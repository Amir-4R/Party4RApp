// =============================================================================
// damma/online-arch/index.ts — single import surface for the rest of the app
// =============================================================================
// Usage:
//   import { createMatch, sendMove, type Player } from "@/src/games/damma/online-arch";
//
// Today every function delegates to `mockService`. When the real WebSocket
// transport is ready, swap the import inside matchClient.ts and nothing else
// has to change.
// =============================================================================
export * from "./types";
export * from "./matchClient";
export { mockService } from "./mockService";
export * from "./mockData";
