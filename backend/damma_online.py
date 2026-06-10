"""
damma_online.py — Real-time multiplayer Dominoes (Damma) backend.
================================================================
Provides:

  REST:
    POST   /api/damma/rooms                 → create a private/public room
    POST   /api/damma/rooms/{rid}/join      → join an existing room
    POST   /api/damma/rooms/{rid}/leave     → leave a room
    POST   /api/damma/rooms/{rid}/ready     → toggle ready flag
    POST   /api/damma/rooms/{rid}/start     → host starts the match
    GET    /api/damma/rooms                 → list public open rooms
    GET    /api/damma/rooms/{rid}           → room snapshot

  WebSocket:
    WS     /api/damma/ws/{rid}              → live room + game updates

Protocol (JSON messages, both directions):

  → Client → Server
    {"type":"ready","ready":true}
    {"type":"play","tile_id":"3-5","side":"left"}
    {"type":"draw"}
    {"type":"pass"}
    {"type":"chat","text":"hi"}
    {"type":"heartbeat"}

  ← Server → Client
    {"type":"room",  "room":{...}}              # full snapshot
    {"type":"state", "state":{...}, "hand":[...]}  # per-player view
    {"type":"move",  "by":"player2", "move":{...}}
    {"type":"chat",  "from":"...", "text":"..."}
    {"type":"error", "message":"..."}
    {"type":"end",   "winner":"player3", "scores":{...}}

Notes
-----
* Game-engine logic is intentionally minimal here — it is a thin SERVER
  twin of the same rules used by the Expo client. Authoritative state is
  kept server-side so cheating clients can't desync.
* When a player disconnects mid-match the slot is marked `disconnected`
  for 30 s; if they do not return the slot is replaced by an automatic
  "auto-play" stand-in that draws / passes / plays first legal tile.
* Hands are PRIVATE — only the owner ever receives them in `state.hand`.
"""
from __future__ import annotations

import asyncio
import random
import time
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends
from pydantic import BaseModel

# Mount this in server.py with:  app.include_router(damma_online_router)
damma_online_router = APIRouter(prefix="/api/damma", tags=["damma-online"])

# ── In-memory room store ────────────────────────────────────────────────────
# For production this should move to Redis / Mongo. The current shape uses
# plain dicts so it is easy to swap.
ROOMS: Dict[str, "Room"] = {}
TURN_SECONDS = 60
DISCONNECT_GRACE_SEC = 30

# ── Matchmaking queue (Phase 3.5) ───────────────────────────────────────────
# Users who clicked "Find any match" wait here until enough players are
# available, then a room is auto-created and they are bulk-assigned to it.
# Keyed by num_players (2 or 4). Each entry: {user_id, name, avatar, joined_at}
QUEUE: Dict[int, List[Dict[str, Any]]] = {2: [], 4: []}
# user_id → {"rid": str, "matched_at": ts} once they are matched into a room.
QUEUE_RESULTS: Dict[str, Dict[str, Any]] = {}
# How long to wait for more players before filling the rest with bots
QUEUE_FILL_WITH_BOTS_AFTER = 25.0  # seconds


# ── Domino engine — server-authoritative duplicate of client rules ──────────
def _full_set() -> List[Dict[str, int]]:
    tiles = []
    for l in range(0, 7):
        for r in range(l, 7):
            tiles.append({"id": f"{l}-{r}", "left": l, "right": r})
    return tiles


def _new_game(num_players: int) -> Dict[str, Any]:
    deck = _full_set()
    random.shuffle(deck)
    hand_size = 7 if num_players == 2 else 5
    hands: Dict[str, List[Dict[str, int]]] = {}
    for i in range(num_players):
        pid = f"player{i + 1}"
        hands[pid] = [deck.pop() for _ in range(hand_size)]
    return {
        "phase": "playing",
        "board": [],
        "left_end": None,
        "right_end": None,
        "hands": hands,
        "boneyard": deck,
        "scores": {f"player{i+1}": 0 for i in range(num_players)},
        "turn": "player1",
        "num_players": num_players,
    }


def _playable_sides(state: Dict[str, Any], tile: Dict[str, int]) -> List[str]:
    if not state["board"]:
        return ["left"]
    sides = []
    if tile["left"] == state["left_end"] or tile["right"] == state["left_end"]:
        sides.append("left")
    if tile["left"] == state["right_end"] or tile["right"] == state["right_end"]:
        sides.append("right")
    return sides


def _apply_move(state: Dict[str, Any], pid: str, tile_id: str, side: str) -> bool:
    hand = state["hands"].get(pid, [])
    tile = next((t for t in hand if t["id"] == tile_id), None)
    if tile is None:
        return False
    if state["turn"] != pid:
        return False
    sides = _playable_sides(state, tile)
    if side not in sides:
        return False
    # First tile
    if not state["board"]:
        state["board"].append(tile)
        state["left_end"] = tile["left"]
        state["right_end"] = tile["right"]
    elif side == "left":
        match = state["left_end"]
        placed = tile if tile["right"] == match else {"id": tile["id"], "left": tile["right"], "right": tile["left"]}
        state["board"].insert(0, placed)
        state["left_end"] = placed["left"]
    else:  # right
        match = state["right_end"]
        placed = tile if tile["left"] == match else {"id": tile["id"], "left": tile["right"], "right": tile["left"]}
        state["board"].append(placed)
        state["right_end"] = placed["right"]
    state["hands"][pid] = [t for t in hand if t["id"] != tile_id]
    # Check win
    if not state["hands"][pid]:
        state["phase"] = "game_over"
        state["winner"] = pid
        state["scores"][pid] += 1
        return True
    _advance_turn(state)
    return True


def _draw_tile(state: Dict[str, Any], pid: str) -> bool:
    if state["turn"] != pid or not state["boneyard"]:
        return False
    state["hands"][pid].append(state["boneyard"].pop())
    return True


def _pass_turn(state: Dict[str, Any], pid: str) -> bool:
    if state["turn"] != pid:
        return False
    _advance_turn(state)
    return True


def _advance_turn(state: Dict[str, Any]) -> None:
    n = state["num_players"]
    cur = int(state["turn"].replace("player", ""))
    nxt = (cur % n) + 1
    state["turn"] = f"player{nxt}"


# ── Room model ──────────────────────────────────────────────────────────────
class Slot:
    __slots__ = ("pid", "user_id", "name", "avatar", "is_bot", "ready", "ws", "disconnect_at")

    def __init__(self, pid: str):
        self.pid = pid
        self.user_id: Optional[str] = None
        self.name: str = ""
        self.avatar: str = ""
        self.is_bot: bool = False
        self.ready: bool = False
        self.ws: Optional[WebSocket] = None
        self.disconnect_at: Optional[float] = None  # epoch when ws dropped


class Room:
    def __init__(self, rid: str, host_id: str, host_name: str, host_avatar: str,
                 visibility: str = "public", num_players: int = 4):
        self.rid = rid
        self.visibility = visibility  # "public" | "private"
        self.num_players = num_players
        self.slots: List[Slot] = [Slot(f"player{i+1}") for i in range(num_players)]
        # Host takes slot 1
        self.slots[0].user_id = host_id
        self.slots[0].name = host_name
        self.slots[0].avatar = host_avatar
        self.slots[0].ready = True
        self.host_id = host_id
        self.state: Optional[Dict[str, Any]] = None
        self.started_at: Optional[float] = None
        self.turn_deadline: Optional[float] = None
        self.created_at: float = time.time()

    def snapshot(self) -> Dict[str, Any]:
        return {
            "rid": self.rid,
            "visibility": self.visibility,
            "num_players": self.num_players,
            "host_id": self.host_id,
            "slots": [{
                "pid": s.pid, "user_id": s.user_id, "name": s.name,
                "avatar": s.avatar, "is_bot": s.is_bot, "ready": s.ready,
                "online": s.ws is not None and s.disconnect_at is None,
            } for s in self.slots],
            "phase": (self.state or {}).get("phase", "lobby"),
            "turn": (self.state or {}).get("turn"),
            "scores": (self.state or {}).get("scores", {}),
            "tile_counts": {s.pid: len((self.state or {}).get("hands", {}).get(s.pid, [])) for s in self.slots} if self.state else {},
            "boneyard_count": len((self.state or {}).get("boneyard", [])) if self.state else 0,
            "turn_seconds_left": max(0, int((self.turn_deadline or 0) - time.time())) if self.turn_deadline else TURN_SECONDS,
        }

    def find_open_slot(self) -> Optional[Slot]:
        for s in self.slots:
            if s.user_id is None and not s.is_bot:
                return s
        return None

    def slot_for_user(self, user_id: str) -> Optional[Slot]:
        for s in self.slots:
            if s.user_id == user_id:
                return s
        return None

    async def broadcast(self, message: Dict[str, Any], exclude_pid: Optional[str] = None) -> None:
        for s in self.slots:
            if exclude_pid and s.pid == exclude_pid:
                continue
            if s.ws is None:
                continue
            try:
                await s.ws.send_json(message)
            except Exception:
                pass

    async def send_state(self) -> None:
        """Send each connected player their private state view."""
        for s in self.slots:
            if s.ws is None or self.state is None:
                continue
            try:
                snap = self.snapshot()
                # Hide other players' tiles; include own hand.
                hand = self.state["hands"].get(s.pid, [])
                await s.ws.send_json({
                    "type": "state",
                    "room": snap,
                    "hand": hand,
                    "board": self.state["board"],
                    "left_end": self.state["left_end"],
                    "right_end": self.state["right_end"],
                })
            except Exception:
                pass

    def all_filled_and_ready(self) -> bool:
        return all(s.user_id or s.is_bot for s in self.slots) and all(s.ready for s in self.slots)


# ── REST endpoints ──────────────────────────────────────────────────────────
class CreateRoomBody(BaseModel):
    host_id: str
    host_name: str
    host_avatar: str = "avatar_ninja"
    visibility: str = "public"
    num_players: int = 4


@damma_online_router.post("/rooms")
async def create_room(body: CreateRoomBody) -> Dict[str, Any]:
    rid = uuid.uuid4().hex[:8]
    room = Room(rid, body.host_id, body.host_name, body.host_avatar, body.visibility, body.num_players)
    ROOMS[rid] = room
    return {"rid": rid, "room": room.snapshot()}


class JoinBody(BaseModel):
    user_id: str
    name: str
    avatar: str = "avatar_ninja"


@damma_online_router.post("/rooms/{rid}/join")
async def join_room(rid: str, body: JoinBody) -> Dict[str, Any]:
    room = ROOMS.get(rid)
    if room is None:
        raise HTTPException(404, "room not found")
    if room.slot_for_user(body.user_id) is not None:
        return {"room": room.snapshot()}
    slot = room.find_open_slot()
    if slot is None:
        raise HTTPException(400, "room full")
    slot.user_id = body.user_id
    slot.name = body.name
    slot.avatar = body.avatar
    slot.ready = False
    await room.broadcast({"type": "room", "room": room.snapshot()})
    return {"room": room.snapshot()}


@damma_online_router.post("/rooms/{rid}/leave")
async def leave_room(rid: str, body: JoinBody) -> Dict[str, Any]:
    room = ROOMS.get(rid)
    if room is None:
        raise HTTPException(404, "room not found")
    slot = room.slot_for_user(body.user_id)
    if slot is None:
        return {"ok": True}
    slot.user_id = None
    slot.name = ""
    slot.avatar = ""
    slot.ready = False
    slot.ws = None
    await room.broadcast({"type": "room", "room": room.snapshot()})
    # Auto-close if host leaves
    if body.user_id == room.host_id:
        ROOMS.pop(rid, None)
    return {"ok": True}


@damma_online_router.post("/rooms/{rid}/ready")
async def set_ready(rid: str, body: JoinBody, ready: bool = True) -> Dict[str, Any]:
    room = ROOMS.get(rid)
    if room is None:
        raise HTTPException(404, "room not found")
    slot = room.slot_for_user(body.user_id)
    if slot is None:
        raise HTTPException(400, "not in room")
    slot.ready = ready
    await room.broadcast({"type": "room", "room": room.snapshot()})
    return {"room": room.snapshot()}


@damma_online_router.post("/rooms/{rid}/start")
async def start_room(rid: str, body: JoinBody) -> Dict[str, Any]:
    room = ROOMS.get(rid)
    if room is None:
        raise HTTPException(404, "room not found")
    if body.user_id != room.host_id:
        raise HTTPException(403, "only host can start")
    # Fill remaining empties with bots
    for s in room.slots:
        if s.user_id is None and not s.is_bot:
            s.is_bot = True
            s.name = f"🤖 Bot {s.pid[-1]}"
            s.avatar = "BOT"
            s.ready = True
    if not room.all_filled_and_ready():
        raise HTTPException(400, "not all players ready")
    room.state = _new_game(room.num_players)
    room.started_at = time.time()
    room.turn_deadline = time.time() + TURN_SECONDS
    await room.broadcast({"type": "room", "room": room.snapshot()})
    await room.send_state()
    return {"room": room.snapshot()}


@damma_online_router.get("/rooms")
async def list_rooms() -> Dict[str, Any]:
    rooms = [
        r.snapshot()
        for r in ROOMS.values()
        if r.visibility == "public" and r.state is None
    ]
    return {"rooms": rooms}


@damma_online_router.get("/rooms/{rid}")
async def get_room(rid: str) -> Dict[str, Any]:
    room = ROOMS.get(rid)
    if room is None:
        raise HTTPException(404, "room not found")
    return {"room": room.snapshot()}


# ── Matchmaking queue endpoints ─────────────────────────────────────────────
class QueueJoinBody(BaseModel):
    user_id: str
    name: str
    avatar: str = "avatar_ninja"
    num_players: int = 4


@damma_online_router.post("/queue/join")
async def queue_join(body: QueueJoinBody) -> Dict[str, Any]:
    """Add user to the matchmaking queue. Returns immediately with queue
    position; the client should then poll /queue/status until matched."""
    np = body.num_players if body.num_players in (2, 4) else 4
    q = QUEUE[np]
    # De-duplicate: if user already queued, refresh their entry instead.
    q[:] = [e for e in q if e["user_id"] != body.user_id]
    QUEUE_RESULTS.pop(body.user_id, None)
    entry = {
        "user_id": body.user_id,
        "name": body.name,
        "avatar": body.avatar,
        "joined_at": time.time(),
        "num_players": np,
    }
    q.append(entry)
    # Try to drain the queue immediately
    await _drain_queue(np)
    return {
        "position": next((i + 1 for i, e in enumerate(q) if e["user_id"] == body.user_id), 0),
        "queue_size": len(q),
        "num_players": np,
    }


@damma_online_router.post("/queue/leave")
async def queue_leave(body: QueueJoinBody) -> Dict[str, Any]:
    for np in (2, 4):
        QUEUE[np][:] = [e for e in QUEUE[np] if e["user_id"] != body.user_id]
    QUEUE_RESULTS.pop(body.user_id, None)
    return {"ok": True}


@damma_online_router.get("/queue/status")
async def queue_status(user_id: str) -> Dict[str, Any]:
    """Poll endpoint. Returns:
       - {matched: true, rid: "..."} when the user has been placed in a room
       - {matched: false, position, queue_size, num_players, wait_seconds}
    """
    if user_id in QUEUE_RESULTS:
        match = QUEUE_RESULTS[user_id]
        return {"matched": True, "rid": match["rid"]}
    # Try a drain pass; opportunistic
    for np in (2, 4):
        await _drain_queue(np)
        if user_id in QUEUE_RESULTS:
            return {"matched": True, "rid": QUEUE_RESULTS[user_id]["rid"]}
    # Not yet matched — find position
    for np in (2, 4):
        q = QUEUE[np]
        for i, e in enumerate(q):
            if e["user_id"] == user_id:
                return {
                    "matched": False,
                    "position": i + 1,
                    "queue_size": len(q),
                    "num_players": np,
                    "wait_seconds": int(time.time() - e["joined_at"]),
                }
    return {"matched": False, "position": 0, "queue_size": 0, "num_players": 0}


async def _drain_queue(num_players: int) -> None:
    """Pop the first `num_players` from the queue and create a room for them.
    If there are fewer than `num_players` BUT the oldest has been waiting
    longer than `QUEUE_FILL_WITH_BOTS_AFTER`, fill the remaining slots with
    bots so the impatient players get a game."""
    q = QUEUE[num_players]
    if not q:
        return
    enough = len(q) >= num_players
    oldest_wait = time.time() - q[0]["joined_at"]
    if not enough and oldest_wait < QUEUE_FILL_WITH_BOTS_AFTER:
        return

    # Take up to `num_players` entries
    picks = q[:num_players]
    del q[:num_players]

    # Create a room owned by the FIRST player
    host = picks[0]
    rid = uuid.uuid4().hex[:8]
    room = Room(rid, host["user_id"], host["name"], host["avatar"], "public", num_players)
    ROOMS[rid] = room
    # Place the rest into open slots
    for entry in picks[1:]:
        slot = room.find_open_slot()
        if slot is None:
            break
        slot.user_id = entry["user_id"]
        slot.name = entry["name"]
        slot.avatar = entry["avatar"]
        slot.ready = True
    # Fill any remaining empties with bots (when timeout-driven)
    for s in room.slots:
        if s.user_id is None and not s.is_bot:
            s.is_bot = True
            s.name = f"🤖 Bot {s.pid[-1]}"
            s.avatar = "BOT"
            s.ready = True
    # Auto-start (everyone is ready by construction)
    room.state = _new_game(room.num_players)
    room.started_at = time.time()
    room.turn_deadline = time.time() + TURN_SECONDS

    # Publish results so each picked user's /queue/status call resolves
    matched_at = time.time()
    for entry in picks:
        QUEUE_RESULTS[entry["user_id"]] = {"rid": rid, "matched_at": matched_at}


# ── WebSocket: live updates + moves ─────────────────────────────────────────
@damma_online_router.websocket("/ws/{rid}")
async def damma_ws(ws: WebSocket, rid: str, user_id: str = "") -> None:
    await ws.accept()
    room = ROOMS.get(rid)
    if room is None:
        await ws.send_json({"type": "error", "message": "room not found"})
        await ws.close()
        return
    slot = room.slot_for_user(user_id)
    if slot is None:
        await ws.send_json({"type": "error", "message": "not in room"})
        await ws.close()
        return
    # Bind WS to slot (handles reconnect cleanly)
    slot.ws = ws
    slot.disconnect_at = None
    await ws.send_json({"type": "room", "room": room.snapshot()})
    if room.state is not None:
        await room.send_state()
    try:
        while True:
            msg = await ws.receive_json()
            await _handle_message(room, slot, msg)
    except WebSocketDisconnect:
        # Mark slot for grace-period auto-replacement
        slot.disconnect_at = time.time()
        slot.ws = None
        await room.broadcast({"type": "room", "room": room.snapshot()})
        asyncio.create_task(_disconnect_watcher(room, slot))


async def _handle_message(room: Room, slot: Slot, msg: Dict[str, Any]) -> None:
    typ = msg.get("type")
    if typ == "heartbeat":
        return
    if typ == "chat":
        await room.broadcast({
            "type": "chat",
            "from": slot.name,
            "text": str(msg.get("text", ""))[:200],
        })
        return
    if room.state is None or room.state.get("phase") != "playing":
        return
    if room.state["turn"] != slot.pid:
        await slot.ws.send_json({"type": "error", "message": "not your turn"})  # type: ignore
        return
    ok = False
    if typ == "play":
        ok = _apply_move(room.state, slot.pid, str(msg.get("tile_id", "")), str(msg.get("side", "left")))
    elif typ == "draw":
        ok = _draw_tile(room.state, slot.pid)
    elif typ == "pass":
        ok = _pass_turn(room.state, slot.pid)
    if not ok:
        await slot.ws.send_json({"type": "error", "message": "illegal move"})  # type: ignore
        return
    room.turn_deadline = time.time() + TURN_SECONDS
    await room.send_state()
    if room.state.get("phase") == "game_over":
        await room.broadcast({
            "type": "end",
            "winner": room.state.get("winner"),
            "scores": room.state["scores"],
        })


async def _disconnect_watcher(room: Room, slot: Slot) -> None:
    """If the player does not return within DISCONNECT_GRACE_SEC, convert
    their slot into a bot stand-in so the match can continue."""
    await asyncio.sleep(DISCONNECT_GRACE_SEC)
    if slot.ws is not None:  # they reconnected
        return
    if room.state is None or room.state.get("phase") != "playing":
        return
    slot.is_bot = True
    slot.name = f"🤖 {slot.name} (bot)"
    await room.broadcast({"type": "room", "room": room.snapshot()})
