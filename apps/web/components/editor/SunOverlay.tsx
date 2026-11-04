"use client";
import { useMemo, useEffect } from "react";
import * as THREE from "three";
import { useAnalysis } from "@/lib/analysisStore";
import { useEditor } from "@/lib/store";
import { heatColor, sunPosition, LAWSON, type Sample } from "@saturn/analyses";

/** Directional light placed at the sun for the selected date/hour. */
export function SunLight() {
  const date = useAnalysis((s) => s.date); const hour = useAnalysis((s) => s.hour); const show = useAnalysis((s) => s.showShadows);
  const origin = useEditor((s) => s.project?.site.origin);
  const pos = useMemo(() => {
    if (!origin) return [200, -150, 300] as [number, number, number];
    const tz = Math.round(origin.lon / 15) * 60;
    const [y, m, d] = date.split("-").map(Number) as [number, number, number];
    const t = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - tz * 60000 + hour * 3600000);
    const p = sunPosition(t, origin.lat, origin.lon);
    if (p.altitude_deg <= 0) return null;
    return [p.vector[0] * 600, p.vector[1] * 600, p.vector[2] * 600] as [number, number, number];
  }, [date, hour, origin]);
  if (!show || !pos) return <directionalLight position={[200, -150, 300]} intensity={0.9} />;
  return <directionalLight position={pos} intensity={1.3} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-350} shadow-camera-right={350} shadow-camera-top={350} shadow-camera-bottom={-350} shadow-camera-near={1} shadow-camera-far={1500} shadow-bias={-0.0004} />;
}

function facadeMesh(samples: Sample[], values: ArrayLike<number>, max: number, size = 1.4): THREE.InstancedMesh | null {
  const n = samples.length; if (!n) return null;
  const geo = new THREE.PlaneGeometry(size, size); const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(geo, mat, n); const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const col = new THREE.Color();
  const zAxis = new THREE.Vector3(0, 0, 1);
  samples.forEach((s, i) => {
    q.setFromUnitVectors(zAxis, new THREE.Vector3(s.n[0], s.n[1], s.n[2]));
    m.compose(new THREE.Vector3(s.p[0] + s.n[0] * 0.05, s.p[1] + s.n[1] * 0.05, s.p[2]), q, new THREE.Vector3(1, 1, 1));
    mesh.setMatrixAt(i, m);
    const [r, g, b] = heatColor(values[i]! / Math.max(0.1, max)); mesh.setColorAt(i, col.setRGB(r, g, b));
  });
  mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

/** Façade VSC overlay (design buildings + nearby neighbours). */
export function DaylightOverlay() {
  const dl = useAnalysis((s) => s.daylight); const overlay = useAnalysis((s) => s.overlay);
  const meshes = useMemo(() => dl ? [facadeMesh(dl.facade.samples, dl.facade.vsc, 40), facadeMesh(dl.context.samples, dl.context.vsc, 40, 2)] : [], [dl]);
  useEffect(() => () => meshes.forEach((m) => { m?.geometry.dispose(); (m?.material as THREE.Material | undefined)?.dispose(); }), [meshes]);
  if (!dl || overlay !== "daylight") return null;
  return <group>{meshes.map((m, i) => m && <primitive key={i} object={m} />)}</group>;
}

export function ViewsOverlay() {
  const v = useAnalysis((s) => s.views); const overlay = useAnalysis((s) => s.overlay);
  const mesh = useMemo(() => (v ? facadeMesh(v.facade.samples, v.facade.openness, 100) : null), [v]);
  useEffect(() => () => { mesh?.geometry.dispose(); (mesh?.material as THREE.Material | undefined)?.dispose(); }, [mesh]);
  if (!v || overlay !== "views" || !mesh) return null;
  return <primitive object={mesh} />;
}

/** Wind comfort: ground heatmap of Lawson classes. */
export function WindOverlay() {
  const w = useAnalysis((s) => s.wind); const overlay = useAnalysis((s) => s.overlay);
  const tex = useMemo(() => {
    if (!w) return null; const { cols, rows, comfort, ratio } = w; const data = new Uint8Array(cols * rows * 4);
    for (let i = 0; i < cols * rows; i++) { if (ratio[i]! < 0) { data[i * 4 + 3] = 0; continue; } const c = new THREE.Color(LAWSON[comfort[i]!]!.color); data[i * 4] = c.r * 255; data[i * 4 + 1] = c.g * 255; data[i * 4 + 2] = c.b * 255; data[i * 4 + 3] = 185; }
    const t = new THREE.DataTexture(data, cols, rows, THREE.RGBAFormat); t.needsUpdate = true; t.magFilter = THREE.LinearFilter; return t;
  }, [w]);
  useEffect(() => () => tex?.dispose(), [tex]);
  if (!w || overlay !== "wind" || !tex) return null;
  const { cols, rows, minX, minY, cell } = w;
  return <mesh position={[minX + (cols * cell) / 2, minY + (rows * cell) / 2, 0.07]}><planeGeometry args={[cols * cell, rows * cell]} /><meshBasicMaterial map={tex} transparent depthWrite={false} /></mesh>;
}

/** Traffic noise: façade Lden quads + ground Lden heatmap (45–75 dB). */
export function NoiseOverlay() {
  const n = useAnalysis((s) => s.noise); const overlay = useAnalysis((s) => s.overlay);
  const mesh = useMemo(() => (n ? facadeMesh(n.facade.samples, Array.from(n.facade.lden).map((v) => Math.max(0, v - 45)), 30, 2) : null), [n]);
  const tex = useMemo(() => {
    if (!n) return null; const { cols, rows, lden } = n.ground; const data = new Uint8Array(cols * rows * 4);
    for (let i = 0; i < cols * rows; i++) { const v = lden[i]!; if (v < 0) { data[i * 4 + 3] = 0; continue; } const [r, g, b] = heatColor(Math.max(0, v - 45) / 30); data[i * 4] = r * 255; data[i * 4 + 1] = g * 255; data[i * 4 + 2] = b * 255; data[i * 4 + 3] = 190; }
    const t = new THREE.DataTexture(data, cols, rows, THREE.RGBAFormat); t.needsUpdate = true; t.magFilter = THREE.LinearFilter; return t;
  }, [n]);
  useEffect(() => () => { mesh?.geometry.dispose(); (mesh?.material as THREE.Material | undefined)?.dispose(); tex?.dispose(); }, [mesh, tex]);
  if (!n || overlay !== "noise" || !tex) return null;
  const { cols, rows, minX, minY, cell } = n.ground;
  return (
    <group>
      <mesh position={[minX + (cols * cell) / 2, minY + (rows * cell) / 2, 0.06]}><planeGeometry args={[cols * cell, rows * cell]} /><meshBasicMaterial map={tex} transparent depthWrite={false} /></mesh>
      {mesh && <primitive object={mesh} />}
    </group>
  );
}

/** Heatmap plane for ground sun-hours plus instanced quads on façades. */
export function SunOverlay() {
  const sun = useAnalysis((s) => s.sun); const overlay = useAnalysis((s) => s.overlay);
  const tex = useMemo(() => {
    if (!sun) return null;
    const { cols, rows, hours } = sun.ground; const data = new Uint8Array(cols * rows * 4);
    for (let i = 0; i < cols * rows; i++) {
      const h = hours[i]!; if (h < 0) { data[i * 4 + 3] = 0; continue; }
      const [r, g, b] = heatColor(h / Math.max(0.1, sun.total_possible_h));
      data[i * 4] = r * 255; data[i * 4 + 1] = g * 255; data[i * 4 + 2] = b * 255; data[i * 4 + 3] = 200;
    }
    const t = new THREE.DataTexture(data, cols, rows, THREE.RGBAFormat); t.needsUpdate = true; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; return t;
  }, [sun]);
  useEffect(() => () => tex?.dispose(), [tex]);
  const facade = useMemo(() => (sun ? facadeMesh(sun.facade.samples, sun.facade.hours, sun.total_possible_h) : null), [sun]);
  useEffect(() => () => { facade?.geometry.dispose(); (facade?.material as THREE.Material | undefined)?.dispose(); }, [facade]);
  if (!sun || overlay !== "sun" || !tex) return null;
  const { cols, rows, minX, minY, cell } = sun.ground;
  return (
    <group>
      <mesh position={[minX + (cols * cell) / 2, minY + (rows * cell) / 2, 0.06]}>
        <planeGeometry args={[cols * cell, rows * cell]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} />
      </mesh>
      {facade && <primitive object={facade} />}
    </group>
  );
}
