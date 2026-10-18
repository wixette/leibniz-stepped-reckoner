// Exports M2 pose sequences for the Blender collision sweep (check_m2_clearance.py).
// Runs only on request:  EXPORT_POSES=1 pnpm vitest run src/tools/exportM2Poses.test.ts
// (pnpm poses:m2 does this). Output: ../blender/out/m2-poses.json (git-ignored).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { it } from "vitest";
import { m2NodeValues } from "../scene/m2Pose";
import * as K from "../sim/kinematics";
import { Machine } from "../sim/machine";
import { M2_SCENARIOS, walkM2 } from "./m2Scenarios";

const OUT = fileURLToPath(new URL("../../../blender/out/m2-poses.json", import.meta.url));
const STEP = Number(process.env.POSE_STEP ?? 1);
const SHIFT_STEP = Number(process.env.SHIFT_STEP ?? 1 / 32);

type Pose = { label: string; values: Record<string, number>; hidden: string[] };
const hidden = (m: Machine) => (m.pin === null ? ["pm.magna_pin"] : []);

it.runIf(process.env.EXPORT_POSES)("export M2 poses", () => {
  const poses: Pose[] = [];
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
  writeFileSync(OUT, JSON.stringify({ generated_by: "web/src/tools/exportM2Poses.test.ts", step_deg: STEP, shift_step: SHIFT_STEP, poses }));
  process.stdout.write(`wrote ${poses.length} poses to ${OUT}\n`);
});
