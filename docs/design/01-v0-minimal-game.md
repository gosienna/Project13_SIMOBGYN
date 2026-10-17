> **Status:** Implemented 2026-10-16
> **Superseded in part by:** [02 — Clinic & Maternity Ward](02-clinic-and-maternity-ward.md), which changed the building layout and the patient flow. This document is the original v0 plan, kept unchanged as history.

# Sim OB/GYN — minimal 3D browser game (v0)

## Context
Empty project folder (`Project13_SimOBGYN`). The user wants a starting point for a Sim-Hospital-like browser game where you play an OB/GYN doctor. Scope for v0: one-floor hospital, fixed top-down 3D camera, a controllable doctor who can walk around and interact, plus a nurse and a pregnant patient. Keep components minimal so it's easy to grow later.

## Stack
- **Vite + Three.js (vanilla JS, ES modules)** — no framework, no physics lib. Node v23 is installed.
- All 3D art built from Three.js primitives (boxes, capsules, spheres) — no external assets.

## File layout
```
package.json            # deps: three; devDeps: vite. scripts: dev, build, preview
index.html              # canvas container + HUD overlay divs
src/main.js             # renderer, scene, lights, fixed camera, game loop
src/hospital.js         # floor, walls, rooms, furniture; exports colliders + interactables
src/characters.js       # createDoctor / createNurse / createPatient (primitive meshes) + walk bob anim
src/player.js           # WASD/arrow movement + click-to-move, wall collision (AABB vs circle)
src/npc.js              # simple waypoint walker (moveTo target, idle states)
src/interaction.js      # nearest-interactable detection, "Press E" prompt, action dispatch
src/hud.js              # prompt label, message toast, money/patients-treated counter
src/style.css
```

## Key design
- **Camera**: `PerspectiveCamera` at fixed position above the floor center, tilted ~55° (Sim-style 3/4 top-down), whole ~30×20 m floor visible. Does not follow or rotate. Resizes with window.
- **Hospital (one level)**: floor plane + box walls with door gaps. Rooms:
  - Reception (desk) / Waiting area (chairs) — patient spawns here
  - Exam / Ultrasound room (exam bed, ultrasound machine)
  - Delivery room (delivery bed, baby incubator)
  - Nurse station (counter)
  Each room gets a floor color tint + floating text label (canvas-texture sprite).
- **Characters** (`characters.js`), each a `THREE.Group` with a shadow-casting body:
  - Doctor (player): white coat, blue pants, stethoscope ring.
  - Nurse (NPC): pink scrubs + cap; wanders between nurse station and rooms on waypoints.
  - Patient (NPC): maternity dress with a belly sphere; sits in waiting area.
  - Shared walk animation: body bob + leg swing while moving; face movement direction.
- **Player movement**: WASD/arrows relative to the fixed camera; click floor to walk there (raycast). Circle-vs-AABB collision against wall/furniture colliders.
- **Interaction** (`E` key or click on target when within ~1.8 m):
  - Patient → "Please follow me to the exam room" → patient walks to exam bed.
  - Ultrasound machine (patient on bed) → toast "Healthy baby, 32 weeks" → patient is marked checked.
  - Nurse → short dialog line (e.g. "Delivery room is ready, Doctor").
  - Delivery bed / incubator → flavor text.
  - After checkup, patient walks to exit and a new patient spawns in waiting area; HUD counter `Patients treated` / `$` increments. This gives a tiny playable loop.

## Verification
1. `npm install && npm run dev`, open the local URL.
2. Confirm: hospital renders with fixed top-down view; doctor moves with WASD and click, can't pass through walls.
3. Nurse walks her route; patient sits in waiting area.
4. Walk to patient, press E → she follows to exam bed; use ultrasound → toast + counter increments; new patient spawns.
5. `npm run build` succeeds with no errors.

## Implementation notes (added after the build)
- Patient flow logic ended up in its own file, `src/game.js`, rather than being split across `main.js` / `interaction.js`.
- Labour path added during implementation: a patient at ≥ 37 weeks goes into labour after the ultrasound → sent to the delivery bed → "Deliver Baby" spawns a newborn in the incubator.
- `main.js` exposes `window.__sim` in dev mode only, used by the automated headless playthrough.
