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
  });
  const darkMat = std({ color: 0x12161c, metalness: 0.82, roughness: 0.28, normalMap: nrm });
  const accentMat = std({
    color: teamColor,
    metalness: 0.4,
    roughness: 0.4,
    emissive: teamColor,
    emissiveIntensity: 0.4,
  });
  const rubberMat = std({ color: 0x1a1a1a, metalness: 0.1, roughness: 0.85 });
  const glassMat = std({
    color: 0x9fd4f0,
    metalness: 0.95,
    roughness: 0.05,
    transparent: true,
    opacity: 0.42,
    emissive: 0x204860,
    emissiveIntensity: 0.2,
  });
  const lightMat = std({
    color: 0xffe8b0,
    emissive: 0xffaa33,
    emissiveIntensity: 1.1,
    metalness: 0.2,
    roughness: 0.35,
  });
  const steelMat = std({ color: 0x6a7380, metalness: 0.9, roughness: 0.22 });

  if (def.domain === 'land') buildTank(body, { bodyMat, darkMat, accentMat, rubberMat, lightMat, steelMat });
  else if (def.domain === 'sea') buildShip(body, { bodyMat, darkMat, accentMat, glassMat, lightMat, steelMat });
  else buildJet(body, { bodyMat, darkMat, accentMat, glassMat, lightMat, steelMat });

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

function buildTank(body, mats) {
  const { bodyMat, darkMat, accentMat, rubberMat, lightMat, steelMat } = mats;

  // Lower hull / tub
  const tub = plate(2.6, 0.7, 3.8, bodyMat, 0.06);
  tub.rotation.x = Math.PI / 2;
  tub.position.set(0, 0.55, 0);
  body.add(tub);

  // Glacis (angled front)
  const glacis = plate(2.4, 1.1, 0.12, bodyMat, 0.05);
  glacis.position.set(0, 0.85, -1.55);
  glacis.rotation.x = -0.55;
  body.add(glacis);

  // Upper deck
  const deck = plate(2.35, 2.6, 0.1, bodyMat, 0.03);
  deck.rotation.x = Math.PI / 2;
  deck.position.set(0, 0.95, 0.1);
  body.add(deck);

  // Side skirts
  for (const x of [-1.35, 1.35]) {
    const skirt = plate(0.08, 0.55, 3.5, darkMat, 0.02);
    skirt.position.set(x, 0.55, 0);
    body.add(skirt);
  }

  // Turret basket (chamfered cylinder via lathe-ish stacked)
  const turret = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, 0.55, 16), bodyMat));
  turret.position.y = 1.35;
  body.add(turret);
  const turretTop = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 0.22, 16), bodyMat));
  turretTop.position.y = 1.7;
  body.add(turretTop);

  // Mantlet
  const mantlet = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.45), darkMat));
  mantlet.position.set(0, 1.4, -0.95);
  body.add(mantlet);

  // Gun barrel (multi-section)
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
  // Bore hint
  const bore = new THREE.Mesh(
    new THREE.CircleGeometry(0.06, 12),
    new THREE.MeshBasicMaterial({ color: 0x050505 })
  );
  bore.position.set(0, 1.4, -4.05);
  body.add(bore);

  // Cupola + MG stub
  const cupola = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.25, 12), darkMat));
  cupola.position.set(0.35, 1.9, 0.15);
  body.add(cupola);
  const mg = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.7, 8), steelMat));
  mg.rotation.x = Math.PI / 2;
  mg.position.set(0.35, 2.05, -0.25);
  body.add(mg);

  // Smoke launchers
  for (let i = 0; i < 4; i++) {
    const s = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 8), darkMat));
    s.rotation.z = Math.PI / 2;
    s.position.set(-0.55 + i * 0.12, 1.55, -0.7);
    body.add(s);
  }

  // Storage boxes / ERA blocks
  for (const [x, z] of [[-0.9, 0.9], [0.9, 0.9], [-0.9, -0.2], [0.9, -0.2]]) {
    const box = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.28, 0.55), darkMat));
    box.position.set(x, 1.1, z);
    body.add(box);
  }

  // Antenna
  const ant = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.6, 6), steelMat));
  ant.position.set(-0.55, 2.5, 0.4);
  body.add(ant);

  // Tracks + road wheels
  for (const side of [-1, 1]) {
    const x = side * 1.25;
    const track = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 3.9), rubberMat));
    track.position.set(x, 0.12, 0);
    body.add(track);
    // drive sprocket + idler
    for (const z of [-1.7, 1.7]) {
      const sprocket = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.38, 14), darkMat));
      sprocket.rotation.z = Math.PI / 2;
      sprocket.position.set(x, 0.38, z);
      body.add(sprocket);
    }
    for (let i = -2; i <= 2; i++) {
      const wheel = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.36, 14), rubberMat));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.32, i * 0.65);
      body.add(wheel);
      const hub = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.38, 10), steelMat));
      hub.rotation.z = Math.PI / 2;
      hub.position.set(x, 0.32, i * 0.65);
      body.add(hub);
    }
    // return rollers
    for (const z of [-0.7, 0.7]) {
      const roll = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 10), darkMat));
      roll.rotation.z = Math.PI / 2;
      roll.position.set(x, 0.72, z);
      body.add(roll);
    }
  }

  // Headlights
  for (const x of [-0.75, 0.75]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), lightMat);
    lamp.position.set(x, 0.85, -1.95);
    body.add(lamp);
    const cage = shadow(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 6, 12), steelMat));
    cage.position.set(x, 0.85, -1.95);
    body.add(cage);
  }

  // Team stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.28), accentMat);
  stripe.position.set(0, 1.15, 0.7);
  body.add(stripe);
}

function buildShip(body, mats) {
  const { bodyMat, darkMat, accentMat, glassMat, lightMat, steelMat } = mats;

  // Main hull + shaped bow
  const hull = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.95, 4.6), bodyMat));
  hull.position.y = 0.5;
  body.add(hull);

  // Flared bow
  const bow = shadow(new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.0, 8), bodyMat));
  bow.rotation.x = Math.PI / 2;
  bow.position.set(0, 0.5, -2.7);
  body.add(bow);

  // Waterline stripe
  const waterline = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.08, 4.5), darkMat);
  waterline.position.set(0, 0.22, 0);
  body.add(waterline);

  // Deck
  const deck = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 4.0), darkMat));
  deck.position.y = 1.0;
  body.add(deck);

  // Superstructure tiers
  const tier1 = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 1.8), bodyMat));
  tier1.position.set(0, 1.4, 0.3);
  body.add(tier1);
  const tier2 = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 1.1), darkMat));
  tier2.position.set(0, 2.0, 0.35);
  body.add(tier2);

  // Bridge glass band
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.35, 0.08), glassMat);
  glass.position.set(0, 2.05, -0.2);
  body.add(glass);

  // Funnel
  const funnel = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.9, 12), darkMat));
  funnel.position.set(0, 2.55, 0.85);
  body.add(funnel);
  const funnelTop = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.15, 12), accentMat);
  funnelTop.position.set(0, 3.05, 0.85);
  body.add(funnelTop);

  // Mast + radar
  const mast = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.8, 8), steelMat));
  mast.position.set(0, 3.0, 0.2);
  body.add(mast);
  const yard = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.08), steelMat));
  yard.position.set(0, 3.5, 0.2);
  body.add(yard);
  const radar = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.45), accentMat));
  radar.position.set(0, 3.85, 0.2);
  body.add(radar);

  // Forward gun turret
  const gunBase = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.48, 0.35, 14), bodyMat));
  gunBase.position.set(0, 1.2, -1.3);
  body.add(gunBase);
  const gunHouse = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.7), darkMat));
  gunHouse.position.set(0, 1.45, -1.3);
  body.add(gunHouse);
  for (const x of [-0.12, 0.12]) {
    const gun = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.7, 10), steelMat));
    gun.rotation.x = Math.PI / 2;
    gun.position.set(x, 1.5, -2.15);
    body.add(gun);
  }

  // Aft CIWS-ish
  const ciws = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.4, 12), darkMat));
  ciws.position.set(0, 1.3, 1.6);
  body.add(ciws);

  // Bulwarks / rails hint
  for (const x of [-1.0, 1.0]) {
    const rail = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 3.6), steelMat));
    rail.position.set(x, 1.2, 0);
    body.add(rail);
  }

  // Navigation lights
  const port = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), std({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 1 }));
  port.position.set(-1.05, 1.15, -1.0);
  body.add(port);
  const starboard = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), std({ color: 0x22ff44, emissive: 0x00ff22, emissiveIntensity: 1 }));
  starboard.position.set(1.05, 1.15, -1.0);
  body.add(starboard);

  for (const x of [-0.55, 0.55]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), lightMat);
    lamp.position.set(x, 0.75, -3.2);
    body.add(lamp);
  }

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 3.4), accentMat);
  stripe.position.set(0.95, 0.75, 0);
  body.add(stripe);
}

function buildJet(body, mats) {
  const { bodyMat, darkMat, accentMat, glassMat, lightMat, steelMat } = mats;

  // Fuselage - tapered cylinder stack
  const noseCone = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.3, 14), bodyMat));
  noseCone.rotation.x = Math.PI / 2;
  noseCone.position.set(0, 0.55, -2.25);
  body.add(noseCone);

  const fore = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.32, 1.2, 16), bodyMat));
  fore.rotation.x = Math.PI / 2;
  fore.position.set(0, 0.55, -1.2);
  body.add(fore);

  const mid = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.38, 1.6, 16), bodyMat));
  mid.rotation.x = Math.PI / 2;
  mid.position.set(0, 0.55, 0.2);
  body.add(mid);

  const aft = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 1.1, 16), bodyMat));
  aft.rotation.x = Math.PI / 2;
  aft.position.set(0, 0.55, 1.4);
  body.add(aft);

  // Cockpit canopy
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), glassMat);
  canopy.scale.set(0.95, 0.75, 1.5);
  canopy.position.set(0, 0.95, -0.55);
  body.add(canopy);
  const frame = shadow(new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.025, 6, 20), darkMat));
  frame.rotation.x = Math.PI / 2;
  frame.position.set(0, 0.88, -0.55);
  body.add(frame);

  // Main wings (swept) - use tapered boxes via scaled meshes
  for (const side of [-1, 1]) {
    const wing = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 1.15), bodyMat));
    wing.position.set(side * 1.55, 0.5, 0.25);
    wing.rotation.y = side * 0.28;
    wing.rotation.z = side * -0.08;
    body.add(wing);
    // missile rail
    const rail = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.9), darkMat));
    rail.position.set(side * 1.7, 0.4, 0.2);
    body.add(rail);
    const missile = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 8), steelMat));
    missile.rotation.x = Math.PI / 2;
    missile.position.set(side * 1.7, 0.32, 0.2);
    body.add(missile);
    const tip = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 8), accentMat));
    tip.rotation.x = -Math.PI / 2;
    tip.position.set(side * 1.7, 0.32, -0.3);
    body.add(tip);
  }

  // Twin intakes
  for (const x of [-0.42, 0.42]) {
    const intake = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.0, 12), darkMat));
    intake.rotation.x = Math.PI / 2;
    intake.position.set(x, 0.38, 0.7);
    body.add(intake);
  }

  // Engines / nozzles
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
    const plume = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.7, 12),
      new THREE.MeshBasicMaterial({ color: 0xff8844, transparent: true, opacity: 0.55, depthWrite: false })
    );
    plume.rotation.x = Math.PI / 2;
    plume.position.set(x, 0.5, 2.55);
    body.add(plume);
  }

  // Vertical stabilizer
  const vstab = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.15, 0.85), darkMat));
  vstab.position.set(0, 1.25, 1.45);
  body.add(vstab);
  // Horizontal stabilizers
  for (const x of [-0.7, 0.7]) {
    const hstab = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.06, 0.5), bodyMat));
    hstab.position.set(x, 0.7, 1.55);
    hstab.rotation.y = x > 0 ? -0.15 : 0.15;
    body.add(hstab);
  }

  // Pitot / lights
  const pitot = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), steelMat));
  pitot.rotation.x = Math.PI / 2;
  pitot.position.set(0, 0.45, -2.85);
  body.add(pitot);

  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), std({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 1 }));
  navL.position.set(-2.5, 0.55, 0.2);
  body.add(navL);
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), std({ color: 0x22ff44, emissive: 0x00ff22, emissiveIntensity: 1 }));
  navR.position.set(2.5, 0.55, 0.2);
  body.add(navR);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 2.4), accentMat);
  stripe.position.set(0, 0.9, 0.1);
  body.add(stripe);

}
