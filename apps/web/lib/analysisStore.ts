"use client";
import { create } from "zustand";
import type { SunHoursResult } from "./analysis/sunhours";
import type { DaylightResult } from "./analysis/daylight";

export type Overlay = "none" | "sun" | "daylight";
interface AnalysisState {
  date: string;            // YYYY-MM-DD
  hour: number;            // local hour for shadow preview
  showShadows: boolean;
  sun: SunHoursResult | null;
  daylight: DaylightResult | null;
  stale: boolean;
  running: "sun" | "daylight" | null;
  overlay: Overlay;
  set: (p: Partial<AnalysisState>) => void;
}
const today = new Date();
export const useAnalysis = create<AnalysisState>((set) => ({
  date: `${today.getFullYear()}-03-20`, hour: 10, showShadows: true, sun: null, daylight: null, stale: false, running: null, overlay: "none",
  set: (p) => set(p),
}));
