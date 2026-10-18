import * as THREE from "three";
import { runM2Checks } from "../../js/accept/m2Checks.js";
import { selftestRequested, showSelftest } from "../../js/accept/selftestPanel.js";
import { applyM2Pose, m2NodeNames } from "../../js/scene/m2Pose.js";
import { gltfName, Rig } from "../../js/scene/rig.js";
import { Viewer } from "../../js/scene/viewer.js";
import * as K from "../../js/sim/kinematics.js";
import { Machine } from "../../js/sim/machine.js";
/** @import { CarryMode } from "../../js/sim/machine.js" */
import { describeStep, snapshotM1 } from "../../js/sim/narrate.js";
/** @import { Snapshot } from "../../js/sim/narrate.js" */
import { registerValue } from "../../js/sim/operations.js";

/**
 * @template {HTMLElement} [T=HTMLElement]
 * @param {string} id
 */
const $ = (id) => /** @type {T} */ (document.getElementById(id));
// The version this module was loaded with (?v=, see tools/stamp.mjs).
const MODEL = "../../assets/m2-full-machine.glb" + new URL(import.meta.url).search;

const machine = new Machine();
const R = machine.registerDigits;
const C = machine.carriageDigits;
const viewer = new Viewer($("stage"));
viewer.setShadowExtent(0.46, { x: -0.22, y: 0.03, z: 0 });
viewer.renderOnDemand = true;
const status = $("status");
/** @type {THREE.Object3D | null} */
let root = null;
/** @type {Rig<string> | null} */
let rig = null;

// ---- camera presets (glTF frame: metres, +Y up, machine front toward +Z) -------------------
const magnaCentre = () => {
  const n = root?.getObjectByName(gltfName("pm.magna_rota"));
  return n ? new THREE.Vector3().setFromMatrixPosition(n.matrixWorld) : new THREE.Vector3(-0.137, 0.0355, 0.1155);
};
/**
 * Camera position looking at target from direction dir, far enough to fit a sphere of radius r.
 * @param {THREE.Vector3Like} target
 * @param {THREE.Vector3Like} dir
 * @param {number} r
 * @returns {[THREE.Vector3Like, THREE.Vector3Like]}
 */
function fit(target, dir, r) {
  const cam = viewer.camera;
  const vfov = THREE.MathUtils.degToRad(cam.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * cam.aspect);
  const d = r / Math.sin(Math.min(vfov, hfov) / 2);
  const p = new THREE.Vector3().copy(dir).normalize().multiplyScalar(d).add(target);
  return [p, target];
}
/** @type {Record<string, () => [THREE.Vector3Like, THREE.Vector3Like]>} */
const VIEWS = {
  overview: () => fit({ x: -0.22, y: 0.04, z: 0 }, { x: 0.35, y: 0.42, z: 0.62 }, 0.4),
  front: () => fit(magnaCentre(), { x: 0.12, y: 0.15, z: 1 }, 0.1), // the ring (r 63 mm) and the crank's sweep
  register: () => [{ x: -0.28, y: 0.5, z: 0.03 }, { x: -0.28, y: 0.08, z: -0.066 }],
  carry: () => [{ x: -0.12, y: 0.3, z: -0.36 }, { x: -0.12, y: 0.06, z: -0.1 }],
};
/** @param {string} name */
const fly = (name) => viewer.flyTo(...VIEWS[name]());
/** @param {string} name */
function jumpTo(name) {
  const [p, t] = VIEWS[name]();
  viewer.camera.position.set(p.x, p.y, p.z);
  viewer.controls.target.set(t.x, t.y, t.z);
}
jumpTo("overview");

// ---- animation: crank turns, carriage shifts, scripted examples -------------------------------
/**
 * - turn: one whole turn of the main crank
 * - theta: crank to this angle (Step)
 * - shift: carriage to this offset (end crank)
 * - pause: seconds
 * @typedef {(
 *   | { turn: 1 | -1 }
 *   | { theta: number }
 *   | { shift: number }
 *   | { pause: number }
 * )} Action
 */

/** @type {Action | null} */
let current = null;
let pauseLeft = 0;
/** @type {Generator<Action, void, void> | null} */
let script = null;
/** @type {{ before: Snapshot; dir: 1 | -1 } | null} */
let stepping = null;
/** @type {string | null} */
let lastStep = null;
let speed = Number((/** @type {HTMLSelectElement} */ ($("speed"))).value);
const DEG_PER_SEC = 360;
const PLACES_PER_SEC = 1;

/** @param {Action} a */
function start(a) {
  current = a;
  if ("pause" in a) pauseLeft = a.pause;
}

/** Ask the running script for its next action (it may change the machine in between). */
function nextFromScript() {
  if (!script) return;
  const r = script.next();
  if (r.done) script = null;
  else start(r.value);
}

viewer.addFrameCallback((dt) => {
  if (!current) return;
  const a = current;
  let done = false;
  if ("pause" in a) {
    pauseLeft -= dt * speed;
    done = pauseLeft <= 0;
  } else if ("shift" in a) {
    const cur = machine.carriagePos;
    const d = a.shift - cur;
    const s = PLACES_PER_SEC * speed * dt;
    const next = Math.abs(d) <= s ? a.shift : cur + Math.sign(d) * s;
    machine.setCarriagePos(next);
    done = next === a.shift;
  } else {
    const target = "turn" in a ? a.turn * 360 : a.theta;
    const cur = machine.theta;
    const d = target - cur;
    const s = DEG_PER_SEC * speed * dt;
    const next = Math.abs(d) <= s ? target : cur + Math.sign(d) * s;
    const refused = cur === 0 && !machine.canStart(target > 0 ? 1 : -1);
    const completed = refused ? false : machine.setTheta(next);
    done = refused || completed || next === target;
    if (refused) {
      // The crank does not move (pin on the stop, or a store that cannot take another
      // carry): stop any running script and say why.
      if (script) say(`Stopped: ${blockText(target > 0 ? 1 : -1) ?? "the crank is blocked."}`);
      script = null;
      stepping = null;
    }
    if (done && stepping) {
      lastStep = describeStep(stepping.before, snapshotM1(machine), stepping.dir, { ribs: [K.RIB_START, K.ribWindowStart(9)], completed });
      stepping = null;
    }
  }
  if (done) {
    current = null;
    nextFromScript();
  }
  render();
});

const busy = () => current !== null || script !== null;

// ---- rendering -----------------------------------------------------------------------------------
const windows = $("windows");
for (let k = R - 1; k >= 0; k--) {
  const w = document.createElement("div");
  w.className = "win";
  w.dataset.k = String(k);
  w.title = `10^${k}`;
  w.innerHTML = `<span class="big">0</span><span class="flag"></span>`;
  windows.appendChild(w);
}
const pins = $("pins");
for (const m of [null, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
  const b = document.createElement("button");
  b.dataset.pin = m === null ? "" : String(m);
  b.textContent = m === null ? "out" : String(m);
  b.title = m === null ? "Take the pin out: the ring only counts turns" : `Pin in hole ${m}: the crank stops after ${m} turns`;
  pins.appendChild(b);
}

/**
 * Why the crank cannot start a turn in this direction, in the operator's words (null: it can).
 * @param {1 | -1} dir
 * @returns {string | null}
 */
function blockText(dir) {
  const b = machine.startBlock(dir);
  if (b === null) return null;
  if (b === "shifting") return "the carriage is still moving.";
  if (b === "pin") return dir > 0 ? "the pin is on the stop: take it out or move it to turn again." : "with the pin in, the Magna Rota only turns forward: take the pin out to subtract.";
  const k = b.storeFull;
  const need = k - (machine.offset + C - 1);
  return (
    `the ${place(k)} carry is still waiting (pentagon tilted) with no carry lever over it, and this turn would store a second carry there, which the store cannot hold. ` +
    `The operator must shift the carriage ${need} place${need > 1 ? "s" : ""} left first and turn once with input 0.`
  );
}

const settingNumber = () => machine.settings.reduce((a, s, i) => a + s * 10 ** i, 0);
const PLACE = ["units", "tens", "hundreds", "thousands"];
/** @param {number} k */
const place = (k) => PLACE[k] ?? `10^${k}`;

function render() {
  viewer.invalidate();
  if (rig && root) applyM2Pose(rig, root, machine);
  const shown = machine.shownDigits();
  const states = machine.carryStates();
  for (const w of /** @type {NodeListOf<HTMLDivElement>} */ (windows.querySelectorAll(".win"))) {
    const k = Number(w.dataset.k);
    /** @type {HTMLElement} */ (w.querySelector(".big")).textContent = String(shown[k]);
    const st = states[k];
    w.classList.toggle("pending", st !== "idle");
    w.classList.toggle("carriage", k >= machine.offset && k < machine.offset + C);
    /** @type {HTMLElement} */ (w.querySelector(".flag")).textContent = st === "stored" ? "▲" : st === "executing" ? "→" : "";
  }
  // The ring's black numbers count additions, its red numbers subtractions.
  const ring = Math.trunc(machine.ringTurns + machine.theta / 360); // completed turns only
  $("counter").textContent = String(Math.abs(ring) % 10);
  $("counter").classList.toggle("red", ring < 0);
  $("offset").textContent = machine.carriagePos === machine.offset ? String(machine.offset) : machine.carriagePos.toFixed(2);
  $("overflow").textContent = String(machine.carryOutLive());
  $("thetaOut").textContent = `${machine.theta.toFixed(1)}°`;
  (/** @type {HTMLInputElement} */ ($("theta"))).value = String(machine.theta);

  const rest = machine.atRest && !busy();
  const input = /** @type {HTMLInputElement} */ ($("input"));
  input.disabled = !rest;
  if (document.activeElement !== input) input.value = String(settingNumber());
  (/** @type {HTMLButtonElement} */ ($("shiftLeft"))).disabled = !rest || machine.offset >= machine.maxOffset;
  (/** @type {HTMLButtonElement} */ ($("shiftRight"))).disabled = !rest || machine.offset <= 0;
  for (const b of /** @type {NodeListOf<HTMLButtonElement>} */ (pins.querySelectorAll("button"))) {
    b.disabled = !rest;
    b.classList.toggle("on", (b.dataset.pin === "" ? null : Number(b.dataset.pin)) === machine.pin);
  }
  const free = !busy();
  (/** @type {HTMLButtonElement} */ ($("add"))).disabled = !free || (machine.theta === 0 && !machine.canStart(1)) || machine.theta < 0;
  (/** @type {HTMLButtonElement} */ ($("sub"))).disabled = !free || (machine.theta === 0 && !machine.canStart(-1)) || machine.theta > 0;
  (/** @type {HTMLButtonElement} */ ($("stepAdd"))).disabled = (/** @type {HTMLButtonElement} */ ($("add"))).disabled;
  (/** @type {HTMLButtonElement} */ ($("stepSub"))).disabled = (/** @type {HTMLButtonElement} */ ($("sub"))).disabled;
  (/** @type {HTMLButtonElement} */ ($("toStop"))).disabled = !rest || machine.pin === null || !machine.canStart(1);
  (/** @type {HTMLInputElement} */ ($("theta"))).disabled = busy();
  for (const b of /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll("[data-example]"))) b.disabled = busy();
  $("modeRipple").classList.toggle("on", machine.mode === "ripple");
  $("modeHistorical").classList.toggle("on", machine.mode === "historical");
  (/** @type {HTMLButtonElement} */ ($("modeRipple"))).disabled = !rest;
  (/** @type {HTMLButtonElement} */ ($("modeHistorical"))).disabled = !rest;

  const phase = $("phase");
  // A store that cannot take another carry: say so instead of the usual phase text.
  const fullDir = machine.atRest && !busy() ? (/** @type {const} */ ([1, -1])).find((d) => typeof machine.startBlock(d) === "object" && machine.startBlock(d) !== null) : undefined;
  const warn = fullDir ? blockText(fullDir) : null;
  phase.textContent = lastStep ? `Step: ${lastStep}` : warn ? `Operator must shift first: ${warn}` : phaseText(states);
  phase.classList.toggle("active", states.some((s) => s !== "idle"));
  phase.classList.toggle("warn", !!warn && !lastStep);
  for (const [id, d] of /** @type {const} */ ([["add", 1], ["sub", -1]])) $(id).title = blockText(d) ? `Blocked: ${blockText(d)}` : "";
}

/**
 * @param {("idle" | "stored" | "executing")[]} states
 * @returns {string}
 */
function phaseText(states) {
  const th = machine.theta;
  const stored = states.map((s, k) => (s === "stored" ? k : -1)).filter((k) => k >= 0);
  const exec = states.findIndex((s) => s === "executing");
  if (machine.carriagePos !== machine.offset) return "The end crank turns the lead screw: the carriage moves one place (one turn = 37 mm).";
  if (exec >= 0) return `The carry lever at ${place(exec)} pushes its store: the ${place(exec + 1)} wheel turns one step.`;
  if (th === 0) {
    const blocked = machine.blocked ? " The pin is on the stop: take it out or move it to turn again." : "";
    const pend = stored.length
      ? ` Carries waiting (pentagon tilted) at ${stored.map(place).join(", ")}${stored.some((k) => k >= machine.offset + C) ? " – above the carriage: shift it over them and turn once with input 0" : " – one more turn finishes them"}.`
      : "";
    return `At rest. Carriage digit 0 is over the ${place(machine.offset)} wheel; input ${settingNumber()}.${pend}${blocked}`;
  }
  const t = Math.abs(th);
  if (t < K.RIB_START) return "Free arc: the drums turn, no rib reaches a gear yet.";
  if (t < K.ribWindowStart(9)) {
    const w = Math.max(0, Math.floor((t - K.RIB_START - 1e-6) / K.RIB_PITCH));
    const k = th >= 0 ? w + 1 : 9 - w;
    return `Rib ${k} of 9 is passing: every carriage digit whose input is ≥ ${10 - k} turns its wheel one step.`;
  }
  if (stored.length) return `Carry window: carries stored at ${stored.map(place).join(", ")}, waiting for their levers.`;
  return "Ribs done; the rest of the turn is the carry window.";
}

// ---- worked examples -----------------------------------------------------------------------------
/** @param {string} s */
const say = (s) => ($("script").textContent = s);

/**
 * @param {CarryMode} mode
 * @returns {Generator<Action, void, void>}
 */
function* resetTo(mode) {
  machine.reset();
  machine.setMode(mode);
  render();
  yield { pause: 0.2 };
}

/** @type {Record<string, () => Generator<Action, void, void>>} */
const EXAMPLES = {
  *mul() {
    yield* resetTo("ripple");
    machine.setNumber(1709);
    say("1709 × 365: set 1709 on the knobs. Multiply by each digit of 365, units first.");
    yield { pause: 1.5 };
    for (const [o, d] of /** @type {const} */ ([[0, 5], [1, 6], [2, 3]])) {
      if (o > 0) {
        say(`Shift the carriage one place left (end crank): the next digit counts ${10 ** o}s.`);
        yield { shift: o };
      }
      machine.setPin(d);
      say(`Pin in hole ${d} of the Magna Rota, then turn the crank until it stops (${d} turns).`);
      render();
      yield { pause: 1 };
      while (!machine.blocked) yield { turn: 1 };
      say(`The pin is on the stop after ${d} turns. Register: ${machine.shownNumber()}.`);
      yield { pause: 1.5 };
    }
    machine.setPin(null);
    yield { shift: 0 };
    say(`1709 × 365 = ${machine.shownNumber()}.`);
  },
  *div() {
    yield* resetTo("ripple");
    machine.setResult(623_785);
    machine.setNumber(1709);
    say("623785 ÷ 1709: the dividend is in the register, the divisor on the knobs. Start with the carriage under the highest place it fits.");
    yield { pause: 1.5 };
    /** @type {number[]} */
    const q = [];
    for (let o = 2; o >= 0; o--) {
      yield { shift: o };
      machine.setPin(null); // the ring counts the subtractions from 0
      say(`Subtract 1709 × ${10 ** o} until the register goes below zero; the Magna Rota counts the turns.`);
      render();
      for (;;) {
        yield { turn: -1 };
        if (registerValue(machine) < 0) {
          say("Overdrawn (the top of the register turned to 9s): add back once.");
          yield { pause: 1 };
          yield { turn: 1 };
          break;
        }
      }
      q.push(-machine.ringTurns);
      say(`Quotient digit ${-machine.ringTurns} (red number at the stop). Quotient so far: ${q.join("")}.`);
      yield { pause: 1.5 };
    }
    yield { shift: 0 };
    say(`623785 ÷ 1709 = ${q.join("")}, remainder ${machine.shownNumber()}.`);
  },
  *beyond() {
    yield* resetTo("ripple");
    machine.setResult(999_999_999);
    machine.setNumber(1);
    say("999 999 999 + 1: nine 9s, but the carriage only reaches digits 0–7.");
    yield { pause: 1.5 };
    yield { turn: 1 };
    say("Digit 8 turned 9 → 0 and stored its carry (pentagon tilted), but no carry lever is over digit 8. Shift the carriage left and turn once with input 0.");
    yield { pause: 2 };
    machine.setNumber(0);
    yield { shift: 1 };
    yield { turn: 1 };
    say(`Done: ${machine.shownNumber().toLocaleString("en")}. Leibniz's operator had to watch for exactly this.`);
    yield { shift: 0 };
  },
  *hist() {
    yield* resetTo("historical");
    machine.setResult(9999);
    machine.setNumber(1);
    say("Historical (deferred) carry mode: 9999 + 1.");
    yield { pause: 1.5 };
    yield { turn: 1 };
    say(`After one turn: ${machine.shownNumber()} – the tens carry made during the carry phase waits (pentagon tilted).`);
    yield { pause: 2 };
    machine.setNumber(0);
    yield { turn: 1 };
    say(`One idle turn finishes it: ${machine.shownNumber()}.`);
  },
};

// ---- controls ------------------------------------------------------------------------------------
const clearStep = () => {
  stepping = null;
  lastStep = null;
};
/** @param {Action} a */
function run(a) {
  if (busy()) return;
  clearStep();
  start(a);
  render();
}
/** @param {1 | -1} dir */
function step(dir) {
  if (busy()) return;
  if (machine.theta !== 0 && Math.sign(machine.theta) !== dir) return;
  if (machine.theta === 0 && !machine.canStart(dir)) return;
  const t = Math.abs(machine.theta);
  const next = machine.stepStops(dir).find((a) => a > t + 1e-6) ?? 360;
  stepping = { before: snapshotM1(machine), dir };
  lastStep = null;
  start({ theta: dir * next });
}
$("add").addEventListener("click", () => run({ turn: 1 }));
$("sub").addEventListener("click", () => run({ turn: -1 }));
$("stepAdd").addEventListener("click", () => step(1));
$("stepSub").addEventListener("click", () => step(-1));
$("toStop").addEventListener("click", () => {
  if (busy()) return;
  clearStep();
  script = (function* () {
    while (!machine.blocked) yield /** @type {Action} */ ({ turn: 1 });
  })();
  nextFromScript();
});
$("shiftLeft").addEventListener("click", () => run({ shift: machine.offset + 1 }));
$("shiftRight").addEventListener("click", () => run({ shift: machine.offset - 1 }));
$("speed").addEventListener("change", (e) => (speed = Number((/** @type {HTMLSelectElement} */ (e.target)).value)));
$("theta").addEventListener("input", (e) => {
  if (busy()) return;
  clearStep();
  machine.setTheta(Number((/** @type {HTMLInputElement} */ (e.target)).value));
  render();
});
$("input").addEventListener("change", (e) => {
  const x = Math.max(0, Math.min(99_999_999, Math.floor(Number((/** @type {HTMLInputElement} */ (e.target)).value) || 0)));
  machine.setNumber(x);
  clearStep();
  render();
});
pins.addEventListener("click", (e) => {
  const b = (/** @type {HTMLElement} */ (e.target)).closest("button");
  if (!b || b.disabled) return;
  machine.setPin(b.dataset.pin === "" ? null : Number(b.dataset.pin));
  clearStep();
  render();
});
for (const b of /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll("[data-example]"))) {
  b.addEventListener("click", () => {
    if (busy()) return;
    clearStep();
    script = EXAMPLES[/** @type {string} */ (b.dataset.example)]();
    nextFromScript();
    render();
  });
}
/** @param {CarryMode} m */
const setMode = (m) => {
  if (!busy() && machine.setMode(m)) {
    clearStep();
    render();
  }
};
$("modeRipple").addEventListener("click", () => setMode("ripple"));
$("modeHistorical").addEventListener("click", () => setMode("historical"));
$("reset").addEventListener("click", () => {
  current = null;
  script = null;
  clearStep();
  say("");
  const mode = machine.mode;
  machine.reset();
  machine.setMode(mode);
  render();
});
for (const b of /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll("[data-view]"))) b.addEventListener("click", () => fly(/** @type {string} */ (b.dataset.view)));

// ---- cut-away and didactic colouring ----------------------------------------------------------------
/** @type {[RegExp, number][]} */
const FUNCTION_COLOURS = [
  [/^pm(setting_dial|setting_rack|setting_plate)/, 0x3d6fd6],
  [/^pmdrum/, 0x8a4fd1],
  [/^pisum_wheel/, 0x2f9e5b],
  [/^picarry_store/, 0xe0782c],
  [/^pm(lever|zweihorn)/, 0xc2412d],
  [/^(pmmagna|pmmain_crank|pmcarriage$|framelead_screw)/, 0xb8860b],
];
const KEEP = new Set(["ink_black", "ink_red", "enamel_white"]);
/** @type {Map<THREE.Mesh, THREE.Material | THREE.Material[]>} */
const originals = new Map();
/**
 * @param {THREE.Object3D} r
 * @param {boolean} on
 */
function applyDidactic(r, on) {
  r.traverse((o) => {
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

// ---- hover labels -------------------------------------------------------------------------------------
const hover = $("hover");
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
/** Casing parts: shown for the original look, hidden to see the mechanism. */
const CASING = ["frame.case", "frame.base", "frame.register_cover", "pm.carriage_cover"];
/** @type {Record<string, string>} */
const STATIC_LABELS = {
  [gltfName("frame.static")]: "Frame",
  [gltfName("pi.window")]: "Reading windows (result register)",
  [gltfName("pm.carriage_panel")]: "Carriage front panel",
  [gltfName("pm.magna_plate")]: "Magna Rota plate and stop finger",
  [gltfName("frame.case")]: "Oak case",
  [gltfName("frame.base")]: "Oak base board and bearers",
  [gltfName("frame.register_cover")]: "Cover plate of the result register (windows show the result)",
  [gltfName("pm.carriage_cover")]: "Cover plate of the carriage",
};
/**
 * @param {THREE.Object3D | null} o
 * @returns {string | null}
 */
function labelFor(o) {
  for (let n = o; n; n = n.parent) {
    const ud = /** @type {{ label_en?: string }} */ (n.userData);
    if (ud.label_en) return ud.label_en;
    if (STATIC_LABELS[n.name]) return STATIC_LABELS[n.name];
    if (n.name.startsWith("pmsetting_plate")) return "Setting dial plate (digits 0–9)";
  }
  return null;
}
/** @param {THREE.Object3D} r */
function setupHover(r) {
  const canvas = viewer.renderer.domElement;
  canvas.addEventListener("pointermove", (e) => {
    const b = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    raycaster.setFromCamera(ndc, viewer.camera);
    const hit = raycaster.intersectObject(r, true).find((h) => h.object.visible && (h.object.parent?.visible ?? true));
    const label = hit ? labelFor(hit.object) : null;
    hover.hidden = !label;
    if (label) {
      hover.textContent = label;
      hover.style.left = `${e.clientX - b.left}px`;
      hover.style.top = `${e.clientY - b.top}px`;
    }
  });
  canvas.addEventListener("pointerleave", () => (hover.hidden = true));
}

// ---- load ------------------------------------------------------------------------------------------------
viewer
  .load(MODEL)
  .then((r) => {
    root = r;
    rig = /** @type {Rig<string>} */ (new Rig(r, m2NodeNames(R, C)));
    $("didactic").addEventListener("change", (e) => {
      const on = (/** @type {HTMLInputElement} */ (e.target)).checked;
      applyDidactic(r, on);
      viewer.invalidate();
      $("legend").hidden = !on;
    });
    const casing = /** @type {HTMLInputElement} */ ($("casing"));
    const showCasing = () => {
      for (const n of CASING) {
        const o = r.getObjectByName(gltfName(n));
        if (o) o.visible = casing.checked;
        viewer.invalidate();
      }
    };
    casing.addEventListener("change", showCasing);
    showCasing();
    $("cutaway").addEventListener("change", (e) => {
      const panel = r.getObjectByName(gltfName("pm.carriage_panel"));
      if (panel) panel.visible = !(/** @type {HTMLInputElement} */ (e.target)).checked;
      viewer.invalidate();
    });
    setupHover(r);
    jumpTo("overview"); // the canvas has its final aspect now
    status.textContent = "";
    render();
    if (selftestRequested()) {
      status.textContent = "Running the M2 self-test (about 15 s)…";
      setTimeout(() => {
        const t0 = performance.now();
        const entry = /** @type {PerformanceResourceTiming | undefined} */ (performance.getEntriesByType("resource").find((e) => e.name === new URL(MODEL, location.href).href));
        const results = runM2Checks(r, { bytes: entry?.decodedBodySize || undefined });
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

// ?debug exposes the page's machine and render() to the console (to set up states by hand).
if (new URLSearchParams(location.search).has("debug")) Object.assign(window, { machine, render });
