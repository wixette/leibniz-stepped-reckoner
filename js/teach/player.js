// Guided lessons (M3): types and the step logic. No DOM and no three.js, so the page, the
// acceptance tests (A3-2, A3-4, A3-6) and the page's ?selftest all run the same code.
//
// A lesson is a list of steps. Entering a step plays its actions (the page animates them;
// tests apply them at once). A step with a learner task unlocks Next only when the task's
// check passes. Back replays the lesson from its start up to the target step, instantly,
// so every step always starts from the same machine state.

import { Machine } from "../sim/machine.js";
/** @import { CarryMode } from "../sim/machine.js" */
import { registerValue } from "../sim/operations.js";

/** @typedef {"overview" | "register" | "knobs" | "front" | "drum" | "carry"} ViewName */

/**
 * A scripted machine action:
 * - reset: a fresh machine
 * - input: setting knobs
 * - pin: Magna Rota pin (also sets the ring back to 0)
 * - shift: carriage to this offset
 * - theta: crank to this angle (a full turn completes at ±360)
 * - turn: whole crank turns
 * - toStop: forward turns until the pin reaches the stop
 * - divideDigit: subtract until overdrawn, then add back once
 * @typedef {(
 *   | { reset: { result?: number; input?: number; mode?: CarryMode } }
 *   | { input: number }
 *   | { pin: number | null }
 *   | { shift: number }
 *   | { theta: number }
 *   | { turn: 1 | -1; times?: number }
 *   | { toStop: true }
 *   | { divideDigit: true }
 * )} Action
 */

/**
 * @typedef {object} Task
 * @property {(m: Machine) => boolean} check Has the learner done it?
 * @property {(m: Machine) => void} solve Do it for them (Back/replay, tests).
 * @property {(m: Machine) => void} wrong A plausible mistake the check must reject (A3-4).
 * @property {("input" | "add" | "sub" | "shift" | "pin" | "toStop")[]} controls Which controls the learner needs for it.
 */

/**
 * @typedef {object} Callout
 * @property {string} node
 * @property {string} text message key (js/l10n)
 * @property {false} [value] no live value: the callout names an area, not the part it is pinned to
 */

/**
 * A picture shown with a step (the tutorial's first chapter), with its credit line.
 * @typedef {object} Picture
 * @property {string} file path from the site's root
 * @property {string} credit message key: what it shows, who made it, its licence
 */

/**
 * @typedef {object} Step
 * @property {string} text message key (js/l10n)
 * @property {string} [chapter] message key: a chapter starts here (the tutorial)
 * @property {Picture} [image]
 * @property {ViewName} [view]
 * @property {boolean} [casing] show the case and cover plates
 * @property {boolean} [cutaway] hide the carriage front panel
 * @property {number} [explode] exploded-view factor 0..1
 * @property {boolean} [focus] fade the parts that are not highlighted
 * @property {string[]} [highlight] node names; "prefix.*" matches a group
 * @property {Callout[]} [callouts]
 * @property {Action[]} [do]
 * @property {Task} [task]
 * @property {(m: Machine) => boolean} [expect] What must be true when the step's actions are done (tests).
 */

/**
 * @typedef {object} Lesson
 * @property {string} id
 * @property {string} title message key
 * @property {string} summary message key
 * @property {Step[]} steps
 * @property {(m: Machine) => boolean} finalCheck
 */

/**
 * What the page shows for a step: presentation settings carry over from earlier steps.
 * @typedef {object} Presentation
 * @property {ViewName} view
 * @property {boolean} casing
 * @property {boolean} cutaway
 * @property {number} explode
 * @property {boolean} focus
 * @property {string[]} highlight
 * @property {Callout[]} callouts
 */

/**
 * @param {Lesson} lesson
 * @param {number} i
 * @returns {Presentation}
 */
export function presentation(lesson, i) {
  /** @type {Presentation} */
  const p = { view: "overview", casing: true, cutaway: false, explode: 0, focus: false, highlight: [], callouts: [] };
  lesson.steps.slice(0, i + 1).forEach((s) => {
    if (s.view) p.view = s.view;
    if (s.casing !== undefined) p.casing = s.casing;
    if (s.cutaway !== undefined) p.cutaway = s.cutaway;
    if (s.explode !== undefined) p.explode = s.explode;
    if (s.focus !== undefined) p.focus = s.focus;
  });
  const s = lesson.steps[i];
  p.highlight = s.highlight ?? [];
  p.callouts = s.callouts ?? [];
  return p;
}

/**
 * Does a node name match a highlight pattern ("pm.drum.0" or "pm.drum.*")?
 * @param {string} pattern
 * @param {string} name
 */
export const matches = (pattern, name) =>
  pattern.endsWith(".*") ? name.startsWith(pattern.slice(0, -1)) : name === pattern;

/**
 * One action, applied at once (no animation). Returns false if the machine refused it.
 * @param {Machine} m
 * @param {Action} a
 * @returns {boolean}
 */
export function applyAction(m, a) {
  if ("reset" in a) {
    m.reset();
    m.setMode(a.reset.mode ?? "ripple");
    m.setResult(a.reset.result ?? 0);
    m.setNumber(a.reset.input ?? 0);
    return true;
  }
  if ("input" in a) return m.setNumber(a.input);
  if ("pin" in a) return m.setPin(a.pin);
  if ("shift" in a) return m.setOffset(a.shift);
  if ("theta" in a) {
    m.setTheta(a.theta);
    return true;
  }
  if ("turn" in a) {
    for (let k = 0; k < (a.times ?? 1); k++) if (!m.turn(a.turn)) return false;
    return true;
  }
  if ("toStop" in a) {
    m.runToStop();
    return m.blocked;
  }
  for (;;) {
    if (!m.turn(-1)) return false;
    if (registerValue(m) < 0) return m.turn(1);
  }
}

/**
 * The machine state at the start of step i (after steps 0..i-1, tasks solved).
 * @param {Lesson} lesson
 * @param {number} i
 * @param {Machine} m
 * @returns {void}
 */
export function replayTo(lesson, i, m) {
  m.reset();
  for (let k = 0; k < i; k++) finishStep(lesson.steps[k], m);
}

/**
 * Play a step's actions and solve its task, at once.
 * @param {Step} s
 * @param {Machine} m
 * @returns {void}
 */
export function finishStep(s, m) {
  for (const a of s.do ?? []) applyAction(m, a);
  if (s.task && !s.task.check(m)) s.task.solve(m);
}

/**
 * @typedef {object} LessonRun
 * @property {boolean} ok
 * @property {string[]} problems
 */

/**
 * Run a lesson start to finish with a scripted learner (A3-2), checking A3-4 on the way.
 * @param {Lesson} lesson
 * @returns {LessonRun}
 */
export function runLesson(lesson) {
  const m = new Machine();
  /** @type {string[]} */
  const problems = [];
  lesson.steps.forEach((s, i) => {
    replayTo(lesson, i, m);
    for (const a of s.do ?? []) if (!applyAction(m, a)) problems.push(`step ${i + 1}: action ${JSON.stringify(a)} refused`);
    if (s.task) {
      if (s.task.check(m)) problems.push(`step ${i + 1}: task already done before the learner acts`);
      // A3-4: a mistake keeps it locked; the right move unlocks it.
      replayTo(lesson, i, m);
      for (const a of s.do ?? []) applyAction(m, a);
      s.task.wrong(m);
      if (s.task.check(m)) problems.push(`step ${i + 1}: task accepts a mistake`);
      replayTo(lesson, i, m);
      for (const a of s.do ?? []) applyAction(m, a);
      s.task.solve(m);
      if (!s.task.check(m)) problems.push(`step ${i + 1}: task not done by its solution`);
    }
    if (s.expect && !s.expect(m)) problems.push(`step ${i + 1}: state not as expected`);
  });
  replayTo(lesson, lesson.steps.length, m);
  if (!lesson.finalCheck(m)) problems.push("final state not as expected");
  return { ok: problems.length === 0, problems };
}
