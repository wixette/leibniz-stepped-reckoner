// The References tab (docs/ui-design.md, U3): where to see the machine and read more, in
// groups, each link with one line on why it is worth a click. Public URLs only; the sources
// behind the model are in research/sources/bibliography.md.

import { t } from "../l10n/l10n.js";
import { el, icon } from "../ui/components.js";

/**
 * @typedef {object} Ref
 * @property {string} id message keys ref.<id>.title and ref.<id>.desc
 * @property {string} url
 * @property {boolean} [german] the page is in German
 */

/** @type {{ group: string; items: Ref[] }[]} */
export const REFERENCES = [
  {
    group: "refs.g.original",
    items: [
      { id: "gwlb", url: "https://www.gwlb.de/leibniz/leibniz-nachlass-und-weitere-leibniz-materialien", german: true },
      { id: "hannover", url: "https://www.hannover.de/Wirtschaft-Wissenschaft/Wissenschaft/Initiative-Wissenschaft-Hannover/Leibniz-in-Hannover/Leibniz%27-Nachlass/Leibniz-Rechenmaschine", german: true },
      { id: "notes", url: "https://digitale-sammlungen.gwlb.de/resolve?docid=00066559" },
      { id: "wiki", url: "https://en.wikipedia.org/wiki/Stepped_reckoner" },
      { id: "wikiWheel", url: "https://en.wikipedia.org/wiki/Leibniz_wheel" },
    ],
  },
  {
    group: "refs.g.museums",
    items: [
      { id: "arithmeum", url: "https://www.arithmeum.uni-bonn.de/en/collection/exhibit-of-the-month/archive/01-the-first-mechanical-calculator-for-all-four-arithmetic-operations-by-gottfried-wilhelm-leibniz.html" },
      { id: "tud", url: "https://tu-dresden.de/mn/math/die-fakultaet/sammlungen/historische-rechenmaschinen/exponate/leibniz-rechenmaschine", german: true },
      { id: "hnf", url: "https://blog.hnf.de/herr-leibniz-und-seine-rechenmaschine/", german: true },
      { id: "smg", url: "https://collection.sciencemuseumgroup.org.uk/objects/co60618" },
      { id: "dm", url: "https://digital.deutsches-museum.de/de/digital-catalogue/collection-object/56956/", german: true },
    ],
  },
  {
    group: "refs.g.reading",
    items: [
      { id: "jordan", url: "https://archive.org/details/zeitschriftfrve10vermgoog", german: true },
      { id: "morar", url: "https://www.cambridge.org/core/journals/british-journal-for-the-history-of-science/article/abs/reinventing-machines-the-transmission-history-of-the-leibniz-calculator/0EFE30C7B3975C7ADF10627D20CC3F07" },
      { id: "ludwig", url: "https://tu-dresden.de/mn/math/ressourcen/dateien/die-fakultaet/historie-der-fakultaet-mathematik/Ludwig_Vortrag_zur_Staffelwalzenmaschine_2006.pdf", german: true },
      { id: "fothe", url: "https://mi-didaktik.uni-jena.de/fmididaktikmedia/144/fothe-2016-informatik-hat-geschichte.pdf", german: true },
      { id: "poisard", url: "https://merga.net.au/wp-content/uploads/DOCS/common/Uploaded%20files/Annual%20Conference%20Proceedings/2006%20Annual%20CP/RP472006%20Poisard.pdf" },
    ],
  },
  {
    group: "refs.g.project",
    items: [
      { id: "source", url: "https://github.com/wixette/leibniz-stepped-reckoner" },
      { id: "report", url: "https://github.com/wixette/leibniz-stepped-reckoner/blob/main/research/REPORT.md" },
      { id: "plan", url: "https://github.com/wixette/leibniz-stepped-reckoner/blob/main/design/modelling-and-animation-plan.md" },
      { id: "dev", url: "dev/" },
    ],
  },
];

/** @returns {HTMLElement} */
export function referencesPanel() {
  return el("div", {}, [
    el("h2", { text: t("tab.refs") }),
    el("p", { class: "lead", text: t("refs.lead") }),
    ...REFERENCES.flatMap(({ group, items }) => [
      el("h3", { text: t(group) }),
      el(
        "ul",
        { class: "ref-list" },
        items.map((r) => {
          const external = /^https?:/.test(r.url);
          return el("li", {}, [
            el("a", { href: r.url, target: external ? "_blank" : undefined, rel: external ? "noopener" : undefined }, [
              el("b", { text: t(`ref.${r.id}.title`) }),
              el("span", {}, [t(`ref.${r.id}.desc`), r.german ? el("em", { text: ` (${t("refs.inGerman")})` }) : null]),
              icon(external ? "open_in_new" : "arrow_forward"),
            ]),
          ]);
        }),
      ),
    ]),
  ]);
}
