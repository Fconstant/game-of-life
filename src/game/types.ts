export type CellChange = { x: number; y: number; alive: boolean };

export type TickResult = { tick: number; timestamp: number; changes: CellChange[] };

export type BoardConfig = {
  width: number;
  height: number;
  initialFill?: 'empty' | 'random';
  seed?: number;
};

export type GameState = 'idle' | 'running' | 'stopped';