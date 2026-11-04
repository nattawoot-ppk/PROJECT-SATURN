"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listProjects, saveProject, deleteProject, type ProjectSummary } from "@/lib/storage";
import { sampleProject, parseProject } from "@saturn/model";
import { nanoid } from "nanoid";

export default function Dashboard() {
  const [items, setItems] = useState<ProjectSummary[]>([]); const router = useRouter();
  useEffect(() => { setItems(listProjects()); }, []);
  const loadSample = () => { const p = sampleProject(); p.id = nanoid(8); p.name = "Sample: bar + point block"; saveProject(p); router.push(`/project/${p.id}`); };
  const importJson = async (f: File) => { try { const p = parseProject(JSON.parse(await f.text())); p.id = nanoid(8); saveProject(p); router.push(`/project/${p.id}`); } catch (e) { alert(`Invalid project file: ${(e as Error).message}`); } };
  return (
    <main className="mx-auto max-w-4xl p-8">
      <header className="mb-8 flex items-end justify-between">
        <div><h1 className="text-2xl font-semibold">Saturn</h1><p className="text-sm text-slate-400">Early-phase building design: site, massing, KPIs, code checks.</p></div>
        <div className="flex gap-2">
          <label className="cursor-pointer rounded bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700">Import JSON<input type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} /></label>
          <button className="rounded bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700" onClick={loadSample}>Open sample</button>
          <Link href="/new" className="rounded bg-sky-600 px-3 py-2 text-sm font-medium hover:bg-sky-500">New project</Link>
        </div>
      </header>
      {items.length === 0 ? (
        <div className="rounded border border-dashed border-slate-700 p-10 text-center text-slate-400">No projects yet. Create one from a map location, or open the sample.</div>
      ) : (
        <ul className="divide-y divide-slate-800 rounded border border-slate-800">
          {items.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-900">
              <Link href={`/project/${p.id}`} className="flex-1"><div className="font-medium">{p.name}</div><div className="text-xs text-slate-500">{p.buildings} buildings · updated {new Date(p.updated_at).toLocaleString()}</div></Link>
              <button className="text-xs text-slate-500 hover:text-rose-300" onClick={() => { if (confirm(`Delete "${p.name}"?`)) { deleteProject(p.id); setItems(listProjects()); } }}>Delete</button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-xs text-slate-600">Projects are stored in this browser (Phase 1). Accounts and cloud storage arrive in Phase 2.</p>
    </main>
  );
}
