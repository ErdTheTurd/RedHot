import * as THREE from 'three';
import { VEHICLES } from './config.js';
import { createVehicleMesh } from './models.js';

export { createVehicleMesh };

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
    this.vy = 0;
    this.grounded = true;
    this.jumpCooldown = 0;
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
      this.mesh.position.y = 8 + Math.sin(performance.now() * 0.002) * 0.2 + Math.max(0, this.vy * 0.05);
      this.grounded = true;
    } else if (d === 'sea') {
      const base = 0.15 + Math.sin(performance.now() * 0.003 + this.id.length) * 0.06;
      if (this.vy > 0 || !this.grounded) {
        this.mesh.position.y += this.vy * 0.016;
      } else {
        this.mesh.position.y = base;
      }
    } else {
      const ground = this.getGroundY(x, z);
      if (this.grounded && this.vy <= 0) {
        this.mesh.position.y = ground;
      }
    }
  }

  /** Apply gravity / jump arc. Returns true if currently airborne. */
  updateJump(dt) {
    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);
    const d = this.vehicle.domain;
    if (d === 'air') {
      this.vy = 0;
      this.grounded = true;
      return false;
    }
    const ground = d === 'sea' ? 0.15 : this.getGroundY(this.mesh.position.x, this.mesh.position.z);
    if (!this.grounded || this.vy > 0) {
      this.vy -= 28 * dt;
      this.mesh.position.y += this.vy * dt;
      if (this.mesh.position.y <= ground) {
        this.mesh.position.y = ground;
        this.vy = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }
    } else {
      this.mesh.position.y = ground;
      this.vy = 0;
      this.grounded = true;
    }
    return !this.grounded;
  }

  tryJump() {
    if (!this.alive || !this.grounded || this.jumpCooldown > 0) return { ok: false, reason: 'Cannot jump' };
    if (this.vehicle.domain === 'air') return { ok: false, reason: 'Jets stay airborne' };
    const ammo = this.ammo[this.vehicle.id];
    if (!ammo) return { ok: false, reason: 'No ammo' };
    const total = ammo.mag + ammo.reserve;
    if (total < 5) return { ok: false, reason: 'Need 5 rounds to jump' };
    let left = 5;
    const fromMag = Math.min(ammo.mag, left);
    ammo.mag -= fromMag;
    left -= fromMag;
    if (left > 0) ammo.reserve -= left;
    this.vy = this.vehicle.domain === 'sea' ? 11 : 13;
    this.grounded = false;
    this.jumpCooldown = 0.35;
    return { ok: true };
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
    this.vy = 0;
    this.grounded = true;
    this.jumpCooldown = 0;
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
