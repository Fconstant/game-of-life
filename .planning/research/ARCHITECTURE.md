# Architecture Patterns

**Domain:** Real-time multiplayer Game of Life with LLM player
**Researched:** 2025-07-24

## Recommended Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                         Bun.serve() Process                         │
│                                                                     │
│  ┌──────────────────────┐    ┌─────────────────────────────────┐   │
│  │   HTTP Router         │    │     WebSocket Handler            │   │
│  │   ─────────────────    │    │     ─────────────────────────    │   │
│  │   /* → index.html     │    │     open:  subscribe to topic    │   │
│  │   /api/* (unused)     │    │     message: handle toggle_cell  │   │
│  └──────────────────────┘    │     close: unsubscribe           │   │
│                               │     Binary: N/A                  │   │
│                               └──────────────┬──────────────────┘   │
│                                              │                      │
│  ┌───────────────────────────────────────────▼──────────────────┐   │
│  │                 Board State (Uint8Array[10000])               │   │
│  │                 ─────────────────────────────                 │   │
│  │                 tick: number                                  │   │
│  │                 players: Set<WebSocketData>                   │   │
│  │                 interval: number (500-3000)                   │   │
│  │                 llmQueue: Array<LLM_Action>                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                               │                                      │
│              ┌────────────────┼────────────────┐                     │
│              ▼                ▼                ▼                     │
│  ┌──────────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │  Game Loop        │ │  LLM Player  │ │  Pub/Sub     │            │
│  │  (setInterval)    │ │  (async)     │ │  Broadcast   │            │
│  │                   │ │              │ │              │            │
│  │  applyRules()     │ │  fetch()     │ │  publish()   │            │
│  │  computeDiff()    │ │  parseJSON() │ │  → all subs  │            │
│  │  llmDequeue()     │ │  enqueue()   │ │              │            │
│  └──────────────────┘ └──────────────┘ └──────────────┘            │
└────────────────────────────────────────────────────────────────────┘
                           │
               WebSocket  │  connection
                           │
┌──────────────────────────▼─────────────────────────────────────────┐
│                     Browser Client                                   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  React App                                                     │   │
│  │  ─────────                                                     │   │
│  │  useSyncExternalStore(boardStore)                               │   │
│  │                                                                 │   │
│  │  ┌──────────────────────┐    ┌──────────────────┐             │   │
│  │  │  WebSocket Client     │    │  Board Grid       │             │   │
│  │  │  ────────────────     │    │  ──────────       │             │   │
│  │  │  onmessage → apply    │    │  100x100 CSS Grid │             │   │
│  │  │  send() → toggle      │    │  onClick → send() │             │   │
│  │  └──────────────────────┘    └──────────────────┘             │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| BoardState | Stores Uint8Array grid + tick counter. Single source of truth. | Game loop, WebSocket handler, LLM player |
| GameLoop | setInterval-driven. Applies GoL rules, calls LLM, computes diff, triggers publish. | BoardState (read/write), Pub/Sub (write), LLM player (trigger) |
| WebSocketHandler | Handles connect/disconnect/message. Validates toggle_cell, set_interval. Subscribes clients to topic. | BoardState (read/write on toggle), Pub/Sub (subscribe/publish) |
| Pub/Sub | Bun-native topic-based broadcast. One topic: "board-state". | GameLoop (publish), WebSocketHandler (subscribe/publish) |
| LLMPlayer | Async timer. Fetches from Ollama, parses response, enqueues actions. | BoardState (read for context), Ollama (HTTP fetch), game loop (enqueue) |
| Client (React) | Renders grid, sends toggles, receives diffs, reconciles local state. | WebSocket server |
| Client WebSocket | Thin wrapper around browser `WebSocket`. Reconnect on close. | Server WebSocket |

### Data Flow

**Tick cycle (server-side, every N ms):**
```
1. GameLoop: read BoardState.currentGrid
2. GameLoop: applyRules() → compute nextGrid
3. GameLoop: diff = xor(currentGrid, nextGrid) → [{x, y, v}, ...]
4. GameLoop: apply LLM queued actions to nextGrid
5. GameLoop: write BoardState.currentGrid = nextGrid
6. GameLoop: increment BoardState.tick
7. GameLoop: publish({type: "board_diff", tick, changes: diff})
8. GameLoop: if LLM timer expired, spawn fetch (async, non-blocking)
```

**Player toggle:**
```
1. Client: click cell → send({type: "toggle_cell", x, y})
2. Server: validate (x,y) in bounds, cell exists
3. Server: BoardState.currentGrid[y][x] ^= 1
4. Server: change recorded — captured on next tick's diff computation
5. Server: (optional) publish immediate diff for responsive feel
```

**Client connect:**
```
1. Server: upgrade HTTP → WebSocket
2. Server: subscribe client to "board-state" topic
3. Server: send({type: "full_state", tick, grid: encode(Grid)})
4. Client: receive full_state → set local grid → render
```

**Client reconnect / resync:**
```
1. Client: detect tick gap (received tick != local tick + 1)
2. Client: send({type: "request_full_state"})
3. Server: send full_state
```

## Patterns to Follow

### Pattern 1: Uint8Array grid encoding
**What:** Store 100x100 grid as `new Uint8Array(10000)`. Index = y * 100 + x.
**When:** Always — memory efficient, fast comparison for diffs, easy to base64-encode.
**Why not nested arrays:** `Uint8Array` is contiguous memory. No cache misses from nested array lookups. `xor` comparison is a single pass. Base64 encoding is ~13KB vs ~50KB+ for JSON 2D array.

```typescript
// Grid operations
const W = 100, H = 100;
const grid = new Uint8Array(W * H);

// Read cell
grid[y * W + x] === 1;

// Toggle cell
grid[y * W + x] ^= 1;

// Compute diff between two grids
function computeDiff(oldGrid: Uint8Array, newGrid: Uint8Array): {x: number, y: number, v: number}[] {
  const changes: {x: number, y: number, v: number}[] = [];
  for (let i = 0; i < oldGrid.length; i++) {
    if (oldGrid[i]! !== newGrid[i]!) {
      changes.push({ x: i % W, y: Math.floor(i / W), v: newGrid[i]! });
    }
  }
  return changes;
}

// Base64 encode for full_state
function encodeGrid(grid: Uint8Array): string {
  return btoa(String.fromCharCode(...grid));
}
```

### Pattern 2: Async LLM with action queue
**What:** LLM runs on its own timer (e.g., every 3 game ticks, or every 5 seconds). It reads board state, calls Ollama, parses response, and queues up to 3 cell toggles. The game loop drains the queue on each tick.
**When:** LLM player is active.

```typescript
const llmQueue: Array<{x: number, y: number}> = [];

// Called asynchronously, does not block game loop
async function llmTick(grid: Uint8Array) {
  const response = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    body: JSON.stringify({
      model: "llama3.2",
      prompt: buildPrompt(grid),
      stream: false,
      options: { temperature: 0.7 },
      format: "json"
    })
  });
  const data = await response.json();
  const actions = JSON.parse(data.response).actions;
  for (const action of actions) {
    if (isValid(action)) llmQueue.push(action);
  }
}

// Called synchronously in game loop
function drainLLMQueue(grid: Uint8Array) {
  while (llmQueue.length > 0) {
    const action = llmQueue.shift()!;
    grid[action.y * W + action.x] ^= 1;
  }
}
```

### Pattern 3: Pub/Sub for fan-out
**What:** Use `server.publish("board-state", message)` instead of iterating client list. Bun handles the broadcast internally.
**When:** Any server→multiple clients broadcast.

```typescript
// Subscribe on open
websocket: {
  open(ws) {
    ws.subscribe("board-state");
  },
  close(ws) {
    ws.unsubscribe("board-state");
  }
}

// Publish from game loop
server.publish("board-state", JSON.stringify({
  type: "board_diff",
  tick,
  changes: diff
}));
```

### Pattern 4: Server-authoritative tick
**What:** Game loop runs on the server. Client timestamps are irrelevant. Client never computes next generation — it only renders what the server sends.
**When:** Always — prevents desync between clients.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Sending full board on every tick
**What:** Broadcasting the entire 100x100 grid as JSON every 500ms.
**Why bad:** ~13KB per tick × 2 ticks/sec × N clients = unnecessary bandwidth. Game of Life typically changes ~1-5% of cells per tick.
**Instead:** Diff-based updates. Full state only on connect.

### Anti-Pattern 2: Blocking game loop on LLM
**What:** `await fetch()` inside the tick handler.
**Why bad:** Ollama calls take 500ms-3s depending on model and hardware. If you await inside the tick loop, the game pauses for everyone until the LLM responds.
**Instead:** Fire-and-forget async. Queue results.

### Anti-Pattern 3: Client-side prediction without authority
**What:** Client computes next generation locally and renders it before server confirms.
**Why bad:** Two clients with slightly different board states (due to concurrent toggles) will compute different next generations. Desync becomes visible and compounding.
**Instead:** Server is sole authority. Client renders only what server sends. Optimistic rendering of own toggle is acceptable (flip cell immediately) but must be overridden by next `board_diff`.

### Anti-Pattern 4: Using `ws.send()` in a loop
**What:** `for (const client of clients) { client.send(msg); }`
**Why bad:** N clients = N sequential send() calls. Higher latency. More backpressure risk.
**Instead:** `server.publish("board-state", msg)` — one call, Bun handles fan-out.

## Scalability Considerations

| Concern | Localhost prototype (1-5 clients) | Notes |
|---------|----------------------------------|-------|
| Board memory | Uint8Array[10000] = 10KB + overhead | Negligible |
| Client list memory | ~1KB per client | 5 clients = 5KB |
| Tick computation | ~1ms per 10k cells (single-threaded) | Fine for any tick rate |
| WebSocket bandwidth | ~200 bytes/tick diff, ~13KB per connect | Fine for localhost |
| LLM latency | 500ms-3s per call | Non-blocking. Not a bottleneck — game continues without LLM actions until next tick. |
| Concurrent toggles | Handled by server authority. Latest toggle wins within a tick. | Acceptable for prototype |

No scaling concerns for localhost. If future deployment to many concurrent users, the bottleneck would be the synchronous game loop (single-threaded JS) and the single-room design. Would need worker threads or separate room instances.

## Sources

- Bun WebSocket docs: `/node_modules/bun-types/docs/runtime/http/websockets.mdx`
- Ollama API docs: `https://docs.ollama.com/api/generate`
- Common Game of Life implementations (grid storage patterns, neighbor counting)
- Pub/Sub architectural pattern (used in MQTT, Redis, Socket.IO rooms)