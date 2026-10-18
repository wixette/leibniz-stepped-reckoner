# Leibniz Stepped Reckoner

[![Tests](https://github.com/wixette/leibniz-stepped-reckoner/actions/workflows/test.yml/badge.svg)](https://github.com/wixette/leibniz-stepped-reckoner/actions/workflows/test.yml)

The first calculating machine for all four operations of arithmetic, in your browser. Gottfried Wilhelm Leibniz's stepped reckoner (c. 1693–1716) introduced the **stepped drum**, used in calculators for 300 years. Set a number on its knobs, turn the crank, and watch it add, carry, multiply and divide, from the inside.

**[Try it online](https://wixette.github.io/leibniz-stepped-reckoner/)**: four guided lessons in English and German (the stepped drum, 9999 + 1, 1709 × 365, 623785 ÷ 1709), free play and a take-apart view. Nothing to install; it runs in any current browser.

The simulator is **kinematically faithful**: every part that matters for the calculation moves as in the surviving machine (8 input, 16 result and 1 counter digits), with dimensions from the published sources and photos of the original and of the TU Dresden replica. Where the sources disagree or are silent, the choice is recorded with its reason ([design/decisions/](design/decisions/), [params/machine.json](params/machine.json)).

## For developers

### Requirements

- **Node.js** 24 (22 or later works) and **pnpm** (the version is pinned in `package.json`; `corepack enable` installs it).
- **Git LFS**, for the 3D model and other binary assets: run `git lfs install` once, then clone as usual (or `git lfs pull` in an existing clone).

### Run it locally

```
pnpm install
pnpm --dir web dev     # http://localhost:5173/
```

The main page links to the lessons and to the developer pages (`web/experiments/`, one per milestone). `pnpm --dir web build` writes the static site to `web/dist/`, which works from any path on any static web server.

### Checks

```
pnpm check:refs   # no private references, local paths or broken links
pnpm test         # the tests
```

```
pnpm --dir web typecheck
pnpm --dir web test   # simulator logic, kinematics, and acceptance tests on the .glb
```

CI runs them on every push and pull request, together with the REUSE lint ([docs/licensing.md](docs/licensing.md)).

### Versions and releases

The version is kept in one place, `package.json`. Set it with `pnpm version <x.y.z>`, which does not commit or tag ([.npmrc](.npmrc)). A release is a pull request named for its version; it is tagged `vX.Y.Z` on GitHub, on the merge commit. Each push to `main` deploys the site to GitHub Pages ([.github/workflows/pages.yml](.github/workflows/pages.yml)).

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
| `web/` | The simulator: Vite + three.js + TypeScript (`src/sim/`, `src/scene/`, `src/teach/`, `experiments/`) |

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
