import type { Pt } from "../geom/polygon";
import { closePolygon, ensureClockwise } from "../geom/polygon";

/**
 * Generates a CLOSED polygon for a NACA 4-digit airfoil.
 * - chord-space: x in [0..1]
 * - y is thickness/camber in chord units
 * - returned polygon is CLOCKWISE
 */
export function naca4Polygon(code: string, samples: number): Pt[] {
  // NACA MPXX:
  // M: max camber (%)
  // P: location of max camber (tenths of chord)
  // XX: thickness (%)
  const m = parseInt(code[0] ?? "0", 10) / 100;
  const p = parseInt(code[1] ?? "0", 10) / 10;
  const t = parseInt(code.slice(2, 4) || "12", 10) / 100;

  const n = Math.max(20, Math.floor(samples));
  const xs = cosineSpacing(n);

  // Thickness distribution
  const yt = (x: number) =>
    5 *
    t *
    (0.2969 * Math.sqrt(x) -
      0.126 * x -
      0.3516 * x * x +
      0.2843 * x * x * x -
      0.1015 * x * x * x * x);

  const yc = (x: number) => {
    if (m === 0 || p === 0) return 0;
    if (x < p) return (m / (p * p)) * (2 * p * x - x * x);
    return (m / ((1 - p) * (1 - p))) * ((1 - 2 * p) + 2 * p * x - x * x);
  };

  const dyc = (x: number) => {
    if (m === 0 || p === 0) return 0;
    if (x < p) return (2 * m / (p * p)) * (p - x);
    return (2 * m / ((1 - p) * (1 - p))) * (p - x);
  };

  const upper: Pt[] = [];
  const lower: Pt[] = [];

  for (const x of xs) {
    const theta = Math.atan(dyc(x));
    const yT = yt(x);
    const yC = yc(x);

    const xu = x - yT * Math.sin(theta);
    const yu = yC + yT * Math.cos(theta);

    const xl = x + yT * Math.sin(theta);
    const yl = yC - yT * Math.cos(theta);

    upper.push({ x: xu, y: yu });
    lower.push({ x: xl, y: yl });
  }

  // Closed polygon: upper (LE->TE) + lower (TE->LE)
  const poly = [...upper, ...lower.reverse()];
  return ensureClockwise(closePolygon(poly));
}

function cosineSpacing(n: number): number[] {
  // Clusters points near LE and TE
  const xs: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    xs.push(0.5 * (1 - Math.cos(Math.PI * u)));
  }
  return xs;
}
