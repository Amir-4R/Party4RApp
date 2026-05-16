# PartyApp - PRD

## Overview
PartyApp is a premium dark-mode mobile React Native (Expo) application for co-watching YouTube videos in synchronized rooms with real-time chat. Built on FastAPI + MongoDB + WebSockets. Bytes are NOT streamed by the server — only timestamps, URL changes, and play/pause/seek events are synced via WebSockets.

## Tech Stack
- **Frontend:** React Native Expo (SDK 54), expo-router, react-native-webview, expo-screen-orientation
- **Backend:** FastAPI, MongoDB (motor), JWT (PyJWT), bcrypt, WebSockets (FastAPI native)
- **Auth:** Username + Password only (no email/phone), JWT bearer tokens stored in Expo SecureStore

## Implemented Features (MVP - Phase 1 + Core Phase 3/4/5)

### Auth (Phase 1)
- Signup with `username`, `password`, `nickname`, `avatar` (grid of 6 cartoon avatars)
- Login with username + password
- JWT token persistence via `@/src/utils/storage` (SecureStore)
- Profile screen with avatar change + logout

### Rooms (Phase 3)
- Create Room (name, public/private toggle, optional password, optional YouTube URL)
- Public rooms list (Home tab) with live member counts
- Room cards show neon glow when active
- Join via WebSocket (auto on entering room)

### Real-time Sync (Phase 4)
- WebSocket connection per room with JWT auth (token query param)
- Only HOST emits playback events (play, pause, seek, change_video)
- All clients receive and apply playback events via YouTube IFrame Player API inside WebView
- Late joiners request current state from host (state_request / state_response)

### In-Room Chat (Phase 5)
- Real-time chat over same WebSocket
- Portrait layout: WebView (16:9 aspect) on TOP, chat panel on BOTTOM
- Landscape rotation OR fullscreen button: video expands to full screen, chat hidden
- Bubble UI (sent = neon turquoise, received = dark surface)

## Routes
| Method | Path | Purpose |
|---|---|---|
| POST | /api/auth/signup | Create account |
| POST | /api/auth/login  | Get JWT |
| GET  | /api/auth/me     | Current user |
| PATCH| /api/auth/profile | Update nickname/avatar |
| POST | /api/rooms       | Create room |
| GET  | /api/rooms/public | List public rooms |
| GET  | /api/rooms/{id}  | Get room |
| POST | /api/rooms/{id}/join | Validate password for private rooms |
| WS   | /api/ws/rooms/{id}?token= | Live room socket |

## Design
- Background: `#0B0B0F` (deep black)
- Accent: `#00F2FE` (neon turquoise)
- Surface: `#15151A`, Elevated: `#1C1C22`
- Text: White / Slate Gray `#6C7A89`
- UI: Flat, minimal, glowing neon borders for active states

## Not Yet Implemented (Future Phases)
- Phase 2: Friend system (search, send/accept/reject, online status)
- Embedded general WebView browser (currently YouTube-only via IFrame)
- Persisted chat history
- Push notifications

## Business Enhancement Idea
Add a "Premium Host Pass" — paid subscription that lets users:
- Create unlimited private rooms with custom branded splash
- Schedule rooms in advance (room link + reminder)
- Higher member cap per room
Revenue: $2.99/month, frictionless monetisation of power-hosts.
