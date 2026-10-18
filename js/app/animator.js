// Animates the machine: crank turns and carriage shifts, one primitive at a time, at a
// steady speed. A lesson step's actions and the learner's own operations both play through
// here, so the page shows every motion the machine makes.

import { registerValue } from "../sim/operations.js";
/** @import { Machine } from "../sim/machine.js" */
import { applyAction } from "../teach/player.js";
/** @import { Action } from "../teach/player.js" */

/** @typedef {{ theta: number } | { shift: number }} Prim */

const DEG_PER_SEC = 300;
const PLACES_PER_SEC = 1.2;

export class Animator {
  /**
   * @private
   * @type {Generator<Prim, void, void> | null}
   */
  seq = null;
  /**
   * @private
   * @type {Prim | null}
   */
  cur = null;
  /**
   * @private
   * @type {((blocked: 1 | -1 | null) => void) | null}
   */
  onDone = null;

  /**
   * @param {Machine} machine
   * @param {() => boolean} paused true while the machine is taken apart: motion waits
   * @param {() => void} changed called whenever the machine moved
   */
  constructor(machine, paused, changed) {
    this.machine = machine;
    this.paused = paused;
    this.changed = changed;
  }

  /** @returns {boolean} */
  get busy() {
    return this.cur !== null || this.seq !== null;
  }

  /**
   * Play a sequence. done() is called when it ends, with the direction the crank refused to
   * turn in if it was blocked (the pin on the stop, a full carry store), else null.
   * @param {Generator<Prim, void, void>} gen
   * @param {(blocked: 1 | -1 | null) => void} [done]
   */
  play(gen, done) {
    this.seq = gen;
    this.onDone = done ?? null;
    this.next();
  }

  /**
   * @param {Prim[]} prims
   * @param {(blocked: 1 | -1 | null) => void} [done]
   */
  playPrims(prims, done) {
    this.play((function* () {
      yield* prims;
    })(), done);
  }

  /** Stop at once, wherever the machine is (the caller resets or replays it). */
  stop() {
    this.seq = null;
    this.cur = null;
    this.onDone = null;
  }

  /**
   * @private
   * @param {1 | -1 | null} blocked
   */
  finish(blocked) {
    const cb = this.onDone;
    this.stop();
    cb?.(blocked);
    this.changed();
  }

  /** @private */
  next() {
    if (!this.seq) return;
    const r = this.seq.next();
    if (r.done) this.finish(null);
    else {
      this.cur = r.value;
      this.changed();
    }
  }

  /**
   * Advance by dt seconds (the viewer's frame callback).
   * @param {number} dt
   */
  tick(dt) {
    const cur = this.cur;
    if (!cur || this.paused()) return;
    const m = this.machine;
    let done = false;
    if ("shift" in cur) {
      const d = cur.shift - m.carriagePos;
      const s = PLACES_PER_SEC * dt;
      const next = Math.abs(d) <= s ? cur.shift : m.carriagePos + Math.sign(d) * s;
      if (!m.setCarriagePos(next)) done = true;
      done ||= next === cur.shift;
    } else {
      const target = cur.theta;
      /** @type {1 | -1} */
      const dir = target > m.theta ? 1 : -1;
      if (m.theta === 0 && !m.canStart(dir)) return this.finish(dir); // a blocked crank does not move
      const s = DEG_PER_SEC * dt;
      const next = Math.abs(target - m.theta) <= s ? target : m.theta + dir * s;
      done = m.setTheta(next) || next === target;
    }
    if (done) {
      this.cur = null;
      this.next();
    } else this.changed();
  }

  /**
   * A lesson step's actions as primitives (settings apply at once, motions animate).
   * @param {Action[]} actions
   * @returns {Generator<Prim, void, void>}
   */
  *expand(actions) {
    const m = this.machine;
    for (const a of actions) {
      if ("theta" in a) yield { theta: a.theta };
      else if ("turn" in a) for (let k = 0; k < (a.times ?? 1); k++) yield { theta: a.turn * 360 };
      else if ("shift" in a) yield { shift: a.shift };
      else if ("toStop" in a) while (!m.blocked && m.canStart(1)) yield { theta: 360 };
      else if ("divideDigit" in a) {
        for (;;) {
          yield { theta: -360 };
          if (registerValue(m) < 0) {
            yield { theta: 360 };
            break;
          }
        }
      } else applyAction(m, a);
    }
  }
}
