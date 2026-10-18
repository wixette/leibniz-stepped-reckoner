// The pages load three.js from vendor/ (import maps); Node and the type check use
// node_modules. These tests keep the two the same, and every page's import map working.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { sourcePath, VENDORED, vendorPath } from "../tools/vendor.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PAGES = ["index.html", "dev/index.html", "dev/01-digit-slice/index.html", "dev/02-carry-slice/index.html", "dev/03-full-machine/index.html"];

describe("vendor/ matches the versions in package.json", () => {
  for (const [pkg, files] of Object.entries(VENDORED)) {
    for (const file of files) {
      it(`${pkg}/${file}`, () => {
        assert.ok(existsSync(vendorPath(pkg, file)), `vendor/${pkg}/${file} is missing: run pnpm vendor`);
        assert.ok(readFileSync(vendorPath(pkg, file)).equals(readFileSync(sourcePath(pkg, file))), `vendor/${pkg}/${file} differs from node_modules: run pnpm vendor`);
      });
    }
  }
});

describe("each page's import map leads to files that exist", () => {
  for (const page of PAGES) {
    it(page, () => {
      const html = readFileSync(join(ROOT, page), "utf8");
      const m = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
      if (page === "dev/index.html") return assert.equal(m, null, "the list of pages loads no modules");
      assert.ok(m, "no import map");
      /** @type {{ imports: Record<string, string> }} */
      const map = JSON.parse(m[1]);
      assert.deepEqual(Object.keys(map.imports).sort(), ["three", "three-mesh-bvh", "three/addons/"]);
      for (const target of Object.values(map.imports)) {
        const file = join(ROOT, dirname(page), target);
        assert.ok(existsSync(file), `${target} does not exist`);
      }
    });
  }
});
