import type { Rib2D, WingArtifactsV1 } from "../types";

type SvgOptions = {
  margin: number;
  ribSpacing: number;
  showLabels: boolean;
};

export function wingToSvg(wing: WingArtifactsV1, opts: SvgOptions): string {
  const margin = opts.margin;
  const spacing = opts.ribSpacing;

  // ---- Row 1: ribs laid out left-to-right ----
  let ribCursorX = margin;
  let ribsRowMaxY = 0;
  const ribGroups: string[] = [];

  for (const rib of wing.ribs) {
    const b = ribBounds(rib);

    // translate rib so its bounding box starts at (ribCursorX, margin)
    const dx = ribCursorX - b.minX;
    const dy = margin - b.minY;

    const outlinePath = `<path d="${pathD(rib.outline, dx, dy)}" />`;

    const slotRects = rib.slots
      .map(
        (s) =>
          `<rect x="${s.rect.x + dx}" y="${s.rect.y + dy}" width="${s.rect.w}" height="${s.rect.h}" />`
      )
      .join("\n");

    const label = opts.showLabels
      ? `<text x="${b.minX + dx}" y="${b.maxY + dy + 10}" font-size="10">${rib.id}</text>`
      : "";

    ribGroups.push(`<g>${outlinePath}\n${slotRects}\n${label}</g>`);

    ribCursorX += (b.maxX - b.minX) + spacing;
    ribsRowMaxY = Math.max(ribsRowMaxY, b.maxY + dy);
  }

  const ribsRowWidth = ribCursorX;

  // ---- Row 2: spars laid out left-to-right under ribs ----
  const sparTop = ribsRowMaxY + margin + 40; // spacing below ribs
  let sparCursorX = margin;
  const sparGroups: string[] = [];

  for (const spar of wing.spars ?? []) {
    // Spar outline is already a closed polygon in spec units.
    const b = polyBounds(spar.outline);

    // translate spar so its bounding box starts at (sparCursorX, sparTop)
    const dx = sparCursorX - b.minX;
    const dy = sparTop - b.minY;

    const outlinePath = `<path d="${pathD(spar.outline, dx, dy)}" />`;

    const label = opts.showLabels
      ? `<text x="${b.minX + dx}" y="${b.maxY + dy + 12}" font-size="10">${spar.id}</text>`
      : "";

    sparGroups.push(`<g>${outlinePath}\n${label}</g>`);

    sparCursorX += (b.maxX - b.minX) + spacing;
  }

  // ---- Overall SVG size ----
  const width = Math.max(Math.max(ribsRowWidth, sparCursorX) + margin, 100);

  // If there are no spars, keep height based on ribs row; otherwise based on spar row.
  const bottomContentY =
    (wing.spars ?? []).length > 0 ? sparTop + 40 : ribsRowMaxY + margin;

  const height = Math.max(bottomContentY + margin + (opts.showLabels ? 24 : 0), 100);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${width}" height="${height}"
     viewBox="0 0 ${width} ${height}">
  <g id="CUT" fill="none" stroke="black" stroke-width="0.2">
    ${ribGroups.join("\n")}
    ${sparGroups.join("\n")}
  </g>
</svg>`;
}

function pathD(pts: Array<{ x: number; y: number }>, dx: number, dy: number): string {
  if (pts.length === 0) return "";
  const p0 = pts[0];
  let d = `M ${p0.x + dx} ${p0.y + dy}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x + dx} ${pts[i].y + dy}`;
  }
  d += " Z";
  return d;
}

function ribBounds(rib: Rib2D) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const p of rib.outline) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  return { minX, minY, maxX, maxY };
}

function polyBounds(poly: Array<{ x: number; y: number }>) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const p of poly) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  // Handle weird empty polygons gracefully
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };

  return { minX, minY, maxX, maxY };
}
