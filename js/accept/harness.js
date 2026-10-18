// Geometry helpers for acceptance checks. Plain three.js + three-mesh-bvh, no
// rendering, so they run both in Node (node --test) and in the page (?selftest).
// All lengths here are in millimetres; the glTF itself is in metres.

import * as THREE from "three";
import { acceleratedRaycast, MeshBVH } from "three-mesh-bvh";
import { gltfName } from "../scene/rig.js";

const M = 1000; // m -> mm

/**
 * @typedef {object} CheckResult
 * @property {string} id
 * @property {string} title
 * @property {boolean} passed
 * @property {string} detail
 */

/**
 * Find a node by its Blender name (dots are stripped by three.js).
 * @param {THREE.Object3D} root
 * @param {string} blenderName
 * @returns {THREE.Object3D}
 */
export function node(root, blenderName) {
  const n = root.getObjectByName(gltfName(blenderName));
  if (!n) throw new Error(`node ${blenderName} not found`);
  return n;
}

/** @param {THREE.Object3D} o */
const isPart = (o) => {
  const ud = /** @type {{ motion?: string }} */ (o.userData);
  return ud.motion !== undefined;
};

/**
 * Meshes that belong to this part, not to a moving child part (e.g. drum shaft vs drum).
 * @param {THREE.Object3D} part
 * @returns {THREE.Mesh[]}
 */
export function ownMeshes(part) {
  /** @type {THREE.Mesh[]} */
  const out = [];
  /** @param {THREE.Object3D} o */
  const walk = (o) => {
    for (const c of o.children) {
      if (isPart(c)) continue;
      if ((/** @type {THREE.Mesh} */ (c)).isMesh) out.push(/** @type {THREE.Mesh} */ (c));
      walk(c);
    }
  };
  if ((/** @type {THREE.Mesh} */ (part)).isMesh) out.push(/** @type {THREE.Mesh} */ (part));
  walk(part);
  return out;
}

/** @type {WeakMap<THREE.BufferGeometry, MeshBVH>} */
const bvhCache = new WeakMap();
/**
 * @param {THREE.BufferGeometry} g
 * @returns {MeshBVH}
 */
function bvh(g) {
  let b = bvhCache.get(g);
  if (!b) {
    // indirect: GLTFLoader shares index buffers between identical primitives, and a
    // default BVH reorders the index in place (invalidating BVHs built earlier).
    b = new MeshBVH(g, { indirect: true });
    // three-mesh-bvh only uses a fast BVH-vs-BVH traversal when the *other*
    // geometry also carries its tree as geometry.boundsTree.
    (/** @type {THREE.BufferGeometry & { boundsTree?: MeshBVH }} */ (g)).boundsTree = b;
    bvhCache.set(g, b);
  }
  return b;
}

/** @param {THREE.Object3D} root */
function refresh(root) {
  let top = root;
  while (top.parent) top = top.parent;
  top.updateMatrixWorld(true);
}

/** Distances beyond this are reported as Infinity; checks only care about the near field. */
const MAX_QUERY_M = 0.005;
const hitA = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 };
const hitB = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 };

/**
 * Minimum distance (mm) between the meshes of two parts at their current pose
 *  (Infinity when farther apart than 5 mm).
 * @param {THREE.Object3D} a
 * @param {THREE.Object3D} b
 * @returns {number}
 */
export function minDistance(a, b) {
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

/**
 * True when any mesh of part a intersects any mesh of part b.
 * @param {THREE.Object3D} a
 * @param {THREE.Object3D} b
 * @returns {boolean}
 */
export function intersects(a, b) {
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

/**
 * Anchor points declared by the build (extras[key], node-local metres) in world space.
 * @param {THREE.Object3D} part
 * @param {string} key
 * @returns {THREE.Vector3[]}
 */
export function anchors(part, key) {
  const flat = (/** @type {Record<string, unknown>} */ (part.userData))[key];
  if (!Array.isArray(flat) || flat.length % 3) throw new Error(`${part.name} has no anchors "${key}"`);
  refresh(part);
  /** @type {THREE.Vector3[]} */
  const out = [];
  for (let i = 0; i < flat.length; i += 3) {
    out.push(new THREE.Vector3(flat[i], flat[i + 1], flat[i + 2]).applyMatrix4(part.matrixWorld));
  }
  return out;
}

/**
 * @param {THREE.Vector3[]} points
 * @param {THREE.Vector3} p
 * @returns {number}
 */
export function nearestIndex(points, p) {
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

/**
 * @typedef {object} RayHit
 * @property {THREE.Mesh} mesh
 * @property {string} material
 * @property {THREE.Vector3} point
 * @property {number} distanceMm
 */

// Ray casts use a mesh's BVH when it has one (built below); others fall back to three.js.
THREE.Mesh.prototype.raycast = acceleratedRaycast;

/**
 * Ray cast against the given parts; returns hits sorted by distance.
 * @param {THREE.Object3D[]} targets
 * @param {THREE.Vector3} origin
 * @param {THREE.Vector3} dir
 * @returns {RayHit[]}
 */
export function rayHits(targets, origin, dir) {
  targets.forEach(refresh);
  for (const t of targets) t.traverse((o) => (/** @type {THREE.Mesh} */ (o)).isMesh && bvh((/** @type {THREE.Mesh} */ (o)).geometry));
  const rc = new THREE.Raycaster(origin, dir.clone().normalize());
  const hits = rc.intersectObjects(targets, true);
  return hits
    .filter((h) => (/** @type {THREE.Mesh} */ (h.object)).isMesh)
    .map((h) => {
      const mesh = /** @type {THREE.Mesh} */ (h.object);
      const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      return { mesh, material: mat.name, point: h.point.clone(), distanceMm: h.distance * M };
    });
}

/**
 * Signed angle (deg) of the segment a->b against the horizontal plane (world +Y up).
 * @param {THREE.Vector3} a
 * @param {THREE.Vector3} b
 * @returns {number}
 */
export function slopeDeg(a, b) {
  const dy = b.y - a.y;
  const dh = Math.hypot(b.x - a.x, b.z - a.z);
  return THREE.MathUtils.radToDeg(Math.atan2(dy, dh));
}

/**
 * Tilt (deg) of the highest edge of a convex polygon given its world corners.
 * @param {THREE.Vector3[]} corners
 * @returns {number}
 */
export function topEdgeTilt(corners) {
  const sorted = [...corners].sort((p, q) => q.y - p.y);
  return Math.abs(slopeDeg(sorted[0], sorted[1]));
}

/**
 * @param {string} id
 * @param {string} title
 * @param {boolean} passed
 * @param {string} detail
 * @returns {CheckResult}
 */
export function result(id, title, passed, detail) {
  return { id, title, passed, detail };
}

/** @param {number} x */
export const fmt = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
