"""
Party4R — Global Leaderboard
Returns top users ranked by Honor Points, by total shared watch time, and by
rooms hosted. Lightweight, read-only — just $sort + $limit on indexed fields.

This module is fully implemented (not a stub) because the data already exists.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional


def register_routes(api: APIRouter, db, current_user_dep):
    """Mount /api/leaderboard/* routes."""

    @api.get("/leaderboard/honor")
    async def top_honor(limit: int = 50):
        limit = max(1, min(limit, 100))
        cursor = db.users.find(
            {"honor": {"$exists": True}},
            {"_id": 0, "id": 1, "username": 1, "nickname": 1, "avatar": 1, "honor": 1},
        ).sort("honor", -1).limit(limit)
        items = []
        rank = 0
        async for u in cursor:
            rank += 1
            u["rank"] = rank
            items.append(u)
        return {"items": items, "total": len(items)}

    @api.get("/leaderboard/watch_time")
    async def top_watch_time(limit: int = 50):
        limit = max(1, min(limit, 100))
        # Aggregate total_seconds across all sessions stored on the user doc.
        pipeline = [
            {"$match": {"total_seconds": {"$exists": True}}},
            {"$sort": {"total_seconds": -1}},
            {"$limit": limit},
            {"$project": {"_id": 0, "id": 1, "username": 1, "nickname": 1, "avatar": 1, "total_seconds": 1}},
        ]
        items = []
        rank = 0
        async for u in db.users.aggregate(pipeline):
            rank += 1
            u["rank"] = rank
            items.append(u)
        return {"items": items, "total": len(items)}

    @api.get("/leaderboard/hosts")
    async def top_hosts(limit: int = 50):
        """Top users by number of rooms they've hosted."""
        limit = max(1, min(limit, 100))
        pipeline = [
            {"$group": {"_id": "$host_id", "rooms_hosted": {"$sum": 1}}},
            {"$sort": {"rooms_hosted": -1}},
            {"$limit": limit},
            {"$lookup": {
                "from": "users",
                "localField": "_id",
                "foreignField": "id",
                "as": "user",
            }},
            {"$unwind": "$user"},
            {"$project": {
                "_id": 0,
                "id": "$user.id",
                "username": "$user.username",
                "nickname": "$user.nickname",
                "avatar": "$user.avatar",
                "rooms_hosted": 1,
            }},
        ]
        items = []
        rank = 0
        async for u in db.rooms.aggregate(pipeline):
            rank += 1
            u["rank"] = rank
            items.append(u)
        return {"items": items, "total": len(items)}
