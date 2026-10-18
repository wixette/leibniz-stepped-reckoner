# Licensing and attribution

## Our own work

| What | Licence |
|---|---|
| Code: JavaScript, Python, build configuration | **Apache-2.0** |
| Content: 3D models, textures, animations, research notes, lesson material, docs | **CC BY-SA 4.0** |

The repository follows the [REUSE](https://reuse.software) specification. [`REUSE.toml`](../REUSE.toml) sets these defaults and lists every third-party exception, and the licence texts are in [`LICENSES/`](../LICENSES). CI runs `reuse lint` on every push and pull request.

## Third-party material

- **Photos from Wikimedia Commons** (mostly CC BY-SA 4.0). A per-file catalogue (licence, author, source URL) is kept next to the images. Anything derived directly from them (a texture, a decal, an image) credits the photographer and stays CC BY-SA. Using a photo only as a *visual reference* for modelling creates no obligation, but the sources are credited anyway.
- **Vendored libraries** in `vendor/`: three.js and three-mesh-bvh (MIT), the Roboto Flex font (SIL Open Font License 1.1) and the Material Symbols icons (Apache-2.0), copied unchanged from their npm packages together with their own `LICENSE` files.
- **The tutorial's pictures** (`images/tutorial/`) are resized copies of Commons files from `research/images/commons/`, under the same licences, credited under each picture on the page and annotated per file in `REUSE.toml`.
- **Public-domain scans** (publications before 1900) can be used freely, and are still cited.
- **Copyrighted drawings and figures** (for example in modern papers and books, or drawings obtained from archives and museums) are **not** copied, traced or redistributed without written permission. **Facts and dimensions taken from them may be used**, with a citation: every value in `params/` carries a `source`.
- **Scans obtained on request from an archive or museum:** check the licence stated on delivery before committing anything, and keep any written permission with the research notes.

Each third-party path gets its own annotation in `REUSE.toml`, and its licence text goes in `LICENSES/`.

## Credits

The README's **Credits** section lists the research sources the model relies on and the photographers whose images were used.
