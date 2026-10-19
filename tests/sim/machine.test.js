import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Machine } from "../../js/sim/machine.js";
import { divide, multiply, registerValue } from "../../js/sim/operations.js";

describe("Machine (16-digit register, 8-digit carriage)", () => {
  it("1709 × 365 = 623785 with the Magna Rota pin stopping the crank", () => {
    const m = new Machine();
    m.setNumber(1709);
    m.setOffset(0);
    m.setPin(5);
    assert.equal(m.runToStop(), 5);
    assert.equal(m.blocked, true);
    assert.equal(m.turn(1), false); // the pin is against the stop
    assert.equal(m.shownNumber(), 8545);
    m.setOffset(1);
    m.setPin(6);
    m.runToStop();
    assert.equal(m.shownNumber(), 111085);
    m.setOffset(2);
    m.setPin(3);
    m.runToStop();
    assert.equal(m.shownNumber(), 623785);
    assert.equal(m.pending.every((p) => p === 0), true);
  });

  it("623785 ÷ 1709 = 365 remainder 0 by subtracting and shifting", () => {
    const m = new Machine();
    m.setResult(623785);
    assert.deepEqual(divide(m, 1709), [3, 6, 5]);
    assert.equal(registerValue(m), 0);
    assert.equal(m.pending.every((p) => p === 0), true);
  });

  it("random multiplications and divisions match integer arithmetic", () => {
    let seed = 11;
    /** @param {number} n */
    const rnd = (n) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), Math.floor((seed / 2 ** 31) * n));
    for (let k = 0; k < 25; k++) {
      const a = 1 + rnd(99999);
      const b = 1 + rnd(999);
      const m = new Machine();
      m.setNumber(a);
      multiply(m, b);
      assert.equal(registerValue(m), a * b);
      const q = divide(m, a);
      assert.equal(Number(q.join("")), b);
      assert.equal(registerValue(m), 0);
    }
  });

  it("a carry above the carriage stays stored until the carriage is shifted over it", () => {
    const m = new Machine();
    m.setResult(999_999_999);
    m.setNumber(1);
    m.turn(1);
    assert.equal(m.shownNumber(), 0); // the nine 9s turned to 0 ...
    assert.equal(m.pending[8], 1); // ... and digit 8's carry waits: no lever above carriage digit 7
    assert.equal(registerValue(m), 1_000_000_000);
    m.setOffset(1);
    m.setNumber(0);
    m.turn(1); // the shifted carriage's top lever executes it early in the turn
    assert.equal(m.shownNumber(), 1_000_000_000);
    assert.equal(m.pending.every((p) => p === 0), true);
  });

  it("refuses a turn that would store a second carry above the carriage; shifting first keeps the count exact", () => {
    const m = new Machine();
    m.setNumber(9_999_999);
    for (let n = 1; n <= 200; n++) assert.equal(m.turn(1), true);
    assert.equal(m.pending[8], 1); // stored at the 101st addition, still waiting
    assert.equal(registerValue(m), 200 * 9_999_999);
    // The 201st addition would wrap digit 8 again while its first carry waits.
    assert.deepEqual(m.startBlock(1), { storeFull: 8 });
    assert.equal(m.turn(1), false);
    assert.equal(m.theta, 0);
    assert.equal(registerValue(m), 200 * 9_999_999); // nothing lost, nothing moved
    // What the operator does: shift over digit 8, one idle turn, shift back, carry on.
    m.setNumber(0);
    m.setOffset(1);
    assert.equal(m.turn(1), true);
    assert.equal(m.pending.every((p) => p === 0), true);
    m.setOffset(0);
    m.setNumber(9_999_999);
    assert.equal(m.turn(1), true);
    assert.equal(registerValue(m), 201 * 9_999_999);
  });

  it("allows a turn that cancels a waiting carry with a borrow (the store goes back to rest)", () => {
    const m = new Machine();
    m.setResult(999_999_999);
    m.setNumber(1);
    m.turn(1);
    assert.equal(m.pending[8], 1);
    assert.equal(m.startBlock(-1), null);
    assert.equal(m.turn(-1), true); // digit 8 borrows 0 -> 9: the store returns from 18 to 0
    assert.equal(m.pending.every((p) => p === 0), true);
    assert.equal(registerValue(m), 999_999_999);
  });

  it("the pin lets the crank turn back 9 - m whole turns, then refuses", () => {
    for (const hole of [0, 3, 8, 9]) {
      const m = new Machine();
      m.setPin(hole);
      let back = 0;
      while (m.turn(-1)) back++;
      assert.equal(back, 9 - hole, `hole ${hole}`);
      assert.equal(m.startBlock(-1), "pin", `hole ${hole}: the next turn back would jam on the finger`);
      assert.equal(m.startBlock(1), null, `hole ${hole}: forward is free again`);
    }
    // forward still stops at the stop after m turns, and from there it may turn back
    const m = new Machine();
    m.setPin(3);
    assert.equal(m.runToStop(), 3);
    assert.equal(m.startBlock(-1), null);
  });

  it("names the reason a turn cannot start", () => {
    const m = new Machine();
    m.setPin(2);
    m.runToStop();
    assert.equal(m.startBlock(1), "pin");
    m.setPin(null);
    m.setCarriagePos(0.5);
    assert.equal(m.startBlock(1), "shifting");
  });

  it("historical mode defers secondary carries to the next turn", () => {
    const m = new Machine();
    m.setMode("historical");
    m.setResult(9999);
    m.setNumber(1);
    m.turn(1);
    assert.equal(m.shownNumber(), 9900);
    assert.equal(m.pending[1], 1);
    m.setNumber(0);
    m.turn(1); // the early horn passes finish the chain (units first)
    assert.equal(m.shownNumber(), 10000);
    assert.equal(m.pending.every((p) => p === 0), true);
  });

  it("ripple mode finishes an 8-digit carry chain inside one turn", () => {
    const m = new Machine();
    m.setResult(99_999_999);
    m.setNumber(1);
    m.turn(1);
    assert.equal(m.shownNumber(), 100_000_000);
    assert.equal(m.pending.every((p) => p === 0), true);
  });

  it("shifts only at rest and within range", () => {
    const m = new Machine();
    m.setTheta(100);
    assert.equal(m.setOffset(1), false);
    m.setTheta(0);
    assert.equal(m.setOffset(9), false);
    assert.equal(m.setOffset(8), true);
    assert.equal(m.machinePose().carriageX, -8 * 37);
  });
});
