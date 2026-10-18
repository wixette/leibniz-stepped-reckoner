// Step control contract (docs/conventions.md): every step ends with a visible change.

import { describe, expect, it } from "vitest";
import { CarrySlice } from "./carrySlice";
import { DigitSlice } from "./digitSlice";
import { changed, describeStep, snapshotM0, snapshotM1 } from "./narrate";

describe("M0 steps", () => {
  it("every step changes something visible, for every digit/setting/direction", () => {
    for (let d = 0; d <= 9; d++) {
      for (let s = 0; s <= 9; s++) {
        for (const dir of [1, -1] as const) {
          const m = new DigitSlice();
          m.digit = d;
          m.setSetting(s);
          for (const stop of m.stepStops(dir)) {
            const a = snapshotM0(m);
            m.setTheta(dir * stop);
            const b = snapshotM0(m);
            expect(changed(a, b), `d=${d} s=${s} dir=${dir} stop=${stop}`).toBe(true);
          }
          expect(m.theta).toBe(0);
        }
      }
    }
  });

  it("describes 9 + 1 step by step", () => {
    const m = new DigitSlice();
    m.digit = 9;
    m.setSetting(1);
    const lines = m.stepStops(1).map((stop) => {
      const a = snapshotM0(m);
      const done = m.setTheta(stop);
      return describeStep(a, snapshotM0(m), 1, { ribs: [78.75, 281.25], completed: done });
    });
    expect(lines).toEqual([
      "A rib turned the result wheel 9 → 0; carry stored (pentagon tilted).",
      "The carry is done (pentagon level); a carry went to the next digit.",
      "Turn complete, the counter moved.",
    ]);
  });
});

describe("M1 steps", () => {
  const cases: [string, "ripple" | "historical", number, number, 1 | -1][] = [];
  for (const mode of ["ripple", "historical"] as const) {
    for (const [r, x, dir] of [[999, 1, 1], [0, 1, -1], [456, 278, 1], [909, 91, 1], [990, 10, 1], [100, 1, -1], [0, 999, -1], [999, 999, 1], [123, 0, 1]] as const) {
      cases.push([`${mode} ${r}${dir > 0 ? "+" : "-"}${x}`, mode, r, x, dir]);
    }
  }
  it("historical 999 + 1: the idle turn's early pass is described as a carry, not a rib", () => {
    const m = new CarrySlice();
    m.setMode("historical");
    m.setResult(999);
    m.setNumber(1);
    m.turn(1);
    m.setNumber(0);
    const first = m.stepStops(1)[0];
    const a = snapshotM1(m);
    m.setTheta(first);
    const line = describeStep(a, snapshotM1(m), 1, { ribs: [78.75, 281.25], completed: false });
    expect(first).toBeLessThan(78.75);
    expect(line).toMatch(/^Hundreds 9 → 0 \(carry received\)/);
  });

  it.each(cases)("%s: every step changes something visible (including idle turns)", (_l, mode, r, x, dir) => {
    const m = new CarrySlice();
    m.setMode(mode);
    m.setResult(r);
    for (const input of [x, 0, 0]) {
      m.setNumber(input);
      for (const stop of m.stepStops(dir)) {
        const a = snapshotM1(m);
        m.setTheta(dir * stop);
        expect(changed(a, snapshotM1(m)), `stop ${stop}`).toBe(true);
      }
      expect(m.theta).toBe(0);
    }
  });
});
