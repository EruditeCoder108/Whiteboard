# Physics and chemistry check — 2 November 2026

The owner narrowed Part 2 to **physics and chemistry** on 2 November. `parts-bio.ts` is unchanged. Its earlier audit findings remain in `tools-audit.md` for reference, without a claim that they were repaired.

All **28 parts** defined in `parts-physics.ts` and `parts-chem.ts` were checked below. Only drawing functions, drawing helpers, two display names and painted labels changed. All 58 registered parts retain exactly the same kind, dimensions, default parameters, settings, controls, terminal positions, circuit functions and animation predicates. A bundled before/after comparison checked those contracts. The electrical parts and all solvers are unchanged. No textbook figure, website picture or raster image was used in an apparatus drawing.

## Sources used for facts and terminology

- **P1:** [NCERT Class X Science, Light — Reflection and Refraction, especially §9.3.6](https://ncert.nic.in/textbook/pdf/jesc109.pdf): lens sign convention and basic optical geometry.
- **P2:** [NCERT Class X Science, Magnetic Effects of Electric Current, §12.1](https://ncert.nic.in/textbook/pdf/jesc112.pdf): compass polarity and closed magnetic field lines.
- **P3:** [NCERT Class XI Physics Laboratory Manual, experiments 1–5](https://ncert.nic.in/pdf/publication/sciencelaboratorymanuals/classXI/physics/kelm102.pdf): “Vernier Callipers”, 10 vernier divisions = 9 main divisions and 0.01 cm least count.
- **P4:** [NCERT Class XI Physics Laboratory Manual, experiments 6–7](https://ncert.nic.in/pdf/publication/sciencelaboratorymanuals/classXI/physics/kelm103.pdf): pendulum length and the small-angle period approximation.
- **C1:** [NCERT Class XI Chemistry Laboratory Manual, Basic Laboratory Techniques](https://ncert.nic.in/pdf/publication/sciencelaboratorymanuals/classXI/chemistry/kelm202.pdf): laboratory glassware, heating, burner, tripod and gauze.
- **C2:** [NCERT Class XI Chemistry Laboratory Manual, Titrimetric Analysis](https://ncert.nic.in/pdf/publication/sciencelaboratorymanuals/classXI/chemistry/kelm206.pdf): burette graduation/readings, meniscus and conical-flask use.
- **C3:** [NCERT Class IX laboratory manual, Materials](https://ncert.nic.in/pdf/publication/sciencelaboratorymanuals/classIX/science/ielm102.pdf): solution, heating and measuring context.
- **C4:** [IIT Kanpur SATHEE's NCERT Structure of the Atom text](https://sathee.iitk.ac.in/pa/sathee-ssc/student-corner/ncert-books/class-09/nb-science-09/sci-09-chapter-4-structure-of-the-atom/): shell notation and the NCERT spelling “Sulphur”. The live NCERT Class IX PDF routes now point to the newer Exploration book, so this source is identified as a reproduction of the older NCERT chapter rather than the current chapter number.

These references informed the facts. Proportions, curves, material highlights and label placement were drawn independently in Canvas2D code.

## Every part checked

| Part / saved kind | What was checked | What changed |
|---|---|---|
| Ray box / `ray-box` | One, three and five parallel exit positions agree with the existing ray emitter. | Slit marks match beam count; quieter metal casing, vents, fasteners and an exit face. |
| Convex lens / `convex-lens` | Converging shape and positive focal length (P1). | Explicit plus sign, unit wording, restrained glass shading and clearer edges. Stored `f` and optical face geometry stay intact. |
| Concave lens / `concave-lens` | Diverging shape and negative focal length (P1). | The minus sign is preserved in the painted value; same glass treatment as the convex lens. |
| Plane mirror / `mirror` | Reflecting edge versus hatched backing (P1). | Distinct bright front edge and subdued metal backing; traced geometry unchanged. |
| Glass prism / `prism` | Triangular faces agree with the existing ray tracer (P1). | Depth from a clipped-looking inner rim and gentle transparent shading; vertices unchanged. |
| Bar magnet / `bar-magnet` | N/S polarity, external N→S direction and internal return (P2). | Direction arrows and return path; field curves fit the original 260×70 bounds; warm red/blue finish and balanced body proportions. Field curves are schematic. |
| Compass / `compass` | N/E/S/W order and the existing red north-seeking needle (P2). | Fine dial divisions, with gaps around the cardinal letters. Needle angle still comes from the unchanged world. |
| Force arrow / `force` | Magnitude is √(x²+y²); existing convention is 10 drawing units/N. | Zero now says **0.0 N**. Direction normalization is handled separately; smaller grip and softer red finish. |
| Spring balance / `spring-balance` | Weight = mass × the existing 9.8 m/s² value; pointer and scale must agree. | Scale positions use that same conversion. Half-newton divisions, less crowded mass block and a clear bottom reading. No change to drag geometry or mass settings. |
| Pendulum / `pendulum` | Pivot-to-bob length, period and small-angle limitation (P4). | Length is drawn proportionally and the 1 m/30° bob stays within the part. Period is marked approximate, with a small-angle note; length and period labels are separated. |
| Vernier callipers / `vernier` | NCERT spelling and 0.01 cm least count (P3). | Display name corrected; inside jaws added; compact vernier shoe fits at 14 cm; zero/end labels and grip stay in bounds; least count is named. |
| Laboratory thermometer / `thermometer` | Laboratory range −10 to 110°C, bulb/capillary and correspondence of column and scale (C1, C3). | Display name distinguishes it from a clinical thermometer. Clear five-degree divisions, end labels, °C and separated scale numbers. Readings and temperature control unchanged. |
| Beaker / `beaker` | Open spout, straight body, approximate volume marks (C1). | Lip, finer graduations, mL label and restrained glass reflections. Meniscus is clipped inside. Empty samples no longer claim a pH. |
| Conical flask / `conical-flask` | Narrow open neck, broad base and titration use (C2). | Rolled lip and glass highlights; clipped meniscus; pH and temperature badges avoid the level grip. Existing volume-height mapping is preserved and remains schematic. |
| Round-bottom flask / `round-flask` | Spherical body and narrow open neck (C1). | Defined lip, reflection and meniscus clipping, including the narrow neck at high fills. Existing capacity and level control are unchanged. |
| Test tube / `test-tube` | Open rim, narrow cylinder and rounded closed end (C1). | Rolled rim and edge highlight; clipped liquid surface; compact empty/pH badge. |
| Measuring cylinder / `measuring-cylinder` | Tall cylindrical bore, pouring lip, broad stable foot and mL scale (C1). | Slender glass body, foot, lip and five-mL minor/ten-mL major marks; scale and level continue to share the same height mapping. |
| Evaporating dish / `evaporating-dish` | Shallow ceramic basin rather than transparent glass (C1, C3). | Warm porcelain body and elliptical rim; liquid remains visible in a schematic section; pH badge is clear of its level grip. |
| Burette / `burette` | Zero at top, increasing readings downward, stopcock and nozzle; a reading is not automatically the net volume delivered (C2). | One-mL marks, curved meniscus, stopcock details, bounded reading label. Zero remaining volume paints no coloured heel. “Show the pH” now actually paints a reading/empty label. Caption says mL rather than “mL used”. |
| Reagent bottle / `reagent-bottle` | Neck, stopper, contents label and decreasing remaining volume (C1). | Amber glass reflection, a properly fitted label, volume-dependent tint and quantity. Its existing pH setting now has a visible result. |
| Funnel / `funnel` | Open cone and narrow continuous stem (C1). | Elliptical rolled rim and one restrained glass reflection. No extra filter-paper feature is implied. |
| Bunsen burner / `bunsen` | Barrel, air inlet, gas inlet and inner/outer blue flame zones (C1). | Curved flame instead of triangles; air hole, gas connector and metal finish; existing on/off point stays at (40,200). |
| Spirit lamp / `spirit-lamp` | Reservoir, wick, cap and flame (C1, C3). | Curved flame, charred wick tip, cap and reservoir highlight. Flame colour remains illustrative rather than an analytical flame test. |
| Tripod and gauze / `tripod` | Three legs and gauze supporting heated glassware (C1). | Actual mesh and support ring, with a ceramic centre; no asbestos depiction or claim. |
| Stand and clamp / `retort-stand` | Heavy base, vertical rod, sliding boss and gripping jaws (C1). | Padded jaw tips, clearer metal/boss details and base edge. Clamp height and interaction point unchanged. |
| pH paper / `ph-strip` | Dry strip versus wetted indicator region; reading from the existing solution model (C3). | Paper shading, bounded compact reading and stronger edge on chalk. The indicator colour function is untouched. |
| Balance / `balance` | Mass is labelled in grams; drawing must not imply a new tare or calibration control. | Softer display, pan and case detail; no fake buttons. Fixed vessel mass/density assumptions in `world.ts` are reported to the lead, not changed. |
| Atomic shells / `atom` | Neutral electron count, shell totals up to Z=36, K/L/M/N notation; Cr and Cu exception code inspected (C4). | Contained footer, named shells, “Sulphur”, restrained electrons. All 36 elements rendered. Bohr-style paths remain a schematic, not literal quantum electron trajectories. |

## Verification and evidence

- Both surfaces were rendered in the real Electron renderer across **430 setting/edge states**, including all 36 atomic numbers. The sign, zero-force and empty-sample checks passed. No painted text escaped its part bounds in those states, and no renderer error was logged.
- [White drawing sheet](../../../audit-shots/science-after/white-contact.png) and [chalk drawing sheet](../../../audit-shots/science-after/chalk-contact.png); individual native-unit renders and `metrics.json` are beside them. Full original interactive audit evidence stays in the parent `audit-shots` folder.
- The before/after compatibility comparison reports **all 58 part contracts unchanged**. This includes the biology and electrical parts, which were deliberately left alone.
- Required command results and final artwork handoff are recorded after the last stage of the task.

## For the lead and a science teacher to check

1. Real panel readability, touch accuracy, 125–200% Windows scaling and visibility from the back of a classroom remain unverified on hardware.
2. Lenses use **drawing units**, not centimetres or metres. The unchanged solver is an ideal thin-lens model. Do not use the drawn glass thickness to calculate refractive index or lens power.
3. The pendulum is a small-angle model even though its existing setting permits 30°. The approximate period label makes this visible; amplitude-dependent dynamics were outside the drawing scope.
4. Conical and round vessels retain the original linear volume-height control. These are schematic levels, not calibrated volumetric geometry. Beaker marks are approximate; the cylinder marks match its straight-bore model.
5. Solution pH, indicator mixtures, heating, density and balance mass need a teacher/lead review before quantitative chemistry lessons. In particular, the unchanged strong-acid/base model does not represent weak acids, salt hydrolysis or very dilute equilibrium; every vessel is still assigned 90 g in `world.ts`.
6. The magnet's compact field curves show direction, not quantitative field strength. The compass solver is unchanged. The physical spring balance and vernier are schematic teaching models within fixed saved dimensions and control coordinates, not calibrated virtual laboratory instruments.
7. Please confirm the school's NCERT edition and preferred practical terminology. Class IX is transitioning to Exploration, so old chapter numbers should not be used as current syllabus mapping.
8. The board-layout settings obstruction and fixed resistor colour bands remain with the lead. Biology corrections were explicitly excluded by the owner after the baseline audit.
