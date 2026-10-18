# Leibniz Stepped Reckoner

[![Tests](https://github.com/wixette/leibniz-stepped-reckoner/actions/workflows/test.yml/badge.svg)](https://github.com/wixette/leibniz-stepped-reckoner/actions/workflows/test.yml)

The first calculating machine for all four operations of arithmetic, in your browser. Gottfried Wilhelm Leibniz's stepped reckoner (c. 1693–1716) introduced the **stepped drum**, used in calculators for 300 years. Set a number on its knobs, turn the crank, and watch it add, carry, multiply and divide, from the inside.

**[Try it online](https://wixette.github.io/leibniz-stepped-reckoner/)**: calculate freely on the machine, take it apart, follow a five-minute tutorial, then six lessons from adding to dividing (the stepped drum, the carry, subtracting, the carriage, 1709 × 365, 623785 ÷ 1709). In ten languages: English, Español, Français, Deutsch, Italiano, Português (Brasil), 简体中文, 繁體中文, 日本語 and 한국어. Nothing to install; it runs in any current browser, on a laptop, a Chromebook or a phone.

The simulator is **kinematically faithful**: every part that matters for the calculation moves as in the surviving machine (8 input, 16 result and 1 counter digits), with dimensions from the published sources and photos of the original and of the TU Dresden replica. Where the sources disagree or are silent, the choice is recorded with its reason ([design/decisions/](design/decisions/), [params/machine.json](params/machine.json)).

## For developers

There is nothing to build: the pages are plain HTML, CSS and JavaScript modules, and three.js is vendored. Serve the directory over HTTP and open it:

```
python3 -m http.server 8000
```

Then open <http://localhost:8000/> for the lessons, or <http://localhost:8000/dev/> for the developer pages (one per milestone; add `?selftest` to run a page's acceptance checks). To deploy, copy the whole directory to a web server, with the Git LFS files checked out. Pages cannot be opened from `file://`, because browsers do not load modules from there.

### Deploying behind a cache

Every file a page names carries the version, `css/style.css?v=0.1.0`, and so does every module the scripts import, through the page's import map, and every model they load. A release asks for new names, so a cache can keep each file as long as it likes and still never give an old one to a new page. Only the pages themselves (`index.html` and the `index.html` files in `dev/`) must not be kept. On a server or a CDN that lets you set the headers:

| What | `Cache-Control` |
| --- | --- |
| The pages (`index.html`, `/`, `dev/…/`) | `no-cache`: kept, but checked with the server each time |
| Everything asked for with `?v=` | `public, max-age=31536000, immutable` |

A CDN must count the query string in its cache key (most do unless told not to). GitHub Pages sets no headers you can change and keeps everything for 10 minutes, so there a release reaches everyone within 10 minutes. The stamps are written by `pnpm version` (or `pnpm stamp`, [tools/stamp.mjs](tools/stamp.mjs)); `pnpm test` fails while a page and `package.json` disagree.

### Requirements

- **Git LFS**, for the 3D models and other binary assets: run `git lfs install` once, then clone as usual (or `git lfs pull` in an existing clone).
- For the checks only: **Node.js** 24 (22 or later works) and **pnpm** (the version is pinned in `package.json`; `corepack enable` installs it). `pnpm install` fetches three.js for the tests and TypeScript's checker; the pages do not use them.

### Checks

```
pnpm install
pnpm check:refs   # no private references, local paths or broken links
pnpm typecheck    # the JSDoc types, checked strictly (tsconfig.json); nothing is compiled
pnpm test         # simulator logic, kinematics, acceptance tests on the .glb, vendor/ and the import maps
```

CI runs them on every push and pull request, together with the REUSE lint ([docs/licensing.md](docs/licensing.md)). How the code is typed, tested and vendored: [docs/conventions.md](docs/conventions.md).

### Versions and releases

The version is kept in one place, `package.json`. Set it with `pnpm version <x.y.z>`, which also writes it into the pages' file names (see *Deploying behind a cache*) and does not commit or tag ([.npmrc](.npmrc)). A release is a pull request named for its version; it is tagged `vX.Y.Z` on GitHub, on the merge commit. Each push to `main` deploys the site to GitHub Pages ([.github/workflows/pages.yml](.github/workflows/pages.yml)).

### Documents

| Document | What it is |
|---|---|
| [research/REPORT.md](research/REPORT.md) | Feasibility, confidence and the value check against existing resources |
| [design/modelling-and-animation-plan.md](design/modelling-and-animation-plan.md) | How the model is built and animated, with milestones M0–M4 and their acceptance tests |
| [design/decisions/0001-carry-interpretation.md](design/decisions/0001-carry-interpretation.md) | Which carry behaviour the simulator shows, and why |
| [params/machine.json](params/machine.json) | Every dimension and angle, with its source and confidence |
| [docs/conventions.md](docs/conventions.md) | Units, axes, part names, export, developer pages, testing, references |
| [docs/ui-design.md](docs/ui-design.md) | The principles the page is laid out by, and its decisions |
| [docs/licensing.md](docs/licensing.md) | Licences and attribution |

### Folder layout

| Folder | Contents |
|---|---|
| `research/` | Sources, notes, data and reference images |
| `design/` | Plan, milestone notes and decision records |
| `params/` | Single source of truth for geometry and timing |
| `blender/scripts/` | Headless Blender scripts that build the model from `params/` and check it |
| `assets/` | Generated `.glb` models (Git LFS) |
| `index.html`, `css/`, `js/` | The simulator's main page and its code: `js/app/` (the page: stage, machine strip, dock, course player), `js/ui/` (components), `js/l10n/` (one file per language), `js/sim/` (the machine), `js/scene/` (three.js), `js/teach/` (tutorial, lessons, part names), `js/accept/` (acceptance checks) |
| `images/` | The logo, the icons (`pnpm icons`) and the tutorial's pictures |
| `dev/` | Developer pages, one per milestone |
| `vendor/` | three.js, three-mesh-bvh, the Roboto Flex font and the Material Symbols icons, copied from npm (`pnpm vendor`) |
| `tests/` | `node --test` tests |
| `tools/` | Reference check, vendoring, version stamps, icons and pose export scripts |

## Credits

The research and model rely in particular on:
- A. Burkhardt and W. Jordan, *Zeitschrift für Vermessungswesen* 26 (1897)
- M. Ludwig (TU Dresden, 2006), on N. J. Lehmann's reconstructions
- E. Stein and F. O. Kopp (Leibniz Universität Hannover)
- K. Badur and W. Rottstedt
- the Arithmeum Bonn
- the Gottfried Wilhelm Leibniz Bibliothek

Reference photographs of the TU Dresden replica come from Wikimedia Commons contributors Dr. Bernd Gross, Plenuska, Eremeev, Wuselig, Jeremy Wolf and SchiDD (CC BY-SA 4.0). The full list is in [research/images/ATTRIBUTION.md](research/images/ATTRIBUTION.md) and [research/sources/bibliography.md](research/sources/bibliography.md).

## Licence

- **Code:** [Apache-2.0](LICENSE)
- **Original content** (3D models, textures, research notes, lessons, docs): [CC BY-SA 4.0](LICENSES/CC-BY-SA-4.0.txt)
- **Third-party material** keeps its own licence, declared per path in [REUSE.toml](REUSE.toml)
