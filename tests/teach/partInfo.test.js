import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";
import "../../js/l10n/all.js";
import { ZONE_KEYS, zoneKey, zoneName } from "../../js/teach/partInfo.js";

describe("Named parts within a node (zones)", () => {
  const n = new THREE.Group();
  n.position.set(1, 0, 0);
  n.rotation.y = Math.PI / 2;
  n.userData.zone_keys = "part.pentagon,part.detentWheel";
  // node-local boxes (min xyz, max xyz); the second overlaps the first, which wins
  n.userData.zone_boxes = [0, 0, 0, 0.1, 0.1, 0.1, 0.05, 0, 0, 0.3, 0.1, 0.1];
  n.updateMatrixWorld(true);
  /** world point of a node-local one */
  const at = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ z) => n.localToWorld(new THREE.Vector3(x, y, z));

  it("finds the first zone holding the point, in the node's own frame", () => {
    assert.equal(zoneKey(n, at(0.02, 0.05, 0.05)), "part.pentagon");
    assert.equal(zoneKey(n, at(0.08, 0.05, 0.05)), "part.pentagon");
    assert.equal(zoneKey(n, at(0.2, 0.05, 0.05)), "part.detentWheel");
    assert.equal(zoneKey(n, at(0.5, 0.05, 0.05)), null);
    assert.equal(zoneKey(n, new THREE.Vector3(0.02, 0.05, 0.05)), null, "a world point not turned into the node's frame");
  });

  it("a node without zones has none", () => {
    assert.equal(zoneKey(new THREE.Group(), new THREE.Vector3()), null);
  });

  it("renames a label for its zone and keeps its place", () => {
    assert.equal(zoneName("Carry store · tens", "part.pentagon", "en").endsWith(" · tens"), true);
    assert.equal(zoneName("Carry store", "part.pentagon", "en").includes("·"), false);
    assert.notEqual(zoneName("x", "part.pentagon", "de"), zoneName("x", "part.pentagon", "en"));
  });

  it("every zone key has a message", () => {
    for (const k of ZONE_KEYS) assert.ok(!zoneName("", k, "en").startsWith("part."), k);
  });
});
