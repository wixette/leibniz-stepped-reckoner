// M1 simulation: an n-digit slice in which every register digit has its own drum and
// lever (register = carriage = n digits, carriage fixed at offset 0). All carry logic
// lives in Machine; this class only keeps the M1 per-digit pose shape.

import * as M from "./kinematicsM1";
import { Machine } from "./machine";

export type { CarryMode } from "./machine";

export type DigitPose = {
  drumShaft: number; // deg (+theta)
  drumY: number; // mm
  dial: number; // deg about the vertical axis
  wheel: number; // deg
  store: number; // deg
  lever: number; // deg (-theta)
  hornAdd: number; // deg
  hornSub: number; // deg
  v: number; // continuous wheel value
};

export class CarrySlice extends Machine {
  readonly n: number;

  constructor(n = M.DIGITS) {
    super(n, n);
    this.n = n;
  }

  /** Pose of every digit at the current crank angle. */
  pose(): DigitPose[] {
    const p = this.machinePose();
    return p.register.map((r, i) => ({ ...p.carriage[i], ...r }));
  }
}
