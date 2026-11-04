"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { ArrowLeft, MapPin } from "lucide-react";
import type { Project } from "@saturn/model";
import { lonLatToLocal, ensureCCW } from "@saturn/geometry";
import { saveProject } from "@/lib/storage";
import { fetchOsmContext } from "@/lib/providers/context";
import type { SitePick } from "@/components/map/SiteMap";
import { Btn, Field, Input, Panel, Chip } from "@/components/ui";

const SiteMap = dynamic(() => import("@/components/map/SiteMap"), { ssr: false, loading: () => <div className="h-[460px] rounded-[16px] border border-line" /> });

export default function NewProject() {
  const router = useRouter();
  const [name, setName] = useState("New feasibility study");
  const [pick, setPick] = useState<SitePick>({ lat: 13.7563, lon: 100.5018, parcelLonLat: null });
  const [radius, setRadius] = useState(300); const [fetchCtx, setFetchCtx] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const create = async () => {
    const now = new Date().toISOString(); const id = nanoid(8);
    const origin = { lat: pick.lat, lon: pick.lon };
    const parcel = pick.parcelLonLat ? ensureCCW(pick.parcelLonLat.map(([lon, lat]) => lonLatToLocal(origin, lon, lat))) : undefined;
    const project: Project = {
      id, schema_version: 1, name, jurisdiction: "generic", tags: [],
      site: { origin, context_radius_m: radius, parcel, parcel_source: "drawn", context_buildings: [], streets: [], street_sections: [], underlays: [], zoning: { source: "manual", setbacks: [], default_setback_m: 0, custom: {} } },
      options: [{ id: "opt1", name: "Option A", buildings: [], created_at: now, updated_at: now }], active_option_id: "opt1",
      settings: { avg_unit_area_m2: 70, residents_per_unit: 2.2, storey_height_m: 3.2, currency: "EUR", rule_pack_id: "generic-international", custom_rules: [] },
      created_at: now, updated_at: now,
    };
    if (fetchCtx) {
      setBusy("Fetching surrounding buildings and streets from OpenStreetMap…");
      try { const r = await fetchOsmContext(origin, radius); project.site.context_buildings = r.buildings; project.site.streets = r.streets; }
      catch (e) { setBusy(`Context fetch failed (${(e as Error).message}); continuing without context.`); await new Promise((r) => setTimeout(r, 1200)); }
    }
    saveProject(project); router.push(`/project/${id}`);
  };

  return (
    <main className="dots-warm min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Link href="/" className="inline-flex items-center gap-1 text-[12px] text-ink-2 hover:text-ink"><ArrowLeft size={14} /> Projects</Link>
        <div className="mb-6 mt-3 flex items-end justify-between">
          <div><h1 className="text-[28px] font-semibold tracking-tight">New project</h1><p className="text-[13px] text-ink-2">Pick the site on the map, outline the parcel, and we fetch the surroundings.</p></div>
          <Chip tone="accent"><MapPin size={12} /> {pick.lat.toFixed(4)}, {pick.lon.toFixed(4)}</Chip>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <Panel><SiteMap value={pick} onChange={setPick} /></Panel>
          <div className="space-y-4">
            <Panel title="Project">
              <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Context radius (m)" className="mt-3"><Input type="number" value={radius} step={50} onChange={(e) => setRadius(Number(e.target.value))} /></Field>
              <label className="mt-3 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={fetchCtx} onChange={(e) => setFetchCtx(e.target.checked)} /> Fetch OSM buildings & streets</label>
            </Panel>
            <Panel title="Status">
              <div className="text-[13px] text-ink-2">{pick.parcelLonLat ? `Parcel outlined with ${pick.parcelLonLat.length} corners.` : "No parcel yet. You can also draw it later in the 3D view."}</div>
              {busy && <div className="mt-2 text-[12px] text-amber">{busy}</div>}
            </Panel>
            <Btn variant="primary" className="w-full py-2.5" disabled={!!busy} onClick={create}>{busy ? "Creating…" : "Create project"}</Btn>
          </div>
        </div>
      </div>
    </main>
  );
}
