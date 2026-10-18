// Acceptance spec for M3 (plan §10.1, A3-1..A3-6; A3-7 is the page's ?selftest running
// these, A3-8 the M0-M2 specs in the same `pnpm test`). The lessons, the presentation and
// the exploded view are the same code the teaching page runs.

import * as THREE from "three";
import { applyM2Pose, m2NodeNames } from "../scene/m2Pose.js";
import { Rig } from "../scene/rig.js";
import { Exploder, findNodes, isShown, makeViews } from "../scene/teachScene.js";
import { Machine } from "../sim/machine.js";
import { UI } from "../teach/i18n.js";
/** @import { Text } from "../teach/i18n.js" */
import { LESSONS } from "../teach/lessons.js";
import { partInfo } from "../teach/partInfo.js";
import { applyIntentNow, intentAt } from "../teach/partActions.js";
import { anchors, rayHits } from "./harness.js";
import { gltfName } from "../scene/rig.js";
import { matches, presentation, replayTo, runLesson } from "../teach/player.js";
/** @import { ViewName } from "../teach/player.js" */
import { result } from "./harness.js";
/** @import { CheckResult } from "./harness.js" */

/** Exploded offsets and the rest pose must agree to this (m). */
export const EXPLODE_TOL_M = 1e-6;
/** Exploding must not rotate anything; recomputing a rotation differs by float noise (~1e-8 rad). */
export const EXPLODE_TOL_RAD = 1e-6;

const CASING = ["frame.case", "frame.base", "frame.register_cover", "pm.carriage_cover"];
/** Parts that can be seen with the case on (through the windows, on top, at the front). */
const EXTERIOR = [
  "pi.window", "pi.sum_wheel.*", "pm.setting_dial.*", "pm.setting_plate.*", "pm.magna_rota", "pm.magna_pin",
  "pm.magna_plate", "pm.main_crank", "pm.carriage", "pm.carriage_panel", "frame.lead_screw", ...CASING,
];
/** @type {ViewName[]} */
const VIEWS = ["overview", "register", "knobs", "front", "drum", "carry"];
/** Part groups the exploded view must move. */
const EXPLODED_GROUPS = ["frame.case", "frame.register_cover", "pm.carriage", "pm.magna_rota", "pi.carry_store.*", "pm.setting_dial.*"];

/** @param {Text} x */
const filled = (x) => x.en.trim() !== "" && x.de.trim() !== "";

/**
 * @param {THREE.Object3D} root
 * @returns {CheckResult[]}
 */
export function runM3Checks(root) {
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
      out.push(result(id, title, r.passed, p.length > 6 ? `${p.slice(0, 6).join("; ")}; … (${p.length} issues)` : r.detail));
    } catch (e) {
      out.push(result(id, title, false, `error: ${e instanceof Error ? e.message : String(e)}`));
    }
  };
  const runs = LESSONS.map((l) => ({ l, r: runLesson(l) }));

  run("A3-1", "Every UI and lesson text, and every part name, exists in English and German", () => {
    /** @type {string[]} */
    const bad = [];
    let n = 0;
    for (const [k, v] of Object.entries(UI)) {
      n++;
      if (!filled(v)) bad.push(`UI.${k}`);
    }
    for (const l of LESSONS) {
      for (const [what, x] of /** @type {const} */ ([["title", l.title], ["summary", l.summary]])) {
        n++;
        if (!filled(x)) bad.push(`${l.id} ${what}`);
      }
      l.steps.forEach((s, i) => {
        n++;
        if (!filled(s.text)) bad.push(`${l.id} step ${i + 1}`);
        for (const c of s.callouts ?? []) {
          n++;
          if (!filled(c.text)) bad.push(`${l.id} step ${i + 1} callout ${c.node}`);
        }
      });
    }
    let parts = 0;
    root.traverse((o) => {
      const ud = /** @type {{ motion?: string; label_en?: string; label_de?: string }} */ (o.userData);
      if (ud.motion === undefined) return;
      parts++;
      if (!ud.label_en?.trim() || !ud.label_de?.trim()) bad.push(`part ${o.name} label`);
    });
    return { passed: bad.length === 0, detail: bad.join("; ") || `${n} texts and ${parts} part names in EN and DE` };
  });

  run("A3-2", "Every lesson runs start to finish with a scripted learner and ends in its stated state", () => {
    const bad = runs.flatMap(({ l, r }) => r.problems.filter((p) => !p.includes("task")).map((p) => `${l.id}: ${p}`));
    return { passed: bad.length === 0, detail: bad.join("; ") || `${LESSONS.length} lessons, ${LESSONS.reduce((a, l) => a + l.steps.length, 0)} steps` };
  });

  run("A3-3", "Every highlighted or labelled part and every camera view a lesson names exists", () => {
    /** @type {string[]} */
    const bad = [];
    const cam = new THREE.PerspectiveCamera(35, 1.5, 0.002, 10);
    const views = makeViews(cam, root);
    for (const v of VIEWS) {
      const [p, t] = views[v]();
      if (![p.x, p.y, p.z, t.x, t.y, t.z].every(Number.isFinite)) bad.push(`view ${v}`);
    }
    let refs = 0;
    for (const l of LESSONS) {
      l.steps.forEach((s, i) => {
        if (s.view && !VIEWS.includes(s.view)) bad.push(`${l.id} step ${i + 1}: view ${s.view}`);
        for (const n of [...(s.highlight ?? []), ...(s.callouts ?? []).map((c) => c.node)]) {
          refs++;
          if (findNodes(root, n).length === 0) bad.push(`${l.id} step ${i + 1}: ${n}`);
        }
      });
    }
    return { passed: bad.length === 0, detail: bad.join("; ") || `${refs} part references and ${VIEWS.length} views resolve` };
  });

  run("A3-4", "A learner task unlocks Next only when its check passes (a mistake keeps it locked)", () => {
    const tasks = LESSONS.reduce((a, l) => a + l.steps.filter((s) => s.task).length, 0);
    const bad = runs.flatMap(({ l, r }) => r.problems.filter((p) => p.includes("task")).map((p) => `${l.id}: ${p}`));
    return { passed: bad.length === 0 && tasks > 0, detail: bad.join("; ") || `${tasks} tasks reject their mistake and accept their solution` };
  });

  run("A3-5", "Exploded view: groups move by their offsets, and factor 0 restores the exact pose", () => {
    /** @type {string[]} */
    const bad = [];
    /** @type {Rig<string>} */
    const rig = new Rig(root, m2NodeNames(16, 8));
    const ex = new Exploder(root);
    for (const g of EXPLODED_GROUPS) {
      const nodes = findNodes(root, g);
      if (nodes.length === 0 || !nodes.every((n) => ex.parts.some((p) => p.node === n))) bad.push(`no offset for ${g}`);
    }
    /** @type {THREE.Object3D[]} */
    const all = [];
    root.traverse((o) => all.push(o));
    const m = new Machine();
    /** @type {[string, () => void][]} */
    const states = [
      ["at rest", () => m.setNumber(1709)],
      ["mid-turn at offset 3", () => {
        m.setNumber(1709);
        m.setOffset(3);
        m.setTheta(150);
      }],
    ];
    for (const [label, setup] of states) {
      m.reset();
      setup();
      ex.factor = 0;
      ex.pose(() => applyM2Pose(rig, root, m));
      const base = all.map((o) => ({ p: o.position.clone(), q: o.quaternion.clone() }));
      ex.factor = 1;
      ex.pose(() => applyM2Pose(rig, root, m));
      all.forEach((o, i) => {
        const off = ex.parts.find((p) => p.node === o)?.offset ?? new THREE.Vector3();
        if (o.position.distanceTo(base[i].p.clone().add(off)) > EXPLODE_TOL_M) bad.push(`${label}: ${o.name} not at pose + offset`);
        if (o.quaternion.angleTo(base[i].q) > EXPLODE_TOL_RAD) bad.push(`${label}: ${o.name} rotated by exploding`);
      });
      ex.factor = 0;
      ex.pose(() => applyM2Pose(rig, root, m));
      all.forEach((o, i) => {
        if (o.position.distanceTo(base[i].p) > EXPLODE_TOL_M) bad.push(`${label}: ${o.name} not back at its pose`);
      });
    }
    m.reset();
    ex.factor = 0;
    ex.pose(() => applyM2Pose(rig, root, m));
    return { passed: bad.length === 0, detail: bad.join("; ") || `${ex.parts.length} parts in ${EXPLODED_GROUPS.length}+ groups; exact round trip at rest and mid-turn` };
  });

  run("A3-6", "In every lesson step the parts it shows are visible: not hidden, and not shut in the case", () => {
    /** @type {string[]} */
    const bad = [];
    /**
     * @param {string[]} names
     * @param {boolean} visible
     */
    const set = (names, visible) => names.forEach((n) => findNodes(root, n).forEach((o) => (o.visible = visible)));
    let checked = 0;
    // Each step as the learner sees it once its actions and task are done (the pin, for
    // example, only shows once it is in).
    /** @type {Rig<string>} */
    const rig = new Rig(root, m2NodeNames(16, 8));
    const m = new Machine();
    for (const l of LESSONS) {
      l.steps.forEach((_, i) => {
        replayTo(l, i + 1, m);
        applyM2Pose(rig, root, m);
        const p = presentation(l, i);
        set(CASING, p.casing);
        set(["pm.carriage_panel"], !p.cutaway);
        for (const n of [...p.highlight, ...p.callouts.map((c) => c.node)]) {
          checked++;
          for (const o of findNodes(root, n)) {
            if (!isShown(o)) bad.push(`${l.id} step ${i + 1}: ${n} hidden`);
          }
          const inside = !EXTERIOR.some((e) => matches(e, n) || (e.endsWith(".*") && n === e));
          if (inside && p.casing && p.explode < 0.5) bad.push(`${l.id} step ${i + 1}: ${n} is inside the closed case`);
        }
      });
    }
    set([...CASING, "pm.carriage_panel"], true);
    m.reset();
    applyM2Pose(rig, root, m);
    return { passed: bad.length === 0, detail: bad.join("; ") || `${checked} shown parts visible in their steps` };
  });

  run("A3-9", "No lesson step turns the crank, shifts the carriage or sets a task while the machine is taken apart", () => {
    /** @type {string[]} */
    const bad = [];
    /** @param {object} a */
    const moves = (a) => ["theta", "turn", "shift", "toStop", "divideDigit"].some((k) => k in a);
    for (const l of LESSONS) {
      l.steps.forEach((s, i) => {
        if (presentation(l, i).explode === 0) return;
        if ((s.do ?? []).some(moves)) bad.push(`${l.id} step ${i + 1}: moves the machine while taken apart`);
        if (s.task) bad.push(`${l.id} step ${i + 1}: task while taken apart`);
      });
    }
    return { passed: bad.length === 0, detail: bad.join("; ") || "steps that take the machine apart only show it" };
  });

  run("A3-11", "Clicking a part does what its panel control does, and every clickable part can be reached", () => {
    /** @type {string[]} */
    const bad = [];
    /** @type {Rig<string>} */
    const rig = new Rig(root, m2NodeNames(16, 8));
    const m = new Machine();
    const pose = () => applyM2Pose(rig, root, m);
    const all = [root];
    // Click = the first visible part on a ray, as on the page.
    /**
     * @param {THREE.Vector3} from
     * @param {THREE.Vector3} to
     */
    const click = (from, to) => {
      pose();
      const hit = rayHits(all, from, to.clone().sub(from)).find((h) => isShown(h.mesh));
      return hit ? intentAt(hit.mesh, hit.point, m) : null;
    };
    /** @param {THREE.Vector3} p */
    const down = (p) => click(p.clone().add(new THREE.Vector3(0, 0.3, 0)), p);
    /** @param {THREE.Vector3} p */
    const front = (p) => click(p.clone().add(new THREE.Vector3(0, 0, 0.4)), p);
    /**
     * @param {string} what
     * @param {ReturnType<typeof click>} intent
     * @param {() => boolean} ok
     */
    const expectThat = (what, intent, ok) => {
      if (!intent) return bad.push(`${what}: nothing clickable`);
      applyIntentNow(intent, m);
      if (!ok()) bad.push(`${what}: ${JSON.stringify(intent)} did not do it`);
    };
    m.reset();
    pose();
    // a digit on dial 2 sets knob 2 to it; the knob itself steps it
    const glyph7 = anchors(findNodes(root, "pm.setting_plate.2")[0], "glyph_anchors")[7];
    expectThat("dial 2, digit 7", down(glyph7), () => m.settings[2] === 7);
    const knob = new THREE.Vector3().setFromMatrixPosition(findNodes(root, "pm.setting_dial.2")[0].matrixWorld);
    knob.y = glyph7.y + 0.006;
    expectThat("knob 2", down(knob), () => m.settings[2] === 8);
    // a hole of the Magna Rota (here by its black digit) sets the pin
    pose();
    const black4 = anchors(findNodes(root, "pm.magna_rota")[0], "black_glyphs")[4];
    expectThat("Magna Rota, hole 4", front(black4), () => m.pin === 4);
    expectThat("the pin", intentAt(findNodes(root, "pm.magna_pin")[0], new THREE.Vector3(), m), () => m.pin === null);
    // the main crank turns once
    pose();
    const crank = findNodes(root, "pm.main_crank")[0];
    const arm = new THREE.Vector3().setFromMatrixPosition(crank.matrixWorld).add(new THREE.Vector3(0, -0.03, 0));
    const turns = m.turns;
    expectThat("main crank", front(arm), () => m.turns === turns + 1);
    // a result wheel, seen through its window, brings the carriage
    pose();
    const read5 = anchors(findNodes(root, "pi.window")[0], "read_points")[5];
    expectThat("result wheel 5", down(read5), () => m.offset === 5);
    // the end crank shifts the carriage left
    pose();
    // aim at the end crank's knob (its dark wood), outside the case's left wall
    const knobBox = new THREE.Box3();
    findNodes(root, "frame.lead_screw")[0].traverse((o) => {
      const mesh = /** @type {THREE.Mesh} */ (o);
      const mats = mesh.isMesh ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
      if (mats.some((mt) => mt.name === "wood_dark")) knobBox.expandByObject(mesh);
    });
    expectThat("end crank", down(knobBox.getCenter(new THREE.Vector3())), () => m.offset === 6);
    m.reset();
    pose();
    return { passed: bad.length === 0, detail: bad.join("; ") || "dial digit, knob, Magna Rota hole, pin, main crank, result wheel and end crank all act like their controls" };
  });

  run("A3-10", "Labels name a part's place in words and show its current value apart from the name", () => {
    /** @type {string[]} */
    const bad = [];
    const m = new Machine();
    m.setResult(6_237_859_041);
    m.setNumber(17_092_583);
    m.setOffset(2);
    m.setPin(4);
    m.runToStop();
    // Only the value may carry a number: a name may hold digits only in a power of ten (10⁴).
    /** @param {string} n */
    const plainName = (n) => !/\d/.test(n.replace(/10[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, ""));
    let n = 0;
    /**
     * @param {string} node
     * @param {string | null} value
     */
    const expectPart = (node, value) => {
      for (const lang of /** @type {const} */ (["en", "de"])) {
        const info = partInfo(gltfName(node), m, lang);
        n++;
        if (!info) bad.push(`${node}: no label`);
        else {
          if (!plainName(info.name)) bad.push(`${node} (${lang}): number in the name "${info.name}"`);
          if (value !== null && info.value !== value) bad.push(`${node} (${lang}): value ${info.value}, expected ${value}`);
        }
      }
    };
    const shown = m.shownDigits();
    for (let k = 0; k < 16; k++) expectPart(`pi.sum_wheel.${k}`, String(shown[k]));
    for (let j = 0; j < 8; j++) {
      expectPart(`pm.setting_dial.${j}`, String(m.settings[j]));
      expectPart(`pm.setting_plate.${j}`, String(m.settings[j]));
      expectPart(`pm.drum.${j}`, String(m.settings[j]));
    }
    for (let k = 0; k < 16; k++) expectPart(`pi.carry_store.${k}`, null);
    expectPart("pm.magna_rota", null);
    expectPart("pm.carriage", null);
    if (!partInfo(gltfName("pm.magna_rota"), m, "en")?.value?.startsWith("4")) bad.push("Magna Rota value is not its 4 turns");
    if (!partInfo(gltfName("pm.carriage"), m, "en")?.value?.startsWith("2")) bad.push("carriage value is not its shift of 2");
    if (!partInfo(gltfName("pm.magna_pin"), m, "en")?.value?.includes("4")) bad.push("pin value is not hole 4");
    return { passed: bad.length === 0, detail: bad.join("; ") || `${n} labels: names in words, values match the machine` };
  });

  return out.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}
