// The app: one machine, shown on the stage and operated from the machine strip or by clicking
// its parts; free play by default, and the tutorial or a lesson as a mode over it
// (docs/ui-design.md, U2). This module holds the state and keeps the page in step with it.

import { Machine } from "../sim/machine.js";
import { applyIcons, applyL10n, showMenu } from "../ui/components.js";
import { load, locale, LOCALE_NAMES, LOCALE_SHORT, LOCALES, setLocale, t, tn } from "../l10n/l10n.js";
/** @import { Locale } from "../l10n/l10n.js" */
import { applyIntentNow, controlOf, possible } from "../teach/partActions.js";
/** @import { Control, Intent } from "../teach/partActions.js" */
import { presentation, replayTo } from "../teach/player.js";
/** @import { Lesson, ViewName } from "../teach/player.js" */
import { placeWord } from "../teach/partInfo.js";
import { Animator } from "./animator.js";
import { Stage } from "./stage.js";
import { CourseUI } from "./course.js";
import { showAbout } from "./about.js";

/**
 * @template {HTMLElement} [T=HTMLElement]
 * @param {string} id
 */
const $ = (id) => /** @type {T} */ (document.getElementById(id));

/** Remembered in the browser (the page works without storage). */
export const store = {
  /** @param {string} k */
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  /**
   * @param {string} k
   * @param {string} v
   */
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode: not remembered */
    }
  },
};

/** @param {number} n */
export const group3 = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/**
 * The course being taken: the tutorial or a lesson.
 * @typedef {object} Course
 * @property {Lesson} lesson
 * @property {number} i the current step
 * @property {boolean} playing the step's own actions are still playing
 * @property {boolean} finished the last step is done
 * @property {"tab-start" | "tab-lessons"} tab where its player lives
 */

/** @typedef {Control | "reset"} StripControl */

export class App {
  machine = new Machine();
  /** @type {Course | null} */
  course = null;
  /**
   * The status line, as a function so it follows the language.
   * @private
   * @type {{ text: () => string; warn: boolean }}
   */
  status = { text: () => "", warn: false };
  /**
   * @private
   * @type {ViewName | null}
   */
  lastView = null;
  focus = false;
  /**
   * An inside view under way (U11): the drum or carry view in free play, which hid the case,
   * opened the front and faded what is not its parts. casing and cutaway hold what to put
   * back when it ends; null once the reader set that tool themselves (it is theirs then).
   * @type {{ view: ViewName; parts: string[]; casing: boolean | null; cutaway: boolean | null } | null}
   */
  inside = null;
  /** Called after the page's texts were put in a new language (panels the app does not own). */
  /** @type {() => void} */
  onRetranslate = () => {};

  constructor() {
    this.stage = new Stage($("stage"), $("hover"), this.machine);
    this.animator = new Animator(
      this.machine,
      () => this.stage.apart,
      () => this.changed(),
    );
    this.stage.allow = (i) => (i && possible(i, this.machine) && this.controlState(controlOf(i)).enabled ? i : null);
    this.stage.onIntent = (i) => this.doIntent(i);
    this.stage.viewer.addFrameCallback((dt) => {
      this.animator.tick(dt);
      if (this.stage.tickExplode(dt)) this.render();
      this.stage.updateCallouts();
    });
    this.courseUI = new CourseUI(this);
    this.wireTopBar();
    this.wireStage();
    this.wireStrip();
  }

  // ---- state changes -------------------------------------------------------------------------------
  /** The machine moved or was set: pose the model and update the page. */
  changed() {
    this.stage.pose();
    this.render();
  }

  /**
   * @param {() => string} text
   * @param {boolean} [warn]
   */
  say(text, warn = false) {
    this.status = { text, warn };
    this.renderStatus();
  }

  /** @returns {boolean} */
  get busy() {
    return this.animator.busy;
  }

  /**
   * The controls the current lesson step asks for (null: free play, all of them).
   * @returns {Set<StripControl> | null}
   */
  allowed() {
    const c = this.course;
    if (!c || c.finished) return null;
    const task = c.lesson.steps[c.i].task;
    return new Set(task && !c.playing ? task.controls : []);
  }

  /**
   * Whether a control can be used now, and if not, why (P6).
   * @param {StripControl} control
   * @param {1 | -1} [dir] for "shift": left (1) or right (-1)
   * @returns {{ enabled: boolean; reason: (() => string) | null; wanted: boolean }}
   */
  controlState(control, dir) {
    const m = this.machine;
    const allowed = this.allowed();
    const wanted = !!allowed?.has(control) && !this.course?.playing;
    /** @param {string} key */
    const no = (key) => ({ enabled: false, reason: () => t(key), wanted });
    if (!this.stage.root) return no("status.notReady");
    if (allowed && !allowed.has(control)) return no(this.course?.playing ? "course.watching" : "status.notNow");
    if (this.busy) return no("status.busy");
    if (this.stage.apart && control !== "reset") return no("status.apart");
    if (control === "shift" && dir === 1 && m.offset >= m.maxOffset) return no("status.carriageEnd");
    if (control === "shift" && dir === -1 && m.offset <= 0) return no("status.carriageEnd");
    if (control === "toStop" && m.pin === null) return no("status.noPin");
    if (control === "toStop" && m.blocked) return no("status.blockedPin");
    return { enabled: true, reason: null, wanted };
  }

  /**
   * Run a control's action if it can be used, else explain in the status line.
   * @param {StripControl} control
   * @param {() => void} action
   * @param {1 | -1} [dir]
   */
  use(control, action, dir) {
    const s = this.controlState(control, dir);
    if (!s.enabled) {
      if (s.reason) this.say(s.reason, true);
      return;
    }
    action();
  }

  /**
   * Why the crank refused to turn.
   * @param {1 | -1} dir
   * @returns {() => string}
   */
  blockText(dir) {
    const b = this.machine.startBlock(dir);
    if (b === "pin") return () => t(dir > 0 ? "status.blockedPin" : "status.blockedPinSub");
    if (b !== null && b !== "shifting") return () => t("status.blockedStore", { place: placeWord(b.storeFull) });
    return () => t("status.busy");
  }

  /** @param {1 | -1} dir */
  turn(dir) {
    const n = group3(this.inputNumber());
    this.animator.playPrims([{ theta: dir * 360 }], (blocked) => {
      if (blocked) this.say(this.blockText(blocked), true);
      else this.say(() => t(dir > 0 ? "status.added" : "status.subtracted", { n }));
      this.afterLearner();
    });
  }

  /** @param {1 | -1} dir left (1) or right (-1) */
  shift(dir) {
    const to = this.machine.offset + dir;
    this.animator.playPrims([{ shift: to }], () => {
      this.say(() => t("status.shifted", { where: this.carriageWhere() }));
      this.afterLearner();
    });
  }

  toStop() {
    const before = this.machine.turns;
    this.animator.play(this.animator.expand([{ toStop: true }]), () => {
      const n = this.machine.turns - before;
      this.say(() => tn("status.ranToStop", n));
      this.afterLearner();
    });
  }

  /** @param {number | null} hole */
  setPin(hole) {
    this.machine.setPin(hole);
    this.say(() => (hole === null ? t("status.pinOut") : t("status.pin", { n: hole })));
    this.afterLearner();
  }

  /** @param {number} x */
  setNumber(x) {
    this.machine.setNumber(x);
    this.say(() => t("status.set", { n: group3(x) }));
    this.afterLearner();
  }

  reset() {
    this.animator.stop();
    this.machine.reset();
    this.say(() => t("status.reset"));
    this.afterLearner();
  }

  /** After the learner did something: update, and tell them when a task is done. */
  afterLearner() {
    this.changed();
    const c = this.course;
    const task = c && !c.finished ? c.lesson.steps[c.i].task : undefined;
    if (task && task.check(this.machine)) this.say(() => t("status.stepDone"));
  }

  /** @param {Intent} i */
  doIntent(i) {
    if (i.kind === "turn") return this.turn(1);
    if (i.kind === "shiftTo" || i.kind === "shiftLeft") {
      const to = i.kind === "shiftTo" ? i.offset : this.machine.offset + 1;
      this.animator.playPrims([{ shift: to }], () => {
        this.say(() => t("status.shifted", { where: this.carriageWhere() }));
        this.afterLearner();
      });
      return;
    }
    applyIntentNow(i, this.machine);
    if (i.kind === "pin") this.say(() => (i.hole === null ? t("status.pinOut") : t("status.pin", { n: /** @type {number} */ (i.hole) })));
    else this.say(() => t("status.set", { n: group3(this.inputNumber()) }));
    this.afterLearner();
  }

  /** @returns {number} */
  inputNumber() {
    return this.machine.settings.reduce((a, s, i) => a + s * 10 ** i, 0);
  }

  /** @returns {string} */
  carriageWhere() {
    const o = this.machine.offset;
    return o === 0 ? t("value.home") : tn("value.placesLeft", o);
  }

  // ---- courses: the tutorial and the lessons ----------------------------------------------------------
  /**
   * @param {Lesson} lesson
   * @param {"tab-start" | "tab-lessons"} tab
   */
  startCourse(lesson, tab) {
    this.settle();
    this.endInside();
    this.course = { lesson, i: 0, playing: false, finished: false, tab };
    this.lastView = null;
    this.enterStep(0, true);
  }

  /**
   * @param {number} i
   * @param {boolean} replay set the machine to the step's start (Back, or a new course)
   */
  enterStep(i, replay) {
    const c = this.course;
    if (!c) return;
    this.animator.stop();
    if (replay) replayTo(c.lesson, i, this.machine);
    c.i = i;
    c.playing = true;
    this.showPresentation();
    this.say(() => "");
    this.courseUI.rebuild();
    this.changed();
    this.animator.play(this.animator.expand(c.lesson.steps[i].do ?? []), () => {
      c.playing = false;
      this.render();
    });
  }

  /**
   * Show a camera view. In free play the drum and carry views are inside views (U11): they hide
   * the case, open the front and fade what is not their parts, and the machine works as usual.
   * In a lesson step a view only moves the camera: the step's presentation stays.
   * @param {ViewName} view
   */
  chooseView(view) {
    const inCourse = !!this.course && !this.course.finished;
    if (!inCourse) this.endInside();
    const parts = inCourse ? undefined : this.stage.views?.[view].inside;
    if (parts) {
      this.inside = { view, parts, casing: this.stage.casing, cutaway: this.stage.cutaway };
      this.stage.casing = false;
      this.stage.cutaway = true;
      this.stage.applyToggles();
      this.focus = true;
      this.stage.highlight(parts, true);
      this.say(() => t("status.inside"));
    }
    this.stage.fly(view);
    this.render();
  }

  /** End an inside view: put back the tools it changed (unless the reader took them over). */
  endInside() {
    const v = this.inside;
    if (!v) return;
    this.inside = null;
    if (v.casing !== null) this.stage.casing = v.casing;
    if (v.cutaway !== null) this.stage.cutaway = v.cutaway;
    this.stage.applyToggles();
    this.focus = false;
    this.stage.highlight([], false);
  }

  /**
   * The parts shown highlighted now: the lesson step's, or the inside view's.
   * @returns {string[]}
   */
  highlightParts() {
    const c = this.course;
    if (c && !c.finished) return presentation(c.lesson, c.i).highlight;
    return this.inside?.parts ?? [];
  }

  /**
   * The parts Focus keeps besides the highlighted ones: the lesson step's context.
   * @returns {string[]}
   */
  focusContext() {
    const c = this.course;
    return c && !c.finished ? presentation(c.lesson, c.i).context : [];
  }

  /** Show the step's presentation: case, open front, taken apart, highlights, view. */
  showPresentation() {
    const c = this.course;
    if (!c) return;
    const p = presentation(c.lesson, c.i);
    this.stage.casing = p.casing;
    this.stage.cutaway = p.cutaway;
    this.stage.setExplode(p.explode);
    this.stage.applyToggles();
    this.focus = p.focus && p.highlight.length > 0;
    this.stage.highlight(p.highlight, this.focus, p.context);
    this.stage.setCallouts(p.callouts.map((x) => ({ node: x.node, text: () => t(x.text), value: x.value })));
    if (p.view !== this.lastView) this.stage.fly(p.view);
    this.lastView = p.view;
  }

  next() {
    const c = this.course;
    if (!c || !this.canNext()) return;
    if (c.i === c.lesson.steps.length - 1) this.finishCourse();
    else this.enterStep(c.i + 1, false);
  }

  back() {
    const c = this.course;
    if (c && c.i > 0 && !this.busy) this.enterStep(c.i - 1, true);
  }

  /** @returns {boolean} */
  canNext() {
    const c = this.course;
    if (!c || c.finished || c.playing || this.busy) return false;
    const task = c.lesson.steps[c.i].task;
    return !task || task.check(this.machine);
  }

  finishCourse() {
    const c = this.course;
    if (!c) return;
    c.finished = true;
    const done = new Set(this.doneCourses());
    done.add(c.lesson.id);
    store.set("lsr-done", JSON.stringify([...done]));
    this.clearPresentation();
    const title = t(c.lesson.title);
    this.say(() => (c.lesson.id === "tutorial" ? t("status.tutorialDone") : t("status.lessonDone", { title })));
    this.courseUI.rebuild();
    this.render();
  }

  /** Leave the course: free play again, with the machine as it is. */
  closeCourse() {
    this.settle();
    this.course = null;
    this.clearPresentation();
    this.say(() => "");
    this.courseUI.rebuild();
    this.render();
  }

  /** Bring a moving machine to rest at once (finish the turn or shift under way). */
  settle() {
    this.animator.stop();
    const m = this.machine;
    if (m.theta !== 0) m.setTheta(m.theta > 0 ? 360 : -360);
    if (m.carriagePos !== m.offset) m.setCarriagePos(Math.round(m.carriagePos));
  }

  /** @private */
  clearPresentation() {
    this.stage.highlight([], false);
    this.stage.setCallouts([]);
    this.stage.setExplode(0);
    this.stage.casing = true;
    this.stage.cutaway = false;
    this.stage.applyToggles();
    this.focus = false;
  }

  /** @returns {string[]} ids of the courses completed in this browser */
  doneCourses() {
    try {
      const v = JSON.parse(store.get("lsr-done") ?? "[]");
      return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  }

  // ---- the page -------------------------------------------------------------------------------------
  /** @private */
  wireTopBar() {
    const ws = $("workspace");
    const dockBtn = $("dockBtn");
    const setDock = (/** @type {boolean} */ open) => {
      ws.classList.toggle("dock-closed", !open);
      dockBtn.dataset.l10nTip = open ? "bar.dockHide" : "bar.dockShow";
      dockBtn.innerHTML = `<i data-icon="${open ? "right_panel_close" : "right_panel_open"}"></i>`;
      applyIcons(dockBtn);
      applyL10n(/** @type {ParentNode} */ (dockBtn.parentElement));
      dockBtn.setAttribute("aria-expanded", String(open));
      store.set("lsr-dock", open ? "open" : "closed");
    };
    setDock(store.get("lsr-dock") !== "closed");
    dockBtn.addEventListener("click", () => setDock(ws.classList.contains("dock-closed")));
    const langBtn = $("langBtn");
    langBtn.addEventListener("click", () =>
      showMenu(
        langBtn,
        LOCALES.map((l) => ({ label: LOCALE_NAMES[l], lang: l, checked: l === locale(), run: () => this.setLanguage(l) })),
      ),
    );
    $("aboutBtn").addEventListener("click", () => showAbout());
  }

  /** @private */
  wireStage() {
    /** @param {"caseChip" | "frontChip" | "apartChip" | "focusChip"} id */
    const chip = (id) => /** @type {HTMLButtonElement} */ ($(id));
    chip("caseChip").addEventListener("click", () => {
      if (this.inside) this.inside.casing = null; // the reader's now
      this.stage.casing = !this.stage.casing;
      this.stage.applyToggles();
      this.render();
    });
    chip("frontChip").addEventListener("click", () => {
      if (this.inside) this.inside.cutaway = null; // the reader's now
      this.stage.cutaway = !this.stage.cutaway;
      this.stage.applyToggles();
      this.render();
    });
    chip("apartChip").addEventListener("click", () => {
      if (this.busy) return this.say(() => t("status.busy"), true);
      this.stage.setExplode(this.stage.explodeTarget > 0 ? 0 : 1);
      if (this.stage.explodeTarget > 0) this.say(() => t("status.apart"));
      this.render();
    });
    chip("focusChip").addEventListener("click", () => {
      const parts = this.highlightParts();
      if (parts.length === 0) return this.say(() => t("tool.focus.off"), true);
      this.focus = !this.focus;
      this.stage.highlight(parts, this.focus, this.focusContext());
      this.render();
    });
    const viewsBtn = $("viewsBtn");
    /** @type {ViewName[]} */
    const views = ["overview", "register", "knobs", "front", "drum", "carry"];
    viewsBtn.addEventListener("click", () => showMenu(viewsBtn, views.map((v) => ({ label: t(`view.${v}`), run: () => this.chooseView(v) }))));
    $("resetViewBtn").addEventListener("click", () => this.chooseView("overview"));
  }

  /** @private */
  wireStrip() {
    const input = /** @type {HTMLInputElement} */ ($("numInput"));
    const commit = () => {
      const digits = input.value.replace(/\D/g, "").slice(-8);
      const x = Number(digits || "0");
      if (x === this.inputNumber()) return this.render();
      this.use("input", () => this.setNumber(x));
      this.render();
    };
    input.addEventListener("change", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
        input.select();
      }
    });
    input.addEventListener("beforeinput", (e) => {
      const s = this.controlState("input");
      if (!s.enabled) {
        e.preventDefault();
        if (s.reason) this.say(s.reason, true);
      }
    });
    input.addEventListener("focus", () => input.select());
    $("addBtn").addEventListener("click", () => this.use("add", () => this.turn(1)));
    $("subBtn").addEventListener("click", () => this.use("sub", () => this.turn(-1)));
    $("leftBtn").addEventListener("click", () => this.use("shift", () => this.shift(1), 1));
    $("rightBtn").addEventListener("click", () => this.use("shift", () => this.shift(-1), -1));
    $("toStopBtn").addEventListener("click", () => this.use("toStop", () => this.toStop()));
    $("resetBtn").addEventListener("click", () => this.use("reset", () => this.reset()));
    const pinBtn = $("pinBtn");
    pinBtn.addEventListener("click", () =>
      this.use("pin", () =>
        showMenu(
          pinBtn,
          [null, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((h) => ({
            label: h === null ? t("strip.pin.out") : String(h),
            checked: this.machine.pin === h,
            run: () => this.use("pin", () => this.setPin(h)),
          })),
        ),
      ),
    );
  }

  /** @param {Locale} l */
  async setLanguage(l) {
    await load(l);
    setLocale(l);
    store.set("lsr-locale", l);
    this.retranslate();
  }

  /** Put every text on the page in the current language. */
  retranslate() {
    const l = locale();
    document.documentElement.lang = l;
    document.title = t("app.title");
    document.querySelector('meta[name="description"]')?.setAttribute("content", t("app.description"));
    $("langShort").textContent = LOCALE_SHORT[l];
    applyL10n(document);
    this.courseUI.rebuild();
    this.stage.retranslate();
    this.onRetranslate();
    this.renderStatus();
    this.render();
  }

  /** Update everything that follows the machine and the course. */
  render() {
    const m = this.machine;
    // readouts
    $("resultOut").textContent = group3(m.shownNumber());
    const ring = Math.trunc(m.ringTurns + m.theta / 360);
    const turns = $("turnsOut");
    turns.textContent = String(Math.abs(ring));
    turns.classList.toggle("red", ring < 0);
    const place = m.carriagePos === m.offset ? String(m.offset) : m.carriagePos.toFixed(1);
    $("placeOut").textContent = place;
    $("placeStrip").textContent = place;
    // the strip
    /**
     * @param {string} id
     * @param {StripControl} control
     * @param {1 | -1} [dir]
     */
    const show = (id, control, dir) => {
      const s = this.controlState(control, dir);
      const b = $(id);
      b.setAttribute("aria-disabled", String(!s.enabled));
      b.classList.toggle("wanted", s.wanted && s.enabled);
    };
    show("addBtn", "add");
    show("subBtn", "sub");
    show("leftBtn", "shift", 1);
    show("rightBtn", "shift", -1);
    show("pinBtn", "pin");
    show("toStopBtn", "toStop");
    show("resetBtn", "reset");
    const input = /** @type {HTMLInputElement} */ ($("numInput"));
    const inputState = this.controlState("input");
    input.readOnly = !inputState.enabled;
    input.setAttribute("aria-disabled", String(!inputState.enabled));
    $("numberField").classList.toggle("wanted", inputState.wanted && inputState.enabled);
    if (document.activeElement !== input) input.value = String(this.inputNumber());
    $("pinValue").textContent = m.pin === null ? "–" : String(m.pin);
    // stage tools
    /**
     * @param {string} id
     * @param {boolean} on
     * @param {boolean} [enabled]
     */
    const chip = (id, on, enabled = true) => {
      $(id).setAttribute("aria-pressed", String(on));
      $(id).setAttribute("aria-disabled", String(!enabled));
    };
    chip("caseChip", this.stage.casing);
    chip("frontChip", this.stage.cutaway);
    chip("apartChip", this.stage.explodeTarget > 0, !this.busy);
    chip("focusChip", this.focus, this.highlightParts().length > 0);
    // the course and the mode
    this.courseUI.update();
    const c = this.course;
    const chipEl = $("modeChip");
    chipEl.textContent = c && !c.finished ? t("mode.step", { title: t(c.lesson.title), i: c.i + 1, n: c.lesson.steps.length }) : t("mode.free");
    chipEl.classList.toggle("course", !!c && !c.finished);
  }

  renderStatus() {
    const s = $("status");
    s.textContent = this.status.text();
    s.classList.toggle("warn", this.status.warn);
  }
}
