// Geometry helpers for acceptance checks. Plain three.js + three-mesh-bvh, no
// rendering, so they run both in Node (Vitest) and in the page (?selftest).
// All lengths here are in millimetres; the glTF itself is in metres.

import * as THREE from "three";
import { acceleratedRaycast, MeshBVH } from "three-mesh-bvh";
import { gltfName } from "../scene/rig";

const M = 1000; // m -> mm

export type CheckResult = { id: string; title: string; passed: boolean; detail: string };

/** Find a node by its Blender name (dots are stripped by three.js). */
export function node(root: THREE.Object3D, blenderName: string): THREE.Object3D {
  const n = root.getObjectByName(gltfName(blenderName));
  if (!n) throw new Error(`node ${blenderName} not found`);
  return n;
}

const isPart = (o: THREE.Object3D) => {
  const ud = o.userData as { motion?: string };
  return ud.motion !== undefined;
};

/** Meshes that belong to this part, not to a moving child part (e.g. drum shaft vs drum). */
export function ownMeshes(part: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  const walk = (o: THREE.Object3D) => {
    for (const c of o.children) {
      if (isPart(c)) continue;
      if ((c as THREE.Mesh).isMesh) out.push(c as THREE.Mesh);
      walk(c);
    }
  };
  if ((part as THREE.Mesh).isMesh) out.push(part as THREE.Mesh);
  walk(part);
  return out;
}

const bvhCache = new WeakMap<THREE.BufferGeometry, MeshBVH>();
function bvh(g: THREE.BufferGeometry): MeshBVH {
  let b = bvhCache.get(g);
  if (!b) {
    // indirect: GLTFLoader shares index buffers between identical primitives, and a
    // default BVH reorders the index in place (invalidating BVHs built earlier).
    b = new MeshBVH(g, { indirect: true });
    // three-mesh-bvh only uses a fast BVH-vs-BVH traversal when the *other*
    // geometry also carries its tree as geometry.boundsTree.
    (g as THREE.BufferGeometry & { boundsTree?: MeshBVH }).boundsTree = b;
    bvhCache.set(g, b);
  }
  return b;
}

function refresh(root: THREE.Object3D) {
  let top = root;
  while (top.parent) top = top.parent;
  top.updateMatrixWorld(true);
}

/** Distances beyond this are reported as Infinity; checks only care about the near field. */
const MAX_QUERY_M = 0.005;
const hitA = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 };
const hitB = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 };

/** Minimum distance (mm) between the meshes of two parts at their current pose
 *  (Infinity when farther apart than 5 mm). */
export function minDistance(a: THREE.Object3D, b: THREE.Object3D): number {
  refresh(a);
  const inv = new THREE.Matrix4();
  const rel = new THREE.Matrix4();
  let best = Infinity;
  for (const ma of ownMeshes(a)) {
    inv.copy(ma.matrixWorld).invert();
    for (const mb of ownMeshes(b)) {
      rel.multiplyMatrices(inv, mb.matrixWorld);
      bvh(mb.geometry);
      const hit = bvh(ma.geometry).closestPointToGeometry(mb.geometry, rel, hitA, hitB, 0, MAX_QUERY_M);
      if (hit) best = Math.min(best, hit.distance);
    }
  }
  return best * M;
}

/** True when any mesh of part a intersects any mesh of part b. */
export function intersects(a: THREE.Object3D, b: THREE.Object3D): boolean {
  refresh(a);
  const inv = new THREE.Matrix4();
  const rel = new THREE.Matrix4();
  for (const ma of ownMeshes(a)) {
    inv.copy(ma.matrixWorld).invert();
    for (const mb of ownMeshes(b)) {
      rel.multiplyMatrices(inv, mb.matrixWorld);
      bvh(mb.geometry);
      if (bvh(ma.geometry).intersectsGeometry(mb.geometry, rel)) return true;
    }
  }
  return false;
}

/** Anchor points declared by the build (extras[key], node-local metres) in world space. */
export function anchors(part: THREE.Object3D, key: string): THREE.Vector3[] {
  const flat = (part.userData as Record<string, unknown>)[key];
  if (!Array.isArray(flat) || flat.length % 3) throw new Error(`${part.name} has no anchors "${key}"`);
  refresh(part);
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < flat.length; i += 3) {
    out.push(new THREE.Vector3(flat[i], flat[i + 1], flat[i + 2]).applyMatrix4(part.matrixWorld));
  }
  return out;
}

export function nearestIndex(points: THREE.Vector3[], p: THREE.Vector3): number {
  let best = -1;
  let bestD = Infinity;
  points.forEach((q, i) => {
    const d = q.distanceToSquared(p);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

export type RayHit = { mesh: THREE.Mesh; material: string; point: THREE.Vector3; distanceMm: number };

// Ray casts use a mesh's BVH when it has one (built below); others fall back to three.js.
THREE.Mesh.prototype.raycast = acceleratedRaycast;

/** Ray cast against the given parts; returns hits sorted by distance. */
export function rayHits(targets: THREE.Object3D[], origin: THREE.Vector3, dir: THREE.Vector3): RayHit[] {
  targets.forEach(refresh);
  for (const t of targets) t.traverse((o) => (o as THREE.Mesh).isMesh && bvh((o as THREE.Mesh).geometry));
  const rc = new THREE.Raycaster(origin, dir.clone().normalize());
  const hits = rc.intersectObjects(targets, true);
  return hits
    .filter((h) => (h.object as THREE.Mesh).isMesh)
    .map((h) => {
      const mesh = h.object as THREE.Mesh;
      const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      return { mesh, material: mat.name, point: h.point.clone(), distanceMm: h.distance * M };
    });
}

/** Signed angle (deg) of the segment a->b against the horizontal plane (world +Y up). */
export function slopeDeg(a: THREE.Vector3, b: THREE.Vector3): number {
  const dy = b.y - a.y;
  const dh = Math.hypot(b.x - a.x, b.z - a.z);
  return THREE.MathUtils.radToDeg(Math.atan2(dy, dh));
}

/** Tilt (deg) of the highest edge of a convex polygon given its world corners. */
export function topEdgeTilt(corners: THREE.Vector3[]): number {
  const sorted = [...corners].sort((p, q) => q.y - p.y);
  return Math.abs(slopeDeg(sorted[0], sorted[1]));
}

export function result(id: string, title: string, passed: boolean, detail: string): CheckResult {
  return { id, title, passed, detail };
}

export const fmt = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
