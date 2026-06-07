"""
Party4R — Google OAuth (Sign-in with Google)
============================================
FULL implementation. Verifies a Google ID token server-side, then finds or
creates a Party4R user record and issues a JWT identical to the one used by
the username/password flow.

How it works:
  1. Frontend uses expo-auth-session to start an OpenID Connect flow with the
     web client ID configured in EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB.
  2. After user consents, Google returns an id_token to the app.
  3. App posts {id_token} to /api/auth/google/exchange.
  4. We verify the token's signature, audience (Web + optional Android),
     issuer, expiry & email_verified flag using google.oauth2.id_token.
  5. We look up or create a user document in Mongo keyed on `google_sub` and
     fall back to email-link for existing local accounts.
  6. We return {access_token, user} — the same shape as /auth/login.

Configuration (.env on the backend):
  GOOGLE_OAUTH_CLIENT_ID_WEB     = xxx.apps.googleusercontent.com   (REQUIRED)
  GOOGLE_OAUTH_CLIENT_ID_ANDROID = yyy.apps.googleusercontent.com   (optional)

When GOOGLE_OAUTH_CLIENT_ID_WEB is missing the endpoint stays mounted but
returns a 503 — this prevents accidental promotion of an unverified token.
"""
from __future__ import annotations

import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# google-auth is already in requirements (used elsewhere); import lazily so a
# missing install doesn't break the rest of the API surface.
try:
    from google.oauth2 import id_token as _gid_token
    from google.auth.transport import requests as _grequests
    _GOOGLE_LIB_OK = True
except Exception:  # pragma: no cover
    _GOOGLE_LIB_OK = False

log = logging.getLogger("party4r.google_auth")

# --- ENV ---------------------------------------------------------------------
# Back-compat: accept both the older GOOGLE_OAUTH_CLIENT_ID and the newer
# split *_WEB / *_ANDROID names.
_LEGACY_ID = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "").strip()
GOOGLE_CLIENT_ID_WEB = os.environ.get("GOOGLE_OAUTH_CLIENT_ID_WEB", _LEGACY_ID).strip()
GOOGLE_CLIENT_ID_ANDROID = os.environ.get("GOOGLE_OAUTH_CLIENT_ID_ANDROID", "").strip()

_VALID_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


# --- Models ------------------------------------------------------------------
class GoogleExchangeBody(BaseModel):
    id_token: str
    access_token: Optional[str] = None  # reserved for future API access


# --- Helpers -----------------------------------------------------------------
def _allowed_audiences() -> List[str]:
    auds: List[str] = []
    if GOOGLE_CLIENT_ID_WEB:
        auds.append(GOOGLE_CLIENT_ID_WEB)
    if GOOGLE_CLIENT_ID_ANDROID:
        auds.append(GOOGLE_CLIENT_ID_ANDROID)
    return auds


def _verify_google_id_token_sync(raw: str) -> dict:
    """Verify a Google ID token.  Raises HTTPException(401) on failure."""
    if not _GOOGLE_LIB_OK:
        raise HTTPException(500, "google-auth library missing on server")

    audiences = _allowed_audiences()
    if not audiences:
        raise HTTPException(
            503, "Google Login not configured (GOOGLE_OAUTH_CLIENT_ID_WEB missing)"
        )

    try:
        request = _grequests.Request()
        # verify_oauth2_token accepts either a single audience or a list.
        # We pass the first; if a token's aud doesn't match we retry with all.
        try:
            info = _gid_token.verify_oauth2_token(raw, request, audiences[0])
        except ValueError:
            # Try every configured audience until one works (covers Android).
            last_err: Optional[Exception] = None
            info = None  # type: ignore
            for aud in audiences:
                try:
                    info = _gid_token.verify_oauth2_token(raw, request, aud)
                    last_err = None
                    break
                except ValueError as e:
                    last_err = e
                    continue
            if info is None:
                raise last_err or ValueError("Invalid Google ID token")
    except ValueError as e:
        log.warning("Google ID token verification failed: %s", e)
        raise HTTPException(401, "Invalid Google ID token")

    if info.get("iss") not in _VALID_ISSUERS:
        raise HTTPException(401, "Wrong Google token issuer")

    if not info.get("email_verified", False):
        raise HTTPException(403, "Email not verified by Google")

    return info


def _suggest_username(name: Optional[str], email: Optional[str], google_sub: str) -> str:
    base = (name or (email.split("@")[0] if email else None) or f"gu_{google_sub[:6]}")
    base = "".join(c for c in base if c.isalnum() or c == "_")[:18].lower() or "guser"
    return f"{base}_{google_sub[:4]}"


def _user_to_public(u: dict) -> dict:
    """Mirror of server.user_to_public — kept here to avoid circular import."""
    return {
        "id": u["id"],
        "username": u["username"],
        "nickname": u.get("nickname", u["username"]),
        "avatar": u.get("avatar", "avatar_ninja"),
        "avatar_image": u.get("avatar_image"),
        "bio": u.get("bio"),
        "banner_id": u.get("banner_id"),
        "badges": u.get("badges", []),
        "created_at": u.get("created_at"),
        "total_seconds": int(u.get("total_seconds", 0)),
    }


# --- Router registration -----------------------------------------------------
def register_routes(api: APIRouter, db, sign_token_for_user):
    """Mount Google Login endpoints on the shared /api router.

    `sign_token_for_user(user_doc)` -> str
        Wraps the existing JWT issuance helper so Google logins look exactly
        like password logins to the rest of the app.
    """

    @api.get("/auth/google/config")
    async def google_config():
        """Lightweight probe used by the mobile app to detect whether Google
        Login is enabled on this server before drawing the button."""
        return {
            "enabled": bool(GOOGLE_CLIENT_ID_WEB),
            "client_id_web": GOOGLE_CLIENT_ID_WEB or None,
            # Never expose the Android client ID in production — frontend uses
            # the web one for the OAuth request and the backend verifies both.
        }

    @api.post("/auth/google/exchange")
    async def google_exchange(body: GoogleExchangeBody):
        # 1) Verify token (synchronous google-auth call — quick & isolated)
        claims = _verify_google_id_token_sync(body.id_token)
        google_sub = claims["sub"]
        email = (claims.get("email") or "").lower() or None
        name = claims.get("name")
        picture = claims.get("picture")

        # 2) Look up by google_sub  →  returning Google user
        user = await db.users.find_one({"google_sub": google_sub}, {"_id": 0})

        # 3) Otherwise link by verified email  →  existing local user
        if not user and email:
            existing = await db.users.find_one({"email": email}, {"_id": 0})
            if existing:
                if existing.get("google_sub") and existing["google_sub"] != google_sub:
                    raise HTTPException(
                        409,
                        "This email is already linked to a different Google account.",
                    )
                # Attach Google identity to the existing account
                update = {
                    "google_sub": google_sub,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
                if picture and not existing.get("avatar_image"):
                    update["avatar_image"] = picture
                await db.users.update_one(
                    {"id": existing["id"]}, {"$set": update}
                )
                existing.update(update)
                user = existing

        # 4) Otherwise create a brand new user
        if not user:
            user_id = str(uuid.uuid4())
            user = {
                "id": user_id,
                "username": _suggest_username(name, email, google_sub),
                "nickname": name or "Player",
                "avatar": "avatar_ninja",
                "avatar_image": picture,
                "email": email,
                "google_sub": google_sub,
                "password_hash": None,
                "honor": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "total_seconds": 0,
            }
            # Defensive: unique-username collisions (extremely rare with _sub
            # tail) → fall back to a fresh suffix.
            try:
                await db.users.insert_one(user)
            except Exception:
                user["username"] = f"{user['username']}_{uuid.uuid4().hex[:4]}"
                await db.users.insert_one(user)
            log.info("Created Google user %s (sub=%s)", user["username"], google_sub)

        token = sign_token_for_user(user)
        return {"access_token": token, "user": _user_to_public(user)}
