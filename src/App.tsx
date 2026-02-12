import { useEffect, useMemo, useState } from "react";
import "./App.css";
import type { WingSpecV1 } from "./core/types";
import { generateWingV1 } from "./core/wing/generateWingV1";
import { wingToParts } from "./core/export/wingParts";
import { packPartsToSheets } from "./core/export/pack";
import type { SheetSpec } from "./core/export/layoutTypes";
import { layoutToSheetSvgs } from "./core/export/sheetsSvg";
import { wingPlanToSvg } from "./core/export/planSvg";

const INCH_TO_MM = 25.4;

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
    { xFrac: 0.25, stockSize: (1 / 8) * INCH_TO_MM, edge: "both" },
    { xFrac: 0.6, stockSize: (1 / 8) * INCH_TO_MM, edge: "both" },
  ],

  ribFeatures: {
    lighteningHoles: {
      enabled: true,
      count: 2,
      radiusFrac: 0.06,
      xStartFrac: 0.32,
      xEndFrac: 0.72,
      yOffsetFrac: 0,
    },
  },
};

const defaultSheet: SheetSpec = {
  width: 600,
  height: 300,
  margin: 10,
  spacing: 6,
};

type ExportMode = "sheets" | "plan";

export default function App() {
  const [spec, setSpec] = useState<WingSpecV1>(defaultSpec);

  const [sheet, setSheet] = useState<SheetSpec>(defaultSheet);
  const [sheetIndex, setSheetIndex] = useState(0);

  const [mode, setMode] = useState<ExportMode>("sheets");
  const [applyKerf, setApplyKerf] = useState(true);

  // Buffered NACA input: prevents crashing while typing
  const [nacaInput, setNacaInput] = useState(spec.airfoil.code);
  useEffect(() => setNacaInput(spec.airfoil.code), [spec.airfoil.code]);

  const wing = useMemo(() => generateWingV1(spec), [spec]);

  const sheetSvgs = useMemo(() => {
    const parts = wingToParts(wing);
    const layout = packPartsToSheets(parts, sheet);
    return layoutToSheetSvgs(layout, sheet, {
      showLabels: true,
      showSheetBorder: true,
      applyKerf,
      kerf: spec.kerf,
    });
  }, [wing, sheet, applyKerf, spec.kerf]);

  const planSvg = useMemo(() => {
    return wingPlanToSvg(wing, {
      margin: 20,
      showRibStations: true,
      showSparLines: true,
      showLabels: true,
    });
  }, [wing]);

  const activeSvg =
    mode === "sheets"
      ? sheetSvgs[Math.min(sheetIndex, Math.max(0, sheetSvgs.length - 1))] ?? ""
      : planSvg;

  const [svgUrl, setSvgUrl] = useState<string>("");

  useEffect(() => {
    const blob = new Blob([activeSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    setSvgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [activeSvg]);

  function updateSpar(i: number, patch: Partial<WingSpecV1["spars"][number]>) {
    setSpec((s) => {
      const spars = s.spars.slice();
      spars[i] = { ...spars[i], ...patch };
      return { ...s, spars };
    });
  }

  function addSpar() {
    setSpec((s) => ({
      ...s,
      spars: [
        ...s.spars,
        { xFrac: 0.4, stockSize: (1 / 8) * INCH_TO_MM, edge: "both" },
      ],
    }));
  }

  function removeSpar(i: number) {
    setSpec((s) => ({ ...s, spars: s.spars.filter((_, idx) => idx !== i) }));
  }

  const selectedSheetCount = sheetSvgs.length;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 16, padding: 16 }}>
      <div style={{ border: "1px solid #3333", borderRadius: 10, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>Luftmach Wing</h2>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 12, opacity: 0.8 }}>Export</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as ExportMode)} style={{ flex: 1 }}>
            <option value="sheets">Cut Sheets</option>
            <option value="plan">Wing Plan</option>
          </select>
        </div>

        <Field label="Span (mm)" value={spec.span} onChange={(v) => setSpec((s) => ({ ...s, span: v }))} />
        <Field label="Root chord (mm)" value={spec.rootChord} onChange={(v) => setSpec((s) => ({ ...s, rootChord: v }))} />
        <Field label="Tip chord (mm)" value={spec.tipChord} onChange={(v) => setSpec((s) => ({ ...s, tipChord: v }))} />
        <Field label="Sweep LE (mm)" value={spec.sweepLE} onChange={(v) => setSpec((s) => ({ ...s, sweepLE: v }))} />

        <Field
          label="Ribs per half"
          value={spec.ribCountPerHalf}
          step={1}
          onChange={(v) => setSpec((s) => ({ ...s, ribCountPerHalf: Math.max(2, Math.round(v)) }))}
        />

        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", fontSize: 12, opacity: 0.8 }}>NACA 4-digit</label>
          <input
            value={nacaInput}
            onChange={(e) => {
              const raw = e.target.value;
              const cleaned = raw.replace(/[^\d]/g, "").slice(0, 4);
              setNacaInput(cleaned);

              // Only update spec when valid
              if (/^\d{4}$/.test(cleaned)) {
                setSpec((s) => ({ ...s, airfoil: { ...s.airfoil, code: cleaned } }));
              }
            }}
            style={{ width: "100%" }}
          />
          {!/^\d{4}$/.test(nacaInput) && (
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Enter 4 digits (e.g. 0012)</div>
          )}
        </div>

        <Field
          label="Airfoil samples"
          value={spec.airfoil.samples}
          step={1}
          onChange={(v) =>
            setSpec((s) => ({
              ...s,
              airfoil: { ...s.airfoil, samples: Math.max(20, Math.round(v)) },
            }))
          }
        />

        <h3 style={{ marginTop: 16, marginBottom: 8 }}>Cut settings</h3>

        <Field
          label="Slot clearance (mm)"
          value={spec.slotClearance}
          onChange={(v) => setSpec((s) => ({ ...s, slotClearance: Math.max(0, v) }))}
        />

        <Field
          label="Kerf (mm)"
          value={spec.kerf}
          onChange={(v) => setSpec((s) => ({ ...s, kerf: Math.max(0, v) }))}
        />

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 10 }}>
          <input type="checkbox" checked={applyKerf} onChange={(e) => setApplyKerf(e.target.checked)} />
          Apply kerf compensation
        </label>

        <h3 style={{ marginTop: 16, marginBottom: 8 }}>Spars (stock sticks)</h3>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={addSpar}>Add spar</button>
          <div style={{ flex: 1 }} />
        </div>

        {spec.spars.map((spar, i) => (
          <div key={i} style={{ border: "1px solid #3333", borderRadius: 8, padding: 8, marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>Spar {i + 1}</strong>
              <button onClick={() => removeSpar(i)}>Remove</button>
            </div>

            <Field
              label="Position xFrac (0..1)"
              value={spar.xFrac}
              step={0.01}
              onChange={(v) => updateSpar(i, { xFrac: clamp(v, 0, 1) })}
            />

            <div style={{ marginTop: 10 }}>
              <label style={{ display: "block", fontSize: 12, opacity: 0.8 }}>Stock size</label>
              <select
                value={stockPresetFromMm(spar.stockSize)}
                onChange={(e) => updateSpar(i, { stockSize: presetMm(e.target.value) })}
                style={{ width: "100%" }}
              >
                <option value="1/16">1/16 in square</option>
                <option value="1/8">1/8 in square</option>
                <option value="1/4">1/4 in square</option>
                <option value="custom">Custom (mm)</option>
              </select>

              {stockPresetFromMm(spar.stockSize) === "custom" && (
                <Field
                  label="Custom size (mm)"
                  value={spar.stockSize}
                  onChange={(v) => updateSpar(i, { stockSize: Math.max(0.1, v) })}
                />
              )}
            </div>

            <div style={{ marginTop: 10 }}>
              <label style={{ display: "block", fontSize: 12, opacity: 0.8 }}>Edge</label>
              <select
                value={spar.edge}
                onChange={(e) => updateSpar(i, { edge: e.target.value as any })}
                style={{ width: "100%" }}
              >
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="both">Both</option>
              </select>
            </div>
          </div>
        ))}

        <h3 style={{ marginTop: 16, marginBottom: 8 }}>Rib realism</h3>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={spec.ribFeatures.lighteningHoles.enabled}
            onChange={(e) =>
              setSpec((s) => ({
                ...s,
                ribFeatures: {
                  ...s.ribFeatures,
                  lighteningHoles: { ...s.ribFeatures.lighteningHoles, enabled: e.target.checked },
                },
              }))
            }
          />
          Lightening holes
        </label>

        <Field
          label="Hole count"
          value={spec.ribFeatures.lighteningHoles.count}
          step={1}
          onChange={(v) =>
            setSpec((s) => ({
              ...s,
              ribFeatures: {
                ...s.ribFeatures,
                lighteningHoles: { ...s.ribFeatures.lighteningHoles, count: Math.max(0, Math.round(v)) },
              },
            }))
          }
        />

        <Field
          label="Hole radius (frac of chord)"
          value={spec.ribFeatures.lighteningHoles.radiusFrac}
          step={0.01}
          onChange={(v) =>
            setSpec((s) => ({
              ...s,
              ribFeatures: {
                ...s.ribFeatures,
                lighteningHoles: { ...s.ribFeatures.lighteningHoles, radiusFrac: clamp(v, 0.01, 0.25) },
              },
            }))
          }
        />

        <Field
          label="Hole start xFrac"
          value={spec.ribFeatures.lighteningHoles.xStartFrac}
          step={0.01}
          onChange={(v) =>
            setSpec((s) => ({
              ...s,
              ribFeatures: {
                ...s.ribFeatures,
                lighteningHoles: { ...s.ribFeatures.lighteningHoles, xStartFrac: clamp(v, 0.05, 0.95) },
              },
            }))
          }
        />

        <Field
          label="Hole end xFrac"
          value={spec.ribFeatures.lighteningHoles.xEndFrac}
          step={0.01}
          onChange={(v) =>
            setSpec((s) => ({
              ...s,
              ribFeatures: {
                ...s.ribFeatures,
                lighteningHoles: { ...s.ribFeatures.lighteningHoles, xEndFrac: clamp(v, 0.05, 0.95) },
              },
            }))
          }
        />

        <Field
          label="Hole yOffset frac"
          value={spec.ribFeatures.lighteningHoles.yOffsetFrac}
          step={0.01}
          onChange={(v) =>
            setSpec((s) => ({
              ...s,
              ribFeatures: {
                ...s.ribFeatures,
                lighteningHoles: { ...s.ribFeatures.lighteningHoles, yOffsetFrac: clamp(v, -0.25, 0.25) },
              },
            }))
          }
        />

        {mode === "sheets" && (
          <>
            <h3 style={{ marginTop: 16 }}>Sheet</h3>
            <Field label="Sheet width (mm)" value={sheet.width} onChange={(v) => setSheet((s) => ({ ...s, width: v }))} />
            <Field label="Sheet height (mm)" value={sheet.height} onChange={(v) => setSheet((s) => ({ ...s, height: v }))} />
            <Field label="Margin (mm)" value={sheet.margin} onChange={(v) => setSheet((s) => ({ ...s, margin: v }))} />
            <Field label="Spacing (mm)" value={sheet.spacing} onChange={(v) => setSheet((s) => ({ ...s, spacing: v }))} />

            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontSize: 12, opacity: 0.8 }}>Preview sheet</label>
              <select value={sheetIndex} onChange={(e) => setSheetIndex(Number(e.target.value))} style={{ width: "100%" }}>
                {sheetSvgs.map((_, i) => (
                  <option key={i} value={i}>
                    Sheet {i + 1} of {selectedSheetCount}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {sheetSvgs.map((s, i) => {
                const url = URL.createObjectURL(new Blob([s], { type: "image/svg+xml;charset=utf-8" }));
                return (
                  <a key={i} href={url} download={`wing_sheet_${i + 1}.svg`}>
                    <button>Download Sheet {i + 1}</button>
                  </a>
                );
              })}
            </div>
          </>
        )}

        {mode === "plan" && (
          <div style={{ marginTop: 12 }}>
            <a href={svgUrl} download="wing_plan.svg">
              <button>Download Plan SVG</button>
            </a>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => navigator.clipboard.writeText(JSON.stringify(spec, null, 2))}>Copy Spec JSON</button>
        </div>
      </div>

      <div style={{ border: "1px solid #3333", borderRadius: 10, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Preview</h3>
        <div style={{ width: "100%", height: "78vh", border: "1px solid #3333", borderRadius: 8 }}>
          <iframe
            key={`${mode}-${sheetIndex}-${applyKerf}-${spec.kerf}-${spec.airfoil.code}`}
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

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function presetMm(val: string): number {
  if (val === "1/16") return (1 / 16) * 25.4;
  if (val === "1/8") return (1 / 8) * 25.4;
  if (val === "1/4") return (1 / 4) * 25.4;
  // custom selection leaves current; caller uses custom input
  return (1 / 8) * 25.4;
}

function stockPresetFromMm(mm: number): "1/16" | "1/8" | "1/4" | "custom" {
  const eps = 0.02;
  const a = (1 / 16) * 25.4;
  const b = (1 / 8) * 25.4;
  const c = (1 / 4) * 25.4;
  if (Math.abs(mm - a) < eps) return "1/16";
  if (Math.abs(mm - b) < eps) return "1/8";
  if (Math.abs(mm - c) < eps) return "1/4";
  return "custom";
}
