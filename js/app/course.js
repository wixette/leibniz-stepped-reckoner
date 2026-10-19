// The dock's Get started and Lessons panels, and the step player that runs the tutorial and
// the lessons in them (docs/ui-design.md, U2, U3, U6). rebuild() lays a panel out again
// (a new step, a new language); update() follows the machine (the task line, Back and Next).

import { t, tn } from "../l10n/l10n.js";
import { el, icon } from "../ui/components.js";
import { LESSONS } from "../teach/lessons.js";
import { TUTORIAL } from "../teach/tutorial.js";
/** @import { Lesson } from "../teach/player.js" */
/** @import { App } from "./app.js" */

/** The version this module was loaded with (?v=), for the pictures it shows. */
const V = new URL(import.meta.url).search;

export class CourseUI {
  /** The dock tab on show (set by the page's tabs). */
  selected = "tab-start";
  /** @type {(id: string) => void} */
  selectTab = () => {};
  /**
   * The live parts of the player, set while one is shown.
   * @private
   * @type {{ taskline: HTMLElement; back: HTMLButtonElement; next: HTMLButtonElement; progress: HTMLElement } | null}
   */
  live = null;

  /** @param {App} app */
  constructor(app) {
    this.app = app;
  }

  /** Lay out the Get started and Lessons panels for the current course and language. */
  rebuild() {
    const c = this.app.course;
    this.live = null;
    const start = /** @type {HTMLElement} */ (document.getElementById("panel-start"));
    const lessons = /** @type {HTMLElement} */ (document.getElementById("panel-lessons"));
    start.replaceChildren(c?.tab === "tab-start" ? this.player() : this.startHome());
    lessons.replaceChildren(c?.tab === "tab-lessons" ? this.player() : this.lessonList());
    this.updateDots();
    this.update();
  }

  /** Show a dot on the tab of a course under way while another tab is on show. */
  updateDots() {
    const c = this.app.course;
    for (const id of ["tab-start", "tab-lessons"]) {
      const dot = document.getElementById(id)?.querySelector(".dot");
      if (dot instanceof HTMLElement) dot.hidden = !(c && !c.finished && c.tab === id && this.selected !== id);
    }
  }

  // ---- Get started -----------------------------------------------------------------------------------
  /** @private */
  startHome() {
    const chapters = TUTORIAL.steps.flatMap((s) => (s.chapter ? [s.chapter] : []));
    const doneTut = this.app.doneCourses().includes("tutorial");
    const cta = el("button", { class: "btn filled has-icon" }, [icon("play_arrow"), el("span", { text: t(doneTut ? "course.again" : "start.cta") })]);
    cta.addEventListener("click", () => this.app.startCourse(TUTORIAL, "tab-start"));
    const toLessons = el("button", { class: "btn tonal has-icon" }, [icon("school"), el("span", { text: t("course.toLessons") })]);
    toLessons.addEventListener("click", () => this.selectTab("tab-lessons"));
    /** @type {[import("../ui/components.js").IconName, string][]} */
    const howto = [
      ["3d_rotation", "start.look.drag"],
      ["open_in_new", "start.look.pan"],
      ["videocam", "start.look.zoom"],
      ["info", "start.look.point"],
      ["radio_button_checked", "start.look.click"],
      ["rotate_right", "start.look.crank"],
    ];
    return el("div", {}, [
      el("div", { class: "card hero" }, [
        el("h2", { text: t("start.welcome") }),
        el("p", { text: t("start.lead") }),
        el("p", { class: "lead", text: t("start.minutes") }),
        el("ol", { class: "chapters" }, chapters.map((k) => el("li", { text: t(k) }))),
        cta,
        doneTut ? el("span", { class: "lead", text: `  ✓ ${t("course.completed")}` }) : null,
      ]),
      el("p", { class: "lead", text: t("start.orTry") }),
      el("h3", { text: t("start.look") }),
      el("ul", { class: "howto" }, howto.map(([i, k]) => el("li", {}, [icon(i), el("span", { text: t(k) })]))),
      el("h3", { text: t("tab.lessons") }),
      el("p", { class: "lead", text: t("start.then") }),
      toLessons,
    ]);
  }

  // ---- Lessons -----------------------------------------------------------------------------------------
  /** @private */
  lessonList() {
    const done = new Set(this.app.doneCourses());
    return el("div", {}, [
      el("h2", { text: t("tab.lessons") }),
      el("p", { class: "lead", text: t("lessons.lead") }),
      el(
        "ol",
        { class: "lesson-list" },
        LESSONS.map((l, i) => {
          const b = el("button", { class: `lesson-item${done.has(l.id) ? " done" : ""}` }, [
            el("span", { class: "num" }, [done.has(l.id) ? icon("check") : String(i + 1)]),
            el("span", {}, [el("b", { text: t(l.title) }), el("span", { text: t(l.summary) })]),
            el("small", { text: tn("lessons.steps", l.steps.length) }),
          ]);
          if (done.has(l.id)) b.setAttribute("aria-label", `${t(l.title)} (${t("course.completed")})`);
          b.addEventListener("click", () => this.app.startCourse(l, "tab-lessons"));
          return el("li", {}, [b]);
        }),
      ),
    ]);
  }

  // ---- the player ----------------------------------------------------------------------------------------
  /** @private */
  player() {
    const app = this.app;
    const c = /** @type {NonNullable<App["course"]>} */ (app.course);
    if (c.finished) return this.finishCard(c.lesson);
    const lesson = c.lesson;
    const step = lesson.steps[c.i];
    const n = lesson.steps.length;
    const isTutorial = lesson.id === "tutorial";
    const lessonNo = LESSONS.indexOf(lesson) + 1;
    // the chapter this step belongs to (the tutorial)
    const chapterKeys = lesson.steps.flatMap((s) => (s.chapter ? [s.chapter] : []));
    const chapter = lesson.steps.slice(0, c.i + 1).reduce((a, s) => s.chapter ?? a, /** @type {string | undefined} */ (undefined));
    const kicker = chapter ? `${t("course.chapter", { i: chapterKeys.indexOf(chapter) + 1, n: chapterKeys.length })} · ${t(chapter)}` : isTutorial ? t("tut.title") : t("course.lessonNo", { n: lessonNo });

    const close = el("button", { class: "btn icon-only" }, [icon("close")]);
    close.setAttribute("aria-label", t("course.close.tip"));
    close.title = t("course.close.tip");
    close.addEventListener("click", () => app.closeCourse());
    const back = el("button", { class: "btn has-icon" }, [icon("chevron_left"), el("span", { text: t("course.back") })]);
    back.addEventListener("click", () => app.back());
    const last = c.i === n - 1;
    const next = el("button", { class: "btn filled" }, [el("span", { text: t(last ? "course.finish" : "course.next") }), icon(last ? "check" : "chevron_right")]);
    next.addEventListener("click", () => app.next());
    const progress = el(
      "div",
      { class: "progress", role: "progressbar", "aria-valuemin": "1", "aria-valuemax": String(n), "aria-valuenow": String(c.i + 1) },
      lesson.steps.map((_, i) => el("i", { class: i < c.i ? "done" : i === c.i ? "now" : "" })),
    );
    const taskline = el("div", { class: "taskline", role: "status" });
    const figure = step.image
      ? el("figure", { class: "figure" }, [
          el("img", { src: step.image.file + V, alt: t(step.image.credit), loading: "lazy" }),
          el("figcaption", { text: t(step.image.credit) }),
        ])
      : null;
    this.live = { taskline, back, next, progress };
    return el("div", { class: "player" }, [
      el("div", { class: "player-head" }, [el("div", { class: "titles" }, [el("div", { class: "kicker", text: kicker }), el("h2", { text: t(lesson.title) })]), close]),
      progress,
      el("div", { class: "step-meta" }, [el("span", { text: t("course.stepOf", { i: c.i + 1, n }) })]),
      figure,
      el("p", { class: "step-text", text: t(step.text) }),
      taskline,
      el("div", { class: "navrow" }, [back, next]),
    ]);
  }

  /**
   * @private
   * @param {Lesson} lesson
   */
  finishCard(lesson) {
    const app = this.app;
    const isTutorial = lesson.id === "tutorial";
    const k = LESSONS.indexOf(lesson);
    const following = k >= 0 ? LESSONS[k + 1] : undefined;
    /** @type {HTMLButtonElement[]} */
    const buttons = [];
    if (isTutorial) {
      const b = el("button", { class: "btn filled has-icon" }, [icon("school"), el("span", { text: t("course.toLessons") })]);
      b.addEventListener("click", () => {
        app.closeCourse();
        this.selectTab("tab-lessons");
      });
      buttons.push(b);
    } else if (following) {
      const b = el("button", { class: "btn filled has-icon" }, [icon("arrow_forward"), el("span", { text: t("course.nextLesson") })]);
      b.addEventListener("click", () => app.startCourse(following, "tab-lessons"));
      buttons.push(b);
    }
    const close = el("button", { class: "btn" }, [el("span", { text: t(isTutorial ? "course.close" : "course.allLessons") })]);
    close.addEventListener("click", () => app.closeCourse());
    buttons.push(close);
    return el("div", { class: "card finish-card" }, [
      icon("celebration"),
      el("h2", { text: t("course.wellDone") }),
      el("p", { class: "lead", text: isTutorial ? t("status.tutorialDone") : t("status.lessonDone", { title: t(lesson.title) }) }),
      following ? el("p", { text: `${t("course.nextLesson")}: ${t(following.title)}` }) : null,
      el("div", { class: "navrow", style: "justify-content:center" }, buttons),
    ]);
  }

  /** Follow the machine: the task line, Back and Next. */
  update() {
    this.updateDots();
    const live = this.live;
    const c = this.app.course;
    if (!live || !c || c.finished) return;
    const task = c.lesson.steps[c.i].task;
    const done = task ? task.check(this.app.machine) : false;
    const watching = c.playing || this.app.busy;
    live.taskline.hidden = !task && !watching;
    live.taskline.className = `taskline${watching ? " watch" : done ? " ok" : ""}`;
    live.taskline.replaceChildren(
      ...(watching ? [icon("videocam"), el("span", { text: t("course.watching") })] : done ? [icon("check_circle-fill"), el("span", { text: t("course.done") })] : [icon("lightbulb"), el("span", { text: t("course.yourTurn") })]),
    );
    live.next.disabled = !this.app.canNext();
    live.back.disabled = c.i === 0 || this.app.busy;
  }
}
