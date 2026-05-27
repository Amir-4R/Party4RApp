"""
Phase 4 re-verification: two specific fixes.
1) GET /api/youtube/extract
2) Skip-vote clears video_url and broadcasts playback change_video
"""
from __future__ import annotations
import asyncio
import json
import os
import secrets
import time

import httpx
import websockets

BASE = "https://partyapp-sync.preview.emergentagent.com"
API = f"{BASE}/api"
WS_BASE = BASE.replace("https://", "wss://").replace("http://", "ws://")

USER1 = {"username": "testuser1", "password": "pass1234"}

FAILURES: list[str] = []


def fail(name, detail):
    msg = f"FAIL [{name}] {detail}"
    print(msg)
    FAILURES.append(msg)


def ok(name, detail=""):
    print(f"PASS [{name}] {detail}")


def auth(t):
    return {"Authorization": f"Bearer {t}"}


async def login(cx, u, p):
    r = await cx.post(f"{API}/auth/login", json={"username": u, "password": p})
    r.raise_for_status()
    j = r.json()
    return j["access_token"], j["user"]["id"]


async def signup(cx, u, p, nick):
    r = await cx.post(
        f"{API}/auth/signup",
        json={"username": u, "password": p, "nickname": nick, "avatar": "avatar_cat"},
    )
    r.raise_for_status()
    j = r.json()
    return j["access_token"], j["user"]["id"]


# ---------- Test 1: GET /youtube/extract ----------
async def test_youtube_get(t1: str):
    name = "GET /youtube/extract"
    async with httpx.AsyncClient(timeout=20.0) as cx:
        # Long URL
        r = await cx.get(
            f"{API}/youtube/extract",
            params={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
            headers=auth(t1),
        )
        if r.status_code != 200:
            fail(name + " long url", f"{r.status_code} {r.text[:200]}")
        else:
            j = r.json()
            if j.get("video_id") != "dQw4w9WgXcQ":
                fail(name + " long url video_id", json.dumps(j))
            elif not j.get("video_url") or not j.get("embed_url") or not j.get("thumbnail"):
                fail(name + " long url shape", json.dumps(j))
            else:
                ok(name + " long url", json.dumps(j))

        # Short URL
        r = await cx.get(
            f"{API}/youtube/extract",
            params={"url": "https://youtu.be/dQw4w9WgXcQ"},
            headers=auth(t1),
        )
        if r.status_code != 200 or r.json().get("video_id") != "dQw4w9WgXcQ":
            fail(name + " short url", f"{r.status_code} {r.text[:200]}")
        else:
            ok(name + " short url", json.dumps(r.json()))

        # Invalid URL
        r = await cx.get(
            f"{API}/youtube/extract",
            params={"url": "not-a-valid-url"},
            headers=auth(t1),
        )
        if r.status_code != 400:
            fail(name + " invalid -> 400", f"got {r.status_code} {r.text[:200]}")
        else:
            ok(name + " invalid -> 400")

        # POST regression check
        r = await cx.post(
            f"{API}/youtube/extract",
            headers=auth(t1),
            json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
        )
        if r.status_code != 200 or r.json().get("video_id") != "dQw4w9WgXcQ":
            fail("POST /youtube/extract regression", f"{r.status_code} {r.text[:200]}")
        else:
            ok("POST /youtube/extract regression", json.dumps(r.json()))


# ---------- Test 2: Skip clears video_url ----------
async def _ws_connect(room_id, token):
    url = f"{WS_BASE}/api/ws/rooms/{room_id}?token={token}"
    return await websockets.connect(url, max_size=2**22)


async def _drain(ws, seconds=1.5):
    deadline = time.time() + seconds
    drained = []
    while time.time() < deadline:
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=0.4)
            try:
                drained.append(json.loads(raw))
            except Exception:
                pass
        except asyncio.TimeoutError:
            break
    return drained


async def _recv_all(ws, timeout=6.0):
    """Drain all messages within `timeout` seconds and return them."""
    deadline = time.time() + timeout
    msgs = []
    while time.time() < deadline:
        try:
            remaining = deadline - time.time()
            if remaining <= 0:
                break
            raw = await asyncio.wait_for(ws.recv(), timeout=min(remaining, 1.5))
            try:
                msgs.append(json.loads(raw))
            except Exception:
                pass
        except asyncio.TimeoutError:
            # if we already received something and no more incoming, exit early
            if msgs:
                break
            continue
    return msgs


async def test_skip_clears(t1, id1, t2, id2):
    name = "Skip-vote clears video_url"
    async with httpx.AsyncClient(timeout=20.0) as cx:
        # Create room
        r = await cx.post(
            f"{API}/rooms",
            headers=auth(t1),
            json={
                "name": "skiptest",
                "is_public": True,
                "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            },
        )
        if r.status_code != 201:
            fail(name + " create_room", f"{r.status_code} {r.text[:200]}")
            return
        room_id = r.json()["id"]
        ok(name + " create_room", room_id)

        # Ensure voting_mode = allowed (default)
        await cx.patch(
            f"{API}/rooms/{room_id}/settings",
            headers=auth(t1),
            json={"voting_mode": "allowed"},
        )

    ws_host = await _ws_connect(room_id, t1)
    ws_peer = await _ws_connect(room_id, t2)
    try:
        await _drain(ws_host, 1.5)
        await _drain(ws_peer, 1.5)

        # Peer initiates skip
        await ws_peer.send(json.dumps({"type": "vote_start", "kind": "skip"}))
        await asyncio.sleep(0.4)
        # Collect vote_state on both sides
        host_msgs = await _recv_all(ws_host, timeout=3.0)
        peer_msgs = await _recv_all(ws_peer, timeout=1.0)

        host_state = next((m for m in host_msgs if m.get("type") == "vote_state"), None)
        peer_state = next((m for m in peer_msgs if m.get("type") == "vote_state"), None)
        if not host_state or not peer_state:
            fail(name + " vote_state broadcast", f"host={host_state} peer={peer_state}")
            return
        ok(name + " vote_state on both", json.dumps(host_state.get("vote")))

        # Host casts yes
        await ws_host.send(json.dumps({"type": "vote_cast", "yes": True}))
        await asyncio.sleep(0.6)
        host_msgs = await _recv_all(ws_host, timeout=4.0)
        peer_msgs = await _recv_all(ws_peer, timeout=1.0)

        # Look for "playback" change_video with video_url=null on BOTH sides
        host_playback = next(
            (m for m in host_msgs if m.get("type") == "playback" and m.get("event") == "change_video"),
            None,
        )
        peer_playback = next(
            (m for m in peer_msgs if m.get("type") == "playback" and m.get("event") == "change_video"),
            None,
        )
        if not host_playback or not peer_playback:
            fail(name + " playback change_video broadcast",
                 f"host={host_playback} peer={peer_playback} | host_msgs={host_msgs} | peer_msgs={peer_msgs}")
        else:
            if host_playback.get("video_url") not in (None, "null"):
                fail(name + " host playback video_url not null", json.dumps(host_playback))
            elif peer_playback.get("video_url") not in (None, "null"):
                fail(name + " peer playback video_url not null", json.dumps(peer_playback))
            else:
                ok(name + " playback change_video video_url=null on both",
                   json.dumps({"host": host_playback, "peer": peer_playback}))

        # Look for "vote_result" passed/skip on both
        host_res = next(
            (m for m in host_msgs if m.get("type") == "vote_result"),
            None,
        )
        peer_res = next(
            (m for m in peer_msgs if m.get("type") == "vote_result"),
            None,
        )
        if not host_res or not peer_res:
            fail(name + " vote_result broadcast", f"host={host_res} peer={peer_res}")
        elif not (host_res.get("passed") and host_res.get("kind") == "skip"):
            fail(name + " vote_result content", json.dumps(host_res))
        else:
            ok(name + " vote_result passed/skip on both",
               json.dumps({"host": host_res, "peer": peer_res}))

        # GET /rooms/{id} while WS still connected (room is destroyed once empty)
        await asyncio.sleep(0.3)
        async with httpx.AsyncClient(timeout=20.0) as cx:
            r = await cx.get(f"{API}/rooms/{room_id}", headers=auth(t1))
            if r.status_code != 200:
                fail(name + " GET room", f"{r.status_code} {r.text[:200]}")
            else:
                vu = r.json().get("video_url")
                if vu:
                    fail(name + " video_url not cleared", f"got {vu!r}")
                else:
                    ok(name + " GET /rooms/{id} video_url is null", json.dumps(r.json()))
    finally:
        await ws_host.close()
        await ws_peer.close()


async def main():
    print(f"Re-verification against {BASE}")
    async with httpx.AsyncClient(timeout=20.0) as cx:
        t1, id1 = await login(cx, USER1["username"], USER1["password"])
        peer_user = f"skippeer_{secrets.token_hex(4)}"
        t2, id2 = await signup(cx, peer_user, "pass1234", "SkipPeer")
        # Friendship
        r = await cx.post(f"{API}/friends/request/{id1}", headers=auth(t2))
        if r.status_code not in (200, 201):
            fail("friend_request", f"{r.status_code} {r.text[:200]}")
        r = await cx.post(f"{API}/friends/accept/{id2}", headers=auth(t1))
        if r.status_code not in (200, 201):
            fail("friend_accept", f"{r.status_code} {r.text[:200]}")
        ok("setup", f"id1={id1} id2={id2} peer={peer_user}")

    await test_youtube_get(t1)
    await test_skip_clears(t1, id1, t2, id2)

    print("\n========== SUMMARY ==========")
    if FAILURES:
        print(f"{len(FAILURES)} FAILURES:")
        for f in FAILURES:
            print(" - " + f)
    else:
        print("All re-verification assertions passed.")


if __name__ == "__main__":
    asyncio.run(main())
