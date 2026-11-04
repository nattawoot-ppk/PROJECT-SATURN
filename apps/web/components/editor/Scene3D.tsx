"use client";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import { useMemo, useRef, useEffect, useState } from "react";
import { useEditor, activeOption } from "@/lib/store";
import { extrudeRing } from "@/lib/extrude";
import { computeEnvelope, buildingHeight, type Building } from "@saturn/model";
import { centroid, bounds, distPointRing, type Ring } from "@saturn/geometry";

function snap(pt: [number, number], parcel: Ring | undefined, env: Ring[]): [number, number] {
  const cands: [number, number][] = [...(parcel ?? []), ...env.flat()];
  for (const c of cands) if (Math.hypot(c[0] - pt[0], c[1] - pt[1]) < 1.5) return c;
  return [Math.round(pt[0] * 2) / 2, Math.round(pt[1] * 2) / 2];
}

function BuildingMesh({ b, selected }: { b: Building; selected: boolean }) {
  const select = useEditor((s) => s.select);
  const tool = useEditor((s) => s.tool);
  const geoms = useMemo(() => {
    let z = 0;
    return b.storeys.map((s) => { const g = extrudeRing(s.footprint ?? b.footprint, z, z + s.height_m); z += s.height_m; return { g, z0: z - s.height_m, z1: z, fp: s.footprint ?? b.footprint }; });
  }, [b]);
  useEffect(() => () => geoms.forEach((x) => x.g.dispose()), [geoms]);
  const color = b.color ?? "#4f8cff";
  const dragRef = useRef<{ start: [number, number]; snapshot: string; fp: Ring; storeyFps: (Ring | undefined)[] } | null>(null);

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (tool !== "select") return;
    e.stopPropagation();
    select(b.id);
    const st = useEditor.getState();
    dragRef.current = { start: [e.point.x, e.point.y], snapshot: JSON.stringify(st.project), fp: b.footprint, storeyFps: b.storeys.map((s) => s.footprint) };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const d = dragRef.current; if (!d) return;
    // project pointer onto ground plane z=0 along ray
    const ray = e.ray; const t = -ray.origin.z / ray.direction.z; const px = ray.origin.x + ray.direction.x * t, py = ray.origin.y + ray.direction.y * t;
    const dx = Math.round((px - d.start[0]) * 2) / 2, dy = Math.round((py - d.start[1]) * 2) / 2;
    if (dx === 0 && dy === 0) return;
    useEditor.getState().mutate((p) => { const bb = activeOption(p)?.buildings.find((x) => x.id === b.id); if (!bb) return; bb.footprint = d.fp.map(([x, y]) => [x + dx, y + dy]); bb.storeys.forEach((s, i) => { const f = d.storeyFps[i]; s.footprint = f ? f.map(([x, y]) => [x + dx, y + dy]) : undefined; }); }, { history: false });
  };
  const onUp = () => { const d = dragRef.current; if (!d) return; dragRef.current = null; const st = useEditor.getState(); if (JSON.stringify(st.project) !== d.snapshot) useEditor.setState({ past: [...st.past, d.snapshot], future: [] }); };

  return (
    <group onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
      {geoms.map((x, i) => (
        <group key={i}>
          <mesh geometry={x.g} castShadow receiveShadow>
            <meshStandardMaterial color={color} emissive={selected ? color : "#000"} emissiveIntensity={selected ? 0.35 : 0} roughness={0.8} />
          </mesh>
          <Line points={[...x.fp, x.fp[0]!].map(([px, py]) => [px, py, x.z1 + 0.01] as [number, number, number])} color={selected ? "#fff" : "#1b2a3a"} lineWidth={selected ? 1.5 : 0.8} />
        </group>
      ))}
    </group>
  );
}

function StoreyHandle({ b }: { b: Building }) {
  const setStoreys = useEditor((s) => s.setStoreys);
  const [drag, setDrag] = useState<{ y: number; n: number } | null>(null);
  const h = buildingHeight(b); const c = centroid(b.footprint);
  useEffect(() => {
    if (!drag) return;
    const mv = (e: PointerEvent) => { const dn = Math.round((drag.y - e.clientY) / 18); const n = Math.max(1, drag.n + dn); if (n !== b.storeys.length) setStoreys(b.id, n); };
    const up = () => setDrag(null);
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
  }, [drag, b, setStoreys]);
  return (
    <mesh position={[c[0], c[1], h + 1.2]} onPointerDown={(e) => { e.stopPropagation(); setDrag({ y: e.nativeEvent.clientY, n: b.storeys.length }); }}>
      <coneGeometry args={[1.2, 2.4, 16]} />
      <meshStandardMaterial color="#ffd166" emissive="#ffd166" emissiveIntensity={0.4} />
    </mesh>
  );
}

function Ground() {
  const tool = useEditor((s) => s.tool);
  const draft = useEditor((s) => s.draft);
  const project = useEditor((s) => s.project);
  const env = useMemo(() => (project ? computeEnvelope(project.site).map((p) => p.outer) : []), [project]);
  const lastClick = useRef(0);
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (tool === "select") return;
    useEditor.getState().setHover(snap([e.point.x, e.point.y], project?.site.parcel, env));
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const st = useEditor.getState();
    if (tool === "select") { st.select(null); return; }
    const pt = snap([e.point.x, e.point.y], project?.site.parcel, env);
    const now = performance.now(); const dbl = now - lastClick.current < 350; lastClick.current = now;
    if (tool === "draw-rect") {
      if (draft.length === 0) st.addDraftPoint(pt);
      else { const a = draft[0]!; st.addBuildingFromRing(rectFrom(a, pt)); st.setTool("select"); }
      return;
    }
    if (dbl) { st.finishDraft(); return; }
    // avoid duplicate consecutive points
    const last = draft[draft.length - 1];
    if (last && Math.hypot(last[0] - pt[0], last[1] - pt[1]) < 0.01) return;
    if (draft.length >= 3 && distPointRing(pt, [draft[0]!]) < 1.5 && Math.hypot(draft[0]![0] - pt[0], draft[0]![1] - pt[1]) < 1.5) { st.finishDraft(); return; }
    st.addDraftPoint(pt);
  };
  return (
    <mesh position={[0, 0, -0.02]} onPointerMove={onMove} onClick={onClick} receiveShadow>
      <planeGeometry args={[4000, 4000]} />
      <meshStandardMaterial color="#1a2230" />
    </mesh>
  );
}

function rectFrom(a: [number, number], b: [number, number]): Ring {
  const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}

function DraftPreview() {
  const draft = useEditor((s) => s.draft); const hover = useEditor((s) => s.hover); const tool = useEditor((s) => s.tool);
  if (tool === "select") return null;
  const color = tool === "draw-parcel" ? "#ffd166" : "#7cf";
  let pts: [number, number][] = draft;
  if (tool === "draw-rect" && draft.length === 1 && hover) pts = [...rectFrom(draft[0]!, hover), rectFrom(draft[0]!, hover)[0]!];
  else if (hover) pts = [...draft, hover];
  return (
    <group>
      {pts.length >= 2 && <Line points={pts.map(([x, y]) => [x, y, 0.05] as [number, number, number])} color={color} lineWidth={1.5} dashed dashSize={1} gapSize={0.5} />}
      {hover && <mesh position={[hover[0], hover[1], 0.1]}><sphereGeometry args={[0.5, 12, 12]} /><meshBasicMaterial color={color} /></mesh>}
      {draft.map((p, i) => <mesh key={i} position={[p[0], p[1], 0.1]}><sphereGeometry args={[0.45, 12, 12]} /><meshBasicMaterial color={color} /></mesh>)}
    </group>
  );
}

function ContextMeshes() {
  const project = useEditor((s) => s.project); const show = useEditor((s) => s.showContext);
  const geoms = useMemo(() => (project?.site.context_buildings ?? []).map((c) => extrudeRing(c.footprint, 0, c.height_m)), [project?.site.context_buildings]);
  useEffect(() => () => geoms.forEach((g) => g.dispose()), [geoms]);
  if (!show) return null;
  return <group>{geoms.map((g, i) => <mesh key={i} geometry={g} castShadow receiveShadow><meshStandardMaterial color="#8a93a3" roughness={1} /></mesh>)}</group>;
}

function Streets() {
  const streets = useEditor((s) => s.project?.site.streets ?? []); const show = useEditor((s) => s.showContext);
  if (!show) return null;
  return <group>{streets.map((s) => <Line key={s.id} points={s.centreline.map(([x, y]) => [x, y, 0.03] as [number, number, number])} color="#5a6b85" lineWidth={Math.max(0.5, s.width_m / 8)} />)}</group>;
}

function SiteOverlay() {
  const project = useEditor((s) => s.project); const showEnv = useEditor((s) => s.showEnvelope);
  const env = useMemo(() => (project ? computeEnvelope(project.site) : []), [project]);
  const envGeoms = useMemo(() => env.map((p) => extrudeRing(p.outer, 0, 0.001)), [env]);
  const parcel = project?.site.parcel;
  return (
    <group>
      {parcel && <Line points={[...parcel, parcel[0]!].map(([x, y]) => [x, y, 0.04] as [number, number, number])} color="#ffd166" lineWidth={2} />}
      {showEnv && env.map((p, i) => (
        <group key={i}>
          <mesh geometry={envGeoms[i]} position={[0, 0, 0.02]}><meshBasicMaterial color="#3ddc97" transparent opacity={0.12} depthWrite={false} /></mesh>
          <Line points={[...p.outer, p.outer[0]!].map(([x, y]) => [x, y, 0.05] as [number, number, number])} color="#3ddc97" lineWidth={1} dashed dashSize={2} gapSize={1} />
        </group>
      ))}
    </group>
  );
}

function CameraRig() {
  const project = useEditor((s) => s.project); const { camera } = useThree();
  const target = useMemo<[number, number, number]>(() => {
    const p = project?.site.parcel; if (!p) return [0, 0, 0];
    const b = bounds([p]); return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, 0];
  }, [project?.site.parcel]);
  useEffect(() => { camera.up.set(0, 0, 1); camera.position.set(target[0] + 120, target[1] - 160, 110); camera.lookAt(target[0], target[1], 0); }, [camera, target]);
  return <OrbitControls makeDefault target={target} maxPolarAngle={Math.PI / 2 - 0.02} enableDamping />;
}

export default function Scene3D() {
  const project = useEditor((s) => s.project); const selectedId = useEditor((s) => s.selectedId);
  const opt = activeOption(project);
  const selected = opt?.buildings.find((b) => b.id === selectedId);
  return (
    <Canvas shadows camera={{ fov: 45, near: 0.5, far: 5000, up: [0, 0, 1], position: [120, -160, 110] }} gl={{ antialias: true }} dpr={[1, 2]} style={{ background: "#0e141c" }}>
      <ambientLight intensity={0.55} />
      <directionalLight position={[200, -150, 300]} intensity={1.2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-300} shadow-camera-right={300} shadow-camera-top={300} shadow-camera-bottom={-300} shadow-camera-far={1000} />
      <hemisphereLight args={["#b8d0ff", "#1a2230", 0.4]} />
      <Ground />
      <gridHelper args={[2000, 400, "#2f4260", "#1c2838"]} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.01]} />
      <SiteOverlay />
      <ContextMeshes />
      <Streets />
      {opt?.buildings.map((b) => <BuildingMesh key={b.id} b={b} selected={b.id === selectedId} />)}
      {selected && <StoreyHandle b={selected} />}
      <DraftPreview />
      <CameraRig />
    </Canvas>
  );
}
