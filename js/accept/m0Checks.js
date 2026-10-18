// Acceptance spec for M0 (design/modelling-and-animation-plan.md §10.1, A0-1..A0-9).
// Each check poses the loaded model through the same code as the page
// (DigitSlice -> applyM0Pose -> Rig) and inspects the resulting 3D geometry.

import * as THREE from "three";
import { applyM0Pose } from "../scene/m0Pose.js";
import { M0_NODES, Rig } from "../scene/rig.js";
import { DigitSlice } from "../sim/digitSlice.js";
import * as K from "../sim/kinematics.js";
import { anchors, fmt, intersects, minDistance, nearestIndex, node, rayHits, result, topEdgeTilt } from "./harness.js";
/** @import { CheckResult } from "./harness.js" */

// Tolerances (mm / deg). See docs/conventions.md -> Testing.
/** Gear pairs are centred in their backlash (drum ribs are 80 % thick), so a driving
 *  rib sits ~0.28 mm from the gear flank on both sides; plus tessellation. */
export const CONTACT_GEAR_MM = 0.4;
/** Pin-on-horn contact is solved analytically; allow tessellation error only. */
export const CONTACT_PIN_MM = 0.3;
export const CLEARANCE_MM = 0.05;
export const ANGLE_TOL_DEG = 1;

/**
 * @typedef {object} Ctx
 * @property {THREE.Object3D} root
 * @property {Rig<keyof typeof M0_NODES>} rig
 * @property {DigitSlice} m
 */

/** @param {Ctx} c */
function pose(c) {
  applyM0Pose(c.rig, c.m.pose());
}

/**
 * @param {Ctx} c
 * @param {number} digit
 * @param {number} setting
 */
function setState(c, digit, setting, theta = 0) {
  c.m.reset();
  c.m.digit = digit;
  c.m.setSetting(setting);
  c.m.setTheta(theta);
  pose(c);
}

/** @param {THREE.Object3D} root */
const parts = (root) => ({
  shaft: node(root, M0_NODES.drumShaft),
  drum: node(root, M0_NODES.drum),
  rack: node(root, M0_NODES.rack),
  dial: node(root, M0_NODES.dial),
  wheel: node(root, M0_NODES.wheel),
  store: node(root, M0_NODES.store),
  plate: node(root, "pm.setting_plate.0"),
  window: node(root, "pi.window.0"),
  frame: node(root, "frame.static"),
});

/** @param {number} k */
const midWindow = (k) => K.ribWindowStart(K.ribWindowIndex(k, 1)) + K.RIB_PITCH / 2;

/**
 * Digit read through the window, by ray casting straight down through its opening.
 *  Returns null if no glyph is visible or the glyphs seen disagree.
 * @param {THREE.Object3D} root
 * @returns {{ digit: number | null; inkHits: number; blocked: number }}
 */
export function readWindow(root) {
  const p = parts(root);
  const [readPoint] = anchors(p.window, "read_point");
  const [hx, hz] = (/** @type {{ read_half_size_mm: number[] }} */ (p.window.userData)).read_half_size_mm.map((v) => v / 1000);
  const glyphs = anchors(p.wheel, "glyph_anchors");
  const down = new THREE.Vector3(0, -1, 0);
  /** @type {Set<number>} */
  const seen = new Set();
  let inkHits = 0;
  let blocked = 0;
  // 17 x 11 rays, ~0.5 mm apart: finer than the glyph strokes (~0.7 mm).
  for (let i = -8; i <= 8; i++) {
    for (let j = -5; j <= 5; j++) {
      const o = readPoint.clone().add(new THREE.Vector3((i / 8) * hx, 0, (j / 5) * hz));
      const [first] = rayHits([p.wheel, p.window, p.store, p.frame], o, down);
      if (!first) continue;
      if (!p.wheel.getObjectById(first.mesh.id) && first.mesh.parent !== p.wheel) {
        blocked++;
        continue;
      }
      if (first.material === "ink_black") {
        inkHits++;
        seen.add(nearestIndex(glyphs, first.point));
      }
    }
  }
  const digit = seen.size === 1 ? [...seen][0] : null;
  return { digit, inkHits, blocked };
}

/**
 * @param {THREE.Object3D} root
 * @returns {CheckResult[]}
 */
export function runM0Checks(root) {
  const rig = new Rig(root, M0_NODES);
  /** @type {Ctx} */
  const c = { root, rig, m: new DigitSlice() };
  const p = parts(root);
  /** @type {CheckResult[]} */
  const out = [];
  /**
   * @param {string} id
   * @param {string} title
   * @param {() => { passed: boolean; detail: string }} fn
   */
  const run = (id, title, fn) => {
    try {
      const r = fn();
      const parts = r.detail.split("; ");
      const detail = parts.length > 6 ? `${parts.slice(0, 6).join("; ")}; … (${parts.length} issues)` : r.detail;
      out.push(result(id, title, r.passed, detail));
    } catch (e) {
      out.push(result(id, title, false, `error: ${e instanceof Error ? e.message : String(e)}`));
    }
  };

  run("A0-9", "Node contract: parts, motion extras and anchors exist", () => {
    const counts = {
      wheelGlyphs: anchors(p.wheel, "glyph_anchors").length,
      gearCenter: anchors(p.wheel, "gear_center").length,
      plateGlyphs: anchors(p.plate, "glyph_anchors").length,
      pointer: anchors(p.dial, "pointer_tip").length,
      readPoint: anchors(p.window, "read_point").length,
      pentagon: anchors(p.store, "pentagon_corners").length,
    };
    const radii = /** @type {{ core_radius_mm?: number; rib_tip_radius_mm?: number }} */ (p.drum.userData);
    const ok =
      counts.wheelGlyphs === 10 && counts.gearCenter === 1 && counts.plateGlyphs === 10 && counts.pointer === 1 &&
      counts.readPoint === 1 && counts.pentagon === 5 && !!radii.core_radius_mm && !!radii.rib_tip_radius_mm;
    return { passed: ok, detail: JSON.stringify(counts) };
  });

  run("A0-1", "The window shows the result digit (ray cast through the opening)", () => {
    /** @type {string[]} */
    const bad = [];
    for (let d = 0; d <= 9; d++) {
      setState(c, d, 0);
      const r = readWindow(root);
      if (r.digit !== d || r.blocked > 0) bad.push(`d=${d}: read ${r.digit} (ink ${r.inkHits}, blocked ${r.blocked})`);
    }
    return { passed: bad.length === 0, detail: bad.join("; ") || "digits 0-9 read correctly" };
  });

  run("A0-2", "The setting pointer aims at the set digit", () => {
    /** @type {string[]} */
    const bad = [];
    let worst = 0;
    for (let s = 0; s <= 9; s++) {
      setState(c, 0, s);
      const axis = new THREE.Vector3().setFromMatrixPosition(p.dial.matrixWorld);
      /** @param {THREE.Vector3} v */
      const flat = (v) => Math.atan2(v.z - axis.z, v.x - axis.x);
      const [tip] = anchors(p.dial, "pointer_tip");
      const a = flat(tip);
      const glyphs = anchors(p.plate, "glyph_anchors");
      const diffs = glyphs.map((g) => Math.abs(THREE.MathUtils.radToDeg(Math.atan2(Math.sin(flat(g) - a), Math.cos(flat(g) - a)))));
      const idx = diffs.indexOf(Math.min(...diffs));
      worst = Math.max(worst, diffs[idx]);
      if (idx !== s || diffs[idx] > ANGLE_TOL_DEG) bad.push(`s=${s}: aims at ${idx} (${fmt(diffs[idx], 2)}°)`);
    }
    return { passed: bad.length === 0, detail: bad.join("; ") || `max angle error ${fmt(worst, 3)}°` };
  });

  run("A0-3", "The gear plane lies on rib k exactly when k >= 10 - s", () => {
    const { core_radius_mm: core, rib_tip_radius_mm: tip } = /** @type {Record<string, number>} */ (p.drum.userData);
    const threshold = (core + tip) / 2;
    const axisDir = new THREE.Vector3(...(/** @type {[number, number, number]} */ ((/** @type {{ axis: number[] }} */ (p.shaft.userData)).axis)));
    /** @type {string[]} */
    const bad = [];
    for (let s = 0; s <= 9; s++) {
      for (let k = 1; k <= 9; k++) {
        setState(c, 0, s, midWindow(k));
        const [g] = anchors(p.wheel, "gear_center");
        const o = new THREE.Vector3().setFromMatrixPosition(p.shaft.matrixWorld);
        const onAxis = o.clone().addScaledVector(axisDir, g.clone().sub(o).dot(axisDir));
        const [hit] = rayHits([p.drum], g, onAxis.clone().sub(g));
        const r = hit ? hit.point.distanceTo(onAxis) * 1000 : 0;
        const onRib = r > threshold;
        if (onRib !== k >= 10 - s) bad.push(`s=${s} k=${k}: ${onRib ? "rib" : "core"} (r=${fmt(r, 2)} mm)`);
      }
    }
    return { passed: bad.length === 0, detail: bad.join("; ") || "90 setting/rib combinations agree with the logic" };
  });

  run("A0-4", "Engaged ribs touch the receiving gear; everything else stays clear", () => {
    /** @type {string[]} */
    const bad = [];
    let worstContact = 0;
    let worstClear = Infinity;
    for (let s = 0; s <= 9; s++) {
      for (let k = 1; k <= 9; k++) {
        setState(c, 0, s, midWindow(k));
        const d = minDistance(p.drum, p.wheel);
        const hit = intersects(p.drum, p.wheel);
        if (k >= 10 - s) {
          worstContact = Math.max(worstContact, d);
          if (d > CONTACT_GEAR_MM || hit) bad.push(`s=${s} k=${k}: engaged rib ${hit ? "intersects" : `${fmt(d)} mm away`}`);
        } else {
          worstClear = Math.min(worstClear, d);
          if (d < CLEARANCE_MM || hit) bad.push(`s=${s} k=${k}: idle rib ${fmt(d)} mm`);
        }
      }
      for (const th of [0, 40, K.RIB_START - 1, 300, 359]) {
        setState(c, 0, s, th);
        const d = minDistance(p.drum, p.wheel);
        worstClear = Math.min(worstClear, d);
        if (d < CLEARANCE_MM || intersects(p.drum, p.wheel)) bad.push(`s=${s} θ=${th}: ${fmt(d)} mm`);
      }
    }
    return {
      passed: bad.length === 0,
      detail: bad.join("; ") || `max engaged gap ${fmt(worstContact)} mm, min idle clearance ${fmt(worstClear)} mm`,
    };
  });

  const pentagonTilt = () => topEdgeTilt(anchors(p.store, "pentagon_corners"));

  run("A0-5", "9 + 1: pentagon level → tilted 18° → level, window shows 0", () => {
    const store = K.STORE_STEP;
    setState(c, 9, 1, 0);
    const t0 = pentagonTilt();
    setState(c, 9, 1, K.CARRY_WINDOW_START);
    const t1 = pentagonTilt();
    setState(c, 9, 1, 359.9);
    const t2 = pentagonTilt();
    const read = readWindow(root).digit;
    c.m.setTheta(360);
    pose(c);
    const t3 = pentagonTilt();
    const final = readWindow(root).digit;
    const ok =
      t0 < ANGLE_TOL_DEG && Math.abs(t1 - store) < ANGLE_TOL_DEG && t2 < ANGLE_TOL_DEG && t3 < ANGLE_TOL_DEG &&
      read === 0 && final === 0 && c.m.carryOut === 1;
    return { passed: ok, detail: `tilt ${fmt(t0, 2)}° → ${fmt(t1, 2)}° → ${fmt(t2, 2)}° → ${fmt(t3, 2)}°; window ${final}; carry out ${c.m.carryOut}` };
  });

  run("A0-6", "0 − 1: pentagon level → tilted 18° → level, window shows 9", () => {
    const store = K.STORE_STEP;
    const endFirstWindow = -(K.ribWindowStart(0) + K.RIB_PITCH);
    setState(c, 0, 1, 0);
    const t0 = pentagonTilt();
    setState(c, 0, 1, endFirstWindow - 1);
    const t1 = pentagonTilt();
    setState(c, 0, 1, -359.9);
    const t2 = pentagonTilt();
    c.m.setTheta(-360);
    pose(c);
    const t3 = pentagonTilt();
    const final = readWindow(root).digit;
    const ok =
      t0 < ANGLE_TOL_DEG && Math.abs(t1 - store) < ANGLE_TOL_DEG && t2 < ANGLE_TOL_DEG && t3 < ANGLE_TOL_DEG &&
      final === 9 && c.m.carryOut === -1;
    return { passed: ok, detail: `tilt ${fmt(t0, 2)}° → ${fmt(t1, 2)}° → ${fmt(t2, 2)}° → ${fmt(t3, 2)}°; window ${final}; borrow ${c.m.carryOut}` };
  });

  run("A0-7", "The Einzahn touches the Fünfhorn while storing; clear at rest", () => {
    /** @type {string[]} */
    const bad = [];
    // v = 9.5 is mid-push (9 + 1, rib 9 at mid-window).
    setState(c, 9, 1, midWindow(9));
    const push = minDistance(p.wheel, p.store);
    if (push > CONTACT_PIN_MM || intersects(p.wheel, p.store)) bad.push(`mid-push gap ${fmt(push)} mm`);
    let worstRest = Infinity;
    for (let d = 0; d <= 9; d++) {
      setState(c, d, 0, 0);
      const r = minDistance(p.wheel, p.store);
      worstRest = Math.min(worstRest, r);
      if (r < CLEARANCE_MM || intersects(p.wheel, p.store)) bad.push(`rest d=${d}: ${fmt(r)} mm`);
    }
    return { passed: bad.length === 0, detail: bad.join("; ") || `mid-push gap ${fmt(push)} mm, min rest clearance ${fmt(worstRest)} mm` };
  });

  run("A0-8", "Pinion and rack stay in mesh across the setting range", () => {
    /** @type {string[]} */
    const bad = [];
    let worst = 0;
    for (let i = 0; i <= 36; i++) {
      const s = i / 4;
      rig.set("dial", K.dialAngle(s));
      rig.set("rack", K.drumFrontY(s));
      rig.set("drum", K.drumFrontY(s));
      const d = minDistance(p.dial, p.rack);
      worst = Math.max(worst, d);
      if (d > CONTACT_PIN_MM || intersects(p.dial, p.rack)) bad.push(`s=${s}: ${fmt(d)} mm`);
    }
    return { passed: bad.length === 0, detail: bad.join("; ") || `max gap ${fmt(worst)} mm over s = 0..9` };
  });

  c.m.reset();
  pose(c);
  out.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  return out;
}
