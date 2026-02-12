export type Units = "mm" | "in";

/**
 * WingSpecV1 is the canonical, versioned input for wing generation.
 * UI edits ONLY this object (or a superset later). Generators consume it.
 */
export type WingSpecV1 = {
  version: 1;
  units: Units;

  // Planform (full wing)
  span: number; // total wingspan
  rootChord: number;
  tipChord: number;
  sweepLE: number; // leading edge sweep distance at tip (v1 placeholder)
  dihedralDeg: number; // preview-only for v1

  // Ribs (half-wing stations)
  ribCountPerHalf: number; // includes root and tip
  airfoil: {
    type: "naca4";
    code: string; // e.g. "0012"
    samples: number; // points per surface (>= 20 recommended)
  };

  // Material / cutting
  materialThickness: number; // e.g. 3 (balsa) or 5 (foam)
  kerf: number; // laser kerf (v1 stored, not applied as offsets yet)
  slotClearance: number; // added to spar thickness to make slot width

  // Spar slots in ribs
  spars: Array<{
    xFrac: number; // 0..1 along chord (0 = LE, 1 = TE)
    thickness: number; // spar material thickness
    slotDepth: number; // slot height in the rib
  }>;
};


export type Rib2D = {
  id: string;
  stationY: number; // distance from centerline along half-span
  chord: number;

  // Closed polygon. Units are same as spec.units.
  outline: Array<{ x: number; y: number }>;

  // Slot rectangles cut into the rib
  slots: Array<{
    id: string;
    rect: { x: number; y: number; w: number; h: number };
  }>;
};
export type Spar2D = {
  id: string;
  length: number;  // in spec units
  width: number;   // spar thickness (material dimension)
  outline: Array<{ x: number; y: number }>; // closed polygon
};
export type WingArtifactsV1 = {
  spec: WingSpecV1;
  ribs: Rib2D[];
  spars: Spar2D[];
};

