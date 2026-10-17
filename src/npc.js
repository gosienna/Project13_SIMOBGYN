import * as THREE from 'three';
import { animateWalk, faceTowards, setPose } from './characters.js';

/**
 * Follows a scripted path. Path entries are [x, z] waypoints or a number
 * (seconds to pause). NPCs ignore colliders, so paths must route through doors.
 */
export class Walker {
  constructor(char, speed = 2) {
    this.char = char;
    this.speed = speed;
    this.path = [];
    this.onArrive = null;
  }

  go(points, onArrive = null) {
    setPose(this.char, 'stand');
    this.path = points.map((p) => (typeof p === 'number' ? { wait: p } : new THREE.Vector3(p[0], 0, p[1])));
    this.onArrive = onArrive;
  }

  get moving() {
    return this.path.length > 0;
  }

  update(dt) {
    const next = this.path[0];
    if (!next) {
      animateWalk(this.char, dt, false);
      return;
    }

    if (next.wait !== undefined) {
      next.wait -= dt;
      animateWalk(this.char, dt, false);
      if (next.wait <= 0) this.advance();
      return;
    }

    const pos = this.char.position;
    const dx = next.x - pos.x;
    const dz = next.z - pos.z;
    const dist = Math.hypot(dx, dz);
    const step = this.speed * dt;
    if (dist > 1e-4) faceTowards(this.char, dx, dz, dt);
    if (dist <= step) {
      pos.x = next.x;
      pos.z = next.z;
      this.advance();
    } else {
      pos.x += (dx / dist) * step;
      pos.z += (dz / dist) * step;
    }
    animateWalk(this.char, dt, true);
  }

  advance() {
    this.path.shift();
    if (!this.path.length && this.onArrive) {
      const cb = this.onArrive;
      this.onArrive = null;
      cb();
    }
  }
}
