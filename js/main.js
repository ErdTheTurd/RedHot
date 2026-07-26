import * as THREE from 'three';
import { createInput } from './input.js';
import { createUI } from './ui.js';
import { Game } from './game.js';
import { InventoryService } from './inventory.js';
import { SFX } from './audio.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7ea8c0);
scene.fog = new THREE.Fog(0x7ea8c0, 55, 160);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(0, 20, 30);

const hemi = new THREE.HemisphereLight(0xbcd6ea, 0x3a4a38, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 1.35);
sun.position.set(-40, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 160;
sun.shadow.camera.left = -60;
sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
scene.add(sun);

const ridge = new THREE.Mesh(
  new THREE.CylinderGeometry(90, 90, 8, 32, 1, true),
  new THREE.MeshStandardMaterial({ color: 0x4d6358, side: THREE.BackSide, flatShading: true })
);
ridge.position.y = -2;
scene.add(ridge);

const inventory = new InventoryService();
const input = createInput();
const gameRef = { game: null };
const ui = createUI({
  get player() { return gameRef.game?.player; },
  get score() { return gameRef.game?.score || { raiders: 0, sentinels: 0 }; },
  get phase() { return gameRef.game?.phase; },
  get phaseLabel() { return gameRef.game?.phaseLabel || ''; },
  get timer() { return gameRef.game?.timer || 0; },
  get bomb() { return gameRef.game?.bomb || { planted: false }; },
  get units() { return gameRef.game?.units || []; },
  get roundNumber() { return gameRef.game?.roundNumber || 0; },
  startMatch(team) { gameRef.game.startMatch(team); },
  closeBuyMenu() { gameRef.game.closeBuyMenu(); },
  buyVehicle(id) { gameRef.game.buyVehicle(id); },
  buyGear(id) { gameRef.game.buyGear(id); },
}, inventory);

const game = new Game({ scene, camera, input, ui, inventory });
gameRef.game = game;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('keydown', (e) => {
  game.onKeyDown(e);
});

canvas.addEventListener('click', () => {
  if (game.running && !game.buyOpen) {
    SFX.unlock();
    input.requestLock();
  }
});

let idleT = 0;
let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (game.running) {
    game.update(dt);
  } else {
    idleT += dt;
    camera.position.set(
      Math.sin(idleT * 0.15) * 35,
      18 + Math.sin(idleT * 0.2) * 2,
      Math.cos(idleT * 0.15) * 35
    );
    camera.lookAt(0, 1, 0);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
