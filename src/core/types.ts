export type Units = "mm" | "in";

export type WingSpecV1 = {
  version: 1;
  units: Units;

  // Planform (full wing)
  span: number; // total wingspan
  rootChord: number;
  tipChord: number;
  sweepLE: number; // leading edge sweep offset at tip in same units as chord
  dihedralDeg: number;

  // Ribs (half-wing stations)
  ribCountPerHalf: number; // includes root and tip
  airfoil: {
    type: "naca4";
    code: string; // e.g. "0012"
    samples: number; // >= 20
  };

  // Material / cutting
  materialThickness: number;
  kerf: number;
  slotClearance: number;

  // Spar sticks (NOT cut parts) -> create open U-notches
  spars: Array<{
    xFrac: number; // 0..1 along chord
    stockSize: number; // square stick size in spec units
    edge: "top" | "bottom" | "both";
  }>;

  // Rib realism features
  ribFeatures: {
    lighteningHoles: {
      enabled: boolean;
      count: number;
      radiusFrac: number;
      xStartFrac: number;
      xEndFrac: number;
      yOffsetFrac: number;
    };
  };
};

export type CutPrimitive =
  | { kind: "rect"; id: string; x: number; y: number; w: number; h: number }
  | { kind: "circle"; id: string; cx: number; cy: number; r: number };

export type Rib2D = {
  id: string;
  stationY: number;
  chord: number;
  outline: Array<{ x: number; y: number }>; // closed polygon
  cutouts: CutPrimitive[];
};

export type WingArtifactsV1 = {
  spec: WingSpecV1;
  ribs: Rib2D[];
};
