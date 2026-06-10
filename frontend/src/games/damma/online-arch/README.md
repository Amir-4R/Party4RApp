# Damma Online Architecture (Phase 5 scaffold)

This folder contains the **API surface** the Damma online multiplayer feature
will consume. It is intentionally **decoupled from any real backend** today —
everything is wired to an in-memory mock so we can ship & test the UI now,
then swap the transport for a real WebSocket implementation later without
touching any screen, lobby, or game-engine code.

---

## File map

| File                | Role |
|---------------------|------|
| `types.ts`          | All TypeScript contracts (`Player`, `Match`, `GameState`, `PlayerMove`, `MatchLobby`, `OnlineConnectionStatus`, etc.). |
| `mockData.ts`       | Sample players/lobbies/state for Storybook-style UI testing. |
| `mockService.ts`    | In-memory implementation of the service contract — fakes ~50 ms latency. |
| `matchClient.ts`    | **Public API** consumed by screens. Exports the 9 user-requested functions. |
| `index.ts`          | Single import barrel → `import { … } from "@/src/games/damma/online-arch"`. |

---

## Public API

All functions accept/return the types in `types.ts`. They are async and never
throw — callers should still check the returned value/`OnlineConnectionStatus`.

```ts
createMatch(host, settings?)         → Promise<Match>
joinMatch(matchId, player)           → Promise<Match | null>
inviteFriends(matchId, friendIds)    → Promise<void>
publicMatchmaking(player, mode)      → Promise<Match>
sendMove(matchId, playerId, move)    → Promise<void>
receiveMove(matchId, listener)       → unsubscribe()
syncGameState(matchId)               → Promise<GameState | null>
reconnectToMatch(matchId, playerId)  → Promise<{ match, state } | null>
leaveMatch(matchId, playerId)        → Promise<void>
```

Plus:

```ts
connectionStatus.get()                              → OnlineConnectionStatus
connectionStatus.subscribe((s) => …)                → unsubscribe()
ONLINE_ENABLED                                       → boolean   (env-flag)
```

---

## Supported modes (all stubbed today)

- **1v1 online**   — `mode: "1v1"`
- **4-player online** — `mode: "4p"`
- **Friends-only** — `visibility: "friends"`
- **Public matchmaking** — `visibility: "public"`
- **Mixed (friends + public slots)** — `visibility: "mixed"`

Lobby slots are typed as `"host" | "friend" | "bot" | "public" | "empty"`, so a
mixed match can have eg. `[host, friend, bot, public]`.

---

## When the real backend is ready

1. Create `realService.ts` exposing the **same** functions as `mockService.ts`.
   The recommended transport is the existing `damma/online.ts` WebSocket client.
2. Inside `matchClient.ts`, replace:
   ```ts
   const service = mockService;
   ```
   with:
   ```ts
   import { realService } from "./realService";
   const service = ONLINE_ENABLED ? realService : mockService;
   ```
3. Set the env flag in `frontend/.env`:
   ```
   EXPO_PUBLIC_DAMMA_ONLINE=true
   ```
4. Nothing else changes — the lobby, the game screen, the engine, the AI all
   keep working untouched.

---

## Backend hook locations

Every function in `mockService.ts` has a `📡 BACKEND HOOK` comment showing
exactly where the real WS/REST call should go.
