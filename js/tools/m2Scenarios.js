// Scripted M2 scenarios (turns, carriage shifts, Magna Rota pin), shared by the
// acceptance tests (A2-9, coarse sampling) and the pose exporter (Blender sweep, fine).

import { Machine } from "../sim/machine.js";
/** @import { CarryMode } from "../sim/machine.js" */

/**
 * - turn: this many whole crank turns that way (one if times is not given)
 * - shift: move the carriage to this offset (end crank)
 * - input: set this number on the knobs
 * - pin: put the Magna Rota's pin in this hole (null: take it out)
 * @typedef {(
 *   | { turn: 1 | -1; times?: number }
 *   | { shift: number }
 *   | { input: number }
 *   | { pin: number | null }
 * )} Op
 */

/**
 * @typedef {object} M2Scenario
 * @property {string} label
 * @property {CarryMode} mode
 * @property {number} result
 * @property {Op[]} ops
 */

/** @type {M2Scenario[]} */
export const M2_SCENARIOS = [
  {
    label: "1709 × 365 with the Magna Rota",
    mode: "ripple",
    result: 0,
    ops: [
      { input: 1709 },
      { pin: 5 }, { turn: 1, times: 5 },
      { shift: 1 }, { pin: 6 }, { turn: 1, times: 6 },
      { shift: 2 }, { pin: 3 }, { turn: 1, times: 3 },
      { pin: null }, { shift: 0 },
    ],
  },
  {
    label: "ripple 999999999 + 1, shift, idle turn",
    mode: "ripple",
    result: 999_999_999,
    ops: [{ input: 1 }, { turn: 1 }, { input: 0 }, { shift: 8 }, { shift: 1 }, { turn: 1 }],
  },
  {
    label: "ripple 99999999 + 99999999 (every rib, every lever)",
    mode: "ripple",
    result: 99_999_999,
    ops: [{ input: 99_999_999 }, { turn: 1 }],
  },
  {
    label: "ripple 0 − 1 at offset 8 (borrow out of the top)",
    mode: "ripple",
    result: 0,
    ops: [{ shift: 8 }, { input: 1 }, { turn: -1 }, { shift: 0 }],
  },
  {
    label: "historical 9999 + 1 (+idle)",
    mode: "historical",
    result: 9999,
    ops: [{ input: 1 }, { turn: 1 }, { input: 0 }, { turn: 1 }],
  },
];

/**
 * Walk a scenario, calling visit at every sampled pose: crank angles every stepDeg
 * within each turn, carriage positions every shiftStep places within each shift.
 * @param {M2Scenario} sc
 * @param {number} stepDeg
 * @param {number} shiftStep
 * @param {(m: Machine, label: string) => void} visit
 * @returns {Machine}
 */
export function walkM2(sc, stepDeg, shiftStep, visit) {
  const m = new Machine();
  m.setMode(sc.mode);
  m.setResult(sc.result);
  visit(m, `${sc.label}: start`);
  for (const op of sc.ops) {
    if ("input" in op) m.setNumber(op.input);
    else if ("pin" in op) m.setPin(op.pin);
    else if ("shift" in op) {
      const from = m.carriagePos;
      const n = Math.max(1, Math.round(Math.abs(op.shift - from) / shiftStep));
      for (let i = 1; i <= n; i++) {
        m.setCarriagePos(i === n ? op.shift : from + ((op.shift - from) * i) / n);
        visit(m, `${sc.label}: carriage ${m.carriagePos.toFixed(3)}`);
      }
    } else {
      for (let k = 0; k < (op.times ?? 1); k++) {
        for (let a = stepDeg; a < 360; a += stepDeg) {
          if (!m.setTheta(op.turn * a) && m.theta === 0) throw new Error(`${sc.label}: crank blocked`);
          visit(m, `${sc.label}: turn ${m.turns + op.turn} θ=${(op.turn * a).toFixed(2)}`);
        }
        m.setTheta(op.turn * 360);
        visit(m, `${sc.label}: after turn ${m.turns}`);
      }
    }
  }
  return m;
}
