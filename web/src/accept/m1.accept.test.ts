// M1 acceptance spec (plan §10.1): runs on assets/m1-carry-slice.glb in Node.
// A1-7 (M0 still passes) is m0.accept.test.ts, which runs in the same `pnpm test`.

import { beforeAll, describe, expect, it } from "vitest";
import type { CheckResult } from "./harness";
import { loadAsset } from "./loadGlb.node";
import { runM1Checks } from "./m1Checks";

let results: CheckResult[] = [];

beforeAll(async () => {
  results = runM1Checks(await loadAsset("m1-carry-slice.glb"));
}, 60_000);

describe("M1 acceptance (three-digit carry slice)", () => {
  it.each(["A1-1", "A1-2", "A1-3", "A1-4", "A1-5", "A1-6"])("%s", (id) => {
    const r = results.find((x) => x.id === id);
    expect(r, `check ${id} did not run`).toBeDefined();
    expect(r!.passed, `${id} ${r!.title}: ${r!.detail}`).toBe(true);
  });
});
