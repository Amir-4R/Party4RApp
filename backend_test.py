"""
Phase 4 backend tests for Party4RApp:
- PATCH /api/rooms/{id}/settings (voting_mode)
- GET /api/youtube/extract
- Voting WS flow (vote_start / vote_cast / vote_cancel)
- Voting policy enforcement (owner_only)
- vote-next flow

Runs against the public EXPO_PUBLIC_BACKEND_URL.
"""
from __future__ import annotations
import asyncio
import json
import os
import secrets
import time
from typing import Optional

import httpx
import websockets

BASE = "https://partyapp-sync.preview.emergentagent.com"
API = f"{BASE}/api"
WS_BASE = BASE.replace("https://", "wss://").replace("http://", "ws://")

USER1 = {"username": "testuser1", "password": "pass1234"}

FAILURES: list[str] = []
NOTES: list[str] = []


def fail(name: str, detail: str):
    msg = f"FAIL [{name}] {detail}"
    print(msg)
    FAILURES.append(msg)


def ok(name: str, detail: str = ""):
    print(f"PASS [{name}] {detail}")


async def login(cx: httpx.AsyncClient, username: str, password: str) -> tuple[str, str]:
    r = await cx.post(f"{API}/auth/login", json={"username": username, "password": password})
    r.raise_for_status()
    j = r.json()
    return j["access_token"], j["user"]["id"]


async def signup(cx: httpx.AsyncClient, username: str, password: str, nickname: str) -> tuple[str, str]:
    r = await cx.post(
        f"{API}/auth/signup",
        json={"username": username, "password": password, "nickname": nickname, "avatar": "avatar_cat"},
    )
    r.raise_for_status()
    j = r.json()
    return j["access_token"], j["user"]["id"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def setup_users() -> dict:
    async with httpx.AsyncClient(timeout=20.0) as cx:
        t1, id1 = await login(cx, USER1["username"], USER1["password"])
        peer_username = f"votepeer_{secrets.token_hex(4)}"
        t2, id2 = await signup(cx, peer_username, "pass1234", "VotePeer")
        # Friendship: peer sends, testuser1 accepts
        r = await cx.post(f"{API}/friends/request/{id1}", headers=auth(t2))
        if r.status_code not in (200, 201):
            fail("friend_request", f"{r.status_code} {r.text[:200]}")
        r = await cx.post(f"{API}/friends/accept/{id2}", headers=auth(t1))
        if r.status_code not in (200, 201):
            fail("friend_accept", f"{r.status_code} {r.text[:200]}")
        ok("setup_users", f"testuser1={id1} peer={id2} ({peer_username})")
        return {"t1": t1, "id1": id1, "t2": t2, "id2": id2, "peer_username": peer_username}


async def create_room(t1: str) -> str:
    async with httpx.AsyncClient(timeout=20.0) as cx:
        r = await cx.post(
            f"{API}/rooms",
            headers=auth(t1),
            json={
                "name": "vote-test",
                "is_public": True,
                "video_url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
            },
        )
        if r.status_code != 201:
            fail("create_room", f"{r.status_code} {r.text[:200]}")
            return ""
        rid = r.json()["id"]
        ok("create_room", rid)
        return rid


# ---------------- Part 1: PATCH /rooms/{id}/settings ----------------
async def test_settings(t1: str, t2: str, room_id: str):
    name = "PATCH /rooms/{id}/settings"
    async with httpx.AsyncClient(timeout=20.0) as cx:
        # Host owner_only
        r = await cx.patch(
            f"{API}/rooms/{room_id}/settings",
            headers=auth(t1),
            json={"voting_mode": "owner_only"},
        )
        if r.status_code != 200:
            fail(name + " host->owner_only", f"{r.status_code} {r.text[:200]}")
        else:
            j = r.json()
            if j.get("voting_mode") != "owner_only":
                fail(name + " host->owner_only", f"voting_mode in resp = {j.get('voting_mode')}")
            else:
                ok(name + " host->owner_only", json.dumps(j))

        # Peer forbidden
        r = await cx.patch(
            f"{API}/rooms/{room_id}/settings",
            headers=auth(t2),
            json={"voting_mode": "allowed"},
        )
        if r.status_code != 403:
            fail(name + " peer->403", f"got {r.status_code} {r.text[:200]}")
        else:
            ok(name + " peer->403")

        # Host back to allowed
        r = await cx.patch(
            f"{API}/rooms/{room_id}/settings",
            headers=auth(t1),
            json={"voting_mode": "allowed"},
        )
        if r.status_code != 200 or r.json().get("voting_mode") != "allowed":
            fail(name + " host->allowed", f"{r.status_code} {r.text[:200]}")
        else:
            ok(name + " host->allowed")


# ---------------- Part 2: GET /youtube/extract ----------------
async def test_youtube_extract(t1: str):
    name = "GET /youtube/extract"
    async with httpx.AsyncClient(timeout=20.0) as cx:
        # Spec says GET with ?url=, code currently uses POST with JSON body. Test GET first.
        urls_ok = [
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ",
        ]
        for url in urls_ok:
            r = await cx.get(f"{API}/youtube/extract", params={"url": url}, headers=auth(t1))
            if r.status_code != 200:
                fail(name + f" GET {url}", f"{r.status_code} {r.text[:300]}")
                continue
            j = r.json()
            if j.get("video_id") != "dQw4w9WgXcQ":
                fail(name + f" GET {url}", f"video_id={j.get('video_id')}")
            else:
                ok(name + f" GET {url}", json.dumps(j))

        # Invalid URL
        r = await cx.get(f"{API}/youtube/extract", params={"url": "not-a-valid-url"}, headers=auth(t1))
        if r.status_code not in (400, 422):
            fail(name + " GET invalid", f"got {r.status_code} {r.text[:200]}")
        else:
            ok(name + " GET invalid", str(r.status_code))

    # Fallback: try POST form (the implementation uses POST). Report as note.
    async with httpx.AsyncClient(timeout=20.0) as cx:
        r = await cx.post(
            f"{API}/youtube/extract",
            headers=auth(t1),
            json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
        )
        NOTES.append(f"POST /youtube/extract returns {r.status_code}: {r.text[:200]}")


# ---------------- Part 3: WS voting flow ----------------
async def _ws_connect(room_id: str, token: str):
    url = f"{WS_BASE}/api/ws/rooms/{room_id}?token={token}"
    return await websockets.connect(url, max_size=2**22)


async def _recv_until(ws, predicate, timeout=10.0, collect=False):
    """Receive messages until predicate(msg) is True. Returns (matched_msg, collected_list)."""
    deadline = time.time() + timeout
    collected = []
    while time.time() < deadline:
        remaining = deadline - time.time()
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
        except asyncio.TimeoutError:
            return None, collected
        try:
            msg = json.loads(raw)
        except Exception:
            continue
        collected.append(msg)
        if predicate(msg):
            return msg, collected
    return None, collected


async def _drain_init(ws, name=""):
    """Drain init/user_joined frames so the test can focus on votes."""
    deadline = time.time() + 1.5
    while time.time() < deadline:
        try:
            await asyncio.wait_for(ws.recv(), timeout=0.4)
        except asyncio.TimeoutError:
            break


async def test_vote_skip(ctx: dict, room_id: str):
    name = "WS vote skip (allowed)"
    # Ensure voting_mode is allowed
    async with httpx.AsyncClient(timeout=20.0) as cx:
        await cx.patch(
            f"{API}/rooms/{room_id}/settings",
            headers=auth(ctx["t1"]),
            json={"voting_mode": "allowed"},
        )

    ws_host = await _ws_connect(room_id, ctx["t1"])
    ws_peer = await _ws_connect(room_id, ctx["t2"])
    try:
        await _drain_init(ws_host)
        await _drain_init(ws_peer)

        # Peer initiates skip vote
        await ws_peer.send(json.dumps({"type": "vote_start", "kind": "skip"}))

        peer_state, _ = await _recv_until(
            ws_peer, lambda m: m.get("type") == "vote_state", timeout=6.0
        )
        host_state, _ = await _recv_until(
            ws_host, lambda m: m.get("type") == "vote_state", timeout=6.0
        )
        if not peer_state or not host_state:
            fail(name + " vote_state broadcast", f"peer={peer_state} host={host_state}")
            return
        v = peer_state.get("vote", {})
        if v.get("kind") != "skip":
            fail(name + " vote.kind", str(v))
        if v.get("initiator") != ctx["id2"]:
            fail(name + " vote.initiator", f"got {v.get('initiator')} expected {ctx['id2']}")
        if v.get("yes") != 1 or v.get("no") != 0:
            fail(name + " yes/no counts", str(v))
        if v.get("required") != 2:
            fail(name + " required", f"got {v.get('required')} expected 2 (members={v.get('member_count')})")
        if "expires_at" not in v:
            fail(name + " expires_at", "missing")
        ok(name + " vote_state ok", json.dumps({"kind": v.get("kind"), "yes": v.get("yes"), "required": v.get("required"), "members": v.get("member_count")}))

        # Host casts yes
        await ws_host.send(json.dumps({"type": "vote_cast", "yes": True}))
        peer_res, _ = await _recv_until(
            ws_peer, lambda m: m.get("type") == "vote_result", timeout=6.0
        )
        host_res, _ = await _recv_until(
            ws_host, lambda m: m.get("type") == "vote_result", timeout=6.0
        )
        if not peer_res or not host_res:
            fail(name + " vote_result broadcast", f"peer={peer_res} host={host_res}")
            return
        if not peer_res.get("passed") or peer_res.get("kind") != "skip":
            fail(name + " vote_result content", json.dumps(peer_res))
        else:
            ok(name + " vote_result passed", json.dumps(peer_res))

        # After skip, spec says host video_url should be cleared
        async with httpx.AsyncClient(timeout=20.0) as cx:
            r = await cx.get(f"{API}/rooms/{room_id}", headers=auth(ctx["t1"]))
            if r.status_code == 200:
                vu = r.json().get("video_url")
                if vu:
                    fail(
                        name + " skip should clear video_url",
                        f"video_url still set after skip-passed: {vu}",
                    )
                else:
                    ok(name + " skip cleared video_url")
            else:
                fail(name + " GET room", f"{r.status_code} {r.text[:200]}")
    finally:
        await ws_host.close()
        await ws_peer.close()


async def test_voting_policy(ctx: dict, room_id: str):
    name = "WS voting policy (owner_only)"
    async with httpx.AsyncClient(timeout=20.0) as cx:
        r = await cx.patch(
            f"{API}/rooms/{room_id}/settings",
            headers=auth(ctx["t1"]),
            json={"voting_mode": "owner_only"},
        )
        if r.status_code != 200:
            fail(name + " set owner_only", f"{r.status_code} {r.text[:200]}")
            return

    ws_host = await _ws_connect(room_id, ctx["t1"])
    ws_peer = await _ws_connect(room_id, ctx["t2"])
    try:
        await _drain_init(ws_host)
        await _drain_init(ws_peer)

        # Peer tries vote_start - should be rejected (no vote_state)
        await ws_peer.send(json.dumps({"type": "vote_start", "kind": "skip"}))
        peer_state, peer_msgs = await _recv_until(
            ws_peer, lambda m: m.get("type") == "vote_state", timeout=2.5
        )
        if peer_state:
            fail(name + " peer should NOT start vote", json.dumps(peer_state))
        else:
            ok(name + " peer vote_start blocked")

        # Host vote_start - should work
        await ws_host.send(json.dumps({"type": "vote_start", "kind": "skip"}))
        host_state, _ = await _recv_until(
            ws_host, lambda m: m.get("type") == "vote_state", timeout=6.0
        )
        peer_state2, _ = await _recv_until(
            ws_peer, lambda m: m.get("type") == "vote_state", timeout=6.0
        )
        if not host_state or not peer_state2:
            fail(name + " host vote_start broadcast", f"host={host_state} peer={peer_state2}")
            return
        v = host_state.get("vote", {})
        if v.get("initiator") != ctx["id1"]:
            fail(name + " host-vote initiator", str(v))
        else:
            ok(name + " host vote_start broadcast", json.dumps({"initiator": v.get("initiator"), "kind": v.get("kind")}))

        # Host cancels
        await ws_host.send(json.dumps({"type": "vote_cancel"}))
        host_res, _ = await _recv_until(
            ws_host, lambda m: m.get("type") == "vote_result", timeout=6.0
        )
        peer_res, _ = await _recv_until(
            ws_peer, lambda m: m.get("type") == "vote_result", timeout=6.0
        )
        if not host_res or not peer_res:
            fail(name + " cancel result", f"host={host_res} peer={peer_res}")
        elif not host_res.get("cancelled"):
            fail(name + " cancelled flag", json.dumps(host_res))
        else:
            ok(name + " vote_cancel broadcast", json.dumps(host_res))
    finally:
        await ws_host.close()
        await ws_peer.close()


async def test_vote_next(ctx: dict, room_id: str):
    name = "WS vote-next flow"
    # Make sure room has a video first (it may have been cleared by previous skip)
    async with httpx.AsyncClient(timeout=20.0) as cx:
        # Reset to allowed
        await cx.patch(
            f"{API}/rooms/{room_id}/settings",
            headers=auth(ctx["t1"]),
            json={"voting_mode": "allowed"},
        )

    ws_host = await _ws_connect(room_id, ctx["t1"])
    ws_peer = await _ws_connect(room_id, ctx["t2"])
    try:
        await _drain_init(ws_host)
        await _drain_init(ws_peer)

        # Peer starts a vote_next for "Me at the zoo"
        await ws_peer.send(json.dumps({
            "type": "vote_start",
            "kind": "next",
            "video_url": "https://youtu.be/jNQXAC9IVRw",
            "title": "Me at the zoo",
        }))
        peer_state, _ = await _recv_until(ws_peer, lambda m: m.get("type") == "vote_state", timeout=6.0)
        host_state, _ = await _recv_until(ws_host, lambda m: m.get("type") == "vote_state", timeout=6.0)
        if not peer_state or not host_state:
            fail(name + " vote_state broadcast", f"peer={peer_state} host={host_state}")
            return
        v = host_state.get("vote", {})
        if v.get("kind") != "next" or v.get("initiator") != ctx["id2"]:
            fail(name + " next vote.kind/initiator", str(v))
        else:
            ok(name + " next vote_state", json.dumps({"kind": v.get("kind"), "video_url": v.get("video_url")}))

        # Host casts yes
        await ws_host.send(json.dumps({"type": "vote_cast", "yes": True}))
        # We expect: vote_state (with new counts) then vote_result for next
        peer_res, _ = await _recv_until(ws_peer, lambda m: m.get("type") == "vote_result", timeout=6.0)
        host_res, _ = await _recv_until(ws_host, lambda m: m.get("type") == "vote_result", timeout=6.0)
        if not peer_res or not host_res:
            fail(name + " vote_result broadcast", f"peer={peer_res} host={host_res}")
            return
        if not peer_res.get("passed") or peer_res.get("kind") != "next":
            fail(name + " vote_result content", json.dumps(peer_res))
        else:
            ok(name + " vote_result passed", json.dumps(peer_res))

        # Verify room video_url updated
        await asyncio.sleep(0.5)
        async with httpx.AsyncClient(timeout=20.0) as cx:
            r = await cx.get(f"{API}/rooms/{room_id}", headers=auth(ctx["t1"]))
            if r.status_code != 200:
                fail(name + " GET room", f"{r.status_code} {r.text[:200]}")
            else:
                vu = r.json().get("video_url") or ""
                if "jNQXAC9IVRw" not in vu:
                    fail(name + " video_url updated", f"got {vu!r}")
                else:
                    ok(name + " video_url updated", vu)
    finally:
        await ws_host.close()
        await ws_peer.close()


async def main():
    print(f"Testing against {BASE}")
    ctx = await setup_users()

    # 1) settings
    rid = await create_room(ctx["t1"])
    if rid:
        await test_settings(ctx["t1"], ctx["t2"], rid)
    # 2) youtube
    await test_youtube_extract(ctx["t1"])
    # 3) WS skip (creates own room because previous gets destroyed when WS closes)
    rid = await create_room(ctx["t1"])
    if rid:
        await test_vote_skip(ctx, rid)
    # 4) policy
    rid = await create_room(ctx["t1"])
    if rid:
        await test_voting_policy(ctx, rid)
    # 5) vote-next
    rid = await create_room(ctx["t1"])
    if rid:
        await test_vote_next(ctx, rid)

    print("\n========== SUMMARY ==========")
    if NOTES:
        print("Notes:")
        for n in NOTES:
            print("  - " + n)
    if FAILURES:
        print(f"\n{len(FAILURES)} FAILURES:")
        for f in FAILURES:
            print("  - " + f)
    else:
        print("All Phase 4 assertions passed.")


if __name__ == "__main__":
    asyncio.run(main())
