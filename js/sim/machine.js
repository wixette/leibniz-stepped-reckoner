// The Leibniz machine: a register of R result digits (pars immobilis) and a carriage of
// C setting digits (pars mobilis) at offset o (carriage digit j works on register digit
// o + j). One turn of the crank (theta 0..360 adding, 0..-360 subtracting) is evaluated
// register digit by digit from the units upward, because a digit only depends on the
// digit below it (through the carry it receives):
//   wheel value  v_k(theta) = d_k + ribs (only under the carriage) + carries received
//   carry store  the Einzahn stores a carry when v_k passes 9 -> 0 (or 0 -> 9 borrowing);
//                a Zweihorn horn executes it when it passes the store - but only stores
//                under the carriage have a lever. A carry stored above the top lever stays
//                stored (pentagon tilted) until the carriage is shifted over it.
// Ripple mode staggers the levers units-first, so a secondary carry is stored before the
// next lever arrives. Historical mode staggers them highest-first (decision 0001).
// Magna Rota: geared 10:1 to the crank; its ring with 10 holes doubles as the
// revolution counter (black numbers count additions, red ones subtractions). A pin in
// hole m stops the crank after m forward turns (Leupold) - multiplication. Turned back, the
// pin goes round the other way and meets the stop finger's far face: the finger's width
// (about 0.22 of a crank turn) leaves 9 - m whole backward turns, and the next would jam
// part-way, so it is refused. (The sources describe no one-way catch; the model measures
// where the pin meets the finger.) Division uses the ring as a counter with the pin out.
// A carry store holds one carry. A turn that would store a second carry in a store whose
// first carry is still waiting (above the carriage, no lever over it) is refused: the
// operator must shift the carriage over that digit first.

import * as K from "./kinematics.js";
import * as M from "./kinematicsM1.js";

/** @typedef {M.CarryMode} CarryMode */

/**
 * Why the crank may not start a turn: the carriage is moving, the Magna Rota pin, or a
 *  carry store that would have to hold a second carry (register digit k).
 * @typedef {"shifting" | "pin" | { storeFull: number }} StartBlock
 */

/**
 * @typedef {object} Exec
 * @property {number} start |theta| of first contact
 * @property {1 | -1} sign
 */
/**
 * @typedef {object} DigitTrace
 * @property {(t: number) => number} v
 * @property {(t: number) => number} store
 * @property {Exec[]} executions
 */

/**
 * @typedef {object} RegisterPose
 * @property {number} wheel
 * @property {number} store
 * @property {number} v
 */
/**
 * @typedef {object} CarriagePose
 * @property {number} drumShaft
 * @property {number} drumY
 * @property {number} dial
 * @property {number} lever
 * @property {number} hornAdd
 * @property {number} hornSub
 */
/**
 * @typedef {object} MachinePose
 * @property {RegisterPose[]} register
 * @property {CarriagePose[]} carriage
 * @property {number} carriageX mm along +X (negative = shifted left)
 * @property {number} endCrank deg
 * @property {number} mainCrank deg (the operator's crank, = theta)
 * @property {number} magnaRota deg (ring)
 */

export const DIGIT_PITCH = 37; // mm (params: layout.digit_pitch)

export class Machine {
  /**
   * @readonly
   * @type {number}
   */
  registerDigits;
  /**
   * @readonly
   * @type {number}
   */
  carriageDigits;
  /** @type {CarryMode} */
  mode = "ripple";
  /**
   * Setting dials on the carriage (index 0 = units of the carriage).
   * @type {number[]}
   */
  settings;
  /**
   * Result wheels at the start of the current turn (index 0 = units).
   * @type {number[]}
   */
  digits;
  /**
   * Carry stored but not executed at the start of the turn (+1 carry, -1 borrow, 0).
   * @type {number[]}
   */
  pending;
  /** Carries/borrows that left the top register digit (overflow). */
  carryOut = 0;
  /** Completed turns (+ adding, - subtracting). */
  turns = 0;
  /** Carriage offset (register digit under carriage digit 0). */
  offset = 0;
  /** Carriage position used for drawing; equals offset at rest, fractional while shifting. */
  carriagePos = 0;
  /**
   * Magna Rota: pin hole (0..9) or null, and turns counted since the ring was last set.
   * @type {number | null}
   */
  pin = null;
  ringTurns = 0;
  /** @protected */
  _theta = 0;

  constructor(registerDigits = 16, carriageDigits = 8) {
    this.registerDigits = registerDigits;
    this.carriageDigits = carriageDigits;
    this.settings = Array(carriageDigits).fill(0);
    this.digits = Array(registerDigits).fill(0);
    this.pending = Array(registerDigits).fill(0);
  }

  get theta() {
    return this._theta;
  }
  get atRest() {
    return this._theta === 0 && this.carriagePos === this.offset;
  }
  get maxOffset() {
    return this.registerDigits - this.carriageDigits;
  }

  /** @returns {void} */
  reset() {
    this._theta = 0;
    this.settings.fill(0);
    this.digits.fill(0);
    this.pending.fill(0);
    this.carryOut = 0;
    this.turns = 0;
    this.offset = 0;
    this.carriagePos = 0;
    this.pin = null;
    this.ringTurns = 0;
  }

  /**
   * @param {number} i
   * @param {number} s
   * @returns {boolean}
   */
  setSetting(i, s) {
    if (!this.atRest || !Number.isInteger(s) || s < 0 || s > 9) return false;
    this.settings[i] = s;
    return true;
  }

  /**
   * Set the number on the setting dials (units digit = least significant).
   * @param {number} x
   * @returns {boolean}
   */
  setNumber(x) {
    if (!this.atRest) return false;
    for (let i = 0; i < this.carriageDigits; i++) this.settings[i] = Math.floor(x / 10 ** i) % 10;
    return true;
  }

  /**
   * Put a number into the result register (as if left by earlier work).
   * @param {number} x
   * @returns {void}
   */
  setResult(x) {
    for (let i = 0; i < this.registerDigits; i++) this.digits[i] = Math.floor(x / 10 ** i) % 10;
  }

  /**
   * @param {CarryMode} mode
   * @returns {boolean}
   */
  setMode(mode) {
    if (!this.atRest) return false;
    this.mode = mode;
    return true;
  }

  /**
   * Shift the carriage (lead screw, one turn of the end crank per place). Only at rest.
   * @param {number} o
   * @returns {boolean}
   */
  setOffset(o) {
    if (this._theta !== 0 || !Number.isInteger(o) || o < 0 || o > this.maxOffset) return false;
    this.offset = o;
    this.carriagePos = o;
    return true;
  }

  /**
   * Move the carriage part-way (end crank animation). Reaching a whole place sets the offset.
   * @param {number} x
   * @returns {boolean}
   */
  setCarriagePos(x) {
    if (this._theta !== 0 || x < 0 || x > this.maxOffset) return false;
    this.carriagePos = x;
    if (Number.isInteger(x)) this.offset = x;
    return true;
  }

  /**
   * Insert the pin in hole m (or remove it with null); the ring is set back to 0 at the stop.
   * @param {number | null} m
   * @returns {boolean}
   */
  setPin(m) {
    if (!this.atRest || (m !== null && (!Number.isInteger(m) || m < 0 || m > 9))) return false;
    this.pin = m;
    this.ringTurns = 0;
    return true;
  }

  /**
   * Set the ring back to 0 at the stop (keeps the pin).
   * @returns {boolean}
   */
  resetRing() {
    if (!this.atRest) return false;
    this.ringTurns = 0;
    return true;
  }

  /**
   * True when the pin has reached the stop: the crank cannot start another forward turn.
   * @returns {boolean}
   */
  get blocked() {
    return this.pin !== null && this.ringTurns >= this.pin;
  }

  /**
   * True when, turned back, the pin is within a turn of the stop finger's far face: another
   * whole backward turn would jam part-way (after 9 - m backward turns from the pin's hole m).
   * @returns {boolean}
   */
  get blockedBack() {
    return this.pin !== null && this.ringTurns <= this.pin - 9;
  }

  /**
   * Why the crank may not start a turn in this direction now (null: it may).
   * @param {1 | -1} dir
   * @returns {StartBlock | null}
   */
  startBlock(dir) {
    if (this.carriagePos !== this.offset) return "shifting";
    if (dir > 0 ? this.blocked : this.blockedBack) return "pin";
    const k = this.overfullStore(dir);
    return k >= 0 ? { storeFull: k } : null;
  }

  /**
   * Whether the crank may start a turn in this direction now.
   * @param {1 | -1} dir
   * @returns {boolean}
   */
  canStart(dir) {
    return this.startBlock(dir) === null;
  }

  /**
   * First register digit whose store this turn would push past one stored carry (its
   * waiting carry not executed, and the Einzahn storing another), or -1. The mechanism
   * cannot hold two: at 36 deg the Muldenrad would start turning the next star.
   * @protected
   * @param {1 | -1} dir
   * @returns {number}
   */
  overfullStore(dir) {
    if (this.pending.every((p) => p === 0)) return -1; // a store starting at rest takes at most one carry per turn
    const tr = this.traces(dir);
    for (let k = 0; k < this.registerDigits; k++) {
      if (Math.round(Math.abs(tr[k].store(360)) / K.STORE_STEP) % 4 >= 2) return k;
    }
    return -1;
  }

  /**
   * Move the crank; returns true when this completed a turn.
   * @param {number} theta
   * @returns {boolean}
   */
  setTheta(theta) {
    let t = Math.max(-360, Math.min(360, theta));
    if (this._theta === 0 && t !== 0 && !this.canStart(t > 0 ? 1 : -1)) return false;
    if (this._theta > 0 && t < 0) t = 0;
    if (this._theta < 0 && t > 0) t = 0;
    if (Math.abs(t) >= 360) {
      this.complete(t > 0 ? 1 : -1);
      return true;
    }
    this._theta = t;
    return false;
  }

  /**
   * Whole-turn helper for tests and scripted lessons; false if the crank is blocked.
   * @param {1 | -1} dir
   * @returns {boolean}
   */
  turn(dir) {
    return this.setTheta(dir * 360);
  }

  /**
   * Turn forward until the pin reaches the stop (multiplication by the pin digit).
   * @returns {number}
   */
  runToStop() {
    let n = 0;
    while (this.pin !== null && !this.blocked && this.turn(1)) n++;
    return n;
  }

  // ---------------------------------------------------------------------------------------
  /**
   * Carriage digit working on register digit k, or -1 if k is outside the carriage.
   * @protected
   * @param {number} k
   * @returns {number}
   */
  carriageIndex(k) {
    const j = k - this.offset;
    return j >= 0 && j < this.carriageDigits ? j : -1;
  }

  /**
   * @protected
   * @param {1 | -1} dir
   * @returns {DigitTrace[]}
   */
  traces(dir) {
    /** @type {DigitTrace[]} */
    const out = [];
    /** @type {DigitTrace | null} */
    let below = null;
    for (let k = 0; k < this.registerDigits; k++) {
      const j = this.carriageIndex(k);
      const d = this.digits[k];
      const s = j >= 0 ? this.settings[j] : 0;
      const p = this.pending[k];
      const from = below;
      /** @param {number} t */
      const received = (t) => {
        if (!from) return 0;
        let sum = 0;
        for (const e of from.executions) {
          if (t >= e.start) sum += e.sign * M.transferProgress(M.executionCurve(t - e.start));
        }
        return sum;
      };
      /** @param {number} t */
      const v = (t) => d + dir * K.ribProgress(s, dir * t) + received(t);
      // Store angle = pending carry (18 each) + Einzahn push this turn + executions so far.
      /** @type {Exec[]} */
      const executions = [];
      /** @param {number} t */
      const store = (t) => {
        let a = K.storeAngle(p, v(t));
        for (const e of executions) {
          if (t >= e.start) a += e.sign * (M.executionCurve(t - e.start) - K.STORE_STEP);
        }
        return a;
      };
      // Only a store under the carriage has a Zweihorn passing it.
      if (j >= 0) {
        for (const start of M.leverPasses(j, this.mode, dir, this.carriageDigits)) {
          const r = dir * store(start);
          const inPitch = ((r % K.STORE_PITCH) + K.STORE_PITCH) % K.STORE_PITCH;
          if (Math.abs(inPitch - K.STORE_STEP) < 1e-6) executions.push({ start, sign: dir });
        }
      }
      /** @type {DigitTrace} */
      const tr = { v, store, executions };
      out.push(tr);
      below = tr;
    }
    return out;
  }

  /**
   * @protected
   * @param {1 | -1} dir
   * @returns {void}
   */
  complete(dir) {
    const tr = this.traces(dir);
    for (let k = 0; k < this.registerDigits; k++) {
      const r = Math.round(tr[k].v(360));
      this.digits[k] = ((r % 10) + 10) % 10;
      const st = tr[k].store(360);
      const rem = Math.round(st / K.STORE_STEP) % 4; // 72 deg = rest, 18 deg = still stored
      this.pending[k] = rem === 0 ? 0 : Math.sign(st);
    }
    this.carryOut += tr[this.registerDigits - 1].executions.reduce((a, e) => a + e.sign, 0);
    this.turns += dir;
    this.ringTurns += dir;
    this._theta = 0;
  }

  /** @returns {MachinePose} */
  machinePose() {
    const th = this._theta;
    /** @type {1 | -1} */
    const dir = th < 0 ? -1 : 1;
    const t = Math.abs(th);
    const tr = this.traces(dir);
    return {
      register: tr.map((x) => {
        const v = x.v(t);
        return { wheel: K.sumWheelAngle(v), store: x.store(t), v };
      }),
      carriage: this.settings.map((s, j) => {
        const ph = M.hornPhases(j, this.mode, this.carriageDigits);
        return {
          drumShaft: th,
          drumY: K.drumFrontY(s),
          dial: K.dialAngle(s),
          lever: -th,
          hornAdd: -(ph.add + th),
          hornSub: -(ph.sub + th),
        };
      }),
      carriageX: -DIGIT_PITCH * this.carriagePos,
      endCrank: 360 * this.carriagePos,
      mainCrank: th,
      magnaRota: 36 * (this.ringTurns + th / 360),
    };
  }

  /**
   * Digits visible in the windows now (index 0 = units).
   * @returns {number[]}
   */
  shownDigits() {
    return this.machinePose().register.map((p) => ((Math.round(p.v) % 10) + 10) % 10);
  }

  /** @returns {number} */
  shownNumber() {
    return this.shownDigits().reduce((a, d, i) => a + d * 10 ** i, 0);
  }

  /**
   * Digit the Magna Rota ring shows at the stop (the revolution counter).
   * @returns {number}
   */
  counterDigit() {
    return ((Math.round(this.ringTurns + this._theta / 360) % 10) + 10) % 10;
  }

  /**
   * What each carry store is doing now.
   * @returns {("idle" | "stored" | "executing")[]}
   */
  carryStates() {
    return this.machinePose().register.map((p) => {
      const r = ((Math.abs(p.store) % K.STORE_PITCH) + K.STORE_PITCH) % K.STORE_PITCH;
      if (r < 0.5 || r > K.STORE_PITCH - 0.5) return "idle";
      if (Math.abs(r - K.STORE_STEP) < 0.01) return "stored";
      return r < K.STORE_STEP ? "stored" : "executing";
    });
  }

  /** @returns {boolean[]} */
  storesTilted() {
    return this.carryStates().map((s) => s !== "idle");
  }

  /**
   * Carries that have left the top digit so far, including those completed in this turn.
   * @returns {number}
   */
  carryOutLive() {
    const th = this._theta;
    if (th === 0) return this.carryOut;
    /** @type {1 | -1} */
    const dir = th < 0 ? -1 : 1;
    const top = this.traces(dir)[this.registerDigits - 1];
    const done = top.executions.filter((e) => Math.abs(th) >= e.start + M.TRANSFER_TRAVEL - 1e-9);
    return this.carryOut + done.reduce((a, e) => a + e.sign, 0);
  }

  /**
   * Step stops (docs/conventions.md): only where a visible change has just completed.
   * @param {1 | -1} dir
   * @returns {number[]}
   */
  stepStops(dir) {
    /** @type {number[]} */
    const ev = [];
    for (const s of this.settings) {
      for (let k = 10 - s; k <= 9; k++) ev.push(K.ribWindowStart(K.ribWindowIndex(k, dir)) + K.RIB_PITCH);
    }
    for (const x of this.traces(dir)) {
      for (const e of x.executions) ev.push(e.start + M.TRANSFER_TRAVEL, e.start + M.EXECUTION_TRAVEL);
    }
    ev.push(360);
    const sorted = ev.map((a) => Math.min(360, a)).filter((a) => a > 0).sort((a, b) => a - b);
    /** @type {number[]} */
    const merged = [];
    for (const a of sorted) {
      if (merged.length && a - merged[merged.length - 1] < 0.5) merged[merged.length - 1] = a;
      else merged.push(a);
    }
    return merged;
  }
}
