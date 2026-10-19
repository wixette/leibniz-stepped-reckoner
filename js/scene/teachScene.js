// Scene helpers for the main page: camera views, highlights, callout labels and
// the exploded view. The exploded view and the highlight matching are also used by the
// acceptance checks (A3-3, A3-5), so they do not touch the DOM.

import * as THREE from "three";
/** @import { ViewName } from "../teach/player.js" */
import { corners } from "./framing.js";
import { gltfName } from "./rig.js";

// ---- node matching ------------------------------------------------------------------------------
/**
 * Nodes for a Blender name ("pm.drum.0") or group ("pm.drum.*": that base name plus a number).
 * @param {THREE.Object3D} root
 * @param {string} pattern
 * @returns {THREE.Object3D[]}
 */
export function findNodes(root, pattern) {
  if (!pattern.endsWith(".*")) {
    const n = root.getObjectByName(gltfName(pattern));
    return n ? [n] : [];
  }
  const re = new RegExp(`^${gltfName(pattern.slice(0, -2))}\\d+$`);
  /** @type {THREE.Object3D[]} */
  const out = [];
  root.traverse((o) => re.test(o.name) && out.push(o));
  return out;
}

/** @param {THREE.Object3D} o */
const shown = (o) => {
  for (let p = /** @type {THREE.Object3D | null} */ (o); p; p = p.parent) if (!p.visible) return false;
  return true;
};
export { shown as isShown };

// ---- camera views -------------------------------------------------------------------------------

/**
 * A camera view: the parts it frames, and the direction it looks at them from (from the parts
 * towards the camera). js/scene/framing.js fits the parts into the free part of the canvas.
 * @typedef {object} ViewSubject
 * @property {THREE.Vector3Like} dir
 * @property {() => THREE.Vector3[]} points the corners of the parts' bounding box, now
 *   (views of carriage parts follow the carriage)
 * @property {string[]} [inside] for a view of parts inside the machine (U11): the parts it
 *   highlights while the case is hidden, the front open and the other parts faded
 */

/**
 * The page's camera views (docs/ui-design.md, U10).
 * @param {THREE.Object3D} root
 * @returns {Record<ViewName, ViewSubject>}
 */
export function viewSubjects(root) {
  /**
   * The corners of the bounding box of the nodes matching the patterns.
   * @param {string[]} patterns
   * @returns {THREE.Vector3[]}
   */
  const boxOf = (patterns) => {
    root.updateWorldMatrix(true, true);
    const box = new THREE.Box3();
    for (const p of patterns) for (const n of findNodes(root, p)) box.expandByObject(n);
    return corners(box);
  };
  /**
   * @param {THREE.Vector3Like} dir
   * @param {string[]} patterns
   * @returns {ViewSubject}
   */
  const view = (dir, patterns) => ({ dir, points: () => boxOf(patterns) });
  return {
    overview: {
      dir: { x: 0.35, y: 0.42, z: 0.62 },
      points: () => {
        // The whole machine, case included whether shown or not: hiding the case does not move
        // the camera.
        root.updateWorldMatrix(true, true);
        return corners(new THREE.Box3().setFromObject(root));
      },
    },
    apart: {
      // The whole machine as it is, taken apart (the stage frames it with the parts moved out).
      dir: { x: 0.35, y: 0.5, z: 0.62 },
      points: () => {
        root.updateWorldMatrix(true, true);
        return corners(new THREE.Box3().setFromObject(root));
      },
    },
    register: view({ x: 0, y: 1, z: 0.12 }, ["pi.window"]),
    knobs: view({ x: 0, y: 1.1, z: 0.8 }, ["pm.setting_dial.*", "pm.setting_plate.*"]),
    front: view({ x: 0.12, y: 0.15, z: 1 }, ["pm.magna_rota", "pm.main_crank", "pm.magna_plate"]),
    drum: {
      ...view({ x: 0.7, y: 0.55, z: 0.75 }, ["pm.drum.0", "pi.sum_wheel.0", "pm.setting_rack.0"]),
      inside: ["pm.drum.0", "pm.setting_rack.0", "pi.sum_wheel.0"],
    },
    carry: {
      ...view({ x: -0.15, y: 0.9, z: -0.75 }, ["pi.carry_store.0", "pi.carry_store.1", "pi.carry_store.2", "pi.carry_store.3", "pi.sum_wheel.0", "pi.sum_wheel.1", "pi.sum_wheel.2", "pi.sum_wheel.3"]),
      inside: [0, 1, 2, 3].flatMap((k) => [`pi.carry_store.${k}`, `pi.sum_wheel.${k}`, `pm.zweihorn_add.${k}`, `pm.zweihorn_sub.${k}`]),
    },
  };
}

// ---- highlight and fade --------------------------------------------------------------------------
const GLOW = new THREE.Color(0xffa31a);

/**
 * The parts that show a part's value, though the model makes them separate parts: Focus keeps
 * them with it (U12), or fading around the windows would fade the digits behind them.
 * @type {[RegExp, (m: RegExpMatchArray) => string[]][]}
 */
const READOUTS = [
  [/^pi\.window$/, () => ["pi.sum_wheel.*"]], // the digits are on the result wheels behind the windows
  [/^pm\.setting_dial\.(\d+|\*)$/, (m) => [`pm.setting_plate.${m[1]}`]], // a knob's digits are on its dial
  [/^pm\.magna_rota$/, () => ["pm.magna_plate"]], // the red number is read at the stop on the plate
];

/**
 * The parts that show the values of the given parts (see READOUTS).
 * @param {string[]} patterns
 * @returns {string[]}
 */
export function readouts(patterns) {
  return patterns.flatMap((p) => READOUTS.flatMap(([re, f]) => {
    const m = p.match(re);
    return m ? f(m) : [];
  }));
}

/** Makes some parts glow and (with fade) fades the rest. Materials are cloned, never edited. */
export class Highlighter {
  /**
   * @private
   * @type {Map<THREE.Mesh, THREE.Material | THREE.Material[]>}
   */
  originals = new Map();

  /**
   * @private
   * @type {THREE.Object3D}
   */
  root;

  /** @param {THREE.Object3D} root */
  constructor(root) {
    this.root = root;
    root.traverse((o) => {
      const m = /** @type {THREE.Mesh} */ (o);
      if (m.isMesh) this.originals.set(m, m.material);
    });
  }

  /**
   * The meshes faded: clicks and hover labels pass through them (U11).
   * @type {Set<THREE.Object3D>}
   */
  faded = new Set();

  /**
   * Make the parts glow; with fade, fade every part except them, their readouts and the context.
   * @param {string[]} patterns the parts to highlight
   * @param {boolean} fade
   * @param {string[]} [context] parts fading keeps as they are (not highlighted)
   * @returns {void}
   */
  set(patterns, fade, context = []) {
    this.faded.clear();
    const lit = this.meshes(patterns);
    const kept = this.meshes([...patterns, ...readouts(patterns), ...context]);
    for (const [mesh, orig] of this.originals) {
      const on = lit.has(mesh);
      const dim = fade && lit.size > 0 && !kept.has(mesh);
      if (!on && !dim) {
        mesh.material = orig;
        continue;
      }
      if (dim) this.faded.add(mesh);
      /**
       * @param {THREE.Material} m
       * @returns {THREE.Material}
       */
      const edit = (m) => {
        const c = /** @type {THREE.MeshStandardMaterial} */ (m.clone());
        if (on && c.emissive) {
          c.emissive = GLOW.clone();
          c.emissiveIntensity = 0.45;
        }
        if (dim) {
          c.transparent = true;
          c.opacity = 0.15;
          c.depthWrite = false;
        }
        return c;
      };
      mesh.material = Array.isArray(orig) ? orig.map(edit) : edit(orig);
    }
  }

  /**
   * @private
   * @param {string[]} patterns
   * @returns {Set<THREE.Mesh>}
   */
  meshes(patterns) {
    /** @type {Set<THREE.Mesh>} */
    const out = new Set();
    for (const p of patterns) for (const n of findNodes(this.root, p)) n.traverse((o) => (/** @type {THREE.Mesh} */ (o)).isMesh && out.add(/** @type {THREE.Mesh} */ (o)));
    return out;
  }
}

// ---- callouts -----------------------------------------------------------------------------------
/**
 * @typedef {object} CalloutItem
 * @property {string} node
 * @property {string} text
 */
/**
 * The current value of a part (glTF node name), shown in a chip beside the name.
 * @typedef {(node: string) => { value: string | null; red?: boolean } | null} ValueOf
 */

/**
 * Fill a label element: the name, then the value in its own chip (never mixed into the name).
 * @param {HTMLElement} el
 * @param {string} name
 * @param {string | null} value
 * @returns {void}
 */
export function fillLabel(el, name, value, red = false) {
  /** @type {HTMLSpanElement | null} */
  let n = el.querySelector(".name");
  /** @type {HTMLSpanElement | null} */
  let v = el.querySelector(".val");
  if (!n || !v) {
    el.textContent = "";
    n = document.createElement("span");
    n.className = "name";
    v = document.createElement("span");
    v.className = "val";
    el.append(n, v);
  }
  if (n.textContent !== name) n.textContent = name;
  if (v.textContent !== (value ?? "")) v.textContent = value ?? "";
  v.hidden = value === null;
  v.classList.toggle("red", red);
}

/** HTML labels pinned to parts (the centre of the part's bounding box), updated every frame. */
export class Callouts {
  /**
   * @private
   * @type {{ nodes: THREE.Object3D[]; el: HTMLDivElement; text: string }[]}
   */
  items = [];
  /** @type {ValueOf} */
  valueOf = () => null;
  /** @private */
  box = new THREE.Box3();
  /** @private */
  v = new THREE.Vector3();

  /**
   * @private
   * @type {HTMLElement}
   */
  host;
  /**
   * @private
   * @type {THREE.Camera}
   */
  camera;
  /**
   * @private
   * @type {THREE.Object3D}
   */
  root;

  /**
   * @param {HTMLElement} host
   * @param {THREE.Camera} camera
   * @param {THREE.Object3D} root
   */
  constructor(host, camera, root) {
    this.host = host;
    this.camera = camera;
    this.root = root;
  }

  /**
   * @param {CalloutItem[]} items
   * @returns {void}
   */
  set(items) {
    for (const it of this.items) it.el.remove();
    this.items = items.map((c) => {
      const el = document.createElement("div");
      el.className = "callout";
      this.host.appendChild(el);
      return { nodes: findNodes(this.root, c.node), el, text: c.text };
    });
  }

  /** @returns {void} */
  update() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    for (const it of this.items) {
      const node = it.nodes[0];
      if (!node || !shown(node)) {
        it.el.hidden = true;
        continue;
      }
      const info = this.valueOf(node.name);
      fillLabel(it.el, it.text, info?.value ?? null, info?.red);
      this.box.setFromObject(node).getCenter(this.v).project(this.camera);
      it.el.hidden = this.v.z > 1;
      it.el.style.left = `${((this.v.x + 1) / 2) * w}px`;
      it.el.style.top = `${((1 - this.v.y) / 2) * h}px`;
    }
  }
}

// ---- exploded view ------------------------------------------------------------------------------
/**
 * Adds factor × extras.explode (mm, in the parent's frame) to every part that has one.
 * The rig re-sets the position of translating parts on every pose, but not of rotating or
 * static ones, so posing goes: remove() → pose the machine → apply(factor) (see pose()).
 */
export class Exploder {
  /**
   * @readonly
   * @type {{ node: THREE.Object3D; offset: THREE.Vector3 }[]}
   */
  parts = [];
  /**
   * @private
   * @type {Map<THREE.Object3D, THREE.Vector3>}
   */
  applied = new Map();
  factor = 0;

  /** @param {THREE.Object3D} root */
  constructor(root) {
    root.traverse((o) => {
      const e = (/** @type {{ explode?: number[] }} */ (o.userData)).explode;
      if (Array.isArray(e) && e.length === 3) this.parts.push({ node: o, offset: new THREE.Vector3(e[0], e[1], e[2]).multiplyScalar(0.001) });
    });
  }

  /**
   * Take the current offsets out again (before the rig poses the machine).
   * @returns {void}
   */
  remove() {
    for (const [node, off] of this.applied) node.position.sub(off);
    this.applied.clear();
  }

  /** @returns {void} */
  apply(factor = this.factor) {
    this.remove();
    this.factor = factor;
    if (factor === 0) return;
    for (const p of this.parts) {
      const off = p.offset.clone().multiplyScalar(factor);
      p.node.position.add(off);
      this.applied.set(p.node, off);
    }
  }

  /**
   * Pose the machine with the exploded offsets kept on top.
   * @param {() => void} applyPose
   * @returns {void}
   */
  pose(applyPose) {
    this.remove();
    applyPose();
    this.apply();
  }
}
