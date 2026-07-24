import { describe, test, expect } from 'bun:test';
import { Board } from './board';

describe('Board', () => {
  test('constructor with width 100, height 100 produces grid.length === 10000', () => {
    const board = new Board({ width: 100, height: 100 });
    expect(board.grid.length).toBe(10000);
  });

  test('width and height properties are set', () => {
    const board = new Board({ width: 100, height: 100 });
    expect(board.width).toBe(100);
    expect(board.height).toBe(100);
  });

  test('tickCount starts at 0', () => {
    const board = new Board({ width: 100, height: 100 });
    expect(board.tickCount).toBe(0);
  });

  test('initialFill "empty" produces all zeros', () => {
    const board = new Board({ width: 100, height: 100, initialFill: 'empty' });
    const allZero = board.grid.every((v: number) => v === 0);
    expect(allZero).toBe(true);
  });

  test('initialFill "random" produces mix of 0s and 1s', () => {
    const board = new Board({ width: 100, height: 100, initialFill: 'random' });
    const zeros = board.grid.filter((v: number) => v === 0).length;
    const ones = board.grid.filter((v: number) => v === 1).length;
    expect(zeros).toBeGreaterThan(0);
    expect(ones).toBeGreaterThan(0);
    expect(zeros + ones).toBe(10000);
  });

  test('initialFill "random" with seed produces same result twice', () => {
    const a = new Board({ width: 100, height: 100, initialFill: 'random', seed: 42 });
    const b = new Board({ width: 100, height: 100, initialFill: 'random', seed: 42 });
    expect(a.grid).toEqual(b.grid);
  });

  test('default initialFill is empty', () => {
    const board = new Board({ width: 100, height: 100 });
    const allZero = board.grid.every((v: number) => v === 0);
    expect(allZero).toBe(true);
  });
});