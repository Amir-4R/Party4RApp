"""
Phase 5 backend tests — Moderation Bot + Push Notifications
"""
import asyncio
import json
import os
import sys
import uuid

import httpx
import websockets

BASE = "https://partyapp-sync.preview.emergentagent.com"
API = BASE + "/api"
WS_BASE = BASE.replace("https://", "wss://").replace("http://", "ws://")

results = []
def report(name, ok, detail=""):
    tag = "PASS" if ok else "FAIL"
    results.append((name, ok, detail))
    print(f"[{tag}] {name}: {detail}")


async def login(client, username, password):
    r = await client.post(f"{API}/auth/login", json={"username": username, "password": password})
    if r.status_code != 200:
        raise RuntimeError(f"login {username} -> {r.status_code} {r.text}")
    return r.json()


async def signup(client, username, password, nickname, avatar):
    r = await client.post(
        f"{API}/auth/signup",
        json={"username": username, "password": password, "nickname": nickname, "avatar": avatar},
    )
    if r.status_code != 201:
        raise RuntimeError(f"signup {username} -> {r.status_code} {r.text}")
    return r.json()


def auth(token):
    return {"Authorization": f"Bearer {token}"}


async def ws_recv_until_chat(ws, timeout=5.0):
    """Drain WS messages until we see a 'chat' type message and return it."""
    end = asyncio.get_event_loop().time() + timeout
    while True:
        remaining = end - asyncio.get_event_loop().time()
        if remaining <= 0:
            return None
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
        except asyncio.TimeoutError:
            return None
        try:
            data = json.loads(raw)
        except Exception:
            continue
        if data.get("type") == "chat":
            return data


async def test_word_filter():
    print("\n=== TEST 1: Word filter on room chat ===")
    async with httpx.AsyncClient(timeout=20.0) as client:
        tu1 = await login(client, "testuser1", "pass1234")
        token = tu1["access_token"]
        # Create room
        r = await client.post(f"{API}/rooms", json={"name": "modtest", "is_public": True}, headers=auth(token))
        if r.status_code != 201:
            report("create modtest room", False, f"{r.status_code} {r.text}")
            return
        room_id = r.json()["id"]
        report("create modtest room", True, f"room_id={room_id}")

        ws_url = f"{WS_BASE}/api/ws/rooms/{room_id}?token={token}"
        try:
            async with websockets.connect(ws_url) as ws:
                # Drain init message
                init_raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
                init = json.loads(init_raw)
                if init.get("type") != "init":
                    report("ws init", False, f"got {init}")
                else:
                    report("ws init", True, f"is_host={init.get('is_host')}")

                cases = [
                    ("clean message", "hello world", "hello world", False),
                    ("multi-word profanity", "fuck this shit", "**** this ****", True),
                    ("leet substitution", "F@ck off", "**** off", True),
                    ("length-preserving uppercase", "you BITCH", "you *****", True),
                    ("repeated chars collapse", "fuuuuck this", None, True),  # check first word stars
                    ("spam words", "porn xxx nudes", "**** *** *****", True),
                    ("Arabic transliteration", "kos omak", "*** omak", True),
                ]

                for name, text_in, text_expect, flag_expect in cases:
                    await ws.send(json.dumps({"type": "chat", "text": text_in}))
                    chat = await ws_recv_until_chat(ws, timeout=5.0)
                    if not chat:
                        report(f"chat '{name}'", False, "no chat response within timeout")
                        continue
                    text_out = chat.get("text", "")
                    flag_out = bool(chat.get("bot_flag", False))

                    # base fields check
                    has_meta = all(k in chat for k in ("nickname", "avatar", "user_id", "timestamp"))

                    if text_expect is None:
                        # repeated-char case — first word must be all stars
                        first = text_out.split(" ")[0] if text_out else ""
                        text_ok = len(first) > 0 and set(first) == {"*"}
                    else:
                        text_ok = text_out == text_expect

                    flag_ok = flag_out == flag_expect
                    ok = text_ok and flag_ok and has_meta
                    report(
                        f"chat '{name}'",
                        ok,
                        f"in={text_in!r} out={text_out!r} bot_flag={flag_out} (exp text={text_expect!r}, flag={flag_expect}) meta_ok={has_meta}",
                    )
        except Exception as e:
            report("ws connect", False, str(e))


async def test_push_token_endpoints():
    print("\n=== TEST 2: Push notification token endpoints ===")
    async with httpx.AsyncClient(timeout=20.0) as client:
        tu1 = await login(client, "testuser1", "pass1234")
        token = tu1["access_token"]
        uid = tu1["user"]["id"]

        # Valid ExponentPushToken format
        valid_token = "ExponentPushToken[xxxx-yyyy-zzzz-aaaa]"
        r = await client.post(f"{API}/push/token", json={"token": valid_token}, headers=auth(token))
        ok = r.status_code == 200 and r.json().get("ok") is True
        report("POST /push/token (ExponentPushToken)", ok, f"{r.status_code} {r.text[:100]}")

        # Verify via GET /auth/me — push_token is NOT in UserPublic model, but
        # the brief says it's OK if either /me returns it OR DB has it. Let's
        # check /me first then describe.
        r2 = await client.get(f"{API}/auth/me", headers=auth(token))
        me_has = "push_token" in (r2.json() if r2.status_code == 200 else {})
        report(
            "GET /auth/me includes push_token field",
            me_has,
            f"me_keys={list(r2.json().keys()) if r2.status_code == 200 else r2.status_code}",
        )

        # Invalid format
        r = await client.post(f"{API}/push/token", json={"token": "invalid-format-token"}, headers=auth(token))
        ok = r.status_code == 400
        report("POST /push/token invalid format -> 400", ok, f"{r.status_code} {r.text[:100]}")

        # ExpoPushToken prefix also accepted
        expo_token = "ExpoPushToken[abc-def-ghi]"
        r = await client.post(f"{API}/push/token", json={"token": expo_token}, headers=auth(token))
        ok = r.status_code == 200
        report("POST /push/token (ExpoPushToken) -> 200", ok, f"{r.status_code} {r.text[:100]}")

        # DELETE token
        r = await client.delete(f"{API}/push/token", headers=auth(token))
        ok = r.status_code == 200 and r.json().get("ok") is True
        report("DELETE /push/token -> 200", ok, f"{r.status_code} {r.text[:100]}")


async def test_dm_with_push():
    print("\n=== TEST 3: DM send-with-push integration ===")
    async with httpx.AsyncClient(timeout=30.0) as client:
        tu1 = await login(client, "testuser1", "pass1234")
        tu1_token = tu1["access_token"]
        tu1_id = tu1["user"]["id"]

        # Sign up fresh peer
        peer_username = f"phase5peer_{uuid.uuid4().hex[:8]}"
        peer = await signup(client, peer_username, "pass1234", "Phase5 Peer", "avatar_cat")
        peer_token = peer["access_token"]
        peer_id = peer["user"]["id"]
        report("signup peer", True, f"peer_id={peer_id} username={peer_username}")

        # Friend request: peer -> tu1, then tu1 accepts
        r = await client.post(f"{API}/friends/request/{tu1_id}", headers=auth(peer_token))
        report("peer requests friend tu1", r.status_code == 200, f"{r.status_code} {r.text[:80]}")
        r = await client.post(f"{API}/friends/accept/{peer_id}", headers=auth(tu1_token))
        report("tu1 accepts peer", r.status_code == 200, f"{r.status_code} {r.text[:80]}")

        # Peer sets push_token to fake token
        fake_token = "ExponentPushToken[FAKE-FOR-TEST]"
        r = await client.post(f"{API}/push/token", json={"token": fake_token}, headers=auth(peer_token))
        report("peer sets push_token", r.status_code == 200, f"{r.status_code} {r.text[:80]}")

        # Clear tu1's push token (was set in previous test, but valid expo prefix)
        # The brief later says "As testuser1 (no push token set)" — ensure clean.
        await client.delete(f"{API}/push/token", headers=auth(tu1_token))

        # tu1 sends DM to peer — push should be attempted but swallowed
        r = await client.post(f"{API}/dms/{peer_id}", json={"text": "hi there"}, headers=auth(tu1_token))
        ok = r.status_code == 201
        report("DM with text returns 201 (push to fake token swallowed)", ok, f"{r.status_code} {r.text[:120]}")

        # tu1 still has no push token — DM to peer with no recipient token would skip,
        # but the brief asks: "As testuser1 (no push token set), POST /dms/{peer_id}"
        # That's already the case above — but the brief test is different: it tests
        # that when *recipient* (peer) has no token, server skips. So let's clear peer's:
        await client.delete(f"{API}/push/token", headers=auth(peer_token))
        r = await client.post(f"{API}/dms/{peer_id}", json={"text": "no token test"}, headers=auth(tu1_token))
        ok = r.status_code == 201
        report("DM still 201 when recipient has no push token", ok, f"{r.status_code} {r.text[:120]}")

        # DM with only image (no text). Re-set fake token on peer so push is attempted.
        await client.post(f"{API}/push/token", json={"token": fake_token}, headers=auth(peer_token))
        img = (
            "data:image/png;base64,"
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII="
        )
        r = await client.post(f"{API}/dms/{peer_id}", json={"image": img}, headers=auth(tu1_token))
        ok = r.status_code == 201
        report("DM image-only returns 201 (push body would be '📷 Photo')", ok, f"{r.status_code} {r.text[:120]}")

        # Sanity: GET /auth/me works after all changes
        r = await client.get(f"{API}/auth/me", headers=auth(tu1_token))
        report("GET /auth/me sanity", r.status_code == 200, f"{r.status_code}")

        # Cleanup: remove friendship
        await client.delete(f"{API}/friends/{peer_id}", headers=auth(tu1_token))


async def main():
    await test_word_filter()
    await test_push_token_endpoints()
    await test_dm_with_push()

    print("\n" + "=" * 60)
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    print(f"TOTAL: {passed} passed, {failed} failed (of {len(results)})")
    if failed:
        print("\nFAILURES:")
        for n, ok, d in results:
            if not ok:
                print(f"  - {n}: {d}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
