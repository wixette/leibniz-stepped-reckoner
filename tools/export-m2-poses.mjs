// Exports M2 pose sequences for the Blender collision sweep (check_m2_clearance.py).
// Run with `pnpm poses:m2` (node tools/export-m2-poses.mjs). Output: blender/out/m2-poses.json
// (git-ignored).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { m2NodeValues } from "../js/scene/m2Pose.js";
import * as K from "../js/sim/kinematics.js";
import { Machine } from "../js/sim/machine.js";
import { M2_SCENARIOS, walkM2 } from "../js/tools/m2Scenarios.js";

const OUT = fileURLToPath(new URL("../blender/out/m2-poses.json", import.meta.url));
const STEP = Number(process.env.POSE_STEP ?? 1);
const SHIFT_STEP = Number(process.env.SHIFT_STEP ?? 1 / 32);

/**
 * @typedef {object} Pose
 * @property {string} label
 * @property {Record<string, number>} values
 * @property {string[]} hidden
 */
/** @param {Machine} m */
const hidden = (m) => (m.pin === null ? ["pm.magna_pin"] : []);

/** @type {Pose[]} */
const poses = [];
for (const sc of M2_SCENARIOS) {
  walkM2(sc, STEP, SHIFT_STEP, (m, label) => poses.push({ label, values: m2NodeValues(m), hidden: hidden(m) }));
}
// Dialling: every knob/rack/drum through the full setting range at rest, at both ends
// of the carriage travel.
for (const offset of [0, 8]) {
  const m = new Machine();
  m.setOffset(offset);
  const base = m2NodeValues(m);
  for (let k = 0; k <= 36; k++) {
    const s = k / 4;
    const values = { ...base };
    for (let j = 0; j < m.carriageDigits; j++) {
      values[`pm.setting_dial.${j}`] = K.dialAngle(s);
      values[`pm.setting_rack.${j}`] = K.drumFrontY(s);
      values[`pm.drum.${j}`] = K.drumFrontY(s);
    }
    poses.push({ label: `dialling s=${s} offset ${offset}`, values, hidden: hidden(m) });
  }
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ generated_by: "tools/export-m2-poses.mjs", step_deg: STEP, shift_step: SHIFT_STEP, poses }));
process.stdout.write(`wrote ${poses.length} poses to ${OUT}\n`);
