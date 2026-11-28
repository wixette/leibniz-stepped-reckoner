import assert from "node:assert/strict";
import { describe, it } from "node:test";
import machine from "../../params/machine.json" with { type: "json" };
import { catchDeflection, catchHeadU, m2NodeValues } from "../../js/scene/m2Pose.js";
import { Machine } from "../../js/sim/machine.js";

const CATCH = machine.geometry.m2.frame.v.carriage_runners.catch;

describe("The carriage's detent catch rides out of its pit by itself", () => {
  it("rests in its half-circle pit, the pit's circle round it", () => {
    const R = CATCH.pit.width / 2;
    const r = CATCH.head_radius;
    assert.ok(r < R, "a near-twin of the pit's circle, a little smaller");
    // its centre on the rail's face, held off the pit's back by the margin
    assert.ok(Math.abs(catchHeadU(0) - (r - R + CATCH.margin)) < 0.005);
    assert.ok(catchHeadU(0) - r < -1, "its back half is in the pit");
  });

  it("is pushed out as the carriage moves, rides on the rail's face, and drops into the next pit", () => {
    const m = new Machine();
    assert.equal(catchDeflection(m), 0);
    let last = 0;
    for (const f of [0.01, 0.02, 0.04, 0.06]) {
      m.setCarriagePos(f);
      const d = catchDeflection(m);
      assert.ok(d >= last, `deflection grows out of the pit (${f})`);
      last = d;
    }
    const out = CATCH.head_radius + CATCH.margin - catchHeadU(0);
    m.setCarriagePos(0.5);
    assert.ok(Math.abs(catchDeflection(m) - out) < 1e-9, "on the face between two pits");
    m.setCarriagePos(1);
    assert.equal(catchDeflection(m), 0, "in the next pit");
    assert.equal(m2NodeValues(m)["pm.carriage_catch"], 0);
    m.setCarriagePos(1.5);
    assert.ok(m2NodeValues(m)["pm.carriage_catch"] > 0, "the catch turns forward about its spring's root");
  });

  it("is the same on both sides of a pit", () => {
    for (const dx of [0.3, 0.8, 1.5, 2.2]) assert.ok(Math.abs(catchHeadU(dx) - catchHeadU(-dx)) < 1e-9);
  });
});
