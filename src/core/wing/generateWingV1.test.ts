import { describe, expect, test } from "vitest";
import type { WingSpecV1 } from "../types";
import { generateWingV1 } from "./generateWingV1";

describe("generateWingV1", () => {
  test("generates ribs with closed outlines and slot rectangles", () => {
    const spec: WingSpecV1 = {
      version: 1,
      units: "mm",
      span: 1000,
      rootChord: 200,
      tipChord: 120,
      sweepLE: 0,
      dihedralDeg: 0,
      ribCountPerHalf: 7,
      airfoil: { type: "naca4", code: "0012", samples: 60 },
      materialThickness: 3,
      slotClearance: 0.25,
      kerf: 0.15,
      spars: [{ xFrac: 0.3, thickness: 6.0, slotDepth: 40 }],

    };

    const wing = generateWingV1(spec);
    expect(wing.ribs.length).toBe(7);

    for (const rib of wing.ribs) {
      // outline should be closed
      const first = rib.outline[0];
      const last = rib.outline[rib.outline.length - 1];
      expect(first.x).toBe(last.x);
      expect(first.y).toBe(last.y);

      // slot count and dimensions
      expect(rib.slots.length).toBe(1);
      const r = rib.slots[0].rect;
      expect(r.w).toBeGreaterThan(0);
      expect(r.h).toBeGreaterThan(0);
    }
  });
});
