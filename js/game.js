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
import {
  createProjectileMesh, createBombMesh, createTorpedoMesh, createLandmineMesh,
  orientProjectile, spawnMuzzleFlash, spawnImpact,
  spawnExplosion, spawnSmokeCloud, spawnEmpBurst, updateVfxList,
  attachDeathFire, updateDeathFire,
} from './vfx.js';
import { MODES } from './progression.js';
import { resolveQuality } from './graphics.js';

export class Game {
  constructor({ scene, camera, input, ui, inventory, lighting = null, quality = null, onQualityChange = null }) {
    this.scene = scene;
    this.camera = camera;
    this.input = input;
    this.ui = ui;
    this.inventory = inventory;
    this.lighting = lighting;
    this.quality = quality || resolveQuality();
    this.onQualityChange = onQualityChange;
    this.mapId = 'ironfront';
    this.modeId = 'strike';
    this.mode = MODES.strike;
    this.map = createMap(scene, this.mapId, this.quality);
    this.applyMapTheme();
    this.units = [];
    this.player = null;
    this.projectiles = [];
    this.effects = [];
    this.score = { raiders: 0, sentinels: 0 };
    this.frags = { raiders: 0, sentinels: 0 };
    this.lossStreak = { raiders: 0, sentinels: 0 };
    this.roundNumber = 0;
    this.phase = PHASE.BUY;
    this.timer = BUY_TIME;
    this.phaseLabel = 'BUY';
    this.plantTime = PLANT_TIME;
    this.defuseTime = DEFUSE_TIME;
    this.waveKills = 0;
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
    this._beepAcc = 0;
    this.camDist = 14;
    this.camHeight = 8;
    this.camYaw = 0;
    this.camPitch = 0.45;
    this.mines = [];
    this._gearApplied = false;
  }

  applyMapTheme() {
    const theme = this.map?.theme;
    if (!theme || !this.scene) return;
    this.scene.background = new THREE.Color(theme.bg);
    const fogMul = this.quality?.fogBoost || 1;
    this.scene.fog = new THREE.FogExp2(theme.fog, theme.fogDensity * fogMul);
    if (this.lighting?.hemi) {
      this.lighting.hemi.color.set(theme.hemiSky);
      this.lighting.hemi.groundColor.set(theme.hemiGround);
    }
    if (this.lighting?.sun) {
      this.lighting.sun.color.set(theme.sun);
      this.lighting.sun.intensity = theme.sunIntensity * (this.quality?.low ? 0.9 : 1);
    }
  }

  loadMap(mapId) {
    if (this.map?.group) this.scene.remove(this.map.group);
    this.mapId = mapId || 'ironfront';
    this.map = createMap(this.scene, this.mapId, this.quality);
    this.applyMapTheme();
  }

  setGraphicsQuality(qualityOrPreset) {
    this.quality = typeof qualityOrPreset === 'string'
      ? resolveQuality(qualityOrPreset)
      : (qualityOrPreset || resolveQuality());
    // Always rebuild the battlefield so Ultra ↔ Low Poly actually changes what you see
    this.loadMap(this.mapId);
    this.onQualityChange?.(this.quality);
    return this.quality;
  }


  startMatch(teamOrOpts, maybeMap, maybeMode) {
    const opts = typeof teamOrOpts === 'object' && teamOrOpts
      ? teamOrOpts
      : { team: teamOrOpts, mapId: maybeMap, modeId: maybeMode };

    const profile = this.inventory?.profile || {};
    this.modeId = opts.modeId || profile.selectedMode || 'strike';
    this.mode = MODES[this.modeId] || MODES.strike;
    const mapId = opts.mapId || profile.selectedMap || 'ironfront';
    if (mapId !== this.mapId) this.loadMap(mapId);
    else this.applyMapTheme();

    let team = opts.team || TEAMS.RAIDERS;
    if (!this.mode.teams) team = TEAMS.RAIDERS;

    SFX.unlock();
    SFX.ui();
    this.ui.hideAllScreens();
    this.running = true;
    this.score = { raiders: 0, sentinels: 0 };
    this.frags = { raiders: 0, sentinels: 0 };
    this.waveKills = 0;
    this.lossStreak = { raiders: 0, sentinels: 0 };
    this.roundNumber = 0;

    for (const u of this.units) this.scene.remove(u.mesh);
    this.units = [];

    const spawnsR = getSpawns('raiders');
    const spawnsS = getSpawns('sentinels');
    const groundY = (x, z) => this.map.groundHeight(x, z);

    const fleet = (this.inventory?.matchLoadout?.() || [])
      .filter((id) => id && (!this.inventory || this.inventory.ownsVehicle(id)));
    const primary = fleet[0] || 'scout_tracker';
    this.player = new Unit({
      id: 'player',
      name: this.mode.freeRoam ? 'Vigilante' : 'You',
      team,
      isPlayer: true,
      spawn: team === TEAMS.RAIDERS ? spawnsR[0] : spawnsS[0],
      vehicleId: primary,
      getSkin: (vid) => this.inventory?.getEquipped(vid) || null,
      getGroundY: groundY,
    });
    // Equipped fleet only — never put locked craft in loadout slots
    this.player.loadout = [
      fleet[0] || primary,
      fleet[1] || null,
      fleet[2] || null,
    ];
    this.player.activeSlot = 0;
    this.player._ensureAmmo?.(primary);
    this.player._swapMesh?.();
    this.player._refillOrdnance?.();
    this.player.money = this.mode.freeRoam ? MAX_MONEY : START_MONEY;
    this.scene.add(this.player.mesh);
    this.units.push(this.player);
    this.placeDomainVehicle(this.player);
    this.clearMines();

    if (this.mode.bots === 'full') {
      const roster = opts.roster || null;
      const addBot = (id, name, teamKey, spawn) => {
        const u = new Unit({
          id,
          name,
          team: teamKey,
          spawn,
          vehicleId: 'scout_tracker',
          getGroundY: groundY,
        });
        u.money = START_MONEY;
        this.scene.add(u.mesh);
        this.units.push(u);
      };

      if (roster?.raiders && roster?.sentinels) {
        let rSpawn = team === TEAMS.RAIDERS ? 1 : 0;
        let sSpawn = team === TEAMS.SENTINELS ? 1 : 0;
        roster.raiders.forEach((slot, i) => {
          if (slot.kind === 'you') return;
          const spawn = spawnsR[rSpawn % spawnsR.length];
          rSpawn += 1;
          addBot(
            `r${i}`,
            slot.name || BOT_NAMES.raiders[i % BOT_NAMES.raiders.length],
            TEAMS.RAIDERS,
            spawn
          );
        });
        roster.sentinels.forEach((slot, i) => {
          if (slot.kind === 'you') return;
          const spawn = spawnsS[sSpawn % spawnsS.length];
          sSpawn += 1;
          addBot(
            `s${i}`,
            slot.name || BOT_NAMES.sentinels[i % BOT_NAMES.sentinels.length],
            TEAMS.SENTINELS,
            spawn
          );
        });
      } else {
        const raiderBots = team === TEAMS.RAIDERS ? 3 : 4;
        const sentinelBots = team === TEAMS.SENTINELS ? 3 : 4;
        for (let i = 0; i < raiderBots; i++) {
          const spawn = spawnsR[team === TEAMS.RAIDERS ? i + 1 : i];
          addBot(`r${i}`, BOT_NAMES.raiders[i], TEAMS.RAIDERS, spawn);
        }
        for (let i = 0; i < sentinelBots; i++) {
          const spawn = spawnsS[team === TEAMS.SENTINELS ? i + 1 : i];
          addBot(`s${i}`, BOT_NAMES.sentinels[i], TEAMS.SENTINELS, spawn);
        }
      }
    } else if (this.mode.bots === 'hostiles' || this.mode.bots === 'waves') {
      const n = this.mode.hostileCount || 6;
      for (let i = 0; i < n; i++) {
        const spawn = spawnsS[i % spawnsS.length];
        const u = new Unit({
          id: `h${i}`,
          name: BOT_NAMES.sentinels[i % BOT_NAMES.sentinels.length],
          team: TEAMS.SENTINELS,
          spawn,
          vehicleId: ['scout_tracker', 'patrol_cutter', 'falcon_interceptor'][i % 3],
          getGroundY: groundY,
        });
        u.money = START_MONEY;
        this.scene.add(u.mesh);
        this.units.push(u);
        this.placeDomainVehicle(u);
      }
    }

    this.input.requestLock();
    this.beginRound();
    // After first round reset so consumable bombs/mags aren't wiped by refill
    this.applyPlayerGear();
  }

  /** Apply accessories + equipped warheads consumables to the player for this match. */
  applyPlayerGear() {
    if (!this.player || !this.inventory) return;
    const acc = this.inventory.accessoryMods();
    this.player.applyAccessories(acc);
    this.player._refillOrdnance?.();
    const { mods, used } = this.inventory.consumeMatchGear();
    this.player.applyMatchConsumables(mods);
    this._gearApplied = true;
    if (used?.length) {
      const names = used.map((id) => id.replace(/_/g, ' ')).join(', ');
      this.ui.toast(`Warheads loaded: ${names}`, 2800);
    } else if (Object.keys(this.inventory.data.accessories || {}).length) {
      this.ui.toast('Accessories online', 1600);
    }
  }

  clearMines() {
    for (const m of this.mines || []) {
      if (m.mesh) this.scene.remove(m.mesh);
    }
    this.mines = [];
  }

  beginRound() {
    this.roundNumber += 1;
    if (this.mode?.buyPhase === false || this.mode?.freeRoam) {
      this.phase = PHASE.LIVE;
      this.phaseLabel = this.mode.freeRoam ? 'VIGILANTE' : 'LIVE';
      this.timer = this.mode.freeRoam ? 9999 : ROUND_TIME;
    } else {
      this.phase = PHASE.BUY;
      this.phaseLabel = 'BUY';
      this.timer = BUY_TIME;
    }
    this.clearBomb();
    this.clearMines();
    for (const p of this.projectiles) {
      if (p.mesh) this.scene.remove(p.mesh);
    }
    this.projectiles = [];
    // Clear lingering VFX from previous round
    for (const fx of this.effects) {
      if (fx.isMuzzle) {
        this.scene.remove(fx.sprite);
        if (fx.disc) this.scene.remove(fx.disc);
        if (fx.light) this.scene.remove(fx.light);
        for (const s of fx.sparks || []) this.scene.remove(s);
      } else {
        this.scene.remove(fx);
      }
    }
    this.effects = [];

    const spawnsR = getSpawns('raiders');
    const spawnsS = getSpawns('sentinels');
    let ri = 0;
    let si = 0;

    for (const u of this.units) {
      const spawn = u.team === TEAMS.RAIDERS ? spawnsR[ri++] : spawnsS[si++];
      u.resetForRound(spawn, true);
      if (u.isPlayer && this.inventory) {
        u.applyAccessories(this.inventory.accessoryMods());
        // Keep leftover match landmines / ordnance extras across rounds within a match
        if (u.matchMods) {
          u.bombs = Math.max(u.bombs || 0, (u.vehicle.bombs || 0) + (u.accMods?.bombCap || 0));
          u.torpedoes = Math.max(u.torpedoes || 0, (u.vehicle.torpedoes || 0) + (u.accMods?.torpedoCap || 0));
        }
      }
    }

    if (this.mode?.plant) {
      const raiders = this.units.filter((u) => u.team === TEAMS.RAIDERS);
      if (raiders.length) {
        const carrier = raiders[Math.floor(Math.random() * raiders.length)];
        carrier.hasBomb = true;
        this.bomb.carrier = carrier;
      }
    }

    if (this.mode?.freeRoam) {
      this.ui.showBanner('VIGILANTE', `${this.mode.name} · free roam`);
      this.ui.toast('Free roam — Esc extract · F gun · B bombs · T torpedoes · X landmine');
    } else if (this.mode?.buyPhase === false) {
      this.ui.showBanner(this.mode.name.toUpperCase(), 'Fight');
    } else {
      this.ui.showBanner(`ROUND ${this.roundNumber}`, this.mode?.name || 'Buy phase');
      this.ui.toast('Press B to open arsenal · X plant landmine');
    }
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
    if (this.mode?.freeRoam) return;
    this.phase = PHASE.END;
    this.phaseLabel = 'ROUND';

    // Frag / siege modes end the whole match from objectives — no classic rounds
    if (this.mode?.fragLimit || this.mode?.bots === 'waves') {
      this.finishMatch(winner === this.player.team, reason);
      return;
    }

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

    const need = this.mode?.roundsToWin || ROUNDS_TO_WIN;
    if (this.score.raiders >= need || this.score.sentinels >= need) {
      const playerWon =
        (this.score.raiders > this.score.sentinels && this.player.team === TEAMS.RAIDERS) ||
        (this.score.sentinels > this.score.raiders && this.player.team === TEAMS.SENTINELS);
      this.finishMatch(playerWon, reason);
      return;
    }

    setTimeout(() => this.beginRound(), 3200);
  }

  finishMatch(playerWon, reason = '') {
    if (this.phase === PHASE.END && this._finishing) return;
    this._finishing = true;
    this.phase = PHASE.END;
    this.phaseLabel = 'END';
    const deposit = 400 + this.player.kills * 80 + (playerWon ? 900 : 250) + Math.floor(this.player.money * 0.15);
    const xp = 120 + this.player.kills * 35 + (playerWon ? 200 : 60);
    this.inventory?.recordMatch(playerWon, deposit, xp);
    const title = playerWon ? 'OPERATION SUCCESS' : 'OPERATION FAILED';
    this.ui.showBanner(title, reason || `Bank +${deposit}`);
    if (playerWon) SFX.roundWin();
    else SFX.roundLoss();
    setTimeout(() => {
      this.ui.showBanner(
        playerWon ? 'MATCH WIN' : 'MATCH LOSS',
        `Bank +${deposit} · XP +${xp} · Lv ${this.inventory?.profile?.level || 1}`
      );
      setTimeout(() => {
        this.running = false;
        this._finishing = false;
        this.ui.hideAllScreens();
        document.getElementById('hud').classList.add('hidden');
        this.input.exitLock();
        this.ui.refreshMeta?.();
        this.ui.showScreen('menu');
      }, 2800);
    }, 2200);
  }

  extractVigilante() {
    if (!this.mode?.freeRoam || this.phase === PHASE.END) return;
    this.phase = PHASE.END;
    this.phaseLabel = 'EXTRACT';
    const deposit = 500 + this.player.kills * 100 + Math.floor(this.player.money * 0.1);
    const xp = 80 + this.player.kills * 40;
    this.inventory?.recordMatch(true, deposit, xp);
    SFX.roundWin();
    this.ui.showBanner('EXTRACTED', `Solo run complete · Bank +${deposit} · XP +${xp}`);
    setTimeout(() => {
      this.running = false;
      this.ui.hideAllScreens();
      document.getElementById('hud').classList.add('hidden');
      this.input.exitLock();
      this.ui.refreshMeta?.();
      this.ui.showScreen('menu');
    }, 2600);
  }

  detonateOrdnance(p) {
    this.spawnExplosion(p.pos.clone());
    const radius = p.radius || 6;
    for (const u of this.units) {
      if (!u.alive || u === p.owner) continue;
      if (this.mode?.teams && u.team === p.owner.team) continue;
      const dist = u.mesh.position.distanceTo(p.pos);
      if (dist > radius) continue;
      const falloff = 1 - dist / radius;
      const dmg = p.damage * (0.45 + falloff * 0.55);
      const result = u.takeDamage(dmg, p.owner, p.pen);
      if (p.owner.isPlayer) SFX.hit();
      if (result.killed) {
        p.owner.kills += 1;
        this.frags[p.owner.team] = (this.frags[p.owner.team] || 0) + 1;
        if (p.owner.isPlayer) this.waveKills += 1;
        p.owner.money = Math.min(MAX_MONEY, p.owner.money + KILL_REWARD);
        SFX.kill();
        this.beginDeathFall(u);
        this.ui.killFeed(p.owner, u, p.kind === 'torpedo' ? 'TORPEDO' : 'BOMB');
        this.ui.toast(p.owner.isPlayer ? `Destroyed ${u.name}` : `${p.owner.name} wrecked ${u.name}`);
        this.checkElimination();
        this.checkModeObjectives();
      }
    }
  }

  checkModeObjectives() {
    if (this.phase === PHASE.END) return;
    if (this.mode?.fragLimit) {
      const need = this.mode.fragLimit;
      if ((this.frags.raiders || 0) >= need) {
        this.endRound(TEAMS.RAIDERS, `${need} frags`);
        return;
      }
      if ((this.frags.sentinels || 0) >= need) {
        this.endRound(TEAMS.SENTINELS, `${need} frags`);
        return;
      }
    }
    if (this.mode?.bots === 'waves' && this.waveKills >= (this.mode.waveKills || 12)) {
      this.endRound(this.player.team, 'Siege held');
      return;
    }
    if (this.mode?.bots === 'waves') {
      const hostilesAlive = this.units.some((u) => u.alive && u.team === TEAMS.SENTINELS);
      if (!hostilesAlive) this.spawnSiegeWave();
    }
  }

  spawnSiegeWave() {
    const spawnsS = getSpawns('sentinels');
    const groundY = (x, z) => this.map.groundHeight(x, z);
    const pool = ['scout_tracker', 'patrol_cutter', 'falcon_interceptor', 'mbt_anvil', 'destroyer_hull'];
    for (let i = 0; i < 4; i++) {
      const spawn = spawnsS[i % spawnsS.length];
      const u = new Unit({
        id: `w${this.roundNumber}_${Date.now()}_${i}`,
        name: BOT_NAMES.sentinels[i % BOT_NAMES.sentinels.length],
        team: TEAMS.SENTINELS,
        spawn,
        vehicleId: pool[i % pool.length],
        getGroundY: groundY,
      });
      u.money = START_MONEY;
      this.scene.add(u.mesh);
      this.units.push(u);
      this.placeDomainVehicle(u);
    }
    this.ui.toast('Incoming siege wave');
    this.ui.showBanner('WAVE INBOUND', `${this.waveKills} / ${this.mode.waveKills} kills`);
  }

  openBuyMenu() {
    if (!this.running) return;
    if (this.phase !== PHASE.BUY && !this.mode?.freeRoam) return;
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
    if (!this.inventory?.ownsVehicle(id)) {
      this.ui.toast('Only crate-unlocked craft can be used');
      return;
    }
    if (p.loadout.includes(id)) {
      p.equip(id, p.loadout.indexOf(id));
      this.placeDomainVehicle(p);
      this.ui.renderBuy();
      return;
    }
    if (p.money < v.price) {
      this.ui.offerAdPurchase?.({
        shortfall: v.price - p.money,
        currency: 'match',
        title: `Need $${v.price - p.money} more`,
        body: `Watch an ad to deploy the ${v.name}.`,
        onMatchGrant: (n) => {
          p.money = Math.min(MAX_MONEY, p.money + n);
        },
        retry: () => this.buyVehicle(id),
      }) || this.ui.toast('Not enough tokens');
      return;
    }
    // find empty slot or replace active
    let slot = p.loadout.findIndex((x) => !x);
    if (slot < 0) slot = p.activeSlot;
    p.money -= v.price;
    p.equip(id, slot);
    this.placeDomainVehicle(p);
    SFX.buy();
    this.ui.renderBuy();
    this.ui.toast(`Deployed ${v.name}`);
  }

  /** Put sea craft into water / jets into air so they aren't stuck underground. */
  placeDomainVehicle(unit) {
    if (!unit?.mesh || !unit.vehicle) return;
    const d = unit.vehicle.domain;
    if (d === 'sea') {
      if (this.map.isWater && !this.map.isWater(unit.mesh.position.x, unit.mesh.position.z)) {
        const sea = this.map.nearestWater(unit.mesh.position.x, unit.mesh.position.z);
        if (sea) {
          unit.mesh.position.x = sea.x;
          unit.mesh.position.z = sea.z;
          this.ui.toast('Ship deployed to open water');
        }
      }
      unit.mesh.position.y = 0.2;
      unit.grounded = true;
      unit.vy = 0;
    } else if (d === 'air') {
      unit.mesh.position.y = 8;
      unit.grounded = true;
      unit.vy = 0;
    } else {
      unit._adjustHeight?.();
    }
  }

  buyGear(id) {
    const p = this.player;
    const g = GEAR[id];
    if (!g || !p) return;
    if (p.money < g.price) {
      this.ui.offerAdPurchase?.({
        shortfall: g.price - p.money,
        currency: 'match',
        title: `Need $${g.price - p.money} more`,
        body: `Watch an ad to buy ${g.name}.`,
        onMatchGrant: (n) => {
          p.money = Math.min(MAX_MONEY, p.money + n);
        },
        retry: () => this.buyGear(id),
      }) || this.ui.toast('Not enough credits');
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
    const water = this.map.isWater(next.x, next.z, def.domain);

    // Ships stay in ocean/river only. Land craft MAY enter water — they sink.
    if (def.domain === 'sea' && !water) {
      return;
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

  /** Land vehicles can drive into ocean/river but sink and take damage. */
  updateWaterHazard(unit, dt) {
    if (!unit?.alive || unit.vehicle.domain !== 'land') {
      if (unit) unit.sinkT = 0;
      return;
    }
    const wet = this.map.isWater(unit.mesh.position.x, unit.mesh.position.z, 'land');
    if (!wet) {
      unit.sinkT = 0;
      return;
    }
    unit.sinkT = (unit.sinkT || 0) + dt;
    const targetY = 0.05 - Math.min(2.4, unit.sinkT * 0.9);
    unit.mesh.position.y += (targetY - unit.mesh.position.y) * Math.min(1, 4 * dt);
    unit.grounded = false;
    unit.vy = Math.min(unit.vy || 0, -0.5);
    if (unit.isPlayer && unit.sinkT > 0.35) {
      this.ui.toast('Sinking! Reach shore or a bridge', 700);
    }
    if (unit.sinkT > 1.15) {
      const res = unit.takeDamage(32 * dt, null, 1);
      if (res.killed) {
        this.beginDeathFall(unit);
        this.ui.killFeed(unit, unit, 'SANK');
        if (unit.isPlayer) this.ui.toast('You sank');
        else this.ui.toast(`${unit.name} sank`);
        this.checkElimination();
        this.checkModeObjectives?.();
      }
    }
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

    const heavy = def.category === 'heavy';
    const origin = unit.mesh.position.clone();
    origin.y += def.domain === 'air' ? 0.6 : 1.45;
    // Offset muzzle forward along facing
    origin.x += Math.sin(unit.yaw) * (def.domain === 'air' ? 2.2 : 3.2);
    origin.z += Math.cos(unit.yaw) * (def.domain === 'air' ? 2.2 : 3.2);

    const spreadMul = unit.accMods?.spreadMult || 1;
    const spread = (def.spread + unit.recoil) * spreadMul;
    const yaw = unit.yaw + (Math.random() - 0.5) * spread * 2;
    // Match look aim: positive pitch aims upward (do not invert for the player)
    const pitch = (unit.pitch || 0) + (Math.random() - 0.5) * spread;
    const dir = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch)
    ).normalize();

    const mesh = createProjectileMesh(heavy);
    mesh.position.copy(origin);
    orientProjectile(mesh, dir);
    this.scene.add(mesh);

    const muzzle = spawnMuzzleFlash(this.scene, origin, dir, heavy);
    this.effects.push({ isMuzzle: true, ...muzzle });

    const dmgMul = 1 + (unit.matchMods?.damageBonus || 0);
    const penBonus = unit.matchMods?.armorPenBonus || 0;
    const flightLife = Math.min(5, def.range / (heavy ? 75 : 110));
    this.projectiles.push({
      kind: 'gun',
      pos: origin,
      dir,
      speed: heavy ? 75 : 110,
      life: flightLife,
      damage: def.damage * dmgMul,
      pen: def.armorPen + penBonus,
      owner: unit,
      heavy,
      mesh,
    });

    if (unit.isPlayer) {
      SFX.fire(heavy);
      document.getElementById('crosshair')?.classList.add('firing');
      setTimeout(() => document.getElementById('crosshair')?.classList.remove('firing'), 60);
    }
  }


  tryDropBomb(unit) {
    if (!unit?.alive) return;
    if (this.phase !== PHASE.LIVE && this.phase !== PHASE.BOMB) return;
    if (unit.vehicle.domain !== 'air') return;
    if ((unit.bombs || 0) <= 0) {
      if (unit.isPlayer) this.ui.toast('No bombs loaded');
      return;
    }
    if (unit.secondaryCooldown > 0) return;
    unit.bombs -= 1;
    unit._recentOrdnanceSpend = performance.now();
    unit._stashOrdnance?.();
    unit.secondaryCooldown = 0.55;
    const origin = unit.mesh.position.clone();
    origin.y -= 0.8;
    const mesh = createBombMesh();
    mesh.position.copy(origin);
    this.scene.add(mesh);
    this.projectiles.push({
      kind: 'bomb',
      pos: origin,
      dir: new THREE.Vector3(Math.sin(unit.yaw) * 0.15, -1, Math.cos(unit.yaw) * 0.15).normalize(),
      speed: 28,
      vy: -2,
      life: 6,
      damage: 95 + (unit.vehicle.bombs || 1) * 4,
      pen: 1,
      radius: 9 + (unit.matchMods?.bombRadius || 0),
      owner: unit,
      heavy: true,
      mesh,
    });
    if (unit.isPlayer) {
      SFX.fire(true);
      this.ui.toast(`Bomb away · ${unit.bombs} left`, 900);
    }
  }

  tryFireTorpedo(unit) {
    if (!unit?.alive) return;
    if (this.phase !== PHASE.LIVE && this.phase !== PHASE.BOMB) return;
    if (unit.vehicle.domain !== 'sea') return;
    if ((unit.torpedoes || 0) <= 0) {
      if (unit.isPlayer) this.ui.toast('No torpedoes loaded');
      return;
    }
    if (unit.secondaryCooldown > 0) return;
    unit.torpedoes -= 1;
    unit._recentOrdnanceSpend = performance.now();
    unit._stashOrdnance?.();
    unit.secondaryCooldown = 0.85;
    const dir = new THREE.Vector3(Math.sin(unit.yaw), 0, Math.cos(unit.yaw)).normalize();
    const origin = unit.mesh.position.clone().addScaledVector(dir, 3.5);
    origin.y = 0.35;
    const mesh = createTorpedoMesh();
    mesh.position.copy(origin);
    orientProjectile(mesh, dir);
    this.scene.add(mesh);
    this.projectiles.push({
      kind: 'torpedo',
      pos: origin,
      dir,
      speed: 42,
      life: unit.vehicle.range / 42 + 0.5,
      damage: 80 + (unit.vehicle.torpedoes || 1) * 5,
      pen: 0.95,
      radius: 4 + (unit.matchMods?.torpedoRadius || 0),
      owner: unit,
      heavy: true,
      mesh,
    });
    if (unit.isPlayer) {
      SFX.fire(true);
      this.ui.toast(`Torpedo · ${unit.torpedoes} left`, 900);
    }
  }

  startReload(unit) {
    const def = unit.vehicle;
    const ammo = unit.ammo[def.id];
    if (!ammo || unit.reloadT > 0) return;
    const magSize = unit.magSizeFor?.(def.id) || def.magSize;
    if (ammo.mag >= magSize || ammo.reserve <= 0) return;

    if (unit.isPlayer) {
      if (unit._triviaReloadPending) return;
      unit._triviaReloadPending = true;
      this.input.exitLock();
      const ask = this.ui.askTrivia?.({
        count: 1,
        title: 'RELOAD BLESSING',
        reason: 'Answer one Catholic Trivia question to chamber a fresh magazine.',
        kicker: 'CATHOLIC TRIVIA',
        cancellable: true,
      });
      Promise.resolve(ask).then((ok) => {
        unit._triviaReloadPending = false;
        if (!this.running) return;
        if (ok) {
          // Re-check ammo in case state changed during the quiz
          const a = unit.ammo[unit.vehicle.id];
          const cap = unit.magSizeFor?.(unit.vehicle.id) || unit.vehicle.magSize;
          if (a && a.mag < cap && a.reserve > 0 && unit.reloadT <= 0) {
            unit.reloadT = unit.vehicle.reload * (unit.accMods?.reloadMult || 1);
            this.ui.toast?.('Magazine blessed', 900);
          }
        } else {
          this.ui.toast?.('Reload denied — try the faith check again', 1400);
        }
        if (!this.buyOpen) this.input.requestLock();
      });
      return;
    }

    unit.reloadT = def.reload * (unit.accMods?.reloadMult || 1);
  }

  finishReload(unit) {
    const def = unit.vehicle;
    const ammo = unit.ammo[def.id];
    const magSize = unit.magSizeFor?.(def.id) || def.magSize;
    const need = magSize - ammo.mag;
    const take = Math.min(need, ammo.reserve);
    ammo.mag += take;
    ammo.reserve -= take;
  }

  tryPlantMine(unit) {
    if (!unit?.alive) return;
    if (this.phase !== PHASE.LIVE && this.phase !== PHASE.BOMB && !this.mode?.freeRoam) return;
    if (unit.vehicle.domain === 'air') {
      if (unit.isPlayer) this.ui.toast('Land to plant mines');
      return;
    }
    if ((unit.landmines || 0) <= 0) {
      if (unit.isPlayer) this.ui.toast('No landmines — equip a pack in Inventory');
      return;
    }
    const pos = unit.mesh.position.clone();
    // Don't stack mines on top of each other
    for (const m of this.mines) {
      if (m.pos.distanceTo(pos) < 2.2) {
        if (unit.isPlayer) this.ui.toast('Too close to another mine');
        return;
      }
    }
    unit.landmines -= 1;
    unit._recentOrdnanceSpend = performance.now();
    const mesh = createLandmineMesh();
    const ground = this.map.groundHeight(pos.x, pos.z);
    mesh.position.set(pos.x, ground + 0.06, pos.z);
    // Own mines always visible to planter
    mesh.visible = !!unit.isPlayer;
    this.scene.add(mesh);
    this.mines.push({
      mesh,
      pos: mesh.position.clone(),
      owner: unit,
      team: unit.team,
      armed: true,
    });
    if (unit.isPlayer) {
      SFX.plant();
      this.ui.toast(`Mine planted · ${unit.landmines} left`, 1200);
    }
  }

  updateMines(dt) {
    if (!this.mines?.length) return;
    const p = this.player;
    const remain = [];
    for (const mine of this.mines) {
      // Visibility rules for the local player
      if (p?.alive && mine.mesh) {
        const own = mine.owner === p || mine.team === p.team;
        const detector = !!p.mineDetector;
        const dist = p.mesh.position.distanceTo(mine.pos);
        const closeStill = dist < 3 && (p.stillT || 0) >= 5;
        mine.mesh.visible = own || detector || closeStill;
        if (mine.mesh.visible && mine.mesh.material) {
          // pulse when newly spotted
        }
      }

      let exploded = false;
      for (const u of this.units) {
        if (!u.alive || !mine.armed) continue;
        if (u.team === mine.team) continue;
        if (u.vehicle.domain === 'air') continue;
        if (u.mesh.position.distanceTo(mine.pos) < 1.6) {
          exploded = true;
          this.detonateMine(mine, u);
          break;
        }
      }
      if (!exploded) remain.push(mine);
    }
    this.mines = remain;
  }

  detonateMine(mine, victim) {
    mine.armed = false;
    if (mine.mesh) this.scene.remove(mine.mesh);
    const boomPos = mine.pos.clone().add(new THREE.Vector3(0, 0.8, 0));
    this.spawnExplosion(boomPos);
    SFX.kill();
    for (const u of this.units) {
      if (!u.alive) continue;
      const dist = u.mesh.position.distanceTo(mine.pos);
      if (dist > 7) continue;
      const falloff = 1 - dist / 7;
      const dmg = 70 * falloff;
      const result = u.takeDamage(dmg, mine.owner, 0.85);
      if (result.lastStand && u.isPlayer) this.ui.toast('Reactive shield saved you!', 1800);
      if (result.killed) {
        if (mine.owner) {
          mine.owner.kills += 1;
          this.frags[mine.owner.team] = (this.frags[mine.owner.team] || 0) + 1;
          this.waveKills += mine.owner.isPlayer ? 1 : 0;
          mine.owner.money = Math.min(MAX_MONEY, mine.owner.money + KILL_REWARD);
        }
        this.beginDeathFall(u);
        this.ui.killFeed(mine.owner || u, u, 'LANDMINE');
        this.checkElimination();
        this.checkModeObjectives();
      }
    }
    if (this.player) this.ui.toast('Landmine detonated', 900);
  }

  updatePlayer(dt) {
    const p = this.player;
    if (!p || !p.alive) return;

    if (this.buyOpen || this.input.cmdMode) return;

    const { dx, dy } = this.input.consumeMouseDelta();
    const sens = 0.0024;
    p.yaw -= dx * sens;
    p.pitch -= dy * sens;

    const shift = this.input.pressedAny('ShiftLeft', 'ShiftRight');
    const isAir = p.vehicle.domain === 'air';

    // Gun aim: Shift + arrow ↑/↓ only (not W/S)
    if (shift) {
      const aimSpeed = 1.55;
      if (this.input.pressed('ArrowUp')) p.pitch += aimSpeed * dt;
      if (this.input.pressed('ArrowDown')) p.pitch -= aimSpeed * dt;
    }

    // Jet altitude: Shift + W/S
    if (shift && isAir) {
      const climb = 14;
      if (!p.flightAlt) p.flightAlt = 8;
      if (this.input.pressed('KeyW')) p.flightAlt += climb * dt;
      if (this.input.pressed('KeyS')) p.flightAlt -= climb * dt;
      p.flightAlt = Math.max(3.5, Math.min(28, p.flightAlt));
    }

    p.pitch = Math.max(-0.5, Math.min(0.85, p.pitch));
    this.camYaw = p.yaw;
    this.camPitch = 0.4 + p.pitch * 0.35;
    p.mesh.rotation.y = p.yaw;

    const speedMul = (p.sinkT > 0) ? 0.38 : 1;
    const speed = p.vehicle.speed * (p.accMods?.speedMult || 1) * speedMul;
    const forward = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    // Right-handed strafe relative to facing (A = left, D = right on screen)
    const right = new THREE.Vector3(-Math.cos(p.yaw), 0, Math.sin(p.yaw));
    const move = new THREE.Vector3();

    // W/S: move unless Shift+jet (altitude). Arrows ↑↓: move unless Shift (aim).
    const useW = this.input.pressed('KeyW');
    const useS = this.input.pressed('KeyS');
    const useUp = this.input.pressed('ArrowUp');
    const useDown = this.input.pressed('ArrowDown');
    if ((!shift || !isAir) && useW) move.add(forward);
    if ((!shift || !isAir) && useS) move.sub(forward);
    if (!shift && useUp) move.add(forward);
    if (!shift && useDown) move.sub(forward);
    if (this.input.pressedAny('KeyA', 'ArrowLeft')) move.add(right);
    if (this.input.pressedAny('KeyD', 'ArrowRight')) move.sub(right);

    if (move.lengthSq() > 0) {
      p.stillT = 0;
      move.normalize().multiplyScalar(speed * dt);
      this.moveUnit(p, p.mesh.position.clone().add(move));
    } else {
      p.stillT = (p.stillT || 0) + dt;
    }

    // Jump (Space) — costs ammo (Jump Boosters reduce cost); blocked while sinking
    if (this.input.consumePress('Space')) {
      if ((p.sinkT || 0) > 0) this.ui.toast('Cannot jump while sinking', 900);
      else {
        const res = p.tryJump();
        if (res.ok) this.ui.toast(`Jump −${res.cost || 5} ammo`);
        else if (res.reason) this.ui.toast(res.reason, 900);
      }
    }
    p.updateJump(dt);
    if (p.grounded && !(p.sinkT > 0)) p._adjustHeight();
    this.updateWaterHazard(p, dt);

    p.secondaryCooldown = Math.max(0, (p.secondaryCooldown || 0) - dt);

    // F = guns · B = jet bombs (live) · T = ship torpedoes · X = landmine
    if (this.input.pressed('KeyF')) this.tryFire(p);
    if (this.input.consumePress('KeyB') && this.phase !== PHASE.BUY && !this.buyOpen) {
      if (p.vehicle.domain === 'air') this.tryDropBomb(p);
    }
    if (this.input.consumePress('KeyT')) this.tryFireTorpedo(p);
    if (this.input.consumePress('KeyX')) this.tryPlantMine(p);
    if (this.input.pressed('KeyR')) this.startReload(p);

    // plant / defuse
    if (this.input.pressed('KeyE') && this.mode?.plant) {
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

    // utilities — EMP moved to V (F is shoot)
    if (this.input.consumePress('KeyG') && p.hasSmoke > 0) {
      p.hasSmoke -= 1;
      this.deploySmoke(p);
    }
    if (this.input.consumePress('KeyV') && p.hasEmp > 0) {
      p.hasEmp -= 1;
      this.deployEmp(p);
    }
  }

  /** Slash commands — type / then the command, Enter. Works in menu or match. */
  handleCommand(line) {
    const raw = String(line || '').trim();
    if (!raw) return;
    const parts = raw.split(/\s+/);
    const cmd = parts[0].toLowerCase().replace(/_/g, '-');

    if (
      cmd === '/give-credits' ||
      cmd === '/givecredits' ||
      cmd === '/give-tokens' ||
      cmd === '/givetokens' ||
      cmd === '/tokens' ||
      cmd === '/credits' ||
      cmd === '/give-money'
    ) {
      const amount = Math.max(1, parseInt(parts[1], 10) || 10000);
      this.inventory?.addWallet(amount);
      if (this.player) {
        this.player.money = Math.min(MAX_MONEY, this.player.money + amount);
      }
      this.ui.refreshMeta?.();
      this.ui.toast(`+${amount} tokens (bank + match)`);
      SFX.buy();
      return;
    }

    if (cmd === '/give-xp' || cmd === '/givexp' || cmd === '/xp') {
      const amount = Math.max(1, parseInt(parts[1], 10) || 5000);
      const res = this.inventory?.addXp(amount);
      this.ui.refreshMeta?.();
      this.ui.toast(`+${amount} XP · Level ${res?.profile?.level || '?'}`);
      SFX.buy();
      return;
    }

    this.ui.toast(`Unknown command: ${cmd} — try /give-tokens or /give-xp`);
  }

  deploySmoke(unit) {
    const ahead = unit.mesh.position.clone().add(
      new THREE.Vector3(Math.sin(unit.yaw), 0, Math.cos(unit.yaw)).multiplyScalar(10)
    );
    ahead.y = 2.5;
    const cloud = spawnSmokeCloud(this.scene, ahead);
    this.effects.push(cloud);
    this.ui.toast('Smoke barrage deployed');
  }

  deployEmp(unit) {
    const origin = unit.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
    this.effects.push(spawnEmpBurst(this.scene, origin));
    for (const u of this.units) {
      if (u.team === unit.team || !u.alive) continue;
      if (u.mesh.position.distanceTo(unit.mesh.position) < 28) {
        u.flashT = 2.2;
      }
    }
    this.ui.toast('EMP flash out');
    SFX.ui();
  }

  /** Larger hit volumes so tanks/ships/jets are reliably damageable. */
  hitRadiusFor(unit, projectile = null) {
    if (projectile?.radius) return projectile.radius;
    const d = unit.vehicle?.domain;
    if (d === 'sea') return 4.4;
    if (d === 'air') return 3.4;
    return 3.6;
  }

  unitHitByProjectile(unit, pos, radius) {
    const up = unit.mesh.position;
    const dx = up.x - pos.x;
    const dy = up.y - pos.y;
    const dz = up.z - pos.z;
    const horiz = Math.hypot(dx, dz);
    // Capsule-ish: generous horizontal radius, taller vertical window for tall hulls / jets
    return horiz <= radius && Math.abs(dy) <= radius * 1.35;
  }

  spawnExplosion(pos) {
    const boom = spawnExplosion(this.scene, pos.clone().add(new THREE.Vector3(0, 1.1, 0)), 1.15);
    this.effects.push(boom);
  }

  /** Initial blast, then fiery tumbling wreck until ground impact. */
  beginDeathFall(u) {
    if (!u?.mesh || u.dying) return;
    u.dying = true;
    u.deathT = 0;
    u.deathSpin = (Math.random() - 0.5) * 10;
    const isAir = u.vehicle.domain === 'air';
    u.vy = isAir ? 1.5 + Math.random() * 2.5 : 5 + Math.random() * 5;
    const fwd = new THREE.Vector3(Math.sin(u.yaw || 0), 0, Math.cos(u.yaw || 0));
    u.vel.copy(fwd).multiplyScalar(isAir ? 8 + Math.random() * 6 : 2 + Math.random() * 3);
    u.vel.x += (Math.random() - 0.5) * 3;
    u.vel.z += (Math.random() - 0.5) * 3;
    this.spawnExplosion(u.mesh.position.clone());
    u.clearDeathFire();
    u.deathFire = attachDeathFire(u.mesh);
    u.mesh.visible = true;
  }

  updateDeathFalls(dt) {
    const t = performance.now() * 0.001;
    for (const u of this.units) {
      if (!u.dying || !u.mesh) continue;
      u.deathT += dt;
      const isAir = u.vehicle.domain === 'air';
      u.vy -= (isAir ? 14 : 22) * dt;
      u.mesh.position.x += u.vel.x * dt;
      u.mesh.position.z += u.vel.z * dt;
      u.mesh.position.y += u.vy * dt;
      u.mesh.rotation.x += u.deathSpin * dt;
      u.mesh.rotation.z += u.deathSpin * 0.65 * dt;
      u.mesh.rotation.y += dt * (1.2 + Math.abs(u.deathSpin) * 0.15);
      if (u.deathFire) updateDeathFire(u.deathFire, dt, t);

      const floorY = this.map.groundHeight(u.mesh.position.x, u.mesh.position.z) + 0.25;
      if (u.mesh.position.y <= floorY || u.deathT > 3.8) {
        u.mesh.position.y = Math.max(u.mesh.position.y, floorY);
        this.spawnExplosion(u.mesh.position.clone());
        u.clearDeathFire();
        u.dying = false;
        u.mesh.visible = false;
        u.vy = 0;
        u.vel.set(0, 0, 0);
      }
    }
  }

  updateProjectiles(dt) {
    const remain = [];
    for (const p of this.projectiles) {
      p.life -= dt;
      if (p.kind === 'bomb') {
        p.vy = (p.vy ?? -2) - 38 * dt;
        p.pos.x += p.dir.x * p.speed * 0.25 * dt;
        p.pos.z += p.dir.z * p.speed * 0.25 * dt;
        p.pos.y += p.vy * dt;
        if (p.mesh) {
          p.mesh.position.copy(p.pos);
          p.mesh.rotation.x += dt * 4;
        }
      } else {
        p.pos.addScaledVector(p.dir, p.speed * dt);
        if (p.kind === 'torpedo') p.pos.y = 0.35;
        if (p.mesh) {
          p.mesh.position.copy(p.pos);
          orientProjectile(p.mesh, p.dir);
          if (p.mesh.userData.trail) {
            p.mesh.userData.trail.material.opacity = 0.35 + Math.random() * 0.35;
          }
        }
      }

      let hit = p.life <= 0;
      if (p.kind === 'bomb') {
        const ground = this.map.groundHeight(p.pos.x, p.pos.z);
        if (p.pos.y <= ground + 0.4) {
          hit = true;
          this.detonateOrdnance(p);
        }
      }
      if (!hit) {
        for (const u of this.units) {
          if (!u.alive || u === p.owner) continue;
          if (this.mode?.teams && u.team === p.owner.team) continue;
          const radius = this.hitRadiusFor(u, p);
          if (this.unitHitByProjectile(u, p.pos, radius)) {
            if (p.kind === 'bomb' || p.kind === 'torpedo') {
              this.detonateOrdnance(p);
              hit = true;
              break;
            }
            const result = u.takeDamage(p.damage, p.owner, p.pen);
            if (result.lastStand && u.isPlayer) this.ui.toast('Reactive shield saved you!', 1800);
            if (p.owner.isPlayer && result.dmg > 0) SFX.hit();
            this.effects.push(spawnImpact(this.scene, p.pos.clone(), p.heavy));
            if (result.killed) {
              p.owner.kills += 1;
              this.frags[p.owner.team] = (this.frags[p.owner.team] || 0) + 1;
              this.waveKills += p.owner.isPlayer ? 1 : 0;
              p.owner.money = Math.min(MAX_MONEY, p.owner.money + KILL_REWARD);
              SFX.kill();
              this.beginDeathFall(u);
              this.ui.killFeed(p.owner, u, p.owner.vehicle.name);
              this.ui.toast(p.owner.isPlayer ? `Destroyed ${u.name}` : `${p.owner.name} wrecked ${u.name}`);
              this.checkElimination();
              this.checkModeObjectives();
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
            this.effects.push(spawnImpact(this.scene, p.pos.clone(), p.heavy));
            hit = true;
            break;
          }
        }
      }
      if (hit) {
        if (p.mesh) this.scene.remove(p.mesh);
      } else {
        remain.push(p);
      }
    }
    this.projectiles = remain;
  }

  checkElimination() {
    if (this.mode?.freeRoam) {
      this.queueRespawnDead(2.8);
      return;
    }
    if (this.mode?.fragLimit) {
      this.checkModeObjectives();
      this.queueRespawnDead(2.5);
      return;
    }
    if (this.mode?.bots === 'waves') {
      this.checkModeObjectives();
      return;
    }
    const raidersAlive = this.units.some((u) => u.alive && u.team === TEAMS.RAIDERS);
    const sentAlive = this.units.some((u) => u.alive && u.team === TEAMS.SENTINELS);
    if (!sentAlive) this.endRound(TEAMS.RAIDERS, 'Sentinels eliminated');
    else if (!raidersAlive && !this.bomb.planted) this.endRound(TEAMS.SENTINELS, 'Raiders eliminated');
  }

  queueRespawnDead(delay = 2.5) {
    for (const u of this.units) {
      if (u.alive || u._respawnAt) continue;
      if (u.isPlayer && this.mode?.freeRoam) {
        // Vigilante: soft respawn near spawn with full hull
        u._respawnAt = performance.now() + delay * 1000;
        continue;
      }
      if (!u.isPlayer) u._respawnAt = performance.now() + delay * 1000;
    }
  }

  processRespawns() {
    const now = performance.now();
    const spawnsR = getSpawns('raiders');
    const spawnsS = getSpawns('sentinels');
    for (const u of this.units) {
      if (u.alive || u.dying || !u._respawnAt || now < u._respawnAt) continue;
      u._respawnAt = 0;
      const spawn = u.team === TEAMS.RAIDERS
        ? spawnsR[Math.floor(Math.random() * spawnsR.length)]
        : spawnsS[Math.floor(Math.random() * spawnsS.length)];
      u.resetForRound(spawn);
      this.placeDomainVehicle(u);
      u.respawnProtected = 1.2;
      if (u.isPlayer) this.ui.toast('Back in the fight');
    }
  }

  updateCamera() {
    const p = this.player;
    if (!p) return;
    const target = (p.alive || p.dying) ? p.mesh.position : new THREE.Vector3(0, 0, 0);
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
    if (this.phase !== PHASE.END && !this.mode?.freeRoam) {
      this.timer -= dt;
      if (this.phase === PHASE.BUY && this.timer <= 0) {
        this.phase = PHASE.LIVE;
        this.phaseLabel = 'LIVE';
        this.timer = ROUND_TIME;
        this.closeBuyMenu();
        this.ui.showBanner('FIGHT', `Round ${this.roundNumber}`);
        this.ui.toast('Weapons free');
      } else if (this.phase === PHASE.LIVE && this.timer <= 0) {
        if (this.bomb.planted) {
          // bomb phase overrides
        } else if (this.mode?.fragLimit) {
          const rf = this.frags.raiders || 0;
          const sf = this.frags.sentinels || 0;
          if (rf === sf) this.endRound(TEAMS.SENTINELS, 'Time — draw goes to defense');
          else this.endRound(rf > sf ? TEAMS.RAIDERS : TEAMS.SENTINELS, 'Time expired');
        } else if (this.mode?.bots === 'waves') {
          this.endRound(TEAMS.SENTINELS, 'Siege overrun — time expired');
        } else if (this.mode?.plant !== false) {
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

    // cooldowns + spawn protection decay (must tick or respawned units stay immortal)
    for (const u of this.units) {
      u.respawnProtected = Math.max(0, (u.respawnProtected || 0) - dt);
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
    this.updateMines(dt);
    this.updateProjectiles(dt);
    this.updateDeathFalls(dt);
    this.processRespawns();
    this.effects = updateVfxList(this.effects, dt, this.scene);

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
    if (e.code === 'Escape' && this.mode?.freeRoam && !this.buyOpen) {
      this.extractVigilante();
      return;
    }
    if (e.code === 'KeyB') {
      if (this.phase === PHASE.BUY) {
        if (this.buyOpen) this.closeBuyMenu();
        else this.openBuyMenu();
      } else if (this.mode?.freeRoam) {
        // Air: B drops bombs (handled in updatePlayer). Ground/sea: B opens arsenal.
        if (this.player?.vehicle?.domain !== 'air') {
          if (this.buyOpen) this.closeBuyMenu();
          else this.openBuyMenu();
        }
      }
    }
    if (e.code === 'KeyC' && this.mode?.freeRoam) {
      if (this.buyOpen) this.closeBuyMenu();
      else this.openBuyMenu();
    }
    if (e.code === 'Digit1') {
      if (this.player?.loadout[0] && (!this.inventory || this.inventory.ownsVehicle(this.player.loadout[0]))) {
        const res = this.player.switchSlot(0);
        this.placeDomainVehicle(this.player);
        if (res?.niceTry) this.ui.showNiceTry?.();
      }
    }
    if (e.code === 'Digit2') {
      if (this.player?.loadout[1] && (!this.inventory || this.inventory.ownsVehicle(this.player.loadout[1]))) {
        const res = this.player.switchSlot(1);
        this.placeDomainVehicle(this.player);
        if (res?.niceTry) this.ui.showNiceTry?.();
      }
    }
    if (e.code === 'Digit3') {
      if (this.player?.loadout[2] && (!this.inventory || this.inventory.ownsVehicle(this.player.loadout[2]))) {
        const res = this.player.switchSlot(2);
        this.placeDomainVehicle(this.player);
        if (res?.niceTry) this.ui.showNiceTry?.();
      }
    }
    if (e.code === 'Escape' && this.buyOpen) this.closeBuyMenu();
  }
}
