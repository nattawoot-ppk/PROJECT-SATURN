"use client";
import { useState } from "react";
import { nanoid } from "nanoid";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import { useEditor } from "@/lib/store";
import { evaluate, type CustomRule } from "@saturn/model";
import { useDerived } from "./Panels";
import { Btn, Chip, Field, Input, Select } from "@/components/ui";

const EXAMPLES = [
  { title: "Client brief: max units", expr: "kpi.unit_count <= 120", scope: "site", message: "{kpi.unit_count} units; brief allows 120" },
  { title: "Min storeys", expr: "building.storeys >= 4", scope: "building", message: "{building.name} has only {building.storeys} storeys" },
  { title: "Parking ratio ≥ 0.8", expr: "kpi.parking_ratio >= 0.8", scope: "site", message: "Parking ratio {kpi.parking_ratio} per unit" },
  { title: "Compact envelope", expr: "kpi.envelope_ratio <= 1.0", scope: "site", message: "Façade/GFA {kpi.envelope_ratio}" },
] as const;

/** Project-level rules: expressions over KPIs, zoning and building figures, evaluated with the pack on every edit. */
export function CustomRulesPanel() {
  const project = useEditor((s) => s.project)!; const mutate = useEditor((s) => s.mutate); const d = useDerived();
  const rules = project.settings.custom_rules; const [draft, setDraft] = useState<CustomRule>({ id: "", title: "", severity: "warning", scope: "site", expr: "", message: "", enabled: true });
  const ctx = d ? { kpi: d.kpis, zoning: project.site.zoning, settings: project.settings, building: { name: "Example", storeys: 5, height_m: 16, gfa_m2: 2000, footprint_m2: 400, category: "residential" } } : {};
  const check = (expr: string): string => { if (!expr.trim()) return ""; try { const v = evaluate(expr, ctx); return typeof v === "boolean" ? (v ? "passes now" : "fails now") : `evaluates to ${String(v)} (should be true/false)`; } catch (e) { return `error: ${(e as Error).message}`; } };
  const add = () => { if (!draft.title || !draft.expr) return; mutate((p) => { p.settings.custom_rules.push({ ...draft, id: nanoid(6) }); }); setDraft({ id: "", title: "", severity: "warning", scope: "site", expr: "", message: "", enabled: true }); };
  const update = (id: string, fn: (r: CustomRule) => void) => mutate((p) => { const r = p.settings.custom_rules.find((x) => x.id === id); if (r) fn(r); });
  return (
    <div className="space-y-3 text-[12.5px]">
      <div className="flex items-center justify-between"><div className="flex items-center gap-1.5 font-semibold"><ShieldCheck size={14} className="text-accent" /> Custom rules</div><Chip>{rules.length}</Chip></div>
      {rules.map((r) => (
        <div key={r.id} className={`space-y-1 rounded-[12px] border p-2 ${r.enabled ? "border-line bg-panel" : "border-line opacity-60"}`}>
          <div className="flex items-center gap-2"><input type="checkbox" checked={r.enabled} onChange={(e) => update(r.id, (x) => { x.enabled = e.target.checked; })} /><input className="flex-1 bg-transparent font-medium focus:outline-none" value={r.title} onChange={(e) => update(r.id, (x) => { x.title = e.target.value; })} /><Chip tone={r.severity === "error" ? "danger" : r.severity === "warning" ? "amber" : "teal"}>{r.severity}</Chip><button className="text-ink-3 hover:text-danger" onClick={() => mutate((p) => { p.settings.custom_rules = p.settings.custom_rules.filter((x) => x.id !== r.id); })}><Trash2 size={12} /></button></div>
          <input className="mono w-full rounded-[8px] border border-line bg-black/30 px-2 py-1 text-[11.5px]" value={r.expr} onChange={(e) => update(r.id, (x) => { x.expr = e.target.value; })} />
          <div className="text-[10.5px] text-ink-3">{r.scope} · {check(r.expr)}</div>
        </div>
      ))}
      <div className="glass-soft space-y-2 rounded-[14px] p-2">
        <div className="label">New rule</div>
        <div className="flex flex-wrap gap-1">{EXAMPLES.map((e) => <button key={e.title} className="pill bg-panel-2 px-2 py-0.5 text-[10.5px] text-ink-2 hover:text-ink" onClick={() => setDraft({ ...draft, title: e.title, expr: e.expr, scope: e.scope, message: e.message })}>{e.title}</button>)}</div>
        <Field label="Title"><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Severity"><Select value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value as CustomRule["severity"] })}><option value="error">error</option><option value="warning">warning</option><option value="info">info</option></Select></Field>
          <Field label="Scope"><Select value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value as CustomRule["scope"] })}><option value="site">site (kpi.*)</option><option value="building">building (building.*)</option></Select></Field>
        </div>
        <Field label="Expression (must be true to pass)"><Input className="mono" placeholder="kpi.far <= 2.5 && kpi.coverage_pct <= 40" value={draft.expr} onChange={(e) => setDraft({ ...draft, expr: e.target.value })} /></Field>
        <div className="text-[10.5px] text-ink-3">{check(draft.expr) || "Available: kpi.gfa_m2, kpi.far, kpi.coverage_pct, kpi.unit_count, kpi.parking_ratio, kpi.max_height_m, zoning.*, building.storeys, building.height_m, building.gfa_m2, min(), max(), abs()"}</div>
        <Field label="Message (use {kpi.far}, {building.name} …)"><Input value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} /></Field>
        <Btn size="sm" variant="primary" disabled={!draft.title || !draft.expr || check(draft.expr).startsWith("error")} onClick={add}><Plus size={12} /> Add rule</Btn>
      </div>
    </div>
  );
}
