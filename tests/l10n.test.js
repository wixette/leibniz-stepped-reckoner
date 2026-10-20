// Translations (docs/ui-design.md, U7): every locale has every English key, keeps every
// {placeholder}, and has no key English lacks; the language is chosen sensibly.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { MESSAGES } from "../js/l10n/all.js";
import { bestLocale, LOCALES, t, tn } from "../js/l10n/l10n.js";

const en = MESSAGES.en;
/** @param {string} s */
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("every locale has every message", () => {
  for (const loc of LOCALES) {
    it(loc, () => {
      const m = MESSAGES[loc];
      assert.ok(m, `no messages for ${loc}`);
      const missing = Object.keys(en).filter((k) => !m[k]?.trim());
      const extra = Object.keys(m).filter((k) => !(k in en));
      assert.deepEqual(missing, [], `${loc} lacks ${missing.length} messages`);
      assert.deepEqual(extra, [], `${loc} has messages English does not`);
      const wrong = Object.keys(en).filter((k) => {
        const want = placeholders(en[k]);
        const got = placeholders(m[k]);
        // a plural form always receives {n}: it may use it, or write the number out ("once")
        if (/\.(one|other)$/.test(k)) return want.filter((p) => p !== "n").join() !== got.filter((p) => p !== "n").join();
        return want.join() !== got.join();
      });
      assert.deepEqual(wrong, [], `${loc}: placeholders differ from English`);
    });
  }
});

describe("texts named by a key built at run time", () => {
  it("every reference has its title and description", () => {
    // read from the source: the module also wires up the page, so Node cannot import it
    const src = readFileSync(new URL("../js/app/references.js", import.meta.url), "utf8");
    const ids = [...src.matchAll(/\{ id: "(\w+)"/g)].map((m) => m[1]);
    assert.ok(ids.length > 10, "references not found");
    const missing = ids.flatMap((id) => [`ref.${id}.title`, `ref.${id}.desc`]).filter((k) => !en[k]);
    assert.deepEqual(missing, [], "references without their texts");
  });
});

describe("choosing and using a locale", () => {
  it("matches the reader's languages to the nearest locale", () => {
    assert.equal(bestLocale(["de-AT", "en"]), "de");
    assert.equal(bestLocale(["pt-PT"]), "pt-BR");
    assert.equal(bestLocale(["zh-Hant-HK"]), "zh-TW");
    assert.equal(bestLocale(["zh-CN"]), "zh");
    assert.equal(bestLocale(["nl", "fr-CA"]), "fr");
    assert.equal(bestLocale(["nl"]), "en");
  });

  it("fills placeholders and chooses plural forms", () => {
    assert.equal(t("status.added", { n: 5 }, "en"), "Added 5.");
    assert.equal(tn("lessons.steps", 1, {}, "en"), "1 step");
    assert.equal(tn("lessons.steps", 9, {}, "en"), "9 steps");
    assert.equal(t("no.such.key"), "no.such.key");
  });
});
