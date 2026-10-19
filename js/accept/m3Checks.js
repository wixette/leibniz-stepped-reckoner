// Acceptance spec for M3 (plan §10.1, A3-1..A3-6; A3-7 is the page's ?selftest running
// these, A3-8 the M0-M2 specs in the same `pnpm test`). The lessons, the presentation and
// the exploded view are the same code the teaching page runs.

import * as THREE from "three";
import { applyM2Pose, m2NodeNames } from "../scene/m2Pose.js";
import { Rig } from "../scene/rig.js";
import { centreOnFreeArea, frame } from "../scene/framing.js";
import { Exploder, Highlighter, findNodes, isShown, viewSubjects } from "../scene/teachScene.js";
import { Machine } from "../sim/machine.js";
import { MESSAGES } from "../l10n/all.js";
import { LOCALES } from "../l10n/l10n.js";
import { LESSONS } from "../teach/lessons.js";
import { PART_KEYS, partInfo, partName } from "../teach/partInfo.js";
import { TUTORIAL } from "../teach/tutorial.js";
import { applyIntentNow, CrankDrag, intentAt } from "../teach/partActions.js";
import { anchors, rayHits } from "./harness.js";
import { gltfName } from "../scene/rig.js";
import { INSIDE_VIEWS, matches, presentation, replayTo, runLesson, VIEWS } from "../teach/player.js";
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
/** Part groups the exploded view must move. */
const EXPLODED_GROUPS = ["frame.case", "frame.register_cover", "pm.carriage", "pm.magna_rota", "pi.carry_store.*", "pm.setting_dial.*"];

/** The tutorial and the lessons: everything the step player runs. */
const COURSES = [TUTORIAL, ...LESSONS];

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
  const runs = COURSES.map((l) => ({ l, r: runLesson(l) }));

  run("A3-1", "Every text of the tutorial and the lessons, and every part's name, exists in every language", () => {
    /** @type {string[]} */
    const bad = [];
    /** @type {Set<string>} */
    const keys = new Set([...PART_KEYS, "place.0", "place.1", "place.2", "place.3", "place.pow"]);
    for (const l of COURSES) {
      keys.add(l.title);
      keys.add(l.summary);
      for (const s of l.steps) {
        keys.add(s.text);
        if (s.chapter) keys.add(s.chapter);
        if (s.image) keys.add(s.image.credit);
        for (const c of s.callouts ?? []) keys.add(c.text);
      }
    }
    for (const k of keys) {
      for (const loc of LOCALES) if (!MESSAGES[loc]?.[k]?.trim()) bad.push(`${loc}: ${k}`);
    }
    // Every part the model names, by its live description or its name.
    const m = new Machine();
    let parts = 0;
    root.traverse((o) => {
      const ud = /** @type {{ motion?: string; label_en?: string }} */ (o.userData);
      if (ud.motion === undefined && ud.label_en === undefined) return;
      parts++;
      if (!partInfo(o.name, m) && !partName(o.name)) bad.push(`part ${o.name} has no name`);
    });
    return { passed: bad.length === 0, detail: bad.join("; ") || `${keys.size} texts in ${LOCALES.length} languages; ${parts} parts named` };
  });

  run("A3-2", "Every lesson runs start to finish with a scripted learner and ends in its stated state", () => {
    const bad = runs.flatMap(({ l, r }) => r.problems.filter((p) => !p.includes("task")).map((p) => `${l.id}: ${p}`));
    return { passed: bad.length === 0, detail: bad.join("; ") || `${COURSES.length} courses (tutorial and lessons), ${COURSES.reduce((a, l) => a + l.steps.length, 0)} steps` };
  });

  run("A3-3", "Every highlighted or labelled part and every camera view a lesson names exists", () => {
    /** @type {string[]} */
    const bad = [];
    const cam = new THREE.PerspectiveCamera(35, 1.5, 0.002, 10);
    const views = viewSubjects(root);
    const insets = { top: 80, right: 12, bottom: 56, left: 12 };
    for (const v of VIEWS) {
      const pts = views[v].points();
      const { position: p, target: t } = frame(cam, pts, views[v].dir, 900, 600, insets);
      if (pts.some((q) => !Number.isFinite(q.x)) || ![p.x, p.y, p.z, t.x, t.y, t.z].every(Number.isFinite)) bad.push(`view ${v}`);
    }
    let refs = 0;
    for (const l of COURSES) {
      l.steps.forEach((s, i) => {
        if (s.view && !VIEWS.includes(s.view)) bad.push(`${l.id} step ${i + 1}: view ${s.view}`);
        for (const n of [...(s.highlight ?? []), ...(s.context ?? []), ...(s.callouts ?? []).map((c) => c.node)]) {
          refs++;
          if (findNodes(root, n).length === 0) bad.push(`${l.id} step ${i + 1}: ${n}`);
        }
      });
    }
    return { passed: bad.length === 0, detail: bad.join("; ") || `${refs} part references and ${VIEWS.length} views resolve` };
  });

  run("A3-4", "A learner task unlocks Next only when its check passes (a mistake keeps it locked)", () => {
    const tasks = COURSES.reduce((a, l) => a + l.steps.filter((s) => s.task).length, 0);
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
    for (const l of COURSES) {
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
    for (const l of COURSES) {
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
     * @param {1 | -1} [dir] -1: a Shift-click
     */
    const click = (from, to, dir = 1) => {
      pose();
      const hit = rayHits(all, from, to.clone().sub(from)).find((h) => isShown(h.mesh));
      return hit ? intentAt(hit.mesh, hit.point, m, dir) : null;
    };
    /**
     * @param {THREE.Vector3} p
     * @param {1 | -1} [dir]
     */
    const down = (p, dir = 1) => click(p.clone().add(new THREE.Vector3(0, 0.3, 0)), p, dir);
    /**
     * @param {THREE.Vector3} p
     * @param {1 | -1} [dir]
     */
    const front = (p, dir = 1) => click(p.clone().add(new THREE.Vector3(0, 0, 0.4)), p, dir);
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
    expectThat("main crank, Shift-click", front(arm, -1), () => m.turns === turns);
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
    expectThat("end crank, Shift-click", down(knobBox.getCenter(new THREE.Vector3()), -1), () => m.offset === 5);
    m.reset();
    pose();
    return { passed: bad.length === 0, detail: bad.join("; ") || "dial digit, knob, Magna Rota hole, pin, main crank (and Shift-click), result wheel and end crank (and Shift-click) all act like their controls" };
  });

  run("A3-12", "Fading keeps what a step or an inside view asks you to see: its parts, their digits and its context", () => {
    /** @type {string[]} */
    const bad = [];
    const hl = new Highlighter(root);
    /**
     * Whether fading fades any mesh of the part.
     * @param {string} n
     */
    const fadedPart = (n) => findNodes(root, n).some((o) => {
      let f = false;
      o.traverse((x) => (f ||= hl.faded.has(x)));
      return f;
    });
    /**
     * The parts that must stay: the highlighted ones, the digits they show, the context.
     * @param {string[]} parts
     * @param {string[]} context
     */
    const mustStay = (parts, context) => [
      ...parts,
      ...context,
      ...(parts.includes("pi.window") ? ["pi.sum_wheel.*"] : []),
      ...parts.flatMap((n) => (n.startsWith("pm.setting_dial.") ? [n.replace("setting_dial", "setting_plate")] : [])),
      ...(parts.includes("pm.magna_rota") ? ["pm.magna_plate"] : []),
    ];
    let checked = 0;
    /**
     * @param {string} what
     * @param {string[]} parts
     * @param {string[]} context
     */
    const check = (what, parts, context) => {
      if (parts.length === 0) return;
      checked++;
      hl.set(parts, true, context);
      if (hl.faded.size === 0) bad.push(`${what}: nothing faded`);
      for (const n of mustStay(parts, context)) if (fadedPart(n)) bad.push(`${what}: ${n} faded`);
    };
    for (const l of COURSES) l.steps.forEach((_, i) => {
      const p = presentation(l, i);
      check(`${l.id} step ${i + 1}`, p.highlight, p.context);
    });
    const views = viewSubjects(root);
    for (const v of VIEWS) check(`view ${v}`, views[v].inside ?? [], []);
    hl.set([], false);
    return { passed: bad.length === 0, detail: bad.join("; ") || `${checked} steps and inside views keep their parts and digits when the rest fades` };
  });

  run("A3-13", "The view clears the way: a step that shows a part inside the case uses an inside view, and inside views have a subject", () => {
    /** @type {string[]} */
    const bad = [];
    const views = viewSubjects(root);
    for (const v of VIEWS) if (!!views[v].inside !== INSIDE_VIEWS.has(v)) bad.push(`view ${v}: inside parts and INSIDE_VIEWS disagree`);
    let interior = 0;
    for (const l of COURSES) {
      l.steps.forEach((_, i) => {
        const p = presentation(l, i);
        const inside = INSIDE_VIEWS.has(p.view);
        if (p.casing === inside || p.cutaway !== inside || p.fade !== inside) bad.push(`${l.id} step ${i + 1}: case, front or fading does not follow the ${p.view} view`);
        if (inside && p.highlight.length === 0) bad.push(`${l.id} step ${i + 1}: the ${p.view} view with nothing to show`);
        const hidden = p.highlight.filter((n) => !EXTERIOR.some((e) => matches(e, n) || (e.endsWith(".*") && n === e)));
        if (hidden.length > 0) interior++;
        if (hidden.length > 0 && !inside && p.explode < 0.5) bad.push(`${l.id} step ${i + 1}: ${hidden.join(", ")} inside the case, seen from the ${p.view} view`);
      });
    }
    return { passed: bad.length === 0, detail: bad.join("; ") || `${interior} steps show parts inside the case, all from an inside view` };
  });

  run("A3-14", "Every view fits its parts into the free area: about 90% of the limiting side, centred, measured on the parts themselves", () => {
    /** @type {string[]} */
    const bad = [];
    const views = viewSubjects(root);
    const ex = new Exploder(root);
    const insets = { top: 80, right: 8, bottom: 8, left: 8 };
    const v = new THREE.Vector3();
    let worst = 1;
    for (const [w, h] of [[900, 600], [700, 900]]) {
      for (const name of VIEWS) {
        ex.apply(name === "apart" ? 1 : 0);
        const cam = new THREE.PerspectiveCamera(35, w / h, 0.002, 10);
        centreOnFreeArea(cam, w, h, insets);
        const f = frame(cam, views[name].points(), views[name].dir, w, h, insets, 0.9);
        cam.position.copy(f.position);
        cam.lookAt(f.target);
        cam.updateMatrixWorld(true);
        cam.updateProjectionMatrix();
        let l = Infinity;
        let r = -Infinity;
        let t = Infinity;
        let b = -Infinity;
        for (const o of views[name].objects()) {
          o.updateWorldMatrix(true, true);
          o.traverse((x) => {
            const m = /** @type {THREE.Mesh} */ (x);
            if (!m.isMesh) return;
            const pos = m.geometry.attributes.position;
            for (let i = 0; i < pos.count; i++) {
              v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).project(cam);
              l = Math.min(l, ((v.x + 1) / 2) * w);
              r = Math.max(r, ((v.x + 1) / 2) * w);
              t = Math.min(t, ((1 - v.y) / 2) * h);
              b = Math.max(b, ((1 - v.y) / 2) * h);
            }
          });
        }
        const fw = w - insets.left - insets.right;
        const fh = h - insets.top - insets.bottom;
        const fill = Math.max((r - l) / fw, (b - t) / fh);
        const off = Math.max(Math.abs((l + r) / 2 - (insets.left + fw / 2)) / fw, Math.abs((t + b) / 2 - (insets.top + fh / 2)) / fh);
        worst = Math.min(worst, fill);
        if (fill < 0.8 || fill > 0.905) bad.push(`${name} at ${w}×${h}: fills ${fill.toFixed(2)}`);
        if (off > 0.03) bad.push(`${name} at ${w}×${h}: ${(off * 100).toFixed(1)}% off-centre`);
      }
    }
    ex.apply(0);
    return { passed: bad.length === 0, detail: bad.join("; ") || `${VIEWS.length} views at two canvas shapes; the least filled fills ${worst.toFixed(2)}` };
  });

  run("A3-15", "Dragging a crank round reads as the way the machine turns it: forward adds (or shifts left), backward the other way", () => {
    /** @type {string[]} */
    const bad = [];
    /** @type {Rig<string>} */
    const rig = new Rig(root, m2NodeNames(16, 8));
    const m = new Machine();
    m.reset();
    applyM2Pose(rig, root, m);
    const centre = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
    let n = 0;
    for (const key of /** @type {const} */ (["pm.main_crank", "frame.lead_screw"])) {
      const node = findNodes(root, key)[0];
      // grab the crank by its handle: the mesh centre farthest from the axle (not from its
      // origin: the end crank's long screw lies along the axle)
      node.updateWorldMatrix(true, true);
      const origin = node.getWorldPosition(new THREE.Vector3());
      const ex = /** @type {{ axis?: number[] }} */ (node.userData);
      const axis = new THREE.Vector3().fromArray(ex.axis ?? [0, 0, 1]).applyQuaternion(node.getWorldQuaternion(new THREE.Quaternion())).normalize();
      /** @type {THREE.Mesh | null} */
      let handle = null;
      let far = -1;
      node.traverse((o) => {
        const mesh = /** @type {THREE.Mesh} */ (o);
        if (!mesh.isMesh) return;
        const off = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3()).sub(origin);
        const d = off.addScaledVector(axis, -off.dot(axis)).length();
        if (d > far) [far, handle] = [d, mesh];
      });
      const h = /** @type {THREE.Mesh} */ (/** @type {unknown} */ (handle));
      if (!h.geometry.boundingBox) h.geometry.computeBoundingBox();
      const local = /** @type {THREE.Box3} */ (h.geometry.boundingBox).getCenter(new THREE.Vector3());
      const at = () => {
        root.updateWorldMatrix(true, true);
        return local.clone().applyMatrix4(h.matrixWorld);
      };
      for (const dir of [{ x: 0.35, y: 0.42, z: 0.62 }, { x: 0.12, y: 0.15, z: 1 }]) {
        const eye = centre.clone().addScaledVector(new THREE.Vector3(dir.x, dir.y, dir.z).normalize(), 1);
        /** @param {THREE.Vector3} p */
        const ray = (p) => new THREE.Ray(eye, p.clone().sub(eye).normalize());
        for (const deg of [40, -40]) {
          rig.set(key, 0);
          const start = at();
          const drag = new CrankDrag(node, start, ray(start));
          // the rig turns the crank by +deg as the machine does when it adds (or shifts left)
          rig.set(key, deg / 2);
          drag.move(ray(at()));
          rig.set(key, deg);
          const got = THREE.MathUtils.radToDeg(drag.move(ray(at())));
          n++;
          if (Math.abs(got - deg) > 2) bad.push(`${key} turned ${deg}° from (${dir.x}, ${dir.y}, ${dir.z}) reads as ${got.toFixed(1)}°`);
        }
      }
      rig.set(key, 0);
    }
    applyM2Pose(rig, root, m);
    return { passed: bad.length === 0, detail: bad.join("; ") || `${n} drags of the two cranks, both ways, from two views, read as turned` };
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
      for (const lang of LOCALES) {
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
    for (const lang of LOCALES) {
      if (!partInfo(gltfName("pm.magna_rota"), m, lang)?.value?.includes("4")) bad.push(`${lang}: Magna Rota value is not its 4 turns`);
      if (!partInfo(gltfName("pm.carriage"), m, lang)?.value?.includes("2")) bad.push(`${lang}: carriage value is not its shift of 2`);
      if (!partInfo(gltfName("pm.magna_pin"), m, lang)?.value?.includes("4")) bad.push(`${lang}: pin value is not hole 4`);
    }
    return { passed: bad.length === 0, detail: bad.join("; ") || `${n} labels: names in words, values match the machine` };
  });

  return out.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}
