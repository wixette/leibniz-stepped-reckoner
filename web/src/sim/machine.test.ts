import { describe, expect, it } from "vitest";
import { Machine } from "./machine";
import { divide, multiply, registerValue } from "./operations";

describe("Machine (16-digit register, 8-digit carriage)", () => {
  it("1709 × 365 = 623785 with the Magna Rota pin stopping the crank", () => {
    const m = new Machine();
    m.setNumber(1709);
    m.setOffset(0);
    m.setPin(5);
    expect(m.runToStop()).toBe(5);
    expect(m.blocked).toBe(true);
    expect(m.turn(1)).toBe(false); // the pin is against the stop
    expect(m.turn(-1)).toBe(false); // and the finger only lets the pinned ring turn forward
    expect(m.shownNumber()).toBe(8545);
    m.setOffset(1);
    m.setPin(6);
    m.runToStop();
    expect(m.shownNumber()).toBe(111085);
    m.setOffset(2);
    m.setPin(3);
    m.runToStop();
    expect(m.shownNumber()).toBe(623785);
    expect(m.pending.every((p) => p === 0)).toBe(true);
  });

  it("623785 ÷ 1709 = 365 remainder 0 by subtracting and shifting", () => {
    const m = new Machine();
    m.setResult(623785);
    expect(divide(m, 1709)).toEqual([3, 6, 5]);
    expect(registerValue(m)).toBe(0);
    expect(m.pending.every((p) => p === 0)).toBe(true);
  });

  it("random multiplications and divisions match integer arithmetic", () => {
    let seed = 11;
    const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), Math.floor((seed / 2 ** 31) * n));
    for (let k = 0; k < 25; k++) {
      const a = 1 + rnd(99999);
      const b = 1 + rnd(999);
      const m = new Machine();
      m.setNumber(a);
      multiply(m, b);
      expect(registerValue(m)).toBe(a * b);
      const q = divide(m, a);
      expect(Number(q.join(""))).toBe(b);
      expect(registerValue(m)).toBe(0);
    }
  });

  it("a carry above the carriage stays stored until the carriage is shifted over it", () => {
    const m = new Machine();
    m.setResult(999_999_999);
    m.setNumber(1);
    m.turn(1);
    expect(m.shownNumber()).toBe(0); // the nine 9s turned to 0 ...
    expect(m.pending[8]).toBe(1); // ... and digit 8's carry waits: no lever above carriage digit 7
    expect(registerValue(m)).toBe(1_000_000_000);
    m.setOffset(1);
    m.setNumber(0);
    m.turn(1); // the shifted carriage's top lever executes it early in the turn
    expect(m.shownNumber()).toBe(1_000_000_000);
    expect(m.pending.every((p) => p === 0)).toBe(true);
  });

  it("refuses a turn that would store a second carry above the carriage; shifting first keeps the count exact", () => {
    const m = new Machine();
    m.setNumber(9_999_999);
    for (let n = 1; n <= 200; n++) expect(m.turn(1)).toBe(true);
    expect(m.pending[8]).toBe(1); // stored at the 101st addition, still waiting
    expect(registerValue(m)).toBe(200 * 9_999_999);
    // The 201st addition would wrap digit 8 again while its first carry waits.
    expect(m.startBlock(1)).toEqual({ storeFull: 8 });
    expect(m.turn(1)).toBe(false);
    expect(m.theta).toBe(0);
    expect(registerValue(m)).toBe(200 * 9_999_999); // nothing lost, nothing moved
    // What the operator does: shift over digit 8, one idle turn, shift back, carry on.
    m.setNumber(0);
    m.setOffset(1);
    expect(m.turn(1)).toBe(true);
    expect(m.pending.every((p) => p === 0)).toBe(true);
    m.setOffset(0);
    m.setNumber(9_999_999);
    expect(m.turn(1)).toBe(true);
    expect(registerValue(m)).toBe(201 * 9_999_999);
  });

  it("allows a turn that cancels a waiting carry with a borrow (the store goes back to rest)", () => {
    const m = new Machine();
    m.setResult(999_999_999);
    m.setNumber(1);
    m.turn(1);
    expect(m.pending[8]).toBe(1);
    expect(m.startBlock(-1)).toBeNull();
    expect(m.turn(-1)).toBe(true); // digit 8 borrows 0 -> 9: the store returns from 18 to 0
    expect(m.pending.every((p) => p === 0)).toBe(true);
    expect(registerValue(m)).toBe(999_999_999);
  });

  it("names the reason a turn cannot start", () => {
    const m = new Machine();
    m.setPin(2);
    expect(m.startBlock(-1)).toBe("pin");
    m.runToStop();
    expect(m.startBlock(1)).toBe("pin");
    m.setPin(null);
    m.setCarriagePos(0.5);
    expect(m.startBlock(1)).toBe("shifting");
  });

  it("historical mode defers secondary carries to the next turn", () => {
    const m = new Machine();
    m.setMode("historical");
    m.setResult(9999);
    m.setNumber(1);
    m.turn(1);
    expect(m.shownNumber()).toBe(9900);
    expect(m.pending[1]).toBe(1);
    m.setNumber(0);
    m.turn(1); // the early horn passes finish the chain (units first)
    expect(m.shownNumber()).toBe(10000);
    expect(m.pending.every((p) => p === 0)).toBe(true);
  });

  it("ripple mode finishes an 8-digit carry chain inside one turn", () => {
    const m = new Machine();
    m.setResult(99_999_999);
    m.setNumber(1);
    m.turn(1);
    expect(m.shownNumber()).toBe(100_000_000);
    expect(m.pending.every((p) => p === 0)).toBe(true);
  });

  it("shifts only at rest and within range", () => {
    const m = new Machine();
    m.setTheta(100);
    expect(m.setOffset(1)).toBe(false);
    m.setTheta(0);
    expect(m.setOffset(9)).toBe(false);
    expect(m.setOffset(8)).toBe(true);
    expect(m.machinePose().carriageX).toBe(-8 * 37);
  });
});
