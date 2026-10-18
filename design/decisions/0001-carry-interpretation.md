# 0001: Which carry behaviour does the simulator show?

- **Status:** accepted 2026-10-17 by the project owner: `ripple` is the default mode, `historical` is the second mode
- **Date:** 2026-10-17
- **Context documents:** `research/sources/notes-mechanism.md` §5, `research/sources/notes-history-and-reconstructions.md`

## The problem in one paragraph

Every source agrees on the *principle* of Leibniz's carry. In phase 1, while the drum ribs turn the result wheels, every wheel that passes 9→0 trips its **Einzahn**, which *stores* a carry by turning a **Fünfhorn** 18°. In phase 2, during the rib-free part of the crank turn, a **Zweihorn** lever for each digit *executes* the stored carry by advancing the next wheel one step. If that step turns a 9 into 0, it creates a new (secondary) carry, which must be executed by the *next* Zweihorn. **Whether a chain of secondary carries (as in 9999 + 1) finishes inside one crank turn depends only on the timing**: does lever i+1 act *after* lever i has finished? That timing is set by the angular position of each Zweihorn horn. The experts who built working machines disagree about the original timing, and the public sources do not give the numbers needed to settle it.

## The four documented interpretations

| # | Who | Claim about the carry | Evidence |
|---|---|---|---|
| I1 | **Burkhardt 1897** (restorer) | The machine "can never have worked": each carry needs a full 22.5° rib pitch, and 8 carries do not fit into one turn. | Timing budget only. **Refuted:** carries need about 10°, not 22.5° (Lehmann). |
| I2 | **Lehmann / TU Dresden** (1993; replicas 1990, 1992, 2001) | The two phases are independent and the original geometry *almost* allows full automation. After **re-staggering the Zweihorn spread angles** (135/102/69/39/36/69/102/132°), up to 8 carries ripple through in **one turn**. | Three true-to-scale replicas, all working. Measurements of the Braunschweig replica and comparisons with the original. Construction drawings and calculations survive in the **Deutsches Museum archive (NL 183/465, /467)**. |
| I3 | **Badur & Rottstedt / GWLB** (2004–05; GWLB CAD model 2011) | A faithful replica "does calculate correctly" **if operated correctly**. GWLB: "only two carries can be executed at once", i.e. secondary carries do not ripple through in the same turn. Unfinished carries show as **tilted pentagon discs**, and the operator sets the input to 0 and turns the crank again until all pentagons stand straight. (Example: 9999 + 1 shows 9900 after the first turn.) | A faithful replica plus a full CAD model (mbe Marc Brandt engineering). GWLB explanatory videos. This is close to Wilberg's (1977) "manual completion" reading. |
| I4 | **Stein & Kopp / Leibniz Univ. Hannover** (2004–2016) | Carries can be incomplete because all digits transfer simultaneously. They can be finished by **turning the crank a further 87° while idle**. Their 2:1 model uses "Pareto-optimised" angles. | Large-scale working model; Studia Leibnitiana 2010 (128 pp). |

I2, I3 and I4 all describe **working machines**. They differ in *how much carrying happens automatically per turn*, which reflects the lever timing each team chose or found.

## Why accuracy here depends on the Deutsches Museum drawings

The simulator's behaviour comes from a **timing table**: the crank angle at which each drum rib and each Zweihorn horn acts (`params/machine.json → timing`). The public sources give *constraints* on that table but not the table itself.

1. **Ludwig gives spread angles, not phases.** A Zweihorn has two horns, one for addition and one for subtraction. Ludwig's eight numbers are the *angle between the two horns* of each lever. What we need is each horn's *absolute* angle relative to the drum ribs, and which number belongs to which digit. That mapping is not published.
2. **The published numbers don't add up under the simplest assumption.** With the drums turning 1:1 with the crank and the rest position symmetric for both directions, the free arc after the ribs is (360 − 202.5) / 2 = **78.75°**. Eight carries at Dresden's **16.5°** each would need **132°**. So some fact is missing: the gear ratio of the lever chain, a different rest position, or carry windows that overlap. **Lehmann's calculations (NL 183/467, 153 sheets) and drawings (NL 183/465, 125 sheets)** contain exactly this.
3. **Reproducing the original's own behaviour (I3) needs the original's geometry.** To make "about 2 carries per turn" *emerge* from the geometry, rather than scripting it, we need the original's horn angles (Burkhardt only says "about 80°, the same everywhere"). Lehmann recorded measurements from Hannover and Braunschweig (NL 183/460) and photographed the originals (NL 183/746). The GWLB/mbe CAD model would also contain them.
4. **The part shapes.** Kopp's drawings show the Zweihorn, Fünfhorn and Muldenrad clearly, but they are copyrighted, so we may not trace them. The archive drawings, if delivered with a CC BY-SA licence, can be used directly.

**What does *not* depend on the drawings:**
- correct arithmetic (handled by the simulation logic);
- the two-phase principle;
- the choice of which interpretation to *teach*;
- a plausible, self-consistent timing table (target B).

The drawings upgrade our *design* timing to *documented* timing, which is the step from target B to C.

## Decision

1. **Implement the carry as a policy in the simulation logic** (`web/src/sim/`), with two modes and the same 3D parts:
   - **`ripple`** (default, after Lehmann, I2): all stored carries inside the carriage window are executed in order from the lowest digit within one turn. Best for teaching, because it *is* a **ripple-carry adder**.
   - **`historical`** (after GWLB/Badur, I3): carries stored by the ribs (phase 1) are executed in this turn's carry window. A **secondary carry created during the carry window stays stored** (its pentagon tilts) until a later turn, which the learner makes with the input set to 0. This reproduces GWLB's worked example: 9999 + 1 shows **9900** after the first turn. It is a sim parameter, `cascade_per_turn` (0 = this behaviour, ∞ = `ripple`), because GWLB's text ("only two carries at once") is too loose to fix the exact number. Also valuable, because it is a **deferred carry / carry-save** scheme with a visible "carry pending" flag and a human in the loop.

   I4 (an extra idle crank angle) and I1 (Burkhardt's error) appear as history notes in the lesson material, not as modes.
2. **The 3D model differs between modes only in the per-digit Zweihorn phase offsets** (parameters), so supporting both costs almost nothing in modelling.
3. **Use our own design timing now** (`params/machine.json → timing`: ribs at 78.75–281.25°, carries in the 78.75° arc after them, about 9.8° each, staggered from units upward). Replace it with Lehmann's documented values when NL 183 arrives.
4. **Do not block on the archive.** M0 and M1 (single digit, then a 3-digit carry slice) proceed now. Request NL 183/460, /465, /467 and /746 immediately. Re-evaluate before M2 (full machine) whether they have arrived.

## Open question to check while modelling

**Carries beyond the carriage window.** The carriage carries only 8 Zweihörner. When a carry has to propagate *above* the highest drum position (for example a result digit at place 12 while the carriage sits at offset 0), probably no lever is there to execute it, so the pentagon disc would stay tilted until the carriage is shifted. Sources hint at this ("Additionswerk für 8 Stellen", Ludwig) but do not state it. The simulation should model it explicitly, and the archive drawings should confirm it.

*Modelled in M2:* the carry waits, pentagon tilted. A turn that would store a second carry in that store is refused until the carriage is shifted (a store holds one carry; see m2-notes). Both behaviours follow from putting the 8 Zweihörner on the carriage. They are still unconfirmed for the original.

## Addendum (M1, 2026-10-17): how the two modes are realised

Both modes use **the same geometry**. Only the Zweihorn phases differ: the stagger of the levers, and therefore each Zweihorn's spread angle.
- **`ripple`**: levers act units first (292, 300.5, 309°, …). A secondary carry is stored 3.4° before the next lever arrives.
- **`historical`**: levers act highest digit first. A secondary carry arrives after its lever has passed and waits, pentagon tilted. The Zweihorn's *other* horn passes each store once near the start of every turn (about 35°–63°) and executes any waiting carry. Any waiting carry is executed there.

**Correction (M2, 2026-10-17).** I first claimed this reproduces GWLB's 9999 + 1 → 9900 → 0000 (tilted) → 10000. It does not.
- The early pass of a lever is its *other* horn. Its time is a constant minus that lever's main window, so highest-first main passes force **units-first early passes**. A pending chain therefore ripples through during the next turn's early passes, and the model gives **9999 + 1 → 9900 → 10000**.
- Matching GWLB's "about two levels per turn" would need early passes spaced under 5.1° apart (closer than the secondary-storing time). In this geometry that also forces main passes so close that a pin meets a horn rotating into its path, i.e. a jam (Lehmann warns of exactly such "Verklemmungen").
- **Conclusion:** GWLB's described behaviour implies lever geometry different from our reconstruction. Our `historical` mode honestly shows *deferred* secondary carries (pentagons tilted, finished by an idle turn). It does not show GWLB's exact per-turn count. Checking this against the original's lever geometry is part of M4 (the NL 183 / GWLB-mbe data).

## Addendum (2026-10-18): new evidence on the original's carry

- **Stein (2007, an abstract):** in the original, with certain digit patterns, carries are **not completed from the 5th result place from the right on**. The Hannover model needs the crank turned 87° further for complete carries.
- **Morar (2015):** Leibniz added the pentagon to each carry "to show whether the carry has been correctly performed" (citing AA I 17, 105).

Both support offering a mode where secondary carries can stay pending (`historical`), shown by tilted pentagons. Neither gives lever angles, so the timing table stays our design. Morar also notes that the surviving machine was changed in Burkhardt's 1890s restoration, so even measurements of it describe the restored state (research/sources/notes-history-and-reconstructions.md).
