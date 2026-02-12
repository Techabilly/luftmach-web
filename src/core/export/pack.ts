import type { LayoutResult, PlacedPart, RawPart, SheetSpec } from "./layoutTypes";

export function packPartsToSheets(parts: RawPart[], sheet: SheetSpec): LayoutResult {
  const usableW = sheet.width - sheet.margin * 2;
  const usableH = sheet.height - sheet.margin * 2;

  const withBounds = parts.map((p) => {
    const b = bounds(p.outline);
    return { p, b, w: b.maxX - b.minX, h: b.maxY - b.minY };
  });

  // Big first
  withBounds.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));

  const sheets: LayoutResult["sheets"] = [];
  let sheetIndex = 0;

  let x = 0;
  let y = 0;
  let rowH = 0;

  let current: PlacedPart[] = [];
  let warnings: string[] = [];

  function pushSheet() {
    if (current.length > 0) {
      sheets.push({ index: sheetIndex, parts: current, warnings });
      sheetIndex++;
    }
    current = [];
    warnings = [];
    x = 0;
    y = 0;
    rowH = 0;
  }

  for (const item of withBounds) {
    const p = item.p;
    const b = item.b;

    const w0 = item.w;
    const h0 = item.h;

    const cand0 = makeCandidate(p, b, w0, h0, 0);
    const cand90 = makeCandidate(p, b, h0, w0, 90);

    const chosen = chooseOrientation(cand0, cand90, usableW, usableH);

    const neededW = chosen.w + (x > 0 ? sheet.spacing : 0);
    if (x > 0 && x + neededW > usableW) {
      x = 0;
      y += rowH + sheet.spacing;
      rowH = 0;
    }

    if (y > 0 && y + chosen.h > usableH) {
      pushSheet();
    }

    const placeX = sheet.margin + x + (x > 0 ? sheet.spacing : 0);
    const placeY = sheet.margin + y;

    x += (x > 0 ? sheet.spacing : 0) + chosen.w;
    rowH = Math.max(rowH, chosen.h);

    const placed = placePart(chosen, placeX, placeY, sheetIndex);
    current.push(placed);

    if (chosen.w > usableW || chosen.h > usableH) {
      warnings.push(
        `${placed.id} exceeds usable area (${usableW}x${usableH}) with part (${chosen.w.toFixed(1)}x${chosen.h.toFixed(1)})`
      );
    }
  }

  if (current.length > 0) sheets.push({ index: sheetIndex, parts: current, warnings });

  return { sheets };
}

type Candidate = {
  id: string;
  rotationDeg: 0 | 90;
  w: number;
  h: number;

  // original part data
  outline: Array<{ x: number; y: number }>;
  cutouts?: RawPart["cutouts"];
  label?: string;

  // original bounds for normalization
  b: { minX: number; minY: number; maxX: number; maxY: number };
};

function makeCandidate(p: RawPart, b: Candidate["b"], w: number, h: number, rot: 0 | 90): Candidate {
  return {
    id: p.id,
    rotationDeg: rot,
    w,
    h,
    outline: p.outline,
    cutouts: p.cutouts,
    label: p.label,
    b,
  };
}

function chooseOrientation(a: Candidate, b: Candidate, usableW: number, usableH: number): Candidate {
  const aFits = a.w <= usableW && a.h <= usableH;
  const bFits = b.w <= usableW && b.h <= usableH;
  if (aFits && !bFits) return a;
  if (!aFits && bFits) return b;
  return Math.max(a.w, a.h) <= Math.max(b.w, b.h) ? a : b;
}

function placePart(c: Candidate, placeX: number, placeY: number, sheetIndex: number): PlacedPart {
  // Normalize to (0,0) using bounds min
  const normOutline = c.outline.map((pt) => ({ x: pt.x - c.b.minX, y: pt.y - c.b.minY }));

  const normCutouts = (c.cutouts ?? []).map((cu) => {
    if (cu.kind === "rect") {
      return { ...cu, x: cu.x - c.b.minX, y: cu.y - c.b.minY };
    }
    if (cu.kind === "circle") {
      return { ...cu, cx: cu.cx - c.b.minX, cy: cu.cy - c.b.minY };
    }
    return cu;
  });

  // Dimensions of normalized part
  const w0 = c.b.maxX - c.b.minX;
  const h0 = c.b.maxY - c.b.minY;

  let outOutline = normOutline;
  let outCutouts = normCutouts;

  if (c.rotationDeg === 90) {
    // Rotate about origin with positive quadrant mapping:
    // (x,y) -> (y, w0 - x)
    outOutline = normOutline.map((p) => ({ x: p.y, y: w0 - p.x }));

    outCutouts = normCutouts.map((cu: any) => {
      if (cu.kind === "rect") {
        const corners = [
          { x: cu.x, y: cu.y },
          { x: cu.x + cu.w, y: cu.y },
          { x: cu.x + cu.w, y: cu.y + cu.h },
          { x: cu.x, y: cu.y + cu.h },
        ].map((p) => ({ x: p.y, y: w0 - p.x }));

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const c of corners) {
          minX = Math.min(minX, c.x);
          minY = Math.min(minY, c.y);
          maxX = Math.max(maxX, c.x);
          maxY = Math.max(maxY, c.y);
        }
        return { ...cu, x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      }

      if (cu.kind === "circle") {
        return { ...cu, cx: cu.cy, cy: w0 - cu.cx };
      }

      return cu;
    });
  }

  // Ensure closed outline remains closed
  if (outOutline.length > 0) {
    const f = outOutline[0];
    const l = outOutline[outOutline.length - 1];
    if (f.x !== l.x || f.y !== l.y) outOutline = [...outOutline, { ...f }];
  }

  return {
    id: c.id,
    sheetIndex,
    x: placeX,
    y: placeY,
    width: c.rotationDeg === 0 ? w0 : h0,
    height: c.rotationDeg === 0 ? h0 : w0,
    outline: outOutline,
    cutouts: outCutouts,
    label: c.label,
    rotationDeg: c.rotationDeg,
  };
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
