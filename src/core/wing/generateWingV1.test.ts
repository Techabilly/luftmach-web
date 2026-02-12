import { describe, expect, test } from "vitest";
import type { WingSpecV1 } from "../types";
import { generateWingV1 } from "./generateWingV1";

describe("generateWingV1", () => {
  test("generates ribs with closed outlines and open-notch cutouts", () => {
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

      spars: [
        { xFrac: 0.3, stockSize: 3.175, notchDepth: 10, edge: "both" },
      ],
    };

    const wing = generateWingV1(spec);
    expect(wing.ribs.length).toBe(7);

    for (const rib of wing.ribs) {
      // outline should be closed
      const first = rib.outline[0];
      const last = rib.outline[rib.outline.length - 1];
      expect(first.x).toBe(last.x);
      expect(first.y).toBe(last.y);

      // should create 2 notch rectangles when edge === "both"
      expect(rib.slots.length).toBe(2);

      for (const cut of rib.slots) {
        expect(cut.rect.w).toBeGreaterThan(0);
        expect(cut.rect.h).toBeGreaterThan(0);
      }
    }
  });
});
