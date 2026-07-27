import * as THREE from 'three';
import { VEHICLES } from './config.js';
import { makeSkinTexture } from './skinArt.js';

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: opts.map ? 0xffffff : color,
    map: opts.map || null,
    metalness: opts.metalness ?? 0.55,
    roughness: opts.roughness ?? 0.45,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? (opts.emissive ? 0.35 : 0),
    flatShading: !!opts.flat,
  });
}

function addShadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createVehicleMesh(def, teamColor, skin = null) {
  const root = new THREE.Group();
  root.userData.vehicleId = def.id;

  // Models were authored facing -Z; movement/camera use +Z as forward.
  // Rotate the visual body 180° so the barrel/bow/nose point the way you drive.
  const body = new THREE.Group();
  body.rotation.y = Math.PI;
  root.add(body);

  const skinTex = skin ? makeSkinTexture(THREE, skin, 256) : null;
  const bodyColor = skin?.color ?? def.color;
  const bodyMat = mat(bodyColor, {
    map: skinTex,
    metalness: skin?.metalness ?? 0.6,
    roughness: skin?.roughness ?? 0.4,
    emissive: skin?.emissive ?? 0x000000,
    emissiveIntensity: skin?.emissive ? 0.4 : 0,
  });
  const accentMat = mat(teamColor, {
    metalness: 0.35,
    roughness: 0.45,
    emissive: teamColor,
    emissiveIntensity: 0.35,
  });
  const darkMat = mat(0x151a20, { metalness: 0.75, roughness: 0.32 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x87c5e8,
    metalness: 0.9,
    roughness: 0.08,
    transparent: true,
    opacity: 0.55,
    emissive: 0x204060,
    emissiveIntensity: 0.15,
  });
  const lightMat = mat(0xffe0a0, { emissive: 0xffaa44, emissiveIntensity: 0.85, metalness: 0.2, roughness: 0.4 });

  if (def.domain === 'land') {
    const chassis = addShadow(new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.55, 3.6), bodyMat));
    chassis.position.y = 0.55;
    body.add(chassis);
    const upper = addShadow(new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.45, 2.4), bodyMat));
    upper.position.set(0, 1.0, 0.15);
    body.add(upper);
    const turret = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.8, 0.5, 12), bodyMat));
    turret.position.y = 1.4;
    body.add(turret);
    const cupola = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.22, 10), darkMat));
    cupola.position.set(0.25, 1.72, 0.1);
    body.add(cupola);
    const barrel = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.4, 8), darkMat));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 1.4, -1.55);
    body.add(barrel);
    const muzzle = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.35, 8), darkMat));
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 1.4, -2.7);
    body.add(muzzle);
    for (const x of [-1.2, 1.2]) {
      const track = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 3.7), darkMat));
      track.position.set(x, 0.3, 0);
      body.add(track);
      for (let i = -1; i <= 1; i++) {
        const wheel = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.35, 10), darkMat));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.28, i * 1.1);
        body.add(wheel);
      }
    }
    for (const x of [-0.7, 0.7]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), lightMat);
      lamp.position.set(x, 0.85, -1.75);
      body.add(lamp);
    }
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.3), accentMat);
    stripe.position.set(0, 1.15, 0.5);
    body.add(stripe);
  } else if (def.domain === 'sea') {
    const hull = addShadow(new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), bodyMat));
    hull.position.y = 0.45;
    body.add(hull);
    const bow = addShadow(new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.8, 6), bodyMat));
    bow.rotation.x = Math.PI / 2;
    bow.position.set(0, 0.45, -2.6);
    body.add(bow);
    const deck = addShadow(new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 3.2), darkMat));
    deck.position.y = 0.88;
    body.add(deck);
    const bridge = addShadow(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.95, 1.3), darkMat));
    bridge.position.set(0, 1.35, 0.35);
    body.add(bridge);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.4, 0.08), glassMat);
    glass.position.set(0, 1.5, -0.3);
    body.add(glass);
    const mast = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 6), darkMat));
    mast.position.set(0, 2.25, 0.5);
    body.add(mast);
    const radar = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.35), accentMat));
    radar.position.set(0, 2.9, 0.5);
    body.add(radar);
    const gunBase = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.3, 10), bodyMat));
    gunBase.position.set(0, 1.1, -1.1);
    body.add(gunBase);
    const gun = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.8, 8), darkMat));
    gun.rotation.x = Math.PI / 2;
    gun.position.set(0, 1.2, -2.0);
    body.add(gun);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 3.2), accentMat);
    stripe.position.set(0.85, 0.7, 0);
    body.add(stripe);
    for (const x of [-0.6, 0.6]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), lightMat);
      lamp.position.set(x, 0.75, -2.9);
      body.add(lamp);
    }
  } else {
    const fuse = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 2.6, 12), bodyMat));
    fuse.rotation.x = Math.PI / 2;
    fuse.position.y = 0.55;
    body.add(fuse);
    const nose = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.1, 10), bodyMat));
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.55, -2.05);
    body.add(nose);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), glassMat);
    canopy.position.set(0, 0.85, -0.35);
    canopy.scale.set(1, 0.7, 1.4);
    body.add(canopy);
    const wing = addShadow(new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.1, 1.2), bodyMat));
    wing.position.set(0, 0.5, 0.15);
    body.add(wing);
    for (const x of [-2.25, 2.25]) {
      const tip = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.5), accentMat));
      tip.position.set(x, 0.7, 0.15);
      body.add(tip);
    }
    for (const x of [-0.45, 0.45]) {
      const intake = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.9, 8), darkMat));
      intake.rotation.x = Math.PI / 2;
      intake.position.set(x, 0.35, 0.6);
      body.add(intake);
    }
    const vtail = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.7), darkMat));
    vtail.position.set(0, 1.1, 1.35);
    body.add(vtail);
    for (const x of [-0.55, 0.55]) {
      const htail = addShadow(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.45), bodyMat));
      htail.position.set(x, 0.65, 1.4);
      body.add(htail);
    }
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.22, 12),
      new THREE.MeshBasicMaterial({ color: 0x66d9ff, transparent: true, opacity: 0.85 })
    );
    glow.position.set(0, 0.5, 1.85);
    body.add(glow);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 2.2), accentMat);
    stripe.position.set(0, 0.85, 0);
    body.add(stripe);
  }

  // Contact shadow + team ring stay un-rotated on root (sit on ground)
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(1.6, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  root.add(blob);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.55, 1.72, 40),
    new THREE.MeshBasicMaterial({ color: teamColor, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  root.add(ring);

  return root;
}

export class Unit {
  constructor({ id, name, team, isPlayer, spawn, vehicleId, getSkin, getGroundY }) {
    this.id = id;
    this.name = name;
    this.team = team;
    this.isPlayer = !!isPlayer;
    this.getSkin = getSkin || (() => null);
    this.getGroundY = getGroundY || (() => 1.0);
    this.alive = true;
    this.hp = 100;
    this.armor = 0;
    this.money = 800;
    this.kills = 0;
    this.deaths = 0;
    this.assists = 0;
    this.hasBomb = false;
    this.hasDefuseKit = false;
    this.hasSmoke = 0;
    this.hasEmp = 0;
    this.loadout = [vehicleId || 'scout_tracker', null, null];
    this.activeSlot = 0;
    this.ammo = {};
    this.yaw = spawn?.yaw ?? 0;
    this.pitch = 0;
    this.vel = new THREE.Vector3();
    this.recoil = 0;
    this.fireCooldown = 0;
    this.reloadT = 0;
    this.plantProgress = 0;
    this.defuseProgress = 0;
    this.flashT = 0;
    this.respawnProtected = 0;
    this.lastAttacker = null;

    const def = VEHICLES[this.loadout[0]];
    this.mesh = createVehicleMesh(
      def,
      team === 'raiders' ? 0xe85d04 : 0x1d9bf0,
      this.getSkin(def.id)
    );
    this.mesh.position.set(spawn.x, spawn.y, spawn.z);
    this.mesh.rotation.y = this.yaw;
    this.mesh.userData.unitId = id;
    this._ensureAmmo(def.id);
    this._adjustHeight();
  }

  get vehicle() {
    return VEHICLES[this.loadout[this.activeSlot]] || VEHICLES[this.loadout[0]];
  }

  _ensureAmmo(vid) {
    if (!this.ammo[vid]) {
      const d = VEHICLES[vid];
      this.ammo[vid] = { mag: d.magSize, reserve: d.reserves };
    }
  }

  equip(vehicleId, slot = 0) {
    this.loadout[slot] = vehicleId;
    this._ensureAmmo(vehicleId);
    this.activeSlot = slot;
    this._swapMesh();
  }

  switchSlot(slot) {
    if (!this.loadout[slot]) return;
    this.activeSlot = slot;
    this.reloadT = 0;
    this._swapMesh();
  }

  _swapMesh() {
    const pos = this.mesh.position.clone();
    const yaw = this.mesh.rotation.y;
    const parent = this.mesh.parent;
    parent?.remove(this.mesh);
    const def = this.vehicle;
    this.mesh = createVehicleMesh(
      def,
      this.team === 'raiders' ? 0xe85d04 : 0x1d9bf0,
      this.getSkin(def.id)
    );
    this.mesh.position.copy(pos);
    this.mesh.rotation.y = yaw;
    this.mesh.userData.unitId = this.id;
    parent?.add(this.mesh);
    this._adjustHeight();
  }

  _adjustHeight() {
    const d = this.vehicle.domain;
    const x = this.mesh.position.x;
    const z = this.mesh.position.z;
    if (d === 'air') {
      this.mesh.position.y = 8 + Math.sin(performance.now() * 0.002) * 0.2;
    } else if (d === 'sea') {
      this.mesh.position.y = 0.15 + Math.sin(performance.now() * 0.003 + this.id.length) * 0.06;
    } else {
      // Sit on terrain top — track bottoms are ~y=0 in local space
      this.mesh.position.y = this.getGroundY(x, z);
    }
  }

  resetForRound(spawn) {
    this.alive = true;
    this.hp = 100;
    for (const id of this.loadout) {
      if (!id) continue;
      const d = VEHICLES[id];
      this._ensureAmmo(id);
      this.ammo[id].mag = d.magSize;
      this.ammo[id].reserve = Math.max(this.ammo[id].reserve, Math.floor(d.reserves * 0.5));
    }
    this.hasBomb = false;
    this.plantProgress = 0;
    this.defuseProgress = 0;
    this.flashT = 0;
    this.fireCooldown = 0;
    this.reloadT = 0;
    this.recoil = 0;
    this.vel.set(0, 0, 0);
    this.yaw = spawn.yaw;
    this.mesh.position.set(spawn.x, spawn.y, spawn.z);
    this.mesh.rotation.y = this.yaw;
    this.mesh.visible = true;
    this._swapMesh();
    this._adjustHeight();
  }

  takeDamage(amount, attacker, armorPen = 0.7) {
    if (!this.alive || this.respawnProtected > 0) return { killed: false, dmg: 0 };
    this.lastAttacker = attacker;
    let dmg = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, dmg * (1 - Math.min(1, armorPen) * 0.5));
      this.armor -= absorbed;
      dmg -= absorbed * 0.5;
    }
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.deaths += 1;
      this.mesh.visible = false;
      return { killed: true, dmg };
    }
    return { killed: false, dmg };
  }
}
