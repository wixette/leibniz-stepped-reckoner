// Operating the machine by clicking (or tapping) its parts in 3D (M3). A click resolves to
// the same operation as a panel control, so the page applies the same locks and lesson
// rules to both. Pure logic over three.js objects: the page and the tests (A3-11) share it.

import * as THREE from "three";
import { anchors } from "../accept/harness";
import { gltfName } from "../scene/rig";
import type { Machine } from "../sim/machine";
import type { Lang } from "./i18n";
import type { Task } from "./player";

export type Control = Task["controls"][number];

export type Intent =
  | { kind: "setDigit"; knob: number; digit: number } // a digit on a setting dial
  | { kind: "nextDigit"; knob: number } // the knob itself: next digit
  | { kind: "turn" } // the main crank: one turn forward
  | { kind: "pin"; hole: number | null } // a hole of the Magna Rota (0 = pin out), or the pin
  | { kind: "shiftTo"; offset: number } // a result wheel: carriage units under it
  | { kind: "shiftLeft" }; // the end crank

/** The panel control an intent stands for (lesson tasks allow controls by name). */
export function controlOf(i: Intent): Control {
  if (i.kind === "setDigit" || i.kind === "nextDigit") return "input";
  if (i.kind === "turn") return "add";
  if (i.kind === "pin") return "pin";
  return "shift";
}

const indexOf = (node: THREE.Object3D, base: string) => {
  const r = new RegExp(`^${gltfName(base)}(\\d+)$`).exec(node.name);
  return r ? Number(r[1]) : null;
};

const nearest = (points: THREE.Vector3[], p: THREE.Vector3) => {
  let best = 0;
  points.forEach((q, i) => (q.distanceToSquared(p) < points[best].distanceToSquared(p) ? (best = i) : 0));
  return best;
};

/** What clicking this part at this world point does (null: not clickable). */
export function intentAt(hit: THREE.Object3D, point: THREE.Vector3, m: Machine): Intent | null {
  for (let n: THREE.Object3D | null = hit; n; n = n.parent) {
    let k: number | null;
    if ((k = indexOf(n, "pm.setting_plate.")) !== null) return { kind: "setDigit", knob: k, digit: nearest(anchors(n, "glyph_anchors"), point) };
    if ((k = indexOf(n, "pm.setting_dial.")) !== null) return { kind: "nextDigit", knob: k };
    if ((k = indexOf(n, "pi.sum_wheel.")) !== null) return { kind: "shiftTo", offset: Math.min(k, m.maxOffset) };
    if (n.name === gltfName("pi.window")) {
      const reads = anchors(n, "read_points");
      return { kind: "shiftTo", offset: Math.min(nearest(reads, point), m.maxOffset) };
    }
    if (n.name === gltfName("pm.main_crank")) return { kind: "turn" };
    if (n.name === gltfName("pm.magna_pin")) return { kind: "pin", hole: null };
    if (n.name === gltfName("pm.magna_rota")) {
      // Holes, black digits and red digits sit on the same spokes: the nearest black digit
      // around the ring's centre gives the hole.
      const centre = new THREE.Vector3().setFromMatrixPosition(n.matrixWorld);
      const ang = (v: THREE.Vector3) => Math.atan2(v.y - centre.y, v.x - centre.x);
      const a = ang(point);
      const glyphs = anchors(n, "black_glyphs");
      let best = 0;
      glyphs.forEach((g, i) => {
        const d = (q: THREE.Vector3) => Math.abs(Math.atan2(Math.sin(ang(q) - a), Math.cos(ang(q) - a)));
        if (d(g) < d(glyphs[best])) best = i;
      });
      return { kind: "pin", hole: best === 0 ? null : best };
    }
    if (n.name === gltfName("frame.lead_screw")) return { kind: "shiftLeft" };
  }
  return null;
}

/** Whether the machine can do it now (at rest, in range, not blocked). */
export function possible(i: Intent, m: Machine): boolean {
  if (i.kind === "turn") return m.theta !== 0 || m.canStart(1);
  if (!m.atRest) return false;
  if (i.kind === "shiftLeft") return m.offset < m.maxOffset;
  if (i.kind === "shiftTo") return i.offset !== m.offset;
  return true;
}

/** One line telling the learner what a click does, for the hover label. */
export function intentHint(i: Intent, lang: Lang): string {
  const de = lang === "de";
  switch (i.kind) {
    case "setDigit":
      return de ? `Klick: ${i.digit} einstellen` : `Click: set ${i.digit}`;
    case "nextDigit":
      return de ? "Klick: nächste Ziffer" : "Click: next digit";
    case "turn":
      return de ? "Klick: einmal vorwärts drehen" : "Click: turn forward once";
    case "pin":
      return i.hole === null ? (de ? "Klick: Stift herausnehmen" : "Click: take the pin out") : de ? `Klick: Stift in Loch ${i.hole}` : `Click: pin in hole ${i.hole}`;
    case "shiftTo":
      return de ? "Klick: Schlitten hierher schieben" : "Click: move the carriage here";
    case "shiftLeft":
      return de ? "Klick: Schlitten eine Stelle nach links" : "Click: carriage one place left";
  }
}

/** Apply an intent at once (tests; the page animates turns and shifts instead). */
export function applyIntentNow(i: Intent, m: Machine): boolean {
  switch (i.kind) {
    case "setDigit":
      return m.setSetting(i.knob, i.digit);
    case "nextDigit":
      return m.setSetting(i.knob, (m.settings[i.knob] + 1) % 10);
    case "pin":
      return m.setPin(i.hole);
    case "turn":
      return m.turn(1);
    case "shiftTo":
      return m.setOffset(i.offset);
    case "shiftLeft":
      return m.setOffset(m.offset + 1);
  }
}
