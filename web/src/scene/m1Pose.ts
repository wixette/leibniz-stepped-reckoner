// Maps a CarrySlice pose to motion values per glTF node (Blender names). Shared by the
// M1 page, the acceptance tests and the pose exporter used by the Blender sweep.

import type { DigitPose } from "../sim/carrySlice";
import { Rig } from "./rig";

export function m1NodeNames(n: number): Record<string, string> {
  const names: Record<string, string> = {};
  for (let i = 0; i < n; i++) {
    for (const base of [
      "pm.drum_shaft", "pm.drum", "pm.setting_rack", "pm.setting_dial", "pi.sum_wheel",
      "pi.carry_store", "pm.lever", "pm.zweihorn_add", "pm.zweihorn_sub",
    ]) {
      names[`${base}.${i}`] = `${base}.${i}`;
    }
  }
  return names;
}

export function m1NodeValues(poses: DigitPose[]): Record<string, number> {
  const out: Record<string, number> = {};
  poses.forEach((p, i) => {
    out[`pm.drum_shaft.${i}`] = p.drumShaft;
    out[`pm.drum.${i}`] = p.drumY;
    out[`pm.setting_rack.${i}`] = p.drumY;
    out[`pm.setting_dial.${i}`] = p.dial;
    out[`pi.sum_wheel.${i}`] = p.wheel;
    out[`pi.carry_store.${i}`] = p.store;
    out[`pm.lever.${i}`] = p.lever;
    out[`pm.zweihorn_add.${i}`] = p.hornAdd;
    out[`pm.zweihorn_sub.${i}`] = p.hornSub;
  });
  return out;
}

export function applyM1Pose(rig: Rig<string>, poses: DigitPose[]): void {
  for (const [name, value] of Object.entries(m1NodeValues(poses))) rig.set(name, value);
}
