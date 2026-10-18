// Crank-angle kinematics of one digit. Mirrors blender/scripts/lib/kinematics.py,
// which the collision sweep verified; src/sim/kinematics.test.ts checks that both agree.
//
// theta: crank angle in degrees within one operation, 0..360 adding, 0..-360 subtracting.
// v: continuous value of the result wheel (digit + fraction of a step).

import machine from "../../../params/machine.json";

type Entry<T = number> = { v: T };
const val = <T = number>(e: Entry<T>): T => e.v;

const P = machine.pars_mobilis;
const G = machine.geometry;
const T = machine.timing;

export const RIB_PITCH = val(P.drum.rib_pitch); // 22.5
export const RIB_START = val(T.rest_free_arc_before_ribs); // 78.75
export const CARRY_WINDOW_START = val(T.carry_window as Entry<number[]>)[0]; // 281.25
export const PER_CARRY = val(T.per_carry_angle); // 9.8
const STEP = val(G.drum.rib_length_step);
const L = val(G.drum.length);
const Y_GEAR = val(G.receiving_gear.y);
export const SUM_STEP = val(machine.pars_immobilis.sum_wheel_step); // 36
export const STORE_STEP = val(machine.pars_immobilis.einzahn_store_rotation); // 18
export const STORE_PITCH = val(machine.pars_immobilis.fuenfhorn_pitch); // 72

const RE = val(G.result.einzahn_radius);
const RPIN = val(G.result.einzahn_pin_radius);
const PSI_E = val(G.result.einzahn_angle);
const [FX, FZ] = val(G.carry_store.offset_xz as Entry<number[]>);
const HORN_LEN = val(G.carry_store.horn_length);
const HORN_W = val(G.carry_store.horn_width);
const HORNS = val(G.carry_store.horns);
const H_REST = (Math.atan2(-FZ, -FX) * 180) / Math.PI;

const rad = (d: number) => (d * Math.PI) / 180;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Drum front-face position along the shaft (mm) for setting s. */
export function drumFrontY(s: number): number {
  return Y_GEAR - L + (9.5 - s) * STEP;
}

/** Setting knob / pinion rotation about the vertical axis (deg). */
export function dialAngle(s: number): number {
  return 36 * s;
}

/** Window (0..8) in which rib k (1..9) passes the gear. Ribs arrive 1..9 forward, 9..1 backward. */
export function ribWindowIndex(k: number, theta: number): number {
  return theta >= 0 ? k - 1 : 9 - k;
}

/** Start angle (|theta|) of rib window w (0..8). */
export function ribWindowStart(w: number): number {
  return RIB_START + w * RIB_PITCH;
}

/** Steps (continuous, 0..s) the drum has given the result wheel so far in this turn. */
export function ribProgress(s: number, theta: number): number {
  const t = Math.abs(theta);
  let total = 0;
  for (let k = 10 - Math.round(s); k <= 9; k++) {
    total += clamp01((t - ribWindowStart(ribWindowIndex(k, theta))) / RIB_PITCH);
  }
  return total;
}

export function wheelValue(digitStart: number, s: number, theta: number): number {
  const u = ribProgress(s, theta);
  return theta >= 0 ? digitStart + u : digitStart - u;
}

/** Result-wheel rotation about the shaft axis (deg); counter-rotates the drum. */
export function sumWheelAngle(v: number): number {
  return -SUM_STEP * v;
}

// --- carry push: Einzahn pin against capsule-shaped horns (see the Python twin) ---

function clearance(h: number, v: number): number {
  const a = rad(PSI_E + SUM_STEP * v);
  const px = RE * Math.cos(a);
  const pz = RE * Math.sin(a);
  let best = Infinity;
  for (let j = 0; j < HORNS; j++) {
    const ha = rad(h + (360 / HORNS) * j);
    const vx = HORN_LEN * Math.cos(ha);
    const vz = HORN_LEN * Math.sin(ha);
    const t = clamp01(((px - FX) * vx + (pz - FZ) * vz) / (vx * vx + vz * vz));
    best = Math.min(best, Math.hypot(px - (FX + t * vx), pz - (FZ + t * vz)));
  }
  return best - (RPIN + HORN_W / 2);
}

const TABLE_STEP = 0.0025;
const PUSH_TABLE: number[] = (() => {
  let h = H_REST;
  const table: number[] = [];
  const n = Math.round(1 / TABLE_STEP);
  for (let i = 0; i <= n; i++) {
    const v = 9 + i * TABLE_STEP;
    if (clearance(h, v) < 0) {
      let lo = h - 60;
      let hi = h;
      for (let it = 0; it < 40; it++) {
        const mid = (lo + hi) / 2;
        if (clearance(mid, v) >= 0) lo = mid;
        else hi = mid;
      }
      h = lo;
    }
    table.push(Math.min(STORE_STEP, H_REST - h));
  }
  table[table.length - 1] = STORE_STEP; // the detent completes the store exactly
  return table;
})();

/** Carry-store deflection (deg, 0..18) caused by the Einzahn for v in [9, 10]. */
export function push(v: number): number {
  const x = (Math.min(Math.max(v, 9), 10) - 9) / TABLE_STEP;
  const i = Math.min(Math.floor(x), PUSH_TABLE.length - 2);
  const f = x - i;
  return PUSH_TABLE[i] * (1 - f) + PUSH_TABLE[i + 1] * f;
}

/** Store rotation from the Einzahn alone. A turn starts with v in [0, 9]. */
export function storeAngle(pendingStart: number, v: number): number {
  const base = STORE_STEP * pendingStart;
  if (v > 9) return base + push(Math.min(v, 10));
  if (v < 0) return base - push(Math.min(9 - v, 10));
  return base;
}

/** Fraction (0..1) of the carry execution for digit j in this turn's carry window. */
export function completion(theta: number, digitIndex = 0): number {
  const t0 = CARRY_WINDOW_START + digitIndex * PER_CARRY;
  return clamp01((Math.abs(theta) - t0) / PER_CARRY);
}

/** Store rotation including the execution of a carry stored in this turn. */
export function storeAngleFull(pendingStart: number, v: number, theta: number, executes: boolean): number {
  const a = storeAngle(pendingStart, v);
  if (!executes) return a;
  const sign = Math.sign(a);
  return a + sign * (STORE_PITCH - STORE_STEP) * completion(theta);
}
