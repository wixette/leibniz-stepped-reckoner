# Lehmann's replica drawings: findings from NL 183/465 and /466 PLAN

These are facts taken from two files of N. J. Lehmann's papers at the Deutsches Museum, read 2026-10-29. Every value is cited as **Deutsches Museum München, NL 183/465** (or **/466 PLAN**) with the PDF page of the archive's delivery. The same values, one per row, are in [`../data/nl183_dimensions.csv`](../data/nl183_dimensions.csv).

**Terms.** The scans are working copies for personal use (ref. AZ FII-62000-2026). No image from them may be published; information taken from them may be, with the citation above. The PDFs, page images and full transcripts are therefore kept outside the repository, and this note holds only dimensions, counts, angles and descriptions in our own words. See [docs/licensing.md](../../docs/licensing.md).

**What the drawings describe.** They are the workshop drawings for the **Dresden replica** (TU Dresden, Sektion Mathematik, workshop Göbel/Rühle, 1988–89; one parts list is dated 14.3.9[1?]). They are not measurements of the Hannover original. The replica copies the original's layout and is the machine the model's proportions were scaled from (photos of the Dresden replicas on Commons), but it was built with metric involute gears, steel frames and Lehmann's corrected carry levers. Where the replica deliberately differs from the original, this note says so.

## 1. The two files

| File | Delivered | Pages | Contents |
|---|---|---|---|
| **/465** "Konstruktionszeichnungen und Planentwürfe zum Nachbau" | PDF, 150 dpi, 2026-10-29 | 127 A4 pages (the quote said 126) | Hand-drawn part drawings with dimensions, material and quantity; gear calculations; a parts list for the result register; the lever arrangement table; "Bild 1" (three digits of the carry at large scale, 5 copies); typed operating instructions (1 page, cut off); two printed figures |
| **/466 PLAN** "Konstruktionspläne zum Nachbau" | PDF, 150 dpi, 2026-10-29 | 9 large sheets | See §9 |

Sheet index of /465, by PDF page:

| Pages | Subject |
|---|---|
| 1–2 | Parts list "Resultatwerk": counts per register place (351 pieces) |
| 3–30 | Crank, frame cladding, trim strips, carry cover, carriage layout and mounting, setting axles and finger levers, feet, fixings, bearing bar of the setting mechanism |
| 30–34 | Carry levers (Zweihörner): arrangement table, gauge chords, the two-finger part w |
| 35–39 | Setting dial, setting stop |
| 40–46 | Lead screw, its nut, thrust ring and holding plate |
| 47–53 | Front-view layout, digit window layouts, carriage cover plate |
| 54–66 | Gear calculations and gear drawings (drum, receiving gear, long gear, setting pinion and rack, large gears A/B/C) |
| 67 | Test multiplications (37037037 × 3, 6, 9, 12, 15) |
| 68–83 | Revolution counter |
| 86–93 | Adjusting jig, "Bild 1" (4 copies), profile-shift calculation for the receiving gear |
| 94–122 | Frame: lower and upper frames, side walls, carriage side walls and bars |
| 123 | Lever-ratio calculation |
| 124 | Operating instructions (typed; the copy breaks off) |
| 126 | Printed figure: Burkhardt's lever arrangement |
| 127 | Printed carry-chain schematic, page "8", by Lehmann |

## 2. Layout and pitch

- **The digit pitch is 36.5 mm**, not 37. It is the only pitch anywhere in the set, and the totals add up: the carry cover is 28.5 + 15 × 36.5 + 34 = 610 mm with 16 windows (/465 p. 13); the carriage bearing bar has 8 holes at 36.5 (p. 28); the lead screw's lead is 36.5 −0.05 (p. 45, 46); the adjusting jig has holes at 18.25 and 36.5 (p. 86). Our 37 mm comes from Burkhardt's 1897 description of the original's screw; the replica's 36.5 may reflect a measurement of the original or a rounding by Burkhardt. *Das letzte Original* or the GWLB could settle which.
- **Carry parts sit on the half pitch.** Measured from the inner face of the crank-side wall, the 16 digit axes are at 28.5 + 36.5 n and the 15 pentagon (carry-store) axes at 46.75 + 36.5 n; 34 mm remain to the far wall (p. 13, 111).
- **Width between the frame's side walls: 610 mm**; lower frame 629 × 154 mm, upper frame 610 × 72 mm, side walls 10 mm steel, 157.5 mm deep and 71–74.5 mm high (p. 94–96, 100, 108). About 630 mm over the walls. 670 mm, our mechanism length from Jordan 1897, appears nowhere; the 658 mm lead screw and the crank housing come closest.
- **Carriage:** 8 setting stations, 331 mm over its side walls ("Wagenlänge 331", a chain that includes 292 = 8 × 36.5), 153 mm deep; it shifts **7 places**, with 8 conical detent holes at 36.5 mm in the lower frame (p. 48, 107, 113–124). The crank is on the left, the revolution counter on the right.

## 3. Stepped drum and input

- **Drum (part t), 8 pieces, brass:** cut as a module-2, **16-tooth** gear (tip Ø36, pitch Ø32), of which **9 teeth are kept as ribs**, 22.5° apart. Toothed length **27.2 mm**, plus a Ø14 × 5 boss, 6 mm bore (p. 55, 63, 64).
- **Rib lengths** (milling dimensions, from the common end face): 3.02, 6.04, 9.06, 12.08, 15.1, 18.12, 21.14, 24.16, 27.18 mm, i.e. **3.02 mm per digit** (p. 63).
- **Drum axle:** 187.75 mm, drum seat Ø8 × 64.55 (p. 6). The drum slides along this seat.
- **Setting train:** the dial turns a 10-tooth module-1.25 pinion (part O, pitch Ø12.5), which drives a 9-tooth rack (p. 58–60, 66). The pinion's pitch circumference is 39.25 mm and the dial has **13 divisions of 27.7°**, so one digit moves the rack and drum **39.25 / 13 = 3.02 mm**, exactly one rib step (p. 57). Digits 0–9 use 10 of the divisions; the other 110.7° is a blank sector where the finger lever meets its stop (p. 35, 38).
- **Setting dial (part n):** Ø35.5 × 1.5 brass, 4 mm numerals (p. 35); the layout sheets draw it Ø33 (p. 47, 53). Each digit shows through a small square window in the 439 × 110 × 2 mm brass carriage cover, 9.75–14.75 mm above the dial's axle (p. 52, 53).

## 4. Receiving gear and result register

- **Receiving gear (part 4, "Einaufnahmerad"), 16 pieces:** **10 teeth**, module 1.75, pointed teeth, **profile shift x = +0.674** (1.18 mm), tip Ø23.36, face width 2.5 (p. 2, 54, 56, 93).
- **Centre distance to the drum: 26.5 mm**; the profile-shift sheet checks 0.67 mm tip clearance against the drum's tip radius of 18 (p. 93; Bild 1, p. 87). The modules differ (1.75 against the drum's 2): the replica accepts a non-standard mesh at the ribs.
- Parts per register place (p. 1–2): digit wheel, its shaft, receiving gear, detent wheel, single tooth (Einzahn), spacer. Per carry unit (15): a first and a second five-horn, a detent disc, a pentagon. Detent springs and five-horn shafts alternate long and short (8 + 7), so neighbouring places sit in two staggered planes.
- No dimensioned drawing of the result digit wheel is in the set; Bild 1 draws it about Ø36.

## 5. Drive train

| Part | Teeth | Module | Tip Ø | Notes | Page |
|---|---|---|---|---|---|
| Long gear (Zahnradwalze, V) | 10 | 2 | 22.9 | 37.5 long, centre distance 18.9; 8 pieces | 54 |
| Gear S | 10 | 2 | 22.9 | 9 pieces | 54, 65 |
| Gear 5 | 10 | 1 | 12 | 16 pieces | 55 |
| Large gears A, B, C | 61 | 1.5 | 94.5 | 5 mm brass, three spokes; at the crank end | 58, 61, 62 |

Every small gear in the set has 10 teeth. The set does not say how the 17 wheels Burkhardt counted map onto these parts.

## 6. Carry levers (Zweihörner)

- **Part w, 8 pieces:** 5 mm steel, hub Ø14, finger tips at **radius 14.65**, the V between the fingers cut with a 65° cutter (p. 34).
- **Pivot:** 18.25 mm across (half a pitch) and 21.6 mm below the result-wheel axis, then 4.9 mm above the drum axis (Bild 1, p. 87, 120).
- **Arrangement table, "machine seen from the front", places ⑧ to ①:** **135°, 102°, 69°, 39°, 36°, 69°, 102°, 132°** (place ① also 131°), "set straight at the machine's zero position"; ① and ② are turned slightly inward (p. 31). Seen from the front the units are on the right, so ① is presumably the units lever and ⑧ the highest. This fixes which spread belongs to which lever, the assumption REPORT.md §3 and decision 0001 left open; the absolute phase of each lever is still not given.
- **Lever ratio:** 14.65 : 8 = 1 : 1.83, so 9° in gives 4.9° out and 18° gives 9.8°; 8.7° is accepted as "a good compromise" (p. 123).
- **Burkhardt's arrangement**, for comparison: a printed figure shows all eight levers at ≈80° spread, each turned 22.5° (1/16 turn) from the next (p. 126). This is the as-found state Lehmann corrected.

## 7. Revolution counter

A single-lobe cam (tip radius 15.4) steps a Ø50 driver disc with 12 slots (part 16); a 12-tooth module-3 gear (19c) turns a 10-tooth module-3 gear (19a/b), so each crank turn moves the counter one digit. Digit disc part 23: Ø47 × 4 brass, 4 mm numerals on radius 18.75. The carriage cover's dial opening is Ø68 with numerals on radius 37.5 at 36° (p. 52, 53, 69–81).

## 8. Operation (typed instructions, p. 124)

- Four operations; **16-digit** result register; **8-digit** setting mechanism, shiftable by **7 places**.
- The carry is driven from the setting mechanism, so it **propagates only up to the result digit just beyond the carriage**. This is what the model already does (plan §10, M2 design decisions).
- The **foremost result digit is reached only by a carry and serves as a sign place: 0 = positive, 9 = …** (the copy breaks off).

## 9. NL 183/466 PLAN

Nine large sheets: schematics and construction drawings by Lehmann, and Werner Lange's 1958 view of the original. Values marked *scaled* are not written on the sheet but measured from the scan (about ±2° or ±1 mm), so they are weaker evidence than written dimensions.

| Page | Contents |
|---|---|
| 1–3 | Isometric schematic of the carry chain for three digits (p. 2 lettered; p. 3 is p. 1 upside down) |
| 4–5 | "Summenrad 1–4" with the levers A1…A4 ("Bild 5") and the eight levers A1…A8 ("Bild 6"), printed and as a pencil working copy |
| 6 | "Bild 1" at 5:1, the same figure as /465 p. 87–90 and 120, with the /465 part numbers added in red |
| 7 | Muldenrad (five-horn) tooth construction on graph paper, about 20:1 |
| 8 | Two cut-out templates at the same scale (18°, 1.55) |
| 9 | Werner Lange, "Die Leibniz'sche Rechenmaschine gezeichnet nach dem Original in der Landesbibliothek Hannover", March 1958: a pictorial exploded view of the original, with Lehmann's pencil notes |

- **Carry chain** (p. 2): the crank drives Z1, and the gear row alternates drum gears and lever gears: Z1 (drum 1), Z2 (lever H1), Z3 (drum 2), Z4 (lever H2), … For each digit: star S → single tooth E → five-horn Ü, which shares its shaft with the five-horn AÜ; lever H strikes AÜ; Ü drives the intermediate wheel ZW of the next digit, which turns that digit's star S. This is Ludwig's Bild 2 with the same letters, and it matches our drive chain (`pars_mobilis.drive_chain`).
- **Bild 1** (p. 6): written dimensions 36.5 and 18.25; the result axis 26.5 mm directly above the drum axis; the lever hub 18.25 across and 4.9 above the drum axis, 21.6 below the result axis. The carry wheel sits halfway between two result axes, level with them. The pentagon (part 8) is a regular pentagon on the carry-wheel axis, about 20 mm circumradius (*scaled*).
- **Lever stagger** (p. 4–5): no angle is written. *Scaled*, Bild 5's levers A1–A4 stand at about 77°, 102°, 124°, 148° (≈ 23–24° per digit); Bild 6's eight levers have horns about 160/130/102/73 | 74/101/128/156° apart. Only 102° coincides with the /465 table; the figure may measure a different angle. Treat it as an illustration, not data.
- **Muldenrad** (p. 7): five horns at 72°, centre about 18.2 from the 10-tooth wheel's centre (the half pitch), radius 12.5, flattened horn tips 2 × 2.01. A note on the single tooth: "überlappt um 0,1, Abstand 0,05" (overlaps by 0.1 mm, clearance 0.05 mm).
- **Lange 1958** (p. 9): 16 result discs and 15 pentagon plates in two staggered rows; the carriage with 8 rack slides; three spoked gears A, B, C at the crank end, a pencil centre distance B–C of 91.38 mm (pitch Ø91.5 of z 61, m 1.5, so Lehmann's large gears follow the original's spacing). Pencil counts next to the gears (65, 63, 60) look like counts of Lange's drawn teeth, not tooth numbers.

## 10. What this means for the model

| Parameter (`params/machine.json`) | Now | From NL 183 | |
|---|---|---|---|
| `layout.digit_pitch`, `frame.lead_screw_pitch` | 37, doc (Burkhardt, original) | **36.5** (replica) | Decide which machine the pitch follows; also `DIGIT_PITCH` in `js/sim/machine.js` |
| `geometry.drum.module`, `virtual_teeth` | 1.875 design, 16 doc | **2**, 16 | |
| `pars_mobilis.drum.outer_diameter`, `core_diameter` | 33, 28 est | **36**, ≈27.3 (root of m 2, z 16) | |
| `drum.length`, `rib_length_step` | 40 est, 4.0 design | **27.2** toothed (+5 boss), **3.02** | |
| `receiving_gear.teeth`, `module`, `thickness` | 10 est, 1.875, 3 design | **10**, **1.75** with x = +0.674, **2.5** | |
| drum ↔ receiving gear centre distance | 24.4 (derived) | **26.5** | |
| `m1.lever_axis_dx`, `lever_axis_z` | −18.5, 44 (drum axis 40) design | **−18.25**, drum axis + **4.9** | |
| `m1.zweihorn_pin_path_radius` | 17 design | **14.65** | |
| `zweihorn.spread_dresden` order | doc, "mapping not given" | **⑧…① as in §6** (① presumably the units) | Our list already runs ⑧…① |
| `setting.pinion_module`, `pinion_teeth` | 1.2732, 10 design | **1.25**, 10; 13-division dial | Our dial uses 10 divisions of 36° |
| `setting_dial.diameter` | 29 est | **35.5** (33 on layouts) | |
| `result_disc_diameter` | 30 est | ≈36 (Bild 1, undimensioned) | Still an estimate |
| `revolution_counter_dial.diameter` | 68 est | **68** opening | Confirmed |
| `pars_immobilis.carry_stores` | 15 design | **15** | Confirmed |
| `receiving_gear_teeth` | 10 est | **10** | Confirmed |

Not in /465: the Fünfhorn, Muldenrad and Einzahn shapes (drawn only in Bild 1, undimensioned), the result digit wheel, the Magna Rota, and the full drive-chain layout. /467 (Lehmann's calculations, 184 scans) may hold them.
