"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import type { Project } from "@saturn/model";
import { lonLatToLocal, ensureCCW } from "@saturn/geometry";
import { saveProject } from "@/lib/storage";
import { fetchOsmContext } from "@/lib/providers/context";
import type { SitePick } from "@/components/map/SiteMap";

const SiteMap = dynamic(() => import("@/components/map/SiteMap"), { ssr: false, loading: () => <div className="h-[420px] rounded border border-slate-800" /> });

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
      site: { origin, context_radius_m: radius, parcel, parcel_source: "drawn", context_buildings: [], streets: [], zoning: { source: "manual", setbacks: [], default_setback_m: 0, custom: {} } },
      options: [{ id: "opt1", name: "Option A", buildings: [], created_at: now, updated_at: now }], active_option_id: "opt1",
      settings: { avg_unit_area_m2: 70, residents_per_unit: 2.2, storey_height_m: 3.2, currency: "EUR", rule_pack_id: "generic-international" },
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
    <main className="mx-auto max-w-4xl p-8">
      <Link href="/" className="text-sm text-slate-400 hover:text-white">← Projects</Link>
      <h1 className="mb-4 mt-2 text-xl font-semibold">New project</h1>
      <div className="space-y-4">
        <label className="block space-y-1"><span className="text-xs uppercase tracking-wide text-slate-400">Project name</span><input className="w-full rounded bg-slate-800 px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <SiteMap value={pick} onChange={setPick} />
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">Context radius <input type="number" className="w-20 rounded bg-slate-800 px-2 py-1" value={radius} step={50} onChange={(e) => setRadius(Number(e.target.value))} /> m</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={fetchCtx} onChange={(e) => setFetchCtx(e.target.checked)} /> Fetch OSM buildings & streets</label>
          <span className="text-slate-500">{pick.parcelLonLat ? `Parcel: ${pick.parcelLonLat.length} corners` : "No parcel yet (you can draw it later in 3D)"}</span>
        </div>
        <button disabled={!!busy} className="rounded bg-sky-600 px-4 py-2 font-medium hover:bg-sky-500 disabled:opacity-50" onClick={create}>{busy ? "Creating…" : "Create project"}</button>
        {busy && <div className="text-xs text-slate-400">{busy}</div>}
      </div>
    </main>
  );
}
