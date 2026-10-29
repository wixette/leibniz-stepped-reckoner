# M4: fidelity upgrade from NL 183 (plan)

Release v1.1.0. Status: **planned 2026-10-29, decisions D1–D3 agreed the same day; phase 1 done and reviewed by the owner 2026-10-29; D4 agreed the same day; phase 2 done 2026-10-29, as far as the drawings fit the model (D5 agreed the same day); phase 3 deferred past v1.1.0 (agreed 2026-10-29); phase 4 done 2026-10-29.**

M4 replaces estimated (`est`) and designed (`design`) parameters with values documented in Lehmann's drawings of the Dresden replica, Deutsches Museum NL 183/465 and /466 PLAN. The facts, with pages, are in [research/sources/notes-nl183.md](../research/sources/notes-nl183.md) (§10 lists the candidate parameters) and [research/data/nl183_dimensions.csv](../research/data/nl183_dimensions.csv). The scans stay outside the repository ([docs/licensing.md](../docs/licensing.md)).

## Decisions (phase 0)

| | Question | Decision |
|---|---|---|
| **D1** | Which machine do the dimensions follow? | **The Dresden replica, throughout** (agreed 2026-10-29). Digit pitch and lead 36.5 mm, not Burkhardt's 37 mm for the original. The model's proportions already come from photos of that replica, and mixing the two would be inconsistent. `reference_machine` in params and the page's About text say so. |
| **D2** | Setting dial: Lehmann's 13 divisions or our 10? | **Lehmann's 13 divisions** (agreed 2026-10-29): digits 0–9 at 27.7°, a 110.7° blank sector with the finger-lever stop, the 10-tooth module-1.25 pinion, 3.02 mm per digit. The photo of the original shows the same layout (evidence below). |
| **D3** | Carry timing | **Keep our design timing** (6.5° lever stagger, spreads 120° → 29°) until /467 is read (agreed 2026-10-29). Phase 3 waits for it. |
| **D4** | Carriage positions: Lehmann's 8 (shift 7 places; the 16th digit only by a carry, used as a sign place) or our 9? | **Lehmann's 8** (agreed 2026-10-29): offsets 0–7 (`layout.carriage_positions`, `Machine.maxOffset`). With 9 the carriage at offset 8 would reach 9.75 mm past the replica's left wall; with 8 the frame takes the replica's 610 mm between its walls. |
| **D5** | Exterior: the original's oak case (as now, from the photos) or the replica's steel frame with cladding, trim strips and feet? And the large gears A, B, C? | **Keep the oak case; A, B, C stay out of v1.1.0** unless /467 shows where they go (agreed 2026-10-29; phase 2 notes). |

### Evidence for D2

The replica: the dial (part n) has 13 divisions of 27.7°, digits 0–9 on ten of them, and a 110.7° blank sector where the finger lever meets its stop (/465 p. 35, 38). With the 10-tooth module-1.25 pinion this gives 3.02 mm of drum travel per digit, the drum's rib step (p. 57, 63).

The original (the surviving machine, GWLB Hannover):
- **Photo of the original** (Commons `Leibniz_Rechenmaschine_(1690).jpg`, Hajotthu, CC BY 3.0; the page's `images/tutorial/original.jpg`): the digit marks around each setting knob span an arc of about 250–270°, and the sector under the finger hook, about 90–110°, is empty (the owner's reading, confirmed on an enlargement, 2026-10-29). This matches Lehmann's 13-division dial: ten digits 27.7° apart span 249°, leaving 110.7°.
- **Leupold 1727** (Tab. VIII Fig. I) and **Jordan 1897** Fig. 2 (after the *Brevis descriptio* figure): the cover plate of each small dial is engraved 0–9 clockwise from the upper right, with a window at the top showing the set digit and a turnable pointer; the window sits in the gap between 9 and 0. Schematic, and of the 12-digit design, but consistent with a blank sector.
- **Lange 1958** (/466 PLAN p. 9): draws the setting discs under the cover with 0–9 round the whole circle. The odd one out; probably simplified for the illustration.

So the evidence points to the original having the layout Lehmann copied, and D2 adopts it: **the 13-division dial** (digits 0–9 at 27.7°, a 110.7° blank sector with the finger-lever stop), the 10-tooth module-1.25 pinion and 3.02 mm per digit, all `doc`. This changes what the learner sees: the dial glyphs, the pointer angles (acceptance check A0-2), click-to-set on a dial digit (A3-11) and the knob's stop. The model now has 10 divisions of 36° (`pars_mobilis.setting_dial.positions`, `geometry.setting.pinion_module` 1.2732 for 4 mm per digit).

## Phases

Each phase ends with the model rebuilt (`pnpm build:model`), `pnpm test` green and the owner's review of the page before the next starts.

### Phase 1: parameter swaps (done and reviewed 2026-10-29)

Values from notes-nl183.md §10, each changed to `conf: doc` with `src` "NL183/465 p. N" (params version 0.2.0):
- **Digit pitch and lead-screw lead 36.5.** `DIGIT_PITCH` in `js/sim/machine.js` now reads `layout.digit_pitch`. The lever axis sits half a pitch from the result axis, now 18.25 (doc, Bild 1).
- **Drum:** module 2, 16 virtual teeth, tip Ø36 (addendum 1.0), root by hf = 7/6 m, toothed length 27.2 with a Ø14 × 5 boss, rib step 3.02.
- **Receiving gear:** 10 teeth, module 1.75, profile shift +0.674 (pointed tips, Ø23.36), root Ø15.66, 2.5 thick, centre distance 26.5. `GearSpec` gained a `shift` argument: the shifted tooth is the same involute, thicker at the pitch circle. Both the build scripts and `kinematicsM1.js` now take the centre distance from params instead of adding pitch radii.
- **Setting train (D2):** 13 divisions (27.7° per digit) in `dial_angle` / `dialAngle`, pinion 10 teeth module 1.25, rack teeth placed in phase by `Kin.rack_centres()` (11 teeth; Lehmann's has 9, for a different layout). The plate's digits follow the 13 divisions; the plate is Ø35.5.
- **Setting stop**, a new static part `pm.setting_stop.j`: a lug in the pointer's plane filling the blank sector, its faces 0.15 mm from the pointer at 0 and at 9. Named in all ten languages (`part.settingStop`), exploded with the plate. Acceptance check **A0-10** (plan §10.1) and an M0 sweep pair check it; the M2 all-pairs sweep covers the others.

What the drawings' sizes needed besides (all `design`, with notes in params):
- **Drum axis lowered to z 37.875**, so the result shaft stays at 64.375 and the register, windows and covers stay where they were.
- **Rib thickness 0.9** (was 0.8): with the drawings' profiles, 0.8 left 0.44 mm at mid-window, over the 0.4 mm contact tolerance of A0-4. At 0.9 the gap is 0.29 mm each side and the worst clearance over a turn 0.15 mm (2D sweep of the rib and gear profiles; tip clearance 0.67 mm, as on p. 93).
- **Rack pitch line x 16.9** (was 19): the drums are now 36 mm across at a 36.5 mm pitch, 0.5 mm apart, as in the replica; the rack of the next digit has to stay outside that circle.
- **Muldenrad module 1.34422** (was 1.376): the store-to-next-shaft distance shrank with the pitch, to 20.163.

Moved to later phases:
- **Lever height (4.9 above the drum axis) and finger radius 14.65 → phase 3.** They move the solved lever-and-store geometry and so the carry timing D3 keeps. `lever_axis_z` stays 44 (design), with a note.
- **Frame, covers and carriage outline → phase 2:** 610 between the frame walls, carry cover 610 × 80 × 18, carriage cover 439 × 110 with the counter dial 73 right of knob 0, carriage walls 38.25 / 37.25 from the end drums. They conflict with the photo fits of M2 (carriage cover 468, dial at 102, carriage depth 188), and the replica's frame is too short for our carriage at offset 8: Lehmann's carriage shifts 7 places (8 positions; the sign place is reached only by a carry, p. 124), ours 8. **Needs the owner's decision (D4).** Trying the carriage margins alone put the carriage into the right screw bearing (A2-3).
- **The About text's credit to the Deutsches Museum** (ten languages) → phase 4. The README credits it now.

Checks: `pnpm test` 379/379, `pnpm typecheck`, `pnpm check:refs`, the M0–M2 builds (M2: 166 k triangles, 7.0 MB), and `pnpm check:model`.

### Phase 2: new geometry (done 2026-10-29)

Done (2026-10-29), after D4:
- **8 carriage positions**: `layout.carriage_positions` 8 (doc), `Machine.maxOffset` from it; the scenarios, the pose export, A2-2/A2-3 and the tests use offset 7 for the far end.
- **Frame lengths** (`geometry.m2.frame_x`, doc): side walls 10 mm thick and 610 apart, register digit 15 28.5 from the crank-side wall and digit 0 34 from the other; the base is the lower frame, 629 long (end bars 11 on the crank side and 8 on the other: the plan view on p. 93 is drawn with the front at the top). The rear wall, front bar and window plate span the 610. Before, the base was 667 (Jordan's 670 for the original).
- **Side walls** (design in Y and Z, `geometry.m2.frame`): low in front, where the carriage's counter section passes over them, and taller behind under the register cover, like the replica's walls with their low front part and tall rear block (p. 95). The lead screw runs in a notch in each wall, as the replica's screw runs in its walls, instead of on two bearing blocks.
- **Counter dial 73 right of knob 0** (p. 51, 52; the photo fit gave 79).
- **Drive chain** (`geometry.m1.drive_gear_*`): the drum and lever gears are the replica's gears S, 10 teeth with a 22.9 tip (doc), 7 wide, the drum's with its Ø14 collar (4 mm in M2, where the Zweihorn pins sit behind it). Lange's schematic of the original (/466 PLAN p. 1) confirms the arrangement: one row driven by the crank, drum and lever gears alternating. The module is our centre distance / 10, 1.925 (the replica's 18.9 centres need the lever height of phase 3); like Lehmann, the pitch diameter is the centre distance. Tooth thickness 0.95 leaves 0.14 mm at the tightest point (2D sweep). The replica's lever-side gear V is 37.5 long; our lever shafts carry the horns there, so both gears are 7 wide.
- **Kept from the photos:** the carriage box (468 long). Lehmann's 439 is the cover plate alone: measured from the knobs, the photographed box reaches about 9 mm further left and 16 mm further right, with its end walls and trims. The carriage floor's ends stay where they were (see its note). The oak case stays as it was.

(The pointed, profile-shifted receiving gear and the ribs cut as teeth of the 16-tooth gear came with phase 1.)

Not done (decision D5, agreed 2026-10-29), and why:
- **Large gears A, B, C** (61 teeth, module 1.5, three spokes, on bearing blocks marked "crank side", p. 6, 26, 57, 60, 61). The sheets give the parts but not where they sit or what they connect: the crank's shaft, a drum shaft (B has a square bore) or the counter. Lange draws them exploded in front of the carriage, meshing in a row (/466 PLAN p. 8). Three equal gears turn 1 : 1, so they are not the Magna Rota's 10 : 1 reduction, as this plan first assumed. In our model the crank sits in the Magna Rota in the middle of the carriage front (photos), and a Ø94.5 gear there would cut through the carriage floor and the base; placing them would be invention.
- **The replica's exterior:** the ladder-shaped lower frame (bars a, b, c), the upper frame's moulded end pieces, the front cladding, the trim strips with 56 screws and ball-head nuts, and four turned brass feet Ø36 × 45 (p. 7–13, 23–25, 93–111). Our model stands in the oak case of the original's photos instead, on an oak board and bearers, with the floor lowered for the crank knob; feet 45 high do not fit that case.
- **Revolution counter internals** (optional): the counter is not simulated (the Magna Rota counts turns), so its cam, 12-slot driver and gears would be hidden, static parts.
- Muldenrad and Einzahn profiles (optional; partly scaled values, so weaker).

### Phase 3: Lehmann's lever arrangement (deferred past v1.1.0, agreed 2026-10-29)

Spreads 135/102/69/39/36/69/102/132° (places ⑧…①) with their real phases, the lever 4.9 mm above the drum axis and its fingers on radius 14.65; decision 0001 revisited; the simulator's carry timing and the historical-mode tests (A1-3, A2-7) change. Needs the absolute lever phases, probably in /467. Not in v1.1.0 unless /467 arrives in time.

### Phase 4: downstream (done 2026-10-29)

Camera framing, label anchors and explode offsets on the page; acceptance specs; the About text and its credit to the Deutsches Museum, NL 183 (ten languages; `reference_machine` in params is done), `ref.tud.desc` ("checked against photos") and docs; CHANGELOG; release screenshots and videos (`pnpm shots`, `pnpm video`).

Done:
- **Page views:** all 32 release shots checked by eye (`pnpm shots`): the camera presets, the lessons' views and the Taken apart view frame the shorter machine as before, and the setting stop explodes with its plate. No preset needed changing.
- **Acceptance specs:** A0-10 (setting stop), A2-2/A2-3/A2-12 at offset 7, and A2-14 (no flickering faces), added after the owner found a flickering strip at the carriage's left end (since v1.0.0): the carriage cover's end walls lay in the front panel's faces.
- **Texts, ten languages:** the About box's reconstruction note (the main parts' sizes follow Lehmann's drawings), its credits ("Deutsches Museum München, NL 183/465 and NL 183/466 PLAN"), and `ref.tud.desc` (the model follows the replica's drawings and was checked against photos of it).
- **Release pictures:** the README's six pictures retaken; the post set and the videos are made by `pnpm shots` and `pnpm video` (not committed: `shots/`, `videos/`).

## Acceptance

- Every parameter changed in phases 1–2 is `doc` with a page, or `design` with a note saying why it departs from the drawings.
- The M0–M3 acceptance specs pass, with any changed statement (e.g. a new drum length) updated in [modelling-and-animation-plan.md](modelling-and-animation-plan.md) §10.1.
- No image, tracing or re-drawing of an NL 183 sheet enters the repository.
