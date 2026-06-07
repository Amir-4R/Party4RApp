"""
Party4R — Google OAuth (Sign-in with Google)
Phase 2 stub. Wires the routes but leaves token verification as TODO so the
entire stack still boots even when GOOGLE_OAUTH_CLIENT_ID is not configured.

When you're ready to enable Google Login:
  1. Create OAuth client in Google Cloud Console (Web + Android types).
  2. Set GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET in .env.
  3. Replace the TODO block in `_verify_google_id_token` with actual
     verification using google-auth library (already in requirements).
  4. The frontend uses expo-auth-session/providers/google → sends idToken to
     POST /api/auth/google/exchange.
"""
from __future__ import annotations

import os
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

log = logging.getLogger("party4r.google_auth")

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET", "")


class GoogleExchangeBody(BaseModel):
    id_token: str
    # Optional: include access_token if you need Google API access (Drive, etc.)
    access_token: Optional[str] = None


async def _verify_google_id_token(id_token: str) -> dict:
    """Verify a Google ID token and return its claims.

    Returns a dict with at least: sub (Google user id), email, email_verified,
    name, picture. Raises HTTPException on failure.

    TODO(google-login): replace with the real implementation:
        from google.oauth2 import id_token as gid
        from google.auth.transport import requests as grequests
        claims = gid.verify_oauth2_token(id_token, grequests.Request(), GOOGLE_CLIENT_ID)
        return claims
    """
    raise HTTPException(
        503,
        "Google Login not yet configured. Set GOOGLE_OAUTH_CLIENT_ID in .env.",
    )


def register_routes(api: APIRouter, db, sign_token_for_user):
    """Mount Google Login endpoints on the shared /api router.

    `sign_token_for_user` is a callable provided by server.py that wraps the
    existing JWT issuance flow — keeps the Google flow consistent with email
    signup.
    """

    @api.post("/auth/google/exchange")
    async def google_exchange(body: GoogleExchangeBody):
        if not GOOGLE_CLIENT_ID:
            raise HTTPException(
                503,
                "Google Login disabled — set GOOGLE_OAUTH_CLIENT_ID env var.",
            )
        claims = await _verify_google_id_token(body.id_token)
        google_sub = claims["sub"]
        email = claims.get("email")
        name = claims.get("name") or (email.split("@")[0] if email else f"gu_{google_sub[:6]}")

        # Upsert user by google_sub
        user = await db.users.find_one({"google_sub": google_sub})
        if not user:
            user = {
                "id": __import__("uuid").uuid4().hex,
                "username": (name + "_" + google_sub[:4]).lower(),
                "nickname": name,
                "avatar": "avatar_ninja",
                "email": email,
                "google_sub": google_sub,
                "password_hash": None,
                "honor": 100,
                "created_at": __import__("datetime").datetime.utcnow().isoformat(),
            }
            await db.users.insert_one(user)
            log.info("Created google user %s (sub=%s)", user["username"], google_sub)

        token = sign_token_for_user(user)
        return {"access_token": token, "user": user}
