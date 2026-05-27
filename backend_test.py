"""
Phase 3 backend tests:
- DM REST flow (friend-only, block-aware, edit/delete/read/typing)
- DM WebSocket realtime + presence
- Shared-time tracking via room WS
- Privacy gate on /api/users/{id}/shared_time
"""
import asyncio
import json
import os
import random
import string
import sys
import time

import httpx
import websockets

BASE = "https://partyapp-sync.preview.emergentagent.com"
API = f"{BASE}/api"
WS_BASE = BASE.replace("https://", "wss://").replace("http://", "ws://")

TESTUSER1 = "testuser1"
PASS1 = "pass1234"

results = []
def log(ok, name, detail=""):
    icon = "OK" if ok else "FAIL"
    line = f"[{icon}] {name}" + (f" — {detail}" if detail else "")
    print(line)
    results.append((ok, name, detail))

def rand_suffix(n=6):
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


async def login(client, username, password):
    r = await client.post(f"{API}/auth/login", json={"username": username, "password": password})
    if r.status_code != 200:
        return None, r
    return r.json(), r


async def signup(client, username, password, nickname, avatar):
    r = await client.post(f"{API}/auth/signup", json={
        "username": username, "password": password, "nickname": nickname, "avatar": avatar,
    })
    if r.status_code != 201:
        return None, r
    return r.json(), r


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


async def main():
    async with httpx.AsyncClient(timeout=20) as c:
        # 1. Login testuser1
        t1, r = await login(c, TESTUSER1, PASS1)
        if not t1:
            log(False, "login testuser1", f"{r.status_code} {r.text}")
            return
        token1 = t1["access_token"]
        u1 = t1["user"]
        log(True, "login testuser1", f"id={u1['id']}")

        # 2. Create a fresh peer user
        peer_username = f"peer_{rand_suffix()}"
        peer_nick = f"Peer{rand_suffix(3)}"
        peer_avatar = random.choice([
            "avatar_ninja","avatar_astronaut","avatar_skull","avatar_alien","avatar_robot","avatar_cat"
        ])
        t2, r = await signup(c, peer_username, "pass1234", peer_nick, peer_avatar)
        if not t2:
            log(False, "signup peer", f"{r.status_code} {r.text}")
            return
        token2 = t2["access_token"]
        u2 = t2["user"]
        log(True, "signup peer", f"username={peer_username} id={u2['id']}")

        h1 = auth_headers(token1)
        h2 = auth_headers(token2)

        # 3. testuser1 sends friend request to peer
        r = await c.post(f"{API}/friends/request/{u2['id']}", headers=h1)
        log(r.status_code == 200, "friend_request send", f"{r.status_code} {r.text[:100]}")

        # 4. peer accepts
        r = await c.post(f"{API}/friends/accept/{u1['id']}", headers=h2)
        log(r.status_code == 200, "friend_request accept", f"{r.status_code} {r.text[:100]}")

        # 5. testuser1 sends DM
        r = await c.post(f"{API}/dms/{u2['id']}", headers=h1, json={"text": "hello"})
        ok = r.status_code == 201
        msg_id = None
        if ok:
            body = r.json()
            msg_id = body.get("id")
            required = {"id","from_id","to_id","text","created_at"}
            present = required.issubset(body.keys())
            log(present and body.get("text") == "hello",
                "POST /dms/{peer_id} 'hello'",
                f"status=201 fields_ok={present}")
        else:
            log(False, "POST /dms/{peer_id} 'hello'", f"{r.status_code} {r.text}")

        # 6. testuser1 GET /dms — conversations
        r = await c.get(f"{API}/dms", headers=h1)
        if r.status_code == 200:
            convs = r.json().get("conversations", [])
            row = next((x for x in convs if (x.get("friend") or {}).get("id") == u2["id"]), None)
            ok = (
                row is not None
                and row.get("last_message") is not None
                and row.get("unread", -1) == 0
            )
            log(ok, "GET /dms (testuser1)",
                f"row_found={row is not None} unread={row.get('unread') if row else None}")
        else:
            log(False, "GET /dms (testuser1)", f"{r.status_code} {r.text}")

        # 7. peer GET /dms — unread should be 1
        r = await c.get(f"{API}/dms", headers=h2)
        if r.status_code == 200:
            convs = r.json().get("conversations", [])
            row = next((x for x in convs if (x.get("friend") or {}).get("id") == u1["id"]), None)
            ok = row is not None and row.get("unread") == 1
            log(ok, "GET /dms (peer) unread=1",
                f"unread={row.get('unread') if row else None}")
        else:
            log(False, "GET /dms (peer)", f"{r.status_code} {r.text}")

        # 8. peer GET history
        r = await c.get(f"{API}/dms/{u1['id']}", headers=h2)
        if r.status_code == 200:
            msgs = r.json().get("messages", [])
            log(any(m.get("text") == "hello" for m in msgs),
                "GET /dms/{testuser1_id} history",
                f"n_msgs={len(msgs)}")
        else:
            log(False, "GET /dms/{testuser1_id} history", f"{r.status_code} {r.text}")

        # 9. peer mark read
        r = await c.post(f"{API}/dms/{u1['id']}/read", headers=h2)
        if r.status_code == 200:
            body = r.json()
            log(body.get("ok") is True and body.get("marked", 0) >= 1,
                "POST /dms/{id}/read", f"marked={body.get('marked')}")
        else:
            log(False, "POST /dms/{id}/read", f"{r.status_code} {r.text}")

        # 10. peer typing
        r = await c.post(f"{API}/dms/{u1['id']}/typing", headers=h2)
        if r.status_code == 200:
            log(r.json().get("ok") is True, "POST /dms/{id}/typing", "")
        else:
            log(False, "POST /dms/{id}/typing", f"{r.status_code} {r.text}")

        # 11. testuser1 edit
        if msg_id:
            r = await c.patch(f"{API}/dms/{msg_id}", headers=h1, json={"text": "hello edited"})
            if r.status_code == 200:
                body = r.json()
                log(body.get("edited") is True and body.get("text") == "hello edited",
                    "PATCH /dms/{message_id}", f"edited={body.get('edited')}")
            else:
                log(False, "PATCH /dms/{message_id}", f"{r.status_code} {r.text}")

            # 12. testuser1 delete
            r = await c.delete(f"{API}/dms/{msg_id}", headers=h1)
            if r.status_code == 200:
                log(r.json().get("ok") is True, "DELETE /dms/{message_id}", "")
            else:
                log(False, "DELETE /dms/{message_id}", f"{r.status_code} {r.text}")

        # 13. Block path: testuser1 blocks peer → DM 403
        r = await c.post(f"{API}/users/block/{u2['id']}", headers=h1)
        log(r.status_code == 200, "block peer", f"{r.status_code}")

        r = await c.post(f"{API}/dms/{u2['id']}", headers=h1, json={"text": "x"})
        log(r.status_code == 403, "POST /dms while blocked → 403", f"{r.status_code} {r.text[:80]}")

        # 14. Unblock and verify DM is 403 because no longer friends
        r = await c.post(f"{API}/users/unblock/{u2['id']}", headers=h1)
        log(r.status_code == 200, "unblock peer", f"{r.status_code}")

        r = await c.post(f"{API}/dms/{u2['id']}", headers=h1, json={"text": "after-unblock"})
        body_text = r.text[:120]
        log(r.status_code == 403, "POST /dms after unblock (no friendship) → 403",
            f"{r.status_code} body={body_text}")

        # ====================================================================
        # Section 2: DM WebSocket realtime + presence
        # ====================================================================
        # Re-friend
        r = await c.post(f"{API}/friends/request/{u2['id']}", headers=h1)
        log(r.status_code == 200, "re-friend request", f"{r.status_code}")
        r = await c.post(f"{API}/friends/accept/{u1['id']}", headers=h2)
        log(r.status_code == 200, "re-friend accept", f"{r.status_code}")

        ws_url1 = f"{WS_BASE}/api/ws/dms?token={token1}"
        ws_url2 = f"{WS_BASE}/api/ws/dms?token={token2}"

        ws1_msgs = []
        ws2_msgs = []

        async def reader(ws, sink):
            try:
                async for m in ws:
                    try:
                        sink.append(json.loads(m))
                    except Exception:
                        sink.append({"raw": m})
            except Exception:
                pass

        try:
            ws1 = await websockets.connect(ws_url1, open_timeout=10)
            ws2 = await websockets.connect(ws_url2, open_timeout=10)
            t1r = asyncio.create_task(reader(ws1, ws1_msgs))
            t2r = asyncio.create_task(reader(ws2, ws2_msgs))
            await asyncio.sleep(0.6)

            # Send DM via REST
            r = await c.post(f"{API}/dms/{u2['id']}", headers=h1, json={"text": "realtime test"})
            log(r.status_code == 201, "POST /dms 'realtime test'", f"{r.status_code}")

            await asyncio.sleep(1.5)

            got1 = any(m.get("type") == "dm_new" and m.get("message", {}).get("text") == "realtime test" for m in ws1_msgs)
            got2 = any(m.get("type") == "dm_new" and m.get("message", {}).get("text") == "realtime test" for m in ws2_msgs)
            log(got1, "WS testuser1 received dm_new", f"msgs_seen={[m.get('type') for m in ws1_msgs]}")
            log(got2, "WS peer received dm_new", f"msgs_seen={[m.get('type') for m in ws2_msgs]}")

            # Close peer WS and check presence offline on testuser1's side
            ws1_msgs.clear()
            await ws2.close()
            await asyncio.sleep(2.5)
            presence_off = any(
                m.get("type") == "presence" and m.get("user_id") == u2["id"] and m.get("online") is False
                for m in ws1_msgs
            )
            log(presence_off, "WS presence offline received",
                f"msgs={[m for m in ws1_msgs if m.get('type')=='presence']}")

            await ws1.close()
            t1r.cancel(); t2r.cancel()
        except Exception as e:
            log(False, "DM WebSocket flow", f"exception: {e}")

        # ====================================================================
        # Section 3: Shared time tracking
        # ====================================================================
        r = await c.post(f"{API}/rooms", headers=h1, json={"name": "sharedtest", "is_public": True})
        if r.status_code != 201:
            log(False, "create room", f"{r.status_code} {r.text}")
            return
        room = r.json()
        room_id = room["id"]
        log(True, "create public room", f"id={room_id}")

        room_ws_url1 = f"{WS_BASE}/api/ws/rooms/{room_id}?token={token1}"
        room_ws_url2 = f"{WS_BASE}/api/ws/rooms/{room_id}?token={token2}"

        rws1_msgs = []
        rws2_msgs = []
        try:
            rws1 = await websockets.connect(room_ws_url1, open_timeout=10)
            rws2 = await websockets.connect(room_ws_url2, open_timeout=10)
            tr1 = asyncio.create_task(reader(rws1, rws1_msgs))
            tr2 = asyncio.create_task(reader(rws2, rws2_msgs))

            await asyncio.sleep(4.2)

            # Disconnect peer first → triggers shared time persistence
            await rws2.close()
            await asyncio.sleep(1.5)

            # GET shared_time as testuser1
            r = await c.get(f"{API}/users/{u2['id']}/shared_time", headers=h1)
            if r.status_code == 200:
                body = r.json()
                ok = body.get("seconds", 0) >= 2 and body.get("hidden") is False
                log(ok, "GET shared_time after co-watch",
                    f"seconds={body.get('seconds')} hidden={body.get('hidden')}")
            else:
                log(False, "GET shared_time after co-watch", f"{r.status_code} {r.text}")

            # Privacy: peer sets nobody
            r = await c.patch(f"{API}/users/privacy", headers=h2,
                              json={"shared_time_visibility": "nobody"})
            log(r.status_code == 200, "PATCH privacy nobody", f"{r.status_code}")

            r = await c.get(f"{API}/users/{u2['id']}/shared_time", headers=h1)
            if r.status_code == 200:
                body = r.json()
                log(body.get("hidden") is True and body.get("seconds") == 0,
                    "GET shared_time hidden when nobody",
                    f"seconds={body.get('seconds')} hidden={body.get('hidden')}")
            else:
                log(False, "GET shared_time hidden", f"{r.status_code} {r.text}")

            # Reset to friends
            r = await c.patch(f"{API}/users/privacy", headers=h2,
                              json={"shared_time_visibility": "friends"})
            log(r.status_code == 200, "PATCH privacy back to friends", f"{r.status_code}")

            await rws1.close()
            tr1.cancel(); tr2.cancel()
        except Exception as e:
            log(False, "Shared time flow", f"exception: {e}")

        # 4. Privacy sanity
        r = await c.get(f"{API}/users/privacy", headers=h1)
        if r.status_code == 200:
            body = r.json()
            log("shared_time_visibility" in body, "GET /users/privacy (testuser1)", f"keys={list(body.keys())}")
        else:
            log(False, "GET /users/privacy", f"{r.status_code} {r.text}")

    fails = [(n, d) for ok, n, d in results if not ok]
    print("\n=========== SUMMARY ===========")
    print(f"Total: {len(results)}  Failed: {len(fails)}")
    for n, d in fails:
        print(f" - FAIL: {n} :: {d}")
    return 0 if not fails else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
