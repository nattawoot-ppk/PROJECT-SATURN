"use client";
import { useMemo, useState } from "react";
import { nanoid } from "nanoid";
import { Plus, Trash2, Image as ImageIcon, Route } from "lucide-react";
import { useEditor } from "@/lib/store";
import { Btn, Chip, Field, Input, Select, Divider } from "@/components/ui";
import { loadImageForUnderlay } from "@/lib/image";
import { centroid, distPointPolyline, polylineLength } from "@saturn/geometry";
import type { StreetBandType, StreetSection } from "@saturn/model";

const BAND_TYPES: StreetBandType[] = ["pavement", "roadway", "bike_lane", "planting", "parking", "median", "safety_zone", "plot_setback"];
const PRESETS: Array<{ name: string; bands: StreetSection["bands"] }> = [
  { name: "Local street 12 m", bands: [{ type: "pavement", width_m: 2.5 }, { type: "roadway", width_m: 7 }, { type: "pavement", width_m: 2.5 }] },
  { name: "Avenue 26 m", bands: [{ type: "pavement", width_m: 3 }, { type: "bike_lane", width_m: 2 }, { type: "planting", width_m: 2 }, { type: "roadway", width_m: 7 }, { type: "median", width_m: 2 }, { type: "roadway", width_m: 7 }, { type: "pavement", width_m: 3 }] },
  { name: "Shared street 8 m", bands: [{ type: "safety_zone", width_m: 1 }, { type: "roadway", width_m: 6 }, { type: "safety_zone", width_m: 1 }] },
];

export function StreetSectionsPanel() {
  const project = useEditor((s) => s.project); const setSite = useEditor((s) => s.setSite);
  const [editing, setEditing] = useState<string | null>(null);
  const near = useMemo(() => {
    if (!project) return [];
    const c = project.site.parcel ? centroid(project.site.parcel) : ([0, 0] as [number, number]);
    return project.site.streets.map((s) => ({ s, d: distPointPolyline(c, s.centreline), len: polylineLength(s.centreline) })).filter((x) => x.len > 10).sort((a, b) => a.d - b.d).slice(0, 12);
  }, [project]);
  if (!project) return null;
  const secs = project.site.street_sections; const sec = secs.find((x) => x.id === editing);
  const addFromPreset = (p: (typeof PRESETS)[number]) => { const id = nanoid(6); setSite((s) => { s.street_sections.push({ id, name: p.name, bands: JSON.parse(JSON.stringify(p.bands)) }); }); setEditing(id); };
  return (
    <div className="space-y-3 text-[12.5px]">
      <div className="flex items-center justify-between"><div className="flex items-center gap-1.5 font-semibold"><Route size={14} className="text-accent" /> Street sections</div><Chip>{secs.length}</Chip></div>
      <div className="flex flex-wrap gap-1">{PRESETS.map((p) => <Btn key={p.name} size="sm" variant="ghost" onClick={() => addFromPreset(p)}><Plus size={11} /> {p.name}</Btn>)}</div>
      {secs.map((x) => (
        <div key={x.id} className={`rounded-[12px] border p-2 ${editing === x.id ? "border-accent/60 bg-accent/10" : "border-line bg-panel"}`}>
          <div className="flex items-center gap-2">
            <button className="flex-1 text-left font-medium" onClick={() => setEditing(editing === x.id ? null : x.id)}>{x.name} <span className="text-ink-3">· {x.bands.reduce((a, b) => a + b.width_m, 0)} m</span></button>
            <button className="text-ink-3 hover:text-danger" onClick={() => setSite((s) => { s.street_sections = s.street_sections.filter((y) => y.id !== x.id); s.streets.forEach((st) => { if (st.section_id === x.id) st.section_id = undefined; }); })}><Trash2 size={12} /></button>
          </div>
          <div className="mt-1 flex h-2 overflow-hidden rounded">{x.bands.map((b, i) => <span key={i} style={{ flex: b.width_m, background: BAND_COLORS[b.type] }} />)}</div>
        </div>
      ))}
      {sec && (
        <div className="glass-soft space-y-2 rounded-[14px] p-2">
          <Field label="Name"><Input value={sec.name} onChange={(e) => setSite((s) => { const t = s.street_sections.find((y) => y.id === sec.id)!; t.name = e.target.value; })} /></Field>
          <div className="label">Bands (left → right)</div>
          {sec.bands.map((b, i) => (
            <div key={i} className="flex items-center gap-1">
              <Select value={b.type} onChange={(e) => setSite((s) => { s.street_sections.find((y) => y.id === sec.id)!.bands[i]!.type = e.target.value as StreetBandType; })}>{BAND_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}</Select>
              <Input type="number" step={0.5} className="!w-20" value={b.width_m} onChange={(e) => setSite((s) => { s.street_sections.find((y) => y.id === sec.id)!.bands[i]!.width_m = Math.max(0.5, Number(e.target.value)); })} />
              <button className="text-ink-3 hover:text-danger" onClick={() => setSite((s) => { const t = s.street_sections.find((y) => y.id === sec.id)!; if (t.bands.length > 1) t.bands.splice(i, 1); })}><Trash2 size={12} /></button>
            </div>
          ))}
          <Btn size="sm" variant="ghost" onClick={() => setSite((s) => { s.street_sections.find((y) => y.id === sec.id)!.bands.push({ type: "pavement", width_m: 2 }); })}><Plus size={11} /> Add band</Btn>
        </div>
      )}
      <Divider />
      <div className="label">Assign to nearby streets</div>
      {near.length === 0 && <div className="text-ink-3">No streets loaded. Fetch context first.</div>}
      {near.map(({ s, len }) => (
        <div key={s.id} className="flex items-center gap-2">
          <span className="flex-1 truncate text-ink-2">{s.name ?? s.class} <span className="text-ink-3">· {Math.round(len)} m</span></span>
          <Select className="!w-36" value={s.section_id ?? ""} onChange={(e) => setSite((site) => { const st = site.streets.find((y) => y.id === s.id)!; st.section_id = e.target.value || undefined; })}>
            <option value="">— none —</option>
            {secs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </Select>
        </div>
      ))}
      <div className="text-[10.5px] text-ink-3">Sections are swept along the street centreline. Editing a section updates every street that uses it. No regulatory check or traffic capacity is implied.</div>
    </div>
  );
}

const BAND_COLORS: Record<StreetBandType, string> = { pavement: "#8d949c", roadway: "#3a4047", bike_lane: "#b5533c", planting: "#2f7d4f", parking: "#4a525b", median: "#6f7780", safety_zone: "#5a616a", plot_setback: "#19e6c1" };

export function UnderlaysPanel() {
  const project = useEditor((s) => s.project); const setSite = useEditor((s) => s.setSite);
  const [status, setStatus] = useState("");
  if (!project) return null;
  const add = async (f: File) => {
    try {
      const { src, aspect } = await loadImageForUnderlay(f);
      const c = project.site.parcel ? centroid(project.site.parcel) : ([0, 0] as [number, number]);
      setSite((s) => { s.underlays.push({ id: nanoid(6), name: f.name, src, centre: c, width_m: 100, rotation_deg: 0, opacity: 0.6, aspect }); });
      setStatus("");
    } catch (e) { setStatus((e as Error).message); }
  };
  return (
    <div className="space-y-3 text-[12.5px]">
      <div className="flex items-center justify-between"><div className="flex items-center gap-1.5 font-semibold"><ImageIcon size={14} className="text-accent" /> Image underlays</div>
        <label className="cursor-pointer"><Btn size="sm" variant="ghost" onClick={(e) => (e.currentTarget.parentElement?.querySelector("input") as HTMLInputElement)?.click()}><Plus size={11} /> Add image</Btn><input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && add(e.target.files[0])} /></label></div>
      {status && <div className="text-danger">{status}</div>}
      {project.site.underlays.map((u) => (
        <div key={u.id} className="glass-soft space-y-2 rounded-[14px] p-2">
          <div className="flex items-center gap-2"><span className="flex-1 truncate font-medium">{u.name}</span><button className="text-ink-3 hover:text-danger" onClick={() => setSite((s) => { s.underlays = s.underlays.filter((x) => x.id !== u.id); })}><Trash2 size={12} /></button></div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Width (m)"><Input type="number" step={1} value={u.width_m} onChange={(e) => setSite((s) => { s.underlays.find((x) => x.id === u.id)!.width_m = Math.max(1, Number(e.target.value)); })} /></Field>
            <Field label="Rotation (°)"><Input type="number" step={1} value={u.rotation_deg} onChange={(e) => setSite((s) => { s.underlays.find((x) => x.id === u.id)!.rotation_deg = Number(e.target.value); })} /></Field>
            <Field label="Centre X (m)"><Input type="number" step={1} value={u.centre[0]} onChange={(e) => setSite((s) => { s.underlays.find((x) => x.id === u.id)!.centre[0] = Number(e.target.value); })} /></Field>
            <Field label="Centre Y (m)"><Input type="number" step={1} value={u.centre[1]} onChange={(e) => setSite((s) => { s.underlays.find((x) => x.id === u.id)!.centre[1] = Number(e.target.value); })} /></Field>
          </div>
          <Field label={`Opacity ${Math.round(u.opacity * 100)} %`}><input type="range" min={0} max={1} step={0.05} value={u.opacity} className="w-full" onChange={(e) => setSite((s) => { s.underlays.find((x) => x.id === u.id)!.opacity = Number(e.target.value); }, )} /></Field>
        </div>
      ))}
      {project.site.underlays.length === 0 && <div className="text-ink-3">Add a site plan or sketch as a ground underlay, then set its width and rotation to match the parcel.</div>}
    </div>
  );
}
