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

    // Open U-notches that touch the rib perimeter (top/bottom/both)
    const slots = spec.spars.flatMap((s, idx) => {
      const cx = s.xFrac * chord;

      // Notch width is stock stick size + clearance
     const notchW = s.stockSize + spec.slotClearance;
     const notchH = notchW; // square notch


      // Find rib top and bottom at this x by intersecting outline with vertical line
      const { yTop, yBottom } = yExtremaAtX(outline, cx);

      const rects: Array<{
        id: string;
        rect: { x: number; y: number; w: number; h: number };
      }> = [];

      if (s.edge === "top" || s.edge === "both") {
        rects.push({
          id: `notch-top-${idx}`,
          rect: {
            x: cx - notchW / 2,
            y: yTop - notchH,
            w: notchW,
            h: notchH,
          },
        });
      }

      if (s.edge === "bottom" || s.edge === "both") {
        rects.push({
          id: `notch-bottom-${idx}`,
          rect: {
            x: cx - notchW / 2,
            y: yBottom,
            w: notchW,
            h: notchH,
          },
        });
      }

      return rects;
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
  if (spec.airfoil.samples < 20) throw new Error("airfoil.samples must be >= 20");

  if (spec.slotClearance < 0) throw new Error("slotClearance must be >= 0");

  for (const s of spec.spars) {
    if (s.xFrac < 0 || s.xFrac > 1) throw new Error("spar xFrac must be in [0..1]");
    if (s.stockSize <= 0) throw new Error("spar stockSize must be > 0");
    if (s.edge !== "top" && s.edge !== "bottom" && s.edge !== "both") throw new Error("spar edge invalid");
  }
}

function yExtremaAtX(
  outline: Array<{ x: number; y: number }>,
  x: number
): { yTop: number; yBottom: number } {
  const ys: number[] = [];

  for (let i = 0; i < outline.length - 1; i++) {
    const a = outline[i];
    const b = outline[i + 1];

    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    if (x < minX || x > maxX) continue;

    // Vertical segment: if it lies on x, include endpoints
    if (a.x === b.x) {
      if (a.x === x) ys.push(a.y, b.y);
      continue;
    }

    const t = (x - a.x) / (b.x - a.x);
    if (t < 0 || t > 1) continue;

    const y = a.y + t * (b.y - a.y);
    ys.push(y);
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
