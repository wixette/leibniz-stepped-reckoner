import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";
import "../../js/l10n/all.js";
import { gltfName } from "../../js/scene/rig.js";
import { Machine } from "../../js/sim/machine.js";
import { applyIntentNow, controlOf, CrankDrag, crankAt, intentAt, intentHint, possible, shiftDir } from "../../js/teach/partActions.js";
/** @import { Intent } from "../../js/teach/partActions.js" */

/** @param {string} name */
const node = (name) => {
  const n = new THREE.Group();
  n.name = gltfName(name);
  return n;
};

/**
 * A carriage with the counter (centre at x = 1, flat in the xz plane, black digit i at 36i°),
 * the pin's parking hole on the cover at (0, 0, 0.1), and the two cranks.
 */
const scene = () => {
  const root = new THREE.Group();
  const carriage = node("pm.carriage");
  root.add(carriage);
  const plate = node("pm.counter_plate");
  plate.position.set(1, 0, 0);
  const glyphs = [];
  for (let i = 0; i < 10; i++) {
    const a = THREE.MathUtils.degToRad(36 * i);
    glyphs.push(0.05 * Math.cos(a), 0, 0.05 * Math.sin(a));
  }
  plate.userData.black_glyphs = glyphs;
  const ring = node("pm.counter_ring");
  const cover = node("pm.carriage_cover");
  const park = node("pm.counter_pin_park");
  park.userData.hole = [0, 0, 0.1];
  const crank = node("pm.main_crank");
  const knob = node("pm.main_crank_knob");
  crank.add(knob);
  const screw = node("frame.lead_screw");
  carriage.add(plate, ring, cover, park, crank);
  root.add(screw);
  root.updateMatrixWorld(true);
  return { root, plate, ring, cover, park, crank, knob, screw };
};

/** The point on the counter at angle deg (round its centre). */
const onCounter = (/** @type {number} */ deg) => {
  const a = THREE.MathUtils.degToRad(deg);
  return new THREE.Vector3(1 + 0.04 * Math.cos(a), 0, 0.04 * Math.sin(a));
};

describe("Operating the machine by its parts", () => {
  it("each intent stands for its panel control", () => {
    /** @type {[Intent, string][]} */
    const cases = [
      [{ kind: "setDigit", knob: 0, digit: 3 }, "input"],
      [{ kind: "nextDigit", knob: 2 }, "input"],
      [{ kind: "turn", dir: 1 }, "add"],
      [{ kind: "turn", dir: -1 }, "sub"],
      [{ kind: "pin", hole: 4 }, "pin"],
      [{ kind: "shiftTo", offset: 2 }, "shift"],
      [{ kind: "shiftStep", dir: -1 }, "shift"],
    ];
    for (const [i, c] of cases) assert.equal(controlOf(i), c, JSON.stringify(i));
    assert.equal(shiftDir({ kind: "shiftStep", dir: -1 }), -1);
    assert.equal(shiftDir({ kind: "turn", dir: 1 }), undefined);
  });

  it("a click on the counter picks the hole by the nearest black digit; on the pin, takes it out", () => {
    const s = scene();
    const m = new Machine();
    assert.deepEqual(intentAt(s.ring, onCounter(0), m), { kind: "pin", hole: 0 });
    assert.deepEqual(intentAt(s.ring, onCounter(36 * 7 + 10), m), { kind: "pin", hole: 7 });
    assert.deepEqual(intentAt(s.plate, onCounter(350), m), { kind: "pin", hole: 0 });
    assert.deepEqual(intentAt(s.park, new THREE.Vector3(), m), { kind: "pin", hole: null });
  });

  it("a click on the cover by the parking hole puts the pin away, only when it is in", () => {
    const s = scene();
    const m = new Machine();
    const near = new THREE.Vector3(0.003, 0, 0.1);
    const far = new THREE.Vector3(0.006, 0, 0.1);
    assert.equal(intentAt(s.cover, near, m), null, "the pin is out already");
    m.setPin(3);
    assert.deepEqual(intentAt(s.cover, near, m), { kind: "pin", hole: null });
    assert.equal(intentAt(s.cover, far, m), null);
  });

  it("the cranks (and their parts) turn forward on a click and back on a Shift-click", () => {
    const s = scene();
    const m = new Machine();
    const p = new THREE.Vector3();
    assert.deepEqual(intentAt(s.knob, p, m), { kind: "turn", dir: 1 });
    assert.deepEqual(intentAt(s.knob, p, m, -1), { kind: "turn", dir: -1 });
    assert.deepEqual(intentAt(s.screw, p, m, -1), { kind: "shiftStep", dir: -1 });
    assert.equal(crankAt(s.knob)?.node, s.crank);
    assert.equal(crankAt(s.screw)?.kind, "shiftStep");
    assert.equal(crankAt(s.plate), null);
    assert.equal(intentAt(s.root, p, m), null);
  });

  it("possible: turns unless the crank is stopped, the rest only at rest and in range", () => {
    const m = new Machine();
    assert.equal(possible({ kind: "turn", dir: 1 }, m), true);
    m.setPin(0);
    assert.equal(possible({ kind: "turn", dir: 1 }, m), false);
    assert.equal(possible({ kind: "turn", dir: -1 }, m), true);
    assert.equal(possible({ kind: "shiftStep", dir: -1 }, m), false);
    assert.equal(possible({ kind: "shiftStep", dir: 1 }, m), true);
    assert.equal(possible({ kind: "shiftTo", offset: 0 }, m), false);
    assert.equal(possible({ kind: "shiftTo", offset: 3 }, m), true);
    m.setTheta(-90);
    assert.equal(possible({ kind: "turn", dir: 1 }, m), true, "mid-turn: the crank goes on");
    assert.equal(possible({ kind: "pin", hole: 2 }, m), false);
    assert.equal(possible({ kind: "setDigit", knob: 0, digit: 1 }, m), false);
  });

  it("each intent has a hint, and applies at once", () => {
    assert.equal(intentHint({ kind: "pin", hole: 4 }), "Click: pin at black 4");
    assert.equal(intentHint({ kind: "pin", hole: null }), "Click: take the pin out");
    for (const i of /** @type {Intent[]} */ ([
      { kind: "setDigit", knob: 0, digit: 5 },
      { kind: "nextDigit", knob: 0 },
      { kind: "turn", dir: 1 },
      { kind: "turn", dir: -1 },
      { kind: "shiftTo", offset: 1 },
      { kind: "shiftStep", dir: 1 },
      { kind: "shiftStep", dir: -1 },
    ]))
      assert.ok(!intentHint(i).startsWith("hint."), JSON.stringify(i));
    const m = new Machine();
    assert.equal(applyIntentNow({ kind: "setDigit", knob: 0, digit: 5 }, m), true);
    assert.equal(applyIntentNow({ kind: "nextDigit", knob: 0 }, m), true);
    assert.equal(m.settings[0], 6);
    assert.equal(applyIntentNow({ kind: "turn", dir: 1 }, m), true);
    assert.equal(applyIntentNow({ kind: "shiftStep", dir: 1 }, m), true);
    assert.equal(applyIntentNow({ kind: "shiftTo", offset: 0 }, m), true);
    assert.equal(applyIntentNow({ kind: "pin", hole: 2 }, m), true);
    assert.equal(m.shownNumber(), 6);
    assert.equal(m.pin, 2);
  });

  it("dragging a crank: the angle swept round its axle, signed by the crank's forward way", () => {
    const s = scene();
    s.crank.userData.axis = [0, 0, 1];
    s.screw.userData.axis = [0, 0, 1];
    const down = (/** @type {number} */ x, /** @type {number} */ y) => new THREE.Ray(new THREE.Vector3(x, y, 5), new THREE.Vector3(0, 0, -1));
    const grab = new THREE.Vector3(1, 0, 0);
    const main = new CrankDrag(s.crank, grab, down(1, 0));
    assert.ok(Math.abs(main.move(down(0, 1)) + Math.PI / 2) < 1e-9, "the main crank's forward is clockwise about +z");
    const screw = new CrankDrag(s.screw, grab, down(1, 0));
    assert.ok(Math.abs(screw.move(down(0, 1)) - Math.PI / 2) < 1e-9);
    const edgeOn = new THREE.Ray(new THREE.Vector3(5, 0, 0), new THREE.Vector3(-1, 0, 0));
    assert.equal(screw.move(edgeOn), screw.angle, "seen edge-on: no change");
  });
});
