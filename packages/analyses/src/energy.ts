/**
 * EPW weather parsing, a synthetic fallback climate, and a simplified hourly thermal model (ISO 13790 5R1C)
 * for free-running comfort (EN 16798-1 adaptive) and heating/cooling demand. Early-stage comparative method.
 */
export interface Hourly { t_out: number[]; ghi: number[]; dni: number[]; dhi: number[]; wind: number[]; source: string }

/** Parse an EPW file (8760 rows). */
export function parseEpw(text: string): Hourly {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  const start = lines.findIndex((l) => /^\d{4},\d{1,2},\d{1,2},\d{1,2},/.test(l));
  if (start < 0) throw new Error("Not an EPW file");
  const t_out: number[] = [], ghi: number[] = [], dni: number[] = [], dhi: number[] = [], wind: number[] = [];
  for (const l of lines.slice(start)) { const c = l.split(","); if (c.length < 22) continue; t_out.push(+c[6]!); ghi.push(+c[13]!); dni.push(+c[14]!); dhi.push(+c[15]!); wind.push(+c[21]!); }
  if (t_out.length < 8760) throw new Error(`EPW has ${t_out.length} rows`);
  const loc = lines[0]?.split(",")[1] ?? "EPW";
  return { t_out: t_out.slice(0, 8760), ghi: ghi.slice(0, 8760), dni: dni.slice(0, 8760), dhi: dhi.slice(0, 8760), wind: wind.slice(0, 8760), source: loc };
}

/** Rough synthetic climate from latitude: annual mean/amplitude and diurnal swing; clear-sky-ish solar. Labelled approximate. */
export function syntheticClimate(lat: number): Hourly {
  const absLat = Math.abs(lat); const mean = 27 - 0.45 * absLat; const amp = absLat < 15 ? 1.5 : 3 + 0.35 * (absLat - 15); const diurnal = 4 + 0.08 * absLat;
  const t_out: number[] = [], ghi: number[] = [], dni: number[] = [], dhi: number[] = [], wind: number[] = [];
  for (let h = 0; h < 8760; h++) {
    const day = Math.floor(h / 24), hr = h % 24; const season = Math.cos((2 * Math.PI * (day - (lat >= 0 ? 200 : 20))) / 365);
    t_out.push(mean + amp * season - diurnal * Math.cos((2 * Math.PI * (hr - 15)) / 24));
    const decl = 23.44 * Math.sin((2 * Math.PI * (day - 81)) / 365); const ha = (hr - 12) * 15; const rad = Math.PI / 180;
    const sinAlt = Math.sin(lat * rad) * Math.sin(decl * rad) + Math.cos(lat * rad) * Math.cos(decl * rad) * Math.cos(ha * rad);
    const g = Math.max(0, 950 * sinAlt); ghi.push(g); dni.push(g * 0.75); dhi.push(g * 0.3); wind.push(3);
  }
  return { t_out, ghi, dni, dhi, wind, source: `Synthetic climate for latitude ${lat.toFixed(1)}° (approximate)` };
}

export interface ThermalInputs {
  floor_m2: number; height_m: number; facade_m2: number; roof_m2: number; glazing_ratio: number;
  u_wall: number; u_roof: number; u_window: number; g_value: number; ach_infiltration: number; ach_vent_free: number;
  internal_gains_w_m2: number; thermal_mass_kj_m2k: number; heat_set: number; cool_set: number;
}
export const DEFAULT_THERMAL: ThermalInputs = { floor_m2: 1000, height_m: 3.2, facade_m2: 800, roof_m2: 200, glazing_ratio: 0.3, u_wall: 0.4, u_roof: 0.2, u_window: 1.6, g_value: 0.45, ach_infiltration: 0.3, ach_vent_free: 3, internal_gains_w_m2: 5, thermal_mass_kj_m2k: 165, heat_set: 20, cool_set: 26 };

export interface ThermalResult { free_t: number[]; comfort_pct: number; overheating_h: number; underheating_h: number; heating_kwh_m2: number; cooling_kwh_m2: number; peak_heat_w_m2: number; peak_cool_w_m2: number }

/** Running mean outdoor temperature (EN 16798-1, α = 0.8). */
function runningMean(t: number[]): number[] { const out = new Array<number>(t.length); let rm = t.slice(0, 24).reduce((a, b) => a + b, 0) / 24; let dayMean = rm; for (let h = 0; h < t.length; h++) { if (h % 24 === 0 && h > 0) { dayMean = t.slice(h - 24, h).reduce((a, b) => a + b, 0) / 24; rm = 0.2 * dayMean + 0.8 * rm; } out[h] = rm; } return out; }

/** Adaptive comfort band (Cat II: ±3 K) around 0.33·Trm + 18.8, valid for Trm 10–30 °C. */
export function comfortBand(trm: number): [number, number] { const t = Math.max(10, Math.min(30, trm)); const c = 0.33 * t + 18.8; return [c - 3, c + 3]; }

/** Simplified hourly 5R1C run. Free-running (natural ventilation when warm) and conditioned modes in one pass. */
export function simulateThermal(w: Hourly, inp: ThermalInputs): ThermalResult {
  const Af = inp.floor_m2; const V = Af * inp.height_m; const Aw = inp.facade_m2 * inp.glazing_ratio, Aop = inp.facade_m2 - Aw;
  const Htr_op = Aop * inp.u_wall + inp.roof_m2 * inp.u_roof; const Htr_w = Aw * inp.u_window;
  const Cm = inp.thermal_mass_kj_m2k * 1000 * Af; // J/K
  const Am = 2.5 * Af; const Htr_ms = 9.1 * Am; const Htr_is = 3.45 * Af * 4.5;
  const Htr_em = 1 / (1 / Htr_op - 1 / Htr_ms);
  const trm = runningMean(w.t_out);
  const free_t = new Array<number>(8760); let Tm_f = 22, Tm_c = 22;
  let comfortH = 0, over = 0, under = 0, heat = 0, cool = 0, pkH = 0, pkC = 0, occ = 0;
  for (let h = 0; h < 8760; h++) {
    const To = w.t_out[h]!; const sol = (w.ghi[h]! * 0.5 + w.dhi[h]! * 0.5) * Aw * inp.g_value * 0.9 * 0.7; // rough: half of GHI on façades, frame & shading factor
    const gains = inp.internal_gains_w_m2 * Af + sol; const phi_ia = 0.5 * gains, phi_m = (Am / (9.1 * Af * 4.5 + 0)) * 0.5 * gains || 0.3 * gains, phi_st = gains - phi_ia - phi_m;
    const step = (Tm: number, ach: number, Tset: [number, number] | null) => {
      const Hve = 0.34 * ach * V; const Htr_1 = 1 / (1 / Hve + 1 / Htr_is); const Htr_2 = Htr_1 + Htr_w; const Htr_3 = 1 / (1 / Htr_2 + 1 / Htr_ms);
      const solve = (phiHC: number) => {
        const phi_mtot = phi_m + Htr_em * To + (Htr_3 * (phi_st + Htr_w * To + Htr_1 * ((phi_ia + phiHC) / Hve + To))) / Htr_2;
        const Tm_next = (Tm * (Cm / 3600 - 0.5 * (Htr_3 + Htr_em)) + phi_mtot) / (Cm / 3600 + 0.5 * (Htr_3 + Htr_em));
        const Tm_avg = (Tm + Tm_next) / 2; const Ts = (Htr_ms * Tm_avg + phi_st + Htr_w * To + Htr_1 * (To + (phi_ia + phiHC) / Hve)) / (Htr_ms + Htr_w + Htr_1);
        const Tair = (Htr_is * Ts + Hve * To + phi_ia + phiHC) / (Htr_is + Hve);
        return { Tm_next, Tair };
      };
      const a = solve(0);
      if (!Tset) return { ...a, phi: 0 };
      if (a.Tair >= Tset[0] && a.Tair <= Tset[1]) return { ...a, phi: 0 };
      const target = a.Tair < Tset[0] ? Tset[0] : Tset[1]; const b = solve(10 * Af); const k = (b.Tair - a.Tair) / (10 * Af); const phi = (target - a.Tair) / k; const c = solve(phi);
      return { ...c, phi };
    };
    // free running: natural ventilation when warm inside and cooler outside
    const [lo, hi] = comfortBand(trm[h]!);
    const warm = Tm_f > hi - 1 && To < Tm_f; const r = step(Tm_f, inp.ach_infiltration + (warm ? inp.ach_vent_free : 0), null); Tm_f = r.Tm_next; free_t[h] = r.Tair;
    const hr = h % 24; if (hr >= 7 && hr <= 22) { occ++; if (r.Tair >= lo && r.Tair <= hi) comfortH++; else if (r.Tair > hi) over++; else under++; }
    const c = step(Tm_c, inp.ach_infiltration + 0.5, [inp.heat_set, inp.cool_set]); Tm_c = c.Tm_next;
    if (c.phi > 0) { heat += c.phi; pkH = Math.max(pkH, c.phi); } else { cool -= c.phi; pkC = Math.max(pkC, -c.phi); }
  }
  return { free_t, comfort_pct: occ ? (100 * comfortH) / occ : 0, overheating_h: over, underheating_h: under, heating_kwh_m2: heat / 1000 / Af, cooling_kwh_m2: cool / 1000 / Af, peak_heat_w_m2: pkH / Af, peak_cool_w_m2: pkC / Af };
}
