// Exports M1 pose sequences for the Blender collision sweep (check_m1_clearance.py).
// Runs only on request:  EXPORT_POSES=1 pnpm vitest run src/tools/exportM1Poses.test.ts
// (pnpm poses:m1 does this). Output: ../blender/out/m1-poses.json (git-ignored).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { it } from "vitest";
import { m1NodeValues } from "../scene/m1Pose";
import * as K from "../sim/kinematics";
import { M1_SCENARIOS, walk } from "./m1Scenarios";

const OUT = fileURLToPath(new URL("../../../blender/out/m1-poses.json", import.meta.url));
const STEP = Number(process.env.POSE_STEP ?? 0.5);

it.runIf(process.env.EXPORT_POSES)("export M1 poses", () => {
  const poses: { label: string; values: Record<string, number> }[] = [];
  for (const sc of M1_SCENARIOS) {
    walk(sc, STEP, (m, label) => poses.push({ label, values: m1NodeValues(m.pose()) }));
  }
  // Dialling: every digit's knob/rack through the full setting range at rest.
  for (let k = 0; k <= 36; k++) {
    const s = k / 4;
    const values: Record<string, number> = {};
    for (let i = 0; i < 3; i++) {
      values[`pm.setting_dial.${i}`] = K.dialAngle(s);
      values[`pm.setting_rack.${i}`] = K.drumFrontY(s);
      values[`pm.drum.${i}`] = K.drumFrontY(s);
    }
    poses.push({ label: `dialling s=${s}`, values });
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ generated_by: "web/src/tools/exportM1Poses.test.ts", step_deg: STEP, poses }));
  process.stdout.write(`wrote ${poses.length} poses to ${OUT}\n`);
});
