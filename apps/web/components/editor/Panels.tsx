"use client";
import { useMemo, useState } from "react";
import { useEditor, activeOption } from "@/lib/store";
import { computeKpis, evaluateRules, getRulePack, KPI_DEFS, formatKpi, kpiValue, USE_CLASSES, buildingHeight, RULE_PACKS, type Finding } from "@saturn/model";
import { ringArea } from "@saturn/geometry";
import { generateOptions } from "@/lib/generate";
import { fetchOsmContext } from "@/lib/providers/context";

export function useDerived() {
  const project = useEditor((s) => s.project);
  return useMemo(() => {
    const opt = activeOption(project);
    if (!project || !opt) return null;
    const kpis = computeKpis(opt, project.site, project.settings);
    const pack = getRulePack(project.settings.rule_pack_id);
    const compliance = evaluateRules(pack, opt, project.site, project.settings, kpis);
    return { opt, kpis, compliance, pack };
  }, [project]);
}

const inputCls = "w-full rounded bg-slate-800 border border-slate-700 px-2 py-1 text-sm text-slate-100 focus:outline-none focus:border-sky-500";
const labelCls = "text-[11px] uppercase tracking-wide text-slate-400";

function Num({ label, value, onChange, step = 1, min, placeholder }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; step?: number; min?: number; placeholder?: string }) {
  return (
    <label className="block space-y-1">
      <span className={labelCls}>{label}</span>
      <input className={inputCls} type="number" step={step} min={min} placeholder={placeholder ?? "—"} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
    </label>
  );
}

export function KpiPanel() {
  const d = useDerived(); if (!d) return null;
  const { kpis } = d;
  return (
    <div className="space-y-1">
      {KPI_DEFS.map((def) => (
        <div key={def.id} className="flex items-baseline justify-between border-b border-slate-800 py-1" title={def.description}>
          <span className="text-sm text-slate-300">{def.label}</span>
          <span className="font-mono text-sm text-slate-100">{formatKpi(def.id, kpiValue(kpis, def.id))}</span>
        </div>
      ))}
      {Object.keys(kpis.gfa_by_use).length > 0 && (
        <div className="pt-2">
          <div className={labelCls}>GFA by use</div>
          {Object.entries(kpis.gfa_by_use).map(([u, a]) => <div key={u} className="flex justify-between text-sm"><span className="text-slate-400">{u}</span><span className="font-mono">{Math.round(a).toLocaleString()} m²</span></div>)}
        </div>
      )}
    </div>
  );
}

const sevCls: Record<Finding["severity"], string> = { error: "border-rose-500/60 bg-rose-500/10 text-rose-200", warning: "border-amber-500/60 bg-amber-500/10 text-amber-100", info: "border-sky-500/40 bg-sky-500/10 text-sky-100" };

export function CompliancePanel() {
  const d = useDerived(); const select = useEditor((s) => s.select); const applyAutofix = useEditor((s) => s.applyAutofix);
  if (!d) return null;
  const { compliance, pack } = d;
  return (
    <div className="space-y-2">
      <div className="text-xs text-slate-400">Pack: {pack.name} v{pack.version} · {compliance.errors} errors · {compliance.warnings} warnings</div>
      {compliance.findings.length === 0 && <div className="rounded border border-emerald-500/50 bg-emerald-500/10 p-2 text-sm text-emerald-200">All checks pass.</div>}
      {compliance.findings.map((f, i) => (
        <div key={i} className={`rounded border p-2 text-sm ${sevCls[f.severity]}`}>
          <div className="flex items-center justify-between gap-2">
            <button className="text-left font-medium hover:underline" onClick={() => f.building_id && select(f.building_id)}>{f.title}</button>
            {f.autofix && <button className="rounded bg-slate-700 px-2 py-0.5 text-xs hover:bg-slate-600" onClick={() => applyAutofix(f.autofix!, f.building_id)}>Fix</button>}
          </div>
          <div className="text-xs opacity-90">{f.message}</div>
        </div>
      ))}
    </div>
  );
}

export function ZoningPanel() {
  const project = useEditor((s) => s.project); const setZoning = useEditor((s) => s.setZoning); const mutate = useEditor((s) => s.mutate);
  if (!project) return null;
  const z = project.site.zoning; const n = project.site.parcel?.length ?? 0;
  return (
    <div className="space-y-3">
      <label className="block space-y-1"><span className={labelCls}>Rule pack</span>
        <select className={inputCls} value={project.settings.rule_pack_id} onChange={(e) => mutate((p) => { p.settings.rule_pack_id = e.target.value; })}>
          {RULE_PACKS.map((p) => <option key={p.id} value={p.id}>{p.name} v{p.version}</option>)}
        </select></label>
      <label className="block space-y-1"><span className={labelCls}>Zone code</span><input className={inputCls} value={z.zone_code ?? ""} onChange={(e) => setZoning((zz) => { zz.zone_code = e.target.value || undefined; })} /></label>
      <div className="grid grid-cols-2 gap-2">
        <Num label="Max height (m)" value={z.max_height_m} step={0.5} onChange={(v) => setZoning((zz) => { zz.max_height_m = v; })} />
        <Num label="Max storeys" value={z.max_storeys} onChange={(v) => setZoning((zz) => { zz.max_storeys = v; })} />
        <Num label="FAR max" value={z.far_max} step={0.1} onChange={(v) => setZoning((zz) => { zz.far_max = v; })} />
        <Num label="Coverage % max" value={z.coverage_pct_max} onChange={(v) => setZoning((zz) => { zz.coverage_pct_max = v; })} />
        <Num label="OSR % min" value={z.osr_pct_min} onChange={(v) => setZoning((zz) => { zz.osr_pct_min = v; })} />
        <Num label="Default setback (m)" value={z.default_setback_m} step={0.5} onChange={(v) => setZoning((zz) => { zz.default_setback_m = v ?? 0; })} />
        <Num label="Parking / unit" value={z.parking_per_unit} step={0.1} onChange={(v) => setZoning((zz) => { zz.parking_per_unit = v; })} />
        <Num label="Parking / 100 m²" value={z.parking_per_100m2} step={0.1} onChange={(v) => setZoning((zz) => { zz.parking_per_100m2 = v; })} />
        <Num label="Min unit area (m²)" value={z.min_unit_area_m2} onChange={(v) => setZoning((zz) => { zz.min_unit_area_m2 = v; })} />
      </div>
      {n > 0 && (
        <div>
          <div className={labelCls}>Per-edge setbacks (m)</div>
          <div className="grid grid-cols-4 gap-1 pt-1">
            {Array.from({ length: n }, (_, i) => {
              const s = z.setbacks.find((x) => x.edge === i);
              return <input key={i} className={inputCls} type="number" step={0.5} placeholder={`E${i + 1}`} value={s?.distance_m ?? ""} title={`Edge ${i + 1}`}
                onChange={(e) => setZoning((zz) => { zz.setbacks = zz.setbacks.filter((x) => x.edge !== i); if (e.target.value !== "") zz.setbacks.push({ edge: i, distance_m: Number(e.target.value) }); })} />;
            })}
          </div>
          <div className="pt-1 text-[11px] text-slate-500">Blank edges use the default setback. Edge 1 starts at the first parcel vertex, counter-clockwise.</div>
        </div>
      )}
      <div className={labelCls}>Allowed uses</div>
      <div className="flex flex-wrap gap-1">
        {USE_CLASSES.map((u) => { const on = z.allowed_uses?.includes(u); return <button key={u} className={`rounded px-2 py-0.5 text-xs ${on ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-300"}`} onClick={() => setZoning((zz) => { const set = new Set(zz.allowed_uses ?? []); if (set.has(u)) set.delete(u); else set.add(u); zz.allowed_uses = set.size ? [...set] : undefined; })}>{u}</button>; })}
      </div>
      <div className="text-[11px] text-slate-500">Source: {z.source}. Leave a field blank if it is not regulated.</div>
    </div>
  );
}

export function BuildingPanel() {
  const project = useEditor((s) => s.project); const id = useEditor((s) => s.selectedId);
  const update = useEditor((s) => s.updateBuilding); const setStoreys = useEditor((s) => s.setStoreys); const del = useEditor((s) => s.deleteBuilding);
  const b = activeOption(project)?.buildings.find((x) => x.id === id);
  if (!b) return <div className="text-sm text-slate-400">Select a building, or draw one with the polygon / rectangle tools.</div>;
  const gfa = b.storeys.reduce((a, s) => a + ringArea(s.footprint ?? b.footprint), 0);
  return (
    <div className="space-y-3">
      <label className="block space-y-1"><span className={labelCls}>Name</span><input className={inputCls} value={b.name} onChange={(e) => update(b.id, (bb) => { bb.name = e.target.value; })} /></label>
      <div className="grid grid-cols-2 gap-2">
        <Num label="Storeys" value={b.storeys.length} min={1} onChange={(v) => v && setStoreys(b.id, v)} />
        <Num label="Storey height (m)" value={b.storeys[0]?.height_m} step={0.1} min={2} onChange={(v) => v && update(b.id, (bb) => bb.storeys.forEach((s) => { s.height_m = v; }))} />
        <Num label="Roof height (m)" value={b.roof.height_m} step={0.1} min={0} onChange={(v) => update(b.id, (bb) => { bb.roof.height_m = v ?? 0; })} />
        <Num label="Efficiency (NIA/GFA)" value={b.efficiency} step={0.01} min={0.3} onChange={(v) => v && update(b.id, (bb) => { bb.efficiency = Math.min(1, v); })} />
      </div>
      <label className="block space-y-1"><span className={labelCls}>Use (all storeys)</span>
        <select className={inputCls} value={b.category} onChange={(e) => update(b.id, (bb) => { bb.category = e.target.value as typeof bb.category; bb.storeys.forEach((s) => { s.use = bb.category; }); })}>{USE_CLASSES.map((u) => <option key={u}>{u}</option>)}</select></label>
      <label className="block space-y-1"><span className={labelCls}>Ground floor use</span>
        <select className={inputCls} value={b.storeys[0]?.use} onChange={(e) => update(b.id, (bb) => { bb.storeys[0]!.use = e.target.value as typeof bb.category; })}>{USE_CLASSES.map((u) => <option key={u}>{u}</option>)}</select></label>
      <label className="block space-y-1"><span className={labelCls}>Tags (comma separated)</span><input className={inputCls} value={b.tags.join(", ")} onChange={(e) => update(b.id, (bb) => { bb.tags = e.target.value.split(",").map((t) => t.trim()).filter(Boolean); })} /></label>
      <label className="block space-y-1"><span className={labelCls}>Colour</span><input type="color" className="h-8 w-16 bg-transparent" value={b.color ?? "#4f8cff"} onChange={(e) => update(b.id, (bb) => { bb.color = e.target.value; })} /></label>
      <div className="rounded bg-slate-800/60 p-2 text-xs text-slate-300">
        <div>Footprint {Math.round(ringArea(b.footprint))} m² · GFA {Math.round(gfa).toLocaleString()} m²</div>
        <div>Height {buildingHeight(b).toFixed(1)} m · {b.storeys.length} storeys</div>
        <div className="pt-1 text-slate-500">Drag the yellow cone above the building to change storeys. Drag the building to move it.</div>
      </div>
      <button className="rounded bg-rose-700 px-3 py-1 text-sm hover:bg-rose-600" onClick={() => del(b.id)}>Delete building</button>
    </div>
  );
}

export function OptionsPanel() {
  const project = useEditor((s) => s.project); const { addOption, setActiveOption, renameOption, deleteOption, mutate } = useEditor();
  const [params, setParams] = useState({ target_gfa_m2: 0, depth_m: 14, gap_m: 18, max_options: 4 });
  const [busy, setBusy] = useState(false);
  if (!project) return null;
  const perOpt = project.options.map((o) => ({ o, k: computeKpis(o, project.site, project.settings), c: evaluateRules(getRulePack(project.settings.rule_pack_id), o, project.site, project.settings) }));
  const defaultGfa = Math.round((project.site.parcel ? ringArea(project.site.parcel) : 0) * (project.site.zoning.far_max ?? 2));
  const run = () => {
    setBusy(true);
    setTimeout(() => {
      const opts = generateOptions(project, { target_gfa_m2: params.target_gfa_m2 || defaultGfa, depth_m: params.depth_m, gap_m: params.gap_m, typologies: ["bars", "perimeter", "l-block"], max_options: params.max_options });
      if (opts.length) mutate((p) => { p.options.push(...opts); p.active_option_id = opts[0]!.id; });
      setBusy(false);
    }, 10);
  };
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {perOpt.map(({ o, k, c }) => (
          <div key={o.id} className={`flex items-center gap-2 rounded border p-2 text-sm ${o.id === project.active_option_id ? "border-sky-500 bg-sky-500/10" : "border-slate-800"}`}>
            <button className="flex-1 text-left" onClick={() => setActiveOption(o.id)}>
              <input className="w-full bg-transparent font-medium focus:outline-none" value={o.name} onChange={(e) => renameOption(o.id, e.target.value)} onClick={(e) => e.stopPropagation()} />
              <div className="text-xs text-slate-400">GFA {Math.round(k.gfa_m2).toLocaleString()} · FAR {k.far.toFixed(2)} · {k.unit_count} units · {k.max_storeys} st · <span className={c.errors ? "text-rose-300" : "text-emerald-300"}>{c.errors} err</span></div>
            </button>
            {project.options.length > 1 && <button className="text-xs text-slate-500 hover:text-rose-300" onClick={() => deleteOption(o.id)}>✕</button>}
          </div>
        ))}
      </div>
      <button className="w-full rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600" onClick={() => addOption()}>Duplicate active option</button>
      <div className="rounded border border-slate-800 p-2">
        <div className="mb-2 text-sm font-medium">Generate massing options</div>
        <div className="grid grid-cols-2 gap-2">
          <Num label="Target GFA (m²)" value={params.target_gfa_m2 || undefined} placeholder={String(defaultGfa)} onChange={(v) => setParams({ ...params, target_gfa_m2: v ?? 0 })} />
          <Num label="Depth (m)" value={params.depth_m} step={0.5} onChange={(v) => setParams({ ...params, depth_m: v ?? 14 })} />
          <Num label="Gap between bars (m)" value={params.gap_m} step={0.5} onChange={(v) => setParams({ ...params, gap_m: v ?? 18 })} />
          <Num label="Max options" value={params.max_options} onChange={(v) => setParams({ ...params, max_options: v ?? 4 })} />
        </div>
        <button disabled={!project.site.parcel || busy} className="mt-2 w-full rounded bg-emerald-600 px-3 py-1 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40" onClick={run}>{busy ? "Generating…" : "Generate"}</button>
        {!project.site.parcel && <div className="pt-1 text-xs text-slate-500">Draw a parcel first.</div>}
      </div>
    </div>
  );
}

export function SitePanel() {
  const project = useEditor((s) => s.project); const setSite = useEditor((s) => s.setSite); const setTool = useEditor((s) => s.setTool); const toggle = useEditor((s) => s.toggle);
  const showEnvelope = useEditor((s) => s.showEnvelope); const showContext = useEditor((s) => s.showContext);
  const [status, setStatus] = useState<string>("");
  if (!project) return null;
  const s = project.site;
  const fetchCtx = async () => {
    setStatus("Fetching OpenStreetMap context…");
    try { const r = await fetchOsmContext(s.origin, s.context_radius_m); setSite((ss) => { ss.context_buildings = r.buildings; ss.streets = r.streets; }); setStatus(`${r.buildings.length} buildings, ${r.streets.length} streets from ${r.source}.`); }
    catch (e) { setStatus(`Failed: ${(e as Error).message}`); }
  };
  return (
    <div className="space-y-3 text-sm">
      <div className="text-xs text-slate-400">Origin {s.origin.lat.toFixed(5)}, {s.origin.lon.toFixed(5)}</div>
      <div className="grid grid-cols-2 gap-2">
        <Num label="Origin lat" value={s.origin.lat} step={0.0001} onChange={(v) => v !== undefined && setSite((ss) => { ss.origin.lat = v; })} />
        <Num label="Origin lon" value={s.origin.lon} step={0.0001} onChange={(v) => v !== undefined && setSite((ss) => { ss.origin.lon = v; })} />
        <Num label="Context radius (m)" value={s.context_radius_m} step={50} onChange={(v) => v && setSite((ss) => { ss.context_radius_m = v; })} />
      </div>
      <button className="w-full rounded bg-slate-700 px-3 py-1 hover:bg-slate-600" onClick={fetchCtx}>Fetch context (OSM)</button>
      {status && <div className="text-xs text-slate-400">{status}</div>}
      <div className="rounded border border-slate-800 p-2">
        <div className="mb-1">Parcel: {s.parcel ? `${s.parcel.length} vertices · ${Math.round(ringArea(s.parcel)).toLocaleString()} m²` : "none"}</div>
        <button className="rounded bg-amber-600 px-3 py-1 hover:bg-amber-500" onClick={() => setTool("draw-parcel")}>Draw parcel in 3D view</button>
        {s.parcel && <button className="ml-2 rounded bg-slate-700 px-3 py-1 hover:bg-slate-600" onClick={() => setSite((ss) => { ss.parcel = undefined; })}>Clear</button>}
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={showEnvelope} onChange={() => toggle("showEnvelope")} /> Show buildable envelope</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={showContext} onChange={() => toggle("showContext")} /> Show context ({s.context_buildings.length} buildings)</label>
      <div className="text-xs text-slate-500">Terrain is flat in this build; elevation tiles arrive in a later phase.</div>
    </div>
  );
}
