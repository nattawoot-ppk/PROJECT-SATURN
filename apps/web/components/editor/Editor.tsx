"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MousePointer2, Pentagon, Square, LandPlot, Undo2, Redo2, Download, ArrowLeft, Camera, ChevronDown } from "lucide-react";
import { useEditor, activeOption, type Tool } from "@/lib/store";
import { KpiPanel, CompliancePanel, ZoningPanel, BuildingPanel, OptionsPanel, SitePanel, useDerived } from "./Panels";
import { DrawingsPanel } from "./DrawingsPanel";
import { PerformancePanel } from "./PerformancePanel";
import { CloudPanel } from "./CloudPanel";
import { exportIfc } from "@/lib/export/ifc";
import { exportDotbim } from "@/lib/export/dotbim";
import { exportGlb } from "@/lib/export/gltf";
import { exportRhino3dm } from "@/lib/export/rhino";
import { XRButton } from "./XRButton";
import { exportObj } from "@/lib/export/obj";
import { exportDxf } from "@/lib/export/dxf";
import { exportExcel } from "@/lib/export/excel";
import { download } from "@/lib/download";
import AnalysisBar from "./AnalysisBar";
import { Btn, Chip, IconBtn, Segmented } from "@/components/ui";
import { makeShareUrl } from "@/lib/share";
import { Share2 } from "lucide-react";
import { useCloud } from "@/lib/cloud";
import { api, cloudEnabled } from "@/lib/api";

const Scene3D = dynamic(() => import("./Scene3D"), { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-ink-3">Loading 3D…</div> });

const tools: Array<{ id: Tool; label: string; key: string; icon: React.ReactNode }> = [
  { id: "select", label: "Select / move", key: "V", icon: <MousePointer2 size={16} /> },
  { id: "draw-polygon", label: "Draw polygon building", key: "P", icon: <Pentagon size={16} /> },
  { id: "draw-rect", label: "Draw rectangle building", key: "R", icon: <Square size={16} /> },
  { id: "draw-parcel", label: "Draw parcel", key: "L", icon: <LandPlot size={16} /> },
];

export default function Editor() {
  const project = useEditor((s) => s.project); const tool = useEditor((s) => s.tool); const setTool = useEditor((s) => s.setTool);
  const panel = useEditor((s) => s.panel); const setPanel = useEditor((s) => s.setPanel);
  const { undo, redo, finishDraft, cancelDraft, deleteBuilding, mutate } = useEditor();
  const d = useDerived();
  const [exp, setExp] = useState(false);
  const cloud = useCloud();
  // Export gating mirrors the pricing table once the cloud is configured and the user is signed in: Free and Starter need Pro/Business or a day pass.
  const gated = cloudEnabled() && !!cloud.me && cloud.entitlements !== null && !cloud.entitlements.exports;

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
  const snapshot = () => { const c = document.querySelector("canvas") as HTMLCanvasElement | null; if (!c) return; c.toBlob((b) => b && download(`${safe}-${opt.name}.png`, b)); };
  const panels = [
    { id: "kpi" as const, label: "KPIs" }, { id: "compliance" as const, label: "Checks", badge: d.compliance.errors ? String(d.compliance.errors) : undefined },
    { id: "zoning" as const, label: "Zoning" }, { id: "building" as const, label: "Building" }, { id: "options" as const, label: "Options" }, { id: "site" as const, label: "Site" }, { id: "performance" as const, label: "Performance" }, { id: "drawings" as const, label: "Drawings" }, { id: "cloud" as const, label: "Cloud" },
  ];
  return (
    <div className="dots flex h-screen flex-col text-ink">
      <header className="flex h-14 items-center gap-3 px-4">
        <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-panel text-ink-2 hover:text-ink"><ArrowLeft size={16} /></Link>
        <div className="glass-soft pill flex items-center gap-2 px-3 py-1.5">
          <span className="h-2 w-2 rounded-full bg-accent" />
          <input className="w-44 min-w-0 bg-transparent text-[13px] font-semibold tracking-tight focus:outline-none" value={project.name} onChange={(e) => mutate((p) => { p.name = e.target.value; }, { history: false })} />
          <span className="whitespace-nowrap text-[11px] text-ink-3">/ {opt.name}</span>
        </div>
        <Segmented value={panel} options={panels} onChange={setPanel} className="ml-2" />
        <div className="ml-auto flex items-center gap-2">
          <Chip tone={d.compliance.errors ? "danger" : "teal"}>{d.compliance.errors ? `${d.compliance.errors} code errors` : "Compliant"}</Chip>
          <span className="mono hidden whitespace-nowrap text-[11.5px] text-ink-2 xl:inline">GFA {Math.round(d.kpis.gfa_m2).toLocaleString()} m² · FAR {d.kpis.far.toFixed(2)} · {d.kpis.unit_count} units</span>
          <IconBtn onClick={undo} title="Undo (Ctrl+Z)"><Undo2 size={15} /></IconBtn>
          <IconBtn onClick={redo} title="Redo (Ctrl+Shift+Z)"><Redo2 size={15} /></IconBtn>
          <XRButton />
          <IconBtn onClick={snapshot} title="Snapshot PNG"><Camera size={15} /></IconBtn>
          <IconBtn onClick={() => { const { url, bytes } = makeShareUrl(project, window.location.origin); navigator.clipboard?.writeText(url).then(() => alert(`Read-only link copied (${Math.round(bytes / 1024)} KB).`), () => prompt("Read-only link:", url)); }} title="Copy read-only share link"><Share2 size={15} /></IconBtn>
          <div className="relative">
            <Btn variant="primary" onClick={() => setExp(!exp)}><Download size={14} /> Export <ChevronDown size={12} /></Btn>
            {exp && (
              <div className="glass absolute right-0 z-20 mt-2 w-64 rounded-[14px] p-1.5" onMouseLeave={() => setExp(false)}>
                {[
                  { l: "OBJ · 3D mesh", f: () => download(`${safe}-${opt.name}.obj`, exportObj(opt, project.site, true)) },
                  { l: "DXF · 3D faces + plans", f: () => download(`${safe}-${opt.name}.dxf`, exportDxf(opt, project.site, true), "application/dxf") },
                  { l: "IFC 4 · storeys, walls, slabs, spaces", f: () => download(`${safe}-${opt.name}.ifc`, exportIfc(project, opt), "application/x-step") },
                  { l: "dotBIM · .bim meshes with metadata", f: () => download(`${safe}-${opt.name}.bim`, exportDotbim(project, opt, true), "application/json") },
                  { l: "Rhino 3DM · layers per building, units, context", f: () => exportRhino3dm(project, opt, true).then((bytes) => download(`${safe}-${opt.name}.3dm`, new Blob([bytes as BlobPart], { type: "application/octet-stream" }))) },
                  { l: "glTF binary · for viewers and VR", f: () => exportGlb(project, opt, true).then((b) => download(`${safe}-${opt.name}.glb`, b)) },
                  { l: "Excel · KPIs, schedules, checks", f: () => download(`${safe}.xlsx`, exportExcel(project)) },
                  { l: "Project JSON", f: () => download(`${safe}.saturn.json`, JSON.stringify(project, null, 2), "application/json") },
                ].map((x) => { const free = x.l.startsWith("Project JSON"); const locked = gated && !free; return <button key={x.l} className={`block w-full rounded-[10px] px-2.5 py-1.5 text-left text-[12.5px] hover:bg-white/10 ${locked ? "opacity-50" : ""}`} onClick={async () => { if (locked) { const org = cloud.me?.orgs[0]; if (org && confirm(`Exports need the Pro plan or a €30 day pass (plan: ${cloud.entitlements?.plan}). Buy a day pass now?`)) { try { const r = await api.daypass(org.id); window.location.href = r.url; } catch (e) { alert((e as Error).message); } } return; } x.f(); setExp(false); }}>{locked ? "🔒 " : ""}{x.l}</button>; })}
                <div className="px-2.5 pt-1 text-[10px] text-ink-3">PDF drawings are in the Drawings panel.</div>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3">
        <main className="relative min-w-0 flex-1 overflow-hidden rounded-[22px] border border-line bg-bg-2">
          <Scene3D />
          <div className="glass pill absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 p-1.5">
            {tools.map((t) => <IconBtn key={t.id} active={tool === t.id} title={`${t.label} (${t.key})`} onClick={() => setTool(t.id)}>{t.icon}</IconBtn>)}
            <span className="mx-1 h-6 w-px bg-line-2" />
            <span className="px-2 text-[10.5px] text-ink-3">Dbl-click / Enter finish · Esc cancel · +/− storeys</span>
          </div>
          {tool !== "select" && <div className="glass-soft pill pointer-events-none absolute left-3 top-3 px-3 py-1 text-[11.5px] text-ink">{tools.find((t) => t.id === tool)?.label}: click to place points{tool === "draw-rect" ? " (two corners)" : ", double-click or Enter to finish"}.</div>}
          <AnalysisBar />
        </main>
        <aside className="glass flex w-[340px] flex-col rounded-[22px]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3"><div className="label">{panels.find((p) => p.id === panel)?.label}</div><span className="text-[10.5px] text-ink-3">{project.settings.rule_pack_id}</span></div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {panel === "kpi" && <KpiPanel />}
            {panel === "compliance" && <CompliancePanel />}
            {panel === "zoning" && <ZoningPanel />}
            {panel === "building" && <BuildingPanel />}
            {panel === "options" && <OptionsPanel />}
            {panel === "site" && <SitePanel />}
            {panel === "drawings" && <DrawingsPanel />}
            {panel === "performance" && <PerformancePanel />}
            {panel === "cloud" && <CloudPanel />}
          </div>
        </aside>
      </div>
    </div>
  );
}
