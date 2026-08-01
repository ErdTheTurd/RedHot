/** Persistent inventory — fleet unlocks, shop skins, keys/cases, rewarded ads */

import { VEHICLES, starterVehicleIds } from './config.js';
import { CASES, KEYS, SKINS, rollVehicleFromCase, rollItemFromCase, defaultSkinId, LEGACY_CASE_MAP, LEGACY_KEY_MAP } from './skins.js';
import { GEAR_ITEMS } from './gearItems.js';
import { awardXp, levelFromXp } from './progression.js';
import { normalizeAdsState, canWatchAd, showRewardedAd, adsRemaining, MAX_ADS_PER_DAY } from './ads.js';
import { isLucky, isSemiLucky, pickBestByRarity, pickSemiLuckyByRarity, rarityRank } from './lucky.js';
import { evaluateAchievements, achievementList, ACHIEVEMENTS } from './achievements.js';

const STORAGE_KEY = 'vehicle_strike_inventory_v3';
const LEGACY_KEYS = ['vehicle_strike_inventory_v2', 'vehicle_strike_inventory_v1'];

function blankOwned() {
  const owned = {};
  for (const id of starterVehicleIds()) owned[id] = true;
  return owned;
}

function blankEquippedFleet() {
  return {
    land: 'scout_tracker',
    sea: 'coastal_skiff',
    air: 'wasp_drone',
  };
}

function blank() {
  const equipped = {};
  for (const v of Object.values(VEHICLES)) {
    equipped[v.id] = defaultSkinId(v.id);
  }
  return {
    wallet: 3500,
    cases: { tank_case: 1, ship_case: 1, jet_case: 1, warheads_case: 1, accessories_case: 1 },
    keys: { tank_key: 1, ship_key: 1, jet_key: 1, warheads_key: 1, accessories_key: 1 },
    skins: {},
    equipped,
    ownedVehicles: blankOwned(),
    equippedFleet: blankEquippedFleet(),
    items: {},
    accessories: {},
    loadoutConsumables: [],
    ads: { date: new Date().toISOString().slice(0, 10), count: 0 },
    stats: {
      matches: 0,
      wins: 0,
      opens: 0,
      kills: 0,
      plants: 0,
      defuses: 0,
      extracts: 0,
      bestKills: 0,
      mpMatches: 0,
      winsStrike: 0,
      winsSkirmish: 0,
      winsSiege: 0,
      mapsPlayed: {},
    },
    achievements: {},
    profile: {
      xp: 0,
      level: 1,
      unlockedMaps: ['ironfront'],
      unlockedModes: ['strike'],
      selectedMap: 'ironfront',
      selectedMode: 'strike',
    },
  };
}

function remapLegacyCrates(bag, map) {
  const out = { ...(bag || {}) };
  for (const [oldId, newId] of Object.entries(map)) {
    const n = out[oldId] || 0;
    if (n > 0) {
      out[newId] = (out[newId] || 0) + n;
      delete out[oldId];
    } else if (oldId in out) {
      delete out[oldId];
    }
  }
  // Drop unknown obsolete ids
  for (const id of Object.keys(out)) {
    if (!(id in CASES) && !(id in KEYS) && !(id in map)) {
      // keep warheads/accessories; strip anything else unknown only if not in CASES/KEYS
    }
  }
  return out;
}

function migrateLegacy(data) {
  const base = blank();
  // Only keep craft the player actually unlocked — no free mid-tier handouts
  const owned = { ...(data.ownedVehicles || {}) };
  for (const id of starterVehicleIds()) owned[id] = true;

  const equippedFleet = { ...base.equippedFleet, ...(data.equippedFleet || {}) };
  for (const domain of ['land', 'sea', 'air']) {
    if (!owned[equippedFleet[domain]]) {
      equippedFleet[domain] = base.equippedFleet[domain];
    }
  }

  const profile = { ...base.profile, ...(data.profile || {}) };
  const stats = {
    ...base.stats,
    ...(data.stats || {}),
    mapsPlayed: { ...(base.stats.mapsPlayed || {}), ...((data.stats && data.stats.mapsPlayed) || {}) },
  };
  const achievements = { ...(data.achievements || {}) };
  const cases = remapLegacyCrates({ ...base.cases, ...(data.cases || {}) }, LEGACY_CASE_MAP);
  const keys = remapLegacyCrates({ ...base.keys, ...(data.keys || {}) }, LEGACY_KEY_MAP);
  // Strip legacy case/key ids that are no longer sold
  for (const id of Object.keys(cases)) {
    if (!CASES[id]) delete cases[id];
  }
  for (const id of Object.keys(keys)) {
    if (!KEYS[id]) delete keys[id];
  }
  return {
    ...base,
    ...data,
    cases,
    keys,
    skins: { ...(data.skins || {}) },
    equipped: { ...base.equipped, ...(data.equipped || {}) },
    ownedVehicles: owned,
    equippedFleet,
    items: { ...(data.items || {}) },
    accessories: { ...(data.accessories || {}) },
    loadoutConsumables: Array.isArray(data.loadoutConsumables)
      ? data.loadoutConsumables.filter((id) => GEAR_ITEMS[id]?.type === 'consumable').slice(0, 4)
      : [],
    ads: normalizeAdsState(data.ads),
    stats,
    achievements,
    profile: awardXp({ ...profile, stats }, 0),
  };
}

export function loadInventory() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      for (const key of LEGACY_KEYS) {
        const legacy = localStorage.getItem(key);
        if (legacy) {
          const migrated = migrateLegacy(JSON.parse(legacy));
          saveInventory(migrated);
          return migrated;
        }
      }
      return blank();
    }
    return migrateLegacy(JSON.parse(raw));
  } catch {
    return blank();
  }
}

export function saveInventory(inv) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(inv));
}

export class InventoryService {
  constructor() {
    this.data = loadInventory();
  }

  persist() {
    saveInventory(this.data);
  }

  get wallet() {
    return this.data.wallet;
  }

  addWallet(n) {
    this.data.wallet = Math.max(0, Math.floor(this.data.wallet + n));
    this.persist();
    return this.checkAchievements();
  }

  /** @returns {{ id: string, def: object }[]} newly unlocked commendations */
  checkAchievements(ctx = {}) {
    const unlocked = evaluateAchievements(this.data, ctx);
    if (unlocked.length) this.persist();
    return unlocked;
  }

  getAchievements() {
    return achievementList().map((def) => ({
      ...def,
      earned: !!this.data.achievements?.[def.id],
      at: this.data.achievements?.[def.id]?.at || null,
    }));
  }

  achievementProgress() {
    const all = achievementList();
    const earned = all.filter((a) => this.data.achievements?.[a.id]).length;
    return { earned, total: all.length };
  }

  ownsVehicle(id) {
    // Strict: must be in the unlocked fleet map (starters are seeded there on new saves)
    return !!this.data.ownedVehicles?.[id];
  }

  unlockVehicle(id) {
    if (!VEHICLES[id]) return false;
    const already = this.ownsVehicle(id);
    this.data.ownedVehicles[id] = true;
    this.persist();
    return !already;
  }

  ownedVehicleList() {
    return Object.values(VEHICLES)
      .filter((v) => this.ownsVehicle(v.id))
      .sort((a, b) => (a.domain + a.category).localeCompare(b.domain + b.category));
  }

  equipFleet(vehicleId) {
    const v = VEHICLES[vehicleId];
    if (!v) return { ok: false, reason: 'Unknown vehicle' };
    if (!this.ownsVehicle(vehicleId)) return { ok: false, reason: 'Not unlocked' };
    this.data.equippedFleet[v.domain] = vehicleId;
    this.persist();
    return { ok: true };
  }

  getEquippedFleet(domain) {
    const id = this.data.equippedFleet?.[domain];
    if (id && this.ownsVehicle(id)) return VEHICLES[id];
    const fallback = starterVehicleIds().map((x) => VEHICLES[x]).find((v) => v.domain === domain);
    return fallback || null;
  }

  matchLoadout() {
    // Always seed starters so a fresh profile can still deploy
    for (const id of starterVehicleIds()) {
      if (!this.data.ownedVehicles[id]) this.data.ownedVehicles[id] = true;
    }
    const pick = (domain, fallback) => {
      const eq = this.data.equippedFleet?.[domain];
      if (eq && this.ownsVehicle(eq)) return eq;
      if (this.ownsVehicle(fallback)) return fallback;
      const any = this.ownedVehicleList().find((v) => v.domain === domain);
      return any?.id || null;
    };
    return [
      pick('land', 'scout_tracker'),
      pick('sea', 'coastal_skiff'),
      pick('air', 'wasp_drone'),
    ];
  }

  buyCase(caseId) {
    const c = CASES[caseId];
    if (!c) return { ok: false, reason: 'Unknown case' };
    if (!isLucky()) {
      if (this.data.wallet < c.price) {
        return { ok: false, reason: 'Not enough bank credits', shortfall: c.price - this.data.wallet, price: c.price, kind: 'case', id: caseId };
      }
      this.data.wallet -= c.price;
    }
    this.data.cases[caseId] = (this.data.cases[caseId] || 0) + (isLucky() ? 99 : 1);
    this.persist();
    return { ok: true };
  }

  buyKey(keyId) {
    const k = KEYS[keyId];
    if (!k) return { ok: false, reason: 'Unknown key' };
    if (!isLucky()) {
      if (this.data.wallet < k.price) {
        return { ok: false, reason: 'Not enough bank credits', shortfall: k.price - this.data.wallet, price: k.price, kind: 'key', id: keyId };
      }
      this.data.wallet -= k.price;
    }
    this.data.keys[keyId] = (this.data.keys[keyId] || 0) + (isLucky() ? 99 : 1);
    this.persist();
    return { ok: true };
  }

  buySkin(skinId) {
    const skin = SKINS[skinId];
    if (!skin || skin.isDefault) return { ok: false, reason: 'Cannot buy' };
    if ((this.data.skins[skinId] || 0) > 0) return { ok: false, reason: 'Already owned' };
    if (!isLucky()) {
      if (this.data.wallet < skin.price) {
        return {
          ok: false,
          reason: 'Not enough bank credits',
          shortfall: skin.price - this.data.wallet,
          price: skin.price,
          kind: 'skin',
          id: skinId,
        };
      }
      this.data.wallet -= skin.price;
    }
    this.data.skins[skinId] = 1;
    this.persist();
    return { ok: true };
  }

  caseCount(id) {
    return this.data.cases[id] || 0;
  }

  keyCount(id) {
    return this.data.keys[id] || 0;
  }

  canOpen(caseId) {
    const c = CASES[caseId];
    if (!c) return false;
    return this.caseCount(caseId) > 0 && this.keyCount(c.keyId) > 0;
  }

  openCase(caseId) {
    const c = CASES[caseId];
    if (!c) return { ok: false, reason: 'Unknown case' };
    if (this.caseCount(caseId) <= 0) return { ok: false, reason: 'No case owned' };
    if (this.keyCount(c.keyId) <= 0) return { ok: false, reason: 'Need a matching key' };

    const consume = !isLucky();

    if (c.kind === 'item') {
      const item = rollItemFromCase(caseId);
      if (!item) return { ok: false, reason: 'Empty case pool' };
      if (consume) {
        this.data.cases[caseId] -= 1;
        this.data.keys[c.keyId] -= 1;
      }
      this.data.stats.opens += 1;
      let duplicate = false;
      if (item.type === 'accessory') {
        duplicate = !!this.data.accessories[item.id];
        this.data.accessories[item.id] = true;
      } else {
        this.data.items[item.id] = (this.data.items[item.id] || 0) + (isLucky() ? 99 : 1);
      }
      const achievements = this.checkAchievements();
      this.persist();
      return { ok: true, item, duplicate, kind: 'item', achievements };
    }

    const vehicle = rollVehicleFromCase(caseId);
    if (!vehicle) return { ok: false, reason: 'Empty case pool' };

    if (consume) {
      this.data.cases[caseId] -= 1;
      this.data.keys[c.keyId] -= 1;
    }
    const isNew = this.unlockVehicle(vehicle.id);
    this.data.stats.opens += 1;
    const achievements = this.checkAchievements();
    this.persist();
    return { ok: true, vehicle, duplicate: !isNew, kind: 'vehicle', achievements };
  }

  /** Dump OP loot when /lucky turns on. */
  applyLuckyBlessing() {
    this.data.wallet = Math.max(this.data.wallet, 999999);
    for (const id of Object.keys(CASES)) {
      this.data.cases[id] = Math.max(this.data.cases[id] || 0, 999);
    }
    for (const id of Object.keys(KEYS)) {
      this.data.keys[id] = Math.max(this.data.keys[id] || 0, 999);
    }
    for (const v of Object.values(VEHICLES)) {
      this.data.ownedVehicles[v.id] = true;
    }
    for (const item of Object.values(GEAR_ITEMS)) {
      if (item.type === 'accessory') this.data.accessories[item.id] = true;
      else this.data.items[item.id] = Math.max(this.data.items[item.id] || 0, 99);
    }
    // Equip top craft per domain
    for (const domain of ['land', 'sea', 'air']) {
      const pool = Object.values(VEHICLES).filter((v) => v.domain === domain);
      const best = pickBestByRarity(pool, (v) => v.rarity || 'milspec');
      if (best) this.data.equippedFleet[domain] = best.id;
    }
    // Best paints per vehicle
    for (const v of Object.values(VEHICLES)) {
      const paints = Object.values(SKINS).filter((s) => s.vehicleId === v.id && !s.isDefault);
      if (!paints.length) continue;
      const best = pickBestByRarity(paints, (s) => s.rarity);
      if (!best) continue;
      this.data.skins[best.id] = Math.max(1, this.data.skins[best.id] || 0);
      const cur = SKINS[this.data.equipped[v.id]];
      if (!cur || cur.isDefault || rarityRank(best.rarity) >= rarityRank(cur.rarity)) {
        this.data.equipped[v.id] = best.id;
      }
    }
    this.persist();
    return true;
  }

  /** Modest stash when /semi-lucky turns on — good, not god-tier. */
  applySemiLuckyBlessing() {
    this.data.wallet = Math.max(this.data.wallet, 25000);
    const caseIds = Object.keys(CASES);
    const keyIds = Object.keys(KEYS);
    for (const id of caseIds.slice(0, Math.min(4, caseIds.length))) {
      this.data.cases[id] = Math.max(this.data.cases[id] || 0, 3);
    }
    for (const id of keyIds.slice(0, Math.min(4, keyIds.length))) {
      this.data.keys[id] = Math.max(this.data.keys[id] || 0, 3);
    }
    // Unlock a solid (not always best) craft per domain
    for (const domain of ['land', 'sea', 'air']) {
      const pool = Object.values(VEHICLES).filter((v) => v.domain === domain);
      const pick = pickSemiLuckyByRarity(pool, (v) => v.rarity || 'milspec');
      if (pick) {
        this.data.ownedVehicles[pick.id] = true;
        this.data.equippedFleet[domain] = pick.id;
      }
    }
    // A few mid-tier warheads / accessories
    const gear = Object.values(GEAR_ITEMS);
    for (let i = 0; i < 4 && gear.length; i += 1) {
      const item = pickSemiLuckyByRarity(gear, (x) => x.rarity);
      if (!item) break;
      if (item.type === 'accessory') this.data.accessories[item.id] = true;
      else this.data.items[item.id] = Math.max(this.data.items[item.id] || 0, 2);
    }
    this.persist();
    return true;
  }

  itemCount(id) {
    return this.data.items[id] || 0;
  }

  ownsAccessory(id) {
    return !!this.data.accessories[id];
  }

  ownedConsumables() {
    return Object.entries(this.data.items || {})
      .filter(([, n]) => n > 0)
      .map(([id, count]) => ({ item: GEAR_ITEMS[id], count }))
      .filter((x) => x.item?.type === 'consumable');
  }

  ownedAccessories() {
    return Object.keys(this.data.accessories || {})
      .map((id) => GEAR_ITEMS[id])
      .filter(Boolean);
  }

  /** Equip up to 4 consumables to auto-apply at match start (consumes 1 each). */
  setLoadoutConsumables(ids) {
    const next = [];
    for (const id of ids || []) {
      if (!GEAR_ITEMS[id] || GEAR_ITEMS[id].type !== 'consumable') continue;
      if ((this.data.items[id] || 0) <= 0) continue;
      if (next.includes(id)) continue;
      next.push(id);
      if (next.length >= 4) break;
    }
    this.data.loadoutConsumables = next;
    this.persist();
    return { ok: true, loadout: next };
  }

  toggleLoadoutConsumable(id) {
    const cur = [...(this.data.loadoutConsumables || [])];
    const i = cur.indexOf(id);
    if (i >= 0) cur.splice(i, 1);
    else if (cur.length < 4 && (this.data.items[id] || 0) > 0) cur.push(id);
    return this.setLoadoutConsumables(cur);
  }

  /**
   * Consume equipped warheads and return a mods object for the match unit.
   */
  consumeMatchGear() {
    const mods = {
      reserve: 0,
      mags: 0,
      bombs: 0,
      torpedoes: 0,
      landmines: 0,
      armorPenBonus: 0,
      damageBonus: 0,
      bombRadius: 0,
      torpedoRadius: 0,
      fullReload: false,
      accessories: { ...this.data.accessories },
    };
    const used = [];
    for (const id of this.data.loadoutConsumables || []) {
      const item = GEAR_ITEMS[id];
      if (!item || (this.data.items[id] || 0) <= 0) continue;
      this.data.items[id] -= 1;
      used.push(id);
      const e = item.effect || {};
      mods.reserve += e.reserve || 0;
      mods.mags += e.mags || 0;
      mods.bombs += e.bombs || 0;
      mods.torpedoes += e.torpedoes || 0;
      mods.landmines += e.landmines || 0;
      mods.armorPenBonus += e.armorPenBonus || 0;
      mods.damageBonus += e.damageBonus || 0;
      mods.bombRadius += e.bombRadius || 0;
      mods.torpedoRadius += e.torpedoRadius || 0;
      if (e.fullReload) mods.fullReload = true;
    }
    // Keep loadout slots that still have stock
    this.data.loadoutConsumables = (this.data.loadoutConsumables || [])
      .filter((id) => (this.data.items[id] || 0) > 0);
    this.persist();
    return { mods, used };
  }

  accessoryMods() {
    const mods = {
      speedMult: 1,
      startArmor: 0,
      reloadMult: 1,
      magBonus: 0,
      bombCap: 0,
      torpedoCap: 0,
      spreadMult: 1,
      jumpAmmoCost: 5,
      mineDetector: false,
      lastStand: false,
    };
    for (const id of Object.keys(this.data.accessories || {})) {
      if (!this.data.accessories[id]) continue;
      const e = GEAR_ITEMS[id]?.effect;
      if (!e) continue;
      if (e.speedMult) mods.speedMult *= e.speedMult;
      if (e.startArmor) mods.startArmor += e.startArmor;
      if (e.reloadMult) mods.reloadMult *= e.reloadMult;
      if (e.magBonus) mods.magBonus += e.magBonus;
      if (e.bombCap) mods.bombCap += e.bombCap;
      if (e.torpedoCap) mods.torpedoCap += e.torpedoCap;
      if (e.spreadMult) mods.spreadMult *= e.spreadMult;
      if (e.jumpAmmoCost != null) mods.jumpAmmoCost = e.jumpAmmoCost;
      if (e.mineDetector) mods.mineDetector = true;
      if (e.lastStand) mods.lastStand = true;
    }
    return mods;
  }

  ownedSkins() {
    return Object.entries(this.data.skins)
      .filter(([, n]) => n > 0)
      .map(([id, count]) => ({ skin: SKINS[id], count }))
      .filter((x) => x.skin)
      .sort((a, b) => {
        const order = ['extraordinary', 'covert', 'classified', 'restricted', 'milspec', 'industrial', 'consumer'];
        return order.indexOf(a.skin.rarity) - order.indexOf(b.skin.rarity);
      });
  }

  equip(skinId) {
    const skin = SKINS[skinId];
    if (!skin) return { ok: false };
    if (!skin.isDefault && !(this.data.skins[skinId] > 0)) return { ok: false, reason: 'Not owned' };
    this.data.equipped[skin.vehicleId] = skinId;
    this.persist();
    return { ok: true };
  }

  getEquipped(vehicleId) {
    const id = this.data.equipped[vehicleId] || defaultSkinId(vehicleId);
    return SKINS[id] || SKINS[defaultSkinId(vehicleId)];
  }

  sellSkin(skinId) {
    const skin = SKINS[skinId];
    if (!skin || skin.isDefault) return { ok: false, reason: 'Cannot sell' };
    if (!(this.data.skins[skinId] > 0)) return { ok: false, reason: 'Not owned' };
    this.data.skins[skinId] -= 1;
    if (this.data.equipped[skin.vehicleId] === skinId) {
      this.data.equipped[skin.vehicleId] = defaultSkinId(skin.vehicleId);
    }
    this.data.wallet += skin.sellPrice;
    this.persist();
    return { ok: true, gained: skin.sellPrice };
  }

  recordMatch(won, deposit, xpGain = 0, extras = {}) {
    const s = this.data.stats;
    s.matches += 1;
    if (won) s.wins += 1;
    const kills = Math.max(0, Math.floor(extras.kills || 0));
    s.kills = (s.kills || 0) + kills;
    s.bestKills = Math.max(s.bestKills || 0, kills);
    if (extras.extracted) s.extracts = (s.extracts || 0) + 1;
    if (extras.multiplayer) s.mpMatches = (s.mpMatches || 0) + 1;
    if (won && extras.modeId === 'strike') s.winsStrike = (s.winsStrike || 0) + 1;
    if (won && extras.modeId === 'skirmish') s.winsSkirmish = (s.winsSkirmish || 0) + 1;
    if (won && extras.modeId === 'siege') s.winsSiege = (s.winsSiege || 0) + 1;
    if (extras.mapId) {
      s.mapsPlayed = { ...(s.mapsPlayed || {}), [extras.mapId]: true };
    }
    this.data.wallet = Math.max(0, Math.floor(this.data.wallet + deposit));
    if (xpGain > 0) this.addXp(xpGain);
    const achievements = this.checkAchievements({ matchKills: kills });
    this.persist();
    return { achievements };
  }

  notePlant() {
    this.data.stats.plants = (this.data.stats.plants || 0) + 1;
    const achievements = this.checkAchievements();
    this.persist();
    return achievements;
  }

  noteDefuse() {
    this.data.stats.defuses = (this.data.stats.defuses || 0) + 1;
    const achievements = this.checkAchievements();
    this.persist();
    return achievements;
  }

  get profile() {
    return this.data.profile;
  }

  addXp(amount) {
    const before = this.data.profile.level || 1;
    this.data.profile = awardXp(
      { ...this.data.profile, stats: this.data.stats },
      amount
    );
    this.data.profile.level = levelFromXp(this.data.profile.xp);
    this.persist();
    return { leveled: this.data.profile.level > before, profile: this.data.profile };
  }

  setOps(mapId, modeId) {
    this.data.profile.selectedMap = mapId;
    this.data.profile.selectedMode = modeId;
    this.persist();
  }

  setCallsign(name) {
    this.data.profile.callsign = String(name || '').slice(0, 16);
    this.persist();
  }

  /** Fresh bank/fleet profile (e.g. after creating a replacement account). */
  resetToBlank(callsign) {
    this.data = blank();
    if (callsign) this.data.profile.callsign = String(callsign).slice(0, 16);
    this.persist();
  }

  // —— Rewarded ads ——
  getAdsState() {
    this.data.ads = normalizeAdsState(this.data.ads);
    return this.data.ads;
  }

  adsLeft() {
    return adsRemaining(this.getAdsState());
  }

  canWatchAd() {
    return canWatchAd(this.getAdsState());
  }

  /**
   * Watch an ad; on success grant enough bank (or callback) to cover shortfall.
   * @param {{ shortfall: number, currency?: 'wallet'|'match', onMatchGrant?: (n:number)=>void }} opts
   */
  async watchAdForFunds(opts) {
    const shortfall = Math.max(1, Math.ceil(opts.shortfall || 0));
    if (!this.canWatchAd()) {
      return { ok: false, reason: `Daily ad limit reached (${MAX_ADS_PER_DAY}/day)` };
    }
    const res = await showRewardedAd();
    if (!res.ok) return res;

    this.data.ads = normalizeAdsState(this.data.ads);
    this.data.ads.count += 1;
    this.persist();

    if (opts.currency === 'match' && typeof opts.onMatchGrant === 'function') {
      opts.onMatchGrant(shortfall);
    } else {
      this.addWallet(shortfall);
    }
    return { ok: true, granted: shortfall, adsLeft: this.adsLeft() };
  }
}
