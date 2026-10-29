# M1 notes: three-digit carry slice

- **Status:** done 2026-10-17. The acceptance spec passes (A1-1…A1-6 in `pnpm test`; A1-7 = the M0 spec, also in `pnpm test`).
- **Plan:** [modelling-and-animation-plan.md](modelling-and-animation-plan.md) §10, §10.1
- **Page:** `dev/02-carry-slice/` (add `?selftest` to run A1 in the browser)

## What M1 adds

| Node (per digit i) | Parts | Motion |
|---|---|---|
| `pm.drum_shaft.i` | shaft + **drive gear** (19 teeth; 10 since M4, as gear S of the replica; handwheel on digit 0 only) | +θ |
| `pi.sum_wheel.i` | as M0 + a **star** (10 teeth, i ≥ 1) that receives carries | −36° per step |
| `pi.carry_store.i` | Einzahn horns (plane A) + **Muldenrad teeth** (plane B, alternating by digit) + **Fünfhorn** (plane C) + pentagon (behind the rear wall) | 18° stored, 72° executed |
| `pm.lever.i` | lever shaft + drive gear (meshes drums i and i+1) + Zweihorn hub | −θ |
| `pm.zweihorn_add.i` / `pm.zweihorn_sub.i` | the Zweihorn's two horns: arm + pin reaching into plane C | −(λ + θ), with λ depending on the carry mode |

Plus a shared `pi.window` (three openings), a full-width rear wall and a front bar. The slice has 33 objects and about 40.5 k triangles, in a 1.27 MB `.glb`.

## How a carry works in the model (one addition turn)

1. **Ribs (78.75°–281.25°).** Every drum adds its digit. A wheel passing 9 → 0 trips its Einzahn, and the store turns **18°** (pentagon tilted).
2. **Carry window (from 292°).** Digit i's adding horn first touches the stored Fünfhorn at W_i. The **Zweihorn pin** pushes the store 18° → 40° within 5.2° of crank and releases at 54°, and a **detent spring** completes it to 72° within 2°.
3. While the store turns 27° → 45°, its **Muldenrad tooth** drives the next digit's **star** one step (2 : 1). If that wheel passes 9 → 0, its own Einzahn stores a **secondary carry** about 5.1° after first contact.
4. **Ripple** staggers the levers units first (W_i = 292 + 8.5 i), so the secondary carry is stored 3.4° before the next lever arrives. **Historical** staggers them highest digit first, so the secondary carry waits (pentagon tilted) for the *other* horn's pass near the start of the next turn (about 35°–52°). This is a deferred carry. **Correction (M2):** I first wrote here that this reproduces GWLB's 9999 + 1 → 9900 → 0000 (tilted) → 10000. It does not. With highest-first *main* passes, the other horns' *early* passes are necessarily units-first (early = const − W), so a pending chain finishes during the next turn's early passes: 9999 + 1 → 9900 → 10000. See decision 0001's correction.
5. The two horns of a Zweihorn are offset by the **spread angle** 2·(contact offset) − 2·W_i. It differs per digit (142°, 122°, 103° in ripple), which is exactly the kind of per-digit "Spreizwinkel" Lehmann re-dimensioned in the Dresden replicas.

## Design findings

1. **The Zweihorn acts through a pin, not a bar.** A full-length horn in the Fünfhorn plane sweeps sideways into the horns. The arm therefore sits in its own plane, and only a pin reaches the Fünfhorn (like the Einzahn). Solved numerically (sandbox, capsule contact):
   - pin path radius 17 mm, pin radius 1 mm;
   - lever axis 18.5 mm toward the next digit, at z = 44;
   - Fünfhorn horns 7.5 mm, bisected at rest by the line from the store axis to the lever axis;
   - rest clearance 1.39 mm; push 18° → 40° in 5.2°; release at 54.3°.
2. **The Muldenrad and star needed shorter teeth (addendum 0.5 module).** With 0.6, a stored (18°) Muldenrad tooth flank dipped into the next star's swept circle while that star was still turning under its own ribs. The M1 sweep caught it.
3. **The carry window starts at 292°, not 281.25°.** A carry may only turn a wheel once that wheel's last rib is at least 22° past its receiving gear. The M1 sweep caught a rib still in the gear 2° after the rib window. The stagger is now 8.5° (was 9.8°), so 8 digits still fit before 360°.
4. **Muldenrad planes alternate by digit parity.** A Muldenrad (radius 14.4 mm) would otherwise meet its own digit's star.
5. **The pentagon discs sit behind a full-width rear wall** (y 104–106), as on the original.

## Verification

| Check | Result |
|---|---|
| `pnpm test` | 250+ tests, including the A0 and A1 acceptance specs; ~20 s in total |
| `pnpm check:model` (M0 sweep + M1 pose replay) | M0_CLEARANCE_OK; M1_CLEARANCE_OK: 67 part pairs × 3,997 poses (1° steps) from 8 scenarios (ripple/historical, add/subtract, 999 + 1, 000 − 1, 999 + 999, …). **M2 update:** that hand-written pair list missed neighbouring-digit collisions (drum ↔ next rack, shaft ↔ next pinion). They are fixed, and the sweep and A1-6 are now all-pairs (m2-notes, finding 3). |
| Mutation: levers turning with the drums | Caught by A1-4 (no lever pushes) and A1-6 (drive gears clash) |
| Browser `?selftest` | page 01: 9/9; page 02: 6/6 |
| Manual testing | 999 + 1 in both modes, stepping through the carry window |

## One source of truth for M1+ motion

From M1 on, multi-digit motion lives **only in the JavaScript sim** (`js/sim/carrySlice.js`, `kinematicsM1.js`). The Blender sweep does not re-implement it. `pnpm poses:m1` exports scripted scenarios as per-node values, and `check_m1_clearance.py` replays them on the Blender model. (M0 keeps its Python kinematics and the Python→JS fixture test.)

## Known simplifications / for M2

(All four were taken up in M2; see [m2-notes.md](m2-notes.md).)

- Carries out of the top digit leave the slice (counted as "carried out"). There is no carriage shift yet.
- **The last digits' springs (M2, 8 digits)** finish just after 360° (last lever at 351.5° plus about 17°). They need to finish in the next turn's free arc, or the stagger needs tightening.
- **Zweihorn spread for high digits (M2)** gets small (about 5° for digit 7), so the add and sub arms would overlap in one plane. M2 needs two arm planes.
- The materials are still plain PBR. There is no Magna Rota, carriage or counter yet.
