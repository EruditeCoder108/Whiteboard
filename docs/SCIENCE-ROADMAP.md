# Floating Whiteboard: science and teaching roadmap

Planning date: **2026-10-08**. Starting point: **1.4.0**, source commit `21693d4`.
Status: **planned expansion**, with a completed canvas audit and an experimental rendering prototype. No science engine has been shipped.

This is the separate science-product track. [The whiteboard roadmap](../ROADMAP.md) remains the editor/workspace track. The tracks share milestones and release gates; the phase names below are planning milestones, not promised version numbers or dates.

## The eventual product

An offline teaching whiteboard where a teacher can draw, insert a labelled scientific model, change its parameters, pause at an exact instant, annotate the result, and save the complete explanation for reuse. An agent can perform those same actions through native commands. Optional speech and AI can assemble explanations from tested models.

The visual identity is paper, graph paper and blueprint: precise geometry, clear labels, restrained colours, readable equations, and purposeful animation. Start with 2D. Use projected depth or cutaway drawings when they clarify a concept. Full 3D is a later, selective option after an actual teaching need and performance budget are established.

High-school physics is the first subject. Attractive short demonstrations help explain and share the product, but virality is not a delivery promise. Each demo must also work as a teacher-led lesson: predict, experiment, observe, explain, and reuse.

## Where we start

The app already has pressure-sensitive ink, editable text/notes/shapes, selection and transforms, groups, local save/recovery, semantic agent/MCP operations, and timed editable recordings with replay and video export. These provide the board around the laboratory.

The app does not yet have a scientific model runtime, simulation objects, calibrated scientific axes, a physics catalogue, lesson sequences for simulations, or voice-to-science control. Connected diagrams, local pages/assets, equations/PDF workflows and broader presentation tools remain on the editor roadmap. Their dependencies are scheduled below rather than assumed complete.

Canvas quality needs attention first. The existing camera supports a large virtual world; the current dots/grid are cached with content and can grow/blur during zoom, while grid density changes abruptly. [The canvas audit](CANVAS-AUDIT.md) separates verified defects, prototype measurements and the implementation proposal. Trusted Windows signing also remains a release requirement for distribution on this machine.

## Indian curriculum baseline

Start with **CBSE/NCERT, academic year 2026–27**. Classes 9–10 teach physics within integrated Science; Classes 11–12 have a separate Physics subject. Other Indian boards will need their own mappings. The following is a broad coverage map, not a complete chapter inventory or an examination checklist.

| Class | Broad physics families to support over time | Source |
|---|---|---|
| 9 | Motion and graphs; forces and friction; work, energy, power and simple machines; sound and wave characteristics. | [CBSE Class IX Science](https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/ScienceSt_SecP1_2026-27.pdf) |
| 10 | Mirrors/lenses and refraction; eye/prism/dispersion; electrical circuits and power; magnetic effects of current. | [CBSE Class X Science](https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Science_SecP1_2026-27.pdf) |
| 11 | Measurement; mechanics, rotation and gravitation; matter/fluids/thermal physics; thermodynamics and gases; oscillations and waves. | [CBSE XI–XII Physics](https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Physics_SecP2_2026-27.pdf) |
| 12 | Electrostatics and circuits; magnetism, induction and AC; electromagnetic waves; optics; radiation/matter, atoms/nuclei and semiconductors. | [CBSE XI–XII Physics](https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Physics_SecP2_2026-27.pdf) |

Sources checked on the planning date through the [official 2026–27 curriculum index](https://cbseacademic.nic.in/curriculum_2027.html). NCERT texts/lab manuals are prescribed in those documents. Use the current text and syllabus again when implementing each concept.

Two mapping precautions: Class IX has a distinct 2026–27 structure, including simple machines; do not silently substitute an older Class IX chapter list. The Class X document lists motor/induction/generator content as formative and contains overlapping assessment notes. We can offer educational demonstrations, but should verify any eventual “exam syllabus” badge against official clarifications. This roadmap does not resolve examination eligibility.

## Starter demonstrations

Build three hero models first, one at a time. The next three expand shared capabilities after the hero workflow works reliably.

| Order | Demonstration | Initial interaction and visual hook | Curriculum connection / starting simplification |
|---|---|---|---|
| 1 | **Projectile motion** | Drag a launch vector; compare angles and gravity presets; inspect velocity components, trajectory, time and energy. Freeze at the highest point. | XI motion in a plane. Begin with uniform gravity and no air resistance; clearly label the idealisation. |
| 2 | **Lens and mirror image formation** | Drag an object through focal positions; rays, image orientation and size update together. Reveal construction rays step by step. | X; later XII optics. Start with thin-lens/paraxial models and an explicit sign convention. |
| 3 | **Electromagnetic induction** | Move a magnet relative to a coil; show changing flux and induced voltage with direction labels and a live graph. Pause motion to explain the change. | XII induction; optional X enrichment. Define the first model's geometry/flux approximation before implementation. |
| 4 | **Series/parallel DC circuits** | Switch between two arrangements; change resistance/voltage; compare current, voltage and power. | X, extended XII. Start with ideal sources and resistors; visual flow is illustrative, not electron speed. |
| 5 | **Pendulum / spring energy** | Compare lengths or masses; show position and energy together; pause at extremes and equilibrium. | XI oscillations; energy intuition for IX. Label the pendulum's small-angle approximation. |
| 6 | **Waves and superposition** | Drag frequency/phase; see travelling and standing patterns, nodes and graph traces. Add a separate sound view. | XI waves; IX sound bridge. Distinguish displacement graphs from actual longitudinal particle motion. |

These choices are product recommendations based on the curriculum families above. Cross-grade views reuse a model while changing explanation depth, labels and controls. A Class IX bridge does not make the full XI treatment a Class IX syllabus topic.

## Teacher experience inside the board

1. Open **Science → Physics**, search by concept or browse class/topic. Preview an original demo before inserting it. Show learning goal, approximation and controls in plain language.
2. Insert an editable **lab frame** onto the existing board. It behaves like board content: select, move, duplicate, lock, save, and navigate back to it. Students still see the surrounding handwritten explanation.
3. Drag meaningful handles directly: launch direction, object position, circuit component values. The selected lab exposes a compact inspector with units; advanced settings stay collapsed.
4. Use a shared transport strip: **play, pause, reset, speed, step and scrub**. Each lab has its own clock; one is active by default. A “compare” action creates a second configuration using a shared time axis.
5. Reveal labels, vectors, equations and graphs as needed. Freeze a frame and write over it. Changes explain themselves through geometry and numbers; a teacher can keep a clean view for screen sharing.
6. Save a reusable lesson containing model settings, annotations and explanation steps. Export a short demonstration or present the longer lesson without an account.

Paper/blueprint themes affect appearance only. Avoid label clipping and collisions, colour-only distinctions, tiny slider handles, or a panel covering the interesting part of the experiment. Support keyboard controls, high contrast, reduced motion, pen/touch and a readable compact-window layout.

Keep two backgrounds distinct: **decorative canvas dots/grid** adapt for navigation; **scientific axes/rulers** have labelled units and a calibrated scale within a lab. Decorative dots are not a measurement instrument.

## Scalable foundation

Keep the scientific calculation independent of board pixels, UI, AI provider and frame rate. Prefer closed-form models when appropriate; numerical models use a documented solver, error tolerances and controlled timesteps. A general rigid-body engine is not the authority for every physics topic.

| Module | Responsibility |
|---|---|
| Concept catalogue | Stable IDs, titles, learning goals, tags, prerequisites, available controls and versioned curriculum mappings. |
| Model definitions | Parameter schema with SI units, allowed ranges, initial conditions, assumptions, model version, analytic/numerical implementation and reference cases. |
| Simulation runtime | Deterministic clock, evaluate/step/seek/reset, bounded graph sampling, reproducible random seeds when needed, and resource limits. |
| Scientific scene | Geometry, vectors, rays, graphs, dimensions and label anchors derived from model state. Rendering and calculations share one state. |
| Board adapter | Persistent lab objects, bounds/hit testing, selection, uniform resizing, cloning, undo, schema migration, save/recovery and snapshot export. |
| Lesson adapter | Parameter changes and transport/reveal events, annotations, checkpoints, camera steps and video rendering at explicit times. |
| Agent adapter | Discover concepts and parameters; insert/read labs; change validated values; play/pause/seek; create comparisons and snapshots. |
| Teacher UI | Catalogue, direct manipulation, compact controls, accessible labels and presentation mode. |

Suggested future module boundary: `engine/science/{catalog,models,runtime,scene,board-adapter,lesson-adapter,agent-adapter}` and `ui/science/`. This is a design proposal, not an already-created code scaffold.

A persistent lab stores its model ID/version, parameters, starting conditions, board placement, reveal options and lesson references. Animation state is derived at time `t`; it must not create hundreds of document objects or undo entries per second. Commit intentional parameter/structure edits as transactions. Transport is transient until deliberately recorded or saved as a starting state.

Separate **SI coordinates** from **board coordinates**. Moving/resizing a frame changes its presentation, not gravity, physical length or elapsed time. Preserve aspect ratio for geometry that needs it. Parameter changes never silently rescale the meaning of an axis.

Replay requires model-aware events and stable versions; today's object-edit recording is a foundation, not complete simulation replay support. Reopening, seeking and exporting must reproduce the same scientific state. If an old model version is unavailable, show a saved static snapshot and an explicit compatibility message instead of silently recalculating with different rules.

The AI selects and configures validated models and lesson steps. Use typed commands and compact state summaries through the existing semantic/MCP foundation. Imported lessons and AI output cannot execute arbitrary scripts. Add more providers through adapters; no OpenAI key is required for manual physics or an external MCP agent. Built-in conversational AI remains optional and depends on a configured local model or provider.

## Phases from current to distant future

| Phase | Product outcome | Scope | Exit gate |
|---|---|---|---|
| **S0 — Canvas and contracts** | A board that feels dependable as the science workspace | Smooth decorative dots/lines; consistent camera gestures; measured rendering budgets; lab object/schema and runtime contracts; initial visual language. Resolve trusted signing for distributed builds. | Zoom/pan without dot growth or visible density snaps; anchor correctness; 500-object lesson and dense-board stress checks; no pen/replay regressions. |
| **S1 — First complete lab** | Projectile motion works as actual editable board content | Catalogue entry, SI model, direct launch handle, labels/vectors, graph, transport, pause-and-annotate, save/reopen, undo and snapshot export. | An instructor creates, changes, freezes, annotates, duplicates and reopens a lesson offline; reference calculations match. |
| **S2 — Physics showcase** | A convincing small teaching product across grades | Lens/mirror and induction hero models; reusable rays, graph/label controls and comparison UI; model-aware lesson recording/replay and short video export. | Three useful lessons, each scientifically checked and understandable without AI; seek/export matches board state; real teacher feedback. |
| **S3 — High-school physics packs** | A library teachers can depend on | Add circuits, oscillations and waves, then chapter-by-chapter mechanics, optics, electricity, thermal and modern-physics families. Versioned CBSE/NCERT mappings; reusable lesson library, equations and practical-style observation tables. | Every advertised concept has reviewed coverage, assumptions, reference tests and a teaching example; coverage dashboard distinguishes planned, implemented and reviewed. |
| **S4 — Agent and speech teaching** | Optional assistance assembles lessons quickly | Extend MCP to all lab actions; text-to-lesson preview; push-to-talk commands; teacher confirms an interpreted instruction and can undo. Then evaluate controlled continuous listening and Hindi/English support. | Commands such as “compare 30 and 60 degrees, pause at the top, label velocity” produce reproducible native content; corrections/cancellation, latency, privacy and cost are measured. |
| **S5 — Broader science and mathematics** | A coherent multidisciplinary teaching studio | Reviewed 2D biology/anatomy diagrams and revealable systems; chemistry/molecular/reaction views; geometry, functions and calculus; shared labels/graphs/lessons. More curriculum boards and languages. | Each subject has its own verified model/diagram standards; packages work offline and remain editable and portable. |
| **S6 — Authoring platform** | Teachers can make and reuse their own scientific lessons | No-code lesson/parameter authoring, constrained reusable instruments, trusted package format, import/export, optional package distribution, and selective projected-depth/3D modules. | A teacher builds a lesson from validated components without coding; compatibility, provenance and resource limits remain reliable. |

The editor roadmap continues alongside this track: attached connectors help circuits and structured diagrams; pages/assets help lesson organization; equations/PDF support helps classroom preparation; presentation/export/accessibility help delivery. Build the narrow capabilities required by a science milestone, then reuse them in the general editor. Do not hold the first lab for every future editor feature.

## Quality and feasibility rules

- **Scientific correctness:** analytical reference values, units/dimensions, sign conventions, limiting cases and relevant conservation/error checks. Teacher or subject-expert review is a gate before calling a pack curriculum-ready.
- **Teaching usefulness:** every model includes a learning question, a meaningful variable change, a readable result and an explanation. Show simplifications at a level appropriate to the lesson.
- **Document integrity:** migration, undo/redo, clone, save/reopen, recovery, unsupported versions and portable lesson tests apply to every persistent lab feature.
- **Performance:** target smooth input on the reference classroom device. Animate one active lab initially; pause/cull offscreen labs, bound particles/graph history, and keep simulation painting separate from cached ink. Measure 1080p/DPR variants and lower-end hardware before release claims. A larger world alone does not require a larger bitmap.
- **AI/speech:** deterministic model actions come first. Show the interpreted command, provide immediate cancellation and one-step undo, and avoid changing a lesson on uncertain speech. Continuous drawing while listening is a later experiment, not a guarantee that a model understands any spoken concept instantly.
- **Distribution:** source-app checks do not prove that the unsigned Windows executable is accepted. Ship through a trusted signing path and validate the actual package.

2D physics, accurate labelled diagrams, editable lessons, native agent control and carefully scoped speech commands are plausible. Arbitrary scientifically correct simulations generated instantly from unrestricted speech, perfect coverage of every teachable concept, and identical performance on every device are not sensible promises.

## Next implementation slice

1. Finish the production canvas/background improvement and its regression/performance checks.
2. Specify the lab schema, SI model interface and deterministic transport; implement one projectile model behind the real board UI.
3. Complete its full teacher workflow and saved-document lifecycle before adding a second model.
4. Extend agent commands to that lab; add optics and induction after the interaction and replay contracts are proven.

Track each future concept as **planned → implemented → scientifically checked → teacher tested**. Expand the catalogue deliberately without requiring this roadmap to list every diagram now.
