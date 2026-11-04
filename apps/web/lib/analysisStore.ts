"use client";
import { create } from "zustand";
import type { SunHoursResult } from "./analysis/sunhours";
import type { DaylightResult } from "./analysis/daylight";
import type { ViewsResult } from "./analysis/views";
import type { NoiseAnalysis } from "./analysis/noise";
import type { WindResult } from "./analysis/wind";

export type Overlay = "none" | "sun" | "daylight" | "views" | "noise" | "wind";
interface AnalysisState {
  date: string;            // YYYY-MM-DD
  hour: number;            // local hour for shadow preview
  showShadows: boolean;
  sun: SunHoursResult | null;
  daylight: DaylightResult | null;
  views: ViewsResult | null;
  noise: NoiseAnalysis | null;
  noiseLimit: string;
  wind: WindResult | null;
  windRose: number[];
  windRef: number;
  windProgress: number;
  stale: boolean;
  running: "sun" | "daylight" | "views" | "noise" | "wind" | null;
  overlay: Overlay;
  set: (p: Partial<AnalysisState>) => void;
}
const today = new Date();
export const useAnalysis = create<AnalysisState>((set) => ({
  date: `${today.getFullYear()}-03-20`, hour: 10, showShadows: true, sun: null, daylight: null, views: null, noise: null, noiseLimit: "WHO", wind: null, windRose: [0.08, 0.06, 0.06, 0.08, 0.1, 0.12, 0.1, 0.08, 0.08, 0.08, 0.08, 0.08], windRef: 5, windProgress: 0, stale: false, running: null, overlay: "none",
  set: (p) => set(p),
}));
