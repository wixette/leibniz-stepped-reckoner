# M3 notes: the teaching layer

> **A record of M3 as first built (2026-10-18).** The page was redesigned for release 1.0.0, and parts of this note no longer describe it: there are ten languages, not two, with every text in `js/l10n/` (the `js/teach/i18n.js` named below is gone); a tutorial and six lessons, not four; free play is the home; the view, not toggles, decides the case, the front and fading; and "page 04" is the site's main page, `index.html`. The current design and its decisions are in [docs/ui-design.md](../docs/ui-design.md), and the acceptance checks added with it (A3-12…A3-15) in `js/accept/m3Checks.js`. The findings, measurements and open items below still stand.

- **Status:** built 2026-10-18. The acceptance spec passes: A3-1…A3-6 and A3-9…A3-11 in `pnpm test`, A3-7 is the page's `?selftest` (9/9), and A3-8 is the M0–M2 specs, which run in the same `pnpm test`. **The exit criterion is still open:** "usable by a teacher without instructions" needs the open steps below.
- **Plan:** [modelling-and-animation-plan.md](modelling-and-animation-plan.md) §10, §10.1 (M3 design decisions)
- **Page:** `index.html` (the site's main page)
  - `?lang=de` starts in German;
  - `?selftest` runs A3;
  - `?perf` shows the frame rate and draw calls;
  - `?debug` exposes the machine to the console.

## What M3 adds

| Piece | Where | What it does |
|---|---|---|
| Teaching page | `index.html` (the site's main page) | A learner page next to the developer page (03). Lesson list, lesson player (Back / Next, step text, "Your turn"), free play, result readout, views, case / front / take-apart / fade toggles, EN ⇄ DE switch (remembered per browser when storage is allowed). |
| Lessons | `js/teach/lessons.js` | Four lessons as data: 1 the stepped drum (9 steps), 2 9999 + 1 and the carry, with the historical carry as an aside (8), 3 1709 × 365 (8), 4 623785 ÷ 1709 (11). They contain 13 learner tasks. |
| Lesson engine | `js/teach/player.js` | Step types; presentation that carries over from step to step; actions, played animated on the page and applied at once in tests; Back replays the lesson from its start; `runLesson` is the headless learner used by A3-2 and A3-4. |
| Text | `js/teach/i18n.js` | All UI strings in English and German. Part names come from the model. |
| Scene helpers | `js/scene/teachScene.js` | Camera views (6, following the carriage); highlight with focus (cloned materials, glow, other parts faded); callouts (HTML labels pinned to parts); exploded view. |
| Model extras | `blender/scripts/build_m2.py`, params `geometry.m2.explode` | `label_en` / `label_de` on the static parts too (frame, case, covers, plates, windows). `extras.explode` offsets for 43 parts in 14 groups. |

**Learner tasks.**
- A task names the controls it needs; the panel shows only those, and free play shows all of them.
- Next unlocks when the task's check passes.
- Each task carries a solution (used by Back and the tests) and a plausible mistake its check must reject: for example 30 instead of 3, the pin in hole 6 instead of 5, one turn instead of turning to the stop.

**The exploded view** adds factor × offset (in the parent's frame) to the posed transform, so it works at any crank angle and carriage position. The rig re-sets translating parts on every pose, but not rotating or static ones, so posing always goes remove offsets → pose → add offsets (`Exploder.pose`).

## Follow-ups after the first review (2026-10-18)

- **Taken apart, the machine cannot calculate.**
  - While "Take it apart" is on (or the parts are still moving), the crank, shift, pin and input controls are locked, with a note saying to put it back together.
  - A lesson action waits until the machine is back together, and the toggle is disabled while the machine moves.
  - A3-9 checks that no lesson step moves the machine or sets a task while it is apart.
- **"Fade the other parts"** is enabled only on lesson steps that highlight parts. Elsewhere it is unticked and greyed out, with a tooltip saying why.
- **Labels show live values, apart from the name** (`js/teach/partInfo.js`).
  - A part's position is named by its decimal place in words ("Result wheel · tens", "Setting knob · units", "10⁴ place" from the ten-thousands on), never by an index.
  - The current value sits in its own coloured chip: a wheel's digit, a knob's or drum's setting, a carry store's state (no carry / carry stored / passing it on), the Magna Rota's turns (red when counting back), the pin's hole, the carriage's shift.
  - So "Setting dial 2: 4" now reads "Setting knob · hundreds" with a **4** chip.
  - Both the hover label and the lesson callouts use it. A3-10 checks the wording and the values against the machine.

## Operating the machine by clicking its parts (2026-10-18)

The machine can be operated by clicking (or tapping) its parts, as well as with the panel (`js/teach/partActions.js`):

| Click on | Does |
|---|---|
| a digit on a setting dial | sets that knob to the digit |
| a setting knob | next digit (9 → 0) |
| the main crank | one turn forward |
| a hole, black digit or red digit of the Magna Rota | puts the pin in that hole (hole 0: pin out) |
| the pin | takes it out |
| a result wheel or its window | moves the carriage so that its units sit under that wheel |
| the end crank | shifts the carriage one place left |

- **What counts as a click:** a press and release that moved no more than 6 px within 600 ms, so dragging still orbits the camera. Touch works the same way.
- **Same rules as the panel:** nothing while the machine moves or is taken apart, and in a lesson only what the current task allows.
- **Hover feedback:** over a clickable part the cursor becomes a pointer, and the hover label adds what a click does ("Click: set 7").
- **A3-11** clicks each kind of part with a ray from the side a user clicks from, and checks that the result equals the panel control.

## Performance (2026-10-18)

Measured on page 04, whole-machine view: 296 meshes (one per material per part). Before, every one cast a shadow, and the page drew 588 calls per frame (294 for the picture, 294 for the shadow map), 60 times a second, even when nothing moved.

| | Draw calls per frame | When |
|---|---|---|
| Before | 588, 60× a second | always |
| Idle | — (nothing rendered) | nothing moves |
| Camera moving | 294 | orbiting, view changes (the shadow map is reused) |
| Machine moving | 505 (211 shadow casters + 294) | crank, carriage, explode, toggles |
| Lite quality | 294, no shadows, pixel ratio 1 | `?quality=lite`, or automatically |

- **Render on demand.** `Viewer.renderOnDemand`, used by pages 03 and 04; the developer pages 01 and 02 keep rendering every frame. A page calls `viewer.invalidate()` when it changes the scene, and camera moves invalidate by themselves.
- **Shadow map cache.** It is redrawn only when parts move, not when the camera does.
- **Fewer shadow casters.** Parts with a bounding radius under 12 mm (digits, pins, hubs) no longer cast shadows: 211 of 296 meshes still do.
- **Adaptive quality.** In "auto" mode, if 60 back-to-back frames average below 25 fps, the viewer switches once to lite: no shadows, pixel ratio 1. `?quality=lite|high` forces either. `?perf` shows the rendered frame rate ("idle" when 0), the draw calls of the last frame and the quality.
- **Bug found on the way:** after a visibility change, the frame timer could report a negative frame time, which ran animations backwards. With the pane in the background, Add started turning the crank the wrong way (a subtraction). The viewer now clamps each frame step to 0–0.1 s.
- **Not done:** merging static meshes across parts. It would save only a few percent here, since most meshes belong to moving parts. Worth revisiting if the Chromebook measurement is still slow in lite mode.

## Acceptance (plan §10.1)

| ID | Result |
|---|---|
| A3-1 | 93 texts (UI strings, lesson texts, callouts) and 109 part names are present in EN and DE |
| A3-2 | The 4 lessons (36 steps) run start to finish and end as stated: 8; 10000 with every pentagon level; 623785; quotient 3, 6, 5 and remainder 0 |
| A3-3 | 53 part references and all 6 views resolve |
| A3-4 | All 13 tasks reject their mistake and accept their solution |
| A3-5 | 43 parts in the required groups. Pose + offset at factor 1; an exact round trip (1e-6 m) at rest and mid-turn at offset 3. Rotations unchanged within float noise (1e-6 rad). |
| A3-6 | Each of the 53 parts the steps show is visible in that step (judged as the learner sees it once the step's actions and task are done) and not shut in the closed case. Mutation check: closing the case on the stepped-drum step fails it. |

| A3-9 | No step moves the machine or sets a task while it is taken apart |
| A3-11 | Dial digit, knob, Magna Rota hole, pin, main crank, result wheel and end crank all act like their panel controls |
| A3-10 | 116 labels (58 parts in EN and DE): names in words, values match the machine |

`pnpm test`: 308 tests, about 14 s in total.

## Checked in the browser

- **Lesson 1:**
  - the take-apart step (callouts on the register, the carriage and the Magna Rota);
  - the knob task (30 keeps Next locked, 3 unlocks it);
  - the drum close-up with focus;
  - the demonstration turn (3), and the learner's 5 + one turn (8).
- **Lesson 2, in German:** the carry view from behind, with the units pentagon tilted and the register reading 9 990 mid-turn.
- **Lesson 3:**
  - the pin task shows only the pin buttons;
  - turning to the stop gives 8 545;
  - the shift task;
  - Back replays to step 4.
- **`?selftest`:** 6/6, no console errors.
- **`?perf` on this Mac:** 60 fps, 588 draw calls, 328 k triangles per frame (both counts include the shadow pass).

## Known limits

- **The carry view looks from behind**, because the pentagons face the rear. The result digits then read upside down; the lesson text talks only about the pentagons there.
- **No touch-specific controls yet.** Orbit and zoom work with touch through OrbitControls, but nothing was tested on a tablet.
- **The developer page (03)** keeps its own copies of the views and the animator; page 04 has its own. They could share code later.

## Still open (to finish M3)

1. **Test with 1–2 teachers** (the exit criterion). Can they run lesson 1 and lesson 3 without instructions? Note where they hesitate.
2. **Have the German text reviewed** by a native speaker (UI strings in `js/teach/i18n.js`, lessons in `js/teach/lessons.js`).
3. **Measure on a Chromebook-class device** with `?perf`, for the whole-machine view and the take-apart view.
