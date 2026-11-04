"use client";
import { useEffect } from "react";
import { Sun, CloudSun, Eye, Volume2, Wind } from "lucide-react";
import { useEditor } from "@/lib/store";
import { useAnalysis } from "@/lib/analysisStore";
import { computeSunHours } from "@/lib/analysis/sunhours";
import { computeDaylight } from "@/lib/analysis/daylight";
import { computeViews } from "@/lib/analysis/views";
import { computeTrafficNoise } from "@/lib/analysis/noise";
import { computeWind } from "@/lib/analysis/wind";
import { LAWSON } from "@saturn/analyses";
import { KEY_DATES, NOISE_LIMITS } from "@saturn/analyses";
import { Btn, Chip } from "@/components/ui";

const Legend = ({ lo, hi }: { lo: string; hi: string }) => (
  <span className="flex shrink-0 items-center gap-1 text-[10.5px] text-ink-3">{lo}<span className="inline-block h-1.5 w-20 rounded" style={{ background: "linear-gradient(90deg,#1f3373,#19a3bf,#f2d933,#e6331a)" }} />{hi}</span>
);

export default function AnalysisBar() {
  const project = useEditor((s) => s.project);
  const a = useAnalysis();
  const year = new Date().getFullYear();
  const updatedAt = project?.updated_at; const optionId = project?.active_option_id;
  useEffect(() => { const st = useAnalysis.getState(); if (st.sun || st.daylight || st.views || st.noise || st.wind) st.set({ stale: true }); }, [updatedAt]);
  useEffect(() => { useAnalysis.getState().set({ sun: null, daylight: null, views: null, noise: null, wind: null, overlay: "none", stale: false }); }, [optionId]);
  const run = (kind: "sun" | "daylight" | "views" | "noise") => {
    if (!project) return; a.set({ running: kind });
    setTimeout(() => {
      try {
        if (kind === "sun") a.set({ sun: computeSunHours(project, a.date), overlay: "sun" });
        if (kind === "daylight") a.set({ daylight: computeDaylight(project), overlay: "daylight" });
        if (kind === "views") a.set({ views: computeViews(project), overlay: "views" });
        if (kind === "noise") a.set({ noise: computeTrafficNoise(project, a.noiseLimit), overlay: "noise" });
        a.set({ stale: false, running: null });
      } catch (e) { console.error(e); a.set({ running: null }); }
    }, 20);
  };
  const runWind = () => {
    if (!project) return; a.set({ running: "wind", windProgress: 0 });
    computeWind(project, a.windRose, a.windRef, (p) => a.set({ windProgress: p })).then((w) => a.set({ wind: w, overlay: "wind", stale: false, running: null })).catch((e) => { console.error(e); a.set({ running: null }); });
  };
  const hh = `${String(Math.floor(a.hour)).padStart(2, "0")}:${String(Math.round((a.hour % 1) * 60)).padStart(2, "0")}`;
  const sel = "pill border border-line bg-black/40 px-2.5 py-1 text-[11.5px] text-ink focus:outline-none";
  return (
    <div className="glass absolute left-3 right-3 top-3 flex h-10 items-center gap-2 overflow-x-auto whitespace-nowrap rounded-full px-3 text-[11.5px]">
      <select className={sel} value={a.date} onChange={(e) => a.set({ date: e.target.value, stale: !!a.sun })}>
        {Object.entries(KEY_DATES(year)).map(([k, v]) => <option key={v} value={v}>{k}</option>)}
        {!Object.values(KEY_DATES(year)).includes(a.date) && <option value={a.date}>{a.date}</option>}
      </select>
      <input type="date" className={sel} value={a.date} onChange={(e) => e.target.value && a.set({ date: e.target.value, stale: !!a.sun })} />
      <label className="flex shrink-0 items-center gap-1 text-ink-2"><input type="checkbox" checked={a.showShadows} onChange={(e) => a.set({ showShadows: e.target.checked })} /> Shadows</label>
      <input type="range" min={5} max={20} step={0.25} value={a.hour} className="w-24 shrink-0" onChange={(e) => a.set({ hour: Number(e.target.value) })} />
      <span className="mono w-10 shrink-0 text-ink-2">{hh}</span>
      <span className="mx-1 h-5 w-px shrink-0 bg-line-2" />
      <Btn size="sm" variant={a.overlay === "sun" ? "primary" : "ghost"} disabled={!!a.running} onClick={() => run("sun")}><Sun size={12} /> {a.running === "sun" ? "Computing…" : "Sun hours"}</Btn>
      <Btn size="sm" variant={a.overlay === "daylight" ? "primary" : "ghost"} disabled={!!a.running} onClick={() => run("daylight")}><CloudSun size={12} /> {a.running === "daylight" ? "Computing…" : "Daylight VSC"}</Btn>
      <Btn size="sm" variant={a.overlay === "views" ? "primary" : "ghost"} disabled={!!a.running} onClick={() => run("views")}><Eye size={12} /> {a.running === "views" ? "Computing…" : "Views"}</Btn>
      <Btn size="sm" variant={a.overlay === "wind" ? "primary" : "ghost"} disabled={!!a.running} onClick={runWind}><Wind size={12} /> {a.running === "wind" ? `Wind ${Math.round(a.windProgress * 100)} %` : "Wind"}</Btn>
      <Btn size="sm" variant={a.overlay === "noise" ? "primary" : "ghost"} disabled={!!a.running} onClick={() => run("noise")}><Volume2 size={12} /> {a.running === "noise" ? "Computing…" : "Noise"}</Btn>
      <select className={sel} value={a.noiseLimit} onChange={(e) => a.set({ noiseLimit: e.target.value, stale: !!a.noise })} title="Guideline set for verdicts">{Object.entries(NOISE_LIMITS).map(([k, v]) => <option key={k} value={k}>{k} · {v.label}</option>)}</select>
      {(a.sun || a.daylight || a.views || a.noise || a.wind) && (
        <select className={sel} value={a.overlay} onChange={(e) => a.set({ overlay: e.target.value as typeof a.overlay })}>
          <option value="none">No overlay</option>
          {a.sun && <option value="sun">Sun hours</option>}
          {a.daylight && <option value="daylight">Daylight VSC</option>}
          {a.views && <option value="views">View openness</option>}
          {a.noise && <option value="noise">Traffic noise Lden</option>}
          {a.wind && <option value="wind">Wind comfort</option>}
        </select>
      )}
      {a.stale && (a.sun || a.daylight || a.views || a.noise || a.wind) && <Chip tone="amber">Stale</Chip>}
      {a.overlay === "sun" && a.sun && <><span className="shrink-0 text-ink-2">Ground avg {a.sun.stats.ground_avg_h.toFixed(1)} h · min {a.sun.stats.ground_min_h.toFixed(1)} h · façade avg {a.sun.stats.facade_avg_h.toFixed(1)} / {a.sun.total_possible_h.toFixed(1)} h · {a.sun.stats.ms} ms</span><Legend lo="0 h" hi={`${a.sun.total_possible_h.toFixed(0)} h`} /></>}
      {a.overlay === "daylight" && a.daylight && <><span className="shrink-0 text-ink-2">Façade VSC avg {a.daylight.stats.facade_avg.toFixed(1)} % · min {a.daylight.stats.facade_min.toFixed(1)} % · {a.daylight.stats.pct_below_27.toFixed(0)} % below 27 % · neighbours {a.daylight.stats.context_avg.toFixed(1)} % · {a.daylight.stats.ms} ms</span><Legend lo="0 %" hi="40 %" /></>}
      {a.overlay === "views" && a.views && <><span className="shrink-0 text-ink-2">Openness avg {a.views.stats.avg.toFixed(0)} % · min {a.views.stats.min.toFixed(0)} % · {a.views.stats.pct_poor.toFixed(0)} % of façade below 40 % · {a.views.stats.ms} ms</span><Legend lo="0 %" hi="100 %" /></>}
      {a.overlay === "noise" && a.noise && <><span className="shrink-0 text-ink-2">{a.noise.stats.roads} roads · façade Lden avg {a.noise.stats.facade_avg.toFixed(0)} · max {a.noise.stats.facade_max.toFixed(0)} dB · {a.noise.stats.pct_over_limit.toFixed(0)} % over limit · bedrooms OK {a.noise.stats.pct_bedroom_ok.toFixed(0)} % · quiet side {a.noise.stats.buildings_with_quiet_side}/{a.noise.stats.buildings} · {a.noise.stats.ms} ms</span><Legend lo="45 dB" hi="75 dB" /></>}
      {a.overlay === "wind" && a.wind && <><span className="shrink-0 text-ink-2">{a.wind.directions.length} directions · ref {a.wind.stats.ref_ms} m/s · max speed-up ×{a.wind.stats.max_ratio.toFixed(2)} · sitting-comfort {a.wind.stats.pct_sitting.toFixed(0)} % · uncomfortable {a.wind.stats.pct_uncomfortable.toFixed(0)} % · {(a.wind.stats.ms / 1000).toFixed(1)} s</span><span className="flex shrink-0 items-center gap-1 text-[10.5px] text-ink-3">{LAWSON.map((c) => <span key={c.label} className="flex items-center gap-0.5"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: c.color }} />{c.label}</span>)}</span></>}
      <span className="ml-auto shrink-0 text-[10px] text-ink-3" title="Comparative early-stage study, not a certified assessment. Flat terrain, direct sun only, CIE overcast sky for VSC.">Comparative, not certified</span>
    </div>
  );
}
