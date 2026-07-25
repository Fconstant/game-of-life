import { describe, test, expect } from 'bun:test';
import { Game, formatTickLog } from './game';

describe('formatTickLog', () => {
  test('0 changes produces no preview and no suffix', () => {
    const log = formatTickLog({
      tick: 1,
      timestamp: 1700000000000,
      changes: [],
    });
    expect(log).toBe('[tick 1] 0 changes | ');
  });

  test('3 changes shows all without suffix', () => {
    const log = formatTickLog({
      tick: 3,
      timestamp: 1700000000000,
      changes: [
        { x: 10, y: 20, alive: false },
        { x: 11, y: 21, alive: true },
        { x: 12, y: 22, alive: false },
      ],
    });
    expect(log).toBe(
      '[tick 3] 3 changes | (10,20:0) (11,21:1) (12,22:0)',
    );
  });

  test('more than 5 changes shows suffix', () => {
    const changes = Array.from({ length: 10 }, (_, i) => ({
      x: i,
      y: i,
      alive: i % 2 === 0,
    }));
    const log = formatTickLog({
      tick: 5,
      timestamp: 1700000000000,
      changes,
    });
    expect(log).toContain('... +5 more');
    expect(log).toContain('[tick 5] 10 changes |');
  });

  test('exactly 5 changes shows no suffix', () => {
    const changes = Array.from({ length: 5 }, (_, i) => ({
      x: i,
      y: i,
      alive: true,
    }));
    const log = formatTickLog({
      tick: 2,
      timestamp: 1700000000000,
      changes,
    });
    expect(log).not.toContain('... ');
  });
});

describe('Game', () => {
  test('start() transitions state to running', () => {
    const game = new Game(100_000);
    game.start();
    expect(game.state).toBe('running');
  });

  test('stop() transitions state to stopped', () => {
    const game = new Game(100_000);
    game.start();
    game.stop();
    expect(game.state).toBe('stopped');
  });

  test('double start() is idempotent', () => {
    const game = new Game(100_000);
    game.start();
    game.start();
    expect(game.state).toBe('running');
  });

  test('constructor creates Board with 100x100 random fill', () => {
    const game = new Game(100_000);
    expect(game.board.width).toBe(100);
    expect(game.board.height).toBe(100);
    expect(game.board.grid.length).toBe(10000);
    const zeros = game.board.grid.filter((v) => v === 0).length;
    const ones = game.board.grid.filter((v) => v === 1).length;
    expect(zeros).toBeGreaterThan(0);
    expect(ones).toBeGreaterThan(0);
  });

  test('tick fires and increments tickCount', async () => {
    const game = new Game(10);
    game.start();
    await Bun.sleep(100);
    game.stop();
    expect(game.board.tickCount).toBeGreaterThan(0);
  });

  test('stop prevents further ticks', async () => {
    const game = new Game(10);
    game.start();
    await Bun.sleep(50);
    game.stop();
    const frozen = game.board.tickCount;
    await Bun.sleep(100);
    expect(game.board.tickCount).toBe(frozen);
    expect(game.state).toBe('stopped');
  });
});