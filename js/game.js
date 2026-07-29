import * as THREE from 'three';
import {
  PHASE, BUY_TIME, BUY_TIME_MAX, ROUND_TIME, BOMB_TIME, DEFUSE_TIME, PLANT_TIME,
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
  spawnSplash, spawnTransformBurst,
} from './vfx.js';
import { MODES } from './progression.js';
import { resolveQuality } from './graphics.js';
import { toggleTriviaSkipped } from './trivia.js';
import { isDevOperator } from './dev.js';
import {
  isLucky,
  isSemiLucky,
  setLucky,
  toggleLucky,
  activateSemiLucky,
  clearSemiLucky,
  semiLuckyRemainingLabel,
  luckTier,
  pickBestByRarity,
  pickSemiLuckyByRarity,
} from './lucky.js';

export class Game {
  constructor({ scene, camera, input, ui, inventory, lighting = null, quality = null, onQualityChange = null, net = null }) {
    this.scene = scene;
    this.camera = camera;
    this.input = input;
    this.ui = ui;
    this.inventory = inventory;
    this.lighting = lighting;
    this.quality = quality || resolveQuality();
    this.onQualityChange = onQualityChange;
    this.net = net;
    this.netEnabled = false;
    this.isNetHost = false;
    this.netHumans = [];
    this.buyVotes = {};
    this._netAcc = 0;
    this._seenEvents = new Set();
    this._semiLuckyWasOn = isSemiLucky();
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
    this.buyVotes = {};
    this._seenEvents = new Set();
    this._netAcc = 0;

    const netOpts = opts.net || null;
    this.netEnabled = !!(netOpts?.enabled && this.net);
    this.isNetHost = !!(netOpts?.isHost);
    this.netHumans = Array.isArray(netOpts?.humans) ? netOpts.humans : [];
    this._myNetId = netOpts?.clientId || this.net?.clientId || null;

    for (const u of this.units) this.scene.remove(u.mesh);
    this.units = [];

    const spawnsR = getSpawns('raiders');
    const spawnsS = getSpawns('sentinels');
    const groundY = (x, z) => this.map.groundHeight(x, z);

    const fleet = (this.inventory?.matchLoadout?.() || [])
      .filter((id) => id && (!this.inventory || this.inventory.ownsVehicle(id)));
    const primary = fleet[0] || 'scout_tracker';
    const playerName = this.mode.freeRoam
      ? 'Vigilante'
      : (this.inventory?.profile?.callsign || 'You');
    this.player = new Unit({
      id: 'player',
      name: playerName,
      team,
      isPlayer: true,
      spawn: team === TEAMS.RAIDERS ? spawnsR[0] : spawnsS[0],
      vehicleId: primary,
      getSkin: (vid) => this.inventory?.getEquipped(vid) || null,
      getGroundY: groundY,
    });
    this.player.netId = this._myNetId;
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
      const addBot = (id, name, teamKey, spawn, extra = {}) => {
        const u = new Unit({
          id,
          name,
          team: teamKey,
          spawn,
          vehicleId: 'scout_tracker',
          getGroundY: groundY,
        });
        u.money = START_MONEY;
        if (extra.netId) {
          u.netId = extra.netId;
          u.isRemote = true;
        }
        this.scene.add(u.mesh);
        this.units.push(u);
      };

      if (roster?.raiders && roster?.sentinels) {
        let rSpawn = team === TEAMS.RAIDERS ? 1 : 0;
        let sSpawn = team === TEAMS.SENTINELS ? 1 : 0;
        roster.raiders.forEach((slot, i) => {
          // Skip local seat only. Host roster marks the host as kind:'you' — other
          // clients must still spawn that seat as a remote human via clientId.
          if (this._myNetId && slot.clientId && slot.clientId === this._myNetId) return;
          if (slot.kind === 'you' && (!this._myNetId || !slot.clientId)) return;
          const spawn = spawnsR[rSpawn % spawnsR.length];
          rSpawn += 1;
          const isHuman = !!(slot.clientId && (slot.kind === 'human' || slot.kind === 'you'));
          addBot(
            isHuman ? `h_${String(slot.clientId).slice(0, 8)}` : `r${i}`,
            slot.name || BOT_NAMES.raiders[i % BOT_NAMES.raiders.length],
            TEAMS.RAIDERS,
            spawn,
            isHuman ? { netId: slot.clientId } : {}
          );
        });
        roster.sentinels.forEach((slot, i) => {
          if (this._myNetId && slot.clientId && slot.clientId === this._myNetId) return;
          if (slot.kind === 'you' && (!this._myNetId || !slot.clientId)) return;
          const spawn = spawnsS[sSpawn % spawnsS.length];
          sSpawn += 1;
          const isHuman = !!(slot.clientId && (slot.kind === 'human' || slot.kind === 'you'));
          addBot(
            isHuman ? `h_${String(slot.clientId).slice(0, 8)}` : `s${i}`,
            slot.name || BOT_NAMES.sentinels[i % BOT_NAMES.sentinels.length],
            TEAMS.SENTINELS,
            spawn,
            isHuman ? { netId: slot.clientId } : {}
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
    if (this.isDev()) setLucky(true);
    if (isLucky()) {
      this.inventory?.applyLuckyBlessing?.();
      this.applyLuckyToPlayer();
    } else if (isSemiLucky()) {
      this.applySemiLuckyToPlayer();
    }
    if (this.isDev()) {
      this.ui.toast?.('DEV ONLINE — full admin · Enter chat · /dev for commands', 3200);
    }
    this._wireNetHandlers();
  }

  isDev() {
    return isDevOperator(this.inventory?.profile?.callsign || this.player?.name);
  }

  _wireNetHandlers() {
    if (!this.netEnabled || !this.net || this._netWired) return;
    this._netWired = true;
    this._unsubNet = [
      this.net.on('unit', (data) => this._onNetUnit(data)),
      this.net.on('matchMeta', (data) => this._onNetMeta(data)),
      this.net.on('event', (data) => this._onNetEvent(data)),
      this.net.on('chat', (data) => {
        if (!data || data.clientId === this._myNetId) return;
        this.ui.pushChat?.(data);
      }),
    ];
  }

  _tearDownNet() {
    if (Array.isArray(this._unsubNet)) {
      for (const off of this._unsubNet) off?.();
    }
    this._unsubNet = [];
    this._netWired = false;
    this.netEnabled = false;
    this.netHumans = [];
    this.buyVotes = {};
    try {
      this.net?.leaveLobby?.();
      this.net?.setStatus?.('menu', {});
    } catch {
      /* ignore */
    }
  }

  _serializeUnit(u) {
    return {
      id: u.id,
      netId: u.netId || null,
      name: u.name,
      team: u.team,
      alive: u.alive,
      hp: u.hp,
      armor: u.armor,
      money: u.money,
      kills: u.kills,
      deaths: u.deaths,
      yaw: u.yaw,
      pitch: u.pitch,
      vehicleId: u.vehicle?.id || u.loadout?.[0],
      domain: u.vehicle?.domain || null,
      loadout: Array.isArray(u.loadout) ? [...u.loadout] : null,
      x: u.mesh.position.x,
      y: u.mesh.position.y,
      z: u.mesh.position.z,
      flightAlt: u.flightAlt || 0,
      transforming: !!u.transformLock,
    };
  }

  _applyUnitState(u, s, lerp = 0.35) {
    if (!u || !s) return;
    if (typeof s.yaw === 'number') u.yaw = s.yaw;
    if (typeof s.pitch === 'number') u.pitch = s.pitch;
    if (typeof s.hp === 'number') u.hp = s.hp;
    if (typeof s.armor === 'number') u.armor = s.armor;
    if (typeof s.money === 'number') u.money = s.money;
    if (typeof s.kills === 'number') u.kills = s.kills;
    if (typeof s.deaths === 'number') u.deaths = s.deaths;
    if (typeof s.alive === 'boolean') u.alive = s.alive;
    if (typeof s.flightAlt === 'number') u.flightAlt = s.flightAlt;

    // Remotes often only have scout_tracker in loadout — force the networked craft
    if (s.vehicleId && u.vehicle?.id !== s.vehicleId && !u.transformLock) {
      if (Array.isArray(s.loadout)) {
        for (let i = 0; i < 3; i++) {
          if (s.loadout[i]) {
            u.loadout[i] = s.loadout[i];
            u._ensureAmmo?.(s.loadout[i]);
          }
        }
      }
      u.forceVehicle?.(s.vehicleId, { animate: !!u.isRemote, remote: !!u.isRemote });
    }

    // Don't fight the transform animation on position
    if (u.transformLock) {
      u.mesh.rotation.y = u.yaw;
      u.mesh.visible = u.alive !== false;
      return;
    }

    if (typeof s.x === 'number') {
      const dx = s.x - u.mesh.position.x;
      const dy = (s.y ?? u.mesh.position.y) - u.mesh.position.y;
      const dz = s.z - u.mesh.position.z;
      if (Math.hypot(dx, dy, dz) > 12) {
        u.mesh.position.set(s.x, s.y ?? u.mesh.position.y, s.z);
      } else {
        u.mesh.position.x += dx * lerp;
        u.mesh.position.y += dy * lerp;
        u.mesh.position.z += dz * lerp;
      }
    }
    u.mesh.rotation.y = u.yaw;
    u.mesh.visible = u.alive !== false;
    if (u.mesh.visible === false && s.alive !== false && typeof s.alive === 'undefined') {
      u.mesh.visible = true;
    }
  }

  _onNetUnit(data) {
    if (!this.running || !data) return;
    if (data.aiBundle && Array.isArray(data.units)) {
      for (const s of data.units) {
        const u = this.units.find((x) => x.id === s.id && !x.isPlayer && !x.isRemote);
        if (u) this._applyUnitState(u, s, 0.45);
      }
      return;
    }
    if (data.clientId && data.clientId === this._myNetId) return;
    let u = this.units.find((x) => x.netId && x.netId === data.clientId);
    if (!u && data.clientId) {
      u = this._spawnRemoteHuman(data);
    }
    if (u) this._applyUnitState(u, data, 0.5);
  }

  /** Create a remote human if their unit packet arrives before/without roster seat. */
  _spawnRemoteHuman(data) {
    if (!data?.clientId || data.clientId === this._myNetId) return null;
    if (this.units.some((x) => x.netId === data.clientId)) {
      return this.units.find((x) => x.netId === data.clientId);
    }
    const known = (this.netHumans || []).find((h) => h.clientId === data.clientId);
    const team = data.team || known?.team || TEAMS.RAIDERS;
    const name = data.name || known?.username || 'Operator';
    const spawns = getSpawns(
      team === TEAMS.SENTINELS ? 'sentinels' : 'raiders',
      this.mapId
    );
    const spawn = spawns[Math.floor(Math.random() * spawns.length)] || spawns[0];
    const groundY = (x, z) => this.map.groundHeight(x, z);
    const vid = data.vehicleId && VEHICLES[data.vehicleId] ? data.vehicleId : 'scout_tracker';
    const u = new Unit({
      id: `h_${String(data.clientId).slice(0, 8)}`,
      name,
      team,
      spawn,
      vehicleId: vid,
      getGroundY: groundY,
    });
    u.money = START_MONEY;
    u.netId = data.clientId;
    u.isRemote = true;
    if (Array.isArray(data.loadout)) {
      for (let i = 0; i < 3; i++) {
        if (data.loadout[i] && VEHICLES[data.loadout[i]]) {
          u.loadout[i] = data.loadout[i];
          u._ensureAmmo(data.loadout[i]);
        }
      }
      const idx = u.loadout.indexOf(vid);
      if (idx >= 0) u.activeSlot = idx;
    }
    u.mesh.visible = true;
    this.scene.add(u.mesh);
    this.units.push(u);
    this.placeDomainVehicle(u);
    if (!known) {
      this.netHumans = this.netHumans || [];
      this.netHumans.push({ clientId: data.clientId, username: name, team });
    }
    this.ui?.toast?.(`${name} linked in`, 1400);
    return u;
  }

  _onNetMeta(data) {
    if (!this.running || !data || this.isNetHost) return;
    if (typeof data.timer === 'number') this.timer = data.timer;
    if (data.phase) {
      this.phase = data.phase;
      this.phaseLabel = data.phaseLabel || data.phase.toUpperCase();
    }
    if (data.score) this.score = { ...data.score };
    if (data.frags) this.frags = { ...data.frags };
    if (data.buyVotes) this.buyVotes = { ...data.buyVotes };
    if (data.bomb) {
      this.bomb.planted = !!data.bomb.planted;
      this.bomb.timer = data.bomb.timer ?? this.bomb.timer;
    }
  }

  _onNetEvent(data) {
    if (!this.running || !data?.type) return;
    const eid = data.eventId || `${data.type}:${data.ts}:${data.from}`;
    if (this._seenEvents.has(eid)) return;
    this._seenEvents.add(eid);
    if (this._seenEvents.size > 200) {
      const first = this._seenEvents.values().next().value;
      this._seenEvents.delete(first);
    }

    if (data.type === 'buyVote') {
      this.buyVotes[data.from] = data.seconds;
      this._resolveBuyVotes(false);
      this.ui.renderBuyVote?.();
      return;
    }

    if (data.type === 'buyExtend' && typeof data.seconds === 'number') {
      if (this.phase === PHASE.BUY) {
        this.timer = Math.max(this.timer, Math.min(BUY_TIME_MAX, data.seconds));
        this.ui.toast?.(`Buy phase set to ${Math.round(this.timer)}s`, 2200);
        this.ui.showBanner?.('BUY EXTENDED', `${Math.round(this.timer)} seconds`);
      }
      return;
    }

    if (data.type === 'devEnd' && data.winner) {
      if (!this.isNetHost) {
        this.endRound?.(data.winner, 'DEV ended round');
      }
      return;
    }

    if (data.type === 'damage' && data.targetNetId === this._myNetId && this.player) {
      const attacker = this.units.find((u) => u.netId === data.from) || this.player;
      this.player.takeDamage(data.amount || 0, attacker, data.pen ?? 1);
    }
  }

  castBuyVote(seconds) {
    const sec = Math.min(BUY_TIME_MAX, Math.max(30, Number(seconds) || 30));
    if (!this.netEnabled || (this.netHumans?.length || 0) < 2) return;
    if (this.phase !== PHASE.BUY) return;
    this.buyVotes[this._myNetId] = sec;
    this.net?.publishEvent?.({
      type: 'buyVote',
      eventId: `vote:${this._myNetId}:${this.roundNumber}:${sec}`,
      seconds: sec,
    });
    this._resolveBuyVotes(true);
  }

  _resolveBuyVotes(broadcast) {
    const humans = this.netHumans || [];
    if (humans.length < 2 || this.phase !== PHASE.BUY) return;
    const tallies = {};
    for (const h of humans) {
      const v = this.buyVotes[h.clientId];
      if (v) tallies[v] = (tallies[v] || 0) + 1;
    }
    const need = Math.max(2, Math.ceil(humans.length / 2));
    let winner = null;
    let best = 0;
    for (const [sec, n] of Object.entries(tallies)) {
      if (n >= need && n >= best) {
        best = n;
        winner = Number(sec);
      }
    }
    if (!winner) return;
    if (this.timer < winner) {
      this.timer = Math.min(BUY_TIME_MAX, winner);
      this.ui.toast?.(`Buy phase extended to ${winner}s`, 2200);
      this.ui.showBanner?.('BUY EXTENDED', `${winner} seconds`);
      if (broadcast && this.isNetHost) {
        this.net?.publishEvent?.({
          type: 'buyExtend',
          eventId: `ext:${this.roundNumber}:${winner}`,
          seconds: winner,
        });
      }
    }
  }

  _publishNet(dt) {
    if (!this.netEnabled || !this.net || !this.player) return;
    this._netAcc += dt;
    if (this._netAcc < 0.08) return;
    this._netAcc = 0;
    this.net.publishUnit(this._serializeUnit(this.player));
    if (this.isNetHost) {
      const ai = this.units
        .filter((u) => !u.isPlayer && !u.isRemote)
        .map((u) => this._serializeUnit(u));
      this.net.publishAiUnits(ai);
      this.net.publishMatchMeta({
        phase: this.phase,
        phaseLabel: this.phaseLabel,
        timer: this.timer,
        score: this.score,
        frags: this.frags,
        buyVotes: this.buyVotes,
        bomb: {
          planted: this.bomb.planted,
          timer: this.bomb.timer,
        },
        roundNumber: this.roundNumber,
      });
    }
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
      this.buyVotes = {};
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
        this._tearDownNet();
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
          if (unit.isPlayer) this.ui.toast('Ship deployed to open water');
        }
      }
      unit.mesh.position.y = 0.2;
      unit.grounded = true;
      unit.vy = 0;
    } else if (d === 'air') {
      if (!unit.flightAlt) unit.flightAlt = 8;
      unit.mesh.position.y = unit.flightAlt;
      unit.grounded = true;
      unit.vy = 0;
    } else {
      unit._adjustHeight?.();
    }
  }

  /** Tick transformer morphs for local + remote units. */
  updateVehicleTransforms(dt) {
    for (const u of this.units) {
      if (!u.transform) continue;
      const helpers = {};
      const kind = u.transform.kind;
      if (kind === 'splash' || kind === 'roll') {
        const sea = this.map?.nearestWater?.(u.transform.startX, u.transform.startZ);
        if (sea) helpers.seaTarget = sea;
      }
      if (kind === 'beach') {
        // Nudge inland from current water spot
        helpers.landTarget = {
          x: u.transform.startX + Math.sin(u.yaw || 0) * 6,
          z: u.transform.startZ + Math.cos(u.yaw || 0) * 6,
        };
      }
      const result = u.updateVehicleTransform(dt, helpers);
      if (!result) continue;

      if (result.justSwapped) {
        this.effects.push(spawnTransformBurst(this.scene, u.mesh.position.clone()));
        SFX.ui();
      }
      if (result.fx === 'splash') {
        const p = u.mesh.position.clone();
        p.y = 0.3;
        this.effects.push(spawnSplash(this.scene, p, 1.15));
        SFX.hit();
      } else if (result.fx === 'impact') {
        this.effects.push(spawnImpact(this.scene, u.mesh.position.clone(), true));
        SFX.hit();
      } else if (result.fx === 'thrust') {
        this.effects.push(spawnSmokeCloud(this.scene, u.mesh.position.clone().add(new THREE.Vector3(0, 0.5, 0))));
        SFX.fire(false);
      }

      if (result.done) {
        this.placeDomainVehicle(u);
        if (u.isPlayer) {
          const name = u.vehicle?.name || 'craft';
          const kindLabel = {
            drop: 'dropped in',
            splash: 'splashed down',
            hover: 'lifted off',
            roll: 'rolled into the drink',
            beach: 'beached',
            morph: 'reformed',
          }[kind] || 'transformed';
          this.ui.toast?.(`${name} — ${kindLabel}`, 1200);
        }
      }
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
    const tier = unit.isPlayer ? luckTier() : null;
    const luckyShot = tier === 'lucky';
    const semiShot = tier === 'semi';
    if (!ammo || ammo.mag <= 0) {
      this.startReload(unit);
      return;
    }
    if (!luckyShot) ammo.mag -= 1;
    else ammo.mag = unit.magSizeFor?.(def.id) || def.magSize;
    unit.fireCooldown = luckyShot
      ? 1 / (def.fireRate * 2.5)
      : semiShot
        ? 1 / (def.fireRate * 1.35)
        : 1 / def.fireRate;
    unit.recoil = luckyShot ? 0 : Math.min(0.2, unit.recoil + def.recoil * (semiShot ? 0.45 : 1));

    const heavy = def.category === 'heavy';
    const origin = unit.mesh.position.clone();
    origin.y += def.domain === 'air' ? 0.6 : 1.45;
    // Offset muzzle forward along facing
    origin.x += Math.sin(unit.yaw) * (def.domain === 'air' ? 2.2 : 3.2);
    origin.z += Math.cos(unit.yaw) * (def.domain === 'air' ? 2.2 : 3.2);

    let dir = null;
    if (luckyShot) {
      let best = null;
      let bestD = Infinity;
      for (const u of this.units) {
        if (!u.alive || u === unit) continue;
        if (this.mode?.teams && u.team === unit.team) continue;
        const d = origin.distanceTo(u.mesh.position);
        if (d < bestD && d < (def.range || 80) * 1.35) {
          bestD = d;
          best = u;
        }
      }
      if (best) {
        const aim = best.mesh.position.clone();
        aim.y += 1.1;
        dir = aim.sub(origin).normalize();
      }
    }
    if (!dir) {
      const spreadMul = unit.accMods?.spreadMult || 1;
      const baseSpread = (def.spread + unit.recoil) * spreadMul;
      const spread = luckyShot ? 0 : semiShot ? baseSpread * 0.35 : baseSpread;
      const yaw = unit.yaw + (Math.random() - 0.5) * spread * 2;
      // Match look aim: positive pitch aims upward (do not invert for the player)
      const pitch = (unit.pitch || 0) + (Math.random() - 0.5) * spread;
      dir = new THREE.Vector3(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        Math.cos(yaw) * Math.cos(pitch)
      ).normalize();
    }

    const mesh = createProjectileMesh(heavy);
    mesh.position.copy(origin);
    orientProjectile(mesh, dir);
    this.scene.add(mesh);

    const muzzle = spawnMuzzleFlash(this.scene, origin, dir, heavy);
    this.effects.push({ isMuzzle: true, ...muzzle });

    const luckDmg = luckyShot ? 8 : semiShot ? 2 : 1;
    const dmgMul = (1 + (unit.matchMods?.damageBonus || 0)) * luckDmg;
    const penBonus = (unit.matchMods?.armorPenBonus || 0) + (luckyShot ? 0.9 : semiShot ? 0.25 : 0);
    const flightLife = Math.min(5, def.range / (heavy ? 75 : 110));
    this.projectiles.push({
      kind: 'gun',
      pos: origin,
      dir,
      speed: luckyShot
        ? (heavy ? 110 : 160)
        : semiShot
          ? (heavy ? 90 : 130)
          : (heavy ? 75 : 110),
      life: flightLife,
      damage: def.damage * dmgMul,
      pen: Math.min(1.2, def.armorPen + penBonus),
      owner: unit,
      heavy,
      mesh,
      radius: luckyShot ? 7.5 : semiShot ? 3.2 : undefined,
      lucky: luckyShot,
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
    if (!(unit.isPlayer && isLucky())) {
      unit.bombs -= 1;
      unit._recentOrdnanceSpend = performance.now();
      unit._stashOrdnance?.();
    }
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
    if (!(unit.isPlayer && isLucky())) {
      unit.torpedoes -= 1;
      unit._recentOrdnanceSpend = performance.now();
      unit._stashOrdnance?.();
    }
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
    if (ammo.mag >= magSize || (ammo.reserve <= 0 && !(unit.isPlayer && (isLucky() || isSemiLucky())))) return;

    if (unit.isPlayer && isLucky()) {
      ammo.reserve = Math.max(ammo.reserve, 999);
      ammo.mag = magSize;
      this.ui.toast?.('Lucky reload', 700);
      return;
    }
    if (unit.isPlayer && isSemiLucky()) {
      ammo.reserve = Math.max(ammo.reserve, magSize * 2);
      // Still takes a short chamber time — not instant like /lucky
      unit.reloadT = Math.max(0.15, (unit.vehicle.reload || 1) * 0.35);
      this.ui.toast?.('Semi-lucky reload', 700);
      return;
    }

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
    // Freeze controls while transformer morph plays
    if (p.transformLock) return;

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

    if (cmd === '/no-questions' || cmd === '/noquestions' || cmd === '/no-trivia') {
      const skipped = toggleTriviaSkipped();
      this.ui.toast(
        skipped
          ? 'Trivia off — type /no-questions again to restore questions'
          : 'Trivia on — deploy, buys, and reloads ask again'
      );
      SFX.ui();
      return;
    }

    if (cmd === '/lucky' || cmd === '/god' || cmd === '/op') {
      const on = toggleLucky();
      if (on) {
        this.inventory?.applyLuckyBlessing?.();
        this.applyLuckyToPlayer?.();
        this.ui.refreshMeta?.();
        this.ui.toast('LUCKY ON — aimbot, immortality, ∞ crates, best drops. /lucky again to cancel');
      } else {
        this.ui.toast('Lucky off — back to mortal rules');
      }
      SFX.buy();
      return;
    }

    if (cmd === '/unlucky' || cmd === '/unop' || cmd === '/mortal') {
      if (this.isDev()) {
        this.ui.toast('DEV cannot go unlucky — admin stays armed. Use /lucky toggle only for display.');
        SFX.ui();
        return;
      }
      setLucky(false);
      clearSemiLucky();
      this._semiLuckyWasOn = false;
      this.ui.refreshMeta?.();
      this.ui.toast('Unlucky — lucky and semi-lucky both cancelled. Back to mortal rules.');
      SFX.ui();
      return;
    }

    if (cmd === '/semi-lucky' || cmd === '/semilucky' || cmd === '/semi') {
      activateSemiLucky();
      this.inventory?.applySemiLuckyBlessing?.();
      this.applySemiLuckyToPlayer?.();
      this.ui.refreshMeta?.();
      this._semiLuckyWasOn = true;
      this.ui.toast(
        `SEMI-LUCKY ON for 10 min (${semiLuckyRemainingLabel()} left) — ×2 dmg, armor, tighter aim, better crates. Weaker than /lucky.`
      );
      SFX.buy();
      return;
    }

    if (cmd === '/dev' || cmd === '/dev-help') {
      if (!this.isDev()) {
        this.ui.toast('DEV only — enlist with callsign DEV');
        return;
      }
      this.ui.toast('DEV: /dev-end /dev-win /dev-score /dev-host /dev-say /lucky /give-tokens — Enter opens chat', 4000);
      return;
    }

    if (cmd === '/dev-end' || cmd === '/dev-round') {
      if (!this.isDev()) {
        this.ui.toast('DEV only');
        return;
      }
      if (!this.running) {
        this.ui.toast('No live match');
        return;
      }
      const winner = parts[1] === 'sentinels' ? TEAMS.SENTINELS : TEAMS.RAIDERS;
      this.endRound?.(winner, 'DEV ended round');
      this.net?.publishEvent?.({ type: 'devEnd', eventId: `devend:${Date.now()}`, winner });
      this.ui.toast(`DEV ended round → ${winner}`);
      return;
    }

    if (cmd === '/dev-win') {
      if (!this.isDev()) {
        this.ui.toast('DEV only');
        return;
      }
      if (this.player) {
        this.score[this.player.team] = Math.max(this.score[this.player.team] || 0, ROUNDS_TO_WIN);
      }
      this.endRound?.(this.player?.team || TEAMS.RAIDERS, 'DEV win');
      this.ui.toast('DEV forced win');
      return;
    }

    if (cmd === '/dev-score') {
      if (!this.isDev()) {
        this.ui.toast('DEV only');
        return;
      }
      const a = parseInt(parts[1], 10);
      const b = parseInt(parts[2], 10);
      if (Number.isFinite(a)) this.score.raiders = a;
      if (Number.isFinite(b)) this.score.sentinels = b;
      this.ui.toast(`DEV score Raiders ${this.score.raiders} · Sentinels ${this.score.sentinels}`);
      return;
    }

    if (cmd === '/dev-host') {
      if (!this.isDev()) {
        this.ui.toast('DEV only');
        return;
      }
      this.net?.forceLobbyHost?.();
      this.isNetHost = true;
      if (this.net) this.net.isMatchHost = true;
      this.ui.toast('DEV claimed host authority');
      return;
    }

    if (cmd === '/dev-say') {
      if (!this.isDev()) {
        this.ui.toast('DEV only');
        return;
      }
      const msg = parts.slice(1).join(' ').trim() || 'DEV broadcast';
      this.ui.pushChat?.({
        username: 'DEV',
        text: msg,
        clientId: this._myNetId,
        admin: true,
      });
      this.net?.publishChat?.(msg, { admin: true, username: 'DEV' });
      return;
    }

    if (cmd === '/help' || cmd === '/?') {
      this.ui.toast(
        this.isDev()
          ? 'DEV cmds: /dev /lucky /semi-lucky /unlucky /give-tokens /give-xp · Enter = chat'
          : 'Commands: /lucky /semi-lucky /unlucky /give-tokens /give-xp /no-questions · Enter = chat'
      );
      return;
    }

    this.ui.toast(
      `Unknown command: ${cmd} — try /help`
    );
  }

  /** Send a chat line (non-command). Returns true if sent. */
  sendChat(text) {
    const msg = String(text || '').trim().slice(0, 180);
    if (!msg) return false;
    if (msg.startsWith('/')) {
      this.handleCommand(msg);
      return true;
    }
    const payload = {
      username: this.inventory?.profile?.callsign || this.net?.username || 'Operator',
      text: msg,
      clientId: this._myNetId || this.net?.clientId,
      admin: this.isDev(),
    };
    this.ui.pushChat?.(payload);
    const ok = this.net?.publishChat?.(msg, {
      username: payload.username,
      admin: payload.admin,
    });
    if (!ok && !this.netEnabled) {
      this.ui.toast?.('Chat needs an online match or lobby', 1600);
    }
    return true;
  }

  applyLuckyToPlayer() {
    const p = this.player;
    if (!p || !isLucky()) return;
    p.money = MAX_MONEY;
    p.hp = 100;
    p.armor = 100;
    p.alive = true;
    p.dying = false;
    // Unlock best fleet into loadout
    const byDomain = { land: null, sea: null, air: null };
    for (const domain of ['land', 'sea', 'air']) {
      const pool = Object.values(VEHICLES).filter((v) => v.domain === domain);
      byDomain[domain] = pickBestByRarity(pool, (v) => v.rarity || 'milspec');
    }
    p.loadout = [
      byDomain.land?.id || p.loadout[0],
      byDomain.sea?.id || p.loadout[1],
      byDomain.air?.id || p.loadout[2],
    ];
    for (const id of p.loadout) {
      if (id) p._ensureAmmo?.(id);
    }
    p.activeSlot = 0;
    p._swapMesh?.();
    p._refillOrdnance?.();
    this.placeDomainVehicle?.(p);
    this.ui.renderBuy?.();
  }

  /** Modest in-match buffs for /semi-lucky (not full god mode). */
  applySemiLuckyToPlayer() {
    const p = this.player;
    if (!p || !isSemiLucky()) return;
    p.money = Math.min(MAX_MONEY, Math.max(p.money, 8000));
    p.hp = Math.max(p.hp, 100);
    p.armor = Math.max(p.armor, 70);
    p.alive = true;
    p.dying = false;
    const byDomain = { land: null, sea: null, air: null };
    for (const domain of ['land', 'sea', 'air']) {
      const pool = Object.values(VEHICLES).filter((v) => v.domain === domain);
      byDomain[domain] = pickSemiLuckyByRarity(pool, (v) => v.rarity || 'milspec');
    }
    p.loadout = [
      byDomain.land?.id || p.loadout[0],
      byDomain.sea?.id || p.loadout[1],
      byDomain.air?.id || p.loadout[2],
    ];
    for (const id of p.loadout) {
      if (id) {
        this.inventory?.unlockVehicle?.(id);
        p._ensureAmmo?.(id);
        const ammo = p.ammo?.[id];
        if (ammo) {
          const mag = p.magSizeFor?.(id) || 30;
          ammo.mag = mag;
          ammo.reserve = Math.max(ammo.reserve || 0, mag * 4);
        }
      }
    }
    p.activeSlot = 0;
    p._swapMesh?.();
    p._refillOrdnance?.();
    if (typeof p.bombs === 'number') p.bombs = Math.max(p.bombs, 4);
    if (typeof p.torpedoes === 'number') p.torpedoes = Math.max(p.torpedoes, 3);
    this.placeDomainVehicle?.(p);
    this.ui.renderBuy?.();
  }

  /** Toast when the 10-minute semi-lucky window ends. */
  tickSemiLuckyExpiry() {
    const on = isSemiLucky();
    if (on) {
      this._semiLuckyWasOn = true;
      return;
    }
    if (this._semiLuckyWasOn) {
      this._semiLuckyWasOn = false;
      clearSemiLucky();
      this.ui.toast?.('Semi-lucky expired — back to normal');
    }
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
            if (u.isRemote && this.netEnabled && u.netId) {
              this.net.publishEvent({
                type: 'damage',
                eventId: `dmg:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
                targetNetId: u.netId,
                amount: p.damage,
                pen: p.pen,
              });
              if (p.owner.isPlayer) SFX.hit();
              this.effects.push(spawnImpact(this.scene, p.pos.clone(), p.heavy));
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

    // phase timer (host or offline owns the clock; clients follow match meta)
    if (this.phase !== PHASE.END && !this.mode?.freeRoam) {
      if (!this.netEnabled || this.isNetHost) {
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
      } else if (this.phase === PHASE.BOMB) {
        this.bomb.timer = this.timer;
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

    this.updateVehicleTransforms(dt);
    this.updatePlayer(dt);
    this.tickSemiLuckyExpiry();
    for (const u of this.units) {
      if (u.isPlayer || u.isRemote) continue;
      if (this.netEnabled && !this.isNetHost) continue;
      updateBot(u, this, dt);
    }
    this.updateMines(dt);
    this.updateProjectiles(dt);
    this.updateDeathFalls(dt);
    this.processRespawns();
    this.effects = updateVfxList(this.effects, dt, this.scene);
    this._publishNet(dt);

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
        if (this.player.transformLock) return;
        const res = this.player.switchSlot(0);
        if (res?.instant) this.placeDomainVehicle(this.player);
        if (res?.niceTry) this.ui.showNiceTry?.();
      }
    }
    if (e.code === 'Digit2') {
      if (this.player?.loadout[1] && (!this.inventory || this.inventory.ownsVehicle(this.player.loadout[1]))) {
        if (this.player.transformLock) return;
        const res = this.player.switchSlot(1);
        if (res?.instant) this.placeDomainVehicle(this.player);
        if (res?.niceTry) this.ui.showNiceTry?.();
      }
    }
    if (e.code === 'Digit3') {
      if (this.player?.loadout[2] && (!this.inventory || this.inventory.ownsVehicle(this.player.loadout[2]))) {
        if (this.player.transformLock) return;
        const res = this.player.switchSlot(2);
        if (res?.instant) this.placeDomainVehicle(this.player);
        if (res?.niceTry) this.ui.showNiceTry?.();
      }
    }
    if (e.code === 'Escape' && this.buyOpen) this.closeBuyMenu();
  }
}
