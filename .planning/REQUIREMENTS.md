# Requirements: Game of Life — Multiplayer + LLM Player

**Defined:** 2025-07-24
**Core Value:** Multiple clients see and interact with the same evolving board in real time, with an AI player that behaves like a human participant.

## v1 Requirements

### Core Simulation

- [ ] **SIM-01**: Server maintains in-memory 100x100 finite board as Uint8Array
- [ ] **SIM-02**: Server runs GoL rules on setInterval tick (alive = 2-3 neighbors, dead = 3 neighbors)
- [ ] **SIM-03**: Cells on edges have fewer neighbors (no wrap-around)
- [ ] **SIM-04**: Server computes board diff (changed cells only) after each tick

### WebSocket Sync

- [ ] **WS-01**: Server upgrades HTTP to WebSocket on client connect
- [ ] **WS-02**: Server sends full board state to newly connected clients
- [ ] **WS-03**: Server broadcasts board_diff to all clients after each tick
- [ ] **WS-04**: Clients send cell_toggle messages; server validates and applies before next tick
- [ ] **WS-05**: Same-cell conflict resolution uses last-writer-wins within tick boundary
- [ ] **WS-06**: Server tracks connected players and broadcasts player list

### UI Grid

- [ ] **UI-01**: Client renders 100x100 grid using CSS Grid or Canvas
- [ ] **UI-02**: Alive cells visually distinct from dead cells
- [ ] **UI-03**: Click toggles cell alive/dead and sends toggle_cell via WebSocket
- [ ] **UI-04**: Client applies board diffs from server to keep in sync
- [ ] **UI-05**: Tick counter visible in UI

### Heartbeat Control

- [ ] **HB-01**: Slider in UI controls simulation tick speed (0.5–3s, 0.25s steps)
- [ ] **HB-02**: Client sends set_interval message on slider change
- [ ] **HB-03**: Server adjusts tick interval and broadcasts new speed to all clients

### LLM Player

- [ ] **LLM-01**: Server calls Ollama (local HTTP API) to request LLM player action
- [ ] **LLM-02**: LLM can toggle individual cells alive/dead
- [ ] **LLM-03**: LLM can place known GoL patterns (glider, block, blinker, beehive)
- [ ] **LLM-04**: LLM actions are async — game loop never blocks on Ollama response
- [ ] **LLM-05**: LLM decisions rate-limited (max 1 action per 3 ticks, max 10 cells per action)
- [ ] **LLM-06**: LLM receives board state as compact representation in prompt
- [ ] **LLM-07**: LLM player appears as a named participant in player list
- [ ] **LLM-08**: Pattern validation — server validates pattern placement before applying

## v2 Requirements

### LLM Polish

- **LLM-09**: Expanded pattern catalogue (pulsar, glider gun, spaceship)
- **LLM-10**: LLM prompt tuning for better decision quality
- **LLM-11**: LLM players can be added/removed at runtime

### UI Polish

- **UI-06**: Player colors — each player's toggles shown in distinct color
- **UI-07**: Zoom/pan for large board
- **UI-08**: Mobile layout

## Out of Scope

| Feature | Reason |
|---------|--------|
| User accounts/auth | Local prototype, anonymous WebSocket sessions |
| Board persistence | No database, all state in server memory |
| Toroidal wrap-around | Finite edges per PROJECT.md |
| Chat/messaging | Feature creep, board interaction is the focus |
| Replay/undo history | Forward-only ticks, out of scope |
| Spectator mode | All connected clients are participants |
| Canvas rendering | CSS Grid sufficient for 10k cells; canvas if perf issues arise |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SIM-01 | | Pending |
| SIM-02 | | Pending |
| SIM-03 | | Pending |
| SIM-04 | | Pending |
| WS-01 | | Pending |
| WS-02 | | Pending |
| WS-03 | | Pending |
| WS-04 | | Pending |
| WS-05 | | Pending |
| WS-06 | | Pending |
| UI-01 | | Pending |
| UI-02 | | Pending |
| UI-03 | | Pending |
| UI-04 | | Pending |
| UI-05 | | Pending |
| HB-01 | | Pending |
| HB-02 | | Pending |
| HB-03 | | Pending |
| LLM-01 | | Pending |
| LLM-02 | | Pending |
| LLM-03 | | Pending |
| LLM-04 | | Pending |
| LLM-05 | | Pending |
| LLM-06 | | Pending |
| LLM-07 | | Pending |
| LLM-08 | | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 0
- Unmapped: 26 ⚠️

---
*Requirements defined: 2025-07-24*
*Last updated: 2025-07-24 after initial definition*