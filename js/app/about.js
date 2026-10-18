// The About dialog (docs/ui-design.md, U8): the logo, the version, what the simulator is,
// credits and licences, and the links to the source and the developer pages.

import { t } from "../l10n/l10n.js";
import { el, icon } from "../ui/components.js";
import pkg from "../../package.json" with { type: "json" };

const V = new URL(import.meta.url).search;

/** Open the About dialog. */
export function showAbout() {
  const dialog = /** @type {HTMLDialogElement} */ (document.getElementById("aboutDialog"));
  const body = /** @type {HTMLElement} */ (document.getElementById("aboutBody"));
  const source = el("a", { href: "https://github.com/wixette/leibniz-stepped-reckoner", target: "_blank", rel: "noopener" }, [t("about.source")]);
  const dev = el("a", { href: "dev/" }, [t("ref.dev.title")]);
  body.replaceChildren(
    el("img", { class: "dialog-logo", src: `images/logo.svg${V}`, alt: "", width: "220", height: "124" }),
    el("h2", { id: "aboutTitle", text: t("app.name") }),
    el("p", { text: t("about.version", { v: pkg.version }) }),
    el("p", { text: t("about.lead") }),
    el("p", { text: t("about.reconstruction") }),
    el("h3", { text: t("about.credits") }),
    el("p", { text: t("about.credits.text") }),
    el("h3", { text: t("about.licences") }),
    el(
      "ul",
      {},
      ["about.licence.code", "about.licence.content", "about.licence.three", "about.licence.font", "about.licence.icons", "about.licence.pictures"].map((k) => el("li", { text: t(k) })),
    ),
    el("p", { style: "margin-top:14px;display:flex;gap:16px;align-items:center" }, [icon("code"), source, dev]),
  );
  const close = /** @type {HTMLButtonElement} */ (document.getElementById("aboutClose"));
  close.onclick = () => dialog.close();
  dialog.showModal();
}
