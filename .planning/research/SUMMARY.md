# Project Research Summary

**Project:** Game of Life — Multiplayer + LLM Player
**Domain:** Real-time multiplayer simulation with AI integration
**Researched:** 2025-07-24
**Confidence:** HIGH

## Executive Summary

This project is a real-time multiplayer Conway's Game of Life with an optional LLM-powered player. The key insight from research is that Bun's built-in WebSocket, Pub/Sub, and HTTP server handle the entire stack — no Express, no Socket.IO, no database, no state management library needed. The server is a single `Bun.serve()` process with a `setInterval` game loop pushing diff-based board updates to all connected clients via WebSocket.

The recommended approach is server-authoritative architecture: the server owns the board state (`Uint8Array[10000]`), computes tick transitions, and broadcasts only changed cells via `server.publish()`. The client renders a 100x100 CSS Grid and applies diffs — it never computes the next generation. The LLM player runs asynchronously via Ollama's REST API, queueing toggle actions that the game loop drains on each tick without blocking.

**Key risks:** (1) LLM blocking the game loop if `await fetch()` is placed inside the tick handler — solved by fire-and-forget async with an action queue. (2) Client state desync — solved by monotonic tick counters and automatic `full_state` resync on gap detection. (3) WebSocket message parsing errors crashing the server — solved by wrapping all message handlers in try/catch.

## Key Findings

### Recommended Stack

The stack is entirely Bun-native. Zero additional npm packages are required beyond what the project template already provides (React 19, Tailwind 4.1, Bun types). Full details in [STACK.md](./STACK.md).

**Core technologies:**
- **Bun >=1.2**: Runtime, server, WebSocket, bundler — all in one. `Bun.serve()` handles HTTP + WebSocket in a single process with built-in HMR.
- **React 19**: Client UI rendering 10k cells via CSS Grid. No Canvas needed. `useSyncExternalStore` bridges WebSocket stream to React state.
- **Tailwind CSS 4.1**: CSS-first config. Utility classes for grid layout and cell sizing.
- **Bun.serve().websocket**: Built-in Pub/Sub API (`server.publish`, `ws.subscribe`). 7x throughput vs Node.js `ws` library. Per-message compression via `perMessageDeflate`.
- **Ollama >=0.5**: Local LLM server. REST API at `http://localhost:11434`. Small models (Llama 3.2 3B, Gemma 3 4B) fit on consumer hardware. Called via `fetch()` — no SDK needed.
- **No database**: All state is in-memory. No persistence in scope.

**Anti-recommendations:** No Canvas API (CSS Grid is sufficient for 10k cells at 0.5s+ tick rates). No Socket.IO (raw WebSocket works everywhere in 2025). No Redux/Zustand (WebSocket stream is the single source of truth). No Express/Hono (Bun.serve() routes are sufficient).

### Expected Features

Full details in [FEATURES.md](./FEATURES.md).

**Must have (table stakes):**
- Interactive grid — click cells to toggle alive/dead, broadcast via WebSocket
- Running simulation — Game of Life rules applied on server tick (100x100 finite board, no wrap-around)
- Visual alive/dead cells — high contrast (bg-black vs bg-white)
- Multiple clients synchronized — diff-based protocol keeps bandwidth low
- Responsive grid — CSS Grid auto-sizing or scroll container

**Should have (differentiators):**
- LLM player — AI toggles cells and places patterns (glider, blinker, block, beehive) via Ollama
- Adjustable tick speed — slider 0.5-3s in 0.25s steps, broadcast to all clients
- Tick counter — monotonic counter in every `board_diff` message, displayed in UI
- Per-message compression — `perMessageDeflate: true` in Bun WebSocket config

**Defer (v2+):**
- Expanded pattern library (more complex patterns for LLM)
- LLM prompt tuning and personality
- Mobile layout optimization
- Compression tuning

### Architecture Approach

The architecture is a single-process Bun.serve() server with an in-memory board state, a setInterval game loop, and WebSocket Pub/Sub for client sync. The client is a React app that renders a CSS Grid and communicates via WebSocket. Full details in [ARCHITECTURE.md](./ARCHITECTURE.md).

**Major components:**
1. **BoardState** — `Uint8Array[10000]` grid + tick counter. Single source of truth. Index = y * 100 + x for O(1) access.
2. **GameLoop** — `setInterval`-driven. Applies GoL rules, computes diff (xor of old/new grid), drains LLM queue, triggers publish. Never awaits external calls.
3. **WebSocketHandler** — Handles connect/disconnect/message. Validates `toggle_cell` and `set_interval`. Subscribes clients to "board-state" topic.
4. **Pub/Sub** — Bun-native topic-based broadcast. `server.publish("board-state", msg)` replaces manual client loops.
5. **LLMPlayer** — Async timer. Fetches from Ollama, parses JSON response, validates coordinates, enqueues up to 3 actions. Non-blocking by design.
6. **Client (React)** — Renders grid, applies diffs, sends toggles. Uses `useSyncExternalStore` for WebSocket-to-React bridge.

**Key patterns:**
- **Diff-based protocol**: Only changed cells sent per tick (~200 bytes vs 13KB for full state)
- **Async LLM with queue**: LLM runs on its own timer, enqueues actions, game loop drains synchronously
- **Server-authoritative tick**: Client never computes next generation. Renders only what server sends.
- **Monotonic tick counter**: Clients detect gaps and request `full_state` resync automatically

### Critical Pitfalls

Full details in [PITFALLS.md](./PITFALLS.md).

1. **LLM blocks the game loop** — Writing `await fetch(Ollama)` inside the tick handler pauses the game for all clients. **Prevention:** Fire-and-forget async with a shared action queue. The synchronous tick loop drains the queue in <1μs.

2. **WebSocket message parsing throws** — Malformed JSON or binary frames crash the server. **Prevention:** Wrap all `message` handler logic in try/catch. Validate message shape before accessing properties.

3. **Client state desync** — Client misses a `board_diff` and diverges from server. **Prevention:** Monotonic tick counter. If received `tick !== lastTick + 1`, request `full_state` resync. Always resync on reconnect.

4. **Client-side game loop** — Running GoL on both server and client causes inevitable drift. **Prevention:** Server is sole authority. Client never computes next generation.

5. **LLM structured output failures** — Small models return malformed JSON or out-of-range coordinates. **Prevention:** Validate all LLM output. Clamp coordinates. Fall back to random valid toggle on parse failure.

## Implications for Roadmap

Based on research, the recommended build order has 5 phases reflecting a strict dependency chain: the server game loop must exist before WebSocket can sync it, WebSocket must work before the UI grid can render live data, etc.

### Phase 1: Server Game Loop
**Rationale:** Foundation for everything. Must exist before any network or UI code. No external dependencies — pure TypeScript with Bun runtime.
**Delivers:** In-memory 100x100 board, `setInterval` tick, GoL rules applied, diff computed, state logged to console.
**Addresses:** Running simulation (table stakes)
**Avoids:** Pitfall — forgetting edge cells have fewer neighbors (finite board rules: only count neighbors within [0,99] bounds)
**Research flag:** SKIP research. Well-documented GoL patterns. Standard 2D neighbor counting.

### Phase 2: WebSocket Sync
**Rationale:** Phase 1 feeds into this. Server must have a running board before clients can sync to it.
**Delivers:** Server upgrades HTTP to WebSocket on connect, subscribes to "board-state" topic, publishes `board_diff` on each tick, sends `full_state` on connect. Client receives messages and logs them.
**Uses:** Bun.serve().websocket, Pub/Sub via `server.publish()`, `ws.subscribe()`
**Implements:** WebSocketHandler component, Pub/Sub component
**Avoids:** Critical pitfalls: sending full state on every tick (use diff-based from day one), WebSocket message parsing crashes (try/catch), client state desync (tick counter + resync)
**Research flag:** SKIP research. Bun WebSocket API is well-documented in `/node_modules/bun-types/docs/runtime/http/websockets.mdx`. Standard patterns.

### Phase 3: UI Grid
**Rationale:** Phase 2 must be working — client needs functioning WebSocket connection to receive board state.
**Delivers:** React renders 100x100 CSS Grid. Client connects to WebSocket, receives `full_state` on connect, applies subsequent `board_diff` messages. Click-to-toggle sends `toggle_cell` message.
**Uses:** React 19, Tailwind 4.1, `useSyncExternalStore` for WebSocket bridge, Bun HTML imports for bundling
**Implements:** Client (React) component, Client WebSocket wrapper
**Avoids:** Moderate pitfall: re-rendering all 10k cells every tick (use React keys, apply only changed cells from `board_diff`)
**Research flag:** SKIP research. Standard React + CSS Grid pattern. `useSyncExternalStore` is well-documented in React 19 docs.

### Phase 4: Heartbeat Control
**Rationale:** UI grid exists (Phase 3), so there's a slider to add. Server game loop is adjustable (Phase 1 groundwork).
**Delivers:** Slider in UI sends `set_interval` message. Server validates (min 500ms, max 3000ms, step 250ms) and adjusts. Broadcast new interval to all clients.
**Addresses:** Adjustable tick speed (differentiator)
**Avoids:** Minor pitfall: server not synchronizing interval across clients (broadcast new interval as a message type, clients display current speed)
**Research flag:** SKIP research. Simple message protocol extension. No new concepts.

### Phase 5: LLM Player
**Rationale:** Depends on all prior phases. Game loop must be stable (Phase 1), WebSocket must work (Phase 2), UI must render (Phase 3), and tick speed control exists (Phase 4). The LLM player is the most complex feature and benefits from a solid foundation.
**Delivers:** Ollama fetch on async timer, action queue, pattern placement. LLM joins as a named participant. Bot actions visible in grid like any player's toggles.
**Uses:** Ollama REST API, fetch() (Bun native), `format: "json"` parameter for structured output
**Implements:** LLMPlayer component
**Addresses:** LLM player (key differentiator), Pattern library (LLM places glider/blinker/block/beehive)
**Avoids:** Critical pitfalls: LLM blocking game loop (fire-and-forget async with queue), LLM structured output failures (validate + clamp + fallback), LLM prompt too long (summarize board state instead of serializing full grid)
**Research flag:** NEEDS DEEPER RESEARCH DURING PLANNING. Prompt engineering for small models is non-trivial. Need to test Ollama with `format: "json"` on Llama 3.2 3B. Pattern placement accuracy needs validation. Fallback behavior design.

### Phase Ordering Rationale

- **Strict dependency chain**: Each phase depends on the previous. Phase 1 (game loop) is the atomic unit. Phase 5 (LLM) is the most experimental and benefits from a verified foundation.
- **Architecture alignment**: The architecture naturally separates into these phases — each component boundary in ARCHITECTURE.md maps to one phase.
- **Pitfall avoidance**: The phase order ensures that critical pitfalls are addressed early. Phase 1 gets the core logic right. Phase 2 establishes the Diff-based protocol from day one. Phase 3 prevents client-side game loop by design.
- **Early validation**: By Phase 3, you can open two browser windows and see the same board. This validates the entire sync pipeline before adding the LLM complexity.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (LLM Player):** Prompt engineering for small models, structured output reliability, pattern placement accuracy, fallback behavior. Need to test with actual Ollama instances.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Game Loop):** Standard GoL rules, finite board. Well-documented.
- **Phase 2 (WebSocket Sync):** Bun WebSocket API is well-documented. Diff-based protocol is standard.
- **Phase 3 (UI Grid):** Standard React + CSS Grid. `useSyncExternalStore` is documented.
- **Phase 4 (Heartbeat Control):** Simple message protocol extension.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified from official Bun docs, project template, and Ollama API docs. All components are well-documented and proven. |
| Features | HIGH | Derived from PROJECT.md requirements and standard GoL implementations. Anti-features are clearly scoped. |
| Architecture | HIGH | Patterns are standard for real-time sync (authoritative server, diff-based protocols, Pub/Sub). Tested in Figma, Google Docs, collaborative tools. |
| Pitfalls | HIGH | Based on documented Bun WebSocket behavior, known LLM limitations, and common real-time sync failure modes. All have clear prevention strategies. |

**Overall confidence:** HIGH

### Gaps to Address

1. **LLM prompt engineering** — The exact prompt structure for small models (Llama 3.2 3B) needs iterative testing. The `format: "json"` parameter works but coordinate accuracy at 3B params is unverified. **Handle:** Build Phase 5 with retry/fallback logic from day one. Test with actual Ollama instance during planning.

2. **CSS Grid at 100x100 with 30px cells** — Works for standard screens but may need scroll container for smaller viewports. **Handle:** Add `overflow: auto` container. If performance issues arise, switch to virtualized viewport or Canvas.

3. **WebSocket idleTimeout tuning** — Default Bun idleTimeout may be too long. **Handle:** Set `idleTimeout: 30` seconds. Add ping/pong if stale connections become a problem.

4. **Multiple clients toggling same cell** — Inherent to the real-time model. Last toggle within a tick wins. **Handle:** Accept as design constraint. Communicate visually that toggles apply at tick boundary.

## Sources

### Primary (HIGH confidence)
- Bun WebSocket API docs: `/node_modules/bun-types/docs/runtime/http/websockets.mdx` — Pub/Sub, backpressure, perMessageDeflate, idleTimeout
- Ollama API docs: `https://docs.ollama.com/api/generate` — REST API, format parameter, options
- Project template: existing `src/index.ts` with Bun.serve(), React 19, Tailwind 4.1 — verified installation
- PROJECT.md: `/home/diplo/projects/game-of-life/.planning/PROJECT.md` — feature requirements and scope

### Secondary (MEDIUM confidence)
- Common Game of Life implementations — grid storage patterns, neighbor counting, finite board rules
- Real-time sync patterns (Google Docs, Figma) — diff-based protocols, authoritative server model
- Pub/Sub architectural pattern (MQTT, Redis, Socket.IO rooms) — broadcast fan-out pattern

### Tertiary (LOW confidence)
- LLM structured output reliability with small models — needs validation with actual Ollama + Llama 3.2 3B during Phase 5 planning
- CSS Grid performance at 100x100 with 500ms tick rate — needs benchmark during Phase 3

---
*Research completed: 2025-07-24*
*Ready for roadmap: yes*