// Scene helpers for the main page: camera views, highlights, callout labels and
// the exploded view. The views, the exploded view and the highlights are also used by the
// acceptance checks (A3-3, A3-5, A3-12..A3-14), so they do not touch the DOM; only the
// labels (fillLabel, Callouts) do.

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
 * The corners of every mesh's own bounding box under the objects, in world space. Framing on
 * these rather than on one box around everything keeps the fit tight when the parts do not fill
 * a box: taken apart, they spread into an L, and the one box's far corners, seen at an angle,
 * would shrink the parts and push them off-centre (U10).
 * @param {THREE.Object3D[]} objects
 * @returns {THREE.Vector3[]}
 */
export function partCorners(objects) {
  /** @type {THREE.Vector3[]} */
  const out = [];
  for (const o of objects) {
    o.updateWorldMatrix(true, true);
    o.traverse((x) => {
      const m = /** @type {THREE.Mesh} */ (x);
      if (!m.isMesh) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      const box = /** @type {THREE.Box3} */ (m.geometry.boundingBox);
      for (const c of corners(box)) out.push(c.applyMatrix4(m.matrixWorld));
    });
  }
  return out;
}

/**
 * A camera view: the parts it frames, and the direction it looks at them from (from the parts
 * towards the camera). js/scene/framing.js fits the parts into the free part of the canvas.
 * @typedef {object} ViewSubject
 * @property {THREE.Vector3Like} dir
 * @property {THREE.Vector3Like} [dirRipple] where it looks from with the ripple carry set fitted
 *   (its parts stand behind the drums, under the pentagons: seen from behind and a little below)
 * @property {() => THREE.Object3D[]} objects the parts it frames
 * @property {() => THREE.Vector3[]} points the corners of each part's own bounding box, where
 *   the parts are now (views of carriage parts follow the carriage)
 * @property {string[]} [inside] for a view of parts inside the machine (U11): the parts it
 *   highlights while the case is hidden, the front open and the other parts faded
 * @property {string[]} [veil] materials an inside view draws half-transparent wherever they are,
 *   so that the parts behind them show
 */

/**
 * The page's camera views (docs/ui-design.md, U10).
 * @param {THREE.Object3D} root
 * @returns {Record<ViewName, ViewSubject>}
 */
export function viewSubjects(root) {
  /**
   * A view of the given objects.
   * @param {THREE.Vector3Like} dir
   * @param {() => THREE.Object3D[]} objects
   * @returns {ViewSubject}
   */
  const of = (dir, objects) => ({ dir, objects, points: () => partCorners(objects()) });
  /**
   * @param {THREE.Vector3Like} dir
   * @param {string[]} patterns
   * @returns {ViewSubject}
   */
  const view = (dir, patterns) => of(dir, () => patterns.flatMap((p) => findNodes(root, p)));
  return {
    // The whole machine, case included whether shown or not: hiding the case does not move
    // the camera.
    overview: of({ x: 0.35, y: 0.42, z: 0.62 }, () => [root]),
    // The whole machine as it is, taken apart (the stage frames it with the parts moved out).
    apart: of({ x: 0.35, y: 0.5, z: 0.62 }, () => [root]),
    register: view({ x: 0, y: 1, z: 0.12 }, ["pi.window"]),
    // nearly from above: the C handles stand upright over the dials and would hide the windows
    // behind them from a lower view (the owner)
    knobs: view({ x: 0, y: 1, z: 0.15 }, ["pm.setting_dial.*", "pm.setting_plate.*"]),
    front: view({ x: 0.12, y: 0.15, z: 1 }, ["pm.magna_rota", "pm.main_crank"]),
    // the revolution counter on the carriage's top right, seen from above and the front
    // straight from the front (x 0): a sideways tilt turns the picture about the view axis, and
    // a round dial in a turned box fills less of it (A3-14)
    counter: view({ x: 0, y: 1, z: 0.35 }, ["pm.counter_ring", "pm.counter_plate"]),
    drum: {
      ...view({ x: 0.95, y: 0.35, z: 0.3 }, ["pm.drum.0", "pi.sum_wheel.0", "pm.setting_rack.0"]),
      inside: ["pm.drum.0", "pm.setting_rack.0", "pi.sum_wheel.0"],
    },
    carry: {
      dirRipple: { x: -0.3, y: -0.15, z: -0.95 },
      // the pentagons only show a stored carry (their tilt still shows through); s' and the
      // ripple horns work right in front of them
      veil: ["steel_pentagon"],
      ...view({ x: -0.15, y: 0.9, z: -0.75 }, ["pi.carry_store.0", "pi.carry_store.1", "pi.carry_store.2", "pi.carry_store.3", "pi.sum_wheel.0", "pi.sum_wheel.1", "pi.sum_wheel.2", "pi.sum_wheel.3"]),
      inside: [0, 1, 2, 3].flatMap((k) => [`pi.carry_store.${k}`, `pi.five_horn_s.${k}`, `pi.five_horn_sr.${k}`, `pi.sum_wheel.${k}`,
        `pm.zweihorn.${k}`, `pm.zweihorn_r.${k}`]),
    },
  };
}

// ---- highlight and fade --------------------------------------------------------------------------
/**
 * "Colour by part" (the Views menu): every kind of part in a colour of its own, so that the parts
 * can be told apart inside the machine. Later patterns override earlier ones (a node's colour goes to
 * the parts it holds). The digits (ink) and the dishes' white bands keep their colours.
 * @type {[string, number][]}
 */
export const PART_COLOURS = [
  ["frame.*", 0x9aa0a8],
  ["pi.window", 0xc9b79c],
  ["pm.carriage", 0xa7abb1],
  ["pm.carriage_cover", 0xc9b79c],
  ["pm.carriage_panel", 0xc9b79c],
  ["frame.lead_screw", 0x7c828c],
  ["pm.drum_shaft.*", 0x646a73],
  ["pm.drum.*", 0xcc8f66],
  ["pm.setting_rack.*", 0xc4a85a],
  ["pm.setting_dial.*", 0xdccb94],
  ["pm.setting_plate.*", 0xdccb94],
  ["pm.setting_stop.*", 0xdccb94],
  ["pm.lever.*", 0x8f7fbf],
  ["pm.zweihorn.*", 0xc27470],
  ["pm.zweihorn_r.*", 0xc27470],
  ["pi.sum_wheel.*", 0x6a88c2],
  ["pi.carry_store.*", 0x6fa57a],
  ["pi.five_horn_s.*", 0x6db5c0],
  ["pi.five_horn_sr.*", 0x6db5c0],
  ["pm.magna_rota", 0xa8805a],
  ["pm.main_crank", 0xa8805a],
  ["pm.large_gear_a", 0xa77aa5],
  ["pm.large_gear_b", 0xa77aa5],
  ["pm.large_gear_c", 0xa77aa5],
  ["pm.counter_shaft", 0xc785a3],
  ["pm.counter_k", 0xc785a3],
  ["pm.counter_l", 0xc785a3],
  ["pm.counter_n", 0xc785a3],
  ["pm.counter_ring", 0xc785a3],
  ["pm.counter_pin", 0xd4aa5c],
  ["pm.counter_pin_park", 0xd4aa5c],
  ["pm.counter_plate", 0xe5e7eb],
  ["pm.counter_frame", 0x8a8f98],
];
/** Materials "Colour by part" leaves alone: the digits and the white bands they are printed on. */
const KEEP_COLOUR = new Set(["ink_black", "ink_red", "enamel_white"]);

/** The parts a step points at glow amber: the page's one colour for "your turn" (U5). */
const GLOW = new THREE.Color(0xffa31a);

/**
 * The parts that show a part's value, though the model makes them separate parts: Focus keeps
 * them with it (U12), or fading around the windows would fade the digits behind them.
 * @type {[RegExp, (m: RegExpMatchArray) => string[]][]}
 */
const READOUTS = [
  [/^pi\.window$/, () => ["pi.sum_wheel.*"]], // the digits are on the result wheels behind the windows
  [/^pm\.setting_dial\.(\d+|\*)$/, (m) => [`pm.setting_plate.${m[1]}`]], // a knob's digits are on its dial
  [/^pm\.counter_(ring|pin)$/, () => ["pm.counter_plate"]], // the numbers the pin points at are on the plate
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

/**
 * Makes some parts glow and (with fade) fades the rest. Materials are cloned, never edited, and
 * each clone is made once (one per material and look) and reused, so steps and views can change
 * the highlight as often as they like without piling up materials.
 */
export class Highlighter {
  /**
   * @private
   * @type {Map<THREE.Mesh, THREE.Material | THREE.Material[]>}
   */
  originals = new Map();

  /**
   * The clones, by original material and look ("lit", "dim" or "lit dim").
   * @private
   * @type {Map<THREE.Material, Map<string, THREE.Material>>}
   */
  clones = new Map();

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
    // each mesh's colour for "Colour by part": the last pattern that holds it wins
    for (const [pattern, hex] of PART_COLOURS) {
      for (const mesh of this.meshes([pattern])) this.partColour.set(mesh, hex);
    }
  }

  /**
   * The colour of each mesh's kind of part (PART_COLOURS).
   * @private
   * @type {Map<THREE.Mesh, number>}
   */
  partColour = new Map();

  /** Draw every kind of part in its own colour (the Views menu's "Colour by part"). */
  colours = false;

  /**
   * The flat-coloured stand-ins, one per original material and colour.
   * @private
   * @type {Map<THREE.Material, Map<number, THREE.Material>>}
   */
  coloured = new Map();

  /**
   * The last set() call, to apply again when the colours are switched.
   * @private
   * @type {[string[], boolean, string[], string[]]}
   */
  last = [[], false, [], []];

  /**
   * The meshes drawn invisible: the frame and the carriage's structure while the case is off.
   * @private
   * @type {Set<THREE.Object3D>}
   */
  concealed = new Set();

  /**
   * The invisible stand-ins, one per material.
   * @private
   * @type {Map<THREE.Material, THREE.Material>}
   */
  unseen = new Map();

  /**
   * Draw these meshes invisible (clicks and hover labels pass through them), keeping the highlight.
   * @param {Set<THREE.Object3D>} meshes
   */
  setConcealed(meshes) {
    this.concealed = meshes;
    this.set(...this.last);
  }

  /**
   * Switch "Colour by part" on or off, keeping the highlight and the fading.
   * @param {boolean} on
   */
  setColours(on) {
    this.colours = on;
    this.set(...this.last);
  }

  /**
   * A mesh's material as drawn before any highlight: the original, or its colour by part.
   * @private
   * @param {THREE.Mesh} mesh
   * @param {THREE.Material} m
   * @returns {THREE.Material}
   */
  base(mesh, m) {
    if (this.concealed.has(mesh)) {
      let u = this.unseen.get(m);
      if (!u) {
        u = m.clone();
        u.visible = false;
        this.unseen.set(m, u);
      }
      return u;
    }
    const hex = this.partColour.get(mesh);
    if (!this.colours || hex === undefined || KEEP_COLOUR.has(m.name)) return m;
    const byHex = this.coloured.get(m) ?? new Map();
    this.coloured.set(m, byHex);
    let c = byHex.get(hex);
    if (!c) {
      const s = /** @type {THREE.MeshStandardMaterial} */ (m.clone());
      s.color = new THREE.Color(hex);
      s.map = null;
      s.metalness = 0.15;
      s.roughness = 0.6;
      c = s;
      byHex.set(hex, c);
    }
    return c;
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
   * @param {string[]} [veil] materials drawn half-transparent while fading (an inside view's)
   * @returns {void}
   */
  set(patterns, fade, context = [], veil = []) {
    this.last = [patterns, fade, context, veil];
    this.faded.clear();
    for (const m of this.concealed) this.faded.add(m);
    const lit = this.meshes(patterns);
    const kept = this.meshes([...patterns, ...readouts(patterns), ...context]);
    const veiled = (/** @type {THREE.Material} */ m) => fade && veil.includes(m.name);
    for (const [mesh, orig] of this.originals) {
      const on = lit.has(mesh);
      const dim = fade && lit.size > 0 && !kept.has(mesh);
      const thin = (Array.isArray(orig) ? orig : [orig]).some(veiled);
      if (!on && !dim && !thin) {
        mesh.material = Array.isArray(orig) ? orig.map((m) => this.base(mesh, m)) : this.base(mesh, orig);
        continue;
      }
      if (dim) this.faded.add(mesh);
      /**
       * @param {THREE.Material} m0
       * @returns {THREE.Material}
       */
      const edit = (m0) => {
        const half = !dim && veiled(m0);
        const m = this.base(mesh, m0);
        const look = `${on ? "lit" : ""} ${dim ? "dim" : ""} ${half ? "veil" : ""}`;
        if (!on && !dim && !half) return m;
        const byLook = this.clones.get(m) ?? new Map();
        this.clones.set(m, byLook);
        const made = byLook.get(look);
        if (made) {
          made.needsUpdate = true; // the quality may have changed shadows since it was last shown
          return made;
        }
        const c = /** @type {THREE.MeshStandardMaterial} */ (m.clone());
        if (on && c.emissive) {
          // in colour by part, a part glows in its own colour, so its colour still tells what it is
          const hex = this.colours ? this.partColour.get(mesh) : undefined;
          c.emissive = hex !== undefined && !KEEP_COLOUR.has(m0.name) ? new THREE.Color(hex) : GLOW.clone();
          c.emissiveIntensity = hex !== undefined ? 0.3 : 0.45;
        }
        if (dim || half) {
          c.transparent = true;
          c.opacity = dim ? 0.15 : 0.4;
          c.depthWrite = false;
        }
        byLook.set(look, c);
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
