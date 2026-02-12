import type { WingArtifactsV1 } from "../types";

type PlanOptions = {
  margin: number;
  showRibStations: boolean;
  showSparLines: boolean;
  showLabels: boolean;
};

export function wingPlanToSvg(wing: WingArtifactsV1, opts: PlanOptions): string {
  const m = opts.margin;

  const halfSpan = wing.spec.span / 2;
  const root = wing.spec.rootChord;
  const tip = wing.spec.tipChord;

  // Trapezoid planform including sweepLE (LE at tip is shifted by sweepLE)
  const left = [
    { x: 0, y: 0 },
    { x: root, y: 0 },
    { x: wing.spec.sweepLE + tip, y: halfSpan },
    { x: wing.spec.sweepLE, y: halfSpan },
    { x: 0, y: 0 },
  ];
  const right = left.map((p) => ({ x: p.x, y: -p.y }));

  const allPts = [...left, ...right];
  const b = bounds(allPts);

  const dx = m - b.minX;
  const dy = m - b.minY;

  const guides: string[] = [];
  const engrave: string[] = [];

  // Planform outlines (GUIDES)
  guides.push(`<path d="${pathD(left, dx, dy)}" />`);
  guides.push(`<path d="${pathD(right, dx, dy)}" />`);

  // Centerline (GUIDES)
  guides.push(`<line x1="${dx}" y1="${dy}" x2="${dx + root}" y2="${dy}" />`);

  // Rib stations (GUIDES)
  if (opts.showRibStations) {
    for (const rib of wing.ribs) {
      const y = rib.stationY;
      // station line across root chord for readability
      guides.push(`<line x1="${0 + dx}" y1="${y + dy}" x2="${root + dx}" y2="${y + dy}" />`);
      guides.push(`<line x1="${0 + dx}" y1="${-y + dy}" x2="${root + dx}" y2="${-y + dy}" />`);
    }
  }

  // Spar lines (GUIDES) + labels (ENGRAVE)
  if (opts.showSparLines) {
    const dChordDy = (tip - root) / halfSpan;
    const dXLEdy = wing.spec.sweepLE / halfSpan;

    for (let i = 0; i < wing.spec.spars.length; i++) {
      const s = wing.spec.spars[i];

      const xRoot = 0 + s.xFrac * root;
      const xTip = wing.spec.sweepLE + s.xFrac * tip;

      // draw actual spar line from root to tip on both panels
      guides.push(`<line x1="${xRoot + dx}" y1="${0 + dy}" x2="${xTip + dx}" y2="${halfSpan + dy}" />`);
      guides.push(`<line x1="${xRoot + dx}" y1="${0 + dy}" x2="${xTip + dx}" y2="${-halfSpan + dy}" />`);

      if (opts.showLabels) {
        const dxdy = dXLEdy + s.xFrac * dChordDy;
        const angleDeg = (Math.atan(dxdy) * 180) / Math.PI;

        // label near root, offset slightly up so it’s readable
        const label = `spar ${i + 1}  x=${s.xFrac.toFixed(2)}  size=${fmt(wing.spec.units, s.stockSize)}  edge=${s.edge}  ang=${angleDeg.toFixed(1)}°`;
        engrave.push(
          `<text x="${xRoot + dx + 2}" y="${dy + 14 + i * 12}" font-size="10">${escapeXml(label)}</text>`
        );
      }
    }
  }

  const width = b.maxX - b.minX + m * 2;
  const height = b.maxY - b.minY + m * 2;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${width}" height="${height}"
     viewBox="0 0 ${width} ${height}">
  <g id="GUIDES" fill="none" stroke="#808080" stroke-width="0.3">
    ${guides.join("\n")}
  </g>
  <g id="ENGRAVE" fill="#808080" stroke="#808080" stroke-width="0.2">
    ${engrave.join("\n")}
  </g>
</svg>`;
}

function pathD(pts: Array<{ x: number; y: number }>, dx: number, dy: number): string {
  if (pts.length === 0) return "";
  const p0 = pts[0];
  let d = `M ${p0.x + dx} ${p0.y + dy}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x + dx} ${pts[i].y + dy}`;
  d += " Z";
  return d;
}

function bounds(poly: Array<{ x: number; y: number }>) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

function fmt(units: "mm" | "in", v: number) {
  if (units === "in") return `${v.toFixed(3)} in`;
  return `${v.toFixed(2)} mm`;
}

function escapeXml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
