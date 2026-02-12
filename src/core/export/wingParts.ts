import type { WingArtifactsV1 } from "../types";

export function wingToParts(wing: WingArtifactsV1) {
  const ribParts = wing.ribs.map((r) => ({
    id: r.id,
    outline: r.outline,
    rectCutouts: r.slots.map((s) => s.rect),
    label: r.id,
  }));

  const sparParts = (wing.spars ?? []).map((s) => ({
    id: s.id,
    outline: s.outline,
    rectCutouts: [],
    label: s.id,
  }));

  return [...ribParts, ...sparParts];
}
