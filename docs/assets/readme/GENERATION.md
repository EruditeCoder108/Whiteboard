# Generated artwork: provenance and prompts

Prepared 2026-10-27 with the **built-in image_gen tool**, not a CLI/API-key workflow. The reference
was the logo supplied by the project owner. The owner's GitHub repo-card reference informed the
safe-area layout; its instructional text and GitHub wordmark were not copied into our artwork.

## Asset roles

| Asset | Role |
|---|---|
| [Transparent logo master](../brand/floating-whiteboard-logo.png) | Regenerated raster mark based on the supplied blue/white board reference. Exterior is alpha-transparent; board and white cards remain opaque. |
| [Chemistry illustration](chemistry-lab-illustration.png) | New generated transparent apparatus cutout, used only as editorial/marketing artwork. |
| [Cover](cover.png) and [template](cover.template.html) | Generated cutouts composed with editable HTML text, exported by Electron. |
| [Repo card and template](../social/README.md) | Same visual assets on a 1280 × 640 canvas with a separate 80 px safe-area guide. |
| [Gallery](gallery/) and [demo GIF](science-demo.gif) | Actual native application rendering, not image-generated. |

## Scientific scope of the cover

The visual depicts open-vessel acid/bicarbonate indicator chemistry: supported glass apparatus,
gravity-level liquids and bubbles inside the reaction solution. Separate sample tubes show
qualitative indicator colours; they do not represent a calibrated pH scale. The scene is an
illustration, not a lab procedure, measured apparatus drawing or guarantee of simulator fidelity.
Generated glass details can contain imperfections. It has been visually reviewed for basic
apparatus/reaction coherence, not certified by a subject expert.

The intended chemistry is acetic acid plus sodium bicarbonate, giving sodium acetate, water and
carbon dioxide. Sources used to check the concept:

- [ACS: A Gas-Producing Reaction](https://www.acs.org/middleschoolchemistry/lessonplans/chapter6/lesson2.html)
- [ACS: Red Cabbage Indicator](https://www.acs.org/education/activities/red-cabbage-indicator.html)

No external 3D stock model was used. The README does not imply that the app implements realistic
fluid dynamics, a 3D chemistry renderer or medical physiology. See the actual
[model boundaries](../../SCIENCE-SHOWCASE-QA.md).

## Exact prompt set

### Logo regeneration

Input: the owner's attached logo. Transparency enabled.

```text
Use case: background-extraction and logo-brand. Edit target: the single attached Floating Whiteboard logo. Regenerate a very faithful clean high-resolution app logo with ACTUAL transparent alpha outside the rounded-square white board tile. Preserve the exact visual identity and arrangement: white softly rounded board with faint blue-gray squared paper, a large frosted translucent blue outlined note at upper left with one vivid electric blue bar and two gray bars, small white card upper right with blue square and two gray lines, white lower-left card with blue circle and gray lines, solid blue card middle right with two white lines, pale blue card lower right, three blue dots at upper right and lower left, dark navy elbow connectors with the central blue circular node and right-pointing arrow, restrained soft blue shadows. Crisp, polished, legible as an app icon; original blue-white colors; orthographic frontal view. Keep all content inside the rounded tile; keep the board tile and internal white cards opaque, while the exterior black backdrop is fully removed to true transparency. Fill most of a square canvas with a modest even margin. No black rectangle, no white outer backdrop, no painted checkerboard, no extra text, no invented elements, no new branding. Retain the subtle original depth and frosted-glass look, not an unrelated new icon.
```

### Logo edge cleanup (final master)

Input: the first regenerated logo. Transparency enabled.

```text
Precise final-production cleanup of this transparent app logo. Preserve its blue-white frosted board, grid, cards, connector positions, colors and contents exactly. Change only the outer silhouette quality: make the rounded white board a perfectly smooth, clean, antialiased rounded-square edge. Remove ALL isolated specks, dots, jagged white fragments, stray colored pixels, and mottled ragged pixels outside the board's rounded contour. The exterior must be uniformly 100% alpha-transparent everywhere with no fragments; no black background, no white canvas, no fake checkerboard. Keep the white board tile and all internal white cards opaque. Keep a small even transparent margin around the complete icon, no cropping. Clean precision app-icon finish, not a redesign; no new shapes or lettering.
```

### Chemistry illustration

New image, no reference image. Transparency enabled.

```text
Use case: scientific-educational illustration. Asset type: premium chemistry-laboratory hero illustration for an offline educational whiteboard README; a standalone transparent cutout that will be placed on a dark navy cover. Create a highly polished, detailed, scientifically coherent 3D scientific illustration, wide 4:3 composition, not a simple flat icon. Show a real acid–bicarbonate colour-indicator experiment: a robust metal retort stand on a stable base, a correctly attached visible bosshead and clamp supporting a small clear glass addition funnel upright; the funnel has a proper stopcock and narrow vertical outlet pointing DOWN into an OPEN straight-sided borosilicate beaker beneath it. A short thin continuous clear droplet stream exits the funnel stem and reaches the beaker's liquid surface. The central beaker contains a homogeneous lavender-pink cabbage-indicator mixture with a restrained plume of small CO2 bubbles originating ONLY inside the liquid and rising to the free surface. No bubbles below the beaker, outside the glass, in the stand, or in air. Unsealed vessel, no flame, no heater. Beside the apparatus put two upright, empty-necked Erlenmeyer reagent flasks containing colourless dilute acetic-acid solution and colourless aqueous sodium-bicarbonate solution. A small supporting trio of separate clear sample tubes in a real rack shows acid pink, neutral purple, and mildly basic blue-green cabbage-indicator samples; each tube has a uniform colour and flat gravity-level meniscus. These are separate samples, NEVER a rainbow-striped reaction in a single vessel. ALL flask necks, rims, glass walls and vessel bases are geometrically correct and continuous; all liquid surfaces are horizontal under gravity; no fused or impossible glassware, no sealed gas-generating vessel, no double walls randomly penetrating each other. The apparatus and rack rest on one small clean lab tray, subtly elevated through realistic feet and contact shadows. Isometric three-quarter view, crisp realistic clear glass with restrained optical highlights, blue-white laboratory palette with warm pink and violet indicator accents, precise restrained editorial product rendering, clean silhouette, beautiful small-scale detail, strong depth and material realism. Entire complete apparatus visible with margin; NOTHING cropped. No people, no hands, no words, no text, no numbers, no formula lettering, no random hazard symbols, no watermarks, no sparkles, no glowing magic, no decorative molecule icons. True transparent background outside the coherent equipment cluster, no painted checkerboard.
```

The HTML templates contain the final copy, composition and colours. `npm run branding` reproduces
the exported sizes and cards from the checked-in PNGs; it does not rerun image generation.
