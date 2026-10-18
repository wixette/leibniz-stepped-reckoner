// Applies a DigitSlice pose to the M0 rig. Shared by the page and the acceptance
// tests, so the tests pose the model exactly as the browser does.

/** @import { Pose } from "../sim/digitSlice.js" */
/** @import { M0_NODES, Rig } from "./rig.js" */

/**
 * @param {Rig<keyof typeof M0_NODES>} rig
 * @param {Pose} p
 * @returns {void}
 */
export function applyM0Pose(rig, p) {
  rig.set("drumShaft", p.drumShaft);
  rig.set("drum", p.drumY);
  rig.set("rack", p.drumY);
  rig.set("dial", p.dial);
  rig.set("wheel", p.wheel);
  rig.set("store", p.store);
}
