"use client";
import { create } from "zustand";
import { nanoid } from "nanoid";
import type { Project, Building, DesignOption, ZoningParams, Site } from "@saturn/model";
import { computeEnvelope, buildingHeight } from "@saturn/model";
import { intersect, polygonArea, type Ring } from "@saturn/geometry";
import { saveProject } from "./storage";

export type Tool = "select" | "draw-polygon" | "draw-rect" | "draw-parcel";

interface EditorState {
  project: Project | null;
  selectedId: string | null;
  tool: Tool;
  draft: Ring;               // points placed with the current draw tool
  hover: [number, number] | null;
  past: string[];
  future: string[];
  showEnvelope: boolean;
  showContext: boolean;
  showUnits: boolean;
  readonly: boolean;
  panel: "kpi" | "compliance" | "zoning" | "building" | "options" | "site" | "drawings" | "performance";

  load: (p: Project) => void;
  mutate: (fn: (p: Project) => void, opts?: { history?: boolean }) => void;
  select: (id: string | null) => void;
  setTool: (t: Tool) => void;
  setPanel: (p: EditorState["panel"]) => void;
  addDraftPoint: (pt: [number, number]) => void;
  setHover: (pt: [number, number] | null) => void;
  cancelDraft: () => void;
  finishDraft: () => void;
  addBuildingFromRing: (ring: Ring) => string;
  updateBuilding: (id: string, fn: (b: Building) => void) => void;
  deleteBuilding: (id: string) => void;
  setStoreys: (id: string, n: number) => void;
  setZoning: (fn: (z: ZoningParams) => void) => void;
  setSite: (fn: (s: Site) => void) => void;
  addOption: (from?: DesignOption) => void;
  setActiveOption: (id: string) => void;
  renameOption: (id: string, name: string) => void;
  deleteOption: (id: string) => void;
  applyAutofix: (kind: "clamp_height" | "clamp_storeys" | "trim_to_envelope", buildingId?: string) => void;
  undo: () => void;
  redo: () => void;
  toggle: (k: "showEnvelope" | "showContext" | "showUnits") => void;
}

export const activeOption = (p: Project | null): DesignOption | null =>
  p ? (p.options.find((o) => o.id === p.active_option_id) ?? p.options[0] ?? null) : null;

const palette = ["#e3e6ea", "#c9ced6", "#f0e6dc", "#d7dde6", "#e8ddd0", "#cfd6de", "#ece9e4"];

export const useEditor = create<EditorState>((set, get) => ({
  project: null, selectedId: null, tool: "select", draft: [], hover: null, past: [], future: [],
  showEnvelope: true, showContext: true, showUnits: true, readonly: false, panel: "kpi",

  load: (p) => set({ project: p, past: [], future: [], selectedId: null, draft: [] }),

  mutate: (fn, opts) => {
    const p = get().project; if (!p) return;
    const before = JSON.stringify(p);
    const next: Project = JSON.parse(before);
    fn(next);
    next.updated_at = new Date().toISOString();
    const opt = next.options.find((o) => o.id === next.active_option_id); if (opt) opt.updated_at = next.updated_at;
    if (!get().readonly) saveProject(next);
    set((s) => ({ project: next, past: opts?.history === false ? s.past : [...s.past.slice(-100), before], future: opts?.history === false ? s.future : [] }));
  },

  select: (id) => set({ selectedId: id, panel: id ? "building" : get().panel === "building" ? "kpi" : get().panel }),
  setTool: (t) => set({ tool: t, draft: [], hover: null }),
  setPanel: (panel) => set({ panel }),
  addDraftPoint: (pt) => set((s) => ({ draft: [...s.draft, pt] })),
  setHover: (hover) => set({ hover }),
  cancelDraft: () => set({ draft: [], tool: "select" }),

  finishDraft: () => {
    const { draft, tool } = get();
    if (tool === "draw-parcel") {
      if (draft.length >= 3) get().setSite((s) => { s.parcel = draft; s.parcel_source = "drawn"; });
    } else if (draft.length >= 3) {
      get().addBuildingFromRing(draft);
    }
    set({ draft: [], tool: "select" });
  },

  addBuildingFromRing: (ring) => {
    const id = nanoid(8);
    get().mutate((p) => {
      const opt = p.options.find((o) => o.id === p.active_option_id)!;
      const n = opt.buildings.length;
      const sh = p.settings.storey_height_m;
      const storeys = Math.max(1, Math.min(p.site.zoning.max_storeys ?? 4, 4));
      opt.buildings.push({
        id, name: `Building ${String.fromCharCode(65 + (n % 26))}`, category: "residential", tags: [], footprint: ring,
        storeys: Array.from({ length: storeys }, (_, i) => ({ id: `${id}-s${i}`, level: i, height_m: sh, use: "residential", units: [], cores: [] })),
        roof: { type: "flat", pitch_deg: 0, height_m: 0 }, parking: [], efficiency: 0.82, color: palette[n % palette.length],
      });
    });
    set({ selectedId: id, panel: "building" });
    return id;
  },

  updateBuilding: (id, fn) => get().mutate((p) => { const b = activeOption(p)?.buildings.find((x) => x.id === id); if (b) fn(b); }),
  deleteBuilding: (id) => { get().mutate((p) => { const o = activeOption(p)!; o.buildings = o.buildings.filter((b) => b.id !== id); }); set({ selectedId: null }); },

  setStoreys: (id, n) => get().updateBuilding(id, (b) => {
    n = Math.max(1, Math.min(200, Math.round(n)));
    const last = b.storeys[b.storeys.length - 1]!;
    while (b.storeys.length < n) { const i = b.storeys.length; b.storeys.push({ ...last, id: `${b.id}-s${i}-${nanoid(4)}`, level: i, units: [], cores: [], footprint: last.footprint }); }
    while (b.storeys.length > n) b.storeys.pop();
  }),

  setZoning: (fn) => get().mutate((p) => fn(p.site.zoning)),
  setSite: (fn) => get().mutate((p) => fn(p.site)),

  addOption: (from) => {
    const id = nanoid(8);
    get().mutate((p) => {
      const now = new Date().toISOString();
      const src = from ?? activeOption(p)!;
      p.options.push({ id, name: `${src.name} copy`, parent_id: src.id, buildings: JSON.parse(JSON.stringify(src.buildings)), created_at: now, updated_at: now });
      p.active_option_id = id;
    });
    set({ selectedId: null });
  },
  setActiveOption: (id) => { get().mutate((p) => { p.active_option_id = id; }, { history: false }); set({ selectedId: null }); },
  renameOption: (id, name) => get().mutate((p) => { const o = p.options.find((x) => x.id === id); if (o) o.name = name; }),
  deleteOption: (id) => get().mutate((p) => { if (p.options.length <= 1) return; p.options = p.options.filter((o) => o.id !== id); if (p.active_option_id === id) p.active_option_id = p.options[0]!.id; }),

  applyAutofix: (kind, buildingId) => {
    get().mutate((p) => {
      const opt = activeOption(p)!; const z = p.site.zoning;
      const targets = buildingId ? opt.buildings.filter((b) => b.id === buildingId) : opt.buildings;
      for (const b of targets) {
        if (kind === "clamp_storeys" && z.max_storeys) b.storeys = b.storeys.slice(0, z.max_storeys);
        if (kind === "clamp_height" && z.max_height_m) { while (b.storeys.length > 1 && buildingHeight(b) > z.max_height_m + 1e-6) b.storeys.pop(); }
        if (kind === "trim_to_envelope") {
          const env = computeEnvelope(p.site); if (!env.length) continue;
          const parts = intersect([{ outer: b.footprint, holes: [] }], env).sort((a, c) => polygonArea(c) - polygonArea(a));
          if (parts[0] && parts[0].outer.length >= 3) { b.footprint = parts[0].outer; for (const s of b.storeys) s.footprint = undefined; }
        }
      }
    });
  },

  undo: () => { const { past, project } = get(); if (!past.length || !project) return; const prev = past[past.length - 1]!; const restored = JSON.parse(prev) as Project; saveProject(restored); set({ project: restored, past: past.slice(0, -1), future: [JSON.stringify(project), ...get().future] }); },
  redo: () => { const { future, project } = get(); if (!future.length || !project) return; const next = JSON.parse(future[0]!) as Project; saveProject(next); set({ project: next, future: future.slice(1), past: [...get().past, JSON.stringify(project)] }); },
  toggle: (k) => set((s) => ({ [k]: !s[k] } as Partial<EditorState>)),
}));
