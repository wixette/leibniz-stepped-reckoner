// Scene helpers for the teaching page (M3): camera views, highlights, callout labels and
// the exploded view. The exploded view and the highlight matching are also used by the
// acceptance checks (A3-3, A3-5), so they do not touch the DOM.

import * as THREE from "three";
import type { ViewName } from "../teach/player";
import { gltfName } from "./rig";

// ---- node matching ------------------------------------------------------------------------------
/** Nodes for a Blender name ("pm.drum.0") or group ("pm.drum.*": that base name plus a number). */
export function findNodes(root: THREE.Object3D, pattern: string): THREE.Object3D[] {
  if (!pattern.endsWith(".*")) {
    const n = root.getObjectByName(gltfName(pattern));
    return n ? [n] : [];
  }
  const re = new RegExp(`^${gltfName(pattern.slice(0, -2))}\\d+$`);
  const out: THREE.Object3D[] = [];
  root.traverse((o) => re.test(o.name) && out.push(o));
  return out;
}

const shown = (o: THREE.Object3D) => {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
};
export { shown as isShown };

// ---- camera views -------------------------------------------------------------------------------
type View = [THREE.Vector3Like, THREE.Vector3Like];

/** Camera position looking at target from direction dir, far enough to fit a sphere of radius r (m). */
export function fitView(camera: THREE.PerspectiveCamera, target: THREE.Vector3Like, dir: THREE.Vector3Like, r: number): View {
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const d = r / Math.sin(Math.min(vfov, hfov) / 2);
  const p = new THREE.Vector3().copy(dir).normalize().multiplyScalar(d).add(target);
  return [p, new THREE.Vector3().copy(target)];
}

/** The page's camera views. Views of carriage parts follow the carriage. */
export function makeViews(camera: THREE.PerspectiveCamera, root: THREE.Object3D): Record<ViewName, () => View> {
  const at = (name: string) => {
    const n = findNodes(root, name)[0];
    n.updateWorldMatrix(true, false);
    return new THREE.Vector3().setFromMatrixPosition(n.matrixWorld);
  };
  const mid = (a: string, b: string) => at(a).add(at(b)).multiplyScalar(0.5);
  return {
    overview: () => fitView(camera, { x: -0.27, y: 0.02, z: 0 }, { x: 0.35, y: 0.42, z: 0.62 }, 0.45),
    register: () => fitView(camera, { x: -0.28, y: 0.084, z: -0.066 }, { x: 0, y: 1, z: 0.12 }, 0.32),
    knobs: () => fitView(camera, mid("pm.setting_dial.0", "pm.setting_dial.7"), { x: 0, y: 1.1, z: 0.8 }, 0.16),
    front: () => fitView(camera, at("pm.magna_rota"), { x: 0.12, y: 0.15, z: 1 }, 0.1),
    drum: () => fitView(camera, at("pm.drum.0").add(new THREE.Vector3(0, 0.02, -0.02)), { x: 0.7, y: 0.55, z: 0.75 }, 0.07),
    carry: () => fitView(camera, mid("pi.carry_store.0", "pi.carry_store.3"), { x: -0.15, y: 0.9, z: -0.75 }, 0.1),
  };
}

// ---- highlight and focus ------------------------------------------------------------------------
const GLOW = new THREE.Color(0xffa31a);

/** Makes some parts glow and (with focus) fades the rest. Materials are cloned, never edited. */
export class Highlighter {
  private originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();

  constructor(private root: THREE.Object3D) {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) this.originals.set(m, m.material);
    });
  }

  set(patterns: string[], focus: boolean): void {
    const lit = new Set<THREE.Mesh>();
    for (const p of patterns) for (const n of findNodes(this.root, p)) n.traverse((o) => (o as THREE.Mesh).isMesh && lit.add(o as THREE.Mesh));
    for (const [mesh, orig] of this.originals) {
      const on = lit.has(mesh);
      const fade = focus && lit.size > 0 && !on;
      if (!on && !fade) {
        mesh.material = orig;
        continue;
      }
      const edit = (m: THREE.Material): THREE.Material => {
        const c = m.clone() as THREE.MeshStandardMaterial;
        if (on && c.emissive) {
          c.emissive = GLOW.clone();
          c.emissiveIntensity = 0.45;
        }
        if (fade) {
          c.transparent = true;
          c.opacity = 0.15;
          c.depthWrite = false;
        }
        return c;
      };
      mesh.material = Array.isArray(orig) ? orig.map(edit) : edit(orig);
    }
  }
}

// ---- callouts -----------------------------------------------------------------------------------
export type CalloutItem = { node: string; text: string };
/** The current value of a part (glTF node name), shown in a chip beside the name. */
export type ValueOf = (node: string) => { value: string | null; red?: boolean } | null;

/** Fill a label element: the name, then the value in its own chip (never mixed into the name). */
export function fillLabel(el: HTMLElement, name: string, value: string | null, red = false): void {
  let n = el.querySelector<HTMLSpanElement>(".name");
  let v = el.querySelector<HTMLSpanElement>(".val");
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
  private items: { nodes: THREE.Object3D[]; el: HTMLDivElement; text: string }[] = [];
  valueOf: ValueOf = () => null;
  private box = new THREE.Box3();
  private v = new THREE.Vector3();

  constructor(private host: HTMLElement, private camera: THREE.Camera, private root: THREE.Object3D) {}

  set(items: CalloutItem[]): void {
    for (const it of this.items) it.el.remove();
    this.items = items.map((c) => {
      const el = document.createElement("div");
      el.className = "callout";
      this.host.appendChild(el);
      return { nodes: findNodes(this.root, c.node), el, text: c.text };
    });
  }

  update(): void {
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
  readonly parts: { node: THREE.Object3D; offset: THREE.Vector3 }[] = [];
  private applied = new Map<THREE.Object3D, THREE.Vector3>();
  factor = 0;

  constructor(root: THREE.Object3D) {
    root.traverse((o) => {
      const e = (o.userData as { explode?: number[] }).explode;
      if (Array.isArray(e) && e.length === 3) this.parts.push({ node: o, offset: new THREE.Vector3(e[0], e[1], e[2]).multiplyScalar(0.001) });
    });
  }

  /** Take the current offsets out again (before the rig poses the machine). */
  remove(): void {
    for (const [node, off] of this.applied) node.position.sub(off);
    this.applied.clear();
  }

  apply(factor = this.factor): void {
    this.remove();
    this.factor = factor;
    if (factor === 0) return;
    for (const p of this.parts) {
      const off = p.offset.clone().multiplyScalar(factor);
      p.node.position.add(off);
      this.applied.set(p.node, off);
    }
  }

  /** Pose the machine with the exploded offsets kept on top. */
  pose(applyPose: () => void): void {
    this.remove();
    applyPose();
    this.apply();
  }
}
