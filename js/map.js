import * as THREE from 'three';
import { makeNoiseTexture, makeWaterTexture } from './textures.js';

const MAP_SIZE = 120;

export function createMap(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const landTex = makeNoiseTexture(256, { base: [55, 70, 48], variance: 22, grid: false });
  landTex.repeat.set(6, 5);
  const sandTex = makeNoiseTexture(256, { base: [120, 105, 70], variance: 18 });
  sandTex.repeat.set(3, 3);
  const concreteTex = makeNoiseTexture(256, { base: [70, 78, 88], variance: 12, grid: true });
  concreteTex.repeat.set(2, 2);
  const waterTex = makeWaterTexture();

  // Ocean
  const waterMat = new THREE.MeshStandardMaterial({
    map: waterTex,
    color: 0x3a8ab0,
    metalness: 0.85,
    roughness: 0.18,
    transparent: true,
    opacity: 0.95,
  });
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_SIZE * 2.8, MAP_SIZE * 2.8, 48, 48),
    waterMat
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.15;
  water.receiveShadow = true;
  water.name = 'water';
  group.add(water);

  // Mainland
  const landMat = new THREE.MeshStandardMaterial({
    map: landTex,
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.05,
  });
  const land = new THREE.Mesh(new THREE.BoxGeometry(70, 1.2, 55), landMat);
  land.position.set(-5, 0.4, -8);
  land.receiveShadow = true;
  land.castShadow = true;
  group.add(land);

  // Cliff faces along coast
  const cliffMat = new THREE.MeshStandardMaterial({ color: 0x4a5344, roughness: 0.9, flatShading: true });
  for (const [x, z, w, h, d] of [
    [-38, -5, 4, 3, 20],
    [28, -10, 3, 2.5, 16],
    [-10, 18, 18, 1.2, 3],
  ]) {
    const cliff = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cliffMat);
    cliff.position.set(x, h / 2, z);
    cliff.castShadow = true;
    cliff.receiveShadow = true;
    group.add(cliff);
  }

  // Site islands
  const sandMat = new THREE.MeshStandardMaterial({ map: sandTex, color: 0xffffff, roughness: 0.88 });
  const siteA = new THREE.Mesh(new THREE.CylinderGeometry(10, 12, 1.0, 16), sandMat);
  siteA.position.set(-28, 0.3, 22);
  siteA.receiveShadow = true;
  group.add(siteA);
  const siteB = new THREE.Mesh(new THREE.CylinderGeometry(9, 11, 1.0, 16), sandMat);
  siteB.position.set(30, 0.3, 18);
  siteB.receiveShadow = true;
  group.add(siteB);

  // Causeways / docks
  const dockMat = new THREE.MeshStandardMaterial({ map: concreteTex, color: 0xffffff, roughness: 0.7, metalness: 0.2 });
  const bridgeA = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 18), dockMat);
  bridgeA.position.set(-18, 0.15, 8);
  bridgeA.receiveShadow = true;
  group.add(bridgeA);
  const bridgeB = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 16), dockMat);
  bridgeB.position.set(18, 0.15, 6);
  bridgeB.receiveShadow = true;
  group.add(bridgeB);

  // Runway markings near hangars
  const markMat = new THREE.MeshBasicMaterial({ color: 0xe8e0c8 });
  for (let i = -3; i <= 3; i++) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.35), markMat);
    mark.position.set(i * 4, 1.02, -30);
    group.add(mark);
  }

  // Cover / buildings
  const coverMat = new THREE.MeshStandardMaterial({
    map: concreteTex,
    color: 0xb0b8c2,
    metalness: 0.35,
    roughness: 0.55,
  });
  const rustMat = new THREE.MeshStandardMaterial({ color: 0x8a5a3a, metalness: 0.45, roughness: 0.55 });
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x89d2ff,
    emissive: 0x3a80b0,
    emissiveIntensity: 0.45,
    metalness: 0.8,
    roughness: 0.2,
  });

  const covers = [
    [-20, 1.5, -15, 6, 3, 4],
    [-8, 1.2, -22, 4, 2.4, 8],
    [10, 1.8, -18, 5, 3.6, 5],
    [22, 1.4, -6, 3, 2.8, 7],
    [-30, 1.2, -5, 4, 2.4, 4],
    [5, 1.0, 5, 8, 2, 2],
    [-12, 1.5, 2, 2, 3, 6],
    [14, 1.5, -2, 2, 3, 6],
    [-26, 1.0, 22, 3, 2, 3],
    [28, 1.0, 18, 3, 2, 3],
  ];
  for (const [x, y, z, w, h, d] of covers) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), coverMat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    // window panels
    if (h > 2.2 && w > 3) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, h * 0.25, 0.08), windowMat);
      win.position.set(x, y + h * 0.15, z - d / 2 - 0.02);
      group.add(win);
    }
  }

  // Cargo crates
  for (const [x, z] of [[-16, -10], [8, -8], [-4, 4], [20, 2], [-24, 16]]) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), rustMat);
    crate.position.set(x, 1.6, z);
    crate.rotation.y = Math.random() * 0.5;
    crate.castShadow = true;
    group.add(crate);
  }

  // Hangars
  const hangarMat = new THREE.MeshStandardMaterial({ color: 0x3a4552, metalness: 0.55, roughness: 0.45 });
  for (const x of [-16, 0, 16]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 1.2), hangarMat);
    h.position.set(x, 2.5, -28);
    h.castShadow = true;
    group.add(h);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.35, 6), hangarMat);
    roof.position.set(x, 5.1, -25.5);
    roof.castShadow = true;
    group.add(roof);
  }

  // Antenna towers
  const metal = new THREE.MeshStandardMaterial({ color: 0x667788, metalness: 0.8, roughness: 0.3 });
  for (const [x, z] of [[-32, -20], [24, -22]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 8, 6), metal);
    pole.position.set(x, 5, z);
    pole.castShadow = true;
    group.add(pole);
    const dish = new THREE.Mesh(new THREE.CircleGeometry(1.2, 16), metal);
    dish.position.set(x, 8.5, z);
    dish.rotation.x = -0.8;
    group.add(dish);
  }

  // Site markers
  const sites = {
    A: new THREE.Vector3(-28, 0.9, 22),
    B: new THREE.Vector3(30, 0.9, 18),
  };

  for (const [label, pos] of Object.entries(sites)) {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.2, 0.18, 24),
      new THREE.MeshStandardMaterial({
        color: label === 'A' ? 0xe85d04 : 0x1d9bf0,
        emissive: label === 'A' ? 0xe85d04 : 0x1d9bf0,
        emissiveIntensity: 0.45,
        metalness: 0.4,
        roughness: 0.4,
      })
    );
    pad.position.copy(pos);
    group.add(pad);

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#d7e4ec';
    ctx.font = 'bold 90px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 64, 64);
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sprite.position.set(pos.x, 4.5, pos.z);
    sprite.scale.set(4, 4, 1);
    group.add(sprite);
  }

  // Soft ground grid (subtle)
  const grid = new THREE.GridHelper(MAP_SIZE, 50, 0x2a3a48, 0x1a2834);
  grid.position.y = 0.03;
  grid.material.opacity = 0.22;
  grid.material.transparent = true;
  group.add(grid);

  // Distant buoy lights
  const buoyMat = new THREE.MeshStandardMaterial({ color: 0xff6644, emissive: 0xff3311, emissiveIntensity: 0.8 });
  for (const [x, z] of [[-48, 30], [50, 28], [-45, -35], [48, -30]]) {
    const buoy = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.2, 8), buoyMat);
    buoy.position.set(x, 0.4, z);
    group.add(buoy);
  }

  return {
    group,
    sites,
    water,
    colliders: covers.map(([x, y, z, w, h, d]) => ({
      min: new THREE.Vector3(x - w / 2, 0, z - d / 2),
      max: new THREE.Vector3(x + w / 2, h * 2, z + d / 2),
      center: new THREE.Vector3(x, y, z),
      half: new THREE.Vector3(w / 2, h / 2, d / 2),
    })),
    isWater(x, z) {
      const onLand =
        (x > -40 && x < 30 && z > -35.5 && z < 19.5) ||
        (Math.hypot(x + 28, z - 22) < 11) ||
        (Math.hypot(x - 30, z - 18) < 10) ||
        (x > -22 && x < -14 && z > -1 && z < 17) ||
        (x > 14 && x < 22 && z > -2 && z < 14);
      return !onLand;
    },
    update(t) {
      if (this.water?.material?.map) {
        this.water.material.map.offset.x = t * 0.02;
        this.water.material.map.offset.y = t * 0.015;
      }
      // gentle vertex swell (skip normals every frame for perf)
      const pos = this.water?.geometry?.attributes?.position;
      if (pos) {
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const y = pos.getY(i);
          pos.setZ(i, Math.sin(x * 0.08 + t * 1.5) * 0.22 + Math.cos(y * 0.07 + t * 1.2) * 0.18);
        }
        pos.needsUpdate = true;
      }
    },
  };
}

export function getSpawns(team) {
  if (team === 'raiders') {
    return [
      { x: -8, y: 0.15, z: -32, yaw: 0 },
      { x: 0, y: 0.15, z: -34, yaw: 0 },
      { x: 8, y: 0.15, z: -32, yaw: 0 },
      { x: -14, y: 0.15, z: -30, yaw: 0.2 },
      { x: 14, y: 0.15, z: -30, yaw: -0.2 },
    ];
  }
  return [
    { x: -24, y: 0.15, z: 26, yaw: Math.PI },
    { x: -30, y: 0.15, z: 20, yaw: Math.PI },
    { x: 26, y: 0.15, z: 22, yaw: Math.PI },
    { x: 32, y: 0.15, z: 16, yaw: Math.PI },
    { x: 4, y: 0.15, z: 10, yaw: Math.PI },
  ];
}

export { MAP_SIZE };
