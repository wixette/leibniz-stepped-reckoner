// Writes the version into every file name the pages give, so that a cache (the
// browser's, or a CDN's) can keep each file as long as it likes: a new release asks for
// new names. As in the 8800 simulator.
//
//     pnpm version 1.2.0    (sets the version, then runs this)
//     pnpm stamp            (after a version set any other way)
//
// tests/stamp.test.js fails while a page and package.json disagree. It edits the pages
// in place; there is no build, and no second copy of a page:
//
// - each local file a page names by src or href gets ?v=<version> (its stylesheet and
//   its main script);
// - its import map gives every module the same: the bare names ("three",
//   "three-mesh-bvh", "three/addons/…"), every .js file in js/ and the vendored
//   libraries, which import one another by relative paths, and the JSON in params/,
//   which the simulation imports as a module. The map turns each into the versioned
//   name, for that page alone;
// - the models, which the scripts fetch themselves, take the version from the URL of
//   the module that loads them (import.meta.url).
//
// The pages themselves are never cached for long (see the README), so they are always
// the newest, and so are the names in them.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { VENDORED } from "./vendor.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The pages that load modules. */
export const PAGES = ["index.html", "dev/01-digit-slice/index.html", "dev/02-carry-slice/index.html", "dev/03-full-machine/index.html"];

/**
 * Every module a page may load, relative to the repository root: the .js files in js/,
 * the vendored ones, and the JSON in params/.
 * @param {string} [root]
 * @returns {string[]}
 */
export function moduleFiles(root = ROOT) {
  /** @param {string} dir @returns {string[]} */
  const walk = (dir) =>
    readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith(".js") ? [`${dir}/${e.name}`] : [],
    );
  const vendored = Object.entries(VENDORED).flatMap(([pkg, files]) => files.filter((f) => f.endsWith(".js")).map((f) => `vendor/${pkg}/${f}`));
  const params = readdirSync(join(root, "params")).filter((f) => f.endsWith(".json")).map((f) => `params/${f}`);
  return [...walk("js"), ...vendored, ...params].sort();
}

/**
 * A page, with the version in every local file name and in its import map. Stamping a
 * stamped page again changes nothing.
 * @param {string} html the page
 * @param {string} page its path from the repository root
 * @param {string} version as package.json has it
 * @param {string[]} modules from moduleFiles()
 * @returns {string}
 */
export function stamp(html, page, version, modules) {
  const v = `?v=${version}`;
  const up = relative(dirname(page), ".").split("\\").join("/");
  /** @param {string} file */
  const url = (file) => (up ? `${up}/${file}` : `./${file}`);
  // A file of the site's own: not a link elsewhere, nor a fragment, nor a folder.
  const local = /^(?![a-z]+:|\/\/|#)([^?#"]+\.[a-z0-9]+)(\?v=[^"#]*)?$/i;
  let out = html.replace(/\b(src|href)="([^"]*)"/g, (whole, attr, u) => {
    const m = u.match(local);
    return m ? `${attr}="${m[1]}${v}"` : whole;
  });
  /** @type {Record<string, string>} */
  const imports = {
    three: url("vendor/three/build/three.module.js") + v,
    "three-mesh-bvh": url("vendor/three-mesh-bvh/build/index.module.js") + v,
  };
  for (const f of VENDORED.three.filter((f) => f.startsWith("examples/jsm/"))) {
    imports[`three/addons/${f.slice("examples/jsm/".length)}`] = url(`vendor/three/${f}`) + v;
  }
  for (const file of modules) imports[url(file)] = url(file) + v;
  const json = JSON.stringify({ imports }, null, 2).replace(/\n/g, "\n    ");
  const block = /(<script type="importmap">\n    )[\s\S]*?(\n    <\/script>)/;
  if (!block.test(out)) throw new Error(`${page} has no import map to stamp`);
  return out.replace(block, (_whole, open, close) => open + json + close);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
  const modules = moduleFiles();
  for (const page of PAGES) {
    const before = readFileSync(join(ROOT, page), "utf8");
    const after = stamp(before, page, version, modules);
    if (after !== before) writeFileSync(join(ROOT, page), after);
    process.stdout.write(`${page} ${after === before ? "already has" : "now has"} version ${version} in its file names.\n`);
  }
}
