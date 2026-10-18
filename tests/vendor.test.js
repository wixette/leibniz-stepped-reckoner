// The pages load three.js from vendor/ (import maps); Node and the type check use
// node_modules. These tests keep the two the same. tests/stamp.test.js checks the maps.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { sourcePath, VENDORED, vendorPath } from "../tools/vendor.mjs";

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

