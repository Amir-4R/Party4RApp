"""Phase 5 — re-verification of word filter only."""
import asyncio
import json
import sys
import httpx
import websockets

BASE = "https://partyapp-sync.preview.emergentagent.com"
API = BASE + "/api"
WS_BASE = BASE.replace("https://", "wss://")

results = []
def report(name, ok, detail=""):
    tag = "PASS" if ok else "FAIL"
    results.append((name, ok, detail))
    print(f"[{tag}] {name}: {detail}")


def auth(t): return {"Authorization": f"Bearer {t}"}


async def ws_recv_until_chat(ws, timeout=5.0):
    loop = asyncio.get_event_loop()
    end = loop.time() + timeout
    while True:
        rem = end - loop.time()
        if rem <= 0:
            return None
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=rem)
        except asyncio.TimeoutError:
            return None
        try:
            data = json.loads(raw)
        except Exception:
            continue
        if data.get("type") == "chat":
            return data


async def main():
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.post(f"{API}/auth/login", json={"username": "testuser1", "password": "pass1234"})
        if r.status_code != 200:
            print("login failed", r.status_code, r.text)
            return 1
        token = r.json()["access_token"]

        r = await client.post(f"{API}/rooms", json={"name": "modtest_rerun", "is_public": True}, headers=auth(token))
        if r.status_code != 201:
            print("room create failed", r.status_code, r.text)
            return 1
        room_id = r.json()["id"]
        report("create room", True, room_id)

        ws_url = f"{WS_BASE}/api/ws/rooms/{room_id}?token={token}"
        async with websockets.connect(ws_url) as ws:
            init_raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
            init = json.loads(init_raw)
            report("ws init", init.get("type") == "init", str(init.get("type")))

            cases = [
                # (label, input, expected_text, expected_bot_flag)
                ("F@ck off",       "F@ck off",       "**** off",         True),
                ("fuuuuck this",   "fuuuuck this",   "******* this",     True),  # 7 stars
                ("porn xxx nudes", "porn xxx nudes", "**** *** *****",   True),
                # Regression
                ("hello world",    "hello world",    "hello world",      False),
                ("fuck this shit", "fuck this shit", "**** this ****",   True),
                ("you BITCH",      "you BITCH",      "you *****",        True),
                ("kos omak",       "kos omak",       "*** omak",         True),
            ]

            for label, text_in, exp_text, exp_flag in cases:
                await ws.send(json.dumps({"type": "chat", "text": text_in}))
                chat = await ws_recv_until_chat(ws, timeout=5.0)
                if not chat:
                    report(label, False, "no chat response")
                    continue
                out = chat.get("text", "")
                flag = bool(chat.get("bot_flag", False))
                meta_ok = all(k in chat for k in ("nickname", "avatar", "user_id", "timestamp"))
                ok = out == exp_text and flag == exp_flag and meta_ok
                report(label, ok, f"in={text_in!r} out={out!r} flag={flag} exp_text={exp_text!r} exp_flag={exp_flag} meta_ok={meta_ok}")

    print("\n" + "=" * 60)
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    print(f"TOTAL: {passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
