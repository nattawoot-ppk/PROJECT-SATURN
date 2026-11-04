import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { parseProject, type Project } from "@saturn/model";

/** Read-only share link: the whole project compressed into the URL hash (no server needed). Context is trimmed to keep links short. */
export function makeShareUrl(project: Project, origin: string): { url: string; bytes: number } {
  const slim: Project = JSON.parse(JSON.stringify(project));
  slim.site.context_buildings = slim.site.context_buildings.slice(0, 250).map((c) => ({ ...c, footprint: c.footprint.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10] as [number, number]) }));
  slim.site.underlays = []; slim.site.terrain = undefined;
  const hash = compressToEncodedURIComponent(JSON.stringify(slim));
  return { url: `${origin}/view#${hash}`, bytes: hash.length };
}
export function readShareHash(hash: string): Project | null {
  try { const json = decompressFromEncodedURIComponent(hash.replace(/^#/, "")); return json ? parseProject(JSON.parse(json)) : null; } catch { return null; }
}
