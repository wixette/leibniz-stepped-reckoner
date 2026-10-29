// The release screenshots, `pnpm shots`: the README's pictures and a set for posts (the
// Taken apart view from several sides and distances, the drum and carry views, and the
// multiplication lesson step by step), in one or more languages.
//
//     pnpm shots                          (English, into ~/Downloads/leibniz-v<version>-media/shots/en/)
//     pnpm shots --lang en,zh --out ~/Pictures/shots
//     pnpm shots --only apart             (the shots whose name contains "apart")
//
// It drives headless Chrome at 1600 × 900 (tools/headless.mjs) and writes JPEGs. A view
// shot is the stage alone, with the dock hidden (1600 × 814); a lesson shot is the whole
// page. Each shot loads the page afresh and sets it up through the app as a reader would
// leave it. The README's six pictures are images/readme/<name>.jpg.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { mediaDir, openBrowser, sleep } from "./headless.mjs";

const WIDTH = 1600;
const HEIGHT = 900;
const QUALITY = 94;

/**
 * A shot: its file name, the stage alone or the whole page, a setup run in the page as
 * the body of an async function (with the helpers in HELPERS), and how long to wait after.
 * @typedef {{ name: string; page?: boolean; setup: string; wait?: number }} Shot
 */

/** Run in the page before each setup. */
const HELPERS = `
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hideDock = async () => { document.getElementById("dockBtn").click(); await sleep(600); };
const view = async (v) => { app.chooseView(v); await sleep(2500); };
// Orbit the camera from where it is, in degrees: across (+ to the machine's right) and up;
// scale its distance (below 1: nearer), and move it across and up by fractions of that.
const cam = async (across = 0, up = 0, zoom = 1, panX = 0, panY = 0) => {
  const v = app.stage.viewer, c = v.camera, t = v.controls.target.clone();
  const o = c.position.clone().sub(t), r = o.length() * zoom;
  const theta = Math.atan2(o.x, o.z) + (across * Math.PI) / 180;
  const phi = Math.min(Math.max(Math.acos(o.y / o.length()) - (up * Math.PI) / 180, 0.08), Math.PI / 2 + 0.25);
  const p = t.clone().add(o.set(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta)).multiplyScalar(r));
  c.position.copy(p);
  c.lookAt(t);
  c.updateMatrixWorld();
  const move = o.setFromMatrixColumn(c.matrixWorld, 0).multiplyScalar(panX * r).add(t.clone().setFromMatrixColumn(c.matrixWorld, 1).multiplyScalar(panY * r));
  v.flyTo(p.add(move), t.add(move), 0.001);
  await sleep(400);
};
// The multiplication lesson at a step, with the step's task done when asked.
const lesson = async (id, i, done) => {
  const { LESSONS } = await import("./js/teach/lessons.js");
  const l = LESSONS.find((x) => x.id === id);
  app.courseUI.selectTab("tab-lessons");
  app.startCourse(l, "tab-lessons");
  if (i > 0) app.enterStep(i, true);
  await sleep(2500);
  const task = l.steps[i].task;
  if (done && task) { task.solve(app.machine); app.afterLearner(); await sleep(800); }
};
`;

const APART = `await hideDock(); await view("apart"); await sleep(1000);`;
const DRUM = `await hideDock(); app.setNumber(3); await view("drum"); app.machine.setTheta(225); app.changed();`;
const CARRY = `await hideDock(); app.machine.setResult(9999); app.setNumber(1); await view("carry"); app.machine.setTheta(300); app.changed();`;

/** @type {Shot[]} */
const SHOTS = [
  // The README's pictures.
  { name: "free-play", page: true, setup: "", wait: 3000 },
  { name: "lesson-carry", page: true, setup: `await lesson("carry", 3, false);`, wait: 3000 },
  { name: "view-apart", setup: APART },
  { name: "view-drum", setup: DRUM },
  { name: "view-carry", setup: CARRY },
  {
    name: "view-magna",
    setup: `await hideDock(); app.setNumber(1709); app.setPin(5); app.machine.turn(1); app.machine.turn(1); app.changed(); await view("front");`,
  },
  // Taken apart, from several sides and distances.
  { name: "apart-wide-front", setup: `${APART} await cam(-35, 10);` },
  { name: "apart-wide-left", setup: `${APART} await cam(-75, 5, 1.05);` },
  { name: "apart-wide-rear", setup: `${APART} await cam(150, 10);` },
  { name: "apart-wide-above", setup: `${APART} await cam(-30, 35);` },
  { name: "apart-mid-front", setup: `${APART} await cam(0, 0, 0.55);` },
  { name: "apart-mid-low-front", setup: `${APART} await cam(-20, -20, 0.85);` },
  { name: "apart-mid-right", setup: `${APART} await cam(40, 15, 0.6);` },
  { name: "apart-close-carriage", setup: `${APART} await cam(-35, 5, 0.4, -0.1);` },
  { name: "apart-close-register-rear", setup: `${APART} await cam(150, 10, 0.5);` },
  // The stepped drum, the other parts faded, mid-turn with 3 set.
  { name: "drum-left", setup: `${DRUM} await cam(-35, 5);` },
  { name: "drum-right", setup: `${DRUM} await cam(35, 10);` },
  { name: "drum-above", setup: `${DRUM} await cam(0, 25, 0.8);` },
  { name: "drum-wide-right", setup: `${DRUM} await cam(60, 20, 1.1);` },
  // The carry, the other parts faded, mid-turn in 9999 + 1.
  { name: "carry-left", setup: `${CARRY} await cam(-35, 5);` },
  { name: "carry-right", setup: `${CARRY} await cam(35, 10);` },
  { name: "carry-above", setup: `${CARRY} await cam(0, 25, 0.8);` },
  { name: "carry-close", setup: `${CARRY} await cam(-20, -10, 0.6);` },
  // The multiplication lesson, 1709 × 365, from start to finish.
  { name: "lesson-multiply-01-set-1709", page: true, setup: `await lesson("multiply", 0, true);` },
  { name: "lesson-multiply-02-pin-in-5", page: true, setup: `await lesson("multiply", 1, true);` },
  {
    name: "lesson-multiply-03-run-to-stop",
    page: true,
    setup: `await lesson("multiply", 2, false); document.getElementById("toStopBtn").click(); await sleep(2200);`,
    wait: 0,
  },
  { name: "lesson-multiply-04-times-5", page: true, setup: `await lesson("multiply", 3, true);` },
  { name: "lesson-multiply-05-shift", page: true, setup: `await lesson("multiply", 4, true);` },
  { name: "lesson-multiply-06-times-60", page: true, setup: `await lesson("multiply", 5, true);` },
  { name: "lesson-multiply-07-times-300", page: true, setup: `await lesson("multiply", 6, true);` },
  { name: "lesson-multiply-08-result", page: true, setup: `await lesson("multiply", 7, true);` },
  { name: "lesson-multiply-09-finished", page: true, setup: `await lesson("multiply", 7, true); app.next(); await sleep(800);` },
];

const { values: opts } = parseArgs({
  options: { lang: { type: "string", default: "en" }, out: { type: "string", default: mediaDir("shots") }, only: { type: "string", default: "" } },
});
const shots = SHOTS.filter((s) => s.name.includes(opts.only));
const { send, evaluate, errors, load, close } = await openBrowser({ width: WIDTH, height: HEIGHT });

let failed = 0;
for (const lang of opts.lang.split(",")) {
  const dir = resolve(opts.out, lang);
  mkdirSync(dir, { recursive: true });
  for (const s of shots) {
    await load(lang);
    try {
      await evaluate(`(async () => { ${HELPERS} ${s.setup} })()`);
    } catch (e) {
      errors.push(String(e));
    }
    await sleep(s.wait ?? 1200);
    const clip = s.page ? undefined : { ...JSON.parse(await evaluate("JSON.stringify(document.getElementById('stage').getBoundingClientRect())")), scale: 1 };
    const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: QUALITY, ...(clip && { clip }) });
    writeFileSync(join(dir, `${s.name}.jpg`), Buffer.from(shot.result.data, "base64"));
    if (errors.length) failed++;
    console.log(`${lang}/${s.name}.jpg${errors.length ? `  ERROR ${errors.join("; ")}` : ""}`);
  }
}
await close();
process.exitCode = failed ? 1 : 0;
