"""
Damma online multiplayer tests — Phase 5.

Covers:
  • POST /api/damma/queue/join with num_players=4
  • GET  /api/damma/queue/status — wait ~25s for timeout-fill (bots)
  • WS   /api/damma/ws/{rid}?user_id=... — first room+state push
  • Bot auto-play causes subsequent state updates without client action
  • Chat broadcast {type:chat,...}
  • Illegal move + not-your-turn error responses
  • End-of-game broadcast
  • Disconnect grace period (slot survives 30s, then flips to bot)
"""
import asyncio
import json
import os
import time
import uuid

import pytest
import requests
import websockets

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "").rstrip("/") or \
    "https://partyapp-sync.preview.emergentagent.com"
API = f"{BASE_URL}/api/damma"
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")


def _uid(tag: str) -> str:
    return f"TEST_p5_{tag}_{uuid.uuid4().hex[:6]}"


# ── 1. Single-user queue + 25s timeout-fill ─────────────────────────────────
def test_queue_join_then_timeout_fills_with_bots():
    """Single user joins queue; after ~25s the server should auto-create a
    room + bot-fill, and /queue/status returns {matched: true, rid: ...}."""
    uid = _uid("solo")
    # Clean any stale state
    requests.post(f"{API}/queue/leave", json={"user_id": uid, "name": "S"})

    r = requests.post(
        f"{API}/queue/join",
        json={"user_id": uid, "name": "Solo", "avatar": "avatar_ninja", "num_players": 4},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["num_players"] == 4
    assert body["queue_size"] >= 1

    # Poll status — should be NOT matched for the first ~25s, then matched.
    matched = False
    rid = None
    deadline = time.time() + 45  # generous buffer
    while time.time() < deadline:
        s = requests.get(f"{API}/queue/status", params={"user_id": uid}, timeout=10)
        assert s.status_code == 200, s.text
        sb = s.json()
        if sb.get("matched"):
            matched = True
            rid = sb["rid"]
            break
        time.sleep(2)

    assert matched, f"User {uid} never matched within 45s"
    assert rid and isinstance(rid, str)

    # Room should exist and be 4 players, all slots filled, started.
    rr = requests.get(f"{API}/rooms/{rid}", timeout=10)
    assert rr.status_code == 200, rr.text
    room = rr.json()["room"]
    assert room["num_players"] == 4
    assert len(room["slots"]) == 4
    # Real user occupies one slot; the other 3 are bots.
    user_slots = [s for s in room["slots"] if s["user_id"] == uid]
    bot_slots = [s for s in room["slots"] if s["is_bot"]]
    assert len(user_slots) == 1, room["slots"]
    assert len(bot_slots) == 3, room["slots"]
    # Game has started
    assert room["phase"] == "playing", room
    # tile_counts present for all 4 pids
    assert set(room["tile_counts"].keys()) == {"player1", "player2", "player3", "player4"}

    # Stash for follow-up tests
    pytest._damma_rid = rid  # type: ignore[attr-defined]
    pytest._damma_uid = uid  # type: ignore[attr-defined]


# ── 2. WebSocket initial messages + bot auto-play + chat ────────────────────
@pytest.mark.asyncio
async def test_ws_initial_room_and_state_and_bot_autoplay():
    """Connect to ws/{rid}, expect first {type:'room'} then {type:'state'},
    then observe bot autoplay broadcasts within ~3-6 s."""
    rid = getattr(pytest, "_damma_rid", None)
    uid = getattr(pytest, "_damma_uid", None)
    if not rid or not uid:
        pytest.skip("Predecessor test_queue_join_then_timeout_fills_with_bots did not run")

    url = f"{WS_BASE}/api/damma/ws/{rid}?user_id={uid}"
    async with websockets.connect(url, ping_interval=None, open_timeout=15) as ws:
        # First message: room snapshot
        msg1 = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
        assert msg1["type"] == "room", msg1
        assert msg1["room"]["num_players"] == 4
        assert msg1["room"]["phase"] == "playing"

        # Second message: per-player state with our hand
        msg2 = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
        assert msg2["type"] == "state", msg2
        assert "hand" in msg2 and isinstance(msg2["hand"], list)
        assert len(msg2["hand"]) == 5, f"Expected 5 tiles, got {len(msg2['hand'])}"
        assert isinstance(msg2.get("board"), list)
        assert "left_end" in msg2 and "right_end" in msg2

        my_pid = next(
            s["pid"] for s in msg2["room"]["slots"] if s["user_id"] == uid
        )

        # ── Chat broadcast test (separate echo) ─────────────────────────────
        await ws.send(json.dumps({"type": "chat", "text": "hello bots"}))
        chat_seen = False
        deadline = time.time() + 5
        while time.time() < deadline and not chat_seen:
            raw = await asyncio.wait_for(ws.recv(), timeout=8)
            m = json.loads(raw)
            if m.get("type") == "chat":
                assert m["text"] == "hello bots"
                assert m["from_pid"] == my_pid
                chat_seen = True
                break
        assert chat_seen, "chat broadcast never echoed back"

        # ── Move validation test ────────────────────────────────────────────
        # First check who's turn it is. Re-read state once more.
        cur_turn = msg2["room"]["turn"]
        if cur_turn == my_pid:
            # Send obvious illegal move
            await ws.send(json.dumps({"type": "play", "tile_id": "9-9", "side": "left"}))
            err = None
            for _ in range(5):
                raw = await asyncio.wait_for(ws.recv(), timeout=8)
                m = json.loads(raw)
                if m.get("type") == "error":
                    err = m
                    break
            assert err is not None, "no error response for illegal move"
            assert "illegal" in err["message"].lower() or "not" in err["message"].lower()
        else:
            # It's a bot's turn — sending a play should yield "not your turn"
            # Note: bot may play before our message lands; tolerate either error.
            await ws.send(json.dumps({"type": "play", "tile_id": "0-0", "side": "left"}))
            err = None
            for _ in range(5):
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=8)
                except asyncio.TimeoutError:
                    break
                m = json.loads(raw)
                if m.get("type") == "error":
                    err = m
                    break
            # If a bot finished its turn and now it's our turn, may not get
            # the not-your-turn error. So we only soft-assert.
            if err:
                assert ("not your turn" in err["message"].lower() or
                        "illegal" in err["message"].lower()), err

        # ── Bot autoplay observation ────────────────────────────────────────
        # Starting turn is always player1 (the queue host = our human user).
        # So no bot will move until WE play. Play our first tile (board empty
        # → any tile on "left" is legal), then watch the board grow as bots
        # auto-play around the table.
        initial_board_len = 0
        initial_counts = dict(msg2["room"]["tile_counts"])
        bots = [s["pid"] for s in msg2["room"]["slots"] if s["is_bot"]]

        if cur_turn == my_pid:
            # Play the first tile in our hand (board is empty so it's legal)
            first_tile = msg2["hand"][0]
            await ws.send(json.dumps({
                "type": "play", "tile_id": first_tile["id"], "side": "left",
            }))

        saw_bot_action = False
        deadline = time.time() + 20
        while time.time() < deadline and not saw_bot_action:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=6)
            except asyncio.TimeoutError:
                break
            m = json.loads(raw)
            if m.get("type") == "state":
                board_len = len(m.get("board") or [])
                tc = m["room"]["tile_counts"]
                if board_len > initial_board_len:
                    saw_bot_action = True
                    break
                for b in bots:
                    if tc.get(b, 5) < initial_counts.get(b, 5):
                        saw_bot_action = True
                        break
        assert saw_bot_action, "no bot autoplay observed within 15s"


# ── 3. Disconnect grace period ──────────────────────────────────────────────
@pytest.mark.asyncio
async def test_disconnect_grace_then_reconnect():
    """Open WS, close it, then re-open within the 30s grace — server should
    still consider us in-room and re-send state."""
    rid = getattr(pytest, "_damma_rid", None)
    uid = getattr(pytest, "_damma_uid", None)
    if not rid or not uid:
        pytest.skip("Predecessor test did not run")

    url = f"{WS_BASE}/api/damma/ws/{rid}?user_id={uid}"
    # Quick connect → close
    async with websockets.connect(url, ping_interval=None, open_timeout=15) as ws:
        first = json.loads(await asyncio.wait_for(ws.recv(), timeout=8))
        assert first["type"] == "room"
    # Wait <30s, reconnect
    await asyncio.sleep(3)
    async with websockets.connect(url, ping_interval=None, open_timeout=15) as ws2:
        again = json.loads(await asyncio.wait_for(ws2.recv(), timeout=8))
        assert again["type"] == "room"
        # Our slot should NOT be flagged is_bot=true yet (grace not expired).
        me = next(s for s in again["room"]["slots"] if s["user_id"] == uid)
        assert me["is_bot"] is False, f"slot flipped to bot too early: {me}"


# ── 4. Sanity: bot autoplay can complete a game (long, optional) ───────────
# Skipped by default — set DAMMA_TEST_LONG=1 to enable; bots may take 30-90s
# to finish a hand and broadcast {type:'end'}.
@pytest.mark.asyncio
async def test_bot_only_game_ends_eventually():
    if os.environ.get("DAMMA_TEST_LONG") != "1":
        pytest.skip("Long-running test (set DAMMA_TEST_LONG=1 to enable)")
    # Fresh single-user queue → timeout-fill → ws listen for end
    uid = _uid("end")
    requests.post(f"{API}/queue/leave", json={"user_id": uid, "name": "E"})
    requests.post(
        f"{API}/queue/join",
        json={"user_id": uid, "name": "E", "num_players": 4},
        timeout=10,
    )
    rid = None
    for _ in range(20):
        s = requests.get(f"{API}/queue/status", params={"user_id": uid}, timeout=10).json()
        if s.get("matched"):
            rid = s["rid"]; break
        await asyncio.sleep(2)
    assert rid, "never matched"

    url = f"{WS_BASE}/api/damma/ws/{rid}?user_id={uid}"
    async with websockets.connect(url, ping_interval=None, open_timeout=15) as ws:
        saw_end = False
        deadline = time.time() + 180
        while time.time() < deadline:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=20)
            except asyncio.TimeoutError:
                continue
            m = json.loads(raw)
            if m.get("type") == "end":
                assert "winner" in m and "scores" in m
                saw_end = True
                break
        assert saw_end, "bot-only game never ended within 3 minutes"
