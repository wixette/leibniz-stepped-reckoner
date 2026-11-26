// Exports the carry levers' horn phases (the two horns of each lever, for each carry set) for the
// Blender build, which draws each Zweihorn as one part with its two horns at that lever's spread.
// Run with `pnpm phases` (node tools/export-lever-phases.mjs) after any change to the carry's
// timing (params/carry-tables.json, timing in params/machine.json). Output: params/lever-phases.json;
// tests/sim/machine.test.js checks that it is up to date.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as M from "../js/sim/kinematicsM1.js";

const OUT = fileURLToPath(new URL("../params/lever-phases.json", import.meta.url));
const LEVERS = 8;

/** @param {M.CarryMode} mode */
const phases = (mode) =>
  Array.from({ length: LEVERS }, (_, j) => {
    const p = M.hornPhases(j, mode);
    return { add: Math.round(p.add * 1e6) / 1e6, sub: Math.round(p.sub * 1e6) / 1e6 };
  });

const out = {
  generated_by: "tools/export-lever-phases.mjs",
  note: "World angle (deg, the simulator's frame) of each lever's adding and subtracting horn at theta = 0; the two turn together, so add - sub is the lever's spread.",
  simultaneous: phases("simultaneous"),
  ripple: phases("ripple"),
};
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${OUT}`);
