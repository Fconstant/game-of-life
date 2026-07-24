# Domain Pitfalls

**Domain:** Real-time multiplayer Game of Life with LLM player
**Researched:** 2025-07-24

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: LLM blocks the game loop
**What goes wrong:** The server pauses the game tick while waiting for Ollama to respond. All clients freeze.
**Why it happens:** The developer writes `await fetch(Ollama)` inside the `setInterval` callback. Ollama is slow (500ms-3s for small models on consumer hardware).
**Consequences:** Game stutters. Clients see janky tick intervals. Worst case: interval backlog causes cascading delays.
**Prevention:** Always fire-and-forget the Ollama call. Use an async function that enqueues results into a shared array. The synchronous tick loop drains the queue in <1μs.
**Detection:** Game tick interval varies wildly when LLM is enabled. Console log timing of `llmTick()` vs `applyRules()`.

### Pitfall 2: WebSocket message parsing throws
**What goes wrong:** `JSON.parse()` in the `message` handler throws because a client sent malformed JSON or a binary frame.
**Why it happens:** Raw WebSocket accepts any input. A browser extension, proxy, or buggy client sends non-JSON data.
**Consequences:** Uncaught exception in `message` handler crashes the server or drops the connection.
**Prevention:** Wrap all `message` handler logic in try/catch. Validate message shape before accessing properties.
**Detection:** Server console shows unhandled promise rejection or error in message handler.

```typescript
// Safe message handler
message(ws, raw) {
  try {
    const msg = JSON.parse(String(raw));
    if (!msg || typeof msg !== 'object' || !msg.type) return;
    handleMessage(ws, msg);
  } catch {
    // Malformed message — ignore
    console.warn("Bad message from", ws.remoteAddress);
  }
}
```

### Pitfall 3: Client state desync
**What goes wrong:** Client's local grid diverges from server's authoritative grid. Cells appear in wrong state.
**Why it happens:** Client misses a `board_diff` (WebSocket message lost or dropped), or applies diffs in wrong order. This is rare with WebSocket (TCP-based, ordered delivery) but possible during reconnection.
**Consequences:** One client sees different board than others. Toggling cells that are already dead/alive. Confusing UX.
**Prevention:** Monotonic tick counter. Client tracks `lastTick`. If received `tick !== lastTick + 1`, request `full_state` resync. On reconnect, always request `full_state`.
**Detection:** User reports "my board doesn't match theirs." Tick counter in debug overlay shows gap.

### Pitfall 4: Client-side game loop (running GoL on both server and client)
**What goes wrong:** Both server and client run the same game loop independently. They drift apart quickly due to floating point timing differences and concurrent toggle interleaving.
**Why it happens:** Naive architecture where server broadcasts "run the next tick" and every client computes independently.
**Consequences:** Impossible to keep in sync. Players toggling cells create divergent states. Each client computes a different next generation.
**Prevention:** Server is sole authority. Client never computes next generation. Client only renders what the server sends.
**Detection:** Two browser windows side by side show different boards after a few ticks.

## Moderate Pitfalls

### Pitfall 1: Full state too large for WebSocket frame
**What goes wrong:** `full_state` message exceeds Bun's `maxPayloadLength` (default 16MB).
**Why it happens:** Sending raw JSON array of 10k values (~200KB) is fine. But if grid is expanded (e.g., 500x500 = 250KB) or encoding is verbose.
**Consequences:** Message silently dropped. New client never receives initial state.
**Prevention:** Encode grid as base64 (13KB for 100x100). Stay well under 16MB limit.
**Detection:** Client stays on blank/loading state after connect.

### Pitfall 2: Ollama structured output failures
**What goes wrong:** LLM returns malformed JSON or coordinates outside [0-99] range.
**Why it happens:** Small models (3B params) struggle with precise structured output. Even with `format: "json"` parameter, coordinate values may be out of range.
**Consequences:** LLM actions silently dropped. LLM appears to not be playing.
**Prevention:** Validate all LLM output. Clamp coordinates. Retry prompt once on parse failure. Fall back to random valid cell toggle if retry fails.
**Detection:** Server logs "LLM action rejected: invalid coordinate (150, 200)".

### Pitfall 3: Multiple clients toggle same cell same tick
**What goes wrong:** Two players click the same cell within the same tick. Both expect their toggle to take effect.
**Why it happens:** Concurrent interaction. Both toggles reach the server before the next tick.
**Consequences:** Cell state only flips once (two XORs = no-op). One player's action is effectively canceled.
**Prevention:** Accept this as inherent to the real-time model. Server is authoritative — last toggle within tick wins. Communicate visually that toggles are applied at tick boundary (e.g., brief flash on click).
**Detection:** Inevitable. Design UX around it rather than preventing.

### Pitfall 4: Heartbeat interval changes during LLM call
**What goes wrong:** User changes tick speed while an Ollama call is in-flight. The LLM's prompt was built for the old interval context.
**Why it happens:** LLM prompt includes timing context (e.g., "you have 500ms between moves"). Interval changes invalidate this.
**Consequences:** LLM may act too fast or too slow for the new interval.
**Prevention:** Don't include interval in LLM prompt. Let LLM act once per N ticks regardless of speed. Or restart LLM timer on interval change.
**Detection:** LLM actions seem mis-timed relative to tick speed.

## Minor Pitfalls

### Pitfall 1: CSS Grid render performance
**What goes wrong:** 10,000 `<div>` elements re-render every tick, causing frame drops.
**Why it happens:** Naive re-render of all cells instead of only changed cells.
**Consequences:** UI feels sluggish at fast tick rates (especially 500ms).
**Prevention:** Use React keys (`key={y * W + x}`) so React only reconciles changed cells. Track changed cells from `board_diff` and only update those DOM nodes.
**Detection:** DevTools Performance tab shows long frames during tick.

### Pitfall 2: WebSocket not closing cleanly
**What goes wrong:** Client navigates away or closes tab. Server doesn't detect disconnection for up to 120 seconds (default `idleTimeout`).
**Why it happens:** Browser doesn't always send close frame. Server waits for timeout.
**Consequences:** Stale connections accumulate. LLM "sees" players that left.
**Prevention:** Set `idleTimeout: 30` seconds. Optionally implement ping/pong via WebSocket.
**Detection:** `server.pendingWebSockets` count continues to grow.

### Pitfall 3: LLM prompt too long
**What goes wrong:** Including full board state in LLM prompt (10k cells = massive token count).
**Why it happens:** Naively serializing grid state into prompt text.
**Consequences:** High token usage. Slow inference. Expensive (even locally).
**Prevention:** Summarize board state instead: alive cell count, density clusters, known patterns detected, recent changes.
**Detection:** Ollama metrics show high prompt_eval_count (>1000 tokens).

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: Game loop | Forgetting edge cells have fewer neighbors | Finite board rules: only count neighbors within [0,99] bounds |
| Phase 2: WebSocket | Sending full state on every tick | Diff-based protocol from day one. Full state only for new connections. |
| Phase 3: UI grid | Re-rendering all 10k cells every tick | Use React keys. Apply only changed cells from board_diff. |
| Phase 4: Heartbeat slider | Server not synchronizing interval across clients | Broadcast new interval value as a message type. Clients display current speed. |
| Phase 5: LLM player | LLM blocks tick loop | Fire-and-forget fetch. Queue pattern. Never await in tick handler. |

## Sources

- Bun WebSocket documentation (backpressure, idleTimeout, maxPayloadLength limits)
- Common real-time sync pitfalls (authoritative server pattern, diff-based protocols)
- Ollama structured output behavior (known issues with small models and JSON mode)
- Game of Life edge cell handling (finite board vs toroidal wrap-around)