import * as THREE from 'three';
import { createInput } from './input.js';
import { createUI } from './ui.js';
import { Game } from './game.js';
import { InventoryService } from './inventory.js';
import { SFX } from './audio.js';
import { makeSkyDome } from './textures.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
if (renderer.shadowMap) {
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7eafc8);
scene.fog = new THREE.FogExp2(0x8eb6c8, 0.012);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 20, 30);

scene.add(makeSkyDome());

const hemi = new THREE.HemisphereLight(0xcfe8f8, 0x3a4a38, 0.7);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff0d0, 1.55);
sun.position.set(-45, 55, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 180;
sun.shadow.camera.left = -70;
sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70;
sun.shadow.camera.bottom = -70;
sun.shadow.bias = -0.00025;
scene.add(sun);

const fill = new THREE.DirectionalLight(0x88aacc, 0.35);
fill.position.set(40, 20, -30);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffc089, 0.25);
rim.position.set(10, 8, 50);
scene.add(rim);

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

input.onCommand((line) => {
  game.handleCommand(line);
  if (game.running && !game.buyOpen) input.requestLock();
});

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
let worldT = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  worldT += dt;

  game.map?.update?.(worldT);

  if (game.running) {
    game.update(dt);
  } else {
    idleT += dt;
    camera.position.set(
      Math.sin(idleT * 0.12) * 38,
      16 + Math.sin(idleT * 0.18) * 2.5,
      Math.cos(idleT * 0.12) * 38
    );
    camera.lookAt(0, 1.5, 0);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
