"use client";
import { useMemo, useEffect } from "react";
import * as THREE from "three";
import { useEditor, activeOption } from "@/lib/store";
import { extrudeRing } from "@/lib/extrude";

export const UNIT_COLORS: Record<string, string> = { studio: "#ffd166", "1br": "#ff9f43", "2br": "#ff5a1f", "3br": "#c4452c", "4br": "#8e2f1f", retail: "#19e6c1", office: "#4fb3ff", core: "#2b3036", corridor: "#6b7380", other: "#9aa3ad" };

/** Unit tiles drawn at each storey floor; building walls become translucent when units are shown. */
export function UnitTiles() {
  const project = useEditor((s) => s.project); const show = useEditor((s) => s.showUnits);
  const opt = activeOption(project);
  const items = useMemo(() => {
    const out: Array<{ g: THREE.BufferGeometry; c: string }> = [];
    if (!show) return out;
    for (const b of opt?.buildings ?? []) {
      let z = 0;
      for (const s of b.storeys) {
        for (const u of s.units) { try { out.push({ g: extrudeRing(u.polygon, z + 0.05, z + 0.35), c: UNIT_COLORS[u.type] ?? "#999" }); } catch { /* skip */ } }
        for (const c of s.cores) { try { out.push({ g: extrudeRing(c, z + 0.05, z + s.height_m - 0.1), c: UNIT_COLORS.core! }); } catch { /* skip */ } }
        z += s.height_m;
      }
    }
    return out;
  }, [opt, show]);
  useEffect(() => () => items.forEach((i) => i.g.dispose()), [items]);
  if (!show) return null;
  return <group>{items.map((it, i) => <mesh key={i} geometry={it.g}><meshStandardMaterial color={it.c} roughness={0.9} /></mesh>)}</group>;
}

/** Parking volumes: basements below ground, surface lots as flat slabs. */
export function ParkingMeshes() {
  const project = useEditor((s) => s.project);
  const opt = activeOption(project);
  const items = useMemo(() => {
    const out: Array<{ g: THREE.BufferGeometry; type: string }> = [];
    for (const b of opt?.buildings ?? []) for (const p of b.parking) {
      try {
        if (p.type === "basement") out.push({ g: extrudeRing(p.polygon, -3 * p.levels, -0.05), type: p.type });
        else if (p.type === "surface") out.push({ g: extrudeRing(p.polygon, 0, 0.12), type: p.type });
      } catch { /* skip */ }
    }
    return out;
  }, [opt]);
  useEffect(() => () => items.forEach((i) => i.g.dispose()), [items]);
  return <group>{items.map((it, i) => <mesh key={i} geometry={it.g}><meshStandardMaterial color={it.type === "basement" ? "#4fb3ff" : "#3c434b"} transparent opacity={it.type === "basement" ? 0.25 : 0.9} roughness={1} /></mesh>)}</group>;
}
