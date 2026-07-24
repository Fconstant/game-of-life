export const NEIGHBOR_OFFSETS: [number, number][] = [
  [-1, -1], [0, -1], [1, -1],
  [-1,  0],          [1,  0],
  [-1,  1], [0,  1], [1,  1],
];

export function countAliveNeighbors(
  board: Uint8Array,
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  let count = 0;
  for (const [dx, dy] of NEIGHBOR_OFFSETS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      count += board[ny * width + nx];
    }
  }
  return count;
}

export function computeNextGeneration(
  board: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const size = width * height;
  const next = new Uint8Array(size);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const alive = board[idx];
      const neighbors = countAliveNeighbors(board, x, y, width, height);
      if (alive) {
        next[idx] = neighbors === 2 || neighbors === 3 ? 1 : 0;
      } else {
        next[idx] = neighbors === 3 ? 1 : 0;
      }
    }
  }
  return next;
}