// M0 acceptance spec (plan §10.1): runs on assets/m0-digit-slice.glb in Node.

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
/** @import { CheckResult } from "../../js/accept/harness.js" */
import { loadAsset } from "./loadGlb.js";
import { runM0Checks } from "../../js/accept/m0Checks.js";

/** @type {CheckResult[]} */
let results = [];

before(async () => {
  results = runM0Checks(await loadAsset("m0-digit-slice.glb"));
}); // budget: docs/conventions.md asks for ~30 s per machine

const IDS = ["A0-1", "A0-2", "A0-3", "A0-4", "A0-5", "A0-6", "A0-7", "A0-8", "A0-9", "A0-10"];

describe("M0 acceptance (one-digit slice)", () => {
  for (const id of IDS) it(id, () => {
    const r = results.find((x) => x.id === id);
    assert.ok(r !== undefined, `check ${id} did not run`);
    assert.equal(r.passed, true, `${id} ${r.title}: ${r.detail}`);
  });
});

describe("M0 acceptance on an already-posed model (as in the page's ?selftest)", () => {
  it("gives the same results after the model was posed by another rig", async () => {
    const { M0_NODES, Rig } = await import("../../js/scene/rig.js");
    const { applyM0Pose } = await import("../../js/scene/m0Pose.js");
    const { DigitSlice } = await import("../../js/sim/digitSlice.js");
    const root = await loadAsset("m0-digit-slice.glb");
    const pageRig = new Rig(root, M0_NODES);
    const m = new DigitSlice();
    m.setSetting(7);
    m.setTheta(123);
    applyM0Pose(pageRig, m.pose());
    const again = runM0Checks(root);
    assert.deepEqual(again.filter((r) => !r.passed).map((r) => `${r.id}: ${r.detail}`), []);
  });
});
