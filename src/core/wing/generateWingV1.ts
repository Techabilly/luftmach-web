import type { CutPrimitive, DebugLatticeOverlay, Point, Rib2D, WingArtifactsV1, WingSpecV1 } from "../types";
import { pointInPolygon } from "../geom/pointInPoly";
import { naca4Polygon } from "./naca4";

export function generateWingV1(spec: WingSpecV1): WingArtifactsV1 {
  assertSpec(spec);

  const halfSpan = spec.span / 2;
  const ribs: Rib2D[] = [];

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

    // --- Lightening holes as offset rounded triangles (existing behavior) ---
    const lh = spec.ribFeatures.lighteningHoles;
    if (lh.enabled && lh.count > 0) {
      const sizeBase = clamp(lh.radiusFrac, 0.01, 0.25) * chord;
      const x0 = clamp(lh.xStartFrac, 0.05, 0.95) * chord;
      const x1 = clamp(lh.xEndFrac, 0.05, 0.95) * chord;

      const baseY = lh.yOffsetFrac * chord;
      const stagger = sizeBase * 0.35;

      const cornerRadius = clamp(lh.cornerFrac, 0, 0.5) * sizeBase;

      // Safety clearance margin from rib perimeter
      const insetMargin = Math.max(spec.kerf, spec.materialThickness * 0.15, 0.5);

      for (let k = 0; k < lh.count; k++) {
        const u = lh.count === 1 ? 0.5 : k / (lh.count - 1);
        const cx = lerp(x0, x1, u);

        // alternate up/down offsets: +, -, +, ...
        const cy = baseY + (k % 2 === 0 ? stagger : -stagger);

        // alternate orientation for visual rhythm
        const rotDeg = k % 2 === 0 ? 0 : 180;
        const rotRad = (rotDeg * Math.PI) / 180;

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

    // --- Web lattice (Step 3): convert lattice cells into CUTOUTS ---
    let webRegion: Rib2D["webRegion"] | undefined;
    let debugLattice: DebugLatticeOverlay | undefined;
    const wl = spec.ribFeatures.webLattice;
   if (wl.enabled) {
  const regionPts = webRegionBetweenSpars(outline, chord, spec.spars, wl.betweenSpars, wl.webMargin, 64);
  if (regionPts.length >= 6) {
    webRegion = { betweenSpars: wl.betweenSpars, pts: regionPts };

    const b = boundsOfPoly(regionPts);
    const candidates = latticeDiamondCells(b, wl.pitch, wl.angleDeg);

    const acceptedCells: Point[][] = [];
    const rejectedCells: Point[][] = [];

    // Filter and emit as poly cutouts
    let cellId = 0;
    for (const tri of candidates) {
      let ok = true;
      for (const v of tri) {
        if (!pointInPolygon(v, regionPts)) {
          ok = false;
          break;
        }
      }

      if (!ok) {
        rejectedCells.push(tri);
        continue;
      }

      acceptedCells.push(tri);

      const cellGap = Math.max(spec.kerf * 2, wl.cornerRadius, 0.6);

      const insetTri = insetTowardCentroid(tri, cellGap);
      if (!insetTri) continue;

      // IMPORTANT: re-check inside test using inset triangle vertices
      let ok2 = true;
      for (const v of insetTri) {
        if (!pointInPolygon(v, regionPts)) {
          ok2 = false;
          break;
        }
      }
      if (!ok2) continue;

      cutouts.push({
        kind: "poly",
        id: `wl-${i}-${cellId++}`,
        pts: insetTri,
        cornerRadius: wl.cornerRadius > 0 ? wl.cornerRadius : undefined,
      });
    }

    debugLattice = {
      webRegion: regionPts,
      candidateLattice: acceptedCells,
      rejectedCells,
    };
  }
}


    ribs.push({
      id: `rib-${i}`,
      stationY,
      chord,
      outline,
      cutouts,
      webRegion, // keep for future/debug; not rendered in plan
      debugLattice,
    });
  }

  return { spec, ribs };
}

/**
 * Build a polygon that represents the "web region" inside the rib,
 * bounded left/right by two spar x positions (with margin), and top/bottom by the airfoil outline.
 *
 * Polygon = top chain (xL->xR) + bottom chain (xR->xL)
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
  const bx = boundsX(outline);
  const eps = 1e-3;
  xL = clamp(xL, bx.minX + eps, bx.maxX - eps);
  xR = clamp(xR, bx.minX + eps, bx.maxX - eps);
  if (!(xR > xL)) return [];

  const n = clampInt(samples, 16, 200);

  const topPts: Point[] = [];
  const botPts: Point[] = [];

  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const x = lerp(xL, xR, u);
    const { yTop, yBottom, ok } = yExtremaAtXSafe(outline, x);
    if (!ok) continue;

    const yTopInset = yTop - webMargin;
    const yBottomInset = yBottom + webMargin;

    if (yTopInset <= yBottomInset) continue;

    topPts.push({ x, y: yTopInset });
    botPts.push({ x, y: yBottomInset });
  }

  if (topPts.length < 3 || botPts.length < 3) return [];

  const poly: Point[] = [];
  for (const p of topPts) poly.push(p);
  for (let i = botPts.length - 1; i >= 0; i--) poly.push(botPts[i]);

  // sanity: centroid should be inside rib outline
  const c = centroid(poly);
  if (!pointInPolygon(c, outline)) return [];

  return poly;

}
// -------------------- Lattice helpers --------------------

function rotatePoint(p: Point, c: Point, angRad: number): Point {
  const s = Math.sin(angRad);
  const co = Math.cos(angRad);
  const x = p.x - c.x;
  const y = p.y - c.y;
  return { x: c.x + x * co - y * s, y: c.y + x * s + y * co };
}

function boundsOfPoly(pts: Point[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}


function latticeDiamondCells(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  pitch: number,
  angleDeg: number
): Point[][] {
  const p = Math.max(0.5, pitch);
  const h = p * 0.5; // diamond half-height

  const pad = p * 2;

  const minX = bounds.minX - pad;
  const maxX = bounds.maxX + pad;
  const minY = bounds.minY - pad;
  const maxY = bounds.maxY + pad;

  const center: Point = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };

  const ang = (angleDeg * Math.PI) / 180;

  const cells: Point[][] = [];

  let row = 0;

  for (let y = minY; y <= maxY + p; y += p) {
    const xOffset = (row % 2) * (p / 2);

    for (let x = minX; x <= maxX + p; x += p) {
      const cx = x + xOffset;
      const cy = y;

      const diamond: Point[] = [
        { x: cx, y: cy - h },
        { x: cx + p / 2, y: cy },
        { x: cx, y: cy + h },
        { x: cx - p / 2, y: cy },
      ];

      cells.push(diamond.map((pt) => rotatePoint(pt, center, ang)));
    }

    row++;
  }

  return cells;
}

// -------------------- Existing helper utilities --------------------

/**
 * Ensure the lightening hole triangle fully fits inside the rib outline,
 * with an additional safety inset margin (so the cut doesn't clip the perimeter).
 */
function fitTriangleHole(
  outline: Point[],
  cx: number,
  cy: number,
  rBase: number,
  rotRad: number,
  insetMargin: number
): Point[] | null {
  if (!pointInPolygon({ x: cx, y: cy }, outline)) return null;

  let r = rBase;

  for (let attempt = 0; attempt < 8; attempt++) {
    const tri = equilateralTriangle(cx, cy, r, rotRad);
    const insetTri = insetTowardCentroid(tri, insetMargin);

    if (insetTri && allPointsInside(outline, insetTri)) return insetTri;

    r *= 0.85;
    if (r < rBase * 0.25) break;
  }

  return null;
}

function allPointsInside(outline: Point[], pts: Point[]): boolean {
  for (const p of pts) {
    if (!pointInPolygon(p, outline)) return false;
  }
  return true;
}

function insetTowardCentroid(pts: Point[], inset: number): Point[] | null {
  if (pts.length < 3) return null;

  const c = centroid(pts);

  const out: Point[] = [];
  for (const p of pts) {
    const vx = c.x - p.x;
    const vy = c.y - p.y;
    const len = Math.hypot(vx, vy);
    if (len <= 1e-6) return null;

    const d = Math.min(inset, len * 0.45);
    const ux = vx / len;
    const uy = vy / len;

    out.push({ x: p.x + ux * d, y: p.y + uy * d });
  }

  return out;
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

function equilateralTriangle(cx: number, cy: number, r: number, rotRad: number): Point[] {
  const pts: Point[] = [];
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

function clampInt(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.floor(v)));
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