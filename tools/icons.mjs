// Draws the page's icons with headless Chrome, so the PNGs are the SVGs exactly:
//
//     pnpm icons           (CHROME=/path/to/chrome if it is not in the usual place)
//
// - images/favicon.svg is drawn by hand: the Magna Rota and its crank, which still reads at
//   16 px, where the whole machine (images/logo.svg) would be a thin stripe;
// - images/favicon.ico: 16, 32 and 48 px, for browsers that take no SVG icon;
// - images/apple-touch-icon.png (180) and images/icon-192.png, icon-512.png (the web app
//   manifest): the same drawing on the page's background, since a home screen gives an
//   icon no background of its own.
//
// Run it after changing favicon.svg, and commit what it writes.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const IMAGES = join(ROOT, "images");
// The page's background (css/style.css, --md-surface), behind the home screen icons.
const BACKGROUND = "#16130f";

const found =
  process.env.CHROME ??
  ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find((p) => existsSync(p));
if (!found) throw new Error("Chrome not found: set CHROME to its path");
const CHROME = found;

const tmp = mkdtempSync(join(tmpdir(), "icons-"));
/**
 * The favicon drawn at a size, on a background (or transparent), as PNG bytes.
 * @param {number} size
 * @param {string | null} background
 * @param {number} inset margin around the drawing, as a fraction of the size
 * @returns {Buffer}
 */
function draw(size, background, inset) {
  const svg = readFileSync(join(IMAGES, "favicon.svg"), "utf8");
  const pad = Math.round(size * inset);
  const html = `<!doctype html><html><body style="margin:0;background:${background ?? "transparent"}">
<img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}" style="display:block;margin:${pad}px;width:${size - 2 * pad}px;height:${size - 2 * pad}px"></body></html>`;
  const page = join(tmp, "icon.html");
  const out = join(tmp, `icon-${size}.png`);
  writeFileSync(page, html);
  execFileSync(CHROME, ["--headless", "--disable-gpu", "--hide-scrollbars", "--default-background-color=00000000", `--window-size=${size},${size}`, `--screenshot=${out}`, `file://${page}`], { stdio: "ignore" });
  return readFileSync(out);
}

/**
 * An .ico holding PNG images (allowed since Windows Vista; every current browser reads it).
 * @param {Buffer[]} pngs
 * @param {number[]} sizes
 * @returns {Buffer}
 */
function ico(pngs, sizes) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach((png, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(sizes[i] % 256, e);
    header.writeUInt8(sizes[i] % 256, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(png.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...pngs]);
}

try {
  const sizes = [16, 32, 48];
  writeFileSync(join(IMAGES, "favicon.ico"), ico(sizes.map((s) => draw(s, null, 0)), sizes));
  writeFileSync(join(IMAGES, "apple-touch-icon.png"), draw(180, BACKGROUND, 0.12));
  writeFileSync(join(IMAGES, "icon-192.png"), draw(192, BACKGROUND, 0.12));
  writeFileSync(join(IMAGES, "icon-512.png"), draw(512, BACKGROUND, 0.12));
  process.stdout.write("images/: favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png\n");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
