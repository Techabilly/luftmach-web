import { describe, expect, test } from "vitest";
import type { WingSpecV1 } from "../types";
import { generateWingV1 } from "./generateWingV1";

describe("generateWingV1", () => {
  test("generates ribs with closed outlines and square U-notches", () => {
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
      kerf: 0.15,
      slotClearance: 0.25,

      spars: [{ xFrac: 0.3, stockSize: 3.175, edge: "both" }],

      ribFeatures: {
        lighteningHoles: {
          enabled: true,
          count: 2,
          radiusFrac: 0.06,
          xStartFrac: 0.3,
          xEndFrac: 0.7,
          yOffsetFrac: 0,
        },
      },
    };

    const wing = generateWingV1(spec);
    expect(wing.ribs.length).toBe(7);

    for (const rib of wing.ribs) {
      const first = rib.outline[0];
      const last = rib.outline[rib.outline.length - 1];
      expect(first.x).toBe(last.x);
      expect(first.y).toBe(last.y);

      // Should include 2 notches for edge="both" plus optional holes
      const notchRects = rib.cutouts.filter((c) => c.kind === "rect");
      expect(notchRects.length).toBe(2);
      for (const c of notchRects) {
        if (c.kind === "rect") {
          expect(c.w).toBeGreaterThan(0);
          expect(c.h).toBeGreaterThan(0);
          // square notch
          expect(c.w).toBeCloseTo(c.h, 6);
        }
      }
    }
  });
});
