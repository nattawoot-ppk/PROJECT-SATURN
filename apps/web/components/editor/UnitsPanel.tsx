"use client";
import { useState } from "react";
import { LayoutGrid, Car, Eraser } from "lucide-react";
import { useEditor, activeOption } from "@/lib/store";
import { DEFAULT_MIX, RES_TYPES, applyLayoutToBuilding, DEFAULT_LAYOUT, planBasement, planSurface, computeEnvelope, computeKpis, type Building, type ResidentialType } from "@saturn/model";
import { Btn, Chip, Field, Input, Select, StatTile, Divider } from "@/components/ui";
import { UNIT_COLORS } from "./UnitsAndParking";

export function UnitsPanel({ b }: { b: Building }) {
  const project = useEditor((s) => s.project)!; const mutate = useEditor((s) => s.mutate); const showUnits = useEditor((s) => s.showUnits); const toggle = useEditor((s) => s.toggle);
  const [mix, setMix] = useState({ ...DEFAULT_MIX.pct }); const [areas, setAreas] = useState({ ...DEFAULT_MIX.area_m2 });
  const [corridor, setCorridor] = useState(1.8); const [optimise, setOptimise] = useState(true);
  const [parkType, setParkType] = useState<"basement" | "surface">("basement");
  const units = b.storeys.reduce((a, s) => a + s.units.filter((u) => RES_TYPES.includes(u.type as ResidentialType)).length, 0);
  const mixNow: Record<string, number> = {}; for (const s of b.storeys) for (const u of s.units) if (RES_TYPES.includes(u.type as ResidentialType)) mixNow[u.type] = (mixNow[u.type] ?? 0) + 1;
  const opt = activeOption(project)!; const kpis = computeKpis(opt, project.site, project.settings);
  const params = { ...DEFAULT_LAYOUT, corridor_m: corridor, mix: { pct: mix, area_m2: areas } };
  const run = () => mutate((p) => { const o = activeOption(p)!; const i = o.buildings.findIndex((x) => x.id === b.id); if (i < 0) return; o.buildings[i] = applyLayoutToBuilding(o.buildings[i]!, params, optimise).building; });
  const runAll = () => mutate((p) => { const o = activeOption(p)!; o.buildings = o.buildings.map((x) => applyLayoutToBuilding(x, params, optimise).building); });
  const clear = () => mutate((p) => { const x = activeOption(p)!.buildings.find((y) => y.id === b.id); if (x) x.storeys.forEach((s) => { s.units = []; s.cores = []; }); });
  const park = () => mutate((p) => {
    const o = activeOption(p)!; const x = o.buildings.find((y) => y.id === b.id); if (!x) return;
    const k = computeKpis(o, p.site, p.settings); const need = Math.max(0, k.parking_required - (k.parking_stalls - x.parking.reduce((a, q) => a + q.stalls, 0)));
    x.parking = x.parking.filter((q) => q.type !== parkType);
    if (parkType === "basement") { const pl = planBasement(x, need); x.parking.push({ id: `${x.id}-pk`, type: "basement", polygon: pl.polygon, levels: pl.levels, stalls: pl.stalls }); }
    else { const env = computeEnvelope(p.site).map((e) => e.outer); const pl = planSurface(env, o.buildings.map((y) => y.footprint), need); if (pl) x.parking.push({ id: `${x.id}-pk`, type: "surface", polygon: pl.polygon, levels: 1, stalls: pl.stalls }); }
  });
  return (
    <div className="space-y-3">
      <Divider />
      <div className="flex items-center justify-between"><div className="flex items-center gap-1.5 text-[13px] font-semibold"><LayoutGrid size={14} className="text-accent" /> Unit layout</div>
        <label className="flex items-center gap-1 text-[11px] text-ink-2"><input type="checkbox" checked={showUnits} onChange={() => toggle("showUnits")} /> show</label></div>
      <div className="grid grid-cols-2 gap-2">
        <StatTile label="Units" value={String(units)} tone="accent" hint={units ? Object.entries(mixNow).map(([t, n]) => `${t} ${Math.round((100 * n) / units)}%`).join(" · ") : "none laid out"} />
        <StatTile label="Parking" value={`${kpis.parking_stalls}/${kpis.parking_required}`} hint="provided / required" tone={kpis.parking_stalls >= kpis.parking_required ? "teal" : "danger"} />
      </div>
      <div className="label">Target mix % · unit area m²</div>
      {RES_TYPES.map((t) => (
        <div key={t} className="flex items-center gap-2 text-[12px]">
          <span className="h-2 w-2 rounded-full" style={{ background: UNIT_COLORS[t] }} /><span className="w-10 text-ink-2">{t}</span>
          <Input type="number" min={0} max={100} value={mix[t] ?? 0} onChange={(e) => setMix({ ...mix, [t]: Number(e.target.value) })} />
          <Input type="number" min={15} value={areas[t] ?? 0} onChange={(e) => setAreas({ ...areas, [t]: Number(e.target.value) })} />
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Corridor (m)"><Input type="number" step={0.1} value={corridor} onChange={(e) => setCorridor(Number(e.target.value))} /></Field>
        <label className="flex items-end gap-2 pb-2 text-[12px]"><input type="checkbox" checked={optimise} onChange={(e) => setOptimise(e.target.checked)} /> Optimise count</label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Btn size="sm" variant="primary" onClick={run}>Generate units</Btn>
        <Btn size="sm" variant="ghost" onClick={runAll}>All buildings</Btn>
        {units > 0 && <Btn size="sm" variant="outline" onClick={clear}><Eraser size={11} /> Clear</Btn>}
      </div>
      <Divider />
      <div className="flex items-center gap-1.5 text-[13px] font-semibold"><Car size={14} className="text-accent" /> Parking</div>
      <div className="flex items-center gap-2">
        <Select value={parkType} onChange={(e) => setParkType(e.target.value as typeof parkType)}><option value="basement">Basement under building</option><option value="surface">Surface lot on site</option></Select>
        <Btn size="sm" variant="primary" onClick={park}>Plan</Btn>
      </div>
      {b.parking.map((p) => <div key={p.id} className="flex items-center justify-between text-[12px]"><span className="text-ink-2">{p.type} · {p.levels} level{p.levels > 1 ? "s" : ""}</span><Chip tone="teal">{p.stalls} stalls</Chip><button className="text-ink-3 hover:text-danger" onClick={() => mutate((pp) => { const x = activeOption(pp)!.buildings.find((y) => y.id === b.id); if (x) x.parking = x.parking.filter((q) => q.id !== p.id); })}>✕</button></div>)}
      <div className="text-[10.5px] text-ink-3">Stall counts use 30 m² gross per basement stall and 25 m² per surface stall, including aisles.</div>
    </div>
  );
}
