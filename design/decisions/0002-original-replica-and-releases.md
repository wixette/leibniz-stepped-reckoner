# 0002: Model the original; one model, two carries; what goes in v1.2.0 and v1.3.0

- **Status:** accepted 2026-11-24 by the project owner
- **Date:** 2026-11-24
- **Context:** Klaus Badur's letter (BADUR2026: dimensions measured on the original, the Zweihorn angle, the approved credit wording) and the draft pages of *Das letzte Original* he sent (WALSDORF2014, chapter II; facts only, see `research/sources/notes-mechanism.md` §8). Decision 0001 and its addenda.

## The question

Until v1.1 the model followed N. J. Lehmann's Dresden replica (decision D1 in `design/m4-notes.md`), because his workshop drawings were the only full dimensioned source. Now we also have measurements of the original in Hannover and a description of how it works. Should the simulator follow the original, the replica, or offer both as two models?

## What differs between the original and Lehmann's replica

| Difference | Visible to a user? |
|---|---|
| The carry: on the original all Zweihörner have the same 90° angle and act at once; Lehmann staggered them (135° … 36°) so that a chain of carries runs through in about one turn | **Yes**, in what the machine does and in the levers |
| Part sizes (drum Ø35 vs 36 mm, ribs 3.15 vs 3.02 mm per digit, …) | Barely: a few per cent |
| The exterior: the original in its oak case; the replica on a steel frame with cladding and brass feet | Yes, but only the outside; the model already shows the oak case |
| Carries 9–15 finished by shifting the carriage over them: possible only on the original (BADUR2026: the changed levers leave no room) | Only in rare cases |

## Decision

1. **One model, of the original.** Where Klaus Badur measured the original, the parts follow his measurements; where he did not, Lehmann's workshop drawings (NL 183/465) still fill in; other sizes stay estimated. This amends D1. A second set of models for the replica would double the upkeep for differences a user would hardly see.
2. **The carry is the one difference users experience, and it stays switchable** (the toolbar's *Carry* box, U30): *Lehmann* (ripple) and *Original* (simultaneous). **Lehmann stays the default** in free play for v1.2.0: a newcomer who tries 9999 + 1 should not first meet a result that looks wrong. The carry lesson teaches both and points to the switch. The default is reconsidered in v1.3.0.
3. **The Reference tab explains the original and its replicas** (Lehmann, Stein and Kopp, Badur and Rottstedt) and how this simulator relates to them.

## Releases

**v1.2.0 — only what has a confirmed source, released without open questions:**
- A1 the Zweihorn angle of the original (90° at the horns' outer edges) for the *Original* carry;
- A2 Badur's credit, as he approved it, in the bibliography and the About text;
- A3 the facts from *Das letzte Original* in the research notes;
- A4 the dimension policy above (this record; `reference_machine`; the About text);
- A5 the visible parts at the original's measured sizes (result discs, setting dials, revolution-counter dial, carriage hood);
- A6 the pentagons at the original's size, in two staggered rows;
- A7 the oak case at the original's length, if it fits the mechanism;
- the carry lesson pointing to the *Carry* switch; the *original and its replicas* section in the Reference tab;
- a check of the README and every user-visible text for consistency; then version, changelog, screenshots. No pull request or merge without the owner's review.

**v1.3.0 — what waits for Badur's answers, and the larger, riskier refits:**
- B1 the crank's direction (the book: *links herum* to add; asked whether that is anticlockwise seen from the front);
- B2/B3 the revolution counter and the Magna Rota: whether the pin and the number circles belong on the counter at the top right, the Magna Rota being a decorative disc on the crank, and whether the pin stops the crank or only marks the count. This would change *Run to stop*, the multiplication and division lessons and the Magna Rota view; B2 (its Ø116.5) goes with it;
- C1 the stepped drums at the original's sizes (Ø35, 28.5 long, 3.15 mm per digit), with the setting pinion and rack;
- C2 the large gears behind the Magna Rota (three in a row, the middle one on the crank's shaft);
- C3 the counter's drive gears and the carriage's detent lever;
- reconsider the default carry.
