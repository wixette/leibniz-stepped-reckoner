// The About dialog (docs/ui-design.md, U8): a title band with its close button, then the logo,
// the version, one line on what the simulator is, the licences and the link to the source, and
// two buttons: References (where the credits and the sources are) and Close. Kept short, as in
// the 8800 simulator: the credits live in the References tab, not here.

import { t } from "../l10n/l10n.js";
import { el, icon } from "../ui/components.js";
import pkg from "../../package.json" with { type: "json" };

const V = new URL(import.meta.url).search;

/**
 * Open the About dialog.
 * @param {() => void} onReferences open the References tab at its credits (the dialog closes first)
 */
export function showAbout(onReferences) {
  const dialog = /** @type {HTMLDialogElement} */ (document.getElementById("aboutDialog"));
  const body = /** @type {HTMLElement} */ (document.getElementById("aboutBody"));
  const source = el("a", { href: "https://github.com/wixette/leibniz-stepped-reckoner", target: "_blank", rel: "noopener" }, [t("about.source")]);
  const refs = el("button", { class: "btn tonal", type: "button" }, [t("tab.refs")]);
  refs.addEventListener("click", () => {
    dialog.close();
    onReferences();
  });
  const ok = el("button", { class: "btn filled", type: "button" }, [t("about.close")]);
  ok.addEventListener("click", () => dialog.close());
  body.replaceChildren(
    el("img", { class: "dialog-logo", src: `images/logo-wide.svg${V}`, alt: "", width: "200", height: "106", draggable: "false" }),
    el("p", { class: "dialog-name", text: t("app.name") }),
    el("p", { text: t("about.version", { v: pkg.version }) }),
    el("p", { text: t("about.lead") }),
    el("p", { style: "margin-top:4px;display:flex;gap:10px;align-items:center" }, [icon("code"), source]),
    el("h3", { text: t("about.licences") }),
    el(
      "ul",
      {},
      ["about.licence.code", "about.licence.content", "about.licence.three", "about.licence.font", "about.licence.icons", "about.licence.pictures", "about.licence.sounds"].map((k) => el("li", { text: t(k) })),
    ),
    el("div", { class: "dialog-actions" }, [refs, ok]),
  );
  const close = /** @type {HTMLButtonElement} */ (document.getElementById("aboutClose"));
  close.onclick = () => dialog.close();
  // A press and release both on the dimmed backdrop also close it (the padding is on the inner
  // parts, so only the backdrop is the <dialog> itself); a text selection dragged out does not.
  // (A block body: an on… handler that returns false cancels the press, and with it any text
  // selection started in the dialog.)
  let pressedOut = false;
  dialog.onpointerdown = (e) => {
    pressedOut = e.target === dialog;
  };
  dialog.onclick = (e) => {
    if (pressedOut && e.target === dialog) dialog.close();
    pressedOut = false;
  };
  dialog.showModal();
}
