// "What just happened" for the Step control: compares observable state before and
// after a step. Pure logic (no DOM, no three.js), shared by the pages and the tests.

import type { DigitSlice } from "./digitSlice";
import type { Machine } from "./machine";

export type CarryState = "idle" | "stored" | "executing";

export type Snapshot = {
  digits: number[]; // shown digits, index 0 = units
  states: CarryState[]; // per carry store
  carryOut: number; // live (includes carries completed in the current turn)
  turns: number;
  theta: number;
};

export function snapshotM0(m: DigitSlice): Snapshot {
  const ph = m.carryPhase;
  const state: CarryState = ph === "stored" ? "stored" : ph === "executing" ? "executing" : "idle";
  return { digits: [m.shownDigit], states: [state], carryOut: m.carryOutLive, turns: m.turns, theta: m.theta };
}

/** Snapshot of a CarrySlice (M1) or the full Machine (M2). */
export function snapshotM1(m: Machine): Snapshot {
  return { digits: m.shownDigits(), states: m.carryStates(), carryOut: m.carryOutLive(), turns: m.turns, theta: m.theta };
}

/** True when anything a learner can see (digits, carry flags, carry out, counter) changed. */
export function changed(a: Snapshot, b: Snapshot): boolean {
  return (
    a.turns !== b.turns ||
    a.carryOut !== b.carryOut ||
    a.digits.some((d, i) => d !== b.digits[i]) ||
    a.states.some((s, i) => s !== b.states[i])
  );
}

const PLACE = ["units", "tens", "hundreds", "thousands"];
const place = (i: number, n: number) => (n === 1 ? "the result wheel" : (PLACE[i] ?? `digit ${i}`));

/**
 * One sentence describing the step from a to b; dir = crank direction of the step.
 * opts.ribs = [start, end] of the rib sector (|theta|). A digit that changes inside it was
 * turned by a rib; outside it, only a carry can turn a wheel.
 */
export function describeStep(a: Snapshot, b: Snapshot, dir: 1 | -1, opts: { ribs: [number, number]; completed: boolean }): string {
  const n = a.digits.length;
  const word = dir > 0 ? "carry" : "borrow";
  const parts: string[] = [];
  const t = Math.abs(b.theta);
  const inRibs = !opts.completed && t > opts.ribs[0] && t <= opts.ribs[1] + 1e-6;
  const moved = a.digits.map((d, i) => (d !== b.digits[i] ? `${place(i, n)} ${d} → ${b.digits[i]}` : "")).filter(Boolean);
  if (moved.length) parts.push(inRibs ? `A rib turned ${moved.join(", ")}` : `${moved.join(", ")} (${word} received)`);
  a.states.forEach((s, i) => {
    const e = b.states[i];
    if (s === e) return;
    const who = n === 1 ? "" : ` at ${place(i, n)}`;
    if (e === "stored") parts.push(`${word} stored${who} (pentagon tilted)`);
    else if (e === "executing") parts.push(`the ${word}${who} is being passed on`);
    else parts.push(`the ${word}${who} is done (pentagon level)`);
  });
  const dOut = b.carryOut - a.carryOut;
  if (dOut !== 0) parts.push(n === 1 ? `${dOut > 0 ? "a carry" : "a borrow"} went to the next digit` : `${dOut > 0 ? "a carry" : "a borrow"} left the top digit`);
  if (opts.completed) parts.push("turn complete, the counter moved");
  if (!parts.length) return "Nothing visible changed.";
  const s = parts.join("; ");
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}
