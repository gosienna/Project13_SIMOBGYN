> **Status:** Implemented 2026-10-17
> **Builds on:** [02 — Clinic & Maternity Ward](02-clinic-and-maternity-ward.md). This doc replaces 02's room widths and door positions; 02's patient flow is unchanged.

# Smaller Exam & Delivery, Larger Maternity Ward

## Context
The user asked to make the Exam and Delivery rooms smaller and the Maternity Ward larger. In 02 all four back-row rooms were 10 m wide, so the 6-bed ward was cramped while the single-bed exam and delivery rooms had a lot of empty floor. The building's outer size (40×20 m) and the clinic stay the same.

## Layout
| Room | 02 (x range, width) | 03 (x range, width) | Door (x) |
|---|---|---|---|
| Clinic | −20..−10 (10 m) | −20..−10 (10 m), unchanged | −15 |
| Exam / Ultrasound | −10..0 (10 m) | **−10..−2.5 (7.5 m)** | −5 → **−6** |
| Delivery | 0..10 (10 m) | **−2.5..5 (7.5 m)** | 5 → **1** |
| Maternity ward | 10..20 (10 m) | **5..20 (15 m)** | 15 → **12.5** |

```
z=-10 ┌──────────┬───────┬───────┬────────────────┐
      │ CLINIC   │ EXAM  │DELIV- │ MATERNITY WARD │
      │          │ ULTRA │ ERY   │  A1   A2   A3  │
      │          │       │       │  B1   B2   B3  │
z=0   ├──door────┴─door──┴door───┴─────door───────┤
      │ WAITING            RECEPTION   NURSE STN  │
z=10  └───────────────[entrance]──────────────────┘
     x=-20     -10    -2.5     5               20
```

- **Exam:** the same furniture moved into the narrower room: bed centered at x −6.5, ultrasound cart at −8.1, desk at −4, cabinet at −8.5.
- **Delivery:** bed at x 1.5 (head east), monitor at 3.1, incubator at 4, cabinet at −1.2, sink at 1.5.
- **Ward:** still 2 rows × 3 beds, now at x = 8, 12.5 and 17 (4.5 m apart instead of 3 m).
  - Every bed has its own bedside table.
  - Row-A beds are reached through the gaps between row-B beds, at x = 10.25 and 14.75.
  - Row B's middle bed (x = 12.5) lines up with the ward door.

## Code changes
- **`src/hospital.js`**:
  - floor rectangles, lobby wall segments and divider positions (`[-10, -2.5, 5]`);
  - furniture coordinates for the exam room, delivery room and ward;
  - ward bed `x` list and the `gap` rule;
  - spots: `examDoor*`, `examBedSide/Lie`, `deliveryDoor*`, `deliveryBedSide/Lie`, `wardDoor*` and `babyCrib`.
- **`src/game.js`**: three of Nurse Amy's patrol points moved to match the new rooms. No flow or fee changes.
- Camera, HUD and the patient flow are unchanged.

## Verification
- The headless Playwright playthrough from 02 was rerun with the ultrasound and delivery-bed positions updated. Both paths pass (clinic → ultrasound → labour → delivery → postpartum ward; clinic → admit → ward round → discharge).
- Funds ended at $1,510 as expected, with no console errors. `npm run build` passes.
- Screenshot check: all furniture sits inside its room, and patients route through the new doorways.
