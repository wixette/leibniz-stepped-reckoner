// Maps a Machine pose to motion values per glTF node (Blender names) for the M2 model.
// Shared by page 03, the acceptance tests and the pose exporter for the Blender sweep.

import * as THREE from "three";
import type { Machine } from "../sim/machine";
import { gltfName, Rig } from "./rig";

export function m2NodeNames(R: number, C: number): Record<string, string> {
  const names: Record<string, string> = {
    "pm.carriage": "pm.carriage",
    "frame.lead_screw": "frame.lead_screw",
    "pm.magna_rota": "pm.magna_rota",
    "pm.magna_pin": "pm.magna_pin",
    "pm.main_crank": "pm.main_crank",
  };
  for (let k = 0; k < R; k++) {
    names[`pi.sum_wheel.${k}`] = `pi.sum_wheel.${k}`;
    names[`pi.carry_store.${k}`] = `pi.carry_store.${k}`;
  }
  for (let j = 0; j < C; j++) {
    for (const base of ["pm.drum_shaft", "pm.drum", "pm.setting_rack", "pm.setting_dial", "pm.lever", "pm.zweihorn_add", "pm.zweihorn_sub"]) {
      names[`${base}.${j}`] = `${base}.${j}`;
    }
  }
  return names;
}

export function m2NodeValues(m: Machine): Record<string, number> {
  const p = m.machinePose();
  const out: Record<string, number> = {
    "pm.carriage": p.carriageX,
    "frame.lead_screw": p.endCrank,
    "pm.magna_rota": p.magnaRota,
    "pm.magna_pin": p.magnaRota - 36 * (m.pin ?? 0),
    "pm.main_crank": p.mainCrank,
  };
  p.register.forEach((r, k) => {
    out[`pi.sum_wheel.${k}`] = r.wheel;
    out[`pi.carry_store.${k}`] = r.store;
  });
  p.carriage.forEach((c, j) => {
    out[`pm.drum_shaft.${j}`] = c.drumShaft;
    out[`pm.drum.${j}`] = c.drumY;
    out[`pm.setting_rack.${j}`] = c.drumY;
    out[`pm.setting_dial.${j}`] = c.dial;
    out[`pm.lever.${j}`] = c.lever;
    out[`pm.zweihorn_add.${j}`] = c.hornAdd;
    out[`pm.zweihorn_sub.${j}`] = c.hornSub;
  });
  return out;
}

/** Poses the model from the machine state (and shows the pin only when it is inserted). */
export function applyM2Pose(rig: Rig<string>, root: THREE.Object3D, m: Machine): void {
  for (const [name, value] of Object.entries(m2NodeValues(m))) rig.set(name, value);
  const pin = root.getObjectByName(gltfName("pm.magna_pin"));
  if (pin) pin.visible = m.pin !== null;
}
