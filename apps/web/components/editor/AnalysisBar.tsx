"use client";
import { useEffect } from "react";
import { Sun, CloudSun, Eye } from "lucide-react";
import { useEditor } from "@/lib/store";
import { useAnalysis } from "@/lib/analysisStore";
import { computeSunHours } from "@/lib/analysis/sunhours";
import { computeDaylight } from "@/lib/analysis/daylight";
import { computeViews } from "@/lib/analysis/views";
import { KEY_DATES } from "@saturn/analyses";
import { Btn, Chip } from "@/components/ui";

const Legend = ({ lo, hi }: { lo: string; hi: string }) => (
  <span className="flex shrink-0 items-center gap-1 text-[10.5px] text-ink-3">{lo}<span className="inline-block h-1.5 w-20 rounded" style={{ background: "linear-gradient(90deg,#1f3373,#19a3bf,#f2d933,#e6331a)" }} />{hi}</span>
);

export default function AnalysisBar() {
  const project = useEditor((s) => s.project);
  const a = useAnalysis();
  const year = new Date().getFullYear();
  const updatedAt = project?.updated_at;
  useEffect(() => { const st = useAnalysis.getState(); if (st.sun || st.daylight || st.views) st.set({ stale: true }); }, [updatedAt]);
  const run = (kind: "sun" | "daylight" | "views") => {
    if (!project) return; a.set({ running: kind });
    setTimeout(() => {
      try {
        if (kind === "sun") a.set({ sun: computeSunHours(project, a.date), overlay: "sun" });
        if (kind === "daylight") a.set({ daylight: computeDaylight(project), overlay: "daylight" });
        if (kind === "views") a.set({ views: computeViews(project), overlay: "views" });
        a.set({ stale: false, running: null });
      } catch (e) { console.error(e); a.set({ running: null }); }
    }, 20);
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
      {(a.sun || a.daylight || a.views) && (
        <select className={sel} value={a.overlay} onChange={(e) => a.set({ overlay: e.target.value as typeof a.overlay })}>
          <option value="none">No overlay</option>
          {a.sun && <option value="sun">Sun hours</option>}
          {a.daylight && <option value="daylight">Daylight VSC</option>}
          {a.views && <option value="views">View openness</option>}
        </select>
      )}
      {a.stale && (a.sun || a.daylight || a.views) && <Chip tone="amber">Stale</Chip>}
      {a.overlay === "sun" && a.sun && <><span className="shrink-0 text-ink-2">Ground avg {a.sun.stats.ground_avg_h.toFixed(1)} h · min {a.sun.stats.ground_min_h.toFixed(1)} h · façade avg {a.sun.stats.facade_avg_h.toFixed(1)} / {a.sun.total_possible_h.toFixed(1)} h · {a.sun.stats.ms} ms</span><Legend lo="0 h" hi={`${a.sun.total_possible_h.toFixed(0)} h`} /></>}
      {a.overlay === "daylight" && a.daylight && <><span className="shrink-0 text-ink-2">Façade VSC avg {a.daylight.stats.facade_avg.toFixed(1)} % · min {a.daylight.stats.facade_min.toFixed(1)} % · {a.daylight.stats.pct_below_27.toFixed(0)} % below 27 % · neighbours {a.daylight.stats.context_avg.toFixed(1)} % · {a.daylight.stats.ms} ms</span><Legend lo="0 %" hi="40 %" /></>}
      {a.overlay === "views" && a.views && <><span className="shrink-0 text-ink-2">Openness avg {a.views.stats.avg.toFixed(0)} % · min {a.views.stats.min.toFixed(0)} % · {a.views.stats.pct_poor.toFixed(0)} % of façade below 40 % · {a.views.stats.ms} ms</span><Legend lo="0 %" hi="100 %" /></>}
      <span className="ml-auto shrink-0 text-[10px] text-ink-3" title="Comparative early-stage study, not a certified assessment. Flat terrain, direct sun only, CIE overcast sky for VSC.">Comparative, not certified</span>
    </div>
  );
}
