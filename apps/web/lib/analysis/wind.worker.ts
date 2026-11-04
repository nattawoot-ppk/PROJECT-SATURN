import { runLbm, type WindOptions } from "@saturn/analyses";

export interface WindJob { mask: Uint8Array; nx: number; ny: number; directions: number[]; options: WindOptions }
self.onmessage = (e: MessageEvent<WindJob>) => {
  const { mask, nx, ny, directions, options } = e.data;
  const results: Float32Array[] = [];
  directions.forEach((d, i) => {
    const r = runLbm(mask, nx, ny, d, options, (p) => self.postMessage({ type: "progress", value: (i + p) / directions.length }));
    results.push(r.speedRatio);
  });
  self.postMessage({ type: "done", results }, { transfer: results.map((r) => r.buffer) });
};
