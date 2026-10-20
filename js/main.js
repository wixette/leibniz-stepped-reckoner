// The simulator's main page: free play on the machine, with the tutorial, the lessons and the
// references in the dock (docs/ui-design.md). The app's parts are in js/app/.

import { bestLocale, isLocale, load, setLocale, t } from "./l10n/l10n.js";
import { applyIcons, tabs } from "./ui/components.js";
import { App, store } from "./app/app.js";
import { referencesPanel } from "./app/references.js";

// The version this module was loaded with (?v=, see tools/stamp.mjs), so a cache never
// pairs an old model with new code.
const MODEL = "assets/m2-full-machine.glb" + new URL(import.meta.url).search;
const params = new URLSearchParams(location.search);

/**
 * @template {HTMLElement} [T=HTMLElement]
 * @param {string} id
 */
const $ = (id) => /** @type {T} */ (document.getElementById(id));

// ---- language: ?lang=, then the reader's last choice, then the browser's ----------------------------
const asked = params.get("lang") ?? "";
const saved = store.get("lsr-locale") ?? "";
const loc = isLocale(asked) ? asked : isLocale(saved) ? saved : bestLocale(navigator.languages ?? [navigator.language]);
await load(loc);
setLocale(loc);

applyIcons(document);
const app = new App();

// ---- the dock's tabs ------------------------------------------------------------------------------------
const select = tabs($("tabs"), (id) => {
  app.courseUI.selected = id;
  app.courseUI.updateDots();
  store.set("lsr-tab", id);
});
app.courseUI.selectTab = select;
const renderRefs = () => $("panel-refs").replaceChildren(referencesPanel());
const savedTab = store.get("lsr-tab");
select(savedTab === "tab-lessons" || savedTab === "tab-refs" ? savedTab : "tab-start");

app.onRetranslate = renderRefs;
app.retranslate();

// ---- the model ----------------------------------------------------------------------------------------
const loader = $("loader");
/** @param {number} f */
const progress = (f) => {
  const pct = Math.round(f * 100);
  $("loaderBar").style.width = `${pct}%`;
  $("loaderText").textContent = t("status.loading", { pct });
};
progress(0);
try {
  await app.stage.load(MODEL, progress);
  loader.hidden = true;
  app.say(() => t("status.ready"));
  app.changed();
} catch (err) {
  $("loaderText").textContent = t("status.loadFailed", { error: err instanceof Error ? err.message : String(err) });
  console.error(err);
}

// ---- ?selftest: the M3 acceptance checks on the loaded model, in the browser ----------------------------
if (params.has("selftest") && app.stage.root) {
  const root = app.stage.root;
  const [{ runM3Checks }, { showSelftest }] = await Promise.all([import("./accept/m3Checks.js"), import("./accept/selftestPanel.js")]);
  const t0 = performance.now();
  app.stage.exploder?.apply(0);
  const results = runM3Checks(root);
  showSelftest($("panel-start"), results, performance.now() - t0);
  app.stage.applyToggles();
  app.changed();
}

// ---- ?perf: frame rate and draw calls (for the Chromebook measurement) ----------------------------------
if (params.has("perf")) {
  const box = document.createElement("div");
  box.className = "readout";
  box.style.cssText = "position:absolute;right:12px;top:12px;font-size:12px;z-index:4";
  $("stage").appendChild(box);
  const viewer = app.stage.viewer;
  let last = viewer.renderedFrames;
  let t0 = performance.now();
  viewer.addFrameCallback(() => {
    const now = performance.now();
    if (now - t0 < 1000) return;
    const fps = Math.round(((viewer.renderedFrames - last) * 1000) / (now - t0));
    const info = viewer.renderer.info;
    box.textContent = `${fps === 0 ? "idle" : `${fps} fps`} · ${info.render.calls} draw calls · ${Math.round(info.render.triangles / 1000)} k tris · ${viewer.quality}${viewer.qualityMode === "auto" ? " (auto)" : ""}`;
    last = viewer.renderedFrames;
    t0 = now;
  });
}

// ?debug exposes the page's state to the console (to set up states by hand).
if (params.has("debug")) Object.assign(window, { app });
