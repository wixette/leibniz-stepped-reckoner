// Maps a Machine pose to motion values per glTF node (Blender names) for the M2 model.
// Shared by the main page, the acceptance tests and the pose exporter for the Blender sweep.

import machine from "../../params/machine.json" with { type: "json" };
import * as THREE from "three";
/** @import { Machine } from "../sim/machine.js" */
import { gltfName, Rig } from "./rig.js";

/**
 * @param {number} R
 * @param {number} C
 * @returns {Record<string, string>}
 */
export function m2NodeNames(R, C) {
  /** @type {Record<string, string>} */
  const names = {
    "pm.carriage": "pm.carriage",
    "frame.lead_screw": "frame.lead_screw",
    "pm.magna_rota": "pm.magna_rota",
    "pm.counter_ring": "pm.counter_ring",
    "pm.counter_pin": "pm.counter_pin",
    "pm.main_crank": "pm.main_crank",
    "pm.large_gear_a": "pm.large_gear_a",
    "pm.large_gear_b": "pm.large_gear_b",
    "pm.large_gear_c": "pm.large_gear_c",
    "pm.counter_shaft": "pm.counter_shaft",
    "pm.counter_k": "pm.counter_k",
    "pm.counter_l": "pm.counter_l",
    "pm.counter_n": "pm.counter_n",
    "pm.carriage_catch": "pm.carriage_catch",
  };
  for (let k = 0; k < R; k++) {
    for (const base of ["pi.sum_wheel", "pi.carry_store", "pi.five_horn_s", "pi.five_horn_sr"]) names[`${base}.${k}`] = `${base}.${k}`;
  }
  for (let j = 0; j < C; j++) {
    for (const base of ["pm.drum_shaft", "pm.drum", "pm.setting_rack", "pm.setting_dial", "pm.lever", "pm.zweihorn", "pm.zweihorn_r"]) {
      names[`${base}.${j}`] = `${base}.${j}`;
    }
  }
  return names;
}

/**
 * Which way the rig turns each crank as the machine goes forward (adds, or shifts the carriage
 * left): the main crank's angle is negated (adding turns it anticlockwise from the front, see
 * m2NodeValues), the end crank's is not. Dragging a crank (js/teach/partActions.js) reads its
 * turn with this sign; tests/scene and A3-15 check it against m2NodeValues.
 * @type {Record<string, 1 | -1>}
 */
export const CRANK_FORWARD = { "pm.main_crank": -1, "frame.lead_screw": 1 };

const CATCH = machine.geometry.m2.frame.v.carriage_runners.catch;
const PITCH = machine.layout.digit_pitch.v;

/**
 * The outline of the front rail around a pit, seen from above (mm): x along the rail from the
 * pit's middle, u forward of the rail's front face (the rail is at u <= 0, but for the pit).
 * The pit is a half circle, as wide as the slot, centred on the face; a small rounding
 * (mouth_fillet) joins it to the face at each side.
 * @type {[number, number][]}
 */
const PIT_EDGE = (() => {
  const R = CATCH.pit.width / 2, e = CATCH.pit.mouth_fillet;
  const xf = Math.sqrt((R + e) ** 2 - e * e); // where the rounding meets the face
  const t1 = Math.atan2(e, xf); // where it meets the half circle, from the face line
  /** @type {[number, number][]} */
  const pts = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i <= 200; i++) pts.push([s * (xf + (PITCH / 2) * (i / 200)), 0]); // the face
    for (let i = 0; i <= 32; i++) {
      // the rounding: a circle e about (xf, -e), from the face to the half circle
      const ang = Math.PI / 2 + (Math.PI / 2 - t1) * (i / 32); // from straight up to toward the centre
      pts.push([s * (xf + e * Math.cos(ang)), -e + e * Math.sin(ang)]);
    }
    for (let i = 0; i <= 64; i++) {
      const t = t1 + (Math.PI / 2 - t1) * (i / 64); // the half circle, from the rounding to its back
      pts.push([s * R * Math.cos(t), -R * Math.sin(t)]);
    }
  }
  return pts;
})();

/**
 * How far forward of the rail's face the catch's round head stands, its centre dx from the
 * pit's middle (mm): the head rests on the pit's two rounded mouth edges, and as the carriage
 * moves it rides up an edge, along the face and into the next pit. Nothing lifts it: the shape
 * does, against its spring (K. Badur: a sprung catch; the owner: it rides out by itself).
 * @param {number} dx
 * @returns {number}
 */
export function catchHeadU(dx) {
  const r = CATCH.head_radius;
  // over the flat face, the head stands one radius out of it
  const xf = Math.sqrt((CATCH.pit.width / 2 + CATCH.pit.mouth_fillet) ** 2 - CATCH.pit.mouth_fillet ** 2);
  let u = Math.abs(dx) >= xf ? r : -Infinity;
  for (const [x, y] of PIT_EDGE) {
    const h = r * r - (x - dx) * (x - dx);
    if (h > 0) u = Math.max(u, y + Math.sqrt(h));
  }
  return u + CATCH.margin;
}

/**
 * How far the detent catch turns forward about its spring's root (radians), at the carriage's
 * position: the smallest angle at which its round head, where its arc about the root takes it
 * (forward, and a little sideways), clears the pit (catchHeadU). Nothing but the pit's shape
 * moves it.
 * @param {Machine} m
 * @returns {number}
 */
export function catchAngle(m) {
  // the head's centre from the root: L toward the carriage's left end, h back toward the rail
  // (the root is on the spring plate, in front of the head)
  const L = CATCH.spring.root_dx;
  const u0 = catchHeadU(0);
  const h = machine.geometry.m2.frame.v.lower_frame.a.y[0] - u0 - (CATCH.spring.y_front + CATCH.spring.thickness / 2);
  // the head's place along the rail from the pit's middle: the carriage leftward of its place
  // as the offset grows; the root is to the head's right (+x)
  const along = -(m.carriagePos - Math.round(m.carriagePos)) * PITCH;
  /** @param {number} a */
  const clear = (a) => u0 + L * Math.sin(a) + h * (1 - Math.cos(a)) >= catchHeadU(along + L * (1 - Math.cos(a)) - h * Math.sin(a));
  if (clear(0)) return 0;
  let lo = 0, hi = Math.asin(Math.min(1, (CATCH.head_radius + 1) / L));
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (clear(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/**
 * How far forward of its rest the catch's head stands (mm).
 * @param {Machine} m
 * @returns {number}
 */
export function catchDeflection(m) {
  const a = catchAngle(m);
  const h = machine.geometry.m2.frame.v.lower_frame.a.y[0] - catchHeadU(0) - (CATCH.spring.y_front + CATCH.spring.thickness / 2);
  return CATCH.spring.root_dx * Math.sin(a) + h * (1 - Math.cos(a));
}

/**
 * @param {Machine} m
 * @returns {Record<string, number>}
 */
export function m2NodeValues(m) {
  const p = m.machinePose();
  // The machine's pose (js/sim) and the carry's contact solves turn the drive one way; the model
  // is built as their mirror image, so that adding turns the crank anticlockwise seen from the
  // front, as on the original (K. Badur, 2026-11-25): every rotation of the drive and the carry
  // is negated here, and the parts' features are mirrored in the build (build_m2.py).
  const ring = -p.counterRing; // anticlockwise seen from above when adding (Badur)
  /** @type {Record<string, number>} */
  const out = {
    "pm.carriage": p.carriageX,
    "frame.lead_screw": p.endCrank,
    "pm.magna_rota": -p.magnaRota,
    "pm.counter_ring": ring,
    // built at the stop; set in hole m it starts m holes clockwise of it (the centre's numbers)
    "pm.counter_pin": ring - 36 * (m.pin ?? 0),
    "pm.main_crank": -p.mainCrank,
    // B is on the crank's drum shaft; A, C and the 17th shaft turn with the lever shafts
    "pm.large_gear_b": -p.mainCrank,
    "pm.large_gear_a": p.mainCrank,
    "pm.large_gear_c": p.mainCrank,
    "pm.counter_shaft": p.mainCrank,
    // the counter's train (build_m2.py): K and J step a tooth (24 deg) a turn about the front-back
    // axis, L and M a tenth of a turn about the vertical, the other way from N and the ring
    "pm.counter_k": (2 / 3) * p.counterRing,
    "pm.counter_l": p.counterRing,
    "pm.counter_n": ring,
    // the catch turns about its spring's root (approximating the spring's bending)
    "pm.carriage_catch": THREE.MathUtils.radToDeg(catchAngle(m)),
  };
  p.register.forEach((r, k) => {
    out[`pi.sum_wheel.${k}`] = -r.wheel;
    out[`pi.carry_store.${k}`] = -r.store;
    out[`pi.five_horn_s.${k}`] = -r.store;
    out[`pi.five_horn_sr.${k}`] = -r.store;
  });
  p.carriage.forEach((c, j) => {
    out[`pm.drum_shaft.${j}`] = -c.drumShaft;
    out[`pm.drum.${j}`] = c.drumY;
    out[`pm.setting_rack.${j}`] = c.drumY;
    out[`pm.setting_dial.${j}`] = c.dial;
    out[`pm.lever.${j}`] = -c.lever;
    // one part per lever and set, its adding horn at the lever's phase and its subtracting horn
    // built the lever's spread on (build_m2.py, params/lever-phases.json); only the fitted set shows
    out[`pm.zweihorn.${j}`] = -c.hornAdd;
    out[`pm.zweihorn_r.${j}`] = -c.hornAdd;
  });
  return out;
}

/**
 * The parts of the carry set not fitted in the machine's mode (Blender names): the original's
 * Zweihorn and front five-horn s for the simultaneous carry, the ripple set's for the ripple carry.
 * @param {Machine} m
 * @returns {string[]}
 */
export function unfittedCarrySet(m) {
  const ripple = m.mode === "ripple";
  /** @type {string[]} */
  const out = [];
  for (let k = 0; k < m.registerDigits; k++) out.push(ripple ? `pi.five_horn_s.${k}` : `pi.five_horn_sr.${k}`);
  for (let j = 0; j < m.carriageDigits; j++) {
    out.push(ripple ? `pm.zweihorn.${j}` : `pm.zweihorn_r.${j}`);
  }
  return out;
}

/**
 * Poses the model from the machine state (and shows the pin in its hole when it is set, in its
 * parking place when it is out).
 * @param {Rig<string>} rig
 * @param {THREE.Object3D} root
 * @param {Machine} m
 * @returns {void}
 */
export function applyM2Pose(rig, root, m) {
  for (const [name, value] of Object.entries(m2NodeValues(m))) rig.set(name, value);
  const off = new Set(unfittedCarrySet(m).map(gltfName));
  for (let k = 0; k < m.registerDigits; k++) {
    for (const n of [`pi.five_horn_s.${k}`, `pi.five_horn_sr.${k}`]) {
      const o = root.getObjectByName(gltfName(n));
      if (o) o.visible = !off.has(gltfName(n));
    }
  }
  for (let j = 0; j < m.carriageDigits; j++) {
    for (const n of [`pm.zweihorn.${j}`, `pm.zweihorn_r.${j}`]) {
      const o = root.getObjectByName(gltfName(n));
      if (o) o.visible = !off.has(gltfName(n));
    }
  }
  const pin = root.getObjectByName(gltfName("pm.counter_pin"));
  if (pin) pin.visible = m.pin !== null;
  const park = root.getObjectByName(gltfName("pm.counter_pin_park"));
  if (park) park.visible = m.pin === null;
}
