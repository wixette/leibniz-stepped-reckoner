// M1 kinematics: carry execution (the Zweihorn's horn driving the five-horn s), carry transfer
// (the five-horn p turning the next ten-wheel) and lever phases per carry mode.
// The parts are the original's (BADUR2026, params geometry.carry); their contacts are solved
// once from the outlines (blender/scripts/lib/carry_solve.py -> params/carry-tables.json).
// Geometry is per digit, in mm, in the X-Z plane of the digit (x = 0 at its drum axis).
// Angles: world angle in the X-Z plane, CCW positive (x = cos, z = sin). A part turned by
// +phi about +Y has every feature at (local angle - phi).

import machine from "../../params/machine.json" with { type: "json" };
import tables from "../../params/carry-tables.json" with { type: "json" };
import { STORE_PITCH, STORE_STEP } from "./kinematics.js";

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
const G = machine.geometry;
const M1 = G.m1;
const T = machine.timing;
/** @param {number} r */
const deg = (r) => (r * 180) / Math.PI;
/** @param {number} x */
const clamp01 = (x) => Math.min(1, Math.max(0, x));

export const CARRY_WINDOW_START = val(/** @type {Entry<number[]>} */ (T.carry_window))[0];
export const PER_CARRY = val(T.per_carry_angle);
export const SPRING_SNAP = val(T.spring_snap_deg);
/** Store angle past which the detent wheel's spring completes an executed carry (the point
 *  between its notches at 54 and 72 deg, BADUR2026 Pos. 20). */
export const SPRING_FROM = val(T.spring_from_store);

// --- layout (per digit) ------------------------------------------------------------
const zs = val(G.drum.axis_z) + val(G.receiving_gear.centre_distance); // result shaft height
const [FDX, FDZ] = val(/** @type {Entry<number[]>} */ (G.carry_store.offset_xz));
export const F = { x: FDX, z: zs + FDZ };
export const L = { x: val(M1.lever_axis_dx), z: val(M1.lever_axis_z) };
export const B_FL = deg(Math.atan2(L.z - F.z, L.x - F.x)); // store axis -> lever axis
export const B_LF = deg(Math.atan2(F.z - L.z, F.x - L.x)); // lever axis -> store axis
/** Store angle at which a five-horn p's horn crosses the line to the next result shaft. */
const CROSS = val(G.carry).transfer_crossing; // 36

// --- Zweihorn push table (adding; subtraction is the mirror image) ----------------------
const Z = tables.zweihorn;
const TABLE_STEP = Z.step; // deg of lever travel

/** Lever angle (deg) between first contact and the crossing of the store->lever line (negative). */
export const CONTACT_START_REL = Z.contact_start_rel;
/** Lever travel (deg) from first contact to where the horn alone would release the store. */
export const RELEASE_TRAVEL = (Z.store.length - 1) * TABLE_STEP;
export const RELEASE_STORE = Z.store[Z.store.length - 1];

/** @param {number} t */
const pushed = (t) => {
  const x = t / TABLE_STEP;
  const i = Math.min(Math.floor(x), Z.store.length - 2);
  const f = x - i;
  return Z.store[i] * (1 - f) + Z.store[i + 1] * f;
};

/**
 * ripple: Lehmann's Dresden replica, levers staggered units first, so a chain of carries runs
 *  through in one turn. simultaneous: the original in Hannover, every lever at the same phase
 *  (K. Badur, measured on the original), so a carry made while carries are being passed on
 *  waits for a later pass (decision 0001).
 * @typedef {"ripple" | "simultaneous"} CarryMode
 */

/**
 * Lever travel (deg) after first contact from which the detent spring completes the store.
 *  The original (simultaneous): the horn pushes the store past the detent's point (SPRING_FROM).
 *  Lehmann (ripple): with the original's parts a carry takes ~26 deg of crank to reach the next
 *  wheel, too slow for a chain of eight in one turn (Lehmann re-dimensioned his Zweihoerner); here
 *  the spring completes the store as soon as the horn touches it (design/v1.3-notes.md).
 * @param {CarryMode} mode
 */
function springStart(mode) {
  if (mode === "ripple") return 0;
  for (let t = 0; t <= RELEASE_TRAVEL; t += 0.01) if (pushed(t) >= SPRING_FROM) return t;
  return RELEASE_TRAVEL;
}
const SPRING = { ripple: springStart("ripple"), simultaneous: springStart("simultaneous") };

/**
 * Store angle (adding sense, 18..72) after the lever has travelled t deg since first contact.
 * @param {number} t
 * @param {CarryMode} [mode]
 * @returns {number}
 */
export function executionCurve(t, mode = "simultaneous") {
  if (t <= 0) return STORE_STEP;
  const s0 = SPRING[mode];
  if (t <= s0) return pushed(t);
  const from = s0 === 0 ? STORE_STEP : pushed(s0);
  const u = clamp01((t - s0) / SPRING_SNAP);
  const e = u * u * (3 - 2 * u);
  return Math.max(t <= RELEASE_TRAVEL ? pushed(t) : RELEASE_STORE, from + (STORE_PITCH - from) * e);
}

/**
 * Carry-transfer progress (0..1) of the next wheel while the store turns (the five-horn p's horn
 * crosses the line to the next result shaft at CROSS, turning the ten-wheel 2:1).
 * @param {number} storeAbs
 * @returns {number}
 */
export function transferProgress(storeAbs) {
  return clamp01((storeAbs - (CROSS - 9)) / 18);
}

/**
 * Lever travel (deg) after first contact until the next wheel has completed its step.
 * @param {CarryMode} [mode]
 */
export function transferTravel(mode = "simultaneous") {
  return TRANSFER[mode];
}
/** @param {CarryMode} mode */
function findTransfer(mode) {
  for (let t = 0; t <= executionTravel(mode); t += 0.01) {
    if (transferProgress(executionCurve(t, mode)) >= 1) return t;
  }
  return executionTravel(mode);
}

/**
 * Lever travel (deg) after first contact until the store is back at rest (72 deg).
 * @param {CarryMode} [mode]
 */
export function executionTravel(mode = "simultaneous") {
  return SPRING[mode] + SPRING_SNAP;
}
const TRANSFER = { ripple: findTransfer("ripple"), simultaneous: findTransfer("simultaneous") };

// --- lever phases per mode ---------------------------------------------------------------

/**
 * |theta| at which digit i's adding horn first touches its store (and the subtracting horn, mirrored).
 * @param {number} i
 * @param {CarryMode} mode
 * @returns {number}
 */
export function leverWindow(i, mode) {
  return mode === "ripple" ? CARRY_WINDOW_START + i * PER_CARRY : SIMULTANEOUS_WINDOW;
}

/**
 * The original's Zweihorn angle, 90 deg at the outer edges of its two horns (BADUR2026), between
 *  the horns' centre lines.
 */
export const ORIGINAL_SPREAD = val(machine.pars_mobilis.zweihorn.spread_original_outer) - 2 * tables.horn_tip_half_angle;

/**
 * |theta| of the 'simultaneous' (Original) carry's main horn pass. A lever's two horns pass its
 *  store symmetrically about 360 + CONTACT_START_REL, the spread apart: the early pass comes before
 *  the ribs, the main pass after them.
 */
export const SIMULTANEOUS_WINDOW = 360 + CONTACT_START_REL - ORIGINAL_SPREAD / 2;

/** @param {number} a */
const norm360 = (a) => ((a % 360) + 360) % 360;

/**
 * World angle of each horn at theta = 0 (the Zweihorn's two horns differ by the spread angle).
 * @param {number} i
 * @param {CarryMode} mode
 */
export function hornPhases(i, mode) {
  const w = leverWindow(i, mode);
  return { add: norm360(B_LF + CONTACT_START_REL - w), sub: norm360(B_LF - CONTACT_START_REL + w) };
}

/**
 * Contact-start crank angles of both horns for a turn in direction dir (|theta| values, ascending).
 * @param {number} i
 * @param {CarryMode} mode
 * @param {1 | -1} dir
 * @returns {number[]}
 */
export function leverPasses(i, mode, dir) {
  const ph = hornPhases(i, mode);
  // Adding: horns move CCW (+theta) and first touch at B_LF + CONTACT_START_REL.
  // Subtracting: horns move CW and first touch at B_LF - CONTACT_START_REL.
  const target = dir > 0 ? B_LF + CONTACT_START_REL : B_LF - CONTACT_START_REL;
  return [ph.add, ph.sub]
    .map((p) => norm360(dir > 0 ? target - p : p - target))
    .map((t) => (t === 0 ? 360 : t))
    .sort((a, b) => a - b);
}
