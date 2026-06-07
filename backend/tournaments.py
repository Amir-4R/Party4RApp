"""
Party4R — Tournaments (skeleton)
Provides the data model + read endpoints. Bracket management + match
scheduling are TODO but signatures are ready so the frontend can wire UI now.

Collections:
    tournaments      — metadata + status (draft / open / running / finished)
    tournament_entries — user signups (one per user per tournament)
    tournament_matches — head-to-head matches (filled by bracket generator)
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field


class CreateTournamentBody(BaseModel):
    title: str = Field(min_length=3, max_length=80)
    description: Optional[str] = Field(default=None, max_length=500)
    max_players: int = Field(ge=2, le=256, default=16)
    starts_at: Optional[datetime] = None


async def ensure_indexes(db):
    await db.tournaments.create_index("status")
    await db.tournament_entries.create_index([("tournament_id", 1), ("user_id", 1)], unique=True)
    await db.tournament_matches.create_index([("tournament_id", 1), ("round", 1)])


def register_routes(api: APIRouter, db, current_user_dep):

    @api.get("/tournaments")
    async def list_tournaments(status: Optional[str] = None, limit: int = 30):
        filter_q = {} if not status else {"status": status}
        cursor = db.tournaments.find(filter_q, {"_id": 0}).sort("created_at", -1).limit(min(limit, 100))
        return {"items": [t async for t in cursor]}

    @api.post("/tournaments", status_code=201)
    async def create_tournament(body: CreateTournamentBody, user=Depends(current_user_dep)):
        doc = {
            "id": uuid.uuid4().hex,
            "title": body.title,
            "description": body.description,
            "max_players": body.max_players,
            "starts_at": body.starts_at.isoformat() if body.starts_at else None,
            "created_by": user["id"],
            "created_at": datetime.utcnow().isoformat(),
            "status": "open",  # draft → open → running → finished
            "participants": [],
        }
        await db.tournaments.insert_one(doc)
        return doc

    @api.post("/tournaments/{tournament_id}/join")
    async def join_tournament(tournament_id: str, user=Depends(current_user_dep)):
        t = await db.tournaments.find_one({"id": tournament_id})
        if not t:
            raise HTTPException(404, "Tournament not found")
        if t.get("status") != "open":
            raise HTTPException(400, "Tournament not accepting entries")
        if user["id"] in t.get("participants", []):
            return {"ok": True, "already_joined": True}
        if len(t.get("participants", [])) >= t["max_players"]:
            raise HTTPException(409, "Tournament full")
        await db.tournaments.update_one(
            {"id": tournament_id},
            {"$addToSet": {"participants": user["id"]}},
        )
        return {"ok": True}

    @api.get("/tournaments/{tournament_id}")
    async def get_tournament(tournament_id: str):
        t = await db.tournaments.find_one({"id": tournament_id}, {"_id": 0})
        if not t:
            raise HTTPException(404, "Tournament not found")
        return t

    # TODO(tournaments): bracket generation + match management endpoints.
    # POST /tournaments/{id}/start  → generate single-elimination bracket
    # POST /tournaments/{id}/matches/{match_id}/score  → record result
