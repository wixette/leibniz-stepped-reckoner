# Changelog

What changed in each release. Versions follow `package.json` and are tagged `vX.Y.Z` ([docs/development.md](docs/development.md), *Versions and releases*). The design decisions cited (U1, U2, …) are in [docs/ui-design.md](docs/ui-design.md).

## 1.3.0 (unreleased)

**The machine**
- The stepped drums have the original's sizes (Klaus Badur's measurements): 35 mm across the ribs on a 32.5 mm pitch circle, 28.5 mm long, the ribs stepped 3.15 mm a digit (Lehmann's replica: 36, 27.2 and 3.02). The setting knob's pinion is sized so that one division still moves the drum one rib.
- The revolution counter on the carriage's top right works, as on the original: its steel ring with 10 holes turns one hole a turn, the pin sits in a hole and points at the black numbers around it (red, on the centre, when subtracting), and it stops the crank at the stop. The pin and its holes moved here from the Magna Rota, which follows Leupold's 1727 description rather than the surviving machine.
- The Magna Rota is the original's: a pierced brass plate with two steel plates behind it, 116.5 mm across, fixed to the crank and turning with it. Its pattern is drawn from Klaus Badur's saw template and photographs of the original.
- The crank on the Magna Rota as on the replica: a shaped steel rod across the plate, a turned oak handle with a gold ball standing out to the front, and two bolts holding the plates.
- The end crank that shifts the carriage as on the replica: a bent steel bar with the same turned oak handle and gold ball as the main crank.
- The carriage box is shaped as on the original: a short wall along the front, the setting dials lower behind it at the counter's height, the counter section's stepped front with its corner under the counter, and moulded frames of three ridges on the front, along the top's back and left edges, and round the counter's top.
- The oak case is gone for now: the machine stands on four turned brass feet under its base plate, on four wooden blocks, as Lehmann's replica does (his drawing of the feet; the museum's photo). The case will be rebuilt round it.
- The frame is built of beams as on the replica: a front beam just in front of the lead screw, a lower frame of side, middle and back beams on the feet, and a rear beam instead of the rear wall. The register has no cover, as on the original: its digits are read through the window plate.
- How the crank drives the machine, as on the original: the crank sits on the axis of the fifth drum (counting the units as the first) and turns it directly; three large gears behind the Magna Rota pass the turn to two carry-lever shafts. A row of 17 gears links all eight drums and the eight lever shafts; each drum's gear slides with the drum along a long gear on its neighbouring lever shaft. The 17th shaft, beside the units drum, is there to drive the revolution counter.
- The setting mechanism is laid out as on the original: at the front of each drum's axis a sleeve carries the rack on an upright wall, and the knob's pinion meshes it there; behind it come the row of gears, then the drums. The setting knobs moved accordingly (closer to their drums and further forward, in line with the revolution counter, as in Klaus Badur's drawing).
- The revolution counter moved to where Klaus Badur measured it on the original: 82 mm right of the units drum (14 mm further left than on Lehmann's replica), in line with the setting knobs.
- The carry is the original's, built from Klaus Badur's part drawings: on an intermediate shaft half-way between two result wheels, two five-horns cut as gear teeth, a detent wheel and the pentagon; on each result shaft a short one-toothed Einzahn and a small ten-toothed wheel; under each store the lever's Zweihorn. The simulator works out how the parts push each other from their shapes. The carry works as on the original (all levers together).
- The *Ripple* carry, the default: in each digit a modern pair of carry parts of our design (a long thin carry lever and a small five-horned star) takes the place of two of the original's, and the levers follow each other about 6° apart, units first, so a whole chain of carries runs through within one turn. It is not historical and not Lehmann's (the *Carry* box used to call the one-turn carry *Lehmann*). It sits behind the drums' axes, where its long horns have room, so the register frame's bar moved slightly forward. The *Carry* box switches between *Ripple* and *Original*; Reset keeps the choice, and the *Carry* view looks at whichever set is fitted.
- The result digits are as large as the setting dials' and face up at the windows, easy to read: the result discs are 8 mm deep instead of the original's 3, and the parts behind them sit 5 mm further back (nothing else in how the machine works changes).
- The revolution counter is driven as on the original: a single tooth on the 17th shaft steps a star wheel once a turn, and a crown wheel and two gears carry the step to the ring, a tenth of a turn (Klaus Badur's drawings of the gears; Burkhardt's description). The ring now steps once a turn instead of turning smoothly.
- Each carry lever's Zweihorn is one part with its two horns, as on the original (Klaus Badur's drawing), in both carry sets.
- The setting knobs have the original's 12 divisions (digits 30° apart, a 60° blank), and the pentagons the original's size.
- A *Counter* view.
- *Show case and frame*: with the case off, the frame, the carriage's front panel and its floor go too, and the whole mechanism shows (the large gears behind the panel among it).
- The revolution counter's pin works both ways: its menu offers the black numbers for adding and the red ones for subtracting, and a new button turns the crank back until the pin meets the stop.
- *Colour by part*, a switch in the Views menu: every kind of part in its own colour, so that the parts inside the machine can be told apart.
- *Slow motion*, a switch in the Views menu: every turn and shift plays at a quarter speed, so that quick moments such as a carry being stored can be followed.
- The register's intermediate shafts are the original's square steel shafts with their long curved cuts along the edges (Klaus Badur's drawing, photos of Lehmann's replica).
- The setting knobs are built as Lehmann drew the replica's (and as the original has them): a steel finger lever whose C handle and pointer are one part, with a pin under the pointer in a hole beside the set digit, and a window at the back of each dial, in the gap between 9 and 0, where a white digit disc under the plate shows the set digit. The dial plates lie flush in round holes of the carriage's cover.

## 1.2.0

The model moves toward the original in Hannover. Klaus Badur, who measured the original before building his replica, sent its dimensions and the angle of its carry levers, in agreement with the Gottfried Wilhelm Leibniz Library, and pages of his chapter in *Das letzte Original* on how it carries. The page now follows the original where he measured it and N. J. Lehmann's drawings of the Dresden replica elsewhere, and it can carry either way ([decision 0002](design/decisions/0002-original-replica-and-releases.md)).

**The carry of the original**
- A new carry, *Original*, follows the original: all eight carry levers act at the same moment, each 90° across its two horns. A carry made while carries are being passed on waits, its pentagon tilted; each further turn with 0 on the knobs finishes two, and the next sum finishes them by itself. 9999 + 1 shows 9900, then 0000, then 10000, and the book's example 099 + 3 shows 002, then 102. The model gets there from the lever geometry alone.
- It replaces the *historical* mode, whose levers came highest digit first, which no source supports ([decision 0001](design/decisions/0001-carry-interpretation.md), addenda of 2026-11-21 and 2026-11-24).
- A new lesson 3, *Carries that wait: the original*, adds 9999 + 1 again as on the original, turn by turn: the units' carry stored, 9900 with the tens' pentagon tilted, then two idle turns the learner makes, and a task on the new *Carry* box. Lesson 2 stays on Lehmann's one-turn carry, the default, and now says that a tilted pentagon means its wheel owes the next one a carry. All in ten languages; seven lessons now.

**The machine**
- The parts Badur measured have the original's sizes: result discs Ø35.5, setting discs Ø36, the carriage hood 444 mm long with its front 111 mm high, and the carriage frame 333 mm long.
- The revolution-counter dial on the carriage is only resized: its steel ring is now the original's Ø69.5 outside and Ø45 inside, reaching the edge, round a smaller brass centre. It is still a static dial with ten dot marks and no digits; the working counter is for 1.3.0.
- The pentagons are the original's, 40 mm across the corners (26 before), in two staggered rows behind the register's rear wall, so that neighbours do not touch. They stand level with the register's cover, which now ends just in front of them, and the oak case still hides them: turn *Show case* off to see them.
- The oak case is the original's 755 mm long (806 before).

**The page**
- A *Carry* box in the toolbar chooses between the two in free play: *Lehmann* or *Original* (U30). It sits before Reset, and the two keep together where the toolbar wraps.
- The toolbar drops Reset's label and its separators on narrower stages than before, so it stays one row on a 1280 px laptop with the panel open and on a 768 px tablet (two rows there before). A phone now has three rows of controls.
- The References tab opens with *The original and its replicas*: how the original carries, what Lehmann, Stein and Kopp, and Badur and Rottstedt did with it, and which of them the model follows.
- The About box is short again, as in the 8800 simulator: the version, what the page is, the source and the licences, with a *References* button. The credits moved to the end of the References tab, which that button opens, as a short list (the research, the original's dimensions, the Dresden replica's, the photographs); they and the tutorial say which sizes are the original's and which Lehmann's, and credit Badur's measurements as he approved.

**Developers**
- The developer pages of the first two milestones (one digit, `dev/01-digit-slice/`, and the three-digit carry slice, `dev/02-carry-slice/`) are removed, with their models, Blender scripts, simulations and checks: their part sizes no longer matched the machine. Their carry tests now run on a 3-digit `Machine` (`tests/sim/smallMachine.test.js`); `dev/03-full-machine/` stays. `pnpm build:model` and `pnpm check:model` now build and check the full machine only.

**Research**
- Badur's measurements and the facts of his chapter (how the original carries, its counter, its carriage, how it is operated) are in the research notes, as facts only ([notes-mechanism.md](research/sources/notes-mechanism.md) §10); the book's text and figures are not in the repository.
- Left for 1.3.0, waiting for Badur's answers or too large for this release: the crank's direction, the revolution counter and the Magna Rota, the stepped drums at the original's sizes, and the large gears behind the Magna Rota (decision 0002).

## 1.1.1

The README is rewritten for newcomers; the simulator itself is unchanged.

- It opens with the machine: a photo of the original in Hannover beside the simulator, seen from the same side.
- *Your first sum* introduces the page as you use it, up to a look inside with the Stepped drum view; the full list of controls is folded away under *All the controls*.
- *How it calculates, in six lessons* explains the mechanism one lesson at a time, each with a picture, instead of a table of lessons and a separate text.
- `pnpm shots` takes the new picture of the whole machine (`view-whole`), cropped to the machine; a shot can now give a crop.

## 1.1.0

The machine follows N. J. Lehmann's workshop drawings of the TU Dresden replica, kept in the Deutsches Museum's archive (NL 183/465 and NL 183/466 PLAN), where they fit the model ([design/m4-notes.md](design/m4-notes.md)).

**The machine**
- The digit pitch and the lead screw are 36.5 mm (37 before, from Burkhardt's description of the original).
- The stepped drum is a 16-tooth module-2 wheel, 36 mm across, with its 9 ribs in 3.02 mm steps and a boss; the receiving gear has 10 pointed, profile-shifted teeth, 26.5 mm from the drum.
- The setting dial has 13 divisions, the digits on ten of them, and a stop the knob's pointer meets at 0 and at 9; one digit moves the drum 3.02 mm, one rib.
- The carriage has 8 positions, as on the replica: it shifts 7 places, so the 16th result digit is reached only by a carry.
- The frame follows the drawings in length: side walls 610 mm apart with the lead screw running in them, the base 629 mm long, and the counter dial 73 mm right of the units knob.
- The drive chain between the drums and the carry levers has the replica's gears: 10 teeth, 22.9 mm across and 7 mm wide, with a collar on each drum's gear.
- The About box and the tutorial credit the drawings, and say which sizes follow them, in all ten languages.

**Fixed**
- A thin strip at the left end of the carriage's front panel flickered when the view moved (since 1.0.0): the end walls of the carriage cover lay in the panel's faces. They now start behind it, and a new acceptance check, A2-14, finds faces of two parts lying in one plane.

**Tools and pages**
- `pnpm shots` takes the release screenshots, the README's and a set for posts, in any of the languages ([docs/development.md](docs/development.md), *Versions and releases*).
- `pnpm video` makes the release videos, with the machine's sound: taken apart, the drum, the carry, an addition and a multiplication, in any of the languages.
- Both write to `~/Downloads/leibniz-v<version>-media/` by default: release media are never kept in the repository.
- The page's description (for search engines and the installed app) and `package.json`'s now say what the simulator is first, and name the lessons and the ten languages, as the GitHub repository's description does.

## 1.0.0

The first public release: the prototype's teaching page becomes the simulator, with free play first and a tutorial, six lessons and references beside the machine.

**The page**
- Free play is the home: a working machine at once, with the tutorial, the lessons and the references in one dock beside or under it (U1–U3). The dock resizes by its edge, and can be hidden (U17).
- The mode is in the top bar: free play, or the lesson and its step, with the way back to free play and a lesson that can be resumed where it was left (U27).
- A five-minute tutorial in three chapters, and six lessons from adding to dividing: the stepped drum, the carry (9999 + 1), subtracting, the carriage, 1709 × 365 and 623785 ÷ 1709 (U6).
- Ten languages: English, Español, Français, Deutsch, Italiano, Português (Brasil), 简体中文, 繁體中文, 日本語 and 한국어 (U7).
- A dark classroom theme in Material 3, with one meaning per colour (U5), and the new logo and app icons.
- What is read can be selected and copied; the controls around it cannot (U28).

**The machine**
- One toolbar under the machine: the number on the knobs, set as it is typed (U19); the crank's + and − (U20); the carriage (U21); the Magna Rota's pin and Run to stop (U22, U23); Reset; and the machine's sound (U29).
- Both cranks can be dragged round either way, or Shift-clicked (U16).
- The pin's backward turns: turned back, the crank goes on until the pin meets the far side of the stop, instead of refusing at once.
- The machine's own sounds: the knobs, the crank, the carriage, the carries, the pin and the stop, with a mute button.

**The 3D view**
- Every view fits its parts into the free part of the stage, and refits when the stage changes size, until the reader moves the camera (U10).
- One Views menu: seven views (Taken apart among them) and a Show case switch (U15). The Stepped drum and Carry views are inside views, which hide the case, open the front and fade the other parts while the machine keeps working (U11–U14).
- The 3D view works by keyboard, and has zoom buttons (U24).

**Fixed in the release review**
- A carry could be lost in a turn whose wheel passed 9 twice: after the carriage was shifted over a waiting carry, the wheel took it and then a second carry before its lever came. The machine now refuses that turn, as it does for any store asked to hold two carries.
- The result readout and the register's value are exact for all 16 digits (the largest product, 99999999 × 99999999, read one too low), and an overdrawn register is always seen as below zero.
- Sound now starts on touch screens, and comes back after the system interrupts it.
- Run to stop says why when a full carry store, not the pin, stops the crank.
- A turn refused because a carry store would have to hold two carries says what to do in either case: shift over a carry no lever reaches and pass it on with an idle turn, or, when the lever would come too late, turn once with 0 on the knobs first (it used to say "no carry lever reaches" in both).
- A right-click or middle-click on a part no longer works it.
- A lesson left for another, or by reloading the page, is remembered at its step.
- A lesson step that sets the machine up is silent, as setting up is (U29).
- Keyboard and screen reader: the focus stays on Next and Back from step to step, and a task's buttons keep it while the machine moves; the step's progress, the visible labels of Reset, the number box and the lesson chip, and the readouts are named; the mute button has one name for each state; the number box looks greyed when it is.
- A browser too old for the page says so, instead of loading for ever.
- The page no longer loads the acceptance checks' code (three-mesh-bvh) when it starts; highlighting reuses its materials instead of making new ones at every step.
- Translations: corrections in Korean, Portuguese, German, Italian, Japanese, Traditional and Simplified Chinese, Spanish and French, and the tutorial's and the lessons' "Completed" each in its own grammatical gender.
- `pnpm build:model` and `pnpm check:model` fail when a Blender script fails (they always passed), and take Blender's path from `$BLENDER`. The site is deployed only once the tests pass on `main`, and CI uses the actions' Node 24 releases.

## 0.0.1

The prototype: the full machine modelled and checked (milestones M0–M2), and a first teaching page with four lessons in English and German (M3).
