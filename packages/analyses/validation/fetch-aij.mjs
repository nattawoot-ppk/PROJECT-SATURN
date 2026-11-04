// Downloads the AIJ wind-tunnel reference data (Eddy3D cleaned mirror) and converts Case A/B pedestrian points into
// the JSON the harness expects. Run from a machine with internet access:  node validation/fetch-aij.mjs
import { writeFileSync, mkdirSync } from "node:fs";
const BASE = "https://raw.githubusercontent.com/Eddy3D-Dev/AIJ-Data-Validation/main";
const cases = { A: { file: "CaseA/caseA_measurements.csv", scale: 250 }, B: { file: "CaseB/caseB_measurements.csv", scale: 250 } };
mkdirSync(new URL("./data/", import.meta.url), { recursive: true });
for (const [id, c] of Object.entries(cases)) {
  const res = await fetch(`${BASE}/${c.file}`); if (!res.ok) { console.error(`Case ${id}: ${res.status} from ${c.file} — check the repository layout and adjust the path.`); continue; }
  const text = await res.text(); const rows = text.trim().split(/\r?\n/).slice(1).map((l) => l.split(",").map(Number));
  // expected columns: x, y, z, U/Uref (model metres); scale to full size
  const pts = rows.filter((r) => r.length >= 4 && !r.some(Number.isNaN)).map(([x, y, , ratio]) => ({ x: x * c.scale, y: y * c.scale, ratio }));
  writeFileSync(new URL(`./data/${id}.json`, import.meta.url), JSON.stringify(pts)); console.log(`Case ${id}: ${pts.length} points written`);
}
