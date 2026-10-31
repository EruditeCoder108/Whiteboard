# Educational 3D models, scientific illustrations and animation tools

Consolidated research brief for Floating Whiteboard. Prepared **31 October 2026**.

## Purpose and status

This collects the direction discussed for richer physics, chemistry and biology lessons: reusable
equipment, anatomical models, molecules, illustrations, animation tools and offline integration.
No dedicated asset-research report was found in the repository; related decisions were scattered
across the science roadmap and showcase QA. This is a consolidated, refreshed brief, not a verbatim
archive of every earlier chat response. Sources below were checked where stated; candidate sources
still needing item-level review are explicitly separated.

The current app has native **2D Canvas2D** science scenes. Downloaded 3D anatomy, a Three.js runtime,
fluid simulation and an imported model library are **not implemented** by this document. No models
are bundled in this research file. Existing implementation context:

- [Science roadmap](SCIENCE-ROADMAP.md)
- [Collection expansion plan](SCIENCE-COLLECTION-PLAN.md)
- [Showcase implementation, references and limitations](SCIENCE-SHOWCASE-QA.md)

## Main conclusions

There are useful free and openly licensed resources, but no single verified collection provides
complete, accurate, classroom-ready equipment, anatomy, chemistry and animations in one package.
Combine specialist scientific data with a small, curated visual library and original interaction.

For this project, the strongest starting combination is:

1. **NIH BioArt Source** for reviewed 2D scientific illustration.
2. **Z-Anatomy** for labelled whole-body anatomical geometry and selected organs.
3. **NIH 3D** for individual biomedical models after checking each entry.
4. **PDB data + 3Dmol.js or Mol*** for molecular and structural-biology views.
5. **Blender and, where useful, FreeCAD** to prepare equipment and editable source assets.
6. **Three.js** for selective interactive 3D inside the existing Electron app.
7. **Poly Haven, ambientCG and Kenney** for suitable materials, lighting and friendly supporting props.

These are engineering recommendations, not claims that an asset or integration has already passed
our scientific, performance or redistribution review.

## Biology and anatomy sources

| Source | Useful content | Rights and selection boundary | Suggested use |
|---|---|---|---|
| [Z-Anatomy models](https://github.com/Z-Anatomy/Models-of-human-anatomy) | Extensive named anatomical structures and a Blender-oriented atlas | Project states CC BY-SA 4.0; retain the supplied credits, including BodyParts3D ancestry and applicable component notices. [Project README](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/master/Readme.md). | Start with one organ or system; isolate parts, simplify geometry and build labels/cutaways. |
| [NIH BioArt Source](https://bioart.niaid.nih.gov/) | Scientific and medical illustrations suitable for diagrams and overlays | Check each entry. The FAQ distinguishes public-domain entries and their citation expectations; do not assume every externally contributed item has identical terms. [FAQ](https://bioart.niaid.nih.gov/faqs). | Strong first choice for polished 2D explanatory assets. |
| [NIH 3D](https://3d.nih.gov/) | Biomedical, biomolecular and other scientific 3D files | Entry-specific licences; the official terms explicitly allow a mix of public-domain, Creative Commons and more restrictive entries. [Terms](https://3d.nih.gov/terms). | Selected organ, cell or molecule examples after geometry and licence inspection. |
| [RCSB Protein Data Bank](https://www.rcsb.org/) | Atomic coordinates for proteins, nucleic acids and complexes | PDB archive data are CC0; integrated external resources can have separate restrictions. Cite structure IDs and original research. [Policy](https://www.rcsb.org/pages/policies). | Molecular structure exploration using a specialised viewer. |

**Anatomical completeness needs careful wording.** A large body atlas is not automatically a complete
physiology simulator. Surface meshes may omit internal chambers, valve attachments, microscopic
structures or variation between individuals. A heart mesh does not supply contraction, pressure,
flow, electrical conduction or an animation rig. Those need separately reviewed models.

For a better heart lesson, first inspect whether the selected geometry actually contains the four
chambers, septa, great vessels and valves needed for the lesson. Then add named parts, selective
visibility, a cutaway, guided stages and explicitly illustrative motion. Keep diagram orientation
and anatomical left/right labels consistent. The existing QA notes record that a public-domain NIH
heart was used only as a temporary reference, not bundled as our native heart cutaway.

## Chemistry sources and apparatus

| Resource | What it supplies | What we still need |
|---|---|---|
| [3Dmol.js](https://github.com/3dmol/3Dmol.js) | BSD-licensed WebGL molecular viewer supporting molecular formats, surfaces, atom selections and labels | Locally bundled structure files, controls and lesson design; it does not simulate pouring or reactions. |
| [Mol*](https://github.com/molstar/molstar) | MIT-licensed molecular visualisation and analysis stack, particularly useful for large biological structures | A simplified teaching interface and measured performance budget. |
| [PubChem](https://pubchem.ncbi.nlm.nih.gov/) | Candidate source for small-molecule records and downloadable structure data | Verify the chosen record, contributing source and reuse policy. Its copyright page could not be retrieved during this refresh, so this report does not give blanket redistribution clearance. |
| [ChemTube3D](https://www.chemtube3d.com/) | Useful examples of molecular structures and chemistry teaching animations | Treat as a teaching/reference candidate, not a cleared asset pack. Some pages carry NC and/or ND restrictions; the [rotatable structures example](https://www.chemtube3d.com/asmen/) uses CC BY-NC-ND 4.0. Check the precise content. |

For **flasks, beakers, burettes, funnels, stands and tubing**, the practical route is a small original
equipment kit made in Blender or FreeCAD, supplemented by individually cleared models. This gives
consistent scale, correct necks/rims, separate moving parts and predictable liquid boundaries.
We have not verified a universal open lab-equipment pack that meets all those requirements.

Proposed kit: beaker, Erlenmeyer flask, measuring cylinder, test tube/rack, pipette/dropper, burette
with stopcock, addition funnel, retort stand/clamps and collection vessels. Give each relevant
piece an interior volume, fill limits, connection points and clear manipulation handles.

The earlier vinegar/bicarbonate/cabbage-indicator example remains a suitable demonstration, with
sources in the [showcase QA](SCIENCE-SHOWCASE-QA.md). Its visual requirements are concrete:

- Liquid remains inside each vessel, with a gravity-level free surface.
- A pouring stream starts at the real lip and lands at the receiving surface.
- Volume changes consistently between vessels; particles appear only where the model permits.
- Indicator colour follows a documented chemistry approximation, not unrelated colour cycling.
- Gas bubbles originate inside reacting liquid; they never spawn underneath the vessel.
- Timing and graph values come from saved, seekable state, so pause, scrub and reopen agree.

A downloaded vessel mesh or Blender fluid bake does not supply those rules. Precomputed fluid clips
can suit a fixed demonstration, but arbitrary user pouring needs additional runtime logic. A
beautiful rendered reaction should not be described as a general chemical or fluid solver.

## Physics and general educational assets

| Source/tool | Useful contribution | Selection notes |
|---|---|---|
| [Poly Haven](https://polyhaven.com/) | Models, materials and HDR lighting for coherent scenes | Assets are CC0. The website/API has separate terms; download approved assets during authoring rather than requiring the live service. [Licence](https://polyhaven.com/license). |
| [ambientCG](https://ambientcg.com/) | Materials and supporting environmental assets | CC0 asset terms. Useful for glass-adjacent scene materials, metal, wood and surfaces; not a science-equipment catalogue. [Licence](https://docs.ambientcg.com/license/). |
| [Kenney](https://kenney.nl/assets) | Friendly 2D/3D props and interface assets | Asset-page packs are CC0 according to the [official support page](https://kenney.nl/support). Inspect the actual pack; these are general game assets, not validated scientific instruments. |
| [FreeCAD](https://github.com/FreeCAD/FreeCAD) | Parametric modelling for dimensioned parts, mechanisms and apparatus | Open-source CAD authoring tool. Its software licence does not grant rights to third-party CAD files. [Project licensing information](https://www.freecad.org/contributing.php). |
| [PhET](https://phet.colorado.edu/) | Valuable interaction and teaching references across science | Current regular HTML simulation licensing is CC BY-NC 4.0; do not rely on older blanket CC-BY statements. Source repositories and assets need separate review. [Current licensing](https://phet.colorado.edu/en/licensing). |

Physics candidates for our own models include pendulums, springs, pulleys, levers, gears, circuit
components, magnets/coils and optical benches. Use procedural geometry for simple parts where it
is easier to keep dimensions and labels consistent. Attractive meshes should remain visual inputs
to a defined model: they do not establish force laws, collision accuracy or magnetic-field physics.

## Additional discovery sources — not cleared for bundling

- **Sketchfab:** search for downloadable science assets, then inspect each model's actual licence,
  creator, textures and attribution. A free download is not a platform-wide redistribution grant.
- **GrabCAD:** potentially useful engineering geometry; its [model-use guidance](https://help.grabcad.com/article/246-how-can-models-be-used-and-shared)
  distinguishes permitted uses. Do not treat the community library as an unrestricted open-source pack.
- **Smithsonian 3D/Open Access:** promising for specimens and historical instruments. The attempted
  policy links did not resolve during this refresh; verify the selected object's CC0 designation
  and source downloads before adoption. Entry point: [Smithsonian 3D](https://3d.si.edu/).
- **Wikimedia Commons, OpenGameArt, BlenderKit and other marketplaces:** possible supplementary
  sources, but each asset and its dependencies require review. No catalogue-wide clearance is claimed.
- **Commercial anatomy platforms and BioRender-style illustration services:** free viewing or a
  free account should not be interpreted as permission to extract and redistribute their libraries.

## Authoring and runtime choices

**Blender** is the primary candidate for modelling, materials, rigs and authored animation. Export
approved meshes and clips to glTF/GLB, or render 2D illustration layers when rotation adds little
teaching value. Users of our EXE should not need Blender installed. Blender's licence page was not
retrievable in this refresh; consult [the official licensing page](https://www.blender.org/about/license/)
when adopting tools/add-ons, and preserve separate rights for imported assets.

**Three.js** is an MIT-licensed general-purpose browser 3D library and the proposed integration
candidate for our Electron/Preact app. [Repository](https://github.com/mrdoob/three.js). Keep the
native board as the surrounding editor and put 3D into selected lab viewports. A specialised
molecular viewer may be more effective than rebuilding molecule rendering in Three.js.

**Format guide:** GLB for packaged meshes/materials/animation; editable Blender/CAD originals for
maintenance; SVG for clear 2D labels/diagrams; PNG for thumbnails. STL is useful for geometry/printing
but normally lacks the material, label and animation structure we need. PDB/mmCIF/SDF describe
scientific structures and should be handled by an appropriate molecular data pipeline.

These choices need a prototype on the target Windows hardware. Do not promise that a large anatomy
atlas or transparent 3D glass scene will be fast merely because it loads in a browser.

## Proposed offline integration workflow

1. Choose the teaching question and required anatomical or apparatus parts before choosing artwork.
2. Record the exact asset page, creator, version/date, original file hash, licence and attribution.
   Save the licence alongside the downloaded original.
3. Review geometry/scientific meaning. Check scale, orientation, missing parts and whether a
   structure is measured, idealised or inferred. Obtain subject review for instructional claims.
4. Prepare a smaller derivative: named meshes, useful pivots, sensible materials and reduced texture
   sizes. Preserve editable source and any share-alike obligations for adapted assets.
5. Package local files and thumbnails. No CDN, account, API key or runtime download for core lessons.
6. Keep scientific state separate from rendering. Time, parameters, camera, selected structures and
   authored actions must serialise predictably. Use saved seeds where random behaviour is needed.
7. Integrate play/pause/step/scrub, undo, save/reopen, freeze-and-annotate and PNG capture. Handle GPU
   context loss and provide a useful static fallback. Test multiple lab objects without excessive
   GPU memory or permanent offscreen rendering.
8. Verify a disposable board on ordinary integrated graphics and real touch/pen hardware. Record
   actual load times, memory and responsiveness before choosing final asset budgets.

Suggested per-asset record:

```json
{
  "id": "biology-heart-example",
  "subject": "biology",
  "sourceUrl": "exact entry URL",
  "creator": "original creator and required contributors",
  "sourceVersion": "release or download date",
  "sha256": "original file hash",
  "license": "exact asset licence identifier",
  "licenseFile": "licenses/asset-license.txt",
  "attribution": "required credit text",
  "changes": ["describe geometry or material changes"],
  "runtimeFile": "models/heart.glb",
  "scientificReview": "pending",
  "limitations": ["list omitted or illustrative structures"]
}
```

## Licence rules for selection

The app's own code is GPL-3.0-only. Third-party model, image, data and software licences remain
separate; do not simply relabel everything GPL. Prefer CC0/public-domain assets when suitable,
or clearly documented attribution licences. CC BY-SA assets need their own attribution and
share-alike treatment for adaptations; preserve that information with the model package.

NC restrictions can conflict with unrestricted redistribution/commercial reuse; ND restrictions
can prevent distributing adaptations. Keep such items as references unless the intended use is
specifically permitted. Check the exact version and dependencies before inclusion. This report is
a selection guide, not a licence clearance for individual unexamined files.

## Three recommended first prototypes

| Prototype | Asset approach | Demonstration to prove |
|---|---|---|
| Induction apparatus | Original coil/magnet geometry, restrained material detail | Finger-driven magnet movement, consistent signed voltage graph and deterministic replay. |
| Reaction apparatus | Original coherent glassware kit, explicit chemistry state | Correct pouring origin, level liquids, confined bubbles, meaningful colour and reversible scrubbing. |
| Anatomy explorer | Selected, credited Z-Anatomy/NIH parts plus reviewed diagram overlays | Rotate/isolate/label structures and use a real cutaway; animate only what the model supports. |

Build one polished specimen of each before expanding. Reuse the equipment/label/interaction
components across future topic packs. The [50+ lesson plan](SCIENCE-COLLECTION-PLAN.md) describes
the larger collection; this research provides the asset and tooling route, not a claim of delivery.
