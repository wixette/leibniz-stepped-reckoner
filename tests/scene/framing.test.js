// Framing (docs/ui-design.md, U10): whatever the shape of the canvas, the subject sits inside
// the free area between the stage's bands, centred, filling 90% of the free area's limiting side.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";
import { centreOnFreeArea, corners, frame, silhouette } from "../../js/scene/framing.js";

// About the machine's size and the overview's direction.
const box = new THREE.Box3(new THREE.Vector3(-0.68, -0.02, -0.17), new THREE.Vector3(0.14, 0.24, 0.16));
const dir = new THREE.Vector3(0.35, 0.42, 0.62);
const insets = { top: 84, right: 12, bottom: 56, left: 12 };

/** @type {[string, number, number][]} */
const CANVASES = [
  ["laptop with the dock on the right", 960, 620],
  ["wide and flat (dock below, short window)", 1600, 360],
  ["portrait", 700, 1000],
  ["phone", 375, 420],
];

describe("the subject fits the free area", () => {
  for (const [name, w, h] of CANVASES) {
    it(name, () => {
      const camera = new THREE.PerspectiveCamera(35, w / h, 0.002, 10);
      centreOnFreeArea(camera, w, h, insets);
      const pts = corners(box);
      const f = frame(camera, pts, dir, w, h, insets, 0.9);
      const s = silhouette(camera, f, pts, w, h);
      const free = { left: insets.left, right: w - insets.right, top: insets.top, bottom: h - insets.bottom };
      assert.ok(s.left >= free.left - 0.5 && s.right <= free.right + 0.5, `sides ${s.left.toFixed(1)}..${s.right.toFixed(1)} outside ${free.left}..${free.right}`);
      assert.ok(s.top >= free.top - 0.5 && s.bottom <= free.bottom + 0.5, `top/bottom ${s.top.toFixed(1)}..${s.bottom.toFixed(1)} outside ${free.top}..${free.bottom}`);
      const fillX = (s.right - s.left) / (free.right - free.left);
      const fillY = (s.bottom - s.top) / (free.bottom - free.top);
      assert.ok(Math.abs(Math.max(fillX, fillY) - 0.9) < 0.01, `fills ${fillX.toFixed(3)} × ${fillY.toFixed(3)}`);
      assert.ok(Math.abs((s.left + s.right) / 2 - (free.left + free.right) / 2) < 1, "centred across");
      assert.ok(Math.abs((s.top + s.bottom) / 2 - (free.top + free.bottom) / 2) < 1, "centred up and down");
    });
  }

  it("keeps the view's direction", () => {
    const camera = new THREE.PerspectiveCamera(35, 1.5, 0.002, 10);
    centreOnFreeArea(camera, 900, 600, insets);
    const f = frame(camera, corners(box), dir, 900, 600, insets);
    const got = f.position.clone().sub(f.target).normalize();
    assert.ok(got.angleTo(dir.clone().normalize()) < 1e-6);
  });

  it("frames a top-down view (looking almost straight down)", () => {
    const camera = new THREE.PerspectiveCamera(35, 1.5, 0.002, 10);
    centreOnFreeArea(camera, 900, 600, insets);
    const pts = corners(box);
    const f = frame(camera, pts, { x: 0, y: 1, z: 0.12 }, 900, 600, insets);
    const s = silhouette(camera, f, pts, 900, 600);
    assert.ok(s.left >= insets.left - 0.5 && s.right <= 900 - insets.right + 0.5 && s.top >= insets.top - 0.5 && s.bottom <= 600 - insets.bottom + 0.5);
  });
});
