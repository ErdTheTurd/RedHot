import * as THREE from 'three';
import {
  makeNoiseTexture,
  makeWaterTexture,
  makeTerrainTexture,
  makeAsphaltTexture,
  makePanelNormalMap,
} from './textures.js';

const MAP_SIZE = 120;

const THEMES = {
  harbor: {
    id: 'harbor',
    landBase: [55, 70, 48],
    sandBase: [145, 125, 85],
    waterColor: 0x2a7aa0,
    concrete: 0xc8d0da,
    cliff: 0x4a5344,
    fog: 0x8eb6c8,
    fogDensity: 0.008,
    bg: 0x6a9ab8,
    hemiSky: 0xd8eef8,
    hemiGround: 0x3a4a30,
    sun: 0xfff0d0,
    sunIntensity: 1.45,
    night: false,
  },
  desert: {
    id: 'desert',
    landBase: [160, 120, 70],
    sandBase: [190, 150, 90],
    waterColor: 0x3a9aaa,
    concrete: 0xc4b49a,
    cliff: 0xa87848,
    fog: 0xd8c090,
    fogDensity: 0.007,
    bg: 0xc8a868,
    hemiSky: 0xffe6b8,
    hemiGround: 0x8a6030,
    sun: 0xffe0a0,
    sunIntensity: 1.7,
    night: false,
  },
  arctic: {
    id: 'arctic',
    landBase: [210, 220, 230],
    sandBase: [230, 235, 240],
    waterColor: 0x1a4058,
    concrete: 0xd0d8e0,
    cliff: 0x8a9aaa,
    fog: 0xc8d8e8,
    fogDensity: 0.009,
    bg: 0xa8c0d8,
    hemiSky: 0xe8f4ff,
    hemiGround: 0x607080,
    sun: 0xf0f6ff,
    sunIntensity: 1.25,
    night: false,
  },
  night: {
    id: 'night',
    landBase: [28, 32, 40],
    sandBase: [50, 48, 42],
    waterColor: 0x0a2030,
    concrete: 0x3a4450,
    cliff: 0x2a3038,
    fog: 0x101820,
    fogDensity: 0.014,
    bg: 0x0a1018,
    hemiSky: 0x203048,
    hemiGround: 0x101018,
    sun: 0x8899bb,
    sunIntensity: 0.55,
    night: true,
  },
};

/** East–west river through the mainland + north fork. Same water body as the ocean. */
export function riverCenterZ(x) {
  return 4 + Math.sin(x * 0.08) * 1.4;
}

export function riverHalfWidth(x) {
  let hw = 3.55;
  // Flare into ocean at mouths so the channel reads continuous
  if (x > 28) hw += Math.min(5, (x - 28) * 0.55);
  if (x < -38) hw += Math.min(5, (-38 - x) * 0.55);
  return hw;
}

export function inRiver(x, z) {
  const cz = riverCenterZ(x);
  const hw = riverHalfWidth(x);
  if (x > -48 && x < 42 && Math.abs(z - cz) < hw) return true;
  // North fork toward site-A waters
  if (x > -34 && x < -24 && z > cz && z < 20) return true;
  return false;
}

/** Land bridges over the river — tanks can cross, ships still treat as water. */
export function onRiverBridge(x, z) {
  return (Math.abs(x + 6) < 2.9 && Math.abs(z - 4) < 5.2)
    || (Math.abs(x - 12) < 2.9 && Math.abs(z - 3.5) < 5.2);
}

function std(opts) {
  return new THREE.MeshStandardMaterial({
    color: opts.color ?? 0xffffff,
    map: opts.map ?? null,
    normalMap: opts.normalMap ?? null,
    metalness: opts.metalness ?? 0.2,
    roughness: opts.roughness ?? 0.7,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    flatShading: !!opts.flat,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    envMapIntensity: opts.envMapIntensity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
}

function shadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createMap(scene, mapId = 'ironfront', quality = null) {
  const themeKey = ({
    ironfront: 'harbor',
    dustfall: 'desert',
    frostbite: 'arctic',
    blacksite: 'night',
  })[mapId] || 'harbor';
  const theme = THEMES[themeKey];
  const q = quality || { low: false, waterSeg: 64, landStep: 2.5, propDensity: 1, flatLand: false, animateWater: true, detailMeshes: true };

  const group = new THREE.Group();
  scene.add(group);

  const panelNrm = makePanelNormalMap(q.low ? 128 : 256);
  const landTex = (q.low || theme.id !== 'harbor')
    ? makeNoiseTexture(q.low ? 256 : 512, { base: theme.landBase, variance: theme.night ? 14 : 22 })
    : makeTerrainTexture();
  landTex.repeat.set(q.low ? 5 : 7, q.low ? 4 : 5);
  const sandTex = makeNoiseTexture(q.low ? 128 : 256, { base: theme.sandBase, variance: 22 });
  sandTex.repeat.set(4, 4);
  const concreteTex = makeNoiseTexture(256, { base: [78, 84, 92], variance: 14, grid: true });
  concreteTex.repeat.set(2, 2);
  const rustTex = makeNoiseTexture(128, { base: [110, 70, 45], variance: 25 });
  const asphaltTex = makeAsphaltTexture();
  const waterTex = makeWaterTexture();

  const landMat = std({
    map: landTex,
    color: q.low ? 0xffffff : theme.id === 'harbor' ? 0xc8d4b8 : 0xffffff,
    roughness: 0.94,
    metalness: 0.04,
    envMapIntensity: 0.35,
    flat: q.flatLand,
  });
  const sandMat = std({ map: sandTex, roughness: 0.9, metalness: 0.05, envMapIntensity: 0.3, flat: q.flatLand });
  const concreteMat = std({
    map: concreteTex,
    normalMap: q.low ? null : panelNrm,
    color: theme.concrete,
    metalness: 0.28,
    roughness: 0.58,
    envMapIntensity: 0.7,
    flat: q.flatLand,
  });
  const rustMat = std({ map: rustTex, color: 0xffffff, metalness: 0.55, roughness: 0.5, envMapIntensity: 0.8 });
  const metalMat = std({ color: theme.night ? 0x4a5564 : 0x6a7684, metalness: 0.88, roughness: 0.28, normalMap: q.low ? null : panelNrm, envMapIntensity: 1.2 });
  const darkMetal = std({ color: 0x2a323c, metalness: 0.75, roughness: 0.4, envMapIntensity: 1 });
  const windowMat = std({
    color: theme.night ? 0xffb070 : 0xa8e0ff,
    emissive: theme.night ? 0xff6622 : 0x2a6a90,
    emissiveIntensity: theme.night ? 1.1 : 0.55,
    metalness: 0.9,
    roughness: 0.12,
    envMapIntensity: 1.4,
  });
  const asphaltMat = std({ map: asphaltTex, roughness: 0.85, metalness: 0.15, envMapIntensity: 0.4, color: theme.night ? 0x888888 : 0xffffff });
  const foamMat = new THREE.MeshBasicMaterial({
    color: theme.id === 'arctic' ? 0xffffff : 0xd8eef8,
    transparent: true,
    opacity: theme.night ? 0.22 : 0.4,
    depthWrite: false,
  });

  // —— Unified ocean (river is the same water body showing through the land cut) ——
  const waterMat = std({
    map: waterTex,
    color: theme.waterColor,
    metalness: 0.95,
    roughness: theme.night ? 0.2 : 0.08,
    transparent: true,
    opacity: 0.92,
    envMapIntensity: 1.85,
  });
  const waterSeg = q.waterSeg || 64;
  const water = shadow(new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_SIZE * 3.2, MAP_SIZE * 3.2, waterSeg, waterSeg),
    waterMat
  ));
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.14;
  water.name = 'water';
  group.add(water);

  // Deep under-tint so trenches read as depth
  const deep = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_SIZE * 3.2, MAP_SIZE * 3.2),
    new THREE.MeshBasicMaterial({
      color: theme.night ? 0x020810 : 0x041820,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
  );
  deep.rotation.x = -Math.PI / 2;
  deep.position.y = -1.8;
  group.add(deep);

  // Shore foam rings (ocean)
  for (const [cx, cz, r] of [[-5, -8, 42], [-28, 22, 13], [30, 18, 12], [-42, 4, 9], [38, 4, 10]]) {
    const foam = new THREE.Mesh(
      new THREE.RingGeometry(r * 0.9, r * 1.06, q.low ? 24 : 64),
      foamMat
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(cx, 0.01, cz);
    group.add(foam);
  }

  // —— Mainland carved so the river connects continuously into the ocean ——
  buildMainlandChannel(group, {
    landMat,
    sandMat,
    concreteMat,
    metalMat,
    foamMat,
    theme,
    quality: q,
  });

  // Beveled cliff faces
  const cliffMat = std({ color: theme.cliff, roughness: 0.9, metalness: 0.08, flat: true, envMapIntensity: 0.25 });
  for (const [x, z, w, h, d, ry] of [
    [-38, -5, 4.5, 3.4, 22, 0.05],
    [28, -10, 3.5, 2.8, 18, -0.08],
    [-10, 18, 20, 1.4, 3.5, 0],
  ]) {
    const cliff = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cliffMat));
    cliff.position.set(x, h / 2, z);
    cliff.rotation.y = ry;
    group.add(cliff);
  }

  // Distant ridgelines for battlefield scale
  if (!q.low) {
    const ridgeMat = std({
      color: theme.cliff,
      roughness: 0.95,
      metalness: 0.05,
      flat: true,
      envMapIntensity: 0.2,
    });
    for (const [x, z, w, h, d] of [
      [-70, -10, 28, 10, 40],
      [70, 5, 26, 9, 36],
      [10, -70, 55, 7, 18],
      [-20, 65, 50, 6, 16],
    ]) {
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), ridgeMat);
      ridge.position.set(x, h * 0.35 - 1, z);
      ridge.castShadow = false;
      ridge.receiveShadow = true;
      group.add(ridge);
    }
  }

  // Rock outcrops
  const rockCount = q.low ? 2 : 4;
  const rockSpots = [[-36, 8, 1.4], [26, 4, 1.1], [-22, -28, 0.9], [12, 16, 1.2]];
  for (let i = 0; i < rockCount; i++) {
    const [x, z, s] = rockSpots[i];
    const rock = shadow(new THREE.Mesh(new THREE.DodecahedronGeometry(s, q.low ? 0 : 1), cliffMat));
    rock.position.set(x, s * 0.55, z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    group.add(rock);
  }

  // Site islands
  const siteA = shadow(new THREE.Mesh(new THREE.CylinderGeometry(10, 12.5, 1.05, 24), sandMat));
  siteA.position.set(-28, 0.3, 22);
  group.add(siteA);
  const siteB = shadow(new THREE.Mesh(new THREE.CylinderGeometry(9, 11.5, 1.05, 24), sandMat));
  siteB.position.set(30, 0.3, 18);
  group.add(siteB);

  // Causeways / docks with railings
  for (const [x, z, len] of [[-18, 8, 18], [18, 6, 16]]) {
    const bridge = shadow(new THREE.Mesh(new THREE.BoxGeometry(8, 0.55, len), concreteMat));
    bridge.position.set(x, 0.18, z);
    group.add(bridge);
    for (const sx of [-3.6, 3.6]) {
      const rail = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, len * 0.95), metalMat));
      rail.position.set(x + sx, 0.55, z);
      group.add(rail);
      for (let i = -3; i <= 3; i++) {
        const post = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.7, 6), metalMat));
        post.position.set(x + sx, 0.45, z + i * (len / 7));
        group.add(post);
      }
    }
    // pilings
    for (let i = -2; i <= 2; i++) {
      for (const sx of [-3.2, 3.2]) {
        const pile = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 2.2, 8), rustMat));
        pile.position.set(x + sx, -0.4, z + i * (len / 5));
        group.add(pile);
      }
    }
  }

  // Runway / asphalt strip
  const runway = shadow(new THREE.Mesh(new THREE.BoxGeometry(14, 0.08, 42), asphaltMat));
  runway.position.set(0, 1.01, -22);
  group.add(runway);
  const markMat = new THREE.MeshBasicMaterial({ color: 0xe8e0c8 });
  for (let i = -5; i <= 5; i++) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.4), markMat);
    mark.position.set(i * 0.05, 1.06, -30 + i * 3.2);
    group.add(mark);
  }

  // Dirt access roads
  const dirtMat = std({
    map: makeNoiseTexture(128, { base: [90, 75, 50], variance: 16 }),
    roughness: 0.95,
    metalness: 0.02,
  });
  dirtMat.map.repeat.set(1, 6);
  for (const [x, z, w, d, ry] of [
    [-12, -5, 4, 28, 0.35],
    [10, -2, 4, 24, -0.25],
    [-5, 5, 3.5, 18, 0.1],
  ]) {
    const road = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), dirtMat));
    road.position.set(x, 1.02, z);
    road.rotation.y = ry;
    group.add(road);
  }

  // —— Cover buildings (detailed façades) ——
  const covers = [
    [-20, 1.5, -15, 6, 3.2, 4],
    [-8, 1.2, -22, 4.5, 2.6, 8],
    [10, 1.8, -18, 5.5, 3.8, 5],
    [22, 1.4, -6, 3.2, 3.0, 7],
    [-30, 1.2, -5, 4.2, 2.6, 4.2],
    [5, 1.0, 5, 8, 2.2, 2.4],
    [-12, 1.5, 2, 2.4, 3.2, 6],
    [14, 1.5, -2, 2.4, 3.2, 6],
    [-26, 1.0, 22, 3.4, 2.2, 3.4],
    [28, 1.0, 18, 3.4, 2.2, 3.4],
  ];

  for (const [x, y, z, w, h, d] of covers) {
    buildBuilding(group, { x, y, z, w, h, d, concreteMat, windowMat, darkMetal, metalMat });
  }

  // Quonset / hangar halls
  for (const hx of [-16, 0, 16]) {
    buildHangar(group, hx, -26, metalMat, darkMetal, concreteMat);
  }

  // Shipping containers
  const containerColors = [0xc44b2a, 0x2a6a9a, 0xc9a227, 0x3a7a4a];
  const containerSpots = [
    [-16, -10], [8, -8], [-4, 4], [20, 2], [-24, 16],
    [-6, -14], [16, -12], [2, 8], [-18, 6], [24, -4],
  ];
  containerSpots.forEach(([x, z], i) => {
    buildContainer(group, x, z, containerColors[i % containerColors.length], panelNrm);
  });

  // Barrels, sandbags, jersey barriers, floodlights
  scatterProps(group, { rustMat, concreteMat, metalMat, darkMetal, sandMat, density: q.propDensity ?? 1 });

  // Antenna / radar towers
  for (const [x, z] of [[-32, -20], [24, -22], [-34, 12]]) {
    buildRadarTower(group, x, z, metalMat, darkMetal);
  }

  // Watchtowers
  buildWatchtower(group, -34, -12, concreteMat, metalMat, windowMat);
  buildWatchtower(group, 30, -14, concreteMat, metalMat, windowMat);

  // Site markers
  const sites = {
    A: new THREE.Vector3(-28, 0.9, 22),
    B: new THREE.Vector3(30, 0.9, 18),
  };
  for (const [label, pos] of Object.entries(sites)) {
    const pad = shadow(new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 3.4, 0.2, 32),
      std({
        color: label === 'A' ? 0xe85d04 : 0x1d9bf0,
        emissive: label === 'A' ? 0xe85d04 : 0x1d9bf0,
        emissiveIntensity: 0.55,
        metalness: 0.45,
        roughness: 0.35,
        envMapIntensity: 0.9,
      })
    ));
    pad.position.copy(pos);
    group.add(pad);

    // Hex ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.8, 0.06, 8, 6),
      new THREE.MeshBasicMaterial({
        color: label === 'A' ? 0xff7a20 : 0x40b8ff,
        transparent: true,
        opacity: 0.7,
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(pos.x, pos.y + 0.15, pos.z);
    group.add(ring);

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f0f6fa';
    ctx.font = 'bold 96px Barlow Condensed, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 64, 70);
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      opacity: 0.9,
    }));
    sprite.position.set(pos.x, 5.2, pos.z);
    sprite.scale.set(3.5, 3.5, 1);
    group.add(sprite);
  }

  // Distant buoys
  const buoyMat = std({ color: 0xff6644, emissive: 0xff3311, emissiveIntensity: 1.1, metalness: 0.4, roughness: 0.4 });
  for (const [x, z] of [[-52, 32], [54, 30], [-50, -38], [52, -32], [0, 48], [-10, -48]]) {
    const buoy = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.4, 10), buoyMat));
    buoy.position.set(x, 0.5, z);
    group.add(buoy);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffaa66 })
    );
    lamp.position.set(x, 1.3, z);
    group.add(lamp);
  }

  // Scrub / bush clusters
  const bushMat = std({
    color: theme.id === 'desert' ? 0x8a7040 : theme.id === 'arctic' ? 0xa8c0a0 : theme.night ? 0x1a2a18 : 0x3a5a28,
    roughness: 0.95,
    metalness: 0.05,
    flat: true,
    envMapIntensity: 0.2,
  });
  const bushN = Math.floor(28 * (q.propDensity ?? 1));
  for (let i = 0; i < bushN; i++) {
    const bx = -35 + Math.random() * 65;
    const bz = -30 + Math.random() * 50;
    if (Math.abs(bx) < 8 && bz < -10) continue;
    if (inRiver(bx, bz) || onRiverBridge(bx, bz)) continue;
    const bush = shadow(new THREE.Mesh(
      new THREE.SphereGeometry(0.5 + Math.random() * 0.6, q.low ? 5 : 7, q.low ? 4 : 6),
      bushMat
    ));
    bush.position.set(bx, 1.15 + Math.random() * 0.3, bz);
    bush.scale.set(1, 0.65 + Math.random() * 0.3, 1);
    group.add(bush);
  }

  // Theme accents — distinct silhouettes per theater
  if (theme.id === 'arctic') {
    for (const [x, z, s] of [[-20, 10, 2.2], [8, -12, 1.8], [22, 8, 2.5], [-8, 16, 1.6], [14, -22, 2.0], [-30, -8, 1.7]]) {
      const berg = shadow(new THREE.Mesh(new THREE.ConeGeometry(s, s * 1.6, 6), sandMat));
      berg.position.set(x, s * 0.5, z);
      group.add(berg);
    }
    const iceSheet = new THREE.Mesh(
      new THREE.CircleGeometry(18, 24),
      new THREE.MeshStandardMaterial({
        color: 0xe8f2fa,
        transparent: true,
        opacity: 0.35,
        roughness: 0.2,
        metalness: 0.15,
      })
    );
    iceSheet.rotation.x = -Math.PI / 2;
    iceSheet.position.set(-6, 1.05, -8);
    group.add(iceSheet);
  }
  if (theme.night) {
    for (const [x, z, hue] of [[-12, -8, 0xff3b7a], [6, 2, 0x3bffc8], [18, -16, 0xff3b7a], [-26, 6, 0x5aa0ff], [0, -20, 0xffaa33]]) {
      const neon = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 0.12, 0.12),
        new THREE.MeshStandardMaterial({ color: hue, emissive: hue, emissiveIntensity: 2.2 })
      );
      neon.position.set(x, 3.4, z);
      group.add(neon);
      const glow = new THREE.PointLight(hue, 1.4, 18, 2);
      glow.position.set(x, 3.6, z);
      group.add(glow);
    }
  }
  if (theme.id === 'desert') {
    for (const [x, z, s] of [[-14, -18, 1.8], [10, 8, 2.4], [-28, -6, 1.5], [20, -14, 2.1], [-6, 12, 1.4]]) {
      const dune = shadow(new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), sandMat));
      dune.scale.set(1.6, 0.45, 1.2);
      dune.position.set(x, 1.1, z);
      group.add(dune);
    }
    const mesa = shadow(new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 4.5, 3.5, 7),
      cliffMat
    ));
    mesa.position.set(-32, 2.6, -22);
    group.add(mesa);
  }
  if (theme.id === 'harbor') {
    for (const [x, z] of [[-18, -24], [8, -26], [22, -18]]) {
      const crate = shadow(new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 1.1, 1.4),
        std({ color: 0xb07030, roughness: 0.75, metalness: 0.15 })
      ));
      crate.position.set(x, 1.55, z);
      group.add(crate);
    }
  }

  return {
    group,
    sites,
    water,
    mapId,
    theme,
    quality: q,
    colliders: covers.map(([x, y, z, w, h, d]) => ({
      min: new THREE.Vector3(x - w / 2, 0, z - d / 2),
      max: new THREE.Vector3(x + w / 2, h * 2, z + d / 2),
      center: new THREE.Vector3(x, y, z),
      half: new THREE.Vector3(w / 2, h / 2, d / 2),
    })),
    isWater(x, z, domain = 'sea') {
      // Land craft can drive over river bridges
      if (domain === 'land' && onRiverBridge(x, z)) return false;
      if (inRiver(x, z)) return true;
      const onLand =
        (x > -40 && x < 30 && z > -35.5 && z < 19.5 && !inRiver(x, z)) ||
        (Math.hypot(x + 28, z - 22) < 11) ||
        (Math.hypot(x - 30, z - 18) < 10) ||
        (x > -22 && x < -14 && z > -1 && z < 17) ||
        (x > 14 && x < 22 && z > -2 && z < 14);
      return !onLand;
    },
    groundHeight(x, z) {
      if (onRiverBridge(x, z)) return 1.35;
      if (inRiver(x, z)) return 0.08;
      if (Math.hypot(x + 28, z - 22) < 11) return 0.85;
      if (Math.hypot(x - 30, z - 18) < 10) return 0.85;
      if (x > -22 && x < -14 && z > -1 && z < 17) return 0.4;
      if (x > 14 && x < 22 && z > -2 && z < 14) return 0.4;
      if (x > -40 && x < 30 && z > -35.5 && z < 19.5) return 1.0;
      return 0.05;
    },
    /** Closest open-water point for deploying ships stuck on land. */
    nearestWater(x, z) {
      if (this.isWater(x, z)) return { x, z };
      const candidates = [
        { x: -30, z: 4 },
        { x: -10, z: 4.5 },
        { x: 5, z: 3.5 },
        { x: 20, z: 4 },
        { x: -28, z: 12 },
        { x: -42, z: 0 },
        { x: 36, z: -8 },
        { x: -28, z: 34 },
        { x: 30, z: 30 },
        { x: 0, z: 28 },
        { x: -5, z: -40 },
        { x: 40, z: 10 },
        { x: -45, z: 20 },
        { x: 18, z: 22 },
        { x: -18, z: 24 },
      ];
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        for (const r of [6, 12, 18, 26]) {
          candidates.push({ x: x + Math.cos(ang) * r, z: z + Math.sin(ang) * r });
        }
      }
      let best = null;
      let bestD = Infinity;
      for (const c of candidates) {
        if (!this.isWater(c.x, c.z)) continue;
        const d = (c.x - x) ** 2 + (c.z - z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      return best || { x: -10, z: 4 };
    },
    update(t) {
      if (this.water?.material?.map) {
        this.water.material.map.offset.x = t * 0.018;
        this.water.material.map.offset.y = t * 0.012;
      }
      if (!this.quality?.animateWater) return;
      const pos = this.water?.geometry?.attributes?.position;
      if (pos) {
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const y = pos.getY(i);
          pos.setZ(
            i,
            Math.sin(x * 0.07 + t * 1.4) * 0.32
              + Math.cos(y * 0.06 + t * 1.1) * 0.26
              + Math.sin((x + y) * 0.03 + t * 0.7) * 0.14
          );
        }
        pos.needsUpdate = true;
        this.water.geometry.computeVertexNormals?.();
      }
    },
  };
}

/**
 * Carve a river trench through the mainland so the shared ocean plane shows through —
 * same material, same waves, continuous into open water at both mouths.
 */
function buildMainlandChannel(group, opts) {
  const { landMat, sandMat, concreteMat, metalMat, foamMat, quality: q } = opts;
  const step = q.landStep || 2.5;
  const landH = 1.28;
  const landY = 0.42;

  for (let x = -40; x < 30; x += step) {
    const x1 = Math.min(30, x + step);
    const mid = (x + x1) * 0.5;
    const w = x1 - x + 0.08;
    const cz = riverCenterZ(mid);
    const hw = riverHalfWidth(mid);

    // South bank plate
    const southTop = cz - hw;
    const southH = southTop - (-35.5);
    if (southH > 0.8) {
      const south = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, landH, southH), landMat));
      south.position.set(mid, landY, -35.5 + southH * 0.5);
      group.add(south);
    }

    // North bank plate (skip / shorten for north fork so ocean continues inland)
    let northBot = cz + hw;
    const inFork = mid > -34 && mid < -24;
    if (inFork) {
      // Fork: leave open water up to site waters; no north fill in channel
      northBot = 19.5;
    }
    const northH = 19.5 - northBot;
    if (!inFork && northH > 0.8) {
      const north = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, landH, northH), landMat));
      north.position.set(mid, landY, northBot + northH * 0.5);
      group.add(north);
    }

    // Sloped sandy banks — same shoreline language as the ocean
    for (const side of [-1, 1]) {
      if (inFork && side > 0) continue;
      const bank = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, 1.65), sandMat));
      bank.position.set(mid, 0.38, cz + side * (hw + 0.15));
      bank.rotation.x = side * 0.42;
      group.add(bank);
      // Cliff face into the channel for depth
      if (!q.low) {
        const wall = shadow(new THREE.Mesh(
          new THREE.BoxGeometry(w, 1.1, 0.22),
          sandMat
        ));
        wall.position.set(mid, -0.15, cz + side * (hw - 0.15));
        group.add(wall);
      }
    }

    // Soft foam along the channel (reads as continuous with ocean foam)
    if (!q.low && Math.abs(mid % (step * 3)) < step) {
      const foam = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.95, hw * 1.85),
        foamMat
      );
      foam.rotation.x = -Math.PI / 2;
      foam.position.set(mid, 0.02, cz);
      group.add(foam);
    }
  }

  // North-fork sandy banks
  for (const [bx, bz, bw, bd] of [
    [-34.2, 11, 1.3, 12],
    [-23.8, 11, 1.3, 12],
    [-29, 18.2, 9, 1.3],
  ]) {
    const bank = shadow(new THREE.Mesh(new THREE.BoxGeometry(bw, 0.55, bd), sandMat));
    bank.position.set(bx, 0.5, bz);
    group.add(bank);
  }

  // Land bridges so tanks can still cross
  for (const [bx, bz] of [[-6, 4], [12, 3.5]]) {
    const bridge = shadow(new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.38, 10), concreteMat));
    bridge.position.set(bx, 1.15, bz);
    group.add(bridge);
    for (const sx of [-2.5, 2.5]) {
      const rail = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 9.5), metalMat));
      rail.position.set(bx + sx, 1.48, bz);
      group.add(rail);
    }
    // Pillars into the water
    for (const pz of [-3.5, 3.5]) {
      for (const px of [-1.8, 1.8]) {
        const pillar = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 2.4, 8), concreteMat));
        pillar.position.set(bx + px, 0.05, bz + pz);
        group.add(pillar);
      }
    }
  }
}

function buildBuilding(group, cfg) {
  const { x, y, z, w, h, d, concreteMat, windowMat, darkMetal, metalMat } = cfg;
  const shell = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), concreteMat));
  shell.position.set(x, y, z);
  group.add(shell);

  // Roof slab + overhang
  const roof = shadow(new THREE.Mesh(new THREE.BoxGeometry(w + 0.45, 0.18, d + 0.45), darkMetal));
  roof.position.set(x, y + h / 2 + 0.1, z);
  group.add(roof);

  // Corner pillars
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pillar = shadow(new THREE.Mesh(
        new THREE.BoxGeometry(0.22, h + 0.15, 0.22),
        metalMat
      ));
      pillar.position.set(x + sx * (w / 2 - 0.1), y, z + sz * (d / 2 - 0.1));
      group.add(pillar);
    }
  }

  // Window grid on long faces
  if (h > 2.0 && w > 2.5) {
    const cols = Math.max(2, Math.floor(w / 1.4));
    const rows = Math.max(1, Math.floor(h / 1.3));
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const ww = (w * 0.7) / cols * 0.7;
        const wh = (h * 0.55) / rows * 0.7;
        const wx = x - w * 0.3 + (col + 0.5) * ((w * 0.7) / cols);
        const wy = y - h * 0.15 + (row + 0.5) * ((h * 0.55) / rows);
        const win = new THREE.Mesh(new THREE.BoxGeometry(ww, wh, 0.06), windowMat);
        win.position.set(wx, wy, z - d / 2 - 0.03);
        group.add(win);
      }
    }
  }

  // Door
  if (w > 3) {
    const door = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.08), darkMetal));
    door.position.set(x, y - h / 2 + 0.85, z + d / 2 + 0.04);
    group.add(door);
  }

  // Rooftop AC / vent
  if (h > 2.5) {
    const vent = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.7), metalMat));
    vent.position.set(x + w * 0.15, y + h / 2 + 0.4, z);
    group.add(vent);
  }
}

function buildHangar(group, x, z, metalMat, darkMetal, concreteMat) {
  // Arched shell via lathed-ish half-cylinder
  const arch = shadow(new THREE.Mesh(
    new THREE.CylinderGeometry(5.2, 5.2, 12, 24, 1, false, 0, Math.PI),
    metalMat
  ));
  arch.rotation.z = Math.PI / 2;
  arch.rotation.y = Math.PI / 2;
  arch.position.set(x, 1.0, z);
  group.add(arch);

  const floor = shadow(new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, 10), concreteMat));
  floor.position.set(x, 1.05, z + 1);
  group.add(floor);

  // End wall with open bay
  const wall = shadow(new THREE.Mesh(new THREE.BoxGeometry(12, 5, 0.4), darkMetal));
  wall.position.set(x, 2.5, z - 5.5);
  group.add(wall);

  // Door rails
  for (const sx of [-5.5, 5.5]) {
    const rail = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.2, 5.2, 0.2), metalMat));
    rail.position.set(x + sx, 2.6, z + 5);
    group.add(rail);
  }

  // Roof ridge light strip
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.08, 0.25),
    new THREE.MeshStandardMaterial({
      color: 0xffe0a0,
      emissive: 0xffaa44,
      emissiveIntensity: 0.8,
      metalness: 0.3,
      roughness: 0.4,
    })
  );
  strip.position.set(x, 6.1, z);
  group.add(strip);
}

function buildContainer(group, x, z, color, nrm) {
  const mat = std({
    color,
    metalness: 0.7,
    roughness: 0.4,
    normalMap: nrm,
    envMapIntensity: 1.1,
  });
  const dark = std({ color: 0x1a1e24, metalness: 0.8, roughness: 0.35 });
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.rotation.y = (Math.random() - 0.5) * 0.4;

  const box = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 5.2), mat));
  box.position.y = 2.1;
  root.add(box);
  for (let i = -2; i <= 2; i++) {
    const rib = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.45, 2.0, 0.1), dark));
    rib.position.set(0, 2.1, i * 0.95);
    root.add(rib);
  }
  // Side corrugation
  for (const sx of [-1.22, 1.22]) {
    for (let i = -2; i <= 2; i++) {
      const rib = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.0, 0.9), dark));
      rib.position.set(sx, 2.1, i * 0.95);
      root.add(rib);
    }
  }
  const doors = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.0, 0.12), dark));
  doors.position.set(0, 2.05, 2.6);
  root.add(doors);
  const latch = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 0.08), mat));
  latch.position.set(0.4, 2.0, 2.68);
  root.add(latch);
  group.add(root);
}

function buildRadarTower(group, x, z, metalMat, darkMetal) {
  const pole = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 10, 8), metalMat));
  pole.position.set(x, 6, z);
  group.add(pole);
  // lattice struts
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const strut = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.06, 9, 0.06), darkMetal));
    strut.position.set(x + Math.cos(a) * 0.55, 5.5, z + Math.sin(a) * 0.55);
    group.add(strut);
  }
  const dish = shadow(new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), metalMat));
  dish.position.set(x, 10.5, z);
  dish.rotation.x = 0.6;
  group.add(dish);
  const feed = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), darkMetal));
  feed.position.set(x, 9.6, z + 0.4);
  feed.rotation.x = 0.6;
  group.add(feed);
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff4422 })
  );
  light.position.set(x, 11.4, z);
  group.add(light);
}

function buildWatchtower(group, x, z, concreteMat, metalMat, windowMat) {
  const shaft = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.2, 7, 2.2), concreteMat));
  shaft.position.set(x, 4.5, z);
  group.add(shaft);
  const cabin = shadow(new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 3.4), metalMat));
  cabin.position.set(x, 8.5, z);
  group.add(cabin);
  for (const [dx, dz] of [[0, -1.72], [0, 1.72], [-1.72, 0], [1.72, 0]]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(dx === 0 ? 2.2 : 0.08, 1.0, dz === 0 ? 2.2 : 0.08), windowMat);
    win.position.set(x + dx, 8.5, z + dz);
    group.add(win);
  }
  const roof = shadow(new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.2, 4), metalMat));
  roof.position.set(x, 10.2, z);
  roof.rotation.y = Math.PI / 4;
  group.add(roof);
}

function scatterProps(group, mats) {
  const { rustMat, concreteMat, metalMat, darkMetal, sandMat, density = 1 } = mats;
  const keep = (i = 0) => density >= 0.99 || Math.random() < density + i * 0.05;

  // Oil barrels
  for (const [x, z] of [[-14, -6], [6, -4], [-2, 6], [18, 4], [-22, 12], [12, -16], [-28, -8]]) {
    if (!keep()) continue;
    for (let i = 0; i < 2 + (Math.random() > 0.5 ? 1 : 0); i++) {
      const barrel = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.38, 1.0, 12), rustMat));
      barrel.position.set(x + i * 0.75, 1.55, z + (i % 2) * 0.2);
      barrel.rotation.z = (Math.random() - 0.5) * 0.15;
      group.add(barrel);
    }
  }

  // Jersey barriers
  for (const [x, z, ry] of [
    [-10, -18, 0.2], [-6, -18, 0.2], [8, -20, -0.1], [12, -20, -0.1],
    [-24, 8, 1.2], [22, 6, -1.0], [0, 2, 0.4],
  ]) {
    const barrier = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 0.55), concreteMat));
    barrier.position.set(x, 1.55, z);
    barrier.rotation.y = ry;
    group.add(barrier);
    const top = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.2, 0.35), concreteMat));
    top.position.set(x, 2.15, z);
    top.rotation.y = ry;
    group.add(top);
  }

  // Sandbag stacks
  for (const [x, z] of [[-27, 20], [29, 16], [-18, -12], [15, 4]]) {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4 - row; col++) {
        const bag = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.32), sandMat));
        bag.rotation.y = (col + row) * 0.08;
        bag.position.set(x + col * 0.5 + row * 0.15, 1.15 + row * 0.35, z);
        group.add(bag);
      }
    }
  }

  // Floodlights
  for (const [x, z] of [[-20, -28], [20, -28], [-30, 18], [32, 14]]) {
    if (!keep(0.1)) continue;
    const pole = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 6, 8), metalMat));
    pole.position.set(x, 4, z);
    group.add(pole);
    const head = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.45), darkMetal));
    head.position.set(x, 7.1, z);
    head.rotation.x = -0.4;
    group.add(head);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xfff2cc,
        emissive: 0xffe088,
        emissiveIntensity: 1.4,
      })
    );
    bulb.position.set(x, 6.95, z + 0.15);
    group.add(bulb);
    if (density > 0.55) {
      const light = new THREE.SpotLight(0xffe8c0, 8, 36, 0.5, 0.5, 1.5);
      light.position.set(x, 7, z);
      light.target.position.set(x * 0.3, 1, z * 0.3);
      light.castShadow = false;
      group.add(light);
      group.add(light.target);
    }
  }

  // Ammo crates
  for (const [x, z] of [[-15, -16], [4, -10], [19, -2]]) {
    const crate = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.7), darkMetal));
    crate.position.set(x, 1.4, z);
    group.add(crate);
    const lid = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.08, 0.72), metalMat));
    lid.position.set(x, 1.78, z);
    group.add(lid);
  }
}

export function getSpawns(team) {
  if (team === 'raiders') {
    return [
      { x: -8, y: 1.0, z: -32, yaw: 0 },
      { x: 0, y: 1.0, z: -34, yaw: 0 },
      { x: 8, y: 1.0, z: -32, yaw: 0 },
      { x: -14, y: 1.0, z: -30, yaw: 0.2 },
      { x: 14, y: 1.0, z: -30, yaw: -0.2 },
    ];
  }
  return [
    { x: -24, y: 0.85, z: 26, yaw: Math.PI },
    { x: -30, y: 0.85, z: 20, yaw: Math.PI },
    { x: 26, y: 0.85, z: 22, yaw: Math.PI },
    { x: 32, y: 0.85, z: 16, yaw: Math.PI },
    { x: 4, y: 1.0, z: 10, yaw: Math.PI },
  ];
}

export { MAP_SIZE };
