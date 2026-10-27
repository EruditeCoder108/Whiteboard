# Third-party notices

Floating Whiteboard's own code is GPL-3.0-only. Dependencies retain the licences below; this file does not relicense them. Versions are from the checked-in lockfile and installed Electron runtime when these notices were prepared (2026-10-27).

| Component | Version | Licence | Source | Full notice |
|---|---|---|---|---|
| @preact/signals | 2.11.3 | MIT | [Upstream](https://github.com/preactjs/signals) | [Text](notices/preact__signals.txt) |
| @preact/signals-core | 1.14.4 | MIT | [Upstream](https://github.com/preactjs/signals) | [Text](notices/preact__signals-core.txt) |
| @types/dom-mediacapture-transform | 0.1.12 | MIT | [Upstream](https://github.com/DefinitelyTyped/DefinitelyTyped) | [Text](notices/types__dom-mediacapture-transform.txt) |
| @types/dom-webcodecs | 0.1.13 | MIT | [Upstream](https://github.com/DefinitelyTyped/DefinitelyTyped) | [Text](notices/types__dom-webcodecs.txt) |
| lucide-preact | 1.49.0 | ISC | [Upstream](https://github.com/lucide-icons/lucide) | [Text](notices/lucide-preact.txt) |
| mediabunny | 1.61.3 | MPL-2.0 | [Upstream](https://github.com/Vanilagy/mediabunny) | [Text](notices/mediabunny.txt) |
| perfect-freehand | 1.2.3 | MIT | [Upstream](https://github.com/steveruizok/perfect-freehand) | [Text](notices/perfect-freehand.txt) |
| preact | 10.29.8 | MIT | [Upstream](https://github.com/preactjs/preact) | [Text](notices/preact.txt) |
| Electron | 44.5.1 | MIT | [Upstream](https://github.com/electron/electron) | [Text](notices/electron.txt) |

## Covered source and distribution

Mediabunny 1.61.3 is MPL-2.0, not MIT. Its published package includes its source and licence: [exact source-bearing package](https://registry.npmjs.org/mediabunny/-/mediabunny-1.61.3.tgz), [upstream repository](https://github.com/Vanilagy/mediabunny). The project uses the upstream dependency without local source modifications. Preserve MPL notices and source availability when redistributing it.

The pinned source-bearing packages for the other npm dependencies are reproducible through package-lock.json. For a GPL binary release, provide the corresponding source for that exact build, including changes and build instructions; do not point recipients at a different or incomplete revision. Include any required dependency source and notices with the source distribution.

Electron distributions also contain their own Electron and Chromium third-party licence material. Keep those supplied files intact. The packaging configuration includes this project's LICENSE, this notice index and the notices directory in resources. These additions apply to future builds; previously generated EXEs are not rewritten by a source-licence change.

## Documentation and artwork

The app mark was regenerated from the user's supplied logo reference with the built-in image-generation tool; build/make-icon.cjs exports its platform sizes. The chemistry cover illustration was also image-generated. See [provenance, prompts and scientific references](docs/assets/readme/GENERATION.md). Synthetic app screenshots and native renderer demos are part of this project. Official technology marks are identified separately in [media credits](docs/assets/readme/README.md); those marks remain their owners' trademarks.

No Excalidraw, tldraw, OpenBoard or other researched editor source was incorporated as part of the README/licensing work. Do not infer permission to copy from those projects from their presence in research notes.
