# UI design

The principles the simulator's page is laid out by, and why. Where a control ends up, and what it looks like, is the code's business. This document holds the rules that decide those things, so that the next change can follow them, or argue with them in the open.

**If a change needs to break a principle, change the principle here first, with its reason.** Decisions are recorded in [Part 3](#part-3--decisions) as U1, U2 and so on, each with what it supersedes and the alternatives rejected, and the code cites them by number.

## Part 1 — Principles

### P1 — The machine is the one primary surface

It is always on screen. Nothing covers it, and nothing pushes it out of view.

*Why:* the machine's windows, dials and wheels *are* its state. Every other view (a cut-away, a lesson, a readout) is read against them.

### P2 — A control has one home

If a control is wanted somewhere else, move it, or make both places visible at once. Don't make a second copy.

*Not copies:* operating a part by clicking it in 3D, and the control that does the same thing. They are two ways to the same operation, and follow the same rules.

### P3 — Tools in one dock, one at a time

The tutorial, the lessons and the references share one dock beside or under the machine. The reader chooses which one it shows, and whether it is open.

### P4 — Occasional actions go in menus and dialogs

Space that is always there is for things that change while you watch. Things done once a session (a language, About) go in the top bar.

### P5 — Each surface keeps its voice

The machine's own markings (the digits on its wheels and dials) stay as on the machine, and are not translated. The instrument around it (top bar, dock, labels, status line) is translated.

### P6 — Unavailable is greyed and explained, never hidden

A control that cannot be used right now stays where it is, greyed, and when used it answers in the status line with the reason: the crank is locked while the machine is taken apart; a lesson step asks for something else; the pin is on the stop.

### P7 — One status line, always visible

It says what just happened, and why something is greyed.

### P8 — A link is a public contract

A link that opens the simulator in a state (a lesson step, numbers on the machine, a language) ends up in worksheets nobody edits again. Once the format is released, fields may be added, but an existing field is never renamed, dropped or read differently. The format lives in one module with nothing of the page in it, and its own test pins it down.

### P9 — A phone gets the same app

Same regions, same order, every feature. Nothing depends on hover or on a precise drag: a single tap does what a click does. A laptop or Chromebook is the main target (U1); a phone must be good enough to do every lesson.

### P10 — One component for each kind of thing

Menu, dialog, icon button, tab, card, chip: each kind of control is one component, used the same way everywhere. They follow Material Design 3 (states, shapes, elevation, motion), in our own colours.

Also:
- **Icons are Material Symbols, inline SVG.** No icon fonts, and no fonts or scripts from a CDN: the page must not need any network but its own site (school networks block a lot). Fonts and icons are vendored like three.js (`pnpm vendor`).
- **Every icon button has a tooltip and a screen-reader name**, both translated.
- **Keyboard first-class:** every control is reachable with Tab, has a visible focus ring, and the dock's tabs follow the WAI-ARIA tabs pattern. The 3D view itself takes the focus: arrows turn it, + and − zoom (U24).
- **Motion is short and optional:** camera flights and panel transitions honour `prefers-reduced-motion`.

## Part 2 — The layout

```
┌ [logo] Stepped Reckoner [🎓 The carry · 3/8│✕ Free play]   [dock] [文A EN ▾] [ⓘ] ┐  top bar
├─────────────────────────────────────────────────────┬────────────────────────────┤
│ RESULT 0 000 000 010 000  TURNS 1   [⌂][🎥 Carry ▾] ┃ Get started│Lessons│Refs   │  dock tabs
│                                                     ┃ ┌────────────────────────┐ │
│                THE MACHINE (3D stage)               ┃ │ Lesson 2 · The carry   │ │
│                                                     ┃ │ ●●●○○○○○  step 3 of 8  │ │
│                                                     ┃ │ Behind each result...  │ │
│                                                     ┃ │ ▸ Your turn  [Number]  │ │  task line (U18)
│ ╭[00000001] [↻ + │ ↺ −] [‹‹ 0 ››] [Pin – ▾│→|]  ⟳ ╮ ┃ └────────────────────────┘ │  toolbar (U18)
├─────────────────────────────────────────────────────┴────────────────────────────┤
│ The ribs added 1 to the units: 9 → 0, and the carry is stored.                   │  status bar
└──────────────────────────────────────────────────────────────────────────────────┘
  ┃ = the dock's edge, its resize handle (U17)
```

On a narrow (under 900 px) or portrait window the same regions stack: top bar, stage (with its toolbar), dock, status bar. The dock then takes the lower part and scrolls; its top edge carries a grab pill to resize it (U17).

## Part 3 — Decisions

### U1 — Desktop first: the dock on the right of a wide window, below on a narrow one

The page is a fixed frame: top bar, stage (with the machine's toolbar floating at its bottom, U18), dock, status bar; the page itself never scrolls. On a wide (landscape, 900 px or more) window the dock sits to the right of the stage, 340–440 px wide by default and resizable by its edge (U17), and can be closed from the top bar; the stage takes the rest. On a narrow or portrait window the dock goes below the stage. Either way the stage keeps a shape not far from square, which suits a 3D view that also flies to close-ups.

*Why on the right, unlike the 8800 simulator (dock below):* the 8800's panel is a flat 2.24 : 1 picture, so the room it leaves is underneath. Our machine, seen whole, is about 2.3 : 1, so its size on a wide screen is limited by the stage's *height*. A dock below takes height: on a 1366 × 768 Chromebook it leaves the machine about 620 px wide, against about 900 px with the dock on the right (and about 1,070 against 1,400 px on a 1920 × 1080 screen). The close-up views (drum, carry, Magna Rota) are nearly square subjects, and lesson text reads better in a column than in a wide strip. *Rejected:* dock below on wide screens (letterboxes the 3D view); a floating lesson card over the stage (breaks P1).

### U2 — Free play is the home; the tutorial and lessons are modes over it

Opening the page gives a working machine at once: every control enabled, nothing to choose first. The dock opens on *Get started* the first time (and on the reader's last tab after that), inviting the tutorial without blocking the machine.

Starting the tutorial or a lesson enters **course mode**: the step player takes the dock, the machine toolbar greys the controls the current step does not use (P6, the status line says why), and the top bar shows where you are (U27). Leaving (the top bar's ✕ Free play, the lesson's ✕, Finish, or opening another lesson) returns to free play with the machine as it is; a lesson left unfinished can be resumed at its step.

### U3 — Three dock tabs: Get started, Lessons, References

- **Get started**: the tutorial in three short chapters: *What is it?* (the machine's story, with historical pictures), *What's inside?* (a tour of the parts in 3D, taking it apart), *Your first sum* (2 + 3, done by the reader).
- **Lessons**: a path of six lessons, each building on the one before (U6), with progress ticks remembered in the browser.
- **References**: where to see the machine and read more, grouped, each link with one line on why it is worth a click.

Free play has no tab: its controls are the machine toolbar, under the machine (P2).

### U4 — The machine's toolbar and the stage's own tools

- **Machine toolbar** (floating at the stage's bottom, centred under the machine, U18): the number on the setting knobs, turn forward (+) and back (−) as one pair, carriage left and right with its place as another, boxed and named like the number box (U21), the Magna Rota's pin (a dropdown box, U22) with turn to the stop joined to it (U23), reset (U20). Icon plus short label where there is room, icons with tooltips where there is not (U18).
- **Readouts** sit on the stage's top edge: the result as on the machine, grouped in threes; the Magna Rota's turn count (red when subtracting); the carriage's place.
- **View controls** float at the stage's top right (U15): a Reset view button (⌂), a − / + zoom pair (U24) and the Views menu, whose button names the view on show. The menu holds the seven views (two of them inside views, U11, and Taken apart) and a Show case switch. Opening the front, fading and taking apart follow the view (U14, U15). They change how the machine is *shown*, not its state, so they stay enabled in a lesson, except where a step depends on them.

### U5 — A dark Material 3 theme for a classroom: blue, with one colour per meaning

A dark scheme (the 8800's family): the 3D stage reads better on dark, and the brass and oak of the machine are the brightest, warmest things on screen. The interface around them is cool blue on blue-grey neutrals. Blue is the complement of the machine's gold, so the machine stands out from its frame instead of being echoed by it, and blue with amber highlights is the palette of science and school, not of luxury.

The first version used a brass-gold primary on warm neutrals to match the machine. It looked cohesive, but it read as luxury rather than as a classroom tool. The machine also blended into its own frame, and "your turn" was the same gold as everything else, so it did not stand out. A side-by-side trial of the two palettes settled it.

**Each colour has one meaning**, everywhere it appears:

| Colour | Means | Where |
|---|---|---|
| Blue (primary) | The instrument: navigation, selection, where you are | The selected tab and its bar, links, the focus ring, filled buttons (Start, Next), the lesson's progress and current step, a lesson under way in another tab (dot), the course chip, ticks in menus, the result readout |
| Blue-grey (secondary) | The machine's controls | The tonal buttons: + and −, the carriage's arrows, Run to stop |
| Amber (attention) | Your turn | The glow on the control a step asks for, the task line's "Your turn", and in 3D the glow on the parts a step points at (the same hue) |
| Green (success) | Done | The task line's "Done", a finished lesson's badge, the lesson-done icon |
| Red (error) | Something was refused | A refused control's reason in the status line, a blocked step |
| The machine's red | Counting backward | The turns readout when the Magna Rota turns back, as its red digits do |

- **The dock has three surface levels,** so its parts do not blur together in the dark: the tab bar is a raised band with a divider under it, the body is the darkest well the content sits in, and cards (a step, a lesson, Get started's welcome) are raised above it with a fine edge. Before, the tab bar, the body and the space around the content shared one colour, and only the cards differed, and only slightly.
- **Hover and press are visible:** a control lightens by 14% under the pointer and 22% when pressed (Material's 8% and 12% barely showed on the blue-grey buttons). A dropdown box also lightens its fill on hover.
- **Contrast:** every text colour on its background reaches at least 7:1 (WCAG AAA). The outlines of the setting boxes reach 5.4:1 against the toolbar.
- Type is Roboto Flex (Latin, Latin Extended, Greek, Cyrillic; CJK falls back to the system's Noto/PingFang/Hiragino/Malgun), with tabular figures for every number.

*Rejected:* a light theme for now (the 3D stage reads better on dark; open question); several themes to choose from (one well-made theme is enough for the first release).

### U6 — The learning path

1. **Adding: the stepped drum** — one digit, then whole numbers at once.
2. **The carry: 9999 + 1** — stored, then passed on; the historical reading as an aside.
3. **Subtracting: turn the other way** — 1000 − 1, borrowing as the mirror of carrying.
4. **The carriage: places and ×10** — shifting multiplies the step by 10.
5. **Multiplying: the Magna Rota** — 1709 × 365 in 14 turns.
6. **Dividing** — 623785 ÷ 1709, subtracting until it goes below zero.

Every lesson opens with what you will learn, has a task the reader does at least every few steps, and ends with a one-line recap and a *Next lesson* button. A task names the control to use, and that control is the only one not greyed.

### U7 — Ten languages, one file each

The locales of the 8800 simulator: English, Español, Français, Deutsch, Italiano, Português (Brasil), 简体中文, 繁體中文, 日本語, 한국어. Each is one module (`js/l10n/<locale>.js`) holding every string of the page, the tutorial, the lessons and the part names, keyed alike; English is the reference and the fallback. A test checks that every locale has every key and keeps every `{placeholder}`. The language comes from `?lang=`, then the reader's last choice, then the browser's languages; the menu lists each language in its own name.

### U8 — The top bar: logo, title, and three icons

Logo and title on the left; on the right the dock toggle, the language menu and About. About is a dialog: logo, version, what the simulator is, credits (sources, photographers, libraries), licences one per line, and links to the source and the developer pages.

### U9 — The 3D stage behaves like a 3D viewer

Orbit by dragging, pan with the right button or two fingers, zoom with the wheel or a pinch, damped and limited so the machine cannot be lost; *Reset view* always brings it back, framed by U10. Hovering a part shows its name and live value; a part that can be operated shows a pointer cursor and what a click will do. The model loads with a progress indicator on the stage; until then the toolbar is greyed with the reason in the status line.

### U10 — Each view fits its parts into the stage's free area

The readouts and the view controls on the stage's top edge float over the canvas. Every camera view frames its parts (the whole machine, or the parts of a close-up) in the **free area** below that band, by two rules:

1. **Nothing covers the machine.** The fit uses the free area, not the whole canvas, so no readout, tool or the dock (which sits beside or under the canvas) ever hides part of it. The camera's centre is moved to the free area's centre (a view offset), so the machine sits in the middle of what is free, and orbiting pivots around it.
2. **Contain at 90%.** The parts are as large as they can be while all of them show: they fill 90% of whichever side of the free area runs out first. In a wide, flat stage that is the height; in a laptop's stage beside the dock, in a portrait or a phone's stage, usually the width or the height, whichever the machine's 2.3 : 1 silhouette meets first.

The camera keeps each view's direction; the fit moves it only nearer or farther and sideways, measured on the corners of each part's own bounding box as the camera sees them. Not a bounding sphere, which would leave them smaller; and not one box around all the parts, whose far corners, seen at an angle, reach well beyond parts that do not fill a box (taken apart, the machine spreads into an L and came out at 68% and 9% off-centre). Acceptance check A3-14 measures every view on the parts' own geometry: about 90% of the limiting side, centred. The whole machine is fitted with its case whether the case is shown or not, so hiding the case does not move the camera; taken apart, it is fitted at its taken-apart size.

**Resizing refits; the reader's camera is the reader's.** While the camera is in a view the page chose (on load, from the Views menu, Reset view or a lesson step), a change of the stage's size (the window, the dock opened or closed, a phone turned) or taking the machine apart refits it at once. Once the reader turns, moves or zooms the camera, it stays where they put it until they choose a view or Reset view. Code: `js/scene/framing.js`, tested in `tests/scene/framing.test.js`.

*Supersedes* the fixed views of M3 (a bounding sphere fitted once to the camera's narrower angle, which ignored the bands and let the machine run off a narrow stage and look small in a flat one). *Rejected:* fitting the shorter side of the stage at 90% (on a 1.9 : 1 laptop stage the 2.3 : 1 machine would then overflow the width); filling 90% of the whole canvas (the readouts and tools would cover the machine's ends).

### U11 — The drum and carry views are inside views; the machine keeps working

The stepped drum and the carry sit inside the case and behind the carriage's front, so a camera view alone would show the case. These two views are **inside views**, in free play and in a lesson alike (U13): besides flying the camera they hide the case, open the carriage front, highlight their parts (the units drum, its rack and its result wheel; the first four carry stores, result wheels and carry levers) and fade everything else, as a lesson step does. The Case chip shows the case is off and can put it back; the status line says it is an inside view.

- **The machine works as usual.** An inside view changes how parts are drawn, not where they are, so every control stays enabled: watching the drum turn and the carry pass on is what the views are for. This is the difference from *Take apart*, which moves parts out of their working places and therefore locks the crank and the knobs.
- **Faded parts are context, not obstacles:** clicks and hover labels pass through them, so a drum or a wheel can be pointed at and clicked through a faded frame.
- **It ends when the reader chooses another view or Reset view:** the front closes, fading stops and the case goes back to how it was. If the reader switched the case themselves meanwhile, it is theirs and is left as they set it. Turning or zooming the camera does not end it; starting the tutorial or a lesson does, and the step's presentation takes over.

*Rejected:* locking the controls in an inside view (it would hide the very motion it exists to show); a clipping plane through the case and carriage (clearer, but it belongs to the 3D quality work; it would follow the same rules).

### U12 — Fading keeps what the step asks you to see, digits included

Fading (in an inside view, U13, U14) fades everything except what the step or view is about. A step names the parts it highlights, but the model splits some parts from the digits you read on them, so fading "everything not highlighted" faded the digits too (the windows' plate stayed, the 16 result digits behind it faded). Fading therefore keeps three things:

- **The highlighted parts.** They glow, in any view.
- **Their readouts,** kept as they are, without the glow: the result wheels behind the windows, the dial around each knob, and the Magna Rota's plate with the stop where its red number is read. This is one table in the scene code, so every step, every inside view and every later lesson gets it.
- **The step's context:** parts the text needs to be seen working but does not single out. The carry lever step keeps the stores and wheels it acts on, and the carry store step keeps the wheels they sit behind.

Acceptance check A3-12 holds every step and every inside view to this.

### U13 — A step names its subject and its view; the view clears the way

Three things used to be mixed up under "focus". They are separate:

1. **The subject:** the parts the step is about. A step names them (`highlight`), and they glow.
2. **The camera:** where we look from. A step names a view, and the view frames its subject (U10).
3. **Clearing the way:** hiding the case, opening the carriage front and fading the other parts. This only matters when the subject sits inside the machine, where the camera alone would show the case.

Clearing the way follows from the view, not from the step. The drum and carry views are the **inside views**: their subject is inside. They hide the case, open the front and fade the others, both in free play (U11) and in a lesson. Every other view shows the machine closed, with nothing faded. The view decides rather than the part, because the same part can be outside from one view and inside from another. The result wheels' digits show through the windows from the register view, with nothing faded; their gears need the drum view.

- **Steps no longer set the case, the front or fading.** They name the subject and the view (and when the machine is taken apart, and the labels), and the rest follows. No step's case, front or fading carries over from an earlier one. Of the 64 steps, every one with the case hidden was already in the drum or carry view, so the case comes out as before. Fading now comes on in all of them, where some had it off: Add 6, Carry 3–5 and 8, and Subtract 3.
- **The Views menu works the same in a lesson as in free play.** Choosing the drum or carry view during a step makes it an inside view: it fades around the step's subject if the step uses that view, or else around the view's own parts. Choosing another view ends it and puts the tools back, also when the step itself was in an inside view, so the machine closes again. *Reset view* in a lesson goes back to the step's own view and presentation; in free play it goes to the overview.
- **Show case stays a manual override,** in any step or view. The next step, Reset view, or an inside view sets it again. The front and fading have no switches any more (U14).
- **Acceptance check A3-13** holds lessons to this. A step that highlights a part inside the case must use an inside view (unless the machine is taken apart), an inside view must have a subject, and every step's case, front and fading follow its view.

*Rejected:* deciding by part ("every internal part fades the rest"). Parts like the result wheels are both outside and inside, and the camera is what decides whether something is in the way.

### U14 — Only the case and taking apart are chips; the view does the rest

Once the view decides the case, the front and fading (U13), the Open front and Fade others chips only undid or redid what the view had already got right. Each one could also leave the page out of step with its view. Both are gone, and the stage tools are **Case** and **Take apart**, beside the Views menu and Reset view. (U15 then moves both into the Views menu.)

- **The front is open, and the other parts are faded, exactly while an inside view is on**, whether a step or the Views menu set it. Another view or Reset view ends it. Orbiting does not.
- **Case stays.** It isn't tied to a subject: in free play it lets the reader look at the whole mechanism working, for example the overview with the case off. In an inside view it puts the case back as a faded shell, if the reader wants it.
- **Take apart stays.** It moves parts rather than hiding them, and it locks the controls (U11).
- **What is lost:** seeing an inside view's subject unfaded among solid parts, or fading around a subject in an outside view. Orbiting a faded view shows where the subject sits. Outside views' subjects are in plain sight, and their glow is enough.
- **Nothing shows the inside view as a pressed chip any more,** so the status line still announces it, and the open machine shows it.

*Rejected:* dropping the Case chip as well (it is the one way to see the whole mechanism at once, outside the inside views).

### U15 — One view menu at the top right: seven views, a case switch, and Reset

Taking apart is a way of looking at the machine, like the close-ups: it has its own best camera, and it never combines well with the other views (taken apart *and* faded would be a mess). So it is a view, **Taken apart**, and the view controls gather in one place at the stage's top right, where Blender and Unity put theirs:

```
[⌂] [🎥 Stepped drum ▾]       ⌂ = Reset view
      Whole machine
      Taken apart
      ─────────────
      Result
      Setting knobs
      Magna Rota
      ── INSIDE ───
      Stepped drum
      Carry
      ─────────────
      ☑ Show case
```

- **The button names the view on show** (the current one is ticked in the menu), since no pressed chip shows the state any more. On a phone it shrinks to its icons.
- **Taken apart flies to its own framing** (U10, fitted to the parts in their taken-apart places) while the parts move out, so it always shows from a good angle, whatever the reader did to the camera. It locks the crank and the knobs (P6); the status line says to choose another view to put the machine back together. Any other view puts it together. In a lesson the step names `view: "apart"`, so steps now name only a subject and a view; it is refused while the machine is moving.
- **Show case is a switch, not a view:** a checkbox at the end of the menu. It is the reader's override (U13, U14).
- **Reset view (⌂) is a separate button, because it means something else than Whole machine.** Whole machine is a place. Reset means "back to where I should be": in free play the whole machine with the case on, in a lesson the step's own view and presentation. It is one click, since undoing a bad orbit is the most common camera action.
- **The bottom tool row is gone,** so only the top band limits the free area, and every view frames the machine a little larger (U10).
- **The view stays when a course ends:** closing or finishing a lesson keeps the view on show, as free play shows it.

*Rejected:* keeping Case and Take apart as chips (two controls for what the menu already says); folding Reset into Whole machine (in a lesson they differ).

### U16 — The cranks turn either way: drag them round, or Shift-click

A click on the main crank turned it forward, and a click on the end crank shifted the carriage left. The other ways were only in the toolbar, and the one-way crank taught the wrong thing: on the real machine, the way you turn the crank is what decides between adding and subtracting.

- **Drag a crank round its axle.** Pressing on a crank grabs it, rather than turning the camera, and dragging it about 30° round one way (and at least 10 pixels) commits one full turn that way. Forward adds and backward subtracts. For the end crank, the two ways shift the carriage left and right. One drag makes one turn; the next turn needs a new drag. The turn then plays as from the toolbar, so a crank is never left half-turned in the middle of a carry.
- **How the angle is read:** the grabbed point moves on a circle round the axle. The pointer's ray meets that circle's plane, and the angle it sweeps there, signed by the crank's axis, is how far the crank has been turned. That works from any view in which the plane is not seen exactly edge-on. Forward is the way the rig turns the crank as the machine adds, or as the carriage goes left.
- **A click keeps its quick action** (forward, or left), and **Shift-click** goes the other way. The hover hint says all three, and changes as Shift is pressed. The cursor shows a hand over a crank, and a closed hand while it is held. The Get started panel names the drag too, since a touch screen has no hover.
- **The same rules as the toolbar:** a drag or Shift-click resolves to the same operation as Add, Subtract or the carriage arrows, so locks and lesson rules apply. A crank that cannot turn either way now is not grabbed, and the drag turns the camera instead. A drag the way a lesson step does not allow, or against a carriage end or a full carry store, is refused, and the status line says why.
- **Acceptance checks:** A3-11 clicks and Shift-clicks both cranks on the model. A3-15 turns each crank 40° each way with the rig, from two views, and checks that the drag reads the same angle and sign.

*Rejected:* ↻ and ↺ buttons beside the crank (controls floating in the scene, against U14 and U15); following the pointer turn by turn (a part-turn would stop in the middle of a carry); Shift-click alone (invisible, and impossible on a touch screen).

### U17 — The dock resizes by its own edge

The dock had a fixed size, so the reader could not give the machine more room, or the lesson text more. Now the dock's own edge is a resize handle: its left edge while it stands beside the machine, its top edge while it lies below.

- **Below the machine it is a grab pill on the dock's top border,** like a phone's bottom sheet. The machine area above it is one block (the 3D view with its toolbar, U18), so the handle separates two regions, not a control from what it controls. Beside the machine the pill shows on hover and focus.
- **Drag it, or move it with the arrow keys** (Shift for bigger steps; Home and End for the smallest and largest). Double-click or Enter returns the default size.
- **The size is remembered for each layout,** beside and below, and clamped to the window as it changes. The dock keeps at least 300 px beside or 160 px below; the machine area keeps at least 360 px wide or 220 px tall.
- **Dragged well past its smallest size** (by 60 px), the dock closes, as with the top bar's dock button. Its remembered size is kept for when it opens again.
- **The 3D view refits as the dock moves** (U10).
- It is a focusable separator (WAI-ARIA window splitter) that reports its size. Its tooltip says how to use it.

### U18 — The toolbar floats under the machine, and the lesson brings its control

With the dock on the right, the toolbar ran the full width under the stage, left-aligned, at the window's bottom-left corner: far from the machine, centred above it, and from the lesson text in the dock.

- **The toolbar floats at the stage's bottom, centred under the machine,** as a compact bar like the view controls at the top right. It sits where the reader is already looking, and the 3D view gets the full height. The framing (U10) keeps the machine clear of it, and refits when the bar re-wraps (a longer language, a narrower stage). It wraps to two rows when the stage is narrow, and shows icons with tooltips on a phone.
- **A step's task line shows the controls it asks for,** for example "Your turn [↻ Add]". Each button works the toolbar's own control, so the same locks, lesson rules and reasons apply (P6). It is greyed when that control is, and the toolbar still makes the asked-for control glow. In a lesson, the moment the reader most often hunts for a control, their eyes can stay in the dock. The number box is a button that puts the cursor in the toolbar's number field.

*Rejected:* the controls in the top band beside the readouts (it would crowd the band that holds the numbers and the camera: top is state and camera, bottom is acting); the controls inside the dock (in free play the dock may be closed).

### U19 — The number box sets the knobs as you type

The number typed into the box under the machine reached the knobs only on Enter, Tab or leaving the box: a hidden step, and on a phone, where there is no Tab and Enter is a keyboard key labelled "Return", not an obvious one.

- **The knobs follow every keystroke.** Typing 3 turns the units knob to 3, typing 30 brings the tens knob in. It is direct manipulation, like the machine itself, and the same as the other way round: clicking a knob updates the box at once.
- **The status line waits** about 0.6 s after the last keystroke before it says "Knobs set to 30" (and, in a lesson, whether the step is done), so it does not change with each digit, and a screen reader does not read each one out. Enter, Tab or leaving the box says it at once.
- **Lesson tasks** check the machine as it is, so the digits on the way to the number asked for are not mistakes: a "set 20" task is done when the box reads 20.
- **On a phone** the keyboard is numeric, and its Enter key reads "Done" (`enterkeyhint`) and puts the keyboard away. On a computer Enter selects the number for the next one.
- **Unchanged:** non-digits are dropped, at most 8 digits (one per knob), an empty box sets 0, and while the machine turns, or when a step does not use the knobs, typing is refused with the reason (P6).

*Rejected:* a Set button beside the box (one more step, and a button next to Add and Subtract suggests that setting the knobs calculates something).

### U20 — The crank's two buttons: its turning icons with + and −, an equal pair

The buttons were labelled Add and Subtract, and Add was filled (the main action, in Material) while Subtract was tonal, so they looked like one active and one inactive button, which they are not. The words were also long in some languages ("Addieren / Subtrahieren", "Additionner / Soustraire").

- **The labels are the crank's turning icon and the sign of what the turn does,** ↻ + and ↺ −. The signs are the same in every language, so the buttons are equally short in all ten. The icons keep them from reading as "make the number bigger or smaller": they say "turn forward: add", as the machine does (U16). The words stay in the tooltip and the accessible name ("Turn the crank forward once: adds the number on the knobs"). The minus is the true minus sign (−), larger than the body text.
- **They are one joined pair, alike:** one crank, two ways. The carriage's left and right arrows are a joined pair too, with its place between them.
- **The toolbar is consistent:** every machine operation is a tonal button. None looks like the default or the active one; in a lesson the step's own control is marked by the glow and its task-line button (U18). Reset, which clears the machine, is the one quiet text button, at the end.
- **The texts that named the buttons say "press +" or "press −"** (in the tutorial and the subtraction lesson, and in Get started), and the task line shows the same ↻ + and ↺ −.

*Rejected:* "Add" and "Sub" (only shortens English; "Sub" means nothing, or something else, in most of our languages); signs without the crank icons (a bare − reads as "smaller" or "remove").

### U21 — The carriage control is boxed and named like the number box, and counts whole places

Its name, "Carriage", was loose text in a third size, smaller than the toolbar's other labels, and it disappeared on a narrower stage, leaving its arrows unnamed. While the carriage moved, its place read 1.2, 1.3, 1.4…, which means nothing to the reader: the carriage works only at a whole place.

- **The place is a value in an outlined box, like the number box and the pin's hole,** with "Carriage" on its border in the same caption style. The left and right arrows are joined to the box's two edges, at the box's full height and with one outer corner shape, as Run to stop is joined to the pin's box (U23). (A first version put smaller buttons inside the box; their corners clashed with the box's, and they stood lower than every other control.) A border label takes no width, so it stays at every size. The boxes read as a set: what is set on the knobs, where the carriage stands, and the pin's hole.
- **Only whole places are shown,** in the toolbar and in the Carriage readout. The number is the last place the carriage has reached: a one-place shift changes it when the carriage arrives, and a longer move (clicking a result wheel) counts up or down place by place as the carriage passes them, like an odometer. The moving carriage in the 3D view shows the motion itself.

### U22 — The pin is a dropdown box: what is set is a box, what is done is a button

The pin control was a tonal button with a circled-dot icon (meant as "a pin in a hole", read as a radio or a record button) and no sign that it opens a list, although it does: the pin out, or holes 1 to 9.

- **It is an outlined dropdown, boxed and named like the number box and the carriage (U21):** "Pin" on its border, the hole inside ("–" when the pin is out), and a ▾. The dot icon is gone. Its border lights while its menu is open.
- **One rule for the toolbar:** what the reader *sets* is a box with its name on the border (the number on the knobs, the carriage's place, the pin's hole); what they *do* is a button (+ and −, run to stop, reset). The pin box and Run to stop stay side by side: one sets the stop, the other runs to it.
- **Its menu** lists "Out", then the holes 1 to 9 under a "Hole" heading, with the current one ticked. Its accessible name says the setting ("Pin: hole 5", "Pin: out"), and its tooltip what the pin does (the crank stops after that many turns).

### U23 — Run to stop is an icon, joined to the pin's box

Run to stop showed ⏩ and its words. The icon read as a video's fast-forward, and the words took room for a control that does something only once a pin is in.

- **It is icon only, with →| (an arrow running into a bar): turn until the stop.**
- **It is joined to the pin's box, like a split button:** the box sets the stop, the button runs the crank to it. On its own an icon is a guess; attached to "Pin" its meaning comes from the box. It is greyed exactly when the box shows "–", and says why when pressed (P6).
- **Its name stays** in the tooltip and the accessible name ("Turn the crank forward until the pin reaches the stop"), and the lesson task line still shows it with its words (U18).
- **Reset keeps its word where there is room** (it drops to its icon on a narrow stage). Its ⟳ is easily taken for the view's Reset (⌂), and it clears the machine, so the word guards against a slip.

### U24 — The 3D view by keyboard, and zoom buttons

The wheel, a trackpad's pinch and a touch screen's pinch zoom the 3D view, within a nearest and a farthest distance. Two gaps remained. The 3D view could not be used by keyboard at all, the one exception to "every control reachable with Tab". And classroom boards and projector touch screens often pass neither a wheel nor a pinch through, while some readers never find the pinch.

- **The 3D view takes the keyboard's focus** (Tab reaches it; its ring sits just inside the stage). While it has the focus:
  - the arrow keys turn it, each as dragging that way does (8° a press; up and down within the same limits as the mouse, never from underneath);
  - Shift and the arrow keys move it;
  - + and − zoom (also = and the underscore, so no Shift is needed);
  - Home resets the view, as ⌂ does.

  Each press is a short animated step. Keys act only while the 3D view has the focus, so typing a number is never affected, and the browser's own Ctrl/⌘ shortcuts pass through. Its accessible name lists the keys, and the Get started panel names them too.
- **A joined − / + pair** sits in the view controls at the top right, between ⌂ and the Views menu. Each press zooms by a factor of 1.25 towards the orbit's centre, in a short flight. A button greys at its limit; the limits are checked as the camera moves, whatever moved it.
- **A step by key or button is the reader's camera,** like a drag (U10): a resize no longer refits the view, and Reset view brings it back.

*Rejected:* double-click or double-tap to zoom (a click on the machine already works its knobs and crank, so a double-click would turn a knob twice).

### U25 — A wide dock lays its tabs out in a row

The dock's three tabs stack each icon above its label. That suits a narrow dock beside the machine, but a wide dock has room to spare across and is short of height, especially below the machine, where a thinner tab bar leaves more room for the lesson.

- **When the dock is about 480 px or wider, each tab's icon sits beside its label,** and the tab bar is 42 px tall instead of 60. Narrower, the tabs stack as before.
- **It goes by the dock's own width,** not by where the dock is: a dock dragged wide beside the machine (U17) gets the row too, and a phone's dock below the machine (about 375 px) keeps the stacked tabs. In practice the row appears below the machine from tablets up, and beside it once the dock is widened.
- **All ten languages fit at the narrowest row width.** The longest labels (Portuguese) leave 8 px to spare; the "lesson under way" dot sits after the label. The selected tab keeps its bar, and the keys are unchanged.

### U26 — A step is a card that adapts to the dock's width

In a wide dock (below the machine on a large screen), a step looked unfinished. Its picture sat letterboxed in a dark band across the full width, the text ran to about 150 characters a line, and Next ended up far from the content.

- **A step is one card:** its picture, its text and its task line together. Back and Next sit under the card.
- **The picture keeps its own shape,** never letterboxed, with rounded corners and its credit underneath.
- **The card adapts to the dock's own width:** below about 640 px the picture sits above the text, the full width of the card; wider, it sits beside the text (two fifths and three fifths), up to 320 px tall. A tall picture, such as the 1727 engraving, stays upright beside the text.
- **Text keeps a reading measure:** a step's text is at most about 68 characters a line, and every panel's content (Get started, the lessons, the references, a step) is centred at no more than 960 px in a wide dock.

### U27 — The mode is in the top bar: where you are, and the way back

Free play or a lesson was shown only by a small tag at the right end of the status bar, which new readers did not notice. The only way back to free play was the small ✕ in the lesson's header. A reader who had started a lesson could not tell why controls were greyed, or how to get out.

- **The top bar shows the mode, always, beside the title.** It is where an app shows its overall state, and the first place people look. The mode is the whole app's state (the dock, the camera, which controls work, the machine's starting state), not the toolbar's, and the toolbar has no room left.
- **In free play, a quiet chip "Free play ▾".** Its menu offers "Resume: *lesson*, step *i* of *n*" when a lesson was left unfinished, "Start the tutorial" (or "again"), and "Choose a lesson…". Each of these brings the dock forward, opening it if it was closed.
- **In a lesson, a blue chip with the lesson and the step** ("The carry: 9999 + 1 · 3/9"), which brings the lesson's tab forward, **joined to "✕ Free play"**, which leaves it. The ✕ in the lesson's header stays as a second way.
- **Leaving keeps the place:** a lesson left unfinished is remembered at its step, so the reader can step out to try something and come back. Resuming sets the machine as that step starts. One lesson is remembered at a time; finishing it, or starting it afresh, forgets it.
- **The refusal says where the way out is:** a control a step does not use answers "…To use it freely, leave the lesson for free play (top bar)."
- **On a phone** the bar cannot grow a second row (height is what a phone lacks), so it frees room instead: the title text goes (the logo stays; the full title is the page's title and is in About), the language button shows only its 文A (the current language is ticked in its menu), and a lesson shows only its step ("3/9", its name is in the dock's header) beside the ✕. Under 360 px the free-play chip also drops its icon, keeping its words and ▾. The mode's text is the one part of the bar that may shorten (with "…"); the ✕ never does. Checked in all ten languages at 320 and 375 px.
- **The status bar's mode tag is gone;** the status line keeps its messages.

## Part 4 — Open questions

- The link format (P8): which fields the first release promises (language, lesson and step, numbers on the machine).
- A light theme.
- A teacher's view (all lessons unlocked, notes per lesson).
