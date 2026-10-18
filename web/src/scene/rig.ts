// Binds glTF nodes to motion scalars. The glTF holds the rest pose; each moving node
// carries extras {motion: "rotate"|"translate", axis: [x,y,z] (glTF frame), unit}.
// Setting a value applies rest * (axis-angle | axis-offset), never accumulating.

import * as THREE from "three";

export type MotionNode = {
  node: THREE.Object3D;
  motion: "rotate" | "translate";
  axis: THREE.Vector3;
  restPos: THREE.Vector3;
  restQuat: THREE.Quaternion;
  labelEn: string;
  labelDe: string;
};

/** Node names the M0 page relies on. Renaming one in Blender is an API change. */
export const M0_NODES = {
  drumShaft: "pm.drum_shaft.0",
  drum: "pm.drum.0",
  rack: "pm.setting_rack.0",
  dial: "pm.setting_dial.0",
  wheel: "pi.sum_wheel.0",
  store: "pi.carry_store.0",
} as const;

export type M0Key = keyof typeof M0_NODES;

/** three.js strips reserved characters (including ".") from glTF node names on load. */
export const gltfName = (name: string) => THREE.PropertyBinding.sanitizeNodeName(name);

export class Rig<K extends string> {
  readonly parts = {} as Record<K, MotionNode>;
  private q = new THREE.Quaternion();

  constructor(root: THREE.Object3D, names: Record<K, string>) {
    const missing: string[] = [];
    for (const [key, name] of Object.entries(names) as [K, string][]) {
      const node = root.getObjectByName(gltfName(name));
      if (!node) {
        missing.push(name);
        continue;
      }
      const ex = node.userData as { motion?: string; axis?: number[]; label_en?: string; label_de?: string };
      if (ex.motion !== "rotate" && ex.motion !== "translate") {
        missing.push(`${name} (no motion extras)`);
        continue;
      }
      // The true rest pose is recorded on the node the first time any rig binds it,
      // so a second rig (e.g. ?selftest on an already-posed page) doesn't take the
      // current pose as its rest pose and double-apply offsets.
      const ud = node.userData as { __rest?: { pos: THREE.Vector3; quat: THREE.Quaternion } };
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

  /** Rotation in degrees, translation in millimetres (the glTF is in metres). */
  set(key: K, value: number): void {
    const p = this.parts[key];
    if (p.motion === "rotate") {
      this.q.setFromAxisAngle(p.axis, THREE.MathUtils.degToRad(value));
      p.node.quaternion.copy(p.restQuat).multiply(this.q);
    } else {
      p.node.position.copy(p.restPos).addScaledVector(p.axis, value / 1000);
    }
  }
}
