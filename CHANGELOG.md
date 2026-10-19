# Changelog

What changed in each release. Versions follow `package.json` and are tagged `vX.Y.Z` ([docs/development.md](docs/development.md), *Versions and releases*). The design decisions cited (U1, U2, …) are in [docs/ui-design.md](docs/ui-design.md).

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
- A right-click or middle-click on a part no longer works it.
- A lesson left for another, or by reloading the page, is remembered at its step.
- A lesson step that sets the machine up is silent, as setting up is (U29).
- Keyboard and screen reader: the focus stays on Next and Back from step to step, and a task's buttons keep it while the machine moves; the step's progress, the visible labels of Reset, the number box and the lesson chip, and the readouts are named; the mute button has one name for each state; the number box looks greyed when it is.
- A browser too old for the page says so, instead of loading for ever.
- The page no longer loads the acceptance checks' code (three-mesh-bvh) when it starts; highlighting reuses its materials instead of making new ones at every step.
- Translations: corrections in Korean, Portuguese, German, Italian, Japanese, Traditional and Simplified Chinese, Spanish and French, and the tutorial's and the lessons' "Completed" each in its own grammatical gender.
- `pnpm build:model` and `pnpm check:model` fail when a Blender script fails (they always passed), and take Blender's path from `$BLENDER`. The site is deployed only once the tests pass on `main`.

## 0.0.1

The prototype: the full machine modelled and checked (milestones M0–M2), and a first teaching page with four lessons in English and German (M3).
