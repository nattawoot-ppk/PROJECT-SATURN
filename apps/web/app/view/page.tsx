"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useEditor } from "@/lib/store";
import { readShareHash } from "@/lib/share";
import { useDerived } from "@/components/editor/Panels";
import { Chip, StatTile } from "@/components/ui";
import AnalysisBar from "@/components/editor/AnalysisBar";

const Scene3D = dynamic(() => import("@/components/editor/Scene3D"), { ssr: false });

export default function ViewPage() {
  const load = useEditor((s) => s.load); const project = useEditor((s) => s.project); const [missing, setMissing] = useState(false);
  useEffect(() => { const p = readShareHash(window.location.hash); if (p) { useEditor.setState({ readonly: true }); load(p); } else setMissing(true); }, [load]);
  const d = useDerived();
  if (missing) return <main className="dots p-8 text-ink-2">This link does not contain a readable project. <Link className="text-accent" href="/">Open Saturn</Link></main>;
  if (!project || !d) return <main className="dots p-8 text-ink-3">Loading…</main>;
  return (
    <div className="dots flex h-screen flex-col">
      <header className="flex h-14 items-center gap-3 px-4">
        <div className="glass-soft pill flex items-center gap-2 px-3 py-1.5"><span className="h-2 w-2 rounded-full bg-accent" /><span className="text-[13px] font-semibold">{project.name}</span><span className="text-[11px] text-ink-3">/ {d.opt.name}</span></div>
        <Chip tone="neutral">Read-only share</Chip>
        <Chip tone={d.compliance.errors ? "danger" : "teal"}>{d.compliance.errors ? `${d.compliance.errors} code errors` : "Compliant"}</Chip>
        <Link href="/" className="ml-auto text-[12px] text-ink-2 hover:text-ink">Open in Saturn →</Link>
      </header>
      <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3">
        <main className="relative min-w-0 flex-1 overflow-hidden rounded-[22px] border border-line bg-bg-2"><Scene3D /><AnalysisBar /></main>
        <aside className="glass w-[300px] space-y-2 rounded-[22px] p-4">
          <div className="label">Key figures</div>
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="GFA" value={Math.round(d.kpis.gfa_m2).toLocaleString()} unit="m²" tone="accent" />
            <StatTile label="FAR" value={d.kpis.far.toFixed(2)} unit="×" tone="teal" />
            <StatTile label="Units" value={String(d.kpis.unit_count)} />
            <StatTile label="Height" value={d.kpis.max_height_m.toFixed(1)} unit="m" />
            <StatTile label="Coverage" value={d.kpis.coverage_pct.toFixed(0)} unit="%" />
            <StatTile label="Buildings" value={String(d.kpis.building_count)} />
          </div>
          <div className="pt-2 text-[10.5px] text-ink-3">Shared from Saturn. Analyses can be re-run here; edits are not saved.</div>
        </aside>
      </div>
    </div>
  );
}
