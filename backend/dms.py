"""
Party4RApp — Phase 3 Direct Messaging
======================================
Friend-to-friend DMs with text + image + read receipts + typing indicators
+ message edit/delete + real-time WebSocket fanout.

Storage minimization:
- `dms` collection: one document per message
- TTL auto-purge after 60 days (privacy + storage savings)
- Only stores: id, from, to, text, image (base64 or null), edited, deleted,
  created_at, read_at, ts. No metadata bloat.
"""
from __future__ import annotations
import os
import uuid
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Set, Annotated, List

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

DM_TTL_DAYS = int(os.environ.get("DM_TTL_DAYS", "60"))


# --------------------------------------------------------------------------
# Models
# --------------------------------------------------------------------------
class DMSend(BaseModel):
    text: str = Field(default="", max_length=2000)
    image: Optional[str] = None     # base64 PNG/JPEG, max ~500KB

class DMEdit(BaseModel):
    text: str = Field(min_length=1, max_length=2000)

class DMPublic(BaseModel):
    id: str
    from_id: str
    to_id: str
    text: str = ""
    image: Optional[str] = None
    edited: bool = False
    deleted: bool = False
    created_at: str
    read_at: Optional[str] = None


def _dm_doc_to_public(m: dict) -> DMPublic:
    return DMPublic(
        id=m["id"],
        from_id=m["from"],
        to_id=m["to"],
        text=m.get("text", "") if not m.get("deleted") else "",
        image=m.get("image") if not m.get("deleted") else None,
        edited=bool(m.get("edited", False)),
        deleted=bool(m.get("deleted", False)),
        created_at=m["created_at"],
        read_at=m.get("read_at"),
    )


def _conv_key(a: str, b: str) -> str:
    return ":".join(sorted([a, b]))


# --------------------------------------------------------------------------
# In-memory presence + typing broadcaster
# --------------------------------------------------------------------------
class DMManager:
    def __init__(self):
        # one ws per user (a user can have multiple devices, but we keep simple:
        # single connection per user_id — newer one displaces older)
        self.connections: Dict[str, WebSocket] = {}

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        # Close any pre-existing connection for this user
        old = self.connections.pop(user_id, None)
        if old:
            try:
                await old.close()
            except Exception:
                pass
        self.connections[user_id] = ws

    def disconnect(self, user_id: str, ws: WebSocket):
        if self.connections.get(user_id) is ws:
            self.connections.pop(user_id, None)

    async def send_to(self, user_id: str, payload: dict) -> bool:
        ws = self.connections.get(user_id)
        if not ws:
            return False
        try:
            await ws.send_text(json.dumps(payload))
            return True
        except Exception:
            self.connections.pop(user_id, None)
            return False

    def is_online(self, user_id: str) -> bool:
        return user_id in self.connections


dm_manager = DMManager()


# --------------------------------------------------------------------------
# Index setup
# --------------------------------------------------------------------------
async def ensure_indexes(db: AsyncIOMotorDatabase):
    # TTL — auto delete DMs older than DM_TTL_DAYS
    await db.dms.create_index(
        "created_at_dt", expireAfterSeconds=DM_TTL_DAYS * 86400, name="dm_ttl"
    )
    # Fast lookup of a conversation between two users, ordered by time
    await db.dms.create_index([("conv", 1), ("created_at_dt", -1)], name="dm_conv_idx")
    # Read receipts query
    await db.dms.create_index("to", name="dm_to_idx")
    logger.info("DM indexes ensured (ttl=%dd)", DM_TTL_DAYS)


# --------------------------------------------------------------------------
# Auth/friendship guards
# --------------------------------------------------------------------------
async def _ensure_can_message(db, sender: dict, target_id: str):
    if target_id == sender["id"]:
        raise HTTPException(400, "Cannot DM yourself")
    target = await db.users.find_one({"id": target_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "User not found")
    # Block check (either side)
    if target_id in (sender.get("blocked_users") or []):
        raise HTTPException(403, "You blocked this user")
    if sender["id"] in (target.get("blocked_users") or []):
        raise HTTPException(403, "You are blocked by this user")
    # Optional: enforce friends-only DMs
    if target_id not in (sender.get("friends") or []):
        raise HTTPException(403, "Only friends can DM")
    return target


# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------
def register_routes(
    api: APIRouter,
    db: AsyncIOMotorDatabase,
    get_current_user,
    push_callback=None,
):

    @api.get("/dms")
    async def list_conversations(current: dict = Depends(get_current_user)):
        """Returns one row per friend with the last message + unread count."""
        friend_ids: list = current.get("friends", []) or []
        if not friend_ids:
            return {"conversations": []}

        out = []
        for fid in friend_ids:
            # Last message for this pair
            convkey = _conv_key(current["id"], fid)
            last = await db.dms.find_one(
                {"conv": convkey},
                {"_id": 0},
                sort=[("created_at_dt", -1)],
            )
            unread = await db.dms.count_documents({
                "conv": convkey,
                "to": current["id"],
                "read_at": None,
                "deleted": {"$ne": True},
            })
            friend = await db.users.find_one(
                {"id": fid},
                {"_id": 0, "id": 1, "username": 1, "nickname": 1, "avatar": 1, "avatar_image": 1},
            )
            if not friend:
                continue
            out.append({
                "friend": friend,
                "last_message": _dm_doc_to_public(last).model_dump() if last else None,
                "unread": unread,
                "online": dm_manager.is_online(fid),
            })
        # Sort: most recent activity first
        out.sort(key=lambda r: (r["last_message"] or {}).get("created_at", ""), reverse=True)
        return {"conversations": out}

    @api.get("/dms/{friend_id}")
    async def get_history(
        friend_id: str,
        before: Optional[str] = None,
        limit: int = 50,
        current: dict = Depends(get_current_user),
    ):
        await _ensure_can_message(db, current, friend_id)
        convkey = _conv_key(current["id"], friend_id)
        q: dict = {"conv": convkey}
        if before:
            q["created_at"] = {"$lt": before}
        cursor = db.dms.find(q, {"_id": 0}).sort("created_at_dt", -1).limit(min(limit, 100))
        msgs = [_dm_doc_to_public(m).model_dump() for m in await cursor.to_list(length=limit)]
        msgs.reverse()  # oldest first for UI
        return {"messages": msgs}

    @api.post("/dms/{friend_id}", status_code=201)
    async def send_dm(
        friend_id: str,
        req: DMSend,
        current: dict = Depends(get_current_user),
    ):
        await _ensure_can_message(db, current, friend_id)
        text = (req.text or "").strip()
        image = req.image
        if not text and not image:
            raise HTTPException(400, "Empty message")
        if image and len(image) > 720_000:
            raise HTTPException(400, "Image too large (max ~500KB)")
        now = datetime.now(timezone.utc)
        doc = {
            "id": str(uuid.uuid4()),
            "conv": _conv_key(current["id"], friend_id),
            "from": current["id"],
            "to": friend_id,
            "text": text[:2000],
            "image": image,
            "edited": False,
            "deleted": False,
            "created_at": now.isoformat(),
            "created_at_dt": now,
            "read_at": None,
        }
        await db.dms.insert_one(doc)
        pub = _dm_doc_to_public(doc).model_dump()
        # Push to both sides via WS if online
        await dm_manager.send_to(friend_id, {"type": "dm_new", "message": pub})
        await dm_manager.send_to(current["id"], {"type": "dm_new", "message": pub})
        # Phase 5 — fire an Expo push to the recipient (client handler
        # suppresses delivery while app is in foreground).
        if push_callback:
            try:
                preview = text or ("📷 Photo" if image else "")
                await push_callback(db, current, friend_id, preview)
            except Exception:
                pass
        return pub

    @api.patch("/dms/{message_id}")
    async def edit_dm(
        message_id: str,
        req: DMEdit,
        current: dict = Depends(get_current_user),
    ):
        m = await db.dms.find_one({"id": message_id}, {"_id": 0})
        if not m:
            raise HTTPException(404, "Message not found")
        if m["from"] != current["id"]:
            raise HTTPException(403, "Can only edit your own messages")
        if m.get("deleted"):
            raise HTTPException(400, "Message is deleted")
        await db.dms.update_one(
            {"id": message_id},
            {"$set": {"text": req.text[:2000], "edited": True}},
        )
        m["text"] = req.text[:2000]
        m["edited"] = True
        pub = _dm_doc_to_public(m).model_dump()
        await dm_manager.send_to(m["to"], {"type": "dm_edit", "message": pub})
        await dm_manager.send_to(m["from"], {"type": "dm_edit", "message": pub})
        return pub

    @api.delete("/dms/{message_id}")
    async def delete_dm(message_id: str, current: dict = Depends(get_current_user)):
        m = await db.dms.find_one({"id": message_id}, {"_id": 0})
        if not m:
            raise HTTPException(404, "Message not found")
        if m["from"] != current["id"]:
            raise HTTPException(403, "Can only delete your own messages")
        await db.dms.update_one(
            {"id": message_id},
            {"$set": {"deleted": True, "text": "", "image": None}},
        )
        m["deleted"] = True; m["text"] = ""; m["image"] = None
        pub = _dm_doc_to_public(m).model_dump()
        await dm_manager.send_to(m["to"], {"type": "dm_delete", "message": pub})
        await dm_manager.send_to(m["from"], {"type": "dm_delete", "message": pub})
        return {"ok": True}

    @api.post("/dms/{friend_id}/read")
    async def mark_read(friend_id: str, current: dict = Depends(get_current_user)):
        now = datetime.now(timezone.utc).isoformat()
        result = await db.dms.update_many(
            {"conv": _conv_key(current["id"], friend_id), "to": current["id"], "read_at": None},
            {"$set": {"read_at": now}},
        )
        # Notify sender so the checkmark turns blue in real-time
        await dm_manager.send_to(friend_id, {
            "type": "dm_read",
            "by": current["id"],
            "read_at": now,
            "count": result.modified_count,
        })
        return {"ok": True, "marked": result.modified_count}

    @api.post("/dms/{friend_id}/typing")
    async def typing(friend_id: str, current: dict = Depends(get_current_user)):
        # Stateless typing indicator — just relay an event
        await dm_manager.send_to(friend_id, {
            "type": "dm_typing",
            "from": current["id"],
            "ts": datetime.now(timezone.utc).isoformat(),
        })
        return {"ok": True}


# --------------------------------------------------------------------------
# WebSocket — real-time fanout to a single user's devices
# --------------------------------------------------------------------------
def register_ws(app, db, get_user_by_id, decode_token):
    @app.websocket("/api/ws/dms")
    async def dms_ws(websocket: WebSocket, token: str = Query(...)):
        try:
            user_id = decode_token(token)
        except ValueError:
            await websocket.close(code=1008)
            return
        user = await get_user_by_id(user_id)
        if not user:
            await websocket.close(code=1008)
            return
        await dm_manager.connect(user_id, websocket)
        try:
            # Push presence (online) to all friends
            for fid in user.get("friends", []) or []:
                await dm_manager.send_to(fid, {
                    "type": "presence",
                    "user_id": user_id,
                    "online": True,
                })
            while True:
                # Keep connection alive; read but don't interpret (RPC happens via REST)
                msg = await websocket.receive_text()
                # Could implement client-driven typing pings here, but typing is
                # already covered by REST POST /dms/{id}/typing for simplicity.
                if msg == "ping":
                    await websocket.send_text("pong")
        except WebSocketDisconnect:
            pass
        except Exception as e:
            logger.warning("DM WS error: %s", e)
        finally:
            dm_manager.disconnect(user_id, websocket)
            # Push offline to friends
            for fid in (user.get("friends", []) or []):
                await dm_manager.send_to(fid, {
                    "type": "presence",
                    "user_id": user_id,
                    "online": False,
                })
