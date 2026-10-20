// Every locale's messages at once, for the checks that need them all (tests, and the page's
// ?selftest, which imports this only then). The page itself loads one locale (l10n.load()).

import { register } from "./l10n.js";
/** @import { Locale, Messages } from "./l10n.js" */
import de from "./de.js";
import en from "./en.js";
import es from "./es.js";
import fr from "./fr.js";
import it from "./it.js";
import ja from "./ja.js";
import ko from "./ko.js";
import ptBR from "./pt-BR.js";
import zhTW from "./zh-TW.js";
import zh from "./zh.js";

/** @type {Record<Locale, Messages>} */
export const MESSAGES = { en, es, fr, de, it, "pt-BR": ptBR, zh, "zh-TW": zhTW, ja, ko };
for (const [l, m] of Object.entries(MESSAGES)) register(/** @type {Locale} */ (l), m);
