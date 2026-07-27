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

const bootError = document.getElementById('boot-error');
const bootErrorMsg = document.getElementById('boot-error-msg');

function showBootError(err) {
  console.error(err);
  if (bootError) {
    bootError.classList.remove('hidden');
    if (bootErrorMsg) {
      bootErrorMsg.textContent = (err && (err.message || String(err))) || 'Unknown startup error';
    }
  }
}

function detectQuality() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && window.innerWidth < 1100);
  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 4;
  const low = isMobile || mem <= 4 || cores <= 2 || !gl;
  return {
    isMobile,
    low,
    pixelRatioCap: low ? 1.25 : 2,
    shadows: !low,
    shadowSize: low ? 1024 : 2048,
    bloom: !low,
    antialias: !low,
  };
}

async function boot() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) throw new Error('Missing #game-canvas');

  // Probe WebGL on a throwaway canvas — never touch #game-canvas first
  // (some browsers refuse a second context after WEBGL_lose_context).
  const probe = document.createElement('canvas');
  const testGl = probe.getContext('webgl2', { failIfMajorPerformanceCaveat: false })
    || probe.getContext('webgl', { failIfMajorPerformanceCaveat: false });
  if (!testGl) {
    throw new Error('WebGL is disabled or unavailable in this browser. Enable hardware acceleration and reload.');
  }

  const quality = detectQuality();

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality.antialias,
      powerPreference: quality.low ? 'default' : 'high-performance',
      alpha: false,
      failIfMajorPerformanceCaveat: false,
    });
  } catch (e) {
    throw new Error('Could not create WebGL renderer. Try another browser or update your GPU drivers.');
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatioCap));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x6a9ab8);
  scene.fog = new THREE.FogExp2(0x8eb6c8, 0.008);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 20, 30);

  const sky = makeSkyDome();
  scene.add(sky);

  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envTex = makeEnvMapTexture();
    scene.environment = pmrem.fromEquirectangular(envTex).texture;
    envTex.dispose();
  } catch (e) {
    console.warn('Env map skipped', e);
  }

  const hemi = new THREE.HemisphereLight(0xd8eef8, 0x3a4a30, 0.55);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff0d0, 1.45);
  sun.position.set(-50, 62, 28);
  sun.castShadow = quality.shadows;
  if (quality.shadows) {
    sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -65;
    sun.shadow.camera.right = 65;
    sun.shadow.camera.top = 65;
    sun.shadow.camera.bottom = -65;
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.03;
  }
  scene.add(sun);
  sun.target.position.set(0, 0, -5);
  scene.add(sun.target);

  const fill = new THREE.DirectionalLight(0x88b0d0, 0.4);
  fill.position.set(45, 22, -35);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffb070, 0.32);
  rim.position.set(12, 10, 55);
  scene.add(rim);

  const amb = new THREE.AmbientLight(0x6a8090, quality.low ? 0.35 : 0.18);
  scene.add(amb);

  let composer = null;
  let bloom = null;
  if (quality.bloom) {
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloom = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.12,
        0.4,
        0.92
      );
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
    } catch (e) {
      console.warn('Post-processing disabled', e);
      composer = null;
      bloom = null;
    }
  }

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

  const onResize = () => {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    if (composer) composer.setSize(w, h);
    if (bloom) bloom.setSize(w, h);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 200));
  // iOS Safari visual viewport changes (URL bar show/hide)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onResize);
  }

  window.addEventListener('keydown', (e) => {
    game.onKeyDown(e);
  });

  canvas.addEventListener('click', () => {
    if (game.running && !game.buyOpen) {
      SFX.unlock();
      input.requestLock();
    }
  });

  // Recover from context loss (laptop sleep, GPU switch)
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    showBootError(new Error('Graphics context lost — reload the page.'));
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

    if (composer) composer.render();
    else renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  document.getElementById('boot-splash')?.classList.add('hidden');
}

boot().catch(showBootError);
