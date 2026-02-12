import type { LayoutResult, PlacedPart, SheetSpec } from "./layoutTypes";

type RawPart = {
  id: string;
  outline: Array<{ x: number; y: number }>;
  rectCutouts?: Array<{ x: number; y: number; w: number; h: number }>;
  label?: string;
};

export function packPartsToSheets(parts: RawPart[], sheet: SheetSpec): LayoutResult {
  const usableW = sheet.width - sheet.margin * 2;
  const usableH = sheet.height - sheet.margin * 2;

  const withBounds = parts.map((p) => {
    const b = bounds(p.outline);
    return {
      ...p,
      b,
      w: b.maxX - b.minX,
      h: b.maxY - b.minY,
    };
  });

  // Place larger parts first for better packing (still simple)
  withBounds.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));

  const sheets: LayoutResult["sheets"] = [];
  let sheetIndex = 0;

  // Shelf cursor
  let x = 0;
  let y = 0;
  let rowH = 0;

  let current: PlacedPart[] = [];
  const startNewSheet = () => {
    if (current.length > 0) {
      sheets.push({ index: sheetIndex, parts: current });
      sheetIndex++;
    }
    current = [];
    x = 0;
    y = 0;
    rowH = 0;
  };

  startNewSheet(); // initializes first sheet, but doesn't push yet

  for (const p of withBounds) {
    const w = p.w;
    const h = p.h;

    // If it doesn't fit in usable area at all, we still place it (will overflow)
    // but better to warn later. For v1, just place.
    const neededW = w + (x > 0 ? sheet.spacing : 0);
    const neededH = h;

    // Move to next row if needed
    if (x > 0 && x + neededW > usableW) {
      x = 0;
      y += rowH + sheet.spacing;
      rowH = 0;
    }

    // New sheet if needed
    if (y > 0 && y + neededH > usableH) {
      // push current sheet and reset
      sheets.push({ index: sheetIndex, parts: current });
      sheetIndex++;
      current = [];
      x = 0;
      y = 0;
      rowH = 0;
    }

    const placeX = sheet.margin + x - p.b.minX + (x > 0 ? sheet.spacing : 0);
    const placeY = sheet.margin + y - p.b.minY;

    x += (x > 0 ? sheet.spacing : 0) + w;
    rowH = Math.max(rowH, h);

    current.push({
      id: p.id,
      sheetIndex,
      x: placeX,
      y: placeY,
      width: w,
      height: h,
      outline: p.outline,
      rectCutouts: p.rectCutouts,
      label: p.label ?? p.id,
    });
  }

  // push last sheet
  if (current.length > 0) sheets.push({ index: sheetIndex, parts: current });

  return { sheets };
}

function bounds(poly: Array<{ x: number; y: number }>) {
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
