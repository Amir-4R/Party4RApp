"""
Party4R — Cloud Sync
Generic per-user key-value store with version control, used to roam settings,
themes, friend list ordering, watched-room history etc. across devices.

Collection: cloud_sync  (one document per user)
  { user_id, payload (dict), version, updated_at }

Client flow:
  1. On login: GET /api/cloud/sync  → get latest payload + version.
  2. Local change: bump local version, write to AsyncStorage.
  3. On idle: POST /api/cloud/sync  with payload + last seen version.
     Server accepts only if posted_version == server_version (optimistic
     concurrency), otherwise returns 409 with the latest.
"""
from __future__ import annotations

from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Any, Dict, Optional


class SyncBody(BaseModel):
    payload: Dict[str, Any] = Field(default_factory=dict)
    base_version: int = Field(ge=0, default=0)


async def ensure_indexes(db):
    await db.cloud_sync.create_index("user_id", unique=True)


def register_routes(api: APIRouter, db, current_user_dep):

    @api.get("/cloud/sync")
    async def get_sync(user=Depends(current_user_dep)):
        doc = await db.cloud_sync.find_one({"user_id": user["id"]}, {"_id": 0})
        if not doc:
            return {"payload": {}, "version": 0, "updated_at": None}
        return doc

    @api.post("/cloud/sync")
    async def put_sync(body: SyncBody, user=Depends(current_user_dep)):
        existing = await db.cloud_sync.find_one({"user_id": user["id"]})
        server_version = (existing or {}).get("version", 0)
        if body.base_version != server_version:
            # Conflict — client is stale. Return current server state for merge.
            return {
                "ok": False,
                "conflict": True,
                "server_version": server_version,
                "payload": (existing or {}).get("payload", {}),
            }
        new_doc = {
            "user_id": user["id"],
            "payload": body.payload,
            "version": server_version + 1,
            "updated_at": datetime.utcnow().isoformat(),
        }
        await db.cloud_sync.update_one(
            {"user_id": user["id"]},
            {"$set": new_doc},
            upsert=True,
        )
        return {"ok": True, "version": new_doc["version"], "updated_at": new_doc["updated_at"]}

    @api.delete("/cloud/sync")
    async def reset_sync(user=Depends(current_user_dep)):
        await db.cloud_sync.delete_one({"user_id": user["id"]})
        return {"ok": True}
