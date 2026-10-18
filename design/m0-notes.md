# M0 notes: one-digit slice

- **Status:** done 2026-10-17. Exit criteria met (see below).
- **Plan:** [modelling-and-animation-plan.md](modelling-and-animation-plan.md) §10

## What M0 contains

| Node | Parts | Motion |
|---|---|---|
| `pm.drum_shaft.0` | square shaft, handwheel (stand-in for the crank drive) | rotate, crank angle θ |
| `pm.drum.0` | stepped drum: 9 graduated ribs + collar | slides along the shaft (setting) |
| `pm.setting_rack.0` | rack + fork in the collar groove | slides with the drum |
| `pm.setting_dial.0` | knob, pointer, vertical shaft, pinion | rotate 36° per digit |
| `pi.sum_wheel.0` | result shaft, 10-tooth receiving gear, digit disc, Einzahn arm + pin | rotate −36° per step |
| `pi.carry_store.0` | store shaft, Fünfhorn (5 capsule horns), Muldenrad, pentagon disc | rotate 18° (store), 72° (executed) |
| `pm.setting_plate.0`, `pi.window.0`, `frame.static` | static | — |

The model has about 8.6 k triangles and the `.glb` is about 300 KB.

## How to rebuild and check

From the repository root:

```bash
pnpm build:model     # params -> Blender (headless) -> assets/m0-digit-slice.glb
pnpm check:model     # collision sweep (~9.5 k poses, 0.05 mm margin) -> M0_CLEARANCE_OK
pnpm fixture         # re-export the Python kinematics fixture for the JS cross-check
pnpm test            # sim + kinematics tests (230), including the Python/JS agreement
python3 -m http.server   # http://localhost:8000/dev/01-digit-slice/
```

Preview renders: `Blender --background --factory-startup --python ../blender/scripts/render_m0_previews.py` writes to `blender/out/previews/` (git-ignored).

## Exit criteria

| Criterion | Evidence |
|---|---|
| Turning θ adds the set digit | Sim tests (all d, s); verified live: 0 + 9 = 9, 9 + 1 = 0 with carry out, 0 − 1 = 9 with borrow |
| 9 + 1 stores a carry and tilts the pentagon | Live at θ = 281.25°: window shows 0, store at 18°, pentagon tilted. Then executed (72°, level) in the carry window. |
| No visible mesh collisions | `check_m0_clearance.py`: all pairs OK over the full motion ranges, both directions |

## Design findings (the sweep caught these; recorded so M1/M2 inherit them)

1. **Stub teeth for the drum and receiving gear** (addendum 0.6 m, dedendum 1.0 m). With full-height involute teeth the contact ratio is about 1.43, so a rib touches the idle gear before its 22.5° window opens. Stub teeth give a contact ratio of about 0.94, which keeps every contact inside its window (drum −10.2° … +11.0° about mid-window). Real intermittent counters rely on a detent for the last couple of degrees, and so do we.
2. **Rib order depends on direction.** Turning forward, ribs 1…9 pass the gear in that order; turning backward, 9…1. Setting *s* engages ribs *k* ≥ 10 − *s*, so the engaged ribs fill the **last** *s* windows when adding and the **first** *s* when subtracting. The result digit therefore changes late in an addition turn and early in a subtraction turn.
3. **Einzahn ↔ Fünfhorn contact must use the horn's full shape.** The first model treated the horn as a line and missed tip contact. The final model uses capsule horns (segment 5.925 mm, radius 1 mm), an Einzahn pin of radius 1.5 mm on radius 10 mm, and a store axis 18 mm from the result shaft at 162°. This gives exactly 18° of push between v = 9.30 and 9.73, with at least 0.6 mm clearance at every resting digit and through the 54° completion. Solved numerically. The same solver runs in Python (`lib/kinematics.py`) and JavaScript (`js/sim/kinematics.js`) as a push table.
4. **The pentagon disc sits behind the rear bracket**, at the machine's back edge, as on the original ("hinten aufgesetzte Fünfeckscheiben", Burkhardt 1897). Otherwise the frame hides the most important carry indicator.
5. **three.js strips dots from glTF node names** (`pm.drum.0` becomes `pmdrum0`). Lookups go through `gltfName()`. This is recorded in `docs/conventions.md`.
6. **Blender build-time parenting:** `matrix_world` is stale for objects just created, so parent-inverse matrices must not be used. Children get parent-relative locations, which also keeps the glTF transforms clean.

## Deviations from the photo estimates (geometry wins)

| Item | Estimate | M0 geometry | Why |
|---|---|---|---|
| Drum core diameter | 28 mm | 26.25 mm (root circle) | Stub-tooth 16-tooth lattice, module 1.875 |
| Drum outer diameter | 33 mm | 32.25 mm | Same |
| Drum length | 40 mm | 40 mm | — |

## Known simplifications in M0 (resolved in later milestones)

- The carry is executed by driving the store directly in the carry window. **M1 adds the Zweihorn** and the next digit, which actually receives the carry.
- The drum is driven straight from the crank angle. The 17-gear drive chain and the long gear / sliding gear come in M1/M2.
- The handwheel stands in for the Magna Rota crank (M2).
- The materials are simple PBR colours with no textures or decoration.
- **Geometric verification relies on the Blender sweep plus manual testing.** The acceptance tests on the `.glb` (A0-1…A0-9 in the plan, §10.1) are written at the start of M1 and then run in `pnpm test`.
