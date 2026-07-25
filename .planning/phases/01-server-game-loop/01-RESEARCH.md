# Research: Phase 1 — Server Game Loop

**Phase:** 01 — Server Game Loop
**Date:** 2026-07-24
**Researcher:** gsd-phase-researcher

---

## Summary

Phase 1 builds the Conway's Game of Life simulation engine — a pure computation core with no UI, no network, and no persistence. The server maintains a 100x100 Uint8Array board, applies GoL rules each tick, and computes diffs of changed cells. The engine is split into three modules: `game.ts` (orchestrator loop), `board.ts` (state + diff), and `rules.ts` (pure function rules engine). All modules live under `src/game/`.

---

## Architectural Responsibility Map

| Module | Responsibility | Depends On | Consumers |
|--------|---------------|------------|-----------|
| `src/game/rules.ts` | Pure function: given a Uint8Array board + width/height, returns new Uint8Array with next generation | Nothing | `board.ts` |
| `src/game/board.ts` | Board state container (Uint8Array[10000]), tick execution, diff computation between old/new state | `rules.ts` | `game.ts`, Phase 2 WebSocket |
| `src/game/game.ts` | Orchestrator: owns the setTimeout tick loop, creates Board, calls tick, logs TickResult | `board.ts` | `src/index.ts` (server entry) |
| `src/game/types.ts` | Shared type definitions: `CellChange`, `TickResult`, `BoardConfig`, `GameState` | Nothing | All game modules |

```
src/index.ts
  └── src/game/game.ts (orchestrator)
        ├── src/game/rules.ts (pure GoL rules)
        └── src/game/board.ts (state + diff)
              └── src/game/rules.ts
        └── src/game/types.ts (shared types)
```

---

## User Constraints (from CONTEXT.md)

Locked, non-negotiable decisions:

| ID | Decision | Constraint |
|----|----------|------------|
| D-01 | Module split | `game.ts` (orchestrator), `board.ts` (state + diff), `rules.ts` (rules engine) |
| D-02 | Directory | `src/game/` — isolated from UI code |
| D-03 | Diff location | `board.ts` — tightly coupled to board state |
| D-04 | Diff format | `{x: number, y: number, alive: boolean}[]` — one object per changed cell |
| D-05 | Diff metadata | `{tick: number, timestamp: number, changes: CellChange[]}` |
| D-06 | Empty diffs | Broadcast with tick counter even when zero changes |

---

## Standard Stack

| Component | Choice | Version | Justification |
|-----------|--------|---------|---------------|
| Runtime | Bun | latest (per `@types/bun`) | Project constraint (PROJECT.md), AGENTS.md preference |
| Language | TypeScript | ESNext target | `tsconfig.json` strict mode activated |
| Module system | ES modules | `"type": "module"` | `package.json` |
| Data structure | `Uint8Array` | Built-in | SIM-01 requirement, 1 byte per cell, no GC pressure |
| Game loop | `setTimeout` chaining | Built-in | Drift-resistant, start/stop via clearTimeout |
| Testing | `bun test` | Built-in | AGENTS.md requirement, no test runner deps |
| No dependencies | Pure Bun stdlib | — | Project constraint: no additional frameworks |

---

## Package Legitimacy Audit

No new packages needed for Phase 1. All required capabilities are provided by the Bun runtime:

- `Uint8Array` — built-in typed array for board state
- `setTimeout` / `clearTimeout` — built-in for tick loop scheduling
- `Date.now()` — built-in for diff timestamp
- `bun test` — built-in test runner (planning phase only, tests in Wave 0)

**Verdict:** Zero external dependencies. Pure Bun + TypeScript stdlib.

---

## Architecture Patterns

### 1. Flat Uint8Array for Grid State

**Pattern:** Map a 100×100 2D grid onto a flat `Uint8Array[10000]` using row-major indexing.

```ts
const index = y * WIDTH + x;  // WIDTH = 100
const x = index % WIDTH;
const y = Math.floor(index / WIDTH);
```

**Why:** Single typed array avoids GC churn from nested arrays. Direct memory access. 10,000 bytes total. SIM-01 explicitly requires Uint8Array.

**Trade-off:** Must guard row-boundary crossings when checking neighbors by index offset. Two approaches:
- **Approach A (2D coordinate loop):** Iterate `(x, y)` coordinates, compute neighbor `(nx, ny)` via bounds check. Clear, no row-boundary bugs. 80,000 bounds checks per tick — negligible.
- **Approach B (flat index offsets + row guard):** Precompute neighbor offsets `[-101, -100, -99, -1, +1, +99, +100, +101]`, guard edges via `index % WIDTH`. Faster but error-prone.

**Recommendation:** Use Approach A for v1. Clarity wins over micro-optimization for 10k cells. Can optimize later if profiling shows it's a bottleneck (it won't be).

### 2. Pure Function Rules Engine

**Pattern:** `rules.ts` exports a single pure function:

```ts
function computeNextGeneration(board: Uint8Array, width: number, height: number): Uint8Array
```

- No side effects, no mutation of input
- Returns new `Uint8Array` — caller (board.ts) owns diff computation
- Conway rules: alive cell with 2 or 3 neighbors stays alive; dead cell with exactly 3 neighbors becomes alive
- Easy to unit test — pure function, no mocking needed

### 3. Stateful Board with Diff Tracking

**Pattern:** `board.ts` holds current grid state, delegates to `rules.ts` for next generation, computes diff between old and new grids.

```
tick():
  oldGrid = currentGrid (reference)
  newGrid = computeNextGeneration(oldGrid, WIDTH, HEIGHT)
  diff = computeDiff(oldGrid, newGrid)
  currentGrid = newGrid
  return { tick, timestamp, changes: diff }
```

Diff algorithm: iterate both grids in lockstep, emit `CellChange` where `old[i] !== new[i]`.

### 4. setTimeout Chaining Game Loop

**Pattern:** Use recursive `setTimeout` instead of `setInterval`:

```ts
function scheduleNextTick() {
  timerId = setTimeout(() => {
    const result = board.tick(tickCount);
    console.log(formatTickResult(result));
    tickCount++;
    scheduleNextTick(); // schedule next after current completes
  }, interval);
}
```

**Why:** `setInterval` fires on a fixed cadence regardless of how long the previous callback took. If `tick()` ever takes > interval, intervals stack and cause cascading drift. `setTimeout` chaining guarantees at least `interval` ms between tick starts.

**Drift handling:** For v1, accept sub-ms jitter from `setTimeout`. No real-time guarantees needed. If precision becomes important (Phase 4 heartbeat control), add drift compensation: `delay = interval - (Date.now() - tickStartTime)`.

**Start/stop:** `game.start()` creates timer. `game.stop()` calls `clearTimeout(timerId)`. No complex state machine needed.

---

## Don't Hand-Roll

| What | Use Instead |
|------|-------------|
| Custom timer/scheduler | Bun's built-in `setTimeout` / `clearTimeout` |
| Custom test framework | `bun test` with `expect` |
| 2D array `number[][]` | Flat `Uint8Array` (per SIM-01) |
| `JSON.stringify` for diff logging | Structured `console.log` with format helper (or `Bun.inspect` for debug) |
| Custom module resolution | Bun's built-in bundler module resolution (per tsconfig) |

---

## Common Pitfalls

| Pitfall | Avoidance |
|---------|-----------|
| **Row-boundary bleeding:** Neighbor at flat index +1 from column 99 wraps to next row | Use 2D coordinate approach: check `nx >= 0 && nx < width` for each neighbor |
| **Mutation of input board in rules.ts:** Modifying the same array read during neighbor counting produces wrong results | Always allocate new `Uint8Array` for output. Never mutate input. |
| **setInterval drift:** Ticks stack if computation > interval | Use `setTimeout` chaining (see Architecture Pattern #4) |
| **Unhandled timer leak:** `start()` called multiple times creates parallel timers | Guard with `if (timerId != null) return` or auto-stop before re-start |
| **Diff empty but not emitted:** Missing empty diff breaks Phase 2 resync detection | Always return `TickResult` even when `changes.length === 0` (per D-06) |
| **Dead-cell neighbor counting:** For dead cells, count neighbors to check birth rule — same loop, same logic | Write single `countAliveNeighbors(board, x, y)` used by both alive and dead paths |

---

## Code Examples

### rules.ts — Core Rules Engine

```ts
// src/game/rules.ts
export const NEIGHBOR_OFFSETS = [
  [-1, -1], [0, -1], [1, -1],
  [-1,  0],          [1,  0],
  [-1,  1], [0,  1], [1,  1],
] as const;

export function countAliveNeighbors(
  board: Uint8Array,
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  let count = 0;
  for (const [dx, dy] of NEIGHBOR_OFFSETS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      count += board[ny * width + nx]!;
    }
  }
  return count;
}

export function computeNextGeneration(
  board: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const next = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const alive = board[idx] === 1;
      const neighbors = countAliveNeighbors(board, x, y, width, height);
      if (alive) {
        next[idx] = (neighbors === 2 || neighbors === 3) ? 1 : 0;
      } else {
        next[idx] = (neighbors === 3) ? 1 : 0;
      }
    }
  }
  return next;
}
```

### types.ts

```ts
// src/game/types.ts
export interface CellChange {
  x: number;
  y: number;
  alive: boolean;
}

export interface TickResult {
  tick: number;
  timestamp: number;
  changes: CellChange[];
}

export interface BoardConfig {
  width: number;
  height: number;
  initialFill?: "empty" | "random";
  seed?: number;
}

export type GameState = "idle" | "running" | "stopped";
```

### board.ts — State + Diff

```ts
// src/game/board.ts
import { computeNextGeneration } from "./rules";
import type { CellChange, TickResult, BoardConfig } from "./types";

export class Board {
  grid: Uint8Array;
  readonly width: number;
  readonly height: number;
  tickCount = 0;

  constructor(config: BoardConfig) {
    this.width = config.width;
    this.height = config.height;
    const size = this.width * this.height;
    if (config.initialFill === "random") {
      this.grid = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        this.grid[i] = Math.random() < 0.5 ? 1 : 0;
      }
    } else {
      this.grid = new Uint8Array(size);
    }
  }

  tick(): TickResult {
    const nextGrid = computeNextGeneration(this.grid, this.width, this.height);
    const changes: CellChange[] = [];
    for (let i = 0; i < this.grid.length; i++) {
      if (this.grid[i] !== nextGrid[i]) {
        changes.push({
          x: i % this.width,
          y: Math.floor(i / this.width),
          alive: nextGrid[i] === 1,
        });
      }
    }
    this.grid = nextGrid;
    this.tickCount++;
    return {
      tick: this.tickCount,
      timestamp: Date.now(),
      changes,
    };
  }
}
```

### game.ts — Orchestrator

```ts
// src/game/game.ts
import { Board } from "./board";
import type { GameState, TickResult } from "./types";

export class Game {
  board: Board;
  state: GameState = "idle";
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private interval: number;

  constructor(interval = 1000) {
    this.interval = interval;
    this.board = new Board({ width: 100, height: 100, initialFill: "random" });
  }

  start(): void {
    if (this.state === "running") return;
    this.state = "running";
    this.scheduleTick();
  }

  stop(): void {
    if (this.timerId != null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.state = "stopped";
  }

  private scheduleTick(): void {
    this.timerId = setTimeout(() => {
      const result = this.board.tick();
      console.log(formatTickLog(result));
      if (this.state === "running") {
        this.scheduleTick();
      }
    }, this.interval);
  }
}

function formatTickLog(result: TickResult): string {
  const changedCount = result.changes.length;
  const preview = result.changes.slice(0, 5)
    .map(c => `(${c.x},${c.y}:${c.alive ? 1 : 0})`)
    .join(" ");
  const suffix = changedCount > 5 ? ` ... +${changedCount - 5} more` : "";
  return `[tick ${result.tick}] ${changedCount} changes | ${preview}${suffix}`;
}
```

### index.ts — Entry Point Integration

```ts
// src/index.ts (additions, not replacement)
import { Game } from "./game/game";

const game = new Game(1000);
game.start();
```

---

## Assumptions Log

| ID | Assumption | Risk | Validation |
|----|------------|------|------------|
| A-01 | 10,000 cells with 2D neighbor loops will run well within 1 tick interval (default 1s) at Bun speed | Low | Benchmark first tick; if >50ms, optimize with flat-index approach |
| A-02 | `setTimeout` drift (<1-4ms jitter) is acceptable for Phase 1 | Low | Phase 4 adds explicit interval control; jitter invisible to users |
| A-03 | Initial fill "random" with 50% probability produces interesting starting states | Low | User can load known patterns in later phases; random is for testing |
| A-04 | `index.ts` grows to host game lifecycle — no separate server bootstrap file needed yet | Low | Can extract to `src/server.ts` if `index.ts` exceeds ~80 lines |
| A-05 | No hot-reload complications with `--hot` and stateful game objects | Medium | `setTimeout` IDs persist across HMR; may need manual restart. Document in dev notes. |

---

## Open Questions

| ID | Question | Owner | Blocking |
|----|----------|-------|----------|
| Q-01 | Should `Game` accept a tick callback (observer pattern) for Phase 2 WebSocket integration, or should diff broadcasting be added inline? | Architect | Phase 2 |
| Q-02 | Should `Board.config.initialFill` support specific seeded patterns (e.g., glider at known position) or only empty/random? | Product | No — Phase 1 only needs empty/random |
| Q-03 | Should `TickResult.changes` be limited in size for degenerate cases (e.g., oscillators that flip the entire board)? | Architect | No — 10,000 changes is acceptable for Phase 1 logging; Phase 2 considers compression |

---

## Environment Availability

| Requirement | Available? | Notes |
|-------------|------------|-------|
| Bun runtime | ✓ | Installed, used by existing `src/index.ts` |
| TypeScript strict mode | ✓ | `tsconfig.json` `"strict": true` |
| `Uint8Array` | ✓ | Built-in, no polyfill |
| `bun test` | ✓ | Built-in, configured via `bun test` command |
| `src/game/` directory | ✗ | Must be created (mkdir during execution) |
| Test files | ✗ | No test files exist — Wave 0: create test infrastructure |

---

## Validation Architecture

`nyquist_validation` is **enabled** in `.planning/config.json` (`workflow.nyquist_validation: true`).

### Test Infrastructure Plan (Wave 0)

**Runner:** `bun test` — built into Bun, no additional dependencies.

**File structure:**
```
src/game/
├── types.ts
├── rules.test.ts      ← unit tests for rules.ts
├── rules.ts
├── board.test.ts      ← unit tests for board.ts
├── board.ts
├── game.test.ts       ← integration tests for game.ts lifecycle
└── game.ts
```

**Test strategy by module:**

| Module | Test Type | What to Validate |
|--------|-----------|------------------|
| `rules.ts` | Pure unit tests | `countAliveNeighbors` returns correct counts for corners (3 neighbors), edges (5), center (8). `computeNextGeneration` produces correct output for known patterns: block (stable), blinker (oscillator), glider (movement). |
| `board.ts` | Unit tests (class) | Constructor initializes correct size. `initialFill: "empty"` produces all-zero grid. `initialFill: "random"` produces grid with 0s and 1s. `tick()` increments `tickCount`, returns `TickResult` with correct shape, changes array populated. Empty diff returns `changes: []` with tick counter (D-06). |
| `game.ts` | Integration tests | `start()` transitions to "running" state. `stop()` clears timer, transitions to "stopped". Double `start()` is idempotent. Ticks fire at expected interval (loose assertion due to timer jitter). |

**Known pattern fixtures:**

```ts
// A 2x2 block — stable pattern, never changes
const BLOCK = [/* coordinates for a 4-cell block pattern */];
// A blinker — period-2 oscillator
const BLINKER = [/* 3 horizontal cells */];
// A glider — period-4 mover
const GLIDER = [/* 5-cell glider pattern */];
```

**Test command:** `bun test` (runs all `.test.ts` files in project).

**Nyquist sampling consideration:** Tests must cover all rule path combinations (alive with 0-8 neighbors, dead with 0-8 neighbors) plus edge/corner cases to satisfy the Nyquist sampling requirement.

### Coverage target

- `rules.ts`: 100% of conditional branches (8 neighbor states × alive/dead = 18 cases)
- `board.ts`: 100% of public methods
- `game.ts`: lifecycle states only (timer assertions loose due to async nature)

---

## Security Domain

`security_enforcement` is **enabled** (absent from `config.json` → enabled by default).

### Phase 1 Security Assessment

Phase 1 has **zero attack surface**: no network I/O, no user input, no file system access beyond source files, no external dependencies, no process spawning, no `eval()`.

| Concern | Status | Justification |
|---------|--------|---------------|
| Input validation | N/A | No external input in Phase 1 |
| Injection attacks | Not applicable | No `eval()`, no dynamic code, no SQL, no shell execution |
| Memory safety | Safe | `Uint8Array` is bounds-checked by JS engine; out-of-bounds returns `undefined` |
| Prototype pollution | Safe | No object spreading from untrusted sources; typed arrays not susceptible |
| Denial of service | Safe | Fixed-size 10,000 cell board; loop is bounded; no resource exhaustion path |
| Information disclosure | Safe | Console logging is intentional; no secrets in code |
| Dependency supply chain | Safe | Zero new dependencies |

**Verdict:** Security domain is satisfied for Phase 1 with no additional mitigations required. A `## Security Domain` section in PLAN.md should note: "Phase 1 has no network or user-facing surface — security review deferred until Phase 2 (WebSocket)."

**Phase 2 security preview:** When WebSocket is introduced, validate `toggle_cell` message bounds (0 ≤ x < 100, 0 ≤ y < 100), use `try/catch` for message parsing (per ROADMAP.md plan 02-02), and enforce per-tick write boundaries for conflict resolution.

---

## Sources

| Source | Type | Relevance |
|--------|------|-----------|
| `.planning/REQUIREMENTS.md` | Requirements | SIM-01 through SIM-04 define mandatory behavior |
| `.planning/ROADMAP.md` | Architecture | Phase 1 plans (01-01, 01-02), success criteria, dependency chain |
| `.planning/PROJECT.md` | Context | Project constraints, finite board decision, Bun stack |
| `.planning/phases/01-server-game-loop/01-CONTEXT.md` | Decisions | D-01 through D-06 locked decisions |
| `.planning/config.json` | Config | `nyquist_validation: true` |
| `package.json` | Stack | Dependencies, scripts, module type |
| `tsconfig.json` | Compiler | Strict mode, ESNext target, bundler resolution |
| `src/index.ts` | Existing Code | Server entry point, Bun.serve() patterns |
| Conway's Game of Life (Gardner, 1970) | Theory | B3/S23 rule set: birth on 3, survival on 2-3 |

---

## Phase Requirements Mapping

```
<phase_requirements>
SIM-01: Server maintains in-memory 100x100 finite board as Uint8Array
  → Module: board.ts (Board class) — flat Uint8Array[10000], row-major indexing
  → Responsibilities: initialization (empty/random), state container
  → Verified by: board.test.ts — constructor creates correct size, fill modes

SIM-02: Server runs GoL rules on setInterval tick (alive = 2-3 neighbors, dead = 3 neighbors)
  → Module: rules.ts (computeNextGeneration) — pure function, B3/S23 rules
  → Module: game.ts (Game class) — setTimeout chaining tick loop
  → Responsibilities: neighbor counting, rule application, tick scheduling
  → Verified by: rules.test.ts — pattern tests (block, blinker, glider); game.test.ts — lifecycle tests

SIM-03: Cells on edges have fewer neighbors (no wrap-around)
  → Module: rules.ts (countAliveNeighbors) — bounds-check each neighbor (nx, ny)
  → Responsibilities: edge-aware neighbor counting via 2D coordinate bounds
  → Verified by: rules.test.ts — corner cell (3 neighbors), edge cell (5 neighbors), center cell (8 neighbors)

SIM-04: Server computes board diff (changed cells only) after each tick
  → Module: board.ts (Board.tick) — compares old/new grids, collects CellChange[]
  → Responsibilities: change detection, TickResult composition
  → Verified by: board.test.ts — diff populated, empty diff on stable patterns, tick counter increments
</phase_requirements>
```

---

## Metadata

- **Phase:** 01 — Server Game Loop
- **Status:** Research Complete
- **Next Step:** `/gsd-plan-phase 1` — Create PLAN.md with implementation waves
- **Plans in Phase:** 2
  - 01-01: Core board state (Uint8Array[10000]) + GoL rules engine with finite-edge neighbor counting
  - 01-02: setTimeout tick loop + board diff computation + console logging
- **Depends On:** Nothing (first phase)
- **Depended On By:** Phase 2 (WebSocket Sync)