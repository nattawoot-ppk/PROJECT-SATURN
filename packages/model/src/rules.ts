import { envelopeWithEdgeSetbacks, ringInsideRing, ringArea, minDistRingToEdge, ensureCCW } from "@saturn/geometry";
import type { Polygon, Ring } from "@saturn/geometry";
import type { DesignOption, Site, ProjectSettings, Building, ZoningParams } from "./schema";
import { computeKpis, buildingHeight, type Kpis } from "./kpi";
import { evaluate } from "./expr";

export type Severity = "error" | "warning" | "info";

/** Built-in geometric/structural checks that cannot be expressed as a simple KPI expression. */
export type BuiltinKind = "setback" | "allowed_use" | "min_unit_area" | "parking_required";

export interface Rule {
  id: string;
  title: string;
  severity: Severity;
  /** Either an expression over {kpi, zoning, settings, building?} or a builtin kind */
  expr?: string;
  builtin?: BuiltinKind;
  /** Evaluate per building (expr gets `building` with height_m, storeys, gfa_m2, category) */
  scope?: "site" | "building";
  /** Only run when this expression is truthy (e.g. zoning parameter is set) */
  when?: string;
  message: string;
  /** Optional autofix identifier handled by the editor */
  autofix?: "clamp_height" | "clamp_storeys" | "trim_to_envelope";
  reference?: string;
}

export interface RulePack {
  id: string;
  name: string;
  version: string;
  jurisdiction: string;
  description?: string;
  /** Default parameters merged under zoning when the project zoning lacks them */
  defaults?: Partial<ZoningParams>;
  rules: Rule[];
}

export interface Finding {
  rule_id: string;
  title: string;
  severity: Severity;
  message: string;
  building_id?: string;
  object_id?: string;
  autofix?: Rule["autofix"];
  /** numeric detail for UI (actual vs limit) */
  actual?: number;
  limit?: number;
}

export interface ComplianceResult {
  pack_id: string;
  findings: Finding[];
  errors: number;
  warnings: number;
  envelope: Polygon[];
  evaluated_at: string;
}

function fmt(v: number) { return Number.isInteger(v) ? String(v) : v.toFixed(1); }

function interpolate(msg: string, ctx: Record<string, unknown>): string {
  return msg.replace(/\{([a-zA-Z0-9_.]+)\}/g, (_, p: string) => {
    const parts = p.split(".");
    let cur: unknown = ctx;
    for (const k of parts) cur = cur && typeof cur === "object" ? (cur as Record<string, unknown>)[k] : undefined;
    return typeof cur === "number" ? fmt(cur) : cur == null ? "—" : String(cur);
  });
}

export function computeEnvelope(site: Site): Polygon[] {
  if (!site.parcel) return [];
  const ring = ensureCCW(site.parcel);
  const z = site.zoning;
  const perEdge = ring.map((_, i) => z.setbacks.find((s) => s.edge === i)?.distance_m ?? z.setbacks.find((s) => s.edge === undefined)?.distance_m ?? z.default_setback_m);
  return envelopeWithEdgeSetbacks(ring, perEdge);
}

export function buildingCtx(b: Building) {
  return {
    id: b.id,
    name: b.name,
    category: b.category,
    height_m: buildingHeight(b),
    storeys: b.storeys.length,
    footprint_m2: ringArea(b.footprint),
    gfa_m2: b.storeys.reduce((a, s) => a + ringArea(s.footprint ?? b.footprint), 0),
  };
}

export function evaluateRules(pack: RulePack, option: DesignOption, site: Site, settings: ProjectSettings, kpis?: Kpis): ComplianceResult {
  const k = kpis ?? computeKpis(option, site, settings);
  // pack defaults fill only parameters the project leaves unset; custom maps merge
  const zoning: ZoningParams = { ...(pack.defaults ?? {}), ...Object.fromEntries(Object.entries(site.zoning).filter(([, v]) => v !== undefined && v !== null)), custom: { ...(pack.defaults?.custom ?? {}), ...(site.zoning.custom ?? {}) } } as ZoningParams;
  const base = { kpi: k, zoning, settings, site: { has_parcel: !!site.parcel } };
  const envelope = computeEnvelope(site);
  const findings: Finding[] = [];

  for (const rule of pack.rules) {
    const scope = rule.scope ?? (rule.builtin ? "building" : "site");
    const targets = scope === "building" ? option.buildings : [undefined];
    for (const b of targets) {
      const ctx: Record<string, unknown> = { ...base, building: b ? buildingCtx(b) : undefined };
      try {
        if (rule.when && !evaluate(rule.when, ctx)) continue;
        if (rule.builtin) {
          findings.push(...runBuiltin(rule, b, site, zoning, envelope, k, ctx));
          continue;
        }
        if (!rule.expr) continue;
        const ok = evaluate(rule.expr, ctx);
        if (!ok) {
          findings.push({ rule_id: rule.id, title: rule.title, severity: rule.severity, message: interpolate(rule.message, ctx), building_id: b?.id, autofix: rule.autofix });
        }
      } catch (e) {
        findings.push({ rule_id: rule.id, title: rule.title, severity: "info", message: `Rule could not be evaluated: ${(e as Error).message}`, building_id: b?.id });
      }
    }
  }
  return {
    pack_id: pack.id,
    findings,
    errors: findings.filter((f) => f.severity === "error").length,
    warnings: findings.filter((f) => f.severity === "warning").length,
    envelope,
    evaluated_at: new Date().toISOString(),
  };
}

function runBuiltin(rule: Rule, b: Building | undefined, site: Site, zoning: ZoningParams, envelope: Polygon[], k: Kpis, ctx: Record<string, unknown>): Finding[] {
  const out: Finding[] = [];
  switch (rule.builtin) {
    case "setback": {
      if (!b || !site.parcel || envelope.length === 0) return out;
      const rings: Ring[] = [b.footprint, ...b.storeys.filter((s) => s.footprint).map((s) => s.footprint!)];
      const inside = rings.every((r) => envelope.some((e) => ringInsideRing(r, e.outer, 0.01)));
      if (!inside) {
        // find worst edge for the message
        const parcel = ensureCCW(site.parcel);
        let worst = { edge: -1, dist: Infinity, limit: 0 };
        parcel.forEach((_, i) => {
          const lim = zoning.setbacks.find((s) => s.edge === i)?.distance_m ?? zoning.setbacks.find((s) => s.edge === undefined)?.distance_m ?? zoning.default_setback_m;
          const d = minDistRingToEdge(b.footprint, parcel, i);
          if (d - lim < worst.dist - worst.limit) worst = { edge: i, dist: d, limit: lim };
        });
        out.push({ rule_id: rule.id, title: rule.title, severity: rule.severity, building_id: b.id, autofix: rule.autofix,
          actual: worst.dist, limit: worst.limit,
          message: interpolate(rule.message, { ...ctx, edge: worst.edge + 1, actual: worst.dist, limit: worst.limit }) });
      }
      return out;
    }
    case "allowed_use": {
      if (!b || !zoning.allowed_uses?.length) return out;
      const uses = new Set(b.storeys.map((s) => s.use));
      for (const u of uses) if (!zoning.allowed_uses.includes(u) && u !== "parking") {
        out.push({ rule_id: rule.id, title: rule.title, severity: rule.severity, building_id: b.id, message: interpolate(rule.message, { ...ctx, use: u }) });
      }
      return out;
    }
    case "min_unit_area": {
      if (!b || !zoning.min_unit_area_m2) return out;
      for (const s of b.storeys) for (const u of s.units) {
        if (!["studio", "1br", "2br", "3br", "4br"].includes(u.type)) continue;
        const a = u.area_m2 ?? ringArea(u.polygon);
        if (a < zoning.min_unit_area_m2) out.push({ rule_id: rule.id, title: rule.title, severity: rule.severity, building_id: b.id, object_id: u.id, actual: a, limit: zoning.min_unit_area_m2, message: interpolate(rule.message, { ...ctx, unit: u.id, actual: a, limit: zoning.min_unit_area_m2 }) });
      }
      return out;
    }
    case "parking_required": {
      if (k.parking_required > 0 && k.parking_stalls < k.parking_required) {
        out.push({ rule_id: rule.id, title: rule.title, severity: rule.severity, actual: k.parking_stalls, limit: k.parking_required, message: interpolate(rule.message, ctx) });
      }
      return out;
    }
  }
  return out;
}
