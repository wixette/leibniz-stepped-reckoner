// Tests for the reference check (tools/check-refs.mjs): `pnpm test`.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { checkLinks, checkText, linkTargets } from "./check-refs.mjs";

const privateName = ["computing", "machines", "lab"].join("-");

test("a mention of the private repository is found, in any case", () => {
  assert.equal(checkText("a.md", `See ${privateName} for more.`).length, 1);
  assert.equal(checkText("a.md", `See ${privateName.toUpperCase()}.`).length, 1);
  assert.equal(checkText("p.json", `{"name": "@${"cml"}/web"}`).length, 1);
  assert.deepEqual(checkText("a.md", "A lab page, a laboratory: fine."), []);
});

test("absolute paths on a developer's machine are found", () => {
  assert.equal(checkText("a.md", "open /Users/alice/src/x.pdf").length, 1);
  assert.equal(checkText("a.sh", "cd /home/bob/work/").length, 1);
  assert.equal(checkText("a.md", "C:\\Users\\carol\\Desktop\\x").length, 1);
  // Not local paths: URLs, the rule's own wording, app paths.
  assert.deepEqual(checkText("a.md", "https://example.org/Users/alice/x"), []);
  assert.deepEqual(checkText("a.md", "no absolute local paths (`/Users/…`)"), []);
  assert.deepEqual(checkText("a.md", "/Applications/Blender.app/Contents/MacOS/Blender"), []);
});

test("links are read from Markdown and HTML, but not from code", () => {
  const md = [
    "[a](docs/a.md) and [b](<docs/b c.md> \"title\")",
    "`[not](a-link.md)`",
    "```",
    "[not](in-a-fence.md)",
    "```",
    '<img src="images/logo.svg"> <source srcset="images/x.svg 1x, images/y.svg 2x">',
  ].join("\n");
  assert.deepEqual(
    linkTargets("README.md", md).map((l) => l.target),
    ["docs/a.md", "docs/b c.md", "images/logo.svg", "images/x.svg", "images/y.svg"],
  );
});

test("a relative link must stay inside the repository and lead somewhere", () => {
  const root = mkdtempSync(path.join(tmpdir(), "refs-"));
  mkdirSync(path.join(root, "docs"));
  writeFileSync(path.join(root, "docs", "a.md"), "# A\n");
  writeFileSync(path.join(root, "README.md"), "");
  const check = (file, text) => checkLinks(root, file, text);
  assert.deepEqual(check("README.md", "[a](docs/a.md#part) [b](/docs/a.md) [web](https://x.org) [top](#top)"), []);
  assert.deepEqual(check("docs/a.md", "[up](../README.md)"), []);
  assert.match(check("docs/a.md", "[out](../../elsewhere/conventions.md)")[0], /leaves the repository/);
  assert.match(check("README.md", "[gone](docs/missing.md)")[0], /broken link/);
  assert.match(check("README.md", "[odd](docs/100%.md)")[0], /malformed link/);
});
