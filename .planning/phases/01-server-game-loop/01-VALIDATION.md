---
phase: 01
slug: server-game-loop
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-24
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `bun test` (built-in) |
| **Config file** | none — `bun test` uses defaults |
| **Quick run command** | `bun test src/game/` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test src/game/`
- **After every plan wave:** Run `bun test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | SIM-01 | — | N/A | unit | `bun test src/game/board.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | SIM-02 | — | N/A | unit | `bun test src/game/rules.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | SIM-03 | — | N/A | unit | `bun test src/game/rules.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | SIM-02 | — | N/A | unit | `bun test src/game/board.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | SIM-04 | — | N/A | unit | `bun test src/game/board.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 1 | SIM-02 | — | N/A | integration | `bun test src/game/game.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/game/rules.test.ts` — stubs for SIM-02, SIM-03 (neighbor counting, edge cases, known patterns)
- [ ] `src/game/board.test.ts` — stubs for SIM-01, SIM-04 (initialization, tick lifecycle, diff computation)
- [ ] `src/game/game.test.ts` — stubs for SIM-02 (game lifecycle: start/stop, tick scheduling)
- [ ] `bun test` — already available (Bun built-in), no framework install needed

---

## Manual-Only Verifications

None — all phase behaviors have automated verification via `bun test`.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending