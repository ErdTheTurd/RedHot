import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createInput } from './input.js';
import { createUI } from './ui.js';
import { Game } from './game.js';
import { InventoryService } from './inventory.js';
import { SFX } from './audio.js';
import { makeSkyDome, makeEnvMapTexture } from './textures.js';

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
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x6a9ab8);
scene.fog = new THREE.FogExp2(0x8eb6c8, 0.008);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 20, 30);

const sky = makeSkyDome();
scene.add(sky);

// Image-based lighting so steel / glass / water actually reflect
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
const envTex = makeEnvMapTexture();
scene.environment = pmrem.fromEquirectangular(envTex).texture;
envTex.dispose();

const hemi = new THREE.HemisphereLight(0xd8eef8, 0x3a4a30, 0.55);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff0d0, 1.45);
sun.position.set(-50, 62, 28);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 2;
sun.shadow.camera.far = 200;
sun.shadow.camera.left = -65;
sun.shadow.camera.right = 65;
sun.shadow.camera.top = 65;
sun.shadow.camera.bottom = -65;
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 0.03;
scene.add(sun);
sun.target.position.set(0, 0, -5);
scene.add(sun.target);

const fill = new THREE.DirectionalLight(0x88b0d0, 0.4);
fill.position.set(45, 22, -35);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffb070, 0.32);
rim.position.set(12, 10, 55);
scene.add(rim);

// Ambient fill so shadowed pockets stay readable
const amb = new THREE.AmbientLight(0x6a8090, 0.18);
scene.add(amb);

// Post: subtle bloom for muzzle / explosions / emissives
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.12,
  0.4,
  0.92
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const inventory = new InventoryService();
const input = createInput();
const gameRef = { game: null };
const ui = createUI({
  get player() { return gameRef.game?.player; },
  get score() { return gameRef.game?.score || { raiders: 0, sentinels: 0 }; },
  get frags() { return gameRef.game?.frags || { raiders: 0, sentinels: 0 }; },
  get waveKills() { return gameRef.game?.waveKills || 0; },
  get mode() { return gameRef.game?.mode; },
  get modeId() { return gameRef.game?.modeId; },
  get mapId() { return gameRef.game?.mapId; },
  get phase() { return gameRef.game?.phase; },
  get phaseLabel() { return gameRef.game?.phaseLabel || ''; },
  get timer() { return gameRef.game?.timer || 0; },
  get bomb() { return gameRef.game?.bomb || { planted: false }; },
  get units() { return gameRef.game?.units || []; },
  get roundNumber() { return gameRef.game?.roundNumber || 0; },
  get input() { return input; },
  get profile() { return inventory.profile; },
  startMatch(opts) { gameRef.game.startMatch(opts); },
  closeBuyMenu() { gameRef.game.closeBuyMenu(); },
  buyVehicle(id) { gameRef.game.buyVehicle(id); },
  buyGear(id) { gameRef.game.buyGear(id); },
}, inventory);

const game = new Game({
  scene,
  camera,
  input,
  ui,
  inventory,
  lighting: { sun, hemi },
});
gameRef.game = game;

input.onCommand((line) => {
  game.handleCommand(line);
  if (game.running && !game.buyOpen) input.requestLock();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.setSize(window.innerWidth, window.innerHeight);
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
    if (game.player?.mesh) {
      sun.target.position.lerp(game.player.mesh.position, 0.04);
      sun.target.updateMatrixWorld();
    }
  } else {
    idleT += dt;
    camera.position.set(
      Math.sin(idleT * 0.1) * 42,
      18 + Math.sin(idleT * 0.16) * 3,
      Math.cos(idleT * 0.1) * 42
    );
    camera.lookAt(0, 2, -4);
  }

  composer.render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
