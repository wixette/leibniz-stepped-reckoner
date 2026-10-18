import * as THREE from "three";
import { runM3Checks } from "../../src/accept/m3Checks";
import { selftestRequested, showSelftest } from "../../src/accept/selftestPanel";
import { applyM2Pose, m2NodeNames } from "../../src/scene/m2Pose";
import { Rig } from "../../src/scene/rig";
import { Callouts, Exploder, fillLabel, findNodes, Highlighter, makeViews } from "../../src/scene/teachScene";
import { Viewer } from "../../src/scene/viewer";
import { Machine } from "../../src/sim/machine";
import { registerValue } from "../../src/sim/operations";
import { type Lang, placeName, t, ui, type UIKey } from "../../src/teach/i18n";
import { LESSONS } from "../../src/teach/lessons";
import { partInfo } from "../../src/teach/partInfo";
import { applyIntentNow, controlOf, type Intent, intentAt, intentHint, possible } from "../../src/teach/partActions";
import { type Action, applyAction, type Lesson, presentation, replayTo, type ViewName } from "../../src/teach/player";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const MODEL = "../../m2-full-machine.glb";
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

let root: THREE.Object3D | null = null;
let rig: Rig<string> | null = null;
let exploder: Exploder | null = null;
let highlighter: Highlighter | null = null;
let callouts: Callouts | null = null;
let views: ReturnType<typeof makeViews> | null = null;

// ---- language (remembered per viewer; the page works without storage) -------------------------
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode: not remembered */
    }
  },
};
const urlLang = new URLSearchParams(location.search).get("lang");
let lang: Lang = urlLang === "de" || urlLang === "en" ? urlLang : store.get("lsr-lang") === "de" ? "de" : "en";

// ---- animation: crank turns and carriage shifts, one primitive at a time -----------------------
type Prim = { theta: number } | { shift: number };
let seq: Generator<Prim, void, void> | null = null;
let cur: Prim | null = null;
let onSeqDone: (() => void) | null = null;
let refusal: string | null = null; // why the crank did not move
let explodeTarget = 0;
const DEG_PER_SEC = 300;
const PLACES_PER_SEC = 1.2;

function play(gen: Generator<Prim, void, void>, done?: () => void) {
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

function* expand(actions: Action[]): Generator<Prim, void, void> {
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
    const dir: 1 | -1 = target > machine.theta ? 1 : -1;
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

function blockText(dir: 1 | -1): string | null {
  const b = machine.startBlock(dir);
  if (b === null || b === "shifting") return null;
  if (b === "pin") return ui(dir > 0 ? "blockedPin" : "blockedPinSub", lang);
  return ui("blockedStore", lang, { place: placeName(b.storeFull, lang) });
}

// ---- lessons --------------------------------------------------------------------------------------
type Mode = "menu" | "lesson" | "free";
let mode: Mode = "menu";
let lesson: Lesson | null = null;
let stepIdx = 0;
let stepPlaying = false;
let lastView: ViewName | null = null;

function enterStep(i: number, replay: boolean) {
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
  ($("casing") as HTMLInputElement).checked = p.casing;
  ($("cutaway") as HTMLInputElement).checked = p.cutaway;
  ($("explode") as HTMLInputElement).checked = p.explode > 0;
  ($("focus") as HTMLInputElement).checked = p.focus && p.highlight.length > 0;
  explodeTarget = p.explode;
  applyToggles();
  highlighter?.set(p.highlight, p.focus && p.highlight.length > 0);
  viewer.invalidate();
  callouts?.set(p.callouts.map((c) => ({ node: c.node, text: t(c.text, lang) })));
  if (views && p.view !== lastView) viewer.flyTo(...views[p.view]());
  lastView = p.view;
}

function openLesson(l: Lesson) {
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
  ($("explode") as HTMLInputElement).checked = false;
  render();
}

// ---- rendering ----------------------------------------------------------------------------------
function applyToggles() {
  if (!root) return;
  viewer.invalidate();
  for (const n of CASING) for (const o of findNodes(root, n)) o.visible = ($("casing") as HTMLInputElement).checked;
  for (const o of findNodes(root, "pm.carriage_panel")) o.visible = !($("cutaway") as HTMLInputElement).checked;
}

const group3 = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

function render() {
  viewer.invalidate();
  if (rig && root && exploder) exploder.pose(() => applyM2Pose(rig!, root!, machine));
  for (const el of document.querySelectorAll<HTMLElement>("[data-ui]")) el.textContent = ui(el.dataset.ui as UIKey, lang);
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
    const b = list.children[i] as HTMLButtonElement;
    b.querySelector("b")!.textContent = t(l.title, lang);
    b.querySelector("span")!.textContent = t(l.summary, lang);
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
    ($("next") as HTMLButtonElement).textContent = ui(last ? "finish" : "next", lang);
    ($("next") as HTMLButtonElement).disabled = stepPlaying || busy() || (!!task && !doneTask);
    ($("back") as HTMLButtonElement).textContent = ui("back", lang);
    ($("back") as HTMLButtonElement).disabled = stepIdx === 0 || busy();
  }

  // controls: everything in free play; in a lesson only what the current task needs
  const allowed = mode === "free" ? null : new Set<string>(task && !stepPlaying ? task.controls : []);
  $("controls").hidden = mode === "menu" || (allowed !== null && allowed.size === 0);
  for (const el of document.querySelectorAll<HTMLElement>("[data-control]")) {
    const c = el.dataset.control!;
    el.hidden = c === "reset" ? mode !== "free" : allowed !== null && !allowed.has(c);
  }
  const locked = apart();
  $("lockednote").hidden = !locked;
  $("lockednote").textContent = ui("apartLocked", lang);
  const rest = machine.atRest && !busy() && !locked;
  const input = $("input") as HTMLInputElement;
  input.disabled = !rest;
  if (document.activeElement !== input) input.value = String(machine.settings.reduce((a, s, i) => a + s * 10 ** i, 0));
  ($("add") as HTMLButtonElement).textContent = ui("add", lang);
  ($("sub") as HTMLButtonElement).textContent = ui("sub", lang);
  ($("shiftLeft") as HTMLButtonElement).textContent = ui("shiftLeft", lang);
  ($("shiftRight") as HTMLButtonElement).textContent = ui("shiftRight", lang);
  ($("toStop") as HTMLButtonElement).textContent = ui("toStop", lang);
  ($("reset") as HTMLButtonElement).textContent = ui("reset", lang);
  ($("add") as HTMLButtonElement).disabled = busy() || locked;
  ($("sub") as HTMLButtonElement).disabled = busy() || locked;
  ($("explode") as HTMLInputElement).disabled = busy();
  // "Fade the other parts" only means something on a lesson step that highlights parts.
  const canFocus = mode === "lesson" && !!lesson && presentation(lesson, stepIdx).highlight.length > 0;
  const focusBox = $("focus") as HTMLInputElement;
  focusBox.disabled = !canFocus;
  if (!canFocus) focusBox.checked = false;
  focusBox.parentElement!.style.opacity = canFocus ? "" : "0.45";
  focusBox.parentElement!.title = canFocus ? "" : ui("focusHint", lang);
  ($("shiftLeft") as HTMLButtonElement).disabled = !rest || machine.offset >= machine.maxOffset;
  ($("shiftRight") as HTMLButtonElement).disabled = !rest || machine.offset <= 0;
  ($("toStop") as HTMLButtonElement).disabled = !rest || machine.pin === null || !machine.canStart(1);
  for (const b of $("pins").querySelectorAll<HTMLButtonElement>("button")) {
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
const turn = (dir: 1 | -1) => !busy() && !apart() && play((function* () { yield { theta: dir * 360 } as Prim; })(), learnerDid);
$("add").addEventListener("click", () => turn(1));
$("sub").addEventListener("click", () => turn(-1));
$("shiftLeft").addEventListener("click", () => !busy() && !apart() && play((function* () { yield { shift: machine.offset + 1 } as Prim; })(), learnerDid));
$("shiftRight").addEventListener("click", () => !busy() && !apart() && play((function* () { yield { shift: machine.offset - 1 } as Prim; })(), learnerDid));
$("toStop").addEventListener("click", () => !busy() && !apart() && play(expand([{ toStop: true }]), learnerDid));
$("reset").addEventListener("click", () => {
  stopAnimation();
  machine.reset();
  learnerDid();
});
$("input").addEventListener("change", (e) => {
  const x = Math.max(0, Math.min(99_999_999, Math.floor(Number((e.target as HTMLInputElement).value) || 0)));
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
$("explode").addEventListener("change", (e) => (explodeTarget = (e.target as HTMLInputElement).checked ? 1 : 0));
$("focus").addEventListener("change", (e) => {
  if (lesson) highlighter?.set(presentation(lesson, stepIdx).highlight, (e.target as HTMLInputElement).checked);
  viewer.invalidate();
});
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-view]")) {
  b.addEventListener("click", () => {
    hover.hidden = true;
    if (views) viewer.flyTo(...views[b.dataset.view as ViewName]());
  });
}

// ---- hover labels (in the page's language) --------------------------------------------------------
const hover = $("hover");
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
/** Name and live value of the part under the pointer (the model's label when it has no value). */
function labelFor(o: THREE.Object3D | null): { name: string; value: string | null; red?: boolean } | null {
  for (let n = o; n; n = n.parent) {
    const info = partInfo(n.name, machine, lang);
    if (info) return info;
    const ud = n.userData as { label_en?: string; label_de?: string };
    const l = lang === "de" ? ud.label_de : ud.label_en;
    if (l) return { name: l, value: null };
  }
  return null;
}
/** The first visible part under a screen point. */
function pick(r: THREE.Object3D, clientX: number, clientY: number): THREE.Intersection | undefined {
  const b = viewer.renderer.domElement.getBoundingClientRect();
  ndc.set(((clientX - b.left) / b.width) * 2 - 1, -((clientY - b.top) / b.height) * 2 + 1);
  raycaster.setFromCamera(ndc, viewer.camera);
  return raycaster.intersectObject(r, true).find((h) => {
    for (let p: THREE.Object3D | null = h.object; p; p = p.parent) if (!p.visible) return false;
    return true;
  });
}

/** A click's operation, if the learner may do it now (same rules as the panel controls). */
function clickIntent(hit: THREE.Intersection | undefined): Intent | null {
  if (!hit || busy() || apart() || mode === "menu") return null;
  const i = intentAt(hit.object, hit.point, machine);
  if (!i || !possible(i, machine)) return null;
  if (mode === "lesson") {
    const task = lesson?.steps[stepIdx].task;
    if (stepPlaying || !task || !task.controls.includes(controlOf(i))) return null;
  }
  return i;
}

function doIntent(i: Intent) {
  if (i.kind === "turn") return turn(1); // animated, like the Add button
  if (i.kind === "setDigit" || i.kind === "nextDigit" || i.kind === "pin") applyIntentNow(i, machine);
  else {
    const to = i.kind === "shiftTo" ? i.offset : machine.offset + 1;
    return play((function* () { yield { shift: to } as Prim; })(), learnerDid);
  }
  learnerDid();
}

let lastPointer: { x: number; y: number } | null = null;
let showHover: ((x: number, y: number) => void) | null = null;
/** Re-read the label under the pointer (its value changes when the machine does). */
function refreshHover() {
  if (lastPointer && showHover && !hover.hidden) showHover(lastPointer.x, lastPointer.y);
}

function setupHover(r: THREE.Object3D) {
  const canvas = viewer.renderer.domElement;
  // A click or tap is a press and release without a drag (dragging orbits the camera).
  let down: { x: number; y: number; t: number } | null = null;
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
    showHover!(e.clientX, e.clientY);
  });
  showHover = (cx: number, cy: number) => {
    const e = { clientX: cx, clientY: cy };
    const b = canvas.getBoundingClientRect();
    const hit = pick(r, e.clientX, e.clientY);
    const label = hit ? labelFor(hit.object) : null;
    const intent = clickIntent(hit);
    canvas.style.cursor = intent ? "pointer" : "";
    hover.hidden = !label;
    if (label) {
      fillLabel(hover, label.name, label.value, label.red);
      let hint = hover.querySelector<HTMLDivElement>(".hint");
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
    rig = new Rig<string>(r, m2NodeNames(machine.registerDigits, machine.carriageDigits));
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
        exploder!.apply(0);
        const results = runM3Checks(r);
        showSelftest($("panel"), results, performance.now() - t0);
        status.textContent = "";
        applyToggles();
        render();
      }, 50);
    }
  })
  .catch((err: unknown) => {
    status.textContent = `Could not load the model: ${err instanceof Error ? err.message : String(err)}`;
    console.error(err);
  });

render();

// ?debug exposes the page's state to the console (to set up states by hand).
if (new URLSearchParams(location.search).has("debug")) Object.assign(window, { machine, render, openLesson, LESSONS, viewer });
