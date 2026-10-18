// M3 acceptance spec (plan §10.1): lessons, i18n and teaching views on assets/m2-full-machine.glb.
// A3-7 is the teaching page's ?selftest (it runs these same checks); A3-8 (M0-M2 still pass)
// is the other *.accept.test.js files in the same `pnpm test`.

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
/** @import { CheckResult } from "../../js/accept/harness.js" */
import { loadAsset } from "./loadGlb.js";
import { runM3Checks } from "../../js/accept/m3Checks.js";

/** @type {CheckResult[]} */
let results = [];

before(async () => {
  results = runM3Checks(await loadAsset("m2-full-machine.glb"));
});

describe("M3 acceptance (teaching layer)", () => {
  for (const id of ["A3-1", "A3-2", "A3-3", "A3-4", "A3-5", "A3-6", "A3-9", "A3-10", "A3-11"]) it(id, () => {
    const r = results.find((x) => x.id === id);
    assert.ok(r !== undefined, `check ${id} did not run`);
    assert.equal(r.passed, true, `${id} ${r.title}: ${r.detail}`);
  });
});
