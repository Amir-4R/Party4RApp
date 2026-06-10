"""
Damma matchmaking queue tests — Phase 4.
Tests POST /api/damma/queue/join, GET /api/damma/queue/status, POST /api/damma/queue/leave
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = "https://partyapp-sync.preview.emergentagent.com"
API = f"{BASE_URL}/api/damma"


def _uid(tag: str) -> str:
    return f"TEST_q4_{tag}_{uuid.uuid4().hex[:6]}"


@pytest.fixture(scope="module")
def cleanup_users():
    """Track all queue user_ids so we can drain them post-test."""
    ids: list[str] = []
    yield ids
    for u in ids:
        try:
            requests.post(f"{API}/queue/leave", json={"user_id": u, "name": ""}, timeout=5)
        except Exception:
            pass


# ── Ingress reachability ────────────────────────────────────────────────────
def test_ingress_reachable():
    """Verify /api/damma/* is reachable via the public ingress."""
    r = requests.get(f"{API}/rooms", timeout=10)
    assert r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert "rooms" in body and isinstance(body["rooms"], list)


# ── Queue join (single user) ────────────────────────────────────────────────
def test_queue_join_returns_position_and_size(cleanup_users):
    u = _uid("solo")
    cleanup_users.append(u)
    # Drain any leftover first
    requests.post(f"{API}/queue/leave", json={"user_id": u, "name": ""})

    r = requests.post(
        f"{API}/queue/join",
        json={"user_id": u, "name": "Solo", "avatar": "avatar_ninja", "num_players": 4},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["num_players"] == 4
    assert body["position"] >= 1
    assert body["queue_size"] >= 1
    # Leave so we don't pollute the queue for subsequent tests
    r2 = requests.post(f"{API}/queue/leave", json={"user_id": u, "name": "Solo"}, timeout=5)
    assert r2.status_code == 200


# ── Queue status while waiting ─────────────────────────────────────────────
def test_queue_status_pending(cleanup_users):
    u = _uid("pend")
    cleanup_users.append(u)
    requests.post(f"{API}/queue/leave", json={"user_id": u, "name": ""})
    requests.post(
        f"{API}/queue/join",
        json={"user_id": u, "name": "Pending", "num_players": 4},
        timeout=10,
    )
    r = requests.get(f"{API}/queue/status", params={"user_id": u}, timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["matched"] is False
    assert body["position"] >= 1
    assert body["queue_size"] >= 1
    assert body["num_players"] == 4
    # cleanup
    requests.post(f"{API}/queue/leave", json={"user_id": u, "name": "Pending"})


# ── Queue leave ────────────────────────────────────────────────────────────
def test_queue_leave_no_500(cleanup_users):
    u = _uid("leave")
    # Leave with no prior join — should still succeed
    r = requests.post(f"{API}/queue/leave", json={"user_id": u, "name": "x"}, timeout=10)
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True

    # Join then leave
    requests.post(f"{API}/queue/join", json={"user_id": u, "name": "Lv", "num_players": 4})
    cleanup_users.append(u)
    r2 = requests.post(f"{API}/queue/leave", json={"user_id": u, "name": "Lv"}, timeout=10)
    assert r2.status_code == 200
    # Status should report not matched + position 0
    r3 = requests.get(f"{API}/queue/status", params={"user_id": u}, timeout=5)
    assert r3.status_code == 200
    assert r3.json()["matched"] is False


# ── Full drain: 4 users → room created ─────────────────────────────────────
def test_four_users_drain_creates_room(cleanup_users):
    users = [_uid(f"d{i}") for i in range(4)]
    # Pre-clean
    for u in users:
        requests.post(f"{API}/queue/leave", json={"user_id": u, "name": ""})
    cleanup_users.extend(users)

    positions = []
    for i, u in enumerate(users):
        r = requests.post(
            f"{API}/queue/join",
            json={"user_id": u, "name": f"P{i}", "avatar": "avatar_ninja", "num_players": 4},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        positions.append(r.json())

    # Give server a moment for drain (it's done sync in queue_join though)
    time.sleep(0.5)

    # All four users should now be matched with same rid
    rids = []
    for u in users:
        r = requests.get(f"{API}/queue/status", params={"user_id": u}, timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["matched"] is True, f"User {u} not matched: {body}"
        assert "rid" in body and isinstance(body["rid"], str) and len(body["rid"]) > 0
        rids.append(body["rid"])

    assert len(set(rids)) == 1, f"Expected single shared rid, got {rids}"
    rid = rids[0]

    # Room should be retrievable
    r = requests.get(f"{API}/rooms/{rid}", timeout=10)
    assert r.status_code == 200, r.text
    room = r.json()["room"]
    assert room["num_players"] == 4
    assert len(room["slots"]) == 4
    # All 4 slots filled with our user_ids
    slot_uids = {s["user_id"] for s in room["slots"]}
    assert slot_uids == set(users), f"Slot user_ids {slot_uids} != {set(users)}"


# ── queue join with invalid num_players defaults to 4 ─────────────────────
def test_queue_join_invalid_num_players_defaults_to_four(cleanup_users):
    u = _uid("inv")
    cleanup_users.append(u)
    r = requests.post(
        f"{API}/queue/join",
        json={"user_id": u, "name": "Inv", "num_players": 5},
        timeout=10,
    )
    assert r.status_code == 200
    assert r.json()["num_players"] == 4
    requests.post(f"{API}/queue/leave", json={"user_id": u, "name": "Inv"})
