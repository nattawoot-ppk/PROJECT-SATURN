import { describe, it, expect } from "vitest";
import { ringArea, centroid, pointInRing, offsetRing, envelopeWithEdgeSetbacks, polygonArea, unionAll, lonLatToLocal, localToLonLat, triangulate, rectRing } from "../src";

const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];

describe("polygon basics", () => {
  it("area of 10x10 square is 100", () => expect(ringArea(square)).toBeCloseTo(100));
  it("centroid is (5,5)", () => expect(centroid(square)).toEqual([5, 5]));
  it("point in ring", () => {
    expect(pointInRing([5, 5], square)).toBe(true);
    expect(pointInRing([15, 5], square)).toBe(false);
  });
});

describe("clipper offsets", () => {
  it("inward offset of 2 m gives 6x6", () => {
    const r = offsetRing(square, -2);
    expect(r.length).toBe(1);
    expect(ringArea(r[0]!)).toBeCloseTo(36, 3);
  });
  it("per-edge setbacks shrink correctly", () => {
    const env = envelopeWithEdgeSetbacks(square, [1, 2, 3, 4]);
    // width: 10 - (2 right + 4 left) = 4 ; depth: 10 - (1 bottom + 3 top) = 6
    expect(env.length).toBe(1);
    expect(polygonArea(env[0]!)).toBeCloseTo(24, 3);
  });
  it("union of overlapping rects", () => {
    const u = unionAll([{ outer: rectRing(5, 5, 10, 10), holes: [] }, { outer: rectRing(10, 5, 10, 10), holes: [] }]);
    expect(u.length).toBe(1);
    expect(polygonArea(u[0]!)).toBeCloseTo(150, 3);
  });
});

describe("geo", () => {
  it("round trips", () => {
    const o = { lat: 13.7563, lon: 100.5018 };
    const [x, y] = lonLatToLocal(o, 100.51, 13.76);
    const [lon, lat] = localToLonLat(o, x, y);
    expect(lon).toBeCloseTo(100.51, 8);
    expect(lat).toBeCloseTo(13.76, 8);
    expect(x).toBeGreaterThan(800); // ~886 m east
  });
});

describe("triangulate", () => {
  it("square with hole yields 8 triangles", () => {
    const t = triangulate({ outer: square, holes: [[[4, 4], [4, 6], [6, 6], [6, 4]]] });
    expect(t.indices.length / 3).toBe(8);
  });
});
