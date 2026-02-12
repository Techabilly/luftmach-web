import type { WingArtifactsV1 } from "../types";

export function wingToParts(wing: WingArtifactsV1) {
  return wing.ribs.map((r) => ({
    id: r.id,
    outline: r.outline,
    rectCutouts: r.slots.map((s) => s.rect),
    label: r.id,
  }));
}
