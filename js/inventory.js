/** Persistent player inventory — crates, keys, skins, wallet (GitHub Pages / localStorage) */

import { CASES, KEYS, SKINS, rollSkinFromCase, defaultSkinId } from './skins.js';
import { awardXp, levelFromXp } from './progression.js';

const STORAGE_KEY = 'vehicle_strike_inventory_v1';

function blank() {
  const equipped = {};
  for (const id of Object.keys(SKINS)) {
    if (SKINS[id].isDefault) equipped[SKINS[id].vehicleId] = id;
  }
  // Starter drip so inventory isn't a wall of Stock paints
  const starterIds = [
    'siege_titan__crimson_wake',
    'raptor_strike__neon_circuit',
    'battleship_kronos__jade_current',
    'mbt_anvil__void_carbon',
    'falcon_interceptor__solar_flare',
    'destroyer_hull__dragon_scale',
  ].filter((id) => SKINS[id]);
  const skins = {};
  for (const id of starterIds) skins[id] = 1;
  // Auto-equip the cool starters where available
  for (const id of starterIds) {
    const s = SKINS[id];
    if (s) equipped[s.vehicleId] = id;
  }
  return {
    wallet: 3500,
    cases: { ironfront_case: 1 },
    keys: { ironfront_key: 1 },
    skins,
    equipped,
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

export function loadInventory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return blank();
    const data = JSON.parse(raw);
    const base = blank();
    const skins = { ...(data.skins || {}) };
    // Legacy saves with zero drops get the starter drip once
    if (!Object.keys(skins).length) {
      for (const [id, n] of Object.entries(base.skins)) skins[id] = n;
    }
    const equipped = { ...base.equipped, ...(data.equipped || {}) };
    if (!Object.keys(data.skins || {}).length) {
      for (const [vid, sid] of Object.entries(base.equipped)) {
        if (base.skins[sid]) equipped[vid] = sid;
      }
    }
    return {
      ...base,
      ...data,
      cases: { ...base.cases, ...(data.cases || {}) },
      keys: { ...base.keys, ...(data.keys || {}) },
      skins,
      equipped,
      stats: { ...base.stats, ...(data.stats || {}) },
      profile: { ...base.profile, ...(data.profile || {}) },
    };
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

  buyCase(caseId) {
    const c = CASES[caseId];
    if (!c || this.data.wallet < c.price) return { ok: false, reason: 'Not enough bank credits' };
    this.data.wallet -= c.price;
    this.data.cases[caseId] = (this.data.cases[caseId] || 0) + 1;
    this.persist();
    return { ok: true };
  }

  buyKey(keyId) {
    const k = KEYS[keyId];
    if (!k || this.data.wallet < k.price) return { ok: false, reason: 'Not enough bank credits' };
    this.data.wallet -= k.price;
    this.data.keys[keyId] = (this.data.keys[keyId] || 0) + 1;
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

    const skin = rollSkinFromCase(caseId);
    if (!skin) return { ok: false, reason: 'Empty case pool' };

    this.data.cases[caseId] -= 1;
    this.data.keys[c.keyId] -= 1;
    this.data.skins[skin.id] = (this.data.skins[skin.id] || 0) + 1;
    this.data.stats.opens += 1;
    this.persist();
    return { ok: true, skin };
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
}
