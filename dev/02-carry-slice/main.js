import * as THREE from "three";
import { runM1Checks } from "../../js/accept/m1Checks.js";
import { selftestRequested, showSelftest } from "../../js/accept/selftestPanel.js";
import { applyM1Pose, m1NodeNames } from "../../js/scene/m1Pose.js";
import { gltfName, Rig } from "../../js/scene/rig.js";
import { Viewer } from "../../js/scene/viewer.js";
import { CarrySlice } from "../../js/sim/carrySlice.js";
/** @import { CarryMode } from "../../js/sim/carrySlice.js" */
import * as K from "../../js/sim/kinematics.js";
import { describeStep, snapshotM1 } from "../../js/sim/narrate.js";
/** @import { Snapshot } from "../../js/sim/narrate.js" */

/**
 * @template {HTMLElement} [T=HTMLElement]
 * @param {string} id
 */
const $ = (id) => /** @type {T} */ (document.getElementById(id));

const machine = new CarrySlice();
const N = machine.n;
const viewer = new Viewer($("stage"));
const status = $("status");

// ---- camera presets (glTF frame: metres, +Y up, machine front toward +Z) ----
/** @type {Record<string, [THREE.Vector3Like, THREE.Vector3Like]>} */
const VIEWS = {
  overview: [{ x: 0.17, y: 0.3, z: 0.36 }, { x: -0.037, y: 0.06, z: -0.01 }],
  front: [{ x: -0.037, y: 0.17, z: 0.33 }, { x: -0.037, y: 0.07, z: 0 }],
  // From above, looking down between the window plate and the rear wall at the carry parts.
  carry: [{ x: -0.035, y: 0.3, z: 0.0 }, { x: -0.04, y: 0.06, z: -0.088 }],
};
viewer.camera.position.set(VIEWS.overview[0].x, VIEWS.overview[0].y, VIEWS.overview[0].z);
viewer.controls.target.set(VIEWS.overview[1].x, VIEWS.overview[1].y, VIEWS.overview[1].z);

// ---- crank animation ----------------------------------------------------------------
/** @type {number | null} */
let target = null;
/** @type {{ before: Snapshot; dir: 1 | -1 } | null} */
let stepping = null; // a Step in progress
/** @type {string | null} */
let lastStep = null; // "what just happened", shown until the next action
let speed = Number((/** @type {HTMLSelectElement} */ ($("speed"))).value);
const DEG_PER_SEC = 360;

viewer.addFrameCallback((dt) => {
  if (target === null) return;
  const cur = machine.theta;
  const delta = target - cur;
  const stepDeg = DEG_PER_SEC * speed * dt;
  const next = Math.abs(delta) <= stepDeg ? target : cur + Math.sign(delta) * stepDeg;
  const completed = machine.setTheta(next);
  if (completed || next === target) {
    target = null;
    if (stepping) {
      lastStep = describeStep(stepping.before, snapshotM1(machine), stepping.dir, { ribs: [K.RIB_START, K.ribWindowStart(9)], completed });
      stepping = null;
    }
  }
  render();
});

// ---- rendering --------------------------------------------------------------------------
/** @type {Rig<string> | null} */
let rig = null;
const windows = $("windows");
for (let i = N - 1; i >= 0; i--) {
  const w = document.createElement("div");
  w.className = "win";
  w.dataset.i = String(i);
  w.innerHTML = `<span class="big">0</span><span class="flag"></span>`;
  windows.appendChild(w);
}

function render() {
  if (rig) applyM1Pose(rig, machine.pose());
  const shown = machine.shownDigits();
  const states = machine.carryStates();
  for (const w of /** @type {NodeListOf<HTMLDivElement>} */ (windows.querySelectorAll(".win"))) {
    const i = Number(w.dataset.i);
    /** @type {HTMLElement} */ (w.querySelector(".big")).textContent = String(shown[i]);
    const st = states[i];
    w.classList.toggle("pending", st !== "idle");
    /** @type {HTMLElement} */ (w.querySelector(".flag")).textContent = st === "stored" ? "carry ▲" : st === "executing" ? "carrying" : "";
  }
  $("carryOut").textContent = String(machine.carryOutLive());
  $("turns").textContent = String(machine.turns);
  $("thetaOut").textContent = `${machine.theta.toFixed(1)}°`;
  (/** @type {HTMLInputElement} */ ($("theta"))).value = String(machine.theta);
  const input = /** @type {HTMLInputElement} */ ($("input"));
  input.disabled = !machine.atRest;
  if (document.activeElement !== input) input.value = String(settingNumber());
  for (const b of /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll("[data-preset]"))) b.disabled = !machine.atRest;
  $("modeRipple").classList.toggle("on", machine.mode === "ripple");
  $("modeHistorical").classList.toggle("on", machine.mode === "historical");
  (/** @type {HTMLButtonElement} */ ($("modeRipple"))).disabled = !machine.atRest;
  (/** @type {HTMLButtonElement} */ ($("modeHistorical"))).disabled = !machine.atRest;
  $("modeHint").textContent =
    machine.mode === "ripple"
      ? "Levers act units first: a carry that creates another carry is passed on in the same turn (a ripple-carry adder)."
      : "Levers act highest digit first: a carry created by a carry waits, pentagon tilted, until the next turn (as GWLB describe the original).";
  const phase = $("phase");
  phase.textContent = lastStep ? `Step: ${lastStep}` : phaseText(states);
  phase.classList.toggle("active", states.some((s) => s !== "idle"));
}

const settingNumber = () => machine.settings.reduce((a, s, i) => a + s * 10 ** i, 0);

/**
 * @param {("idle" | "stored" | "executing")[]} states
 * @returns {string}
 */
function phaseText(states) {
  const th = machine.theta;
  const exec = states.findIndex((s) => s === "executing");
  const stored = states.map((s, i) => (s === "stored" ? i : -1)).filter((i) => i >= 0);
  /** @param {number} i */
  const name = (i) => ["units", "tens", "hundreds"][i] ?? `digit ${i}`;
  if (exec >= 0) {
    return exec + 1 < N
      ? `The ${name(exec)} carry lever (Zweihorn) pushes its store a full horn: its Muldenrad turns the ${name(exec + 1)} wheel one step.`
      : `The ${name(exec)} carry lever pushes its store: the carry leaves the slice (it would turn the next digit).`;
  }
  if (th === 0) {
    const pend = stored.length ? ` Stored carries are waiting at: ${stored.map(name).join(", ")} — turn again (input 0) to finish them.` : "";
    return `At rest. Input ${settingNumber()}: one forward turn adds it, one backward turn subtracts it.${pend}`;
  }
  const t = Math.abs(th);
  if (t < K.RIB_START) return "Free arc: drums turn, no rib reaches a gear yet.";
  if (t < K.ribWindowStart(9)) {
    // A window's end belongs to that window (it has just been passed), not the next one.
    const w = Math.max(0, Math.floor((t - K.RIB_START - 1e-6) / K.RIB_PITCH));
    const k = th >= 0 ? w + 1 : 9 - w;
    const s = stored.length ? ` Carry stored at ${stored.map(name).join(", ")} (pentagon tilted), waiting for the carry window.` : "";
    return `Rib ${k} of 9 is passing: every digit whose input is ≥ ${10 - k} advances one step.${s}`;
  }
  if (stored.length) return `Carry window: carry stored at ${stored.map(name).join(", ")}, waiting for its lever.`;
  return "Ribs done; the rest of the turn is the carry window.";
}

// ---- controls ------------------------------------------------------------------------------
const clearStep = () => {
  stepping = null;
  lastStep = null;
};
/** @param {1 | -1} dir */
function turn(dir) {
  if (machine.theta !== 0 && Math.sign(machine.theta) !== dir) return;
  clearStep();
  target = dir * 360;
}
/**
 * Turn the crank (forward = adding, backward = subtracting) to the next completed change.
 * @param {1 | -1} dir
 */
function step(dir) {
  if (target !== null) return; // let the current step finish first
  if (machine.theta !== 0 && Math.sign(machine.theta) !== dir) return;
  const t = Math.abs(machine.theta);
  const next = machine.stepStops(dir).find((a) => a > t + 1e-6) ?? 360;
  stepping = { before: snapshotM1(machine), dir };
  lastStep = null;
  target = dir * next;
}
$("add").addEventListener("click", () => turn(1));
$("sub").addEventListener("click", () => turn(-1));
$("stepAdd").addEventListener("click", () => step(1));
$("stepSub").addEventListener("click", () => step(-1));
$("speed").addEventListener("change", (e) => (speed = Number((/** @type {HTMLSelectElement} */ (e.target)).value)));
$("theta").addEventListener("input", (e) => {
  target = null;
  clearStep();
  machine.setTheta(Number((/** @type {HTMLInputElement} */ (e.target)).value));
  render();
});
$("input").addEventListener("change", (e) => {
  const x = Math.max(0, Math.min(999, Math.floor(Number((/** @type {HTMLInputElement} */ (e.target)).value) || 0)));
  machine.setNumber(x);
  clearStep();
  render();
});
for (const b of /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll("[data-preset]"))) {
  b.addEventListener("click", () => {
    const [result, input] = /** @type {string} */ (b.dataset.preset).split(",").map(Number);
    target = null;
    clearStep();
    const mode = machine.mode;
    machine.reset();
    machine.setMode(mode);
    machine.setResult(result);
    machine.setNumber(input);
    render();
  });
}
/** @param {CarryMode} m */
const setMode = (m) => {
  if (machine.setMode(m)) {
    clearStep();
    render();
  }
};
$("modeRipple").addEventListener("click", () => setMode("ripple"));
$("modeHistorical").addEventListener("click", () => setMode("historical"));
$("reset").addEventListener("click", () => {
  target = null;
  clearStep();
  const mode = machine.mode;
  machine.reset();
  machine.setMode(mode);
  render();
});
for (const b of /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll("[data-view]"))) {
  b.addEventListener("click", () => viewer.flyTo(...VIEWS[/** @type {string} */ (b.dataset.view)]));
}

// ---- didactic colouring ----------------------------------------------------------------------
/** @type {[RegExp, number][]} */
const FUNCTION_COLOURS = [
  [/^pm(setting_dial|setting_rack|setting_plate)/, 0x3d6fd6],
  [/^pmdrum/, 0x8a4fd1],
  [/^pisum_wheel/, 0x2f9e5b],
  [/^picarry_store/, 0xe0782c],
  [/^pm(lever|zweihorn)/, 0xc2412d],
];
const KEEP = new Set(["ink_black", "enamel_white"]);
/** @type {Map<THREE.Mesh, THREE.Material | THREE.Material[]>} */
const originals = new Map();
/**
 * @param {THREE.Object3D} root
 * @param {boolean} on
 */
function applyDidactic(root, on) {
  root.traverse((o) => {
    const mesh = /** @type {THREE.Mesh} */ (o);
    if (!mesh.isMesh) return;
    if (!originals.has(mesh)) originals.set(mesh, mesh.material);
    const orig = /** @type {THREE.Material | THREE.Material[]} */ (originals.get(mesh));
    if (!on) {
      mesh.material = orig;
      return;
    }
    /** @type {THREE.Object3D | null} */
    let owner = mesh;
    while (owner && !FUNCTION_COLOURS.some(([re]) => re.test(/** @type {THREE.Object3D} */ (owner).name)) && owner.parent) owner = owner.parent;
    const hit = FUNCTION_COLOURS.find(([re]) => owner && re.test(owner.name));
    /**
     * @param {THREE.Material} m
     * @returns {THREE.Material}
     */
    const recolour = (m) => {
      if (KEEP.has(m.name)) return m;
      if (!hit) {
        const g = new THREE.MeshStandardMaterial({ color: 0xbdb8ad, transparent: true, opacity: 0.3, roughness: 0.8 });
        g.depthWrite = false;
        return g;
      }
      return new THREE.MeshStandardMaterial({ color: hit[1], roughness: 0.55, metalness: 0.1 });
    };
    mesh.material = Array.isArray(orig) ? orig.map(recolour) : recolour(orig);
  });
}

// ---- hover labels ------------------------------------------------------------------------------
const hover = $("hover");
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
/**
 * @param {THREE.Object3D | null} o
 * @returns {string | null}
 */
function labelFor(o) {
  for (let n = o; n; n = n.parent) {
    const ud = /** @type {{ label_en?: string }} */ (n.userData);
    if (ud.label_en) return ud.label_en;
    if (n.name === gltfName("frame.static")) return "Frame";
    if (n.name === gltfName("pi.window")) return "Reading windows";
    if (n.name.startsWith("pmsetting_plate")) return "Setting dial plate (digits 0–9)";
  }
  return null;
}
/** @param {THREE.Object3D} root */
function setupHover(root) {
  const canvas = viewer.renderer.domElement;
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, viewer.camera);
    const hit = raycaster.intersectObject(root, true)[0];
    const label = hit ? labelFor(hit.object) : null;
    hover.hidden = !label;
    if (label) {
      hover.textContent = label;
      hover.style.left = `${e.clientX - r.left}px`;
      hover.style.top = `${e.clientY - r.top}px`;
    }
  });
  canvas.addEventListener("pointerleave", () => (hover.hidden = true));
}

// ---- load -----------------------------------------------------------------------------------------
viewer
  .load("../../assets/m1-carry-slice.glb")
  .then((root) => {
    rig = /** @type {Rig<string>} */ (new Rig(root, m1NodeNames(N)));
    (/** @type {HTMLInputElement} */ ($("didactic"))).addEventListener("change", (e) => {
      const on = (/** @type {HTMLInputElement} */ (e.target)).checked;
      applyDidactic(root, on);
      $("legend").hidden = !on;
    });
    setupHover(root);
    status.textContent = "";
    render();
    if (selftestRequested()) {
      status.textContent = "Running self-test…";
      setTimeout(() => {
        const t0 = performance.now();
        const results = runM1Checks(root);
        showSelftest($("panel"), results, performance.now() - t0);
        status.textContent = "";
        render();
      }, 50);
    }
  })
  .catch(/** @param {unknown} err */ (err) => {
    status.textContent = `Could not load the model: ${err instanceof Error ? err.message : String(err)}`;
    console.error(err);
  });

render();
