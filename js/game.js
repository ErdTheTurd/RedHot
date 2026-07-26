import * as THREE from 'three';
import {
  PHASE, BUY_TIME, ROUND_TIME, BOMB_TIME, DEFUSE_TIME, PLANT_TIME,
  ROUNDS_TO_WIN, START_MONEY, MAX_MONEY, WIN_REWARD, LOSS_REWARDS,
  KILL_REWARD, PLANT_REWARD, BOT_NAMES, VEHICLES, GEAR, TEAMS,
} from './config.js';
import { Unit } from './units.js';
import { createMap, getSpawns } from './map.js';
import { updateBot } from './bots.js';
import { SFX } from './audio.js';

export class Game {
  constructor({ scene, camera, input, ui }) {
    this.scene = scene;
    this.camera = camera;
    this.input = input;
    this.ui = ui;
    this.map = createMap(scene);
    this.units = [];
    this.player = null;
    this.projectiles = [];
    this.effects = [];
    this.score = { raiders: 0, sentinels: 0 };
    this.lossStreak = { raiders: 0, sentinels: 0 };
    this.roundNumber = 0;
    this.phase = PHASE.BUY;
    this.timer = BUY_TIME;
    this.phaseLabel = 'BUY';
    this.plantTime = PLANT_TIME;
    this.defuseTime = DEFUSE_TIME;
    this.bomb = {
      planted: false,
      site: null,
      position: null,
      timer: BOMB_TIME,
      carrier: null,
      mesh: null,
    };
    this.running = false;
    this.buyOpen = false;
    this._smokeClouds = [];
    this._beepAcc = 0;
    this.camDist = 14;
    this.camHeight = 8;
    this.camYaw = 0;
    this.camPitch = 0.45;
  }

  startMatch(team) {
    SFX.unlock();
    SFX.ui();
    this.ui.hideAllScreens();
    this.running = true;
    this.score = { raiders: 0, sentinels: 0 };
    this.lossStreak = { raiders: 0, sentinels: 0 };
    this.roundNumber = 0;

    // clear units
    for (const u of this.units) this.scene.remove(u.mesh);
    this.units = [];

    const playerName = 'You';
    const spawnsR = getSpawns('raiders');
    const spawnsS = getSpawns('sentinels');

    this.player = new Unit({
      id: 'player',
      name: playerName,
      team,
      isPlayer: true,
      spawn: team === TEAMS.RAIDERS ? spawnsR[0] : spawnsS[0],
      vehicleId: 'scout_tracker',
    });
    this.player.money = START_MONEY;
    this.scene.add(this.player.mesh);
    this.units.push(this.player);

    // 4v4 bots
    for (let i = 0; i < 4; i++) {
      if (team === TEAMS.RAIDERS && i === 0) {
        // player already fills first raider slot conceptually — still add 3 raider bots + 4 sentinels
      }
    }
    const raiderBots = team === TEAMS.RAIDERS ? 3 : 4;
    const sentinelBots = team === TEAMS.SENTINELS ? 3 : 4;

    for (let i = 0; i < raiderBots; i++) {
      const spawn = spawnsR[team === TEAMS.RAIDERS ? i + 1 : i];
      const u = new Unit({
        id: `r${i}`,
        name: BOT_NAMES.raiders[i],
        team: TEAMS.RAIDERS,
        spawn,
        vehicleId: 'scout_tracker',
      });
      u.money = START_MONEY;
      this.scene.add(u.mesh);
      this.units.push(u);
    }
    for (let i = 0; i < sentinelBots; i++) {
      const spawn = spawnsS[team === TEAMS.SENTINELS ? i + 1 : i];
      const u = new Unit({
        id: `s${i}`,
        name: BOT_NAMES.sentinels[i],
        team: TEAMS.SENTINELS,
        spawn,
        vehicleId: 'scout_tracker',
      });
      u.money = START_MONEY;
      this.scene.add(u.mesh);
      this.units.push(u);
    }

    this.input.requestLock();
    this.beginRound();
  }

  beginRound() {
    this.roundNumber += 1;
    this.phase = PHASE.BUY;
    this.phaseLabel = 'BUY';
    this.timer = BUY_TIME;
    this.clearBomb();
    this.projectiles = [];
    for (const c of this._smokeClouds) this.scene.remove(c);
    this._smokeClouds = [];

    const spawnsR = getSpawns('raiders');
    const spawnsS = getSpawns('sentinels');
    let ri = 0;
    let si = 0;

    for (const u of this.units) {
      const spawn = u.team === TEAMS.RAIDERS ? spawnsR[ri++] : spawnsS[si++];
      u.resetForRound(spawn, true);
    }

    // give bomb to random raider
    const raiders = this.units.filter((u) => u.team === TEAMS.RAIDERS);
    const carrier = raiders[Math.floor(Math.random() * raiders.length)];
    carrier.hasBomb = true;
    this.bomb.carrier = carrier;

    this.ui.showBanner(`ROUND ${this.roundNumber}`, 'Buy phase');
    this.ui.toast('Press B to open arsenal');
    if (!this.buyOpen && this.player.alive) {
      // auto hint only
    }
  }

  clearBomb() {
    this.bomb.planted = false;
    this.bomb.site = null;
    this.bomb.position = null;
    this.bomb.timer = BOMB_TIME;
    if (this.bomb.mesh) {
      this.scene.remove(this.bomb.mesh);
      this.bomb.mesh = null;
    }
  }

  plantBomb(unit, site) {
    if (this.bomb.planted || !unit.hasBomb) return;
    unit.hasBomb = false;
    unit.plantProgress = 0;
    this.bomb.planted = true;
    this.bomb.site = site;
    this.bomb.position = this.map.sites[site].clone();
    this.bomb.timer = BOMB_TIME;
    this.phase = PHASE.BOMB;
    this.phaseLabel = 'WARHEAD';
    this.timer = BOMB_TIME;

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.7, 0.8),
      new THREE.MeshStandardMaterial({
        color: 0x222222,
        emissive: 0xe85d04,
        emissiveIntensity: 0.5,
        metalness: 0.6,
        roughness: 0.4,
      })
    );
    mesh.position.copy(this.bomb.position);
    mesh.position.y = 1.2;
    this.scene.add(mesh);
    this.bomb.mesh = mesh;

    unit.money = Math.min(MAX_MONEY, unit.money + PLANT_REWARD);
    SFX.plant();
    this.ui.toast(`WARHEAD PLANTED · ${site}`);
    this.ui.showBanner('WARHEAD PLANTED', `Site ${site}`);
  }

  defuseBomb(unit) {
    if (!this.bomb.planted) return;
    this.clearBomb();
    SFX.roundWin();
    this.endRound(TEAMS.SENTINELS, 'Warhead defused');
  }

  endRound(winner, reason) {
    if (this.phase === PHASE.END) return;
    this.phase = PHASE.END;
    this.phaseLabel = 'ROUND';
    this.score[winner] += 1;

    const loser = winner === TEAMS.RAIDERS ? TEAMS.SENTINELS : TEAMS.RAIDERS;
    this.lossStreak[winner] = 0;
    this.lossStreak[loser] = Math.min(4, this.lossStreak[loser] + 1);

    for (const u of this.units) {
      if (u.team === winner) {
        u.money = Math.min(MAX_MONEY, u.money + WIN_REWARD);
      } else {
        u.money = Math.min(MAX_MONEY, u.money + LOSS_REWARDS[this.lossStreak[loser]]);
      }
    }

    const winLabel = winner === TEAMS.RAIDERS ? 'RAIDERS WIN' : 'SENTINELS WIN';
    this.ui.showBanner(winLabel, reason);
    if (winner === this.player.team) SFX.roundWin();
    else SFX.roundLoss();

    if (this.score.raiders >= ROUNDS_TO_WIN || this.score.sentinels >= ROUNDS_TO_WIN) {
      setTimeout(() => {
        this.ui.showBanner(
          this.score.raiders > this.score.sentinels ? 'RAIDERS MATCH WIN' : 'SENTINELS MATCH WIN',
          `${this.score.raiders} – ${this.score.sentinels}`
        );
        setTimeout(() => {
          this.running = false;
          this.ui.hideAllScreens();
          document.getElementById('hud').classList.add('hidden');
          this.input.exitLock();
          this.ui.showScreen('menu');
        }, 2800);
      }, 2200);
      return;
    }

    setTimeout(() => this.beginRound(), 3200);
  }

  openBuyMenu() {
    if (!this.running || this.phase !== PHASE.BUY) return;
    this.buyOpen = true;
    this.input.exitLock();
    this.ui.openBuy();
  }

  closeBuyMenu() {
    this.buyOpen = false;
    this.ui.closeBuy();
    if (this.running) this.input.requestLock();
  }

  buyVehicle(id) {
    const p = this.player;
    const v = VEHICLES[id];
    if (!v || !p) return;
    if (p.loadout.includes(id)) {
      p.equip(id, p.loadout.indexOf(id));
      this.ui.renderBuy();
      return;
    }
    if (p.money < v.price) {
      this.ui.toast('Not enough credits');
      return;
    }
    p.money -= v.price;
    // fill first empty slot or replace active
    let slot = p.loadout.findIndex((x) => !x);
    if (slot < 0) slot = p.activeSlot;
    p.equip(id, slot);
    SFX.buy();
    this.ui.renderBuy();
    this.ui.toast(`Purchased ${v.name}`);
  }

  buyGear(id) {
    const p = this.player;
    const g = GEAR[id];
    if (!g || !p) return;
    if (p.money < g.price) {
      this.ui.toast('Not enough credits');
      return;
    }
    if (id === 'plating') {
      p.money -= g.price;
      p.armor = 100;
    } else if (id === 'kit_smoke') {
      p.money -= g.price;
      p.hasSmoke += 1;
    } else if (id === 'kit_emp') {
      p.money -= g.price;
      p.hasEmp += 1;
    } else if (id === 'defuse_kit') {
      if (p.team !== TEAMS.SENTINELS) return;
      p.money -= g.price;
      p.hasDefuseKit = true;
    }
    SFX.buy();
    this.ui.renderBuy();
    this.ui.toast(`Purchased ${g.name}`);
  }

  moveUnit(unit, next) {
    const def = unit.vehicle;
    const water = this.map.isWater(next.x, next.z);
    const cur = unit.mesh.position;

    if (def.domain === 'land' && water) {
      return;
    }
    if (def.domain === 'sea' && !water) {
      // Allow slow beaching so ships can leave land spawns / cross pads
      const dx = next.x - cur.x;
      const dz = next.z - cur.z;
      next.x = cur.x + dx * 0.4;
      next.z = cur.z + dz * 0.4;
    }

    for (const c of this.map.colliders) {
      const px = Math.max(c.min.x, Math.min(next.x, c.max.x));
      const pz = Math.max(c.min.z, Math.min(next.z, c.max.z));
      const dx = next.x - px;
      const dz = next.z - pz;
      if (dx * dx + dz * dz < 1.6 * 1.6) {
        return;
      }
    }

    next.x = Math.max(-55, Math.min(55, next.x));
    next.z = Math.max(-50, Math.min(45, next.z));
    unit.mesh.position.x = next.x;
    unit.mesh.position.z = next.z;
  }

  tryFire(unit) {
    if (!unit.alive) return;
    if (this.phase !== PHASE.LIVE && this.phase !== PHASE.BOMB) return;
    if (unit.fireCooldown > 0 || unit.reloadT > 0) return;
    const def = unit.vehicle;
    const ammo = unit.ammo[def.id];
    if (!ammo || ammo.mag <= 0) {
      this.startReload(unit);
      return;
    }
    ammo.mag -= 1;
    unit.fireCooldown = 1 / def.fireRate;
    unit.recoil = Math.min(0.2, unit.recoil + def.recoil);

    const origin = unit.mesh.position.clone();
    origin.y += def.domain === 'air' ? 0.5 : 1.2;
    const spread = def.spread + unit.recoil;
    const yaw = unit.yaw + (Math.random() - 0.5) * spread * 2;
    const pitch = (unit.isPlayer ? -unit.pitch : 0) + (Math.random() - 0.5) * spread;
    const dir = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch)
    ).normalize();

    const trail = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 6, 6),
      new THREE.MeshBasicMaterial({ color: def.category === 'heavy' ? 0xff6a1a : 0xfff2c0 })
    );
    trail.position.copy(origin);
    this.scene.add(trail);

    this.projectiles.push({
      pos: origin,
      dir,
      speed: 90,
      life: def.range / 90,
      damage: def.damage,
      pen: def.armorPen,
      owner: unit,
      heavy: def.category === 'heavy',
      trail,
    });

    if (unit.isPlayer) {
      SFX.fire(def.category === 'heavy');
      document.getElementById('crosshair')?.classList.add('firing');
      setTimeout(() => document.getElementById('crosshair')?.classList.remove('firing'), 60);
    }
  }

  startReload(unit) {
    const def = unit.vehicle;
    const ammo = unit.ammo[def.id];
    if (!ammo || unit.reloadT > 0) return;
    if (ammo.mag >= def.magSize || ammo.reserve <= 0) return;
    unit.reloadT = def.reload;
  }

  finishReload(unit) {
    const def = unit.vehicle;
    const ammo = unit.ammo[def.id];
    const need = def.magSize - ammo.mag;
    const take = Math.min(need, ammo.reserve);
    ammo.mag += take;
    ammo.reserve -= take;
  }

  updatePlayer(dt) {
    const p = this.player;
    if (!p || !p.alive) return;

    if (this.buyOpen) return;

    const { dx, dy } = this.input.consumeMouseDelta();
    const sens = 0.0022;
    p.yaw -= dx * sens;
    p.pitch -= dy * sens;
    p.pitch = Math.max(-0.5, Math.min(0.85, p.pitch));
    this.camYaw = p.yaw;
    this.camPitch = 0.4 + p.pitch * 0.35;
    p.mesh.rotation.y = p.yaw;

    const speed = p.vehicle.speed;
    const forward = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    const right = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
    const move = new THREE.Vector3();
    if (this.input.pressed('KeyW')) move.add(forward);
    if (this.input.pressed('KeyS')) move.sub(forward);
    if (this.input.pressed('KeyA')) move.sub(right);
    if (this.input.pressed('KeyD')) move.add(right);
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * dt);
      this.moveUnit(p, p.mesh.position.clone().add(move));
    }
    p._adjustHeight();

    if (this.input.mouse.down) this.tryFire(p);
    if (this.input.pressed('KeyR')) this.startReload(p);

    // plant / defuse
    if (this.input.pressed('KeyE')) {
      if (p.team === TEAMS.RAIDERS && p.hasBomb && !this.bomb.planted) {
        for (const [label, site] of Object.entries(this.map.sites)) {
          if (p.mesh.position.distanceTo(site) < 4.5) {
            p.plantProgress += dt;
            this.ui.toast(`Planting… ${Math.floor((p.plantProgress / PLANT_TIME) * 100)}%`, 400);
            if (p.plantProgress >= PLANT_TIME) this.plantBomb(p, label);
            break;
          }
        }
      } else if (p.team === TEAMS.SENTINELS && this.bomb.planted) {
        if (p.mesh.position.distanceTo(this.bomb.position) < 4) {
          const need = p.hasDefuseKit ? DEFUSE_TIME * 0.5 : DEFUSE_TIME;
          p.defuseProgress += dt;
          this.ui.toast(`Defusing… ${Math.floor((p.defuseProgress / need) * 100)}%`, 400);
          if (p.defuseProgress >= need) this.defuseBomb(p);
        }
      }
    } else {
      p.plantProgress = 0;
      p.defuseProgress = 0;
    }

    // utilities
    if (this.input.pressed('KeyG') && p.hasSmoke > 0) {
      p.hasSmoke -= 1;
      this.deploySmoke(p);
      this.input.keys.KeyG = false;
    }
    if (this.input.pressed('KeyF') && p.hasEmp > 0) {
      p.hasEmp -= 1;
      this.deployEmp(p);
      this.input.keys.KeyF = false;
    }
  }

  deploySmoke(unit) {
    const cloud = new THREE.Mesh(
      new THREE.SphereGeometry(6, 16, 12),
      new THREE.MeshStandardMaterial({
        color: 0xb0c0c8,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      })
    );
    const ahead = unit.mesh.position.clone().add(
      new THREE.Vector3(Math.sin(unit.yaw), 0, Math.cos(unit.yaw)).multiplyScalar(10)
    );
    ahead.y = 3;
    cloud.position.copy(ahead);
    cloud.userData.life = 10;
    this.scene.add(cloud);
    this._smokeClouds.push(cloud);
    this.ui.toast('Smoke barrage deployed');
  }

  deployEmp(unit) {
    for (const u of this.units) {
      if (u.team === unit.team || !u.alive) continue;
      if (u.mesh.position.distanceTo(unit.mesh.position) < 28) {
        u.flashT = 2.2;
      }
    }
    this.ui.toast('EMP flash out');
    SFX.ui();
  }

  updateProjectiles(dt) {
    const remain = [];
    for (const p of this.projectiles) {
      p.life -= dt;
      p.pos.addScaledVector(p.dir, p.speed * dt);
      if (p.trail) p.trail.position.copy(p.pos);

      let hit = p.life <= 0;
      if (!hit) {
        for (const u of this.units) {
          if (!u.alive || u === p.owner || u.team === p.owner.team) continue;
          const dist = u.mesh.position.distanceTo(p.pos);
          const radius = u.vehicle.domain === 'air' ? 2.2 : 1.8;
          if (dist < radius) {
            const result = u.takeDamage(p.damage, p.owner, p.pen);
            if (p.owner.isPlayer) SFX.hit();
            if (result.killed) {
              p.owner.kills += 1;
              p.owner.money = Math.min(MAX_MONEY, p.owner.money + KILL_REWARD);
              SFX.kill();
              this.ui.killFeed(p.owner, u, p.owner.vehicle.name);
              this.ui.toast(p.owner.isPlayer ? `Destroyed ${u.name}` : `${p.owner.name} wrecked ${u.name}`);
              this.checkElimination();
              if (u.hasBomb) {
                u.hasBomb = false;
                const living = this.units.filter((x) => x.alive && x.team === TEAMS.RAIDERS);
                if (living.length) {
                  const n = living[Math.floor(Math.random() * living.length)];
                  n.hasBomb = true;
                  this.bomb.carrier = n;
                  if (n.isPlayer) this.ui.toast('You recovered the warhead');
                }
              }
            }
            hit = true;
            break;
          }
        }
      }
      if (!hit) {
        for (const c of this.map.colliders) {
          if (
            p.pos.x >= c.min.x && p.pos.x <= c.max.x &&
            p.pos.z >= c.min.z && p.pos.z <= c.max.z &&
            p.pos.y <= c.max.y
          ) {
            hit = true;
            break;
          }
        }
      }
      if (hit) {
        if (p.trail) this.scene.remove(p.trail);
      } else {
        remain.push(p);
      }
    }
    this.projectiles = remain;
  }

  checkElimination() {
    const raidersAlive = this.units.some((u) => u.alive && u.team === TEAMS.RAIDERS);
    const sentAlive = this.units.some((u) => u.alive && u.team === TEAMS.SENTINELS);
    if (!sentAlive) this.endRound(TEAMS.RAIDERS, 'Sentinels eliminated');
    else if (!raidersAlive && !this.bomb.planted) this.endRound(TEAMS.SENTINELS, 'Raiders eliminated');
  }

  updateCamera() {
    const p = this.player;
    if (!p) return;
    const target = p.alive ? p.mesh.position : new THREE.Vector3(0, 0, 0);
    const dist = this.camDist;
    const height = this.camHeight + (p.vehicle?.domain === 'air' ? 4 : 0);
    const yaw = this.camYaw;
    const pitch = this.camPitch;
    const offset = new THREE.Vector3(
      -Math.sin(yaw) * Math.cos(pitch) * dist,
      height + Math.sin(pitch) * 4,
      -Math.cos(yaw) * Math.cos(pitch) * dist
    );
    const desired = target.clone().add(offset);
    this.camera.position.lerp(desired, 0.15);
    const look = target.clone();
    look.y += 1.5;
    this.camera.lookAt(look);

    if (p.flashT > 0) {
      document.getElementById('damage-fx').style.opacity = Math.min(0.95, 0.55 + p.flashT * 0.2);
    }
  }

  update(dt) {
    if (!this.running) return;

    // phase timer
    if (this.phase !== PHASE.END) {
      this.timer -= dt;
      if (this.phase === PHASE.BUY && this.timer <= 0) {
        this.phase = PHASE.LIVE;
        this.phaseLabel = 'LIVE';
        this.timer = ROUND_TIME;
        this.closeBuyMenu();
        this.ui.showBanner('FIGHT', `Round ${this.roundNumber}`);
        this.ui.toast('Weapons free');
      } else if (this.phase === PHASE.LIVE && this.timer <= 0) {
        // time expired
        if (this.bomb.planted) {
          // shouldn't happen — bomb phase overrides
        } else {
          this.endRound(TEAMS.SENTINELS, 'Time expired — sites held');
        }
      } else if (this.phase === PHASE.BOMB) {
        this.bomb.timer = this.timer;
        this._beepAcc += dt;
        const interval = Math.max(0.15, this.bomb.timer / 25);
        if (this._beepAcc >= interval) {
          this._beepAcc = 0;
          SFX.bombBeep();
        }
        if (this.timer <= 0) {
          this.ui.showBanner('WARHEAD DETONATED', 'Site destroyed');
          this.endRound(TEAMS.RAIDERS, 'Warhead detonated');
        }
      }
    }

    // cooldowns
    for (const u of this.units) {
      if (!u.alive) continue;
      u.fireCooldown = Math.max(0, u.fireCooldown - dt);
      u.recoil = Math.max(0, u.recoil - dt * 0.12);
      u.flashT = Math.max(0, u.flashT - dt);
      if (u.reloadT > 0) {
        u.reloadT -= dt;
        if (u.reloadT <= 0) {
          u.reloadT = 0;
          this.finishReload(u);
        }
      }
    }

    this.updatePlayer(dt);
    for (const u of this.units) {
      if (!u.isPlayer) updateBot(u, this, dt);
    }
    this.updateProjectiles(dt);

    for (const c of this._smokeClouds) {
      c.userData.life -= dt;
      c.material.opacity = Math.max(0, Math.min(0.55, c.userData.life / 10));
    }
    this._smokeClouds = this._smokeClouds.filter((c) => {
      if (c.userData.life <= 0) {
        this.scene.remove(c);
        return false;
      }
      return true;
    });

    if (this.bomb.mesh) {
      this.bomb.mesh.rotation.y += dt * 2;
      this.bomb.mesh.position.y = 1.2 + Math.sin(performance.now() * 0.008) * 0.1;
    }

    this.updateCamera();
    this.ui.updateHud();
    this.ui.updateScoreboard(this.input.pressed('Tab'));
  }

  onKeyDown(e) {
    if (!this.running) return;
    if (e.code === 'KeyB') {
      if (this.phase === PHASE.BUY) {
        if (this.buyOpen) this.closeBuyMenu();
        else this.openBuyMenu();
      }
    }
    if (e.code === 'Digit1') this.player?.switchSlot(0);
    if (e.code === 'Digit2') this.player?.switchSlot(1);
    if (e.code === 'Digit3') this.player?.switchSlot(2);
    if (e.code === 'Escape' && this.buyOpen) this.closeBuyMenu();
  }
}
