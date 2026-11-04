"use client";
import { useEffect } from "react";
import { useEditor } from "@/lib/store";
import { useAnalysis } from "@/lib/analysisStore";
import { computeSunHours } from "@/lib/analysis/sunhours";
import { computeDaylight } from "@/lib/analysis/daylight";
import { KEY_DATES } from "@saturn/analyses";

const Legend = ({ lo, hi }: { lo: string; hi: string }) => (
  <span className="flex shrink-0 items-center gap-1 text-slate-400">{lo}<span className="inline-block h-2 w-20 rounded" style={{ background: "linear-gradient(90deg,#1f3373,#1a99bf,#f2d933,#e6331a)" }} />{hi}</span>
);

export default function AnalysisBar() {
  const project = useEditor((s) => s.project);
  const a = useAnalysis();
  const year = new Date().getFullYear();
  const updatedAt = project?.updated_at;
  useEffect(() => { const st = useAnalysis.getState(); if (st.sun || st.daylight) st.set({ stale: true }); }, [updatedAt]);
  const runSun = () => { if (!project) return; a.set({ running: "sun" }); setTimeout(() => { try { a.set({ sun: computeSunHours(project, a.date), stale: false, overlay: "sun", running: null }); } catch (e) { console.error(e); a.set({ running: null }); } }, 20); };
  const runDaylight = () => { if (!project) return; a.set({ running: "daylight" }); setTimeout(() => { try { a.set({ daylight: computeDaylight(project), stale: false, overlay: "daylight", running: null }); } catch (e) { console.error(e); a.set({ running: null }); } }, 20); };
  const hh = `${String(Math.floor(a.hour)).padStart(2, "0")}:${String(Math.round((a.hour % 1) * 60)).padStart(2, "0")}`;
  return (
    <div className="flex h-11 items-center gap-2 overflow-x-auto whitespace-nowrap border-t border-slate-800 bg-slate-950 px-3 text-xs">
      <select className="shrink-0 rounded bg-slate-800 px-2 py-1" value={a.date} onChange={(e) => a.set({ date: e.target.value, stale: !!a.sun })}>
        {Object.entries(KEY_DATES(year)).map(([k, v]) => <option key={v} value={v}>{k}</option>)}
        {!Object.values(KEY_DATES(year)).includes(a.date) && <option value={a.date}>{a.date}</option>}
      </select>
      <input type="date" className="shrink-0 rounded bg-slate-800 px-2 py-1" value={a.date} onChange={(e) => e.target.value && a.set({ date: e.target.value, stale: !!a.sun })} />
      <label className="flex shrink-0 items-center gap-1"><input type="checkbox" checked={a.showShadows} onChange={(e) => a.set({ showShadows: e.target.checked })} /> Shadows</label>
      <input type="range" min={5} max={20} step={0.25} value={a.hour} className="w-28 shrink-0" onChange={(e) => a.set({ hour: Number(e.target.value) })} />
      <span className="w-10 shrink-0 font-mono">{hh}</span>
      <span className="mx-1 h-6 w-px shrink-0 bg-slate-800" />
      <button disabled={!!a.running} className="shrink-0 rounded bg-amber-600 px-2 py-1 font-medium hover:bg-amber-500 disabled:opacity-50" onClick={runSun}>{a.running === "sun" ? "Computing…" : "Sun hours"}</button>
      <button disabled={!!a.running} className="shrink-0 rounded bg-sky-700 px-2 py-1 font-medium hover:bg-sky-600 disabled:opacity-50" onClick={runDaylight}>{a.running === "daylight" ? "Computing…" : "Daylight (VSC)"}</button>
      {(a.sun || a.daylight) && (
        <select className="shrink-0 rounded bg-slate-800 px-2 py-1" value={a.overlay} onChange={(e) => a.set({ overlay: e.target.value as typeof a.overlay })}>
          <option value="none">No overlay</option>
          {a.sun && <option value="sun">Sun hours</option>}
          {a.daylight && <option value="daylight">Daylight VSC</option>}
        </select>
      )}
      {a.stale && (a.sun || a.daylight) && <span className="shrink-0 text-amber-300">Stale: model changed</span>}
      {a.overlay === "sun" && a.sun && <><span className="shrink-0 text-slate-400">Ground avg {a.sun.stats.ground_avg_h.toFixed(1)} h · min {a.sun.stats.ground_min_h.toFixed(1)} h · façade avg {a.sun.stats.facade_avg_h.toFixed(1)} h of {a.sun.total_possible_h.toFixed(1)} h · {a.sun.stats.ms} ms</span><Legend lo="0 h" hi={`${a.sun.total_possible_h.toFixed(0)} h`} /></>}
      {a.overlay === "daylight" && a.daylight && <><span className="shrink-0 text-slate-400">Façade VSC avg {a.daylight.stats.facade_avg.toFixed(1)} % · min {a.daylight.stats.facade_min.toFixed(1)} % · {a.daylight.stats.pct_below_27.toFixed(0)} % of façade below 27 % · neighbours avg {a.daylight.stats.context_avg.toFixed(1)} % · {a.daylight.stats.ms} ms</span><Legend lo="0 %" hi="40 %" /></>}
      <span className="ml-auto shrink-0 text-[10px] text-slate-600" title="Comparative early-stage study, not a certified assessment. Flat terrain, direct sun only, CIE overcast sky for VSC.">Comparative, not certified</span>
    </div>
  );
}
