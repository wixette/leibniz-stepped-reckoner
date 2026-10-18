// Minimal three.js viewer: renderer, camera, orbit controls, studio lighting.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * Studio environment for the metals: a warm grey dome (light above, a lighter table below) with
 * softboxes above-left, to the right, in front and below the front (so the carriage front and
 * the Magna Rota catch a reflection) and a strip behind for rim highlights. Brass and steel take their
 * look almost entirely from what they reflect.
 */
function studioEnvironment(): THREE.Scene {
  const env = new THREE.Scene();
  const dome = new THREE.SphereGeometry(10, 32, 16);
  const pos = dome.getAttribute("position");
  const colours: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / 10; // -1 (floor) .. 1 (top)
    const v = h >= 0 ? 0.38 + 0.32 * h : 0.38 - 0.16 * h * h; // a mid-grey table below, not a black floor
    c.setRGB(v * 1.04, v, v * 0.92);
    colours.push(c.r, c.g, c.b);
  }
  dome.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  env.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true })));
  const box = (w: number, h: number, intensity: number, p: [number, number, number]) => {
    const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    m.color.setScalar(intensity);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    b.position.set(...p);
    b.lookAt(0, 0, 0);
    env.add(b);
  };
  box(5, 3, 9, [-3, 6, 3]); // key, above left
  box(1.2, 5, 6, [6, 2.5, 1]); // strip, right
  box(8, 2.5, 4, [0, 1.5, 7]); // front fill, low
  box(6, 2, 2.2, [1, -2.5, 6]); // bounce card below the front, for the vertical brass faces
  box(8, 1, 3, [0, 3, -6]); // rim, behind
  return env;
}

/** Parts smaller than this (bounding-sphere radius, m) do not cast shadows: digits, pins, hubs. */
const SHADOW_MIN_RADIUS = 0.012;
/** Below this frame rate while animating, "auto" quality drops to "lite" (once). */
const LITE_BELOW_FPS = 25;

export type Quality = "high" | "lite";

export class Viewer {
  readonly renderer: THREE.WebGLRenderer;
  /**
   * Render only when something changed (invalidate()), not 60 times a second: an idle page
   * then costs nothing. The developer pages 01/02 keep rendering every frame.
   */
  renderOnDemand = false;
  /** "auto" starts high and drops to lite when animation runs slowly. */
  qualityMode: Quality | "auto" = "auto";
  quality: Quality = "high";
  /** Frames actually rendered (for ?perf). */
  renderedFrames = 0;
  private dirty = true;
  private sceneDirty = true;
  private flying = 0;
  private slowFrames: number[] = [];
  private lastRender = 0;
  onQualityChange: ((q: Quality) => void) | null = null;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private onFrame: ((dt: number) => void)[] = [];
  private key: THREE.DirectionalLight;
  private timer = new THREE.Timer();

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Neutral keeps the hue of brass (ACES pushes yellows towards olive)
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.shadowMap.enabled = true;
    host.appendChild(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(studioEnvironment(), 0.02).texture;
    this.scene.background = new THREE.Color(0xe9e7e2);

    const key = new THREE.DirectionalLight(0xfff4e6, 1.2);
    key.position.set(0.25, 0.45, 0.3);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.05;
    key.shadow.camera.far = 1.5;
    Object.assign(key.shadow.camera, { left: -0.2, right: 0.2, top: 0.2, bottom: -0.2 });
    key.shadow.bias = -0.0005;
    this.scene.add(key);
    this.key = key;

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.002, 10);
    this.camera.position.set(0.32, 0.24, 0.3);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.06, 0.0);
    this.controls.enableDamping = true;

    this.controls.addEventListener("change", () => this.invalidate(false));
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.timer.connect(document);
    this.renderer.setAnimationLoop((time) => this.tick(time));
  }

  /** Fit the key light's shadow box around a model of the given half-size (metres) centred at c. */
  setShadowExtent(half: number, c: THREE.Vector3Like = { x: 0, y: 0, z: 0 }): void {
    const cam = this.key.shadow.camera;
    Object.assign(cam, { left: -half, right: half, top: half, bottom: -half, far: 4 * half + 1 });
    this.key.position.set(c.x + 0.25, c.y + 0.45, c.z + 0.3);
    this.key.target.position.set(c.x, c.y, c.z);
    this.scene.add(this.key.target);
    cam.updateProjectionMatrix();
  }

  async load(url: string): Promise<THREE.Group> {
    const gltf = await new GLTFLoader().loadAsync(url);
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.computeBoundingSphere();
      m.castShadow = (m.geometry.boundingSphere?.radius ?? 1) >= SHADOW_MIN_RADIUS;
      m.receiveShadow = true;
    });
    this.scene.add(gltf.scene);
    this.invalidate();
    return gltf.scene;
  }

  /**
   * Ask for a new frame (render-on-demand). sceneChanged = false for camera-only changes:
   * the shadow map is then reused, since the light and the parts did not move.
   */
  invalidate(sceneChanged = true): void {
    this.dirty = true;
    if (sceneChanged) this.sceneDirty = true;
  }

  /** Shadows on or off and the pixel ratio: "lite" for weak devices. */
  setQuality(q: Quality): void {
    if (q === this.quality) return;
    this.quality = q;
    this.renderer.shadowMap.enabled = q === "high";
    this.key.castShadow = q === "high";
    this.renderer.setPixelRatio(q === "high" ? Math.min(window.devicePixelRatio, 2) : 1);
    this.scene.traverse((o) => {
      const mats = (o as THREE.Mesh).isMesh ? ([] as THREE.Material[]).concat((o as THREE.Mesh).material) : [];
      for (const mt of mats) mt.needsUpdate = true; // shaders change with shadows on/off
    });
    this.resize();
    this.invalidate();
    this.onQualityChange?.(q);
  }

  addFrameCallback(cb: (dt: number) => void): void {
    this.onFrame.push(cb);
  }

  /** Smoothly move the camera to look at target from position (metres). */
  flyTo(position: THREE.Vector3Like, target: THREE.Vector3Like, seconds = 0.8): void {
    const p0 = this.camera.position.clone();
    const t0 = this.controls.target.clone();
    const p1 = new THREE.Vector3().copy(position);
    const t1 = new THREE.Vector3().copy(target);
    let t = 0;
    this.flying++;
    const step = (dt: number) => {
      t = Math.min(1, t + dt / seconds);
      const e = t * t * (3 - 2 * t);
      this.camera.position.lerpVectors(p0, p1, e);
      this.controls.target.lerpVectors(t0, t1, e);
      this.invalidate(false);
      if (t >= 1) {
        this.onFrame.splice(this.onFrame.indexOf(step), 1);
        this.flying--;
      }
    };
    this.onFrame.push(step);
  }

  private resize(): void {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.invalidate(false);
  }

  private tick(time: number): void {
    this.timer.update(time);
    // Clamp to 0..0.1 s: after a visibility change the timer can report a negative delta,
    // which would run animations backwards (an Add turned into a subtraction).
    const dt = Math.max(0, Math.min(0.1, this.timer.getDelta()));
    for (const cb of [...this.onFrame]) cb(dt);
    this.controls.update();
    if (!this.renderOnDemand) {
      this.draw(time);
      return;
    }
    if (!this.dirty) {
      this.lastRender = 0; // an idle gap is not a slow frame
      return;
    }
    // The shadow map only needs redrawing when parts moved, not when the camera did.
    this.renderer.shadowMap.autoUpdate = false;
    if (this.sceneDirty) this.renderer.shadowMap.needsUpdate = true;
    this.dirty = false;
    this.sceneDirty = false;
    this.draw(time);
  }

  private draw(time: number): void {
    this.renderer.render(this.scene, this.camera);
    this.renderedFrames++;
    // Auto quality: watch back-to-back frames (animation, orbiting); if they are slow,
    // drop shadows and the pixel ratio once.
    if (this.qualityMode === "auto" && this.quality === "high" && this.lastRender > 0) {
      this.slowFrames.push(time - this.lastRender);
      if (this.slowFrames.length > 60) this.slowFrames.shift();
      const avg = this.slowFrames.reduce((a, b) => a + b, 0) / this.slowFrames.length;
      if (this.slowFrames.length === 60 && avg > 1000 / LITE_BELOW_FPS) this.setQuality("lite");
    }
    this.lastRender = time;
  }
}
