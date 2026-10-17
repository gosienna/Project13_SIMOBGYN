import * as THREE from 'three';

const SKIN = 0xf2c9a8;
const materialCache = new Map();

function mat(color) {
  if (!materialCache.has(color)) {
    materialCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.75 }));
  }
  return materialCache.get(color);
}

function mesh(geo, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/**
 * Builds a primitive humanoid. The root group handles position + facing (yaw);
 * the inner rig handles poses (stand / sit / lie). Front of the body is +Z.
 */
function makeHumanoid({ top, bottom, skin = SKIN, shoes = 0x3a3a3a, hair = 0x3b2a20, longHair = false }) {
  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);

  const makeLeg = (x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.8, 0);
    pivot.add(mesh(new THREE.BoxGeometry(0.16, 0.72, 0.18), bottom, 0, -0.36, 0));
    pivot.add(mesh(new THREE.BoxGeometry(0.17, 0.08, 0.26), shoes, 0, -0.76, 0.04));
    rig.add(pivot);
    return pivot;
  };
  const makeArm = (x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.48, 0);
    pivot.add(mesh(new THREE.CapsuleGeometry(0.065, 0.42, 4, 8), top, 0, -0.27, 0));
    pivot.add(mesh(new THREE.SphereGeometry(0.07, 10, 8), skin, 0, -0.56, 0));
    rig.add(pivot);
    return pivot;
  };

  const legL = makeLeg(-0.1);
  const legR = makeLeg(0.1);
  const armL = makeArm(-0.29);
  const armR = makeArm(0.29);

  rig.add(mesh(new THREE.CapsuleGeometry(0.22, 0.42, 4, 14), top, 0, 1.15, 0));
  rig.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 8), skin, 0, 1.6, 0));
  rig.add(mesh(new THREE.SphereGeometry(0.17, 16, 12), skin, 0, 1.76, 0));

  const hairCap = mesh(new THREE.SphereGeometry(0.185, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 1.77, -0.01);
  hairCap.rotation.x = -0.3;
  rig.add(hairCap);
  if (longHair) rig.add(mesh(new THREE.BoxGeometry(0.3, 0.42, 0.1), hair, 0, 1.6, -0.14));

  const eyeGeo = new THREE.SphereGeometry(0.022, 8, 6);
  rig.add(mesh(eyeGeo, 0x222222, -0.06, 1.78, 0.155));
  rig.add(mesh(eyeGeo, 0x222222, 0.06, 1.78, 0.155));

  root.userData = { rig, legL, legR, armL, armR, pose: 'stand', phase: 0, walkAmt: 0 };
  return root;
}

export function createDoctor() {
  const c = makeHumanoid({ top: 0xfafafa, bottom: 0x2f4f7f, hair: 0x1a1a1a });
  const { rig } = c.userData;
  // Lab coat skirt
  rig.add(mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.42, 16), 0xf2f2f2, 0, 0.74, 0));
  // Stethoscope
  const steth = mesh(new THREE.TorusGeometry(0.17, 0.02, 8, 24), 0x333333, 0, 1.5, 0.02);
  steth.rotation.x = Math.PI / 2;
  rig.add(steth);
  rig.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), 0xb0bec5, 0.08, 1.3, 0.21));
  // Selection ring so the player is easy to spot
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.38, 0.46, 32),
    new THREE.MeshBasicMaterial({ color: 0x43a047, transparent: true, opacity: 0.85 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  c.add(ring);
  return c;
}

export function createNurse() {
  const c = makeHumanoid({ top: 0xf48fb1, bottom: 0xec7aa3, hair: 0x5a3825, shoes: 0xffffff });
  const { rig } = c.userData;
  const cap = mesh(new THREE.BoxGeometry(0.26, 0.08, 0.2), 0xffffff, 0, 1.93, 0.02);
  cap.rotation.x = -0.2;
  rig.add(cap);
  rig.add(mesh(new THREE.BoxGeometry(0.1, 0.03, 0.02), 0xe53935, 0, 1.95, 0.125));
  rig.add(mesh(new THREE.BoxGeometry(0.03, 0.08, 0.02), 0xe53935, 0, 1.95, 0.125));
  rig.add(mesh(new THREE.SphereGeometry(0.09, 10, 8), 0x5a3825, 0, 1.8, -0.17));
  return c;
}

export function createPatient({ dress = 0xb39ddb, hair = 0x3b2a20 } = {}) {
  const c = makeHumanoid({ top: dress, bottom: SKIN, hair, longHair: true, shoes: 0x8d6e63 });
  const { rig } = c.userData;
  rig.add(mesh(new THREE.CylinderGeometry(0.26, 0.36, 0.45, 16), dress, 0, 0.6, 0));
  // Pregnant belly
  const belly = mesh(new THREE.SphereGeometry(0.21, 16, 12), dress, 0, 1.02, 0.16);
  belly.scale.set(1, 1, 1.05);
  rig.add(belly);
  return c;
}

export function createBaby(blanket = 0xf8bbd0) {
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.12, 12, 10), blanket, 0, 0.08, 0);
  body.scale.set(1, 0.7, 1.6);
  g.add(body);
  g.add(mesh(new THREE.SphereGeometry(0.075, 12, 10), SKIN, 0, 0.1, 0.2));
  return g;
}

export function setPose(char, pose) {
  const u = char.userData;
  u.pose = pose;
  u.rig.rotation.set(0, 0, 0);
  u.rig.position.set(0, 0, 0);
  for (const limb of [u.legL, u.legR, u.armL, u.armR]) limb.rotation.set(0, 0, 0);

  if (pose === 'sit') {
    u.rig.position.y = -0.27;
    u.legL.rotation.x = u.legR.rotation.x = -Math.PI / 2;
    u.armL.rotation.x = u.armR.rotation.x = -0.5;
  } else if (pose === 'lie') {
    // Rotate so the head points along local -Z and the belly faces up.
    u.rig.rotation.x = -Math.PI / 2;
    u.rig.position.y = 0.92;
  }
}

/** Leg/arm swing + bob while walking; eases back to rest when idle. */
export function animateWalk(char, dt, moving) {
  const u = char.userData;
  if (u.pose !== 'stand') return;
  if (moving) u.phase += dt * 9;
  u.walkAmt += ((moving ? 1 : 0) - u.walkAmt) * Math.min(1, dt * 10);
  const s = Math.sin(u.phase) * 0.55 * u.walkAmt;
  u.legL.rotation.x = s;
  u.legR.rotation.x = -s;
  u.armL.rotation.x = -s * 0.8;
  u.armR.rotation.x = s * 0.8;
  u.rig.position.y = Math.abs(Math.cos(u.phase)) * 0.05 * u.walkAmt;
}

/** Smoothly turns a character to face direction (dx, dz). */
export function faceTowards(char, dx, dz, dt) {
  const target = Math.atan2(dx, dz);
  let diff = target - char.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  char.rotation.y += diff * Math.min(1, dt * 12);
}

function drawLabel(sprite, text) {
  const { canvas, ctx } = sprite.userData;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'bold 30px system-ui, sans-serif';
  const w = Math.min(canvas.width - 4, ctx.measureText(text).width + 32);
  const x = (canvas.width - w) / 2;
  ctx.fillStyle = 'rgba(31, 45, 58, 0.8)';
  ctx.beginPath();
  ctx.roundRect(x, 6, w, 52, 26);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, 33);
  sprite.material.map.needsUpdate = true;
}

/** Floating name tag above a character. */
export function makeLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 64;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(1.8, 0.3, 1);
  sprite.userData = { canvas, ctx: canvas.getContext('2d') };
  drawLabel(sprite, text);
  return sprite;
}

export function setLabelText(sprite, text) {
  drawLabel(sprite, text);
}

export function disposeObject(obj) {
  obj.traverse((o) => {
    o.geometry?.dispose();
    if (o.isSprite) {
      o.material.map?.dispose();
      o.material.dispose();
    }
  });
}
