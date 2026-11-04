/**
 * Solar position (NOAA / Meeus simplified algorithm). Accuracy ≈ 0.01° in altitude/azimuth,
 * sufficient for sun-hours and shadow studies. Inputs in degrees, UTC time.
 */
export interface SunPosition { altitude_deg: number; azimuth_deg: number; /** unit vector in local frame: x east, y north, z up */ vector: [number, number, number] }

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function julianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

export function sunPosition(date: Date, lat: number, lon: number): SunPosition {
  const jd = julianDay(date);
  const T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const Mr = rad(M);
  const C = Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) + Math.sin(3 * Mr) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(rad(omega));
  const decl = Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lambda)));
  const y = Math.tan(rad(eps) / 2) ** 2;
  const eqTime = 4 * deg(y * Math.sin(2 * rad(L0)) - 2 * e * Math.sin(Mr) + 4 * e * y * Math.sin(Mr) * Math.cos(2 * rad(L0)) - 0.5 * y * y * Math.sin(4 * rad(L0)) - 1.25 * e * e * Math.sin(2 * Mr));
  const minutesUtc = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const trueSolarTime = (minutesUtc + eqTime + 4 * lon) % 1440;
  const ha = trueSolarTime / 4 < 0 ? trueSolarTime / 4 + 180 : trueSolarTime / 4 - 180;
  const latR = rad(lat), haR = rad(ha);
  const cosZen = Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(haR);
  const zen = Math.acos(Math.max(-1, Math.min(1, cosZen)));
  const altitude = 90 - deg(zen);
  let az: number;
  const denom = Math.cos(latR) * Math.sin(zen);
  if (Math.abs(denom) < 1e-9) az = 180;
  else {
    const cosAz = (Math.sin(latR) * Math.cos(zen) - Math.sin(decl)) / denom;
    az = deg(Math.acos(Math.max(-1, Math.min(1, cosAz))));
    az = ha > 0 ? (az + 180) % 360 : (540 - az) % 360;
  }
  const altR = rad(altitude), azR = rad(az);
  return { altitude_deg: altitude, azimuth_deg: az, vector: [Math.cos(altR) * Math.sin(azR), Math.cos(altR) * Math.cos(azR), Math.sin(altR)] };
}

/** Sun vectors above the horizon for one local calendar day, sampled every `stepMin` minutes. tzOffsetMin = minutes east of UTC. */
export function sunVectorsForDay(dateISO: string, lat: number, lon: number, stepMin = 15, tzOffsetMin = Math.round(lon / 15) * 60): Array<{ t: Date; pos: SunPosition }> {
  const [y, m, d] = dateISO.split("-").map(Number) as [number, number, number];
  const startUtc = Date.UTC(y, m - 1, d, 0, 0, 0) - tzOffsetMin * 60000;
  const out: Array<{ t: Date; pos: SunPosition }> = [];
  for (let mins = 0; mins < 1440; mins += stepMin) {
    const t = new Date(startUtc + mins * 60000);
    const pos = sunPosition(t, lat, lon);
    if (pos.altitude_deg > 0.5) out.push({ t, pos });
  }
  return out;
}

export const KEY_DATES = (year: number) => ({ "Spring equinox": `${year}-03-20`, "Summer solstice": `${year}-06-21`, "Autumn equinox": `${year}-09-22`, "Winter solstice": `${year}-12-21` });
