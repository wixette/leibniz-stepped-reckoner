// M3 acceptance spec (plan §10.1): lessons, i18n and teaching views on assets/m2-full-machine.glb.
// A3-7 is the teaching page's ?selftest (it runs these same checks); A3-8 (M0-M2 still pass)
// is the other *.accept.test.ts files in the same `pnpm test`.

import { beforeAll, describe, expect, it } from "vitest";
import type { CheckResult } from "./harness";
import { loadAsset } from "./loadGlb.node";
import { runM3Checks } from "./m3Checks";

let results: CheckResult[] = [];

beforeAll(async () => {
  results = runM3Checks(await loadAsset("m2-full-machine.glb"));
}, 120_000);

describe("M3 acceptance (teaching layer)", () => {
  it.each(["A3-1", "A3-2", "A3-3", "A3-4", "A3-5", "A3-6", "A3-9", "A3-10", "A3-11"])("%s", (id) => {
    const r = results.find((x) => x.id === id);
    expect(r, `check ${id} did not run`).toBeDefined();
    expect(r!.passed, `${id} ${r!.title}: ${r!.detail}`).toBe(true);
  });
});
