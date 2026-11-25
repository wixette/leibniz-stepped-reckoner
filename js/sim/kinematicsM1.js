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

// --- Zweihorn push tables (adding; subtraction is the mirror image) ---------------------
// One per carry set: the original's (Badur) for the simultaneous carry, the ripple set (our
// design: a long thin Zweihorn and a small five-horned star s') for the ripple carry.

/**
 * simultaneous: the original in Hannover, every lever at the same phase (K. Badur, measured on
 *  the original), so a carry made while carries are being passed on waits for a later pass
 *  (decision 0001). ripple: the ripple set's levers staggered units first, so a chain of carries
 *  runs through in one turn (design/v1.3-notes.md).
 * @typedef {"ripple" | "simultaneous"} CarryMode
 */

/** @type {Record<CarryMode, { step: number; contact_start_rel: number; store: number[]; catch?: { from_store: number; start: number; store: number[] } }>} */
const TABLES = { simultaneous: tables.zweihorn, ripple: tables.zweihorn_ripple };

/**
 * Lever angle (deg) between first contact and the crossing of the store->lever line (negative).
 * @param {CarryMode} [mode]
 */
export function contactStartRel(mode = "simultaneous") {
  return TABLES[mode].contact_start_rel;
}
/** The original set's, for the simultaneous carry. */
export const CONTACT_START_REL = contactStartRel("simultaneous");

/**
 * Store angle (adding sense) pushed by the horn after t deg of lever travel since first contact.
 * @param {number} t
 * @param {CarryMode} mode
 */
const pushed = (t, mode) => {
  const Z = TABLES[mode];
  const x = t / Z.step;
  const i = Math.max(0, Math.min(Math.floor(x), Z.store.length - 2));
  const f = Math.min(1, x - i);
  return Z.store[i] * (1 - f) + Z.store[i + 1] * f;
};
/**
 * A horn that arrives while its store is still being stored (turning 0..18 under the Einzahn and
 * the detent spring) meets the five-horn from behind and pushes it on to 18: the least store
 * angle (adding sense) the horn allows t deg before its first contact with a store at 18
 * (t < 0), or null outside that lead-in. Only the ripple set's levers follow closely enough.
 * @param {number} t
 * @param {CarryMode} mode
 * @returns {number | null}
 */
export function catchCurve(t, mode) {
  const c = TABLES[mode].catch;
  if (!c || t >= 0 || t < c.start) return null;
  const x = (t - c.start) / TABLES[mode].step;
  const i = Math.max(0, Math.min(Math.floor(x), c.store.length - 2));
  const f = Math.min(1, x - i);
  return c.store[i] * (1 - f) + c.store[i + 1] * f;
}
/**
 * The least store angle the catch applies to (a store further back is not yet in the horn's way).
 * @param {CarryMode} mode
 */
export function catchFrom(mode) {
  const c = TABLES[mode].catch;
  return c ? c.from_store : Infinity;
}

/** @param {CarryMode} mode */
const releaseTravel = (mode) => (TABLES[mode].store.length - 1) * TABLES[mode].step;
/** @param {CarryMode} mode */
const releaseStore = (mode) => TABLES[mode].store[TABLES[mode].store.length - 1];

/**
 * Lever travel (deg) after first contact until the horn has pushed the store past the detent
 * wheel's point (SPRING_FROM), from where its spring completes the step.
 * @param {CarryMode} mode
 */
function springStart(mode) {
  for (let t = 0; t <= releaseTravel(mode); t += 0.01) if (pushed(t, mode) >= SPRING_FROM) return t;
  return releaseTravel(mode);
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
  if (t <= s0) return pushed(t, mode);
  const from = pushed(s0, mode);
  const u = clamp01((t - s0) / SPRING_SNAP);
  const e = u * u * (3 - 2 * u);
  return Math.max(t <= releaseTravel(mode) ? pushed(t, mode) : releaseStore(mode), from + (STORE_PITCH - from) * e);
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
/**
 * Lever travel (deg) after first contact until the store has reached angle a (adding sense).
 * @param {CarryMode} mode
 * @param {number} a
 */
function travelTo(mode, a) {
  for (let t = 0; t <= executionTravel(mode); t += 0.01) if (executionCurve(t, mode) >= a) return t;
  return executionTravel(mode);
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

/**
 * The ripple set's lever timing: the first lever touches its store so that the next wheel starts
 * to turn at the carry window's start (after the ribs), and each lever follows the one below once
 * that one's transfer is done (its own store then stored), plus a small margin.
 */
export const RIPPLE_FIRST = CARRY_WINDOW_START - travelTo("ripple", CROSS - 9);
export const RIPPLE_STAGGER = TRANSFER.ripple + val(G.carry).ripple_stage_margin;

// --- lever phases per mode ---------------------------------------------------------------

/**
 * |theta| at which digit i's adding horn first touches its store (and the subtracting horn, mirrored).
 * @param {number} i
 * @param {CarryMode} mode
 * @returns {number}
 */
export function leverWindow(i, mode) {
  return mode === "ripple" ? RIPPLE_FIRST + i * RIPPLE_STAGGER : SIMULTANEOUS_WINDOW;
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
  const c = contactStartRel(mode);
  return { add: norm360(B_LF + c - w), sub: norm360(B_LF - c + w) };
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
  const c = contactStartRel(mode);
  const target = dir > 0 ? B_LF + c : B_LF - c;
  return [ph.add, ph.sub]
    .map((p) => norm360(dir > 0 ? target - p : p - target))
    .map((t) => (t === 0 ? 360 : t))
    .sort((a, b) => a - b);
}
