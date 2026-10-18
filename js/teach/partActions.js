// Operating the machine by clicking (or tapping) its parts in 3D (M3). A click resolves to
// the same operation as a panel control, so the page applies the same locks and lesson
// rules to both. Pure logic over three.js objects: the page and the tests (A3-11) share it.

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
 * - turn: the main crank: one turn forward
 * - pin: a hole of the Magna Rota (0 = pin out), or the pin
 * - shiftTo: a result wheel: carriage units under it
 * - shiftLeft: the end crank
 * @typedef {(
 *   | { kind: "setDigit"; knob: number; digit: number }
 *   | { kind: "nextDigit"; knob: number }
 *   | { kind: "turn" }
 *   | { kind: "pin"; hole: number | null }
 *   | { kind: "shiftTo"; offset: number }
 *   | { kind: "shiftLeft" }
 * )} Intent
 */

/**
 * The panel control an intent stands for (lesson tasks allow controls by name).
 * @param {Intent} i
 * @returns {Control}
 */
export function controlOf(i) {
  if (i.kind === "setDigit" || i.kind === "nextDigit") return "input";
  if (i.kind === "turn") return "add";
  if (i.kind === "pin") return "pin";
  return "shift";
}

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
 * What clicking this part at this world point does (null: not clickable).
 * @param {THREE.Object3D} hit
 * @param {THREE.Vector3} point
 * @param {Machine} m
 * @returns {Intent | null}
 */
export function intentAt(hit, point, m) {
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
    if (n.name === gltfName("pm.main_crank")) return { kind: "turn" };
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
    if (n.name === gltfName("frame.lead_screw")) return { kind: "shiftLeft" };
  }
  return null;
}

/**
 * Whether the machine can do it now (at rest, in range, not blocked).
 * @param {Intent} i
 * @param {Machine} m
 * @returns {boolean}
 */
export function possible(i, m) {
  if (i.kind === "turn") return m.theta !== 0 || m.canStart(1);
  if (!m.atRest) return false;
  if (i.kind === "shiftLeft") return m.offset < m.maxOffset;
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
      return t("hint.turn");
    case "pin":
      return i.hole === null ? t("hint.pinOut") : t("hint.pin", { n: i.hole });
    case "shiftTo":
      return t("hint.shiftTo");
    case "shiftLeft":
      return t("hint.shiftLeft");
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
      return m.turn(1);
    case "shiftTo":
      return m.setOffset(i.offset);
    case "shiftLeft":
      return m.setOffset(m.offset + 1);
  }
}
