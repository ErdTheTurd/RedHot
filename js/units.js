import * as THREE from 'three';
import { VEHICLES } from './config.js';
import { createVehicleMesh } from './models.js';
import { isLucky } from './lucky.js';

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
    this.bombs = 0;
    this.torpedoes = 0;
    this.landmines = 0;
    this.matchMods = null;
    this.accMods = null;
    this.mineDetector = false;
    this.lastStand = false;
    this.lastStandUsed = false;
    this.jumpAmmoCost = 5;
    this.stillT = 0;
    this.secondaryCooldown = 0;
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
    this.flightAlt = 8;
    this.dying = false;
    this.deathT = 0;
    this.deathSpin = 0;
    this.deathFire = null;
    this.sinkT = 0;

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
    this._refillOrdnance(def);
    this._adjustHeight();
  }

  _refillOrdnance(def) {
    const d = def || this.vehicle;
    const bombCap = (d.bombs || 0) + (this.accMods?.bombCap || 0);
    const torpCap = (d.torpedoes || 0) + (this.accMods?.torpedoCap || 0);
    this.bombs = bombCap;
    this.torpedoes = torpCap;
    this._seedOrdnanceStore(d.id, bombCap, torpCap);
  }

  _seedOrdnanceStore(vid, bombs, torpedoes) {
    if (!this._ordnanceByVehicle) this._ordnanceByVehicle = {};
    const id = vid || this.vehicle?.id;
    if (!id) return;
    this._ordnanceByVehicle[id] = {
      bombs: bombs ?? this.bombs ?? 0,
      torpedoes: torpedoes ?? this.torpedoes ?? 0,
    };
  }

  _stashOrdnance() {
    const id = this.vehicle?.id;
    if (!id) return;
    if (!this._ordnanceByVehicle) this._ordnanceByVehicle = {};
    this._ordnanceByVehicle[id] = {
      bombs: this.bombs || 0,
      torpedoes: this.torpedoes || 0,
    };
  }

  _restoreOrdnance() {
    const d = this.vehicle;
    const id = d?.id;
    if (!id) return;
    if (!this._ordnanceByVehicle) this._ordnanceByVehicle = {};
    const bombCap = (d.bombs || 0) + (this.accMods?.bombCap || 0);
    const torpCap = (d.torpedoes || 0) + (this.accMods?.torpedoCap || 0);
    if (!this._ordnanceByVehicle[id]) {
      this._ordnanceByVehicle[id] = { bombs: bombCap, torpedoes: torpCap };
    }
    const stored = this._ordnanceByVehicle[id];
    // Never grant more than what this hull still has left
    this.bombs = Math.max(0, Math.min(bombCap, stored.bombs));
    this.torpedoes = Math.max(0, Math.min(torpCap, stored.torpedoes));
    stored.bombs = this.bombs;
    stored.torpedoes = this.torpedoes;
  }

  /** Caps for the current vehicle (accessories included). */
  _ordnanceCaps() {
    const d = this.vehicle;
    return {
      bombs: (d.bombs || 0) + (this.accMods?.bombCap || 0),
      torpedoes: (d.torpedoes || 0) + (this.accMods?.torpedoCap || 0),
    };
  }

  get vehicle() {
    return VEHICLES[this.loadout[this.activeSlot]] || VEHICLES[this.loadout[0]];
  }

  magSizeFor(vid) {
    const d = VEHICLES[vid] || this.vehicle;
    return (d?.magSize || 0) + (this.accMods?.magBonus || 0);
  }

  /** Permanent accessory mods (re-applied each round). */
  applyAccessories(acc) {
    this.accMods = acc || null;
    this.mineDetector = !!acc?.mineDetector;
    this.lastStand = !!acc?.lastStand;
    this.jumpAmmoCost = acc?.jumpAmmoCost != null ? acc.jumpAmmoCost : 5;
    if (acc?.startArmor) this.armor = Math.max(this.armor, acc.startArmor);
  }

  /**
   * One-shot warheads loadout for this match (ammo / ordnance / damage).
   * Call after accessories so mag bonuses apply.
   */
  applyMatchConsumables(mods) {
    this.matchMods = mods || null;
    if (!mods) return;
    this.landmines = (this.landmines || 0) + (mods.landmines || 0);
    for (const id of this.loadout) {
      if (!id) continue;
      const d = VEHICLES[id];
      this._ensureAmmo(id);
      const mag = this.magSizeFor(id);
      if (mods.fullReload) {
        this.ammo[id].mag = mag;
        this.ammo[id].reserve = Math.max(this.ammo[id].reserve, d.reserves);
      }
      this.ammo[id].reserve += (mods.reserve || 0) + (mods.mags || 0) * mag;
    }
    this.bombs = (this.bombs || 0) + (mods.bombs || 0);
    this.torpedoes = (this.torpedoes || 0) + (mods.torpedoes || 0);
    this._stashOrdnance();
  }

  _ensureAmmo(vid) {
    if (!this.ammo[vid]) {
      const d = VEHICLES[vid];
      const mag = this.magSizeFor(vid);
      this.ammo[vid] = { mag, reserve: d.reserves };
    }
  }

  equip(vehicleId, slot = 0) {
    this._stashOrdnance();
    this.loadout[slot] = vehicleId;
    this._ensureAmmo(vehicleId);
    this.activeSlot = slot;
    this._swapMesh();
    // Fresh equip / buy gets a full magazine of ordnance for that hull
    this._refillOrdnance();
  }

  /**
   * In-match slot swap. Does NOT refill bombs/torpedoes/mines (that was an exploit).
   * Returns { ok, niceTry } when a rapid switch-refill attempt is detected.
   */
  switchSlot(slot) {
    if (!this.loadout[slot]) return { ok: false };
    if (slot === this.activeSlot) return { ok: false, same: true };

    const minesBefore = this.landmines || 0;
    const caps = this._ordnanceCaps();
    const depleted =
      (caps.bombs > 0 && (this.bombs || 0) < caps.bombs) ||
      (caps.torpedoes > 0 && (this.torpedoes || 0) < caps.torpedoes);

    const now = performance.now();
    const since = now - (this._lastSlotSwitchAt || 0);
    this._lastSlotSwitchAt = now;
    if (since < 900) this._slotSwitchBurst = (this._slotSwitchBurst || 0) + 1;
    else this._slotSwitchBurst = 1;

    // Old bug: _refillOrdnance on every switch. Rapid cycling after spending = exploit tell.
    const recentSpend = this._recentOrdnanceSpend && (now - this._recentOrdnanceSpend < 4000);
    const niceTry = !!(
      this.isPlayer &&
      this._slotSwitchBurst >= 2 &&
      (depleted || recentSpend)
    );

    this._stashOrdnance();
    this.activeSlot = slot;
    this.reloadT = 0;
    this._swapMesh();
    this._restoreOrdnance();
    // Mines are match-global — never bump on switch
    this.landmines = minesBefore;

    return { ok: true, niceTry };
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
    if (this.dying) return;
    if (d === 'air') {
      const alt = this.flightAlt ?? 8;
      this.mesh.position.y = alt + Math.sin(performance.now() * 0.002) * 0.15;
      this.grounded = true;
    } else if (d === 'sea') {
      const onLand = this.getGroundY(x, z) > 0.45;
      const base = onLand
        ? this.getGroundY(x, z)
        : 0.15 + Math.sin(performance.now() * 0.003 + this.id.length) * 0.06;
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
    if (this.dying) return true;
    const d = this.vehicle.domain;
    if (d === 'air') {
      this.vy = 0;
      this.grounded = true;
      return false;
    }
    const ground = d === 'sea'
      ? (this.getGroundY(this.mesh.position.x, this.mesh.position.z) > 0.45
        ? this.getGroundY(this.mesh.position.x, this.mesh.position.z)
        : 0.15)
      : this.getGroundY(this.mesh.position.x, this.mesh.position.z);
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
    const cost = this.jumpAmmoCost || 5;
    const total = ammo.mag + ammo.reserve;
    if (total < cost) return { ok: false, reason: `Need ${cost} rounds to jump` };
    let left = cost;
    const fromMag = Math.min(ammo.mag, left);
    ammo.mag -= fromMag;
    left -= fromMag;
    if (left > 0) ammo.reserve -= left;
    this.vy = this.vehicle.domain === 'sea' ? 11 : 13;
    this.grounded = false;
    this.jumpCooldown = 0.35;
    return { ok: true, cost };
  }

  resetForRound(spawn) {
    this.alive = true;
    this.hp = 100;
    this.lastStandUsed = false;
    this.stillT = 0;
    this.dying = false;
    this.deathT = 0;
    this.deathSpin = 0;
    this.clearDeathFire();
    this.flightAlt = 8;
    this.sinkT = 0;
    this._ordnanceByVehicle = {};
    this._slotSwitchBurst = 0;
    this._lastSlotSwitchAt = 0;
    for (const id of this.loadout) {
      if (!id) continue;
      const d = VEHICLES[id];
      this._ensureAmmo(id);
      this.ammo[id].mag = this.magSizeFor(id);
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
    this.respawnProtected = 0;
    this.vel.set(0, 0, 0);
    this.yaw = spawn.yaw;
    this.mesh.position.set(spawn.x, spawn.y, spawn.z);
    this.mesh.rotation.set(0, this.yaw, 0);
    this.mesh.visible = true;
    this._swapMesh();
    this._refillOrdnance();
    if (this.accMods) {
      this.applyAccessories(this.accMods);
    }
    this._adjustHeight();
  }

  clearDeathFire() {
    if (this.deathFire) {
      this.mesh.remove(this.deathFire);
      this.deathFire.traverse?.((o) => {
        o.geometry?.dispose?.();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
          else o.material.dispose?.();
        }
      });
      this.deathFire = null;
    }
  }

  takeDamage(amount, attacker, armorPen = 0.7) {
    if (!this.alive || this.dying || this.respawnProtected > 0) return { killed: false, dmg: 0 };
    if (this.isPlayer && isLucky()) {
      this.flashT = Math.max(this.flashT, 0.15);
      return { killed: false, dmg: 0, lucky: true };
    }
    this.lastAttacker = attacker;
    let dmg = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, dmg * (1 - Math.min(1, armorPen) * 0.5));
      this.armor -= absorbed;
      dmg -= absorbed * 0.5;
    }
    this.hp -= dmg;
    if (this.hp <= 0) {
      if (this.lastStand && !this.lastStandUsed) {
        this.hp = 1;
        this.lastStandUsed = true;
        return { killed: false, dmg, lastStand: true };
      }
      this.hp = 0;
      this.alive = false;
      this.deaths += 1;
      // Stay visible — fiery fall handled by Game.beginDeathFall
      this.mesh.visible = true;
      return { killed: true, dmg };
    }
    return { killed: false, dmg };
  }
}
