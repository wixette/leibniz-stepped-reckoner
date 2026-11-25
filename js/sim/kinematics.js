// Crank-angle kinematics of one digit. Mirrors blender/scripts/lib/kinematics.py,
// which the collision sweep verified; tests/sim/kinematics.test.js checks that both agree.
//
// theta: crank angle in degrees within one operation, 0..360 adding, 0..-360 subtracting.
// v: continuous value of the result wheel (digit + fraction of a step).

import machine from "../../params/machine.json" with { type: "json" };
import tables from "../../params/carry-tables.json" with { type: "json" };

/**
 * @template [T=number]
 * @typedef {object} Entry
 * @property {T} v
 */
/**
 * @template [T=number]
 * @param {Entry<T>} e
 * @returns {T}
 */
const val = (e) => e.v;

const P = machine.pars_mobilis;
const G = machine.geometry;
const T = machine.timing;

export const RIB_PITCH = val(P.drum.rib_pitch); // 22.5
export const RIB_START = val(T.rest_free_arc_before_ribs); // 78.75
export const CARRY_WINDOW_START = val(/** @type {Entry<number[]>} */ (T.carry_window))[0]; // 281.25
export const PER_CARRY = val(T.per_carry_angle); // 9.8
const STEP = val(G.drum.rib_length_step);
const L = val(G.drum.length);
const Y_GEAR = val(G.receiving_gear.y);
export const SUM_STEP = val(machine.pars_immobilis.sum_wheel_step); // 36
export const STORE_STEP = val(machine.pars_immobilis.einzahn_store_rotation); // 18
export const STORE_PITCH = val(machine.pars_immobilis.fuenfhorn_pitch); // 72
/** Knob rotation per setting digit (deg): the dial has 12 divisions, digits on ten of them. */
export const DIAL_STEP = 360 / val(P.setting_dial.divisions); // 30

/** @param {number} x */
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/**
 * Drum front-face position along the shaft (mm) for setting s.
 * @param {number} s
 * @returns {number}
 */
export function drumFrontY(s) {
  return Y_GEAR - L + (9.5 - s) * STEP;
}

/**
 * Setting knob / pinion rotation about the vertical axis (deg): one division per digit.
 * @param {number} s
 * @returns {number}
 */
export function dialAngle(s) {
  return DIAL_STEP * s;
}

/**
 * Window (0..8) in which rib k (1..9) passes the gear. Ribs arrive 1..9 forward, 9..1 backward.
 * @param {number} k
 * @param {number} theta
 * @returns {number}
 */
export function ribWindowIndex(k, theta) {
  return theta >= 0 ? k - 1 : 9 - k;
}

/**
 * Start angle (|theta|) of rib window w (0..8).
 * @param {number} w
 * @returns {number}
 */
export function ribWindowStart(w) {
  return RIB_START + w * RIB_PITCH;
}

/**
 * Steps (continuous, 0..s) the drum has given the result wheel so far in this turn.
 * @param {number} s
 * @param {number} theta
 * @returns {number}
 */
export function ribProgress(s, theta) {
  const t = Math.abs(theta);
  let total = 0;
  for (let k = 10 - Math.round(s); k <= 9; k++) {
    total += clamp01((t - ribWindowStart(ribWindowIndex(k, theta))) / RIB_PITCH);
  }
  return total;
}

/**
 * @param {number} digitStart
 * @param {number} s
 * @param {number} theta
 * @returns {number}
 */
export function wheelValue(digitStart, s, theta) {
  const u = ribProgress(s, theta);
  return theta >= 0 ? digitStart + u : digitStart - u;
}

/**
 * Result-wheel rotation about the shaft axis (deg); counter-rotates the drum.
 * @param {number} v
 * @returns {number}
 */
export function sumWheelAngle(v) {
  return -SUM_STEP * v;
}

// --- carry push: the Einzahn's tooth against the five-horn, solved from the parts' outlines
// (blender/scripts/lib/carry_solve.py -> params/carry-tables.json); past the detent wheel's
// point the detent spring completes the store to 18 deg.
const PUSH = tables.push;

/**
 * Carry-store deflection (deg, 0..18) caused by the Einzahn for v in [9, 10].
 * @param {number} v
 * @returns {number}
 */
export function push(v) {
  const x = (Math.min(Math.max(v, 9), 10) - PUSH.v0) / PUSH.step;
  const i = Math.min(Math.floor(x), PUSH.store.length - 2);
  const f = x - i;
  return PUSH.store[i] * (1 - f) + PUSH.store[i + 1] * f;
}

/**
 * Store rotation from the Einzahn alone. A turn starts with v in [0, 9]. Every 9 -> 0 (or
 * 0 -> 9) the wheel passes pushes the store once more: a wheel that also receives a waiting
 * carry can pass twice in one turn (v beyond 19), and the store then reaches 36 deg, which
 * Machine refuses (a store holds one carry). Up to v = 19 this is the M0 push (lib/kinematics.py).
 * @param {number} pendingStart
 * @param {number} v
 * @returns {number}
 */
export function storeAngle(pendingStart, v) {
  const base = STORE_STEP * pendingStart;
  /** @param {number} w how far past 9 the wheel has turned, either way */
  const pushes = (w) => {
    const q = Math.floor((w - 9) / 10); // the passes completed before this one
    return STORE_STEP * q + push(w - 10 * q);
  };
  if (v > 9) return base + pushes(v);
  if (v < 0) return base - pushes(9 - v);
  return base;
}

/**
 * Fraction (0..1) of the carry execution for a digit in this turn's carry window.
 * @param {number} theta
 * @param {number} [digitIndex] the digit (0 = units), whose lever comes PER_CARRY later per digit
 * @returns {number}
 */
export function completion(theta, digitIndex = 0) {
  const t0 = CARRY_WINDOW_START + digitIndex * PER_CARRY;
  return clamp01((Math.abs(theta) - t0) / PER_CARRY);
}

/**
 * Store rotation including the execution of a carry stored in this turn.
 * @param {number} pendingStart
 * @param {number} v
 * @param {number} theta
 * @param {boolean} executes
 * @returns {number}
 */
export function storeAngleFull(pendingStart, v, theta, executes) {
  const a = storeAngle(pendingStart, v);
  if (!executes) return a;
  const sign = Math.sign(a);
  return a + sign * (STORE_PITCH - STORE_STEP) * completion(theta);
}
