import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catchLift, m2NodeValues } from "../../js/scene/m2Pose.js";
import { Machine } from "../../js/sim/machine.js";

describe("The carriage's detent catch", () => {
  it("rests in its groove at a place, and is lifted whenever the carriage is between places", () => {
    const m = new Machine();
    assert.equal(catchLift(m), 0);
    assert.equal(m2NodeValues(m)["pm.carriage_catch"], 0);
    m.setCarriagePos(0.5);
    assert.equal(catchLift(m), 1, "over the rail, between two grooves");
    assert.ok(m2NodeValues(m)["pm.carriage_catch"] > 0);
    m.setCarriagePos(1);
    assert.equal(catchLift(m), 0);
  });

  it("follows the animator's lift at a place, within 0..1, and Reset drops it", () => {
    const m = new Machine();
    m.catchLift = 0.4;
    assert.equal(catchLift(m), 0.4);
    m.catchLift = 1.7;
    assert.equal(catchLift(m), 1);
    m.reset();
    assert.equal(catchLift(m), 0);
  });
});
