import * as THREE from 'three';

/**
 * Registry of things the doctor can interact with.
 * Item shape: { object, position?, range?, promptHeight?, label(): string|null, action() }
 * label() returning null means "nothing to do right now".
 */
export class Interactions {
  constructor() {
    this.items = new Set();
    this.byObject = new WeakMap();
  }

  add(item) {
    item.range ??= 1.8;
    item.promptHeight ??= 2.0;
    if (!item.getPosition) {
      const v = new THREE.Vector3();
      item.getPosition = item.position ? () => item.position : () => item.object.getWorldPosition(v);
    }
    this.items.add(item);
    this.byObject.set(item.object, item);
    return item;
  }

  remove(item) {
    this.items.delete(item);
    this.byObject.delete(item.object);
  }

  /** Closest available item within range of pos. */
  nearest(pos) {
    let best = null;
    let bestD = Infinity;
    for (const it of this.items) {
      if (!it.label()) continue;
      const p = it.getPosition();
      const d = Math.hypot(p.x - pos.x, p.z - pos.z);
      if (d <= it.range && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    return best;
  }

  /** First item hit by a raycaster (checks the hit mesh and its ancestors). */
  pick(raycaster) {
    const objects = [...this.items].map((i) => i.object);
    for (const hit of raycaster.intersectObjects(objects, true)) {
      for (let o = hit.object; o; o = o.parent) {
        const item = this.byObject.get(o);
        if (item) return item;
      }
    }
    return null;
  }
}
