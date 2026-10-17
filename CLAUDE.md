# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Sim OB/GYN is a small browser hospital-management game built with plain JavaScript (ES modules), Three.js and Vite. It has no framework, no TypeScript, no test suite and no linter.

## Commands

```bash
npm install        # install three + vite
npm run dev        # Vite dev server with HMR
npm run build      # production build to dist/
npm run preview    # serve the built dist/
```

In dev builds, `window.__sim` exposes `{ game, player, doctor, interactions }` for poking at state from the browser console (see `src/main.js`).

## Architecture

`index.html` holds the HUD DOM (`#stats`, `#prompt`, `#toasts`, `#progress`), and `src/main.js` mounts the WebGL canvas into `#app`. `main.js` owns the renderer, the lights, the fixed camera, input (keyboard E/Space to interact, click to walk or interact via raycasting) and the single `setAnimationLoop`. Each frame it calls `player.update(dt)`, then `game.update(dt)`, then positions the floating interaction prompt.

- **`hospital.js`**: `buildHospital(scene)` builds all static geometry from boxes and returns the data other modules depend on:
  - `colliders`: axis-aligned XZ rectangles. Only the player uses them.
  - `chairs`, `wardBeds`, `clinic`, `examBed`, `deliveryBed`: slot objects with an `occupant` field. These slots act as the reservation system for rooms and beds.
  - `objects`: meshes that interactions attach to.
  - `spots`: named `[x, z]` waypoints (door in/out points, bed-side and lie positions). All NPC routing is written in terms of these spots.

  The floor spans x −20..20, z −10..10 (+Z faces the camera; screen-up is −Z). Four rooms sit along the north row (Clinic, Exam/Ultrasound, Delivery, Ward), and their doorways at x = −15, −5, 5, 15 open onto the lobby to the south.
- **`game.js`** (`Game`): all gameplay. It contains the patient state machine (documented in the class's doc comment), spawning, fees and stats, ward recovery timers and the nurse's patrol route. The patient `state` drives both the label text and the interaction prompt (`patientPrompt`). `location` records which slot the patient holds. Moving a patient between rooms always goes through `moveTo`, which calls `leaveCurrentSpot` (frees the slot and returns the exit path), then `routeInto` (the entry path), then `settle` (pose and position). New rooms or flows need cases in all of these.
- **`npc.js`** (`Walker`): follows a scripted path of `[x, z]` waypoints or numbers (pause in seconds). **NPCs ignore colliders**, so every path must route explicitly through the door spots.
- **`player.js`** (`Player`): WASD/arrow movement plus click-to-move with circle-vs-AABB collision (`resolveCollisions`). `player.locked` freezes input during timed actions. `Game` sets it around `await hud.progress(...)`.
- **`interaction.js`** (`Interactions`): a registry of `{ object, range, promptHeight, label(), action() }`. When `label()` returns `null`, the item is currently unavailable: it is skipped by both `nearest()` (E key) and click-picking. Prompts are therefore context-sensitive simply by returning `null`.
- **`characters.js`**: procedural humanoids built from primitives. The root group handles position and yaw, and the inner `userData.rig` handles poses (`setPose`: stand/sit/lie). This module also has walk animation, canvas-sprite name labels and `disposeObject`. Call `disposeObject` when removing characters, because materials are cached and shared per color, so only geometries and sprite textures are disposed.
- **`hud.js`**: DOM-only HUD helpers: stats panel, positioned prompt, toasts (`info`/`good`/`warn`/`money`) and a promise-based `progress(label, seconds)` bar.
