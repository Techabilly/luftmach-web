export type Pt = { x: number; y: number };

export function closePolygon(pts: Pt[]): Pt[] {
  if (pts.length < 3) return pts;
  const a = pts[0];
  const b = pts[pts.length - 1];
  if (a.x === b.x && a.y === b.y) return pts;
  return [...pts, { ...a }];
}

export function polygonArea(pts: Pt[]): number {
  // Shoelace formula (works with open or closed polygons)
  let area = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    area += pts[i].x * pts[i + 1].y - pts[i + 1].x * pts[i].y;
  }
  return area * 0.5;
}

/**
 * Ensures clockwise winding (useful for consistent SVG output).
 * Returns a CLOSED polygon.
 */
export function ensureClockwise(pts: Pt[]): Pt[] {
  const closed = closePolygon(pts);
  const area = polygonArea(closed);
  // area > 0 => CCW; we want CW
  return area > 0 ? closed.slice().reverse() : closed;
}
