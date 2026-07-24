# Phase 1: Server Game Loop - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2025-07-24
**Phase:** 1-Server Game Loop
**Areas discussed:** File structure, Diff format contract

---

## File structure

| Option | Description | Selected |
|--------|-------------|----------|
| Single game.ts (Recommended) | All game logic in one file. Simple, easy to navigate for ~200 lines. Can split later if needed. | |
| Split into modules | board.ts, rules.ts, diff.ts. More structure, but more files to coordinate for a small codebase. | ✓ |
| You decide | Pick whatever fits the codebase style. | |

**User's choice:** Split into modules
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| board.ts + rules.ts + diff.ts | Board state management, GoL rules engine, diff computation. Clear separation of concerns. | |
| game.ts (orchestrator) + board.ts + rules.ts | Game loop orchestrator separate from board and rules. Rules could be a pure function library. | ✓ |
| You decide | Pick whatever fits best. | |

**User's choice:** game.ts (orchestrator) + board.ts + rules.ts
**Notes:** Rules as pure function library, game orchestrator manages the loop

---

| Option | Description | Selected |
|--------|-------------|----------|
| Inside board.ts (Recommended) | Diff is tightly coupled to board state — comparing old vs new grid. Natural fit. | ✓ |
| Separate diff.ts | Isolated diff logic. More flexible if diff format changes for WebSocket. | |
| You decide | Pick whatever makes sense. | |

**User's choice:** Inside board.ts (Recommended)
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| src/game/ (Recommended) | Separate directory for game logic. Keeps game code isolated from UI code. | ✓ |
| src/ (flat) | board.ts, rules.ts, game.ts alongside App.tsx and index.ts. Simpler, fewer dirs. | |
| You decide | Pick the right structure. | |

**User's choice:** src/game/ (Recommended)
**Notes:** None

---

## Diff format contract

| Option | Description | Selected |
|--------|-------------|----------|
| Coordinate list (Recommended) | Array of {x, y, alive} objects. Simple, human-readable. ~4 bytes per changed cell. | ✓ |
| Flat tuple array | Flat array [x1,y1,alive1, x2,y2,alive2, ...]. Compact, fast to serialize. Less readable. | |
| Coordinates only (toggle) | Only store changed cells as [x, y] pairs. Client infers toggle (alive = !current). Saves bandwidth but requires client state. | |

**User's choice:** Coordinate list (Recommended)
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Include tick counter (Recommended) | Diff includes tick number. Clients can detect missed ticks and request resync. | |
| No metadata | Just the cell changes. Simpler, client tracks tick locally. | |
| Tick + timestamp | Include tick counter + timestamp. Useful for debugging but adds overhead. | ✓ |

**User's choice:** Tick + timestamp
**Notes:** Debugging value outweighs overhead

---

| Option | Description | Selected |
|--------|-------------|----------|
| Send empty diff (Recommended) | Send empty array [] with tick counter. Clients know tick happened but nothing changed. | ✓ |
| Skip broadcast | Skip broadcast entirely. Saves bandwidth but clients can't detect missed ticks. | |
| You decide | | |

**User's choice:** Send empty diff (Recommended)
**Notes:** None

---

## the agent's Discretion

No areas deferred to agent — user made explicit choices for all questions.

## Deferred Ideas

None — discussion stayed within phase scope.
