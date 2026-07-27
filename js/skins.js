/** Skin catalog, crates, keys — CS2-style drop economy for vehicles */

import { VEHICLES } from './config.js';

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
 * Each finish has unique colors + a pattern used by preview art and 3D body textures.
 * pattern: solid | camo | digital | hex | carbon | tiger | rust | circuit | pearl | scale | stripes | mesh | splatter
 */
const FINISHES = [
  { suffix: 'Desert Storm', color: 0xc2a46b, secondary: 0x8a7048, tertiary: 0xe8d5a8, pattern: 'camo', metalness: 0.25, roughness: 0.72, rarity: 'consumer' },
  { suffix: 'Urban Mesh', color: 0x6a727a, secondary: 0x3a4248, tertiary: 0xa8b0b8, pattern: 'mesh', metalness: 0.4, roughness: 0.55, rarity: 'consumer' },
  { suffix: 'Forest Canopy', color: 0x4a5c3a, secondary: 0x2a3820, tertiary: 0x7a8c5a, pattern: 'camo', metalness: 0.28, roughness: 0.68, rarity: 'consumer' },
  { suffix: 'Night Ops', color: 0x2a3038, secondary: 0x12161c, tertiary: 0x4a5560, pattern: 'digital', metalness: 0.5, roughness: 0.45, rarity: 'industrial' },
  { suffix: 'Arctic White', color: 0xd8e2ea, secondary: 0x8aa0b2, tertiary: 0xffffff, pattern: 'splatter', metalness: 0.35, roughness: 0.4, rarity: 'industrial' },
  { suffix: 'Copper Patina', color: 0xb87333, secondary: 0x5a8a6a, tertiary: 0xd4a060, pattern: 'rust', metalness: 0.7, roughness: 0.38, rarity: 'industrial' },
  { suffix: 'Cobalt Stripe', color: 0x2f6fb5, secondary: 0x0e2a4a, tertiary: 0x6aa8e8, pattern: 'stripes', metalness: 0.55, roughness: 0.4, rarity: 'milspec' },
  { suffix: 'Jade Current', color: 0x2f8f6b, secondary: 0x0a3a2a, tertiary: 0x6ad4a8, pattern: 'hex', metalness: 0.5, roughness: 0.38, rarity: 'milspec' },
  { suffix: 'Crimson Wake', color: 0xa83232, secondary: 0x4a1010, tertiary: 0xe86060, pattern: 'tiger', metalness: 0.55, roughness: 0.4, rarity: 'milspec' },
  { suffix: 'Neon Circuit', color: 0x0a2a28, secondary: 0x1fd6c0, tertiary: 0x88ffe8, pattern: 'circuit', metalness: 0.65, roughness: 0.28, emissive: 0x0a4a44, rarity: 'restricted' },
  { suffix: 'Purple Haze', color: 0x6b3fa0, secondary: 0x2a1040, tertiary: 0xc48cff, pattern: 'splatter', metalness: 0.6, roughness: 0.32, emissive: 0x2a1040, rarity: 'restricted' },
  { suffix: 'Solar Flare', color: 0xff8a1a, secondary: 0x8a2a00, tertiary: 0xffd080, pattern: 'stripes', metalness: 0.55, roughness: 0.3, emissive: 0x4a2200, rarity: 'restricted' },
  { suffix: 'Void Carbon', color: 0x12161c, secondary: 0x2a3038, tertiary: 0x0a0c10, pattern: 'carbon', metalness: 0.85, roughness: 0.18, emissive: 0x102030, rarity: 'classified' },
  { suffix: 'Rose Titanium', color: 0xc45c7a, secondary: 0x6a2840, tertiary: 0xf0a0b8, pattern: 'pearl', metalness: 0.8, roughness: 0.22, emissive: 0x401020, rarity: 'classified' },
  { suffix: 'Ion Storm', color: 0x3d7cff, secondary: 0x102040, tertiary: 0xa0c8ff, pattern: 'circuit', metalness: 0.75, roughness: 0.2, emissive: 0x102040, rarity: 'classified' },
  { suffix: 'Blood Orbit', color: 0x8b0000, secondary: 0x2a0000, tertiary: 0xff4040, pattern: 'hex', metalness: 0.7, roughness: 0.18, emissive: 0x400000, rarity: 'covert' },
  { suffix: 'Ghost Pearl', color: 0xe8f0ff, secondary: 0xa0b8d0, tertiary: 0xffffff, pattern: 'pearl', metalness: 0.9, roughness: 0.12, emissive: 0x304050, rarity: 'covert' },
  { suffix: 'Dragon Scale', color: 0x1a8f3c, secondary: 0x0a3018, tertiary: 0x50d880, pattern: 'scale', metalness: 0.75, roughness: 0.2, emissive: 0x0a3018, rarity: 'covert' },
  { suffix: 'Apex Legend', color: 0xffd700, secondary: 0x8a6000, tertiary: 0xfff0a0, pattern: 'hex', metalness: 0.95, roughness: 0.1, emissive: 0x5a4000, rarity: 'extraordinary' },
  { suffix: 'Black Market', color: 0x1a0a10, secondary: 0xff3b5c, tertiary: 0xff8098, pattern: 'tiger', metalness: 0.9, roughness: 0.12, emissive: 0x400010, rarity: 'extraordinary' },
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
      name: `${v.name} | Factory New`,
      shortName: 'Factory New',
      rarity: 'consumer',
      color: v.color,
      secondary: (v.color >> 1) & 0x7f7f7f,
      tertiary: Math.min(0xffffff, v.color + 0x202020),
      pattern: 'solid',
      metalness: 0.55,
      roughness: 0.45,
      emissive: 0x000000,
      sellPrice: 5,
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
    desc: 'Opens Ironfront Weapon Cases.',
    image: './assets/keys/ironfront-key.png',
  },
  coastal_key: {
    id: 'coastal_key',
    name: 'Coastal Ops Key',
    price: 850,
    caseId: 'coastal_case',
    desc: 'Opens Coastal Ops Cases.',
    image: './assets/keys/coastal-key.png',
  },
  apex_key: {
    id: 'apex_key',
    name: 'Apex Collection Key',
    price: 1200,
    caseId: 'apex_case',
    desc: 'Opens Apex Collection Cases.',
    image: './assets/keys/apex-key.png',
  },
};

function skinsForCase(rarities, vehicleFilter = null) {
  return Object.values(SKINS).filter((s) => {
    if (s.isDefault) return false;
    if (!rarities.includes(s.rarity)) return false;
    if (vehicleFilter && !vehicleFilter.includes(s.vehicleId)) return false;
    return true;
  });
}

export const CASES = {
  ironfront_case: {
    id: 'ironfront_case',
    name: 'Ironfront Case',
    price: 250,
    keyId: 'ironfront_key',
    color: '#c45c28',
    image: './assets/cases/ironfront-case.png',
    desc: 'Standard fleet finishes across all vehicle classes.',
    contains: () => skinsForCase([
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
    desc: 'Focused on ships and frontline strike craft.',
    contains: () => skinsForCase(
      ['industrial', 'milspec', 'restricted', 'classified', 'covert', 'extraordinary'],
      Object.values(VEHICLES)
        .filter((v) => v.domain === 'sea' || v.category === 'rifle')
        .map((v) => v.id)
    ),
  },
  apex_case: {
    id: 'apex_case',
    name: 'Apex Collection Case',
    price: 500,
    keyId: 'apex_key',
    color: '#e4ae39',
    image: './assets/cases/apex-case.png',
    desc: 'High-tier pool. Better odds at Classified+.',
    contains: () => skinsForCase(['milspec', 'restricted', 'classified', 'covert', 'extraordinary']),
    weightBoost: { milspec: 1, restricted: 1.4, classified: 1.8, covert: 2.2, extraordinary: 2.5 },
  },
};

export function rollSkinFromCase(caseId) {
  const crate = CASES[caseId];
  if (!crate) return null;
  const pool = crate.contains();
  if (!pool.length) return null;
  const boost = crate.weightBoost || {};
  const weighted = pool.map((s) => ({
    skin: s,
    w: (RARITY[s.rarity]?.weight || 1) * (boost[s.rarity] || 1),
  }));
  const total = weighted.reduce((a, b) => a + b.w, 0);
  let r = Math.random() * total;
  for (const item of weighted) {
    r -= item.w;
    if (r <= 0) return item.skin;
  }
  return weighted[weighted.length - 1].skin;
}

export function rarityColor(id) {
  return RARITY[id]?.color || '#b0c3d9';
}

export function defaultSkinId(vehicleId) {
  return `${vehicleId}__factory`;
}
