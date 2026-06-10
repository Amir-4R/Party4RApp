import os
import logging
import uuid
import json
import secrets
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Optional, Annotated, Dict, Set

from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Query
from fastapi.security import OAuth2PasswordBearer
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# -----------------------------------------------------------------------------
# Config — all read cleanly from environment with safe production defaults.
# Render injects these via render.yaml / dashboard env vars.
# -----------------------------------------------------------------------------
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "party4r")
JWT_SECRET = os.environ.get("JWT_SECRET") or secrets.token_hex(32)
JWT_ALGO = "HS256"
TOKEN_EXPIRE_HOURS = int(os.environ.get("TOKEN_EXPIRE_HOURS", "168"))  # 1 week
YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "")

# CORS origins: comma-separated env or "*" for fully open (current preview setup)
CORS_ORIGINS_RAW = os.environ.get("CORS_ORIGINS", "*").strip()
_CORS_LIST = [o.strip() for o in CORS_ORIGINS_RAW.split(",") if o.strip()] or ["*"]
ALLOW_CREDENTIALS = "*" not in _CORS_LIST  # browsers reject "*" + credentials

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(
    title="Party4RApp Backend",
    description="Co-watching rooms, friends, real-time sync (WebSockets), YouTube search.",
    version="1.0.0",
)
api = APIRouter(prefix="/api")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

if not os.environ.get("JWT_SECRET"):
    logger.warning(
        "JWT_SECRET not set — generated ephemeral key. Tokens will invalidate on restart."
    )
if MONGO_URL.startswith("mongodb://localhost"):
    logger.warning(
        "MONGO_URL points to localhost — set a real MongoDB Atlas URI in production."
    )


# ============== Models ==============
class SignupRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=6, max_length=128)
    nickname: str = Field(min_length=1, max_length=64)
    avatar: str = Field(min_length=1, max_length=64)


class LoginRequest(BaseModel):
    username: str
    password: str


class UserPublic(BaseModel):
    id: str
    username: str
    nickname: str
    avatar: str
    avatar_image: Optional[str] = None
    bio: Optional[str] = None
    banner_id: Optional[str] = None
    background_image: Optional[str] = None
    badges: list = []
    created_at: Optional[str] = None
    total_seconds: int = 0


class FriendUser(BaseModel):
    id: str
    username: str
    nickname: str
    avatar: str
    avatar_image: Optional[str] = None
    online: bool = False


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class CreateRoomRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    is_public: bool = True
    password: Optional[str] = None
    video_url: Optional[str] = None


class RoomPublic(BaseModel):
    id: str
    name: str
    host_id: str
    host_nickname: str
    host_avatar: str
    is_public: bool
    has_password: bool
    video_url: Optional[str] = None
    member_count: int = 0
    created_at: str


class JoinRoomRequest(BaseModel):
    password: Optional[str] = None


# ============== Helpers ==============
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def decode_token(token: str) -> str:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        return payload["sub"]
    except Exception as e:
        raise ValueError(str(e))


async def get_user_by_id(user_id: str) -> Optional[dict]:
    return await db.users.find_one({"id": user_id}, {"_id": 0})


async def get_current_user(token: Annotated[Optional[str], Depends(oauth2_scheme)]) -> dict:
    if not token:
        raise HTTPException(401, "Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    try:
        user_id = decode_token(token)
    except ValueError:
        raise HTTPException(401, "Invalid token", headers={"WWW-Authenticate": "Bearer"})
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(401, "User not found", headers={"WWW-Authenticate": "Bearer"})
    return user


def user_to_public(u: dict) -> UserPublic:
    return UserPublic(
        id=u["id"],
        username=u["username"],
        nickname=u["nickname"],
        avatar=u["avatar"],
        avatar_image=u.get("avatar_image"),
        bio=u.get("bio"),
        banner_id=u.get("banner_id"),
        background_image=u.get("background_image"),
        badges=u.get("badges", []),
        created_at=u.get("created_at"),
        total_seconds=int(u.get("total_seconds", 0)),
    )


# Track online users by their WS connection count
ONLINE_USERS: Dict[str, int] = {}


def mark_online(uid: str):
    ONLINE_USERS[uid] = ONLINE_USERS.get(uid, 0) + 1


def mark_offline(uid: str):
    n = ONLINE_USERS.get(uid, 0) - 1
    if n <= 0:
        ONLINE_USERS.pop(uid, None)
    else:
        ONLINE_USERS[uid] = n


def is_online(uid: str) -> bool:
    return uid in ONLINE_USERS


def to_friend(u: dict) -> FriendUser:
    return FriendUser(
        id=u["id"],
        username=u["username"],
        nickname=u["nickname"],
        avatar=u["avatar"],
        avatar_image=u.get("avatar_image"),
        online=is_online(u["id"]),
    )


# ============== WebSocket Room Manager ==============
class RoomManager:
    def __init__(self):
        # room_id -> {user_id: WebSocket}
        self.rooms: Dict[str, Dict[str, WebSocket]] = {}
        # room_id -> ordered list of user_ids (join order, for host succession)
        self.join_order: Dict[str, list] = {}
        # room_id -> user dict cache
        self.members: Dict[str, Dict[str, dict]] = {}
        # room_id -> current host user_id
        self.current_host: Dict[str, str] = {}
        # (room_id, user_id) -> connect epoch seconds
        self.connect_time: Dict[tuple, float] = {}

    async def connect(self, room_id: str, user: dict, ws: WebSocket):
        await ws.accept()
        self.rooms.setdefault(room_id, {})[user["id"]] = ws
        self.members.setdefault(room_id, {})[user["id"]] = {
            "id": user["id"], "nickname": user["nickname"], "avatar": user["avatar"]
        }
        order = self.join_order.setdefault(room_id, [])
        if user["id"] not in order:
            order.append(user["id"])
        import time as _t
        self.connect_time[(room_id, user["id"])] = _t.time()

    def pop_session_seconds(self, room_id: str, user_id: str) -> int:
        import time as _t
        start = self.connect_time.pop((room_id, user_id), None)
        if start is None:
            return 0
        return max(0, int(_t.time() - start))

    def get_peer_overlaps(self, room_id: str, user_id: str) -> list:
        """Return [(peer_id, overlap_seconds), ...] for all OTHER members
        currently in the room at the time this user leaves.

        Overlap = now - max(my_connect_time, peer_connect_time)
        Used to track shared-time between pairs of friends co-watching.
        """
        import time as _t
        now = _t.time()
        my_start = self.connect_time.get((room_id, user_id))
        if my_start is None:
            return []
        peers = []
        for peer_id in list(self.rooms.get(room_id, {}).keys()):
            if peer_id == user_id:
                continue
            peer_start = self.connect_time.get((room_id, peer_id))
            if peer_start is None:
                continue
            overlap = max(0, int(now - max(my_start, peer_start)))
            if overlap > 0:
                peers.append((peer_id, overlap))
        return peers

    def disconnect(self, room_id: str, user_id: str) -> bool:
        """Returns True if room became empty and should be destroyed."""
        empty = False
        if room_id in self.rooms:
            self.rooms[room_id].pop(user_id, None)
            self.members.get(room_id, {}).pop(user_id, None)
            order = self.join_order.get(room_id, [])
            if user_id in order:
                order.remove(user_id)
            if not self.rooms[room_id]:
                self.rooms.pop(room_id, None)
                self.members.pop(room_id, None)
                self.join_order.pop(room_id, None)
                self.current_host.pop(room_id, None)
                empty = True
        return empty

    def set_host(self, room_id: str, user_id: str):
        self.current_host[room_id] = user_id

    def get_host(self, room_id: str) -> Optional[str]:
        return self.current_host.get(room_id)

    def next_host(self, room_id: str) -> Optional[str]:
        order = self.join_order.get(room_id, [])
        return order[0] if order else None

    async def broadcast(self, room_id: str, payload: dict, exclude_user: Optional[str] = None):
        msg = json.dumps(payload)
        conns = list(self.rooms.get(room_id, {}).items())
        for uid, ws in conns:
            if exclude_user and uid == exclude_user:
                continue
            try:
                await ws.send_text(msg)
            except Exception:
                pass

    def get_members(self, room_id: str) -> list:
        return list(self.members.get(room_id, {}).values())

    def member_count(self, room_id: str) -> int:
        return len(self.rooms.get(room_id, {}))


manager = RoomManager()


# ============== Auth Routes ==============
@api.get("/")
async def root():
    return {"message": "PartyApp API"}


@api.post("/auth/signup", response_model=TokenResponse, status_code=201)
async def signup(req: SignupRequest):
    existing = await db.users.find_one({"username": req.username})
    if existing:
        raise HTTPException(400, "Username already taken")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "username": req.username,
        "password_hash": hash_password(req.password),
        "nickname": req.nickname,
        "avatar": req.avatar,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    token = create_token(user_id)
    return TokenResponse(access_token=token, user=user_to_public(doc))


@api.post("/auth/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    user = await db.users.find_one({"username": req.username}, {"_id": 0})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Incorrect username or password")
    token = create_token(user["id"])
    return TokenResponse(access_token=token, user=user_to_public(user))


@api.get("/auth/me", response_model=UserPublic)
async def me(current: Annotated[dict, Depends(get_current_user)]):
    return user_to_public(current)


@api.patch("/auth/profile", response_model=UserPublic)
async def update_profile(
    nickname: Optional[str] = None,
    avatar: Optional[str] = None,
    avatar_image: Optional[str] = None,
    bio: Optional[str] = None,
    banner_id: Optional[str] = None,
    background_image: Optional[str] = None,
    badge: Optional[str] = None,
    current: dict = Depends(get_current_user),
):
    updates = {}
    if nickname is not None:
        updates["nickname"] = nickname[:64]
    if avatar is not None:
        updates["avatar"] = avatar
    if avatar_image is not None:
        # base64 data URI capped at ~700KB
        if len(avatar_image) > 720_000:
            raise HTTPException(400, "Avatar image too large (max ~500KB)")
        updates["avatar_image"] = avatar_image
    if bio is not None:
        updates["bio"] = bio[:280]
    if banner_id is not None:
        updates["banner_id"] = banner_id
    if background_image is not None:
        # Empty string explicitly clears the custom profile background.
        if background_image == "":
            updates["background_image"] = None
        else:
            # base64 data URI capped at ~900KB (background is wider than avatar)
            if len(background_image) > 920_000:
                raise HTTPException(400, "Background image too large (max ~650KB)")
            updates["background_image"] = background_image
    if badge is not None:
        # toggle badge in/out of badges array
        existing = current.get("badges", [])
        if badge in existing:
            existing.remove(badge)
        else:
            existing.append(badge)
        updates["badges"] = existing
    if updates:
        await db.users.update_one({"id": current["id"]}, {"$set": updates})
        current.update(updates)
    return user_to_public(current)


# ============== Users / Friends ==============
@api.get("/users/search", response_model=list[FriendUser])
async def users_search(q: str, current: dict = Depends(get_current_user)):
    q = q.strip()
    if not q or len(q) < 2:
        return []
    pattern = {"$regex": q, "$options": "i"}
    users = await db.users.find(
        {
            "$and": [
                {"id": {"$ne": current["id"]}},
                {"$or": [{"username": pattern}, {"nickname": pattern}]},
            ]
        },
        {"_id": 0},
    ).limit(30).to_list(30)
    return [to_friend(u) for u in users]


@api.get("/friends")
async def list_friends(current: dict = Depends(get_current_user)):
    friend_ids = current.get("friends", [])
    in_ids = current.get("friend_requests_in", [])
    out_ids = current.get("friend_requests_out", [])

    async def resolve(ids: list) -> list:
        if not ids:
            return []
        users = await db.users.find({"id": {"$in": ids}}, {"_id": 0}).to_list(200)
        return [to_friend(u).model_dump() for u in users]

    return {
        "friends": await resolve(friend_ids),
        "incoming": await resolve(in_ids),
        "outgoing": await resolve(out_ids),
    }


@api.post("/friends/request/{target_id}")
async def friend_request_send(target_id: str, current: dict = Depends(get_current_user)):
    if target_id == current["id"]:
        raise HTTPException(400, "Cannot friend yourself")
    target = await db.users.find_one({"id": target_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "User not found")
    if target_id in current.get("friends", []):
        return {"ok": True, "status": "already_friends"}
    if target_id in current.get("friend_requests_out", []):
        return {"ok": True, "status": "already_requested"}
    if target_id in current.get("friend_requests_in", []):
        # They already requested us → auto-accept
        return await friend_request_accept(target_id, current)
    await db.users.update_one(
        {"id": current["id"]}, {"$addToSet": {"friend_requests_out": target_id}}
    )
    await db.users.update_one(
        {"id": target_id}, {"$addToSet": {"friend_requests_in": current["id"]}}
    )
    return {"ok": True, "status": "sent"}


@api.post("/friends/accept/{requester_id}")
async def friend_request_accept(
    requester_id: str, current: dict = Depends(get_current_user)
):
    if requester_id not in current.get("friend_requests_in", []):
        raise HTTPException(400, "No pending request from this user")
    await db.users.update_one(
        {"id": current["id"]},
        {
            "$pull": {"friend_requests_in": requester_id},
            "$addToSet": {"friends": requester_id},
        },
    )
    await db.users.update_one(
        {"id": requester_id},
        {
            "$pull": {"friend_requests_out": current["id"]},
            "$addToSet": {"friends": current["id"]},
        },
    )
    return {"ok": True, "status": "accepted"}


@api.post("/friends/reject/{requester_id}")
async def friend_request_reject(
    requester_id: str, current: dict = Depends(get_current_user)
):
    await db.users.update_one(
        {"id": current["id"]}, {"$pull": {"friend_requests_in": requester_id}}
    )
    await db.users.update_one(
        {"id": requester_id}, {"$pull": {"friend_requests_out": current["id"]}}
    )
    return {"ok": True}


@api.delete("/friends/{friend_id}")
async def friend_remove(friend_id: str, current: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current["id"]}, {"$pull": {"friends": friend_id}}
    )
    await db.users.update_one(
        {"id": friend_id}, {"$pull": {"friends": current["id"]}}
    )
    return {"ok": True}


# ============== Room Routes ==============
def room_to_public(r: dict) -> RoomPublic:
    return RoomPublic(
        id=r["id"],
        name=r["name"],
        host_id=r["host_id"],
        host_nickname=r.get("host_nickname", ""),
        host_avatar=r.get("host_avatar", ""),
        is_public=r["is_public"],
        has_password=bool(r.get("password")),
        video_url=r.get("video_url"),
        member_count=manager.member_count(r["id"]),
        created_at=r["created_at"],
    )


@api.post("/rooms", response_model=RoomPublic, status_code=201)
async def create_room(req: CreateRoomRequest, current: dict = Depends(get_current_user)):
    room_id = str(uuid.uuid4())
    doc = {
        "id": room_id,
        "name": req.name,
        "host_id": current["id"],
        "host_nickname": current["nickname"],
        "host_avatar": current["avatar"],
        "is_public": req.is_public,
        "password": req.password if not req.is_public else None,
        "video_url": req.video_url,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.rooms.insert_one(doc)
    doc.pop("_id", None)
    return room_to_public(doc)


@api.get("/rooms/public", response_model=list[RoomPublic])
async def list_public_rooms(current: dict = Depends(get_current_user)):
    rooms = await db.rooms.find({"is_public": True}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [room_to_public(r) for r in rooms]


@api.get("/rooms/{room_id}", response_model=RoomPublic)
async def get_room(room_id: str, current: dict = Depends(get_current_user)):
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(404, "Room not found")
    return room_to_public(room)


@api.post("/rooms/{room_id}/join")
async def join_room(room_id: str, req: JoinRoomRequest, current: dict = Depends(get_current_user)):
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(404, "Room not found")
    if not room["is_public"] and room.get("password"):
        if req.password != room["password"]:
            raise HTTPException(403, "Incorrect room password")
    return {"ok": True, "room": room_to_public(room)}


@api.post("/rooms/{room_id}/video")
async def set_video(room_id: str, video_url: str, current: dict = Depends(get_current_user)):
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(404, "Room not found")
    if room["host_id"] != current["id"]:
        raise HTTPException(403, "Only host can change video")
    await db.rooms.update_one({"id": room_id}, {"$set": {"video_url": video_url}})
    return {"ok": True}


# ============== YouTube Search ==============
import urllib.parse
import httpx


@api.get("/youtube/search")
async def youtube_search(q: str, current: dict = Depends(get_current_user)):
    if not YOUTUBE_API_KEY:
        raise HTTPException(503, "YouTube API key not configured")
    if not q.strip():
        return {"items": []}
    url = (
        "https://www.googleapis.com/youtube/v3/search"
        f"?part=snippet&type=video&maxResults=15&safeSearch=moderate"
        f"&q={urllib.parse.quote(q)}&key={YOUTUBE_API_KEY}"
    )
    async with httpx.AsyncClient(timeout=10.0) as cx:
        r = await cx.get(url)
        if r.status_code != 200:
            raise HTTPException(502, f"YouTube API error: {r.text[:200]}")
        data = r.json()
    items = []
    for it in data.get("items", []):
        vid = it.get("id", {}).get("videoId")
        sn = it.get("snippet", {})
        if not vid:
            continue
        items.append(
            {
                "video_id": vid,
                "title": sn.get("title"),
                "channel": sn.get("channelTitle"),
                "thumbnail": sn.get("thumbnails", {}).get("medium", {}).get("url"),
                "published_at": sn.get("publishedAt"),
            }
        )
    return {"items": items}


# ============== WebSocket ==============
@app.websocket("/api/ws/rooms/{room_id}")
async def room_ws(websocket: WebSocket, room_id: str, token: str = Query(...)):
    # Authenticate
    try:
        user_id = decode_token(token)
    except ValueError:
        await websocket.close(code=1008)
        return
    user = await get_user_by_id(user_id)
    if not user:
        await websocket.close(code=1008)
        return

    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        await websocket.close(code=1008)
        return

    is_host = room["host_id"] == user["id"]
    creator_id = room["host_id"]
    await manager.connect(room_id, user, websocket)

    # Host succession: creator returns → reclaim; otherwise current host stays
    cur = manager.get_host(room_id)
    if cur is None:
        manager.set_host(room_id, user["id"])  # first connection = host
    elif user["id"] == creator_id and cur != creator_id:
        manager.set_host(room_id, creator_id)  # creator reclaims
        await manager.broadcast(room_id, {"type": "host_changed", "host_id": creator_id})
    is_host = manager.get_host(room_id) == user["id"]

    # Notify others + send init
    await manager.broadcast(
        room_id,
        {
            "type": "user_joined",
            "user": {"id": user["id"], "nickname": user["nickname"], "avatar": user["avatar"]},
            "members": manager.get_members(room_id),
        },
        exclude_user=user["id"],
    )
    await websocket.send_text(
        json.dumps(
            {
                "type": "init",
                "is_host": is_host,
                "host_id": manager.get_host(room_id),
                "creator_id": creator_id,
                "video_url": room.get("video_url"),
                "members": manager.get_members(room_id),
                "self": {"id": user["id"], "nickname": user["nickname"], "avatar": user["avatar"]},
            }
        )
    )

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue
            mtype = data.get("type")

            if mtype == "chat":
                text = (data.get("text") or "").strip()
                image = data.get("image")  # base64 data URI (optional)
                if image and len(image) > 720_000:
                    # ~500KB binary after base64 overhead
                    continue
                if not text and not image:
                    continue
                # Phase 5 — Word filter (soft censor only)
                bot_warning = False
                if text:
                    text, bot_warning = censor_text(text)
                payload = {
                    "type": "chat",
                    "text": text[:500] if text else "",
                    "user_id": user["id"],
                    "nickname": user["nickname"],
                    "avatar": user["avatar"],
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                if image:
                    payload["image"] = image
                if bot_warning:
                    payload["bot_flag"] = True
                await manager.broadcast(room_id, payload)
            elif mtype == "playback":
                # Only current host can issue playback commands
                if manager.get_host(room_id) != user["id"]:
                    continue
                event = data.get("event")
                if event not in ("play", "pause", "seek", "change_video"):
                    continue
                payload = {
                    "type": "playback",
                    "event": event,
                    "time": data.get("time"),
                    "video_url": data.get("video_url"),
                    "host_id": user["id"],
                }
                if event == "change_video" and data.get("video_url"):
                    await db.rooms.update_one(
                        {"id": room_id}, {"$set": {"video_url": data["video_url"]}}
                    )
                await manager.broadcast(room_id, payload)
            elif mtype == "transfer_host":
                # Only current host can transfer
                if manager.get_host(room_id) != user["id"]:
                    continue
                target = data.get("to")
                if target and target in manager.rooms.get(room_id, {}):
                    manager.set_host(room_id, target)
                    await manager.broadcast(room_id, {"type": "host_changed", "host_id": target})
            elif mtype == "vote_start":
                room_doc = await db.rooms.find_one({"id": room_id}, {"_id": 0, "voting_mode": 1})
                mode = (room_doc or {}).get("voting_mode", "allowed")
                if mode == "owner_only" and manager.get_host(room_id) != user["id"]:
                    continue
                kind = data.get("kind")
                if kind not in ("skip", "next"):
                    continue
                v = _vote_start(
                    room_id, kind, user["id"], manager.member_count(room_id),
                    video_id=data.get("video_id"),
                    video_url=data.get("video_url"),
                    title=data.get("title"),
                )
                if v:
                    await manager.broadcast(room_id, {"type": "vote_state", "vote": v.public()})
            elif mtype == "vote_cast":
                v = _vote_cast(room_id, user["id"], bool(data.get("yes", False)))
                if not v:
                    continue
                await manager.broadcast(room_id, {"type": "vote_state", "vote": v.public()})
                if v.passed():
                    if v.kind == "skip":
                        # Clear the room's current video and broadcast a change_video
                        # so all clients actually drop to "No video" state.
                        await db.rooms.update_one(
                            {"id": room_id}, {"$set": {"video_url": None}}
                        )
                        await manager.broadcast(room_id, {
                            "type": "playback", "event": "change_video",
                            "video_url": None, "host_id": manager.get_host(room_id),
                        })
                        await manager.broadcast(room_id, {"type": "vote_result", "passed": True, "kind": "skip"})
                    elif v.kind == "next" and (v.video_url or v.video_id):
                        url = v.video_url or f"https://www.youtube.com/watch?v={v.video_id}"
                        await db.rooms.update_one({"id": room_id}, {"$set": {"video_url": url}})
                        await manager.broadcast(room_id, {
                            "type": "playback", "event": "change_video",
                            "video_url": url, "host_id": manager.get_host(room_id),
                        })
                        await manager.broadcast(room_id, {"type": "vote_result", "passed": True, "kind": "next", "video_url": url})
                    _vote_end(room_id)
            elif mtype == "vote_cancel":
                v = _vote_active(room_id)
                if v and (v.initiator == user["id"] or manager.get_host(room_id) == user["id"]):
                    _vote_end(room_id)
                    await manager.broadcast(room_id, {"type": "vote_result", "passed": False, "kind": v.kind, "cancelled": True})
            elif mtype == "state_request":
                # New joiner asks for current playback state — forward to host
                host_ws = manager.rooms.get(room_id, {}).get(room["host_id"])
                if host_ws:
                    try:
                        await host_ws.send_text(
                            json.dumps({"type": "state_request", "from": user["id"]})
                        )
                    except Exception:
                        pass
            elif mtype == "state_response":
                # Host sends current state — relay to specific user
                target = data.get("to")
                if is_host and target:
                    target_ws = manager.rooms.get(room_id, {}).get(target)
                    if target_ws:
                        try:
                            await target_ws.send_text(
                                json.dumps(
                                    {
                                        "type": "playback",
                                        "event": "seek_sync",
                                        "time": data.get("time"),
                                        "playing": data.get("playing"),
                                        "video_url": data.get("video_url"),
                                    }
                                )
                            )
                        except Exception:
                            pass
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.exception("ws error: %s", e)
    finally:
        was_host = manager.get_host(room_id) == user["id"]
        mark_offline(user["id"])
        # Track shared-time with currently-connected peers (Phase 3)
        peer_overlaps = manager.get_peer_overlaps(room_id, user["id"])
        # Track session duration for analytics
        session_secs = manager.pop_session_seconds(room_id, user["id"])
        if session_secs > 0:
            try:
                await db.users.update_one(
                    {"id": user["id"]}, {"$inc": {"total_seconds": session_secs}}
                )
            except Exception:
                pass
        # Persist pair-level shared seconds (upsert per pair)
        for peer_id, overlap_seconds in peer_overlaps:
            if overlap_seconds <= 0:
                continue
            try:
                pair_key = ":".join(sorted([user["id"], peer_id]))
                await db.pair_time.update_one(
                    {"pair": pair_key},
                    {
                        "$inc": {"seconds": int(overlap_seconds)},
                        "$set": {
                            "last_room_id": room_id,
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                        },
                        "$setOnInsert": {
                            "pair": pair_key,
                            "user_ids": sorted([user["id"], peer_id]),
                        },
                    },
                    upsert=True,
                )
            except Exception as e:
                logger.warning("pair_time upsert failed: %s", e)
        empty = manager.disconnect(room_id, user["id"])
        if empty:
            await db.rooms.delete_one({"id": room_id})
        else:
            new_host_id = None
            if was_host:
                new_host_id = manager.next_host(room_id)
                if new_host_id:
                    manager.set_host(room_id, new_host_id)
            await manager.broadcast(
                room_id,
                {
                    "type": "user_left",
                    "user_id": user["id"],
                    "members": manager.get_members(room_id),
                    "new_host_id": new_host_id,
                },
            )
            if new_host_id:
                await manager.broadcast(
                    room_id,
                    {"type": "host_changed", "host_id": new_host_id, "new_host_id": new_host_id},
                )


app.include_router(api)

# ============================================================================
# Phase 3 — Shared Time (pair-level co-watching minutes)
# ============================================================================
@app.get("/api/users/{user_id}/shared_time")
async def get_shared_time(user_id: str, current: dict = Depends(get_current_user)):
    """Return total seconds the current user has co-watched with `user_id`.

    Privacy gate: respects the target user's `shared_time_visibility` field
    from PrivacySettings (everyone | friends | nobody).
    """
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "privacy": 1, "friends": 1})
    if not target:
        raise HTTPException(404, "User not found")
    if user_id != current["id"]:
        vis = (target.get("privacy") or {}).get("shared_time_visibility", "friends")
        if vis == "nobody":
            return {"seconds": 0, "hidden": True}
        if vis == "friends" and user_id not in (current.get("friends") or []):
            return {"seconds": 0, "hidden": True}
    pair_key = ":".join(sorted([current["id"], user_id]))
    row = await db.pair_time.find_one({"pair": pair_key}, {"_id": 0, "seconds": 1})
    return {"seconds": int((row or {}).get("seconds", 0)), "hidden": False}


@app.on_event("startup")
async def _pair_time_indexes():
    try:
        await db.pair_time.create_index("pair", unique=True, name="pair_unique")
        await db.pair_time.create_index("user_ids", name="pair_user_ids")
    except Exception as e:
        logger.warning("pair_time index creation skipped: %s", e)

# ============================================================================
# Phase 2 (Mega Update) — Privacy, Safety, Moderation routes
# Note: these routes register directly on `app` (so they bypass the already-
# included `api` router). They all use the /api prefix explicitly.
# ============================================================================
from privacy_safety import register_routes as _register_phase2, ensure_indexes as _ensure_phase2_indexes  # noqa: E402
from dms import (
    register_routes as _register_dms,
    register_ws as _register_dms_ws,
    ensure_indexes as _ensure_dms_indexes,
)  # noqa: E402
from rooms_voting import (
    register_routes as _register_voting,
    start_vote as _vote_start,
    cast_vote as _vote_cast,
    get_active as _vote_active,
    end_vote as _vote_end,
)  # noqa: E402
from moderation import censor_text  # noqa: E402 — Phase 5 word filter
from notifications import (
    register_routes as _register_push,
    send_dm_push as _send_dm_push,
)  # noqa: E402 — Phase 5 push notifications

# ───────────────────────────────────────────────────────────────────────────
# Phase 9 — Portable / paid-hosting stubs (Google Login, Tournaments,
# Leaderboard, Cloud Sync). These import lazily so a missing optional env
# var doesn't break boot.
# ───────────────────────────────────────────────────────────────────────────
import importlib

# ── Damma online multiplayer (Phase 3) ─────────────────────────────────────
from damma_online import damma_online_router  # noqa: E402
app.include_router(damma_online_router)

def _safe_import(name):
    try:
        return importlib.import_module(name)
    except Exception as e:  # pragma: no cover
        logger.warning("Phase 9 module %s not loaded: %s", name, e)
        return None

_mod_google = _safe_import("google_auth")
_mod_leaderboard = _safe_import("leaderboard")
_mod_tournaments = _safe_import("tournaments")
_mod_cloud_sync = _safe_import("cloud_sync")

# We create a NEW router for phase 2 then include it (works because we include after)
_phase2_router = APIRouter(prefix="/api")
_register_phase2(_phase2_router, db, get_current_user)
app.include_router(_phase2_router)

# Phase 3 — Direct Messages
_dms_router = APIRouter(prefix="/api")
_register_dms(_dms_router, db, get_current_user, push_callback=_send_dm_push)
app.include_router(_dms_router)
_register_dms_ws(app, db, get_user_by_id, decode_token)

# Phase 4 — Room voting + settings
_voting_router = APIRouter(prefix="/api")
_register_voting(_voting_router, db, get_current_user)
app.include_router(_voting_router)

# Phase 5 — Push notification token routes
_push_router = APIRouter(prefix="/api")
_register_push(_push_router, db, get_current_user)
app.include_router(_push_router)

# ───────────────────────────────────────────────────────────────────────────
# Phase 9 — Portable hosting feature stubs.  All four modules are optional;
# they no-op when their env vars / collections aren't ready.
# ───────────────────────────────────────────────────────────────────────────
def _sign_token_for_user(user: dict) -> str:
    """Helper exposed to google_auth for issuing JWTs after Google login."""
    return create_token(user["id"])

_phase9_router = APIRouter(prefix="/api")
if _mod_google:
    _mod_google.register_routes(_phase9_router, db, _sign_token_for_user)
if _mod_leaderboard:
    _mod_leaderboard.register_routes(_phase9_router, db, get_current_user)
if _mod_tournaments:
    _mod_tournaments.register_routes(_phase9_router, db, get_current_user)
if _mod_cloud_sync:
    _mod_cloud_sync.register_routes(_phase9_router, db, get_current_user)
app.include_router(_phase9_router)


@app.on_event("startup")
async def _phase2_startup():
    try:
        await _ensure_phase2_indexes(db)
        await _ensure_dms_indexes(db)
        if _mod_tournaments:
            await _mod_tournaments.ensure_indexes(db)
        if _mod_cloud_sync:
            await _mod_cloud_sync.ensure_indexes(db)
    except Exception as e:
        logger.warning("Phase 2/3/9 index creation skipped: %s", e)


app.add_middleware(
    CORSMiddleware,
    allow_credentials=ALLOW_CREDENTIALS,
    allow_origins=_CORS_LIST,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():  # noqa: F811 — different router (app vs api), intentional second route
    """Plain root for Render healthchecks / uptime monitors."""
    return {"service": "party4r-backend", "status": "ok", "version": app.version}


@app.get("/health")
@app.get("/api/health")
async def health():
    """Lightweight liveness probe — exposed at both /health (legacy Render
    convention) and /api/health (uniform with the rest of the public API,
    used by Docker/K8s healthchecks + reverse proxies)."""
    try:
        await db.command("ping")
        return {"status": "ok", "db": "ok"}
    except Exception as e:
        return {"status": "degraded", "db": str(e)}


# ---------------------------------------------------------------------------
# One-shot download endpoint for the Render deployment bundle.
# Only exposed when /app/dist/party4r-backend-render.zip exists.
# Safe to leave in place — it serves a static file, no DB access.
# ---------------------------------------------------------------------------
from fastapi.responses import FileResponse  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

# Mount the static web export under /api/web/ so it can be tested in any browser
# AND used as the source URL for PWABuilder.com (ingress only forwards /api/*).
_WEB_BUILD = "/app/dist/web-build"
if os.path.exists(_WEB_BUILD):
    app.mount("/api/web", StaticFiles(directory=_WEB_BUILD, html=True), name="web-export")

_DIST_DIR = "/app/dist"
_BUNDLES = {
    "backend.zip": "party4r-backend-render.zip",
    "render-flat.zip": "party4r-render-flat.zip",
    "frontend.zip": "party4r-frontend-eas.zip",
    "full.zip": "party4r-app-full.zip",
    "web-build.zip": "party4r-web-build.zip",
    "android-gradle.zip": "party4r-android-gradle.zip",
    "android-prebuilt.zip": "party4r-android-prebuilt.zip",  # already-prebuilt for Termux
    "mobile-full.zip": "party4r-mobile-full.zip",  # full JS source + prebuilt android/ + bundled JS
    "complete.zip": "party4r-complete.zip",        # frontend + backend + all configs (the ENTIRE app)
    "termux-ready.zip": "party4r-termux-ready.zip", # ready-to-build Termux bundle with BUILD_TERMUX.sh
    "backend-deploy.zip": "party4r-backend-deploy.zip", # backend-only, ready for Render redeploy
}


def _serve_bundle(name: str):
    fname = _BUNDLES.get(name)
    if not fname:
        raise HTTPException(status_code=404, detail="unknown bundle")
    path = os.path.join(_DIST_DIR, fname)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="bundle not built yet")
    return FileResponse(path, media_type="application/zip", filename=fname)


@api.get("/download/backend.zip")
async def download_backend_bundle_api():
    return _serve_bundle("backend.zip")


# ─── Generic source-code download endpoint ──────────────────────────────────
# Lets the user pull text files from /app/exports/. Used to deliver code copies
# (e.g. carrom.txt) directly from the app. Path traversal is blocked.
_EXPORTS_DIR = "/app/exports"


@api.get("/exports/{filename}")
async def download_export_file(filename: str):
    # Reject any path-traversal attempt
    if "/" in filename or "\\" in filename or filename.startswith(".."):
        raise HTTPException(status_code=400, detail="invalid filename")
    path = os.path.join(_EXPORTS_DIR, filename)
    if not os.path.exists(path) or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="file not found")
    # Plain-text payload with a forced download
    return FileResponse(
        path,
        media_type="text/plain; charset=utf-8",
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/download/backend.zip")
async def download_backend_bundle_direct():
    return _serve_bundle("backend.zip")


# Direct-on-app twin for the exports endpoint — needed because @api routes
# added after `app.include_router(api)` are NOT auto-mounted.
@app.get("/api/exports/{filename}")
async def download_export_file_direct(filename: str):
    if "/" in filename or "\\" in filename or filename.startswith(".."):
        raise HTTPException(status_code=400, detail="invalid filename")
    path = os.path.join(_EXPORTS_DIR, filename)
    if not os.path.exists(path) or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="file not found")
    # Pick a sensible media type from the extension
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    media = {
        "zip":  "application/zip",
        "txt":  "text/plain; charset=utf-8",
        "ts":   "text/plain; charset=utf-8",
        "tsx":  "text/plain; charset=utf-8",
        "json": "application/json",
        "md":   "text/markdown; charset=utf-8",
    }.get(ext, "application/octet-stream")
    return FileResponse(
        path,
        media_type=media,
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/download/frontend.zip")
async def download_frontend_bundle_direct():
    return _serve_bundle("frontend.zip")


@app.get("/api/download/mobile-full.zip")
async def download_mobile_full_bundle_direct():
    """Complete bundle for Termux local APK build:
    full JS source + pre-generated android/ + pre-bundled index.android.bundle."""
    return _serve_bundle("mobile-full.zip")


@app.get("/api/download/complete.zip")
async def download_complete_bundle_direct():
    """ENTIRE app source code: frontend + backend + all configs + README.
    Best for archiving the whole project or migrating to a new dev machine."""
    return _serve_bundle("complete.zip")


@app.get("/api/download/termux-ready.zip")
async def download_termux_ready_bundle_direct():
    """Termux-ready bundle: frontend JS + pre-generated android/ folder +
    one-shot BUILD_TERMUX.sh script that installs Android SDK + builds APK.
    The easiest way to build the APK locally on an Android phone."""
    return _serve_bundle("termux-ready.zip")


@app.get("/api/download/backend-deploy.zip")
async def download_backend_deploy_bundle_direct():
    """Backend-only deploy bundle: server.py + dms.py + notifications.py +
    moderation.py + privacy_safety.py + rooms_voting.py + requirements.txt +
    Procfile + DEPLOY_TO_RENDER.md. Drop into a Render GitHub repo + redeploy
    to enable DMs and Push Notifications on production."""
    return _serve_bundle("backend-deploy.zip")


# --- Per-file backend source downloads -------------------------------------
# Lets the user drop individual files straight into their Render repo when
# their entry-point uses a different filename layout (e.g. `main.py`).
_BACKEND_SRC_ROOT = Path(__file__).parent


def _serve_backend_source(filename: str):
    """Serve a single backend source file as a plain-text download."""
    target = _BACKEND_SRC_ROOT / filename
    if not target.exists() or not target.is_file():
        raise HTTPException(404, f"{filename} not found")
    return FileResponse(
        path=str(target),
        media_type="text/x-python" if filename.endswith(".py") else "text/plain",
        filename=filename,
    )


@app.get("/api/source/server.py")
async def source_server_py():
    """Main FastAPI app — registers all routers. Rename to main.py if your
    Render service entrypoint expects that filename."""
    return _serve_backend_source("server.py")


@app.get("/api/source/dms.py")
async def source_dms_py():
    """Direct Messages module — REST + WebSocket + Mongo TTL indexes."""
    return _serve_backend_source("dms.py")


@app.get("/api/source/notifications.py")
async def source_notifications_py():
    """Expo Push Notifications module — POST/DELETE /api/push/token."""
    return _serve_backend_source("notifications.py")


@app.get("/api/source/moderation.py")
async def source_moderation_py():
    """Reports + word filter + Gmail SMTP delivery for admin alerts."""
    return _serve_backend_source("moderation.py")


@app.get("/api/source/privacy_safety.py")
async def source_privacy_safety_py():
    """Block/unblock + privacy settings + presence heartbeat + honor logic."""
    return _serve_backend_source("privacy_safety.py")


@app.get("/api/source/rooms_voting.py")
async def source_rooms_voting_py():
    """Voting mode for rooms — accept/reject host's video changes."""
    return _serve_backend_source("rooms_voting.py")


@app.get("/api/source/requirements.txt")
async def source_requirements_txt():
    """Python pip dependencies, sane versions for Render's Python 3.11."""
    return _serve_backend_source("requirements.txt")


@app.get("/api/source/Procfile")
async def source_procfile():
    """Render web process command — uvicorn server:app …"""
    return _serve_backend_source("Procfile")


@app.get("/api/download/full.zip")
async def download_full_bundle_direct():
    return _serve_bundle("full.zip")


@app.get("/api/download/render-flat.zip")
async def download_render_flat_bundle_direct():
    return _serve_bundle("render-flat.zip")


@app.get("/api/download/main.py")
async def download_main_py():
    """Serve the production main.py (with MONGO_URI) as plain text so it
    can be viewed/copied directly in a mobile browser."""
    path = "/app/dist/main.py"
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="main.py not built yet")
    return FileResponse(
        path,
        media_type="text/plain; charset=utf-8",
        filename="main.py",
    )


@app.get("/api/download/web-build.zip")
async def download_web_build():
    return _serve_bundle("web-build.zip")


@app.get("/api/download/android-gradle.zip")
async def download_android_gradle_bundle():
    return _serve_bundle("android-gradle.zip")


@app.get("/api/download/android-prebuilt.zip")
async def download_android_prebuilt():
    return _serve_bundle("android-prebuilt.zip")


@app.get("/download/backend.zip")
async def download_backend_bundle_root():
    return _serve_bundle("backend.zip")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
