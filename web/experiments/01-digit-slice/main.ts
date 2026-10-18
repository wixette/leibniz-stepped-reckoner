import * as THREE from "three";
import { runM0Checks } from "../../src/accept/m0Checks";
import { selftestRequested, showSelftest } from "../../src/accept/selftestPanel";
import { applyM0Pose } from "../../src/scene/m0Pose";
import { gltfName, M0_NODES, Rig } from "../../src/scene/rig";
import { Viewer } from "../../src/scene/viewer";
import { DigitSlice } from "../../src/sim/digitSlice";
import * as K from "../../src/sim/kinematics";
import { describeStep, type Snapshot, snapshotM0 } from "../../src/sim/narrate";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const machine = new DigitSlice();
const viewer = new Viewer($("stage"));
const status = $("status");

// ---- camera presets (glTF frame: metres, +Y up, machine front toward +Z) ----
const VIEWS: Record<string, [THREE.Vector3Like, THREE.Vector3Like]> = {
  overview: [{ x: 0.32, y: 0.24, z: 0.3 }, { x: 0, y: 0.06, z: 0 }],
  gear: [{ x: 0.075, y: 0.1, z: 0.05 }, { x: 0, y: 0.058, z: -0.02 }],
  carry: [{ x: -0.075, y: 0.125, z: -0.18 }, { x: -0.014, y: 0.068, z: -0.085 }],
};

// ---- crank animation -------------------------------------------------------------
let target: number | null = null; // theta we are animating toward
let speed = Number(($("speed") as HTMLSelectElement).value);
const DEG_PER_SEC = 360; // real time: one turn per second

let stepping: { before: Snapshot; dir: 1 | -1 } | null = null; // a Step in progress
let lastStep: string | null = null; // "what just happened", shown until the next action

function animateTo(theta: number) {
  target = theta;
}

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
      lastStep = describeStep(stepping.before, snapshotM0(machine), stepping.dir, { ribs: [K.RIB_START, K.ribWindowStart(9)], completed });
      stepping = null;
    }
  }
  render();
});

// ---- rig + UI rendering -----------------------------------------------------------
let rig: Rig<keyof typeof M0_NODES> | null = null;

function render() {
  if (rig) applyM0Pose(rig, machine.pose());
  $("shown").textContent = String(machine.shownDigit);
  $("carryOut").textContent = String(machine.carryOutLive);
  $("turns").textContent = String(machine.turns);
  const th = machine.theta;
  $("thetaOut").textContent = `${th.toFixed(1)}°`;
  ($("theta") as HTMLInputElement).value = String(th);
  for (const b of document.querySelectorAll<HTMLButtonElement>("#digits button")) {
    b.classList.toggle("on", Number(b.dataset.d) === machine.setting);
    b.disabled = !machine.atRest;
  }
  const phase = $("phase");
  phase.textContent = lastStep ? `Step: ${lastStep}` : phaseText();
  phase.classList.toggle("active", machine.carryPhase !== "none");
}

function phaseText(): string {
  const th = machine.theta;
  if (th === 0) return `At rest. Setting ${machine.setting}: one forward turn adds ${machine.setting}, one backward turn subtracts it.`;
  switch (machine.carryPhase) {
    case "storing":
      return "The wheel passes 9 → 0: its single tooth (Einzahn) pushes the carry store…";
    case "stored":
      return "Carry stored: the Fünfhorn turned 18° and the pentagon at the back tilts. It waits for the carry window.";
    case "executing":
      return "Carry window: the stored carry is executed — the store completes a full horn (72°). In the full machine this turns the next digit (M1).";
    case "executed":
      return "Carry passed to the next digit; the pentagon is level again.";
  }
  const t = Math.abs(th);
  if (t < K.RIB_START) return "Free arc: the drum turns, nothing touches the gear yet.";
  const ribEnd = K.ribWindowStart(9);
  if (t < ribEnd) {
    // A window's end belongs to that window (it has just been passed), not the next one.
    const w = Math.max(0, Math.floor((t - K.RIB_START - 1e-6) / K.RIB_PITCH)); // window 0..8
    const k = th >= 0 ? w + 1 : 9 - w;
    const engaged = k >= 10 - machine.setting;
    return engaged
      ? `Rib ${k} of 9 is passing the gear: the result wheel advances one step.`
      : `Rib ${k} of 9 is too short to reach the gear at setting ${machine.setting}.`;
  }
  return "Ribs done. The rest of the turn is free (the carry window, unused this time).";
}

// ---- controls -----------------------------------------------------------------------
const digits = $("digits");
for (let d = 0; d <= 9; d++) {
  const b = document.createElement("button");
  b.textContent = String(d);
  b.dataset.d = String(d);
  b.addEventListener("click", () => {
    if (machine.setSetting(d)) {
      lastStep = null;
      render();
    }
  });
  digits.appendChild(b);
}

function turn(dir: 1 | -1) {
  if (machine.theta !== 0 && Math.sign(machine.theta) !== dir) return;
  stepping = null;
  lastStep = null;
  animateTo(dir * 360);
}

/** Turn the crank (forward = adding, backward = subtracting) to the next completed change. */
function step(dir: 1 | -1) {
  if (target !== null) return; // let the current step finish first
  if (machine.theta !== 0 && Math.sign(machine.theta) !== dir) return;
  const t = Math.abs(machine.theta);
  const next = machine.stepStops(dir).find((a) => a > t + 1e-6) ?? 360;
  stepping = { before: snapshotM0(machine), dir };
  lastStep = null;
  animateTo(dir * next);
}

$("add").addEventListener("click", () => turn(1));
$("sub").addEventListener("click", () => turn(-1));
$("stepAdd").addEventListener("click", () => step(1));
$("stepSub").addEventListener("click", () => step(-1));
$("speed").addEventListener("change", (e) => (speed = Number((e.target as HTMLSelectElement).value)));
$("theta").addEventListener("input", (e) => {
  target = null;
  stepping = null;
  lastStep = null;
  machine.setTheta(Number((e.target as HTMLInputElement).value));
  render();
});
$("reset").addEventListener("click", () => {
  target = null; // stop any crank animation in progress
  stepping = null;
  lastStep = null;
  machine.reset();
  render();
});
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-view]")) {
  b.addEventListener("click", () => viewer.flyTo(...VIEWS[b.dataset.view!]));
}

// ---- didactic colouring -----------------------------------------------------------------
// Node names as three.js sees them (dots stripped, see gltfName).
const FUNCTION_COLOURS: [RegExp, number][] = [
  [/^pm(setting_dial|setting_rack|setting_plate)/, 0x3d6fd6],
  [/^pmdrum/, 0x8a4fd1],
  [/^pisum_wheel/, 0x2f9e5b],
  [/^picarry_store/, 0xe0782c],
];
const KEEP = new Set(["ink_black", "enamel_white"]);
const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();

function applyDidactic(root: THREE.Object3D, on: boolean) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (!originals.has(mesh)) originals.set(mesh, mesh.material);
    const orig = originals.get(mesh)!;
    if (!on) {
      mesh.material = orig;
      return;
    }
    let owner: THREE.Object3D | null = mesh;
    while (owner && !FUNCTION_COLOURS.some(([re]) => re.test(owner!.name)) && owner.parent) owner = owner.parent;
    const hit = FUNCTION_COLOURS.find(([re]) => owner && re.test(owner.name));
    const recolour = (m: THREE.Material): THREE.Material => {
      if (KEEP.has(m.name)) return m;
      if (!hit) {
        const g = new THREE.MeshStandardMaterial({ color: 0xbdb8ad, transparent: true, opacity: 0.35, roughness: 0.8 });
        g.depthWrite = false;
        return g;
      }
      return new THREE.MeshStandardMaterial({ color: hit[1], roughness: 0.55, metalness: 0.1 });
    };
    mesh.material = Array.isArray(orig) ? orig.map(recolour) : recolour(orig);
  });
}

// ---- hover labels ---------------------------------------------------------------------------
const hover = $("hover");
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function labelFor(o: THREE.Object3D | null): string | null {
  for (let n = o; n; n = n.parent) {
    const ud = n.userData as { label_en?: string };
    if (ud.label_en) return ud.label_en;
    if (n.name === gltfName("frame.static")) return "Frame";
    if (n.name === gltfName("pi.window.0")) return "Reading window";
    if (n.name === gltfName("pm.setting_plate.0")) return "Setting dial plate (digits 0–9)";
  }
  return null;
}

function setupHover(root: THREE.Object3D) {
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

// ---- load ---------------------------------------------------------------------------------------
viewer
  .load("../../m0-digit-slice.glb")
  .then((root) => {
    rig = new Rig(root, M0_NODES);
    ($("didactic") as HTMLInputElement).addEventListener("change", (e) => {
      const on = (e.target as HTMLInputElement).checked;
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
        const results = runM0Checks(root); // poses the model itself, then resets it
        showSelftest($("panel"), results, performance.now() - t0);
        status.textContent = "";
        render(); // restore the page's own state
      }, 50);
    }
  })
  .catch((err: unknown) => {
    status.textContent = `Could not load the model: ${err instanceof Error ? err.message : String(err)}`;
    console.error(err);
  });

render();
