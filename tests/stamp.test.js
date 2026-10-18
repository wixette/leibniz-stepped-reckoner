// The version stamps (tools/stamp.mjs): every page names its files, and maps its
// modules, with package.json's version, and every name it maps leads to a file.

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { moduleFiles, PAGES, stamp } from "../tools/stamp.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;

/**
 * @param {string} page
 * @returns {Record<string, string>}
 */
function importMap(page) {
  const m = readFileSync(join(ROOT, page), "utf8").match(/<script type="importmap">([\s\S]*?)<\/script>/);
  assert.ok(m, `${page} has no import map`);
  return JSON.parse(m[1]).imports;
}

/**
 * The bare names (not relative paths) the pages' scripts import.
 * @returns {Set<string>}
 */
function bareImports() {
  /** @param {string} dir @returns {string[]} */
  const walk = (dir) =>
    readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith(".js") ? [`${dir}/${e.name}`] : [],
    );
  const names = new Set();
  for (const file of [...walk("js"), ...walk("dev")]) {
    const src = readFileSync(join(ROOT, file), "utf8");
    for (const m of src.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)"([^".][^"]*)"/g)) names.add(m[1]);
  }
  return names;
}

describe("version stamps", () => {
  for (const page of PAGES) {
    it(`${page} carries version ${VERSION} (run pnpm stamp if not)`, () => {
      const html = readFileSync(join(ROOT, page), "utf8");
      assert.equal(html, stamp(html, page, VERSION, moduleFiles()));
      assert.match(html, /<script type="module" src="[^"]+\.js\?v=/);
    });

    it(`${page}: every name in its import map leads to a file`, () => {
      for (const target of Object.values(importMap(page))) {
        const file = join(ROOT, dirname(page), target.replace(/\?v=.*$/, ""));
        assert.ok(existsSync(file), `${target} does not exist`);
      }
    });

    it(`${page}: every bare name the scripts import is in its import map`, () => {
      const map = importMap(page);
      for (const name of bareImports()) assert.ok(name in map, `"${name}" is not in the import map (vendor it in tools/vendor.mjs, then pnpm vendor and pnpm stamp)`);
    });
  }

  it("stamping a stamped page changes nothing", () => {
    const html = readFileSync(join(ROOT, "index.html"), "utf8");
    const once = stamp(html, "index.html", "9.9.9", moduleFiles());
    assert.equal(stamp(once, "index.html", "9.9.9", moduleFiles()), once);
    assert.ok(once.includes('href="css/style.css?v=9.9.9"'));
    assert.ok(!once.includes("?v=" + VERSION + '"') || VERSION === "9.9.9");
  });
});
