/** Local tangent-plane (ENU-like) conversions around a project origin. Sufficient for sites up to a few km. */
export interface GeoOrigin { lat: number; lon: number }
const R = 6378137;
export function lonLatToLocal(origin: GeoOrigin, lon: number, lat: number): [number, number] {
  const dLat = ((lat - origin.lat) * Math.PI) / 180;
  const dLon = ((lon - origin.lon) * Math.PI) / 180;
  const x = dLon * R * Math.cos((origin.lat * Math.PI) / 180);
  const y = dLat * R;
  return [x, y];
}
export function localToLonLat(origin: GeoOrigin, x: number, y: number): [number, number] {
  const lat = origin.lat + (y / R) * (180 / Math.PI);
  const lon = origin.lon + (x / (R * Math.cos((origin.lat * Math.PI) / 180))) * (180 / Math.PI);
  return [lon, lat];
}
