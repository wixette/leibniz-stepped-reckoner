import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fixture from "../fixtures/kinematics.json" with { type: "json" };
import * as K from "../../js/sim/kinematics.js";

/**
 * Equal to `digits` decimal places: |actual - expected| < 10^-digits / 2.
 * @param {number} actual
 * @param {number} expected
 * @param {number} digits
 */
function closeTo(actual, expected, digits) {
  assert.ok(Math.abs(actual - expected) < 10 ** -digits / 2, `${actual} is not close to ${expected} (${digits} digits)`);
}

describe("kinematics agrees with the Python twin (which the collision sweep verified)", () => {
  for (const x of fixture.samples) it(`s=${x.setting} d=${x.digit_start} theta=${x.theta}`, () => {
    const v = K.wheelValue(x.digit_start, x.setting, x.theta);
    closeTo(v, x.v, 9);
    closeTo(K.sumWheelAngle(v), x.wheel_angle, 9);
    closeTo(K.storeAngleFull(0, v, x.theta, true), x.store_angle, 6);
    closeTo(K.storeAngleFull(0, v, x.theta, false), x.store_angle_not_executed, 6);
    closeTo(K.drumFrontY(x.setting), x.drum_front_y, 9);
    closeTo(K.dialAngle(x.setting), x.dial_angle, 9);
  });

  it("push table matches", () => {
    for (const p of fixture.push) closeTo(K.push(p.v), p.push, 6);
  });
});

describe("rib timing", () => {
  it("gives exactly s steps per full turn in both directions", () => {
    for (let s = 0; s <= 9; s++) {
      assert.equal(K.ribProgress(s, 360), s);
      assert.equal(K.ribProgress(s, -360), s);
    }
  });

  it("uses the last s windows when adding and the first s when subtracting", () => {
    const s = 3;
    const lastStart = K.ribWindowStart(9 - s); // window 6
    assert.equal(K.ribProgress(s, lastStart), 0);
    assert.equal(K.ribProgress(s, lastStart + K.RIB_PITCH), 1);
    assert.equal(K.ribProgress(s, -K.ribWindowStart(0)), 0);
    assert.equal(K.ribProgress(s, -K.ribWindowStart(s)), s);
  });

  it("is monotonic within a turn", () => {
    let prev = -1;
    for (let t = 0; t <= 360; t += 0.5) {
      const u = K.ribProgress(9, t);
      assert.ok(u >= prev, `${u} >= ${prev}`);
      prev = u;
    }
  });
});

describe("carry store", () => {
  it("is pushed 0 -> 18 deg during the 9 -> 0 step, monotonically", () => {
    assert.equal(K.push(9), 0);
    assert.equal(K.push(10), K.STORE_STEP);
    let prev = 0;
    for (let v = 9; v <= 10; v += 0.01) {
      const p = K.push(v);
      assert.ok(p >= prev - 1e-12, `${p} >= ${prev - 1e-12}`);
      prev = p;
    }
  });

  it("completes a full horn pitch (72 deg) when the carry is executed", () => {
    closeTo(K.storeAngleFull(0, 10, 360, true), K.STORE_PITCH, 9);
    closeTo(K.storeAngleFull(0, -1, -360, true), -K.STORE_PITCH, 9);
    closeTo(K.storeAngleFull(0, 10, 360, false), K.STORE_STEP, 9);
  });
});
