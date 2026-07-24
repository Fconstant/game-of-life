# Phase 1: Server Game Loop - Context

**Gathered:** 2025-07-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Server runs Conway's Game of Life simulation on a 100x100 in-memory board at fixed interval. Computes board diffs each tick. No UI, no network, no persistence — pure computation core.

</domain>

<decisions>
## Implementation Decisions

### File Structure
- **D-01:** Split game logic into modules: `game.ts` (orchestrator), `board.ts` (state + diff), `rules.ts` (GoL rules engine)
- **D-02:** Game modules live in `src/game/` directory, isolated from UI code
- **D-03:** Diff computation lives inside `board.ts` — tightly coupled to board state

### Diff Format Contract
- **D-04:** Diff format: array of `{x: number, y: number, alive: boolean}` objects — one entry per changed cell
- **D-05:** Diff includes metadata: `{tick: number, timestamp: number, changes: CellChange[]}` — clients use tick for resync detection
- **D-06:** Empty diffs (no cells changed) still broadcast with tick counter — clients know tick happened, nothing changed

### the agent's Discretion
- No "you decide" responses — user made explicit choices for all areas

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — 26 v1 requirements, Phase 1 covers SIM-01 through SIM-04
- `.planning/ROADMAP.md` — Phase 1 definition, success criteria, dependency chain

### Project
- `.planning/PROJECT.md` — Project context, constraints, key decisions

No external specs — requirements fully captured in REQUIREMENTS.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Bun.serve()` in `src/index.ts`: Existing server setup with routes — game loop will be added alongside or integrated
- `bun-plugin-tailwind`: Already configured, no changes needed for Phase 1 (server-only)

### Established Patterns
- TypeScript with strict config (`tsconfig.json`)
- Bun runtime with `--hot` reload for development
- ES modules (`"type": "module"` in package.json)

### Integration Points
- `src/index.ts`: Entry point — game loop will be started from here
- `package.json` scripts: `bun run dev` starts the server

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Server Game Loop*
*Context gathered: 2025-07-24*
