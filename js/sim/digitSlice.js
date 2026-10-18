// M0 simulation: one digit of the Leibniz machine (setting dial + stepped drum +
// result wheel + carry store). Pure logic, no three.js.
//
// The crank angle theta runs 0..360 (adding) or 0..-360 (subtracting). Reaching
// either end completes the operation and resets theta to 0. A carry stored by the
// Einzahn during the rib window is executed in the carry window of the same turn
// (decision 0001: ripple; for the units digit this is the same in historical mode),
// and leaves the slice as "carry out" to the next (not modelled) digit.

import * as K from "./kinematics.js";

/**
 * @typedef {object} Pose
 * @property {number} drumShaft deg about the shaft axis
 * @property {number} drumY mm along the shaft (drum and rack)
 * @property {number} dial deg about the vertical axis
 * @property {number} wheel deg about the result shaft
 * @property {number} store deg about the store shaft
 * @property {number} v continuous wheel value in this turn
 */

/** @typedef {"none" | "storing" | "stored" | "executing" | "executed"} CarryPhase */

export class DigitSlice {
  setting = 0;
  /** Digit shown in the window at the start of the current turn (0..9). */
  digit = 0;
  /** Carries passed to the next higher digit (+1 per carry, -1 per borrow). */
  carryOut = 0;
  /** Completed operations (the revolution counter). */
  turns = 0;
  /** @private */
  _theta = 0;

  /** @returns {number} */
  get theta() {
    return this._theta;
  }

  /** @returns {boolean} */
  get atRest() {
    return this._theta === 0;
  }

  /**
   * Setting can only change at rest, as on the real machine.
   * @param {number} s
   * @returns {boolean}
   */
  setSetting(s) {
    if (!this.atRest || !Number.isInteger(s) || s < 0 || s > 9) return false;
    this.setting = s;
    return true;
  }

  /**
   * Back to the initial state: crank at rest, setting 0, result 0, no carry out,
   * counter 0. Allowed at any time (the operator clears the machine by hand).
   * @returns {void}
   */
  reset() {
    this._theta = 0;
    this.setting = 0;
    this.digit = 0;
    this.carryOut = 0;
    this.turns = 0;
  }

  /**
   * Move the crank to theta (deg). The direction is fixed once a turn has started:
   * a turn begun forward can go back to 0 but not below it. Returns true when the
   * move completed an operation.
   * @param {number} theta
   * @returns {boolean}
   */
  setTheta(theta) {
    let t = Math.max(-360, Math.min(360, theta));
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
   * @private
   * @param {1 | -1} dir
   * @returns {void}
   */
  complete(dir) {
    const raw = this.digit + dir * this.setting;
    if (raw >= 10) this.carryOut += 1;
    if (raw < 0) this.carryOut -= 1;
    this.digit = ((raw % 10) + 10) % 10;
    this.turns += dir;
    this._theta = 0;
  }

  /**
   * Does the current turn produce a carry (adding) or a borrow (subtracting)?
   * @returns {boolean}
   */
  get turnCarries() {
    if (this._theta > 0) return this.digit + this.setting >= 10;
    if (this._theta < 0) return this.digit - this.setting < 0;
    return false;
  }

  /** @returns {Pose} */
  pose() {
    const s = this.setting;
    const th = this._theta;
    const v = K.wheelValue(this.digit, s, th);
    return {
      drumShaft: th,
      drumY: K.drumFrontY(s),
      dial: K.dialAngle(s),
      wheel: K.sumWheelAngle(v),
      store: K.storeAngleFull(0, v, th, true),
      v,
    };
  }

  /**
   * Digit visible in the window right now (nearest step while the wheel moves).
   * @returns {number}
   */
  get shownDigit() {
    const v = this.pose().v;
    return ((Math.round(v) % 10) + 10) % 10;
  }

  /**
   * Carries passed on so far, including one completed earlier in this turn.
   * @returns {number}
   */
  get carryOutLive() {
    if (this.carryPhase !== "executed") return this.carryOut;
    return this.carryOut + (this._theta > 0 ? 1 : -1);
  }

  /** @returns {CarryPhase} */
  get carryPhase() {
    if (!this.turnCarries) return "none";
    const c = K.completion(this._theta);
    if (c >= 1) return "executed";
    if (c > 0) return "executing";
    const v = this.pose().v;
    const pushed = v > 9 ? K.push(Math.min(v, 10)) : v < 0 ? K.push(Math.min(9 - v, 10)) : 0;
    if (pushed >= K.STORE_STEP) return "stored";
    return pushed > 0 ? "storing" : "none";
  }

  /**
   * Crank angles (|theta|, ascending) where something starts or stops moving in the
   * current turn. Used by the "step to next event" control.
   * @param {1 | -1} dir
   * @returns {number[]}
   */
  stepStops(dir) {
    // Step semantics (docs/conventions.md): a step ends where a visible change has
    // just COMPLETED, never at the start of a motion:
    //   - end of each rib window in which the rib reaches the gear (wheel +-1),
    //   - end of the carry execution (store level again, carry passed on),
    //   - 360 (operation committed).
    const s = this.setting;
    /** @type {Set<number>} */
    const ev = new Set();
    for (let k = 10 - s; k <= 9; k++) ev.add(K.ribWindowStart(K.ribWindowIndex(k, dir)) + K.RIB_PITCH);
    const carries = dir > 0 ? this.digit + s >= 10 : this.digit - s < 0;
    if (carries) ev.add(K.CARRY_WINDOW_START + K.PER_CARRY);
    ev.add(360);
    return [...ev].sort((a, b) => a - b);
  }
}
