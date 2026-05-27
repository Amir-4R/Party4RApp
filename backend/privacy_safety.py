"""
Party4RApp — Phase 2 Privacy, Safety & Moderation routes
=========================================================
This module is included into the main FastAPI app via:
    from privacy_safety import register_routes
    register_routes(api, db, get_current_user, manager)

Scope (matches user's Mega-Update plan):
- Block / unblock system
- Online status & last-seen with 3-level privacy
- Profile visibility
- Report system → SMTP email to MODERATION_EMAIL
- Honor points (start 100, drop on bad behavior)
- Account deletion (wipe all user data)
- Rate limiting helpers (per-user, per-action)
- TTL-based auto-cleanup of old reports / chat logs

Data minimization principles applied:
- No device fingerprinting
- Reports store only: reporter_id, target_id, category, brief evidence text,
  message_id (optional), room_id (optional), timestamp
- Reports expire 90 days after creation via TTL index
"""
from __future__ import annotations
import os
import time
import uuid
import smtplib
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------
# Configurable thresholds (env-driven, with sane defaults)
# --------------------------------------------------------------------------
HONOR_START = int(os.environ.get("HONOR_START", "100"))
HONOR_PENALTY_REPORT = int(os.environ.get("HONOR_PENALTY_REPORT", "8"))
HONOR_PENALTY_SPAM = int(os.environ.get("HONOR_PENALTY_SPAM", "3"))
HONOR_PENALTY_TOXIC = int(os.environ.get("HONOR_PENALTY_TOXIC", "10"))
HONOR_MIN = 0
HONOR_MAX = 200
REPORT_TTL_DAYS = int(os.environ.get("REPORT_TTL_DAYS", "90"))
CHAT_TTL_DAYS = int(os.environ.get("CHAT_TTL_DAYS", "30"))

MODERATION_EMAIL = os.environ.get("MODERATION_EMAIL", "yemenamer20@gmail.com")
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")

# --------------------------------------------------------------------------
# In-memory rate limiter (per-user, per-action sliding window)
# --------------------------------------------------------------------------
_RATE_BUCKETS: Dict[str, list] = {}


def _rate_key(uid: str, action: str) -> str:
    return f"{uid}:{action}"


def rate_check(uid: str, action: str, max_calls: int, window_seconds: int) -> bool:
    """Return True if the call is allowed, False if rate-limited."""
    now = time.time()
    cutoff = now - window_seconds
    key = _rate_key(uid, action)
    bucket = _RATE_BUCKETS.get(key, [])
    bucket = [t for t in bucket if t > cutoff]
    if len(bucket) >= max_calls:
        _RATE_BUCKETS[key] = bucket
        return False
    bucket.append(now)
    _RATE_BUCKETS[key] = bucket
    return True


def require_rate(uid: str, action: str, max_calls: int, window_seconds: int):
    if not rate_check(uid, action, max_calls, window_seconds):
        raise HTTPException(429, f"Too many {action} requests. Please slow down.")


# --------------------------------------------------------------------------
# Models
# --------------------------------------------------------------------------
class PrivacySettings(BaseModel):
    online_visibility: str = Field(default="everyone")   # "everyone" | "friends" | "nobody"
    last_seen_visibility: str = Field(default="everyone")
    profile_visibility: str = Field(default="everyone")
    shared_time_visibility: str = Field(default="friends")


class PrivacyUpdate(BaseModel):
    online_visibility: Optional[str] = None
    last_seen_visibility: Optional[str] = None
    profile_visibility: Optional[str] = None
    shared_time_visibility: Optional[str] = None


class ReportRequest(BaseModel):
    target_id: str
    category: str = Field(..., pattern=r"^(harassment|threats|spam|abuse|dangerous_links|inappropriate|other)$")
    description: str = Field(min_length=5, max_length=500)
    message_id: Optional[str] = None
    room_id: Optional[str] = None
    evidence: Optional[str] = Field(default=None, max_length=2000)  # tiny excerpt only


class BlockResponse(BaseModel):
    ok: bool
    blocked: bool


VALID_VISIBILITY = {"everyone", "friends", "nobody"}


def can_see(viewer_id: str, target: dict, field: str) -> bool:
    """Determine if viewer can see one of target's privacy-gated fields."""
    if viewer_id == target["id"]:
        return True
    priv = (target.get("privacy") or {}).get(field, "everyone")
    if priv == "nobody":
        return False
    if priv == "friends":
        return target["id"] in (target.get("friends") or []) or viewer_id in (target.get("friends") or [])
    return True


# --------------------------------------------------------------------------
# Honor helpers
# --------------------------------------------------------------------------
def honor_rank(score: int) -> str:
    if score >= 90:
        return "excellent"
    if score >= 70:
        return "good"
    if score >= 40:
        return "neutral"
    if score >= 20:
        return "low_trust"
    return "restricted"


async def apply_honor_delta(db: AsyncIOMotorDatabase, user_id: str, delta: int, reason: str):
    """Apply +/- honor change, clamp 0..200, log it."""
    user = await db.users.find_one({"id": user_id}, {"honor": 1})
    if not user:
        return
    cur = int(user.get("honor", HONOR_START))
    new = max(HONOR_MIN, min(HONOR_MAX, cur + delta))
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"honor": new}, "$push": {"honor_history": {
            "ts": datetime.now(timezone.utc).isoformat(),
            "delta": delta, "reason": reason[:80], "new_score": new,
        }}},
    )


# --------------------------------------------------------------------------
# SMTP report email (best-effort, non-blocking)
# --------------------------------------------------------------------------
def _send_report_email_sync(report: dict, reporter: dict, target: dict):
    """Synchronous helper — runs in a thread to avoid blocking the event loop."""
    if not SMTP_USER or not SMTP_PASS:
        logger.warning("SMTP not configured — report saved to DB only.")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[Party4R Report] {report['category']} — {target.get('username','?')}"
        msg["From"] = SMTP_USER
        msg["To"] = MODERATION_EMAIL
        body = f"""
A new user report has been filed.

Report ID:   {report['id']}
Category:    {report['category']}
Filed:       {report['created_at']}

Reporter:    {reporter.get('username')} ({reporter.get('id')})
Target:      {target.get('username')} ({target.get('id')})
Target honor: {target.get('honor', HONOR_START)}

Room:        {report.get('room_id') or '—'}
Message id:  {report.get('message_id') or '—'}

Description:
{report.get('description','')}

Evidence excerpt (max 2000 chars):
{report.get('evidence','—')}

— Party4RApp moderation pipeline
""".strip()
        msg.attach(MIMEText(body, "plain", "utf-8"))
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10) as s:
            s.login(SMTP_USER, SMTP_PASS)
            s.send_message(msg)
        return True
    except Exception as e:
        logger.exception("SMTP send failed: %s", e)
        return False


async def send_report_email_async(report: dict, reporter: dict, target: dict):
    return await asyncio.get_running_loop().run_in_executor(
        None, _send_report_email_sync, report, reporter, target
    )


# --------------------------------------------------------------------------
# Indexes / TTL setup
# --------------------------------------------------------------------------
async def ensure_indexes(db: AsyncIOMotorDatabase):
    # Reports auto-delete after REPORT_TTL_DAYS
    await db.reports.create_index(
        "created_at_dt", expireAfterSeconds=REPORT_TTL_DAYS * 86400, name="report_ttl"
    )
    # Chat messages auto-delete after CHAT_TTL_DAYS (privacy + storage savings)
    await db.chat_messages.create_index(
        "created_at_dt", expireAfterSeconds=CHAT_TTL_DAYS * 86400, name="chat_ttl"
    )
    # Username lookup
    await db.users.create_index("username", unique=True)
    # Public rooms list
    await db.rooms.create_index([("is_public", 1), ("created_at", -1)])
    # Friend lookups
    await db.users.create_index("friends")
    logger.info(
        "Indexes ensured (report ttl=%dd, chat ttl=%dd)", REPORT_TTL_DAYS, CHAT_TTL_DAYS
    )


# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------
def register_routes(api: APIRouter, db: AsyncIOMotorDatabase, get_current_user):

    # ====== BLOCK SYSTEM ======
    @api.post("/users/block/{target_id}", response_model=BlockResponse)
    async def block_user(target_id: str, current: dict = Depends(get_current_user)):
        if target_id == current["id"]:
            raise HTTPException(400, "Cannot block yourself")
        target = await db.users.find_one({"id": target_id}, {"_id": 0, "id": 1})
        if not target:
            raise HTTPException(404, "User not found")
        # Block = remove from friends + add to blocked list (both sides for symmetry)
        await db.users.update_one(
            {"id": current["id"]},
            {
                "$addToSet": {"blocked_users": target_id},
                "$pull": {
                    "friends": target_id,
                    "friend_requests_in": target_id,
                    "friend_requests_out": target_id,
                },
            },
        )
        await db.users.update_one(
            {"id": target_id},
            {
                "$pull": {
                    "friends": current["id"],
                    "friend_requests_in": current["id"],
                    "friend_requests_out": current["id"],
                }
            },
        )
        return BlockResponse(ok=True, blocked=True)

    @api.post("/users/unblock/{target_id}", response_model=BlockResponse)
    async def unblock_user(target_id: str, current: dict = Depends(get_current_user)):
        await db.users.update_one(
            {"id": current["id"]}, {"$pull": {"blocked_users": target_id}}
        )
        return BlockResponse(ok=True, blocked=False)

    @api.get("/users/blocked")
    async def list_blocked(current: dict = Depends(get_current_user)):
        ids = current.get("blocked_users", []) or []
        if not ids:
            return {"blocked": []}
        rows = await db.users.find(
            {"id": {"$in": ids}},
            {"_id": 0, "id": 1, "username": 1, "nickname": 1, "avatar": 1, "avatar_image": 1},
        ).to_list(200)
        return {"blocked": rows}

    # ====== PRIVACY SETTINGS ======
    @api.get("/users/privacy", response_model=PrivacySettings)
    async def get_privacy(current: dict = Depends(get_current_user)):
        p = current.get("privacy") or {}
        return PrivacySettings(
            online_visibility=p.get("online_visibility", "everyone"),
            last_seen_visibility=p.get("last_seen_visibility", "everyone"),
            profile_visibility=p.get("profile_visibility", "everyone"),
            shared_time_visibility=p.get("shared_time_visibility", "friends"),
        )

    @api.patch("/users/privacy", response_model=PrivacySettings)
    async def update_privacy(req: PrivacyUpdate, current: dict = Depends(get_current_user)):
        update = {}
        for field in ("online_visibility", "last_seen_visibility", "profile_visibility", "shared_time_visibility"):
            v = getattr(req, field)
            if v is not None:
                if v not in VALID_VISIBILITY:
                    raise HTTPException(400, f"invalid visibility for {field}")
                update[f"privacy.{field}"] = v
        if update:
            await db.users.update_one({"id": current["id"]}, {"$set": update})
        u = await db.users.find_one({"id": current["id"]}, {"_id": 0, "privacy": 1})
        p = (u or {}).get("privacy") or {}
        return PrivacySettings(
            online_visibility=p.get("online_visibility", "everyone"),
            last_seen_visibility=p.get("last_seen_visibility", "everyone"),
            profile_visibility=p.get("profile_visibility", "everyone"),
            shared_time_visibility=p.get("shared_time_visibility", "friends"),
        )

    # ====== PRESENCE / LAST SEEN ======
    @api.post("/users/presence/heartbeat")
    async def heartbeat(current: dict = Depends(get_current_user)):
        require_rate(current["id"], "heartbeat", 30, 60)  # max 30/min
        await db.users.update_one(
            {"id": current["id"]},
            {"$set": {"last_seen": datetime.now(timezone.utc).isoformat()}},
        )
        return {"ok": True}

    # ====== REPORTS ======
    @api.post("/reports", status_code=201)
    async def file_report(req: ReportRequest, current: dict = Depends(get_current_user)):
        require_rate(current["id"], "report", 5, 600)  # max 5 / 10 min
        if req.target_id == current["id"]:
            raise HTTPException(400, "Cannot report yourself")
        target = await db.users.find_one({"id": req.target_id}, {"_id": 0})
        if not target:
            raise HTTPException(404, "Target user not found")
        report_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        report = {
            "id": report_id,
            "reporter_id": current["id"],
            "target_id": req.target_id,
            "category": req.category,
            "description": req.description.strip(),
            "evidence": (req.evidence or "")[:2000],
            "message_id": req.message_id,
            "room_id": req.room_id,
            "created_at": now.isoformat(),
            "created_at_dt": now,  # used by TTL index
            "status": "open",
        }
        await db.reports.insert_one(report)
        await apply_honor_delta(db, req.target_id, -HONOR_PENALTY_REPORT, f"reported:{req.category}")
        # Best-effort email (does not block response)
        asyncio.create_task(send_report_email_async(report, current, target))
        return {"ok": True, "report_id": report_id}

    # ====== HONOR ======
    @api.get("/users/{user_id}/honor")
    async def get_honor(user_id: str, current: dict = Depends(get_current_user)):
        u = await db.users.find_one({"id": user_id}, {"_id": 0, "honor": 1})
        if not u:
            raise HTTPException(404, "User not found")
        score = int(u.get("honor", HONOR_START))
        return {"score": score, "rank": honor_rank(score)}

    # ====== ADMIN — moderation panel ============================================
    # Admin access is controlled by the comma-separated ADMIN_USERNAMES env var.
    # If unset/empty, all admin endpoints return 403.
    def require_admin(current: dict = Depends(get_current_user)) -> dict:
        admins = [
            u.strip().lower()
            for u in os.environ.get("ADMIN_USERNAMES", "").split(",")
            if u.strip()
        ]
        if not admins:
            raise HTTPException(403, "Admin panel disabled (ADMIN_USERNAMES not set)")
        if (current.get("username") or "").lower() not in admins:
            raise HTTPException(403, "Admin access required")
        return current

    @api.get("/admin/reports")
    async def list_reports(
        status: str = "open",
        limit: int = 50,
        _: dict = Depends(require_admin),
    ):
        """List reports filtered by status, newest first. Includes minimal
        reporter/target profile info for the moderation UI."""
        limit = max(1, min(limit, 200))
        q = {} if status == "all" else {"status": status}
        rows = await db.reports.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(length=limit)
        # Enrich with reporter + target usernames (best-effort).
        user_ids = {r["reporter_id"] for r in rows} | {r["target_id"] for r in rows}
        users = {
            u["id"]: u
            async for u in db.users.find(
                {"id": {"$in": list(user_ids)}},
                {"_id": 0, "id": 1, "username": 1, "nickname": 1, "honor": 1},
            )
        }
        for r in rows:
            r["reporter"] = users.get(r["reporter_id"])
            r["target"] = users.get(r["target_id"])
            r.pop("created_at_dt", None)  # not JSON-serializable
        return {"reports": rows, "count": len(rows)}

    @api.patch("/admin/reports/{report_id}")
    async def update_report(
        report_id: str,
        body: dict,
        _: dict = Depends(require_admin),
    ):
        """Update a report's status. Allowed values: open|resolved|dismissed."""
        new_status = (body.get("status") or "").strip().lower()
        if new_status not in {"open", "resolved", "dismissed"}:
            raise HTTPException(400, "Invalid status (open|resolved|dismissed)")
        res = await db.reports.update_one(
            {"id": report_id},
            {"$set": {"status": new_status, "resolved_at": datetime.now(timezone.utc).isoformat()}},
        )
        if not res.matched_count:
            raise HTTPException(404, "Report not found")
        return {"ok": True, "status": new_status}

    @api.get("/admin/smtp/health")
    async def smtp_health(_: dict = Depends(require_admin)):
        """Quick check: does the backend have SMTP credentials configured?"""
        return {
            "configured": bool(SMTP_USER and SMTP_PASS),
            "host": SMTP_HOST,
            "port": SMTP_PORT,
            "moderation_email": MODERATION_EMAIL,
            "sender": SMTP_USER or None,
        }

    # ====== ACCOUNT DELETION (GDPR / Play Data Safety) ======
    @api.delete("/auth/account")
    async def delete_account(current: dict = Depends(get_current_user)):
        uid = current["id"]
        # Delete all data tied to this account
        await db.rooms.delete_many({"host_id": uid})
        await db.reports.delete_many({"reporter_id": uid})
        await db.users.update_many(
            {},
            {"$pull": {"friends": uid, "friend_requests_in": uid, "friend_requests_out": uid, "blocked_users": uid}},
        )
        await db.users.delete_one({"id": uid})
        return {"ok": True}
