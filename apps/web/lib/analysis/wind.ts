import { combineDirections, lawsonClass, DEFAULT_WIND, type WindOptions } from "@saturn/analyses";
import { pointInRing, bounds, type Ring } from "@saturn/geometry";
import type { Project } from "@saturn/model";
import { activeOption } from "@/lib/store";

export interface WindResult {
  cols: number; rows: number; minX: number; minY: number; cell: number;
  ratio: Float32Array;        // weighted mean speed ratio (−1 = building)
  perDirection: Float32Array[]; directions: number[];
  speed: Float32Array;        // mean pedestrian speed m/s = ratio × uRef
  comfort: Uint8Array;        // Lawson class
  stats: { ref_ms: number; max_ratio: number; pct_uncomfortable: number; pct_sitting: number; ms: number };
}

export const DIRECTIONS_12 = Array.from({ length: 12 }, (_, i) => i * 30);

/** Rasterise buildings into an obstacle mask and run the LBM worker for all directions. */
export function computeWind(project: Project, rose: number[], uRef: number, onProgress?: (p: number) => void, opts: Partial<WindOptions> = {}): Promise<WindResult> {
  const t0 = performance.now();
  const o = { ...DEFAULT_WIND, ...opts };
  const opt = activeOption(project);
  const rings: Ring[] = [...(opt?.buildings ?? []).map((b) => b.footprint), ...project.site.context_buildings.map((c) => c.footprint)];
  const parcel = project.site.parcel ?? [[-60, -60], [60, -60], [60, 60], [-60, 60]];
  const bb = bounds([parcel]); const margin = 80;
  const minX = bb.minX - margin, minY = bb.minY - margin; const cols = Math.ceil((bb.maxX - bb.minX + 2 * margin) / o.cell_m), rows = Math.ceil((bb.maxY - bb.minY + 2 * margin) / o.cell_m);
  const mask = new Uint8Array(cols * rows);
  const near = rings.filter((r) => { const rb = bounds([r]); return rb.maxX > minX && rb.minX < minX + cols * o.cell_m && rb.maxY > minY && rb.minY < minY + rows * o.cell_m; });
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const x = minX + (i + 0.5) * o.cell_m, y = minY + (j + 0.5) * o.cell_m; if (near.some((r) => pointInRing([x, y], r))) mask[j * cols + i] = 1; }
  const dirs = DIRECTIONS_12.filter((_, i) => (rose[i] ?? 0) > 0.001);
  const freq = dirs.map((d) => rose[DIRECTIONS_12.indexOf(d)]!); const fsum = freq.reduce((a, b) => a + b, 0) || 1;
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./wind.worker.ts", import.meta.url));
    worker.onmessage = (e: MessageEvent<{ type: string; value?: number; results?: Float32Array[] }>) => {
      if (e.data.type === "progress") onProgress?.(e.data.value ?? 0);
      if (e.data.type === "done") {
        worker.terminate();
        const results = e.data.results!; const ratio = combineDirections(results, freq.map((f) => f / fsum));
        const speed = new Float32Array(ratio.length), comfort = new Uint8Array(ratio.length);
        let maxR = 0, unc = 0, sit = 0, n = 0;
        for (let i = 0; i < ratio.length; i++) { if (ratio[i]! < 0) continue; speed[i] = ratio[i]! * uRef; comfort[i] = lawsonClass(speed[i]!); maxR = Math.max(maxR, ratio[i]!); n++; if (comfort[i] === 4) unc++; if (comfort[i] === 0) sit++; }
        resolve({ cols, rows, minX, minY, cell: o.cell_m, ratio, perDirection: results, directions: dirs, speed, comfort, stats: { ref_ms: uRef, max_ratio: maxR, pct_uncomfortable: n ? (100 * unc) / n : 0, pct_sitting: n ? (100 * sit) / n : 0, ms: Math.round(performance.now() - t0) } });
      }
    };
    worker.onerror = (err) => { worker.terminate(); reject(err); };
    worker.postMessage({ mask, nx: cols, ny: rows, directions: dirs, options: o });
  });
}
