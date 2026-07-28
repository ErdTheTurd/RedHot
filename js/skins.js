/** Skin catalog, crates, keys — fleet unlocks + warheads/accessories */

import { VEHICLES } from './config.js';
import { warheadsPool, accessoriesPool, rollItemFromPool } from './gearItems.js';

export const RARITY = {
  consumer: { id: 'consumer', label: 'Consumer Grade', color: '#b0c3d9', weight: 79.92 },
  industrial: { id: 'industrial', label: 'Industrial Grade', color: '#5e98d9', weight: 15.98 },
  milspec: { id: 'milspec', label: 'Mil-Spec', color: '#4b69ff', weight: 3.2 },
  restricted: { id: 'restricted', label: 'Restricted', color: '#8847ff', weight: 0.64 },
  classified: { id: 'classified', label: 'Classified', color: '#d32ce6', weight: 0.32 },
  covert: { id: 'covert', label: 'Covert', color: '#eb4b4b', weight: 0.064 },
  extraordinary: { id: 'extraordinary', label: 'Extraordinary', color: '#e4ae39', weight: 0.026 },
};

/**
 * Finishes are shop cosmetics — NOT crate drops.
 * pattern: solid | camo | digital | hex | carbon | tiger | rust | circuit | pearl | scale | stripes | mesh | splatter
 */
const FINISHES = [
  { suffix: 'Desert Storm', color: 0xc2a46b, secondary: 0x8a7048, tertiary: 0xe8d5a8, pattern: 'camo', metalness: 0.25, roughness: 0.72, rarity: 'consumer', price: 120 },
  { suffix: 'Urban Mesh', color: 0x6a727a, secondary: 0x3a4248, tertiary: 0xa8b0b8, pattern: 'mesh', metalness: 0.4, roughness: 0.55, rarity: 'consumer', price: 120 },
  { suffix: 'Forest Canopy', color: 0x4a5c3a, secondary: 0x2a3820, tertiary: 0x7a8c5a, pattern: 'camo', metalness: 0.28, roughness: 0.68, rarity: 'consumer', price: 120 },
  { suffix: 'Night Ops', color: 0x2a3038, secondary: 0x12161c, tertiary: 0x4a5560, pattern: 'digital', metalness: 0.5, roughness: 0.45, rarity: 'industrial', price: 280 },
  { suffix: 'Arctic White', color: 0xd8e2ea, secondary: 0x8aa0b2, tertiary: 0xffffff, pattern: 'splatter', metalness: 0.35, roughness: 0.4, rarity: 'industrial', price: 280 },
  { suffix: 'Copper Patina', color: 0xb87333, secondary: 0x5a8a6a, tertiary: 0xd4a060, pattern: 'rust', metalness: 0.7, roughness: 0.38, rarity: 'industrial', price: 280 },
  { suffix: 'Cobalt Stripe', color: 0x2f6fb5, secondary: 0x0e2a4a, tertiary: 0x6aa8e8, pattern: 'stripes', metalness: 0.55, roughness: 0.4, rarity: 'milspec', price: 650 },
  { suffix: 'Jade Current', color: 0x2f8f6b, secondary: 0x0a3a2a, tertiary: 0x6ad4a8, pattern: 'hex', metalness: 0.5, roughness: 0.38, rarity: 'milspec', price: 650 },
  { suffix: 'Crimson Wake', color: 0xa83232, secondary: 0x4a1010, tertiary: 0xe86060, pattern: 'tiger', metalness: 0.55, roughness: 0.4, rarity: 'milspec', price: 650 },
  { suffix: 'Neon Circuit', color: 0x0a2a28, secondary: 0x1fd6c0, tertiary: 0x88ffe8, pattern: 'circuit', metalness: 0.65, roughness: 0.28, emissive: 0x0a4a44, rarity: 'restricted', price: 1400 },
  { suffix: 'Purple Haze', color: 0x6b3fa0, secondary: 0x2a1040, tertiary: 0xc48cff, pattern: 'splatter', metalness: 0.6, roughness: 0.32, emissive: 0x2a1040, rarity: 'restricted', price: 1400 },
  { suffix: 'Solar Flare', color: 0xff8a1a, secondary: 0x8a2a00, tertiary: 0xffd080, pattern: 'stripes', metalness: 0.55, roughness: 0.3, emissive: 0x4a2200, rarity: 'restricted', price: 1400 },
  { suffix: 'Void Carbon', color: 0x12161c, secondary: 0x2a3038, tertiary: 0x0a0c10, pattern: 'carbon', metalness: 0.85, roughness: 0.18, emissive: 0x102030, rarity: 'classified', price: 3200 },
  { suffix: 'Rose Titanium', color: 0xc45c7a, secondary: 0x6a2840, tertiary: 0xf0a0b8, pattern: 'pearl', metalness: 0.8, roughness: 0.22, emissive: 0x401020, rarity: 'classified', price: 3200 },
  { suffix: 'Ion Storm', color: 0x3d7cff, secondary: 0x102040, tertiary: 0xa0c8ff, pattern: 'circuit', metalness: 0.75, roughness: 0.2, emissive: 0x102040, rarity: 'classified', price: 3200 },
  { suffix: 'Blood Orbit', color: 0x8b0000, secondary: 0x2a0000, tertiary: 0xff4040, pattern: 'hex', metalness: 0.7, roughness: 0.18, emissive: 0x400000, rarity: 'covert', price: 7500 },
  { suffix: 'Ghost Pearl', color: 0xe8f0ff, secondary: 0xa0b8d0, tertiary: 0xffffff, pattern: 'pearl', metalness: 0.9, roughness: 0.12, emissive: 0x304050, rarity: 'covert', price: 7500 },
  { suffix: 'Dragon Scale', color: 0x1a8f3c, secondary: 0x0a3018, tertiary: 0x50d880, pattern: 'scale', metalness: 0.75, roughness: 0.2, emissive: 0x0a3018, rarity: 'covert', price: 7500 },
  { suffix: 'Apex Legend', color: 0xffd700, secondary: 0x8a6000, tertiary: 0xfff0a0, pattern: 'hex', metalness: 0.95, roughness: 0.1, emissive: 0x5a4000, rarity: 'extraordinary', price: 16000 },
  { suffix: 'Black Market', color: 0x1a0a10, secondary: 0xff3b5c, tertiary: 0xff8098, pattern: 'tiger', metalness: 0.9, roughness: 0.12, emissive: 0x400010, rarity: 'extraordinary', price: 16000 },
];

const SELL = {
  consumer: 15,
  industrial: 35,
  milspec: 90,
  restricted: 280,
  classified: 900,
  covert: 2800,
  extraordinary: 8500,
};

function buildSkins() {
  const skins = {};
  for (const v of Object.values(VEHICLES)) {
    const id = `${v.id}__factory`;
    skins[id] = {
      id,
      vehicleId: v.id,
      name: `${v.name} | Stock`,
      shortName: 'Stock',
      rarity: 'consumer',
      color: v.color,
      secondary: (v.color >> 1) & 0x7f7f7f,
      tertiary: Math.min(0xffffff, v.color + 0x202020),
      pattern: 'solid',
      metalness: 0.55,
      roughness: 0.45,
      emissive: 0x000000,
      sellPrice: 5,
      price: 0,
      isDefault: true,
    };
  }

  for (const v of Object.values(VEHICLES)) {
    for (const finish of FINISHES) {
      const slug = finish.suffix.toLowerCase().replace(/\s+/g, '_');
      const id = `${v.id}__${slug}`;
      skins[id] = {
        id,
        vehicleId: v.id,
        name: `${v.name} | ${finish.suffix}`,
        shortName: finish.suffix,
        rarity: finish.rarity,
        color: finish.color,
        secondary: finish.secondary,
        tertiary: finish.tertiary,
        pattern: finish.pattern,
        metalness: finish.metalness,
        roughness: finish.roughness,
        emissive: finish.emissive || 0x000000,
        sellPrice: SELL[finish.rarity],
        price: finish.price,
        isDefault: false,
      };
    }
  }
  return skins;
}

export const SKINS = buildSkins();

export const KEYS = {
  ironfront_key: {
    id: 'ironfront_key',
    name: 'Ironfront Case Key',
    price: 750,
    caseId: 'ironfront_case',
    desc: 'Opens Ironfront Fleet Cases — unlock tanks, ships, and jets.',
    image: './assets/keys/ironfront-key.png',
  },
  coastal_key: {
    id: 'coastal_key',
    name: 'Coastal Ops Key',
    price: 850,
    caseId: 'coastal_case',
    desc: 'Opens Coastal Ops Cases — ships & strike craft focus.',
    image: './assets/keys/coastal-key.png',
  },
  apex_key: {
    id: 'apex_key',
    name: 'Apex Collection Key',
    price: 1200,
    caseId: 'apex_case',
    desc: 'Opens Apex Cases — higher odds at rare fleet craft.',
    image: './assets/keys/apex-key.png',
  },
  warheads_key: {
    id: 'warheads_key',
    name: 'Warheads Case Key',
    price: 900,
    caseId: 'warheads_case',
    desc: 'Opens Warheads Cases — bullets, mags, bombs, torpedoes, mines.',
    image: './assets/keys/warheads-key.png',
  },
  accessories_key: {
    id: 'accessories_key',
    name: 'Accessories Case Key',
    price: 1100,
    caseId: 'accessories_case',
    desc: 'Opens Accessories Cases — detectors, engines, scopes, and more.',
    image: './assets/keys/accessories-key.png',
  },
};

function vehiclesForCase(rarities, filterFn = null) {
  return Object.values(VEHICLES).filter((v) => {
    if (v.starter && !v.crateOnly) return false; // starters aren't crate drops
    const r = v.rarity || 'milspec';
    if (!rarities.includes(r)) return false;
    if (filterFn && !filterFn(v)) return false;
    return true;
  });
}

export const CASES = {
  ironfront_case: {
    id: 'ironfront_case',
    name: 'Ironfront Fleet Case',
    price: 250,
    keyId: 'ironfront_key',
    color: '#c45c28',
    image: './assets/cases/ironfront-case.png',
    desc: 'Unlocks unique-looking tanks, ships, and jets for your fleet.',
    kind: 'vehicle',
    contains: () => vehiclesForCase([
      'consumer', 'industrial', 'milspec', 'restricted', 'classified', 'covert', 'extraordinary',
    ]),
  },
  coastal_case: {
    id: 'coastal_case',
    name: 'Coastal Ops Case',
    price: 350,
    keyId: 'coastal_key',
    color: '#1d9bf0',
    image: './assets/cases/coastal-case.png',
    desc: 'Focused pool: ships and frontline air / land strikers.',
    kind: 'vehicle',
    contains: () => vehiclesForCase(
      ['industrial', 'milspec', 'restricted', 'classified', 'covert', 'extraordinary'],
      (v) => v.domain === 'sea' || v.category === 'rifle' || v.style === 'hydro' || v.style === 'keel' || v.style === 'leviathan'
    ),
  },
  apex_case: {
    id: 'apex_case',
    name: 'Apex Fleet Case',
    price: 500,
    keyId: 'apex_key',
    color: '#e4ae39',
    image: './assets/cases/apex-case.png',
    desc: 'High-tier fleet pool. Better odds at Classified+ craft.',
    kind: 'vehicle',
    contains: () => vehiclesForCase(['milspec', 'restricted', 'classified', 'covert', 'extraordinary']),
    weightBoost: { milspec: 1, restricted: 1.4, classified: 1.8, covert: 2.2, extraordinary: 2.5 },
  },
  warheads_case: {
    id: 'warheads_case',
    name: 'Warheads Case',
    price: 400,
    keyId: 'warheads_key',
    color: '#ff5c5c',
    image: './assets/cases/warheads-case.png',
    desc: 'Ordnance upgrades: bullets, mags, bombs, torpedoes, landmines, and more.',
    kind: 'item',
    contains: () => warheadsPool(),
    weightBoost: { consumer: 1, industrial: 1.1, milspec: 1.2, restricted: 1.4, classified: 1.6, covert: 1.8, extraordinary: 2 },
  },
  accessories_case: {
    id: 'accessories_case',
    name: 'Accessories Case',
    price: 550,
    keyId: 'accessories_key',
    color: '#7ec8e8',
    image: './assets/cases/accessories-case.png',
    desc: 'Permanent vehicle mods: mine detector, engines, plating, scopes, and more.',
    kind: 'item',
    contains: () => accessoriesPool(),
    weightBoost: { industrial: 1, milspec: 1.2, restricted: 1.5, classified: 1.8, covert: 2.2 },
  },
};

/** Roll a vehicle unlock from a case (not a skin). */
export function rollVehicleFromCase(caseId) {
  const crate = CASES[caseId];
  if (!crate || crate.kind === 'item') return null;
  let pool = crate.contains();
  // Always include crate exclusives that match rarity filters so cases feel special
  const exclusives = Object.values(VEHICLES).filter((v) => v.crateOnly);
  for (const v of exclusives) {
    if (!pool.find((x) => x.id === v.id)) {
      const allowed = crate.id === 'apex_case'
        ? ['milspec', 'restricted', 'classified', 'covert', 'extraordinary']
        : null;
      if (!allowed || allowed.includes(v.rarity)) pool = [...pool, v];
    }
  }
  // Also allow non-starter base craft that aren't in pool yet (APC etc. if marked)
  const unlockables = Object.values(VEHICLES).filter((v) => !v.starter || v.crateOnly);
  if (!pool.length) pool = unlockables;
  if (!pool.length) return null;

  const boost = crate.weightBoost || {};
  const weighted = pool.map((v) => ({
    vehicle: v,
    w: (RARITY[v.rarity || 'milspec']?.weight || 1) * (boost[v.rarity || 'milspec'] || 1),
  }));
  const total = weighted.reduce((a, b) => a + b.w, 0);
  let r = Math.random() * total;
  for (const item of weighted) {
    r -= item.w;
    if (r <= 0) return item.vehicle;
  }
  return weighted[weighted.length - 1].vehicle;
}

/** Roll a warheads/accessories item from an item case. */
export function rollItemFromCase(caseId) {
  const crate = CASES[caseId];
  if (!crate || crate.kind !== 'item') return null;
  return rollItemFromPool(crate.contains(), crate.weightBoost || {});
}

/** @deprecated — use rollVehicleFromCase */
export function rollSkinFromCase(caseId) {
  return rollVehicleFromCase(caseId);
}

export function rarityColor(id) {
  return RARITY[id]?.color || '#b0c3d9';
}

export function defaultSkinId(vehicleId) {
  return `${vehicleId}__factory`;
}

/** Skins available for purchase in the Armory (one finish × one vehicle listing uses price). */
export function shopSkinCatalog() {
  // Sell finishes as "paint kits" applied per vehicle — list unique finish names once,
  // but purchase is always for a specific vehicle skin id in UI.
  return Object.values(SKINS).filter((s) => !s.isDefault);
}
