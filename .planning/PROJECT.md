# Game of Life — Multiplayer + LLM Player

## What This Is

A real-time collaborative Game of Life webapp where multiple players toggle cells on a finite board, simulation runs at a configurable heartbeat (0.5–3s, 0.25s increments), and an LLM player (Ollama local model) participates by toggling cells and placing known patterns. Cell state syncs across all clients via WebSocket.

## Core Value

Multiple clients see and interact with the same evolving board in real time, with an AI player that behaves like a human participant.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] WebSocket server syncs board state across connected clients
- [ ] Finite 100x100 board with 2D cell grid
- [ ] Configurable heartbeat slider (0.5–3s, 0.25s steps) controls simulation tick rate
- [ ] Players click cells to toggle alive/dead in real time
- [ ] LLM player (Ollama) connects as a participant, toggles cells and places patterns
- [ ] All clients see the same board state in sync

### Out of Scope

- Toroidal/wrap-around board — finite edges only
- Turn-based play — real-time concurrent interaction only
- User auth/accounts — anonymous WebSocket sessions
- Deployed hosting — local working prototype

## Context

- Built on existing Bun + React + Tailwind template
- WebSocket server via `Bun.serve()` WebSocket support
- No database or persistence needed
- Ollama runs locally for LLM player

## Constraints

- **Tech stack**: Bun runtime, React frontend, Tailwind CSS, WebSocket — no additional frameworks
- **Local only**: Runs on localhost for development/prototype
- **LLM**: Ollama with a small model (e.g. Llama 3.2 3B or similar)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Finite board | Simpler than toroidal for first version | — Pending |
| Heartbeat slider | Lets players control pace for real-time interaction | — Pending |
| WebSocket sync | Server authoritative, built into Bun | — Pending |
| Ollama local | Lightweight, free, runs offline | — Pending |
| Pattern-aware LLM | LLM can toggle cells AND place known patterns | — Pending |

---

*Last updated: 2025-07-24 after initialization*