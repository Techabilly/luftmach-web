import type { SheetSpec } from "./layoutTypes";
import type { LayoutResult } from "./layoutTypes";

type SvgSheetOptions = {
  showLabels: boolean;
  showSheetBorder: boolean;
};

export function layoutToSheetSvgs(layout: LayoutResult, sheet: SheetSpec, opts: SvgSheetOptions): string[] {
  return layout.sheets.map((s) => {
    const border = opts.showSheetBorder
      ? `<rect x="0" y="0" width="${sheet.width}" height="${sheet.height}" fill="none" stroke="black" stroke-width="0.3" />`
      : "";

    const parts = s.parts
      .map((p) => {
        const outline = `<path d="${pathD(p.outline, p.x, p.y)}" />`;

        const cutouts =
          p.rectCutouts?.map((r) => `<rect x="${r.x + p.x}" y="${r.y + p.y}" width="${r.w}" height="${r.h}" />`).join("\n") ??
          "";

        const label = opts.showLabels
          ? `<text x="${p.x}" y="${p.y + p.height + 12}" font-size="10">${p.label ?? p.id}</text>`
          : "";

        return `<g>${outline}\n${cutouts}\n${label}</g>`;
      })
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${sheet.width}" height="${sheet.height}"
     viewBox="0 0 ${sheet.width} ${sheet.height}">
  <g id="CUT" fill="none" stroke="black" stroke-width="0.2">
    ${border}
    ${parts}
  </g>
</svg>`;
  });
}

function pathD(pts: Array<{ x: number; y: number }>, dx: number, dy: number): string {
  if (pts.length === 0) return "";
  const p0 = pts[0];
  let d = `M ${p0.x + dx} ${p0.y + dy}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x + dx} ${pts[i].y + dy}`;
  d += " Z";
  return d;
}
