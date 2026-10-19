// Draws the page's icons from the logo with headless Chrome, so the PNGs are the SVGs exactly:
//
//     pnpm icons           (CHROME=/path/to/chrome if it is not in the usual place)
//
// The logo, images/logo.svg, is a square with the machine in a wide band across its middle.
// images/logo-wide.svg (the top bar, About) and images/favicon.svg are the same drawing with
// the view cropped close: to the machine, and to a square as wide as the machine.
//
// - images/favicon.ico: 16, 32 and 48 px from favicon.svg, for browsers that take no SVG icon;
// - images/apple-touch-icon.png (180) from favicon.svg on the page's background, since an
//   iPhone's home screen gives an icon no background of its own;
// - images/icon-192.png and icon-512.png (the web app manifest): the logo as it is, on
//   transparent.
//
// Run it after changing the logo (and its two crops), and commit what it writes.

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
 * An SVG of images/ drawn as a square of a size, on a background (or transparent), as PNG bytes.
 * @param {string} file
 * @param {number} size
 * @param {string | null} background
 * @param {number} inset margin around the drawing, as a fraction of the size
 * @returns {Buffer}
 */
function draw(file, size, background, inset) {
  const svg = readFileSync(join(IMAGES, file), "utf8");
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
  writeFileSync(join(IMAGES, "favicon.ico"), ico(sizes.map((s) => draw("favicon.svg", s, null, 0)), sizes));
  writeFileSync(join(IMAGES, "apple-touch-icon.png"), draw("favicon.svg", 180, BACKGROUND, 0.1));
  writeFileSync(join(IMAGES, "icon-192.png"), draw("logo.svg", 192, null, 0));
  writeFileSync(join(IMAGES, "icon-512.png"), draw("logo.svg", 512, null, 0));
  process.stdout.write("images/: favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png\n");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
