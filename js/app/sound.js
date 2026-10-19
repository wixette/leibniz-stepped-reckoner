// The machine's sounds (docs/ui-design.md, U29). Only the machine makes sound; the interface is
// silent. One observer watches the machine every frame and sounds whatever moved, so the reader's
// own operations and a lesson's demonstrations sound alike:
// - a setting knob moved: a short tick (one per knob, not one per digit);
// - the main crank starts a turn: the full revolution, slowed to the turn's 1.2 s;
// - the carriage starts one place: the full revolution (the end crank turns once a place);
// - a carry stored (a wheel passed 9): a short tick; a carry passed on: a step;
// - the Magna Rota's pin put in or taken out: a step.
// The app adds the two that are not motion: the crank refused (blocked) and the crank at the stop.
// Sound starts after the reader's first press or key, as browsers require. Web Audio: decoded
// once, played with no delay, overlapping, each a little different in pitch and loudness so
// that repeated clicks do not sound recorded.

/** @import { Machine } from "../sim/machine.js" */

/** The version this module was loaded with (?v=), for the files it loads. */
const V = new URL(import.meta.url).search;

const FILES = /** @type {const} */ ({
  tick: "gear-click-step-short.mp3",
  step: "gear-click-step.mp3",
  turn: "gear-click-full-revolution.mp3",
  refuse: "gear-refusal.mp3",
  stop: "gear-stop.mp3",
});
/** @typedef {keyof typeof FILES} SoundName */

/** The files are levelled to full scale: play them at this. */
const LEVEL = 0.5;
/** How long the full-revolution sound is (s), and how long the crank and a place take (s). */
const REVOLUTION_S = 0.68;
const CRANK_TURN_S = 1.2; // 360° at the animator's 300°/s
const PLACE_S = 1 / 1.2; // one place at the animator's 1.2 places/s
/** Knobs moved at once tick this far apart (s). */
const TICK_GAP_S = 0.035;

/**
 * @typedef {object} Snapshot
 * @property {number[]} settings
 * @property {number | null} pin
 * @property {number} theta
 * @property {number} pos the carriage's position (places)
 * @property {string[]} carries
 */

export class Sound {
  /**
   * @private
   * @type {AudioContext | null}
   */
  ctx = null;
  /**
   * @private
   * @type {Partial<Record<SoundName, AudioBuffer>>}
   */
  buffers = {};
  /**
   * @private
   * @type {GainNode | null}
   */
  out = null;
  /** Muted by the reader (remembered by the app). */
  muted = false;
  /**
   * @private
   * @type {Snapshot | null}
   */
  last = null;

  /** Start listening for the first press or key, after which sound may start. */
  constructor() {
    const unlock = () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      this.start();
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
  }

  /** @private */
  async start() {
    if (this.ctx) return;
    const Ctx = window.AudioContext;
    if (!Ctx) return; // no Web Audio: the machine is silent
    this.ctx = new Ctx();
    this.out = this.ctx.createGain();
    this.out.gain.value = LEVEL;
    this.out.connect(this.ctx.destination);
    await Promise.all(
      Object.entries(FILES).map(async ([name, file]) => {
        try {
          const res = await fetch(new URL(`../../audio/${file}${V}`, import.meta.url));
          const data = await res.arrayBuffer();
          this.buffers[/** @type {SoundName} */ (name)] = await /** @type {AudioContext} */ (this.ctx).decodeAudioData(data);
        } catch {
          // a sound that cannot load stays silent; the machine works without it
        }
      }),
    );
  }

  /**
   * Play a sound now (or after a delay), at a speed (below 1: slower and lower).
   * @param {SoundName} name
   * @param {{ rate?: number; delay?: number }} [o]
   */
  play(name, o = {}) {
    const { ctx, out } = this;
    const buffer = this.buffers[name];
    if (this.muted || !ctx || !out || !buffer || ctx.state !== "running") return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    // a little different each time: ±4% in pitch, ±12% in loudness
    src.playbackRate.value = (o.rate ?? 1) * (0.96 + Math.random() * 0.08);
    const gain = ctx.createGain();
    gain.gain.value = 0.88 + Math.random() * 0.24;
    src.connect(gain).connect(out);
    src.start(ctx.currentTime + (o.delay ?? 0));
  }

  /**
   * Take the machine as it is now without sounding it: a lesson step set it up, or the page
   * just loaded.
   * @param {Machine} m
   */
  resync(m) {
    this.last = snapshot(m);
  }

  /**
   * Sound what moved since the last frame (the viewer's frame callback).
   * @param {Machine} m
   */
  watch(m) {
    const now = snapshot(m);
    const was = this.last;
    this.last = now;
    if (!was) return;
    // the setting knobs: a tick for each knob that moved
    let k = 0;
    now.settings.forEach((s, i) => s !== was.settings[i] && this.play("tick", { delay: k++ * TICK_GAP_S }));
    if (now.pin !== was.pin) this.play("step");
    // the main crank starts a turn (it rests at 0 between turns)
    if (was.theta === 0 && now.theta !== 0) this.play("turn", { rate: REVOLUTION_S / CRANK_TURN_S });
    // the carriage starts a place: leaving a whole place, or crossing one on a longer move
    if (now.pos !== was.pos) {
      const dir = Math.sign(now.pos - was.pos);
      const left = (/** @type {number} */ p) => (dir > 0 ? Math.floor(p + 1e-6) : Math.ceil(p - 1e-6));
      const starting = Number.isInteger(was.pos);
      const crossed = !Number.isInteger(now.pos) && left(now.pos) !== left(was.pos);
      if (starting || crossed) this.play("turn", { rate: REVOLUTION_S / PLACE_S });
    }
    // the carries: stored as a wheel passes 9 (a tick), passed on by its lever (a step)
    now.carries.forEach((c, i) => {
      const before = was.carries[i];
      if (before === "idle" && c !== "idle") this.play("tick");
      else if (before !== "idle" && c === "idle") this.play("step");
    });
  }
}

/**
 * @param {Machine} m
 * @returns {Snapshot}
 */
function snapshot(m) {
  return { settings: [...m.settings], pin: m.pin, theta: m.theta, pos: m.carriagePos, carries: m.carryStates() };
}
