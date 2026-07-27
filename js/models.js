import * as THREE from 'three';
import { makeSkinTexture } from './skinArt.js';
import { makePanelNormalMap } from './textures.js';

const _panelNormal = { tex: null };
function panelNormal() {
  if (!_panelNormal.tex) _panelNormal.tex = makePanelNormalMap(256);
  return _panelNormal.tex;
}

function shadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function std(opts) {
  return new THREE.MeshStandardMaterial({
    color: opts.color ?? 0xffffff,
    map: opts.map ?? null,
    normalMap: opts.normalMap ?? null,
    metalness: opts.metalness ?? 0.55,
    roughness: opts.roughness ?? 0.4,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    flatShading: !!opts.flat,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    envMapIntensity: opts.envMapIntensity ?? 1,
  });
}

/** Beveled armor plate helper */
function plate(w, h, d, mat, bevel = 0.04) {
  const shape = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;
  shape.moveTo(-hw + bevel, -hh);
  shape.lineTo(hw - bevel, -hh);
  shape.lineTo(hw, -hh + bevel);
  shape.lineTo(hw, hh - bevel);
  shape.lineTo(hw - bevel, hh);
  shape.lineTo(-hw + bevel, hh);
  shape.lineTo(-hw, hh - bevel);
  shape.lineTo(-hw, -hh + bevel);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: true,
    bevelThickness: bevel * 0.5,
    bevelSize: bevel * 0.4,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -d / 2);
  return shadow(new THREE.Mesh(geo, mat));
}


export function createVehicleMesh(def, teamColor, skin = null) {
  const root = new THREE.Group();
  root.userData.vehicleId = def.id;

  // Authored facing -Z; spin so drive/+Z matches barrel
  const body = new THREE.Group();
  body.rotation.y = Math.PI;
  root.add(body);

  const skinTex = skin ? makeSkinTexture(THREE, skin, 256) : null;
  const nrm = panelNormal();

  const bodyMat = std({
    color: skinTex ? 0xffffff : (skin?.color ?? def.color),
    map: skinTex,
    normalMap: nrm,
    metalness: skin?.metalness ?? 0.62,
    roughness: skin?.roughness ?? 0.38,
    emissive: skin?.emissive ?? 0x000000,
    emissiveIntensity: skin?.emissive ? 0.35 : 0,
    envMapIntensity: 1.15,
  });
  const darkMat = std({ color: 0x12161c, metalness: 0.85, roughness: 0.26, normalMap: nrm, envMapIntensity: 1.2 });
  const accentMat = std({
    color: teamColor,
    metalness: 0.4,
    roughness: 0.4,
    emissive: teamColor,
    emissiveIntensity: 0.45,
    envMapIntensity: 0.9,
  });
  const rubberMat = std({ color: 0x1a1a1a, metalness: 0.1, roughness: 0.88, envMapIntensity: 0.25 });
  const glassMat = std({
    color: 0x9fd4f0,
    metalness: 0.98,
    roughness: 0.04,
    transparent: true,
    opacity: 0.4,
    emissive: 0x204860,
    emissiveIntensity: 0.25,
    envMapIntensity: 1.8,
  });
  const lightMat = std({
    color: 0xffe8b0,
    emissive: 0xffaa33,
    emissiveIntensity: 1.25,
    metalness: 0.2,
    roughness: 0.35,
  });
  const steelMat = std({ color: 0x6a7380, metalness: 0.92, roughness: 0.18, envMapIntensity: 1.4 });

  if (def.domain === 'land') buildTank(body, { bodyMat, darkMat, accentMat, rubberMat, lightMat, steelMat }, def.style || 'mbt');
  else if (def.domain === 'sea') buildShip(body, { bodyMat, darkMat, accentMat, glassMat, lightMat, steelMat }, def.style || 'cutter');
  else buildJet(body, { bodyMat, darkMat, accentMat, glassMat, lightMat, steelMat }, def.style || 'falcon');

  // Scale / silhouette bias per craft so every unlock reads unique at a glance
  const scaleMap = {
    scout: 0.82, apc: 1.05, mbt: 1.0, titan: 1.28, raider: 0.95, frost: 1.12, fang: 1.08,
    skiff: 0.72, cutter: 0.95, destroyer: 1.15, battleship: 1.4, hydro: 0.88, keel: 1.05, leviathan: 1.55,
    wasp: 0.7, falcon: 0.95, raptor: 1.1, stealth: 1.25, dart: 0.78, gunship: 1.2, eclipse: 1.35,
  };
  const s = scaleMap[def.style] || 1;
  body.scale.setScalar(s);

  // Ground contact
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 32),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  root.add(blob);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.7, 1.9, 48),
    new THREE.MeshBasicMaterial({ color: teamColor, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  root.add(ring);

  return root;
}

function buildTank(body, mats, style = 'mbt') {
  const { bodyMat, darkMat, accentMat, rubberMat, lightMat, steelMat } = mats;

  if (style === 'scout') {
    const tub = plate(2.0, 0.5, 2.8, bodyMat, 0.05);
    tub.rotation.x = Math.PI / 2;
    tub.position.set(0, 0.45, 0);
    body.add(tub);
    const cabin = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 1.2), darkMat));
    cabin.position.set(0, 0.95, 0.2);
    body.add(cabin);
    const gun = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.6, 10), steelMat));
    gun.rotation.x = Math.PI / 2;
    gun.position.set(0, 1.0, -1.3);
    body.add(gun);
    for (const side of [-1, 1]) {
      const wheel = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.35, 12), rubberMat));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * 1.0, 0.4, -0.7);
      body.add(wheel);
      const wheel2 = wheel.clone();
      wheel2.position.z = 0.8;
      body.add(wheel2);
    }
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.2), accentMat);
    stripe.position.set(0, 1.15, 0.4);
    body.add(stripe);
    return;
  }

  if (style === 'apc') {
    const hull = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.3, 4.0), bodyMat));
    hull.position.y = 0.85;
    body.add(hull);
    const ramp = plate(2.0, 1.0, 0.12, darkMat, 0.04);
    ramp.position.set(0, 0.7, 2.0);
    ramp.rotation.x = 0.4;
    body.add(ramp);
    const turret = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.35, 12), darkMat));
    turret.position.set(0, 1.65, -0.4);
    body.add(turret);
    const rotary = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.4, 10), steelMat));
    rotary.rotation.x = Math.PI / 2;
    rotary.position.set(0, 1.7, -1.2);
    body.add(rotary);
    for (const side of [-1, 1]) {
      for (let i = -2; i <= 2; i++) {
        const w = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.3, 12), rubberMat));
        w.rotation.z = Math.PI / 2;
        w.position.set(side * 1.2, 0.28, i * 0.7);
        body.add(w);
      }
    }
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.25), accentMat);
    stripe.position.set(0, 1.4, 0.5);
    body.add(stripe);
    return;
  }

  if (style === 'raider') {
    const hull = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 3.2), bodyMat));
    hull.position.y = 0.7;
    body.add(hull);
    const wedge = shadow(new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.6, 4), bodyMat));
    wedge.rotation.x = Math.PI / 2;
    wedge.position.set(0, 0.7, -1.8);
    body.add(wedge);
    const rollbar = shadow(new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 6, 16, Math.PI), steelMat));
    rollbar.rotation.x = Math.PI / 2;
    rollbar.position.set(0, 1.4, 0.2);
    body.add(rollbar);
    const gun = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.0, 10), steelMat));
    gun.rotation.x = Math.PI / 2;
    gun.position.set(0, 1.35, -1.0);
    body.add(gun);
    for (const side of [-1, 1]) {
      for (const z of [-1.1, 1.1]) {
        const tire = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 14), rubberMat));
        tire.rotation.z = Math.PI / 2;
        tire.position.set(side * 1.2, 0.55, z);
        body.add(tire);
      }
    }
    return;
  }

  if (style === 'frost') {
    const tub = plate(2.8, 0.85, 4.2, bodyMat, 0.06);
    tub.rotation.x = Math.PI / 2;
    tub.position.set(0, 0.6, 0);
    body.add(tub);
    const plow = shadow(new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.9, 0.2), steelMat));
    plow.position.set(0, 0.7, -2.3);
    plow.rotation.x = -0.35;
    body.add(plow);
    const turret = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.6, 12), bodyMat));
    turret.position.y = 1.4;
    body.add(turret);
    const barrel = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.8, 12), steelMat));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 1.45, -2.4);
    body.add(barrel);
    for (const side of [-1, 1]) {
      const track = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 4.2), rubberMat));
      track.position.set(side * 1.35, 0.15, 0);
      body.add(track);
    }
    return;
  }

  if (style === 'fang') {
    const low = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.55, 4.0), bodyMat));
    low.position.y = 0.45;
    body.add(low);
    const wedge = plate(2.2, 1.4, 0.15, darkMat, 0.04);
    wedge.position.set(0, 0.7, -1.6);
    wedge.rotation.x = -0.7;
    body.add(wedge);
    const lance = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 3.6, 10), steelMat));
    lance.rotation.x = Math.PI / 2;
    lance.position.set(0, 0.95, -2.6);
    body.add(lance);
    const glow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8),
      new THREE.MeshBasicMaterial({ color: 0xff3b7a })
    );
    glow.rotation.x = Math.PI / 2;
    glow.position.set(0, 0.95, -4.4);
    body.add(glow);
    for (const side of [-1, 1]) {
      const skirt = plate(0.1, 0.4, 3.8, darkMat, 0.02);
      skirt.position.set(side * 1.25, 0.4, 0);
      body.add(skirt);
    }
    return;
  }

  if (style === 'titan') {
    const tub = plate(3.2, 1.0, 4.6, bodyMat, 0.08);
    tub.rotation.x = Math.PI / 2;
    tub.position.set(0, 0.7, 0);
    body.add(tub);
    const turret = shadow(new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 0.75, 16), bodyMat));
    turret.position.y = 1.55;
    body.add(turret);
    for (const x of [-0.35, 0.35]) {
      const barrel = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.2, 12), steelMat));
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(x, 1.55, -2.8);
      body.add(barrel);
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const era = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.55), darkMat));
        era.position.set(side * 1.5, 1.2, -0.8 + i * 0.7);
        body.add(era);
      }
    }
    for (const side of [-1, 1]) {
      const track = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 4.6), rubberMat));
      track.position.set(side * 1.5, 0.15, 0);
      body.add(track);
    }
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.35), accentMat);
    stripe.position.set(0, 1.3, 0.9);
    body.add(stripe);
    return;
  }

  // default mbt — full classic battle tank
  const tub = plate(2.6, 0.7, 3.8, bodyMat, 0.06);
  tub.rotation.x = Math.PI / 2;
  tub.position.set(0, 0.55, 0);
  body.add(tub);

  const glacis = plate(2.4, 1.1, 0.12, bodyMat, 0.05);
  glacis.position.set(0, 0.85, -1.55);
  glacis.rotation.x = -0.55;
  body.add(glacis);

  const deck = plate(2.35, 2.6, 0.1, bodyMat, 0.03);
  deck.rotation.x = Math.PI / 2;
  deck.position.set(0, 0.95, 0.1);
  body.add(deck);

  for (const x of [-1.35, 1.35]) {
    const skirt = plate(0.08, 0.55, 3.5, darkMat, 0.02);
    skirt.position.set(x, 0.55, 0);
    body.add(skirt);
  }

  const turret = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, 0.55, 16), bodyMat));
  turret.position.y = 1.35;
  body.add(turret);
  const turretTop = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 0.22, 16), bodyMat));
  turretTop.position.y = 1.7;
  body.add(turretTop);

  const mantlet = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.45), darkMat));
  mantlet.position.set(0, 1.4, -0.95);
  body.add(mantlet);

  const breech = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.5, 12), steelMat));
  breech.rotation.x = Math.PI / 2;
  breech.position.set(0, 1.4, -1.25);
  body.add(breech);
  const barrel = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.6, 14), steelMat));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 1.4, -2.55);
  body.add(barrel);
  const thermal = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.7, 12), darkMat));
  thermal.rotation.x = Math.PI / 2;
  thermal.position.set(0, 1.4, -2.0);
  body.add(thermal);
  const muzzle = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.35, 12), steelMat));
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, 1.4, -3.85);
  body.add(muzzle);

  for (const side of [-1, 1]) {
    const x = side * 1.25;
    const track = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 3.9), rubberMat));
    track.position.set(x, 0.12, 0);
    body.add(track);
    for (let i = -2; i <= 2; i++) {
      const wheel = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.36, 14), rubberMat));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.32, i * 0.65);
      body.add(wheel);
    }
  }

  for (const x of [-0.75, 0.75]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), lightMat);
    lamp.position.set(x, 0.85, -1.95);
    body.add(lamp);
  }

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.28), accentMat);
  stripe.position.set(0, 1.15, 0.7);
  body.add(stripe);
}

function buildShip(body, mats, style = 'cutter') {
  const { bodyMat, darkMat, accentMat, glassMat, lightMat, steelMat } = mats;

  if (style === 'skiff') {
    const hull = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 3.0), bodyMat));
    hull.position.y = 0.4;
    body.add(hull);
    const bow = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.2, 6), bodyMat));
    bow.rotation.x = Math.PI / 2;
    bow.position.set(0, 0.4, -1.8);
    body.add(bow);
    const console = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.6), darkMat));
    console.position.set(0, 0.85, 0.2);
    body.add(console);
    const gun = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.1, 8), steelMat));
    gun.rotation.x = Math.PI / 2;
    gun.position.set(0, 0.95, -0.7);
    body.add(gun);
    const outboard = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.5), darkMat));
    outboard.position.set(0, 0.35, 1.5);
    body.add(outboard);
    return;
  }

  if (style === 'hydro') {
    const hull = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 3.6), bodyMat));
    hull.position.y = 0.55;
    body.add(hull);
    for (const side of [-1, 1]) {
      const foil = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 1.4), steelMat));
      foil.position.set(side * 0.9, 0.2, 0.2);
      foil.rotation.z = side * 0.25;
      body.add(foil);
    }
    const cabin = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 1.2), darkMat));
    cabin.position.set(0, 0.95, 0);
    body.add(cabin);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.06), glassMat);
    glass.position.set(0, 1.0, -0.6);
    body.add(glass);
    return;
  }

  if (style === 'keel') {
    const hull = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 4.4), bodyMat));
    hull.position.y = 0.35;
    body.add(hull);
    const low = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 2.2), darkMat));
    low.position.set(0, 0.85, 0.2);
    body.add(low);
    const gun = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 10), steelMat));
    gun.rotation.x = Math.PI / 2;
    gun.position.set(0, 0.95, -1.8);
    body.add(gun);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.06, 4.0), accentMat);
    stripe.position.set(0, 0.55, 0);
    body.add(stripe);
    return;
  }

  if (style === 'battleship' || style === 'leviathan') {
    const len = style === 'leviathan' ? 5.8 : 5.2;
    const hull = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, len), bodyMat));
    hull.position.y = 0.6;
    body.add(hull);
    const deck = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.12, len * 0.9), darkMat));
    deck.position.y = 1.25;
    body.add(deck);
    const turrets = style === 'leviathan' ? [-1.8, 0, 1.6] : [-1.5, 1.3];
    for (const z of turrets) {
      const base = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.4, 14), bodyMat));
      base.position.set(0, 1.5, z);
      body.add(base);
      for (const x of [-0.18, 0.18]) {
        const g = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 2.0, 10), steelMat));
        g.rotation.x = Math.PI / 2;
        g.position.set(x, 1.6, z - 1.1);
        body.add(g);
      }
    }
    const funnel = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.2, 12), darkMat));
    funnel.position.set(0, 2.2, 0.4);
    body.add(funnel);
    return;
  }

  if (style === 'destroyer') {
    const hull = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 5.0), bodyMat));
    hull.position.y = 0.5;
    body.add(hull);
    const bow = shadow(new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.2, 8), bodyMat));
    bow.rotation.x = Math.PI / 2;
    bow.position.set(0, 0.5, -3.0);
    body.add(bow);
    const tier = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.6), darkMat));
    tier.position.set(0, 1.4, 0.3);
    body.add(tier);
    const mast = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.2, 8), steelMat));
    mast.position.set(0, 2.6, 0.2);
    body.add(mast);
    const gunBase = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.3, 12), bodyMat));
    gunBase.position.set(0, 1.15, -1.5);
    body.add(gunBase);
    const gun = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.0, 10), steelMat));
    gun.rotation.x = Math.PI / 2;
    gun.position.set(0, 1.2, -2.5);
    body.add(gun);
    return;
  }

  // default cutter
  const hull = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.95, 4.6), bodyMat));
  hull.position.y = 0.5;
  body.add(hull);
  const bow = shadow(new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.0, 8), bodyMat));
  bow.rotation.x = Math.PI / 2;
  bow.position.set(0, 0.5, -2.7);
  body.add(bow);
  const deck = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 4.0), darkMat));
  deck.position.y = 1.0;
  body.add(deck);
  const tier1 = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 1.8), bodyMat));
  tier1.position.set(0, 1.4, 0.3);
  body.add(tier1);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.35, 0.08), glassMat);
  glass.position.set(0, 1.85, -0.2);
  body.add(glass);
  const funnel = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.9, 12), darkMat));
  funnel.position.set(0, 2.35, 0.85);
  body.add(funnel);
  const gunBase = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.48, 0.35, 14), bodyMat));
  gunBase.position.set(0, 1.2, -1.3);
  body.add(gunBase);
  for (const x of [-0.12, 0.12]) {
    const gun = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.7, 10), steelMat));
    gun.rotation.x = Math.PI / 2;
    gun.position.set(x, 1.5, -2.15);
    body.add(gun);
  }
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 3.4), accentMat);
  stripe.position.set(0.95, 0.75, 0);
  body.add(stripe);
  for (const x of [-0.55, 0.55]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), lightMat);
    lamp.position.set(x, 0.75, -3.2);
    body.add(lamp);
  }
}

function buildJet(body, mats, style = 'falcon') {
  const { bodyMat, darkMat, accentMat, glassMat, lightMat, steelMat } = mats;

  if (style === 'wasp') {
    const pod = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), bodyMat));
    pod.scale.set(1, 0.7, 1.4);
    pod.position.set(0, 0.6, 0);
    body.add(pod);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), glassMat);
    canopy.position.set(0, 0.85, -0.35);
    body.add(canopy);
    for (const side of [-1, 1]) {
      const arm = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.15), darkMat));
      arm.position.set(side * 0.9, 0.85, 0);
      body.add(arm);
      const rotor = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 16), steelMat));
      rotor.position.set(side * 1.4, 0.95, 0);
      body.add(rotor);
    }
    const gun = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 8), steelMat));
    gun.rotation.x = Math.PI / 2;
    gun.position.set(0, 0.45, -1.0);
    body.add(gun);
    return;
  }

  if (style === 'dart') {
    const needle = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 4.2, 12), bodyMat));
    needle.rotation.x = Math.PI / 2;
    needle.position.set(0, 0.55, 0);
    body.add(needle);
    const nose = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.0, 10), bodyMat));
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.55, -2.4);
    body.add(nose);
    for (const side of [-1, 1]) {
      const wing = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.55), bodyMat));
      wing.position.set(side * 0.95, 0.55, 0.4);
      wing.rotation.y = side * 0.4;
      body.add(wing);
    }
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.2, 12),
      new THREE.MeshBasicMaterial({ color: 0x66e0ff })
    );
    glow.position.set(0, 0.55, 2.2);
    body.add(glow);
    return;
  }

  if (style === 'gunship') {
    const fat = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 3.2, 14), bodyMat));
    fat.rotation.x = Math.PI / 2;
    fat.position.set(0, 0.6, 0);
    body.add(fat);
    for (const side of [-1, 1]) {
      const wing = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 1.4), bodyMat));
      wing.position.set(side * 1.7, 0.55, 0.2);
      body.add(wing);
      const pod = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.4, 10), darkMat));
      pod.rotation.x = Math.PI / 2;
      pod.position.set(side * 1.5, 0.35, 0.1);
      body.add(pod);
    }
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), glassMat);
    canopy.scale.set(1, 0.7, 1.3);
    canopy.position.set(0, 1.0, -0.8);
    body.add(canopy);
    return;
  }

  if (style === 'stealth' || style === 'eclipse') {
    const span = style === 'eclipse' ? 5.2 : 4.2;
    const wing = shadow(new THREE.Mesh(new THREE.BoxGeometry(span, 0.14, 2.8), bodyMat));
    wing.position.set(0, 0.55, 0);
    body.add(wing);
    // diamond planform tips
    for (const side of [-1, 1]) {
      const tip = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 3), bodyMat));
      tip.rotation.z = side * Math.PI / 2;
      tip.position.set(side * span * 0.42, 0.55, 0.2);
      body.add(tip);
    }
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), glassMat);
    cockpit.scale.set(1.2, 0.5, 1.6);
    cockpit.position.set(0, 0.72, -0.6);
    body.add(cockpit);
    for (const x of [-0.35, 0.35]) {
      const nozzle = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.5), darkMat));
      nozzle.position.set(x, 0.45, 1.3);
      body.add(nozzle);
    }
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 2.0), accentMat);
    stripe.position.set(0, 0.65, 0);
    body.add(stripe);
    return;
  }

  if (style === 'raptor') {
    const mid = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 3.4, 14), bodyMat));
    mid.rotation.x = Math.PI / 2;
    mid.position.set(0, 0.55, 0);
    body.add(mid);
    const nose = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.4, 12), bodyMat));
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.55, -2.2);
    body.add(nose);
    for (const side of [-1, 1]) {
      const boom = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 2.2), darkMat));
      boom.position.set(side * 0.85, 0.55, 0.8);
      body.add(boom);
      const wing = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 1.3), bodyMat));
      wing.position.set(side * 1.7, 0.5, 0.1);
      wing.rotation.y = side * 0.22;
      body.add(wing);
      const nozzle = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.4, 10), steelMat));
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(side * 0.85, 0.55, 2.0);
      body.add(nozzle);
    }
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), glassMat);
    canopy.scale.set(0.9, 0.7, 1.4);
    canopy.position.set(0, 0.95, -0.5);
    body.add(canopy);
    return;
  }

  // default falcon fighter
  const noseCone = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.3, 14), bodyMat));
  noseCone.rotation.x = Math.PI / 2;
  noseCone.position.set(0, 0.55, -2.25);
  body.add(noseCone);
  const mid = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.38, 1.6, 16), bodyMat));
  mid.rotation.x = Math.PI / 2;
  mid.position.set(0, 0.55, 0.2);
  body.add(mid);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), glassMat);
  canopy.scale.set(0.95, 0.75, 1.5);
  canopy.position.set(0, 0.95, -0.55);
  body.add(canopy);
  for (const side of [-1, 1]) {
    const wing = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 1.15), bodyMat));
    wing.position.set(side * 1.55, 0.5, 0.25);
    wing.rotation.y = side * 0.28;
    body.add(wing);
  }
  for (const x of [-0.28, 0.28]) {
    const nozzle = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.45, 12), steelMat));
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(x, 0.5, 2.0);
    body.add(nozzle);
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.16, 16),
      new THREE.MeshBasicMaterial({ color: 0x66e0ff, transparent: true, opacity: 0.9 })
    );
    glow.position.set(x, 0.5, 2.25);
    body.add(glow);
  }
  const vstab = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.15, 0.85), darkMat));
  vstab.position.set(0, 1.25, 1.45);
  body.add(vstab);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 2.4), accentMat);
  stripe.position.set(0, 0.9, 0.1);
  body.add(stripe);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), lightMat);
  lamp.position.set(0, 0.45, -2.8);
  body.add(lamp);
}
