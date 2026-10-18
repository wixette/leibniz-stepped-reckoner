// All-pairs collision sweep for acceptance checks: every part against every other part
// that can move relative to it, with a bounding-box prefilter and a cache keyed on which
// parts moved since the last pose. Shared by the M1 and M2 specs (A1-6, A2-3, A2-9).

import * as THREE from "three";
import { gltfName } from "../scene/rig.js";
import { intersects, ownMeshes } from "./harness.js";

/**
 * @typedef {object} Part
 * @property {string} name
 * @property {THREE.Object3D} obj
 * @property {THREE.Mesh[]} meshes
 * @property {boolean} onCarriage
 * @property {boolean} rigid
 */

/**
 * Every part of the model, and whether it moves with the carriage / is fixed to its body.
 * @param {THREE.Object3D} root
 * @returns {Part[]}
 */
export function parts(root) {
  /** @type {Part[]} */
  const out = [];
  const carriage = root.getObjectByName(gltfName("pm.carriage")) ?? null;
  root.traverse((o) => {
    const motion = (/** @type {{ motion?: string }} */ (o.userData)).motion;
    if (motion === undefined) return;
    let onCarriage = false;
    for (let p = /** @type {THREE.Object3D | null} */ (o); p && carriage; p = p.parent) if (p === carriage) onCarriage = true;
    const meshes = ownMeshes(o);
    for (const m of meshes) m.geometry.boundingBox ?? m.geometry.computeBoundingBox();
    out.push({ name: o.name, obj: o, meshes, onCarriage, rigid: motion === "static" || o === carriage });
  });
  return out;
}

/**
 * Designed contacts, not collisions (names as three.js gives them, dots stripped):
 * shafts journaled in the frame or the carriage, the drum keyed on its shaft, a knob
 * standing on its dial plate and meshing with its rack, the pin in its Magna Rota hole.
 * @type {RegExp[]}
 */
const DESIGNED = [
  /^framestatic~(pisum_wheel|picarry_store|pmdrum_shaft|pmsetting_dial|pmlever)\d+$/,
  /^framelead_screw~framestatic$/,
  /^pmcarriage~(pmdrum_shaft|pmsetting_dial)\d+$/,
  /^pmdrum_shaft(\d+)~pmdrum\1$/,
  /^pmsetting_dial(\d+)~pmsetting_(plate|rack)\1$/,
  /^pmmagna_pin~pmmagna_rota$/,
];
/**
 * @param {string} a
 * @param {string} b
 */
const designed = (a, b) => DESIGNED.some((re) => re.test(`${a}~${b}`) || re.test(`${b}~${a}`));

export class CollisionSweep {
  /**
   * @private
   * @type {Part[]}
   */
  all;
  /**
   * @private
   * @type {[Part, Part][]}
   */
  pairs = [];
  /** @private */
  box = new THREE.Box3();
  /** @private */
  tmp = new THREE.Box3();
  /**
   * @private
   * @type {Map<Part, THREE.Box3>}
   */
  boxes = new Map();
  /**
   * @private
   * @type {Map<Part, number[]>}
   */
  last = new Map();
  /**
   * @private
   * @type {Map<Part, number>}
   */
  version = new Map();
  /**
   * @private
   * @type {Map<string, { va: number; vb: number; hit: boolean }>}
   */
  cache = new Map();
  /**
   * Results by pair and relative transform: repeated turns revisit the same configurations.
   * @private
   * @type {Map<string, boolean>}
   */
  seen = new Map();
  /** @private */
  rel = new THREE.Matrix4();
  tested = 0;

  /**
   * @private
   * @type {THREE.Object3D}
   */
  root;

  /** @param {THREE.Object3D} root */
  constructor(root) {
    this.root = root;
    this.all = parts(root);
    for (let i = 0; i < this.all.length; i++) {
      for (let k = i + 1; k < this.all.length; k++) {
        const [a, b] = [this.all[i], this.all[k]];
        if (a.onCarriage === b.onCarriage && a.rigid && b.rigid) continue; // one rigid body
        if (designed(a.name, b.name)) continue;
        this.pairs.push([a, b]);
      }
    }
  }

  /**
   * Pairs of parts that intersect at the current pose (only re-tests parts that moved;
   *  hidden parts, such as the Magna Rota pin when it is out, are skipped).
   * @returns {string[]}
   */
  run() {
    let top = this.root;
    while (top.parent) top = top.parent;
    top.updateMatrixWorld(true);
    for (const p of this.all) {
      const e = p.meshes.flatMap((m) => /** @type {number[]} */ (m.matrixWorld.elements));
      const prev = this.last.get(p);
      if (!prev || prev.some((v, i) => Math.abs(v - e[i]) > 1e-9)) {
        this.last.set(p, e);
        this.version.set(p, (this.version.get(p) ?? 0) + 1);
        const bx = this.boxes.get(p) ?? new THREE.Box3();
        bx.makeEmpty();
        for (const m of p.meshes) bx.union(this.tmp.copy(/** @type {THREE.Box3} */ (m.geometry.boundingBox)).applyMatrix4(m.matrixWorld));
        this.boxes.set(p, bx);
      }
    }
    /** @type {string[]} */
    const hits = [];
    /** @param {THREE.Object3D} o */
    const shown = (o) => {
      for (let p = /** @type {THREE.Object3D | null} */ (o); p; p = p.parent) if (!p.visible) return false;
      return true;
    };
    for (const [a, b] of this.pairs) {
      if (!shown(a.obj) || !shown(b.obj)) continue;
      const key = `${a.name}~${b.name}`;
      const va = /** @type {number} */ (this.version.get(a));
      const vb = /** @type {number} */ (this.version.get(b));
      const c = this.cache.get(key);
      /** @type {boolean} */
      let hit;
      if (c && c.va === va && c.vb === vb) hit = c.hit;
      else {
        const near = this.box.copy(/** @type {THREE.Box3} */ (this.boxes.get(a))).intersectsBox(/** @type {THREE.Box3} */ (this.boxes.get(b)));
        if (near) {
          this.rel.copy(a.obj.matrixWorld).invert().multiply(b.obj.matrixWorld);
          const rk = `${key}:${this.rel.elements.map((v) => Math.round(v * 1e5)).join(",")}`;
          const known = this.seen.get(rk);
          if (known === undefined) this.tested++;
          hit = known ?? intersects(a.obj, b.obj);
          if (known === undefined) this.seen.set(rk, hit);
        } else hit = false;
        this.cache.set(key, { va, vb, hit });
      }
      if (hit) hits.push(key);
    }
    return hits;
  }
}
