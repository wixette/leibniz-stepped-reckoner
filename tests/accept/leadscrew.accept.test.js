// The lead screw's cut groove drives the carriage through the nut's follower pin (Badur: on the
// original the thread is a cut groove; design/v1.4-notes.md): the pin stays in the groove as the
// carriage shifts, and only because the screw turns with it.

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { intersects } from "../../js/accept/harness.js";
import { applyM2Pose, m2NodeNames } from "../../js/scene/m2Pose.js";
import { gltfName, Rig } from "../../js/scene/rig.js";
import { Machine } from "../../js/sim/machine.js";
import { loadAsset } from "./loadGlb.js";

describe("The lead screw and the nut's pin", () => {
  /** @type {import("three").Group} */
  let root;
  before(async () => {
    root = await loadAsset("m2-full-machine.glb");
  });

  it("the pin rides in the groove through a shift, and would hit the screw if it did not turn", () => {
    const m = new Machine();
    const rig = new Rig(root, m2NodeNames(m.registerDigits, m.carriageDigits));
    const carriage = /** @type {import("three").Object3D} */ (root.getObjectByName(gltfName("pm.carriage")));
    const screw = /** @type {import("three").Object3D} */ (root.getObjectByName(gltfName("frame.lead_screw")));
    for (const pos of [0, 0.1, 0.25, 0.5, 0.75, 1, 3.4, 6.9, 7]) {
      m.setCarriagePos(pos);
      applyM2Pose(rig, root, m);
      assert.equal(intersects(carriage, screw), false, `carriage at ${pos}`);
    }
    m.setCarriagePos(0.25);
    applyM2Pose(rig, root, m);
    rig.set("frame.lead_screw", -m.machinePose().endCrank); // the screw turned the other way
    assert.equal(intersects(carriage, screw), true, "the pin is in the groove");
  });
});
