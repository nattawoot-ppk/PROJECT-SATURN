"use client";
import { useMemo, useState } from "react";
import { Wand2, Copy, Trash2, Download as Dl, MapPin, Layers } from "lucide-react";
import { useEditor, activeOption } from "@/lib/store";
import { computeKpis, evaluateRules, getRulePack, KPI_DEFS, formatKpi, kpiValue, USE_CLASSES, buildingHeight, RULE_PACKS, type Finding } from "@saturn/model";
import { ringArea } from "@saturn/geometry";
import { generateOptions } from "@/lib/generate";
import { fetchOsmContext } from "@/lib/providers/context";
import { fetchTerrain } from "@/lib/providers/terrain";
import { slopeStats } from "@saturn/geometry";
import { Btn, Chip, Divider, Field, Input, Num, Select, StatTile } from "@/components/ui";
import { StreetSectionsPanel, UnderlaysPanel } from "./SiteFeaturePanels";
import { UnitsPanel } from "./UnitsPanel";

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

export function KpiPanel() {
  const d = useDerived(); if (!d) return null;
  const { kpis } = d;
  const mix = Object.entries(kpis.gfa_by_use);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <StatTile label="GFA" value={Math.round(kpis.gfa_m2).toLocaleString()} unit="m²" tone="accent" bars={mix.map(([, a]) => a)} hint={mix.map(([u]) => u).join(" · ") || "no buildings"} />
        <StatTile label="FAR" value={kpis.far.toFixed(2)} unit="×" tone="teal" hint={`coverage ${kpis.coverage_pct.toFixed(0)} %`} />
        <StatTile label="Units" value={String(kpis.unit_count)} hint={`avg ${Math.round(kpis.avg_unit_area_m2)} m² · ${Math.round(kpis.residents_est)} residents`} />
        <StatTile label="Height" value={kpis.max_height_m.toFixed(1)} unit="m" hint={`${kpis.max_storeys} storeys max`} />
      </div>
      <div className="glass-soft rounded-[16px] px-3 py-1">
        {KPI_DEFS.map((def) => (
          <div key={def.id} className="flex items-baseline justify-between border-b border-line py-1.5 last:border-0" title={def.description}>
            <span className="text-[12.5px] text-ink-2">{def.label}</span>
            <span className="mono text-[12.5px] text-ink">{formatKpi(def.id, kpiValue(kpis, def.id))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const sevCls: Record<Finding["severity"], string> = { error: "border-danger/50 bg-danger/10", warning: "border-amber/50 bg-amber/10", info: "border-teal/40 bg-teal/10" };
const sevDot: Record<Finding["severity"], string> = { error: "bg-danger", warning: "bg-amber", info: "bg-teal" };

export function CompliancePanel() {
  const d = useDerived(); const select = useEditor((s) => s.select); const applyAutofix = useEditor((s) => s.applyAutofix);
  if (!d) return null;
  const { compliance, pack } = d;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Errors" value={String(compliance.errors)} tone={compliance.errors ? "danger" : "teal"} />
        <StatTile label="Warnings" value={String(compliance.warnings)} tone="neutral" />
        <StatTile label="Rules" value={String(pack.rules.length)} hint={`v${pack.version}`} />
      </div>
      {compliance.findings.length === 0 && <div className="rounded-[14px] border border-teal/40 bg-teal/10 p-3 text-[12.5px] text-teal">All checks pass.</div>}
      {compliance.findings.map((f, i) => (
        <div key={i} className={`rounded-[14px] border p-3 text-[12.5px] ${sevCls[f.severity]}`}>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${sevDot[f.severity]}`} />
            <button className="flex-1 text-left font-medium hover:underline" onClick={() => f.building_id && select(f.building_id)}>{f.title}</button>
            {f.autofix && <Btn size="sm" variant="outline" onClick={() => applyAutofix(f.autofix!, f.building_id)}>Fix</Btn>}
          </div>
          <div className="mt-1 pl-4 text-[11.5px] text-ink-2">{f.message}</div>
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
      <Field label="Rule pack"><Select value={project.settings.rule_pack_id} onChange={(e) => mutate((p) => { p.settings.rule_pack_id = e.target.value; })}>{RULE_PACKS.map((p) => <option key={p.id} value={p.id}>{p.name} v{p.version}</option>)}</Select></Field>
      <Field label="Zone code"><Input value={z.zone_code ?? ""} onChange={(e) => setZoning((zz) => { zz.zone_code = e.target.value || undefined; })} /></Field>
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
          <div className="label">Per-edge setbacks (m)</div>
          <div className="mt-1 grid grid-cols-4 gap-1">
            {Array.from({ length: n }, (_, i) => { const s = z.setbacks.find((x) => x.edge === i); return <Input key={i} type="number" step={0.5} placeholder={`E${i + 1}`} value={s?.distance_m ?? ""} title={`Edge ${i + 1}`} onChange={(e) => setZoning((zz) => { zz.setbacks = zz.setbacks.filter((x) => x.edge !== i); if (e.target.value !== "") zz.setbacks.push({ edge: i, distance_m: Number(e.target.value) }); })} />; })}
          </div>
          <div className="mt-1 text-[10.5px] text-ink-3">Blank edges use the default. Edge 1 starts at the first parcel vertex, counter-clockwise.</div>
        </div>
      )}
      <div className="label">Allowed uses</div>
      <div className="flex flex-wrap gap-1">
        {USE_CLASSES.map((u) => { const on = z.allowed_uses?.includes(u); return <button key={u} className={`pill px-2.5 py-0.5 text-[11px] ${on ? "bg-accent text-white" : "bg-panel-2 text-ink-2"}`} onClick={() => setZoning((zz) => { const set = new Set(zz.allowed_uses ?? []); if (set.has(u)) set.delete(u); else set.add(u); zz.allowed_uses = set.size ? [...set] : undefined; })}>{u}</button>; })}
      </div>
      <div className="text-[10.5px] text-ink-3">Source: {z.source}. Leave a field blank if it is not regulated.</div>
    </div>
  );
}

export function BuildingPanel() {
  const project = useEditor((s) => s.project); const id = useEditor((s) => s.selectedId);
  const update = useEditor((s) => s.updateBuilding); const setStoreys = useEditor((s) => s.setStoreys); const del = useEditor((s) => s.deleteBuilding);
  const select = useEditor((s) => s.select);
  const all = activeOption(project)?.buildings ?? [];
  const b = all.find((x) => x.id === id);
  if (!b) return (
    <div className="space-y-2 text-[12.5px]">
      <div className="text-ink-2">Select a building in the view or from the list, or draw one with the polygon / rectangle tools.</div>
      {all.map((x) => (
        <button key={x.id} className="flex w-full items-center justify-between rounded-[12px] border border-line bg-panel px-3 py-2 text-left hover:bg-panel-2" onClick={() => select(x.id)}>
          <span className="font-medium">{x.name}</span>
          <span className="mono text-[11px] text-ink-3">{x.storeys.length} st · {Math.round(x.storeys.reduce((a, s) => a + ringArea(s.footprint ?? x.footprint), 0)).toLocaleString()} m²</span>
        </button>
      ))}
    </div>
  );
  const gfa = b.storeys.reduce((a, s) => a + ringArea(s.footprint ?? b.footprint), 0);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <StatTile label="GFA" value={Math.round(gfa).toLocaleString()} unit="m²" tone="accent" hint={`footprint ${Math.round(ringArea(b.footprint))} m²`} />
        <StatTile label="Height" value={buildingHeight(b).toFixed(1)} unit="m" hint={`${b.storeys.length} storeys`} />
      </div>
      <Field label="Name"><Input value={b.name} onChange={(e) => update(b.id, (bb) => { bb.name = e.target.value; })} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Num label="Storeys" value={b.storeys.length} min={1} onChange={(v) => v && setStoreys(b.id, v)} />
        <Num label="Storey height (m)" value={b.storeys[0]?.height_m} step={0.1} min={2} onChange={(v) => v && update(b.id, (bb) => bb.storeys.forEach((s) => { s.height_m = v; }))} />
        <Num label="Roof height (m)" value={b.roof.height_m} step={0.1} min={0} onChange={(v) => update(b.id, (bb) => { bb.roof.height_m = v ?? 0; })} />
        <Num label="Efficiency NIA/GFA" value={b.efficiency} step={0.01} min={0.3} onChange={(v) => v && update(b.id, (bb) => { bb.efficiency = Math.min(1, v); })} />
      </div>
      <Field label="Use (all storeys)"><Select value={b.category} onChange={(e) => update(b.id, (bb) => { bb.category = e.target.value as typeof bb.category; bb.storeys.forEach((s) => { s.use = bb.category; }); })}>{USE_CLASSES.map((u) => <option key={u}>{u}</option>)}</Select></Field>
      <Field label="Ground floor use"><Select value={b.storeys[0]?.use} onChange={(e) => update(b.id, (bb) => { bb.storeys[0]!.use = e.target.value as typeof bb.category; })}>{USE_CLASSES.map((u) => <option key={u}>{u}</option>)}</Select></Field>
      <Field label="Tags (comma separated)"><Input value={b.tags.join(", ")} onChange={(e) => update(b.id, (bb) => { bb.tags = e.target.value.split(",").map((t) => t.trim()).filter(Boolean); })} /></Field>
      <Field label="Colour"><input type="color" className="h-8 w-16 cursor-pointer rounded bg-transparent" value={b.color ?? "#d9dde3"} onChange={(e) => update(b.id, (bb) => { bb.color = e.target.value; })} /></Field>
      <div className="text-[10.5px] text-ink-3">Drag the orange cone above the building to change storeys. Drag the building to move it. +/− keys change storeys.</div>
      <Btn variant="danger" size="sm" onClick={() => del(b.id)}><Trash2 size={12} /> Delete building</Btn>
      <UnitsPanel b={b} />
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
  const maxGfa = Math.max(...perOpt.map((x) => x.k.gfa_m2), 1);
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {perOpt.map(({ o, k, c }) => (
          <div key={o.id} className={`rounded-[14px] border p-2.5 transition ${o.id === project.active_option_id ? "border-accent/70 bg-accent/10" : "border-line bg-panel hover:bg-panel-2"}`}>
            <div className="flex items-center gap-2">
              <button className="flex-1 text-left" onClick={() => setActiveOption(o.id)}>
                <input className="w-full bg-transparent text-[13px] font-semibold focus:outline-none" value={o.name} onChange={(e) => renameOption(o.id, e.target.value)} onClick={(e) => e.stopPropagation()} />
              </button>
              <Chip tone={c.errors ? "danger" : "teal"}>{c.errors ? `${c.errors} err` : "ok"}</Chip>
              {project.options.length > 1 && <button className="text-ink-3 hover:text-danger" onClick={() => deleteOption(o.id)}><Trash2 size={12} /></button>}
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded bg-black/30"><div className="h-full bg-teal/80" style={{ width: `${(100 * k.gfa_m2) / maxGfa}%` }} /></div>
            <div className="mono mt-1 text-[10.5px] text-ink-3">GFA {Math.round(k.gfa_m2).toLocaleString()} · FAR {k.far.toFixed(2)} · {k.unit_count} units · {k.max_storeys} st</div>
          </div>
        ))}
      </div>
      <Btn variant="ghost" size="sm" className="w-full" onClick={() => addOption()}><Copy size={12} /> Duplicate active option</Btn>
      <Divider />
      <div className="glass-soft rounded-[16px] p-3">
        <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold"><Wand2 size={14} className="text-accent" /> Generate massing</div>
        <div className="grid grid-cols-2 gap-2">
          <Num label="Target GFA (m²)" value={params.target_gfa_m2 || undefined} placeholder={String(defaultGfa)} onChange={(v) => setParams({ ...params, target_gfa_m2: v ?? 0 })} />
          <Num label="Depth (m)" value={params.depth_m} step={0.5} onChange={(v) => setParams({ ...params, depth_m: v ?? 14 })} />
          <Num label="Gap (m)" value={params.gap_m} step={0.5} onChange={(v) => setParams({ ...params, gap_m: v ?? 18 })} />
          <Num label="Max options" value={params.max_options} onChange={(v) => setParams({ ...params, max_options: v ?? 4 })} />
        </div>
        <Btn variant="primary" className="mt-3 w-full" disabled={!project.site.parcel || busy} onClick={run}>{busy ? "Generating…" : "Generate options"}</Btn>
        {!project.site.parcel && <div className="pt-1 text-[10.5px] text-ink-3">Draw a parcel first.</div>}
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
    <div className="space-y-3 text-[12.5px]">
      <div className="grid grid-cols-2 gap-2">
        <StatTile label="Parcel" value={s.parcel ? Math.round(ringArea(s.parcel)).toLocaleString() : "—"} unit="m²" hint={s.parcel ? `${s.parcel.length} vertices` : "not drawn"} tone="accent" />
        <StatTile label="Context" value={String(s.context_buildings.length)} hint={`${s.streets.length} streets`} tone="teal" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Num label="Origin lat" value={s.origin.lat} step={0.0001} onChange={(v) => v !== undefined && setSite((ss) => { ss.origin.lat = v; })} />
        <Num label="Origin lon" value={s.origin.lon} step={0.0001} onChange={(v) => v !== undefined && setSite((ss) => { ss.origin.lon = v; })} />
        <Num label="Context radius (m)" value={s.context_radius_m} step={50} onChange={(v) => v && setSite((ss) => { ss.context_radius_m = v; })} />
      </div>
      <div className="flex gap-1.5">
        <Btn variant="ghost" size="sm" className="flex-1" onClick={fetchCtx}><Dl size={12} /> Fetch context (OSM)</Btn>
        <Btn variant="ghost" size="sm" className="flex-1" onClick={async () => { setStatus("Fetching terrain tiles…"); try { const t = await fetchTerrain(s.origin, Math.min(600, s.context_radius_m + 100)); setSite((ss) => { ss.terrain = t; }); const st = slopeStats(t); setStatus(`Terrain ${t.cols}×${t.rows} @ ${t.cell_m} m · max slope ${st.max_pct.toFixed(0)} %`); } catch (e) { setStatus(`Terrain failed: ${(e as Error).message}`); } }}><Dl size={12} /> Fetch terrain</Btn>
      </div>
      {s.terrain && <div className="flex items-center justify-between text-[11px] text-ink-2"><span>Terrain loaded ({s.terrain.cols}×{s.terrain.rows} @ {s.terrain.cell_m} m)</span><button className="text-ink-3 hover:text-danger" onClick={() => setSite((ss) => { ss.terrain = undefined; })}>remove</button></div>}
      {status && <div className="text-[11px] text-ink-2">{status}</div>}
      <Divider />
      <div className="flex gap-2">
        <Btn variant="outline" size="sm" onClick={() => setTool("draw-parcel")}><MapPin size={12} /> Draw parcel in 3D</Btn>
        {s.parcel && <Btn variant="ghost" size="sm" onClick={() => setSite((ss) => { ss.parcel = undefined; })}>Clear parcel</Btn>}
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={showEnvelope} onChange={() => toggle("showEnvelope")} /> Show buildable envelope</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={showContext} onChange={() => toggle("showContext")} /> <Layers size={12} /> Show context</label>
      <Divider />
      <StreetSectionsPanel />
      <Divider />
      <UnderlaysPanel />
      <div className="text-[10.5px] text-ink-3">Terrain comes from AWS Terrain Tiles (30 m SRTM-class data, ~5 m pixels). Buildings sit at the ground level of their footprint centre.</div>
    </div>
  );
}
