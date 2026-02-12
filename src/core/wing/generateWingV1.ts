import type { CutPrimitive, WingArtifactsV1, WingSpecV1 } from "../types";
import { pointInPolygon } from "../geom/pointInPoly";
import { naca4Polygon } from "./naca4";

export function generateWingV1(spec: WingSpecV1): WingArtifactsV1 {
  assertSpec(spec);

  const halfSpan = spec.span / 2;
  const ribs = [];

  const count = Math.max(2, Math.floor(spec.ribCountPerHalf));

  // Planform derivatives for spar angle (constant for linear sweep + linear taper)
  const dChordDy = (spec.tipChord - spec.rootChord) / halfSpan;
  const dXLEdy = spec.sweepLE / halfSpan;

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const stationY = t * halfSpan;

    const chord = lerp(spec.rootChord, spec.tipChord, t);

    const outline = naca4Polygon(spec.airfoil.code, spec.airfoil.samples).map((p) => ({
      x: p.x * chord,
      y: p.y * chord,
    }));

    const cutouts: CutPrimitive[] = [];

    // --- Spar notches (open U-notches to perimeter) ---
    for (let sIdx = 0; sIdx < spec.spars.length; sIdx++) {
      const s = spec.spars[sIdx];
      const cx = s.xFrac * chord;

      // Base square notch size from stock size + clearance
      const base = s.stockSize + spec.slotClearance;

      // Spar angle in planform due to sweep + taper at this xFrac
      const dxdy = dXLEdy + s.xFrac * dChordDy;
      const phi = Math.atan(dxdy);
      const widen = 1 / Math.max(0.2, Math.cos(phi)); // clamp to avoid absurd widths

      // Effective notch size in rib template
      const notchSize = base * widen;

      const { yTop, yBottom } = yExtremaAtX(outline, cx);

      if (s.edge === "top" || s.edge === "both") {
        cutouts.push({
          kind: "rect",
          id: `notch-top-${sIdx}`,
          x: cx - notchSize / 2,
          y: yTop - notchSize,
          w: notchSize,
          h: notchSize,
        });
      }

      if (s.edge === "bottom" || s.edge === "both") {
        cutouts.push({
          kind: "rect",
          id: `notch-bottom-${sIdx}`,
          x: cx - notchSize / 2,
          y: yBottom,
          w: notchSize,
          h: notchSize,
        });
      }
    }

    // --- Lightening holes ---
    const lh = spec.ribFeatures.lighteningHoles;
    if (lh.enabled && lh.count > 0) {
      const r = clamp(lh.radiusFrac, 0.005, 0.25) * chord;
      const x0 = clamp(lh.xStartFrac, 0.05, 0.95) * chord;
      const x1 = clamp(lh.xEndFrac, 0.05, 0.95) * chord;
      const yOff = lh.yOffsetFrac * chord;

      for (let k = 0; k < lh.count; k++) {
        const u = lh.count === 1 ? 0.5 : k / (lh.count - 1);
        const hx = lerp(x0, x1, u);
        const hy = yOff;

        if (pointInPolygon({ x: hx, y: hy }, outline)) {
          cutouts.push({ kind: "circle", id: `lh-${k}`, cx: hx, cy: hy, r });
        }
      }
    }

    ribs.push({
      id: `rib-${i}`,
      stationY,
      chord,
      outline,
      cutouts,
    });
  }

  return { spec, ribs };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function assertSpec(spec: WingSpecV1): void {
  if (spec.version !== 1) throw new Error("WingSpecV1 version mismatch");
  if (spec.span <= 0) throw new Error("span must be > 0");
  if (spec.rootChord <= 0 || spec.tipChord <= 0) throw new Error("rootChord and tipChord must be > 0");
  if (spec.ribCountPerHalf < 2) throw new Error("ribCountPerHalf must be >= 2");
  if (!/^\d{4}$/.test(spec.airfoil.code)) throw new Error('airfoil.code must be a 4-digit string like "0012"');
  if (spec.airfoil.samples < 20) throw new Error("airfoil.samples must be >= 20");
  if (spec.slotClearance < 0) throw new Error("slotClearance must be >= 0");
  if (spec.kerf < 0) throw new Error("kerf must be >= 0");

  for (const s of spec.spars) {
    if (s.xFrac < 0 || s.xFrac > 1) throw new Error("spar xFrac must be in [0..1]");
    if (s.stockSize <= 0) throw new Error("spar stockSize must be > 0");
    if (s.edge !== "top" && s.edge !== "bottom" && s.edge !== "both") throw new Error("spar edge invalid");
  }
}

function yExtremaAtX(outline: Array<{ x: number; y: number }>, x: number): { yTop: number; yBottom: number } {
  const ys: number[] = [];

  for (let i = 0; i < outline.length - 1; i++) {
    const a = outline[i];
    const b = outline[i + 1];

    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    if (x < minX || x > maxX) continue;

    if (a.x === b.x) {
      if (a.x === x) ys.push(a.y, b.y);
      continue;
    }

    const t = (x - a.x) / (b.x - a.x);
    if (t < 0 || t > 1) continue;

    ys.push(a.y + t * (b.y - a.y));
  }

  if (ys.length === 0) return { yTop: 0, yBottom: 0 };

  let yTop = -Infinity;
  let yBottom = Infinity;
  for (const y of ys) {
    yTop = Math.max(yTop, y);
    yBottom = Math.min(yBottom, y);
  }
  return { yTop, yBottom };
}
