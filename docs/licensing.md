# Licensing and attribution

## Our own work

| What | Licence |
|---|---|
| Code: JavaScript, Python, build configuration | **Apache-2.0** |
| Content: 3D models, textures, animations, research notes, lesson material, docs | **CC BY-SA 4.0** |

The repository follows the [REUSE](https://reuse.software) specification. [`REUSE.toml`](../REUSE.toml) sets these defaults and lists every third-party exception, and the licence texts are in [`LICENSES/`](../LICENSES). CI runs `reuse lint` on every push and pull request.

## Third-party material

- **Photos from Wikimedia Commons** (mostly CC BY-SA 4.0). A per-file catalogue (licence, author, source URL) is kept next to the images. Anything derived directly from them (a texture, a decal, an image) credits the photographer and stays CC BY-SA. Using a photo only as a *visual reference* for modelling creates no obligation, but the sources are credited anyway.
- **Vendored libraries** in `vendor/`: three.js and three-mesh-bvh (MIT), the Roboto Flex font (SIL Open Font License 1.1) and the Material Symbols icons (Apache-2.0), copied unchanged from their npm packages together with their own `LICENSE` files. The icons are the one exception: `vendor/material-symbols/icons.js` gathers the SVGs the page uses into one module, as they are.
- **The tutorial's pictures** (`images/tutorial/`) are resized copies of Commons files from `research/images/commons/`, under the same licences, credited under each picture on the page and annotated per file in `REUSE.toml`.
- **The machine's sounds** (`audio/`) are adapted from Pixabay sound effects under the Pixabay Content License (`LicenseRef-Pixabay`): free to use and modify, no attribution required (given anyway, in About), but not to be redistributed on their own as a sound pack. The licence file quotes the terms and links the binding ones.
- **Public-domain scans** (publications before 1900) can be used freely, and are still cited.
- **Copyrighted drawings and figures** (for example in modern papers and books, or drawings obtained from archives and museums) are **not** copied, traced or redistributed without written permission. **Facts and dimensions taken from them may be used**, with a citation: every value in `params/` carries a `source`.
- **Scans obtained on request from an archive or museum:** check the licence stated on delivery before committing anything, and keep any written permission with the research notes.
- **The Deutsches Museum's NL 183 scans** (Lehmann's papers; delivered 2026-10-29) are working copies for personal use. No image from them may be published, but information taken from them may be, cited as "Deutsches Museum München, NL 183/465" (or the actual file number). So:
  - The PDFs, page images, crops and full transcripts are kept **outside the repository**, never committed, never attached to an issue or pull request, never shown on the page.
  - The repository holds **facts** taken from them: dimensions, tooth counts, angles and short descriptions in our own words ([`research/sources/notes-nl183.md`](../research/sources/notes-nl183.md), [`research/data/nl183_dimensions.csv`](../research/data/nl183_dimensions.csv), and `params/` values whose `src` names the file and page). Quotations stay short.
  - **No tracings or re-drawings of a sheet.** A diagram or model built from our own parameters is fine, even when those parameters came from the drawings. A figure that reproduces a sheet's layout, view or linework is not.

Each third-party path gets its own annotation in `REUSE.toml`, and its licence text goes in `LICENSES/`.

## Credits

The README's **Credits** section lists the research sources the model relies on and the photographers whose images were used.
