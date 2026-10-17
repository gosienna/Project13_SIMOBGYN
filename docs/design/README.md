# Sim OB/GYN — Design Docs

This folder tracks how the game is designed, one document per feature or change, in order.

## Timeline

| # | Design doc | Date | Status |
|---|---|---|---|
| 01 | [Minimal 3D game (v0)](01-v0-minimal-game.md) | 2026-10-16 | Implemented; layout and flow replaced by 02 |
| 02 | [Clinic & Maternity Ward](02-clinic-and-maternity-ward.md) | 2026-10-17 | Implemented; room widths replaced by 03 |
| 03 | [Smaller Exam & Delivery, Larger Ward](03-resize-rooms-larger-ward.md) | 2026-10-17 | Implemented |

## Current game at a glance
- **Stack:** Vite + Three.js, vanilla JS, no external assets (all models are built from primitive shapes).
- **View:** one-floor 40×20 m hospital, fixed top-down 3D camera.
- **Rooms:** Clinic (10 m) · Exam/Ultrasound (7.5 m) · Delivery (7.5 m) · Maternity Ward (15 m, 6 beds) · Lobby (waiting area, reception, nurse station). See [03](03-resize-rooms-larger-ward.md#layout).
- **Characters:** Doctor (player), Nurse Amy (patrols the rooms), pregnant patients (arrive every ~20–30 s).
- **Controls:** WASD / arrows to move, click to walk or interact, `E` to interact.
- **Patient flow:** waiting → clinic consult → home / ultrasound / ward admission; labour → delivery → postpartum ward → discharge. See [02](02-clinic-and-maternity-ward.md#patient-flow).

## Conventions
- Each new feature gets the next numbered doc (`03-…md`), with Context, Design, Code structure and Verification sections, plus a status header.
- Earlier docs are history and are not rewritten. A newer doc says what it replaces, and the older doc's status header points to it.
- Update the timeline table and the "Current game at a glance" summary when a feature lands.
