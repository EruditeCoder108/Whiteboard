# Growing the science collection

Planning update: 2026-10-27. This document describes future work, not shipped features or a delivery schedule.

## Starting point

The source preview contains **14 native offline experiments**, including three deeper studios:
recordable magnet motion, pouring indicator chemistry and a guided heart cutaway. The
[README gallery](../README.md#a-closer-look-at-the-collection) shows actual native captures.
See [current scientific assumptions and QA](SCIENCE-SHOWCASE-QA.md) before using a scene as a lesson.
These are teaching models; the chemistry and physiology include illustrative approximations.

The long-term ambition is **50+ useful interactive lessons**. A preset or a cosmetic variation does
not automatically count as a new lesson. Breadth should follow good interaction, clear science and
classroom usefulness. This plan extends the [science roadmap](SCIENCE-ROADMAP.md) and shares the
editor's [product roadmap](../ROADMAP.md).

## Build depth, then expand

1. **Polish what exists.** Review vessel geometry and liquid clipping, pouring trajectories, valve
   timing, label placement and graph readability. Give each scene a meaningful learner action.
   Test finger input and small screens with real hardware before claiming classroom readiness.
2. **Create coherent physics packs.** Ship small groups of reviewed lessons with a shared visual
   language and useful comparisons. Physics remains the largest initial part of the collection.
3. **Grow chemistry and biology deliberately.** Use explicit models and reviewed diagrams; choose
   each level of abstraction for a teaching purpose. Use depth, cutaways or selective 3D only when
   they explain something that a simpler view cannot.
4. **Package lessons for teaching.** Add prediction prompts, guided stops, comparison presets,
   accessible explanations and curriculum mappings after subject review.

## Proposed topic packs

All additions in this table are **candidates for future work**. Existing related scenes are starting
points, not evidence that the whole pack is implemented.

| Pack | Candidate lessons and interactions |
|---|---|
| Motion and forces | Relative motion; position/velocity graphs; free fall and drag; Newton's laws; friction on an incline; connected bodies. |
| Energy and momentum | Work and energy; roller-coaster energy; elastic/inelastic collisions; impulse; centre of mass; momentum conservation. |
| Rotation and gravity | Torque and balance; rotational inertia; angular momentum; circular motion; orbits and escape speed. |
| Electricity and magnetism | Series/parallel networks; circuit measurements; capacitor charging; field lines; motor/generator; transformer and AC. |
| Waves, sound and optics | Standing waves; resonance; sound and beats; Doppler effect; refraction and total internal reflection; prisms; interference. |
| Heat, fluids and matter | Thermal expansion; conduction and convection; gas laws; pressure and buoyancy; phase changes; kinetic particle models. |
| Chemistry: amounts and solutions | Particle-level dissolving; concentration and dilution; stoichiometry; limiting reactants; precipitation and conservation of atoms. |
| Chemistry: reactions and change | Reviewed acid/base titration; indicators; reaction rates; equilibrium; electrochemistry; apparatus with purposeful direct manipulation. |
| Biology: living systems | Deeper circulation and gas exchange; lung mechanics; neuron signalling; muscle action; digestion and transport. |
| Biology: cells and inheritance | Membrane transport; enzymes; mitosis/meiosis; DNA replication; transcription/translation; Mendelian inheritance. |

These subjects can support many more than 50 lessons over time. They are a direction for selecting
strong examples, not a commitment to implement every row. Exact equations, diagrams, assets and
curriculum coverage should be chosen and referenced when each lesson is built.

## Keep a large library easy to use

Extend the existing library gradually with subject → topic packs, search, class/level tags,
clear thumbnails and a short explanation of what a learner can change. Keep favourites, recent
lessons and experiments already on the board close at hand. These enhancements are planned.

Use progressive controls: a compact exploratory view first, then vectors, equations, graphs and
assumptions when needed. A useful preview should expose the interaction without inserting multiple
objects. A small window should retain readable controls and clear scrolling. Familiar details such
as a baseball, real apparatus or a recognisable bulb can add warmth without changing the science.

## A quality gate for every lesson

Track **planned → implemented → scientifically reviewed → classroom tested** separately. Current
implementation and automated checks do not imply the later review stages are complete.

- State the teaching question, model boundaries, units, governing rules and primary references.
- Make at least one learner action matter: drag, adjust, assemble, compare or predict an outcome.
- Derive motion and graphs from the same deterministic model state. Scrubbing must reproduce a
  frame; randomness, if educationally necessary, must use a saved seed.
- Label axes and vectors legibly, use SI where applicable, and distinguish scale from illustration.
  Keep colours meaningful and provide explanations beyond colour alone.
- Verify play/pause/step/scrub, freeze-and-annotate, undo/redo, save/reopen and matching PNG export.
  Any future lesson-recording support must capture continuous science state explicitly.
- Keep the complete core lesson offline. Check asset licences, provenance, size and rendering cost.
- Test with disposable boards/profiles, including small windows, touch, pen and keyboard. Preserve
  live user data. Record physical-device and teacher checks separately from automated results.

Start each addition with one convincing, reviewable lesson. Expand the collection when the scene
helps a learner explain something, rather than merely filling another thumbnail.
