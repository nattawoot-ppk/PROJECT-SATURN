/** Heightmap helpers: Terrarium RGB decoding, slippy-tile maths, bilinear sampling. */
export interface HeightGrid { grid: number[]; cols: number; rows: number; cell_m: number; minX: number; minY: number }

/** Terrarium encoding (AWS Terrain Tiles / Mapzen): h = R*256 + G + B/256 − 32768. */
export function decodeTerrarium(r: number, g: number, b: number): number { return r * 256 + g + b / 256 - 32768; }

export function lonLatToTile(lon: number, lat: number, z: number): { x: number; y: number; px: number; py: number } {
  const n = Math.pow(2, z); const xf = ((lon + 180) / 360) * n;
  const latR = (lat * Math.PI) / 180; const yf = ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n;
  return { x: Math.floor(xf), y: Math.floor(yf), px: xf - Math.floor(xf), py: yf - Math.floor(yf) };
}

/** Ground resolution (m/px) of a 256 px tile at latitude. */
export function metresPerPixel(lat: number, z: number): number { return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, z); }

/** Bilinear sample of a height grid at local (x, y); clamps to the grid edge. */
export function sampleHeight(h: HeightGrid, x: number, y: number): number {
  const fx = (x - h.minX) / h.cell_m, fy = (y - h.minY) / h.cell_m;
  const i = Math.max(0, Math.min(h.cols - 2, Math.floor(fx))), j = Math.max(0, Math.min(h.rows - 2, Math.floor(fy)));
  const tx = Math.max(0, Math.min(1, fx - i)), ty = Math.max(0, Math.min(1, fy - j));
  const at = (ii: number, jj: number) => h.grid[jj * h.cols + ii] ?? 0;
  return (1 - tx) * (1 - ty) * at(i, j) + tx * (1 - ty) * at(i + 1, j) + (1 - tx) * ty * at(i, j + 1) + tx * ty * at(i + 1, j + 1);
}

/** Slope statistics over a polygon's bounding box, in percent. */
export function slopeStats(h: HeightGrid): { max_pct: number; mean_pct: number } {
  let max = 0, sum = 0, n = 0;
  for (let j = 0; j < h.rows - 1; j++) for (let i = 0; i < h.cols - 1; i++) {
    const a = h.grid[j * h.cols + i]!, b = h.grid[j * h.cols + i + 1]!, c = h.grid[(j + 1) * h.cols + i]!;
    const s = Math.hypot(b - a, c - a) / h.cell_m * 100; max = Math.max(max, s); sum += s; n++;
  }
  return { max_pct: max, mean_pct: n ? sum / n : 0 };
}
