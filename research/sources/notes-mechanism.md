# How the surviving Leibniz machine works: mechanism notes for modelling

This is a synthesis of the sources listed in [bibliography.md](bibliography.md). Every fact carries a source tag (see the key at the end). Statements marked **[inference]** are my own deductions from those sources. They are not stated in any of them.

The subject is the **"younger" (jüngere) machine**: the only surviving original, built c. 1693–1716 and now at the GWLB in Hannover. Its digit configuration is **8 / 16 / 1**: 8-digit input (setting) section, 16-digit result register, and a 1-digit revolution counter. [STEIN16][ARITH][TUD]

---

## 1. The two main assemblies

| Leibniz's Latin name | German literature | English | Role |
|---|---|---|---|
| *Pars immobilis* | Resultatwerk / Rechenwerk / "Lineal" (Burkhardt) | fixed part, accumulator | 16 result digits, read through rectangular windows on top. Also holds the carry mechanism. |
| *Pars mobilis* | Einstellwerk / Eingabeschlitten | movable part, input carriage | 8 stepped drums with their setting knobs, the big multiplier dial (*Magna Rota*), and the revolution counter. Slides left and right one digit at a time. |
| *Rotae minusculae* | Einstellscheiben | small setting dials | 8 dials with pointers, used to enter the operand |
| *Magna Rota* | Multiplikationsscheibe / Kurbelscheibe | big wheel | multiplier dial with 10 holes and a stop pin, turned by the main handle |
| *Rota maiuscula* (Jordan fig. 2) | | | the larger right-hand dial of the counter / Magna Rota group |

Sources: [JORDAN1897 Fig. 2], [LEUPOLD via JORDAN1897], [BURKHARDT1897].

The 1897 geometric drawing labels these parts. It is in `images/zfv1897_p290_jordan_fig2_geometric_drawing_67cm.png`, but it shows **12** windows: it copies the *Brevis descriptio* figure, not the surviving 16-digit machine.

## 2. Stepped drum (Staffelwalze / Leibniz wheel): one per input digit, 8 total

- The drum is a cylinder with **9 ribs (teeth) of graduated length**. In Burkhardt's words, rib 1 also serves as the closing tooth for 9, and the others are stacked in steps in front of it. [BURKHARDT1897] [LUDWIG2006]
- **Rib pitch is 1/16 of a revolution, i.e. 22.5°** (Burkhardt's "Tempo"). The 9 ribs cover 9/16 of the circumference (202.5°), leaving a **rib-free sector of 7/16 (157.5°)**. The carry phase uses that free sector. [BURKHARDT1897] [LUDWIG2006] Stein instead gives "Teilungswinkel der Zähne: 22,5°, Gesamtwinkel 180°", i.e. 8 × 22.5° between the first and last rib. [STEIN16]
- **Digit 1 engages the full rib length and digit 9 the shortest.** The drum is shifted **axially** under a fixed receiving gear (*Aufnahmezahnrad*), so the number of ribs that reach that gear equals the set digit. [STEIN16 (Kopp drawing)] [LUDWIG2006 Bild 1]
- **Input path** (from F.-O. Kopp's colour isometric drawing in [STEIN16]): **setting knob** (*Stellgriff*, on a horizontal digit disc 0–9) → pinion → **slider with rack** (*Schieber mit Zahnstange*) → shifts the stepped drum axially. **Drive path:** **long gear** (*Langes Zahnrad*) → **sliding gear** (*Verschiebezahnrad*), which rides along the long gear so the drum stays driven at any axial position → stepped drum → receiving gear → result display.
- Burkhardt found the setting pinions (*Stelltriebe*) only press-fitted and apparently never used, so he trimmed some by up to 2.5 mm. He also found the drive cylinders and drums "too short": at a full 9→0 shift the driving gears came out of mesh. [BURKHARDT1897]
- **Burkhardt's 1896 restoration** added round rings and small set-screws to fix the drums to their square shafts. [BURKHARDT1897]

## 3. Drive train (main crank → drums and carry levers)

- One full turn of the main handle (on the *Magna Rota*) performs one addition or subtraction. **The turning direction selects the operation**: one direction adds and the other subtracts. [WIKI][ARITH][LEIBNIZCENTRAL]
- Burkhardt: the drive consists of **17 crown wheels** (*Kronräder*). He replaced all of them with new steel wheels, fitted tooth by tooth, to get a "tolerable" motion. [BURKHARDT1897]
- Ludwig's kinematic schematic (Bild 2) shows a **row of meshing gears Z1, Z2, Z3, …** driven by crank K. Every second gear carries a carry lever **H_i**, and the others drive the drums. **[inference]** With 8 digits this gives 2 × 8 + 1 = 17 gears, which matches Burkhardt's count. So the drive train is most likely one idler chain along the carriage, alternating drum-drive and carry-lever gears.
- Burkhardt says the slightly scraping motion came from the decorated drive disc rubbing on the cover box, not from the drive itself. [BURKHARDT1897]

## 4. Result register (Pars immobilis / "Lineal"): 16 digits

- Each digit has a **sum wheel** (*Summenrad / Zählrad*) with 10 positions, so **36° per unit**. [LUDWIG2006][STEIN16]
- Results are read on **vertical result discs**, i.e. digit cylinders on horizontal axes, through rectangular windows. Jordan stresses that the windows are rectangles over discs on horizontal axes, not sector-shaped. Stein describes "horizontal input discs and vertical result discs". [JORDAN1897][STEIN16]
- **Detent:** holding springs (*Haltefederchen*) and detent-notch wheels (*Rastkerbenräder*) hold every digit. [BURKHARDT1897][STEIN16]
- Burkhardt calls the "Lineal" the best-made part of the machine. In 1894 the digit disc at **position 15** was missing because its drive gear sat half a tooth out of phase, and he fitted a blank disc. [BURKHARDT1897]
- Burkhardt also found an elaborate closure: the drive wheel had to be removed from the cover box before the works could be reached. [BURKHARDT1897]

## 5. Carry mechanism (Zehnerübertrag): the hard part

### Two-phase principle (Leibniz's solution)

1. **Phase 1 (parallel digit addition).** As the crank turns, all drums add their digits at once. Every sum wheel that passes 9→0 trips a **single tooth** (*Einzahn*, EZ) fixed to it. That tooth turns the digit's **carry store** by **18°** (half a 36° pitch). [LUDWIG2006][STEIN16]
2. **Phase 2 (serial carry execution).** While the drums are in their rib-free sector, the **carry levers H_i / "Zweihörner"** (two-horned levers, ZH) act **one after another, starting at the lowest digit**. Each one completes a stored carry by advancing the next sum wheel one unit. A secondary carry created this way (…999 + 1) is picked up by the next, later-acting lever in the same crank turn. [LUDWIG2006][ARITH][STEIN16]

The Arithmeum adds that a carry is executed only after the drums have disengaged, so no carry is lost. [ARITH]

### Named parts (Stein/Kopp labels, with Ludwig's labels in brackets)

| Part (German) | Abbrev. | Ludwig | Function |
|---|---|---|---|
| Zählrad | ZR | S_i | result counting wheel, 10 positions |
| Einzahn | EZ | E_i | single tooth on the result wheel's shaft, trips at 9→0 |
| Muldenrad | MR | (part of Ü_i) | trough-wheel with concave flanks, the carry store's driven wheel |
| Fünfhorn | FH | Ü_i | five-horned star, the carry storage element. Rotates 18° to *store* and completes 72° (360°/5) per carry. |
| Zweihorn | ZH | H_i on AÜ_i | two-horned drive lever. One horn acts for addition and the other for subtraction (90° apart per the Arithmeum). |
| Antrieb Übertrag | — | AÜ_i | carry drive, offset 18° against Ü_i |
| Zwischenrad | — | ZW_i | intermediate star wheel that transfers the carry into S_(i+1) |
| Pentagon-Scheibe | — | — | pentagonal disc on the carry shaft at the back. **It shows an incomplete carry** (an edge sticks up), and it is used for **zeroing**: press a straight edge onto all pentagons. |
| Rastkranz / Rastkerbenrad | RKR | — | detent/notch wheel with an 18° pitch plus springs |

Sources: [STEIN16 slide p.43 Kopp drawing], [LUDWIG2006], [BURKHARDT1897], [ARITH], [MYTIME].

### Key angles (needed for animation timing)

| Quantity | Value | Source |
|---|---|---|
| Rib pitch of the drum | 22.5° (1/16 rev) | BURKHARDT1897, LUDWIG2006 |
| Rib-free sector available for carries | 157.5° (7/16 rev) | LUDWIG2006 |
| Sum-wheel step | 36° per digit | LUDWIG2006, STEIN16 |
| Carry storage rotation of the Muldenrad/Fünfhorn when the Einzahn trips | 18° (Hannover model: 14°) | STEIN16, LUDWIG2006 |
| Offset angle Muldenrad ↔ Fünfhorn | 18° | STEIN16 |
| Fünfhorn pitch | 72° | BURKHARDT1897 |
| Sum-wheel rotation actually achieved by the carry in Leibniz's geometry | 21.5° (target 36°). The Hannover model reaches 31.55°. | STEIN16 |
| Crank angle a carry actually needs in the original (with detent springs) | ≈10° | LUDWIG2006 (Lehmann's measurement) |
| Crank angle per carry in the Dresden replica | 16.5° | LUDWIG2006 |
| Zweihorn spread angle in Burkhardt's restoration | ≈80°, the same on every digit | LUDWIG2006 |
| Zweihorn spread angles in the Dresden replica, Bild 3 (8 levers) | 135°, 102°, 69°, 39° / 36°, 69°, 102°, 132° | LUDWIG2006 |
| Gap between H4 and H5 in the Dresden replica (lets the carriage return to rest) | 36°. H5's spread is +3° versus H4. | LUDWIG2006 |
| Hannover model optimisation | Zweihorn spread Δφ = 31.5°, rib pitch reduced to 21°, and an extra 87° of crank travel to finish carries | STEIN16 |

### The GWLB/Badur reading of the original's carry capacity

According to the archived LeibnizCentral page (based on the Badur/Rottstedt reconstruction), the machine executes **at most two carries at once**. For 9999 + 1, one crank turn leaves the intermediate result **9900** with tilted pentagon discs. The operator then sets the input to 0 and turns the crank again (twice in that example) until all pentagon discs stand straight and the result reads 10000. This is a third interpretation, alongside Lehmann's (fully automatic after re-staggering) and Stein's (finish carries by turning the crank further while idle). [LEIBNIZCENTRAL]

### Burkhardt's (1897) "it never worked" argument, for the history lesson

Burkhardt assumed every carry needs one full rib pitch (22.5°). His budget: 3 tempi dead travel + 9 for digits + 2 run-out = 14 × 22.5° = 315°, which leaves 45° (2 tempi) for 7 carries. A single 9+1 carry would need 315° + 57.5° = 372.5° > 360°, so he concluded the machine "can never have worked". [BURKHARDT1897] Lehmann later showed that the two phases are independent and that a carry needs only about 10° thanks to detent springs. [LUDWIG2006][LEHMANN1993]

## 6. Carriage shift (Schlittenverschiebung)

- The **crank at the left end** (K in Jordan's fig. 2) turns a **lead screw with a 37 mm pitch**. One turn moves the input carriage by exactly **one decimal place**. A spring-loaded catch (*Einfallfeder*) holds the carriage in each position. [BURKHARDT1897][WIKI]
- **[inference]** So the **digit pitch (centre-to-centre spacing of digits) is ≈37 mm**. That fits the 67 cm length: 16 result digits × 37 mm ≈ 592 mm, plus the end frames. Check this against photos or drawings before relying on it. **Checked 2026-10-29:** Lehmann's drawings of the Dresden replica use **36.5 mm** throughout, lead screw included (Deutsches Museum München, NL 183/465 p. 13, 28, 45; [notes-nl183.md](notes-nl183.md)); the model follows them since M4.
- Leupold's 1727 engraving shows the motion crank on the right, while the 1892 photo shows it on the left. Jordan speculated that this reflects two different machines. [JORDAN1897]

## 7. Multiplier dial (Magna Rota) and revolution counter

- The big dial has **concentric rings**: the outer ring has digits 0–9 for multiplication, the inner movable ring has **10 holes**, and a third ring has digits (red) used for **division** (subtraction). [LEUPOLD via JORDAN1897][WIKI]
- **To operate:** put a stylus or pin into the hole for the multiplier digit, then turn the handle until the pin hits the **fixed stop between 0 and 9**. The machine adds (or subtracts) the set number that many times. [LEUPOLD via JORDAN1897][WIKI]
- In division, the quotient digit is read on the ring opposite the inserted pin. [LEUPOLD via JORDAN1897]
- There is a **1-digit revolution counter** (*Umdrehungszählwerk*). [STEIN16][ARITH][TUD]

## 8. Operating procedures (for animation scripts)

Brevis descriptio example, as quoted by Leupold 1727 and Jordan 1897: **1709 × 365 = 623785**.

1. Clear everything: result windows 0, Magna Rota pointer at 0.
2. Set **1709** on the 4 rightmost small dials (*rotae minusculae*).
3. Align the carriage so the units drum is under the units window.
4. Pin in hole **5** and turn until the stop. The result shows **8545**.
5. Shift the carriage **one place left**. Pin in **6** and turn. The result shows **111085**.
6. Shift one more place. Pin in **3** and turn. The result shows **623785**.

Division runs the reverse. The dividend goes into the result register and the divisor into the dials. The carriage starts at the left, the operator subtracts repeatedly and shifts right, and any remainder is left in the result windows. [LEUPOLD via JORDAN1897][WIKI]

Two-phase carry example from [LUDWIG2006]: **448 + 254**. Phase 1 gives the column values 0 | 6 | 9 | 12. Phase 2 resolves them step by step to 0 | 6 | 10 | 2 and then 0 | 7 | 0 | 2 = **702**. The full step table is in `../data/worked_examples.json`.

## 9. Physical data

| Item | Value | Source |
|---|---|---|
| Mechanism length | 67 cm (Jordan corrects the earlier "100 cm" and "1 m") | JORDAN1897 |
| Mechanism L × W × H | 67 × 27 × 17 cm | SOLCOVA, MYTIME |
| Oak case | 97 × 30 × 25 cm | SOLCOVA, MYTIME |
| Weight of the original | 14 kg | HANNOVER.DE, HNF blog |
| Materials | polished brass and steel, oak case | WIKI |
| Arithmeum replica (2008) H × W × D | 14 × 90 × 30 cm, 23 kg | ARITH-REPLICA |
| Science Museum 1937 working model (scaled) | 190 × 217 × 440 mm | SMG |

---

**Source key:** BURKHARDT1897, JORDAN1897, LEUPOLD (1727, via Jordan), LUDWIG2006, LEHMANN1993, STEIN16 (Stein 2016 slide excerpt with Kopp drawings), ARITH (Arithmeum exhibit text), ARITH-REPLICA, TUD (TU Dresden replica page), WIKI (en.wikipedia Stepped reckoner), MYTIME (my-time-machines.net), SOLCOVA (CTU Prague slides), SMG (Science Museum Group), LEIBNIZCENTRAL. Full citations are in [bibliography.md](bibliography.md).
