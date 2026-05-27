"""
Party4RApp — Phase 4 Voting + Room Settings + YouTube browser helper
=====================================================================
Adds:
- Per-room voting state (vote-to-skip + vote-for-next-video)
- Room voting_mode: "allowed" | "owner_only"
- Active vote tracking with auto-expiry
- Broadcast vote progress over the existing room WebSocket
- REST endpoint to update room voting settings
- /api/youtube/extract endpoint (extract videoId from any YT URL) so the
  frontend WebView browser doesn't need to call the YouTube Data API

Threshold rule from spec:
    required = floor(member_count / 2) + 1
"""
from __future__ import annotations
import os
import time
import uuid
import logging
import re
from datetime import datetime, timezone
from typing import Optional, Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

VOTE_TTL_SECONDS = 30


# --------------------------------------------------------------------------
# In-memory vote tracker (cheap, room-scoped)
# --------------------------------------------------------------------------
class VoteState:
    """One active vote per room (skip or next-video request)."""
    def __init__(self, vote_id: str, kind: str, initiator: str, member_count: int,
                 video_id: Optional[str] = None, video_url: Optional[str] = None,
                 title: Optional[str] = None):
        self.id = vote_id
        self.kind = kind          # "skip" | "next"
        self.initiator = initiator
        self.member_count = member_count
        self.video_id = video_id
        self.video_url = video_url
        self.title = title
        self.casts: Dict[str, bool] = {}   # user_id -> yes/no
        self.created_at = time.time()
        self.expires_at = time.time() + VOTE_TTL_SECONDS

    def required(self) -> int:
        return (self.member_count // 2) + 1

    def yes_count(self) -> int:
        return sum(1 for v in self.casts.values() if v)

    def no_count(self) -> int:
        return sum(1 for v in self.casts.values() if not v)

    def passed(self) -> bool:
        return self.yes_count() >= self.required()

    def expired(self) -> bool:
        return time.time() > self.expires_at

    def public(self) -> dict:
        return {
            "id": self.id,
            "kind": self.kind,
            "initiator": self.initiator,
            "video_id": self.video_id,
            "video_url": self.video_url,
            "title": self.title,
            "yes": self.yes_count(),
            "no": self.no_count(),
            "required": self.required(),
            "member_count": self.member_count,
            "expires_at": self.expires_at,
            "remaining_seconds": max(0, int(self.expires_at - time.time())),
        }


_active_votes: Dict[str, VoteState] = {}   # room_id -> VoteState


def start_vote(room_id: str, kind: str, initiator: str, member_count: int,
               video_id: Optional[str] = None, video_url: Optional[str] = None,
               title: Optional[str] = None) -> Optional[VoteState]:
    """Returns the new vote if started, or None if one is already active."""
    existing = _active_votes.get(room_id)
    if existing and not existing.expired():
        return None
    v = VoteState(str(uuid.uuid4()), kind, initiator, member_count,
                  video_id=video_id, video_url=video_url, title=title)
    # Initiator implicitly votes yes
    v.casts[initiator] = True
    _active_votes[room_id] = v
    return v


def cast_vote(room_id: str, user_id: str, yes: bool) -> Optional[VoteState]:
    v = _active_votes.get(room_id)
    if not v or v.expired():
        return None
    v.casts[user_id] = bool(yes)
    return v


def get_active(room_id: str) -> Optional[VoteState]:
    v = _active_votes.get(room_id)
    if v and v.expired():
        _active_votes.pop(room_id, None)
        return None
    return v


def end_vote(room_id: str):
    _active_votes.pop(room_id, None)


# --------------------------------------------------------------------------
# Models
# --------------------------------------------------------------------------
class RoomSettings(BaseModel):
    voting_mode: Optional[str] = Field(default=None, pattern=r"^(allowed|owner_only)$")
    name: Optional[str] = Field(default=None, max_length=64)


class YouTubeExtract(BaseModel):
    url: str = Field(min_length=10, max_length=300)


# --------------------------------------------------------------------------
# YouTube URL → video ID extractor (no API call)
# --------------------------------------------------------------------------
_YT_PATTERNS = [
    re.compile(r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/|youtube\.com/embed/|youtube\.com/v/)([\w-]{11})"),
]


def extract_video_id(url: str) -> Optional[str]:
    for p in _YT_PATTERNS:
        m = p.search(url)
        if m:
            return m.group(1)
    # Bare 11-char id
    if re.fullmatch(r"[\w-]{11}", url.strip()):
        return url.strip()
    return None


# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------
def register_routes(api: APIRouter, db: AsyncIOMotorDatabase, get_current_user):

    @api.patch("/rooms/{room_id}/settings")
    async def update_room_settings(
        room_id: str,
        req: RoomSettings,
        current: dict = Depends(get_current_user),
    ):
        room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
        if not room:
            raise HTTPException(404, "Room not found")
        if room["host_id"] != current["id"]:
            raise HTTPException(403, "Only the room owner can update settings")
        update = {}
        if req.voting_mode is not None:
            update["voting_mode"] = req.voting_mode
        if req.name is not None:
            update["name"] = req.name.strip()[:64]
        if update:
            await db.rooms.update_one({"id": room_id}, {"$set": update})
        room.update(update)
        return {
            "id": room_id,
            "name": room.get("name"),
            "voting_mode": room.get("voting_mode", "allowed"),
        }

    @api.post("/youtube/extract")
    async def youtube_extract(req: YouTubeExtract, current: dict = Depends(get_current_user)):
        """Extract a video ID from any YouTube URL without calling the Data API."""
        vid = extract_video_id(req.url)
        if not vid:
            raise HTTPException(400, "No YouTube video ID found in URL")
        return {
            "video_id": vid,
            "video_url": f"https://www.youtube.com/watch?v={vid}",
            "embed_url": f"https://www.youtube.com/embed/{vid}",
            "thumbnail": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
        }
