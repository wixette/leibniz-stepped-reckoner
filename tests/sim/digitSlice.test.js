import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DigitSlice } from "../../js/sim/digitSlice.js";
import * as K from "../../js/sim/kinematics.js";

/**
 * @param {DigitSlice} m
 * @param {1 | -1} dir
 */
function turn(m, dir, steps = 720) {
  for (let i = 1; i <= steps; i++) {
    if (m.setTheta((dir * 360 * i) / steps)) return;
  }
}

describe("DigitSlice arithmetic", () => {
  it("adds the setting once per forward turn", () => {
    const m = new DigitSlice();
    m.setSetting(4);
    turn(m, 1);
    assert.equal(m.digit, 4);
    turn(m, 1);
    assert.equal(m.digit, 8);
    assert.equal(m.carryOut, 0);
    assert.equal(m.turns, 2);
  });

  it("9 + 1 = 0 with a carry out", () => {
    const m = new DigitSlice();
    m.setSetting(9);
    turn(m, 1);
    m.setSetting(1);
    turn(m, 1);
    assert.equal(m.digit, 0);
    assert.equal(m.carryOut, 1);
  });

  it("0 - 1 = 9 with a borrow", () => {
    const m = new DigitSlice();
    m.setSetting(1);
    turn(m, -1);
    assert.equal(m.digit, 9);
    assert.equal(m.carryOut, -1);
    assert.equal(m.turns, -1);
  });

  it("matches (d + s) mod 10 and the carry for every digit and setting", () => {
    for (let d = 0; d <= 9; d++) {
      for (let s = 0; s <= 9; s++) {
        const m = new DigitSlice();
        m.digit = d;
        m.setSetting(s);
        turn(m, 1);
        assert.equal(m.digit, (d + s) % 10);
        assert.equal(m.carryOut, d + s >= 10 ? 1 : 0);
      }
    }
  });
});

describe("DigitSlice operating rules", () => {
  it("refuses to change the setting mid-turn", () => {
    const m = new DigitSlice();
    m.setSetting(3);
    m.setTheta(100);
    assert.equal(m.setSetting(5), false);
    assert.equal(m.setting, 3);
  });

  it("does not reverse through rest within a turn", () => {
    const m = new DigitSlice();
    m.setTheta(50);
    m.setTheta(-30);
    assert.equal(m.theta, 0);
  });

  it("shows the carry phases in order during 9 + 1", () => {
    const m = new DigitSlice();
    m.digit = 9;
    m.setSetting(1);
    /** @type {string[]} */
    const seen = [];
    for (let t = 0; t < 360; t += 0.25) {
      m.setTheta(t);
      if (seen[seen.length - 1] !== m.carryPhase) seen.push(m.carryPhase);
    }
    assert.deepEqual(seen, ["none", "storing", "stored", "executing", "executed"]);
  });

  it("reset returns to the initial state, even mid-turn", () => {
    const m = new DigitSlice();
    m.setSetting(9);
    turn(m, 1);
    m.setSetting(1);
    turn(m, 1); // 9 + 1: digit 0, carry out 1, 2 turns
    m.setTheta(150); // mid-turn
    m.reset();
    assert.deepEqual([m.theta, m.setting, m.digit, m.carryOut, m.turns], [0, 0, 0, 0, 0]);
    assert.equal(m.atRest, true);
    assert.equal(m.setSetting(4), true);
  });

  it("puts step stops only where a motion has just completed", () => {
    const m = new DigitSlice();
    m.digit = 9;
    m.setSetting(1);
    const ev = m.stepStops(1);
    // rib 9 passed, carry passed on (end of the carry window), turn done
    assert.deepEqual(ev, [K.ribWindowStart(8) + K.RIB_PITCH, K.CARRY_WINDOW_START + K.PER_CARRY, 360]);
    assert.ok(!ev.includes(78.75));
  });
});
