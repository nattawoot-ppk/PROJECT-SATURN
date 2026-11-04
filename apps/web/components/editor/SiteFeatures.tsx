"use client";
import { useMemo, useEffect } from "react";
import * as THREE from "three";
import { useEditor } from "@/lib/store";
import { extrudeRing } from "@/lib/extrude";
import { polylineStrip } from "@saturn/geometry";
import type { StreetBandType } from "@saturn/model";

const BAND_STYLE: Record<StreetBandType, { color: string; height: number; opacity?: number }> = {
  pavement: { color: "#8d949c", height: 0.15 },
  roadway: { color: "#2b3036", height: 0.02 },
  bike_lane: { color: "#b5533c", height: 0.06 },
  planting: { color: "#2f7d4f", height: 0.3 },
  parking: { color: "#3c434b", height: 0.02 },
  median: { color: "#6f7780", height: 0.15 },
  safety_zone: { color: "#4a5058", height: 0.03 },
  plot_setback: { color: "#19e6c1", height: 0.01, opacity: 0.18 },
};

/** Street sections swept along their assigned streets. */
export function StreetSections() {
  const site = useEditor((s) => s.project?.site); const show = useEditor((s) => s.showContext);
  const items = useMemo(() => {
    if (!site) return [];
    const out: Array<{ g: THREE.BufferGeometry; style: { color: string; height: number; opacity?: number } }> = [];
    for (const st of site.streets) {
      const sec = site.street_sections.find((x) => x.id === st.section_id); if (!sec) continue;
      const W = sec.bands.reduce((a, b) => a + b.width_m, 0); let off = -W / 2;
      for (const band of sec.bands) {
        const strip = polylineStrip(st.centreline, off, off + band.width_m); off += band.width_m;
        const style = BAND_STYLE[band.type];
        try { out.push({ g: extrudeRing(strip, -0.05, style.height), style }); } catch { /* degenerate strip */ }
      }
    }
    return out;
  }, [site]);
  useEffect(() => () => items.forEach((i) => i.g.dispose()), [items]);
  if (!show) return null;
  return <group>{items.map((it, i) => <mesh key={i} geometry={it.g} receiveShadow><meshStandardMaterial color={it.style.color} roughness={1} transparent={!!it.style.opacity} opacity={it.style.opacity ?? 1} depthWrite={!it.style.opacity} /></mesh>)}</group>;
}

/** Georeferenced image underlays on the ground plane. */
export function Underlays() {
  const underlays = useEditor((s) => s.project?.site.underlays ?? []);
  const textures = useMemo(() => underlays.map((u) => { const t = new THREE.TextureLoader().load(u.src); t.colorSpace = THREE.SRGBColorSpace; return t; }), [underlays]);
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);
  return (
    <group>
      {underlays.map((u, i) => (
        <mesh key={u.id} position={[u.centre[0], u.centre[1], 0.015]} rotation={[0, 0, (u.rotation_deg * Math.PI) / 180]}>
          <planeGeometry args={[u.width_m, u.width_m / u.aspect]} />
          <meshBasicMaterial map={textures[i]} transparent opacity={u.opacity} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
