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

      // ENGRAVE: label
      if (opts.showLabels) {
        engraveParts.push(
          `<text x="${p.x}"
                 y="${p.y + p.height + 12}"
                 font-size="10">
             ${p.label ?? p.id}
           </text>`
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
