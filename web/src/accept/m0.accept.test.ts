// M0 acceptance spec (plan §10.1): runs on assets/m0-digit-slice.glb in Node.

import { beforeAll, describe, expect, it } from "vitest";
import type { CheckResult } from "./harness";
import { loadAsset } from "./loadGlb.node";
import { runM0Checks } from "./m0Checks";

let results: CheckResult[] = [];

beforeAll(async () => {
  results = runM0Checks(await loadAsset("m0-digit-slice.glb"));
}, 60_000); // budget: docs/conventions.md asks for ~30 s per machine

const IDS = ["A0-1", "A0-2", "A0-3", "A0-4", "A0-5", "A0-6", "A0-7", "A0-8", "A0-9"];

describe("M0 acceptance (one-digit slice)", () => {
  it.each(IDS)("%s", (id) => {
    const r = results.find((x) => x.id === id);
    expect(r, `check ${id} did not run`).toBeDefined();
    expect(r!.passed, `${id} ${r!.title}: ${r!.detail}`).toBe(true);
  });
});

describe("M0 acceptance on an already-posed model (as in the page's ?selftest)", () => {
  it("gives the same results after the model was posed by another rig", async () => {
    const { M0_NODES, Rig } = await import("../scene/rig");
    const { applyM0Pose } = await import("../scene/m0Pose");
    const { DigitSlice } = await import("../sim/digitSlice");
    const root = await loadAsset("m0-digit-slice.glb");
    const pageRig = new Rig(root, M0_NODES);
    const m = new DigitSlice();
    m.setSetting(7);
    m.setTheta(123);
    applyM0Pose(pageRig, m.pose());
    const again = runM0Checks(root);
    expect(again.filter((r) => !r.passed).map((r) => `${r.id}: ${r.detail}`)).toEqual([]);
  }, 60_000);
});
