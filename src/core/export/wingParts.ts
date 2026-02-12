import type { WingArtifactsV1 } from "../types";
import type { RawPart } from "./layoutTypes";

export function wingToParts(wing: WingArtifactsV1): RawPart[] {
  return wing.ribs.map((r) => ({
    id: r.id,
    outline: r.outline,
    cutouts: r.cutouts,
    label: r.id,
  }));
}
