# Core (no UI imports)

This directory contains the **deterministic geometry and export logic**.

Rules:
- ❌ No React imports
- ❌ No DOM access
- ❌ No browser APIs
- ✅ Pure functions only
- ✅ Typed inputs (Specs) → typed outputs (Artifacts)

The UI layer is a *client* of this code.
UI state changes must never directly manipulate geometry.
