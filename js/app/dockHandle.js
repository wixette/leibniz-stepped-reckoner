// The dock's resize handle (docs/ui-design.md, U17). It is the dock's own edge: its left edge
// while the dock stands beside the machine, its top edge (a grab pill, like a bottom sheet's)
// while it lies below. Drag it, move it with the arrow keys, or double-click it to go back to
// the default size. The size is remembered for each of the two layouts. Dragged well past its
// smallest size, the dock closes, as with the top bar's dock button.

/** Same as the stacked layout's media query in css/style.css (U1). */
const STACKED = "(max-width: 899px), (orientation: portrait)";
/** The dock's smallest size (px): wide beside the machine, tall below it. */
const DOCK_MIN = { w: 300, h: 160 };
/** What the machine area keeps at least (px). */
const STAGE_MIN = { w: 360, h: 220 };
/** Dragged this far (px) below the smallest size, the dock closes. */
const CLOSE_BEYOND = 60;
/** An arrow key moves the edge this far (px); with Shift, four times as far. */
const STEP = 16;

/**
 * @param {object} o
 * @param {HTMLElement} o.workspace the grid holding the machine area and the dock
 * @param {HTMLElement} o.dock
 * @param {HTMLElement} o.handle
 * @param {{ get(key: string): string | null; set(key: string, value: string): void }} o.store
 * @param {() => void} o.close closes the dock
 */
export function wireDockHandle({ workspace, dock, handle, store, close }) {
  const mq = window.matchMedia(STACKED);
  const stacked = () => mq.matches;
  const key = () => (stacked() ? "lsr-dock-h" : "lsr-dock-w");
  const prop = () => (stacked() ? "--dock-h" : "--dock-w");
  const range = () => {
    const r = workspace.getBoundingClientRect();
    return stacked()
      ? { min: DOCK_MIN.h, max: Math.max(DOCK_MIN.h, Math.round(r.height - STAGE_MIN.h)) }
      : { min: DOCK_MIN.w, max: Math.max(DOCK_MIN.w, Math.round(r.width - STAGE_MIN.w)) };
  };
  const size = () => {
    const r = dock.getBoundingClientRect();
    return Math.round(stacked() ? r.height : r.width);
  };
  const describe = () => {
    const { min, max } = range();
    handle.setAttribute("aria-orientation", stacked() ? "horizontal" : "vertical");
    handle.setAttribute("aria-valuemin", String(min));
    handle.setAttribute("aria-valuemax", String(max));
    handle.setAttribute("aria-valuenow", String(size()));
  };
  /**
   * @param {number} px
   * @param {boolean} [save]
   */
  const set = (px, save = true) => {
    const { min, max } = range();
    const v = Math.round(Math.min(max, Math.max(min, px)));
    workspace.style.setProperty(prop(), `${v}px`);
    if (save) store.set(key(), String(v));
    describe();
  };
  const reset = () => {
    workspace.style.removeProperty(prop());
    store.set(key(), "");
    describe();
  };
  // the layout's remembered size (or the default), clamped to the window as it is now
  const restore = () => {
    workspace.style.removeProperty("--dock-w");
    workspace.style.removeProperty("--dock-h");
    const v = Number(store.get(key()));
    if (v > 0) set(v, false);
    else describe();
  };
  restore();
  mq.addEventListener("change", restore);
  window.addEventListener("resize", restore);

  /** @type {{ px: number | null } | null} */
  let drag = null;
  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    drag = { px: null };
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      // not an active pointer: the drag works without capture
    }
    document.body.classList.add("resizing", stacked() ? "resizing-rows" : "resizing-cols");
  });
  handle.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const r = workspace.getBoundingClientRect();
    drag.px = stacked() ? r.bottom - e.clientY : r.right - e.clientX;
    set(drag.px, false);
  });
  const end = () => {
    if (!drag) return;
    const { px } = drag;
    drag = null;
    document.body.classList.remove("resizing", "resizing-rows", "resizing-cols");
    if (px === null) return;
    if (px < range().min - CLOSE_BEYOND) {
      restore();
      close();
    } else set(px);
  };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
  handle.addEventListener("dblclick", reset);
  handle.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? STEP * 4 : STEP;
    // the dock grows towards the machine: left beside it, up below it
    const grow = stacked() ? "ArrowUp" : "ArrowLeft";
    const shrink = stacked() ? "ArrowDown" : "ArrowRight";
    if (e.key === grow) set(size() + step);
    else if (e.key === shrink) set(size() - step);
    else if (e.key === "Home") set(range().min);
    else if (e.key === "End") set(range().max);
    else if (e.key === "Enter") reset();
    else return;
    e.preventDefault();
  });
}
