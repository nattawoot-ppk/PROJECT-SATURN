import earcut from "earcut";
import type { Polygon } from "./types";

/** Triangulate a polygon with holes. Returns flat vertex array [x,y,...] and triangle indices. */
export function triangulate(p: Polygon): { vertices: number[]; indices: number[] } {
  const vertices: number[] = [];
  const holeIndices: number[] = [];
  for (const [x, y] of p.outer) vertices.push(x, y);
  for (const h of p.holes) {
    holeIndices.push(vertices.length / 2);
    for (const [x, y] of h) vertices.push(x, y);
  }
  const indices = earcut(vertices, holeIndices.length ? holeIndices : undefined, 2);
  return { vertices, indices };
}
