import * as THREE from 'three';

// Floor plan (top-down, +X right, +Z toward camera):
//   x: -20..20, z: -10..10
//   North row (x widths): Clinic 10 | Exam / Ultrasound 7.5 | Delivery 7.5 | Maternity ward 15 (6 beds)
//   South half: Lobby — waiting area, reception, nurse station; entrance at z = 10
const WALL_T = 0.3;
const WALL_COLOR = 0xf3efe7;
const TRIM_COLOR = 0x9fb7c9;

export function buildHospital(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];

  /** Axis-aligned box resting on y=baseY, centered at (x, z). */
  function box(w, h, d, color, x, baseY, z, { collide = true, material } = {}) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      material ?? new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
    );
    m.position.set(x, baseY + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    if (collide) colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return m;
  }

  function wall(x1, z1, x2, z2, h) {
    const horizontal = z1 === z2;
    const w = horizontal ? Math.abs(x2 - x1) + WALL_T : WALL_T;
    const d = horizontal ? WALL_T : Math.abs(z2 - z1) + WALL_T;
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    box(w, h, d, WALL_COLOR, cx, 0, cz);
    box(w + 0.02, 0.06, d + 0.02, TRIM_COLOR, cx, h, cz, { collide: false });
  }

  function floor(x1, z1, x2, z2, color, y = 0.01) {
    const w = x2 - x1;
    const d = z2 - z1;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({ map: tileTexture(color, w, d), roughness: 0.9 })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x1 + w / 2, y, z1 + d / 2);
    m.receiveShadow = true;
    group.add(m);
  }

  function floorLabel(text, x, z, width = 4.5) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    let size = 54;
    do ctx.font = `bold ${size--}px system-ui, sans-serif`;
    while (ctx.measureText(text).width > 496);
    ctx.fillStyle = 'rgba(60, 80, 100, 0.55)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 48);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(width, (width * 96) / 512),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.03, z);
    group.add(m);
  }

  function plant(x, z) {
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.2, 0.4, 12),
      new THREE.MeshStandardMaterial({ color: 0xc0704a })
    );
    pot.position.set(x, 0.2, z);
    const leaves = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.42, 1),
      new THREE.MeshStandardMaterial({ color: 0x4caf50, flatShading: true })
    );
    leaves.position.set(x, 0.75, z);
    for (const m of [pot, leaves]) {
      m.castShadow = true;
      group.add(m);
    }
    colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
  }

  // ---------- Ground & floors ----------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 80),
    new THREE.MeshStandardMaterial({ color: 0x9cc788, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  group.add(ground);

  floor(-2.5, 10, 2.5, 16, 0xcfcfcf, 0.0); // sidewalk
  floor(-20, 0, 20, 10, 0xece2d0); // lobby
  floor(-20, -10, -10, 0, 0xf6efd2); // clinic
  floor(-10, -10, -2.5, 0, 0xd8efe5); // exam room
  floor(-2.5, -10, 5, 0, 0xf8e1ea); // delivery room
  floor(5, -10, 20, 0, 0xe6e1f3); // ward
  floor(15, 0.15, 20, 4.3, 0xdbe8f5, 0.015); // nurse station
  box(3, 0.02, 1.2, 0x5d6d7e, 0, 0, 9.3, { collide: false }); // door mat

  // ---------- Walls ----------
  wall(-20, -10, 20, -10, 2.6); // north (back) wall
  wall(-20, -10, -20, 10, 2.2); // west
  wall(20, -10, 20, 10, 2.2); // east
  wall(-20, 10, -1.5, 10, 0.6); // south — low cut-away so the camera sees in
  wall(1.5, 10, 20, 10, 0.6);
  // Interior wall between the lobby and the four rooms; doorways at x = -15, -6, 1, 12.5
  wall(-20, 0, -16, 0, 1.4);
  wall(-14, 0, -7, 0, 1.4);
  wall(-5, 0, 0, 0, 1.4);
  wall(2, 0, 11.5, 0, 1.4);
  wall(13.5, 0, 20, 0, 1.4);
  for (const x of [-10, -2.5, 5]) wall(x, -10, x, 0, 2.0); // room dividers
  // Keep the player from walking out the front door.
  colliders.push({ minX: -1.5, maxX: 1.5, minZ: 10, maxZ: 10.4 });

  // ---------- Clinic (x -20..-10) ----------
  const clinicDesk = box(2.2, 0.75, 1.0, 0xb08860, -15, 0, -7);
  box(0.6, 0.4, 0.05, 0x222222, -15, 0.75, -7.35, { collide: false });
  box(0.5, 0.45, 0.5, 0x555555, -15, 0, -8.1); // doctor's chair
  box(0.5, 0.5, 0.08, 0x444444, -15, 0.45, -8.33, { collide: false });
  box(0.5, 0.45, 0.5, 0x4f9da6, -15, 0, -5.7); // patient's chair
  box(0.5, 0.5, 0.08, 0x3d7f87, -15, 0.45, -5.48, { collide: false });
  box(0.8, 0.55, 1.9, 0x80b3b0, -18.5, 0, -4); // exam couch
  box(0.7, 0.1, 0.4, 0xffffff, -18.5, 0.55, -4.7, { collide: false });
  box(2.4, 1.8, 0.4, 0x8d6e63, -17, 0, -9.65); // bookshelf
  [0xe57373, 0x64b5f6, 0xffd54f].forEach((c, i) =>
    box(2.0, 0.3, 0.05, c, -17, 0.3 + i * 0.5, -9.43, { collide: false })
  );
  plant(-10.9, -9.3);
  floorLabel('CLINIC', -12.5, -1.6, 4);

  // ---------- Exam / Ultrasound room (x -10..-2.5) ----------
  const examBed = box(2.0, 0.5, 0.9, 0x7f93a8, -6.5, 0, -6);
  box(2.0, 0.2, 0.9, 0xe9f1f7, -6.5, 0.5, -6, { collide: false });
  box(0.4, 0.1, 0.7, 0xffffff, -7.25, 0.7, -6, { collide: false });

  const ultrasound = box(0.6, 0.8, 0.5, 0xdde5ee, -8.1, 0, -4.9);
  box(0.6, 0.06, 0.5, 0x9aa9b8, -8.1, 0.8, -4.9, { collide: false });
  box(0.06, 0.4, 0.06, 0x78909c, -8.1, 0.86, -5.05, { collide: false });
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x1b1f24, emissive: 0x000000 });
  const ultrasoundScreen = box(0.55, 0.4, 0.05, 0, -8.1, 1.06, -5.05, { collide: false, material: screenMat });

  box(2, 0.75, 0.9, 0xb08860, -4, 0, -8.6); // desk
  box(0.6, 0.4, 0.05, 0x222222, -4, 0.75, -8.9, { collide: false });
  box(0.5, 0.45, 0.5, 0x555555, -4, 0, -7.7); // desk chair
  box(2.2, 1.8, 0.5, 0xd7e3ea, -8.5, 0, -9.6); // cabinet
  floorLabel('EXAM · ULTRASOUND', -6.25, -1.6, 4);

  // ---------- Delivery room (x -2.5..5) ----------
  const deliveryBed = box(2.0, 0.5, 0.9, 0xc98aa5, 1.5, 0, -6);
  box(2.0, 0.2, 0.9, 0xfbeff3, 1.5, 0.5, -6, { collide: false });
  box(0.4, 0.1, 0.7, 0xffffff, 2.25, 0.7, -6, { collide: false });

  box(0.3, 1.2, 0.3, 0x90a4ae, 3.1, 0, -7.1); // vitals monitor
  box(0.55, 0.4, 0.05, 0, 3.1, 1.2, -7.1, {
    collide: false,
    material: new THREE.MeshStandardMaterial({ color: 0x0d1f12, emissive: 0x2e7d32, emissiveIntensity: 0.7 }),
  });

  const incubator = box(1.1, 0.75, 0.65, 0xe0e0e0, 4, 0, -8.6);
  box(0.9, 0.05, 0.5, 0xffffff, 4, 0.75, -8.6, { collide: false });
  box(1.0, 0.4, 0.6, 0, 4, 0.75, -8.6, {
    collide: false,
    material: new THREE.MeshStandardMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.3, depthWrite: false }),
  });

  box(2.2, 1.8, 0.5, 0xf3e5ec, -1.2, 0, -9.6); // supplies cabinet
  box(1.5, 0.9, 0.6, 0xcfd8dc, 1.5, 0, -9.55); // sink counter
  plant(4.3, -0.8);
  floorLabel('DELIVERY', 2.5, -1.6, 3.5);

  // ---------- Maternity ward (x 5..20): 6 beds, heads against the wall ----------
  // Row A sits against the back wall, row B in the middle; the aisle between them is z -7.8..-5.
  const wardBeds = [];
  for (const [row, z] of [['A', -8.85], ['B', -4]]) {
    for (const x of [8, 12.5, 17]) {
      const mesh = box(0.9, 0.5, 2.0, 0x9575cd, x, 0, z);
      box(0.9, 0.2, 2.0, 0xf5f2fb, x, 0.5, z, { collide: false });
      box(0.7, 0.1, 0.4, 0xffffff, x, 0.7, z - 0.75, { collide: false });
      box(0.5, 0.6, 0.5, 0xd1c4e9, x + 0.85, 0, z - 0.75); // bedside table
      const gap = x <= 12.5 ? 10.25 : 14.75; // gap between row-B beds leading to the aisle
      const side = row === 'A' ? [x, -7.35] : [x, -2.5];
      wardBeds.push({
        mesh,
        occupant: null,
        lie: { x, z: z + 0.9, yaw: 0 },
        // Path from the ward door to the foot of this bed (last point = where she stands).
        approach: row === 'A' ? [[gap, -2.2], [gap, -6.4], side] : [side],
      });
    }
  }
  plant(5.7, -9.3);
  plant(19.3, -0.8);
  floorLabel('MATERNITY WARD', 16.5, -1.6, 4);

  // ---------- Lobby ----------
  const reception = box(3.2, 1.0, 0.8, 0x5b7fa8, 4.5, 0, 6.5);
  box(3.4, 0.06, 1.0, 0xf0f0f0, 4.5, 1.0, 6.5, { collide: false });
  box(0.6, 0.4, 0.05, 0x222222, 4.5, 1.06, 6.25, { collide: false });
  floorLabel('RECEPTION', 4.5, 8.4, 3.5);

  const chairs = [];
  for (const x of [-14.4, -13, -11.6, -10.2, -8.8, -7.4]) {
    box(0.6, 0.45, 0.55, 0x4f9da6, x, 0, 5);
    box(0.6, 0.55, 0.1, 0x3d7f87, x, 0.45, 4.75, { collide: false });
    chairs.push({ x, z: 5.0, occupant: null });
  }
  floorLabel('WAITING AREA', -10.9, 7.4);

  box(3.5, 1.0, 0.6, 0x6aa4c8, 17.5, 0, 3.5); // nurse station counter
  box(3.7, 0.06, 0.8, 0xf0f0f0, 17.5, 1.0, 3.5, { collide: false });
  box(0.6, 0.4, 0.05, 0x222222, 17.5, 1.06, 3.3, { collide: false });
  floorLabel('NURSE STATION', 17.5, 4.9, 3.8);

  plant(-19.3, 9.3);
  plant(19.3, 9.3);
  plant(-19.3, 0.8);

  return {
    group,
    colliders,
    chairs,
    wardBeds,
    clinic: { occupant: null },
    examBed: { mesh: examBed, occupant: null },
    deliveryBed: { mesh: deliveryBed, occupant: null },
    objects: { clinicDesk, ultrasound, ultrasoundScreen, incubator, reception },
    spots: {
      entrance: [0, 13],
      entranceInside: [0, 9],
      receptionFront: [4.5, 7.6],
      westAisle: -16.2, // x of the aisle west of the chair row
      lobbyCenter: [1.5, 4],
      clinicDoorOut: [-15, 1.3],
      clinicDoorIn: [-15, -1.3],
      clinicSide: [-15, -4.9],
      clinicSeat: { x: -15, z: -5.7, yaw: Math.PI },
      examDoorOut: [-6, 1.3],
      examDoorIn: [-6, -1.3],
      examBedSide: [-5.9, -4.85],
      examBedLie: { x: -5.6, z: -6, yaw: Math.PI / 2 },
      deliveryDoorOut: [1, 1.3],
      deliveryDoorIn: [1, -1.3],
      deliveryBedSide: [0.9, -4.9],
      deliveryBedLie: { x: 0.6, z: -6, yaw: -Math.PI / 2 },
      wardDoorOut: [12.5, 1.3],
      wardDoorIn: [12.5, -1.3],
      nurseHome: [17.5, 2.5],
      doctorStart: [0, 6],
      babyCrib: new THREE.Vector3(4, 0.8, -8.6),
    },
  };
}

function tileTexture(color, w, d) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const base = new THREE.Color(color);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = `#${base.clone().multiplyScalar(0.9).getHexString()}`;
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(w / 1.2, d / 1.2);
  return tex;
}
