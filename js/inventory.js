/** Persistent inventory — fleet unlocks, shop skins, keys/cases, rewarded ads */

import { VEHICLES, starterVehicleIds } from './config.js';
import { CASES, KEYS, SKINS, rollVehicleFromCase, defaultSkinId } from './skins.js';
import { awardXp, levelFromXp } from './progression.js';
import { normalizeAdsState, canWatchAd, showRewardedAd, adsRemaining, MAX_ADS_PER_DAY } from './ads.js';

const STORAGE_KEY = 'vehicle_strike_inventory_v2';
const LEGACY_KEY = 'vehicle_strike_inventory_v1';

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
    cases: { ironfront_case: 1 },
    keys: { ironfront_key: 1 },
    skins: {},
    equipped,
    ownedVehicles: blankOwned(),
    equippedFleet: blankEquippedFleet(),
    ads: { date: new Date().toISOString().slice(0, 10), count: 0 },
    stats: { matches: 0, wins: 0, opens: 0 },
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

function migrateLegacy(data) {
  const base = blank();
  const owned = { ...base.ownedVehicles, ...(data.ownedVehicles || {}) };
  // Old saves may only have skins — grant mid-tier fleet so they aren't stuck
  if (!data.ownedVehicles) {
    for (const id of ['apc_crusher', 'patrol_cutter', 'falcon_interceptor']) {
      owned[id] = true;
    }
  }
  for (const id of starterVehicleIds()) owned[id] = true;

  const equippedFleet = { ...base.equippedFleet, ...(data.equippedFleet || {}) };
  for (const domain of ['land', 'sea', 'air']) {
    if (!owned[equippedFleet[domain]]) {
      equippedFleet[domain] = base.equippedFleet[domain];
    }
  }

  const profile = { ...base.profile, ...(data.profile || {}) };
  const stats = { ...base.stats, ...(data.stats || {}) };
  return {
    ...base,
    ...data,
    cases: { ...base.cases, ...(data.cases || {}) },
    keys: { ...base.keys, ...(data.keys || {}) },
    skins: { ...(data.skins || {}) },
    equipped: { ...base.equipped, ...(data.equipped || {}) },
    ownedVehicles: owned,
    equippedFleet,
    ads: normalizeAdsState(data.ads),
    stats,
    profile: awardXp({ ...profile, stats }, 0),
  };
}

export function loadInventory() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const migrated = migrateLegacy(JSON.parse(legacy));
        saveInventory(migrated);
        return migrated;
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
  }

  ownsVehicle(id) {
    return !!this.data.ownedVehicles[id] || !!VEHICLES[id]?.starter;
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
    return [
      this.getEquippedFleet('land')?.id || 'scout_tracker',
      this.getEquippedFleet('sea')?.id || 'coastal_skiff',
      this.getEquippedFleet('air')?.id || 'wasp_drone',
    ];
  }

  buyCase(caseId) {
    const c = CASES[caseId];
    if (!c) return { ok: false, reason: 'Unknown case' };
    if (this.data.wallet < c.price) {
      return { ok: false, reason: 'Not enough bank credits', shortfall: c.price - this.data.wallet, price: c.price, kind: 'case', id: caseId };
    }
    this.data.wallet -= c.price;
    this.data.cases[caseId] = (this.data.cases[caseId] || 0) + 1;
    this.persist();
    return { ok: true };
  }

  buyKey(keyId) {
    const k = KEYS[keyId];
    if (!k) return { ok: false, reason: 'Unknown key' };
    if (this.data.wallet < k.price) {
      return { ok: false, reason: 'Not enough bank credits', shortfall: k.price - this.data.wallet, price: k.price, kind: 'key', id: keyId };
    }
    this.data.wallet -= k.price;
    this.data.keys[keyId] = (this.data.keys[keyId] || 0) + 1;
    this.persist();
    return { ok: true };
  }

  buySkin(skinId) {
    const skin = SKINS[skinId];
    if (!skin || skin.isDefault) return { ok: false, reason: 'Cannot buy' };
    if ((this.data.skins[skinId] || 0) > 0) return { ok: false, reason: 'Already owned' };
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

    const vehicle = rollVehicleFromCase(caseId);
    if (!vehicle) return { ok: false, reason: 'Empty case pool' };

    this.data.cases[caseId] -= 1;
    this.data.keys[c.keyId] -= 1;
    const isNew = this.unlockVehicle(vehicle.id);
    this.data.stats.opens += 1;
    this.persist();
    return { ok: true, vehicle, duplicate: !isNew };
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

  recordMatch(won, deposit, xpGain = 0) {
    this.data.stats.matches += 1;
    if (won) this.data.stats.wins += 1;
    this.addWallet(deposit);
    if (xpGain > 0) this.addXp(xpGain);
    else this.persist();
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
