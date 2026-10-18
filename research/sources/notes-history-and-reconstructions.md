# History, versions, replicas and the "did it work?" debate

Tags refer to [bibliography.md](bibliography.md).

## Timeline of Leibniz's machines

| Date | Event | Source |
|---|---|---|
| 1670 | Concept notes "Instrumentum Arithmeticum" and "Lebendige Rechenbank" name the 5 needed elements: digit wheels, a setting mechanism, a result mechanism, a place-shift, and a revolution counter. | UEYUEMEZ2022 (citing Lehmann 1993) |
| 1672 (Paris) | Wooden model, already with a setting mechanism | UEYUEMEZ2022 |
| 1 Feb 1673 | Wooden model shown to the Royal Society, London. Robert Hooke is critical. | WIKI, UEYUEMEZ2022 |
| 1673–1674 | Brass machine by the Paris clockmaker Olivier, 4-digit input. Shown to the Académie on 9 Jan 1675. | UEYUEMEZ2022 |
| 1677 | Third machine ordered from Olivier: first 7 digits, later 8 input / 12 result. Finished 1694 (the "older" machine, now lost). 1677 *Mémoire pour M. Olivier* proposes an alternative carry. | UEYUEMEZ2022, JORDAN1897 |
| c. 1693–1716 | **"Younger" machine (surviving): 8/16/1 digits.** Begun c. 1693, finished 1698, corrected until 1716 (Stein). Other dates given: 1690–1720 (WIKI) and 1700–1716 (Ludwig, TUD). | STEIN16, WIKI, LUDWIG2006 |
| 1710 | *Brevis descriptio machinae arithmeticae* printed in *Miscellanea Berolinensia* | LEIBNIZ1710 |
| 1727 | Leupold's *Theatrum arithmetico-geometricum* publishes the engraving (Tab. VIII) | LEUPOLD1727 |
| 1764/1775 | Machine sent to Göttingen for repair and forgotten | WIKI, LUDWIG2006 |
| 1876/1879 | Rediscovered in an attic or model room at Göttingen University | WIKI, LUDWIG2006, MORAR2015 |
| 1880 | Returned to Hannover | WIKI |
| 1894–1896 | **Arthur Burkhardt (Glashütte) disassembles, cleans and restores it.** He replaces the steel crown wheels and declares that it "can never have worked". | BURKHARDT1897 |
| since 1896 | Kept at the Königliche Bibliothek, later the NLB and now the GWLB Hannover. Not in working order today (Badur 2008). | — |

## Replicas (important for modelling, since replica photos and drawings fill the gaps)

| Replica | Builder / year | Location | Notes |
|---|---|---|---|
| 4 replicas | Dr. F. Trinks (Brunsviga), c. 1923–24 | Braunschweig (Landesmuseum), Deutsches Museum Munich, … | Still had multi-place carry problems. The Braunschweig and Munich examples differ in detail, though the differences don't affect function. | LUDWIG2006 |
| Dresden #1 | N. J. Lehmann; built by M. Göbel and K. Rühle, TU Dresden workshop, 1988/90 | BBAW Berlin | **True to scale**, measured from the Trinks replica (partially disassembled) plus the Paland drawings (Braunschweig) and Munich data. Lehmann re-staggered the Zweihorn spread angles, and it works fully. | LUDWIG2006 |
| Dresden #2 | same, 1992 | Deutsches Technikmuseum Berlin | | LUDWIG2006 |
| Dresden #3 | same, 2001 | TU Dresden collection, on loan to Technische Sammlungen Dresden | Photographed extensively on Commons (CC BY-SA). Appears in a 2025 feature film. | LUDWIG2006, TUD, COMMONS |
| Hannover model | F. O. Kopp, J. Anton, E. Stein (LUH Inst. für Dynamik und Schwingungen), DFG project 2003/05 | Leibniz Univ. Hannover | **6/12/1 digits, 2:1 scale ("doubled drum spacing")**, "Pareto-optimised" carry. There are also 8:1 acrylic models of the drum and carry. | STEIN16, STEIN2007 |
| Badur/Rottstedt | K. Badur and W. Rottstedt, 2003–2005 | private (Garbsen/Hannover) | "Faithful" replicas, two of them. They work with correct manufacture and operation. Technical drawings exist. | BADUR2004, UEYUEMEZ2022 |
| Arithmeum | U. Wolff and I. Laubach, 2008 | Arithmeum Bonn | 8/1/16; 14 × 90 × 30 cm; 23 kg | ARITH-REPLICA |
| Science Museum | 1937 | London | Scaled working model, 190 × 217 × 440 mm | SMG |

## Did the original work? (useful as a lesson "plot twist")

- **Burkhardt (1897): no.** He assumed every carry needs a full 22.5° rib pitch, which does not fit into one crank turn (see the timing budget in notes-mechanism.md §5).
- **v. Mackensen (1969):** agrees with Burkhardt.
- **Wilberg (1977):** Leibniz may have meant secondary carries to be finished by hand, with the pentagon discs as indicators.
- **Lehmann (1993) and the Dresden replicas:** yes, in principle. The two addition phases are independent, a carry needs only about 10° thanks to detent springs, and re-staggering the Zweihorn angles makes it fully automatic.
- **Badur & Rottstedt (2004/05): yes.** A faithful replica computes correctly when built and operated correctly.
- **Stein & Kopp (2010/2016): partly.** Carries can be incomplete because all digits transfer simultaneously, which can be fixed by turning the crank further while idle. The Hannover model optimises the angles.
- **Morar (2015):** historiographic critique. Each replica is an interpretation, and the original's internal structure was never fully known.

## Which source is closest to the original? (from MORAR2015 and STEIN2007, read 2026-10-18)

None of the sources is "the original machine as Leibniz left it". Each is a different layer:

| Source | What it records | Caveat |
|---|---|---|
| The surviving machine today (and the 2020 measurements of all its parts, MBe/LUH) | the machine **after Burkhardt's restoration** (1890s) | Burkhardt changed it: gears that had only been cast and never fitted were **ground down by 2.5 mm**; axles were straightened; he added rings fixed to the axles with small screws; the bent frame was hammered, drilled, re-closed and re-drilled. |
| Badur & Rottstedt replica (2003–05), and the c. 2011 MBe CAD model based on it | the Hannover artefact's **"original dimensions"**, made with modern alloys and 1/100 mm precision | the closest to the original's geometry, but built with a precision the 17th century did not have |
| Lehmann's Dresden replicas (1988–2001), and NL 183 at the Deutsches Museum | a **working design** | Badur criticised Lehmann for changing **dimensions and even individual components** to make it work. Matches our working mechanism, not the original's measurements. |
| Hannover model (Stein, Kopp, 2004–05) | a 2:1, 6/12/1 working model with **two small design changes**; complete carries need 87° more crank | an optimised, scaled design |

**For M4:** a value from Lehmann's drawings is "how a working replica did it". A value from the CAD model or the 2020 measurements is "what the Hannover object measures today", including Burkhardt's changes. Record which kind each `doc` value is, not just `doc`.

**On the carry in the original:** Stein (2007) says that with certain digit patterns the original does not complete carries **from the 5th result place from the right on**. Leibniz added a pentagon to each carry to show whether it was completed (Morar, citing AA I 17, 105), and some read this as an invitation to finish carries by hand. Both support showing deferred carries (our `historical` mode, decision 0001).

**Implication for the emulator:** the 3D model should follow one documented interpretation, ideally the true-scale Lehmann/Dresden one. Its documentation should say plainly that it is a reconstruction. The carry logic can be simulated exactly (in software) even where the physical angle tuning is disputed.
