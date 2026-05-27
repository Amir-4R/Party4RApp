"""
Phase 8 backend test — Gmail SMTP for Reports + Admin moderation endpoints.

Constraints:
- Use pre-seeded admin: testuser1 / pass1234
- Limit to TWO POST /api/reports calls TOTAL across the whole test run.
- Verify response time of /api/reports is < 2 seconds.
- Verify backend logs do NOT contain "SMTP send failed" or "SMTP not configured".
"""
import os
import sys
import time
import json
import uuid
import secrets
import requests
import subprocess
from pathlib import Path

BASE = os.environ.get(
    "BACKEND_URL", "https://partyapp-sync.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE}/api"

ADMIN_USER = "testuser1"
ADMIN_PASS = "pass1234"

# Pre-seeded non-admin peer (we know the username but NOT password — only used as target).
TARGET_USERNAME = "peer_qceoot"

results = []   # list of (label, ok, detail)

def add(label, ok, detail=""):
    sym = "PASS" if ok else "FAIL"
    print(f"[{sym}] {label}  {detail}")
    results.append((label, ok, detail))


def jwt_for(username: str, password: str) -> str:
    r = requests.post(
        f"{API}/auth/login",
        json={"username": username, "password": password},
        timeout=15,
    )
    if r.status_code != 200:
        raise RuntimeError(f"login {username} failed: {r.status_code} {r.text[:200]}")
    return r.json()["access_token"]


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Setup: admin token + target user lookup
# ---------------------------------------------------------------------------
print(f"\n==> Backend URL: {API}\n")

admin_token = jwt_for(ADMIN_USER, ADMIN_PASS)
print(f"  admin token acquired for {ADMIN_USER}")

# We need testuser1's id for the target_id != self check and also for the target.
# Lookup the target user by searching admin's perspective.
me_r = requests.get(f"{API}/auth/me", headers=auth_header(admin_token), timeout=15)
assert me_r.status_code == 200, me_r.text
admin_id = me_r.json()["id"]
print(f"  admin id = {admin_id}")

# Find target peer_qceoot via search.
search_r = requests.get(
    f"{API}/users/search",
    headers=auth_header(admin_token),
    params={"q": TARGET_USERNAME},
    timeout=15,
)
assert search_r.status_code == 200, search_r.text
matches = [u for u in search_r.json() if u["username"] == TARGET_USERNAME]
if not matches:
    raise RuntimeError(f"could not find target user {TARGET_USERNAME}")
target_id = matches[0]["id"]
print(f"  target {TARGET_USERNAME} id = {target_id}")


# ---------------------------------------------------------------------------
# TASK 1 — GET /api/admin/smtp/health  (admin only)
# ---------------------------------------------------------------------------
r = requests.get(f"{API}/admin/smtp/health", headers=auth_header(admin_token), timeout=15)
ok = r.status_code == 200
body = r.json() if ok else {}
add("admin smtp/health status 200", ok, f"status={r.status_code}")

# Body shape checks
add("smtp/health configured:true", ok and body.get("configured") is True,
    f"configured={body.get('configured')}")
add("smtp/health host=smtp.gmail.com",
    ok and body.get("host") == "smtp.gmail.com",
    f"host={body.get('host')}")
add("smtp/health port=465", ok and body.get("port") == 465,
    f"port={body.get('port')}")
add("smtp/health moderation_email=yemenamer20@gmail.com",
    ok and body.get("moderation_email") == "yemenamer20@gmail.com",
    f"moderation_email={body.get('moderation_email')}")
add("smtp/health sender=yemenamer20@gmail.com",
    ok and body.get("sender") == "yemenamer20@gmail.com",
    f"sender={body.get('sender')}")
add("smtp/health does NOT leak password", "password" not in (body or {}) and "pass" not in (body or {}),
    f"keys={list(body.keys()) if body else []}")


# ---------------------------------------------------------------------------
# Capture backend log file size BEFORE the report so we can grep new lines.
# ---------------------------------------------------------------------------
BACKEND_LOG = "/var/log/supervisor/backend.err.log"
BACKEND_OUT = "/var/log/supervisor/backend.out.log"
log_pre_size = {}
for f in [BACKEND_LOG, BACKEND_OUT]:
    if os.path.exists(f):
        log_pre_size[f] = os.path.getsize(f)


# ---------------------------------------------------------------------------
# TASK 2 — POST /api/reports (FIRST OF TWO max calls)
# ---------------------------------------------------------------------------
report_body = {
    "target_id": target_id,
    "category": "harassment",
    "description": "Phase8 smoke test",
    "evidence": "automated test ping — please ignore",
}
t0 = time.time()
r = requests.post(
    f"{API}/reports",
    headers={**auth_header(admin_token), "Content-Type": "application/json"},
    data=json.dumps(report_body),
    timeout=10,
)
elapsed = time.time() - t0
add("POST /api/reports status 201", r.status_code == 201,
    f"status={r.status_code} elapsed={elapsed:.3f}s body={r.text[:160]}")
add("POST /api/reports response < 2s", elapsed < 2.0,
    f"elapsed={elapsed:.3f}s")

report_id = None
if r.status_code == 201:
    rj = r.json()
    add("POST /api/reports ok:true", rj.get("ok") is True, f"ok={rj.get('ok')}")
    report_id = rj.get("report_id")
    add("POST /api/reports report_id present", bool(report_id), f"report_id={report_id}")
else:
    add("POST /api/reports ok:true", False, "no body")
    add("POST /api/reports report_id present", False, "no body")

# Wait ~10s for the background SMTP send to attempt & log any error.
print("  ... waiting 10s for background SMTP task ...")
time.sleep(10)

# Grep new log lines for SMTP-related entries.
smtp_log_lines = []
for f in [BACKEND_LOG, BACKEND_OUT]:
    if not os.path.exists(f):
        continue
    pre = log_pre_size.get(f, 0)
    try:
        with open(f, "rb") as fh:
            fh.seek(pre)
            new = fh.read().decode("utf-8", errors="replace")
        for line in new.splitlines():
            if "SMTP" in line or "smtplib" in line or "ssl" in line.lower() and "Error" in line:
                smtp_log_lines.append(f"{Path(f).name}: {line}")
    except Exception as e:
        smtp_log_lines.append(f"{f}: read error: {e}")

print("\n--- SMTP-related log lines during test window ---")
for ln in smtp_log_lines:
    print("   " + ln)
if not smtp_log_lines:
    print("   (none)")
print("---\n")

has_send_failed = any("SMTP send failed" in ln for ln in smtp_log_lines)
has_not_configured = any("SMTP not configured" in ln for ln in smtp_log_lines)
add("backend logs do NOT contain 'SMTP send failed'", not has_send_failed,
    f"matched_lines={[l for l in smtp_log_lines if 'SMTP send failed' in l]}")
add("backend logs do NOT contain 'SMTP not configured'", not has_not_configured,
    f"matched_lines={[l for l in smtp_log_lines if 'SMTP not configured' in l]}")


# ---------------------------------------------------------------------------
# TASK 3 — GET /api/admin/reports?status=open&limit=20
# ---------------------------------------------------------------------------
r = requests.get(
    f"{API}/admin/reports",
    headers=auth_header(admin_token),
    params={"status": "open", "limit": 20},
    timeout=15,
)
add("GET /admin/reports?status=open 200", r.status_code == 200, f"status={r.status_code}")
if r.status_code == 200:
    body = r.json()
    add("GET /admin/reports body has 'reports' & 'count' keys",
        "reports" in body and "count" in body, f"keys={list(body.keys())}")
    rows = body.get("reports", [])
    # find our report
    found = next((row for row in rows if row.get("id") == report_id), None)
    add("our report_id present in open list", bool(found),
        f"report_id={report_id}, found={'yes' if found else 'no'}, rows={len(rows)}")
    if found:
        rep = found.get("reporter") or {}
        tgt = found.get("target") or {}
        add("enriched reporter has id/username/nickname/honor",
            all(k in rep for k in ("id", "username", "nickname", "honor")),
            f"reporter_keys={list(rep.keys())}")
        add("enriched target has id/username/nickname/honor",
            all(k in tgt for k in ("id", "username", "nickname", "honor")),
            f"target_keys={list(tgt.keys())}")
        add("report status == 'open'", found.get("status") == "open",
            f"status={found.get('status')}")
        add("created_at_dt NOT in response (stripped server-side)",
            "created_at_dt" not in found,
            f"has_created_at_dt={'created_at_dt' in found}")


# ---------------------------------------------------------------------------
# TASK 4 — PATCH /api/admin/reports/<id>  -> status=resolved
# ---------------------------------------------------------------------------
if report_id:
    r = requests.patch(
        f"{API}/admin/reports/{report_id}",
        headers={**auth_header(admin_token), "Content-Type": "application/json"},
        data=json.dumps({"status": "resolved"}),
        timeout=15,
    )
    add("PATCH /admin/reports/{id} resolved 200", r.status_code == 200,
        f"status={r.status_code} body={r.text[:160]}")
    if r.status_code == 200:
        rj = r.json()
        add("PATCH resolved body ok:true & status:'resolved'",
            rj.get("ok") is True and rj.get("status") == "resolved",
            f"body={rj}")

    # Should appear in resolved list
    r = requests.get(
        f"{API}/admin/reports",
        headers=auth_header(admin_token),
        params={"status": "resolved", "limit": 20},
        timeout=15,
    )
    if r.status_code == 200:
        rows = r.json().get("reports", [])
        found_resolved = any(row.get("id") == report_id for row in rows)
        add("report appears in status=resolved list", found_resolved,
            f"rows={len(rows)}")
    else:
        add("report appears in status=resolved list", False,
            f"status={r.status_code}")

    # Should NOT appear in open list anymore
    r = requests.get(
        f"{API}/admin/reports",
        headers=auth_header(admin_token),
        params={"status": "open", "limit": 20},
        timeout=15,
    )
    if r.status_code == 200:
        rows = r.json().get("reports", [])
        still_open = any(row.get("id") == report_id for row in rows)
        add("report NOT in status=open list after resolve", not still_open,
            f"rows={len(rows)}")


# ---------------------------------------------------------------------------
# TASK 5 — invalid status
# ---------------------------------------------------------------------------
if report_id:
    r = requests.patch(
        f"{API}/admin/reports/{report_id}",
        headers={**auth_header(admin_token), "Content-Type": "application/json"},
        data=json.dumps({"status": "banana"}),
        timeout=15,
    )
    add("PATCH invalid status -> 400", r.status_code == 400,
        f"status={r.status_code} body={r.text[:160]}")
    try:
        detail = r.json().get("detail")
    except Exception:
        detail = None
    add("PATCH invalid status detail correct",
        detail == "Invalid status (open|resolved|dismissed)",
        f"detail={detail!r}")


# ---------------------------------------------------------------------------
# TASK 6 — non-admin access must be denied (create a throwaway user)
# ---------------------------------------------------------------------------
nonadmin_username = f"nonadm_{secrets.token_hex(4)}"
nonadmin_password = f"P!{secrets.token_hex(6)}"
signup_r = requests.post(
    f"{API}/auth/signup",
    json={
        "username": nonadmin_username,
        "password": nonadmin_password,
        "nickname": "NonAdminTester",
        "avatar": "avatar_robot",
    },
    timeout=15,
)
assert signup_r.status_code == 201, f"signup failed: {signup_r.status_code} {signup_r.text}"
nonadmin_token = signup_r.json()["access_token"]
nonadmin_id = signup_r.json()["user"]["id"]
print(f"  non-admin signed up: {nonadmin_username} (id={nonadmin_id})")

# GET /admin/reports as non-admin -> 403
r = requests.get(f"{API}/admin/reports", headers=auth_header(nonadmin_token), timeout=15)
add("non-admin GET /admin/reports -> 403", r.status_code == 403,
    f"status={r.status_code} body={r.text[:160]}")
try:
    detail = r.json().get("detail")
except Exception:
    detail = None
add("non-admin /admin/reports detail = 'Admin access required'",
    detail == "Admin access required", f"detail={detail!r}")

# GET /admin/smtp/health as non-admin -> 403
r = requests.get(f"{API}/admin/smtp/health", headers=auth_header(nonadmin_token), timeout=15)
add("non-admin GET /admin/smtp/health -> 403", r.status_code == 403,
    f"status={r.status_code} body={r.text[:160]}")

# PATCH /admin/reports/<id> as non-admin -> 403
if report_id:
    r = requests.patch(
        f"{API}/admin/reports/{report_id}",
        headers={**auth_header(nonadmin_token), "Content-Type": "application/json"},
        data=json.dumps({"status": "open"}),
        timeout=15,
    )
    add("non-admin PATCH /admin/reports/{id} -> 403", r.status_code == 403,
        f"status={r.status_code} body={r.text[:160]}")


# ---------------------------------------------------------------------------
# TASK 7 — DELETE /api/auth/account (regression check on the throwaway user)
# ---------------------------------------------------------------------------
r = requests.delete(f"{API}/auth/account", headers=auth_header(nonadmin_token), timeout=15)
add("DELETE /auth/account (throwaway) ok", r.status_code == 200 and r.json().get("ok") is True,
    f"status={r.status_code} body={r.text[:160]}")
# After delete, /auth/me should fail
r = requests.get(f"{API}/auth/me", headers=auth_header(nonadmin_token), timeout=15)
add("after delete, /auth/me 401", r.status_code == 401,
    f"status={r.status_code}")


# ---------------------------------------------------------------------------
# SUMMARY
# ---------------------------------------------------------------------------
print("\n========== SUMMARY ==========")
passed = sum(1 for _, ok, _ in results if ok)
total = len(results)
print(f"PASSED: {passed} / {total}")
print()
fails = [(label, detail) for label, ok, detail in results if not ok]
if fails:
    print("FAILURES:")
    for label, detail in fails:
        print(f"  - {label}: {detail}")
else:
    print("All assertions passed.")

sys.exit(0 if passed == total else 1)
