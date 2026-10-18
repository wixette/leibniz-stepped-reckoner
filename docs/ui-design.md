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
- **Keyboard first-class:** every control is reachable with Tab, has a visible focus ring, and the dock's tabs follow the WAI-ARIA tabs pattern.
- **Motion is short and optional:** camera flights and panel transitions honour `prefers-reduced-motion`.

## Part 2 — The layout

```
┌ [logo] Leibniz's Calculating Machine                      [dock] [文A EN ▾] [ⓘ] ┐  top bar
├──────────────────────────────────────────────────────┬───────────────────────────┤
│ RESULT 0 000 000 010 000   TURNS 1   PLACE 0   [views▾]│ Get started│Lessons│Refs │  dock tabs
│                                                      │ ┌───────────────────────┐ │
│                 THE MACHINE (3D stage)               │ │ Lesson 2 · The carry  │ │
│                                                      │ │ ●●●○○○○○  step 3 of 8 │ │
│   [case] [open front] [take apart] [focus]   [⟲ view]│ │ Behind each result... │ │
├──────────────────────────────────────────────────────┤ │ ▸ Your turn: set 1    │ │
│ [ 00000001 ]  [↻ +][↺ −]  [◀ carriage ▶]  pin [–▾] [⇥ to stop] [reset]          │  machine strip
├──────────────────────────────────────────────────────┴───────────────────────────┤
│ The ribs added 1 to the units: 9 → 0, and the carry is stored.   Lesson 2 · 3/8  │  status bar
└──────────────────────────────────────────────────────────────────────────────────┘
```

On a narrow (under 900 px) or portrait window the same regions stack: top bar, stage, machine strip, dock, status bar. The dock then takes the lower part and scrolls.

## Part 3 — Decisions

### U1 — Desktop first: the dock on the right of a wide window, below on a narrow one

The page is a fixed frame: top bar, stage, machine strip, dock, status bar; the page itself never scrolls. On a wide (landscape, 900 px or more) window the dock sits to the right of the stage, 360–440 px wide, and can be closed from the top bar; the stage takes the rest. On a narrow or portrait window the dock goes below the machine strip. Either way the stage keeps a shape not far from square, which suits a 3D view that also flies to close-ups.

*Why on the right, unlike the 8800 simulator (dock below):* the 8800's panel is a flat 2.24 : 1 picture, so the room it leaves is underneath. Our machine, seen whole, is about 2.3 : 1, so its size on a wide screen is limited by the stage's *height*. A dock below takes height: on a 1366 × 768 Chromebook it leaves the machine about 620 px wide, against about 900 px with the dock on the right (and about 1,070 against 1,400 px on a 1920 × 1080 screen). The close-up views (drum, carry, Magna Rota) are nearly square subjects, and lesson text reads better in a column than in a wide strip. *Rejected:* dock below on wide screens (letterboxes the 3D view); a floating lesson card over the stage (breaks P1).

### U2 — Free play is the home; the tutorial and lessons are modes over it

Opening the page gives a working machine at once: every control enabled, nothing to choose first. The dock opens on *Get started* the first time (and on the reader's last tab after that), inviting the tutorial without blocking the machine.

Starting the tutorial or a lesson enters **course mode**: the step player takes the dock, the machine strip greys the controls the current step does not use (P6, the status line says why), and the status bar shows where you are. Leaving (Close, Finish, or opening another lesson) returns to free play with the machine as it is.

### U3 — Three dock tabs: Get started, Lessons, References

- **Get started**: the tutorial in three short chapters: *What is it?* (the machine's story, with historical pictures), *What's inside?* (a tour of the parts in 3D, taking it apart), *Your first sum* (2 + 3, done by the reader).
- **Lessons**: a path of six lessons, each building on the one before (U6), with progress ticks remembered in the browser.
- **References**: where to see the machine and read more, grouped, each link with one line on why it is worth a click.

Free play has no tab: its controls are the machine strip, under the machine (P2).

### U4 — The machine strip and the stage's own tools

- **Machine strip** (under the stage): the number on the setting knobs, turn forward (add) and back (subtract), carriage left and right with its place, the Magna Rota's pin, turn to the stop, reset. Icon plus short label on wide screens, icons with tooltips on narrow ones.
- **Readouts** sit on the stage's top edge: the result as on the machine, grouped in threes; the Magna Rota's turn count (red when subtracting); the carriage's place.
- **Stage tools** float on the stage's bottom edge: show the case, open the carriage front, take apart, fade the other parts; a views menu (the six camera views) and a reset-view button. They change how the machine is *shown*, not its state, so they stay enabled in a lesson, except where a step depends on them.

### U5 — A dark Material 3 theme in brass and oak

A dark scheme (the 8800's family) with a brass-gold primary and a warm neutral surface, so the oak and brass of the model are the brightest things on screen. Type is Roboto Flex (Latin, Latin Extended, Greek, Cyrillic; CJK falls back to the system's Noto/PingFang/Hiragino/Malgun), with tabular figures for every number. *Rejected:* a light theme for now (the 3D stage reads better on dark; open question).

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

Orbit by dragging, pan with the right button or two fingers, zoom with the wheel or a pinch, damped and limited so the machine cannot be lost; *Reset view* always brings it back. Hovering a part shows its name and live value; a part that can be operated shows a pointer cursor and what a click will do. The model loads with a progress indicator on the stage; until then the strip is greyed with the reason in the status line.

## Part 4 — Open questions

- The link format (P8): which fields the first release promises (language, lesson and step, numbers on the machine).
- A light theme.
- A teacher's view (all lessons unlocked, notes per lesson).
