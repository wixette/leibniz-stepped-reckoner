// M2 acceptance spec (plan §10.1): runs on assets/m2-full-machine.glb in Node.
// A2-10 (M0 and M1 still pass) is m0.accept.test.ts and m1.accept.test.ts, which run in
// the same `pnpm test`.

import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { CheckResult } from "./harness";
import { loadAsset } from "./loadGlb.node";
import { runM2Checks } from "./m2Checks";

const FILE = "m2-full-machine.glb";
let results: CheckResult[] = [];

beforeAll(async () => {
  const bytes = statSync(fileURLToPath(new URL(`../../../assets/${FILE}`, import.meta.url))).size;
  results = runM2Checks(await loadAsset(FILE), { bytes });
}, 180_000);

const IDS = ["A2-1", "A2-2", "A2-3", "A2-4", "A2-5", "A2-6", "A2-7", "A2-8", "A2-9", "A2-11", "A2-12", "A2-13"];

describe("M2 acceptance (full machine)", () => {
  it.each(IDS)("%s", (id) => {
    const r = results.find((x) => x.id === id);
    expect(r, `check ${id} did not run`).toBeDefined();
    expect(r!.passed, `${id} ${r!.title}: ${r!.detail}`).toBe(true);
  });
});
