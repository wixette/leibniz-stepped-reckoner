// The reference check (`pnpm check:refs`). This repository is public, and it was
// developed in a private one first. Nothing here may point back to private
// material, or anywhere else a reader cannot follow. It fails on:
//
//   1. a mention of the private development repository or its package scope;
//   2. an absolute path on a developer's machine (/Users/name/…, /home/name/…,
//      C:\Users\name\…);
//   3. a relative link, in Markdown or HTML, that leaves the repository or
//      points at a file that does not exist.
//
// It reads every file git tracks or would track (so new files are checked
// before they are committed), and skips binary files and LFS objects. CI runs
// it on every push and pull request; see docs/conventions.md, "References".

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Names of private material. Built from parts, so this file does not trip its own check. */
const PRIVATE = [
  ["computing", "machines", "lab"].join("-"),
  "@" + "cml/",
];

const LOCAL_PATH = [
  /(?:^|[^\w.:/])\/(?:Users|home)\/[A-Za-z0-9._-]+\//, // /Users/name/… and /home/name/…
  /\b[A-Za-z]:\\Users\\[^\\\s]+\\/, // C:\Users\name\…
];

/** Problems in one file's text that do not depend on other files: private names, local paths. */
export function checkText(file, text) {
  const problems = [];
  text.split("\n").forEach((line, i) => {
    const lower = line.toLowerCase();
    for (const name of PRIVATE) {
      if (lower.includes(name)) problems.push(`${file}:${i + 1}: mentions private material (${name})`);
    }
    for (const re of LOCAL_PATH) {
      if (re.test(line)) problems.push(`${file}:${i + 1}: absolute local path`);
    }
  });
  return problems;
}

/** Link targets in Markdown or HTML text, with their line numbers (fenced code blocks skipped). */
export function linkTargets(file, text) {
  const out = [];
  const md = file.endsWith(".md");
  let fenced = false;
  text.split("\n").forEach((line, i) => {
    if (md && /^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      return;
    }
    if (fenced) return;
    const scan = md ? line.replace(/`[^`]*`/g, "") : line; // inline code is not a link
    // [text](target "title"), or [text](<target with spaces>)
    if (md) for (const m of scan.matchAll(/\]\(\s*(?:<([^>]+)>|([^)\s]+))(?:\s+"[^"]*")?\s*\)/g)) out.push({ target: m[1] ?? m[2], line: i + 1 });
    for (const m of scan.matchAll(/\b(?:href|src|srcset)\s*=\s*["']([^"']+)["']/g)) {
      for (const part of m[1].split(",")) out.push({ target: part.trim().split(/\s+/)[0], line: i + 1 });
    }
  });
  return out;
}

const external = (t) => /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(t) || t === "";

/** Relative links that leave the repository or point at nothing. */
export function checkLinks(root, file, text) {
  const problems = [];
  for (const { target, line } of linkTargets(file, text)) {
    if (external(target)) continue;
    let clean;
    try {
      clean = decodeURIComponent(target.split("#")[0].split("?")[0]);
    } catch {
      problems.push(`${file}:${line}: malformed link (${target})`); // a stray % that is no escape
      continue;
    }
    if (clean === "") continue;
    const resolved = clean.startsWith("/") ? path.join(root, clean) : path.resolve(root, path.dirname(file), clean);
    const rel = path.relative(root, resolved);
    if (rel.startsWith("..") || path.isAbsolute(rel)) problems.push(`${file}:${line}: link leaves the repository (${target})`);
    else if (!existsSync(resolved)) problems.push(`${file}:${line}: broken link (${target})`);
  }
  return problems;
}

const LINKED = /\.(md|html)$/;
/** The check and its tests spell out the patterns they look for, so they are not scanned. */
const SELF = new Set(["tools/check-refs.mjs", "tools/check-refs.test.mjs"]);
const MAX_BYTES = 4 * 1024 * 1024;

function isBinary(buf) {
  return buf.subarray(0, 8192).includes(0);
}
function isLfsPointer(text) {
  return text.startsWith("version https://git-lfs.github.com/spec/");
}

/** Check every tracked or trackable file under root; returns the problems found. */
export function checkRepository(root) {
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root })
    .toString()
    .split("\0")
    .filter(Boolean);
  const problems = [];
  for (const file of files) {
    if (SELF.has(file)) continue;
    const full = path.join(root, file);
    if (!existsSync(full) || statSync(full).size > MAX_BYTES) continue;
    const buf = readFileSync(full);
    if (isBinary(buf)) continue;
    const text = buf.toString("utf8");
    if (isLfsPointer(text)) continue;
    problems.push(...checkText(file, text));
    if (LINKED.test(file)) problems.push(...checkLinks(root, file, text));
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"]).toString().trim();
  const problems = checkRepository(root);
  if (problems.length) {
    console.error(problems.join("\n"));
    console.error(`\ncheck:refs: ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
    process.exit(1);
  }
  console.log("check:refs: no private references, local paths or broken links");
}
