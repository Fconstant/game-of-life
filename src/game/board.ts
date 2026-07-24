import type { BoardConfig } from './types';

export class Board {
  grid: Uint8Array;
  width: number;
  height: number;
  tickCount: number;

  constructor(config: BoardConfig) {
    this.width = config.width;
    this.height = config.height;
    this.tickCount = 0;
    const size = this.width * this.height;
    this.grid = new Uint8Array(size);

    if (config.initialFill === 'random') {
      if (config.seed !== undefined) {
        let s = config.seed;
        for (let i = 0; i < size; i++) {
          s = (s * 1103515245 + 12345) & 0x7fffffff;
          this.grid[i] = s > 0x3fffffff ? 1 : 0;
        }
      } else {
        for (let i = 0; i < size; i++) {
          this.grid[i] = Math.random() < 0.5 ? 1 : 0;
        }
      }
    }
  }
}