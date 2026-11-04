import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { projectToDoc, docToProject } from "../src";

const proj = () => ({ id: "p1", name: "P", site: { parcel: [[0, 0], [1, 0], [1, 1]] }, active_option_id: "o1", created_at: "a", updated_at: "a",
  options: [{ id: "o1", name: "A", created_at: "a", updated_at: "a", buildings: [{ id: "b1", name: "B1", storeys: 3 }, { id: "b2", name: "B2", storeys: 5 }] }] });

describe("yjs mapping", () => {
  it("round trips and preserves order", () => {
    const d = new Y.Doc(); projectToDoc(d, proj()); expect(docToProject(d)).toEqual(proj());
  });
  it("merges concurrent edits to different buildings", () => {
    const a = new Y.Doc(), b = new Y.Doc(); projectToDoc(a, proj()); Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    const pa = proj(); (pa.options[0]!.buildings[0] as { storeys: number }).storeys = 9; projectToDoc(a, pa);
    const pb = proj(); (pb.options[0]!.buildings[1] as { name: string }).name = "Tower"; projectToDoc(b, pb);
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b)); Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    const merged = docToProject(a) as typeof pa;
    expect((merged.options[0]!.buildings[0] as { storeys: number }).storeys).toBe(9);
    expect((merged.options[0]!.buildings[1] as { name: string }).name).toBe("Tower");
    expect(docToProject(b)).toEqual(merged);
  });
  it("deletes removed buildings and options", () => {
    const d = new Y.Doc(); projectToDoc(d, proj()); const p = proj(); p.options[0]!.buildings.pop(); projectToDoc(d, p);
    expect((docToProject(d) as typeof p).options[0]!.buildings.length).toBe(1);
  });
});
