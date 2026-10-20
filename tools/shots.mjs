// The release screenshots, `pnpm shots`: the README's pictures and a set for posts (the
// Taken apart view from several sides and distances, the drum and carry views, and the
// multiplication lesson step by step), in one or more languages.
//
//     pnpm shots                          (English, into shots/en/)
//     pnpm shots --lang en,zh --out ~/Pictures/shots
//     pnpm shots --only apart             (the shots whose name contains "apart")
//
// It serves the repository itself, drives headless Chrome over the DevTools protocol at
// 1600 × 900 and writes JPEGs. A view shot is the stage alone, with the dock hidden
// (1600 × 814); a lesson shot is the whole page. Each shot loads the page afresh, with
// ?debug for window.app, and sets it up through the app as a reader would leave it.
// Chrome is found at its usual place, or set CHROME. The models must be checked out
// from Git LFS. The README's six pictures are images/readme/<name>.jpg.

import { spawn } from "node:child_process";
import { createReadStream, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
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
  options: { lang: { type: "string", default: "en" }, out: { type: "string", default: join(ROOT, "shots") }, only: { type: "string", default: "" } },
});
const shots = SHOTS.filter((s) => s.name.includes(opts.only));
if (readFileSync(join(ROOT, "assets/m2-full-machine.glb")).subarray(0, 4).toString() !== "glTF") {
  throw new Error("assets/m2-full-machine.glb is not a model: fetch it with `git lfs pull`");
}

/** @type {Record<string, string>} */
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav",
};
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  let file = normalize(join(ROOT, path));
  try {
    if (!file.startsWith(ROOT)) throw new Error();
    if (statSync(file).isDirectory()) file = join(file, "index.html");
    statSync(file);
  } catch {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", () => r(undefined)));
const address = server.address();
const site = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/`;

const CHROME =
  process.env.CHROME ??
  { darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" }[
    /** @type {string} */ (process.platform)
  ] ??
  "google-chrome";
const profile = mkdtempSync(join(tmpdir(), "lsr-shots-"));
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(
  CHROME,
  [
    "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--enable-gpu", "--hide-scrollbars",
    `--window-size=${WIDTH},${HEIGHT}`, "--force-device-scale-factor=1", "--mute-audio",
    ...(process.platform === "darwin" ? ["--use-angle=metal"] : []), "about:blank",
  ],
  { stdio: "ignore" },
);

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** @type {{ type: string; webSocketDebuggerUrl: string }[] | undefined} */
let targets;
for (let i = 0; i < 50 && !targets; i++) {
  targets = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json(), () => sleep(200).then(() => undefined));
}
const target = targets?.find((t) => t.type === "page");
if (!target) throw new Error(`Chrome did not start (${CHROME}); set CHROME to its path`);
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let nextId = 0;
/** @type {Map<number, (m: any) => void>} */
const replies = new Map();
/** @type {string[]} */
const errors = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(String(e.data));
  replies.get(m.id)?.(m);
  replies.delete(m.id);
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
});
/**
 * @param {string} method
 * @param {object} [params]
 * @returns {Promise<any>}
 */
const send = (method, params = {}) =>
  new Promise((r) => {
    const id = ++nextId;
    replies.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
/** @param {string} expression */
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text);
  return r.result?.result?.value;
};
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });

let failed = 0;
for (const lang of opts.lang.split(",")) {
  const dir = resolve(opts.out, lang);
  mkdirSync(dir, { recursive: true });
  for (const s of shots) {
    errors.length = 0;
    await evaluate("try { localStorage.clear() } catch {}").catch(() => {}); // no lesson done or to resume
    await send("Page.navigate", { url: `${site}?lang=${lang}&debug&quality=high` });
    await sleep(500);
    for (let i = 0; i < 150; i++) {
      if (await evaluate("!!(window.app?.stage.root && document.getElementById('loader').hidden)").catch(() => false)) break;
      await sleep(200);
    }
    await sleep(500);
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
ws.close();
await new Promise((r) => (chrome.once("exit", r), chrome.kill()));
server.close();
rmSync(profile, { recursive: true, force: true });
process.exitCode = failed ? 1 : 0;
