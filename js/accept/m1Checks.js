// Acceptance spec for M1 (plan §10.1, A1-1..A1-6; A1-7 runs the M0 spec separately).
// Poses the M1 model through CarrySlice -> applyM1Pose -> Rig, exactly as page 02 does.

import * as THREE from "three";
import { applyM1Pose, m1NodeNames } from "../scene/m1Pose.js";
import { Rig } from "../scene/rig.js";
import { CarrySlice } from "../sim/carrySlice.js";
/** @import { CarryMode } from "../sim/carrySlice.js" */
import * as K from "../sim/kinematics.js";
import * as M from "../sim/kinematicsM1.js";
import { CollisionSweep } from "./collisions.js";
import { anchors, fmt, intersects, minDistance, nearestIndex, node, rayHits, result, topEdgeTilt } from "./harness.js";
/** @import { CheckResult } from "./harness.js" */
import { ANGLE_TOL_DEG, CLEARANCE_MM, CONTACT_GEAR_MM, CONTACT_PIN_MM } from "./m0Checks.js";

/**
 * @typedef {object} Ctx
 * @property {THREE.Object3D} root
 * @property {Rig<string>} rig
 * @property {CarrySlice} m
 * @property {number} n
 */

/** @param {Ctx} c */
function pose(c) {
  applyM1Pose(c.rig, c.m.pose());
}

/**
 * @param {Ctx} c
 * @param {{ mode?: CarryMode; result?: number; input?: number; theta?: number }} opts
 */
function state(c, opts) {
  c.m.reset();
  c.m.setMode(opts.mode ?? "ripple");
  c.m.setResult(opts.result ?? 0);
  c.m.setNumber(opts.input ?? 0);
  c.m.setTheta(opts.theta ?? 0);
  pose(c);
}

/**
 * @param {Ctx} c
 * @param {string} base
 * @param {number} i
 */
const part = (c, base, i) => node(c.root, `${base}.${i}`);

/**
 * Digit shown in window i (ray cast straight down through its opening); null if unreadable.
 * @param {THREE.Object3D} root
 * @param {number} i
 * @returns {number | null}
 */
export function readWindowM1(root, i) {
  const window = node(root, "pi.window");
  const wheel = node(root, `pi.sum_wheel.${i}`);
  const read = anchors(window, "read_points")[i];
  const [hx, hz] = (/** @type {{ read_half_size_mm: number[] }} */ (window.userData)).read_half_size_mm.map((v) => v / 1000);
  const glyphs = anchors(wheel, "glyph_anchors");
  const targets = [wheel, window, node(root, `pi.carry_store.${i}`), node(root, "frame.static")];
  /** @type {Set<number>} */
  const seen = new Set();
  let blocked = 0;
  for (let a = -8; a <= 8; a++) {
    for (let b = -5; b <= 5; b++) {
      const o = read.clone().add(new THREE.Vector3((a / 8) * hx, 0, (b / 5) * hz));
      const [first] = rayHits(targets, o, new THREE.Vector3(0, -1, 0));
      if (!first) continue;
      /** @type {THREE.Object3D | null} */
      let owner = first.mesh;
      while (owner && owner !== wheel) owner = owner.parent;
      if (!owner) {
        blocked++;
        continue;
      }
      if (first.material === "ink_black") seen.add(nearestIndex(glyphs, first.point));
    }
  }
  return seen.size === 1 && blocked === 0 ? [...seen][0] : null;
}

/** @param {Ctx} c */
const readAll = (c) => Array.from({ length: c.n }, (_, i) => readWindowM1(c.root, i));
/** @param {Ctx} c */
const tilts = (c) => Array.from({ length: c.n }, (_, i) => topEdgeTilt(anchors(part(c, "pi.carry_store", i), "pentagon_corners")));
/** @param {number[]} t */
const level = (t) => t.every((x) => x < ANGLE_TOL_DEG);
/** @param {(number | null)[]} d */
const showNum = (d) => d.map((x) => (x === null ? "?" : String(x))).reverse().join("");

/**
 * @param {THREE.Object3D} root
 * @returns {CheckResult[]}
 */
export function runM1Checks(root) {
  const n = M.DIGITS;
  /** @type {Rig<string>} */
  const rig = new Rig(root, m1NodeNames(n));
  /** @type {Ctx} */
  const c = { root, rig, m: new CarrySlice(n), n };
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

  run("A1-1", "Per-digit M0 checks hold on all three digits", () => {
    /** @type {string[]} */
    const bad = [];
    // contract
    for (let i = 0; i < n; i++) {
      if (anchors(part(c, "pi.sum_wheel", i), "glyph_anchors").length !== 10) bad.push(`wheel ${i} glyphs`);
      if (anchors(part(c, "pi.carry_store", i), "pentagon_corners").length !== 5) bad.push(`store ${i} pentagon`);
    }
    if (anchors(node(root, "pi.window"), "read_points").length !== n) bad.push("window read points");
    // readout of every digit in every window
    for (let d = 0; d <= 9; d++) {
      state(c, { result: d * 111 });
      const r = readAll(c);
      if (r.some((x) => x !== d)) bad.push(`all ${d}: read ${showNum(r)}`);
    }
    // pointers
    for (let s = 0; s <= 9; s++) {
      state(c, { input: s * 111 });
      for (let i = 0; i < n; i++) {
        const dial = part(c, "pm.setting_dial", i);
        const axis = new THREE.Vector3().setFromMatrixPosition(dial.matrixWorld);
        /** @param {THREE.Vector3} v */
        const flat = (v) => Math.atan2(v.z - axis.z, v.x - axis.x);
        const a = flat(anchors(dial, "pointer_tip")[0]);
        const g = anchors(part(c, "pm.setting_plate", i), "glyph_anchors");
        const diffs = g.map((p) => Math.abs(THREE.MathUtils.radToDeg(Math.atan2(Math.sin(flat(p) - a), Math.cos(flat(p) - a)))));
        const idx = diffs.indexOf(Math.min(...diffs));
        if (idx !== s || diffs[idx] > ANGLE_TOL_DEG) bad.push(`pointer ${i} s=${s} -> ${idx}`);
      }
    }
    // rib/gear contact (engaged mid-window) and Einzahn contact while storing
    for (const s of [3, 9]) {
      for (let k = 10 - s; k <= 9; k++) {
        const mid = K.ribWindowStart(K.ribWindowIndex(k, 1)) + K.RIB_PITCH / 2;
        state(c, { input: s * 111, theta: mid });
        for (let i = 0; i < n; i++) {
          const d = minDistance(part(c, "pm.drum", i), part(c, "pi.sum_wheel", i));
          if (d > CONTACT_GEAR_MM || intersects(part(c, "pm.drum", i), part(c, "pi.sum_wheel", i))) bad.push(`rib ${k} digit ${i}: ${fmt(d)} mm`);
        }
      }
    }
    state(c, { result: 999, input: 111, theta: 270 }); // every digit 9 -> 0 at rib 9 mid-window
    for (let i = 0; i < n; i++) {
      const d = minDistance(part(c, "pi.sum_wheel", i), part(c, "pi.carry_store", i));
      if (d > CONTACT_PIN_MM) bad.push(`Einzahn ${i}: ${fmt(d)} mm`);
    }
    return { passed: bad.length === 0, detail: bad.join("; ") || "contract, readout 0-9, pointers, rib and Einzahn contact OK on all digits" };
  });

  run("A1-2", "Ripple: 999 + 1 → 000 and one carry out in one turn; pentagons level", () => {
    state(c, { mode: "ripple", result: 999, input: 1 });
    c.m.setTheta(M.leverWindow(0, "ripple") - 1); // ribs done, units carry stored
    pose(c);
    const stored = tilts(c);
    c.m.setTheta(360);
    pose(c);
    const r = readAll(c);
    const t = tilts(c);
    const ok = Math.abs(stored[0] - K.STORE_STEP) < ANGLE_TOL_DEG && r.every((x) => x === 0) && c.m.carryOut === 1 && level(t);
    return { passed: ok, detail: `units stored tilt ${fmt(stored[0], 1)}°; after the turn ${showNum(r)}, carry out ${c.m.carryOut}, tilts ${t.map((x) => fmt(x, 1)).join("/")}` };
  });

  run("A1-3", "Historical: 999 + 1 → 900 (tens carry waits) → 000 + carry after an idle turn", () => {
    state(c, { mode: "historical", result: 999, input: 1 });
    c.m.setTheta(360);
    pose(c);
    const r1 = readAll(c);
    const t1 = tilts(c);
    c.m.setNumber(0);
    c.m.setTheta(360);
    pose(c);
    const r2 = readAll(c);
    const t2 = tilts(c);
    const ok =
      showNum(r1) === "900" && t1[1] > K.STORE_STEP - ANGLE_TOL_DEG && t1[0] < ANGLE_TOL_DEG && t1[2] < ANGLE_TOL_DEG &&
      showNum(r2) === "000" && level(t2) && c.m.carryOut === 1;
    return { passed: ok, detail: `turn 1: ${showNum(r1)} tilts ${t1.map((x) => fmt(x, 1)).join("/")}; idle turn: ${showNum(r2)} tilts ${t2.map((x) => fmt(x, 1)).join("/")}, carry out ${c.m.carryOut}` };
  });

  run("A1-4", "Zweihorns act in their own windows, units first; carries transfer; secondary stored in time", () => {
    /** @type {string[]} */
    const bad = [];
    for (let i = 0; i < n; i++) {
      const w = M.leverWindow(i, "ripple");
      const store = () => part(c, "pi.carry_store", i);
      const horn = () => part(c, "pm.zweihorn_add", i);
      state(c, { result: 999, input: 1, theta: w - 2 });
      const before = minDistance(store(), horn());
      state(c, { result: 999, input: 1, theta: w + 2 });
      const during = minDistance(store(), horn());
      const hit = intersects(store(), horn());
      if (before < CLEARANCE_MM) bad.push(`lever ${i} touches early (${fmt(before)} mm)`);
      if (during > CONTACT_PIN_MM || hit) bad.push(`lever ${i} not pushing (${hit ? "intersects" : `${fmt(during)} mm`})`);
      if (i + 1 < n) {
        state(c, { result: 999, input: 1, theta: w + 4 });
        const xfer = minDistance(store(), part(c, "pi.sum_wheel", i + 1));
        if (xfer > CONTACT_GEAR_MM) bad.push(`Muldenrad ${i} not driving star ${i + 1} (${fmt(xfer)} mm)`);
        state(c, { result: 999, input: 1, theta: M.leverWindow(i + 1, "ripple") - 0.25 });
        const tilt = tilts(c)[i + 1];
        if (Math.abs(tilt - K.STORE_STEP) > ANGLE_TOL_DEG) bad.push(`digit ${i + 1} not stored before its lever (${fmt(tilt, 1)}°)`);
      }
      if (i > 0 && !(M.leverWindow(i, "ripple") > M.leverWindow(i - 1, "ripple"))) bad.push(`lever order ${i}`);
    }
    return { passed: bad.length === 0, detail: bad.join("; ") || "levers 0→1→2 push in order, transfer and secondary storing on time" };
  });

  run("A1-5", "Borrow ripple: 000 − 1 → 999 with one borrow out", () => {
    state(c, { mode: "ripple", result: 0, input: 1 });
    c.m.setTheta(-360);
    pose(c);
    const r = readAll(c);
    const ok = r.every((x) => x === 9) && c.m.carryOut === -1 && level(tilts(c));
    return { passed: ok, detail: `${showNum(r)}, borrow out ${c.m.carryOut}` };
  });

  run("A1-6", "No intersections at the runtime transforms (sampled turns, all pairs)", () => {
    const sweep = new CollisionSweep(root);
    /** @type {string[]} */
    const bad = [];
    let poses = 0;
    for (const sc of /** @type {const} */ ([{ result: 999, input: 1, dir: 1 }, { result: 0, input: 1, dir: -1 }, { result: 456, input: 278, dir: 1 }, { result: 0, input: 909, dir: 1 }, { result: 0, input: 90, dir: -1 }])) {
      for (let a = 0; a < 360; a += 4) {
        state(c, { result: sc.result, input: sc.input, theta: sc.dir * a });
        poses++;
        for (const h of sweep.run()) bad.push(`${h} @ ${sc.result}${sc.dir > 0 ? "+" : "-"}${sc.input} θ=${sc.dir * a}`);
      }
    }
    return { passed: bad.length === 0, detail: bad.join("; ") || `all moving pairs × ${poses} poses clear (${sweep.tested} near-pair tests)` };
  });

  c.m.reset();
  pose(c);
  return out.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}
