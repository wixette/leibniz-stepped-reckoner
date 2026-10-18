// M0 simulation: one digit of the Leibniz machine (setting dial + stepped drum +
// result wheel + carry store). Pure logic, no three.js.
//
// The crank angle theta runs 0..360 (adding) or 0..-360 (subtracting). Reaching
// either end completes the operation and resets theta to 0. A carry stored by the
// Einzahn during the rib window is executed in the carry window of the same turn
// (decision 0001: ripple; for the units digit this is the same in historical mode),
// and leaves the slice as "carry out" to the next (not modelled) digit.

import * as K from "./kinematics";

export type Pose = {
  drumShaft: number; // deg about the shaft axis
  drumY: number; // mm along the shaft (drum and rack)
  dial: number; // deg about the vertical axis
  wheel: number; // deg about the result shaft
  store: number; // deg about the store shaft
  v: number; // continuous wheel value in this turn
};

export type CarryPhase = "none" | "storing" | "stored" | "executing" | "executed";

export class DigitSlice {
  setting = 0;
  /** Digit shown in the window at the start of the current turn (0..9). */
  digit = 0;
  /** Carries passed to the next higher digit (+1 per carry, -1 per borrow). */
  carryOut = 0;
  /** Completed operations (the revolution counter). */
  turns = 0;
  private _theta = 0;

  get theta(): number {
    return this._theta;
  }

  get atRest(): boolean {
    return this._theta === 0;
  }

  /** Setting can only change at rest, as on the real machine. */
  setSetting(s: number): boolean {
    if (!this.atRest || !Number.isInteger(s) || s < 0 || s > 9) return false;
    this.setting = s;
    return true;
  }

  /**
   * Back to the initial state: crank at rest, setting 0, result 0, no carry out,
   * counter 0. Allowed at any time (the operator clears the machine by hand).
   */
  reset(): void {
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
   */
  setTheta(theta: number): boolean {
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

  private complete(dir: 1 | -1): void {
    const raw = this.digit + dir * this.setting;
    if (raw >= 10) this.carryOut += 1;
    if (raw < 0) this.carryOut -= 1;
    this.digit = ((raw % 10) + 10) % 10;
    this.turns += dir;
    this._theta = 0;
  }

  /** Does the current turn produce a carry (adding) or a borrow (subtracting)? */
  get turnCarries(): boolean {
    if (this._theta > 0) return this.digit + this.setting >= 10;
    if (this._theta < 0) return this.digit - this.setting < 0;
    return false;
  }

  pose(): Pose {
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

  /** Digit visible in the window right now (nearest step while the wheel moves). */
  get shownDigit(): number {
    const v = this.pose().v;
    return ((Math.round(v) % 10) + 10) % 10;
  }

  /** Carries passed on so far, including one completed earlier in this turn. */
  get carryOutLive(): number {
    if (this.carryPhase !== "executed") return this.carryOut;
    return this.carryOut + (this._theta > 0 ? 1 : -1);
  }

  get carryPhase(): CarryPhase {
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
   */
  stepStops(dir: 1 | -1): number[] {
    // Step semantics (docs/conventions.md): a step ends where a visible change has
    // just COMPLETED, never at the start of a motion:
    //   - end of each rib window in which the rib reaches the gear (wheel +-1),
    //   - end of the carry execution (store level again, carry passed on),
    //   - 360 (operation committed).
    const s = this.setting;
    const ev = new Set<number>();
    for (let k = 10 - s; k <= 9; k++) ev.add(K.ribWindowStart(K.ribWindowIndex(k, dir)) + K.RIB_PITCH);
    const carries = dir > 0 ? this.digit + s >= 10 : this.digit - s < 0;
    if (carries) ev.add(K.CARRY_WINDOW_START + K.PER_CARRY);
    ev.add(360);
    return [...ev].sort((a, b) => a - b);
  }
}
