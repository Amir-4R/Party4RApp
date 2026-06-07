"""
Party4R — Tournaments (FULL implementation)
============================================
Single-elimination tournament engine with auto-bracket generation, match
scoring, and auto-advancement of winners.

Status lifecycle:
    open      → players can join
    running   → bracket generated, matches in progress
    finished  → winner crowned

Collections
-----------
    tournaments         metadata + participants[] + status + winner
    tournament_matches  one document per head-to-head match in the bracket

Bracket math
------------
For N participants we pad to the next power of 2 with "BYE" slots so the
bracket is always perfectly binary.  Total matches = participants - 1.
Round numbers start at 1 (first round) and end at log2(bracketSize).
"""
from __future__ import annotations

import math
import uuid
import random
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field


# ----------------------------------------------------------------------------
# Pydantic models
# ----------------------------------------------------------------------------
class CreateTournamentBody(BaseModel):
    title: str = Field(min_length=3, max_length=80)
    description: Optional[str] = Field(default=None, max_length=500)
    max_players: int = Field(ge=2, le=64, default=8)
    starts_at: Optional[datetime] = None
    prize: Optional[str] = Field(default=None, max_length=120)


class SubmitScoreBody(BaseModel):
    winner_id: str = Field(min_length=1)
    score_p1: int = Field(ge=0, le=999, default=0)
    score_p2: int = Field(ge=0, le=999, default=0)


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
async def ensure_indexes(db):
    await db.tournaments.create_index("status")
    await db.tournament_matches.create_index([("tournament_id", 1), ("round", 1), ("match_number", 1)])


def _next_power_of_two(n: int) -> int:
    return 1 if n <= 1 else 2 ** math.ceil(math.log2(n))


def _build_bracket(player_ids: List[str]) -> List[Dict[str, Any]]:
    """Pad with BYE slots and lay out a single-elimination bracket.

    Round 1 contains all initial matches.  Subsequent rounds are created with
    empty player slots that get filled when winners are reported.

    BYEs are distributed so every BYE is paired with a real player — this way
    no BYE-vs-BYE matches are ever created (they would be unplayable).
    """
    bracket_size = _next_power_of_two(len(player_ids))
    rounds_count = int(math.log2(bracket_size))

    # Shuffle for fair seeding
    randomized = player_ids[:]
    random.shuffle(randomized)

    players_count = len(randomized)
    byes_count = bracket_size - players_count
    # Number of R1 pairs = bracket_size / 2
    # Give the first `byes_count` pairs each one BYE (paired with a real player)
    # so those top-seeded players auto-advance to round 2.
    padded: List[Optional[str]] = []
    pair_count = bracket_size // 2
    real_idx = 0
    for pair_idx in range(pair_count):
        if pair_idx < byes_count:
            # Real player vs BYE  → auto-advance the real player
            padded.append(randomized[real_idx]); real_idx += 1
            padded.append(None)
        else:
            # Two real players
            padded.append(randomized[real_idx]); real_idx += 1
            padded.append(randomized[real_idx]); real_idx += 1

    matches: List[Dict[str, Any]] = []
    match_number = 0

    # Round 1 — populate from padded list
    round1_matches = []
    for i in range(0, bracket_size, 2):
        match_number += 1
        p1, p2 = padded[i], padded[i + 1]
        # If one side is BYE, auto-advance the other
        winner_id = None
        finished = False
        if p1 is None and p2 is not None:
            winner_id = p2
            finished = True
        elif p2 is None and p1 is not None:
            winner_id = p1
            finished = True
        elif p1 is None and p2 is None:
            # Should not happen with our pairing logic, but treat as dead
            finished = True

        m = {
            "id": uuid.uuid4().hex,
            "round": 1,
            "match_number": match_number,
            "player1_id": p1,
            "player2_id": p2,
            "winner_id": winner_id,
            "score_p1": 0,
            "score_p2": 0,
            "finished": finished,
            "scheduled_at": None,
        }
        matches.append(m)
        round1_matches.append(m)

    # Subsequent rounds — placeholders that fill in as winners are reported
    prev_round = round1_matches
    for r in range(2, rounds_count + 1):
        this_round = []
        for i in range(0, len(prev_round), 2):
            match_number += 1
            # Pre-populate from already-finished predecessor matches
            p1 = prev_round[i].get("winner_id") if prev_round[i]["finished"] else None
            p2 = prev_round[i + 1].get("winner_id") if prev_round[i + 1]["finished"] else None
            # Auto-advance if one side is BYE chain
            winner_id = None
            finished = False
            if p1 and p2 is None and prev_round[i + 1]["finished"]:
                winner_id = p1
                finished = True
            elif p2 and p1 is None and prev_round[i]["finished"]:
                winner_id = p2
                finished = True

            m = {
                "id": uuid.uuid4().hex,
                "round": r,
                "match_number": match_number,
                "player1_id": p1,
                "player2_id": p2,
                "winner_id": winner_id,
                "score_p1": 0,
                "score_p2": 0,
                "finished": finished,
                "scheduled_at": None,
            }
            this_round.append(m)
        matches.extend(this_round)
        prev_round = this_round

    return matches


async def _enrich_participants(db, participant_ids: List[str]) -> List[dict]:
    """Fetch public user info for each participant."""
    if not participant_ids:
        return []
    cursor = db.users.find(
        {"id": {"$in": participant_ids}},
        {"_id": 0, "id": 1, "username": 1, "nickname": 1, "avatar": 1, "avatar_image": 1, "honor": 1},
    )
    return [u async for u in cursor]


# ----------------------------------------------------------------------------
# Router
# ----------------------------------------------------------------------------
def register_routes(api: APIRouter, db, current_user_dep):

    @api.get("/tournaments")
    async def list_tournaments(status: Optional[str] = None, limit: int = 30):
        filter_q: Dict[str, Any] = {}
        if status:
            filter_q["status"] = status
        cursor = (
            db.tournaments.find(filter_q, {"_id": 0})
            .sort("created_at", -1)
            .limit(min(limit, 100))
        )
        items = []
        async for t in cursor:
            items.append({
                "id": t["id"],
                "title": t["title"],
                "description": t.get("description"),
                "status": t["status"],
                "max_players": t["max_players"],
                "participants_count": len(t.get("participants", [])),
                "prize": t.get("prize"),
                "starts_at": t.get("starts_at"),
                "created_by": t.get("created_by"),
                "created_at": t.get("created_at"),
                "winner_id": t.get("winner_id"),
            })
        return {"items": items, "total": len(items)}

    @api.post("/tournaments", status_code=201)
    async def create_tournament(
        body: CreateTournamentBody, user=Depends(current_user_dep)
    ):
        doc = {
            "id": uuid.uuid4().hex,
            "title": body.title,
            "description": body.description,
            "max_players": body.max_players,
            "starts_at": body.starts_at.isoformat() if body.starts_at else None,
            "prize": body.prize,
            "created_by": user["id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "open",
            "participants": [user["id"]],  # creator auto-joins
            "winner_id": None,
        }
        await db.tournaments.insert_one(doc)
        # Return a copy without _id
        doc.pop("_id", None)
        return doc

    @api.get("/tournaments/{tournament_id}")
    async def get_tournament(tournament_id: str):
        t = await db.tournaments.find_one({"id": tournament_id}, {"_id": 0})
        if not t:
            raise HTTPException(404, "Tournament not found")
        # Enrich participants with public info
        t["participants_info"] = await _enrich_participants(db, t.get("participants", []))
        host = await db.users.find_one({"id": t["created_by"]}, {"_id": 0, "id": 1, "username": 1, "nickname": 1, "avatar": 1})
        t["host"] = host
        if t.get("winner_id"):
            w = await db.users.find_one({"id": t["winner_id"]}, {"_id": 0, "id": 1, "username": 1, "nickname": 1, "avatar": 1})
            t["winner"] = w
        return t

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

    @api.post("/tournaments/{tournament_id}/leave")
    async def leave_tournament(tournament_id: str, user=Depends(current_user_dep)):
        t = await db.tournaments.find_one({"id": tournament_id})
        if not t:
            raise HTTPException(404, "Tournament not found")
        if t.get("status") != "open":
            raise HTTPException(400, "Cannot leave a tournament after it starts")
        if user["id"] == t["created_by"]:
            raise HTTPException(400, "Host cannot leave their own tournament")
        await db.tournaments.update_one(
            {"id": tournament_id},
            {"$pull": {"participants": user["id"]}},
        )
        return {"ok": True}

    @api.post("/tournaments/{tournament_id}/start")
    async def start_tournament(tournament_id: str, user=Depends(current_user_dep)):
        t = await db.tournaments.find_one({"id": tournament_id})
        if not t:
            raise HTTPException(404, "Tournament not found")
        if user["id"] != t["created_by"]:
            raise HTTPException(403, "Only the host can start the tournament")
        if t.get("status") != "open":
            raise HTTPException(400, f"Tournament already {t['status']}")
        if len(t.get("participants", [])) < 2:
            raise HTTPException(400, "Need at least 2 players to start")

        # Generate bracket
        matches = _build_bracket(t["participants"])
        for m in matches:
            m["tournament_id"] = tournament_id
            m["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.tournament_matches.insert_many(matches)

        # If only 1 real player (others were BYEs), crown immediately
        last_match = matches[-1]
        winner_id = last_match["winner_id"] if last_match["finished"] else None

        await db.tournaments.update_one(
            {"id": tournament_id},
            {
                "$set": {
                    "status": "finished" if winner_id else "running",
                    "started_at": datetime.now(timezone.utc).isoformat(),
                    "winner_id": winner_id,
                    "rounds_count": int(math.log2(_next_power_of_two(len(t["participants"])))),
                }
            },
        )
        return {"ok": True, "matches_count": len(matches), "winner_id": winner_id}

    @api.get("/tournaments/{tournament_id}/bracket")
    async def get_bracket(tournament_id: str):
        t = await db.tournaments.find_one({"id": tournament_id}, {"_id": 0})
        if not t:
            raise HTTPException(404, "Tournament not found")
        cursor = db.tournament_matches.find(
            {"tournament_id": tournament_id}, {"_id": 0}
        ).sort([("round", 1), ("match_number", 1)])
        matches = [m async for m in cursor]
        # Enrich with player info
        all_player_ids = list({
            pid
            for m in matches
            for pid in [m.get("player1_id"), m.get("player2_id")]
            if pid
        })
        users = {u["id"]: u for u in await _enrich_participants(db, all_player_ids)}
        for m in matches:
            m["player1"] = users.get(m.get("player1_id"))
            m["player2"] = users.get(m.get("player2_id"))
        # Group by round
        rounds_dict: Dict[int, List[dict]] = {}
        for m in matches:
            rounds_dict.setdefault(m["round"], []).append(m)
        rounds = [
            {"round": r, "matches": rounds_dict[r]}
            for r in sorted(rounds_dict.keys())
        ]
        return {
            "tournament_id": tournament_id,
            "status": t.get("status"),
            "winner_id": t.get("winner_id"),
            "rounds": rounds,
        }

    @api.post("/tournaments/{tournament_id}/matches/{match_id}/score")
    async def submit_match_score(
        tournament_id: str,
        match_id: str,
        body: SubmitScoreBody,
        user=Depends(current_user_dep),
    ):
        t = await db.tournaments.find_one({"id": tournament_id})
        if not t:
            raise HTTPException(404, "Tournament not found")
        if t.get("status") != "running":
            raise HTTPException(400, "Tournament not running")
        if user["id"] != t["created_by"]:
            raise HTTPException(403, "Only the host can submit match results")

        match = await db.tournament_matches.find_one(
            {"id": match_id, "tournament_id": tournament_id}
        )
        if not match:
            raise HTTPException(404, "Match not found")
        if match.get("finished"):
            raise HTTPException(400, "Match already finished")

        # Validate winner
        if body.winner_id not in (match.get("player1_id"), match.get("player2_id")):
            raise HTTPException(400, "Winner must be one of the match players")

        # Update match
        await db.tournament_matches.update_one(
            {"id": match_id},
            {
                "$set": {
                    "winner_id": body.winner_id,
                    "score_p1": body.score_p1,
                    "score_p2": body.score_p2,
                    "finished": True,
                    "finished_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )

        # Advance winner into next round's appropriate slot
        next_round = match["round"] + 1
        next_match_number = (match["match_number"] + 1) // 2  # only correct within round

        # Find next match by position relative to current round
        # round1 matches are 1..N/2 → next round is 1..N/4
        # We need to locate the right match in next round.
        round_matches_cursor = db.tournament_matches.find(
            {"tournament_id": tournament_id, "round": match["round"]},
            {"_id": 0, "id": 1, "match_number": 1},
        ).sort("match_number", 1)
        round_matches = [r async for r in round_matches_cursor]
        # Position of this match within its round (0-based)
        pos_in_round = next(
            (i for i, r in enumerate(round_matches) if r["id"] == match_id), 0
        )
        next_pos_in_round = pos_in_round // 2
        slot = "player1_id" if pos_in_round % 2 == 0 else "player2_id"

        next_round_cursor = db.tournament_matches.find(
            {"tournament_id": tournament_id, "round": next_round},
            {"_id": 0, "id": 1},
        ).sort("match_number", 1)
        next_round_matches = [r async for r in next_round_cursor]

        winner_id = body.winner_id
        if next_round_matches and next_pos_in_round < len(next_round_matches):
            next_match_id = next_round_matches[next_pos_in_round]["id"]
            await db.tournament_matches.update_one(
                {"id": next_match_id},
                {"$set": {slot: body.winner_id}},
            )
        else:
            # No next round → this was the final → crown tournament winner
            await db.tournaments.update_one(
                {"id": tournament_id},
                {
                    "$set": {
                        "status": "finished",
                        "winner_id": winner_id,
                        "finished_at": datetime.now(timezone.utc).isoformat(),
                    }
                },
            )
            # Award honor points to winner (small celebration boost)
            try:
                await db.users.update_one(
                    {"id": winner_id}, {"$inc": {"honor": 50}}
                )
            except Exception:
                pass

        return {"ok": True, "winner_id": body.winner_id}

    @api.delete("/tournaments/{tournament_id}", status_code=204)
    async def delete_tournament(tournament_id: str, user=Depends(current_user_dep)):
        t = await db.tournaments.find_one({"id": tournament_id})
        if not t:
            raise HTTPException(404, "Tournament not found")
        if user["id"] != t["created_by"]:
            raise HTTPException(403, "Only the host can delete the tournament")
        if t.get("status") == "running":
            raise HTTPException(400, "Cannot delete a tournament in progress")
        await db.tournaments.delete_one({"id": tournament_id})
        await db.tournament_matches.delete_many({"tournament_id": tournament_id})
        return None
