import type { LayoutResult, SheetSpec } from "./layoutTypes";

type SvgSheetOptions = {
  showLabels: boolean;
  showSheetBorder: boolean;
};

export function layoutToSheetSvgs(
  layout: LayoutResult,
  sheet: SheetSpec,
  opts: SvgSheetOptions
): string[] {
  return layout.sheets.map((sheetLayout) => {
    const cutParts: string[] = [];
    const engraveParts: string[] = [];
    const guideParts: string[] = [];

    // ---- GUIDES LAYER ----
    if (opts.showSheetBorder) {
      // Outer sheet boundary
      guideParts.push(
        `<rect x="0" y="0" width="${sheet.width}" height="${sheet.height}" />`
      );

      // Usable area (margin box)
      guideParts.push(
        `<rect x="${sheet.margin}" y="${sheet.margin}"
               width="${sheet.width - sheet.margin * 2}"
               height="${sheet.height - sheet.margin * 2}" />`
      );
    }

    // ---- CUT + ENGRAVE LAYERS ----
    for (const p of sheetLayout.parts) {
      // CUT: main outline
      cutParts.push(
        `<path d="${pathD(p.outline, p.x, p.y)}" />`
      );

      // CUT: slot rectangles or cutouts
      if (p.rectCutouts) {
        for (const r of p.rectCutouts) {
          cutParts.push(
            `<rect x="${r.x + p.x}"
                   y="${r.y + p.y}"
                   width="${r.w}"
                   height="${r.h}" />`
          );
        }
      }
      const b = polyBounds(p.outline);
      const cx = p.x + (b.minX + b.maxX) / 2;
      const cy = p.y + (b.minY + b.maxY) / 2;
      // ENGRAVE: label
      if (opts.showLabels) {
      const label = p.label ?? p.id;
const fontSize = clamp(Math.min(p.width, p.height) * 0.12, 6, 12);

engraveParts.push(
  `<text x="${cx}" y="${cy}" font-size="${fontSize}" text-anchor="middle" dominant-baseline="central">${escapeXml(
    label
  )}</text>`
);
      }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${sheet.width}"
     height="${sheet.height}"
     viewBox="0 0 ${sheet.width} ${sheet.height}">

  <!-- GUIDES: 50% gray -->
  <g id="GUIDES"
     fill="none"
     stroke="#808080"
     stroke-width="0.3">
    ${guideParts.join("\n")}
  </g>

  <!-- CUT: 100% black -->
  <g id="CUT"
     fill="none"
     stroke="#000000"
     stroke-width="0.2">
    ${cutParts.join("\n")}
  </g>

  <!-- ENGRAVE: 50% gray -->
  <g id="ENGRAVE"
     fill="#808080"
     stroke="#808080"
     stroke-width="0.2">
    ${engraveParts.join("\n")}
  </g>

</svg>`;
  });
}

function pathD(
  pts: Array<{ x: number; y: number }>,
  dx: number,
  dy: number
): string {
  if (pts.length === 0) return "";
  const p0 = pts[0];
  let d = `M ${p0.x + dx} ${p0.y + dy}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x + dx} ${pts[i].y + dy}`;
  }
  d += " Z";
  return d;
}
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function escapeXml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
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

  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}
