import { describe, it, expect } from "vitest";
import { decodeTerrarium, lonLatToTile, sampleHeight, metresPerPixel, slopeStats } from "../src";

describe("terrain", () => {
  it("decodes terrarium", () => { expect(decodeTerrarium(128, 0, 0)).toBe(0); expect(decodeTerrarium(128, 100, 128)).toBeCloseTo(100.5); });
  it("tile maths", () => { const t = lonLatToTile(100.5018, 13.7563, 15); expect(t.x).toBe(25531); expect(t.y).toBe(15119); expect(metresPerPixel(0, 15)).toBeCloseTo(4.777, 2); });
  it("bilinear sampling", () => {
    const h = { grid: [0, 10, 20, 30], cols: 2, rows: 2, cell_m: 10, minX: 0, minY: 0 };
    expect(sampleHeight(h, 5, 0)).toBeCloseTo(5); expect(sampleHeight(h, 5, 5)).toBeCloseTo(15); expect(sampleHeight(h, 100, 100)).toBeCloseTo(30);
    expect(slopeStats(h).max_pct).toBeGreaterThan(100);
  });
});
