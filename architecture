# ARCHITECTURE – luftmach-web

## Overview

This project generates laser-cuttable wing ribs and layouts.

Pipeline:

WingSpecV1 → generateWingV1 → Rib2D → CutPrimitives → SVG export

---

## Core Modules

### 1. Spec Layer

**File:** `core/types.ts`

Defines:
- WingSpecV1
- Rib2D
- CutPrimitive

Key concept:
- Everything is driven from spec → pure generation

---

### 2. Geometry Generation

**File:** `core/wing/generateWingV1.ts`

Responsible for:

- Rib creation
- Airfoil scaling
- Spar notch generation
- Cutout generation

#### Key Outputs

Each rib:
```ts
{
  outline: Point[],
  cutouts: CutPrimitive[],
  webRegion?: { pts: Point[] }
}
