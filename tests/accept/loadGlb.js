// Node-only: load a .glb from the machine's assets/ folder for acceptance tests.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
/** @import * as THREE from "three" */
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * @param {string} file
 * @returns {Promise<THREE.Group>}
 */
export async function loadAsset(file) {
  const path = fileURLToPath(new URL(`../../assets/${file}`, import.meta.url));
  const buf = readFileSync(path);
  if (buf.subarray(0, 4).toString("latin1") !== "glTF") {
    throw new Error(`${file} is not a glTF binary. Run "git lfs pull" (it may be an LFS pointer).`);
  }
  const ab = /** @type {ArrayBuffer} */ (buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  // Node has no image decoder; acceptance checks use geometry and material names only.
  const loader = new GLTFLoader().register(() => ({ name: "no_textures_in_node", loadTexture: () => Promise.resolve(/** @type {THREE.Texture} */ (/** @type {unknown} */ (null))) }));
  const gltf = await loader.parseAsync(ab, "");
  return gltf.scene;
}
