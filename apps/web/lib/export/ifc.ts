import type { Project, DesignOption } from "@saturn/model";
import { computeKpis, buildingHeight } from "@saturn/model";
import { ensureCCW, offsetRing, ringArea, type Ring } from "@saturn/geometry";

/**
 * Minimal IFC4 (STEP) writer: Project → Site → Building → Storey → {Slab, Walls (exterior, typed), Spaces (units), Roof slab},
 * with KPI property sets and georeferencing on the site. Geometry via IfcExtrudedAreaSolid of IfcArbitraryClosedProfileDef.
 */
export function exportIfc(project: Project, opt: DesignOption): string {
  const lines: string[] = []; let id = 0;
  const E = (s: string) => { lines.push(`#${++id}= ${s};`); return `#${id}`; };
  const guid = () => { const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$"; let g = chars[Math.floor(Math.random() * 4)]!; for (let i = 1; i < 22; i++) g += chars[Math.floor(Math.random() * 64)]; return g; };
  const str = (s: string) => `'${s.replace(/'/g, "''").replace(/[^\x20-\x7E]/g, "?")}'`;
  const num = (n: number) => { const s = n.toFixed(4); return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, ".") : s + "."; };
  const now = Math.floor(Date.now() / 1000);

  const person = E(`IFCPERSON($,'SATRN',$,$,$,$,$,$)`); const org = E(`IFCORGANIZATION($,'SATRN',$,$,$)`);
  const pao = E(`IFCPERSONANDORGANIZATION(${person},${org},$)`);
  const app = E(`IFCAPPLICATION(${org},'0.1','SATRN','SATRN')`);
  const owner = E(`IFCOWNERHISTORY(${pao},${app},$,.ADDED.,${now},$,$,${now})`);
  const lu = E(`IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)`); const au = E(`IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)`); const vu = E(`IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)`); const pu = E(`IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)`);
  const units = E(`IFCUNITASSIGNMENT((${lu},${au},${vu},${pu}))`);
  const origin = E(`IFCCARTESIANPOINT((0.,0.,0.))`); const zdir = E(`IFCDIRECTION((0.,0.,1.))`); const xdir = E(`IFCDIRECTION((1.,0.,0.))`);
  const wcs = E(`IFCAXIS2PLACEMENT3D(${origin},${zdir},${xdir})`);
  const ctx = E(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${wcs},$)`);
  const bodyCtx = E(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,${ctx},$,.MODEL_VIEW.,$)`);
  const proj = E(`IFCPROJECT('${guid()}',${owner},${str(project.name)},$,$,$,$,(${ctx}),${units})`);
  // georeferencing (IFC4 IfcMapConversion requires a projected CRS; we add site lat/lon instead, which every viewer reads)
  const toDMS = (d: number) => { const sign = d < 0 ? -1 : 1; d = Math.abs(d); const deg = Math.floor(d), min = Math.floor((d - deg) * 60), sec = Math.floor(((d - deg) * 60 - min) * 60), ms = Math.round((((d - deg) * 60 - min) * 60 - sec) * 1e6); return `(${sign * deg},${sign * min},${sign * sec},${sign * ms})`; };
  const sitePl = E(`IFCLOCALPLACEMENT($,${wcs})`);
  const site = E(`IFCSITE('${guid()}',${owner},'Site',$,$,${sitePl},$,$,.ELEMENT.,${toDMS(project.site.origin.lat)},${toDMS(project.site.origin.lon)},0.,$,$)`);
  E(`IFCRELAGGREGATES('${guid()}',${owner},$,$,${proj},(${site}))`);

  const placement = (parent: string, z: number) => { const p = E(`IFCCARTESIANPOINT((0.,0.,${num(z)}))`); const a = E(`IFCAXIS2PLACEMENT3D(${p},${zdir},${xdir})`); return E(`IFCLOCALPLACEMENT(${parent},${a})`); };
  const profile = (ring: Ring) => { const pts = ensureCCW(ring).map(([x, y]) => E(`IFCCARTESIANPOINT((${num(x)},${num(y)}))`)); const poly = E(`IFCPOLYLINE((${[...pts, pts[0]].join(",")}))`); return E(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,${poly})`); };
  const solid = (ring: Ring, z: number, h: number) => { const prof = profile(ring); const p = E(`IFCCARTESIANPOINT((0.,0.,${num(z)}))`); const a = E(`IFCAXIS2PLACEMENT3D(${p},${zdir},${xdir})`); const s = E(`IFCEXTRUDEDAREASOLID(${prof},${a},${zdir},${num(h)})`); const rep = E(`IFCSHAPEREPRESENTATION(${bodyCtx},'Body','SweptSolid',(${s}))`); return E(`IFCPRODUCTDEFINITIONSHAPE($,$,(${rep}))`); };
  const pset = (obj: string, name: string, props: Array<[string, number | string]>) => {
    const ps = props.map(([k, v]) => E(`IFCPROPERTYSINGLEVALUE(${str(k)},$,${typeof v === "number" ? `IFCREAL(${num(v)})` : `IFCTEXT(${str(v)})`},$)`));
    const set = E(`IFCPROPERTYSET('${guid()}',${owner},${str(name)},$,(${ps.join(",")}))`);
    E(`IFCRELDEFINESBYPROPERTIES('${guid()}',${owner},$,$,(${obj}),${set})`);
  };

  const wallType = E(`IFCWALLTYPE('${guid()}',${owner},'Exterior wall 300',$,$,$,$,$,$,.STANDARD.)`);
  const slabType = E(`IFCSLABTYPE('${guid()}',${owner},'Floor slab 250',$,$,$,$,$,$,.FLOOR.)`);
  const roofType = E(`IFCSLABTYPE('${guid()}',${owner},'Roof slab 300',$,$,$,$,$,$,.ROOF.)`);
  const typed: Record<string, string[]> = { [wallType]: [], [slabType]: [], [roofType]: [] };
  const kpis = computeKpis(opt, project.site, project.settings);
  const buildings: string[] = [];

  for (const b of opt.buildings) {
    const bPl = placement(sitePl, 0);
    const bld = E(`IFCBUILDING('${guid()}',${owner},${str(b.name)},$,$,${bPl},$,$,.ELEMENT.,$,$,$)`);
    buildings.push(bld);
    pset(bld, "Pset_SaturnBuilding", [["GFA_m2", b.storeys.reduce((a, s) => a + ringArea(s.footprint ?? b.footprint), 0)], ["Height_m", buildingHeight(b)], ["Storeys", b.storeys.length], ["Category", b.category], ["Tags", b.tags.join(", ")]]);
    const storeys: string[] = []; let z = 0;
    b.storeys.forEach((s, si) => {
      const sPl = placement(bPl, z);
      const st = E(`IFCBUILDINGSTOREY('${guid()}',${owner},${str(`Level ${si + 1}`)},$,$,${sPl},$,$,.ELEMENT.,${num(z)})`);
      storeys.push(st);
      const fp = ensureCCW(s.footprint ?? b.footprint); const elems: string[] = [];
      // floor slab
      const slab = E(`IFCSLAB('${guid()}',${owner},${str(`Slab L${si + 1}`)},$,$,${placement(sPl, 0)},${solid(fp, -0.25, 0.25)},$,.FLOOR.)`); elems.push(slab); typed[slabType]!.push(slab);
      // exterior walls: one per footprint edge, 0.3 m thick inside the edge
      const n = fp.length;
      for (let i = 0; i < n; i++) {
        const a = fp[i]!, c = fp[(i + 1) % n]!; const dx = c[0] - a[0], dy = c[1] - a[1]; const l = Math.hypot(dx, dy); if (l < 0.3) continue;
        const nx = -dy / l, ny = dx / l; // inward for CCW
        const wr: Ring = [[a[0], a[1]], [c[0], c[1]], [c[0] + nx * 0.3, c[1] + ny * 0.3], [a[0] + nx * 0.3, a[1] + ny * 0.3]];
        const w = E(`IFCWALL('${guid()}',${owner},${str(`Wall L${si + 1}-${i + 1}`)},$,$,${placement(sPl, 0)},${solid(wr, 0, s.height_m)},$,.STANDARD.)`); elems.push(w); typed[wallType]!.push(w);
      }
      // spaces for units; if none, one space for the whole storey
      const inner = offsetRing(fp, -0.3)[0] ?? fp;
      const spaces = s.units.length ? s.units.map((u) => ({ name: `${u.type} ${Math.round(u.area_m2 ?? ringArea(u.polygon))} m²`, ring: u.polygon, type: u.type })) : [{ name: `${s.use} L${si + 1}`, ring: inner, type: s.use }];
      for (const sp of spaces) {
        const space = E(`IFCSPACE('${guid()}',${owner},${str(sp.name)},$,$,${placement(sPl, 0)},${solid(sp.ring, 0, s.height_m)},${str(sp.type)},.ELEMENT.,.INTERNAL.,$)`);
        pset(space, "Pset_SpaceCommon", [["NetFloorArea", ringArea(sp.ring)], ["Category", sp.type]]);
        E(`IFCRELAGGREGATES('${guid()}',${owner},$,$,${st},(${space}))`);
      }
      for (const c of s.cores) { const core = E(`IFCSPACE('${guid()}',${owner},'Core',$,$,${placement(sPl, 0)},${solid(c, 0, s.height_m)},'core',.ELEMENT.,.INTERNAL.,$)`); E(`IFCRELAGGREGATES('${guid()}',${owner},$,$,${st},(${core}))`); }
      // roof slab on top storey
      if (si === b.storeys.length - 1) { const roof = E(`IFCSLAB('${guid()}',${owner},'Roof',$,$,${placement(sPl, 0)},${solid(fp, s.height_m, 0.3)},$,.ROOF.)`); elems.push(roof); typed[roofType]!.push(roof); }
      E(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${guid()}',${owner},$,$,(${elems.join(",")}),${st})`);
      z += s.height_m;
    });
    E(`IFCRELAGGREGATES('${guid()}',${owner},$,$,${bld},(${storeys.join(",")}))`);
  }
  // context as proxies
  const ctxElems: string[] = [];
  for (const c of project.site.context_buildings.slice(0, 400)) ctxElems.push(E(`IFCBUILDINGELEMENTPROXY('${guid()}',${owner},${str(c.name ?? "Context building")},$,$,${placement(sitePl, 0)},${solid(c.footprint, 0, c.height_m)},$,$)`));
  if (ctxElems.length) E(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${guid()}',${owner},'Context',$,(${ctxElems.join(",")}),${site})`);
  if (buildings.length) E(`IFCRELAGGREGATES('${guid()}',${owner},$,$,${site},(${buildings.join(",")}))`);
  for (const [t, objs] of Object.entries(typed)) if (objs.length) E(`IFCRELDEFINESBYTYPE('${guid()}',${owner},$,$,(${objs.join(",")}),${t})`);
  pset(site, "Pset_SaturnSite", [["ParcelArea_m2", kpis.parcel_area_m2], ["GFA_m2", kpis.gfa_m2], ["FAR", kpis.far], ["Coverage_pct", kpis.coverage_pct], ["Units", kpis.unit_count], ["Option", opt.name]]);

  const header = `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [ReferenceView_V1.2]'),'2;1');\nFILE_NAME('${project.name.replace(/'/g, "")}.ifc','${new Date().toISOString()}',('SATRN'),('SATRN'),'SATRN 0.1','SATRN 0.1','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n`;
  return header + lines.join("\n") + "\nENDSEC;\nEND-ISO-10303-21;\n";
}
