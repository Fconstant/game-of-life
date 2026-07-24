import { describe, test, expect } from 'bun:test';
import { countAliveNeighbors, computeNextGeneration } from './rules';

function makeBoard(alive: [number, number][], width = 100, height = 100): Uint8Array {
  const board = new Uint8Array(width * height);
  for (const [x, y] of alive) {
    board[y * width + x] = 1;
  }
  return board;
}

function aliveCells(board: Uint8Array, width: number): [number, number][] {
  const cells: [number, number][] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === 1) {
      cells.push([i % width, Math.floor(i / width)]);
    }
  }
  return cells;
}

describe('countAliveNeighbors', () => {
  test('corner cell at (0,0) has max 3 neighbors', () => {
    const board = new Uint8Array(100 * 100);
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]]) {
      board[dy * 100 + dx] = 1;
    }
    expect(countAliveNeighbors(board, 0, 0, 100, 100)).toBe(3);
  });

  test('edge cell at (50,0) has max 5 neighbors', () => {
    const board = new Uint8Array(100 * 100);
    for (let i = 49; i <= 51; i++) {
      board[i] = 1;
      board[100 + i] = 1;
    }
    expect(countAliveNeighbors(board, 50, 0, 100, 100)).toBe(5);
  });

  test('center cell at (50,50) has max 8 neighbors', () => {
    const board = new Uint8Array(100 * 100);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        board[(50 + dy) * 100 + (50 + dx)] = 1;
      }
    }
    expect(countAliveNeighbors(board, 50, 50, 100, 100)).toBe(8);
  });

  test('empty board returns 0 neighbors', () => {
    const board = new Uint8Array(100 * 100);
    expect(countAliveNeighbors(board, 10, 10, 100, 100)).toBe(0);
  });
});

describe('computeNextGeneration', () => {
  test('block (2x2) is stable', () => {
    const width = 4;
    const height = 4;
    const block: [number, number][] = [[1, 1], [1, 2], [2, 1], [2, 2]];
    const initial = makeBoard(block, width, height);
    const next = computeNextGeneration(initial, width, height);
    const nextAlive = aliveCells(next, width);
    expect(nextAlive).toContainEqual([1, 1]);
    expect(nextAlive).toContainEqual([1, 2]);
    expect(nextAlive).toContainEqual([2, 1]);
    expect(nextAlive).toContainEqual([2, 2]);
    expect(nextAlive.length).toBe(4);
  });

  test('blinker oscillates over 2 ticks', () => {
    const width = 5;
    const height = 5;
    const blinkerH: [number, number][] = [[1, 0], [1, 1], [1, 2]];
    const blinkerV: [number, number][] = [[0, 1], [1, 1], [2, 1]];
    const initial = makeBoard(blinkerH, width, height);
    const tick1 = computeNextGeneration(initial, width, height);
    const tick1Alive = aliveCells(tick1, width);
    for (const [x, y] of blinkerV) {
      expect(tick1Alive).toContainEqual([x, y]);
    }
    expect(tick1Alive.length).toBe(3);
    const tick2 = computeNextGeneration(tick1, width, height);
    const tick2Alive = aliveCells(tick2, width);
    for (const [x, y] of blinkerH) {
      expect(tick2Alive).toContainEqual([x, y]);
    }
    expect(tick2Alive.length).toBe(3);
  });

  test('glider translates by (1,1) after 4 ticks', () => {
    const width = 6;
    const height = 6;
    const glider: [number, number][] = [[2, 0], [0, 1], [2, 1], [1, 2], [2, 2]];
    const initial = makeBoard(glider, width, height);
    let board = initial;
    for (let i = 0; i < 4; i++) {
      board = computeNextGeneration(board, width, height);
    }
    const finalAlive = aliveCells(board, width);
    const expected: [number, number][] = [[3, 1], [1, 2], [3, 2], [2, 3], [3, 3]];
    for (const [x, y] of expected) {
      expect(finalAlive).toContainEqual([x, y]);
    }
    expect(finalAlive.length).toBe(5);
  });

  test('underpopulation: live cell with 0 neighbors dies', () => {
    const board = makeBoard([[1, 1]], 3, 3);
    const next = computeNextGeneration(board, 3, 3);
    expect(next[1 * 3 + 1]).toBe(0);
  });

  test('birth: dead cell with 3 neighbors becomes alive', () => {
    const board = new Uint8Array(3 * 3);
    board[0 * 3 + 0] = 1;
    board[0 * 3 + 1] = 1;
    board[0 * 3 + 2] = 1;
    const next = computeNextGeneration(board, 3, 3);
    expect(next[1 * 3 + 1]).toBe(1);
  });
});