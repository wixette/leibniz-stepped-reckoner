// What a label says about a part (M3): its name and, for parts that hold a value, the
// current value. A part's position is named by its decimal place in words ("Result wheel ·
// tens"), never by an index, so the only number in a label is the value, shown apart from
// the name (A3-10). Pure logic: the page renders it, the tests check it.

import { gltfName } from "../scene/rig";
import type { Machine } from "../sim/machine";
import type { Lang } from "./i18n";
import { placeName } from "./i18n";

export type PartInfo = { name: string; value: string | null; red?: boolean };

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (n: number) => String(n).split("").map((d) => SUP[Number(d)]).join("");

/** A decimal place in words; from 10⁴ on as a power of ten ("10⁴ place" / "10⁴-Stelle"). */
export function placeWord(k: number, lang: Lang): string {
  if (k < 4) return placeName(k, lang);
  return lang === "de" ? `10${sup(k)}-Stelle` : `10${sup(k)} place`;
}

const NAMES = {
  wheel: { en: "Result wheel", de: "Zählrad" },
  store: { en: "Carry store", de: "Übertragsspeicher" },
  dial: { en: "Setting knob", de: "Stellknopf" },
  plate: { en: "Setting dial", de: "Einstellscheibe" },
  drum: { en: "Stepped drum", de: "Staffelwalze" },
  rack: { en: "Setting rack", de: "Einstellzahnstange" },
  magna: { en: "Magna Rota", de: "Magna Rota" },
  pin: { en: "Pin of the Magna Rota", de: "Stift der Magna Rota" },
  carriage: { en: "Carriage", de: "Schlitten" },
};

const STORE_STATE = {
  idle: { en: "no carry", de: "kein Übertrag" },
  stored: { en: "carry stored", de: "Übertrag gespeichert" },
  executing: { en: "passing the carry on", de: "Übertrag wird weitergegeben" },
};

/**
 * Name and live value of a part, by its glTF node name (dots stripped, e.g. "pisum_wheel3"),
 * or null for parts without a live description (the page then uses the model's label).
 * Carriage parts are named by the place of the input they set (knob j = 10^j of the input).
 */
export function partInfo(node: string, m: Machine, lang: Lang): PartInfo | null {
  const idx = (base: string) => {
    const r = new RegExp(`^${gltfName(base)}(\\d+)$`).exec(node);
    return r ? Number(r[1]) : null;
  };
  const named = (n: { en: string; de: string }, k: number) => `${n[lang]} · ${placeWord(k, lang)}`;
  let k: number | null;
  if ((k = idx("pi.sum_wheel.")) !== null) return { name: named(NAMES.wheel, k), value: String(m.shownDigits()[k]) };
  if ((k = idx("pi.carry_store.")) !== null) return { name: named(NAMES.store, k), value: STORE_STATE[m.carryStates()[k]][lang] };
  if ((k = idx("pm.setting_dial.")) !== null) return { name: named(NAMES.dial, k), value: String(m.settings[k]) };
  if ((k = idx("pm.setting_plate.")) !== null) return { name: named(NAMES.plate, k), value: String(m.settings[k]) };
  if ((k = idx("pm.drum.")) !== null) return { name: named(NAMES.drum, k), value: String(m.settings[k]) };
  if ((k = idx("pm.setting_rack.")) !== null) return { name: named(NAMES.rack, k), value: String(m.settings[k]) };
  if (node === gltfName("pm.magna_rota")) {
    const turns = Math.trunc(m.ringTurns + m.theta / 360);
    const n = Math.abs(turns);
    const word = lang === "de" ? (turns < 0 ? `${n} zurück` : `${n} Umdrehung${n === 1 ? "" : "en"}`) : turns < 0 ? `${n} back` : `${n} turn${n === 1 ? "" : "s"}`;
    return { name: NAMES.magna[lang], value: word, red: turns < 0 };
  }
  if (node === gltfName("pm.magna_pin")) {
    return { name: NAMES.pin[lang], value: m.pin === null ? null : lang === "de" ? `Loch ${m.pin}` : `hole ${m.pin}` };
  }
  if (node === gltfName("pm.carriage")) {
    const o = m.offset;
    const value = o === 0 ? (lang === "de" ? "Grundstellung" : "home") : lang === "de" ? `${o} Stelle${o === 1 ? "" : "n"} links` : `${o} place${o === 1 ? "" : "s"} left`;
    return { name: NAMES.carriage[lang], value };
  }
  return null;
}
