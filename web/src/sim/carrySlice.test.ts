import { describe, expect, it } from "vitest";
import { CarrySlice } from "./carrySlice";

function add(m: CarrySlice, x: number) {
  m.setNumber(x);
  m.turn(1);
}

describe("CarrySlice arithmetic (ripple)", () => {
  it("adds multi-digit numbers with carries", () => {
    const m = new CarrySlice();
    add(m, 456);
    add(m, 278);
    expect(m.shownNumber()).toBe(734);
    expect(m.carryOut).toBe(0);
    expect(m.pending).toEqual([0, 0, 0]);
  });

  it("999 + 1 ripples to 000 with one carry out in one turn", () => {
    const m = new CarrySlice();
    m.setResult(999);
    add(m, 1);
    expect(m.shownNumber()).toBe(0);
    expect(m.carryOut).toBe(1);
    expect(m.pending).toEqual([0, 0, 0]);
    expect(m.turns).toBe(1);
  });

  it("000 - 1 ripples to 999 with one borrow out", () => {
    const m = new CarrySlice();
    m.setNumber(1);
    m.turn(-1);
    expect(m.shownNumber()).toBe(999);
    expect(m.carryOut).toBe(-1);
    expect(m.pending).toEqual([0, 0, 0]);
  });

  it("matches integer arithmetic for many random additions and subtractions", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed / 2 ** 31);
    for (let k = 0; k < 300; k++) {
      const m = new CarrySlice();
      const a = Math.floor(rnd() * 1000);
      const b = Math.floor(rnd() * 1000);
      m.setResult(a);
      const dir = rnd() < 0.5 ? 1 : -1;
      m.setNumber(b);
      m.turn(dir);
      const exact = a + dir * b;
      expect(m.shownNumber() + 1000 * m.carryOut).toBe(exact);
      expect(m.pending).toEqual([0, 0, 0]);
    }
  });
});

describe("CarrySlice historical mode (decision 0001)", () => {
  it("999 + 1: 900 after the first turn (tens carry waits), 000 + carry after an idle turn", () => {
    const m = new CarrySlice();
    m.setMode("historical");
    m.setResult(999);
    add(m, 1);
    expect(m.shownNumber()).toBe(900);
    expect(m.pending).toEqual([0, 1, 0]);
    expect(m.carryOut).toBe(0);
    add(m, 0); // idle turn with the input set to 0
    expect(m.shownNumber()).toBe(0);
    expect(m.carryOut).toBe(1);
    expect(m.pending).toEqual([0, 0, 0]);
  });

  it("executes a pending carry at the start of a turn and a new carry of the same digit later", () => {
    const m = new CarrySlice();
    m.setMode("historical");
    m.setResult(999);
    add(m, 1); // 900, tens carry pending
    add(m, 10); // tens: pending carry executed early, then 0 + 1 = 1 by the ribs
    expect(m.shownNumber() + 1000 * m.carryOut).toBe(999 + 1 + 10);
    for (let k = 0; k < 3 && m.pending.some((p) => p !== 0); k++) add(m, 0);
    expect(m.shownNumber() + 1000 * m.carryOut).toBe(1010);
  });

  it("ends with the same number as ripple mode once idle turns finish the carries", () => {
    for (const [a, b] of [[999, 1], [909, 91], [990, 10], [555, 445]]) {
      const m = new CarrySlice();
      m.setMode("historical");
      m.setResult(a);
      add(m, b);
      for (let k = 0; k < 4 && m.pending.some((p) => p !== 0); k++) add(m, 0);
      expect(m.shownNumber() + 1000 * m.carryOut).toBe(a + b);
    }
  });
});

describe("CarrySlice operating rules", () => {
  it("refuses settings and mode changes mid-turn and resets fully", () => {
    const m = new CarrySlice();
    m.setNumber(123);
    m.setTheta(100);
    expect(m.setSetting(0, 5)).toBe(false);
    expect(m.setMode("historical")).toBe(false);
    m.reset();
    expect([m.theta, m.carryOut, m.turns, ...m.settings, ...m.digits, ...m.pending]).toEqual(Array(12).fill(0));
  });

  it("shows a tilted store while a carry is stored and level again after execution", () => {
    const m = new CarrySlice();
    m.setResult(9);
    m.setNumber(1);
    m.setTheta(281); // ribs done, units carry stored, lever not yet arrived
    expect(m.storesTilted()[0]).toBe(true);
    m.setTheta(359);
    expect(m.storesTilted()).toEqual([false, false, false]);
  });
});
