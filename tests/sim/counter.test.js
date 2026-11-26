import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Machine } from "../../js/sim/machine.js";
import { registerValue } from "../../js/sim/operations.js";

describe("Revolution counter and the machine's state", () => {
  it("reset clears the pin, the ring and the carriage, and keeps the carry mode", () => {
    const m = new Machine();
    m.setMode("simultaneous");
    m.setNumber(12);
    m.setOffset(3);
    m.setPin(4);
    m.turn(1);
    m.reset();
    assert.equal(m.pin, null);
    assert.equal(m.ringTurns, 0);
    assert.equal(m.offset, 0);
    assert.equal(m.carriagePos, 0);
    assert.equal(registerValue(m), 0);
    assert.deepEqual(m.settings, Array(8).fill(0));
    assert.equal(m.mode, "simultaneous");
  });

  it("setPin takes holes 0..9 or null, only at rest, and sets the ring back to 0", () => {
    const m = new Machine();
    for (const bad of [-1, 10, 2.5]) assert.equal(m.setPin(bad), false, String(bad));
    assert.equal(m.pin, null);
    assert.equal(m.setPin(0), true);
    assert.equal(m.setPin(9), true);
    m.turn(1);
    assert.equal(m.ringTurns, 1);
    m.setTheta(90);
    assert.equal(m.setPin(3), false, "mid-turn");
    m.setTheta(360);
    assert.equal(m.setPin(3), true);
    assert.equal(m.ringTurns, 0);
    assert.equal(m.setPin(null), true);
    assert.equal(m.pin, null);
  });

  it("pin 5 stops 5 turns forward, or 4 back: 9 between the stop's two faces", () => {
    const m = new Machine();
    m.setPin(5);
    assert.equal(m.runToStop(), 5);
    assert.equal(m.canStart(1), false);
    assert.equal(m.startBlock(1), "pin");
    m.setPin(5);
    assert.equal(m.runBackToStop(), 4);
    assert.equal(m.canStart(-1), false);
    assert.equal(m.blockedBack, true);
    assert.equal(m.canStart(1), true);
  });

  it("the pin at black 0 stops forward at once and allows 9 turns back", () => {
    const m = new Machine();
    m.setPin(0);
    assert.equal(m.turn(1), false);
    assert.equal(m.runBackToStop(), 9);
  });

  it("countedTurns counts a turn once the ring has stepped, part-way through it", () => {
    const m = new Machine();
    m.setTheta(100);
    assert.equal(m.countedTurns(), 0);
    m.setTheta(300);
    assert.equal(m.countedTurns(), 1);
    m.setTheta(360);
    assert.equal(m.countedTurns(), 1);
    assert.equal(m.theta, 0);
    m.setTheta(-100);
    assert.equal(m.countedTurns(), 1);
    m.setTheta(0);
    m.setTheta(-300);
    assert.equal(m.countedTurns(), 0);
    m.setTheta(-360);
    assert.equal(m.countedTurns(), 0);
    m.turn(-1);
    assert.equal(m.countedTurns(), -1);
  });

  it("the carry mode changes only at rest", () => {
    const m = new Machine();
    m.setTheta(120);
    assert.equal(m.setMode("simultaneous"), false);
    m.setTheta(360);
    assert.equal(m.setMode("simultaneous"), true);
    assert.equal(m.mode, "simultaneous");
  });

  it("a carry waiting in a store survives a mode change and is executed in the new mode", () => {
    for (const [from, to] of [["ripple", "simultaneous"], ["simultaneous", "ripple"]]) {
      const m = new Machine();
      m.setMode(/** @type {"ripple" | "simultaneous"} */ (from));
      m.setResult(9999);
      m.setNumber(1);
      m.turn(1);
      assert.equal(registerValue(m), 10000, `${from}: value counts the waiting carries`);
      m.setMode(/** @type {"ripple" | "simultaneous"} */ (to));
      m.setNumber(0);
      m.turn(1);
      assert.equal(m.shownNumber(), 10000, `${from} → ${to}`);
      assert.equal(m.pending.every((p) => p === 0), true);
    }
  });
});
