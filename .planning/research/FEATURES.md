# Feature Landscape

**Domain:** Real-time multiplayer Conway's Game of Life with LLM player
**Researched:** 2025-07-24

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Interactive grid | Core interaction — click cells to toggle alive/dead | Low | Click → WebSocket message → server validates → diff broadcast |
| Running simulation | Game of Life rules applied on tick | Medium | Standard GoL with 100x100 finite board. No wrap-around. |
| Visual alive/dead distinction | Obvious which cells are alive | Low | Tailwind classes: bg-black vs bg-white. High contrast. |
| Multiple clients sync | Players see same board state | Medium | Diff-based protocol keeps bandwidth low. Pub/Sub for broadcast. |
| Responsive grid | Grid fits browser window | Low | CSS Grid with auto-sizing or scroll container |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| LLM player | AI plays like a human — toggles cells, places gliders/blinkers | High | Ollama integration. Prompt engineering. Pattern library. Action queue. |
| Adjustable tick speed | Slider 0.5-3s in 0.25s steps — players control pace | Low | Server-side interval change. Broadcast new interval to all clients. |
| Pattern library (LLM) | LLM knows glider, blinker, block, beehive — places them | Medium | Prompt includes pattern definitions. LLM chooses coordinate + pattern. Server executes the multi-cell placement. |
| Per-message compression | Reduces bandwidth for large diffs | Low | Bun WebSocket `perMessageDeflate: true`. One config flag. |
| Tick counter | Visible tick number for coordination | Low | Monotonic counter in every `board_diff` message. Display in UI. |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| User accounts/auth | Not required for localhost prototype. Adds security surface area, session management. | Anonymous WebSocket connections. Data field tracks session. |
| Board persistence | No database in scope. Adds complexity with zero value for local prototype. | All state in server memory. Lost on restart. |
| Toroidal wrap-around | Out of scope per PROJECT.md. Finite edges are simpler. | Cells on edge have fewer neighbors. Document this behavior. |
| Chat/messaging | Feature creep. Game focus is board interaction. | LLM player actions speak for themselves. |
| Canvas rendering | Over-engineering for 10k cells at sub-second tick rates. | CSS Grid with React DOM. If performance issues arise, layer in canvas as optimization. |
| Replay/undo history | Requires storing tick snapshots. Out of scope. | Current state only. Ticks are forward-only. |
| Spectator mode | Adds complexity to WebSocket auth. Not needed for local prototype. | All connected clients are participants. |

## Feature Dependencies

```
Game loop (setInterval) → Tick computation → Board diff → WebSocket broadcast
                                                                       ↓
Client connection ← full_state message ← Client reconcile board → Render grid
                                                                       ↓
Player click → toggle_cell → Server validates → Applies to board → Next tick captures diff
                                                                       ↓
LLM player timer → async Ollama fetch → Parse response → Queue actions → Next tick applies
                                                                       ↓
Heartbeat slider → set_interval message → Server adjusts interval → Broadcast new speed
```

## MVP Recommendation

Prioritize (one phase each):

1. **Server game loop** — in-memory 100x100 board, setInterval tick, GoL rules. No network. Log state to console.
2. **WebSocket sync** — server upgrades connections, publishes board_diff on each tick, sends full_state on connect. Client receives messages.
3. **UI grid** — React renders 100x100 CSS Grid. Receives board_state on connect, applies diffs. Click-to-toggle sends toggle_cell.
4. **Heartbeat control** — Slider in UI sends set_interval. Server adjusts. All clients see speed change.
5. **LLM player** — Ollama fetch on tick, action queue, pattern placement. Bot joins as a named participant.

Defer: Pattern library expansion, LLM prompt tuning, mobile layout, compression tuning.

## Sources

- /home/diplo/projects/game-of-life/.planning/PROJECT.md (requirements defined)
- Common Game of Life implementations (standard grid interaction patterns)
- Real-time collaborative app patterns (Google Docs, Figma diff-sync approach)