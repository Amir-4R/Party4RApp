"""
Party4RApp — Phase 5 Push Notifications

Stores Expo push tokens per user and fans out push notifications via the
official Expo Push API (https://exp.host/--/api/v2/push/send).

User choice for this phase:
- Notifications fire ONLY for new DMs.
- Foreground delivery is suppressed client-side (handled by setNotificationHandler
  in the app). Server always sends; client decides whether to display.

Endpoints (added under /api):
- POST   /push/token        { token }      → save the current device's Expo push token.
- DELETE /push/token                       → clear the saved token (logout / opt-out).

Helper:
- async send_dm_push(db, sender, recipient_id, message_text)
"""

from __future__ import annotations
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


class PushTokenIn(BaseModel):
    token: str = Field(..., min_length=10, max_length=400)


def _is_expo_token(token: str) -> bool:
    """Accept ExponentPushToken[...] AND ExpoPushToken[...] formats."""
    return (
        token.startswith("ExponentPushToken[")
        or token.startswith("ExpoPushToken[")
    ) and token.endswith("]")


def register_routes(api, db, get_current_user):
    """Mount /push/token routes onto the supplied APIRouter."""

    @api.post("/push/token")
    async def save_push_token(
        body: PushTokenIn,
        current: dict = Depends(get_current_user),
    ):
        if not _is_expo_token(body.token):
            raise HTTPException(400, "Invalid Expo push token format")
        await db.users.update_one(
            {"id": current["id"]},
            {"$set": {"push_token": body.token}},
        )
        return {"ok": True}

    @api.delete("/push/token")
    async def clear_push_token(current: dict = Depends(get_current_user)):
        await db.users.update_one(
            {"id": current["id"]},
            {"$unset": {"push_token": ""}},
        )
        return {"ok": True}


async def _post_expo_push(messages: list[dict]) -> None:
    """Fire-and-forget POST to Expo's push endpoint. Never raises."""
    if not messages:
        return
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    # Expo recommends gzip Accept-Encoding but httpx handles
                    # decompression automatically.
                },
            )
            if r.status_code >= 400:
                logger.warning("Expo push %s: %s", r.status_code, r.text[:200])
    except Exception as e:
        logger.warning("Expo push send failed: %s", e)


async def send_dm_push(
    db,
    sender: dict,
    recipient_id: str,
    message_text: str,
) -> None:
    """Send a single DM push to `recipient_id` if they have a token.

    Server-side gating:
    - Caller may have already determined the recipient is "live" (DM WS
      connected) and should skip pushing — we do NOT re-check that here
      because the WS map lives in another module. Client-side handler will
      suppress foreground display anyway.

    Args:
        db:           Motor database instance (the same one used by dms.py).
        sender:       Sender user doc (we use `nickname` for the title).
        recipient_id: User-id of the receiver.
        message_text: Plain text body. Image-only DMs pass "📷 Photo".
    """
    recipient = await db.users.find_one(
        {"id": recipient_id}, {"_id": 0, "push_token": 1}
    )
    token: Optional[str] = (recipient or {}).get("push_token")
    if not token:
        return
    if not _is_expo_token(token):
        return

    body_preview = (message_text or "").strip()
    if len(body_preview) > 120:
        body_preview = body_preview[:117] + "…"

    msg = {
        "to": token,
        "sound": "default",
        "title": sender.get("nickname") or "New message",
        "body": body_preview or "Sent you a photo",
        "data": {
            "kind": "dm",
            "from_id": sender.get("id"),
            "from_nickname": sender.get("nickname"),
        },
        # On iOS, badge increment hints the OS to bump the app-icon badge.
        "badge": 1,
        # Channel id used by Android (defined in mobile expo-notifications setup).
        "channelId": "dms",
        # Expo recommends "high" priority for chat messages.
        "priority": "high",
    }
    await _post_expo_push([msg])
