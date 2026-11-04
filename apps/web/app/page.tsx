"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload, Sparkles, Trash2, ArrowUpRight, Building2 } from "lucide-react";
import { listProjects, saveProject, deleteProject, type ProjectSummary } from "@/lib/storage";
import { sampleProject, parseProject } from "@saturn/model";
import { nanoid } from "nanoid";
import { Btn, StatTile, Chip } from "@/components/ui";
import { api, cloudEnabled, getToken } from "@/lib/api";
import { useCloud } from "@/lib/cloud";

export default function Dashboard() {
  const [items, setItems] = useState<ProjectSummary[]>([]); const router = useRouter();
  const cloud = useCloud(); const [cloudItems, setCloudItems] = useState<Array<{ id: string; name: string; updatedAt: string; version: number }>>([]);
  const refresh = cloud.refresh;
  useEffect(() => { setItems(listProjects()); refresh().then(() => { if (cloudEnabled() && getToken()) api.listProjects().then(setCloudItems).catch(() => setCloudItems([])); }); }, [refresh]);
  const openCloud = async (id: string) => { const r = await api.getProject(id); saveProject(r.document); useCloud.getState().bind(r.id, r.version); router.push(`/project/${r.document.id}`); };
  const loadSample = () => { const p = sampleProject(); p.id = nanoid(8); p.name = "Sample: bar + point block"; saveProject(p); router.push(`/project/${p.id}`); };
  const importJson = async (f: File) => { try { const p = parseProject(JSON.parse(await f.text())); p.id = nanoid(8); saveProject(p); router.push(`/project/${p.id}`); } catch (e) { alert(`Invalid project file: ${(e as Error).message}`); } };
  const totalBuildings = items.reduce((a, p) => a + p.buildings, 0);
  return (
    <main className="dots-warm min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_24px_rgba(255,90,31,0.45)]"><Building2 size={18} /></div>
            <div><div className="text-[15px] font-semibold tracking-tight">SATURN</div><div className="label">Early-phase building design</div></div>
          </div>
          <div className="flex items-center gap-2">
            <label className="cursor-pointer"><Btn variant="ghost" onClick={(e) => (e.currentTarget.parentElement?.querySelector("input") as HTMLInputElement)?.click()}><Upload size={14} /> Import JSON</Btn><input type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} /></label>
            <Btn variant="ghost" onClick={loadSample}><Sparkles size={14} /> Open sample</Btn>
            {cloudEnabled() && (cloud.me ? <Chip tone="teal">{cloud.me.user.email}</Chip> : <Link href="/auth"><Btn variant="outline">Sign in</Btn></Link>)}
            <Link href="/new"><Btn variant="primary"><Plus size={14} /> New project</Btn></Link>
          </div>
        </header>

        <section className="glass mb-8 rounded-[24px] p-8">
          <div className="grid gap-8 md:grid-cols-[1.4fr_1fr]">
            <div>
              <h1 className="text-[40px] font-semibold leading-[1.05] tracking-tight">
                <span className="text-ink-3">●</span> From site<br /><span className="text-ink-3">to</span> <span className="text-accent">building permit</span><br />in one model.
              </h1>
              <p className="mt-4 max-w-md text-[14px] text-ink-2">Click a location, sketch or generate massing, and watch areas, code checks, sun and daylight update as you work. Export to Excel, DXF and BIM.</p>
              <div className="mt-6 flex gap-2"><Link href="/new"><Btn variant="primary">Start a study <ArrowUpRight size={14} /></Btn></Link><Btn variant="outline" onClick={loadSample}>Try the sample</Btn></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Projects" value={String(items.length)} hint="stored in this browser" bars={[3, 5, 4, 7, 6, 9, 8]} />
              <StatTile label="Buildings" value={String(totalBuildings)} tone="teal" hint="across all projects" />
              <StatTile label="Analyses" value="3" unit="live" hint="shadows · sun hours · daylight" />
              <StatTile label="Rule packs" value="1" hint="generic international" tone="accent" />
            </div>
          </div>
        </section>

        <div className="mb-3 flex items-center justify-between"><div className="label">Projects</div><Chip tone="neutral">{items.length} total</Chip></div>
        {items.length === 0 ? (
          <div className="glass-soft rounded-[18px] p-12 text-center text-ink-2">No projects yet. Create one from a map location, or open the sample.</div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <li key={p.id} className="glass group relative rounded-[18px] p-4 transition hover:border-accent/50">
                <Link href={`/project/${p.id}`} className="block">
                  <div className="mb-6 flex items-center justify-between"><Chip tone="teal">{p.buildings} buildings</Chip><ArrowUpRight size={16} className="text-ink-3 transition group-hover:text-accent" /></div>
                  <div className="text-[15px] font-semibold tracking-tight">{p.name}</div>
                  <div className="mt-1 text-[11px] text-ink-3">Updated {new Date(p.updated_at).toLocaleString()}</div>
                </Link>
                <button className="absolute bottom-4 right-4 text-ink-3 opacity-0 transition hover:text-danger group-hover:opacity-100" title="Delete" onClick={() => { if (confirm(`Delete "${p.name}"?`)) { deleteProject(p.id); setItems(listProjects()); } }}><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
        {cloudItems.length > 0 && (
          <>
            <div className="mb-3 mt-8 flex items-center justify-between"><div className="label">Cloud projects</div><Chip tone="teal">{cloudItems.length}</Chip></div>
            <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{cloudItems.map((p) => <li key={p.id} className="glass rounded-[18px] p-4"><button className="w-full text-left" onClick={() => openCloud(p.id)}><div className="mb-4 flex items-center justify-between"><Chip tone="teal">v{p.version}</Chip><ArrowUpRight size={16} className="text-ink-3" /></div><div className="text-[15px] font-semibold">{p.name}</div><div className="mt-1 text-[11px] text-ink-3">Saved {new Date(p.updatedAt).toLocaleString()}</div></button></li>)}</ul>
          </>
        )}
        <p className="mt-10 text-[11px] text-ink-3">{cloudEnabled() ? "Projects are stored in this browser until you save them to the cloud." : "Projects are stored in this browser. Configure NEXT_PUBLIC_API_URL to enable accounts and cloud storage."}</p>
      </div>
    </main>
  );
}
