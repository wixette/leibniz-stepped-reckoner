// M1 kinematics: carry execution (Zweihorn pin pushing the Fünfhorn), carry transfer
// (Muldenrad teeth -> star on the next result shaft) and lever phases per carry mode.
// Geometry is per digit, in mm, in the X-Z plane of the digit (x = 0 at its drum axis).
// Angles: world angle in the X-Z plane, CCW positive (x = cos, z = sin). A part turned by
// +phi about +Y has every feature at (local angle - phi).

import machine from "../../params/machine.json" with { type: "json" };
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
/** @param {number} d */
const rad = (d) => (d * Math.PI) / 180;
/** @param {number} x */
const clamp01 = (x) => Math.min(1, Math.max(0, x));

export const DIGITS = val(M1.digits);
export const CARRY_WINDOW_START = val(/** @type {Entry<number[]>} */ (T.carry_window))[0];
export const PER_CARRY = val(T.per_carry_angle);
export const SPRING_SNAP = val(T.spring_snap_deg);
export const SPRING_FROM = val(T.spring_from_store);

// --- layout (per digit) ------------------------------------------------------------
const zd = val(G.drum.axis_z);
const drumPitchR = (val(G.drum.module) * val(G.drum.virtual_teeth)) / 2;
const rgPitchR = (val(G.receiving_gear.module) * val(G.receiving_gear.teeth)) / 2;
const zs = zd + drumPitchR + rgPitchR;
const [FDX, FDZ] = val(/** @type {Entry<number[]>} */ (G.carry_store.offset_xz));
export const F = { x: FDX, z: zs + FDZ };
export const L = { x: val(M1.lever_axis_dx), z: val(M1.lever_axis_z) };
export const B_FL = deg(Math.atan2(L.z - F.z, L.x - F.x)); // store axis -> lever axis
export const B_LF = deg(Math.atan2(F.z - L.z, F.x - L.x)); // lever axis -> store axis

const PIN_R = val(M1.zweihorn_pin_radius);
const PATH_R = val(M1.zweihorn_pin_path_radius);
const FH_LEN = val(M1.fuenfhorn_horn_length);
const FH_R = val(M1.fuenfhorn_horn_radius);
const FH_HUB = val(M1.fuenfhorn_hub_radius);
const MR_CROSS = val(M1.muldenrad_crossing_store_angle); // 36

/**
 * @param {number} px
 * @param {number} pz
 * @param {number} ax
 * @param {number} az
 * @param {number} bx
 * @param {number} bz
 */
function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const t = clamp01(((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz));
  return Math.hypot(px - (ax + t * vx), pz - (az + t * vz));
}

/**
 * Clearance (mm) between the Zweihorn pin at world angle alpha and the Fünfhorn at store angle.
 * @param {number} alpha
 * @param {number} store
 * @returns {number}
 */
export function pinClearance(alpha, store) {
  const px = L.x + PATH_R * Math.cos(rad(alpha));
  const pz = L.z + PATH_R * Math.sin(rad(alpha));
  let best = Math.hypot(px - F.x, pz - F.z) - (PIN_R + FH_HUB);
  for (let k = 0; k < 5; k++) {
    const a = rad(B_FL + 36 + 72 * k - store);
    const d = segDist(px, pz, F.x, F.z, F.x + FH_LEN * Math.cos(a), F.z + FH_LEN * Math.sin(a)) - (PIN_R + FH_R);
    best = Math.min(best, d);
  }
  return best;
}

// --- Zweihorn push table (adding; subtraction is the mirror image) ----------------------
const TABLE_STEP = 0.05; // deg of lever travel
const push = (() => {
  let store = STORE_STEP;
  /** @type {number | null} */
  let start = null;
  /** @type {number[]} */
  const table = [];
  for (let alpha = B_LF - 40; alpha < B_LF + 40; alpha += TABLE_STEP) {
    if (pinClearance(alpha, store) < 0) {
      if (start === null) start = alpha;
      let lo = store, hi = store + 90;
      for (let it = 0; it < 40; it++) {
        const mid = (lo + hi) / 2;
        if (pinClearance(alpha, mid) >= 0) hi = mid;
        else lo = mid;
      }
      store = hi;
    }
    if (start !== null) table.push(store);
  }
  if (start === null) throw new Error("Zweihorn never touches a stored Fünfhorn: check geometry params");
  // Trim the table at release (the store stops moving).
  let last = table.length - 1;
  while (last > 0 && table[last] === table[last - 1]) last--;
  return { contactStartRel: start - B_LF, table: table.slice(0, last + 1) };
})();

/** Lever angle (deg) between first contact and the crossing of the store->lever line (negative). */
export const CONTACT_START_REL = push.contactStartRel;
/** Lever travel (deg) from first contact to where the pin alone would release the store. */
export const RELEASE_TRAVEL = (push.table.length - 1) * TABLE_STEP;
export const RELEASE_STORE = push.table[push.table.length - 1];

/** @param {number} t */
const pushed = (t) => {
  const x = t / TABLE_STEP;
  const i = Math.min(Math.floor(x), push.table.length - 2);
  const f = x - i;
  return push.table[i] * (1 - f) + push.table[i + 1] * f;
};

/** Lever travel (deg) until the store reaches SPRING_FROM (or the pin releases it earlier). */
export const SPRING_START = (() => {
  for (let t = 0; t <= RELEASE_TRAVEL; t += 0.01) if (pushed(t) >= SPRING_FROM) return t;
  return RELEASE_TRAVEL;
})();
const SPRING_START_STORE = pushed(SPRING_START);

/**
 * Store angle (adding sense, 18..72) after the lever has travelled t deg since first contact.
 *  The pin pushes the store to SPRING_FROM; the detent spring then completes the horn pitch.
 * @param {number} t
 * @returns {number}
 */
export function executionCurve(t) {
  if (t <= 0) return STORE_STEP;
  if (t <= SPRING_START) return pushed(t);
  const u = clamp01((t - SPRING_START) / SPRING_SNAP);
  const e = u * u * (3 - 2 * u);
  return SPRING_START_STORE + (STORE_PITCH - SPRING_START_STORE) * e;
}

/**
 * Carry-transfer progress (0..1) of the next wheel while the store turns 18 -> 72 (Muldenrad teeth).
 * @param {number} storeAbs
 * @returns {number}
 */
export function transferProgress(storeAbs) {
  return clamp01((storeAbs - (MR_CROSS - 9)) / 18);
}

/** Lever travel (deg) after first contact until the next wheel has completed its step. */
export const TRANSFER_TRAVEL = (() => {
  for (let t = 0; t <= SPRING_START + SPRING_SNAP; t += 0.01) {
    if (transferProgress(executionCurve(t)) >= 1) return t;
  }
  return SPRING_START + SPRING_SNAP;
})();

/** Lever travel (deg) after first contact until the store is back at rest (72 deg). */
export const EXECUTION_TRAVEL = SPRING_START + SPRING_SNAP;

// --- lever phases per mode ---------------------------------------------------------------
/** @typedef {"ripple" | "historical"} CarryMode */

/**
 * |theta| at which digit i's adding horn first touches its store (and the subtracting horn, mirrored).
 * @param {number} i
 * @param {CarryMode} mode
 * @returns {number}
 */
export function leverWindow(i, mode, n = DIGITS) {
  const order = mode === "ripple" ? i : n - 1 - i;
  return CARRY_WINDOW_START + order * PER_CARRY;
}

/** @param {number} a */
const norm360 = (a) => ((a % 360) + 360) % 360;

/**
 * World angle of each horn at theta = 0 (the Zweihorn's two horns differ by the spread angle).
 * @param {number} i
 * @param {CarryMode} mode
 */
export function hornPhases(i, mode, n = DIGITS) {
  const w = leverWindow(i, mode, n);
  return { add: norm360(B_LF + CONTACT_START_REL - w), sub: norm360(B_LF - CONTACT_START_REL + w) };
}

/**
 * Contact-start crank angles of both horns for a turn in direction dir (|theta| values, ascending).
 * @param {number} i
 * @param {CarryMode} mode
 * @param {1 | -1} dir
 * @returns {number[]}
 */
export function leverPasses(i, mode, dir, n = DIGITS) {
  const ph = hornPhases(i, mode, n);
  // Adding: horns move CCW (+theta) and first touch at B_LF + CONTACT_START_REL.
  // Subtracting: horns move CW and first touch at B_LF - CONTACT_START_REL.
  const target = dir > 0 ? B_LF + CONTACT_START_REL : B_LF - CONTACT_START_REL;
  return [ph.add, ph.sub]
    .map((p) => norm360(dir > 0 ? target - p : p - target))
    .map((t) => (t === 0 ? 360 : t))
    .sort((a, b) => a - b);
}
