import { Board } from './board';
import type { GameState, TickResult } from './types';

export function formatTickLog(result: TickResult): string {
  const changedCount = result.changes.length;
  const preview = result.changes
    .slice(0, 5)
    .map((c) => `(${c.x},${c.y}:${c.alive ? '1' : '0'})`)
    .join(' ');
  const suffix = changedCount > 5 ? ` ... +${changedCount - 5} more` : '';
  return `[tick ${result.tick}] ${changedCount} changes | ${preview}${suffix}`;
}

export class Game {
  board: Board;
  interval: number;
  state: GameState;
  private timerId: ReturnType<typeof setTimeout> | null;

  constructor(interval = 1000) {
    this.board = new Board({ width: 100, height: 100, initialFill: 'random' });
    this.interval = interval;
    this.state = 'idle';
    this.timerId = null;
  }

  start(): void {
    if (this.state === 'running') return;
    this.state = 'running';
    this.scheduleTick();
  }

  stop(): void {
    if (this.timerId != null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.state = 'stopped';
  }

  private scheduleTick(): void {
    this.timerId = setTimeout(() => {
      const result = this.board.tick();
      console.log(formatTickLog(result));
      if (this.state === 'running') {
        this.scheduleTick();
      }
    }, this.interval);
  }
}