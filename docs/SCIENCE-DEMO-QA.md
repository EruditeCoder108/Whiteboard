# Eleven native offline experiments — 2026-10-08

Local continuation of the projectile lab, with existing staged S0 work preserved. Version remains 1.4.0; these changes are unreleased source work. The live profile is never used for QA.

## What is delivered

The flask button now opens an **Animation library**. It provides search across titles/questions/assumptions, subject counts (7 physics, 3 chemistry, 1 biology), topic filtering, two-column desktop cards, a single-column compact layout and an **On this board** list that focuses existing labs. Maths has an explicit empty roadmap state. All eleven visible entries insert actual native objects; none is a placeholder.

The reported button defect was `.science-hero svg` applying the large illustration dimensions and margins to its nested button icon. Illustration rules are now scoped to `.science-preview`; action icons are fixed at 16 px and the label is a separate inline element. QA measures icon/text geometry, full containment of the insertion action in the scrollable content and dialog bounds at 420×320.

New labs start in **Explore**. **Explain** reveals scientific detail as one undoable edit; existing saved reveal choices remain. The projectile and pendulum markers are stitched baseballs. Native Canvas2D props, SVG thumbnails and a quiet paper/blueprint palette keep everything offline. Appearance does not add spin, drag or bounce to the projectile model.

Each model supports labelled validated controls, play/pause/reset, speed, 1/30-second step, exact scrub, middle/end checkpoints (apex/impact for projectile), freeze-and-annotate, selection/move/uniform resize/rotation/group/duplicate/lock/order, undo, exact frozen-time save/reopen/recovery and PNG snapshots through the existing editor. Continuous scientific animation is still not captured by generic lesson recording; frozen edits and annotations are supported.

## Models and scientific limits

| Model | Controls / observable result | Authority and simplification |
|---|---|---|
| Projectile | Launch speed/angle, initial height, gravity/mass; trajectory, velocity, energy and two graphs | Existing closed-form SI projectile, no drag, level landing plane; pre-impact velocity. |
| Lenses & mirrors | Convex lens / concave mirror, focal length, object distance/height | Thin/paraxial model, `1/f=1/u+1/v`, `m=-v/u`. Positive u; positive v is real. At u=f, display no finite image. Construction timing is illustrative. |
| Magnet & coil | Turns, period, peak flux; voltage graph | Prescribed sinusoidal position and Gaussian flux per turn. Faraday's law `ε=-N dΦ/dt` is evaluated analytically; no magnetic-field solver or connected load. |
| Circuits & bulbs | Series/parallel, DC voltage, two resistances | Ideal fixed resistors. Current and power satisfy Ohm/Kirchhoff laws. Glow represents power; moving dots illustrate conventional current, not electron speed. |
| Pendulum & spring | Small-angle pendulum length/amplitude; spring stiffness/mass/amplitude | Linear undamped oscillators. Pendulum amplitude ≤15°; its energy uses the linear approximation. Spring displacement is relative to equilibrium. |
| Waves | Amplitude, frequency, wavelength, phase | Equal-amplitude, equal-frequency transverse waves travelling in the same direction. Show both waves and their sum. No standing-wave or longitudinal-sound claim. |
| Forces & friction | Push, mass, friction coefficient | Horizontal cart starts at rest. Static/kinetic coefficients are equal; constant Earth gravity and no rolling resistance. Acceleration is zero below the static threshold. |
| States of matter | Chosen phase, temperature, visible count | Seed-free deterministic illustrative motion; not molecular dynamics or a phase diagram. Temperature does not silently select phase. Ideal argon RMS reference is shown only in the gas view. |
| Atoms & reactions | Integer initial H₂/O₂ counts; remaining reactants and water | `2H₂+O₂→2H₂O` stoichiometry. Six atoms move into two water molecules per authored step; counts update at completed checkpoints. Atom conservation is tested. This is not kinetics, a molecular reaction pathway or a real experiment. |
| Blood circulation | Illustrative heartbeat, flow-marker count | Schematic RA→RV→lungs→LA→LV→body→RA. Patient-facing right heart appears on the viewer's left. Colours encode oxygenation; blood is always red. Marker travel/beat timing are illustrative; no haemodynamic model. |
| Colour-change reaction apparatus | Diluted vinegar and bicarbonate volumes, shared concentration; pouring, colour, CO₂, approximate pH graph | Open beaker with cabbage indicator in 20 mL ideal water. Instant mixing/stoichiometry and escaping CO₂. Authored pouring/bubble timing and indicator colours are illustrative. |

The apparatus uses `CH₃COOH + NaHCO₃ → CH₃COONa + CO₂ + H₂O`. Solution quantities are in mL and mol/L; calculations convert to litres/moles. Reaction extent is bounded by the limiting reagent. Approximate pH comes from a 64-iteration bisection of charge balance, using water, acetate and residual carbonate equilibria at 25°C (Kw=1e-14, acetic Ka=1.75e-5, carbonic K1=4.3e-7, K2=4.7e-11). It assumes reaction-product CO₂ vents and ignores indicator buffering, activities and gas-transfer kinetics. It is an educational approximation, not calibrated titration software. Equal acid/base moles leave sodium acetate, so the resulting pH is not forced to 7. Bubbles stop when the model no longer produces CO₂.

Sources for subject review: [NCERT projectile reference](https://ncert.nic.in/textbook/pdf/keph103.pdf), [CBSE 2026–27 Science](https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Science_SecP1_2026-27.pdf), [NCERT Life Processes](https://ncert.nic.in/textbook/pdf/jesc105.pdf), [NCERT Acids, Bases and Salts](https://ncert.nic.in/textbook/pdf/jesc102.pdf), [ACS cabbage indicator](https://www.acs.org/education/activities/red-cabbage-indicator.html), [Purdue indicator demonstration](https://chemed.chem.purdue.edu/genchem/demosheets/11.1.html). CBSE Science, NCERT Life Processes and ACS indicator material were consulted during this continuation; no complete subject-expert or curriculum review is claimed.

## Structure and persistence

- `engine/science/models.ts`: static model registry, parameter schemas/defaults, assumptions, finite pure state evaluation and per-model durations; no imported scripts or external provider.
- `catalogue.ts`: search and subject/topic metadata derived from that registry.
- `runtime.ts`: per-item monotonic clocks; seek evaluates explicit time. One Board-controlled lab plays at once; offscreen/locked/pass-through/replay rules remain.
- `scene.ts` / `experiments.ts` / `props.ts`: shared native board/PNG/frozen-replay rendering. Diagrams are bounded; graphs use 121 cached samples tied to immutable objects. The projectile keeps its existing bounded geometry cache.
- `ui/science/{Catalogue,Science,Inspector,Preview}.tsx`: compact library, shared transport, validated controls and teaching reveals. The library hides inspector/transport while it is open to prevent panel collisions. Keyboard Tab stays within ordinary UI navigation; Escape clears search then closes.
- `LabItem.params` now accepts model-specific numeric schemas. Native boards remain format 3 when labs are present (ordinary boards remain 2); frozen recordings remain format 2. Each known model validates exact keys, ranges and discrete choices. Model/version compatibility remains explicit. Generic semantic reads include native parameters, unit maps, model version, frozen state and assumptions; dedicated science command APIs remain future work.

## Validation

Run from `app`, with `TEMP` and `TMP` set to `app/.work`:

```powershell
npm test -- --maxWorkers=1 --testTimeout=15000
npm run typecheck
npm run build
node e2e/science-library.mjs
node e2e/projectile.mjs
```

**203 unit checks passed**, including 18 new model/registry/lifecycle tests. Reference cases cover real/virtual/focal optics, numerical Faraday derivative, unequal-resistor current/power, oscillator periods/energy, exact destructive interference, static friction, √T gas speed, every stoichiometric atom checkpoint, apparatus limiting reagent/charge-balance outcomes and all-model save/reopen/replay clocks. TypeScript and source build passed.

**78 library checks passed** in disposable profiles with blocked renderer HTTP(S). They test every model via the actual UI, native insertion, transient play, one-step parameter edits/undo, integer-count validation, scientific seek/freeze, mixed-model PNG decode, actual disk save/restart, original ink preservation, on-board navigation, annotation and compact geometry. Results: [library-results.json](science-qa/library-results.json). Visuals: [desktop library](science-qa/library-wide.png), [compact library](science-qa/library-compact.png), plus `science-qa/demo-*.png` from the production scene renderer. No physical-display FPS or latency claim is made.

Hidden-window screenshot capture after resizing stalled in early runs. For UI captures only, QA renders a non-focusable, mouse-isolated window beyond the right edge of **every** connected display, then hides it again. Native UI entrance motion is reduced for screenshots. The live window/profile is never selected. This is a test-capture workaround, not a product rendering fix.

The existing projectile workflow and drawing/recovery/object/laser/agent/replay checks were rerun: **44 projectile, 46 drawing, 22 recovery, 35 object, 14 laser, 40 agent and 30 replay checks passed**. Together with unit/library validation, **512 checks passed**, plus TypeScript/build. One drawing run raced an in-progress camera reset before pinch; a fresh profile passed. The harness now waits for camera animation to be idle before starting that unrelated gesture, and its final run also passed. No grid renderer or physics change was made for it. Historical QA screenshots outside `docs/science-qa` are restored to their original baseline after testing.

After all QA, SHA-256 comparison confirmed all nine sampled live-profile files unchanged: board, five board backups, recordings, recording backup and MCP adapter. Before/after manifests are in ignored `.work/library-live-{before,after}.json`. Git remains `main` at `5cb4c02`, 0 ahead/0 behind the fetched origin snapshot; the existing staged work is preserved and this delivery is additional local source work. No commit, push or live-app restart was performed.

## Remaining gates

These are implemented educational demos with analytical/software checks, not a reviewed curriculum pack. Teacher/subject-expert review, physical pen/touch, visible classroom performance and screen sharing remain. Continuous scientific lesson/video replay, dedicated model manipulation handles beyond projectile, science MCP transport commands, future-version raster fallback and trusted release signing remain separate work. Existing dense-board stalls are not claimed resolved.
