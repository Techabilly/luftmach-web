import type { CutPrimitive, Point, WingArtifactsV1, WingSpecV1 } from "../types";
import { pointInPolygon } from "../geom/pointInPoly";
import { naca4Polygon } from "./naca4";

export function generateWingV1(spec: WingSpecV1): WingArtifactsV1 {
  assertSpec(spec);

  const halfSpan = spec.span / 2;
  const ribs: WingArtifactsV1["ribs"] = [];

  const count = Math.max(2, Math.floor(spec.ribCountPerHalf));

  // Planform derivatives for spar angle (constant for linear sweep + linear taper)
  const dChordDy = (spec.tipChord - spec.rootChord) / halfSpan;
  const dXLEdy = spec.sweepLE / halfSpan;

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const stationY = t * halfSpan;

    const chord = lerp(spec.rootChord, spec.tipChord, t);

    // Airfoil outline (closed polygon)
    const outline: Point[] = naca4Polygon(spec.airfoil.code, spec.airfoil.samples).map((p) => ({
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

    // --- Step 1: compute web region polygon (between selected spars) ---
    let webRegion: { betweenSpars: [number, number]; pts: Point[] } | undefined;

    const wl = spec.ribFeatures.webLattice;
    if (wl.enabled) {
      const pts = webRegionBetweenSpars(outline, chord, spec.spars, wl.betweenSpars, wl.webMargin, 48);
      if (pts.length >= 6) {
        webRegion = { betweenSpars: wl.betweenSpars, pts };
      }
    }

    ribs.push({
      id: `rib-${i}`,
      stationY,
      chord,
      outline,
      cutouts,
      webRegion,
    });
  }

  return { spec, ribs };
}

/**
 * Build a polygon that represents the "web region" inside the rib,
 * bounded left/right by two spar x positions (with margin), and top/bottom by the airfoil outline.
 *
 * Method:
 * - compute xL/xR from spar indices and chord
 * - apply webMargin
 * - sample N x positions in [xL..xR]
 * - for each x, find yTop/yBottom from outline intersections
 * - create polygon: top chain (increasing x) + bottom chain (decreasing x)
 */
export function webRegionBetweenSpars(
  outline: Point[],
  chord: number,
  spars: Array<{ xFrac: number; stockSize: number; edge: "top" | "bottom" | "both" }>,
  between: [number, number],
  webMargin: number,
  samples: number
): Point[] {
  const [a, b] = between;
  if (a < 0 || b < 0 || a >= spars.length || b >= spars.length) return [];
  if (a === b) return [];

  const left = Math.min(a, b);
  const right = Math.max(a, b);

  let xL = spars[left].xFrac * chord + webMargin;
  let xR = spars[right].xFrac * chord - webMargin;

  if (!(xR > xL)) return [];

  // Clamp within outline x-range
  const { minX, maxX } = boundsX(outline);
  const eps = 1e-3;
  xL = clamp(xL, minX + eps, maxX - eps);
  xR = clamp(xR, minX + eps, maxX - eps);
  if (!(xR > xL)) return [];

  const n = clampInt(samples, 12, 200);

  const topPts: Point[] = [];
  const botPts: Point[] = [];

  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const x = lerp(xL, xR, u);
    const { yTop, yBottom, ok } = yExtremaAtXSafe(outline, x);
    if (!ok) continue;

    topPts.push({ x, y: yTop });
    botPts.push({ x, y: yBottom });
  }

  if (topPts.length < 3 || botPts.length < 3) return [];

  // Build polygon: top left->right, bottom right->left
  const poly: Point[] = [];
  for (const p of topPts) poly.push(p);
  for (let i = botPts.length - 1; i >= 0; i--) poly.push(botPts[i]);

  // Optional: ensure polygon is generally valid and inside rib (sample a centroid check)
  const c = centroid(poly);
  if (!pointInPolygon(c, outline)) {
    // if centroid isn't inside, something's off—return empty rather than emitting junk
    return [];
  }

  return poly;
}

function centroid(pts: Point[]): Point {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

function boundsX(pts: Point[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
  }
  if (!isFinite(minX)) return { minX: 0, maxX: 0 };
  return { minX, maxX };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function clampInt(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.floor(v)));
}

function assertSpec(spec: WingSpecV1) {
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
  }

  const wl = spec.ribFeatures.webLattice;
  if (wl.pitch <= 0) throw new Error("webLattice.pitch must be > 0");
  if (wl.webMargin < 0) throw new Error("webLattice.webMargin must be >= 0");
}

function yExtremaAtX(outline: Point[], x: number): { yTop: number; yBottom: number } {
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

function yExtremaAtXSafe(outline: Point[], x: number): { yTop: number; yBottom: number; ok: boolean } {
  const { yTop, yBottom } = yExtremaAtX(outline, x);
  const ok = isFinite(yTop) && isFinite(yBottom) && yTop > yBottom;
  return { yTop, yBottom, ok };
}
