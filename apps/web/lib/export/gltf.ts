import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type { Project, DesignOption } from "@saturn/model";
import { extrudeRing } from "@/lib/extrude";

/** Binary glTF of design + context, Y-up for viewers/VR. */
export function exportGlb(project: Project, opt: DesignOption, includeContext = true): Promise<Blob> {
  const scene = new THREE.Scene(); const root = new THREE.Group(); root.rotation.x = -Math.PI / 2; scene.add(root);
  for (const b of opt.buildings) { let z = 0; for (const s of b.storeys) { const m = new THREE.Mesh(extrudeRing(s.footprint ?? b.footprint, z, z + s.height_m), new THREE.MeshStandardMaterial({ color: b.color ?? "#d9dde3", roughness: 0.9 })); m.name = `${b.name} L${s.level + 1}`; root.add(m); z += s.height_m; } }
  if (includeContext) for (const c of project.site.context_buildings) { const m = new THREE.Mesh(extrudeRing(c.footprint, 0, c.height_m), new THREE.MeshStandardMaterial({ color: "#6f757d", roughness: 1 })); m.name = c.name ?? "context"; root.add(m); }
  if (project.site.parcel) { const g = extrudeRing(project.site.parcel, -0.05, 0); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: "#2a2f36" })); m.name = "parcel"; root.add(m); }
  return new Promise((resolve, reject) => new GLTFExporter().parse(scene as unknown as THREE.Object3D, (r) => resolve(new Blob([r as ArrayBuffer], { type: "model/gltf-binary" })), (e) => reject(e), { binary: true }));
}
