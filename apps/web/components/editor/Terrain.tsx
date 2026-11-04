"use client";
import { useMemo, useEffect } from "react";
import * as THREE from "three";
import { useEditor } from "@/lib/store";

/** Shaded terrain mesh from the site height grid (z-up). */
export function TerrainMesh() {
  const terrain = useEditor((s) => s.project?.site.terrain);
  const geo = useMemo(() => {
    if (!terrain) return null;
    const { cols, rows, cell_m, minX, minY, grid } = terrain;
    const g = new THREE.PlaneGeometry((cols - 1) * cell_m, (rows - 1) * cell_m, cols - 1, rows - 1);
    const pos = g.attributes.position as THREE.BufferAttribute;
    // PlaneGeometry vertices run row-major from top-left (+y) to bottom; map to our grid (minY at j=0)
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const vi = (rows - 1 - j) * cols + i; pos.setZ(vi, grid[j * cols + i]! - 0.05); }
    g.translate(minX + ((cols - 1) * cell_m) / 2, minY + ((rows - 1) * cell_m) / 2, 0); g.computeVertexNormals();
    return g;
  }, [terrain]);
  useEffect(() => () => geo?.dispose(), [geo]);
  if (!geo) return null;
  return <mesh geometry={geo} receiveShadow><meshStandardMaterial color="#161a20" roughness={1} wireframe={false} /></mesh>;
}
