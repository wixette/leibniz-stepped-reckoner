// Exports M1 pose sequences for the Blender collision sweep (check_m1_clearance.py).
// Run with `pnpm poses:m1` (node tools/export-m1-poses.mjs). Output: blender/out/m1-poses.json
// (git-ignored).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { m1NodeValues } from "../js/scene/m1Pose.js";
import * as K from "../js/sim/kinematics.js";
import { M1_SCENARIOS, walk } from "../js/tools/m1Scenarios.js";

const OUT = fileURLToPath(new URL("../blender/out/m1-poses.json", import.meta.url));
const STEP = Number(process.env.POSE_STEP ?? 0.5);

/** @type {{ label: string; values: Record<string, number> }[]} */
const poses = [];
for (const sc of M1_SCENARIOS) {
  walk(sc, STEP, (m, label) => poses.push({ label, values: m1NodeValues(m.pose()) }));
}
// Dialling: every digit's knob/rack through the full setting range at rest.
for (let k = 0; k <= 36; k++) {
  const s = k / 4;
  /** @type {Record<string, number>} */
  const values = {};
  for (let i = 0; i < 3; i++) {
    values[`pm.setting_dial.${i}`] = K.dialAngle(s);
    values[`pm.setting_rack.${i}`] = K.drumFrontY(s);
    values[`pm.drum.${i}`] = K.drumFrontY(s);
  }
  poses.push({ label: `dialling s=${s}`, values });
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ generated_by: "tools/export-m1-poses.mjs", step_deg: STEP, poses }));
process.stdout.write(`wrote ${poses.length} poses to ${OUT}\n`);
