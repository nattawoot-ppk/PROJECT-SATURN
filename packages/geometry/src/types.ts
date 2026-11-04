/** 2D point in metres (local project frame). */
export type Vec2 = [number, number];
/** Simple closed ring, implicitly closed (last point != first). */
export type Ring = Vec2[];
/** Polygon with optional holes. */
export interface Polygon { outer: Ring; holes: Ring[] }
export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }
