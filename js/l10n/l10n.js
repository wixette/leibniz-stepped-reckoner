// Translations (docs/ui-design.md, U7): ten locales, one module each (js/l10n/<locale>.js),
// keyed alike. English is the reference and the fallback. Pure logic: no DOM, so the
// page, the tests and the lessons' checks share it.
//
// A message may hold {name} placeholders, filled from the params of t(). A message whose
// form depends on a number has variants "<key>.one", "<key>.other" (and others where a
// language needs them: "few", "many", "two", "zero"), chosen by tn() with Intl.PluralRules.

/** The locales, in the order the language menu lists them. */
export const LOCALES = /** @type {const} */ (["en", "es", "fr", "de", "it", "pt-BR", "zh", "zh-TW", "ja", "ko"]);
/** @typedef {(typeof LOCALES)[number]} Locale */
/** @typedef {Record<string, string>} Messages */

/** What each locale calls itself, for the language menu. */
export const LOCALE_NAMES = /** @type {Record<Locale, string>} */ ({
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  "pt-BR": "Português (Brasil)",
  zh: "简体中文",
  "zh-TW": "繁體中文",
  ja: "日本語",
  ko: "한국어",
});

/** What the language button shows: short, beside an icon that already says "language". */
export const LOCALE_SHORT = /** @type {Record<Locale, string>} */ ({
  en: "EN",
  es: "ES",
  fr: "FR",
  de: "DE",
  it: "IT",
  "pt-BR": "PT",
  zh: "简",
  "zh-TW": "繁",
  ja: "日",
  ko: "한",
});

/** @type {Partial<Record<Locale, Messages>>} */
const tables = {};
/** @type {Locale} */
let current = "en";

/**
 * @param {string} x
 * @returns {x is Locale}
 */
export const isLocale = (x) => /** @type {readonly string[]} */ (LOCALES).includes(x);

/**
 * Make a locale's messages available (the page loads them with load(); tests register all).
 * @param {Locale} locale
 * @param {Messages} messages
 */
export function register(locale, messages) {
  tables[locale] = messages;
}

/**
 * Load a locale's module (and English, the fallback) in the browser.
 * @param {Locale} locale
 * @returns {Promise<void>}
 */
export async function load(locale) {
  for (const l of /** @type {Locale[]} */ (["en", locale])) {
    if (!tables[l]) tables[l] = (await import(`./${l}.js`)).default;
  }
}

/** @param {Locale} locale */
export function setLocale(locale) {
  current = locale;
}

/** @returns {Locale} */
export const locale = () => current;

/**
 * The best supported locale for a list of language tags (the reader's choices, in order),
 * or English.
 * @param {readonly string[]} tags
 * @returns {Locale}
 */
export function bestLocale(tags) {
  for (const raw of tags) {
    const tag = raw.trim();
    if (!tag) continue;
    const lower = tag.toLowerCase();
    // Chinese: Traditional for Taiwan, Hong Kong and Macao, and for the Hant script.
    if (lower.startsWith("zh")) return /hant|-tw|-hk|-mo/.test(lower) ? "zh-TW" : "zh";
    if (lower.startsWith("pt")) return "pt-BR";
    const exact = LOCALES.find((l) => l.toLowerCase() === lower);
    if (exact) return exact;
    const base = LOCALES.find((l) => l.toLowerCase() === lower.split("-")[0]);
    if (base) return base;
  }
  return "en";
}

/**
 * A message in the current locale (English if it has none), with its placeholders filled.
 * A key no locale has comes back as itself, so a missing text shows rather than breaks.
 * @param {string} key
 * @param {Record<string, string | number>} [params]
 * @param {Locale} [loc]
 * @returns {string}
 */
export function t(key, params = {}, loc = current) {
  const msg = tables[loc]?.[key] ?? tables.en?.[key] ?? key;
  return msg.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
}

/**
 * A message whose form depends on a number n (also available as the {n} placeholder).
 * @param {string} key
 * @param {number} n
 * @param {Record<string, string | number>} [params]
 * @param {Locale} [loc]
 * @returns {string}
 */
export function tn(key, n, params = {}, loc = current) {
  const rule = new Intl.PluralRules(loc).select(n);
  const table = tables[loc] ?? {};
  const k = `${key}.${rule}` in table || `${key}.${rule}` in (tables.en ?? {}) ? `${key}.${rule}` : `${key}.other`;
  return t(k, { n, ...params }, loc);
}

/**
 * Whether a key exists in English (the reference).
 * @param {string} key
 * @returns {boolean}
 */
export const has = (key) => key in (tables.en ?? {});
