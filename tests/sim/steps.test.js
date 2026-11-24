// Step control contract (docs/conventions.md): every step ends with a visible change.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Machine } from "../../js/sim/machine.js";
import { changed, describeStep, snapshot } from "../../js/sim/narrate.js";

/** A 3-digit machine: every register digit has its own drum and lever. */
const small = () => new Machine(3, 3);

describe("Steps on a 3-digit machine", () => {
  /** @type {[string, "ripple" | "simultaneous", number, number, 1 | -1][]} */
  const cases = [];
  for (const mode of /** @type {const} */ (["ripple", "simultaneous"])) {
    for (const [r, x, dir] of /** @type {const} */ ([[999, 1, 1], [0, 1, -1], [456, 278, 1], [909, 91, 1], [990, 10, 1], [100, 1, -1], [0, 999, -1], [999, 999, 1], [123, 0, 1]])) {
      cases.push([`${mode} ${r}${dir > 0 ? "+" : "-"}${x}`, mode, r, x, dir]);
    }
  }
  it("simultaneous 999 + 1: the idle turn's early pass is described as a carry, not a rib", () => {
    const m = small();
    m.setMode("simultaneous");
    m.setResult(999);
    m.setNumber(1);
    m.turn(1);
    m.setNumber(0);
    const first = m.stepStops(1)[0];
    const a = snapshot(m);
    m.setTheta(first);
    const line = describeStep(a, snapshot(m), 1, { ribs: [78.75, 281.25], completed: false });
    assert.ok(first < 78.75, `${first} < ${78.75}`);
    assert.match(line, /^Hundreds 9 → 0 \(carry received\)/);
  });

  for (const [label, mode, r, x, dir] of cases) it(`${label}: every step changes something visible (including idle turns)`, () => {
    const m = small();
    m.setMode(mode);
    m.setResult(r);
    for (const input of [x, 0, 0]) {
      m.setNumber(input);
      for (const stop of m.stepStops(dir)) {
        const a = snapshot(m);
        m.setTheta(dir * stop);
        assert.equal(changed(a, snapshot(m)), true, `stop ${stop}`);
      }
      assert.equal(m.theta, 0);
    }
  });
});
