import * as THREE from 'three';
import './style.css';
import { buildHospital } from './hospital.js';
import { createDoctor, createNurse } from './characters.js';
import { Player } from './player.js';
import { Interactions } from './interaction.js';
import { hud } from './hud.js';
import { Game } from './game.js';

// ---------- Renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd9e8);

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9aa8, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(12, 25, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -27, right: 27, top: 20, bottom: -20, near: 1, far: 80 });
sun.shadow.bias = -0.0005;
scene.add(sun);

// ---------- Fixed top-down camera ----------
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
const CAM_TARGET = new THREE.Vector3(0, 0, 0.8);
const CAM_DIR = new THREE.Vector3(0, 1, 0.62).normalize(); // ~58° above the horizon

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  // Back off on narrow screens so the whole floor stays visible.
  const dist = 38 * Math.max(1, 1.6 / camera.aspect);
  camera.position.copy(CAM_TARGET).addScaledVector(CAM_DIR, dist);
  camera.lookAt(CAM_TARGET);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- World ----------
const hospital = buildHospital(scene);

const doctor = createDoctor();
doctor.position.set(...xz(hospital.spots.doctorStart));
doctor.rotation.y = Math.PI;
scene.add(doctor);

const nurse = createNurse();
nurse.position.set(...xz(hospital.spots.nurseHome));
scene.add(nurse);

const player = new Player(doctor, hospital.colliders);
const interactions = new Interactions();
const game = new Game({ scene, hospital, interactions, hud, player, nurse });

if (import.meta.env.DEV) window.__sim = { game, player, doctor, interactions };

function xz([x, z]) {
  return [x, 0, z];
}

// ---------- Input ----------
addEventListener('keydown', (e) => {
  if ((e.code !== 'KeyE' && e.code !== 'Space') || e.repeat) return;
  e.preventDefault();
  if (player.locked) return;
  const item = interactions.nearest(doctor.position);
  if (item) {
    player.target = null;
    item.action();
  }
});

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

const marker = new THREE.Mesh(
  new THREE.RingGeometry(0.2, 0.3, 24),
  new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0 })
);
marker.rotation.x = -Math.PI / 2;
marker.position.y = 0.04;
scene.add(marker);

function showMarker(p) {
  marker.position.x = p.x;
  marker.position.z = p.z;
  marker.material.opacity = 1;
}

function setPointer(e) {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || player.locked) return;
  setPointer(e);
  const item = interactions.pick(raycaster);
  if (item?.label()) {
    const p = item.getPosition();
    showMarker(p);
    player.walkTo(p, item.range - 0.25, () => item.action());
    return;
  }
  const pt = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(floorPlane, pt)) {
    showMarker(pt);
    player.walkTo(pt, 0.08);
  }
});

renderer.domElement.addEventListener('pointermove', (e) => {
  setPointer(e);
  renderer.domElement.style.cursor = interactions.pick(raycaster)?.label() ? 'pointer' : 'default';
});

// ---------- Loop ----------
const clock = new THREE.Clock();
const promptPos = new THREE.Vector3();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  player.update(dt);
  game.update(dt);

  const item = player.locked ? null : interactions.nearest(doctor.position);
  if (item) {
    promptPos.copy(item.getPosition());
    promptPos.y = item.promptHeight;
    promptPos.project(camera);
    hud.showPrompt(
      `<kbd>E</kbd>${item.label()}`,
      (promptPos.x * 0.5 + 0.5) * innerWidth,
      (-promptPos.y * 0.5 + 0.5) * innerHeight
    );
  } else {
    hud.hidePrompt();
  }

  marker.material.opacity = Math.max(0, marker.material.opacity - dt * 1.5);
  renderer.render(scene, camera);
});
