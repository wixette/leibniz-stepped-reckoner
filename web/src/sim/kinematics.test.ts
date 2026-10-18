import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/kinematics.json";
import * as K from "./kinematics";

describe("kinematics agrees with the Python twin (which the collision sweep verified)", () => {
  it.each(fixture.samples)("s=$setting d=$digit_start theta=$theta", (x) => {
    const v = K.wheelValue(x.digit_start, x.setting, x.theta);
    expect(v).toBeCloseTo(x.v, 9);
    expect(K.sumWheelAngle(v)).toBeCloseTo(x.wheel_angle, 9);
    expect(K.storeAngleFull(0, v, x.theta, true)).toBeCloseTo(x.store_angle, 6);
    expect(K.storeAngleFull(0, v, x.theta, false)).toBeCloseTo(x.store_angle_not_executed, 6);
    expect(K.drumFrontY(x.setting)).toBeCloseTo(x.drum_front_y, 9);
    expect(K.dialAngle(x.setting)).toBeCloseTo(x.dial_angle, 9);
  });

  it("push table matches", () => {
    for (const p of fixture.push) expect(K.push(p.v)).toBeCloseTo(p.push, 6);
  });
});

describe("rib timing", () => {
  it("gives exactly s steps per full turn in both directions", () => {
    for (let s = 0; s <= 9; s++) {
      expect(K.ribProgress(s, 360)).toBe(s);
      expect(K.ribProgress(s, -360)).toBe(s);
    }
  });

  it("uses the last s windows when adding and the first s when subtracting", () => {
    const s = 3;
    const lastStart = K.ribWindowStart(9 - s); // window 6
    expect(K.ribProgress(s, lastStart)).toBe(0);
    expect(K.ribProgress(s, lastStart + K.RIB_PITCH)).toBe(1);
    expect(K.ribProgress(s, -K.ribWindowStart(0))).toBe(0);
    expect(K.ribProgress(s, -K.ribWindowStart(s))).toBe(s);
  });

  it("is monotonic within a turn", () => {
    let prev = -1;
    for (let t = 0; t <= 360; t += 0.5) {
      const u = K.ribProgress(9, t);
      expect(u).toBeGreaterThanOrEqual(prev);
      prev = u;
    }
  });
});

describe("carry store", () => {
  it("is pushed 0 -> 18 deg during the 9 -> 0 step, monotonically", () => {
    expect(K.push(9)).toBe(0);
    expect(K.push(10)).toBe(K.STORE_STEP);
    let prev = 0;
    for (let v = 9; v <= 10; v += 0.01) {
      const p = K.push(v);
      expect(p).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = p;
    }
  });

  it("completes a full horn pitch (72 deg) when the carry is executed", () => {
    expect(K.storeAngleFull(0, 10, 360, true)).toBeCloseTo(K.STORE_PITCH, 9);
    expect(K.storeAngleFull(0, -1, -360, true)).toBeCloseTo(-K.STORE_PITCH, 9);
    expect(K.storeAngleFull(0, 10, 360, false)).toBeCloseTo(K.STORE_STEP, 9);
  });
});
