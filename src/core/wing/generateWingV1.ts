import type { WingArtifactsV1, WingSpecV1 } from "../types";
import { naca4Polygon } from "./naca4";

export function generateWingV1(spec: WingSpecV1): WingArtifactsV1 {
  assertSpec(spec);

  const halfSpan = spec.span / 2;
  const ribs = [];

  // Includes root (t=0) and tip (t=1)
  const count = Math.max(2, Math.floor(spec.ribCountPerHalf));

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const stationY = t * halfSpan;

    const chord = lerp(spec.rootChord, spec.tipChord, t);

    // Airfoil outline in chord-space [0..1]; scale to chord length.
    const outline = naca4Polygon(spec.airfoil.code, spec.airfoil.samples).map((p) => ({
      x: p.x * chord,
      y: p.y * chord,
    }));

    const slots = spec.spars.map((s, idx) => {
      const cx = s.xFrac * chord;
      const slotW = s.thickness + spec.slotClearance;
      return {
        id: `slot-${idx}`,
        rect: {
          x: cx - slotW / 2,
          y: -s.slotDepth / 2,
          w: slotW,
          h: s.slotDepth,
        },
      };
    });

    ribs.push({
      id: `rib-${i}`,
      stationY,
      chord,
      outline,
      slots,
    });
  }

  return { spec, ribs };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function assertSpec(spec: WingSpecV1): void {
  if (spec.version !== 1) throw new Error("WingSpecV1 version mismatch");
  if (spec.span <= 0) throw new Error("span must be > 0");
  if (spec.rootChord <= 0 || spec.tipChord <= 0) throw new Error("rootChord and tipChord must be > 0");
  if (spec.ribCountPerHalf < 2) throw new Error("ribCountPerHalf must be >= 2");
  if (!/^\d{4}$/.test(spec.airfoil.code)) throw new Error('airfoil.code must be a 4-digit string like "0012"');
  if (spec.slotClearance < 0) throw new Error("slotClearance must be >= 0");

  if (spec.airfoil.samples < 20) throw new Error("airfoil.samples must be >= 20");

  for (const s of spec.spars) {
    if (s.xFrac < 0 || s.xFrac > 1) throw new Error("spar xFrac must be in [0..1]");
    if (s.thickness <= 0 || s.slotDepth <= 0) throw new Error("spar thickness/slotDepth must be > 0");

  }
}
