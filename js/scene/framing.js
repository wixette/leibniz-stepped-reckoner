// Framing a subject in the 3D view (docs/ui-design.md, U10). The stage's readouts and tools
// float over the canvas, so the subject is fitted into the free area between them, not into
// the whole canvas: as large as it can be while all of it shows, filling a share (90%) of
// whichever side of the free area runs out first ("contain"). The camera keeps its view's
// direction; only its distance and its sideways position change.
//
// The free area is usually off-centre (the bands above and below differ), so the camera gets a
// view offset that puts its centre, where the orbit target appears, at the free area's centre.
// Then the subject sits in the middle of the free area and orbiting pivots around it.
// Pure: no DOM, so the tests check it in Node.

import * as THREE from "three";

/**
 * The parts of the canvas the subject must stay clear of, in CSS pixels from each edge.
 * @typedef {{ top: number; right: number; bottom: number; left: number }} Insets
 */

/**
 * @typedef {object} Framing
 * @property {THREE.Vector3} position camera position
 * @property {THREE.Vector3} target where the camera looks (and orbits around)
 */

const UP = new THREE.Vector3(0, 1, 0);

/**
 * The view offset that puts the camera's centre at the centre of the free area.
 * @param {THREE.PerspectiveCamera} camera
 * @param {number} width canvas width (px)
 * @param {number} height canvas height (px)
 * @param {Insets} insets
 */
export function centreOnFreeArea(camera, width, height, insets) {
  const dx = (insets.left - insets.right) / 2;
  const dy = (insets.top - insets.bottom) / 2;
  // Rendering the window (x, y) of a full image of the same size moves the content by (-x, -y).
  camera.setViewOffset(width, height, -dx, -dy, width, height);
}

/**
 * The 8 corners of a box.
 * @param {THREE.Box3} box
 * @returns {THREE.Vector3[]}
 */
export function corners(box) {
  const { min, max } = box;
  /** @type {THREE.Vector3[]} */
  const out = [];
  for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) out.push(new THREE.Vector3(x, y, z));
  return out;
}

/**
 * Where to put the camera so that the points, seen from direction dir, fill `fill` of the free
 * area's limiting side, centred in it. The camera's projection must already carry the view
 * offset of centreOnFreeArea() (only its fov and aspect are read here).
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.Vector3[]} points the subject (e.g. its bounding box's corners)
 * @param {THREE.Vector3Like} dir from the subject towards the camera
 * @param {number} width canvas width (px)
 * @param {number} height canvas height (px)
 * @param {Insets} insets
 * @param {number} [fill] share of the free area's limiting side the subject fills
 * @returns {Framing}
 */
export function frame(camera, points, dir, width, height, insets, fill = 0.9) {
  // Camera axes as camera.lookAt() makes them with the world's up: z back towards the camera.
  const z = new THREE.Vector3().copy(dir).normalize();
  const x = new THREE.Vector3().crossVectors(UP, z);
  if (x.lengthSq() < 1e-8) x.set(1, 0, 0); // looking straight down: keep the world's x
  x.normalize();
  const y = new THREE.Vector3().crossVectors(z, x);

  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const tanH = tanV * (width / Math.max(1, height));
  // Half-size of the target rectangle, as a share of the canvas's half-size.
  const halfX = (fill * Math.max(1, width - insets.left - insets.right)) / width;
  const halfY = (fill * Math.max(1, height - insets.top - insets.bottom)) / height;

  const target = new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
  const radius = Math.max(1e-6, ...points.map((p) => p.distanceTo(target)));
  let distance = radius / Math.min(tanV * halfY, tanH * halfX); // a first guess: the bounding sphere
  const v = new THREE.Vector3();
  for (let i = 0; i < 40; i++) {
    const camPos = target.clone().addScaledVector(z, distance);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      v.subVectors(p, camPos);
      const depth = Math.max(1e-6, -v.dot(z));
      const u = v.dot(x) / (depth * tanH);
      const w = v.dot(y) / (depth * tanV);
      minX = Math.min(minX, u);
      maxX = Math.max(maxX, u);
      minY = Math.min(minY, w);
      maxY = Math.max(maxY, w);
    }
    // Centre the silhouette (move the camera and its target sideways together) ...
    target.addScaledVector(x, ((minX + maxX) / 2) * distance * tanH).addScaledVector(y, ((minY + maxY) / 2) * distance * tanV);
    // ... and scale it to the limiting side (the silhouette's size goes as 1 / distance).
    const s = Math.max((maxX - minX) / (2 * halfX), (maxY - minY) / (2 * halfY));
    if (Math.abs(s - 1) < 1e-4 && Math.abs(minX + maxX) < 1e-4 && Math.abs(minY + maxY) < 1e-4) break;
    distance *= s;
  }
  return { position: target.clone().addScaledVector(z, distance), target };
}

/**
 * Where a set of points lands on the canvas (CSS px) seen from a framing: for tests and checks.
 * @param {THREE.PerspectiveCamera} camera with its view offset set
 * @param {Framing} f
 * @param {THREE.Vector3[]} points
 * @param {number} width
 * @param {number} height
 * @returns {{ left: number; right: number; top: number; bottom: number }}
 */
export function silhouette(camera, f, points, width, height) {
  camera.position.copy(f.position);
  camera.lookAt(f.target);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const p of points) {
    const q = p.clone().project(camera);
    const px = ((q.x + 1) / 2) * width;
    const py = ((1 - q.y) / 2) * height;
    left = Math.min(left, px);
    right = Math.max(right, px);
    top = Math.min(top, py);
    bottom = Math.max(bottom, py);
  }
  return { left, right, top, bottom };
}
