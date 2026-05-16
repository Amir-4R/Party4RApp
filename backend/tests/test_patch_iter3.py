"""Iteration-3 patch tests:
- /me returns `created_at` (ISO) and `total_seconds` (int, default 0)
- Fresh signup → total_seconds = 0
- Hours tracking: ~3s WS session increments total_seconds
- Multi-session cumulative tracking
- Chat with `image` field broadcast
- Oversize image (>720_000 chars) dropped
- Image-only (no text) still broadcasts
- Empty text + no image dropped
"""
import json
import time
import uuid
import asyncio
import requests
import websockets

BASE = "https://partyapp-sync.preview.emergentagent.com"
API = f"{BASE}/api"
WS_BASE = BASE.replace("https://", "wss://")


def _uniq(prefix="u"):
    return f"TEST_{prefix}_{uuid.uuid4().hex[:8]}"


def _auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _signup(nickname="X", avatar="avatar_robot"):
    uname = _uniq()
    r = requests.post(f"{API}/auth/signup", json={
        "username": uname, "password": "pass1234",
        "nickname": nickname, "avatar": avatar,
    })
    assert r.status_code == 201, r.text
    d = r.json()
    return {"token": d["access_token"], "user": d["user"], "username": uname}


def _create_room(token, name=None):
    r = requests.post(f"{API}/rooms", headers=_auth(token), json={
        "name": name or _uniq("room"), "is_public": True,
    })
    assert r.status_code == 201, r.text
    return r.json()


def _ws_url(room_id, token):
    return f"{WS_BASE}/api/ws/rooms/{room_id}?token={token}"


async def _recv_until(ws, mtype, tries=8, timeout=4):
    for _ in range(tries):
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
        except asyncio.TimeoutError:
            return None
        m = json.loads(raw)
        if m.get("type") == mtype:
            return m
    return None


async def _drain_init(ws):
    return await _recv_until(ws, "init")


# ============== 1. Analytics: /me fields ==============
class TestMeAnalyticsFields:
    def test_me_has_created_at_and_total_seconds(self):
        a = _signup("Analytics")
        r = requests.get(f"{API}/auth/me", headers=_auth(a["token"]))
        assert r.status_code == 200
        d = r.json()
        assert "created_at" in d, f"created_at missing: {d}"
        assert "total_seconds" in d, f"total_seconds missing: {d}"
        assert isinstance(d["created_at"], str) and len(d["created_at"]) >= 10
        # quick ISO sanity — contains 'T' and starts with year
        assert "T" in d["created_at"], f"created_at not ISO: {d['created_at']}"
        assert isinstance(d["total_seconds"], int)
        assert d["total_seconds"] == 0, f"Fresh user should have 0, got {d['total_seconds']}"

    def test_signup_response_user_has_total_seconds_zero(self):
        a = _signup("FreshUser")
        # token response already carries user
        assert a["user"].get("total_seconds", 0) == 0
        assert a["user"].get("created_at") is not None


# ============== 2. Hours tracking ==============
class TestHoursTracking:
    def test_session_increments_total_seconds(self):
        a = _signup("Hours")
        room = _create_room(a["token"])
        rid = room["id"]

        async def run():
            async with websockets.connect(_ws_url(rid, a["token"])) as ws:
                init = await _drain_init(ws)
                assert init is not None
                await asyncio.sleep(3.2)
            # let server's finally{} flush the $inc
            await asyncio.sleep(0.8)

        asyncio.run(run())

        r = requests.get(f"{API}/auth/me", headers=_auth(a["token"]))
        assert r.status_code == 200
        secs = r.json()["total_seconds"]
        assert 2 <= secs <= 6, f"Expected ~3 seconds, got {secs}"

    def test_multi_session_cumulative(self):
        a = _signup("MultiSess")
        room = _create_room(a["token"])
        rid = room["id"]

        async def one_session(dur):
            async with websockets.connect(_ws_url(rid, a["token"])) as ws:
                await _drain_init(ws)
                await asyncio.sleep(dur)
            await asyncio.sleep(0.6)

        async def run():
            await one_session(2.2)
            # room may be auto-destroyed when last ws leaves; recreate
            return None

        asyncio.run(run())

        # First check after session 1
        r1 = requests.get(f"{API}/auth/me", headers=_auth(a["token"]))
        first = r1.json()["total_seconds"]
        assert 1 <= first <= 4, f"After 1st ~2s session, got {first}"

        # Recreate room (likely destroyed) and run second session
        room2 = _create_room(a["token"])
        rid2 = room2["id"]

        async def run2():
            async with websockets.connect(_ws_url(rid2, a["token"])) as ws:
                await _drain_init(ws)
                await asyncio.sleep(2.2)
            await asyncio.sleep(0.6)

        asyncio.run(run2())

        r2 = requests.get(f"{API}/auth/me", headers=_auth(a["token"]))
        total = r2.json()["total_seconds"]
        assert total >= first + 1, f"Total should accumulate; first={first}, total={total}"
        assert 3 <= total <= 8, f"Total should be ~4 (2+2), got {total}"


# ============== 3. Chat with image ==============
class TestChatImage:
    def test_chat_with_image_broadcasts(self):
        a = _signup("ImgA")
        b = _signup("ImgB")
        room = _create_room(a["token"])
        rid = room["id"]

        async def run():
            async with websockets.connect(_ws_url(rid, a["token"])) as ws_a:
                await _drain_init(ws_a)
                async with websockets.connect(_ws_url(rid, b["token"])) as ws_b:
                    await _drain_init(ws_b)
                    await _recv_until(ws_a, "user_joined")

                    img = "data:image/jpeg;base64,AAAA"
                    await ws_b.send(json.dumps({"type": "chat", "text": "hi", "image": img}))
                    msg = await _recv_until(ws_a, "chat", tries=6)
                    assert msg is not None, "A should have received chat broadcast"
                    assert msg["text"] == "hi"
                    assert msg.get("image") == img, f"Image not forwarded: {msg}"
                    assert msg["user_id"] == b["user"]["id"]

        asyncio.run(run())

    def test_chat_image_only_no_text_broadcasts(self):
        a = _signup("ImgOnlyA")
        b = _signup("ImgOnlyB")
        room = _create_room(a["token"])
        rid = room["id"]

        async def run():
            async with websockets.connect(_ws_url(rid, a["token"])) as ws_a:
                await _drain_init(ws_a)
                async with websockets.connect(_ws_url(rid, b["token"])) as ws_b:
                    await _drain_init(ws_b)
                    await _recv_until(ws_a, "user_joined")

                    img = "data:image/png;base64," + ("Z" * 200)
                    await ws_b.send(json.dumps({"type": "chat", "text": "", "image": img}))
                    msg = await _recv_until(ws_a, "chat", tries=6)
                    assert msg is not None, "Image-only chat should still broadcast"
                    assert msg.get("image") == img
                    assert msg.get("text") in ("", None)

        asyncio.run(run())

    def test_chat_oversize_image_dropped(self):
        a = _signup("OverA")
        b = _signup("OverB")
        room = _create_room(a["token"])
        rid = room["id"]

        async def run():
            async with websockets.connect(_ws_url(rid, a["token"])) as ws_a:
                await _drain_init(ws_a)
                async with websockets.connect(_ws_url(rid, b["token"])) as ws_b:
                    await _drain_init(ws_b)
                    await _recv_until(ws_a, "user_joined")

                    huge = "data:image/jpeg;base64," + ("A" * 720_001)
                    await ws_b.send(json.dumps({"type": "chat", "text": "big", "image": huge}))
                    # Should NOT be broadcast — wait briefly
                    msg = await _recv_until(ws_a, "chat", tries=3, timeout=2)
                    assert msg is None, f"Oversize image chat should be dropped, got {msg}"

                    # Sanity: small follow-up chat still works (connection alive)
                    await ws_b.send(json.dumps({"type": "chat", "text": "after-drop"}))
                    ok = await _recv_until(ws_a, "chat", tries=5, timeout=3)
                    assert ok is not None, "Connection should remain alive after oversize drop"
                    assert ok["text"] == "after-drop"

        asyncio.run(run())

    def test_chat_empty_text_no_image_dropped(self):
        a = _signup("EmptyA")
        b = _signup("EmptyB")
        room = _create_room(a["token"])
        rid = room["id"]

        async def run():
            async with websockets.connect(_ws_url(rid, a["token"])) as ws_a:
                await _drain_init(ws_a)
                async with websockets.connect(_ws_url(rid, b["token"])) as ws_b:
                    await _drain_init(ws_b)
                    await _recv_until(ws_a, "user_joined")

                    await ws_b.send(json.dumps({"type": "chat", "text": "   "}))
                    msg = await _recv_until(ws_a, "chat", tries=3, timeout=2)
                    assert msg is None, f"Empty/whitespace chat should be dropped, got {msg}"

                    # And one with neither text nor image
                    await ws_b.send(json.dumps({"type": "chat"}))
                    msg2 = await _recv_until(ws_a, "chat", tries=3, timeout=2)
                    assert msg2 is None, f"Completely empty chat should be dropped, got {msg2}"

        asyncio.run(run())
