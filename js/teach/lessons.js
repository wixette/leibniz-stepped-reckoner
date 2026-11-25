// The lessons (docs/ui-design.md, U6), as data: a path of six, each building on the one
// before. Texts are message keys (js/l10n/*.js); A3-1 checks that every key exists in every
// language, A3-2 runs every lesson headless, A3-4 checks the learner tasks, A3-6 the
// visibility of what each step shows.

/** @import { Machine } from "../sim/machine.js" */
import { registerValue } from "../sim/operations.js";
/** @import { Lesson, Task } from "./player.js" */

/** @param {Machine} m */
export const settingNumber = (m) => m.settings.reduce((a, s, i) => a + s * 10 ** i, 0);
/** @param {Machine} m */
const allLevel = (m) => m.pending.every((p) => p === 0);

/**
 * @param {number} n
 * @param {number} wrong
 * @returns {Task}
 */
export const setInput = (n, wrong) => ({
  check: (m) => settingNumber(m) === n,
  solve: (m) => m.setNumber(n),
  wrong: (m) => m.setNumber(wrong),
  controls: ["input"],
});

/**
 * @param {number} o
 * @param {number} wrong
 * @returns {Task}
 */
const shiftTo = (o, wrong) => ({
  check: (m) => m.offset === o,
  solve: (m) => m.setOffset(o),
  wrong: (m) => m.setOffset(wrong),
  controls: ["shift"],
});

/**
 * One forward turn that must leave the register showing a number, after `turns` turns.
 * @param {number} shown
 * @param {number} turns
 * @returns {Task}
 */
const turnTo = (shown, turns) => ({
  check: (m) => m.turns === turns && m.shownNumber() === shown,
  solve: (m) => m.turn(1),
  wrong: (m) => m.turn(-1),
  controls: ["add"],
});

// ---------------------------------------------------------------------------------------------
/** @type {Lesson} */
const add = {
  id: "add",
  title: "l.add.title",
  summary: "l.add.summary",
  steps: [
    { do: [{ reset: {} }], view: "knobs", highlight: ["pm.setting_dial.*"], text: "l.add.intro" },
    { highlight: ["pm.setting_dial.0"], text: "l.add.set3", task: setInput(3, 30) },
    {
      view: "drum",
      highlight: ["pm.drum.0", "pi.sum_wheel.0", "pm.setting_rack.0"],
      callouts: [
        { node: "pm.drum.0", text: "part.drum" },
        { node: "pi.sum_wheel.0", text: "part.wheel" },
      ],
      text: "l.add.inside",
    },
    { do: [{ theta: 200 }], highlight: ["pm.drum.0", "pi.sum_wheel.0"], text: "l.add.turning", expect: (m) => m.theta === 200 },
    { do: [{ theta: 360 }], highlight: ["pi.sum_wheel.0"], text: "l.add.fullTurn", expect: (m) => m.shownDigits()[0] === 3 && m.turns === 1 },
    {
      highlight: ["pm.drum.0", "pi.sum_wheel.0"],
      text: "l.add.yourTurn",
      task: {
        check: (m) => m.turns === 2 && m.shownNumber() === 8,
        solve: (m) => {
          m.setNumber(5);
          m.turn(1);
        },
        wrong: (m) => {
          m.setNumber(5);
          m.turn(-1);
        },
        controls: ["input", "add"],
      },
    },
    { view: "register", highlight: ["pi.window"], text: "l.add.eight" },
    {
      do: [{ reset: {} }],
      view: "overview",
      highlight: ["pm.setting_dial.*"],
      text: "l.add.wholeNumber",
      task: {
        check: (m) => m.turns === 1 && m.shownNumber() === 1234,
        solve: (m) => {
          m.setNumber(1234);
          m.turn(1);
        },
        wrong: (m) => {
          m.setNumber(1243);
          m.turn(1);
        },
        controls: ["input", "add"],
      },
    },
    { view: "register", highlight: ["pi.window"], text: "l.add.recap", expect: (m) => m.shownNumber() === 1234 },
  ],
  finalCheck: (m) => m.shownNumber() === 1234 && m.turns === 1,
};

// ---------------------------------------------------------------------------------------------
/** @type {Lesson} */
const carry = {
  id: "carry",
  title: "l.carry.title",
  summary: "l.carry.summary",
  steps: [
    { do: [{ reset: { result: 9999 } }], view: "register", highlight: ["pi.window"], text: "l.carry.intro" },
    { view: "knobs", highlight: ["pm.setting_dial.0"], text: "l.carry.set1", task: setInput(1, 10) },
    {
      view: "carry",
      highlight: ["pi.carry_store.0", "pi.carry_store.1", "pi.carry_store.2", "pi.carry_store.3"],
      context: ["pi.sum_wheel.0", "pi.sum_wheel.1", "pi.sum_wheel.2", "pi.sum_wheel.3"],
      callouts: [{ node: "pi.carry_store.0", text: "l.carry.pentagonUnits" }],
      text: "l.carry.stores",
    },
    {
      do: [{ theta: 285 }],
      highlight: ["pi.sum_wheel.0", "pi.carry_store.0"],
      text: "l.carry.stored",
      expect: (m) => m.carryStates()[0] === "stored" && m.shownDigits()[0] === 0,
    },
    {
      do: [{ theta: 360 }],
      highlight: ["pm.zweihorn.0", "pm.zweihorn.1", "pm.zweihorn.2", "pm.zweihorn.3"],
      context: [0, 1, 2, 3, 4].flatMap((k) => [`pi.carry_store.${k}`, `pi.sum_wheel.${k}`]),
      callouts: [{ node: "pm.zweihorn.0", text: "l.carry.lever" }],
      text: "l.carry.passedOn",
      expect: (m) => m.shownNumber() === 10000 && allLevel(m),
    },
    { view: "register", highlight: ["pi.window"], text: "l.carry.idea" },
    {
      do: [{ reset: { result: 99 } }],
      view: "knobs",
      highlight: ["pm.setting_dial.*"],
      text: "l.carry.yourTurn",
      task: {
        check: (m) => m.turns === 1 && m.shownNumber() === 100 && allLevel(m),
        solve: (m) => {
          m.setNumber(1);
          m.turn(1);
        },
        wrong: (m) => {
          m.setNumber(10);
          m.turn(1);
        },
        controls: ["input", "add"],
      },
    },
    { view: "register", highlight: ["pi.window"], text: "l.carry.recap", expect: (m) => m.shownNumber() === 100 && allLevel(m) },
  ],
  finalCheck: (m) => m.shownNumber() === 100 && allLevel(m),
};

// ---------------------------------------------------------------------------------------------
/**
 * The original's carry (decisions 0001, 0002): all levers at once, so a carry made by a carry
 * waits, and idle turns with 0 on the knobs finish it, two places a turn.
 * @type {Lesson}
 */
const carryOriginal = {
  id: "carryOriginal",
  title: "l.orig.title",
  summary: "l.orig.summary",
  steps: [
    // The original (decision 0001): the same sum again, step by step, the learner turning the idle turns.
    {
      do: [{ reset: { mode: "simultaneous", result: 9999 } }],
      view: "register",
      highlight: ["pi.window"],
      text: "l.carry.origIntro",
      expect: (m) => m.mode === "simultaneous" && m.shownNumber() === 9999,
    },
    { view: "knobs", highlight: ["pm.setting_dial.0"], text: "l.carry.set1", task: setInput(1, 10) },
    {
      do: [{ theta: 285 }],
      view: "carry",
      highlight: ["pi.sum_wheel.0", "pi.carry_store.0"],
      text: "l.carry.origStored",
      expect: (m) => m.carryStates()[0] === "stored" && m.shownDigits()[0] === 0,
    },
    {
      do: [{ theta: 360 }],
      highlight: ["pi.carry_store.1", "pm.zweihorn.0", "pm.zweihorn.1"],
      context: [0, 1, 2, 3, 4].flatMap((k) => [`pi.carry_store.${k}`, `pi.sum_wheel.${k}`]),
      text: "l.carry.origWaits",
      expect: (m) => m.shownNumber() === 9900 && m.pending[1] === 1,
    },
    {
      view: "carry",
      highlight: ["pi.carry_store.1"],
      text: "l.carry.origIdleTask",
      task: {
        check: (m) => m.shownNumber() === 0 && m.pending[3] === 1,
        solve: (m) => {
          m.setNumber(0);
          m.turn(1);
        },
        wrong: (m) => {
          m.turn(1); // 1 still on the knobs
        },
        controls: ["input", "add"],
      },
    },
    {
      view: "carry",
      highlight: ["pi.carry_store.3"],
      context: [0, 1, 2, 3, 4].flatMap((k) => [`pi.carry_store.${k}`, `pi.sum_wheel.${k}`]),
      text: "l.carry.origTwo",
      expect: (m) => m.shownNumber() === 0 && m.pending[3] === 1,
    },
    {
      view: "carry",
      highlight: ["pi.carry_store.3"],
      text: "l.carry.origDoneTask",
      task: {
        check: (m) => m.shownNumber() === 10000 && allLevel(m),
        solve: (m) => {
          m.turn(1);
        },
        wrong: (m) => {
          m.turn(-1);
        },
        controls: ["add"],
      },
    },
    { view: "register", highlight: ["pi.window"], text: "l.carry.origRecap", expect: (m) => m.shownNumber() === 10000 && allLevel(m) },
    {
      // the toolbar's Carry box (U30): back to the default, the ripple carry
      view: "register",
      text: "l.carry.switch",
      task: {
        check: (m) => m.mode === "ripple",
        solve: (m) => {
          m.setMode("ripple");
        },
        wrong: (m) => {
          m.setMode("simultaneous");
        },
        controls: ["carry"],
      },
    },
  ],
  finalCheck: (m) => m.shownNumber() === 10000 && allLevel(m) && m.mode === "ripple",
};

// ---------------------------------------------------------------------------------------------
/** @type {Lesson} */
const subtract = {
  id: "subtract",
  title: "l.sub.title",
  summary: "l.sub.summary",
  steps: [
    { do: [{ reset: { result: 1000 } }], view: "register", highlight: ["pi.window"], text: "l.sub.intro" },
    { view: "knobs", highlight: ["pm.setting_dial.0"], text: "l.sub.set1", task: setInput(1, 10) },
    {
      view: "carry",
      highlight: ["pi.sum_wheel.0", "pi.sum_wheel.1", "pi.sum_wheel.2", "pi.sum_wheel.3", "pi.carry_store.0", "pi.carry_store.1", "pi.carry_store.2"],
      text: "l.sub.turnBack",
      task: {
        check: (m) => m.turns === -1 && m.shownNumber() === 999 && allLevel(m),
        solve: (m) => m.turn(-1),
        wrong: (m) => m.turn(1),
        controls: ["sub"],
      },
    },
    { view: "register", highlight: ["pi.window"], text: "l.sub.borrow" },
    {
      view: "counter",
      highlight: ["pm.counter_ring"],
      callouts: [{ node: "pm.counter_ring", text: "part.magna" }],
      text: "l.sub.red",
      expect: (m) => m.ringTurns === -1,
    },
    {
      view: "knobs",
      highlight: ["pm.setting_dial.*"],
      text: "l.sub.tooMuch",
      task: {
        check: (m) => registerValue(m) < 0,
        solve: (m) => {
          m.setNumber(2000);
          m.turn(-1);
        },
        wrong: (m) => {
          m.setNumber(200);
          m.turn(-1);
        },
        controls: ["input", "sub"],
      },
    },
    { view: "register", highlight: ["pi.window"], text: "l.sub.belowZero" },
  ],
  finalCheck: (m) => registerValue(m) < 0,
};

// ---------------------------------------------------------------------------------------------
/** @type {Lesson} */
const carriage = {
  id: "carriage",
  title: "l.shift.title",
  summary: "l.shift.summary",
  steps: [
    { do: [{ reset: {} }], view: "knobs", highlight: ["pm.setting_dial.*"], text: "l.shift.intro", task: setInput(12, 21) },
    { view: "overview", highlight: ["pm.main_crank"], text: "l.shift.turnOnce", task: turnTo(12, 1) },
    { highlight: ["pm.carriage", "frame.lead_screw"], text: "l.shift.slide", task: shiftTo(1, 2) },
    {
      view: "register",
      highlight: ["pi.window"],
      text: "l.shift.turnAgain",
      task: {
        check: (m) => m.offset === 1 && m.turns === 2 && m.shownNumber() === 132,
        solve: (m) => m.turn(1),
        wrong: (m) => m.turn(-1),
        controls: ["add"],
      },
    },
    { text: "l.shift.recap", highlight: ["pi.window"], expect: (m) => m.shownNumber() === 132 },
  ],
  finalCheck: (m) => m.shownNumber() === 132 && m.offset === 1,
};

// ---------------------------------------------------------------------------------------------
/** @type {Lesson} */
const multiply = {
  id: "multiply",
  title: "l.mul.title",
  summary: "l.mul.summary",
  steps: [
    { do: [{ reset: {} }], view: "knobs", highlight: ["pm.setting_dial.*"], text: "l.mul.intro", task: setInput(1709, 1790) },
    {
      view: "counter",
      highlight: ["pm.counter_ring", "pm.counter_pin", "pm.counter_plate"],
      callouts: [{ node: "pm.counter_plate", text: "l.mul.stop" }],
      text: "l.mul.pin5",
      task: { check: (m) => m.pin === 5 && m.offset === 0, solve: (m) => m.setPin(5), wrong: (m) => m.setPin(6), controls: ["pin"] },
    },
    {
      highlight: ["pm.counter_ring", "pm.main_crank"],
      text: "l.mul.toStop",
      task: {
        check: (m) => m.pin === 5 && m.offset === 0 && m.blocked,
        solve: (m) => m.runToStop(),
        wrong: (m) => m.turn(1),
        controls: ["toStop", "add"],
      },
    },
    { view: "register", highlight: ["pi.window"], text: "l.mul.first", expect: (m) => m.shownNumber() === 8545 },
    { view: "overview", highlight: ["pm.carriage"], text: "l.mul.shift1", task: shiftTo(1, 2) },
    {
      view: "counter",
      highlight: ["pm.counter_ring", "pm.counter_pin"],
      text: "l.mul.pin6",
      task: {
        check: (m) => m.offset === 1 && m.pin === 6 && m.blocked,
        solve: (m) => {
          m.setPin(6);
          m.runToStop();
        },
        wrong: (m) => {
          m.setPin(5);
          m.runToStop();
        },
        controls: ["pin", "toStop", "add"],
      },
    },
    {
      text: "l.mul.last",
      task: {
        check: (m) => m.offset === 2 && m.pin === 3 && m.blocked,
        solve: (m) => {
          m.setOffset(2);
          m.setPin(3);
          m.runToStop();
        },
        wrong: (m) => {
          m.setOffset(2);
          m.setPin(3);
          m.turn(1);
        },
        controls: ["shift", "pin", "toStop", "add"],
      },
    },
    { view: "register", highlight: ["pi.window"], text: "l.mul.recap", expect: (m) => m.shownNumber() === 623785 },
  ],
  finalCheck: (m) => registerValue(m) === 623785,
};

// ---------------------------------------------------------------------------------------------
/** @type {Lesson} */
const divide = {
  id: "divide",
  title: "l.div.title",
  summary: "l.div.summary",
  steps: [
    { do: [{ reset: { result: 623785 } }], view: "register", highlight: ["pi.window"], text: "l.div.intro" },
    { view: "knobs", highlight: ["pm.setting_dial.*"], text: "l.div.setDivisor", task: setInput(1709, 1790) },
    { view: "overview", highlight: ["pm.carriage"], text: "l.div.shift2", task: shiftTo(2, 1) },
    {
      do: [{ pin: null }, { turn: -1, times: 3 }],
      view: "counter",
      highlight: ["pm.counter_ring"],
      text: "l.div.three",
      expect: (m) => m.ringTurns === -3 && registerValue(m) === 111085,
    },
    { do: [{ turn: -1 }], view: "register", highlight: ["pi.window"], text: "l.div.tooMany", expect: (m) => registerValue(m) < 0 },
    {
      do: [{ turn: 1 }],
      view: "counter",
      highlight: ["pm.counter_ring"],
      text: "l.div.addBack",
      expect: (m) => m.ringTurns === -3 && registerValue(m) === 111085,
    },
    { view: "overview", highlight: ["pm.carriage"], text: "l.div.shift1", task: shiftTo(1, 0) },
    {
      do: [{ pin: null }, { divideDigit: true }],
      view: "counter",
      highlight: ["pm.counter_ring"],
      text: "l.div.six",
      expect: (m) => m.ringTurns === -6 && registerValue(m) === 8545,
    },
    { view: "overview", highlight: ["pm.carriage"], text: "l.div.shift0", task: shiftTo(0, 1) },
    {
      do: [{ pin: null }, { divideDigit: true }],
      view: "counter",
      highlight: ["pm.counter_ring"],
      text: "l.div.five",
      expect: (m) => m.ringTurns === -5 && registerValue(m) === 0,
    },
    { view: "register", highlight: ["pi.window"], text: "l.div.recap" },
  ],
  finalCheck: (m) => registerValue(m) === 0 && m.offset === 0,
};

/** The learning path, in order. */
export const LESSONS = [add, carry, carryOriginal, subtract, carriage, multiply, divide];
