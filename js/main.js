import * as THREE from "three";
import { runM3Checks } from "./accept/m3Checks.js";
import { selftestRequested, showSelftest } from "./accept/selftestPanel.js";
import { applyM2Pose, m2NodeNames } from "./scene/m2Pose.js";
import { Rig } from "./scene/rig.js";
import { Callouts, Exploder, fillLabel, findNodes, Highlighter, makeViews } from "./scene/teachScene.js";
import { Viewer } from "./scene/viewer.js";
import { Machine } from "./sim/machine.js";
import { registerValue } from "./sim/operations.js";
import { placeName, t, ui } from "./teach/i18n.js";
/** @import { Lang, UIKey } from "./teach/i18n.js" */
import { LESSONS } from "./teach/lessons.js";
import { partInfo } from "./teach/partInfo.js";
import { applyIntentNow, controlOf, intentAt, intentHint, possible } from "./teach/partActions.js";
/** @import { Intent } from "./teach/partActions.js" */
import { applyAction, presentation, replayTo } from "./teach/player.js";
/** @import { Action, Lesson, ViewName } from "./teach/player.js" */

/**
 * @template {HTMLElement} [T=HTMLElement]
 * @param {string} id
 */
const $ = (id) => /** @type {T} */ (document.getElementById(id));
const MODEL = "assets/m2-full-machine.glb";
const CASING = ["frame.case", "frame.base", "frame.register_cover", "pm.carriage_cover"];

const machine = new Machine();
const viewer = new Viewer($("stage"));
viewer.setShadowExtent(0.5, { x: -0.27, y: 0, z: 0 });
viewer.renderOnDemand = true;
{
  const q = new URLSearchParams(location.search).get("quality");
  if (q === "lite" || q === "high") {
    viewer.qualityMode = q;
    viewer.setQuality(q);
  }
}
const status = $("status");

/** @type {THREE.Object3D | null} */
let root = null;
/** @type {Rig<string> | null} */
let rig = null;
/** @type {Exploder | null} */
let exploder = null;
/** @type {Highlighter | null} */
let highlighter = null;
/** @type {Callouts | null} */
let callouts = null;
/** @type {ReturnType<typeof makeViews> | null} */
let views = null;

// ---- language (remembered per viewer; the page works without storage) -------------------------
const store = {
  get: /** @param {string} k */ (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: /** @param {string} k @param {string} v */ (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode: not remembered */
    }
  },
};
const urlLang = new URLSearchParams(location.search).get("lang");
/** @type {Lang} */
let lang = urlLang === "de" || urlLang === "en" ? urlLang : store.get("lsr-lang") === "de" ? "de" : "en";

// ---- animation: crank turns and carriage shifts, one primitive at a time -----------------------
/** @typedef {{ theta: number } | { shift: number }} Prim */
/** @type {Generator<Prim, void, void> | null} */
let seq = null;
/** @type {Prim | null} */
let cur = null;
/** @type {(() => void) | null} */
let onSeqDone = null;
/** @type {string | null} */
let refusal = null; // why the crank did not move
let explodeTarget = 0;
const DEG_PER_SEC = 300;
const PLACES_PER_SEC = 1.2;

/**
 * @param {Generator<Prim, void, void>} gen
 * @param {() => void} [done]
 */
function play(gen, done) {
  seq = gen;
  onSeqDone = done ?? null;
  refusal = null;
  nextPrim();
}
function stopAnimation() {
  seq = null;
  cur = null;
  onSeqDone = null;
}
function nextPrim() {
  if (!seq) return;
  const r = seq.next();
  if (r.done) {
    const cb = onSeqDone;
    stopAnimation();
    cb?.();
  } else cur = r.value;
  render();
}

/**
 * @param {Action[]} actions
 * @returns {Generator<Prim, void, void>}
 */
function* expand(actions) {
  for (const a of actions) {
    if ("theta" in a) yield { theta: a.theta };
    else if ("turn" in a) for (let k = 0; k < (a.times ?? 1); k++) yield { theta: a.turn * 360 };
    else if ("shift" in a) yield { shift: a.shift };
    else if ("toStop" in a) while (!machine.blocked && machine.canStart(1)) yield { theta: 360 };
    else if ("divideDigit" in a) {
      for (;;) {
        yield { theta: -360 };
        if (registerValue(machine) < 0) {
          yield { theta: 360 };
          break;
        }
      }
    } else applyAction(machine, a);
  }
}

viewer.addFrameCallback((dt) => {
  if (exploder && exploder.factor !== explodeTarget) {
    const f = exploder.factor + Math.sign(explodeTarget - exploder.factor) * Math.min(Math.abs(explodeTarget - exploder.factor), dt * 1.2);
    exploder.factor = f;
    render();
  }
  callouts?.update();
  if (!cur || apart()) return; // a lesson action waits until the machine is back together
  let done = false;
  if ("shift" in cur) {
    const d = cur.shift - machine.carriagePos;
    const s = PLACES_PER_SEC * dt;
    const next = Math.abs(d) <= s ? cur.shift : machine.carriagePos + Math.sign(d) * s;
    if (!machine.setCarriagePos(next)) done = true;
    done ||= next === cur.shift;
  } else {
    const target = cur.theta;
    /** @type {1 | -1} */
    const dir = target > machine.theta ? 1 : -1;
    if (machine.theta === 0 && !machine.canStart(dir)) {
      refusal = blockText(dir);
      const cb = onSeqDone;
      stopAnimation(); // a blocked crank does not move: stop the whole sequence
      cb?.();
      render();
      return;
    }
    const s = DEG_PER_SEC * dt;
    const next = Math.abs(target - machine.theta) <= s ? target : machine.theta + dir * s;
    const completed = machine.setTheta(next);
    done = completed || next === target;
  }
  if (done) {
    cur = null;
    nextPrim();
  } else render();
});

const busy = () => cur !== null || seq !== null;
/** Taken apart (or on the way): the machine cannot calculate. */
const apart = () => (exploder?.factor ?? 0) > 0 || explodeTarget > 0;

/**
 * @param {1 | -1} dir
 * @returns {string | null}
 */
function blockText(dir) {
  const b = machine.startBlock(dir);
  if (b === null || b === "shifting") return null;
  if (b === "pin") return ui(dir > 0 ? "blockedPin" : "blockedPinSub", lang);
  return ui("blockedStore", lang, { place: placeName(b.storeFull, lang) });
}

// ---- lessons --------------------------------------------------------------------------------------
/** @typedef {"menu" | "lesson" | "free"} Mode */
/** @type {Mode} */
let mode = "menu";
/** @type {Lesson | null} */
let lesson = null;
let stepIdx = 0;
let stepPlaying = false;
/** @type {ViewName | null} */
let lastView = null;

/**
 * @param {number} i
 * @param {boolean} replay
 */
function enterStep(i, replay) {
  if (!lesson) return;
  stopAnimation();
  if (replay) replayTo(lesson, i, machine);
  stepIdx = i;
  showPresentation();
  stepPlaying = true;
  play(expand(lesson.steps[i].do ?? []), () => {
    stepPlaying = false;
    render();
  });
}

function showPresentation() {
  if (!lesson) return;
  const p = presentation(lesson, stepIdx);
  (/** @type {HTMLInputElement} */ ($("casing"))).checked = p.casing;
  (/** @type {HTMLInputElement} */ ($("cutaway"))).checked = p.cutaway;
  (/** @type {HTMLInputElement} */ ($("explode"))).checked = p.explode > 0;
  (/** @type {HTMLInputElement} */ ($("focus"))).checked = p.focus && p.highlight.length > 0;
  explodeTarget = p.explode;
  applyToggles();
  highlighter?.set(p.highlight, p.focus && p.highlight.length > 0);
  viewer.invalidate();
  callouts?.set(p.callouts.map((c) => ({ node: c.node, text: t(c.text, lang) })));
  if (views && p.view !== lastView) viewer.flyTo(...views[p.view]());
  lastView = p.view;
}

/** @param {Lesson} l */
function openLesson(l) {
  lesson = l;
  mode = "lesson";
  lastView = null;
  enterStep(0, true);
}

function toMenu() {
  stopAnimation();
  lesson = null;
  mode = "menu";
  highlighter?.set([], false);
  callouts?.set([]);
  explodeTarget = 0;
  (/** @type {HTMLInputElement} */ ($("explode"))).checked = false;
  render();
}

// ---- rendering ----------------------------------------------------------------------------------
function applyToggles() {
  if (!root) return;
  viewer.invalidate();
  for (const n of CASING) for (const o of findNodes(root, n)) o.visible = (/** @type {HTMLInputElement} */ ($("casing"))).checked;
  for (const o of findNodes(root, "pm.carriage_panel")) o.visible = !(/** @type {HTMLInputElement} */ ($("cutaway"))).checked;
}

/** @param {number} n */
const group3 = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

function render() {
  viewer.invalidate();
  if (rig && root && exploder) {
    const [r, o] = [rig, root];
    exploder.pose(() => applyM2Pose(r, o, machine));
  }
  for (const el of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll("[data-ui]"))) el.textContent = ui(/** @type {UIKey} */ (el.dataset.ui), lang);
  document.documentElement.lang = lang;
  $("lang").textContent = ui("language", lang);
  $("result").textContent = group3(machine.shownNumber());
  const ring = Math.trunc(machine.ringTurns + machine.theta / 360); // completed turns only
  $("counter").textContent = String(Math.abs(ring) % 10);
  $("counter").style.color = ring < 0 ? "#a3170e" : "";
  $("offset").textContent = machine.carriagePos === machine.offset ? String(machine.offset) : machine.carriagePos.toFixed(1);

  // lesson list
  const list = $("lessonlist");
  if (list.childElementCount !== LESSONS.length) {
    list.innerHTML = "";
    LESSONS.forEach((l) => {
      const b = document.createElement("button");
      b.dataset.lesson = l.id;
      b.innerHTML = "<b></b><span></span>";
      b.addEventListener("click", () => openLesson(l));
      list.appendChild(b);
    });
  }
  LESSONS.forEach((l, i) => {
    const b = /** @type {HTMLButtonElement} */ (list.children[i]);
    /** @type {HTMLElement} */ (b.querySelector("b")).textContent = t(l.title, lang);
    /** @type {HTMLElement} */ (b.querySelector("span")).textContent = t(l.summary, lang);
  });

  $("menu").hidden = mode === "lesson";
  $("player").hidden = mode !== "lesson";

  // the player
  const step = lesson?.steps[stepIdx];
  const task = step?.task;
  if (lesson && step) {
    $("lessonTitle").textContent = t(lesson.title, lang);
    $("progress").textContent = ui("stepOf", lang, { i: stepIdx + 1, n: lesson.steps.length });
    $("stepText").textContent = t(step.text, lang);
    const line = $("taskline");
    const doneTask = task ? task.check(machine) : false;
    line.hidden = !task && !refusal && !stepPlaying;
    line.className = refusal ? "blocked" : doneTask ? "ok" : "";
    line.textContent = refusal ?? (stepPlaying ? ui("watching", lang) : task ? (doneTask ? `✓ ${ui("done", lang)}` : `${ui("yourTurn", lang)} ↓`) : "");
    const last = stepIdx === lesson.steps.length - 1;
    (/** @type {HTMLButtonElement} */ ($("next"))).textContent = ui(last ? "finish" : "next", lang);
    (/** @type {HTMLButtonElement} */ ($("next"))).disabled = stepPlaying || busy() || (!!task && !doneTask);
    (/** @type {HTMLButtonElement} */ ($("back"))).textContent = ui("back", lang);
    (/** @type {HTMLButtonElement} */ ($("back"))).disabled = stepIdx === 0 || busy();
  }

  // controls: everything in free play; in a lesson only what the current task needs
  const allowed = mode === "free" ? null : /** @type {Set<string>} */ (new Set(task && !stepPlaying ? task.controls : []));
  $("controls").hidden = mode === "menu" || (allowed !== null && allowed.size === 0);
  for (const el of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll("[data-control]"))) {
    const c = /** @type {string} */ (el.dataset.control);
    el.hidden = c === "reset" ? mode !== "free" : allowed !== null && !allowed.has(c);
  }
  const locked = apart();
  $("lockednote").hidden = !locked;
  $("lockednote").textContent = ui("apartLocked", lang);
  const rest = machine.atRest && !busy() && !locked;
  const input = /** @type {HTMLInputElement} */ ($("input"));
  input.disabled = !rest;
  if (document.activeElement !== input) input.value = String(machine.settings.reduce((a, s, i) => a + s * 10 ** i, 0));
  (/** @type {HTMLButtonElement} */ ($("add"))).textContent = ui("add", lang);
  (/** @type {HTMLButtonElement} */ ($("sub"))).textContent = ui("sub", lang);
  (/** @type {HTMLButtonElement} */ ($("shiftLeft"))).textContent = ui("shiftLeft", lang);
  (/** @type {HTMLButtonElement} */ ($("shiftRight"))).textContent = ui("shiftRight", lang);
  (/** @type {HTMLButtonElement} */ ($("toStop"))).textContent = ui("toStop", lang);
  (/** @type {HTMLButtonElement} */ ($("reset"))).textContent = ui("reset", lang);
  (/** @type {HTMLButtonElement} */ ($("add"))).disabled = busy() || locked;
  (/** @type {HTMLButtonElement} */ ($("sub"))).disabled = busy() || locked;
  (/** @type {HTMLInputElement} */ ($("explode"))).disabled = busy();
  // "Fade the other parts" only means something on a lesson step that highlights parts.
  const canFocus = mode === "lesson" && !!lesson && presentation(lesson, stepIdx).highlight.length > 0;
  const focusBox = /** @type {HTMLInputElement} */ ($("focus"));
  focusBox.disabled = !canFocus;
  if (!canFocus) focusBox.checked = false;
  /** @type {HTMLElement} */ (focusBox.parentElement).style.opacity = canFocus ? "" : "0.45";
  /** @type {HTMLElement} */ (focusBox.parentElement).title = canFocus ? "" : ui("focusHint", lang);
  (/** @type {HTMLButtonElement} */ ($("shiftLeft"))).disabled = !rest || machine.offset >= machine.maxOffset;
  (/** @type {HTMLButtonElement} */ ($("shiftRight"))).disabled = !rest || machine.offset <= 0;
  (/** @type {HTMLButtonElement} */ ($("toStop"))).disabled = !rest || machine.pin === null || !machine.canStart(1);
  for (const b of /** @type {NodeListOf<HTMLButtonElement>} */ ($("pins").querySelectorAll("button"))) {
    b.disabled = !rest;
    b.classList.toggle("on", (b.dataset.pin === "" ? null : Number(b.dataset.pin)) === machine.pin);
    if (b.dataset.pin === "") b.textContent = ui("pinOut", lang);
  }
  if (mode === "free") {
    const line = refusal;
    status.textContent = line ?? "";
  }
}

// ---- controls -----------------------------------------------------------------------------------
const learnerDid = () => {
  refusal = null;
  render();
  refreshHover();
};
/** @param {1 | -1} dir */
const turn = (dir) => !busy() && !apart() && play((function* () { yield /** @type {Prim} */ ({ theta: dir * 360 }); })(), learnerDid);
$("add").addEventListener("click", () => turn(1));
$("sub").addEventListener("click", () => turn(-1));
$("shiftLeft").addEventListener("click", () => !busy() && !apart() && play((function* () { yield /** @type {Prim} */ ({ shift: machine.offset + 1 }); })(), learnerDid));
$("shiftRight").addEventListener("click", () => !busy() && !apart() && play((function* () { yield /** @type {Prim} */ ({ shift: machine.offset - 1 }); })(), learnerDid));
$("toStop").addEventListener("click", () => !busy() && !apart() && play(expand([{ toStop: true }]), learnerDid));
$("reset").addEventListener("click", () => {
  stopAnimation();
  machine.reset();
  learnerDid();
});
$("input").addEventListener("change", (e) => {
  const x = Math.max(0, Math.min(99_999_999, Math.floor(Number((/** @type {HTMLInputElement} */ (e.target)).value) || 0)));
  if (!apart()) machine.setNumber(x);
  learnerDid();
});
for (const m of [null, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
  const b = document.createElement("button");
  b.dataset.pin = m === null ? "" : String(m);
  b.textContent = m === null ? "–" : String(m);
  b.addEventListener("click", () => {
    if (!apart()) machine.setPin(m);
    learnerDid();
  });
  $("pins").appendChild(b);
}
$("next").addEventListener("click", () => {
  if (!lesson) return;
  if (stepIdx === lesson.steps.length - 1) {
    status.textContent = ui("lessonDone", lang);
    setTimeout(() => (status.textContent = ""), 3000);
    toMenu();
  } else enterStep(stepIdx + 1, false);
});
$("back").addEventListener("click", () => lesson && stepIdx > 0 && enterStep(stepIdx - 1, true));
$("toMenu").addEventListener("click", (e) => {
  e.preventDefault();
  toMenu();
});
$("freeplay").addEventListener("click", () => {
  mode = "free";
  highlighter?.set([], false);
  callouts?.set([]);
  render();
});
$("lang").addEventListener("click", () => {
  lang = lang === "en" ? "de" : "en";
  store.set("lsr-lang", lang);
  if (lesson) callouts?.set(presentation(lesson, stepIdx).callouts.map((c) => ({ node: c.node, text: t(c.text, lang) })));
  render();
});
for (const id of ["casing", "cutaway"]) $(id).addEventListener("change", applyToggles);
$("explode").addEventListener("change", (e) => (explodeTarget = (/** @type {HTMLInputElement} */ (e.target)).checked ? 1 : 0));
$("focus").addEventListener("change", (e) => {
  if (lesson) highlighter?.set(presentation(lesson, stepIdx).highlight, (/** @type {HTMLInputElement} */ (e.target)).checked);
  viewer.invalidate();
});
for (const b of /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll("[data-view]"))) {
  b.addEventListener("click", () => {
    hover.hidden = true;
    if (views) viewer.flyTo(...views[/** @type {ViewName} */ (b.dataset.view)]());
  });
}

// ---- hover labels (in the page's language) --------------------------------------------------------
const hover = $("hover");
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
/**
 * Name and live value of the part under the pointer (the model's label when it has no value).
 * @param {THREE.Object3D | null} o
 * @returns {{ name: string; value: string | null; red?: boolean } | null}
 */
function labelFor(o) {
  for (let n = o; n; n = n.parent) {
    const info = partInfo(n.name, machine, lang);
    if (info) return info;
    const ud = /** @type {{ label_en?: string; label_de?: string }} */ (n.userData);
    const l = lang === "de" ? ud.label_de : ud.label_en;
    if (l) return { name: l, value: null };
  }
  return null;
}
/**
 * The first visible part under a screen point.
 * @param {THREE.Object3D} r
 * @param {number} clientX
 * @param {number} clientY
 * @returns {THREE.Intersection | undefined}
 */
function pick(r, clientX, clientY) {
  const b = viewer.renderer.domElement.getBoundingClientRect();
  ndc.set(((clientX - b.left) / b.width) * 2 - 1, -((clientY - b.top) / b.height) * 2 + 1);
  raycaster.setFromCamera(ndc, viewer.camera);
  return raycaster.intersectObject(r, true).find((h) => {
    for (let p = /** @type {THREE.Object3D | null} */ (h.object); p; p = p.parent) if (!p.visible) return false;
    return true;
  });
}

/**
 * A click's operation, if the learner may do it now (same rules as the panel controls).
 * @param {THREE.Intersection | undefined} hit
 * @returns {Intent | null}
 */
function clickIntent(hit) {
  if (!hit || busy() || apart() || mode === "menu") return null;
  const i = intentAt(hit.object, hit.point, machine);
  if (!i || !possible(i, machine)) return null;
  if (mode === "lesson") {
    const task = lesson?.steps[stepIdx].task;
    if (stepPlaying || !task || !task.controls.includes(controlOf(i))) return null;
  }
  return i;
}

/** @param {Intent} i */
function doIntent(i) {
  if (i.kind === "turn") return turn(1); // animated, like the Add button
  if (i.kind === "setDigit" || i.kind === "nextDigit" || i.kind === "pin") applyIntentNow(i, machine);
  else {
    const to = i.kind === "shiftTo" ? i.offset : machine.offset + 1;
    return play((function* () { yield /** @type {Prim} */ ({ shift: to }); })(), learnerDid);
  }
  learnerDid();
}

/** @type {{ x: number; y: number } | null} */
let lastPointer = null;
/** @type {((x: number, y: number) => void) | null} */
let showHover = null;
/** Re-read the label under the pointer (its value changes when the machine does). */
function refreshHover() {
  if (lastPointer && showHover && !hover.hidden) showHover(lastPointer.x, lastPointer.y);
}

/** @param {THREE.Object3D} r */
function setupHover(r) {
  const canvas = viewer.renderer.domElement;
  // A click or tap is a press and release without a drag (dragging orbits the camera).
  /** @type {{ x: number; y: number; t: number } | null} */
  let down = null;
  canvas.addEventListener("pointerdown", (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
    hover.hidden = true; // a drag moves the camera: the label would point at the wrong part
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 600;
    down = null;
    if (moved > 6 || !quick) return;
    const i = clickIntent(pick(r, e.clientX, e.clientY));
    if (i) doIntent(i);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.buttons) return; // dragging
    lastPointer = { x: e.clientX, y: e.clientY };
    showHover?.(e.clientX, e.clientY);
  });
  showHover = /** @param {number} cx @param {number} cy */ (cx, cy) => {
    const e = { clientX: cx, clientY: cy };
    const b = canvas.getBoundingClientRect();
    const hit = pick(r, e.clientX, e.clientY);
    const label = hit ? labelFor(hit.object) : null;
    const intent = clickIntent(hit);
    canvas.style.cursor = intent ? "pointer" : "";
    hover.hidden = !label;
    if (label) {
      fillLabel(hover, label.name, label.value, label.red);
      /** @type {HTMLDivElement | null} */
      let hint = hover.querySelector(".hint");
      if (!hint) {
        hint = document.createElement("div");
        hint.className = "hint";
        hover.appendChild(hint);
      }
      hint.textContent = intent ? intentHint(intent, lang) : "";
      hint.hidden = !intent;
      hover.style.left = `${e.clientX - b.left}px`;
      hover.style.top = `${e.clientY - b.top}px`;
    }
  };
  canvas.addEventListener("pointerleave", () => (hover.hidden = true));
}

// ---- ?perf: frame rate and draw calls (for the Chromebook measurement) ---------------------------
if (new URLSearchParams(location.search).has("perf")) {
  const box = $("perf");
  box.hidden = false;
  // Rendered frames per second (0 while idle: the page renders on demand), and the cost of
  // the last rendered frame. "busy" = while the machine or camera moves.
  let last = viewer.renderedFrames;
  let t0 = performance.now();
  viewer.addFrameCallback(() => {
    const now = performance.now();
    if (now - t0 < 1000) return;
    const fps = Math.round(((viewer.renderedFrames - last) * 1000) / (now - t0));
    const info = viewer.renderer.info;
    box.textContent = `${fps === 0 ? "idle" : `${fps} fps`} · ${info.render.calls} draw calls · ${Math.round(info.render.triangles / 1000)} k tris · ${viewer.quality}${viewer.qualityMode === "auto" ? " (auto)" : ""}`;
    last = viewer.renderedFrames;
    t0 = now;
  });
}

// ---- load -----------------------------------------------------------------------------------------
viewer
  .load(MODEL)
  .then((r) => {
    root = r;
    rig = /** @type {Rig<string>} */ (new Rig(r, m2NodeNames(machine.registerDigits, machine.carriageDigits)));
    exploder = new Exploder(r);
    highlighter = new Highlighter(r);
    callouts = new Callouts($("stage"), viewer.camera, r);
    callouts.valueOf = (node) => partInfo(node, machine, lang);
    views = makeViews(viewer.camera, r);
    const [p, tg] = views.overview();
    viewer.camera.position.set(p.x, p.y, p.z);
    viewer.controls.target.set(tg.x, tg.y, tg.z);
    setupHover(r);
    applyToggles();
    status.textContent = "";
    render();
    if (selftestRequested()) {
      status.textContent = "Running the M3 self-test…";
      setTimeout(() => {
        const t0 = performance.now();
        exploder?.apply(0);
        const results = runM3Checks(r);
        showSelftest($("panel"), results, performance.now() - t0);
        status.textContent = "";
        applyToggles();
        render();
      }, 50);
    }
  })
  .catch(/** @param {unknown} err */ (err) => {
    status.textContent = `Could not load the model: ${err instanceof Error ? err.message : String(err)}`;
    console.error(err);
  });

render();

// ?debug exposes the page's state to the console (to set up states by hand).
if (new URLSearchParams(location.search).has("debug")) Object.assign(window, { machine, render, openLesson, LESSONS, viewer });
