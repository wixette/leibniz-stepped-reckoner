# Modelling and animation plan: Leibniz stepped reckoner (target B)

- **Status:** M0–M2 done; M3 built, and redesigned for release 1.0.0 (2026-10-20, [docs/ui-design.md](../docs/ui-design.md)); M4 open. First written 2026-10-17.
- **Inputs:** [`../research/REPORT.md`](../research/REPORT.md), [`../research/sources/notes-mechanism.md`](../research/sources/notes-mechanism.md), [`../params/machine.json`](../params/machine.json), [decision 0001](decisions/0001-carry-interpretation.md)
- **Conventions:** [`docs/conventions.md`](../docs/conventions.md)

## 1. Goal and success criteria

Build a **kinematically faithful** 3D model of the surviving machine (8 input / 16 result / 1 counter digits). Students can operate it in the browser, and every part that matters for the calculation moves correctly.

The model is done when:
1. **It is operable.** Students can set 8 digits, insert the multiplier pin, turn the main crank both ways, and shift the carriage. The result windows and the counter show exactly what the simulation logic computes, for every test in `research/data/worked_examples.json` and for random 8×8-digit multiplications and divisions.
2. **The mechanism is visible.** Students can watch any digit's drum → receiving gear → result wheel → Einzahn → Fünfhorn → Zweihorn chain move, in slow motion, with a cut-away or x-ray view.
3. **It is plausible.** Overlaid on the reference photos (§8), outlines and the positions of the main parts match within about 5 %. Gear meshes never visibly interpenetrate during animation.
4. **It performs.** It stays under 300 k triangles and 15 MB of `.glb`, and runs at 60 fps on an M1 and at least 30 fps on a mid-range school Chromebook.

## 2. Architecture: three layers

```
 params/machine.json ──► Blender build scripts ──► assets/leibniz.glb  (rest pose, named nodes)
                                                          │
 js/sim/       (pure JS state machine) ──state──► js/scene/       (sets one scalar per node)
        ▲                                                  │
        └──────────── user input (dials, pin, cranks) ◄────┘
```

- **The simulation logic is the truth.** The digit wheels, stored carries, pentagon flags, carriage offset, counter and crank angle θ all live in `sim/`. It is unit-tested without graphics.
- **The scene only reflects state.** Every moving node gets one scalar per frame (an angle or an offset), computed from the sim state and θ by pure functions in `sim/kinematics.js`.
- **The `.glb` contains no baked animation.** It holds the geometry, the hierarchy and the pivots only.

## 3. Assembly hierarchy and node contract

Node names follow `docs/conventions.md`. Indices: `d` = drum/input digit 0–7, `r` = result digit 0–15. Digit 0 is units, at the right.

| Node | Parent | Motion (one scalar) | Count |
|---|---|---|---|
| `frame.base`, `frame.rail.{front,back}`, `frame.foot.n` | root | static | — |
| `frame.lead_screw` | root | rotation about X | 1 |
| `frame.end_crank` | `frame.lead_screw` | follows the screw | 1 |
| `pi.register` (body, top plate, windows) | root | static | 1 |
| `pi.sum_wheel.r` (with receiving gear, Einzahn and result disc) | `pi.register` | rotation about Y, 36° per unit | 16 |
| `pi.carry_store.r` (Muldenrad + Fünfhorn + pentagon disc + detent wheel) | `pi.register` | rotation about Y (18° store, 72° per completed carry) | 15 |
| `pi.carry_transfer.r` (Zwischenrad / carry-drive gear) | `pi.register` | rotation about Y | 15 |
| `pm.carriage` | root | translation along X, 36.5 mm steps (37 until M4) | 1 |
| `pm.box` (casing panels, top plate, decorations) | `pm.carriage` | static; panels can hide individually for the cut-away | 1 set |
| `pm.drum_shaft.d` | `pm.carriage` | rotation about Y (θ) | 8 |
| `pm.drum.d` | `pm.drum_shaft.d` | translation along Y (setting, 0–9 steps) | 8 |
| `pm.setting_dial.d` (knob + pinion) | `pm.carriage` | rotation about Z, 27.7° per digit (13 divisions, M4; 36° until then) | 8 |
| `pm.setting_rack.d` | `pm.carriage` | translation along Y (with the drum) | 8 |
| `pm.drive_gear.n` | `pm.carriage` | rotation about Y (±θ, alternating) | 17 |
| `pm.zweihorn.d` | `pm.drive_gear.(2d+1)` | follows its gear | 8 |
| `pm.magna_rota` (inner ring with holes) | `pm.carriage` | rotation about Y (θ) | 1 |
| `pm.magna_rota.handle` | `pm.magna_rota` | follows | 1 |
| `pm.magna_rota.stop`, `pm.magna_rota.dial_plate` | `pm.carriage` | static | 1 each |
| `pm.pin` | `pm.magna_rota` | visibility + hole index | 1 |
| `pm.counter_wheel` | `pm.carriage` | rotation, 36° per turn | 1 |

**Contract test:** the web app loads the `.glb` and asserts that every name listed in the rig's node tables (`scene/rig.js`) exists, so a renamed node fails the build.

## 4. Part-by-part modelling approach

| Part | Method | Notes |
|---|---|---|
| Stepped drum | **Procedural** (`drum.py`) | Core cylinder plus 9 ribs. Rib *k* (1–9) spans 22.5° steps over the 202.5° sector, and its length is `length − (k−1)·rib_length_step`. Ribs are slightly rounded. This is the hero part, so it gets the highest detail. |
| Receiving gear, drive gears, counter gear | **Procedural** (`gear.py`, involute) | Module chosen so the pitch radii mesh at the estimated centre distances. 10-tooth receiving gear. |
| Result disc | Procedural cylinder + digit texture | One shared texture atlas (0–9 on the rim) with a UV offset per disc. Digits must face the window at rest. |
| Einzahn | Procedural (single-tooth cam) | Small, but coloured didactically in carry mode. |
| Fünfhorn, Muldenrad | **Profile-driven extrusion** (`star.py`) | 5 horns with concave flanks (Muldenrad: troughs). The profile comes from a few params (tip radius, root radius, flank curvature). Shape guided by the Ludwig schematic; not traced from Kopp. |
| Zwischenrad (star wheel) | Profile-driven (`star.py`) | Star with *n* points. Ludwig shows 8–10. |
| Zweihorn | **Profile-driven** (`zweihorn.py`) | Two horns whose spread angle is a parameter per digit. |
| Pentagon disc | Procedural regular pentagon | On the carry-store shaft, at the back. Its tilt is the visible "carry pending" flag. |
| Setting dial, knob, rack | Procedural + simple manual knob | The hook-shaped knob seen in the photos is a small hand-made mesh, instanced 8 times. |
| Magna Rota | Procedural rings and holes + **hand-made pierced decoration** | Decoration as a texture/alpha first; geometry only if it is cheap. |
| Lead screw | Procedural helix, 36.5 mm lead (37 until M4) | Single start |
| Casing panels, decorative plates | **Manual** (`source/casing.blend`) | Simple box geometry with bevels. Ornament as normal or alpha maps. |
| Frame, rails, feet, end crank | Mostly procedural, with hand-made turned feet and handle | Lathe profiles |
| Oak case | Optional, later | Not needed for target B |

**Materials:** `brass_polished`, `brass_satin`, `steel`, `steel_dark`, `glass` (the register top, as on the Dresden replica), and `oak`. **Didactic overrides** (swapped at runtime): `didactic_input` (setting chain), `didactic_drum`, `didactic_result`, `didactic_carry_store`, `didactic_carry_exec`, `didactic_drive`.

**Level of detail:** gear teeth get a reduced-segment LOD for distant views. Instancing is used for the 16 and 8 repeated assemblies, and the web side uses `InstancedMesh` where the per-instance transform is enough.

## 5. Kinematics and timing (one operation = one crank turn)

The **master clock** is the crank angle θ ∈ [0°, 360°). The drums turn 1:1 with the crank. Addition and subtraction run the same table mirrored.

| θ (addition) | Event |
|---|---|
| 0° | Rest. The rib-free sector faces every receiving gear, and the pin (if set) is away from the stop. |
| 0 – 78.75° | Free arc: nothing engages |
| 78.75 – 281.25° | **Rib window.** For rib *k* = 1…9 at θ_k = 78.75 + (k−1)·22.5°, every drum whose setting digit *s* ≥ 10 − *k* advances its result wheel by one step (36°), eased over that 22.5°. A result wheel passing 9→0 rotates its Einzahn, which **stores** a carry: the carry store turns 18° and the pentagon tilts. |
| 281.25 – 292° | Rib clearance: the last ribs leave the receiving gears (≥ 22° past). Nothing moves a wheel. |
| 292 – 360° | **Carry window** (updated in M1). Zweihorn *j* (j = 0…7, units first) first touches its store at φ_j = 292 + j·8.5°. If the store at digit *j* holds a carry, it **completes** the store (the remaining 54° to 72°; the pentagon straightens) and advances result wheel *j*+1 one step. If that causes 9→0, the store at *j*+1 is set before φ_{j+1}: a ripple. |
| 360° | Back to rest. The counter advances one step. With the pin set, the Magna Rota stops after *n* turns. |

**Mode `historical` (decision 0001):** the same table, except that a carry *created during the carry window* (a secondary carry) is not executed in the same turn. It stays stored, with its pentagon tilted, until the next turn (sim parameter `cascade_per_turn` = 0). 9999 + 1 then shows 9900 → 9000 → 0000 + carry → 10000 over successive turns with the input at 0.

**Subtraction:** θ runs negative. The same windows are mirrored, the other horn of each Zweihorn acts, and wheels pass 0→9 to store a "borrow".

**Easing:** gear steps use smooth-step easing within each 22.5° window. Detents snap in the last 15 % of a step, which is visible as a small spring catch. Result wheels never move outside rib or carry events.

**Carriage shift:** the end crank turns the screw. One full turn moves `pm.carriage` one digit pitch, 36.5 mm (37 until M4). A spring catch indexes the positions, and the shift is only allowed at θ = 0, as on the real machine.

**Setting:** turning a setting dial by *s* steps slides its drum by *s* × 3.02 mm along Y (rack and pinion; 4.0 mm until M4), only at θ = 0. A stop on the dial plate lets the knob turn only from 0 to 9 (M4, NL 183/465 p. 38).

## 6. Animation strategy

- **Runtime-procedural**, as described above, so any calculation the student enters animates correctly. Nothing is pre-baked.
- **Playback speeds:** real time (about 1 s per crank turn), slow (×0.1), and **step** mode. Step mode turns the crank to the next moment a visible change has *completed*: a rib has passed, a carry has been stored, a carry has been passed on, or the turn has been committed. The panel then reports what just happened. Step mode is essential for teaching the carry; the definition is in `docs/conventions.md`.
- **The camera follows the action:** preset views (front operator view, top register view, underside drum view, single-digit close-up) with smooth transitions.
- **Cinematic clips** (optional, later): Blender actions exported as separate `*-cinematic.glb` files for an intro video. They are never used in the interactive model.

## 7. Build pipeline

```
params/machine.json
  └─ blender/scripts/build.py   (headless: Blender --background --factory-startup --python build.py)
       ├─ lib/params.py         load and validate params (units, required keys)
       ├─ lib/gear.py, drum.py, star.py, zweihorn.py, lathe.py
       ├─ assemble.py           hierarchy, pivots, names, materials
       ├─ link source/*.blend   hand-made parts
       └─ export.py             assets/leibniz.raw.glb
  └─ gltf-transform optimize    assets/leibniz.glb (dedupe, weld, meshopt)
  └─ gltf-validator + checks    triangle budget, node-name contract, no NaN transforms
```

- **One command** (`pnpm build:model`) runs everything. The build is deterministic, so the same params give the same `.glb`.
- **Preview renders:** `render_previews.py` writes Workbench renders of fixed views to `blender/out/` (git-ignored), used for the photo-overlay check.

## 8. Fidelity checks

1. **Photo overlay.** Camera-match two reference photos in Blender (front: Commons *Rechenmaschine von Leibniz (Nachbau) 08*; underside: *Leibniz-Rechenmaschine TSD (10)*). Overlay the render at 50 % and record deviations in `design/fidelity-log.md`. M2 used the true front elevation *Rechenmaschine von Leibniz (Nachbau) 03* instead (*Nachbau 08* is taken from above), with an orthographic render scaled by the 37 mm knob pitch (`render_m2_overlay.py`); the deviations are in [m2-notes.md](m2-notes.md).
2. **Proportion checklist:**
   - digit pitch 37 mm (36.5 since M4, from the drawings);
   - mechanism length 670 mm;
   - height about 170 mm;
   - Magna Rota about 124 mm;
   - drum about 28/33 mm diameter;
   - carriage length about 470 mm.
3. **Mesh check.** In the Blender preview, sweep θ from 0 to 360° and test for intersections between the drum ribs and the receiving gear at each setting (a script reports the minimum clearance).
4. **Arithmetic check.** The sim unit tests cover add, subtract, ripple 9999…9 + 1, borrow 1000 − 1, the multiplication 1709 × 365, a division with remainder, and both carry modes.
5. **Acceptance tests on the `.glb` (in `pnpm test`, from M1 on).** Readout, contact and clearance checks run on the exported model, posed through the web rig exactly as the page poses it. See `docs/conventions.md` → *Testing*, and §10.1 below.

## 9. Teaching affordances that affect modelling

These must be planned now, because they change how the meshes are cut.
- **Cut-away and x-ray:** casing panels are separate nodes (`pm.box.panel_*`, `pi.register.cover`), so they can hide or turn transparent.
- **Single-digit slice:** every per-digit sub-assembly can be isolated. Grouping keeps one digit's chain together.
- **Exploded view:** each part stores an "explode vector" as glTF `extras`, so the web side can animate it.
- **Labels:** each node carries a German and an English label key in `extras` for hover tooltips.
- **Didactic colouring:** material slots, not separate meshes (§4).

## 10. Milestones

| M | Deliverable | Exit criteria |
|---|---|---|
| **M0: one-digit slice** ✅ done 2026-10-17 ([notes](m0-notes.md)) | Drum + setting dial/rack + receiving gear + result wheel + Einzahn + carry store + pentagon, built procedurally from params, exported, and shown in a minimal three.js page with a θ slider | Turning θ adds the set digit. 9 + 1 stores a carry and tilts the pentagon. No visible mesh collisions. |
| **M1: 3-digit carry slice** ✅ done 2026-10-17 ([notes](m1-notes.md)) | 3 digits plus Zweihörner, the drive gears and the sim logic (both carry modes). Step mode. **Acceptance-test harness** (glTF-in-Node, readout/contact/clearance checks, `?selftest`), retrofitted to M0 first. | 999 + 1 ripples in one turn (`ripple`) and needs extra idle turns (`historical`, 900 → 000 + carry → 1000). `pnpm test` runs the M0 and M1 acceptance specs (§10.1) and passes. |
| **M2: full machine** ✅ done 2026-10-18 ([notes](m2-notes.md)): mechanism 2026-10-17; casing, photo overlay (carriage, Magna Rota, frame and case within 5 % of the photos) and materials 2026-10-18. Chromebook performance not measured yet. | 16-digit register, 8-digit carriage, Magna Rota with pin and stop, counter, lead screw and carriage shift, casing, materials | Every worked example animates correctly. Within the performance budget. Photo overlay within about 5 %. |
| **M3: teaching layer** 🟡 built 2026-10-18 ([notes](m3-notes.md)), redesigned for release 1.0.0 on 2026-10-20 ([ui-design.md](../docs/ui-design.md)); teacher test, translation review and Chromebook measurement open | UI (EN/DE, then ten languages), camera presets, cut-away, exploded view, labels, guided lessons (9999 + 1, 1709 × 365, a division) | Usable by a teacher without instructions (to be tested with 1–2 teachers) |
| **M4: fidelity upgrade (target C)** | Replace `est`/`design` params with documented values from NL 183 or the GWLB (§12). NL 183/465 received 2026-10-29; candidate values in [notes-nl183.md](../research/sources/notes-nl183.md) §10. Planned for v1.1.0 in [m4-notes.md](m4-notes.md). | Params mostly `doc`. Decision 0001 revisited. |

M0 and M1 also prove the pipeline (params → Blender → glTF → three.js), which the later milestones reuse.

**Each model milestone has a permanent experiment page** in `dev/NN-name/`, linked from `dev/index.html`. M3 is the site's main page instead (`index.html`):

| Milestone | Page |
|---|---|
| M0 | `01-digit-slice` |
| M1 | `02-carry-slice` |
| M2 | `03-full-machine` |
| M3 | `index.html` (the main page) |

A milestone is accepted when **`pnpm test` passes its acceptance spec** (§10.1) and you have tested its page by hand. Earlier pages must keep working as shared code (`js/sim/`, `js/scene/`, params) evolves, so they double as live regression tests. Every page has a **Reset machine** control and a `?selftest` mode that plays the same acceptance scenarios on screen.

### 10.1 Acceptance specs

Each statement becomes one test in `tests/accept/` (named by its ID) and one `?selftest` check on the milestone's page. Tolerances: contact ≤ 0.3 mm, clearance ≥ 0.05 mm, readout angles ± 1°.

#### M0: one-digit slice (retrofitted at the start of M1)

| ID | Statement | Kind |
|---|---|---|
| A0-1 | For every result digit *d* at rest, a ray cast straight down through the centre of the reading window hits the glyph for *d*. | readout |
| A0-2 | For every setting *s*, the setting pointer aims at the glyph *s* on the dial plate (± 1°). | readout |
| A0-3 | For every setting *s*, the receiving gear's plane lies on rib *k* exactly when *k* ≥ 10 − *s*, and on the plain drum core otherwise. | readout (geometry ↔ logic) |
| A0-4 | During each engaged rib window, that rib and the receiving gear are in contact at mid-window; outside every window they are clear. | contact + clearance |
| A0-5 | 9 + 1: the pentagon's top edge is level at rest, tilted 18° (± 1°) at the end of the rib window, and level again at the end of the turn. The window then shows 0. | readout |
| A0-6 | 0 − 1: the same as A0-5, mirrored (borrow); the window then shows 9. | readout |
| A0-7 | During the 9 → 0 step, the Einzahn pin and a Fünfhorn horn are in contact while the store moves, and they are clear at rest. | contact + clearance |
| A0-8 | The pinion and the rack stay in contact and clear of each other across the whole setting range. | contact + clearance |
| A0-9 | The `.glb` contains every node the page needs, each with motion extras (`motion`, `axis`). | contract |
| A0-10 | The setting stop (added in M4): the pointer clears the stop for every setting 0–9, comes within 0.3 mm of it at 0 and at 9, and cannot turn a tenth of a division beyond either. | contact + clearance |

#### M1: three-digit carry slice

| ID | Statement | Kind |
|---|---|---|
| A1-1 | A0-1…A0-9 hold for each of the three digits. | all |
| A1-2 | `ripple`: 999 + 1 → the three windows read 000 and one carry leaves the slice after **one** turn. Every pentagon is level at rest. | readout |
| A1-3 | `historical`: 999 + 1 reads 900 after the first turn (tens pentagon tilted, carry pending), then 000 with one carry out and all pentagons level after one idle turn (input 0). | readout |
| A1-4 | Each Zweihorn touches its carry drive only inside its own carry window, in order from the units digit upward; a secondary carry is stored before the next lever's window opens. | contact + timing |
| A1-5 | Borrow ripple: 000 − 1 → 999 with one borrow out (`ripple`). | readout |
| A1-6 | Sampled clearance at the runtime transforms for every moving pair across the add and subtract turns of A1-2 and A1-5. | clearance |
| A1-7 | The M0 page (`01-digit-slice`) still passes its own acceptance spec, i.e. shared code changes did not break it. | regression |

The M1 harness work comes first:
- load the `.glb` in Node;
- add a small geometry helper module for ray casts, minimum distances, edge angles and the BVH-based intersection test;
- write the M0 tests A0-1…A0-9;
- add `?selftest` to page 01.

The new M1 parts follow, with A1 tests written alongside each one.

#### M2: full machine

M2 design decisions:
- **Carriage.** The 8 drums, setting knobs, drive chain, Zweihorn levers and Magna Rota ride on one carriage (`pm.carriage`). It shifts in 37 mm steps (36.5 since M4; offset 0–8, 0–7 since M4 decision D4, so the top digit is reached only by a carry) by the lead screw and end crank, only at rest. Lever j acts on register store o + j.
- **Carries beyond the carriage window stay stored.** A store above the top lever has no lever to execute it. Its carry stays stored (pentagon tilted) until a later turn with the carriage shifted over it. This is the "open question" from §11, now modelled.
- **A store holds one carry.** A turn that would store a second carry in a store whose first carry is still waiting is refused, and the page says the operator must shift first. Mechanically, the Einzahn would push the store from 18° to 36°, into the Muldenrad's transfer range (27–45°), half-turning the next wheel. Without this rule the sim lost the second carry silently (found 2026-10-18: adding 9 999 999 for the 201st time at offset 0).
- **Faster carry execution.**
  - Once the store passes 45° (the next wheel has finished its step), the detent spring takes over from the lever and completes 45 → 72° within 2°.
  - The lever stagger is 6.5° (the secondary carry is stored 5.1° after first contact), so 8 levers fit in 292–347.5°.
  - Every early "other horn" pass falls in 6.9–52.4°, before the ribs.
  - Spreads run 120° → 29°, in the same spirit as Lehmann's 135 → 39.
  - The add and sub arms sit in separate planes.
- **The Magna Rota is geared 10 : 1 to the crank** (one dial turn = ten operations). Its ring has 10 holes. A pin in hole m stops the crank after m turns at the fixed stop between 0 and 9 (Leupold). The ring also serves as the 1-digit revolution counter: the quotient digit is read off it, as in the sources. Turned back, the pin comes round to the finger's far face, leaving 9 − m whole backward turns (m2-notes). Multiplication uses the pin, and division uses the ring as a counter with the pin out (black numbers count additions, red numbers subtractions). The operator's main crank sits in the middle of the ring.

| ID | Statement | Kind |
|---|---|---|
| A2-1 | Contract: 16 result wheels and 16 stores on the register; 8 drums, knobs and levers plus the Magna Rota on `pm.carriage`. Anchors are present. | contract |
| A2-2 | All 16 windows read 0–9 correctly, and all 8 setting pointers aim at their digit (both at offsets 0 and 8). | readout |
| A2-3 | For every carriage offset 0–7 (0–8 before M4), drum j sits under the receiving gear of register digit o + j and lever j lines up with store o + j, with nothing intersecting at rest. | geometry |
| A2-4 | **1709 × 365** with the Magna Rota (pins 5, 6, 3 at offsets 0, 1, 2) reads **623785**, and the pin rests against the stop after each multiplier digit. | readout |
| A2-5 | **623785 ÷ 1709** by repeated subtraction and shifting gives quotient digits 3, 6, 5 (read on the Magna Rota) and remainder 0. | readout |
| A2-6 | Ripple: **999999999 + 1** at offset 0 reads 000000000 with the carry for digit 8 stored (pentagon tilted, no lever there). After a shift to offset 1 and an idle turn, it reads 1000000000 with every pentagon level. | readout |
| A2-7 | Historical: **9999 + 1** reads 9900 (tens pentagon tilted) after the first turn and 10000 after one idle turn. Secondary carries are deferred, not lost. (GWLB's exact 3-turn sequence is not reproducible with this lever geometry; see decision 0001's correction.) | readout |
| A2-8 | Budget: at most 300 k triangles and at most 15 MB of `.glb`. | budget |
| A2-9 | Sampled clearance at the runtime transforms across add and subtract turns, carriage shifts and a multiplier run. | clearance |
| A2-10 | The M0 and M1 specs still pass (shared-code regression). | regression |
| A2-11 | A carry store holds one carry. With digit 8's carry waiting above the carriage and digits 0–8 at 9, a turn adding 1 is refused (nothing moves; store 8 stays at 18°). After a shift, an idle turn and the shift back, the same addition completes, and the register holds the exact value (2 000 000 000). | readout |
| A2-12 | Casing: the oak case, the oak base and bearers, and the brass cover plates are static parts (the carriage cover rides with the carriage), so the page can hide them together. No woodwork sits outside them, so hiding them leaves only the mechanism. All 16 windows read through the cover openings at offsets 0 and 8. | readout |
| A2-13 | Both cranks can be turned by hand. Over a full turn, at both carriage ends, the main crank's knob stays at least 10 mm above the case's front wall top and floor (room for fingers), and the end crank's knob stays above the table. Added 2026-10-18: the knob used to run in a 6 mm slot behind the front wall. | geometry |

#### M3: teaching layer

M3 design decisions, as first built. **The 1.0.0 redesign superseded several of them** ([docs/ui-design.md](../docs/ui-design.md)): ten languages instead of EN/DE, with every text and part name a message key in `js/l10n/` (U7); six lessons and a tutorial instead of four lessons (U6); free play as the home (U2); and the view, not the step, deciding the case, the front and fading (U13–U15). The acceptance checks A3-12…A3-15 were added with them; their statements are in ui-design.md (U12, U13, U10, U16).

- **A learner page, separate from the developer page.** `index.html` (the site's main page) is built for pupils, teachers and visitors. It reuses the sim, the scene code and the M2 model. Page 03 stays the developer page (crank-angle slider, carry modes, self-test hooks).
- **Audience:** pupils from about 12, their teachers, and museum visitors. Short sentences, one idea per step, the mechanism named in both languages.
- **EN/DE everywhere.**
  - All UI and lesson text lives in string tables with an English and a German entry (`js/teach/i18n.js`, `js/teach/lessons.js`).
  - Part names come from the model (`extras.label_en` / `label_de`), static parts included.
  - The German text should be reviewed by a native speaker (still open).
- **Guided lessons are data, not code paths.**
  - A lesson is a list of steps: text, camera view, parts to highlight, callout labels, casing state, and either a scripted machine action (turn, shift, pin, set) or a **learner task** (the learner operates the machine; Next unlocks when its check passes).
  - The lessons:
    1. one digit: the stepped drum;
    2. 9999 + 1: the carry (with the historical carry as an aside);
    3. 1709 × 365 with the Magna Rota;
    4. 623785 ÷ 1709.
  - Lessons drive the same `Machine` as everything else.
- **Highlights and callouts.** A highlighted part glows; with "focus" on, the other parts fade. A callout is an HTML label pinned to a part's position on screen.
- **Exploded view.**
  - Each part group has an explode offset, built into the model as `extras.explode` (mm, glTF frame) from params.
  - The page animates a factor 0 → 1 and adds factor × offset to the posed transform, so it works at any crank angle or carriage position.
- **Free play** keeps the simple controls: input, add, subtract, shift, Magna Rota pin, Reset.

| ID | Statement | Kind |
|---|---|---|
| A3-1 | Every UI string and every lesson text has an English and a German entry, and every part of the M2 model (moving or static) has `label_en` and `label_de`. *Since 1.0.0:* every text of the tutorial and the lessons, and every part's name, exists in all ten languages. | i18n |
| A3-2 | Each lesson runs from its first step to its last, headless, with a scripted learner doing its tasks, and ends in its stated state (lesson 1: 8, after the demonstration 3 and the learner's 5; lesson 2: 10000 and every pentagon level; lesson 3: 623785; lesson 4: quotient 365 on the ring, remainder 0). | logic |
| A3-3 | Every part a lesson highlights or labels, and every camera view it names, exists in the model or the page. | contract |
| A3-4 | A learner task does not unlock Next until its check passes: a wrong setting, turn or shift leaves it locked, and the right one unlocks it. | logic |
| A3-5 | Exploded view: every part group has an offset. At factor 1 each group sits at its pose plus its offset; at factor 0 every transform equals the unexploded pose (within 1e-6), at rest and mid-turn. | geometry |
| A3-6 | In every lesson step, the parts it highlights or labels are visible (the casing state the step sets does not hide them), and the result windows still read through the cover when the case is shown. | readout |
| A3-7 | The page's `?selftest` runs A3-2…A3-6 on the loaded model. | contract |
| A3-8 | The M0, M1 and M2 specs still pass. | regression |
| A3-9 | No lesson step turns the crank, shifts the carriage or sets a learner task while the machine is taken apart. The page locks the calculating controls while it is apart, and a lesson action waits until it is back together. | logic |
| A3-11 | The machine can be operated by clicking or tapping its parts, as well as with the panel. A dial digit sets that knob; a knob steps it; the main crank turns once; a Magna Rota hole sets the pin (hole 0: pin out); the pin comes out; a result wheel brings the carriage's units under it; the end crank shifts the carriage left. Each part is reachable by a ray from the side a user clicks from. The page applies the same locks and lesson rules as for the panel controls. | logic |
| A3-10 | Labels name a part's position by its decimal place in words ("Result wheel · tens", "10⁴ place"), never by an index, and show the part's current value in a separate chip that matches the machine: result wheels, setting knobs and dials, drums, carry stores, the Magna Rota, its pin and the carriage. | readout |

Still open for M3:
- test the page with 1–2 teachers (the plan's exit criterion);
- have the German text reviewed;
- measure frame rate on a Chromebook-class device with `?perf`.

## 11. Risks and open questions

| Risk / question | Mitigation |
|---|---|
| The timing table is our design, not documented (decision 0001) | Keep it in params, label it in the UI as a reconstruction, and upgrade at M4 |
| Do carries above the carriage window stay pending? | Model it explicitly in the sim. Confirm from the drawings. |
| Exact shapes of the Zweihorn, Fünfhorn and Muldenrad | Parametric profiles, refined later. No tracing of copyrighted drawings. |
| Gear tooth counts other than the 10-tooth receiving gear are unknown | Choose counts that give the required ratios. Mark them `design`. |
| Photo perspective distorts the estimates | Camera-matched overlays (§8) rather than raw pixel ratios |
| Chromebook performance with 16 + 8 + 17 geared assemblies | Instancing, LOD and Meshopt. Measure at M2. |

## 12. Data requested

Documented dimensions for M4 depend on primary material held by others. Each request asks for licence terms that allow use in this open simulator (CC BY or CC BY-SA, or at least dimension tables), with credit to the holders:

1. **Deutsches Museum archive:** copies of **NL 183/460, /465, /466 PLAN, /467 and /746** (N. J. Lehmann's documents, drawings, calculations and photos of his reconstructions). Requested 2026-10-18. **Answered by 2026-10-23** (W. Schinhan, Archiv, ref. AZ FII-61400-2026):
   - **Offer:** 392 PDF scans at 150 dpi ("very legible"), €1 per scan plus a €10 base fee. The scans do not exist yet: the archive makes them for the order, at its standard 150 dpi for working copies. (The finding aid lists 6 + 125 + 10 + 153 sheets and 78 photos, 372 items in all; the reply does not say what the other 20 scans are.) That is €478.38 with 19 % VAT inside Germany. From abroad there is no VAT, but payment comes first, against an advance invoice: €402 plus 6 % (€24.12) by Visa/Mastercard, or €402 plus the bank's transfer fee (0 to about €40 depending on the country). To order: confirm, give a billing address and, from abroad, the payment method.
   - **Terms:** the PDFs are working copies for personal use only. No image from them may be published. **Information taken from them (dimensions, tooth counts, angles) may be published**, cited as "Deutsches Museum München, NL 183/460" (the archive's example; use the actual file number).
   - **Images for publication** would be TIFF scans from the museum's Bildstelle at €24 per scan, arranged separately.
   - The archive reads the catalogue's CC BY-SA 4.0 note as "no commercial use of downloads". That is not what CC BY-SA says, but it does not matter here: the scans' own terms are stricter, and only facts from them go into the project.
   - **Batch 1, /465 and /466 PLAN**, asked for on 2026-10-23, to see how far they answer the construction questions before ordering more. **Quote received the same day:** /465 is 126 scans; /466 PLAN is 9 scans (8 sheets and 1 arrow-shaped drawing). That is €135 + €10 base fee + 6 % card fee = **€153.70**, paid by card from New Zealand against an advance invoice. After consulting the head of the archive, Dr. Röschner, the archive confirmed that PDF scans are **always 150 dpi**, whatever the size of the original; the standard is legibility. /467 would be **184 scans** (more than its 153 sheets), orderable with batch 1 or later. **Batch 1 ordered 2026-10-23** (/467 left until batch 1 has been read); next, the archive sends an advance invoice, scans after payment and emails a download link.
   - **Batch 1 delivered 2026-10-29** (A. Krutsch, ref. AZ FII-62000-2026), as download links valid for 30 days: /465 is 127 pages, /466 PLAN 9 sheets. /465 turns out to be the TU Dresden workshop drawings of the replica (1988–89): dimensions, materials and gear data for nearly every part. Findings, and what they change in `params/`, are in [research/sources/notes-nl183.md](../research/sources/notes-nl183.md). The PDFs are kept outside the repository (docs/licensing.md).
   - **What /466 PLAN contains**, from an overview photo the archive sent (for illustration only; not to be published or committed): a large print, "Die Leibniz'sche Rechenmaschine gezeichnet nach dem Original in der Landesbibliothek Hannover von Werner Lange, März 1958", an exploded pictorial view of the machine **drawn from the original** (so after Burkhardt's restoration), with lettered parts, three large spoked gears A, B, C, one centre distance dimensioned, and Lehmann's pencil notes; tracings of the carry chain for three digits in isometric layout (star wheels, Fünfhörner, part-toothed wheels, the row of digit wheels); sheets that seem to show, for one digit after another, a 10-division wheel with a two-armed lever at a different angle each time, possibly the Zweihorn stagger (decision 0001); and a large tooth-profile drawing with dimension lines. Mostly schematic: the part dimensions are more likely in /465.
2. **mbe Marc Brandt engineering (Burgdorf):** the c. 2011 CAD model (made for the GWLB, based on the Badur/Rottstedt design) and the 2020 measurements of all parts of the original (taken with mbe's support for a Leibniz Universität Hannover glass model). Sources: research/sources/bibliography.md (LEIBNIZCENTRAL, HANNOVER2020). Requested 2026-10-18. **Declined 2026-10-19:** having consulted Klaus Badur, mbe may not provide any data or dimensions. The machine, and with it all rights, belongs to the GWLB, so a request has to go to the GWLB officially.
3. **Gottfried Wilhelm Leibniz Bibliothek (GWLB), Hannover:** the owner of the original and of the rights to the CAD model. To be asked officially for, in order of preference, the CAD model, a table of dimensions, or permission to use dimensions with credit. Not asked yet. Its published terms require a reproduction permission for photographs of the machine (digitisation and reproductions department), and name no open licence; the request should expect conditions rather than CC BY-SA.

Independent of any permission: *Das letzte Original* (GWLB 2014; WALSDORF2014 in the bibliography), co-written by Klaus Badur, may give dimensions, which can be used as facts with a citation.

Settled: Stein 2007 has been read (research/sources/bibliography.md, STEIN2007), and decision 0001 was confirmed on 2026-10-17 (`ripple` default, `historical` second mode).
