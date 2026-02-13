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

    // Airfoil outline (closed polygon)
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

    // --- Lightening holes as offset rounded triangles (F1: guaranteed fully inside) ---
    const lh = spec.ribFeatures.lighteningHoles;
    if (lh.enabled && lh.count > 0) {
      const sizeBase = clamp(lh.radiusFrac, 0.01, 0.25) * chord;
      const x0 = clamp(lh.xStartFrac, 0.05, 0.95) * chord;
      const x1 = clamp(lh.xEndFrac, 0.05, 0.95) * chord;

      const baseY = lh.yOffsetFrac * chord;
      const stagger = sizeBase * 0.35;

      const cornerRadius = clamp(lh.cornerFrac, 0, 0.5) * sizeBase;

      // Safety clearance margin from rib perimeter (in same units as model: mm)
      const insetMargin = Math.max(spec.kerf, spec.materialThickness * 0.15, 0.5);

      for (let k = 0; k < lh.count; k++) {
        const u = lh.count === 1 ? 0.5 : k / (lh.count - 1);
        const cx = lerp(x0, x1, u);

        // alternate up/down offsets: +, -, +, ...
        const cy = baseY + (k % 2 === 0 ? stagger : -stagger);

        // alternate orientation for visual rhythm
        const rotDeg = k % 2 === 0 ? 0 : 180;
        const rotRad = (rotDeg * Math.PI) / 180;

        // Try to fit: shrink if needed, then inset for margin
        const fitted = fitTriangleHole(outline, cx, cy, sizeBase, rotRad, insetMargin);

        if (fitted) {
          cutouts.push({
            kind: "poly",
            id: `lh-tri-${k}`,
            pts: fitted,
            cornerRadius: cornerRadius > 0 ? Math.min(cornerRadius, sizeBase * 0.45) : undefined,
          });
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

/**
 * F1: Ensure the lightening hole triangle fully fits inside the rib outline,
 * with an additional safety inset margin (so the cut doesn't clip the perimeter).
 *
 * Strategy:
 * - Start with size r
 * - Create triangle points
 * - Inset them toward centroid by insetMargin (so we keep clearance)
 * - If all inset vertices are inside outline -> accept
 * - Otherwise shrink and retry
 */
function fitTriangleHole(
  outline: Array<{ x: number; y: number }>,
  cx: number,
  cy: number,
  rBase: number,
  rotRad: number,
  insetMargin: number
): Array<{ x: number; y: number }> | null {
  // quick reject: if center isn't inside, don't bother
  if (!pointInPolygon({ x: cx, y: cy }, outline)) return null;

  let r = rBase;

  // A few shrink attempts is plenty; this is fast and stable
  for (let attempt = 0; attempt < 8; attempt++) {
    const tri = equilateralTriangle(cx, cy, r, rotRad);

    // Inset toward centroid to guarantee a clearance margin
    const insetTri = insetTowardCentroid(tri, insetMargin);

    if (insetTri && allPointsInside(outline, insetTri)) {
      return insetTri;
    }

    r *= 0.85; // shrink and retry
    if (r < rBase * 0.25) break; // don't produce tiny junk holes
  }

  return null;
}

function allPointsInside(outline: Array<{ x: number; y: number }>, pts: Array<{ x: number; y: number }>): boolean {
  for (const p of pts) {
    if (!pointInPolygon(p, outline)) return false;
  }
  return true;
}

function insetTowardCentroid(
  pts: Array<{ x: number; y: number }>,
  inset: number
): Array<{ x: number; y: number }> | null {
  if (pts.length < 3) return null;

  const c = centroid(pts);

  // Move each vertex toward centroid by `inset`, clamped by distance to centroid
  const out: Array<{ x: number; y: number }> = [];
  for (const p of pts) {
    const vx = c.x - p.x;
    const vy = c.y - p.y;
    const len = Math.hypot(vx, vy);
    if (len <= 1e-6) return null;

    const d = Math.min(inset, len * 0.45); // prevent collapsing
    const ux = vx / len;
    const uy = vy / len;

    out.push({ x: p.x + ux * d, y: p.y + uy * d });
  }

  return out;
}

function centroid(pts: Array<{ x: number; y: number }>): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

function equilateralTriangle(cx: number, cy: number, r: number, rotRad: number): Array<{ x: number; y: number }> {
  // vertices on a circle of radius r
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 3; i++) {
    const a = rotRad + (Math.PI * 2 * i) / 3;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
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

  const lh = spec.ribFeatures.lighteningHoles;
  if (lh.count < 0) throw new Error("lightening hole count must be >= 0");
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
