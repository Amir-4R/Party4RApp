# Party4RApp - PRD (Iteration 2)

## Overview
Party4RApp (renamed from PartyApp) — premium dark-mode mobile React Native (Expo) co-watching app. Backend: FastAPI + MongoDB + WebSockets + YouTube Data API v3.

## Tech Stack
- Frontend: Expo SDK 54, expo-router, react-native-webview, expo-screen-orientation
- Backend: FastAPI, MongoDB (motor), JWT (PyJWT), bcrypt, FastAPI WebSockets, httpx, YouTube Data API v3
- Auth: Username + Password only, JWT in SecureStore

## Features (current build)
- **Auth**: signup/login (username+password+nickname+avatar grid)
- **Rooms**: create public/private (optional password), public dashboard
- **Real-time sync**: WebSocket per room, host-only Play/Pause/Seek/ChangeVideo
- **Chat**: real-time, portrait-split (video top, chat bottom), landscape fullscreen
- **Auto-destroy empty rooms** (new): last WS disconnect → room deleted from MongoDB
- **Dynamic host transfer + crown** (new):
  - Original creator gets glowing neon crown by default
  - Host leaves → next user in join order auto-promoted (`host_changed` broadcast)
  - Creator returns → leadership auto-reclaimed
  - Manual transfer via tap on member avatar (`transfer_host` WS msg)
- **In-app YouTube search** (new): GET `/api/youtube/search?q=...` → Data API v3; host taps YouTube icon → search modal → tap any result instantly broadcasts video to all peers (no link-pasting)
- **App renamed**: `Party4RApp` (app.json + login brand tag)

## Routes
- `GET /api/youtube/search?q=...` (auth required, 401 without)
- `WS /api/ws/rooms/{id}?token=...` with messages:
  - in: chat, playback, state_request, state_response, **transfer_host**
  - out: init (with creator_id, host_id), chat, playback, user_joined, user_left (with new_host_id), **host_changed**

## Testing
- **28/28 backend pytest pass** (auth, rooms, basic WS, room auto-destroy, host transfer on disconnect, manual host transfer, creator reclaim, YouTube search, regression)
- Test files: `/app/backend/tests/backend_test.py`, `/app/backend/tests/test_patch_iter2.py`

## Not yet implemented (future)
- Voice chat + Pro noise cancellation + dual audio sliders (deferred — needs custom dev build + LiveKit/Agora)
- Phase 2: Friend system (search, send/accept/reject, online status)
- General WebView browser (non-YouTube)

## Business Enhancement
"Premium Host Pass" — $2.99/mo for unlimited private rooms with branded splash, schedulable rooms with reminder links, higher member caps.
