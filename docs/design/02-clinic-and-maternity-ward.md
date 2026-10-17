> **Status:** Implemented 2026-10-17
> **Superseded in part by:** [03 — Smaller Exam & Delivery, Larger Ward](03-resize-rooms-larger-ward.md), which changed room widths and door positions. The patient flow here is still current.
> **Builds on:** [01 — Minimal 3D game (v0)](01-v0-minimal-game.md)
> Written after implementation, to record what was built.

# Clinic & Maternity Ward

## Context
The user asked for two new rooms: a **clinic** and a room for **admitted patients with 6 beds**. The v0 floor (30×20 m) had no free space for them. Both rooms are also connected to the patient flow, so they are part of gameplay rather than decoration.

## Layout
The building is now **40×20 m** (x −20..20, z −10..10). The back row holds four equal 10×10 m rooms, with doorways in the lobby wall at x = −15, −5, 5, 15.

```
z=-10 ┌──────────┬──────────┬──────────┬──────────┐
      │ CLINIC   │  EXAM /  │ DELIVERY │ MATERNITY│
      │ desk,    │ ULTRA-   │ bed,     │ WARD     │
      │ 2 chairs,│ SOUND    │ monitor, │ 6 beds   │
      │ couch    │          │ incubator│ (2 × 3)  │
z=0   ├──door────┴──door────┴──door────┴──door────┤
      │ WAITING (6 chairs)   RECEPTION   NURSE STN│
z=10  └────────────────[entrance]─────────────────┘
     x=-20     -10         0          10        20
```

| Room | Key furniture | Notes |
|---|---|---|
| Clinic | desk + monitor, doctor chair, patient chair (`clinicSeat`), exam couch, bookshelf | patient sits facing the desk |
| Exam / Ultrasound | exam bed (head west), ultrasound cart | moved from x −15..0 to −10..0 |
| Delivery | delivery bed (head east), vitals monitor, incubator | moved from x 0..15 to 0..10 |
| Maternity ward | 6 beds; row A against the back wall, row B in the middle; aisle at z ≈ −7.8..−5 | beds run along z, head north |
| Lobby | 6 waiting chairs, reception, nurse station (moved east to x = 17.5) | |

Ward beds are data in `hospital.wardBeds[]`. Each bed has `lie` (where the patient lies) and `approach` (the path from the ward door to the foot of the bed). Row-A beds route through the gaps between row-B beds (x = 13.5 / 16.5).

## Patient flow
```
arriving → waiting ──(Call to Clinic)──► inClinic ──(Consult, +$80)──┬─► routine check-up ─► home
                                                                     ├─► needsUltrasound ─► onExamBed ─(Scan, +$150)─┬─► home (< 37 wks)
                                                                     │                                               └─► labor ─► onDeliveryBed ─(Deliver, +$500)─► ward (postpartum, 30 s)
                                                                     └─► needsAdmit (preeclampsia) ─► ward (observation, 40 s)

ward: admitted ──(timer; one Ward Round = −10 s)──► readyDischarge ──(Discharge, +$200)──► home
```
- Consult outcome: ultrasound if ≥ 37 weeks, otherwise random. 35% ultrasound, 25% admit, 40% routine.
- If the ward is full after a delivery, the mother goes home instead. Admitting into a full ward shows a warning.
- The clinic, exam bed, delivery bed and each ward bed hold one patient. They are reserved as soon as a patient is sent, so they can't be double-booked.
- `Patients treated` increments whenever a patient goes home.

Tunables in `src/game.js`:
```js
const FEE = { consult: 80, ultrasound: 150, delivery: 500, wardDischarge: 200 };
const WARD_STAY = { observation: 40, postpartum: 30 }; // seconds
```

## Code structure
- **`src/hospital.js`**: new layout. Returns `clinic`, `wardBeds`, `objects.clinicDesk`, and new spots (`clinicDoorOut/In`, `clinicSide`, `clinicSeat`, `wardDoorOut/In`, `westAisle`).
- **`src/game.js`**: flow rewritten around `p.location` (`chair | clinic | exam | delivery | ward`):
  - `moveTo(p, room, …)`: frees the current spot, reserves the target and walks there. Its helpers:
    - `leaveCurrentSpot(p)`: frees the spot and returns the path out to the lobby.
    - `routeInto(room, bed)`: returns the path from the lobby into the room.
  - `settle(p)`: sits or lays the patient down on arrival.
  - `sendHome(p)`: walks the patient to the exit and removes her.
  - `patientPrompt(p)`: the per-state "[E] …" prompt text.
  - Nurse patrol route covers all four rooms plus the waiting area.
- **`src/hud.js`**: new `Ward beds n/6` stat row.
- **`src/main.js`**: camera distance `38 × max(1, 1.6 / aspect)` so the 40 m building fits; shadow camera widened to ±27 × ±20.

NPCs still follow scripted waypoint paths with no pathfinding. Moving a door or bed means updating `spots` / `wardBeds[].approach` in `hospital.js`.

## Verification
A headless Playwright playthrough (dev server + `window.__sim`) drove both paths with real `E` presses:
1. Patient at 39 weeks: clinic → consult → exam → ultrasound → labour → delivery → postpartum ward bed.
2. Patient at 25 weeks (consult forced to the admission outcome): clinic → admit → ward → ward round → recovery → discharge → leaves.

Funds ended at $1,510 (= 500 + 80 + 150 + 500 + 80 + 200), matching the fees. No console errors. `npm run build` passes.
