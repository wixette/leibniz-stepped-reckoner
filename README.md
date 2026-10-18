# Leibniz Stepped Reckoner

[![Tests](https://github.com/wixette/leibniz-stepped-reckoner/actions/workflows/test.yml/badge.svg)](https://github.com/wixette/leibniz-stepped-reckoner/actions/workflows/test.yml)

The first calculating machine for all four operations of arithmetic, in your browser. Gottfried Wilhelm Leibniz's stepped reckoner (c. 1693–1716) introduced the **stepped drum**, used in calculators for 300 years. Set a number on its knobs, turn the crank, and watch it add, carry, multiply and divide, from the inside.

> **Under construction.** The simulator is being moved into this repository. This page will say how to try it online at <https://wixette.github.io/leibniz-stepped-reckoner/> once it is here.

## For developers

### Requirements

- **Node.js** 24 (22 or later works) and **pnpm** (the version is pinned in `package.json`; `corepack enable` installs it).
- **Git LFS**, for the 3D model and other binary assets: run `git lfs install` once, then clone as usual (or `git lfs pull` in an existing clone).

### Checks

```
pnpm check:refs   # no private references, local paths or broken links
pnpm test         # the tests
```

CI runs them on every push and pull request, together with the REUSE lint ([docs/licensing.md](docs/licensing.md)).

### Versions and releases

The version is kept in one place, `package.json`. Set it with `pnpm version <x.y.z>`, which does not commit or tag ([.npmrc](.npmrc)). A release is a pull request named for its version; it is tagged `vX.Y.Z` on GitHub, on the merge commit. Each push to `main` deploys the site to GitHub Pages ([.github/workflows/pages.yml](.github/workflows/pages.yml)).

### Documents

| Document | What it is |
|---|---|
| [docs/conventions.md](docs/conventions.md) | Units, axes, part names, export, developer pages, testing, references |
| [docs/ui-design.md](docs/ui-design.md) | The principles the page is laid out by, and its decisions |
| [docs/licensing.md](docs/licensing.md) | Licences and attribution |

## Licence

- **Code:** [Apache-2.0](LICENSE)
- **Original content** (3D models, textures, research notes, lessons, docs): [CC BY-SA 4.0](LICENSES/CC-BY-SA-4.0.txt)
- **Third-party material** keeps its own licence, declared per path in [REUSE.toml](REUSE.toml)
