"use client";
import { useMemo, useState } from "react";
import { Droplets, Thermometer, Sun, Upload } from "lucide-react";
import { useEditor, activeOption } from "@/lib/store";
import { useAnalysis } from "@/lib/analysisStore";
import { siteSurfaces, stormwater, unitDaylightFactors, runThermal, monthlyMeans } from "@/lib/analysis/performance";
import { parseEpw, type Hourly, type ThermalResult } from "@saturn/analyses";
import { Btn, Chip, Divider, Field, Input, Select, StatTile } from "@/components/ui";

export function PerformancePanel() {
  const project = useEditor((s) => s.project)!; const dl = useAnalysis((s) => s.daylight);
  const opt = activeOption(project)!;
  // stormwater
  const [intensity, setIntensity] = useState(120); const [release, setRelease] = useState(20); const [paved, setPaved] = useState(30);
  const sw = useMemo(() => stormwater(siteSurfaces(project, paved / 100), intensity, 15, release), [project, intensity, release, paved]);
  // daylight factor
  const [glazing, setGlazing] = useState(0.3); const dfMin = project.site.zoning.daylight_factor_min_pct ?? 2;
  const dfs = useMemo(() => (dl ? unitDaylightFactors(project, dl, glazing) : []), [project, dl, glazing]);
  const dfPass = dfs.length ? (100 * dfs.filter((d) => d.df_pct >= dfMin).length) / dfs.length : 0;
  // comfort & energy
  const [bid, setBid] = useState(opt.buildings[0]?.id ?? ""); const [weather, setWeather] = useState<Hourly | null>(null); const [res, setRes] = useState<{ result: ThermalResult; weather: Hourly } | null>(null); const [busy, setBusy] = useState(false);
  const [uWall, setUWall] = useState(0.4); const [gVal, setGVal] = useState(0.45); const [mass, setMass] = useState(165);
  const b = opt.buildings.find((x) => x.id === bid) ?? opt.buildings[0];
  const run = () => { if (!b) return; setBusy(true); setTimeout(() => { try { setRes(runThermal(b, weather, project.site.origin.lat, glazing, { u_wall: uWall, g_value: gVal, thermal_mass_kj_m2k: mass })); } finally { setBusy(false); } }, 20); };
  const loadEpw = async (f: File) => { try { setWeather(parseEpw(await f.text())); setRes(null); } catch (e) { alert((e as Error).message); } };
  const months = res ? monthlyMeans(res.result.free_t) : []; const outM = res ? monthlyMeans(res.weather.t_out) : [];
  return (
    <div className="space-y-4 text-[12.5px]">
      <section className="space-y-2">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold"><Droplets size={14} className="text-teal" /> Stormwater</div>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Impervious" value={sw.impervious_pct.toFixed(0)} unit="%" tone={sw.impervious_pct > 70 ? "danger" : "teal"} hint={`runoff coefficient ${sw.weighted_c.toFixed(2)}`} />
          <StatTile label="Detention" value={Math.round(sw.detention_m3).toLocaleString()} unit="m³" hint={`peak ${(sw.peak_runoff_m3_s * 1000).toFixed(0)} l/s · annual ${Math.round(sw.annual_runoff_m3).toLocaleString()} m³`} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Storm mm/h"><Input type="number" value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} /></Field>
          <Field label="Release l/s·ha"><Input type="number" value={release} onChange={(e) => setRelease(Number(e.target.value))} /></Field>
          <Field label="Paved % of open"><Input type="number" value={paved} onChange={(e) => setPaved(Number(e.target.value))} /></Field>
        </div>
        <div className="text-[10.5px] text-ink-3">Rational method: roofs 0.95, paving 0.9, green 0.25. 15-minute design storm.</div>
      </section>
      <Divider />
      <section className="space-y-2">
        <div className="flex items-center justify-between"><div className="flex items-center gap-1.5 text-[13px] font-semibold"><Sun size={14} className="text-amber" /> Daylight factor per unit</div><Chip tone={dfs.length ? (dfPass >= 80 ? "teal" : "danger") : "neutral"}>{dfs.length ? `${dfPass.toFixed(0)} % ≥ ${dfMin} %` : "run Daylight VSC first"}</Chip></div>
        <Field label={`Glazing ratio of exterior wall · ${Math.round(glazing * 100)} %`}><input type="range" min={0.1} max={0.7} step={0.05} value={glazing} className="w-full" onChange={(e) => setGlazing(Number(e.target.value))} /></Field>
        {dfs.length > 0 && (
          <div className="glass-soft max-h-48 overflow-y-auto rounded-[12px] px-2 py-1">
            {[...dfs].sort((a, c) => a.df_pct - c.df_pct).slice(0, 12).map((d) => <div key={d.unit} className="flex items-center justify-between border-b border-line py-1 last:border-0"><span className="text-ink-2">{d.building} L{d.level} · {d.type} {Math.round(d.area_m2)} m²</span><span className={`mono ${d.df_pct >= dfMin ? "text-teal" : "text-danger"}`}>{d.df_pct.toFixed(1)} %</span></div>)}
            <div className="pt-1 text-[10.5px] text-ink-3">Lowest 12 of {dfs.length} units. BRE average DF with sky angle from façade VSC.</div>
          </div>
        )}
        {!dl && <div className="text-[10.5px] text-ink-3">Needs façade VSC (analysis bar) and unit layouts (Building panel).</div>}
      </section>
      <Divider />
      <section className="space-y-2">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold"><Thermometer size={14} className="text-accent" /> Comfort & energy (free-running)</div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Building"><Select value={b?.id ?? ""} onChange={(e) => { setBid(e.target.value); setRes(null); }}>{opt.buildings.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
          <Field label="Weather"><label className="pill flex cursor-pointer items-center gap-1 border border-line bg-black/30 px-2 py-1.5 text-[12px]"><Upload size={12} /> {weather ? weather.source.slice(0, 18) : "EPW file…"}<input type="file" accept=".epw" className="hidden" onChange={(e) => e.target.files?.[0] && loadEpw(e.target.files[0])} /></label></Field>
          <Field label="U wall W/m²K"><Input type="number" step={0.05} value={uWall} onChange={(e) => setUWall(Number(e.target.value))} /></Field>
          <Field label="g-value"><Input type="number" step={0.05} value={gVal} onChange={(e) => setGVal(Number(e.target.value))} /></Field>
          <Field label="Thermal mass kJ/m²K"><Input type="number" step={5} value={mass} onChange={(e) => setMass(Number(e.target.value))} /></Field>
          <div className="flex items-end"><Btn variant="primary" size="sm" className="w-full" disabled={!b || busy} onClick={run}>{busy ? "Simulating…" : "Run 8760 h"}</Btn></div>
        </div>
        {!weather && <div className="text-[10.5px] text-amber">No EPW loaded: a synthetic climate from latitude will be used (approximate). Load an EPW from climate.onebuilding.org for real results.</div>}
        {res && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <StatTile label="Thermal autonomy" value={res.result.comfort_pct.toFixed(0)} unit="%" tone={res.result.comfort_pct > 70 ? "teal" : "accent"} hint={`${res.result.overheating_h} h too warm · ${res.result.underheating_h} h too cold`} />
              <StatTile label="Demand" value={`${res.result.heating_kwh_m2.toFixed(0)} / ${res.result.cooling_kwh_m2.toFixed(0)}`} unit="kWh/m²·a" hint="heating / cooling with 20–26 °C set points" />
            </div>
            <div className="glass-soft rounded-[12px] p-2">
              <div className="label mb-1">Monthly mean · free-running indoor (orange) vs outdoor (grey)</div>
              <div className="flex h-16 items-end gap-1">{months.map((m, i) => <div key={i} className="flex flex-1 flex-col items-center gap-0.5"><div className="flex w-full items-end gap-[1px]"><span className="flex-1 rounded-sm bg-accent/80" style={{ height: `${Math.max(2, (m / 40) * 56)}px` }} /><span className="flex-1 rounded-sm bg-ink-3/60" style={{ height: `${Math.max(2, (outM[i]! / 40) * 56)}px` }} /></div><span className="text-[8px] text-ink-3">{"JFMAMJJASOND"[i]}</span></div>)}</div>
            </div>
            <div className="text-[10.5px] text-ink-3">{res.weather.source}. ISO 13790 5R1C hourly, EN 16798-1 Cat II adaptive band, occupied 07–22. Comparative, not certified.</div>
          </div>
        )}
      </section>
    </div>
  );
}
