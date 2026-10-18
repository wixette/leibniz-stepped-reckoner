// The 3D stage (docs/ui-design.md, U9): the viewer and the model, how it is shown (case, open
// front, taken apart, highlights and callouts, camera views), and pointing at and clicking its
// parts. The machine's state is the app's; the stage poses the model from it.

import * as THREE from "three";
import { applyM2Pose, m2NodeNames } from "../scene/m2Pose.js";
import { gltfName, Rig } from "../scene/rig.js";
import { Callouts, Exploder, fillLabel, findNodes, Highlighter, makeViews } from "../scene/teachScene.js";
import { Viewer } from "../scene/viewer.js";
/** @import { Machine } from "../sim/machine.js" */
import { intentAt, intentHint } from "../teach/partActions.js";
/** @import { Intent } from "../teach/partActions.js" */
import { partInfo, partName } from "../teach/partInfo.js";
/** @import { ViewName } from "../teach/player.js" */

/** Parts hidden by "Case" (the oak case, base and the brass cover plates). */
const CASING = ["frame.case", "frame.base", "frame.register_cover", "pm.carriage_cover"];
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export class Stage {
  /** @type {THREE.Object3D | null} */
  root = null;
  /**
   * @private
   * @type {Rig<string> | null}
   */
  rig = null;
  /** @type {Exploder | null} */
  exploder = null;
  /**
   * @private
   * @type {Highlighter | null}
   */
  highlighter = null;
  /**
   * @private
   * @type {Callouts | null}
   */
  callouts = null;
  /** @type {ReturnType<typeof makeViews> | null} */
  views = null;
  casing = true;
  cutaway = false;
  /** Taken-apart target, 0 or 1; the exploder's factor moves towards it. */
  explodeTarget = 0;
  /**
   * The callouts' texts (message keys), kept to translate them again.
   * @private
   * @type {{ node: string; text: () => string; value?: false }[]}
   */
  calloutItems = [];

  /** What a click on a part may do now (null: nothing), and doing it: set by the app. */
  /** @type {(i: Intent | null) => Intent | null} */
  allow = () => null;
  /** @type {(i: Intent) => void} */
  onIntent = () => {};

  /**
   * @param {HTMLElement} host
   * @param {HTMLElement} hover the hover label
   * @param {Machine} machine
   */
  constructor(host, hover, machine) {
    this.host = host;
    this.hoverBox = hover;
    this.machine = machine;
    this.viewer = new Viewer(host, { transparent: true });
    this.viewer.setShadowExtent(0.5, { x: -0.27, y: 0, z: 0 });
    this.viewer.renderOnDemand = true;
    const q = new URLSearchParams(location.search).get("quality");
    if (q === "lite" || q === "high") {
      this.viewer.qualityMode = q;
      this.viewer.setQuality(q);
    }
    const c = this.viewer.controls;
    c.minDistance = 0.12;
    c.maxDistance = 2.2;
    c.maxPolarAngle = Math.PI * 0.62; // a little below the table, never from underneath
    c.screenSpacePanning = true;
  }

  /** @returns {boolean} */
  get apart() {
    return (this.exploder?.factor ?? 0) > 0 || this.explodeTarget > 0;
  }

  /**
   * @param {string} url
   * @param {(fraction: number) => void} onProgress
   * @returns {Promise<void>}
   */
  async load(url, onProgress) {
    const r = await this.viewer.load(url, onProgress);
    this.root = r;
    const m = this.machine;
    this.rig = /** @type {Rig<string>} */ (new Rig(r, m2NodeNames(m.registerDigits, m.carriageDigits)));
    this.exploder = new Exploder(r);
    this.highlighter = new Highlighter(r);
    this.callouts = new Callouts(this.host, this.viewer.camera, r);
    this.callouts.valueOf = (node) => partInfo(node, this.machine);
    this.views = makeViews(this.viewer.camera, r);
    const [p, t] = this.views.overview();
    this.viewer.camera.position.set(p.x, p.y, p.z);
    this.viewer.controls.target.set(t.x, t.y, t.z);
    this.setupPointer();
    this.applyToggles();
    this.pose();
  }

  /** Pose the model from the machine (keeping the exploded offsets). */
  pose() {
    const { rig, root, exploder } = this;
    if (rig && root && exploder) exploder.pose(() => applyM2Pose(rig, root, this.machine));
    this.viewer.invalidate();
    this.refreshHover();
  }

  /**
   * Advance the take-apart animation; true while it moves.
   * @param {number} dt
   * @returns {boolean}
   */
  tickExplode(dt) {
    const ex = this.exploder;
    if (!ex || ex.factor === this.explodeTarget) return false;
    const d = this.explodeTarget - ex.factor;
    ex.factor += Math.sign(d) * Math.min(Math.abs(d), reducedMotion() ? 1 : dt * 1.2);
    this.pose();
    return true;
  }

  /** Show or hide the case and the carriage front, as set. */
  applyToggles() {
    if (!this.root) return;
    for (const n of CASING) for (const o of findNodes(this.root, n)) o.visible = this.casing;
    for (const o of findNodes(this.root, "pm.carriage_panel")) o.visible = !this.cutaway;
    this.viewer.invalidate();
    this.refreshHover();
  }

  /**
   * Highlight parts, fading the rest if focus is on.
   * @param {string[]} names
   * @param {boolean} focus
   */
  highlight(names, focus) {
    this.highlighter?.set(names, focus);
    this.viewer.invalidate();
  }

  /**
   * Callouts: labels pinned to parts, with their texts as functions (they follow the language).
   * A callout with value: false names an area and shows no live value.
   * @param {{ node: string; text: () => string; value?: false }[]} items
   */
  setCallouts(items) {
    this.calloutItems = items;
    const quiet = new Set(items.filter((c) => c.value === false).map((c) => gltfName(c.node)));
    if (this.callouts) this.callouts.valueOf = (node) => (quiet.has(node) ? null : partInfo(node, this.machine));
    this.callouts?.set(items.map((c) => ({ node: c.node, text: c.text() })));
    this.viewer.invalidate();
  }

  /** Translate the callouts again (the language changed). */
  retranslate() {
    this.setCallouts(this.calloutItems);
    this.refreshHover();
  }

  /** Move the callouts with the camera and the parts. */
  updateCallouts() {
    this.callouts?.update();
  }

  /**
   * Fly the camera to a view.
   * @param {ViewName} view
   */
  fly(view) {
    if (!this.views) return;
    this.hoverBox.hidden = true;
    const [p, t] = this.views[view]();
    this.viewer.flyTo(p, t, reducedMotion() ? 0.001 : 0.8);
  }

  // ---- pointing and clicking -------------------------------------------------------------------
  /**
   * @private
   * @type {{ x: number; y: number } | null}
   */
  lastPointer = null;
  /** @private */
  raycaster = new THREE.Raycaster();
  /** @private */
  ndc = new THREE.Vector2();

  /**
   * The first visible part under a screen point.
   * @private
   * @param {number} clientX
   * @param {number} clientY
   * @returns {THREE.Intersection | undefined}
   */
  pick(clientX, clientY) {
    if (!this.root) return undefined;
    const b = this.viewer.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((clientX - b.left) / b.width) * 2 - 1, -((clientY - b.top) / b.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.viewer.camera);
    return this.raycaster.intersectObject(this.root, true).find((h) => {
      for (let p = /** @type {THREE.Object3D | null} */ (h.object); p; p = p.parent) if (!p.visible) return false;
      return true;
    });
  }

  /**
   * Name and live value of a part (walking up to the nearest named node).
   * @private
   * @param {THREE.Object3D} o
   * @returns {{ name: string; value: string | null; red?: boolean } | null}
   */
  labelFor(o) {
    for (let n = /** @type {THREE.Object3D | null} */ (o); n; n = n.parent) {
      const info = partInfo(n.name, this.machine);
      if (info) return info;
      const name = partName(n.name);
      if (name) return { name, value: null };
    }
    return null;
  }

  /**
   * The operation a click there would do, if allowed now.
   * @private
   * @param {THREE.Intersection | undefined} hit
   * @returns {Intent | null}
   */
  intentAtHit(hit) {
    if (!hit) return null;
    return this.allow(intentAt(hit.object, hit.point, this.machine));
  }

  /**
   * @private
   * @param {number} x
   * @param {number} y
   */
  showHover(x, y) {
    const canvas = this.viewer.renderer.domElement;
    const hit = this.pick(x, y);
    const label = hit ? this.labelFor(hit.object) : null;
    const intent = this.intentAtHit(hit);
    canvas.style.cursor = intent ? "pointer" : "";
    this.hoverBox.hidden = !label;
    if (!label) return;
    fillLabel(this.hoverBox, label.name, label.value, label.red);
    /** @type {HTMLDivElement | null} */
    let hint = this.hoverBox.querySelector(".hint");
    if (!hint) {
      hint = document.createElement("div");
      hint.className = "hint";
      this.hoverBox.appendChild(hint);
    }
    hint.textContent = intent ? intentHint(intent) : "";
    hint.hidden = !intent;
    const b = canvas.getBoundingClientRect();
    const w = this.hoverBox.offsetWidth;
    const left = x - b.left;
    // keep the label inside the stage: flip it to the left of the pointer near the right edge
    this.hoverBox.style.left = `${left + w + 28 > b.width ? left - w - 28 : left}px`;
    this.hoverBox.style.top = `${y - b.top}px`;
  }

  /** Re-read the label under the pointer (its value changes when the machine does). */
  refreshHover() {
    if (this.lastPointer && !this.hoverBox.hidden) this.showHover(this.lastPointer.x, this.lastPointer.y);
  }

  /** @private */
  setupPointer() {
    const canvas = this.viewer.renderer.domElement;
    // A click or tap is a press and release without a drag (dragging orbits the camera).
    /** @type {{ x: number; y: number; t: number } | null} */
    let down = null;
    canvas.addEventListener("pointerdown", (e) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
      this.hoverBox.hidden = true;
    });
    canvas.addEventListener("pointerup", (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.t < 600;
      down = null;
      if (moved > 6 || !quick) return;
      const i = this.intentAtHit(this.pick(e.clientX, e.clientY));
      if (i) this.onIntent(i);
      if (e.pointerType === "mouse") {
        this.lastPointer = { x: e.clientX, y: e.clientY };
        this.showHover(e.clientX, e.clientY);
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      if (e.buttons || e.pointerType !== "mouse") return; // dragging, or a touch (no hover)
      this.lastPointer = { x: e.clientX, y: e.clientY };
      this.showHover(e.clientX, e.clientY);
    });
    canvas.addEventListener("pointerleave", () => (this.hoverBox.hidden = true));
  }
}
