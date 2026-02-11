import type { Rib2D, WingArtifactsV1 } from "../types";

type SvgOptions = {
  margin: number;
  ribSpacing: number;
  showLabels: boolean;
};

export function wingToSvg(wing: WingArtifactsV1, opts: SvgOptions): string {
  const margin = opts.margin;
  const spacing = opts.ribSpacing;

  let cursorX = margin;
  let maxY = 0;

  const groups: string[] = [];

  for (const rib of wing.ribs) {
    const b = ribBounds(rib);

    // Translate rib so its bounding box starts at (cursorX, margin)
    const dx = cursorX - b.minX;
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

    groups.push(`<g>${outlinePath}\n${slotRects}\n${label}</g>`);

    cursorX += (b.maxX - b.minX) + spacing;
    maxY = Math.max(maxY, b.maxY + dy);
  }

  const width = Math.max(cursorX + margin, 100);
  const height = Math.max(maxY + margin * 2 + (opts.showLabels ? 24 : 0), 100);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${width}" height="${height}"
     viewBox="0 0 ${width} ${height}">
  <g id="CUT" fill="none" stroke="black" stroke-width="0.2">
    ${groups.join("\n")}
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
