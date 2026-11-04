import { parseProject, type Project } from "@saturn/model";

const INDEX_KEY = "saturn.projects.index";
const key = (id: string) => `saturn.project.${id}`;

export interface ProjectSummary { id: string; name: string; updated_at: string; buildings: number }

function safeLocal(): Storage | null {
  try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
}

export function listProjects(): ProjectSummary[] {
  const ls = safeLocal(); if (!ls) return [];
  try { return JSON.parse(ls.getItem(INDEX_KEY) ?? "[]") as ProjectSummary[]; } catch { return []; }
}

export function saveProject(p: Project): void {
  const ls = safeLocal(); if (!ls) return;
  ls.setItem(key(p.id), JSON.stringify(p));
  const idx = listProjects().filter((s) => s.id !== p.id);
  const active = p.options.find((o) => o.id === p.active_option_id) ?? p.options[0];
  idx.unshift({ id: p.id, name: p.name, updated_at: p.updated_at, buildings: active?.buildings.length ?? 0 });
  ls.setItem(INDEX_KEY, JSON.stringify(idx));
}

export function loadProject(id: string): Project | null {
  const ls = safeLocal(); if (!ls) return null;
  const raw = ls.getItem(key(id)); if (!raw) return null;
  try { return parseProject(JSON.parse(raw)); } catch (e) { console.error("Corrupt project", id, e); return null; }
}

export function deleteProject(id: string): void {
  const ls = safeLocal(); if (!ls) return;
  ls.removeItem(key(id));
  ls.setItem(INDEX_KEY, JSON.stringify(listProjects().filter((s) => s.id !== id)));
}
