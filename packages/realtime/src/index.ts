import * as Y from "yjs";

/**
 * Project JSON ↔ Yjs document mapping shared by the API room server and the web client.
 * Layout: map "project" holds every top-level key except options; map "options" holds one Y.Map per option with its
 * fields and a nested "buildings" Y.Map keyed by building id. Concurrent edits to different buildings or options merge;
 * edits to the same building resolve last-writer-wins at the building level.
 */
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function projectToDoc(doc: Y.Doc, project: Record<string, unknown>, origin: unknown = "local") {
  doc.transact(() => {
    const root = doc.getMap("project");
    for (const [k, v] of Object.entries(project)) if (k !== "options" && !same(root.get(k), v)) root.set(k, clone(v));
    for (const k of Array.from(root.keys())) if (!(k in project)) root.delete(k);
    const opts = doc.getMap("options");
    const options = (project.options as Array<Record<string, unknown>>) ?? [];
    const ids = new Set(options.map((o) => String(o.id)));
    for (const k of Array.from(opts.keys())) if (!ids.has(k)) opts.delete(k);
    options.forEach((o, oi) => {
      let om = opts.get(String(o.id)) as Y.Map<unknown> | undefined;
      if (!om) { om = new Y.Map(); opts.set(String(o.id), om); }
      for (const [k, v] of Object.entries(o)) if (k !== "buildings" && !same(om.get(k), v)) om.set(k, clone(v));
      if (om.get("__order") !== oi) om.set("__order", oi);
      let bm = om.get("buildings") as Y.Map<unknown> | undefined;
      if (!bm) { bm = new Y.Map(); om.set("buildings", bm); }
      const blds = (o.buildings as Array<Record<string, unknown>>) ?? []; const bids = new Set(blds.map((b) => String(b.id)));
      for (const k of Array.from(bm.keys())) if (!bids.has(k)) bm.delete(k);
      blds.forEach((b, i) => { const next = { ...b, __order: i }; if (!same(bm!.get(String(b.id)), next)) bm!.set(String(b.id), clone(next)); });
    });
  }, origin);
}

export function docToProject(doc: Y.Doc): Record<string, unknown> | null {
  const root = doc.getMap("project"); if (!root.has("id")) return null;
  const out: Record<string, unknown> = {}; root.forEach((v, k) => { out[k] = v; });
  const options: Array<Record<string, unknown>> = [];
  (doc.getMap("options") as Y.Map<Y.Map<unknown>>).forEach((om) => {
    const o: Record<string, unknown> = {}; om.forEach((v, k) => { if (k !== "buildings") o[k] = v; });
    const blds: Array<Record<string, unknown>> = []; (om.get("buildings") as Y.Map<Record<string, unknown>> | undefined)?.forEach((b) => blds.push(b));
    blds.sort((a, b) => Number(a.__order ?? 0) - Number(b.__order ?? 0));
    o.buildings = blds.map((b) => { const c = { ...b }; delete c.__order; return c; });
    options.push(o);
  });
  options.sort((a, b) => Number(a.__order ?? 0) - Number(b.__order ?? 0));
  out.options = options.map((o) => { const c = { ...o }; delete c.__order; return c; });
  return out;
}

export interface Presence { id: string; name: string; color: string; selected?: string | null; option?: string }
export const PRESENCE_COLORS = ["#ff5a1f", "#19e6c1", "#ffd166", "#4fb3ff", "#c86dd7", "#ff6b81", "#7bed9f"];
export const colorFor = (s: string) => PRESENCE_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % PRESENCE_COLORS.length]!;
