/**
 * Distinct theater layouts — Dustfall, Frostbite, Blacksite.
 * Ironfront Harbor stays in map.js; these are full alternate battlefields.
 */
import * as THREE from 'three';
import {
  makeNoiseTexture,
  makeWaterTexture,
  makeAsphaltTexture,
  makePanelNormalMap,
  makeDesertTerrain,
  makeIceTerrain,
  makeNightYardTexture,
} from './textures.js';

const MAP_SIZE = 120;

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

function makeOcean(group, theme, q, waterColor) {
  const waterTex = makeWaterTexture();
  const waterMat = std({
    map: waterTex,
    color: waterColor ?? theme.waterColor,
    metalness: 0.95,
    roughness: theme.night ? 0.22 : 0.08,
    transparent: true,
    opacity: 0.92,
    envMapIntensity: 1.85,
  });
  const seg = q.waterSeg || 64;
  const water = shadow(new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_SIZE * 3.2, MAP_SIZE * 3.2, seg, seg),
    waterMat
  ));
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.14;
  water.name = 'water';
  group.add(water);

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
  return water;
}

function sitePad(group, pos, label, color, emissive) {
  const pad = shadow(new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.4, 0.2, 32),
    std({
      color,
      emissive,
      emissiveIntensity: 0.55,
      metalness: 0.45,
      roughness: 0.35,
      envMapIntensity: 0.9,
    })
  ));
  pad.position.copy(pos);
  group.add(pad);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.8, 0.06, 8, 6),
    new THREE.MeshBasicMaterial({ color: emissive, transparent: true, opacity: 0.7 })
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
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas),
    transparent: true,
    depthWrite: false,
    opacity: 0.9,
  }));
  sprite.position.set(pos.x, 5.2, pos.z);
  sprite.scale.set(3.5, 3.5, 1);
  group.add(sprite);
}

function buildBuilding(group, cfg) {
  const { x, y, z, w, h, d, concreteMat, windowMat, darkMetal, metalMat } = cfg;
  const shell = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), concreteMat));
  shell.position.set(x, y, z);
  group.add(shell);
  const roof = shadow(new THREE.Mesh(new THREE.BoxGeometry(w + 0.45, 0.18, d + 0.45), darkMetal));
  roof.position.set(x, y + h / 2 + 0.1, z);
  group.add(roof);
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
}

function buildContainer(group, x, z, color, nrm, yaw = 0) {
  const mat = std({ color, metalness: 0.7, roughness: 0.4, normalMap: nrm, envMapIntensity: 1.1 });
  const dark = std({ color: 0x1a1e24, metalness: 0.8, roughness: 0.35 });
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.rotation.y = yaw;
  const box = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 5.2), mat));
  box.position.y = 2.1;
  root.add(box);
  const doors = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.0, 0.12), dark));
  doors.position.set(0, 2.05, 2.6);
  root.add(doors);
  group.add(root);
}

function waterUpdateApi(water, quality) {
  return {
    update(t) {
      if (water?.material?.map) {
        water.material.map.offset.x = t * 0.018;
        water.material.map.offset.y = t * 0.012;
      }
      if (!quality?.animateWater) return;
      const pos = water?.geometry?.attributes?.position;
      if (!pos) return;
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
      water.geometry.computeVertexNormals?.();
    },
  };
}

function nearestWaterHelper(isWaterFn, x, z, fallback) {
  if (isWaterFn(x, z)) return { x, z };
  const candidates = [...(fallback || [])];
  for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2;
    for (const r of [6, 12, 18, 26]) {
      candidates.push({ x: x + Math.cos(ang) * r, z: z + Math.sin(ang) * r });
    }
  }
  let best = null;
  let bestD = Infinity;
  for (const c of candidates) {
    if (!isWaterFn(c.x, c.z)) continue;
    const d = (c.x - x) ** 2 + (c.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best || fallback?.[0] || { x: 0, z: 0 };
}

/** Extra signature landmarks — Ultra only; honor detail / density knobs. */
function wantLandmarks(q) {
  if (q?.low || q?.landmarkDetail === false || q?.detailMeshes === false) return false;
  return (q?.propDensity ?? 1) >= 0.55;
}

function buildMesaArch(group, x, z, cliffMat, sandMat) {
  const left = shadow(new THREE.Mesh(new THREE.BoxGeometry(3.2, 9, 4.5), cliffMat));
  left.position.set(x - 4.5, 5.2, z);
  group.add(left);
  const right = shadow(new THREE.Mesh(new THREE.BoxGeometry(3.2, 9, 4.5), cliffMat));
  right.position.set(x + 4.5, 5.2, z);
  group.add(right);
  const lintel = shadow(new THREE.Mesh(new THREE.BoxGeometry(13, 2.4, 4.2), cliffMat));
  lintel.position.set(x, 10.8, z);
  group.add(lintel);
  const cap = shadow(new THREE.Mesh(new THREE.BoxGeometry(12.5, 0.45, 3.8), sandMat));
  cap.position.set(x, 12.1, z);
  group.add(cap);
}

function buildDesertRadioTower(group, x, z, metalMat, darkMetal) {
  const mast = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, 18, 8), metalMat));
  mast.position.set(x, 10, z);
  group.add(mast);
  for (let i = 0; i < 3; i++) {
    const y = 4 + i * 4.5;
    const ring = shadow(new THREE.Mesh(new THREE.BoxGeometry(3.2 - i * 0.4, 0.12, 3.2 - i * 0.4), darkMetal));
    ring.position.set(x, y, z);
    group.add(ring);
    for (let a = 0; a < 4; a++) {
      const ang = (a / 4) * Math.PI * 2 + 0.4;
      const strut = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 4.2, 0.08), darkMetal));
      strut.position.set(x + Math.cos(ang) * 1.2, y - 1.8, z + Math.sin(ang) * 1.2);
      strut.rotation.z = Math.cos(ang) * 0.25;
      strut.rotation.x = Math.sin(ang) * 0.25;
      group.add(strut);
    }
  }
  const dish = shadow(new THREE.Mesh(new THREE.SphereGeometry(1.8, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.48), metalMat));
  dish.position.set(x, 17.5, z);
  dish.rotation.x = 0.55;
  group.add(dish);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff4422 })
  );
  beacon.position.set(x, 19.2, z);
  group.add(beacon);
}

function buildOilDerrick(group, x, z, metalMat, darkMetal) {
  const legs = [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]];
  for (const [lx, lz] of legs) {
    const leg = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.28, 12, 0.28), metalMat));
    leg.position.set(x + lx, 7, z + lz);
    leg.rotation.z = -lx * 0.06;
    leg.rotation.x = lz * 0.06;
    group.add(leg);
  }
  const crown = shadow(new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.4, 3.5), darkMetal));
  crown.position.set(x, 13.2, z);
  group.add(crown);
  const boom = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.35, 8, 0.35), metalMat));
  boom.position.set(x, 9, z);
  group.add(boom);
  const pump = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 1.4), darkMetal));
  pump.position.set(x, 1.8, z);
  group.add(pump);
}

function buildIceLighthouse(group, x, z, concreteMat, metalMat, windowMat) {
  const base = shadow(new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, 2.8, 10), concreteMat));
  base.position.set(x, 2.0, z);
  group.add(base);
  const shaft = shadow(new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.5, 11, 10), concreteMat));
  shaft.position.set(x, 8.5, z);
  group.add(shaft);
  // Icy stripe bands
  for (const y of [5.5, 9.5]) {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(1.35, 1.35, 0.55, 10),
      std({ color: 0xe8f4ff, roughness: 0.35, metalness: 0.2, emissive: 0xa0c8e8, emissiveIntensity: 0.15 })
    );
    band.position.set(x, y, z);
    group.add(band);
  }
  const lantern = shadow(new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 2.0, 10), metalMat));
  lantern.position.set(x, 14.8, z);
  group.add(lantern);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1.5, 10), windowMat);
  glass.position.set(x, 14.8, z);
  group.add(glass);
  const light = new THREE.PointLight(0xc8e8ff, 2.2, 48, 2);
  light.position.set(x, 15, z);
  group.add(light);
  const cap = shadow(new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.5, 8), metalMat));
  cap.position.set(x, 16.4, z);
  group.add(cap);
}

function buildIceRidgeWall(group, x, z, cliffMat, sandMat, yaw = 0.2) {
  const wall = shadow(new THREE.Mesh(new THREE.BoxGeometry(8, 11, 28), cliffMat));
  wall.position.set(x, 5.5, z);
  wall.rotation.y = yaw;
  group.add(wall);
  for (const [ox, oy, oz, s] of [[-2, 7, -8, 3.2], [1.5, 8, 4, 2.6], [0, 9, 10, 2.2]]) {
    const spike = shadow(new THREE.Mesh(new THREE.ConeGeometry(s * 0.55, s * 1.8, 5), sandMat));
    spike.position.set(x + ox, oy + s * 0.4, z + oz);
    spike.rotation.y = yaw;
    group.add(spike);
  }
}

function buildFrostBeacon(group, x, z, metalMat, darkMetal) {
  const mast = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 14, 8), metalMat));
  mast.position.set(x, 8, z);
  group.add(mast);
  const cabin = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 2.4), darkMetal));
  cabin.position.set(x, 3.2, z);
  group.add(cabin);
  const dish = shadow(new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), metalMat));
  dish.position.set(x, 14.2, z);
  dish.rotation.x = 0.7;
  group.add(dish);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xa0e0ff })
  );
  lamp.position.set(x, 15.6, z);
  group.add(lamp);
}

function buildNeonTower(group, x, z, metalMat, darkMetal, hue = 0xff3b7a) {
  const shaft = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.4, 22, 2.4), darkMetal));
  shaft.position.set(x, 12, z);
  group.add(shaft);
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.18, 3.4),
      new THREE.MeshStandardMaterial({ color: hue, emissive: hue, emissiveIntensity: 2.6 })
    );
    ring.position.set(x, 4 + i * 3.6, z);
    group.add(ring);
  }
  const tip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.35, 4, 6),
    new THREE.MeshStandardMaterial({ color: hue, emissive: hue, emissiveIntensity: 3 })
  );
  tip.position.set(x, 25, z);
  group.add(tip);
  const glow = new THREE.PointLight(hue, 2.4, 36, 2);
  glow.position.set(x, 18, z);
  group.add(glow);
  const strut = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.2, 16, 0.2), metalMat));
  strut.position.set(x + 1.6, 10, z + 1.6);
  group.add(strut);
}

function buildAntennaFarm(group, x, z, metalMat, darkMetal) {
  for (let i = 0; i < 4; i++) {
    const ox = (i % 2) * 3.5 - 1.5;
    const oz = Math.floor(i / 2) * 3.5 - 1.5;
    const h = 10 + i * 1.5;
    const pole = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, h, 6), metalMat));
    pole.position.set(x + ox, h * 0.5 + 1, z + oz);
    group.add(pole);
    const dish = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), darkMetal));
    dish.position.set(x + ox, h + 0.6, z + oz);
    dish.rotation.x = 0.5 + i * 0.1;
    group.add(dish);
  }
  const pad = shadow(new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 8), darkMetal));
  pad.position.set(x, 1.15, z);
  group.add(pad);
}

function buildIndustrialStack(group, x, z, concreteMat, metalMat, hue = 0x3bffc8) {
  const stack = shadow(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 16, 12), concreteMat));
  stack.position.set(x, 9, z);
  group.add(stack);
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(2.0, 0.18, 6, 16),
    new THREE.MeshStandardMaterial({ color: hue, emissive: hue, emissiveIntensity: 2.4 })
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.set(x, 15.5, z);
  group.add(collar);
  const cap = shadow(new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.5, 12), metalMat));
  cap.position.set(x, 17.2, z);
  group.add(cap);
  const glow = new THREE.PointLight(hue, 1.6, 28, 2);
  glow.position.set(x, 16, z);
  group.add(glow);
}

/* ═══════════════════════════════════════════════════════════
 * DUSTFALL MESA — north–south wadi canyon, mesa bowls, dunes
 * ═══════════════════════════════════════════════════════════ */
export function wadiCenterX(z) {
  return 1.5 + Math.sin(z * 0.09) * 3.2 + Math.sin(z * 0.03) * 1.1;
}
export function wadiHalfWidth(z) {
  let hw = 4.2;
  if (z > 28) hw += Math.min(6, (z - 28) * 0.5);
  if (z < -32) hw += Math.min(6, (-32 - z) * 0.5);
  return hw;
}
export function inWadi(x, z) {
  return z > -42 && z < 40 && Math.abs(x - wadiCenterX(z)) < wadiHalfWidth(z);
}
export function onWadiBridge(x, z) {
  return (Math.abs(z + 10) < 2.8 && Math.abs(x - wadiCenterX(-10)) < 5.5)
    || (Math.abs(z - 8) < 2.8 && Math.abs(x - wadiCenterX(8)) < 5.5);
}

export function buildDustfallMap(scene, theme, q) {
  const group = new THREE.Group();
  scene.add(group);

  const panelNrm = makePanelNormalMap(q.low ? 128 : 256);
  const landTex = makeDesertTerrain(q.low ? 256 : 512);
  landTex.repeat.set(6, 5);
  const sandTex = makeNoiseTexture(q.low ? 128 : 256, { base: theme.sandBase, variance: 28 });
  sandTex.repeat.set(5, 5);
  const cliffMat = std({ color: theme.cliff, roughness: 0.92, metalness: 0.06, flat: true, envMapIntensity: 0.3 });
  const landMat = std({ map: landTex, roughness: 0.96, metalness: 0.03, envMapIntensity: 0.4, flat: q.flatLand });
  const sandMat = std({ map: sandTex, roughness: 0.94, metalness: 0.04, envMapIntensity: 0.35, flat: q.flatLand });
  const concreteMat = std({
    color: theme.concrete,
    map: makeNoiseTexture(256, { base: [120, 100, 70], variance: 16, grid: true }),
    roughness: 0.7,
    metalness: 0.2,
    flat: q.flatLand,
  });
  const metalMat = std({ color: 0x8a7060, metalness: 0.75, roughness: 0.4, envMapIntensity: 1 });
  const darkMetal = std({ color: 0x3a3028, metalness: 0.7, roughness: 0.45 });
  const windowMat = std({
    color: 0xffe0a0,
    emissive: 0xaa6622,
    emissiveIntensity: 0.35,
    metalness: 0.85,
    roughness: 0.2,
  });
  const foamMat = new THREE.MeshBasicMaterial({
    color: 0xe8d8b0,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });

  const water = makeOcean(group, theme, q, 0x2a8a9a);

  // Dual plateaus split by north–south wadi
  const step = q.landStep || 2.8;
  for (let z = -38; z < 34; z += step) {
    const z1 = Math.min(34, z + step);
    const midZ = (z + z1) * 0.5;
    const d = z1 - z + 0.08;
    const cx = wadiCenterX(midZ);
    const hw = wadiHalfWidth(midZ);

    const westRight = cx - hw;
    const westW = westRight - (-42);
    if (westW > 1.2) {
      const west = shadow(new THREE.Mesh(new THREE.BoxGeometry(westW, 1.35, d), landMat));
      west.position.set(-42 + westW * 0.5, 0.45, midZ);
      group.add(west);
    }
    const eastLeft = cx + hw;
    const eastW = 38 - eastLeft;
    if (eastW > 1.2) {
      const east = shadow(new THREE.Mesh(new THREE.BoxGeometry(eastW, 1.35, d), landMat));
      east.position.set(eastLeft + eastW * 0.5, 0.45, midZ);
      group.add(east);
    }
    // Sandy canyon walls
    for (const side of [-1, 1]) {
      const bank = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, d), sandMat));
      bank.position.set(cx + side * (hw + 0.2), 0.2, midZ);
      bank.rotation.z = side * -0.35;
      group.add(bank);
    }
    if (!q.low && Math.abs(midZ % (step * 3)) < step) {
      const foam = new THREE.Mesh(new THREE.PlaneGeometry(hw * 1.9, d * 0.9), foamMat);
      foam.rotation.x = -Math.PI / 2;
      foam.position.set(cx, 0.02, midZ);
      group.add(foam);
    }
  }

  // Bridges across the wadi
  for (const bz of [-10, 8]) {
    const bx = wadiCenterX(bz);
    const bridge = shadow(new THREE.Mesh(new THREE.BoxGeometry(11, 0.4, 5.2), concreteMat));
    bridge.position.set(bx, 1.2, bz);
    group.add(bridge);
    for (const sz of [-2.3, 2.3]) {
      const rail = shadow(new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.45, 0.12), metalMat));
      rail.position.set(bx, 1.55, bz + sz);
      group.add(rail);
    }
  }

  // Mesa / butte landmarks (real cover silhouettes)
  const mesas = [
    [-30, 16, 5.5, 7, 4.2],
    [-34, -6, 4.2, 5.5, 3.5],
    [26, 12, 4.8, 6.2, 3.8],
    [30, -14, 3.8, 4.5, 5],
    [-18, -24, 3.2, 3.8, 3],
  ];
  for (const [x, z, rTop, rBot, h] of mesas) {
    const mesa = shadow(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 8), cliffMat));
    mesa.position.set(x, h * 0.5 + 0.2, z);
    group.add(mesa);
    const cap = shadow(new THREE.Mesh(new THREE.CylinderGeometry(rTop * 0.95, rTop * 0.95, 0.35, 8), sandMat));
    cap.position.set(x, h + 0.35, z);
    group.add(cap);
  }

  // Dune fields
  for (const [x, z, s] of [
    [-12, -28, 2.4], [8, -22, 3.1], [18, 2, 2.6], [-22, 6, 2.0],
    [12, 20, 2.8], [-8, 24, 1.9], [22, -28, 2.2], [-28, -20, 2.5],
  ]) {
    const dune = shadow(new THREE.Mesh(new THREE.SphereGeometry(s, 12, 8), sandMat));
    dune.scale.set(1.8, 0.42, 1.35);
    dune.position.set(x, 1.05, z);
    group.add(dune);
  }

  // Sparse adobe / outpost buildings (not harbor hangars)
  const covers = [
    [-22, 1.4, -16, 5, 2.8, 4],
    [16, 1.6, -18, 4.2, 3.2, 4.5],
    [-14, 1.3, 14, 6, 2.4, 3.2],
    [20, 1.5, 8, 3.5, 3.0, 5],
    [-32, 1.2, 20, 3.2, 2.4, 3.2],
    [28, 1.2, -10, 3.2, 2.4, 3.2],
  ];
  for (const [x, y, z, w, h, d] of covers) {
    buildBuilding(group, { x, y, z, w, h, d, concreteMat, windowMat, darkMetal, metalMat });
  }

  // Dirt airstrip (angled, not centered runway)
  const dirt = std({
    map: makeNoiseTexture(128, { base: [110, 85, 50], variance: 18 }),
    roughness: 0.97,
    metalness: 0.02,
  });
  const strip = shadow(new THREE.Mesh(new THREE.BoxGeometry(10, 0.08, 36), dirt));
  strip.position.set(-8, 1.05, -20);
  strip.rotation.y = 0.28;
  group.add(strip);

  // Rock needles
  for (const [x, z, h] of [[-36, 4, 4.5], [34, -4, 3.8], [6, 28, 3.2], [-4, -34, 2.8]]) {
    const spire = shadow(new THREE.Mesh(new THREE.ConeGeometry(1.1, h, 5), cliffMat));
    spire.position.set(x, h * 0.5, z);
    group.add(spire);
  }

  // Signature Dustfall landmarks — arch / radio / derrick (Ultra)
  if (wantLandmarks(q)) {
    buildMesaArch(group, 4, -30, cliffMat, sandMat);
    buildDesertRadioTower(group, 32, 18, metalMat, darkMetal);
    buildOilDerrick(group, -38, -18, metalMat, darkMetal);
    // Distant butte needle for skyline read
    const needle = shadow(new THREE.Mesh(new THREE.ConeGeometry(1.6, 12, 6), cliffMat));
    needle.position.set(-42, 7, 28);
    group.add(needle);
  }

  const sites = {
    A: new THREE.Vector3(-30, 7.6, 16),
    B: new THREE.Vector3(28, 5.2, -12),
  };
  // Raised site pads on mesa tops
  sitePad(group, sites.A, 'A', 0xd4a017, 0xe8b020);
  sitePad(group, sites.B, 'B', 0xc47a20, 0xe09030);

  const scrub = std({ color: 0x7a6838, roughness: 0.95, metalness: 0.04, flat: true });
  for (let i = 0; i < Math.floor(18 * (q.propDensity ?? 1)); i++) {
    const bx = -36 + Math.random() * 70;
    const bz = -34 + Math.random() * 64;
    if (inWadi(bx, bz)) continue;
    const bush = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.4 + Math.random() * 0.5, 6, 5), scrub));
    bush.position.set(bx, 1.2, bz);
    bush.scale.set(1, 0.5, 1);
    group.add(bush);
  }

  const isWater = (x, z, domain = 'sea') => {
    if (domain === 'land' && onWadiBridge(x, z)) return false;
    if (inWadi(x, z)) return true;
    // Mesa tops + plateaus are land
    if (Math.hypot(x + 30, z - 16) < 6.2) return false;
    if (Math.hypot(x - 28, z + 12) < 5.5) return false;
    if (x > -42 && x < 38 && z > -38 && z < 34 && !inWadi(x, z)) return false;
    return true;
  };

  const api = waterUpdateApi(water, q);
  return {
    group,
    sites,
    water,
    mapId: 'dustfall',
    theme,
    quality: q,
    layout: 'canyon',
    minimap: { land: [-42, -38, 80, 72], waterTint: '#3a9aaa', landTint: '#c4a060' },
    colliders: covers.map(([x, y, z, w, h, d]) => ({
      min: new THREE.Vector3(x - w / 2, 0, z - d / 2),
      max: new THREE.Vector3(x + w / 2, h * 2, z + d / 2),
      center: new THREE.Vector3(x, y, z),
      half: new THREE.Vector3(w / 2, h / 2, d / 2),
    })),
    isWater,
    groundHeight(x, z) {
      if (onWadiBridge(x, z)) return 1.4;
      if (inWadi(x, z)) return 0.08;
      if (Math.hypot(x + 30, z - 16) < 6.2) return 7.2;
      if (Math.hypot(x - 28, z + 12) < 5.5) return 4.8;
      if (x > -42 && x < 38 && z > -38 && z < 34) return 1.05;
      return 0.05;
    },
    nearestWater(x, z) {
      return nearestWaterHelper(isWater, x, z, [
        { x: 0, z: -20 }, { x: 2, z: 0 }, { x: 0, z: 20 }, { x: wadiCenterX(0), z: 0 },
      ]);
    },
    update: api.update,
  };
}

/* ═══════════════════════════════════════════════════════════
 * FROSTBITE SOUND — fractured ice shelves + black channels
 * ═══════════════════════════════════════════════════════════ */
function inIceChannel(x, z) {
  // Primary east–west channel
  const cz = -2 + Math.sin(x * 0.07) * 2.2;
  if (x > -44 && x < 44 && Math.abs(z - cz) < 3.4) return true;
  // Cross fissure north–south
  const cx = 6 + Math.sin(z * 0.08) * 1.8;
  if (z > -30 && z < 28 && Math.abs(x - cx) < 2.8) return true;
  // Gap between shelves near sites
  if (x > -36 && x < -20 && z > 10 && z < 18) return true;
  if (x > 16 && x < 34 && z > 6 && z < 16) return true;
  return false;
}
function onIceBridge(x, z) {
  return (Math.abs(x + 4) < 3.2 && Math.abs(z + 2) < 4.5)
    || (Math.abs(x - 10) < 3.2 && Math.abs(z + 1) < 4.5)
    || (Math.abs(z - 4) < 3.0 && Math.abs(x - 6) < 4.5);
}

export function buildFrostbiteMap(scene, theme, q) {
  const group = new THREE.Group();
  scene.add(group);

  const iceTex = makeIceTerrain(q.low ? 256 : 512);
  iceTex.repeat.set(4, 4);
  const landMat = std({
    map: iceTex,
    roughness: 0.35,
    metalness: 0.18,
    envMapIntensity: 1.1,
    color: 0xffffff,
    flat: q.flatLand,
  });
  const sandMat = std({
    map: makeNoiseTexture(256, { base: [220, 230, 240], variance: 12 }),
    roughness: 0.25,
    metalness: 0.2,
    envMapIntensity: 1.0,
  });
  const cliffMat = std({ color: theme.cliff, roughness: 0.7, metalness: 0.15, flat: true });
  const concreteMat = std({ color: 0xc8d4e0, roughness: 0.55, metalness: 0.35 });
  const metalMat = std({ color: 0x7a8a9a, metalness: 0.85, roughness: 0.3 });
  const darkMetal = std({ color: 0x2a343e, metalness: 0.8, roughness: 0.4 });
  const windowMat = std({
    color: 0xc0e8ff,
    emissive: 0x4080a0,
    emissiveIntensity: 0.7,
    metalness: 0.9,
    roughness: 0.12,
  });
  const foamMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });

  const water = makeOcean(group, theme, q, 0x0e2840);

  // Ice shelves as distinct plates (not one mainland)
  const shelves = [
    // South shelf — raider spawn
    [-8, -22, 36, 22],
    // West shelf
    [-28, 2, 20, 28],
    // East shelf
    [24, 0, 22, 26],
    // North-west site shelf
    [-28, 24, 18, 16],
    // North-east site shelf
    [26, 20, 18, 14],
    // Mid north remnant
    [2, 16, 14, 10],
  ];
  for (const [x, z, w, d] of shelves) {
    const plate = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, d), landMat));
    plate.position.set(x, 0.35, z);
    group.add(plate);
    // Cracked edge foam
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(Math.min(w, d) * 0.35, Math.min(w, d) * 0.42, 32),
      foamMat
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(x, 0.92, z);
    group.add(rim);
  }

  // Ice bridges
  for (const [bx, bz, bw, bd] of [[-4, -2, 7, 9], [10, -1, 7, 9], [6, 4, 9, 6]]) {
    const bridge = shadow(new THREE.Mesh(new THREE.BoxGeometry(bw, 0.45, bd), sandMat));
    bridge.position.set(bx, 1.05, bz);
    group.add(bridge);
  }

  // Iceberg cover (solid, not decoration-only)
  for (const [x, z, s] of [
    [-16, -8, 2.8], [12, -14, 2.2], [-10, 10, 3.0], [18, 6, 2.5],
    [-32, -10, 2.0], [32, -8, 2.4], [0, -30, 1.8], [-22, 18, 2.1],
    [20, 26, 1.9], [8, 8, 1.6],
  ]) {
    const berg = shadow(new THREE.Mesh(new THREE.ConeGeometry(s, s * 1.8, 6), sandMat));
    berg.position.set(x, s * 0.55, z);
    berg.rotation.y = Math.random() * 1.5;
    group.add(berg);
  }

  // Research outposts (few, cold)
  const covers = [
    [-20, 1.3, -18, 5, 2.6, 4],
    [18, 1.4, -16, 4.5, 2.8, 4],
    [-30, 1.2, 22, 3.5, 2.4, 3.5],
    [28, 1.2, 18, 3.5, 2.4, 3.5],
    [0, 1.5, -26, 6, 3.0, 3.2],
  ];
  for (const [x, y, z, w, h, d] of covers) {
    buildBuilding(group, { x, y, z, w, h, d, concreteMat, windowMat, darkMetal, metalMat });
  }

  // One cold hangar on south shelf
  const hangar = shadow(new THREE.Mesh(
    new THREE.CylinderGeometry(4.5, 4.5, 10, 20, 1, false, 0, Math.PI),
    metalMat
  ));
  hangar.rotation.z = Math.PI / 2;
  hangar.rotation.y = Math.PI / 2;
  hangar.position.set(-6, 0.9, -28);
  group.add(hangar);

  // Pressure ridges
  if (!q.low) {
    for (const [x, z, w, h, d, ry] of [
      [-40, 8, 6, 5, 18, 0.2],
      [42, -4, 5, 4.5, 16, -0.15],
      [5, -42, 30, 3.5, 8, 0],
    ]) {
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cliffMat);
      ridge.position.set(x, h * 0.3, z);
      ridge.rotation.y = ry;
      group.add(ridge);
    }
  }

  // Signature Frostbite landmarks — lighthouse / ice ridge / beacon (Ultra)
  if (wantLandmarks(q)) {
    buildIceLighthouse(group, -38, 28, concreteMat, metalMat, windowMat);
    buildIceRidgeWall(group, 44, 10, cliffMat, sandMat, -0.25);
    buildFrostBeacon(group, 30, -22, metalMat, darkMetal);
    // Ice arch remnant between shelves
    const archL = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.2, 7, 3), sandMat));
    archL.position.set(-2, 4.2, 10);
    group.add(archL);
    const archR = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.2, 7, 3), sandMat));
    archR.position.set(6, 4.2, 10);
    group.add(archR);
    const archTop = shadow(new THREE.Mesh(new THREE.BoxGeometry(10, 2, 3.2), sandMat));
    archTop.position.set(2, 8.2, 10);
    group.add(archTop);
  }

  const sites = {
    A: new THREE.Vector3(-28, 0.95, 24),
    B: new THREE.Vector3(26, 0.95, 20),
  };
  sitePad(group, sites.A, 'A', 0x7ec8e8, 0xa0e0ff);
  sitePad(group, sites.B, 'B', 0x5aa0c8, 0x80c8f0);

  const isWater = (x, z, domain = 'sea') => {
    if (domain === 'land' && onIceBridge(x, z)) return false;
    if (inIceChannel(x, z)) return true;
    // On a shelf?
    for (const [sx, sz, w, d] of shelves) {
      if (Math.abs(x - sx) < w / 2 && Math.abs(z - sz) < d / 2) return false;
    }
    if (onIceBridge(x, z)) return false;
    return true;
  };

  const api = waterUpdateApi(water, q);
  return {
    group,
    sites,
    water,
    mapId: 'frostbite',
    theme,
    quality: q,
    layout: 'ice',
    minimap: { land: [-40, -35, 80, 70], waterTint: '#1a4058', landTint: '#d0e0f0' },
    colliders: covers.map(([x, y, z, w, h, d]) => ({
      min: new THREE.Vector3(x - w / 2, 0, z - d / 2),
      max: new THREE.Vector3(x + w / 2, h * 2, z + d / 2),
      center: new THREE.Vector3(x, y, z),
      half: new THREE.Vector3(w / 2, h / 2, d / 2),
    })),
    isWater,
    groundHeight(x, z) {
      if (onIceBridge(x, z)) return 1.25;
      if (inIceChannel(x, z)) return 0.06;
      for (const [sx, sz, w, d] of shelves) {
        if (Math.abs(x - sx) < w / 2 && Math.abs(z - sz) < d / 2) return 0.9;
      }
      return 0.05;
    },
    nearestWater(x, z) {
      return nearestWaterHelper(isWater, x, z, [
        { x: 0, z: -2 }, { x: 6, z: 8 }, { x: -28, z: 14 }, { x: 24, z: 12 },
      ]);
    },
    update: api.update,
  };
}

/* ═══════════════════════════════════════════════════════════
 * BLACKSITE YARD — enclosed industrial basin, dense neon grid
 * ═══════════════════════════════════════════════════════════ */
function inYardCanal(x, z) {
  // Outer moat ring around the yard
  const inOuter = x > -48 && x < 48 && z > -42 && z < 38;
  const inInner = x > -34 && x < 34 && z > -30 && z < 26;
  if (inOuter && !inInner) return true;
  // Inner service canal (cross)
  if (Math.abs(z - 2) < 2.6 && x > -28 && x < 28) return true;
  if (Math.abs(x + 2) < 2.4 && z > -22 && z < 20) return true;
  return false;
}
function onYardBridge(x, z) {
  return (Math.abs(x + 2) < 3.5 && Math.abs(z - 2) < 3.5)
    || (Math.abs(z - 2) < 2.8 && Math.abs(x + 16) < 3.2)
    || (Math.abs(z - 2) < 2.8 && Math.abs(x - 14) < 3.2)
    || (Math.abs(x + 2) < 2.8 && Math.abs(z + 12) < 3.2)
    || (Math.abs(x + 2) < 2.8 && Math.abs(z - 14) < 3.2);
}

export function buildBlacksiteMap(scene, theme, q) {
  const group = new THREE.Group();
  scene.add(group);

  const panelNrm = makePanelNormalMap(q.low ? 128 : 256);
  const yardTex = makeNightYardTexture(q.low ? 256 : 512);
  yardTex.repeat.set(5, 5);
  const asphaltTex = makeAsphaltTexture();
  const landMat = std({
    map: yardTex,
    roughness: 0.88,
    metalness: 0.12,
    envMapIntensity: 0.5,
    color: 0x8899aa,
    flat: q.flatLand,
  });
  const asphaltMat = std({
    map: asphaltTex,
    roughness: 0.75,
    metalness: 0.25,
    envMapIntensity: 0.6,
    color: 0x666666,
  });
  const concreteMat = std({
    color: theme.concrete,
    map: makeNoiseTexture(256, { base: [40, 46, 54], variance: 12, grid: true }),
    normalMap: q.low ? null : panelNrm,
    metalness: 0.35,
    roughness: 0.5,
  });
  const metalMat = std({ color: 0x4a5564, metalness: 0.9, roughness: 0.28, normalMap: q.low ? null : panelNrm, envMapIntensity: 1.3 });
  const darkMetal = std({ color: 0x1a2028, metalness: 0.85, roughness: 0.35 });
  const windowMat = std({
    color: 0xffb070,
    emissive: 0xff6622,
    emissiveIntensity: 1.2,
    metalness: 0.9,
    roughness: 0.1,
  });

  const water = makeOcean(group, theme, q);

  // Main yard plate (inner land)
  const yard = shadow(new THREE.Mesh(new THREE.BoxGeometry(66, 1.2, 54), landMat));
  yard.position.set(0, 0.4, -2);
  group.add(yard);

  // Outer ring plates (broken — leave canal)
  // (ocean shows through moat; no fill)

  // Asphalt lanes
  for (const [x, z, w, d, ry] of [
    [0, -2, 8, 48, 0],
    [-2, 2, 52, 7, 0],
    [-18, -14, 5, 22, 0.05],
    [16, -10, 5, 20, -0.05],
  ]) {
    const road = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), asphaltMat));
    road.position.set(x, 1.05, z);
    road.rotation.y = ry;
    group.add(road);
  }

  // Canal bridges
  for (const [bx, bz, bw, bd] of [
    [-2, 2, 7, 7], [-16, 2, 6, 5.5], [14, 2, 6, 5.5], [-2, -12, 5.5, 6], [-2, 14, 5.5, 6],
  ]) {
    const bridge = shadow(new THREE.Mesh(new THREE.BoxGeometry(bw, 0.35, bd), concreteMat));
    bridge.position.set(bx, 1.15, bz);
    group.add(bridge);
    for (const s of [-1, 1]) {
      if (bw >= bd) {
        const rail = shadow(new THREE.Mesh(new THREE.BoxGeometry(bw * 0.9, 0.4, 0.1), metalMat));
        rail.position.set(bx, 1.45, bz + s * bd * 0.45);
        group.add(rail);
      } else {
        const rail = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, bd * 0.9), metalMat));
        rail.position.set(bx + s * bw * 0.45, 1.45, bz);
        group.add(rail);
      }
    }
  }

  // Dense industrial building grid
  const covers = [
    [-22, 1.8, -18, 7, 3.8, 5],
    [-12, 2.2, -20, 5, 4.5, 4],
    [8, 1.6, -18, 6, 3.4, 5],
    [20, 2.0, -16, 5.5, 4.2, 4.5],
    [-24, 1.5, -6, 4, 3.2, 6],
    [22, 1.5, -4, 4, 3.2, 6],
    [-20, 1.7, 10, 6, 3.6, 4],
    [18, 1.7, 12, 6, 3.6, 4],
    [-10, 1.4, 16, 5, 2.8, 3.5],
    [8, 1.4, 16, 5, 2.8, 3.5],
    [-6, 2.4, -8, 3, 5.0, 3],
    [10, 2.4, -6, 3, 5.0, 3],
  ];
  for (const [x, y, z, w, h, d] of covers) {
    buildBuilding(group, { x, y, z, w, h, d, concreteMat, windowMat, darkMetal, metalMat });
  }

  // Container stacks (walls of cover)
  const colors = [0xc44b2a, 0x2a6a9a, 0xc9a227, 0x3a7a4a, 0x8a3a9a];
  const stacks = [
    [-14, -12], [-14, -8], [-14, -4],
    [12, -12], [12, -8], [12, -4],
    [-26, 4], [-26, 8], [24, 4], [24, 8],
  ];
  stacks.forEach(([x, z], i) => {
    buildContainer(group, x, z, colors[i % colors.length], panelNrm, (i % 3) * 0.15);
  });

  // Twin hangars north
  for (const hx of [-12, 12]) {
    const arch = shadow(new THREE.Mesh(
      new THREE.CylinderGeometry(4.8, 4.8, 11, 20, 1, false, 0, Math.PI),
      metalMat
    ));
    arch.rotation.z = Math.PI / 2;
    arch.rotation.y = Math.PI / 2;
    arch.position.set(hx, 0.95, 20);
    group.add(arch);
  }

  // Perimeter fence posts
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const fx = Math.cos(a) * 33;
    const fz = Math.sin(a) * 27 - 2;
    const post = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.4, 0.15), metalMat));
    post.position.set(fx, 2.0, fz);
    group.add(post);
  }

  // Neon landmark lanes
  const neons = [
    [-12, -8, 0xff3b7a], [6, 2, 0x3bffc8], [18, -16, 0xff3b7a],
    [-26, 6, 0x5aa0ff], [0, -20, 0xffaa33], [14, 10, 0x3bffc8],
    [-8, 14, 0xff3b7a], [22, -2, 0x5aa0ff],
  ];
  for (const [x, z, hue] of neons) {
    const neon = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.14, 0.14),
      new THREE.MeshStandardMaterial({ color: hue, emissive: hue, emissiveIntensity: 2.4 })
    );
    neon.position.set(x, 3.6, z);
    group.add(neon);
    const glow = new THREE.PointLight(hue, 1.6, 20, 2);
    glow.position.set(x, 3.8, z);
    group.add(glow);
  }

  // Flood towers
  for (const [x, z] of [[-30, -24], [30, -24], [-30, 20], [30, 18]]) {
    const pole = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 9, 8), metalMat));
    pole.position.set(x, 5.2, z);
    group.add(pole);
    const light = new THREE.PointLight(0xffe0b0, 2.2, 32, 2);
    light.position.set(x, 9.5, z);
    group.add(light);
  }

  // Signature Blacksite landmarks — neon tower / antennas / stack (Ultra)
  if (wantLandmarks(q)) {
    buildNeonTower(group, 0, -24, metalMat, darkMetal, 0xff3b7a);
    buildAntennaFarm(group, -28, -20, metalMat, darkMetal);
    buildIndustrialStack(group, 28, 20, concreteMat, metalMat, 0x3bffc8);
    buildNeonTower(group, -18, 18, metalMat, darkMetal, 0x5aa0ff);
  }

  const sites = {
    A: new THREE.Vector3(-24, 1.05, 14),
    B: new THREE.Vector3(22, 1.05, 12),
  };
  sitePad(group, sites.A, 'A', 0xff3b7a, 0xff5a90);
  sitePad(group, sites.B, 'B', 0x3bffc8, 0x60ffd8);

  const isWater = (x, z, domain = 'sea') => {
    if (domain === 'land' && onYardBridge(x, z)) return false;
    if (inYardCanal(x, z)) return true;
    if (x > -34 && x < 34 && z > -30 && z < 26) return false;
    return true;
  };

  const api = waterUpdateApi(water, q);
  return {
    group,
    sites,
    water,
    mapId: 'blacksite',
    theme,
    quality: q,
    layout: 'yard',
    minimap: { land: [-34, -30, 68, 56], waterTint: '#0a2030', landTint: '#2a3440' },
    colliders: covers.map(([x, y, z, w, h, d]) => ({
      min: new THREE.Vector3(x - w / 2, 0, z - d / 2),
      max: new THREE.Vector3(x + w / 2, h * 2, z + d / 2),
      center: new THREE.Vector3(x, y, z),
      half: new THREE.Vector3(w / 2, h / 2, d / 2),
    })),
    isWater,
    groundHeight(x, z) {
      if (onYardBridge(x, z)) return 1.35;
      if (inYardCanal(x, z)) return 0.06;
      if (x > -34 && x < 34 && z > -30 && z < 26) return 1.0;
      return 0.05;
    },
    nearestWater(x, z) {
      return nearestWaterHelper(isWater, x, z, [
        { x: -2, z: 2 }, { x: 0, z: -28 }, { x: 36, z: 0 }, { x: -36, z: 0 },
      ]);
    },
    update: api.update,
  };
}

/** Spawns unique to each theater. */
export const THEATER_SPAWNS = {
  dustfall: {
    raiders: [
      { x: -16, y: 1.05, z: -32, yaw: 0.15 },
      { x: -4, y: 1.05, z: -34, yaw: 0 },
      { x: 10, y: 1.05, z: -32, yaw: -0.1 },
      { x: -24, y: 1.05, z: -28, yaw: 0.25 },
      { x: 18, y: 1.05, z: -28, yaw: -0.2 },
    ],
    sentinels: [
      { x: -28, y: 7.3, z: 20, yaw: Math.PI },
      { x: -34, y: 1.05, z: 10, yaw: Math.PI },
      { x: 26, y: 4.9, z: -6, yaw: Math.PI },
      { x: 32, y: 1.05, z: 4, yaw: Math.PI },
      { x: 14, y: 1.05, z: 16, yaw: Math.PI },
    ],
  },
  frostbite: {
    raiders: [
      { x: -12, y: 0.95, z: -28, yaw: 0 },
      { x: -2, y: 0.95, z: -30, yaw: 0 },
      { x: 8, y: 0.95, z: -28, yaw: 0 },
      { x: -20, y: 0.95, z: -24, yaw: 0.2 },
      { x: 14, y: 0.95, z: -24, yaw: -0.2 },
    ],
    sentinels: [
      { x: -30, y: 0.95, z: 28, yaw: Math.PI },
      { x: -24, y: 0.95, z: 22, yaw: Math.PI },
      { x: 24, y: 0.95, z: 24, yaw: Math.PI },
      { x: 30, y: 0.95, z: 18, yaw: Math.PI },
      { x: 4, y: 0.95, z: 18, yaw: Math.PI },
    ],
  },
  blacksite: {
    raiders: [
      { x: -10, y: 1.05, z: -24, yaw: 0 },
      { x: 0, y: 1.05, z: -26, yaw: 0 },
      { x: 10, y: 1.05, z: -24, yaw: 0 },
      { x: -18, y: 1.05, z: -20, yaw: 0.15 },
      { x: 18, y: 1.05, z: -20, yaw: -0.15 },
    ],
    sentinels: [
      { x: -26, y: 1.05, z: 18, yaw: Math.PI },
      { x: -20, y: 1.05, z: 14, yaw: Math.PI },
      { x: 20, y: 1.05, z: 16, yaw: Math.PI },
      { x: 26, y: 1.05, z: 12, yaw: Math.PI },
      { x: 0, y: 1.05, z: 18, yaw: Math.PI },
    ],
  },
};
