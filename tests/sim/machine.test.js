import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DIGIT_PITCH, Machine } from "../../js/sim/machine.js";
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

  it("full-size 8 × 8-digit products are exact, and divide back, in both modes", () => {
    // Exact in BigInt: up to 16 digits, beyond what a Number holds exactly. The register's
    // value counts the carries still waiting in its stores.
    /** @param {Machine} m */
    const exact = (m) => {
      let x = BigInt(m.shownText());
      m.pending.forEach((p, k) => (x += BigInt(p) * 10n ** BigInt(k + 1)));
      return x + BigInt(m.carryOut) * 10n ** BigInt(m.registerDigits);
    };
    let seed = 3;
    /** @param {number} n */
    const rnd = (n) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), Math.floor((seed / 2 ** 31) * n));
    for (const mode of /** @type {const} */ (["ripple", "historical"])) {
      const pairs = [[99_999_999, 99_999_999], ...Array.from({ length: 10 }, () => [10_000_000 + rnd(90_000_000), 10_000_000 + rnd(90_000_000)])];
      for (const [a, b] of pairs) {
        const m = new Machine();
        m.setMode(mode);
        m.setNumber(a);
        multiply(m, b);
        assert.equal(exact(m), BigInt(a) * BigInt(b), `${mode}: ${a} × ${b}`);
        assert.equal(Number(divide(m, a).join("")), b, `${mode}: ${a} × ${b} ÷ ${a}`);
        assert.equal(exact(m), 0n, `${mode}: ${a} × ${b} ÷ ${a} leaves no remainder`);
      }
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

  it("refuses a turn in which a wheel would pass 9 twice while its first carry still waits", () => {
    // Digit 9 receives store 8's waiting carry early in the turn (9 -> 0, store 9 stored), then
    // the ribs and store 8's new carry take it past 9 again before lever 7 passes store 9.
    const m = new Machine();
    m.setResult(9_909_999_999);
    m.setNumber(99_999_999);
    m.turn(1);
    assert.equal(m.pending[8], 1);
    m.setOffset(2);
    assert.deepEqual(m.startBlock(1), { storeFull: 9 });
    assert.equal(m.turn(1), false);
    assert.equal(registerValue(m), 10_009_999_998); // nothing moved, nothing lost
    // what the page advises (status.blockedStoreLate): an idle turn the same way first
    m.setNumber(0);
    assert.equal(m.turn(1), true);
    m.setNumber(99_999_999);
    assert.equal(m.turn(1), true);
    assert.equal(registerValue(m), 10_009_999_998 + 9_999_999_900);
  });

  it("random additions and subtractions at any carriage place stay exact, in both modes", () => {
    // The register's exact value: its digits, the carries waiting in the stores and what left the top.
    /** @param {Machine} m */
    const exact = (m) => {
      let x = BigInt(m.carryOut);
      for (let k = m.registerDigits - 1; k >= 0; k--) x = x * 10n + BigInt(m.digits[k]);
      m.pending.forEach((p, k) => (x += BigInt(p) * 10n ** BigInt(k + 1)));
      return x;
    };
    let seed = 7;
    /** @param {number} n */
    const rnd = (n) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), Math.floor((seed / 2 ** 31) * n));
    for (const mode of /** @type {const} */ (["ripple", "historical"])) {
      for (let trial = 0; trial < 20; trial++) {
        const m = new Machine();
        m.setMode(mode);
        let want = 0n;
        for (let step = 0; step < 20; step++) {
          const o = rnd(9);
          const x = rnd(3) === 0 ? 99_999_999 : rnd(10 ** (1 + rnd(8)));
          /** @type {1 | -1} */
          const dir = rnd(2) ? 1 : -1;
          m.setOffset(o);
          m.setNumber(x);
          if (!m.canStart(dir)) continue; // a store would have to hold two carries: refused
          assert.equal(m.turn(dir), true);
          want += BigInt(dir * x) * 10n ** BigInt(o);
          assert.equal(exact(m), want, `${mode}, trial ${trial}, step ${step}`);
        }
      }
    }
  });

  it("reads all 16 digits exactly, and knows when the register is below zero", () => {
    const m = new Machine();
    assert.equal(m.shownText(), "0");
    m.setNumber(99_999_999);
    multiply(m, 99_999_999); // the largest product, beyond 2^53
    assert.equal(m.shownText(), (99_999_999n * 99_999_999n).toString());
    m.reset();
    m.setOffset(8);
    m.setNumber(1);
    m.turn(-1); // 0 - 10^8: the borrow leaves the top digit
    assert.equal(m.shownText(), "9999999900000000");
    assert.equal(registerValue(m), -100_000_000);
  });

  it("shifts only at rest and within range", () => {
    const m = new Machine();
    m.setTheta(100);
    assert.equal(m.setOffset(1), false);
    m.setTheta(0);
    assert.equal(m.setOffset(9), false);
    assert.equal(m.setOffset(8), true);
    assert.equal(m.machinePose().carriageX, -8 * DIGIT_PITCH);
  });
});
