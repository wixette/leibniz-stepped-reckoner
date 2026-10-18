# M2 notes: the full machine

- **Status:** done 2026-10-18. Mechanism 2026-10-17; casing, photo overlay and materials 2026-10-18. The acceptance spec passes: A2-1…A2-9 and A2-11…A2-13 in `pnpm test`, and A2-10 is the M0 and M1 specs, which run in the same `pnpm test`. Chromebook performance is not measured yet (see "Not done yet").
- **Plan:** [modelling-and-animation-plan.md](modelling-and-animation-plan.md) §10, §10.1 (M2 design decisions)
- **Page:** `dev/03-full-machine/` (add `?selftest` to run A2 in the browser)

## What M2 adds

| Node | Parts | Motion |
|---|---|---|
| `pi.sum_wheel.k`, `pi.carry_store.k` (k = 0…15) | the M1 register parts, 16 times, fixed to the frame | as M1 |
| `pm.carriage` | carriage floor, nut on the lead screw, drum and knob bearings | translates −37 mm per place (offset 0–8) |
| `pm.carriage_panel` | front panel, stepped on the right as on the original (hidden for the cut-away view) | rigid with the carriage |
| `pm.drum_shaft.j` … `pm.zweihorn_sub.j` (j = 0…7) | the M1 drum, setting and carry-lever parts, on the carriage | as M1; lever j acts on store o + j |
| `frame.lead_screw` | 37 mm pitch screw and the end crank (outside the case's left wall) | 360° per place |
| `pm.magna_rota` | ring with 10 holes; black numbers 0–9 count additions, red numbers count subtractions | 36° per crank turn |
| `pm.magna_pin` | the pin, in the hole set by the operator (hidden when out) | with the ring |
| `pm.magna_plate` | dark backing plate and stop finger just clockwise of the top | rigid with the carriage |
| `pm.main_crank` | the operator's crank in the middle of the Magna Rota | θ |
| `frame.case` | oak case: floor, rear and end walls (the left one with a hole for the screw), low front wall (no lid) | static |
| `frame.base` | oak base board and the two bearers under it (woodwork; split out of `frame.static` 2026-10-18) | static |
| `frame.register_cover` | brass top plate over the register, with openings over the 16 windows and a front skirt | static |
| `pm.carriage_cover` | brass top plates (the right one 12 mm lower), end walls, and the revolution-counter dial plate | rigid with the carriage |

The two oak bearers the mechanism stands on are in `frame.base`, with the base board. 110 objects, about 164 k triangles, 6.9 MB `.glb` with textures (budget: 300 k, 15 MB).

## Casing (2026-10-18)

The original sits in an **oak case** with **polished brass cover plates** (research/data/machine_spec.json). In normal use only these stay visible:
- the 16 result windows,
- the 8 setting knobs,
- the Magna Rota with its crank.

The four casing nodes (`frame.case`, `frame.base`, `frame.register_cover`, `pm.carriage_cover`) are static, so page 03 shows or hides them together. With them hidden, only the mechanism remains: all woodwork is in the casing, and the brass frame (rear wall, front bar, brackets, screw bearings) stays. They are shown by default (the original look), and the "Show the case, base and cover plates" box hides them to show the mechanism.

- **Heights.** The register cover sits at z 86–87.5, above every register part: the Muldenrad tips reach z 84.4 and the rear wall z 85. The carriage cover sits on the front panel at z 94–96, under the knob plates (z 98), with holes for the knob shafts. (Before the photo overlay these were z 104–106 and 108.)
- **Openings.** The cover's openings are 1–2 mm larger than the window plate's. Without that, a digit 8 mm below the cover was half hidden from the "Register" view.
- **Proportions.** See the next section: the photo overlay set the case to 806 × 290 mm.
- **Main crank vs the case front (2026-10-18).**
  - The crank rests pointing down, so at rest its knob is at the bottom of its sweep.
  - The knob ran in a 6 mm slot behind the front wall, 16 mm below its top and 4 mm above the floor. Nothing intersected, but no hand could follow it round, and from the front the knob was hidden.
  - The case floor is now 26 mm lower (z −60, taller bearers), and the front wall top is at z −42. The knob clears the wall by 12 mm and the floor by 30 mm.
  - **A2-13** now checks over a full turn at both carriage ends that both cranks can be turned by hand: knob ≥ 10 mm above the front wall and the floor, and the end crank's knob above the table. With the old case it fails (−16 mm, 4 mm).
- **What A2-9 found when the casing went in:**
  - The carriage cover's end walls reached the result-wheel shafts (now they end at y 4).
  - The end crank's 28 mm arm swung its knob through the base plate (now 12 mm). This collision existed before the casing: the lead-screw-in-frame journal exemption hid it. That is the cost of a broad designed-contact entry.
- **A2-12** checks the casing:
  - the parts are static, and the carriage cover moves with the carriage;
  - no oak mesh exists outside the four casing nodes;
  - all 16 windows read through the cover openings at offsets 0 and 8.

## How the sim generalised

- **`Machine(registerDigits, carriageDigits)`** (`js/sim/machine.js`) replaces the M1 slice logic. `CarrySlice` is now `Machine(3, 3)`, so M1 runs on the same code.
- **Offsets.**
  - Ribs act only on register digits under the carriage.
  - Carry levers only pass stores under the carriage.
  - A carry stored above the top lever stays stored, pentagon tilted, until the carriage is shifted over it.
- **The Magna Rota pin stops forward turns only.** The stop finger sits on one side of the pin. With a pin in, the crank turns forward until the pin reaches the stop (multiplication). Division uses the ring as a counter with the pin out, and the quotient digit is the red number at the stop.
- **A store holds one carry (added 2026-10-18).** `Machine.startBlock(dir)` says why the crank may not start: the carriage is moving, the pin, or `{ storeFull: k }`.
  - `storeFull` means this turn would store a second carry in a store whose first is still waiting above the carriage.
  - That turn is refused. Page 03 says the operator must shift first, and a scripted run stops with the same message.
  - **Example:** adding 9 999 999 at offset 0 stores digit 8's carry at the 101st addition. The 201st addition is refused until the carriage is shifted over digit 8.
  - Before this rule the sim dropped the second carry silently (10⁹ too low).
  - A turn that *cancels* a waiting carry (a borrow at the same digit) is allowed: the store goes back to rest.
  - Tests: `tests/sim/machine.test.js` and A2-11.
- **Operator procedures** are in `js/sim/operations.js`: `multiply` (pin per digit, shift) and `divide` (subtract until overdrawn, add back once, read the ring). The page's worked examples and the tests use the same steps.

## Design findings

1. **The lead screw had to move behind the front panel** (y −77, z 20; it was y −104). At the front it crossed the Magna Rota ring's plane and the crank's sweep.
2. **The Magna Rota needed its own crank.** A handle on the ring itself (36° per operation) is not a crank, and its knob swept through the stop bridge. The crank now sits in the ring's centre hole (ring = annulus). Its arm is in front of the pin heads, and its knob stays above the carriage floor.
3. **Shared layout bug, also in M1:** drum *i*'s ribs reached 0.4 mm into the setting rack of digit *i* + 1 whenever that digit's setting was at least 2 below digit *i*'s. Drum shaft *i* also clipped the setting pinion of digit *i* + 1. M1's hand-written pair lists (A1-6 and the Blender sweep) never tested neighbouring-digit pairs. The M2 all-pairs sweep found it.
   - **Fix:** rack pitch line 20 → 19 mm (0.6 mm clearance to the rib tips). The square drum shaft starts behind the neighbour's pinion. In M1, shaft 0 reaches the handwheel as a round shaft that clears it. M0, M1 and M2 were rebuilt.
   - **Process fix:** A1-6, A2-3, A2-9 and both Blender sweeps are now **all-pairs** with an explicit designed-contact list (see docs/conventions.md).
4. **A harness bug:** BVHs built the default way reorder a geometry's index in place, but GLTFLoader shares index buffers between identical primitives. Building one wheel's BVH broke another's, and rays passed through it. BVHs are now built with `indirect: true`.
5. **The stop gap.** The pin stops 0.15 mm short of the finger (contact tolerance 0.3 mm), so the at-rest pose never intersects.

## Proportions and photo overlay (2026-10-18)

**Method.** Every photo is measured with the documented 37 mm digit pitch as the ruler: the 8 setting knobs sit one pitch apart. No outline was traced. The comparison is between numbers, and the overlay only checks them by eye.
- **Main reference:** *Rechenmaschine von Leibniz (Nachbau) 03* (Commons, Eremeev, CC BY-SA 4.0), the Dresden replica. It is a true front elevation: long lens, camera level with the carriage top. Knob pitch 55.6 px in the knob plane, about 1.556 px/mm in the carriage-front plane (the front is about 70 mm nearer the camera).
- **Cross-checks:**
  - *DD-TS-Leibniz-Rechenmaschine* (SchiDD, CC BY-SA 4.0): the same replica, from slightly above.
  - *Leibniz Rechenmaschine (1690)* (CC BY 3.0): the original in Hannover, in its case with the lid open.
  - Jordan 1897 Fig. 4 (public domain): the original in April 1892.
  - *Leibniz-Rechenmaschine TSD (12)* (Dr. Bernd Gross, CC BY-SA 4.0): a top view, used for depths.
- **Overlay:** `blender/scripts/render_m2_overlay.py` renders an orthographic front elevation of the model (one flat colour per part) and draws its edges in red over the scaled photo. The photo and the model are aligned on the units knob and the carriage's top front edge.
  - Output goes to `blender/out/overlay/` (git-ignored; the overlays are derivatives of CC BY-SA photos, so they are not committed).
  - With the replica's carriage at about offset 6, the frame lines up too.

```
Blender --background --factory-startup --python blender/scripts/render_m2_overlay.py -- --offset 6 \
  --photo "research/images/commons/Rechenmaschine_von_Leibniz_(Nachbau)_03.jpg" --px-per-mm 1.556 --knob0 812.8 413
```

**What changed.** The carriage, the Magna Rota and the case were the furthest off:

| Feature | Photos | Model before | Model now | Residual |
|---|---|---|---|---|
| Carriage length | 468 (Nachbau 03), 469 (DD-TS), 463 (original) | 354 | 468 | 0 % |
| Knob 7 to the carriage's left end | 60, 59, 51 | 75 | 60 | 0 % (Nachbau 03) |
| Knob 0 to the carriage's right end | 149, 151, 152 | 20 | 149 | 0 % |
| Carriage front height (bottom edge to top) | 121 (Nachbau 03) | 99 | 121 | 0 % |
| Magna Rota diameter | 126, 128, 127; 131 (1892) | 96 | 126 | 0 to −4 % |
| Magna Rota centre, left of knob 0 | 162 (Nachbau 03), 154 (DD-TS, from above) | 155 | 162 | 0 / +5 % |
| Magna Rota centre height | middle of the carriage front | middle | middle | — |
| Main crank radius (axis to knob) | 62 | 45 | 60 | −3 % |
| Right part of the carriage: full height to, right of knob 0 | 87 | — | 87 | 0 % |
| Right part: top below the main top | 12 | — | 12 | 0 % |
| Right part: height of the stepped end | 58 | — | 54 | −7 % (its underside clears the lead screw, z 30) |
| Counter dial centre, right of knob 0 | 77 | — | 77 | 0 % |
| Carriage top depth (front edge to the register) | about 116 (top view; ±10 %) | 96 | 116 | 0 % |
| Frame (base) length | 670 (JORDAN1897), about 655 (Nachbau 03) | 750 | 667 | −0.4 % / +2 % |
| Case length, outside | about 800 (original: 21.5 pitches = 797 in the 1690 photo; 1.72 × carriage = 805 in the 1892 photo) | 780 | 806 | +1 % |
| Case depth, outside | 300 (secondary) | 270 | 290 | −3 % |

Lengths are in mm. Unchanged and already matching: the 37 mm digit pitch and the 16 windows (documented), and the knob row (one pitch apart, by construction).

**How the layout changed** (`params/machine.json`, `geometry.m2`):
- **Carriage.**
  - The left end moved in (35 mm from drum 7).
  - The carriage gained the stepped right part of the original, which carries the counter dial (`carriage_counter_section`). At offset 0 that part hangs 115 mm past the frame's right end; the replica photos imply about 130 mm. Its underside (z 30) passes over the right screw bearing.
  - The front panel moved 20 mm forward (y −112) and now runs from z −25 to 94, below the base plate, as on the original (`carriage_front_panel_z`). The base plate starts behind it (y −106).
- **Magna Rota.** Radius 48 → 63, pin circle 38 → 50, centre at x −137, z 35.5. Its backing plate is now dark steel, so the ring stands out from the panel. The main crank is 60 mm, with a larger knob.
- **Frame.** The base plate is 667 mm (`geometry.m2.frame`). The mechanism stands on two 34 mm oak bearers, as on the cross bars in the 1892 photo, so the carriage front and the ring hang below the base. The end crank is outside the case's left wall, as in the 1690 photo and Jordan's Fig. 2 (next bullet).
- **Case.** Outer 806 × 290 mm, 182 mm high without the lid (walls to z 140, above the knobs, as in the photos).
- **End crank outside the case** (as on the original: machine_spec "crank at left end", Jordan 1897 Fig. 2 "K").
  - The lead screw passes through a bearing hole in the case's left wall. The wall is built from four pieces around an 18 × 18 mm hole, which leaves 1.45 mm to the screw ridge (radius 7.55).
  - The crank's arm plane is 8–11 mm outside the wall; its knob reaches 37 mm out; the arm is 55 mm.
  - **Against Jordan's Fig. 2** (a plan view; measured in his window pitch, since that drawing shows the 12-digit version): the arm is about 1.14 pitches, 42 mm at 37 mm or 59 mm at the printed 67 cm scale. The arm plane is about 9–12 mm outside the wall, and the handle reaches 32–45 mm out. All three model values fall in these ranges.
  - **Table clearance.** The axis is at z 20 and the case underside at z −42, so the arm plus the knob radius must stay under 62 mm. They are 59 mm: the knob passes 3 mm above the table. (The 24 mm arm proposed earlier assumed the old case underside at z −8.)
  - **Explicit probe.** Because `frame.lead_screw~frame.static` is a designed journal exemption, the crank was also probed on its own: every crank vertex over a full turn in 2° steps, against `frame.static` and `frame.case`. Minimum distances were 19 mm to `frame.static` and 8 mm to `frame.case`, and the lowest point was z −39.05. The screw against the wall hole is covered by the all-pairs sweep (`frame.case` against `frame.lead_screw` is a tested pair).

**Not matched, and why:**
- **Case length against the secondary sources.** MYTIME and SOLCOVA give 970 × 300 × 250 mm. Both photos of the original give about 800 mm, and so does the carriage travel. The 970 mm figure may include the lid's moulding or the display box. We follow the photos.
- **Case height.** It cannot be compared: the 250 mm includes the lid, which is not modelled.
- **Overall height.** From the case floor to the knob tops the model measures 144 mm. The replica measures about 130 mm from its feet, but its carriage hangs below its feet. The secondary 170 mm cannot be checked.
- **The end crank's arm** is 55 mm. That fits Jordan's Fig. 2 (42–59 mm) but not the replica photos (about 120 mm), which would reach below the table.
- **The register is not overlaid.** Its parts sit under brass covers in the original and under glass in the replica. Only its length (16 × 37 mm) and its height against the carriage top (8.5 mm below; the photo shows 8–12 mm) are compared.
- **Ornament** is not modelled: the Magna Rota's pierced scrollwork, the panel mouldings and the engraving.

## Materials and lighting (2026-10-18)

The material names stay the same (`brass_polished`, `brass_satin`, `steel`, `steel_dark`, `oak`, `wood_dark`, `enamel_white`, `ink_black`, `ink_red`). The acceptance checks and the didactic colouring rely on `ink_black`, `ink_red` and `enamel_white`.
- **Textures** (`blender/scripts/lib/bl.py`) are generated in the build with numpy, from a fixed seed, so a rebuild gives the same `.glb`. They tile seamlessly, so no texture source files are needed.
  - **Oak:** a 1024² colour map (long, gently wandering growth rings, pores, a little figure) and a roughness map. Darker, as the original case is.
  - **Brass and steel:** a 512² roughness map each, with fine brushing along the machine and soft wear patches. This breaks up the flat plates.
  - **UVs:** box-projected at 250 mm per tile, with u along X, so the grain and the brushing run along the machine. Only meshes with a textured material get UVs.
  - The textures are exported as JPEG (`bl.EXPORT_IMAGES`), with metallic and roughness in one glTF texture (G = roughness, B = metallic). They add about 2 MB, including the UVs (4.9 → 6.9 MB).
- **Colours** are linear reflectances. Brass is toned down for aged, lacquered metal (polished 0.86/0.64/0.28, roughness 0.20; satin 0.38). Steel is 0.55/0.56/0.58, roughness 0.28, and dark steel 0.10/0.11/0.13. Enamel is glossier (0.30).
- **Viewer** (`js/scene/viewer.js`, shared by pages 01–03):
  - A studio environment replaces three.js's RoomEnvironment: a warm grey dome with softboxes above left, to the right, in front, below the front (so vertical brass faces catch a reflection) and behind. Metals take their look from what they reflect; in the grey room the brass looked olive and flat.
  - Neutral tone mapping replaces ACES, which pushed brass yellows towards olive.
  - The key light is a little weaker and warmer (1.2).
- **Node acceptance tests** skip textures. Node has no image decoder, and the checks use geometry and material names only (`tests/accept/loadGlb.js`).

## Digit labels enlarged for teaching (2026-10-18)

**This is a deliberate deviation, not a documented size.** None of our sources gives digit sizes. Leupold (1727, via Jordan 1897) only says the digits 0–9 are inscribed on the wheels and dials, and the Magna Rota's engraving is listed as a photo-only detail. At the earlier, estimated sizes the digits were unreadable once the whole 16-digit machine was in view. All values are in `geometry.m2.digit_labels`; the M0 and M1 slices keep their sizes.

Digit height is 0.70 × the font size passed to `bl.glyph_mesh` (measured).

| Where | Digit height before → now | Layout |
|---|---|---|
| Result windows | 4.3 → **10.0 mm** | Result disc radius 15 → 17.5 mm and width 8 → 14 mm (y 59.2–73.2). Its front rim keeps 0.6 mm from a drum's back end (y 58 at setting 0); its back stays clear of the carry-store horns (y 75); adjacent rims are 1.2 mm apart on the 37 mm pitch. The window opening is 12.6 × 13.2 mm, which leaves about 3 mm of white beside the digit and 1.6 mm above and below, while the neighbouring digits on the disc stay out of view. The cover opening is 1 mm larger all round. |
| Setting dials | 2.7 → **4.6 mm** | Plate radius 17 → 18 mm (plates 1 mm apart on the 37 mm pitch); digits on a 14.3 mm circle with wide gaps between them; pointer 8.5 → 10.5 mm to reach them. A first try at 6 mm looked crowded. |
| Magna Rota | 4.2 → **9.1 mm** | Three rings from the rim inwards, with gaps between them: holes at r 55 (was 50), black digits at r 45, red digits at r 32. The stop finger spans only the band from the rim to the holes, so it never covers a digit. |
| Revolution-counter dial | — | Has dot marks only, no digits |

**Limits:**
- A 10 mm digit needs about 2 px/mm on screen. That is about a full-screen window for the whole 800 mm machine. In a narrow pane showing all of it, a digit is only about 7 px tall, so zoom in (the Register and Magna Rota views) to read it.

## Verification

| Check | Result |
|---|---|
| `pnpm test` | 299 tests, including the A0, A1 and A2 acceptance specs; about 12 s in total |
| A2-9 (in `pnpm test`) | 765 poses (every 15°, every 1/8 place) over 5 scenarios: 1709 × 365, 999999999 + 1 with shifts across the whole travel, 99999999 + 99999999, 0 − 1 at offset 8, historical 9999 + 1 |
| `pnpm check:model` | M0_CLEARANCE_OK; M1_CLEARANCE_OK (all 462 moving pairs × 7957 poses); **M2_CLEARANCE_OK: all 5712 moving pairs (with the casing and base) × 8399 poses** (1° crank steps, 1/32-place shifts, 5 scenarios, plus dialling at offsets 0 and 8), 0.05 mm margin, about 3.5 min. Rerun 2026-10-18 after the overlay layout and the materials. |
| Browser `?selftest` | page 01: 9/9; page 02: 6/6; page 03: 12/12 (rerun 2026-10-18; A2-8 reports 164 132 triangles, 6.57 MiB) |
| Page 03 by hand | 2026-10-17: 1709 × 365 = 623785 and 623785 ÷ 1709 = 365 r 0 (worked examples, 2× speed); turn to the stop with pin 3; 999 999 999 + 1 with a shift. 2026-10-18: the overview and front views with the new layout and materials; pages 01 and 02 with the new viewer lighting. |
| Photo overlay | `render_m2_overlay.py` against Nachbau 03 (offsets 0 and 6) and DD-TS (offset 5): the carriage outline, step, knob row and Magna Rota coincide (see the table above) |
| Build | deterministic: two `pnpm build:model` runs give identical `.glb` files |

## Not done yet (rest of the plan's M2 row, or M3)

- **Performance on a Chromebook-class device.** Not measured yet (§11). The six textures take about 16 MB of GPU memory (RGBA with mipmaps).
- **Lid and decoration.** No lid (the GWLB photos show internal decoration in it), no pierced scrollwork or engraving on the Magna Rota, no panel mouldings, no shaped end frames.
- **The revolution counter.** Its dial plate on the carriage's right part is static; in this model the Magna Rota counts the turns.
- **The end crank** is 55 mm, within the range from Jordan's Fig. 2 (42–59 mm). The replica photos show about 120 mm, which would reach below the table here. No spring catch (Einfallfeder) indexes the places yet.
- **Lessons, EN/DE UI, exploded view** are M3.
