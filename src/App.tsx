import { useMemo, useState } from "react";
import "./App.css";
import type { WingSpecV1 } from "./core/types";
import { generateWingV1 } from "./core/wing/generateWingV1";
import { wingToSvg } from "./core/export/svg";

const defaultSpec: WingSpecV1 = {
  version: 1,
  units: "mm",

  span: 1200,
  rootChord: 220,
  tipChord: 140,
  sweepLE: 0,
  dihedralDeg: 3,

  ribCountPerHalf: 9,
  airfoil: { type: "naca4", code: "0012", samples: 80 },

  materialThickness: 3,
  kerf: 0.15,
slotClearance: 0.25,

  spars: [
    { xFrac: 0.25, thickness: 6.0, slotDepth: 40 },
    { xFrac: 0.25, thickness: 6.0, slotDepth: 40 },

  ],
};

export default function App() {
  const [spec, setSpec] = useState<WingSpecV1>(defaultSpec);

  const wing = useMemo(() => generateWingV1(spec), [spec]);
  const svg = useMemo(
    () =>
      wingToSvg(wing, {
        margin: 10,
        ribSpacing: 20,
        showLabels: true,
      }),
    [wing]
  );

  // Make a download URL for the SVG string
  const svgUrl = useMemo(() => {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    return URL.createObjectURL(blob);
  }, [svg]);

  function updateNumber(key: keyof WingSpecV1) {
    return (value: number) => setSpec((s) => ({ ...s, [key]: value as any }));
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16, padding: 16 }}>
      <div style={{ border: "1px solid #3333", borderRadius: 10, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>Luftmach Wing v1</h2>
        <p style={{ marginTop: 4, opacity: 0.8 }}>
          Rib + spar wing generator (SVG export). UI only edits <code>WingSpecV1</code>.
        </p>

        <Field label="Span (mm)" value={spec.span} onChange={updateNumber("span")} />
        <Field label="Root chord (mm)" value={spec.rootChord} onChange={updateNumber("rootChord")} />
        <Field label="Tip chord (mm)" value={spec.tipChord} onChange={updateNumber("tipChord")} />
        <Field
          label="Ribs per half"
          value={spec.ribCountPerHalf}
          step={1}
          onChange={(v) => setSpec((s) => ({ ...s, ribCountPerHalf: Math.max(2, Math.round(v)) }))}
        />

        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", fontSize: 12, opacity: 0.8 }}>NACA 4-digit</label>
          <input
            value={spec.airfoil.code}
            onChange={(e) => setSpec((s) => ({ ...s, airfoil: { ...s.airfoil, code: e.target.value } }))}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <a href={svgUrl} download="wing_ribs.svg">
            <button>Download SVG</button>
          </a>

          <button onClick={() => navigator.clipboard.writeText(JSON.stringify(spec, null, 2))}>
            Copy Spec JSON
          </button>
        </div>

        <p style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
          Next steps: kerf/clearance, spar parts, nesting, DXF export, 3D preview.
        </p>
      </div>

      <div style={{ border: "1px solid #3333", borderRadius: 10, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>SVG Preview</h3>
        <div style={{ width: "100%", height: "75vh", border: "1px solid #3333", borderRadius: 8 }}>
          <iframe title="svg-preview" src={svgUrl} style={{ width: "100%", height: "100%", border: "none" }} />
        </div>
      </div>
    </div>
  );
}

function Field(props: { label: string; value: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div style={{ marginTop: 12 }}>
      <label style={{ display: "block", fontSize: 12, opacity: 0.8 }}>{props.label}</label>
      <input
        type="number"
        value={props.value}
        step={props.step ?? 1}
        onChange={(e) => props.onChange(Number(e.target.value))}
        style={{ width: "100%" }}
      />
    </div>
  );
}
