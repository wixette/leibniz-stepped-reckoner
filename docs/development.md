# Development

How to run, check, change and release the simulator. The rules the code, the model and the tests follow are in [conventions.md](conventions.md), the page's design principles in [ui-design.md](ui-design.md), and the licences in [licensing.md](licensing.md).

## Running it

There is nothing to build: the pages are plain HTML, CSS and JavaScript modules, and three.js is vendored. Serve the repository's root over HTTP and open it:

```
python3 -m http.server 8000
```

- <http://localhost:8000/> is the simulator (`index.html`).
- <http://localhost:8000/dev/> lists the developer pages, one per milestone of the model (`dev/01-digit-slice/`, `dev/02-carry-slice/`, `dev/03-full-machine/`). They are not linked from the simulator.

Pages cannot be opened from `file://`, because browsers do not load modules from there.

**Page options.** The main page reads these from its address:

| Option | What it does |
|---|---|
| `?lang=de` | Start in that language (`en`, `es`, `fr`, `de`, `it`, `pt-BR`, `zh`, `zh-TW`, `ja`, `ko`) |
| `?quality=lite` or `?quality=high` | Force the rendering quality (by default it drops to lite by itself on a slow device) |
| `?selftest` | Run the page's acceptance checks on the loaded model and show the results (every page, `dev/` included) |
| `?perf` | Show the frame rate, draw calls and triangles |
| `?debug` | Expose the page's state to the console as `app` |

## Requirements

- **Git LFS**, for the 3D models: run `git lfs install` once, then clone as usual (or `git lfs pull` in an existing clone). Without it the `.glb` files are small pointer files, and the page and the acceptance tests fail with "not a glTF file".
- For the checks only: **Node.js** 24 (22 or later works) and **pnpm** (the version is pinned in `package.json`; `corepack enable` installs it). `pnpm install` fetches three.js for the tests and TypeScript's checker; the pages do not use them.
- For rebuilding the model only: **Blender** (the scripts call it at `/Applications/Blender.app`; see [conventions.md](conventions.md), *Code*).
- For the screenshots and videos only: **Google Chrome**, and for the videos **ffmpeg** (with libx264).

## Checks

```
pnpm install
pnpm check:refs   # no private references, local paths or broken links
pnpm typecheck    # the JSDoc types, checked strictly (tsconfig.json); nothing is compiled
pnpm test         # simulator logic, kinematics, acceptance tests on the .glb, vendor/ and the import maps
```

CI runs them on every push and pull request, together with the REUSE lint ([licensing.md](licensing.md)). How the code is typed, tested and vendored, and what the acceptance tests check: [conventions.md](conventions.md).

**Model changes** (`params/`, `blender/scripts/`) need Blender: `pnpm build:model` rebuilds the `.glb` files, and `pnpm check:model` runs the slow collision sweep, which must pass before a model change is committed. Commit the new `.glb` together with the params.

## Versions and releases

The version is kept in one place, `package.json`. Set it with `pnpm version <x.y.z>`, which also writes it into the pages' file names (see *Deploying behind a cache*) and does not commit or tag ([.npmrc](../.npmrc)). A release is a pull request named for its version; it is tagged `vX.Y.Z` on GitHub, on the merge commit, and its changes are listed in [CHANGELOG.md](../CHANGELOG.md). Each push to `main` deploys the site to GitHub Pages once its tests have passed ([.github/workflows/pages.yml](../.github/workflows/pages.yml)).

**Screenshots.** `pnpm shots` takes the release pictures ([tools/shots.mjs](../tools/shots.mjs)): the README's six (copied by hand into `images/readme/`), and a set for posts: the Taken apart view from several sides and distances, the drum and carry views from several sides, and the multiplication lesson step by step. It serves the repository itself and drives headless Chrome, at 1600 × 900; view shots are the stage alone, with the dock hidden. `--lang en,zh` takes them in each language given, into `~/Downloads/leibniz-v<version>-media/shots/<lang>/` (or `--out <folder>`), and `--only <text>` only those whose name contains it. Chrome is found at its usual place, or set `CHROME` to its path.

**Videos.** `pnpm video` makes the release clips ([tools/video.mjs](../tools/video.mjs)), 1920 × 1080 MP4 with the machine's sound: the machine taken apart and looked round, the stepped drum and the carry in slow motion, an addition and a multiplication from start to finish. They are made frame by frame, not recorded in real time: the tool replaces the page's clock and advances it one frame at a time, so the video is smooth however slow the rendering, and nothing on the screen or the sound card is recorded. The soundtrack is mixed afterwards from `audio/`, from a log of every sound the app played. It takes the same `--lang`, `--out` (default `~/Downloads/leibniz-v<version>-media/videos/<lang>/`) and `--only`, and `--fps` (30). It needs ffmpeg, and takes a few minutes for each language.

Release media are never kept in the repository: both tools write outside it by default, and only the README's six pictures are committed.

## Deploying behind a cache

To deploy, copy the whole directory to a web server, with the Git LFS files checked out.

Every file a page names carries the version, `css/style.css?v=1.0.0`, and so does every module the scripts import, through the page's import map, and every model they load. A release asks for new names, so a cache can keep each file as long as it likes and still never give an old one to a new page. Only the pages themselves (`index.html` and the `index.html` files in `dev/`) must not be kept. On a server or a CDN that lets you set the headers:

| What | `Cache-Control` |
| --- | --- |
| The pages (`index.html`, `/`, `dev/…/`) | `no-cache`: kept, but checked with the server each time |
| Everything asked for with `?v=` | `public, max-age=31536000, immutable` |

A CDN must count the query string in its cache key (most do unless told not to). GitHub Pages sets no headers you can change and keeps everything for 10 minutes, so there a release reaches everyone within 10 minutes. The stamps are written by `pnpm version` (or `pnpm stamp`, [tools/stamp.mjs](../tools/stamp.mjs)); `pnpm test` fails while a page and `package.json` disagree.

## Documents

| Document | What it is |
|---|---|
| [research/REPORT.md](../research/REPORT.md) | Feasibility, confidence and the value check against existing resources |
| [design/modelling-and-animation-plan.md](../design/modelling-and-animation-plan.md) | How the model is built and animated, with milestones M0–M4 and their acceptance tests |
| [design/m0-notes.md](../design/m0-notes.md) … [m3-notes.md](../design/m3-notes.md) | What each milestone built and found, as recorded at the time |
| [design/decisions/0001-carry-interpretation.md](../design/decisions/0001-carry-interpretation.md) | Which carry behaviour the simulator shows, and why |
| [params/machine.json](../params/machine.json) | Every dimension and angle, with its source and confidence |
| [conventions.md](conventions.md) | Units, axes, part names, export, developer pages, testing, references |
| [ui-design.md](ui-design.md) | The principles the page is laid out by, and its decisions (U1, U2, …) |
| [licensing.md](licensing.md) | Licences and attribution |

## Folder layout

| Folder | Contents |
|---|---|
| `research/` | Sources, notes, data and reference images |
| `design/` | Plan, milestone notes and decision records |
| `params/` | Single source of truth for geometry and timing |
| `blender/scripts/` | Headless Blender scripts that build the model from `params/` and check it |
| `assets/` | Generated `.glb` models (Git LFS) |
| `index.html`, `css/`, `js/` | The simulator's main page and its code: `js/app/` (the page: stage, machine strip, dock, course player), `js/ui/` (components), `js/l10n/` (one file per language), `js/sim/` (the machine), `js/scene/` (three.js), `js/teach/` (tutorial, lessons, part names), `js/accept/` (acceptance checks), `js/tools/` (scenarios for the pose exports) |
| `audio/` | The machine's sounds |
| `images/` | The logo, the icons (`pnpm icons`), the tutorial's pictures and the README's screenshots |
| `dev/` | Developer pages, one per milestone |
| `vendor/` | three.js, three-mesh-bvh, the Roboto Flex font and the Material Symbols icons, copied from npm (`pnpm vendor`) |
| `tests/` | `node --test` tests |
| `tools/` | Reference check, vendoring, version stamps, icons, screenshots, videos and pose export scripts |
