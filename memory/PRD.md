# Party4RApp - PRD (Iteration 3)

## Stack
- Frontend: Expo SDK 54 (expo-router, react-native-webview, expo-screen-orientation, expo-image-picker)
- Backend: FastAPI + MongoDB (motor) + WebSockets + bcrypt + PyJWT + httpx
- Integrations: YouTube Data API v3

## Patches in this build (Iter-3)
### Analytics
- User doc has `total_seconds` (int, default 0). On every WS connect, server stamps connect time; on disconnect, computes delta and atomically `$inc`s the field.
- `GET /api/auth/me` returns `created_at` (ISO) + `total_seconds`
- Profile screen displays "Member Since" (formatted date) and "Total Hours" (e.g., "3h 24m"), auto-refreshes on focus

### Private Browser Hub (frontend-only)
- Host's YouTube modal is now a 2-tab Hub:
  - **YouTube tab**: search privately via Data API v3 → tap any result = "Add to Room" (broadcasts via existing `change_video`)
  - **Web tab**: private WebView with URL bar (default `https://www.google.com`); host can browse freely; "Add to Room" button pushes current URL to all peers
- Modular tab system — Netflix/Crunchyroll tabs can be added; only YouTube has playback sync (DRM constraint)

### Chat Image Attachments
- WS `chat` message accepts optional `image` field (base64 data URI, ≤700KB)
- Frontend: paperclip button → `expo-image-picker` (gallery, 0.5 quality) → base64 → send via WS
- Permission flow handles grant/deny/canAskAgain with "Open Settings" fallback per `<handle_permissions_contract>`
- Server drops oversize images silently (logged); empty messages also dropped
- Chat bubbles render image above optional text caption

## Existing features (unchanged)
- Auth (username+password, JWT, SecureStore)
- Public/private rooms, auto-destroy when last user leaves
- Host-only playback sync (play/pause/seek/change_video); host transfer (auto on disconnect, manual via avatar tap, creator-reclaim)
- Glowing neon crown on host
- Real-time text chat, portrait split + landscape fullscreen
- Auto YouTube IFrame player sync

## Testing
- **36/36 backend pytest** (iter1 + iter2 + iter3)
- Test files: `/app/backend/tests/backend_test.py`, `test_patch_iter2.py`, `test_patch_iter3.py`

## Deferred / Future
- Avatar upload from gallery (deferred to next patch)
- 4 banners + 6 badges (deferred to next patch)
- Bio editing (deferred to next patch)
- Voice chat + noise cancellation + dual audio sliders (needs LiveKit/Agora + custom dev build)
- Friend system (Phase 2)

## Business Enhancement
"Premium Host Pass" ($2.99/mo): unlimited private rooms, scheduled rooms with reminder links, higher member caps, branded splash.
