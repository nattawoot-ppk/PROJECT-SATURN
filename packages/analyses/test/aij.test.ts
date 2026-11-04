import { describe, it, expect } from "vitest";
import { runCase, score } from "../validation/aij";

describe("AIJ harness", () => {
  it("case A reproduces the qualitative pattern: upstream slow-down, corner speed-up, wake", () => {
    const { at, b } = runCase("A", 2, 2500);
    const upstream = at(-3 * b, 0), near = at(-0.75 * b, 0), corner = at(-0.4 * b, 0.8 * b), wake = at(1 * b, 0), far = at(6 * b, 0);
    expect(near).toBeLessThan(upstream * 0.8);
    expect(corner).toBeGreaterThan(upstream * 1.05);
    expect(wake).toBeLessThan(0.5);
    expect(far).toBeGreaterThan(wake);
  }, 120000);
  it("scorer counts hits within 30 %", () => {
    const s = score((x) => (x < 0 ? 1 : 0.5), [{ x: -1, y: 0, ratio: 1.1 }, { x: 1, y: 0, ratio: 0.9 }]);
    expect(s.n).toBe(2); expect(s.hit_rate).toBe(0.5);
  });
});
