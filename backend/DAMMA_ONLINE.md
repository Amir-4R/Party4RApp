# Damma Online Multiplayer — Phase 3 Backend

Real-time WebSocket + REST infrastructure for 4-player online Dominoes.

## Files

| Path | Purpose |
|------|---------|
| `backend/damma_online.py` | Server: Room manager + game engine twin + WebSocket router |
| `backend/server.py` | Mounts `damma_online_router` after the main app |
| `frontend/src/games/damma/online.ts` | Typed client wrapper (REST + WebSocket) |

## REST API

All endpoints prefixed with `/api/damma`.

### `POST /rooms`
Create a new room.
```json
{
  "host_id": "u1",
  "host_name": "Ahmed",
  "host_avatar": "avatar_ninja",
  "visibility": "public",     // or "private"
  "num_players": 4            // 2 or 4
}
```
**Response:** `{ "rid": "abc123", "room": {...snapshot} }`

### `POST /rooms/{rid}/join`
Join an existing room (auto-assigns to first open slot).
```json
{ "user_id": "u2", "name": "Khalid", "avatar": "avatar_pirate" }
```

### `POST /rooms/{rid}/ready?ready=true`
Toggle the user's ready flag.

### `POST /rooms/{rid}/start`
Host-only: fills empty slots with bots, deals tiles, and begins the match.

### `POST /rooms/{rid}/leave`
Leave the room. If the **host** leaves, the room is destroyed.

### `GET /rooms`
List PUBLIC rooms that have not yet started.

### `GET /rooms/{rid}`
Snapshot of one room.

## WebSocket

`WS /api/damma/ws/{rid}?user_id={uid}`

### Client → Server messages
| Type | Payload |
|------|---------|
| `heartbeat` | — |
| `play` | `{ tile_id: "3-5", side: "left" \| "right" }` |
| `draw` | — |
| `pass` | — |
| `chat` | `{ text: "hi" }` |

### Server → Client messages
| Type | Payload |
|------|---------|
| `room` | `{ room: RoomSnapshot }` (lobby + slot updates) |
| `state` | `{ board, left_end, right_end, hand, room }` — **hand is private** |
| `chat` | `{ from, text }` |
| `end` | `{ winner: "player3", scores: {...} }` |
| `error` | `{ message: "..." }` |

## Behaviour

- **Authoritative server**: all moves validated server-side; illegal moves rejected with `error`.
- **Private hands**: each player only ever receives their own hand.
- **Bot fill on start**: empty slots become bots when the host presses Start.
- **Disconnect grace**: 30 s — if the player doesn't return, their slot is marked as a bot stand-in so the match continues.
- **Turn timer**: 60 s — `room.turn_seconds_left` ticks down; client can show it directly.

## Frontend usage example

```ts
import { getDammaClient } from "@/src/games/damma/online";

const client = getDammaClient();

// 1. Create a room
const { rid } = await client.createRoom({
  host_id: user.id, host_name: user.nickname, num_players: 4, visibility: "public",
});

// 2. Connect WebSocket
await client.connect(rid, user.id, {
  onRoom:  (room) => setRoom(room),
  onState: (game, hand, room) => setGame({ board: game.board, hand, room }),
  onEnd:   (end) => showResultOverlay(end),
  onError: (msg) => toast(msg),
});

// 3. Set ready then start (host)
await client.setReady(rid, user.id, user.nickname, true);
await client.startMatch(rid, user.id, user.nickname);

// 4. Send moves
client.play("3-5", "left");
client.draw();
client.pass();
```

## What's NOT done yet (deferred to Phase 4)

- Frontend lobby & game screens still use **local** mock data. To integrate
  online, wire `damma-lobby.tsx` actions to `client.createRoom`/`joinRoom` and
  add a new `damma-online.tsx` (or reuse `damma.tsx` with a `?rid=` param) that
  drives its state from `onState` callbacks instead of running the local engine.
- Friend invites via DM/Push (the protocol supports it — just needs UI).
- Persistent room storage (currently in-memory; restarts wipe rooms).
- Matchmaking queue (for "find me any public match" without manual browsing).

## Smoke test

```bash
# Create
curl -s -X POST http://localhost:8001/api/damma/rooms \
  -H "Content-Type: application/json" \
  -d '{"host_id":"u1","host_name":"Tester","num_players":4}'

# List
curl -s http://localhost:8001/api/damma/rooms

# WebSocket  (use any wscat / websocat / browser console)
ws://localhost:8001/api/damma/ws/<rid>?user_id=u1
```
