import { lonLatToTile, metresPerPixel, decodeTerrarium, lonLatToLocal, localToLonLat } from "@saturn/geometry";
import type { Site } from "@saturn/model";

/** AWS Terrain Tiles (Terrarium PNG, key-free). Builds a local height grid relative to the origin elevation. */
export async function fetchTerrain(origin: { lat: number; lon: number }, radius_m: number, cell_m = 4, signal?: AbortSignal): Promise<NonNullable<Site["terrain"]>> {
  const z = 15; const mpp = metresPerPixel(origin.lat, z);
  const minX = -radius_m, minY = -radius_m; const cols = Math.ceil((2 * radius_m) / cell_m) + 1, rows = cols;
  // tiles covering the bbox
  const [lonMin, latMin] = localToLonLat(origin, minX, minY); const [lonMax, latMax] = localToLonLat(origin, -minX, -minY);
  const t0 = lonLatToTile(lonMin, latMax, z), t1 = lonLatToTile(lonMax, latMin, z);
  const tiles = new Map<string, Uint8ClampedArray>();
  for (let tx = t0.x; tx <= t1.x; tx++) for (let ty = t0.y; ty <= t1.y; ty++) {
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${tx}/${ty}.png`;
    const res = await fetch(url, { signal }); if (!res.ok) throw new Error(`Terrain tile ${res.status}`);
    const bmp = await createImageBitmap(await res.blob()); const c = document.createElement("canvas"); c.width = c.height = 256;
    const ctx = c.getContext("2d")!; ctx.drawImage(bmp, 0, 0); tiles.set(`${tx}/${ty}`, ctx.getImageData(0, 0, 256, 256).data);
  }
  const elev = (x: number, y: number): number => {
    const [lon, lat] = localToLonLat(origin, x, y); const t = lonLatToTile(lon, lat, z); const d = tiles.get(`${t.x}/${t.y}`); if (!d) return 0;
    const px = Math.min(255, Math.floor(t.px * 256)), py = Math.min(255, Math.floor(t.py * 256)); const i = (py * 256 + px) * 4;
    return decodeTerrarium(d[i]!, d[i + 1]!, d[i + 2]!);
  };
  const z0 = elev(0, 0); const grid = new Array<number>(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) grid[j * cols + i] = elev(minX + i * cell_m, minY + j * cell_m) - z0;
  void mpp; void lonLatToLocal;
  return { grid, cols, rows, cell_m, minX, minY };
}
