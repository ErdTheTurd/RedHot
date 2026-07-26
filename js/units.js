import * as THREE from 'three';
import { VEHICLES } from './config.js';

export function createVehicleMesh(def, teamColor, skin = null) {
  const root = new THREE.Group();
  root.userData.vehicleId = def.id;

  const bodyColor = skin?.color ?? def.color;
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    metalness: skin?.metalness ?? 0.55,
    roughness: skin?.roughness ?? 0.45,
    emissive: skin?.emissive ?? 0x000000,
    emissiveIntensity: skin?.emissive ? 0.35 : 0,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: teamColor,
    metalness: 0.3,
    roughness: 0.5,
    emissive: teamColor,
    emissiveIntensity: 0.25,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1a1f24,
    metalness: 0.7,
    roughness: 0.35,
  });

  if (def.domain === 'land') {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 3.4), bodyMat);
    hull.position.y = 0.7;
    hull.castShadow = true;
    root.add(hull);

    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.55, 8), bodyMat);
    turret.position.y = 1.35;
    root.add(turret);

    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 2.2), darkMat);
    barrel.position.set(0, 1.35, -1.3);
    root.add(barrel);

    for (const x of [-1.15, 1.15]) {
      const track = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 3.5), darkMat);
      track.position.set(x, 0.35, 0);
      root.add(track);
    }

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.35), accentMat);
    stripe.position.set(0, 1.05, 0.4);
    root.add(stripe);
  } else if (def.domain === 'sea') {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 4.2), bodyMat);
    hull.position.y = 0.45;
    hull.castShadow = true;
    root.add(hull);

    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.6, 4), bodyMat);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.z = Math.PI / 4;
    bow.position.set(0, 0.45, -2.4);
    root.add(bow);

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.2), darkMat);
    bridge.position.set(0, 1.15, 0.3);
    root.add(bridge);

    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 1.8), darkMat);
    gun.position.set(0, 1.5, -1.1);
    root.add(gun);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 3.5), accentMat);
    stripe.position.set(0.7, 0.7, 0);
    root.add(stripe);
  } else {
    // air / jet
    const fuselage = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 3.2), bodyMat);
    fuselage.position.y = 0.4;
    fuselage.castShadow = true;
    root.add(fuselage);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.2, 6), bodyMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.4, -2.0);
    root.add(nose);

    const wing = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 1.1), bodyMat);
    wing.position.set(0, 0.35, 0.2);
    root.add(wing);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.7), darkMat);
    tail.position.set(0, 0.85, 1.3);
    root.add(tail);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 2.4), accentMat);
    stripe.position.set(0, 0.7, 0);
    root.add(stripe);
  }

  // selection ring / shadow disc
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.4, 1.55, 32),
    new THREE.MeshBasicMaterial({ color: teamColor, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  root.add(ring);

  return root;
}

export class Unit {
  constructor({ id, name, team, isPlayer, spawn, vehicleId, getSkin }) {
    this.id = id;
    this.name = name;
    this.team = team;
    this.isPlayer = !!isPlayer;
    this.getSkin = getSkin || (() => null);
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
    if (d === 'air') this.mesh.position.y = 8 + Math.sin(performance.now() * 0.002) * 0.15;
    else if (d === 'sea') this.mesh.position.y = 0.35;
    else this.mesh.position.y = 0.15;
  }

  resetForRound(spawn, keepMoneyLoadout = true) {
    this.alive = true;
    this.hp = 100;
    if (!keepMoneyLoadout) {
      this.armor = 0;
      this.loadout = ['scout_tracker', null, null];
      this.activeSlot = 0;
      this.ammo = {};
      this._ensureAmmo('scout_tracker');
    } else {
      // refill mags partially like CS warm-up buy
      for (const id of this.loadout) {
        if (!id) continue;
        const d = VEHICLES[id];
        this._ensureAmmo(id);
        this.ammo[id].mag = d.magSize;
        this.ammo[id].reserve = Math.max(this.ammo[id].reserve, Math.floor(d.reserves * 0.5));
      }
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
