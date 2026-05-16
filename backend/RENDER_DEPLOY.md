# Party4RApp — Deploy Backend to Render ($5/mo Starter Plan)

This is a copy-paste checklist for shipping the FastAPI backend to **Render**
with WebSockets, MongoDB Atlas, and YouTube search wired up.

---

## 1) Push the repository to GitHub

```bash
git add backend/ render.yaml
git commit -m "Render deployment blueprint"
git push origin main
```

The deployment uses **`/app/render.yaml`** at the repo root and the
**`/app/backend/`** folder as the service root.

---

## 2) Create a free MongoDB Atlas cluster

1. Sign up at <https://www.mongodb.com/cloud/atlas> (free).
2. Create a new **M0 (Free tier)** cluster — any region close to your Render
   region (Oregon by default in `render.yaml`).
3. Under **Database Access** → add a user (`party4r`) with a strong password.
4. Under **Network Access** → add IP `0.0.0.0/0` (allow all). Render uses
   dynamic egress IPs.
5. Click **Connect → Drivers** and copy the connection string. It looks like:
   ```
   mongodb+srv://party4r:<password>@cluster0.xxxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Replace `<password>` with the real password. **Keep this string private.**

---

## 3) Get a YouTube Data API v3 key

1. Go to <https://console.cloud.google.com/apis/credentials>.
2. Enable the **YouTube Data API v3** for your project.
3. Create an **API key** and copy it.

---

## 4) Create the Render service

### Option A — One-click Blueprint (recommended)

1. Go to <https://dashboard.render.com/blueprints>.
2. Click **New Blueprint Instance**.
3. Pick the GitHub repo with this code.
4. Render auto-detects `render.yaml` and shows the service `party4r-backend`.
5. When prompted, paste:
   - `MONGO_URL` → your Atlas connection string from step 2
   - `YOUTUBE_API_KEY` → your key from step 3
6. Click **Apply**. Render will install dependencies and start the server.

### Option B — Manual setup

1. **New +** → **Web Service** → connect your repo.
2. Settings:
   - **Root Directory**: `backend`
   - **Runtime**: Python
   - **Build Command**: `pip install --no-cache-dir -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT --workers 2 --timeout-keep-alive 75`
   - **Plan**: Starter ($5/mo)
   - **Health Check Path**: `/health`
3. Add the env vars from `.env.example`. Set `JWT_SECRET` to a random 64-char hex.

---

## 5) Verify the deployment

After the build succeeds, Render gives you a URL like
`https://party4r-backend.onrender.com`. Run these checks:

```bash
# Liveness
curl https://party4r-backend.onrender.com/health
# → {"status":"ok","db":"ok"}

# API root
curl https://party4r-backend.onrender.com/api/
# → {"message":"Party4R API"}
```

WebSocket sanity check (browser console):

```js
const ws = new WebSocket("wss://party4r-backend.onrender.com/api/ws/rooms/test?token=invalid");
ws.onopen = () => console.log("connected (will be closed by server because token is invalid)");
ws.onclose = (e) => console.log("closed code:", e.code);  // expect 1008 = policy violation
```

---

## 6) Point the Expo app at your Render URL

In the Expo frontend, set:

```bash
EXPO_PUBLIC_BACKEND_URL="https://party4r-backend.onrender.com"
```

Then `expo start --clear`.

---

## 7) Tighten CORS before public release

Once you know your production frontend domain(s), update the
`CORS_ORIGINS` env var in Render to something like:

```
https://party4r.app,https://*.expo.dev
```

The server will automatically disable `allow_credentials` whenever `*` is in
the list, so once you switch to explicit origins, credentialed cookies/headers
will start working again.

---

## Notes & gotchas

- **Starter plan supports WebSockets** out of the box; the free plan **spins
  down** after 15 min idle, which kills WebSocket sessions.
- Render's `$PORT` is dynamically assigned — don't hardcode it.
- `JWT_SECRET` is auto-generated on first deploy. If you regenerate it later,
  all existing tokens become invalid (users must log back in).
- Logs: **Dashboard → Logs** in real time, or `render logs --service party4r-backend`.
- The backend writes nothing to disk (all state lives in MongoDB), so Render's
  ephemeral filesystem is fine.
