import * as THREE from "three";
import { triangulate, ensureCCW, type Ring } from "@saturn/geometry";

/** Build a closed prism from a ring (z-up) between z0 and z1. */
export function extrudeRing(ringIn: Ring, z0: number, z1: number): THREE.BufferGeometry {
  const ring = ensureCCW(ringIn);
  const { vertices, indices } = triangulate({ outer: ring, holes: [] });
  const pos: number[] = []; const idx: number[] = []; const nrm: number[] = [];
  const n = ring.length;
  // top
  for (let i = 0; i < vertices.length; i += 2) { pos.push(vertices[i]!, vertices[i + 1]!, z1); nrm.push(0, 0, 1); }
  for (const i of indices) idx.push(i);
  // bottom (reversed winding)
  const bOff = pos.length / 3;
  for (let i = 0; i < vertices.length; i += 2) { pos.push(vertices[i]!, vertices[i + 1]!, z0); nrm.push(0, 0, -1); }
  for (let i = 0; i < indices.length; i += 3) idx.push(bOff + indices[i + 2]!, bOff + indices[i + 1]!, bOff + indices[i]!);
  // sides
  for (let i = 0; i < n; i++) {
    const a = ring[i]!, b = ring[(i + 1) % n]!;
    const dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1;
    const nx = dy / l, ny = -dx / l; // outward for CCW
    const s = pos.length / 3;
    pos.push(a[0], a[1], z0, b[0], b[1], z0, b[0], b[1], z1, a[0], a[1], z1);
    for (let k = 0; k < 4; k++) nrm.push(nx, ny, 0);
    idx.push(s, s + 1, s + 2, s, s + 2, s + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

export function ringToLine(ring: Ring, z: number, closed = true): THREE.BufferGeometry {
  const pts = ring.map(([x, y]) => new THREE.Vector3(x, y, z));
  if (closed && ring.length) pts.push(pts[0]!.clone());
  return new THREE.BufferGeometry().setFromPoints(pts);
}
