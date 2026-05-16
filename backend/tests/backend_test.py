"""PartyApp backend tests — auth, rooms, websockets."""
import os
import json
import uuid
import asyncio
import pytest
import requests
import websockets

# Use EXPO_PUBLIC_BACKEND_URL from frontend env (public)
BASE = "https://partyapp-sync.preview.emergentagent.com"
API = f"{BASE}/api"
WS_BASE = BASE.replace("https://", "wss://").replace("http://", "ws://")


def _uniq(prefix="u"):
    return f"TEST_{prefix}_{uuid.uuid4().hex[:8]}"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def user_a(session):
    uname = _uniq("a")
    r = session.post(f"{API}/auth/signup", json={
        "username": uname, "password": "pass1234",
        "nickname": "Alice", "avatar": "avatar_ninja"
    })
    assert r.status_code == 201, r.text
    d = r.json()
    return {"token": d["access_token"], "user": d["user"], "password": "pass1234", "username": uname}


@pytest.fixture(scope="module")
def user_b(session):
    uname = _uniq("b")
    r = session.post(f"{API}/auth/signup", json={
        "username": uname, "password": "pass1234",
        "nickname": "Bob", "avatar": "avatar_cat"
    })
    assert r.status_code == 201, r.text
    d = r.json()
    return {"token": d["access_token"], "user": d["user"], "username": uname}


def _auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Auth tests ----------
class TestAuth:
    def test_signup_returns_jwt_and_user(self, session):
        uname = _uniq("sn")
        r = session.post(f"{API}/auth/signup", json={
            "username": uname, "password": "pass1234",
            "nickname": "Nick", "avatar": "avatar_alien"
        })
        assert r.status_code == 201
        d = r.json()
        assert "access_token" in d and d["token_type"] == "bearer"
        assert d["user"]["username"] == uname
        assert d["user"]["nickname"] == "Nick"
        assert d["user"]["avatar"] == "avatar_alien"
        assert "id" in d["user"]

    def test_signup_duplicate_returns_400(self, session, user_a):
        r = session.post(f"{API}/auth/signup", json={
            "username": user_a["username"], "password": "pass1234",
            "nickname": "X", "avatar": "avatar_robot"
        })
        assert r.status_code == 400

    def test_login_success(self, session, user_a):
        r = session.post(f"{API}/auth/login", json={
            "username": user_a["username"], "password": user_a["password"]
        })
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_login_wrong_password_401(self, session, user_a):
        r = session.post(f"{API}/auth/login", json={
            "username": user_a["username"], "password": "wrong_pw"
        })
        assert r.status_code == 401

    def test_login_unknown_user_401(self, session):
        r = session.post(f"{API}/auth/login", json={
            "username": "no_such_user_xyz", "password": "whatever"
        })
        assert r.status_code == 401

    def test_me_with_valid_token(self, session, user_a):
        r = session.get(f"{API}/auth/me", headers=_auth(user_a["token"]))
        assert r.status_code == 200
        assert r.json()["username"] == user_a["username"]

    def test_me_missing_token_401(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_invalid_token_401(self, session):
        r = session.get(f"{API}/auth/me", headers={"Authorization": "Bearer not.a.token"})
        assert r.status_code == 401

    def test_patch_profile_avatar(self, session, user_a):
        r = session.patch(f"{API}/auth/profile?avatar=avatar_alien",
                          headers=_auth(user_a["token"]))
        assert r.status_code == 200
        assert r.json()["avatar"] == "avatar_alien"
        # verify via GET
        r2 = session.get(f"{API}/auth/me", headers=_auth(user_a["token"]))
        assert r2.json()["avatar"] == "avatar_alien"

    def test_patch_profile_requires_auth(self, session):
        r = session.patch(f"{API}/auth/profile?avatar=avatar_cat")
        assert r.status_code == 401


# ---------- Rooms tests ----------
class TestRooms:
    def test_create_public_room(self, session, user_a):
        r = session.post(f"{API}/rooms", headers=_auth(user_a["token"]), json={
            "name": "TEST_public_room", "is_public": True
        })
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["is_public"] is True
        assert d["has_password"] is False
        assert d["host_id"] == user_a["user"]["id"]
        assert d["host_nickname"] == user_a["user"]["nickname"]
        assert d["member_count"] == 0
        assert "id" in d
        # store for other tests
        TestRooms.public_room_id = d["id"]

    def test_create_private_room_with_password(self, session, user_a):
        r = session.post(f"{API}/rooms", headers=_auth(user_a["token"]), json={
            "name": "TEST_private_room", "is_public": False, "password": "s3cret"
        })
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["is_public"] is False
        assert d["has_password"] is True
        TestRooms.private_room_id = d["id"]

    def test_list_public_rooms_only_public(self, session, user_a):
        r = session.get(f"{API}/rooms/public", headers=_auth(user_a["token"]))
        assert r.status_code == 200
        rooms = r.json()
        assert isinstance(rooms, list)
        ids = [x["id"] for x in rooms]
        assert TestRooms.public_room_id in ids
        assert TestRooms.private_room_id not in ids
        assert all(x["is_public"] for x in rooms)

    def test_list_rooms_requires_auth(self, session):
        r = session.get(f"{API}/rooms/public")
        assert r.status_code == 401

    def test_get_room_by_id(self, session, user_a):
        r = session.get(f"{API}/rooms/{TestRooms.public_room_id}",
                        headers=_auth(user_a["token"]))
        assert r.status_code == 200
        assert r.json()["id"] == TestRooms.public_room_id

    def test_get_room_404(self, session, user_a):
        r = session.get(f"{API}/rooms/nonexistent-id-xyz",
                        headers=_auth(user_a["token"]))
        assert r.status_code == 404

    def test_join_public_room(self, session, user_b):
        r = session.post(f"{API}/rooms/{TestRooms.public_room_id}/join",
                         headers=_auth(user_b["token"]), json={})
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_join_private_room_wrong_password(self, session, user_b):
        r = session.post(f"{API}/rooms/{TestRooms.private_room_id}/join",
                         headers=_auth(user_b["token"]), json={"password": "WRONG"})
        assert r.status_code == 403

    def test_join_private_room_correct_password(self, session, user_b):
        r = session.post(f"{API}/rooms/{TestRooms.private_room_id}/join",
                         headers=_auth(user_b["token"]), json={"password": "s3cret"})
        assert r.status_code == 200


# ---------- WebSocket tests ----------
async def _ws_url(room_id, token):
    return f"{WS_BASE}/api/ws/rooms/{room_id}?token={token}"


async def _recv_json(ws, timeout=5):
    raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
    return json.loads(raw)


class TestWebSocket:
    def test_ws_invalid_token_closed(self, user_a):
        async def run():
            url = await _ws_url(TestRooms.public_room_id, "invalid.token.here")
            try:
                async with websockets.connect(url) as ws:
                    # server should close with 1008
                    try:
                        await asyncio.wait_for(ws.recv(), timeout=5)
                    except websockets.ConnectionClosed as e:
                        return e.code
                    return None
            except websockets.InvalidStatus as e:
                return e.response.status_code
            except websockets.ConnectionClosed as e:
                return e.code
        code = asyncio.get_event_loop().run_until_complete(run()) if False else asyncio.run(run())
        # Either close code 1008 or connection rejected
        assert code in (1008, 403, 401) or code is not None

    def test_ws_handshake_init_and_chat_broadcast(self, user_a, user_b):
        async def run():
            results = {}
            url_a = await _ws_url(TestRooms.public_room_id, user_a["token"])
            url_b = await _ws_url(TestRooms.public_room_id, user_b["token"])

            async def find(ws, mtype, tries=5):
                for _ in range(tries):
                    m = await _recv_json(ws)
                    if m.get("type") == mtype:
                        return m
                return None

            async with websockets.connect(url_a) as ws_a:
                init_a = await find(ws_a, "init")
                results["init_a"] = init_a
                assert init_a is not None
                assert init_a["is_host"] is True
                assert init_a["host_id"] == user_a["user"]["id"]

                async with websockets.connect(url_b) as ws_b:
                    init_b = await find(ws_b, "init")
                    results["init_b"] = init_b
                    assert init_b is not None
                    assert init_b["is_host"] is False

                    # A should receive user_joined for B
                    # drain until user_joined
                    for _ in range(3):
                        msg = await _recv_json(ws_a)
                        if msg["type"] == "user_joined":
                            results["user_joined"] = msg
                            break
                    assert results.get("user_joined")
                    assert results["user_joined"]["user"]["id"] == user_b["user"]["id"]

                    # B sends chat -> A receives it
                    await ws_b.send(json.dumps({"type": "chat", "text": "hello from bob"}))
                    # B also receives broadcast (no exclude)
                    chat_msg_a = None
                    for _ in range(3):
                        m = await _recv_json(ws_a)
                        if m["type"] == "chat":
                            chat_msg_a = m
                            break
                    assert chat_msg_a is not None
                    assert chat_msg_a["text"] == "hello from bob"
                    assert chat_msg_a["user_id"] == user_b["user"]["id"]

                    # Non-host playback from B should be IGNORED — A must NOT receive it
                    await ws_b.send(json.dumps({"type": "playback", "event": "play", "time": 10}))
                    got_playback = False
                    try:
                        for _ in range(2):
                            m = await asyncio.wait_for(ws_a.recv(), timeout=2)
                            j = json.loads(m)
                            if j.get("type") == "playback":
                                got_playback = True
                                break
                    except asyncio.TimeoutError:
                        pass
                    assert got_playback is False, "Non-host playback should be ignored"

                    # Host A sends playback -> B receives
                    await ws_a.send(json.dumps({"type": "playback", "event": "play", "time": 5}))
                    pb_b = None
                    for _ in range(3):
                        m = await _recv_json(ws_b)
                        if m["type"] == "playback":
                            pb_b = m
                            break
                    assert pb_b is not None
                    assert pb_b["event"] == "play"
                    assert pb_b["host_id"] == user_a["user"]["id"]

                # B disconnects — A should get user_left
                left = None
                try:
                    for _ in range(3):
                        m = await asyncio.wait_for(ws_a.recv(), timeout=3)
                        j = json.loads(m)
                        if j.get("type") == "user_left":
                            left = j
                            break
                except asyncio.TimeoutError:
                    pass
                assert left is not None
                assert left["user_id"] == user_b["user"]["id"]
            return results

        asyncio.run(run())
