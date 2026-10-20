// The getting-started tutorial (docs/ui-design.md, U3): three short chapters, as a lesson
// the same player runs, with pictures in the first chapter. A3-1 checks its texts in every
// language, A3-2 runs it headless, A3-4 checks its learner tasks.

import { setInput } from "./lessons.js";
/** @import { Lesson } from "./player.js" */

/** @type {Lesson} */
export const TUTORIAL = {
  id: "tutorial",
  title: "tut.title",
  summary: "tut.summary",
  steps: [
    // 1 · What is it?
    {
      chapter: "tut.ch1",
      do: [{ reset: {} }],
      view: "overview",
      image: { file: "images/tutorial/original.jpg", credit: "img.original" },
      text: "tut.what",
    },
    { image: { file: "images/tutorial/leupold-1727.jpg", credit: "img.leupold" }, text: "tut.four" },
    { image: { file: "images/tutorial/stepped-drum.jpg", credit: "img.drum" }, text: "tut.drum" },
    { image: { file: "images/tutorial/replica.jpg", credit: "img.replica" }, text: "tut.model" },
    // 2 · What's inside?
    {
      chapter: "tut.ch2",
      view: "apart",
      callouts: [
        { node: "pi.sum_wheel.10", text: "tut.register", value: false },
        { node: "pm.drum.5", text: "part.carriage", value: false },
        { node: "pm.magna_rota", text: "part.magna", value: false },
      ],
      text: "tut.twoParts",
    },
    { view: "register", highlight: ["pi.window"], text: "tut.windows" },
    { view: "knobs", highlight: ["pm.setting_dial.*"], text: "tut.knobs" },
    {
      view: "drum",
      highlight: ["pm.drum.0", "pi.sum_wheel.0"],
      callouts: [{ node: "pm.drum.0", text: "part.drum" }],
      text: "tut.inside",
    },
    {
      view: "front",
      highlight: ["pm.main_crank", "pm.magna_rota"],
      callouts: [{ node: "pm.main_crank", text: "part.mainCrank" }],
      text: "tut.crank",
    },
    { view: "overview", text: "tut.lookAround" },
    // 3 · Your first sum
    { chapter: "tut.ch3", do: [{ reset: {} }], view: "knobs", highlight: ["pm.setting_dial.0"], text: "tut.set2", task: setInput(2, 20) },
    {
      view: "overview",
      highlight: ["pm.main_crank"],
      text: "tut.turn",
      task: { check: (m) => m.turns === 1 && m.shownNumber() === 2, solve: (m) => m.turn(1), wrong: (m) => m.turn(-1), controls: ["add"] },
    },
    { view: "knobs", highlight: ["pm.setting_dial.0"], text: "tut.set3", task: setInput(3, 30) },
    {
      view: "overview",
      highlight: ["pm.main_crank"],
      text: "tut.turnAgain",
      task: { check: (m) => m.turns === 2 && m.shownNumber() === 5, solve: (m) => m.turn(1), wrong: (m) => m.turn(-1), controls: ["add"] },
    },
    { view: "register", highlight: ["pi.window"], text: "tut.done" },
  ],
  finalCheck: (m) => m.shownNumber() === 5 && m.turns === 2,
};
