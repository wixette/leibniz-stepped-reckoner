// The page in headless Chrome, for `pnpm shots` and `pnpm video`: serves the repository
// itself on a free port, starts Chrome with the GPU at a fixed window size and talks to it
// over the DevTools protocol. Chrome is found at its usual place, or set CHROME. The models
// must be checked out from Git LFS.

import { spawn } from "node:child_process";
import { createReadStream, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** @type {Record<string, string>} */
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav",
};

const CHROME =
  process.env.CHROME ??
  { darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" }[
    /** @type {string} */ (process.platform)
  ] ??
  "google-chrome";

/** @param {number} ms */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @typedef {object} Browser
 * @property {(method: string, params?: object) => Promise<any>} send a DevTools command
 * @property {(expression: string) => Promise<any>} evaluate run JavaScript in the page, awaiting a promise
 * @property {(lang: string) => Promise<void>} load load the simulator afresh, in a language, with ?debug, and wait for its model
 * @property {string[]} errors exceptions the page threw since the last load
 * @property {() => Promise<void>} close
 */

/**
 * Serve the repository and open Chrome on it.
 * @param {{ width: number; height: number }} size
 * @returns {Promise<Browser>}
 */
export async function openBrowser({ width, height }) {
  if (readFileSync(join(ROOT, "assets/m2-full-machine.glb")).subarray(0, 4).toString() !== "glTF") {
    throw new Error("assets/m2-full-machine.glb is not a model: fetch it with `git lfs pull`");
  }
  const server = createServer((req, res) => {
    let file = normalize(join(ROOT, decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname)));
    try {
      if (!file.startsWith(ROOT)) throw new Error();
      if (statSync(file).isDirectory()) file = join(file, "index.html");
      statSync(file);
    } catch {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", () => r(undefined)));
  const address = server.address();
  const site = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/`;

  const profile = mkdtempSync(join(tmpdir(), "lsr-headless-"));
  const port = 9300 + Math.floor(Math.random() * 500);
  const chrome = spawn(
    CHROME,
    [
      "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--enable-gpu", "--hide-scrollbars",
      `--window-size=${width},${height}`, "--force-device-scale-factor=1", "--mute-audio",
      ...(process.platform === "darwin" ? ["--use-angle=metal"] : []), "about:blank",
    ],
    { stdio: "ignore" },
  );
  /** @type {{ type: string; webSocketDebuggerUrl: string }[] | undefined} */
  let targets;
  for (let i = 0; i < 50 && !targets; i++) {
    targets = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json(), () => sleep(200).then(() => undefined));
  }
  const target = targets?.find((t) => t.type === "page");
  if (!target) throw new Error(`Chrome did not start (${CHROME}); set CHROME to its path`);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));

  let nextId = 0;
  /** @type {Map<number, (m: any) => void>} */
  const replies = new Map();
  /** @type {string[]} */
  const errors = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(String(e.data));
    replies.get(m.id)?.(m);
    replies.delete(m.id);
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  });
  /** @type {Browser["send"]} */
  const send = (method, params = {}) =>
    new Promise((r) => {
      const id = ++nextId;
      replies.set(id, r);
      ws.send(JSON.stringify({ id, method, params }));
    });
  /** @type {Browser["evaluate"]} */
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text);
    return r.result?.result?.value;
  };
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });

  return {
    send,
    evaluate,
    errors,
    async load(lang) {
      errors.length = 0;
      await evaluate("try { localStorage.clear() } catch {}").catch(() => {}); // no lesson done or to resume
      await send("Page.navigate", { url: `${site}?lang=${lang}&debug&quality=high` });
      await sleep(500);
      for (let i = 0; i < 150; i++) {
        if (await evaluate("!!(window.app?.stage.root && document.getElementById('loader').hidden)").catch(() => false)) break;
        await sleep(200);
      }
      await sleep(500);
    },
    async close() {
      ws.close();
      await new Promise((r) => (chrome.once("exit", r), chrome.kill()));
      server.close();
      rmSync(profile, { recursive: true, force: true });
    },
  };
}
