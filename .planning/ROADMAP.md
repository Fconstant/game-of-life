# Roadmap: Game of Life — Multiplayer + LLM Player

## Overview

Real-time collaborative Conway's Game of Life where multiple players toggle cells on a 100x100 finite board, simulation runs at a configurable heartbeat, and an LLM player (Ollama local) participates by toggling cells and placing known patterns. Built on Bun + React + Tailwind with no database or auth.

Build order follows a strict dependency chain: server game loop → WebSocket sync → UI grid → heartbeat control → LLM player. Each phase delivers a complete, verifiable capability. By Phase 3, two browser windows show the same synced board — validating the entire sync pipeline before adding LLM complexity.

**Phases:** 5
**Granularity:** Standard
**Requirements coverage:** 26/26

## Phases

- [ ] **Phase 1: Server Game Loop** — In-memory 100x100 board with setInterval tick, GoL rules, and diff computation
- [ ] **Phase 2: WebSocket Sync** — Server broadcasts board state to clients via Pub/Sub; clients send cell toggles
- [ ] **Phase 3: UI Grid** — React renders 100x100 CSS Grid; users see live board and click to toggle cells
- [ ] **Phase 4: Heartbeat Control** — Slider in UI adjusts simulation tick speed (0.5–3s, 0.25s steps)
- [ ] **Phase 5: LLM Player** — Ollama-powered AI player toggles cells and places patterns asynchronously

## Phase Details

### Phase 1: Server Game Loop
**Goal**: Server runs GoL simulation on a 100x100 board at fixed interval
**Depends on**: Nothing (first phase)
**Requirements**: SIM-01, SIM-02, SIM-03, SIM-04
**Success Criteria** (what must be TRUE):
  1. Server initializes 100x100 Uint8Array grid with random or empty cells
  2. Server applies GoL rules each tick — cells die/born per neighbor count (2-3 neighbors alive = alive, 3 neighbors = birth)
  3. Edge cells have correct neighbor counts (finite board, no wrap-around)
  4. Server computes and logs diff of changed cells each tick — only changed cell coordinates output
**Plans**: 2 plans

Plans:
- [ ] 01-01: Core board state (Uint8Array[10000]) + GoL rules engine with finite-edge neighbor counting
- [ ] 01-02: setInterval tick loop + board diff computation (xor old/new grid) + console logging

### Phase 2: WebSocket Sync
**Goal**: Clients connect and receive board state in real time via WebSocket Pub/Sub
**Depends on**: Phase 1
**Requirements**: WS-01, WS-02, WS-03, WS-04, WS-05, WS-06
**Success Criteria** (what must be TRUE):
  1. Client connects via WebSocket and receives full board state (full_state message)
  2. All connected clients receive board_diff after each server tick
  3. Client toggle_cell messages are validated (bounds check) and applied server-side before next tick
  4. Same-cell conflict uses last-writer-wins within tick boundary
  5. Server tracks connected players and broadcasts player list on join/leave
  6. Clients can request full_state resync on tick gap detection
**Plans**: 3 plans

Plans:
- [ ] 02-01: WebSocket connection handler (Bun.serve().websocket) + full_state message on connect
- [ ] 02-02: board_diff broadcast on each tick + toggle_cell message handling with validation + try/catch message parsing
- [ ] 02-03: Conflict resolution (last-writer-wins), player tracking/player list broadcast, resync protocol (request_full_state)

### Phase 3: UI Grid
**Goal**: Users see and interact with the board visually in the browser
**Depends on**: Phase 2
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05
**Success Criteria** (what must be TRUE):
  1. User sees 100x100 CSS Grid with alive cells visually distinct from dead cells (high contrast)
  2. User clicks any cell to toggle it — change sends via WebSocket and appears on all connected clients
  3. Board updates in real time as server ticks — only changed cells re-render
  4. Tick counter is visible in UI, incrementing with each server tick
**Plans**: 2 plans

Plans:
- [ ] 03-01: React 100x100 CSS Grid rendering + WebSocket client connection + full_state initial render
- [ ] 03-02: Click-to-toggle (sends toggle_cell via WebSocket) + board_diff reconciliation (apply only changed cells) + tick counter display

**UI hint**: yes

### Phase 4: Heartbeat Control
**Goal**: Users control simulation speed via a slider
**Depends on**: Phase 3
**Requirements**: HB-01, HB-02, HB-03
**Success Criteria** (what must be TRUE):
  1. User sees slider labeled with current tick speed (default 1s)
  2. User drags slider to change tick speed (range 0.5–3s, 0.25s step increments)
  3. Server adjusts tick interval immediately in response to set_interval message
  4. All clients display the new tick speed — broadcast from server
**Plans**: 1 plan

Plans:
- [ ] 04-01: Slider UI component + set_interval message handler on server + interval adjustment + speed broadcast to all clients

**UI hint**: yes

### Phase 5: LLM Player
**Goal**: AI player (Ollama) participates as a named player, toggling cells and placing patterns without blocking the game loop
**Depends on**: Phase 4
**Requirements**: LLM-01, LLM-02, LLM-03, LLM-04, LLM-05, LLM-06, LLM-07, LLM-08
**Success Criteria** (what must be TRUE):
  1. LLM player appears as named participant ("Ollama" or similar) in the player list
  2. LLM toggles individual cells alive/dead autonomously without blocking the game loop
  3. LLM places known patterns (glider, block, blinker, beehive) at valid board coordinates
  4. LLM actions respect rate limits (max 1 action per 3 ticks, max 10 cells per action)
  5. Server validates all LLM output — clamps out-of-range coordinates, falls back to random valid toggle on parse failure
**Plans**: 3 plans

Plans:
- [ ] 05-01: Async Ollama integration — fire-and-forget fetch to local Ollama API, action queue drained synchronously by game loop
- [ ] 05-02: Pattern placement (glider, block, blinker, beehive definitions) + server-side pattern validation before applying
- [ ] 05-03: Rate limiting (max 1 action per 3 ticks, max 10 cells per action) + LLM player identity in player list + compact board state prompt construction

**UI hint**: yes

## Dependency Map

```
Phase 1: Server Game Loop
     │
     ▼
Phase 2: WebSocket Sync
     │
     ▼
Phase 3: UI Grid
     │
     ▼
Phase 4: Heartbeat Control
     │
     ▼
Phase 5: LLM Player
```

Strict linear dependency chain. Each phase builds on the previous. No parallel phases — server foundation must be verified before layering on network, UI, controls, and AI.

## Verification Plan

| Phase | Done When |
|-------|-----------|
| Phase 1 | Server logs board state each tick — diff shows only changed cells. Verifiable via console output. |
| Phase 2 | Two clients connect — both receive same board state. Toggling on client A appears on client B. Disconnect/reconnect correctly. |
| Phase 3 | Browser renders 100x100 grid. Click toggles cell. Changes propagate to all windows. Tick counter increments. |
| Phase 4 | Slider changes server tick speed immediately. All clients display new speed. Valid range enforced (0.5–3s, 0.25s steps). |
| Phase 5 | LLM player joins as named participant. Toggles cells and places patterns. Game does not stutter. Invalid LLM output handled gracefully. |

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Server Game Loop | 0/2 | Not started | - |
| 2. WebSocket Sync | 0/3 | Not started | - |
| 3. UI Grid | 0/2 | Not started | - |
| 4. Heartbeat Control | 0/1 | Not started | - |
| 5. LLM Player | 0/3 | Not started | - |
