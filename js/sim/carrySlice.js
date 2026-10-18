// M1 simulation: an n-digit slice in which every register digit has its own drum and
// lever (register = carriage = n digits, carriage fixed at offset 0). All carry logic
// lives in Machine; this class only keeps the M1 per-digit pose shape.

import * as M from "./kinematicsM1.js";
import { Machine } from "./machine.js";

/** @typedef {import("./machine.js").CarryMode} CarryMode */

/**
 * @typedef {object} DigitPose
 * @property {number} drumShaft deg (+theta)
 * @property {number} drumY mm
 * @property {number} dial deg about the vertical axis
 * @property {number} wheel deg
 * @property {number} store deg
 * @property {number} lever deg (-theta)
 * @property {number} hornAdd deg
 * @property {number} hornSub deg
 * @property {number} v continuous wheel value
 */

export class CarrySlice extends Machine {
  /**
   * @readonly
   * @type {number}
   */
  n;

  constructor(n = M.DIGITS) {
    super(n, n);
    this.n = n;
  }

  /**
   * Pose of every digit at the current crank angle.
   * @returns {DigitPose[]}
   */
  pose() {
    const p = this.machinePose();
    return p.register.map((r, i) => ({ ...p.carriage[i], ...r }));
  }
}
