import { describe, expect, it } from "vitest";
import { DigitSlice } from "./digitSlice";
import * as K from "./kinematics";

function turn(m: DigitSlice, dir: 1 | -1, steps = 720) {
  for (let i = 1; i <= steps; i++) {
    if (m.setTheta((dir * 360 * i) / steps)) return;
  }
}

describe("DigitSlice arithmetic", () => {
  it("adds the setting once per forward turn", () => {
    const m = new DigitSlice();
    m.setSetting(4);
    turn(m, 1);
    expect(m.digit).toBe(4);
    turn(m, 1);
    expect(m.digit).toBe(8);
    expect(m.carryOut).toBe(0);
    expect(m.turns).toBe(2);
  });

  it("9 + 1 = 0 with a carry out", () => {
    const m = new DigitSlice();
    m.setSetting(9);
    turn(m, 1);
    m.setSetting(1);
    turn(m, 1);
    expect(m.digit).toBe(0);
    expect(m.carryOut).toBe(1);
  });

  it("0 - 1 = 9 with a borrow", () => {
    const m = new DigitSlice();
    m.setSetting(1);
    turn(m, -1);
    expect(m.digit).toBe(9);
    expect(m.carryOut).toBe(-1);
    expect(m.turns).toBe(-1);
  });

  it("matches (d + s) mod 10 and the carry for every digit and setting", () => {
    for (let d = 0; d <= 9; d++) {
      for (let s = 0; s <= 9; s++) {
        const m = new DigitSlice();
        m.digit = d;
        m.setSetting(s);
        turn(m, 1);
        expect(m.digit).toBe((d + s) % 10);
        expect(m.carryOut).toBe(d + s >= 10 ? 1 : 0);
      }
    }
  });
});

describe("DigitSlice operating rules", () => {
  it("refuses to change the setting mid-turn", () => {
    const m = new DigitSlice();
    m.setSetting(3);
    m.setTheta(100);
    expect(m.setSetting(5)).toBe(false);
    expect(m.setting).toBe(3);
  });

  it("does not reverse through rest within a turn", () => {
    const m = new DigitSlice();
    m.setTheta(50);
    m.setTheta(-30);
    expect(m.theta).toBe(0);
  });

  it("shows the carry phases in order during 9 + 1", () => {
    const m = new DigitSlice();
    m.digit = 9;
    m.setSetting(1);
    const seen: string[] = [];
    for (let t = 0; t < 360; t += 0.25) {
      m.setTheta(t);
      if (seen[seen.length - 1] !== m.carryPhase) seen.push(m.carryPhase);
    }
    expect(seen).toEqual(["none", "storing", "stored", "executing", "executed"]);
  });

  it("reset returns to the initial state, even mid-turn", () => {
    const m = new DigitSlice();
    m.setSetting(9);
    turn(m, 1);
    m.setSetting(1);
    turn(m, 1); // 9 + 1: digit 0, carry out 1, 2 turns
    m.setTheta(150); // mid-turn
    m.reset();
    expect([m.theta, m.setting, m.digit, m.carryOut, m.turns]).toEqual([0, 0, 0, 0, 0]);
    expect(m.atRest).toBe(true);
    expect(m.setSetting(4)).toBe(true);
  });

  it("puts step stops only where a motion has just completed", () => {
    const m = new DigitSlice();
    m.digit = 9;
    m.setSetting(1);
    const ev = m.stepStops(1);
    // rib 9 passed, carry passed on (end of the carry window), turn done
    expect(ev).toEqual([K.ribWindowStart(8) + K.RIB_PITCH, K.CARRY_WINDOW_START + K.PER_CARRY, 360]);
    expect(ev).not.toContain(78.75);
  });
});
