/**
 * Road traffic noise, early-stage comparative method.
 * Emission: RLS-90 mean level Lm,E at 25 m from hourly flow M, heavy share p and speeds.
 * Propagation: line-source divergence from the 25 m reference, air absorption, Maekawa screening by buildings,
 * +3 dB façade reflection at façade receivers. Period levels combined into Lden and Lnight.
 * Not a certified CNOSSOS-EU implementation; intended for comparing options.
 */
export interface RoadSource { id: string; pts: Array<[number, number]>; aadt: number; heavy_pct: number; speed_kmh: number }
export interface Receiver { p: [number, number, number]; n?: [number, number, number]; facade: boolean; owner?: string; storey?: number }
export interface Blocker { ring: Array<[number, number]>; height: number }
export interface NoiseOptions { period_share?: { day: number; evening: number; night: number }; heavy_night_factor?: number; seg_m?: number; reflection_db?: number }
export interface NoiseResult { lden: Float32Array; lnight: Float32Array; lday: Float32Array }

const log10 = Math.log10;

/** RLS-90 emission level Lm,E (dB(A)) at 25 m for hourly flow M (veh/h), heavy share p (%), speeds (km/h). */
export function rls90Emission(M: number, p: number, vCar: number, vHgv: number): number {
  if (M <= 0) return -Infinity;
  const base = 37.3 + 10 * log10(M * (1 + 0.082 * p));
  const vC = Math.max(30, Math.min(130, vCar)), vH = Math.max(30, Math.min(80, vHgv));
  const Lpkw = 27.7 + 10 * log10(1 + Math.pow(0.02 * vC, 3));
  const Llkw = 23.1 + 12.5 * log10(vH);
  const D = Llkw - Lpkw;
  const Dv = Lpkw - 37.3 + 10 * log10((100 + (Math.pow(10, 0.1 * D) - 1) * p) / (100 + 8.23 * p));
  return base + Dv;
}

/** Maekawa barrier attenuation (dB) for path difference delta (m) at ~500 Hz. */
export function maekawa(delta: number): number {
  if (delta <= 0) return 0;
  const N = (2 * delta) / 0.68;
  return Math.min(20, 10 * log10(3 + 20 * N));
}

function segIntersect(a: [number, number], b: [number, number], c: [number, number], d: [number, number]): number | null {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0]! * s[1]! - r[1]! * s[0]!; if (Math.abs(den) < 1e-12) return null;
  const t = ((c[0] - a[0]) * s[1]! - (c[1] - a[1]) * s[0]!) / den; const u = ((c[0] - a[0]) * r[1]! - (c[1] - a[1]) * r[0]!) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

/** Screening for one source→receiver path: returns the Maekawa attenuation from the tallest blocking building. */
export function screening(src: [number, number, number], rec: [number, number, number], blockers: Blocker[]): number {
  const a: [number, number] = [src[0], src[1]], b: [number, number] = [rec[0], rec[1]];
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d < 0.5) return 0;
  let best = 0;
  for (const bl of blockers) {
    const ts: number[] = [];
    for (let i = 0; i < bl.ring.length; i++) { const t = segIntersect(a, b, bl.ring[i]!, bl.ring[(i + 1) % bl.ring.length]!); if (t !== null) ts.push(t); }
    if (ts.length < 1) continue;
    const t0 = Math.min(...ts), t1 = Math.max(...ts);
    const d1 = t0 * d, d2 = (1 - t1) * d; const H = bl.height;
    // line of sight height at the barrier: if the barrier is lower than the sight line it does not screen
    const hAt0 = src[2] + (rec[2] - src[2]) * t0, hAt1 = src[2] + (rec[2] - src[2]) * t1;
    if (H <= Math.max(hAt0, hAt1)) continue;
    const delta = Math.hypot(d1, H - src[2]) + (t1 - t0) * d + Math.hypot(d2, H - rec[2]) - Math.hypot(d, rec[2] - src[2]);
    best = Math.max(best, maekawa(delta));
  }
  return best;
}

function sumDb(levels: number[]): number { let s = 0; for (const l of levels) if (isFinite(l)) s += Math.pow(10, l / 10); return s > 0 ? 10 * log10(s) : -Infinity; }

/** Level at a receiver from one road for a given hourly flow. */
function roadLevel(road: RoadSource, M: number, pHeavy: number, rec: Receiver, blockers: Blocker[], segM: number): number {
  if (M <= 0) return -Infinity;
  const Le = rls90Emission(M, pHeavy, road.speed_kmh, Math.min(road.speed_kmh, 80));
  const parts: number[] = [];
  for (let i = 1; i < road.pts.length; i++) {
    const a = road.pts[i - 1]!, b = road.pts[i]!; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.1) continue;
    const n = Math.max(1, Math.ceil(L / segM));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n; const sp: [number, number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0.5];
      const dx = rec.p[0] - sp[0], dy = rec.p[1] - sp[1], dz = rec.p[2] - sp[2]; const d = Math.max(1, Math.hypot(dx, dy, dz));
      if (rec.n) { const dot = (dx * rec.n[0] + dy * rec.n[1]) / Math.max(1e-6, Math.hypot(dx, dy)); if (dot < -0.15) continue; } // sound from behind the façade is screened by the building itself
      // contribution of a segment of length L/n from a line with level Le at 25 m: Le defined for infinite line → point-like share
      const segLen = L / n;
      const lp = Le + 10 * log10(segLen / (2 * d)) - 10 * log10(d / 25) - 0.005 * Math.max(0, d - 25) - screening(sp, rec.p, blockers);
      parts.push(lp);
    }
  }
  return sumDb(parts);
}

/** Lden / Lnight / Lday at every receiver. */
export function computeNoise(roads: RoadSource[], receivers: Receiver[], blockers: Blocker[], opts: NoiseOptions = {}): NoiseResult {
  const share = opts.period_share ?? { day: 0.06, evening: 0.04, night: 0.011 }; // hourly share of AADT per period
  const segM = opts.seg_m ?? 10; const refl = opts.reflection_db ?? 3;
  const lden = new Float32Array(receivers.length), lnight = new Float32Array(receivers.length), lday = new Float32Array(receivers.length);
  receivers.forEach((rec, i) => {
    const ld: number[] = [], le: number[] = [], ln: number[] = [];
    for (const r of roads) {
      ld.push(roadLevel(r, r.aadt * share.day, r.heavy_pct, rec, blockers, segM));
      le.push(roadLevel(r, r.aadt * share.evening, r.heavy_pct, rec, blockers, segM));
      ln.push(roadLevel(r, r.aadt * share.night, r.heavy_pct * (opts.heavy_night_factor ?? 1.5), rec, blockers, segM));
    }
    const add = rec.facade ? refl : 0;
    const Ld = sumDb(ld) + add, Le = sumDb(le) + add, Ln = sumDb(ln) + add;
    lday[i] = isFinite(Ld) ? Ld : 0; lnight[i] = isFinite(Ln) ? Ln : 0;
    const v = (12 * Math.pow(10, Ld / 10) + 4 * Math.pow(10, (Le + 5) / 10) + 8 * Math.pow(10, (Ln + 10) / 10)) / 24;
    lden[i] = v > 0 && isFinite(v) ? 10 * log10(v) : 0;
  });
  return { lden, lnight, lday };
}

/** Guideline thresholds (dB) by jurisdiction family; WHO elsewhere. */
export const NOISE_LIMITS: Record<string, { lden_quiet: number; lnight_bedroom: number; lden_facade_max: number; label: string }> = {
  NO: { lden_quiet: 55, lnight_bedroom: 45, lden_facade_max: 65, label: "Norway T-1442 (yellow zone 55 Lden)" },
  SE: { lden_quiet: 55, lnight_bedroom: 45, lden_facade_max: 60, label: "Sweden SFS 2015:216" },
  DK: { lden_quiet: 58, lnight_bedroom: 45, lden_facade_max: 68, label: "Denmark Miljøstyrelsen" },
  WHO: { lden_quiet: 53, lnight_bedroom: 45, lden_facade_max: 65, label: "WHO 2018 road traffic" },
};
