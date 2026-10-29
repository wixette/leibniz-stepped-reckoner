// Acceptance spec for M2 (plan §10.1, A2-1..A2-9 and A2-11..A2-13; A2-10 runs the M0/M1
// specs in the same `pnpm test`). Poses the full machine through Machine -> applyM2Pose ->
// Rig, exactly as the main page and page 03 do.

import * as THREE from "three";
import { applyM2Pose, m2NodeNames } from "../scene/m2Pose.js";
import { Rig } from "../scene/rig.js";
import * as K from "../sim/kinematics.js";
import { Machine } from "../sim/machine.js";
/** @import { CarryMode } from "../sim/machine.js" */
import { registerValue } from "../sim/operations.js";
import { M2_SCENARIOS, walkM2 } from "../tools/m2Scenarios.js";
import { CollisionSweep } from "./collisions.js";
import { anchors, fmt, intersects, minDistance, nearestIndex, node, rayHits, result, topEdgeTilt } from "./harness.js";
/** @import { CheckResult } from "./harness.js" */
import { ANGLE_TOL_DEG, CONTACT_PIN_MM } from "./m0Checks.js";
import { readWindowM1 } from "./m1Checks.js";

export const MAX_TRIANGLES = 300_000;
export const MAX_BYTES = 15 * 1024 * 1024;
/** Room for fingers round a crank knob at the bottom of its sweep (mm). */
export const HAND_MM = 10;
/** An outside crank knob must not touch the table the case stands on (mm). */
export const CLEARANCE_TABLE_MM = 1;
/** Alignment of a carriage digit with its register digit (mm along X). */
export const ALIGN_MM = 0.05;

/**
 * @typedef {object} Ctx
 * @property {THREE.Object3D} root
 * @property {Rig<string>} rig
 * @property {Machine} m
 * @property {number} R
 * @property {number} C
 */

/** @param {Ctx} c */
const pose = (c) => applyM2Pose(c.rig, c.root, c.m);

/**
 * @param {Ctx} c
 * @param {{ mode?: CarryMode; result?: number; input?: number; offset?: number; theta?: number }} o
 */
function state(c, o) {
  c.m.reset();
  c.m.setMode(o.mode ?? "ripple");
  c.m.setResult(o.result ?? 0);
  c.m.setNumber(o.input ?? 0);
  c.m.setOffset(o.offset ?? 0);
  c.m.setTheta(o.theta ?? 0);
  pose(c);
}

/**
 * @param {Ctx} c
 * @param {string} base
 * @param {number} i
 */
const part = (c, base, i) => node(c.root, `${base}.${i}`);
/** @param {Ctx} c */
const readAll = (c) => Array.from({ length: c.R }, (_, i) => readWindowM1(c.root, i));
/** @param {(number | null)[]} d */
const showNum = (d) => d.map((x) => (x === null ? "?" : String(x))).reverse().join("");
/** @param {Ctx} c */
const tilts = (c) => Array.from({ length: c.R }, (_, k) => topEdgeTilt(anchors(part(c, "pi.carry_store", k), "pentagon_corners")));
/**
 * @param {THREE.Object3D} o
 * @returns {number}
 */
function worldX(o) {
  let top = o;
  while (top.parent) top = top.parent;
  top.updateMatrixWorld(true);
  return new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).x * 1000;
}

/**
 * Digit (0-9) of the ring glyph nearest the top of the Magna Rota (where the stop is).
 * @param {Ctx} c
 * @param {"black_glyphs" | "red_glyphs"} key
 * @returns {number}
 */
function ringDigit(c, key) {
  const g = anchors(node(c.root, "pm.magna_rota"), key);
  let best = 0;
  g.forEach((p, i) => (p.y > g[best].y ? (best = i) : 0));
  return key === "black_glyphs" ? best : (10 - best) % 10;
}

/**
 * Pointer of setting knob j aims at digit s (within the angle tolerance)?
 * @param {Ctx} c
 * @param {number} j
 * @returns {number}
 */
function pointerDigit(c, j) {
  const dial = part(c, "pm.setting_dial", j);
  const axis = new THREE.Vector3().setFromMatrixPosition(dial.matrixWorld);
  /** @param {THREE.Vector3} v */
  const flat = (v) => Math.atan2(v.z - axis.z, v.x - axis.x);
  const a = flat(anchors(dial, "pointer_tip")[0]);
  const g = anchors(part(c, "pm.setting_plate", j), "glyph_anchors");
  const diffs = g.map((p) => Math.abs(THREE.MathUtils.radToDeg(Math.atan2(Math.sin(flat(p) - a), Math.cos(flat(p) - a)))));
  const idx = diffs.indexOf(Math.min(...diffs));
  return diffs[idx] <= ANGLE_TOL_DEG ? idx : -1;
}

// ---- the spec ---------------------------------------------------------------------------------
/**
 * @typedef {object} M2Options
 * @property {number} [bytes]
 * @property {number} [sweepStepDeg]
 * @property {number} [sweepShiftStep]
 */

/**
 * @param {THREE.Object3D} root
 * @param {M2Options} [opts]
 * @returns {CheckResult[]}
 */
export function runM2Checks(root, opts = {}) {
  const ex = /** @type {{ register_digits?: number; carriage_digits?: number }} */ ((root.getObjectByName("lsr_m2")?.userData ?? {}));
  const R = ex.register_digits ?? 16;
  const C = ex.carriage_digits ?? 8;
  /** @type {Rig<string>} */
  const rig = new Rig(root, m2NodeNames(R, C));
  /** @type {Ctx} */
  const c = { root, rig, m: new Machine(R, C), R, C };
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
      const p = r.detail.split("; ");
      const detail = p.length > 6 ? `${p.slice(0, 6).join("; ")}; … (${p.length} issues)` : r.detail;
      out.push(result(id, title, r.passed, detail));
    } catch (e) {
      out.push(result(id, title, false, `error: ${e instanceof Error ? e.message : String(e)}`));
    }
  };
  /** @type {CollisionSweep | null} */
  let sweep = null;
  const collisions = () => (sweep ??= new CollisionSweep(root)).run();

  run("A2-1", "Contract: 16 wheels and stores on the register; 8 drums, knobs, levers and the Magna Rota on the carriage", () => {
    /** @type {string[]} */
    const bad = [];
    const carriage = node(root, "pm.carriage");
    /** @param {THREE.Object3D} o */
    const onCarriage = (o) => {
      for (let p = /** @type {THREE.Object3D | null} */ (o); p; p = p.parent) if (p === carriage) return true;
      return false;
    };
    for (let k = 0; k < R; k++) {
      if (anchors(part(c, "pi.sum_wheel", k), "glyph_anchors").length !== 10) bad.push(`wheel ${k} glyphs`);
      if (anchors(part(c, "pi.carry_store", k), "pentagon_corners").length !== 5) bad.push(`store ${k} pentagon`);
      if (onCarriage(part(c, "pi.sum_wheel", k))) bad.push(`wheel ${k} is on the carriage`);
    }
    if (anchors(node(root, "pi.window"), "read_points").length !== R) bad.push("window read points");
    for (let j = 0; j < C; j++) {
      for (const b of ["pm.drum", "pm.setting_dial", "pm.setting_plate", "pm.setting_stop", "pm.lever", "pm.zweihorn_add", "pm.zweihorn_sub"]) {
        if (!onCarriage(part(c, b, j))) bad.push(`${b}.${j} not on the carriage`);
      }
      if (anchors(part(c, "pm.setting_plate", j), "glyph_anchors").length !== 10) bad.push(`plate ${j} glyphs`);
    }
    for (const n of ["pm.magna_rota", "pm.magna_pin", "pm.magna_plate", "pm.main_crank"]) if (!onCarriage(node(root, n))) bad.push(`${n} not on the carriage`);
    if (onCarriage(node(root, "frame.lead_screw"))) bad.push("lead screw on the carriage");
    if (anchors(node(root, "pm.magna_rota"), "black_glyphs").length !== 10) bad.push("ring black glyphs");
    if (anchors(node(root, "pm.magna_rota"), "red_glyphs").length !== 10) bad.push("ring red glyphs");
    if (anchors(node(root, "pm.magna_plate"), "stop_point").length !== 1) bad.push("stop point");
    return { passed: bad.length === 0, detail: bad.join("; ") || `${R} register digits, ${C} carriage digits, Magna Rota, crank and lead screw present with anchors` };
  });

  run("A2-2", "All 16 windows read 0–9; all 8 pointers aim at their digit (offsets 0 and 8)", () => {
    /** @type {string[]} */
    const bad = [];
    for (const offset of [0, c.m.maxOffset]) {
      for (let d = 0; d <= 9; d++) {
        state(c, { offset, input: d * 11_111_111 });
        c.m.digits.fill(d);
        pose(c);
        const r = readAll(c);
        if (r.some((x) => x !== d)) bad.push(`offset ${offset}, all ${d}: read ${showNum(r)}`);
        for (let j = 0; j < C; j++) {
          const p = pointerDigit(c, j);
          if (p !== d) bad.push(`offset ${offset}: pointer ${j} at ${p} for ${d}`);
        }
      }
    }
    return { passed: bad.length === 0, detail: bad.join("; ") || "16 windows × 10 digits and 8 pointers × 10 digits correct at offsets 0 and 8" };
  });

  run("A2-3", "Every offset 0–8: drum j under gear o+j, lever j at store o+j, nothing intersecting at rest", () => {
    /** @type {string[]} */
    const bad = [];
    state(c, {});
    /** @param {number} j */
    const ref = (j) => ({
      drum: worldX(part(c, "pm.drum_shaft", j)) - worldX(part(c, "pi.sum_wheel", j)),
      lever: worldX(part(c, "pm.lever", j)) - worldX(part(c, "pi.carry_store", j)),
    });
    const d0 = Array.from({ length: C }, (_, j) => ref(j));
    let worst = 0;
    for (let o = 0; o <= c.m.maxOffset; o++) {
      state(c, { offset: o, input: 12_345_678 });
      for (let j = 0; j < C; j++) {
        const gear = anchors(part(c, "pi.sum_wheel", o + j), "gear_center")[0].x * 1000;
        const drum = worldX(part(c, "pm.drum_shaft", j));
        const dDrum = Math.abs(drum - gear);
        const dLever = Math.abs(worldX(part(c, "pm.lever", j)) - worldX(part(c, "pi.carry_store", o + j)) - d0[j].lever);
        worst = Math.max(worst, dDrum, dLever);
        if (dDrum > ALIGN_MM) bad.push(`offset ${o}: drum ${j} ${fmt(dDrum)} mm off gear ${o + j}`);
        if (dLever > ALIGN_MM) bad.push(`offset ${o}: lever ${j} ${fmt(dLever)} mm off store ${o + j}`);
      }
      for (const h of collisions()) bad.push(`offset ${o}: ${h}`);
    }
    return { passed: bad.length === 0, detail: bad.join("; ") || `aligned within ${fmt(worst, 4)} mm at offsets 0–${c.m.maxOffset}; no intersections at rest` };
  });

  run("A2-4", "1709 × 365 with the Magna Rota reads 623785; the pin rests on the stop after each digit, and turned back clears the finger for 9 - m turns", () => {
    /** @type {string[]} */
    const bad = [];
    state(c, { input: 1709 });
    [5, 6, 3].forEach((d, o) => {
      c.m.setOffset(o);
      c.m.setPin(d);
      const n = c.m.runToStop();
      pose(c);
      const pin = node(root, "pm.magna_pin");
      const plate = node(root, "pm.magna_plate");
      const gap = minDistance(pin, plate);
      if (n !== d) bad.push(`digit ${d}: ${n} turns`);
      if (gap > CONTACT_PIN_MM || intersects(pin, plate)) bad.push(`digit ${d}: pin–stop ${fmt(gap)} mm`);
      if (c.m.turn(1)) bad.push(`digit ${d}: crank turned past the stop`);
      if (ringDigit(c, "black_glyphs") !== d) bad.push(`digit ${d}: ring shows ${ringDigit(c, "black_glyphs")}`);
    });
    c.m.setPin(null);
    c.m.setOffset(0);
    pose(c);
    const r = readAll(c);
    if (showNum(r) !== "0000000000623785") bad.push(`read ${showNum(r)}`);
    // Turned back, the pin meets the finger's far face: 9 - m whole turns are clear, and the
    // next would jam part-way, which is why the machine refuses it.
    const back = new Machine();
    back.setPin(3);
    const cb = { ...c, m: back };
    const pin = node(root, "pm.magna_pin");
    const plate = node(root, "pm.magna_plate");
    let turnsBack = 0;
    while (back.turn(-1)) {
      turnsBack++;
      pose(cb);
      if (intersects(pin, plate)) bad.push(`turned back ${turnsBack}: the pin is in the finger`);
    }
    let jam = false;
    for (let deg = 10; deg < 360 && !jam; deg += 10) {
      back.setTheta(0);
      /** @type {{ _theta: number }} */ (/** @type {unknown} */ (back))._theta = -deg; // the refused turn, followed by hand
      pose(cb);
      jam = intersects(pin, plate);
    }
    /** @type {{ _theta: number }} */ (/** @type {unknown} */ (back))._theta = 0;
    pose(c);
    if (turnsBack !== 6) bad.push(`pin 3: ${turnsBack} turns back (want 6)`);
    if (!jam) bad.push("pin 3: the refused turn back would not meet the finger");
    return { passed: bad.length === 0, detail: bad.join("; ") || `reads ${showNum(r)}; pin on the stop after 5, 6 and 3 turns; turned back, 6 clear turns from hole 3, the 7th meets the finger` };
  });

  run("A2-5", "623785 ÷ 1709: quotient 3, 6, 5 read on the Magna Rota, remainder 0", () => {
    state(c, { result: 623_785, input: 1709 });
    /** @type {number[]} */
    const q = [];
    for (let o = 2; o >= 0; o--) {
      c.m.setOffset(o);
      c.m.setPin(null);
      for (;;) {
        c.m.turn(-1);
        if (registerValue(c.m) < 0) {
          c.m.turn(1); // overdraft: add back once
          break;
        }
      }
      pose(c);
      q.push(ringDigit(c, "red_glyphs"));
    }
    c.m.setOffset(0);
    pose(c);
    const r = readAll(c);
    const ok = q.join("") === "365" && r.every((x) => x === 0);
    return { passed: ok, detail: `quotient digits on the ring ${q.join(", ")}; remainder ${showNum(r)}` };
  });

  run("A2-6", "Ripple 999999999 + 1: carry for digit 8 waits (no lever); after a shift and an idle turn reads 1000000000", () => {
    state(c, { result: 999_999_999, input: 1 });
    c.m.turn(1);
    pose(c);
    const r1 = readAll(c);
    const t1 = tilts(c);
    c.m.setNumber(0);
    c.m.setOffset(1);
    c.m.turn(1);
    c.m.setOffset(0);
    pose(c);
    const r2 = readAll(c);
    const t2 = tilts(c);
    const others = t1.filter((_, k) => k !== 8);
    const ok =
      showNum(r1) === "0000000000000000" && Math.abs(t1[8] - K.STORE_STEP) < ANGLE_TOL_DEG && others.every((x) => x < ANGLE_TOL_DEG) &&
      showNum(r2) === "0000001000000000" && t2.every((x) => x < ANGLE_TOL_DEG);
    return { passed: ok, detail: `turn 1: ${showNum(r1)}, store 8 tilt ${fmt(t1[8], 1)}°; after shift + idle turn: ${showNum(r2)}, max tilt ${fmt(Math.max(...t2), 1)}°` };
  });

  run("A2-7", "Historical 9999 + 1 reads 9900 (tens pentagon tilted), then 10000 after an idle turn", () => {
    state(c, { mode: "historical", result: 9999, input: 1 });
    c.m.turn(1);
    pose(c);
    const r1 = showNum(readAll(c)).slice(-5);
    const t1 = tilts(c);
    c.m.setNumber(0);
    c.m.turn(1);
    pose(c);
    const r2 = showNum(readAll(c)).slice(-5);
    const t2 = tilts(c);
    const ok = r1 === "09900" && Math.abs(t1[1] - K.STORE_STEP) < ANGLE_TOL_DEG && r2 === "10000" && t2.every((x) => x < ANGLE_TOL_DEG);
    return { passed: ok, detail: `turn 1: ${r1} (tens tilt ${fmt(t1[1], 1)}°); idle turn: ${r2}` };
  });

  run("A2-11", "A turn that would store a second carry above the carriage is refused; after a shift it completes", () => {
    // 999999999 + 1 leaves digit 8's carry waiting. Then digits 0-8 back to 9 (as after
    // ~10^9 more of additions): the next + 1 would wrap digit 8 again.
    state(c, { result: 999_999_999, input: 1 });
    c.m.turn(1);
    c.m.digits.fill(9, 0, 9);
    const block = c.m.startBlock(1);
    const turned = c.m.turn(1);
    pose(c);
    const r1 = showNum(readAll(c));
    const t1 = tilts(c)[8];
    c.m.setNumber(0);
    c.m.setOffset(1);
    c.m.turn(1);
    c.m.setOffset(0);
    c.m.setNumber(1);
    const turned2 = c.m.turn(1);
    pose(c);
    const r2 = showNum(readAll(c));
    const t2 = tilts(c);
    const ok =
      JSON.stringify(block) === JSON.stringify({ storeFull: 8 }) && !turned && c.m.theta === 0 &&
      r1 === "0000000999999999" && Math.abs(t1 - K.STORE_STEP) < ANGLE_TOL_DEG &&
      turned2 && r2 === "0000001000000000" && Math.abs(t2[8] - K.STORE_STEP) < ANGLE_TOL_DEG && registerValue(c.m) === 2_000_000_000;
    return {
      passed: ok,
      detail: `refused (${JSON.stringify(block)}, turned ${turned}): reads ${r1}, store 8 tilt ${fmt(t1, 1)}°; after shift + idle turn + 1: reads ${r2}, store 8 tilt ${fmt(t2[8], 1)}°, value ${registerValue(c.m)}`,
    };
  });

  run("A2-12", "Casing: case, base and cover plates are static, hold all the woodwork; all 16 windows read through the cover", () => {
    /** @type {string[]} */
    const bad = [];
    const parts = ["frame.case", "frame.base", "frame.register_cover", "pm.carriage_cover"].map((n) => node(root, n));
    // With the casing hidden only the mechanism remains: no woodwork (oak) left in the rest of the model.
    const casingSet = new Set(parts);
    root.traverse((o) => {
      const mesh = /** @type {THREE.Mesh} */ (o);
      if (!mesh.isMesh) return;
      let inCasing = false;
      for (let p = /** @type {THREE.Object3D | null} */ (mesh); p; p = p.parent) if (casingSet.has(p)) inCasing = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (!inCasing && mats.some((m) => m.name === "oak")) bad.push(`oak outside the casing: ${mesh.name}`);
    });
    parts.forEach((p) => (/** @type {{ motion?: string }} */ (p.userData)).motion !== "static" && bad.push(`${p.name} not static`));
    const carriage = node(root, "pm.carriage");
    let onCarriage = false;
    for (let p = /** @type {THREE.Object3D | null} */ (node(root, "pm.carriage_cover")); p; p = p.parent) if (p === carriage) onCarriage = true;
    if (!onCarriage) bad.push("carriage cover does not move with the carriage");
    const openings = anchors(node(root, "frame.register_cover"), "opening_centres");
    if (openings.length !== R) bad.push(`${openings.length} cover openings`);
    // Look down through each cover opening from above: the first part hit must be the
    // result wheel, showing a digit (no casing part in the way), at both carriage ends.
    const blockers = [...parts, node(root, "pi.window"), node(root, "frame.static")];
    for (const offset of [0, c.m.maxOffset]) {
      state(c, { offset, result: 0 });
      c.m.digits.fill(7);
      pose(c);
      for (let k = 0; k < R; k++) {
        const wheel = part(c, "pi.sum_wheel", k);
        const glyphs = anchors(wheel, "glyph_anchors");
        for (const [dx, dz] of [[0, 0], [-0.003, -0.0015], [0.003, 0.0015]]) {
          const o = openings[k].clone().add(new THREE.Vector3(dx, 0.01, dz));
          const [first] = rayHits([...blockers, wheel], o, new THREE.Vector3(0, -1, 0));
          /** @type {THREE.Object3D | null} */
          let owner = first?.mesh ?? null;
          while (owner && owner !== wheel) owner = owner.parent;
          if (!owner) bad.push(`offset ${offset}: window ${k} blocked by ${first?.mesh.name ?? "nothing"}`);
          else if (first.material === "ink_black" && nearestIndex(glyphs, first.point) !== 7) bad.push(`offset ${offset}: window ${k} shows the wrong digit`);
        }
      }
    }
    return { passed: bad.length === 0, detail: bad.join("; ") || `4 casing parts (no oak elsewhere); 16 windows clear through the cover at offsets 0 and ${c.m.maxOffset}` };
  });

  run("A2-13", "Both cranks can be turned by hand: knobs clear the case's front wall, floor and the table", () => {
    // A knob is the crank's wood_dark mesh. Over a full turn, at both carriage ends, its
    // lowest point must leave room for a hand above the front wall top and the case floor
    // (main crank), and stay above the table the case stands on (end crank).
    /** @type {string[]} */
    const bad = [];
    const caseNode = node(root, "frame.case");
    /** @param {string} key */
    const up = (key) => anchors(caseNode, key)[0].y * 1000;
    const wallTop = up("front_wall_top");
    const floorTop = up("floor_top");
    const table = up("underside");
    /** @param {THREE.Object3D} part */
    const lowest = (part) => {
      let top = part;
      while (top.parent) top = top.parent;
      top.updateMatrixWorld(true);
      let min = Infinity;
      const v = new THREE.Vector3();
      part.traverse((o) => {
        const mesh = /** @type {THREE.Mesh} */ (o);
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        if (!mats.some((m) => m.name === "wood_dark")) return;
        const pos = mesh.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) min = Math.min(min, v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).y * 1000);
      });
      return min;
    };
    let mainLow = Infinity;
    let endLow = Infinity;
    for (const offset of [0, c.m.maxOffset]) {
      for (let a = 0; a < 360; a += 10) {
        state(c, { offset, theta: a });
        mainLow = Math.min(mainLow, lowest(node(root, "pm.main_crank")));
      }
    }
    for (let k = 0; k <= 32; k++) {
      state(c, {});
      c.m.setCarriagePos(k / 32);
      pose(c);
      endLow = Math.min(endLow, lowest(node(root, "frame.lead_screw")));
    }
    if (mainLow - wallTop < HAND_MM) bad.push(`main crank knob ${fmt(mainLow - wallTop, 1)} mm above the front wall`);
    if (mainLow - floorTop < HAND_MM) bad.push(`main crank knob ${fmt(mainLow - floorTop, 1)} mm above the case floor`);
    if (endLow - table < CLEARANCE_TABLE_MM) bad.push(`end crank knob ${fmt(endLow - table, 1)} mm above the table`);
    return {
      passed: bad.length === 0,
      detail: bad.join("; ") || `main crank knob clears the front wall by ${fmt(mainLow - wallTop, 1)} mm and the floor by ${fmt(mainLow - floorTop, 1)} mm; end crank knob ${fmt(endLow - table, 1)} mm above the table`,
    };
  });

  run("A2-8", `Budget: ≤ ${MAX_TRIANGLES / 1000}k triangles, ≤ 15 MB`, () => {
    let tris = 0;
    root.traverse((o) => {
      const g = (/** @type {THREE.Mesh} */ (o)).isMesh ? (/** @type {THREE.Mesh} */ (o)).geometry : null;
      if (g) tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    });
    const bytesOk = opts.bytes === undefined || opts.bytes <= MAX_BYTES;
    const size = opts.bytes === undefined ? "size not measured here" : `${(opts.bytes / 1024 / 1024).toFixed(2)} MB`;
    return { passed: tris <= MAX_TRIANGLES && bytesOk, detail: `${Math.round(tris)} triangles, ${size}` };
  });

  run("A2-9", "No intersections across turns, carriage shifts and a multiplier run (sampled)", () => {
    /** @type {string[]} */
    const bad = [];
    let poses = 0;
    const step = opts.sweepStepDeg ?? 15;
    const shiftStep = opts.sweepShiftStep ?? 0.125;
    for (const sc of M2_SCENARIOS) {
      walkM2(sc, step, shiftStep, (m, label) => {
        c.m = m;
        pose(c);
        poses++;
        for (const h of collisions()) bad.push(`${h} @ ${label}`);
      });
    }
    c.m = new Machine(R, C);
    return { passed: bad.length === 0, detail: bad.join("; ") || `${poses} poses clear (every ${step}°, every ${shiftStep} place)` };
  });

  c.m.reset();
  pose(c);
  return out.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}
