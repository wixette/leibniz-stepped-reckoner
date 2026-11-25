// Maps a Machine pose to motion values per glTF node (Blender names) for the M2 model.
// Shared by the main page, page 03, the acceptance tests and the pose exporter for the Blender sweep.

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
