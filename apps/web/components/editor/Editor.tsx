"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useEditor, activeOption, type Tool } from "@/lib/store";
import { KpiPanel, CompliancePanel, ZoningPanel, BuildingPanel, OptionsPanel, SitePanel, useDerived } from "./Panels";
import { exportObj } from "@/lib/export/obj";
import { exportDxf } from "@/lib/export/dxf";
import { exportExcel } from "@/lib/export/excel";
import { download } from "@/lib/download";
import AnalysisBar from "./AnalysisBar";

const Scene3D = dynamic(() => import("./Scene3D"), { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-slate-500">Loading 3D…</div> });

const tools: Array<{ id: Tool; label: string; key: string }> = [
  { id: "select", label: "Select / move", key: "V" },
  { id: "draw-polygon", label: "Draw polygon building", key: "P" },
  { id: "draw-rect", label: "Draw rectangle building", key: "R" },
  { id: "draw-parcel", label: "Draw parcel", key: "L" },
];

export default function Editor() {
  const project = useEditor((s) => s.project); const tool = useEditor((s) => s.tool); const setTool = useEditor((s) => s.setTool);
  const panel = useEditor((s) => s.panel); const setPanel = useEditor((s) => s.setPanel);
  const { undo, redo, finishDraft, cancelDraft, deleteBuilding, mutate } = useEditor();
  const d = useDerived();
  const [exp, setExp] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName; if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (e.key === "Escape") { cancelDraft(); useEditor.getState().select(null); return; }
      if (e.key === "Enter") { finishDraft(); return; }
      if (e.key === "Delete" || e.key === "Backspace") { const id = useEditor.getState().selectedId; if (id) deleteBuilding(id); return; }
      const k = e.key.toUpperCase(); const t = tools.find((x) => x.key === k); if (t) setTool(t.id);
      const sel = useEditor.getState().selectedId; const b = activeOption(useEditor.getState().project)?.buildings.find((x) => x.id === sel);
      if (b && (e.key === "+" || e.key === "=")) useEditor.getState().setStoreys(b.id, b.storeys.length + 1);
      if (b && e.key === "-") useEditor.getState().setStoreys(b.id, b.storeys.length - 1);
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [undo, redo, finishDraft, cancelDraft, deleteBuilding, setTool]);

  if (!project || !d) return null;
  const opt = d.opt; const safe = project.name.replace(/[^A-Za-z0-9_-]+/g, "_");
  const panels: Array<{ id: typeof panel; label: string; badge?: string }> = [
    { id: "kpi", label: "KPIs" },
    { id: "compliance", label: "Checks", badge: d.compliance.errors ? String(d.compliance.errors) : undefined },
    { id: "zoning", label: "Zoning" },
    { id: "building", label: "Building" },
    { id: "options", label: "Options" },
    { id: "site", label: "Site" },
  ];
  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex h-12 items-center gap-3 border-b border-slate-800 px-3">
        <Link href="/" className="text-sm text-slate-400 hover:text-white">← Projects</Link>
        <input className="bg-transparent text-sm font-semibold focus:outline-none" value={project.name} onChange={(e) => mutate((p) => { p.name = e.target.value; }, { history: false })} />
        <span className="text-xs text-slate-500">· {opt.name}</span>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className={`rounded px-2 py-0.5 ${d.compliance.errors ? "bg-rose-600/30 text-rose-200" : "bg-emerald-600/30 text-emerald-200"}`}>{d.compliance.errors ? `${d.compliance.errors} code errors` : "Compliant"}</span>
          <span className="font-mono text-slate-300">GFA {Math.round(d.kpis.gfa_m2).toLocaleString()} m² · FAR {d.kpis.far.toFixed(2)} · {d.kpis.unit_count} units</span>
          <button className="rounded bg-slate-800 px-2 py-1 hover:bg-slate-700" onClick={undo} title="Ctrl+Z">Undo</button>
          <button className="rounded bg-slate-800 px-2 py-1 hover:bg-slate-700" onClick={redo} title="Ctrl+Shift+Z">Redo</button>
          <div className="relative">
            <button className="rounded bg-sky-600 px-3 py-1 font-medium hover:bg-sky-500" onClick={() => setExp(!exp)}>Export ▾</button>
            {exp && (
              <div className="absolute right-0 z-20 mt-1 w-56 rounded border border-slate-700 bg-slate-900 p-1 shadow-xl" onMouseLeave={() => setExp(false)}>
                {[
                  { l: "OBJ (3D mesh)", f: () => download(`${safe}-${opt.name}.obj`, exportObj(opt, project.site, true)) },
                  { l: "DXF (3D faces + plans)", f: () => download(`${safe}-${opt.name}.dxf`, exportDxf(opt, project.site, true), "application/dxf") },
                  { l: "Excel (KPIs, schedules, checks)", f: () => download(`${safe}.xlsx`, exportExcel(project)) },
                  { l: "Project JSON", f: () => download(`${safe}.saturn.json`, JSON.stringify(project, null, 2), "application/json") },
                ].map((x) => <button key={x.l} className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-slate-800" onClick={() => { x.f(); setExp(false); }}>{x.l}</button>)}
                <div className="px-2 pt-1 text-[10px] text-slate-500">IFC, Rhino 3DM, dotBIM and PDF drawings arrive in Phase 3.</div>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-12 flex-col items-center gap-1 border-r border-slate-800 py-2">
          {tools.map((t) => <button key={t.id} title={`${t.label} (${t.key})`} className={`flex h-9 w-9 items-center justify-center rounded text-xs font-bold ${tool === t.id ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`} onClick={() => setTool(t.id)}>{t.key}</button>)}
          <div className="mt-auto px-1 text-center text-[9px] leading-tight text-slate-600">Dbl-click or Enter to finish · Esc cancels · +/- storeys</div>
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1"><Scene3D />
            {tool !== "select" && <div className="pointer-events-none absolute left-3 top-3 rounded bg-slate-900/80 px-3 py-1 text-xs text-slate-200">{tools.find((t) => t.id === tool)?.label}: click to place points{tool === "draw-rect" ? " (two corners)" : ", double-click or Enter to finish"}.</div>}
          </div>
          <AnalysisBar />
        </main>
        <aside className="flex w-80 flex-col border-l border-slate-800">
          <nav className="flex border-b border-slate-800 text-xs">
            {panels.map((p) => <button key={p.id} className={`flex-1 px-1 py-2 ${panel === p.id ? "border-b-2 border-sky-500 text-white" : "text-slate-400 hover:text-white"}`} onClick={() => setPanel(p.id)}>{p.label}{p.badge && <span className="ml-1 rounded bg-rose-600 px-1 text-[10px]">{p.badge}</span>}</button>)}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {panel === "kpi" && <KpiPanel />}
            {panel === "compliance" && <CompliancePanel />}
            {panel === "zoning" && <ZoningPanel />}
            {panel === "building" && <BuildingPanel />}
            {panel === "options" && <OptionsPanel />}
            {panel === "site" && <SitePanel />}
          </div>
        </aside>
      </div>
    </div>
  );
}
