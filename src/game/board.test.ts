import { describe, test, expect } from 'bun:test';
import { Board } from './board';

function makeBoard(alive: [number, number][], width = 100, height = 100): Board {
  const config = { width, height, initialFill: 'empty' as const };
  const b = new Board(config);
  for (const [x, y] of alive) {
    b.grid[y * width + x] = 1;
  }
  return b;
}

describe('Board.tick()', () => {
  test('empty board returns TickResult with no changes and incremented tick', () => {
    const board = new Board({ width: 100, height: 100 });
    const result = board.tick();
    expect(result.changes.length).toBe(0);
    expect(board.tickCount).toBe(1);
    expect(result.tick).toBe(1);
  });

  test('TickResult has tick, timestamp, and changes array', () => {
    const board = new Board({ width: 100, height: 100 });
    const result = board.tick();
    expect(result).toHaveProperty('tick', 1);
    expect(result).toHaveProperty('timestamp');
    expect(typeof result.timestamp).toBe('number');
    expect(result.timestamp).toBeGreaterThan(1650000000000);
    expect(Array.isArray(result.changes)).toBe(true);
  });

  test('single center cell dies with no neighbors — 1 change, alive: false', () => {
    const board = makeBoard([[50, 50]]);
    const result = board.tick();
    expect(result.changes.length).toBe(1);
    expect(result.changes[0]).toEqual({ x: 50, y: 50, alive: false });
  });

  test('2x2 block is stable — 0 changes', () => {
    const board = makeBoard([[1, 1], [1, 2], [2, 1], [2, 2]], 4, 4);
    const result = board.tick();
    expect(result.changes.length).toBe(0);
    expect(board.tickCount).toBe(1);
  });

  test('tickCount increments across multiple ticks', () => {
    const board = new Board({ width: 100, height: 100 });
    board.tick();
    board.tick();
    expect(board.tickCount).toBe(2);
    board.tick();
    expect(board.tickCount).toBe(3);
  });

  test('blinker produces correct changes', () => {
    const board = makeBoard([[10, 10], [11, 10], [12, 10]], 20, 20);
    const result = board.tick();
    expect(result.changes.length).toBe(4);
    const survival = result.changes.filter((c) => c.alive);
    expect(survival).toContainEqual({ x: 11, y: 9, alive: true });
    expect(survival).toContainEqual({ x: 11, y: 11, alive: true });
  });
});