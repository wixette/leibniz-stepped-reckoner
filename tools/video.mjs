// The release videos, `pnpm video`: short clips of the machine at work, with its sound, in
// one or more languages. 1920 × 1080, H.264 and AAC in MP4.
//
//     pnpm video                          (English, into videos/en/)
//     pnpm video --lang en,zh --out ~/Movies/lsr
//     pnpm video --only carry --fps 60
//
// Frame by frame, not in real time: before the page loads, the page's clock
// (requestAnimationFrame and performance.now, which drive every motion through the viewer's
// frame callbacks) is replaced by one this tool advances by exactly one frame at a time,
// then takes the frame (tools/headless.mjs). So the video is smooth however slow the
// rendering, and no screen or audio device is recorded. The machine can run slower than
// the camera (slow motion), by scaling the animator's time step alone.
//
// The sound is not recorded either: every sound the app asks for (Sound.play, with its
// time, speed and delay) is logged, and the soundtrack is mixed afterwards from the same
// files in audio/, as js/app/sound.js plays them. A revolution's sound (a crank turn, a
// carriage place) is stretched to the motion's length in slow motion, keeping its pitch.
// Each soundtrack is then made as loud as it can be, its peak at -1 dB. Needs ffmpeg.

import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { openBrowser, ROOT, sleep } from "./headless.mjs";

const WIDTH = 1920;
const HEIGHT = 1080;
const RATE = 48000;
/** As in js/app/sound.js: the files, and the level they are played at. */
const FILES = {
  tick: "gear-click-step-short.mp3",
  step: "gear-click-step.mp3",
  turn: "gear-click-full-revolution.mp3",
  refuse: "gear-refusal.mp3",
  stop: "gear-stop.mp3",
};
const LEVEL = 0.5;
/** The soundtrack's peak, -1 dB. */
const PEAK = 10 ** (-1 / 20);

/** Installed before the page's own scripts: a clock that runs in real time until started. */
const CLOCK = `(() => {
  const realNow = performance.now.bind(performance);
  const realFrame = window.requestAnimationFrame.bind(window);
  let manual = false, t = 0, queue = [], id = 0;
  performance.now = () => (manual ? t : realNow());
  window.requestAnimationFrame = (cb) => {
    if (manual) { queue.push(cb); return ++id; }
    return realFrame((ts) => (manual ? queue.push(cb) : cb(ts)));
  };
  window.__clock = {
    start() { t = realNow(); manual = true; return t; },
    advance(ms) { t += ms; const q = queue; queue = []; for (const cb of q) cb(t); return t; },
    get now() { return t; },
  };
})();`;

/** Run in the page when recording starts: log the sounds, scale the machine's time, steer the camera. */
const RECORDER = `(() => {
  const s = app.sound, v = app.stage.viewer;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const rec = { sounds: [], motions: [], speed: 1, drift: [0, 0, 1], each: null, state: {} };
  s.resync(app.machine); // what was set up before is not heard
  const t0 = __clock.start();
  s.play = (name, o = {}) => {
    if (s.muted) return;
    // a little different each time, as Sound.play does
    rec.sounds.push({ name, t: (__clock.now - t0) / 1000 + (o.delay ?? 0), rate: (o.rate ?? 1) * (0.96 + rnd() * 0.08), gain: 0.88 + rnd() * 0.24 });
  };
  // When each crank turn and carriage move ran, for the length of its sound.
  let crankFrom = null, shiftFrom = null;
  const motions = () => {
    const m = app.machine, now = (__clock.now - t0) / 1000;
    const crank = m.theta !== 0, shift = !Number.isInteger(m.carriagePos);
    if (crank && crankFrom === null) crankFrom = now;
    if (!crank && crankFrom !== null) rec.motions.push({ start: crankFrom, end: now }), (crankFrom = null);
    if (shift && shiftFrom === null) shiftFrom = now;
    if (!shift && shiftFrom !== null) rec.motions.push({ start: shiftFrom, end: now }), (shiftFrom = null);
  };
  const tick = app.animator.tick.bind(app.animator);
  app.animator.tick = (dt) => tick(dt * rec.speed);
  // Orbit the camera by degrees across (+: to the machine's right) and up, and scale its distance.
  rec.orbit = (across, up, zoom) => {
    const c = v.camera, t = v.controls.target, o = c.position.clone().sub(t);
    const r = o.length() * zoom;
    const theta = Math.atan2(o.x, o.z) + (across * Math.PI) / 180;
    const phi = Math.min(Math.max(Math.acos(o.y / o.length()) - (up * Math.PI) / 180, 0.08), Math.PI / 2 + 0.25);
    c.position.copy(t).add(o.set(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta)).multiplyScalar(r));
    c.lookAt(t);
    v.invalidate();
  };
  // One frame: the scene's hook, the camera's drift (not while it flies to a view), the clock.
  rec.frame = (dt) => {
    rec.each?.(rec.state);
    const [a, u, z] = rec.drift;
    if (!v.isFlying && (a || u || z !== 1)) rec.orbit(a * dt, u * dt, z ** dt);
    __clock.advance(dt * 1000);
    motions();
  };
  window.__rec = rec;
})();`;

/** Page helpers for the setups, run before recording in real time. */
const HELPERS = `
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hideDock = async () => { document.getElementById("dockBtn").click(); await sleep(800); };
const view = async (v) => { app.chooseView(v); await sleep(2500); };
`;

/**
 * What a scene's script can do, frame-exact. Page code runs between frames, as the reader's
 * presses would.
 * @typedef {object} Take
 * @property {(js: string) => Promise<any>} run run page code now
 * @property {(id: string) => Promise<void>} press press a button on the page (by id)
 * @property {(seconds: number) => Promise<void>} hold record this long
 * @property {(seconds?: number) => Promise<void>} settle record until the machine is at rest (and the camera has landed)
 * @property {(x: number) => Promise<void>} speed run the machine at this speed (1: as on the page)
 * @property {(across: number, up?: number, zoom?: number) => Promise<void>} drift move the camera on its own, by degrees and a zoom factor a second
 * @property {(js: string | null) => Promise<void>} each run page code before every frame (with `rec`, and `s`, an object kept between frames)
 * @property {(v: string, seconds?: number) => Promise<void>} view fly to a view and record the flight and a little after
 * @property {(digits: number, gap?: number) => Promise<void>} type set a number on the knobs, a digit at a time as typed
 */

/**
 * @typedef {{ name: string; setup: string; script: (t: Take) => Promise<void> }} Scene
 */

/** Slow motion through a turn: quick to the first rib, slow while the ribs turn the wheels, slowest for the carries. */
const TURN_PROFILE = (/** @type {number} */ ribs, /** @type {number} */ carries) =>
  `const th = Math.abs(app.machine.theta); rec.speed = th < 70 ? 0.6 : th < 270 ? ${ribs} : ${carries};`;

/** @type {Scene[]} */
const SCENES = [
  {
    // The whole machine, at work, then taken apart and looked round to the back, coming nearer.
    name: "01-take-apart",
    setup: `await hideDock(); await view("overview");`,
    async script(t) {
      await t.drift(3);
      await t.hold(1.5);
      await t.type(1709, 0.15);
      await t.hold(0.4);
      await t.press("addBtn");
      await t.settle();
      await t.hold(0.6);
      await t.drift(0);
      await t.view("apart", 2.4);
      await t.drift(11, -0.6, 0.96);
      await t.hold(14);
      await t.drift(0);
      await t.hold(1.2);
    },
  },
  {
    // The stepped drum: 3, then 5 on the units knob, each added in slow motion.
    name: "02-stepped-drum",
    setup: `await hideDock(); await view("drum");`,
    async script(t) {
      await t.drift(1.5);
      await t.hold(1.2);
      await t.type(3);
      await t.hold(0.8);
      await t.each(TURN_PROFILE(0.3, 0.6));
      await t.press("addBtn");
      await t.settle();
      await t.each(null);
      await t.hold(1.2);
      await t.type(5);
      await t.hold(0.8);
      await t.each(TURN_PROFILE(0.3, 0.6));
      await t.press("addBtn");
      await t.settle();
      await t.each(null);
      await t.hold(1.5);
    },
  },
  {
    // The carry: 9999 + 1 passes a carry on four times; 10000 − 1 borrows back.
    name: "03-carry",
    setup: `await hideDock(); app.machine.setResult(9999); app.setNumber(1); app.changed(); await view("carry");`,
    async script(t) {
      await t.drift(-1.5);
      await t.hold(1.5);
      await t.each(TURN_PROFILE(0.8, 0.12));
      await t.press("addBtn");
      await t.settle();
      await t.hold(1.5);
      await t.press("subBtn");
      await t.settle();
      await t.each(null);
      await t.hold(1.5);
    },
  },
  {
    // 4789 + 5236 = 10025: the first number added, then the second watched inside, the drum
    // first and the carries as they come.
    name: "04-addition",
    setup: `await hideDock(); await view("overview");`,
    async script(t) {
      await t.drift(1.5);
      await t.hold(1.5);
      await t.view("knobs", 1.0);
      await t.type(4789);
      await t.hold(0.6);
      await t.view("overview", 1.0);
      await t.press("addBtn");
      await t.settle();
      await t.hold(1.0);
      await t.view("knobs", 1.0);
      await t.type(5236);
      await t.hold(0.6);
      await t.view("drum", 1.2);
      await t.each(`const th = app.machine.theta;
        if (!s.carry && th > 225) { s.carry = true; app.chooseView("carry"); }
        rec.speed = th < 60 ? 0.6 : th < 225 ? 0.3 : 0.1;`);
      await t.press("addBtn");
      await t.settle();
      await t.each(null);
      await t.hold(1.2);
      await t.view("register", 2.5);
      await t.view("overview", 2.0);
    },
  },
  {
    // 1709 × 365 = 623785: five turns, shift, six turns, shift, three turns, the Magna Rota's
    // pin stopping each run; each shift watched close up.
    name: "05-multiplication",
    setup: `await hideDock(); await view("overview");`,
    async script(t) {
      await t.drift(1.5);
      await t.hold(1.5);
      await t.view("knobs", 1.0);
      await t.type(1709);
      await t.hold(0.6);
      for (const [digit, shift] of /** @type {const} */ ([[5, true], [6, true], [3, false]])) {
        await t.view("front", 1.0);
        await t.run(`app.setPin(${digit})`);
        await t.hold(0.8);
        await t.press("toStopBtn");
        await t.settle();
        await t.hold(1.0);
        if (!shift) break;
        await t.run(`__shiftView()`);
        await t.settle();
        await t.hold(0.5);
        await t.speed(0.5);
        await t.press("leftBtn");
        await t.settle();
        await t.speed(1);
        await t.hold(0.8);
      }
      await t.view("register", 2.5);
      await t.view("overview", 2.0);
    },
  },
];

/** Where the carriage is shifted: the end crank, the lead screw and the carriage's end, from outside the left. */
const SHIFT_VIEW = `
const THREE = await import("three");
window.__shiftView = () => {
  const v = app.stage.viewer;
  const box = new THREE.Box3().setFromObject(app.stage.root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName("frame.lead_screw")));
  const target = new THREE.Vector3(box.min.x + 0.2, (box.min.y + box.max.y) / 2, 0.05);
  v.flyTo(target.clone().add(new THREE.Vector3(-0.3, 0.18, 0.3)), target, 1.0);
};`;

const { values: opts } = parseArgs({
  options: {
    lang: { type: "string", default: "en" },
    out: { type: "string", default: join(ROOT, "videos") },
    only: { type: "string", default: "" },
    fps: { type: "string", default: "30" },
  },
});
const FPS = Number(opts.fps);
const scenes = SCENES.filter((s) => s.name.includes(opts.only));
const work = mkdtempSync(join(tmpdir(), "lsr-video-"));

/**
 * Run ffmpeg; resolve with its output when it exits cleanly.
 * @param {string[]} args
 * @param {Buffer} [input]
 * @returns {Promise<Buffer>}
 */
function ffmpeg(args, input) {
  return new Promise((ok, fail) => {
    const p = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", ...args], { stdio: ["pipe", "pipe", "pipe"] });
    /** @type {Buffer[]} */
    const out = [];
    let err = "";
    p.stdout.on("data", (d) => out.push(d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", fail);
    p.on("exit", (code) => (code === 0 ? ok(Buffer.concat(out)) : fail(new Error(`ffmpeg ${args.join(" ")}: ${err}`))));
    p.stdin.end(input);
  });
}

/** @type {Map<string, Float32Array>} */
const decoded = new Map();
/**
 * A sound file as stereo samples at RATE, made longer by 1/stretch without changing its pitch.
 * @param {keyof typeof FILES} name
 * @param {number} stretch
 */
async function samples(name, stretch) {
  const key = `${name}@${stretch.toFixed(3)}`;
  let s = decoded.get(key);
  if (!s) {
    // atempo takes 0.5…100 a stage: chain stages for slower
    const stages = [];
    for (let x = stretch; x < 0.999; x /= Math.max(x, 0.5)) stages.push(Math.max(x, 0.5).toFixed(4));
    const filter = stages.length ? ["-filter:a", stages.map((x) => `atempo=${x}`).join(",")] : [];
    const raw = await ffmpeg(["-i", join(ROOT, "audio", FILES[name]), ...filter, "-f", "f32le", "-ac", "2", "-ar", String(RATE), "pipe:1"]);
    s = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
    decoded.set(key, s);
  }
  return s;
}

/**
 * Mix the logged sounds into a stereo track of the given length, as raw 32-bit floats.
 * @param {{ name: keyof typeof FILES; t: number; rate: number; gain: number }[]} sounds
 * @param {{ start: number; end: number }[]} motions
 * @param {number} seconds
 */
async function mix(sounds, motions, seconds) {
  const n = Math.ceil(seconds * RATE);
  const out = new Float32Array(n * 2);
  for (const e of sounds) {
    // a revolution lasts as long as the motion it started with, when that ran slower
    let stretch = 1;
    const motion = e.name === "turn" && motions.find((m) => Math.abs(m.start - e.t) < 1.5 / FPS);
    if (motion) {
      const played = (await samples("turn", 1)).length / 2 / RATE / e.rate;
      stretch = Math.min(1, played / (motion.end - motion.start));
      if (stretch > 0.97) stretch = 1;
    }
    const src = await samples(e.name, stretch);
    const frames = src.length / 2;
    const start = Math.round(e.t * RATE);
    const g = e.gain * LEVEL;
    for (let i = 0; start + i < n; i++) {
      const x = i * e.rate;
      const k = Math.floor(x);
      if (k + 1 >= frames) break;
      const f = x - k;
      for (let c = 0; c < 2; c++) out[(start + i) * 2 + c] += g * (src[k * 2 + c] * (1 - f) + src[(k + 1) * 2 + c] * f);
    }
  }
  // as loud as it can be without clipping: its peak at -1 dB
  const peak = out.reduce((p, x) => Math.max(p, Math.abs(x)), 0);
  const gain = peak > 0 ? PEAK / peak : 1;
  for (let i = 0; i < out.length; i++) out[i] *= gain;
  return Buffer.from(out.buffer);
}

const { send, evaluate, errors, load, close } = await openBrowser({ width: WIDTH, height: HEIGHT });
await send("Page.enable");
await send("Page.addScriptToEvaluateOnNewDocument", { source: CLOCK });

let failed = 0;
for (const lang of opts.lang.split(",")) {
  const dir = resolve(opts.out, lang);
  mkdirSync(dir, { recursive: true });
  for (const scene of scenes) {
    await load(lang);
    await evaluate(`(async () => { ${HELPERS} ${SHIFT_VIEW} ${scene.setup} })()`);
    await sleep(500);
    await evaluate(RECORDER);

    const video = join(work, "video.mp4");
    const encoder = spawn(
      "ffmpeg",
      ["-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
        "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", video],
      { stdio: ["pipe", "ignore", "inherit"] },
    );
    const encoded = new Promise((r) => encoder.on("exit", r));
    let frames = 0;
    const frame = async () => {
      await evaluate(`__rec.frame(${1 / FPS})`);
      const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 95 });
      if (!encoder.stdin.write(Buffer.from(shot.result.data, "base64"))) await new Promise((r) => encoder.stdin.once("drain", r));
      frames++;
    };
    /** @param {number} seconds */
    const hold = async (seconds) => {
      for (let i = Math.round(seconds * FPS); i > 0; i--) await frame();
    };
    /** @type {Take} */
    const take = {
      run: (js) => evaluate(js),
      press: async (id) => void (await evaluate(`document.getElementById(${JSON.stringify(id)}).click()`)),
      hold,
      async settle(seconds = 30) {
        await frame(); // the press starts the motion on the next frame
        for (let i = seconds * FPS; i > 0 && (await evaluate("app.busy || app.stage.viewer.isFlying")); i--) await frame();
      },
      speed: async (x) => void (await evaluate(`__rec.speed = ${x}`)),
      drift: async (across, up = 0, zoom = 1) => void (await evaluate(`__rec.drift = [${across}, ${up}, ${zoom}]`)),
      each: async (js) => void (await evaluate(js ? `__rec.state = {}; __rec.each = (s) => { const rec = __rec; ${js} }` : "__rec.each = null; __rec.speed = 1")),
      async view(v, seconds = 1.5) {
        await evaluate(`app.chooseView(${JSON.stringify(v)})`);
        await hold(seconds);
      },
      async type(digits, gap = 0.3) {
        const s = String(digits);
        for (let i = 1; i <= s.length; i++) {
          await evaluate(`app.setNumber(${s.slice(0, i)})`);
          await hold(gap);
        }
      },
    };
    await scene.script(take);
    encoder.stdin.end();
    await encoded;

    const seconds = frames / FPS;
    const { sounds, motions } = await evaluate("({ sounds: __rec.sounds, motions: __rec.motions })");
    const audio = join(work, "audio.f32");
    writeFileSync(audio, await mix(sounds, motions, seconds));
    const out = join(dir, `${scene.name}.mp4`);
    await ffmpeg(["-y", "-i", video, "-f", "f32le", "-ar", String(RATE), "-ac", "2", "-i", audio,
      "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out]);
    if (errors.length) failed++;
    console.log(`${lang}/${scene.name}.mp4  ${seconds.toFixed(1)} s, ${sounds.length} sounds${errors.length ? `  ERROR ${errors.join("; ")}` : ""}`);
  }
}
await close();
rmSync(work, { recursive: true, force: true });
process.exitCode = failed ? 1 : 0;
