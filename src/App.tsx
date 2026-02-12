import { useEffect, useMemo, useState } from "react";
import "./App.css";
import type { WingSpecV1 } from "./core/types";
import { generateWingV1 } from "./core/wing/generateWingV1";
import { wingToParts } from "./core/export/wingParts";
import { packPartsToSheets } from "./core/export/pack";
import type { SheetSpec } from "./core/export/layoutTypes";
import { layoutToSheetSvgs } from "./core/export/sheetsSvg";

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
  { xFrac: 0.25, stockSize: 3.175, edge: "both" }, // 1/8" in mm
  { xFrac: 0.6,  stockSize: 3.175, edge: "both" },
],

};

const defaultSheet: SheetSpec = {
  width: 600,
  height: 300,
  margin: 10,
  spacing: 6,
};

export default function App() {
  const [spec, setSpec] = useState<WingSpecV1>(defaultSpec);
  const [sheet, setSheet] = useState<SheetSpec>(defaultSheet);
  const [sheetIndex, setSheetIndex] = useState(0);

  const wing = useMemo(() => generateWingV1(spec), [spec]);

  const svgs = useMemo(() => {
    const parts = wingToParts(wing);
    const layout = packPartsToSheets(parts, sheet);
    return layoutToSheetSvgs(layout, sheet, { showLabels: true, showSheetBorder: true });
  }, [wing, sheet]);

  const svg = svgs[Math.min(sheetIndex, svgs.length - 1)] ?? "";

  const [svgUrl, setSvgUrl] = useState<string>("");

  useEffect(() => {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    setSvgUrl(url);
    return () => URL.revokeObjectURL(url);
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

        <h3 style={{ marginTop: 16 }}>Sheet</h3>
        <Field label="Sheet width (mm)" value={sheet.width} onChange={(v) => setSheet((s: SheetSpec)  => ({ ...s, width: v }))} />
        <Field label="Sheet height (mm)" value={sheet.height} onChange={(v) => setSheet((s: SheetSpec)  => ({ ...s, height: v }))} />
        <Field label="Margin (mm)" value={sheet.margin} onChange={(v) => setSheet((s: SheetSpec)  => ({ ...s, margin: v }))} />
        <Field label="Spacing (mm)" value={sheet.spacing} onChange={(v) => setSheet((s: SheetSpec)  => ({ ...s, spacing: v }))} />

        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", fontSize: 12, opacity: 0.8 }}>Preview sheet</label>
          <select value={sheetIndex} onChange={(e) => setSheetIndex(Number(e.target.value))} style={{ width: "100%" }}>
            {svgs.map((_, i) => (
              <option key={i} value={i}>
                Sheet {i + 1} of {svgs.length}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {svgs.map((s, i) => {
            const url = URL.createObjectURL(new Blob([s], { type: "image/svg+xml;charset=utf-8" }));
            return (
              <a key={i} href={url} download={`wing_sheet_${i + 1}.svg`}>
                <button>Download Sheet {i + 1}</button>
              </a>
            );
          })}
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
          <iframe
             key={sheetIndex}
            title="svg-preview"
            src={svgUrl}
            style={{ width: "100%", height: "100%", border: "none" }}
/>

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
