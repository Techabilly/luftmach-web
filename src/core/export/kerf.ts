import type { CutPrimitive } from "../types";

export function applyKerfToOutline(outline: Array<{ x: number; y: number }>, kerf: number): Array<{ x: number; y: number }> {
  if (kerf <= 0) return outline;
  const delta = kerf / 2;
  return offsetPolygon(outline, delta);
}

export function applyKerfToCutouts(cutouts: CutPrimitive[] | undefined, kerf: number): CutPrimitive[] | undefined {
  if (!cutouts || cutouts.length === 0) return cutouts;
  if (kerf <= 0) return cutouts;

  const delta = kerf / 2;

  // For internal cutouts, shrink them by delta (inward), so the kerf cut ends up at nominal size.
  return cutouts
    .map((c) => {
      if (c.kind === "rect") {
        const w = Math.max(0, c.w - 2 * delta);
        const h = Math.max(0, c.h - 2 * delta);
        return { ...c, x: c.x + delta, y: c.y + delta, w, h };
      }
      if (c.kind === "circle") {
        return { ...c, r: Math.max(0, c.r - delta) };
      }
      return c;
    })
    .filter((c) => {
      if (c.kind === "rect") return c.w > 0 && c.h > 0;
      if (c.kind === "circle") return c.r > 0;
      return true;
    });
}

/**
 * Simple polygon offset with miter joins.
 * Works best on reasonably smooth/simple polygons (like airfoils).
 */
function offsetPolygon(poly: Array<{ x: number; y: number }>, delta: number) {
  if (poly.length < 4) return poly;

  const area = signedArea(poly);
  const isCCW = area > 0;
  // For outward offset: CCW uses +delta, CW uses -delta (because normals flip)
  const d = isCCW ? delta : -delta;

  const out: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < poly.length - 1; i++) {
    const p0 = poly[(i - 1 + (poly.length - 1)) % (poly.length - 1)];
    const p1 = poly[i];
    const p2 = poly[(i + 1) % (poly.length - 1)];

    const n1 = unitNormal(p0, p1);
    const n2 = unitNormal(p1, p2);

    // Offset lines: p1 + n*d
    const a1 = { x: p0.x + n1.x * d, y: p0.y + n1.y * d };
    const b1 = { x: p1.x + n1.x * d, y: p1.y + n1.y * d };

    const a2 = { x: p1.x + n2.x * d, y: p1.y + n2.y * d };
    const b2 = { x: p2.x + n2.x * d, y: p2.y + n2.y * d };

    const ip = lineIntersection(a1, b1, a2, b2) ?? { x: p1.x + (n1.x + n2.x) * 0.5 * d, y: p1.y + (n1.y + n2.y) * 0.5 * d };
    out.push(ip);
  }

  // Close
  out.push({ ...out[0] });
  return out;
}

function unitNormal(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // Left normal
  return { x: -dy / len, y: dx / len };
}

function lineIntersection(a1: any, a2: any, b1: any, b2: any): { x: number; y: number } | null {
  const dax = a2.x - a1.x;
  const day = a2.y - a1.y;
  const dbx = b2.x - b1.x;
  const dby = b2.y - b1.y;

  const denom = dax * dby - day * dbx;
  if (Math.abs(denom) < 1e-9) return null;

  const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / denom;
  return { x: a1.x + t * dax, y: a1.y + t * day };
}

function signedArea(poly: Array<{ x: number; y: number }>) {
  let a = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    a += poly[i].x * poly[i + 1].y - poly[i + 1].x * poly[i].y;
  }
  return a * 0.5;
}
