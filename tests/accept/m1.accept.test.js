// M1 acceptance spec (plan §10.1): runs on assets/m1-carry-slice.glb in Node.
// A1-7 (M0 still passes) is m0.accept.test.js, which runs in the same `pnpm test`.

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
/** @import { CheckResult } from "../../js/accept/harness.js" */
import { loadAsset } from "./loadGlb.js";
import { runM1Checks } from "../../js/accept/m1Checks.js";

/** @type {CheckResult[]} */
let results = [];

before(async () => {
  results = runM1Checks(await loadAsset("m1-carry-slice.glb"));
});

describe("M1 acceptance (three-digit carry slice)", () => {
  for (const id of ["A1-1", "A1-2", "A1-3", "A1-4", "A1-5", "A1-6"]) it(id, () => {
    const r = results.find((x) => x.id === id);
    assert.ok(r !== undefined, `check ${id} did not run`);
    assert.equal(r.passed, true, `${id} ${r.title}: ${r.detail}`);
  });
});
