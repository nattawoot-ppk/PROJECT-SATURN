/** Sky subdivision and vertical sky component (VSC) helpers. */
export interface SkyPatch { dir: [number, number, number]; altitude_deg: number; solid_angle: number }

/** Tregenza-style 145-patch sky: 7 altitude bands (30,30,24,24,18,12,6 patches) + zenith. */
export function tregenzaPatches(): SkyPatch[] {
  const bands = [30, 30, 24, 24, 18, 12, 6];
  const out: SkyPatch[] = [];
  const rad = (d: number) => (d * Math.PI) / 180;
  bands.forEach((n, i) => {
    const alt = 6 + i * 12; // band centre altitude: 6, 18, 30, 42, 54, 66, 78
    const a0 = rad(alt - 6), a1 = rad(alt + 6);
    const solid = ((2 * Math.PI) / n) * (Math.sin(a1) - Math.sin(a0));
    for (let k = 0; k < n; k++) {
      const az = rad((360 / n) * (k + 0.5));
      out.push({ dir: [Math.cos(rad(alt)) * Math.sin(az), Math.cos(rad(alt)) * Math.cos(az), Math.sin(rad(alt))], altitude_deg: alt, solid_angle: solid });
    }
  });
  out.push({ dir: [0, 0, 1], altitude_deg: 90, solid_angle: 2 * Math.PI * (1 - Math.sin(rad(84))) });
  return out;
}

/** CIE standard overcast sky relative luminance at altitude (BRE/VSC convention). */
export function overcastLuminance(altitude_deg: number): number {
  return (1 + 2 * Math.sin((altitude_deg * Math.PI) / 180)) / 3;
}

/**
 * Vertical Sky Component of a surface with unit normal `n` given a per-patch visibility array (1 = visible).
 * Returns percent. An unobstructed vertical surface gives ≈ 39.6 %; a horizontal one 100 %.
 */
export function vsc(n: [number, number, number], patches: SkyPatch[], visible: ArrayLike<number>): number {
  let num = 0, den = 0;
  for (let i = 0; i < patches.length; i++) {
    const p = patches[i]!;
    const L = overcastLuminance(p.altitude_deg) * p.solid_angle;
    const cosH = p.dir[2]; // incidence on horizontal plane
    den += L * cosH;
    const cosN = n[0] * p.dir[0] + n[1] * p.dir[1] + n[2] * p.dir[2];
    if (cosN > 0 && visible[i]) num += L * cosN;
  }
  return den > 0 ? (100 * num) / den : 0;
}
