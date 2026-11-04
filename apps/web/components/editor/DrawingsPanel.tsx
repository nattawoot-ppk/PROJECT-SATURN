"use client";
import { useMemo, useState } from "react";
import { FileText, Download } from "lucide-react";
import { useEditor, activeOption } from "@/lib/store";
import { allSheets } from "@/lib/drawings/svg";
import { sheetsToPdf } from "@/lib/drawings/pdf";
import { download } from "@/lib/download";
import { Btn, Chip } from "@/components/ui";

export function DrawingsPanel() {
  const project = useEditor((s) => s.project);
  const opt = activeOption(project);
  const sheets = useMemo(() => (project && opt ? allSheets(project, opt) : []), [project, opt]);
  const [sel, setSel] = useState(0); const [busy, setBusy] = useState(false);
  if (!project || !opt) return null;
  const safe = project.name.replace(/[^A-Za-z0-9_-]+/g, "_");
  const cur = sheets[Math.min(sel, sheets.length - 1)];
  const pdf = async () => { setBusy(true); try { download(`${safe}-${opt.name}-drawings.pdf`, await sheetsToPdf(sheets)); } finally { setBusy(false); } };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><div className="flex items-center gap-1.5 text-[13px] font-semibold"><FileText size={14} className="text-accent" /> Drawing set</div><Chip>{sheets.length} sheets · A3</Chip></div>
      <div className="flex flex-wrap gap-1">{sheets.map((s, i) => <button key={s.id} className={`pill px-2.5 py-1 text-[11px] ${i === sel ? "bg-white text-black" : "bg-panel-2 text-ink-2 hover:text-ink"}`} onClick={() => setSel(i)}>{s.title}</button>)}</div>
      {cur && (
        <div className="overflow-hidden rounded-[14px] border border-line bg-white">
          <div className="aspect-[420/297] w-full" dangerouslySetInnerHTML={{ __html: cur.svg.replace(/width="420mm" height="297mm"/, 'width="100%" height="100%"') }} />
        </div>
      )}
      {cur && <div className="text-[11px] text-ink-3">{cur.subtitle} · 1:{cur.scale}</div>}
      <div className="flex flex-wrap gap-1.5">
        <Btn size="sm" variant="primary" disabled={busy} onClick={pdf}><Download size={12} /> {busy ? "Rendering…" : "PDF (all sheets)"}</Btn>
        {cur && <Btn size="sm" variant="ghost" onClick={() => download(`${safe}-${cur.id}.svg`, cur.svg, "image/svg+xml")}>SVG (this sheet)</Btn>}
      </div>
      <div className="text-[10.5px] text-ink-3">Plans show footprints, units and cores; sections cut through the parcel centroid; elevations are silhouettes with context in grey. Early-phase drawings, not for construction.</div>
    </div>
  );
}
