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
import { getGraphicsPreset, resolveQuality, setGraphicsPreset } from './graphics.js';
import { getAccount } from './account.js';
import { NetClient } from './net.js';

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

  let quality = resolveQuality(getGraphicsPreset());

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

  let composer = null;
  let bloom = null;

  function rebuildComposer(q) {
    if (composer) {
      composer.dispose?.();
      composer = null;
      bloom = null;
    }
    if (!q.bloom) return;
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      // Stronger Ultra bloom — spectacle without washing out the map
      bloom = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.34,
        0.52,
        0.82
      );
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
      composer.setSize(window.innerWidth, window.innerHeight);
    } catch (e) {
      console.warn('Post-processing disabled', e);
      composer = null;
      bloom = null;
    }
  }

  function applyRendererQuality(q) {
    quality = q;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatioCap));
    renderer.shadowMap.enabled = q.shadows;
    renderer.toneMappingExposure = q.low ? 1.0 : 1.28;
    if (sun) {
      sun.castShadow = q.shadows;
      sun.intensity = q.low ? 1.2 : 1.72;
      if (q.shadows) {
        sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
        sun.shadow.needsUpdate = true;
      }
    }
    if (amb) amb.intensity = q.low ? 0.35 : 0.12;
    if (hemi) hemi.intensity = q.low ? 0.45 : 0.7;
    if (fill) fill.intensity = q.low ? 0.28 : 0.55;
    if (rim) rim.intensity = q.low ? 0.2 : 0.45;
    rebuildComposer(q);
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatioCap));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = quality.low ? 1.0 : 1.28;
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x6a9ab8);
  scene.fog = new THREE.FogExp2(0x8eb6c8, 0.0072);

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

  const hemi = new THREE.HemisphereLight(0xd8eef8, 0x3a4a30, quality.low ? 0.45 : 0.7);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff0d0, quality.low ? 1.2 : 1.72);
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

  const fill = new THREE.DirectionalLight(0x88b0d0, quality.low ? 0.28 : 0.55);
  fill.position.set(45, 22, -35);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffb070, quality.low ? 0.2 : 0.45);
  rim.position.set(12, 10, 55);
  scene.add(rim);

  const amb = new THREE.AmbientLight(0x6a8090, quality.low ? 0.35 : 0.12);
  scene.add(amb);

  rebuildComposer(quality);

  const inventory = new InventoryService();
  const input = createInput();
  const gameRef = { game: null };
  const net = new NetClient({ account: getAccount() });
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
    get running() { return !!gameRef.game?.running; },
    get netHumans() { return gameRef.game?.netHumans || []; },
    get buyVotes() { return gameRef.game?.buyVotes || {}; },
    startMatch(opts) { gameRef.game.startMatch(opts); },
    closeBuyMenu() { gameRef.game.closeBuyMenu(); },
    buyVehicle(id) { gameRef.game.buyVehicle(id); },
    buyGear(id) { gameRef.game.buyGear(id); },
    castBuyVote(sec) { gameRef.game?.castBuyVote?.(sec); },
    setGraphicsQuality(preset) {
      const saved = setGraphicsPreset(preset);
      return gameRef.game.setGraphicsQuality(saved);
    },
    get quality() { return gameRef.game?.quality; },
  }, inventory, { net });

  const game = new Game({
    scene,
    camera,
    input,
    ui,
    inventory,
    lighting: { sun, hemi },
    quality,
    net,
    onQualityChange: (q) => applyRendererQuality(q),
  });
  gameRef.game = game;

  // Sync Low Poly checkbox after Game exists (createUI runs earlier).
  const lowPolyChk = document.getElementById('chk-low-poly');
  if (lowPolyChk) lowPolyChk.checked = !!game.quality?.low;

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
