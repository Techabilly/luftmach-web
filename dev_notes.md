# DEV NOTES – luftmach-web

## Current Status (Web Lattice Milestone)

- Diamond lattice implemented inside rib web regions
- Lattice is:
  - Generated as polygon cells (not triangles)
  - Clipped using point-in-polygon against web region
  - Inset toward centroid for spacing (kerf + margin safety)
- UI updated:
  - "Rib realism" removed
  - Replaced with Web Lattice controls

## Known Good Parameters

These reliably produce visible lattice:

- pitch: 8
- angleDeg: 0
- webMargin: 2
- cornerRadius: 0.8

## Known Issues

- Large pitch + high angle can cause:
  - All cells to be rejected (nothing visible)
- Very tight margins:
  - Cells clip out entirely
- No adaptive scaling yet:
  - Small ribs may get empty regions

## Important Lessons Learned

1. **UI state vs defaultSpec**
   - React state does NOT reset on hot reload
   - Always hard refresh when debugging geometry

2. **Geometry failures are usually filtering**
   - Cells are generated → then rejected
   - Always suspect point-in-polygon + inset

3. **Inset is critical**
   - Prevents:
     - edge collisions
     - touching cells
   - But can over-shrink if too aggressive

4. **Parameter sensitivity**
   - pitch, margin, and angle interact strongly
   - debugging requires simplifying:
     - angle = 0
     - small pitch
     - small margin

## Next Goals

- Adaptive pitch scaling (based on region width)
- Better clipping (edge trimming vs full rejection)
- Optional:
  - hex lattice
  - structural direction alignment
