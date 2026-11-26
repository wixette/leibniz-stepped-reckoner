import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { unfittedCarrySet } from "../../js/scene/m2Pose.js";
import { Machine } from "../../js/sim/machine.js";
import { registerValue } from "../../js/sim/operations.js";
import { applyAction, fittedCarryPart, matches, presentation } from "../../js/teach/player.js";
/** @import { Lesson } from "../../js/teach/player.js" */

describe("Lesson player", () => {
  it("toStopBack turns back until the pin stops it: red 3 is the hole of black 6", () => {
    const m = new Machine();
    applyAction(m, { reset: { result: 100, input: 7 } });
    applyAction(m, { pin: 6 });
    assert.equal(applyAction(m, { toStopBack: true }), true);
    assert.equal(registerValue(m), 100 - 3 * 7);
    assert.equal(m.canStart(-1), false);
  });

  it("toStopBack without a pin refuses", () => {
    const m = new Machine();
    assert.equal(applyAction(m, { toStopBack: true }), false);
  });

  it("divideDigit subtracts until overdrawn and adds back once", () => {
    const m = new Machine();
    applyAction(m, { reset: { result: 45, input: 7 } });
    assert.equal(applyAction(m, { divideDigit: true }), true);
    assert.equal(registerValue(m), 45 - 6 * 7);
  });

  it("divideDigit with the pin at black 0 stops after 9: nothing to add back", () => {
    const m = new Machine();
    applyAction(m, { reset: { result: 66, input: 7 } });
    applyAction(m, { pin: 0 });
    assert.equal(applyAction(m, { divideDigit: true }), true);
    assert.equal(registerValue(m), 66 - 9 * 7);
    assert.equal(m.ringTurns, -9);
  });

  it("divideDigit with the pin counting a smaller digit adds back as without it", () => {
    const m = new Machine();
    applyAction(m, { reset: { result: 30, input: 7 } });
    applyAction(m, { pin: 0 });
    assert.equal(applyAction(m, { divideDigit: true }), true);
    assert.equal(registerValue(m), 2);
    assert.equal(m.ringTurns, -4);
  });

  it("reset defaults to the ripple carry", () => {
    const m = new Machine();
    m.setMode("simultaneous");
    applyAction(m, { reset: {} });
    assert.equal(m.mode, "ripple");
    applyAction(m, { reset: { mode: "simultaneous" } });
    assert.equal(m.mode, "simultaneous");
  });

  it("the original's carry parts are shown as the ripple set's when it is fitted", () => {
    assert.equal(fittedCarryPart("pm.zweihorn.3", "ripple"), "pm.zweihorn_r.3");
    assert.equal(fittedCarryPart("pm.zweihorn.*", "ripple"), "pm.zweihorn_r.*");
    assert.equal(fittedCarryPart("pi.five_horn_s.*", "ripple"), "pi.five_horn_sr.*");
    assert.equal(fittedCarryPart("pi.five_horn_p.*", "ripple"), "pi.five_horn_p.*");
    assert.equal(fittedCarryPart("pm.zweihorn.3", "simultaneous"), "pm.zweihorn.3");
    assert.equal(fittedCarryPart("pi.five_horn_s.*", "simultaneous"), "pi.five_horn_s.*");
  });

  it("presentation carries the view over, and maps carry parts by mode", () => {
    /** @type {Lesson} */
    const lesson = {
      id: "t",
      title: "t",
      summary: "t",
      finalCheck: () => true,
      steps: [
        { text: "a", view: "carry" },
        { text: "b", highlight: ["pm.zweihorn.*"], context: ["pi.five_horn_s.2"], callouts: [{ node: "pm.zweihorn.1", text: "c" }] },
        { text: "c", view: "apart" },
      ],
    };
    const r = presentation(lesson, 1);
    assert.equal(r.view, "carry");
    assert.equal(r.casing, false);
    assert.equal(r.cutaway, true);
    assert.equal(r.fade, true);
    assert.deepEqual(r.highlight, ["pm.zweihorn_r.*"]);
    assert.deepEqual(r.context, ["pi.five_horn_sr.2"]);
    assert.equal(r.callouts[0].node, "pm.zweihorn_r.1");
    const s = presentation(lesson, 1, "simultaneous");
    assert.deepEqual(s.highlight, ["pm.zweihorn.*"]);
    assert.equal(s.callouts[0].node, "pm.zweihorn.1");
    const a = presentation(lesson, 2);
    assert.equal(a.explode, 1);
    assert.equal(a.casing, true);
    assert.equal(a.fade, false);
    assert.equal(presentation(lesson, 0).highlight.length, 0);
  });

  it("matches takes whole names and prefix.* groups", () => {
    assert.equal(matches("pm.drum.*", "pm.drum.3"), true);
    assert.equal(matches("pm.drum.*", "pm.drums"), false);
    assert.equal(matches("pm.drum.3", "pm.drum.3"), true);
    assert.equal(matches("pm.drum.3", "pm.drum.30"), false);
  });

  it("the carry set not fitted is the other mode's", () => {
    const m = new Machine();
    m.setMode("ripple");
    const r = unfittedCarrySet(m);
    assert.equal(r.length, m.registerDigits + m.carriageDigits);
    assert.ok(r.includes("pm.zweihorn.0") && r.includes("pi.five_horn_s.15"));
    assert.ok(!r.some((n) => n.includes("_r.") || n.includes("_sr.")));
    m.setMode("simultaneous");
    const s = unfittedCarrySet(m);
    assert.ok(s.includes("pm.zweihorn_r.7") && s.includes("pi.five_horn_sr.0"));
    assert.ok(!s.includes("pm.zweihorn.0"));
  });
});
