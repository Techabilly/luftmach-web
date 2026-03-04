export type Units = "mm" | "in";

export type Point = { x: number; y: number };

export type WingSpecV1 = {
  version: 1;
  units: Units;

  span: number;
  rootChord: number;
  tipChord: number;
  sweepLE: number;
  dihedralDeg: number;

  ribCountPerHalf: number;
  airfoil: {
    type: "naca4";
    code: string;
    samples: number;
  };

  materialThickness: number;
  kerf: number;
  slotClearance: number;

  spars: Array<{
    xFrac: number;
    stockSize: number;
    edge: "top" | "bottom" | "both";
  }>;

  ribFeatures: {
    lighteningHoles: {
      enabled: boolean;
      count: number;
      radiusFrac: number;
      xStartFrac: number;
      xEndFrac: number;
      yOffsetFrac: number;
      cornerFrac: number;
    };
    webLattice: {
      enabled: boolean;
      betweenSpars: [number, number];
      pitch: number;
      angleDeg: number;
      webMargin: number;
      cornerRadius: number;
    };
  };
};

export type CutPrimitive =
  | { kind: "rect"; id: string; x: number; y: number; w: number; h: number }
  | { kind: "circle"; id: string; cx: number; cy: number; r: number }
  | { kind: "poly"; id: string; pts: Point[]; cornerRadius?: number };

export type Rib2D = {
  id: string;
  stationY: number;
  chord: number;

  // closed polygon (first point equals last point)
  outline: Point[];

  cutouts: CutPrimitive[];

  // Step 1 will populate this when webLattice.enabled is true
  webRegion?: {
    betweenSpars: [number, number];
    pts: Point[];
  };
};

export type WingArtifactsV1 = {
  spec: WingSpecV1;
  ribs: Rib2D[];
};