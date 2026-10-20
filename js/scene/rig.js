// Binds glTF nodes to motion scalars. The glTF holds the rest pose; each moving node
// carries extras {motion: "rotate"|"translate", axis: [x,y,z] (glTF frame), unit}.
// Setting a value applies rest * (axis-angle | axis-offset), never accumulating.

import * as THREE from "three";

/**
 * @typedef {object} MotionNode
 * @property {THREE.Object3D} node
 * @property {"rotate" | "translate"} motion
 * @property {THREE.Vector3} axis
 * @property {THREE.Vector3} restPos
 * @property {THREE.Quaternion} restQuat
 * @property {string} labelEn
 * @property {string} labelDe
 */

/** Node names the M0 page relies on. Renaming one in Blender is an API change. */
export const M0_NODES = /** @type {const} */ ({
  drumShaft: "pm.drum_shaft.0",
  drum: "pm.drum.0",
  rack: "pm.setting_rack.0",
  dial: "pm.setting_dial.0",
  wheel: "pi.sum_wheel.0",
  store: "pi.carry_store.0",
});

/** @typedef {keyof typeof M0_NODES} M0Key */

/**
 * three.js strips reserved characters (including ".") from glTF node names on load.
 * @param {string} name
 */
export const gltfName = (name) => THREE.PropertyBinding.sanitizeNodeName(name);

/** @template {string} K */
export class Rig {
  /** @readonly */
  parts = /** @type {Record<K, MotionNode>} */ ({});
  /** @private */
  q = new THREE.Quaternion();

  /**
   * @param {THREE.Object3D} root
   * @param {Record<K, string>} names
   */
  constructor(root, names) {
    /** @type {string[]} */
    const missing = [];
    for (const [key, name] of /** @type {[K, string][]} */ (Object.entries(names))) {
      const node = root.getObjectByName(gltfName(name));
      if (!node) {
        missing.push(name);
        continue;
      }
      const ex = /** @type {{ motion?: string; axis?: number[]; label_en?: string; label_de?: string }} */ (node.userData);
      if (ex.motion !== "rotate" && ex.motion !== "translate") {
        missing.push(`${name} (no motion extras)`);
        continue;
      }
      // The true rest pose is recorded on the node the first time any rig binds it,
      // so a second rig (e.g. ?selftest on an already-posed page) doesn't take the
      // current pose as its rest pose and double-apply offsets.
      const ud = /** @type {{ __rest?: { pos: THREE.Vector3; quat: THREE.Quaternion } }} */ (node.userData);
      ud.__rest ??= { pos: node.position.clone(), quat: node.quaternion.clone() };
      this.parts[key] = {
        node,
        motion: ex.motion,
        axis: new THREE.Vector3().fromArray(ex.axis ?? [0, 0, 1]).normalize(),
        restPos: ud.__rest.pos,
        restQuat: ud.__rest.quat,
        labelEn: ex.label_en ?? name,
        labelDe: ex.label_de ?? name,
      };
    }
    if (missing.length) throw new Error(`glTF is missing required nodes: ${missing.join(", ")}`);
  }

  /**
   * Rotation in degrees, translation in millimetres (the glTF is in metres).
   * @param {K} key
   * @param {number} value
   * @returns {void}
   */
  set(key, value) {
    const p = this.parts[key];
    if (p.motion === "rotate") {
      this.q.setFromAxisAngle(p.axis, THREE.MathUtils.degToRad(value));
      p.node.quaternion.copy(p.restQuat).multiply(this.q);
    } else {
      p.node.position.copy(p.restPos).addScaledVector(p.axis, value / 1000);
    }
  }
}

/**
 * Anchor points declared by the build (extras[key], node-local metres) in world space.
 * @param {THREE.Object3D} part
 * @param {string} key
 * @returns {THREE.Vector3[]}
 */
export function anchors(part, key) {
  const flat = (/** @type {Record<string, unknown>} */ (part.userData))[key];
  if (!Array.isArray(flat) || flat.length % 3) throw new Error(`${part.name} has no anchors "${key}"`);
  let top = part;
  while (top.parent) top = top.parent;
  top.updateMatrixWorld(true);
  /** @type {THREE.Vector3[]} */
  const out = [];
  for (let i = 0; i < flat.length; i += 3) {
    out.push(new THREE.Vector3(flat[i], flat[i + 1], flat[i + 2]).applyMatrix4(part.matrixWorld));
  }
  return out;
}
