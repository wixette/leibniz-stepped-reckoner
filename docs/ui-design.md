# UI design

The principles the simulator's page is laid out by, and why. Where a control ends up, and what it looks like, is the code's business. This document holds the rules that decide those things, so that the next change can follow them, or argue with them in the open.

**If a change needs to break a principle, change the principle here first, with its reason.** Decisions are recorded in [Part 2](#part-2--decisions) as U1, U2 and so on, each with what it supersedes and the alternatives rejected, and the code cites them by number.

## Part 1 — Principles

### P1 — The machine is the one primary surface

It is always on screen. Nothing covers it, and nothing pushes it out of view.

*Why:* the machine's windows, dials and wheels *are* its state. Every other view (a cut-away, a lesson, a readout panel) is read against them.

### P2 — A control has one home

If a control is wanted somewhere else, move it, or make both places visible at once. Don't make a second copy.

*Not copies:* operating a part by clicking it in 3D, and the panel control that does the same thing. They are two ways to the same operation, and follow the same rules.

### P3 — Tools in one place, one at a time

Lessons, readouts and other instruments share one area beside or under the machine. The reader chooses which one it shows, and whether it is open.

### P4 — Occasional actions go in menus and dialogs

Space that is always there is for things that change while you watch. Things done once a session (choosing a lesson, a language, sharing a link, About) go in the toolbar.

### P5 — Each surface keeps its voice

The machine's own markings (the digits on its wheels and dials) stay as on the machine, and are not translated. The instrument around it (toolbar, lessons, labels) is translated.

### P6 — Unavailable is greyed and explained, never hidden

A control that cannot be used right now stays where it is, greyed, and when used it answers in the status line with the reason: the crank is locked while the machine is taken apart; the pin is on the stop.

### P7 — One status line, always visible

It says what just happened, and why something is greyed.

### P8 — A link is a public contract

A link that opens the simulator in a state (a lesson step, numbers on the machine, a language) ends up in worksheets nobody edits again. Once the format is released, fields may be added, but an existing field is never renamed, dropped or read differently. The format lives in one module with nothing of the page in it, and its own test pins it down.

### P9 — A phone gets the same app

Same regions, same order. Nothing depends on hover or on a precise drag: a single tap does what a click does.

### P10 — One component for each kind of thing

Menu, dialog, icon button, empty state: each kind of control is one component, used the same way everywhere. These are Material Design's patterns, not its look.

Also:
- **Icons are inline SVG.** No icon fonts, and no fonts from a CDN: the page must not need the network.
- **Every icon button has a tooltip and a screen-reader name**, both translated.

## Part 2 — Decisions

None yet.

## Part 3 — Open questions

- The layout on a phone (P9).
- The link format (P8): which fields the first release promises.
