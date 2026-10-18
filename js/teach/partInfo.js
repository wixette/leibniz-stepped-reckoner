// What a label says about a part (M3): its name and, for parts that hold a value, the
// current value. A part's position is named by its decimal place in words ("Result wheel ·
// tens"), never by an index, so the only number in a label is the value, shown apart from
// the name (A3-10). Names come from the message files (js/l10n), in every language (A3-1).
// Pure logic: the page renders it, the tests check it.

import { gltfName } from "../scene/rig.js";
import { locale, t, tn } from "../l10n/l10n.js";
/** @import { Locale } from "../l10n/l10n.js" */
/** @import { Machine } from "../sim/machine.js" */

/**
 * @typedef {object} PartInfo
 * @property {string} name
 * @property {string | null} value
 * @property {boolean} [red]
 */

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
/** @param {number} n */
const sup = (n) => String(n).split("").map((d) => SUP[Number(d)]).join("");

/**
 * A decimal place in words; from 10⁴ on as a power of ten ("10⁴ place").
 * @param {number} k
 * @param {Locale} [loc]
 * @returns {string}
 */
export function placeWord(k, loc = locale()) {
  return k < 4 ? t(`place.${k}`, {}, loc) : t("place.pow", { pow: `10${sup(k)}` }, loc);
}

/**
 * Parts named by their place (index = decimal place, or the input digit for the carriage's
 * parts), and parts with one name. Live parts (wheels, knobs, drums...) are in partInfo().
 */
const PLACED = /** @type {const} */ ([
  ["pm.drum_shaft.", "part.drumShaft"],
  ["pm.lever.", "part.lever"],
  ["pm.zweihorn_add.", "part.zweihornAdd"],
  ["pm.zweihorn_sub.", "part.zweihornSub"],
]);
const SINGLE = /** @type {const} */ ([
  ["frame.base", "part.base"],
  ["frame.case", "part.case"],
  ["frame.lead_screw", "part.leadScrew"],
  ["frame.register_cover", "part.registerCover"],
  ["frame.static", "part.frame"],
  ["pi.window", "part.windows"],
  ["pm.carriage_cover", "part.carriageCover"],
  ["pm.carriage_panel", "part.carriagePanel"],
  ["pm.magna_plate", "part.magnaPlate"],
  ["pm.main_crank", "part.mainCrank"],
]);

/** Every message key a part name can use (A3-1). */
export const PART_KEYS = [
  ...PLACED.map(([, k]) => k),
  ...SINGLE.map(([, k]) => k),
  "part.wheel",
  "part.store",
  "part.dial",
  "part.plate",
  "part.drum",
  "part.rack",
  "part.magna",
  "part.pin",
  "part.carriage",
];

/**
 * @param {string} node glTF node name (dots stripped)
 * @param {string} base node name with a trailing dot ("pi.sum_wheel.")
 * @returns {number | null}
 */
function index(node, base) {
  const r = new RegExp(`^${gltfName(base)}(\\d+)$`).exec(node);
  return r ? Number(r[1]) : null;
}

/**
 * Name and live value of a part, by its glTF node name (dots stripped, e.g. "pisum_wheel3"),
 * or null for parts without a live value (partName() names those).
 * Carriage parts are named by the place of the input they set (knob j = 10^j of the input).
 * @param {string} node
 * @param {Machine} m
 * @param {Locale} [loc]
 * @returns {PartInfo | null}
 */
export function partInfo(node, m, loc = locale()) {
  /**
   * @param {string} key
   * @param {number} k
   */
  const named = (key, k) => `${t(key, {}, loc)} · ${placeWord(k, loc)}`;
  /** @type {number | null} */
  let k;
  if ((k = index(node, "pi.sum_wheel.")) !== null) return { name: named("part.wheel", k), value: String(m.shownDigits()[k]) };
  if ((k = index(node, "pi.carry_store.")) !== null) return { name: named("part.store", k), value: t(`value.store.${m.carryStates()[k]}`, {}, loc) };
  if ((k = index(node, "pm.setting_dial.")) !== null) return { name: named("part.dial", k), value: String(m.settings[k]) };
  if ((k = index(node, "pm.setting_plate.")) !== null) return { name: named("part.plate", k), value: String(m.settings[k]) };
  if ((k = index(node, "pm.drum.")) !== null) return { name: named("part.drum", k), value: String(m.settings[k]) };
  if ((k = index(node, "pm.setting_rack.")) !== null) return { name: named("part.rack", k), value: String(m.settings[k]) };
  if (node === gltfName("pm.magna_rota")) {
    const turns = Math.trunc(m.ringTurns + m.theta / 360);
    const n = Math.abs(turns);
    return { name: t("part.magna", {}, loc), value: turns < 0 ? tn("value.back", n, {}, loc) : tn("value.turns", n, {}, loc), red: turns < 0 };
  }
  if (node === gltfName("pm.magna_pin")) {
    return { name: t("part.pin", {}, loc), value: m.pin === null ? null : t("value.hole", { n: m.pin }, loc) };
  }
  if (node === gltfName("pm.carriage")) {
    const o = m.offset;
    return { name: t("part.carriage", {}, loc), value: o === 0 ? t("value.home", {}, loc) : tn("value.placesLeft", o, {}, loc) };
  }
  return null;
}

/**
 * The name of a part without a live value, by its glTF node name, or null.
 * @param {string} node
 * @param {Locale} [loc]
 * @returns {string | null}
 */
export function partName(node, loc = locale()) {
  for (const [base, key] of PLACED) {
    const k = index(node, base);
    if (k !== null) return `${t(key, {}, loc)} · ${placeWord(k, loc)}`;
  }
  for (const [name, key] of SINGLE) if (node === gltfName(name)) return t(key, {}, loc);
  return null;
}
