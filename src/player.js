import { animateWalk, faceTowards } from './characters.js';

// The camera is fixed looking north, so screen-up is world -Z.
const KEYMAP = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export class Player {
  constructor(char, colliders) {
    this.char = char;
    this.colliders = colliders;
    this.radius = 0.3;
    this.speed = 4;
    this.keys = new Set();
    this.locked = false; // true while performing an action (scan, delivery)
    this.target = null;
    this.stuckTime = 0;

    addEventListener('keydown', (e) => {
      if (KEYMAP[e.code]) {
        this.keys.add(e.code);
        e.preventDefault();
      }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  /** Walk toward a point; calls onArrive once within stopWithin meters. */
  walkTo(point, stopWithin = 0.1, onArrive = null) {
    this.target = { x: point.x, z: point.z, stopWithin, onArrive };
    this.stuckTime = 0;
  }

  update(dt) {
    let dx = 0;
    let dz = 0;
    let maxStep = Infinity;

    if (!this.locked) {
      for (const k of this.keys) {
        dx += KEYMAP[k][0];
        dz += KEYMAP[k][1];
      }
      if (dx || dz) {
        this.target = null;
      } else if (this.target) {
        const pos = this.char.position;
        const tx = this.target.x - pos.x;
        const tz = this.target.z - pos.z;
        const dist = Math.hypot(tx, tz);
        if (dist <= this.target.stopWithin) {
          const cb = this.target.onArrive;
          this.target = null;
          cb?.();
        } else {
          dx = tx;
          dz = tz;
          maxStep = dist;
        }
      }
    }

    const len = Math.hypot(dx, dz);
    const moving = len > 0;
    if (moving) {
      const pos = this.char.position;
      const bx = pos.x;
      const bz = pos.z;
      const step = Math.min(this.speed * dt, maxStep);
      pos.x += (dx / len) * step;
      pos.z += (dz / len) * step;
      resolveCollisions(pos, this.radius, this.colliders);
      faceTowards(this.char, dx, dz, dt);

      // Give up on click-to-move targets we can't reach.
      if (this.target) {
        const moved = Math.hypot(pos.x - bx, pos.z - bz);
        this.stuckTime = moved < step * 0.25 ? this.stuckTime + dt : 0;
        if (this.stuckTime > 0.3) this.target = null;
      }
    }
    animateWalk(this.char, dt, moving);
  }
}

/** Pushes a circle (pos.x, pos.z, r) out of every axis-aligned box collider. */
export function resolveCollisions(pos, r, colliders) {
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      pos.x += (dx / d) * (r - d);
      pos.z += (dz / d) * (r - d);
    } else {
      // Center is inside the box: push out along the shallowest axis.
      const options = [
        [c.minX - r - pos.x, 0],
        [c.maxX + r - pos.x, 0],
        [0, c.minZ - r - pos.z],
        [0, c.maxZ + r - pos.z],
      ];
      options.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
      pos.x += options[0][0];
      pos.z += options[0][1];
    }
  }
}
