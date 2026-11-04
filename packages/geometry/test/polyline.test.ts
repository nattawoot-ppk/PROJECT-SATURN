import { describe, it, expect } from "vitest";
import { offsetPolyline, polylineStrip, ringArea, polylineLength, distPointPolyline } from "../src";

describe("polyline", () => {
  it("offsets a straight line to the left", () => {
    const o = offsetPolyline([[0, 0], [10, 0]], 2);
    expect(o[0]![1]).toBeCloseTo(2); expect(o[1]![1]).toBeCloseTo(2);
  });
  it("strip of a 10 m line between -3 and 3 has area 60", () => {
    expect(ringArea(polylineStrip([[0, 0], [10, 0]], -3, 3))).toBeCloseTo(60, 6);
  });
  it("mitre join on a right angle keeps width", () => {
    const o = offsetPolyline([[0, 0], [10, 0], [10, 10]], 1);
    expect(o[1]![0]).toBeCloseTo(9); expect(o[1]![1]).toBeCloseTo(1);
  });
  it("length and distance", () => {
    expect(polylineLength([[0, 0], [3, 4]])).toBeCloseTo(5);
    expect(distPointPolyline([5, 5], [[0, 0], [10, 0]])).toBeCloseTo(5);
  });
});
