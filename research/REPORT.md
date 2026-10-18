# Can we build an accurate, animated 3D Leibniz stepped reckoner for teaching?

**Feasibility report** · research only, no modelling or code · 2026-10-17
Supporting material is in this folder: [sources/](sources/), [data/](data/), [images/](images/).

---

## 1. Bottom line

**Yes. I can build it, with confidence that depends on which "accuracy" you need.**

| Target | What it means | Confidence with the data collected now | Confidence after getting the drawing sets (§6) |
|---|---|---|---|
| **A. Didactic functional emulator** | All visible parts and all key internal mechanisms are present and move correctly. The arithmetic is exactly right, including the two-phase carry. Proportions match the original to within a few percent. | **High (≈85–90 %)** | Very high |
| **B. Kinematically faithful mechanism** | Same as A, plus the real timing: the 22.5° rib pitch, the rib-free carry sector, 18° carry storage, staggered Zweihorn levers, the 37 mm carriage step, and the detents. Gear meshes look right. | **Medium-high (≈70 %)**. The angles are documented, but most absolute part sizes have to be estimated from photos. | High |
| **C. Dimensionally exact digital replica** | Every part at measured millimetre dimensions and tooth counts of the Hannover original. | **Low (≈30 %)**. No public measured drawing set exists. | **Medium-high** if Lehmann's 125-sheet drawing set (Deutsches Museum NL 183/465) or Stein & Kopp (2010) is obtained |

**Is it worth building? Yes** (see §7, value check of 2026-10-17). There is no openly licensed, web-native, interactive model of this machine. The two existing 3D works are not usable:
- the Arithmeum animation is a view-only video;
- the GWLB/mbe CAD model was a 2011-era 3D PDF that is now offline, and only 1 of its 6 videos is still public.

The closest comparable project is a WebGL simulator of a *different* stepped-drum machine, the Curta.

**My recommendation:** build **target B** as a parametric model now. It is enough for science and CS lessons. Keep every dimension in one parameter file so the model can be upgraded towards **C** once the drawing sets arrive. Label the model as a *reconstruction following Lehmann/Dresden*, because even the physical replicas disagree on the carry details.

## 2. Why I'm confident about the parts that matter for teaching

The lessons are about **how the machine calculates**. That part is well documented.

1. **The stepped drum (the core idea).** It has 9 graduated ribs with a 22.5° pitch (1/16 turn) spanning 180°. Digit 1 gets the full rib length and digit 9 the shortest. Setting a digit shifts the drum axially, through a knob, a pinion and a rack, under a fixed receiving gear. The drum is driven through a sliding gear on a long gear. *(Burkhardt 1897; Kopp drawing in Stein 2016; Ludwig 2006.)*
2. **The two-phase carry (the CS gem: parallel add, then serial carry propagation).**
   - In phase 1, every sum wheel that passes 9→0 trips its **Einzahn**, which turns a **Fünfhorn** carry store by 18°.
   - In phase 2, **staggered Zweihorn levers** complete the stored carries in the drum's rib-free 157.5° sector, lowest digit first, so cascading carries resolve within the same crank turn.
   - All part names, the schematic and the angles are documented. *(Ludwig 2006; Stein 2016; Arithmeum; Burkhardt 1897.)*
   - A step-by-step numeric trace (448 + 254) is saved in [data/worked_examples.json](data/worked_examples.json).
3. **Operator-level controls.** These are:
   - the 8 setting dials;
   - the Magna Rota multiplier dial, with 10 holes, a pin, a stop, black digits for multiplication and red digits for division;
   - the crank, where the turning direction chooses add or subtract;
   - the side crank, which turns a 37 mm-pitch lead screw so that one turn shifts the carriage one decimal place;
   - the 16 result windows and the 1-digit revolution counter.

   Leibniz's own worked example (1709 × 365 = 623785) gives a ready-made animation script.
4. **Visual reference.** I collected:
   - 47 freely licensed images: ~38 multi-angle photos of the Dresden replica, including an underside view of drums and gears, plus a photo of the original;
   - the 1897 public-domain drawings, including Jordan's labelled 67 cm geometric drawing and the April 1892 photo;
   - Leupold's 1727 engraving.
5. **Precedent.** A Bonn/Arithmeum BSc thesis (2022) built exactly this kind of Blender model from Badur's drawings for a Leibniz carry mechanism, with involute gears, keyframe animation and didactic colour coding. The Arithmeum also has a full-machine 3D animation (Mario Wolfram), but it is view-only. **No openly downloadable 3D model or web emulator of the machine exists** (searches of Sketchfab, Thingiverse, GrabCAD, Printables, GitHub and the web), so this would be new. A proprietary CAD model does exist (GWLB/mbe, see §7), but it is not publicly available.

## 3. What is missing

| Gap | Impact | Mitigation now | Real fix |
|---|---|---|---|
| Absolute part dimensions (drum diameter and length, rib increments, gear diameters and tooth counts, shaft spacing, deck heights) | Matters for target C only | Scale from the known anchors: **67 cm** mechanism length, **27 × 17 cm** footprint/height, and **≈37 mm digit pitch** (inferred from the screw pitch). Use the 38 photos for proportions. | Lehmann drawings NL 183/465; Stein & Kopp 2010; *Das letzte Original* (2014) |
| Shapes of the Fünfhorn, Muldenrad, Zweihorn and Einzahn | Medium. They are the "stars" of the carry animation. | Kopp's isometric drawing and Ludwig's schematic give clear shapes and angles, so they can be modelled schematically and correctly. | Same drawing sets |
| Exact phase angles of each Zweihorn in the original | Low for teaching | Use Lehmann's documented Dresden values (135/102/69/39/36/69/102/132°, 16.5° per carry). The mapping of those values to lever positions needs one assumption. | Ludwig/Lehmann notes NL 183/467 |
| Drive train layout (17 crown wheels) | Low | Model as a gear chain (inferred as 2 × 8 + 1 = 17) | Drawings |
| Revolution counter internals | Low | Simple 10-position counter | Drawings |
| Tooth profiles (handmade, not involute) | Cosmetic | Use involute or stylised teeth | — |
| Disagreement over whether the original carried correctly | Conceptual | Simulate correct arithmetic, and optionally add a "Burkhardt vs. Lehmann" lesson mode | — |

## 4. Suggested design approach (for when you green-light building)

- **Parametric parts.** Generate gears, drums and star wheels from parameters (tooth count, pitch angle, radius) rather than sculpting them. That makes the move from estimated to measured dimensions a data change. glTF export suits three.js.
- **One master clock.** The main crank angle θ (0–360° per operation) drives everything:
  - drum rotation and rib engagement windows in the rib sector of each drum;
  - each Zweihorn's activation window in the free sector, staggered by digit;
  - detent snaps.

  The carriage position and the dial settings are separate discrete states.
- **Logic separate from visuals.** A small state machine holds the digits, stored carries, carriage offset and counter, and the 3D layer only reflects it. Exact arithmetic is then guaranteed even where the physical timing is idealised.
- **Teaching affordances.** Provide:
  - a transparent or cut-away casing;
  - colour coding by function, as in the Arithmeum thesis;
  - a single-digit "exploded" view of drum → receiving gear → sum wheel → Einzahn → Fünfhorn → Zweihorn;
  - slow motion around the carry phase;
  - a "parallel vs. serial carry" overlay for CS classes.
- **Assembly hierarchy.** Follow [data/component_inventory.csv](data/component_inventory.csv): 25 part types grouped into *pars immobilis* (fixed result register), *pars mobilis* (carriage: drums, dials, Magna Rota, drive) and the frame/case.

## 5. Risks and caveats

- **Licensing.** Most of the replica photos are **CC BY-SA 4.0**. Using them as reference is fine. Textures or images derived directly from them must carry attribution and share-alike. The licence for each file is recorded in [data/wikimedia_commons_catalog.json](data/wikimedia_commons_catalog.json). The Kopp, Ludwig and Arithmeum figures are copyrighted, so I summarised them and did not copy them.
- **Which machine?** The 1710 description, Leupold's engraving and Jordan's Fig. 2 show a **12-digit** result register. The surviving machine and all modern replicas have **16 digits**. Model the 16-digit surviving machine.
- **Unverified numbers.** "126 gears" (HNF blog) and the 67 × 27 × 17 cm and 97 × 30 × 25 cm sizes come from secondary sources only. The 37 mm digit pitch is my inference. All of these should be checked against the drawing sets or by scaling photos.
- **Limits of this research.** I could not open the paywalled or print-only works (Lehmann 1993, Badur 2004, Stein & Kopp 2010, *Das letzte Original*). I also could not open Stein's 2007 open-access PDF, because its repository uses a bot-protection challenge, and the LeibnizCentral page failed with a TLS certificate error. Their abstracts and secondary citations are consistent with the open sources I did read.

## 6. Recommended next steps to raise accuracy (all are things you can do and I cannot)

1. **Request copies of Lehmann's papers** from the Deutsches Museum Archive (digital@deutsches-museum.de). The metadata is CC BY-SA 4.0, and copies are available on request:
   - **NL 183/465**: construction drawings, 125 sheets;
   - **NL 183/466 PLAN**: construction plans, 10 sheets including 6 large-format plans (1958 and c. 1988);
   - **NL 183/467**: calculations, 153 sheets;
   - **NL 183/746**: photos.

   This is the highest-value item.
2. **Download Stein 2007** in a normal browser: https://leopard.tu-braunschweig.de/servlets/MCRFileNodeServlet/dbbs_derivate_00028671/Stein_Vier-Spezies-Rechenmaschine.pdf
3. **Buy *Das letzte Original*** (GWLB 2014, ISBN 978-3-943922-08-0) and get **Stein & Kopp 2010** (*Studia Leibnitiana* 42/1, 128 pp.) through a library. Stein 2007 turned out to be a 2-page abstract with no dimensions (read 2026-10-18). Stein & Kopp 2010 is the full engineering account: gear kinematics, the optimisation and the Hannover model's design changes. The shorter 2006 congress papers (STEIN-KOPP2006 in the bibliography) are a cheaper first step.
4. Optionally contact the **Arithmeum** (Prof. Ina Prinz, Mario Wolfram) or the **TU Dresden Kustodie** (Dr. Jörg Zaun) for measurements or permission to photograph the internals.

5. **Ask mbe Marc Brandt engineering (Burgdorf), with the GWLB, about their CAD model** (see §7). It is based on Badur & Rottstedt's complete reconstruction, made for the GWLB c. 2011. In 2020 mbe also helped the Leibniz Universität Hannover measure all parts of the original, for a glass model. mbe made both, so it is the most direct contact; the GWLB owns the original, and LUH commissioned the measurements. If they licence it, or just geometry or dimensions from it, under CC BY or CC BY-SA, target C would be in reach at once. It would also make the project a partnership rather than a duplicate.

   **Outcome (2026-10-19):** mbe declined. Having consulted Klaus Badur, it may not provide any data or dimensions, because the machine and all rights to it belong to the GWLB; requests have to go to the GWLB officially. Next: an official request to the GWLB (plan §12, item 3).

Once any one of items 1–3 or item 5 is in hand, target C becomes realistic.

## 7. Value check: does an equivalent already exist? (2026-10-17)

The question here is whether teachers and students already have something of similar quality. If they did, we should not build ours.

### 7.1 Existing resources for *this* machine

| Resource | What it is | Interactive? | Open licence? | Still available? | Verdict |
|---|---|---|---|---|---|
| **GWLB "Interaktives 3D-Modell"** on LeibnizCentral, funded by VGH/VGH-Stiftung, c. 2011 | Full CAD model by **mbe Marc Brandt engineering**, based on Badur & Rottstedt's complete reconstruction. Delivered as a **3D PDF (U3D), which needs Adobe Reader 9**. It came with 6 CAD-render videos: addition, subtraction, multiplication, division ×2, and carry. | Rotate and zoom only, with no operation | No | **No.** The domain `dokumente.leibnizcentral.de` now redirects to an unrelated third-party "browser verification" site (not GWLB; do not link it). The PDF is not in the Wayback Machine. **Only 1 of the 6 videos is public** ("Dividieren Teil 2", 1:40, @LeibnizBibliothek); the other 5 return HTTP 403 on YouTube oEmbed, so they are probably private or removed. | **The closest earlier effort, now effectively lost.** It shows that demand existed and that a precise CAD model exists. It is a partner lead, not a competitor (§6 step 5). |
| **Arithmeum Bonn, video 01** (Mario Wolfram, Blender) | High-quality 3D animation of the machine's mechanics | No (video) | No | Yes, on the Arithmeum site | Excellent to *watch*, but students cannot set numbers, turn the crank or isolate parts, and it cannot be reused. |
| Arithmeum video 38 / Üyümez thesis 2022 | Blender animation of the **1677 carry concept**, not the surviving machine | No | No | Yes | Complementary |
| LUH / Initiative Wissenschaft Hannover video series (A. Walsdorf); TIB AV-Portal lectures | Filmed physical demonstrator models and talks | No | No (standard copyright) | Yes | Good for context |
| Commons GIFs (Ezrdr 2010, Staecker 2023) | Single drum and counter wheel loop | No | CC BY-SA | Yes | Shows the principle only, with no carry and no full machine |
| `sadr0b0t/leibniz-wheel` (GitHub) | OpenSCAD model of a single Leibniz wheel | No | Open | Yes | A part, not a machine |
| 3D-printed drum demonstrator (Italian YouTube) | Physical drum model | No | — | Yes | Principle only |
| Valencia Museo de Informática (Scratch) | Simulator of a **Schubert** Leibniz-type calculator (a later machine) | Yes (2D) | Scratch | The site refused connection on the check date | A different machine; 2D |
| Science Museum and Computer History Museum pages | Photos and text | No | No | Yes | Context |

### 7.2 Comparable projects for *other* calculators (the quality bar)

| Project | Machine | Notes |
|---|---|---|
| **YACS 2.0** (satadorus.eu, 2026) | Curta, which also uses a stepped drum | The **closest analogue in quality**: built from measurements of a real Curta, 3D, runs in the browser via WebGL (X_ITE/VRML), and operable (setters, crank, clearing lever, carriage). No licence is stated. It shows that a web-native, operable 3D calculator is achievable and appreciated. |
| Arithmeum Curta simulator and animation | Curta | The museum pairs an operable simulator with a 3D explainer video for the Curta, but not for Leibniz. |
| e-pascaline (Maschietto & Soury-Lavergne, Cabri Elem) | Pascaline-style "Zero+1" | Research-backed **primary-school** tool for place value and carrying. Proprietary environment. |
| Würzburg University "Flash-Rechenmaschine" | Pinwheel machine | Interactive but **Flash-based, so it no longer runs**. This shows the same obsolescence risk that killed the GWLB 3D PDF. |
| Unity WebGL / EveryCalculators toys | Arithmometer, Pascaline | Low fidelity, not mechanism-level, and of unclear accuracy |

### 7.3 Evidence that teachers would use it

- **The carry is a documented teaching difficulty.** Maths-education research uses calculating machines and their mechanisation to teach "carried numbers" and place value. Examples are Poisard (MERGA 2006) and Maschietto & Soury-Lavergne (pascaline/e-pascaline), who note that many pupils and teachers do not understand the carry well mathematically. A machine that *shows* the carry being stored and then propagated speaks directly to that need.
- **CS curricula** (history of computing, algorithms) already use Leibniz. M. Fothe (Univ. Jena, 2016), *Informatik hat Geschichte*, uses the four-species machine to motivate the "gear with a variable number of teeth". Leibniz's two-phase carry (parallel digit add, then serial ripple-carry) maps directly onto adder design (ripple-carry vs. carry-save), which no existing resource exploits.
- **The originals cannot be touched.** The Hannover original is locked against any operation. The physical replicas (GWLB, Dresden, Arithmeum, HNF Paderborn, Badur/Rottstedt) are fragile and are not available for hands-on use. GWLB gave exactly this as its reason for commissioning the 2011 digital model.
- **Some demand evidence is indirect.** The one surviving GWLB CAD video has about 53 K views, a 2025 feature film showed the Dresden replica working, and the Arithmeum keeps producing Leibniz animations.

### 7.4 Verdict

**Building target B is worthwhile and not duplicative.** No existing resource combines:
1. the **real surviving machine** (8/16/1), not a generic drum or a different calculator;
2. **student operation**: set digits, insert the multiplier pin, turn the crank, shift the carriage;
3. **visible internals**, including the **two-phase carry** (Einzahn → Fünfhorn → staggered Zweihorn), with slow motion, cut-aways and exploded views;
4. **web-native delivery**, so it runs on a school Chromebook with no plugin, unlike the dead Flash and 3D-PDF predecessors;
5. an **open licence** (CC BY-SA content, Apache-2.0 code), so teachers can remix, translate and embed it, which none of the above permits.

**To maximise value, the project should:**
- **Lead with the carry**, which is the least-served and most pedagogically valuable topic. Offer a "parallel vs. ripple carry" overlay for CS classes and a "carry the 1" view for primary and lower-secondary maths.
- **Ship lesson material with the model**: guided tasks such as 9999 + 1 and 1709 × 365, teacher notes and multilingual UI text (at least EN and DE). Bare 3D models are less useful to teachers than ready-to-use lessons.
- **Avoid format death**: use plain three.js and glTF with no proprietary viewer, and include an offline build.
- **Present the history honestly**: show the reconstruction choice (Lehmann/Dresden staggering) and optionally the Burkhardt "it can't work" controversy, plus the GWLB/Badur reading that the original handles only about two carries at once and needs an extra idle crank turn (indicated by tilted pentagon discs).
- **Reach out before building** to GWLB/mbe, and optionally the Arithmeum. A co-branded or data-sharing arrangement would raise accuracy (target C) and give access to existing audiences. Our open licence is a strong offer to institutions whose own digital efforts became inaccessible.

### 7.5 Licence notes for the planned project

- **Code under Apache-2.0 and content (models, textures, docs) under CC BY-SA 4.0** is a standard and compatible split. three.js is MIT and fits under Apache-2.0.
- Replica photos on Commons are mostly **CC BY-SA 4.0**. They are fine as modelling *references*. Any texture or image derived directly from them must keep attribution and share-alike, which CC BY-SA content already does.
- **Facts and dimensions are not copyrightable, but drawings are.** Measurements from Ludwig, Stein, Kopp or Lehmann may be used. Their drawings or images must not be copied without permission. The Deutsches Museum's NL 183 records are marked CC BY-SA 4.0, but confirm that this covers the scans themselves when you request them.
- The 1897 and 1727 scans are public domain.

---

### Index of collected material

- [sources/notes-mechanism.md](sources/notes-mechanism.md): how every subsystem works, with angles and a source for each fact
- [sources/notes-history-and-reconstructions.md](sources/notes-history-and-reconstructions.md): versions, replicas, and the "did it work?" debate
- [sources/bibliography.md](sources/bibliography.md): annotated bibliography with relevance and access status
- [sources/raw-ocr/](sources/raw-ocr/): full OCR text of Jordan 1897 and Burkhardt 1897 (German, public domain)
- [data/machine_spec.json](data/machine_spec.json): parameters with confidence levels and known unknowns
- [data/component_inventory.csv](data/component_inventory.csv): part list with motion, linkages and data availability
- [data/worked_examples.json](data/worked_examples.json): animation and test scripts (1709 × 365, the 448 + 254 two-phase carry, Burkhardt's timing budget)
- [data/wikimedia_commons_catalog.json](data/wikimedia_commons_catalog.json): 50 Commons files with licence and author
- [images/](images/): 1897 drawings and photos, plus 47 Commons images. See [images/ATTRIBUTION.md](images/ATTRIBUTION.md).
