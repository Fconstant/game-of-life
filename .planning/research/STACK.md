# Technology Stack

**Project:** Game of Life — Multiplayer + LLM Player
**Researched:** 2025-07-24
**Mode:** Ecosystem

## Overview

This project needs zero external framework additions beyond what Bun already provides. The stack is:

```
Bun (runtime + server + WebSocket + bundler)
├── React 19 (UI rendering)
├── Tailwind CSS 4 (styling)
├── Bun.serve() WebSocket (real-time sync)
├── Ollama /api/generate (LLM player)
└── No database
```

Every component already exists in the project template. No new npm packages required for the core stack.

## Recommended Stack

### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Bun | >=1.2 | Runtime, server, WebSocket, bundler | Already installed. Bun.serve() handles HTTP + WebSocket in one process. Built-in HMR for dev. Native TypeScript/JSX — no build step needed for server code. |
| React | 19 | Client UI | Already installed. Canvas-free game board rendering via DOM grid (CSS Grid). Adequate for 100x100 cells (10k elements) with proper virtualization strategy. |
| Tailwind CSS | 4.1 | Styling | Already installed. v4 uses CSS-first config (no tailwind.config.js). Utility classes for grid layout, cell sizing, slider styling. |

### WebSocket Layer
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Bun.serve().websocket | built-in | Real-time bidirectional sync | 7x throughput vs Node.js `ws` library (benchmarked: ~700k msg/s vs ~100k). Native Pub/Sub API (`server.publish`, `ws.subscribe`). Per-message compression via `perMessageDeflate`. Built-in backpressure handling. |
| WebSocket (browser) | built-in | Client WebSocket connection | Standard browser API. No polyfill needed. Bun's WebSocket client supports custom headers (Bun extension). |

### LLM Player
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Ollama | >=0.5 | Local LLM server | Runs locally. No API keys. Small models (Llama 3.2 3B, Gemma 3 4B) fit on consumer hardware. REST API at `http://localhost:11434`. |
| fetch (Bun) | built-in | Ollama API calls | Bun's native `fetch` works for HTTP calls to Ollama. No SDK needed. Non-streaming mode (`stream: false`) for turn-based LLM decisions. |

## Rationale

### Why no additional dependencies

1. **Bun is the whole server.** HTTP routing, WebSocket upgrade, message handling, pub/sub — all in `Bun.serve()`. No Express, no ws library, no Socket.IO. Bun's WebSocket API is declarative (handler object instead of per-connection event listeners), which reduces memory overhead at scale.

2. **Pub/Sub replaces manual broadcast loops.** Instead of maintaining an array of connected clients and looping through `ws.send()`, use `server.publish("board-state", message)`. All clients subscribed to the topic receive the update. Bun handles fan-out internally. This is critical for diff-based board updates: all subscribers get changes in a single `publish()` call.

3. **React 19 without extra state management.** The board state is a flat 2D array `Uint8Array[10000]` (1 = alive, 0 = dead). React's `useSyncExternalStore` can bridge the WebSocket stream to React state. No Redux, no Zustand, no Immer needed. The message protocol is the single source of truth.

4. **No Canvas API needed.** 10k cells at ~30px each = 3000x3000px total grid. CSS Grid with `grid-template-columns: repeat(100, 30px)` works. Each cell is a `<div>` with `class="w-[30px] h-[30px]"`. React reconciliation handles changed cells. For 100x100 this is fast enough at 0.5s tick intervals. Canvas would be premature optimization.

### WebSocket message protocol design

The protocol has three message types. All messages are JSON strings.

**Message 1: `board_diff`** — Sent server→clients on each tick. Contains only cells that changed.

```typescript
// Server → Client (on every tick + player toggle)
{
  "type": "board_diff",
  "tick": 142,         // monotonic tick counter
  "changes": [
    { "x": 12, "y": 45, "v": 1 },  // toggled alive
    { "x": 13, "y": 45, "v": 0 }   // toggled dead
  ]
}
```

**Message 2: `full_state`** — Sent to newly connected clients. Full 100x100 snapshot.

```typescript
// Server → Client (on connect)
{
  "type": "full_state",
  "tick": 142,
  "grid": "base64-encoded-uint8array-of-10000-bytes"  // ~13KB base64
}
```

**Message 3: `toggle_cell`** — Sent client→server when a player clicks.

```typescript
// Client → Server
{
  "type": "toggle_cell",
  "x": 12,
  "y": 45
}
```

**Client reconciliation:**
- Client starts with full state on connect.
- On each `board_diff`, client applies changes to its local grid copy.
- If client receives `tick` that is not `previous_tick + 1`, it requests `full_state` resync.
- Client can optimistically apply its own toggle before server ack, but must honor `board_diff` as authoritative.

### Game loop architecture

The server runs a single `setInterval` (adjustable). Per tick:

```
1. Apply Game of Life rules to current board → compute diffs
2. If LLM player is active: call Ollama async, queue its toggle decisions
3. Publish board_diff to all subscribed clients
4. Store current tick number
```

Tick interval is controlled by clients sending a `set_interval` message:

```typescript
// Client → Server
{ "type": "set_interval", "ms": 500 }
```

Server validates: min 500ms, max 3000ms, step 250ms.

### Ollama integration pattern

Call pattern from Bun:

```typescript
const response = await fetch("http://localhost:11434/api/generate", {
  method: "POST",
  body: JSON.stringify({
    model: "llama3.2",
    prompt: buildLLMPrompt(boardState, playerContext),
    stream: false,
    options: { temperature: 0.7, seed: 42 }
  })
});
const data = await response.json();
// data.response contains the LLM's decision text
```

`buildLLMPrompt()` constructs a prompt like:

```
You are a player in a Game of Life. The board is 100x100.
Current state: {alive cells count, clusters, patterns detected}
You can:
- Toggle cells: specify coordinates (x,y) to flip alive/dead
- Place known patterns: glider, blinker, block, beehive
Choose up to 3 cell toggles or one pattern placement.
Respond in JSON format:
{"actions": [{"type": "toggle", "x": 10, "y": 20}, ...]}
```

The LLM runs asynchronously — it does NOT block the game tick. Its queued actions are applied on the next tick.

## Anti-Recommendations

| Category | Recommended | Anti-Recommended | Why |
|----------|-------------|-----------------|-----|
| WebSocket lib | Bun.serve().websocket | `ws` npm package | Bun's built-in WebSocket is 7x faster. Adding `ws` duplicates native API with no benefit. |
| HTTP framework | Bun.serve() routes | Express, Hono, Elysia | Zero additional routes needed — just static file serving + WebSocket upgrade. Extra framework = extra complexity with no benefit. |
| State management | useSyncExternalStore | Redux, Zustand, Jotai | Single-source-of-truth is the WebSocket stream. No complex state shapes. Extra state lib = indirection. |
| Canvas rendering | CSS Grid + React DOM | HTML5 Canvas, Pixi.js, Three.js | 100x100 DOM grid is fast enough at 0.5s+ tick rates. Canvas adds imperative rendering code, breaks React declarative model, and doesn't compose with Tailwind. |
| LLM SDK | fetch() to Ollama API | langchain, ollama-js npm | Ollama API is a single POST endpoint. An SDK adds dependency weight for a one-line fetch call. |
| Database | None | SQLite, Redis, filesystem | No persistence in scope. All state is in-memory on the server. Adding DB = unnecessary infrastructure. |
| Real-time framework | Raw WebSocket | Socket.IO | Socket.IO adds fallback transports (long-polling), rooms, and ACK protocol. We don't need any of that — pure WebSocket works everywhere in 2025. |

## Installation

No additional packages. Existing `package.json` is sufficient:

```bash
# Already installed:
bun install
# Already in dependencies:
#   bun-plugin-tailwind, react, react-dom, tailwindcss
# Already in devDependencies:
#   @types/react, @types/react-dom, @types/bun
```

To add Ollama (separate from Node project):

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh
# Pull a small model
ollama pull llama3.2:3b
```

## Confidence Levels

| Area | Confidence | Notes |
|------|------------|-------|
| Bun WebSocket suitability | HIGH | Verified from official Bun docs (websockets.mdx). 7x throughput benchmark. Pub/Sub API is purpose-built for broadcast scenarios. |
| Board state diffing protocol | HIGH | Standard pattern used in real-time collaborative apps (Operational Transform adjacent). Proven in Figma, Google Docs. |
| React DOM grid performance | HIGH | 10k DOM nodes is well within browser comfort zone. React 19's reconciliation handles this effortlessly at sub-second intervals. |
| Ollama API call pattern | HIGH | Ollama REST API is stable and well-documented. fetch() is the canonical way to call it from Bun. |
| CSS Grid 100x100 rendering | MEDIUM | Works for 30px cells (3000px total). May need scroll container for smaller screens. If performance issues arise, switch to canvas or virtualize visible viewport. |
| LLM prompt reliability | MEDIUM | Small models (3B params) may produce malformed JSON or nonsensical coordinates. Need retry logic, fallback behavior, and structured output (`format: json` parameter). |

## Sources

- Bun WebSocket API docs: `/node_modules/bun-types/docs/runtime/http/websockets.mdx`
- Ollama API docs: `https://docs.ollama.com/api/generate`
- Project template: existing `src/index.ts` with `Bun.serve()`, React 19, Tailwind 4.1
- WebSocket benchmark: Bun docs (7x vs Node.js `ws`)