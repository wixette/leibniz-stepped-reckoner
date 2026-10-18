// M2 acceptance spec (plan §10.1): runs on assets/m2-full-machine.glb in Node.
// A2-10 (M0 and M1 still pass) is m0.accept.test.js and m1.accept.test.js, which run in
// the same `pnpm test`.

import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
/** @import { CheckResult } from "../../js/accept/harness.js" */
import { loadAsset } from "./loadGlb.js";
import { runM2Checks } from "../../js/accept/m2Checks.js";

const FILE = "m2-full-machine.glb";
/** @type {CheckResult[]} */
let results = [];

before(async () => {
  const bytes = statSync(fileURLToPath(new URL(`../../assets/${FILE}`, import.meta.url))).size;
  results = runM2Checks(await loadAsset(FILE), { bytes });
});

const IDS = ["A2-1", "A2-2", "A2-3", "A2-4", "A2-5", "A2-6", "A2-7", "A2-8", "A2-9", "A2-11", "A2-12", "A2-13"];

describe("M2 acceptance (full machine)", () => {
  for (const id of IDS) it(id, () => {
    const r = results.find((x) => x.id === id);
    assert.ok(r !== undefined, `check ${id} did not run`);
    assert.equal(r.passed, true, `${id} ${r.title}: ${r.detail}`);
  });
});
