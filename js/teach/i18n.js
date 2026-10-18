// English and German text for the teaching page (M3). Every entry has both languages;
// A3-1 checks that none is missing. Part names come from the model (label_en / label_de).

/** @typedef {"en" | "de"} Lang */
/**
 * @typedef {object} Text
 * @property {string} en
 * @property {string} de
 */

/**
 * @param {Text} text
 * @param {Lang} lang
 * @returns {string}
 */
export const t = (text, lang) => text[lang];

export const UI = /** @satisfies {Record<string, Text>} */ ({
  title: { en: "Leibniz's calculating machine", de: "Die Rechenmaschine von Leibniz" },
  subtitle: {
    en: "The first machine for all four operations of arithmetic (about 1700). Reconstruction for teaching.",
    de: "Die erste Maschine für alle vier Grundrechenarten (um 1700). Rekonstruktion für den Unterricht.",
  },
  lessons: { en: "Lessons", de: "Lektionen" },
  freePlay: { en: "Free play", de: "Freies Rechnen" },
  freePlayHint: {
    en: "Set a number, turn the crank, shift the carriage, use the pin. Nothing can break.",
    de: "Zahl einstellen, Kurbel drehen, Schlitten verschieben, Stift setzen. Es kann nichts kaputtgehen.",
  },
  back: { en: "◀ Back", de: "◀ Zurück" },
  next: { en: "Next ▶", de: "Weiter ▶" },
  finish: { en: "Finish", de: "Fertig" },
  stepOf: { en: "Step {i} of {n}", de: "Schritt {i} von {n}" },
  yourTurn: { en: "Your turn", de: "Du bist dran" },
  done: { en: "Done!", de: "Geschafft!" },
  watching: { en: "Watch the machine…", de: "Schau der Maschine zu…" },
  lessonDone: { en: "Lesson complete.", de: "Lektion abgeschlossen." },
  allLessons: { en: "All lessons", de: "Alle Lektionen" },
  result: { en: "Result", de: "Ergebnis" },
  input: { en: "Input (setting knobs)", de: "Eingabe (Stellknöpfe)" },
  turns: { en: "Magna Rota", de: "Magna Rota" },
  shift: { en: "Carriage", de: "Schlitten" },
  add: { en: "＋ Add (turn forward)", de: "＋ Addieren (vorwärts drehen)" },
  sub: { en: "− Subtract (turn back)", de: "− Subtrahieren (rückwärts drehen)" },
  shiftLeft: { en: "◀ Shift left", de: "◀ Nach links" },
  shiftRight: { en: "Shift right ▶", de: "Nach rechts ▶" },
  pin: { en: "Magna Rota pin", de: "Stift der Magna Rota" },
  pinOut: { en: "out", de: "heraus" },
  toStop: { en: "⟳ Turn until it stops", de: "⟳ Drehen bis zum Anschlag" },
  reset: { en: "↺ Reset", de: "↺ Zurücksetzen" },
  views: { en: "View", de: "Ansicht" },
  viewOverview: { en: "Whole machine", de: "Ganze Maschine" },
  viewRegister: { en: "Result", de: "Ergebnis" },
  viewFront: { en: "Magna Rota", de: "Magna Rota" },
  viewDrum: { en: "Stepped drum", de: "Staffelwalze" },
  viewCarry: { en: "Carry", de: "Zehnerübertrag" },
  showCase: { en: "Show the case", de: "Gehäuse zeigen" },
  cutaway: { en: "Open the carriage front", de: "Schlitten vorne öffnen" },
  explode: { en: "Take it apart", de: "Auseinandernehmen" },
  focus: { en: "Fade the other parts", de: "Andere Teile ausblenden" },
  language: { en: "Deutsch", de: "English" },
  apartLocked: {
    en: "Taken apart, the machine cannot calculate. Put it back together (untick “Take it apart”) to use the crank and knobs.",
    de: "Auseinandergenommen kann die Maschine nicht rechnen. Zum Kurbeln und Einstellen wieder zusammensetzen („Auseinandernehmen“ abwählen).",
  },
  focusHint: {
    en: "Available in lesson steps that highlight parts.",
    de: "Verfügbar in Lektionsschritten, die Teile hervorheben.",
  },
  blockedPin: {
    en: "The pin is on the stop. Take the pin out or move it to turn again.",
    de: "Der Stift liegt am Anschlag. Stift herausnehmen oder versetzen, um weiterzudrehen.",
  },
  blockedPinSub: {
    en: "With the pin in, the Magna Rota only turns forward. Take the pin out to subtract.",
    de: "Mit Stift dreht die Magna Rota nur vorwärts. Zum Subtrahieren den Stift herausnehmen.",
  },
  blockedStore: {
    en: "A carry is still waiting at the {place} wheel, where no carry lever reaches. Shift the carriage left first.",
    de: "Am Rad der {place} wartet noch ein Übertrag, den kein Hebel erreicht. Zuerst den Schlitten nach links schieben.",
  },
  reconstruction: {
    en: "A reconstruction: the mechanism and its angles follow the sources; many part sizes are estimates, and the digits are enlarged for reading.",
    de: "Eine Rekonstruktion: Mechanik und Winkel folgen den Quellen; viele Maße sind geschätzt, die Ziffern zum Lesen vergrößert.",
  },
  morePages: {
    en: "More pages: the mechanism step by step, and both readings of the carry (in English)",
    de: "Weitere Seiten: der Mechanismus Schritt für Schritt und beide Deutungen des Übertrags (auf Englisch)",
  },
});

/** @typedef {keyof typeof UI} UIKey */

/**
 * UI text with {name} placeholders filled in.
 * @param {UIKey} key
 * @param {Lang} lang
 * @param {Record<string, string | number>} [vars]
 * @returns {string}
 */
export function ui(key, lang, vars = {}) {
  return UI[key][lang].replace(/\{(\w+)\}/g, /** @param {string} k */ (_, k) => String(vars[k] ?? `{${k}}`));
}

/** @type {Text[]} */
const PLACES = [
  { en: "units", de: "Einer" },
  { en: "tens", de: "Zehner" },
  { en: "hundreds", de: "Hunderter" },
  { en: "thousands", de: "Tausender" },
];

/**
 * Name of decimal place k (units, tens, …; 10^k beyond the thousands).
 * @param {number} k
 * @param {Lang} lang
 * @returns {string}
 */
export function placeName(k, lang) {
  return PLACES[k]?.[lang] ?? `10^${k}`;
}
