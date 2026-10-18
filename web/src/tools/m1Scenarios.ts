// Scripted M1 scenarios, shared by the pose exporter (Blender sweep) and acceptance tests.

import { CarrySlice, type CarryMode } from "../sim/carrySlice";

export type Scenario = {
  label: string;
  mode: CarryMode;
  result: number; // number in the register before the first turn
  turns: { input: number; dir: 1 | -1 }[];
};

export const M1_SCENARIOS: Scenario[] = [
  { label: "ripple 999+1", mode: "ripple", result: 999, turns: [{ input: 1, dir: 1 }] },
  { label: "ripple 000-1", mode: "ripple", result: 0, turns: [{ input: 1, dir: -1 }] },
  { label: "ripple 456+278", mode: "ripple", result: 456, turns: [{ input: 278, dir: 1 }] },
  { label: "ripple 999+999", mode: "ripple", result: 999, turns: [{ input: 999, dir: 1 }] },
  { label: "ripple 000-999", mode: "ripple", result: 0, turns: [{ input: 999, dir: -1 }] },
  { label: "historical 999+1 (+idle)", mode: "historical", result: 999, turns: [{ input: 1, dir: 1 }, { input: 0, dir: 1 }] },
  { label: "historical 000-1 (+idle)", mode: "historical", result: 0, turns: [{ input: 1, dir: -1 }, { input: 0, dir: -1 }] },
  { label: "historical 909+91 (+idle)", mode: "historical", result: 909, turns: [{ input: 91, dir: 1 }, { input: 0, dir: 1 }] },
];

/** Walk a scenario, calling visit at every sampled crank angle (and at rest before each turn). */
export function walk(sc: Scenario, stepDeg: number, visit: (m: CarrySlice, label: string) => void): CarrySlice {
  const m = new CarrySlice();
  m.setMode(sc.mode);
  m.setResult(sc.result);
  sc.turns.forEach((t, k) => {
    m.setNumber(t.input);
    for (let a = 0; a < 360; a += stepDeg) {
      m.setTheta(t.dir * a);
      visit(m, `${sc.label} turn ${k + 1} θ=${(t.dir * a).toFixed(2)}`);
    }
    m.setTheta(t.dir * 360);
  });
  return m;
}
