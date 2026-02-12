export type SheetSpec = {
  width: number;
  height: number;
  margin: number;
  spacing: number;
};

export type PlacedPart = {
  id: string;
  sheetIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  outline: Array<{ x: number; y: number }>;
  rectCutouts?: Array<{ x: number; y: number; w: number; h: number }>;
  label?: string;
};

export type LayoutResult = {
  sheets: Array<{
    index: number;
    parts: PlacedPart[];
  }>;
};
