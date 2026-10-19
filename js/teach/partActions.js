// Operating the machine by clicking (or tapping) its parts in 3D (M3), and by dragging its two
// cranks round (U16). A click or a drag resolves to the same operation as a panel control, so
// the page applies the same locks and lesson rules to both. Pure logic over three.js objects:
// the page and the tests (A3-11, A3-15) share it.

import * as THREE from "three";
import { anchors } from "../accept/harness.js";
import { gltfName } from "../scene/rig.js";
/** @import { Machine } from "../sim/machine.js" */
import { t } from "../l10n/l10n.js";
/** @import { Task } from "./player.js" */

/** @typedef {Task["controls"][number]} Control */

/**
 * What a click on a part asks for:
 * - setDigit: a digit on a setting dial
 * - nextDigit: the knob itself: next digit
 * - turn: the main crank: one turn forward (1, adds) or backward (-1, subtracts)
 * - pin: a hole of the Magna Rota (0 = pin out), or the pin
 * - shiftTo: a result wheel: carriage units under it
 * - shiftStep: the end crank: the carriage one place left (1) or right (-1)
 * @typedef {(
 *   | { kind: "setDigit"; knob: number; digit: number }
 *   | { kind: "nextDigit"; knob: number }
 *   | { kind: "turn"; dir: 1 | -1 }
 *   | { kind: "pin"; hole: number | null }
 *   | { kind: "shiftTo"; offset: number }
 *   | { kind: "shiftStep"; dir: 1 | -1 }
 * )} Intent
 */

/**
 * The panel control an intent stands for (lesson tasks allow controls by name).
 * @param {Intent} i
 * @returns {Control}
 */
export function controlOf(i) {
  if (i.kind === "setDigit" || i.kind === "nextDigit") return "input";
  if (i.kind === "turn") return i.dir > 0 ? "add" : "sub";
  if (i.kind === "pin") return "pin";
  return "shift";
}

/**
 * The direction a shift control is asked for (the carriage's ends refuse one), if any.
 * @param {Intent} i
 * @returns {1 | -1 | undefined}
 */
export const shiftDir = (i) => (i.kind === "shiftStep" ? i.dir : undefined);

/**
 * @param {THREE.Object3D} node
 * @param {string} base
 */
const indexOf = (node, base) => {
  const r = new RegExp(`^${gltfName(base)}(\\d+)$`).exec(node.name);
  return r ? Number(r[1]) : null;
};

/**
 * @param {THREE.Vector3[]} points
 * @param {THREE.Vector3} p
 */
const nearest = (points, p) => {
  let best = 0;
  points.forEach((q, i) => (q.distanceToSquared(p) < points[best].distanceToSquared(p) ? (best = i) : 0));
  return best;
};

/**
 * What clicking this part at this world point does (null: not clickable). dir is the way a
 * crank turns: forward (1, a click) or backward (-1, a Shift-click); other parts ignore it.
 * @param {THREE.Object3D} hit
 * @param {THREE.Vector3} point
 * @param {Machine} m
 * @param {1 | -1} [dir]
 * @returns {Intent | null}
 */
export function intentAt(hit, point, m, dir = 1) {
  for (let n = /** @type {THREE.Object3D | null} */ (hit); n; n = n.parent) {
    /** @type {number | null} */
    let k;
    if ((k = indexOf(n, "pm.setting_plate.")) !== null) return { kind: "setDigit", knob: k, digit: nearest(anchors(n, "glyph_anchors"), point) };
    if ((k = indexOf(n, "pm.setting_dial.")) !== null) return { kind: "nextDigit", knob: k };
    if ((k = indexOf(n, "pi.sum_wheel.")) !== null) return { kind: "shiftTo", offset: Math.min(k, m.maxOffset) };
    if (n.name === gltfName("pi.window")) {
      const reads = anchors(n, "read_points");
      return { kind: "shiftTo", offset: Math.min(nearest(reads, point), m.maxOffset) };
    }
    if (n.name === gltfName("pm.main_crank")) return { kind: "turn", dir };
    if (n.name === gltfName("pm.magna_pin")) return { kind: "pin", hole: null };
    if (n.name === gltfName("pm.magna_rota")) {
      // Holes, black digits and red digits sit on the same spokes: the nearest black digit
      // around the ring's centre gives the hole.
      const centre = new THREE.Vector3().setFromMatrixPosition(n.matrixWorld);
      /** @param {THREE.Vector3} v */
      const ang = (v) => Math.atan2(v.y - centre.y, v.x - centre.x);
      const a = ang(point);
      const glyphs = anchors(n, "black_glyphs");
      let best = 0;
      glyphs.forEach((g, i) => {
        /** @param {THREE.Vector3} q */
        const d = (q) => Math.abs(Math.atan2(Math.sin(ang(q) - a), Math.cos(ang(q) - a)));
        if (d(g) < d(glyphs[best])) best = i;
      });
      return { kind: "pin", hole: best === 0 ? null : best };
    }
    if (n.name === gltfName("frame.lead_screw")) return { kind: "shiftStep", dir };
  }
  return null;
}

/**
 * The crank a part belongs to, if it is one: the main crank or the end crank (with its screw).
 * @param {THREE.Object3D} hit
 * @returns {{ node: THREE.Object3D; kind: "turn" | "shiftStep" } | null}
 */
export function crankAt(hit) {
  for (let n = /** @type {THREE.Object3D | null} */ (hit); n; n = n.parent) {
    if (n.name === gltfName("pm.main_crank")) return { node: n, kind: "turn" };
    if (n.name === gltfName("frame.lead_screw")) return { node: n, kind: "shiftStep" };
  }
  return null;
}

/**
 * Dragging a crank round its axle (U16). The grabbed point moves on a circle round the axle, in
 * the plane through it across the axle; the pointer's ray meets that plane, and the angle it
 * sweeps there, signed by the crank's axis, is how far the reader has turned it. Positive is the
 * crank's forward way: the rig turns it about its axis (glTF extras) by +angle as the machine
 * adds, or as the carriage goes left.
 */
export class CrankDrag {
  /** Turned angle so far (radians; + forward). */
  angle = 0;

  /**
   * @param {THREE.Object3D} node the crank (it turns about its rig axis through its origin)
   * @param {THREE.Vector3} grab the grabbed point (world)
   * @param {THREE.Ray} ray the pointer's ray at the grab
   */
  constructor(node, grab, ray) {
    const ex = /** @type {{ axis?: number[] }} */ (node.userData);
    node.updateWorldMatrix(true, false);
    /** The axle's direction (world). */
    this.axis = new THREE.Vector3().fromArray(ex.axis ?? [0, 0, 1]).applyQuaternion(node.getWorldQuaternion(new THREE.Quaternion())).normalize();
    const origin = node.getWorldPosition(new THREE.Vector3());
    /** Where the axle crosses the plane of the grabbed point's circle. */
    this.centre = origin.addScaledVector(this.axis, grab.clone().sub(origin).dot(this.axis));
    /** @private */
    this.plane = new THREE.Plane().setFromNormalAndCoplanarPoint(this.axis, grab);
    /** @private */
    this.last = this.radial(ray) ?? grab.clone().sub(this.centre);
  }

  /**
   * From the axle to where the ray meets the circle's plane (null: the plane is seen edge-on).
   * @private
   * @param {THREE.Ray} ray
   * @returns {THREE.Vector3 | null}
   */
  radial(ray) {
    if (Math.abs(ray.direction.dot(this.axis)) < 0.05) return null;
    const p = ray.intersectPlane(this.plane, new THREE.Vector3());
    return p ? p.sub(this.centre) : null;
  }

  /**
   * Follow the pointer.
   * @param {THREE.Ray} ray
   * @returns {number} the angle turned so far (radians; + forward)
   */
  move(ray) {
    const v = this.radial(ray);
    if (!v || v.lengthSq() < 1e-12) return this.angle;
    const cross = new THREE.Vector3().crossVectors(this.last, v).dot(this.axis);
    this.angle += Math.atan2(cross, this.last.dot(v));
    this.last = v;
    return this.angle;
  }
}

/** How far a crank must be dragged round to commit a full turn (or a shift): about 30°. */
export const CRANK_COMMIT = THREE.MathUtils.degToRad(30);

/**
 * Whether the machine can do it now (at rest, in range, not blocked).
 * @param {Intent} i
 * @param {Machine} m
 * @returns {boolean}
 */
export function possible(i, m) {
  if (i.kind === "turn") return m.theta !== 0 || m.canStart(i.dir);
  if (!m.atRest) return false;
  if (i.kind === "shiftStep") return m.offset + i.dir >= 0 && m.offset + i.dir <= m.maxOffset;
  if (i.kind === "shiftTo") return i.offset !== m.offset;
  return true;
}

/**
 * One line telling the learner what a click does, for the hover label.
 * @param {Intent} i
 * @returns {string}
 */
export function intentHint(i) {
  switch (i.kind) {
    case "setDigit":
      return t("hint.setDigit", { n: i.digit });
    case "nextDigit":
      return t("hint.nextDigit");
    case "turn":
      return t(i.dir > 0 ? "hint.turn" : "hint.turnBack");
    case "pin":
      return i.hole === null ? t("hint.pinOut") : t("hint.pin", { n: i.hole });
    case "shiftTo":
      return t("hint.shiftTo");
    case "shiftStep":
      return t(i.dir > 0 ? "hint.shiftLeft" : "hint.shiftRight");
  }
}

/**
 * Apply an intent at once (tests; the page animates turns and shifts instead).
 * @param {Intent} i
 * @param {Machine} m
 * @returns {boolean}
 */
export function applyIntentNow(i, m) {
  switch (i.kind) {
    case "setDigit":
      return m.setSetting(i.knob, i.digit);
    case "nextDigit":
      return m.setSetting(i.knob, (m.settings[i.knob] + 1) % 10);
    case "pin":
      return m.setPin(i.hole);
    case "turn":
      return m.turn(i.dir);
    case "shiftTo":
      return m.setOffset(i.offset);
    case "shiftStep":
      return m.setOffset(m.offset + i.dir);
  }
}
