import type { CutPrimitive } from "../types";

export type SheetSpec = {
  width: number;
  height: number;
  margin: number;
  spacing: number;
};

export type RawPart = {
  id: string;
  outline: Array<{ x: number; y: number }>; // closed
  cutouts?: CutPrimitive[];
  label?: string;
};

export type PlacedPart = {
  id: string;
  sheetIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;

  outline: Array<{ x: number; y: number }>;
  cutouts?: CutPrimitive[];
  label?: string;

  rotationDeg: 0 | 90;
};

export type LayoutResult = {
  sheets: Array<{
    index: number;
    parts: PlacedPart[];
    warnings: string[];
  }>;
};
