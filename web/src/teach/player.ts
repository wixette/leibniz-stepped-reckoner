// Guided lessons (M3): types and the step logic. No DOM and no three.js, so the page, the
// acceptance tests (A3-2, A3-4, A3-6) and the page's ?selftest all run the same code.
//
// A lesson is a list of steps. Entering a step plays its actions (the page animates them;
// tests apply them at once). A step with a learner task unlocks Next only when the task's
// check passes. Back replays the lesson from its start up to the target step, instantly,
// so every step always starts from the same machine state.

import { type CarryMode, Machine } from "../sim/machine";
import { registerValue } from "../sim/operations";
import type { Text } from "./i18n";

export type ViewName = "overview" | "register" | "knobs" | "front" | "drum" | "carry";

export type Action =
  | { reset: { result?: number; input?: number; mode?: CarryMode } } // a fresh machine
  | { input: number } // setting knobs
  | { pin: number | null } // Magna Rota pin (also sets the ring back to 0)
  | { shift: number } // carriage to this offset
  | { theta: number } // crank to this angle (a full turn completes at ±360)
  | { turn: 1 | -1; times?: number }
  | { toStop: true } // forward turns until the pin reaches the stop
  | { divideDigit: true }; // subtract until overdrawn, then add back once

export type Task = {
  /** Has the learner done it? */
  check: (m: Machine) => boolean;
  /** Do it for them (Back/replay, tests). */
  solve: (m: Machine) => void;
  /** A plausible mistake the check must reject (A3-4). */
  wrong: (m: Machine) => void;
  /** Which controls the learner needs for it. */
  controls: ("input" | "add" | "sub" | "shift" | "pin" | "toStop")[];
};

export type Callout = { node: string; text: Text };

export type Step = {
  text: Text;
  view?: ViewName;
  casing?: boolean; // show the case and cover plates
  cutaway?: boolean; // hide the carriage front panel
  explode?: number; // exploded-view factor 0..1
  focus?: boolean; // fade the parts that are not highlighted
  highlight?: string[]; // node names; "prefix.*" matches a group
  callouts?: Callout[];
  do?: Action[];
  task?: Task;
  /** What must be true when the step's actions are done (tests). */
  expect?: (m: Machine) => boolean;
};

export type Lesson = { id: string; title: Text; summary: Text; steps: Step[]; finalCheck: (m: Machine) => boolean };

/** What the page shows for a step: presentation settings carry over from earlier steps. */
export type Presentation = {
  view: ViewName;
  casing: boolean;
  cutaway: boolean;
  explode: number;
  focus: boolean;
  highlight: string[];
  callouts: Callout[];
};

export function presentation(lesson: Lesson, i: number): Presentation {
  const p: Presentation = { view: "overview", casing: true, cutaway: false, explode: 0, focus: false, highlight: [], callouts: [] };
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

/** Does a node name match a highlight pattern ("pm.drum.0" or "pm.drum.*")? */
export const matches = (pattern: string, name: string) =>
  pattern.endsWith(".*") ? name.startsWith(pattern.slice(0, -1)) : name === pattern;

/** One action, applied at once (no animation). Returns false if the machine refused it. */
export function applyAction(m: Machine, a: Action): boolean {
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

/** The machine state at the start of step i (after steps 0..i-1, tasks solved). */
export function replayTo(lesson: Lesson, i: number, m: Machine): void {
  m.reset();
  for (let k = 0; k < i; k++) finishStep(lesson.steps[k], m);
}

/** Play a step's actions and solve its task, at once. */
export function finishStep(s: Step, m: Machine): void {
  for (const a of s.do ?? []) applyAction(m, a);
  if (s.task && !s.task.check(m)) s.task.solve(m);
}

export type LessonRun = { ok: boolean; problems: string[] };

/** Run a lesson start to finish with a scripted learner (A3-2), checking A3-4 on the way. */
export function runLesson(lesson: Lesson): LessonRun {
  const m = new Machine();
  const problems: string[] = [];
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
