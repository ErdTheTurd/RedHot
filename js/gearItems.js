/** Warheads (ordnance) + Accessories crate catalog */

const RARITY_WEIGHT = {
  consumer: 79.92,
  industrial: 15.98,
  milspec: 3.2,
  restricted: 0.64,
  classified: 0.32,
  covert: 0.064,
  extraordinary: 0.026,
};

/**
 * Crate drop items.
 * type: 'consumable' — stackable match loadout charges
 * type: 'accessory' — permanent unlock (one-time)
 */
export const GEAR_ITEMS = {
  // —— WARHEADS (consumables) ——
  ammo_belt: {
    id: 'ammo_belt',
    name: 'Ammo Belt',
    shortName: 'Bullets',
    crate: 'warheads',
    type: 'consumable',
    rarity: 'consumer',
    domain: 'all',
    desc: '+60 reserve rounds for any vehicle this match.',
    effect: { reserve: 60 },
    color: '#c8a060',
  },
  mag_crate: {
    id: 'mag_crate',
    name: 'Magazine Crate',
    shortName: 'Mags',
    crate: 'warheads',
    type: 'consumable',
    rarity: 'industrial',
    domain: 'all',
    desc: '+2 full magazines added to reserve.',
    effect: { mags: 2 },
    color: '#5e98d9',
  },
  bomb_rack: {
    id: 'bomb_rack',
    name: 'Bomb Rack',
    shortName: 'Bombs',
    crate: 'warheads',
    type: 'consumable',
    rarity: 'milspec',
    domain: 'air',
    desc: '+2 bombs for jets this match.',
    effect: { bombs: 2 },
    color: '#4b69ff',
  },
  torpedo_rack: {
    id: 'torpedo_rack',
    name: 'Torpedo Rack',
    shortName: 'Torpedoes',
    crate: 'warheads',
    type: 'consumable',
    rarity: 'milspec',
    domain: 'sea',
    desc: '+2 torpedoes for ships this match.',
    effect: { torpedoes: 2 },
    color: '#2f8f6b',
  },
  landmine_pack: {
    id: 'landmine_pack',
    name: 'Landmine Pack',
    shortName: 'Mines',
    crate: 'warheads',
    type: 'consumable',
    rarity: 'restricted',
    domain: 'land',
    desc: '+3 landmines. Plant with X. Hidden unless close & still.',
    effect: { landmines: 3 },
    color: '#8847ff',
  },
  ap_rounds: {
    id: 'ap_rounds',
    name: 'AP Rounds',
    shortName: 'AP Rounds',
    crate: 'warheads',
    type: 'consumable',
    rarity: 'restricted',
    domain: 'all',
    desc: '+25% armor penetration this match.',
    effect: { armorPenBonus: 0.25 },
    color: '#d32ce6',
  },
  incendiary_shells: {
    id: 'incendiary_shells',
    name: 'Incendiary Shells',
    shortName: 'Incendiary',
    crate: 'warheads',
    type: 'consumable',
    rarity: 'classified',
    domain: 'all',
    desc: '+15% gun damage this match.',
    effect: { damageBonus: 0.15 },
    color: '#eb4b4b',
  },
  depth_charge: {
    id: 'depth_charge',
    name: 'Depth Charge',
    shortName: 'Depth Charge',
    crate: 'warheads',
    type: 'consumable',
    rarity: 'classified',
    domain: 'sea',
    desc: '+1 heavy sea charge (extra torpedo + bigger blast).',
    effect: { torpedoes: 1, torpedoRadius: 2 },
    color: '#1d9bf0',
  },
  cluster_bombs: {
    id: 'cluster_bombs',
    name: 'Cluster Bombs',
    shortName: 'Cluster',
    crate: 'warheads',
    type: 'consumable',
    rarity: 'covert',
    domain: 'air',
    desc: '+3 bombs with wider blast radius.',
    effect: { bombs: 3, bombRadius: 3 },
    color: '#e85d04',
  },
  warhead_core: {
    id: 'warhead_core',
    name: 'Warhead Core',
    shortName: 'Core',
    crate: 'warheads',
    type: 'consumable',
    rarity: 'extraordinary',
    domain: 'all',
    desc: 'Full reload + bombs/torpedoes/mines top-up.',
    effect: { fullReload: true, bombs: 2, torpedoes: 2, landmines: 2 },
    color: '#e4ae39',
  },

  // —— ACCESSORIES (permanent unlocks) ——
  mine_detector: {
    id: 'mine_detector',
    name: 'Mine Detector',
    shortName: 'Detector',
    crate: 'accessories',
    type: 'accessory',
    rarity: 'milspec',
    desc: 'Reveals enemy landmines on the minimap and in world.',
    effect: { mineDetector: true },
    color: '#4b69ff',
  },
  tuned_engines: {
    id: 'tuned_engines',
    name: 'Tuned Engines',
    shortName: 'Engines',
    crate: 'accessories',
    type: 'accessory',
    rarity: 'milspec',
    desc: '+18% movement speed on all craft.',
    effect: { speedMult: 1.18 },
    color: '#1d9bf0',
  },
  reinforced_plating: {
    id: 'reinforced_plating',
    name: 'Reinforced Plating',
    shortName: 'Plating',
    crate: 'accessories',
    type: 'accessory',
    rarity: 'restricted',
    desc: 'Start every round with +50 plating.',
    effect: { startArmor: 50 },
    color: '#8847ff',
  },
  quick_loader: {
    id: 'quick_loader',
    name: 'Quick Loader',
    shortName: 'Q-Loader',
    crate: 'accessories',
    type: 'accessory',
    rarity: 'restricted',
    desc: '25% faster reloads.',
    effect: { reloadMult: 0.75 },
    color: '#d32ce6',
  },
  extended_mag: {
    id: 'extended_mag',
    name: 'Extended Magazine',
    shortName: 'Ext Mag',
    crate: 'accessories',
    type: 'accessory',
    rarity: 'industrial',
    desc: '+8 mag capacity on every vehicle.',
    effect: { magBonus: 8 },
    color: '#5e98d9',
  },
  bomb_bay_ext: {
    id: 'bomb_bay_ext',
    name: 'Expanded Bomb Bay',
    shortName: 'Bomb Bay',
    crate: 'accessories',
    type: 'accessory',
    rarity: 'classified',
    desc: '+2 bomb capacity on jets.',
    effect: { bombCap: 2 },
    color: '#eb4b4b',
  },
  heavy_tubes: {
    id: 'heavy_tubes',
    name: 'Heavy Torpedo Tubes',
    shortName: 'Tubes',
    crate: 'accessories',
    type: 'accessory',
    rarity: 'classified',
    desc: '+2 torpedo capacity on ships.',
    effect: { torpedoCap: 2 },
    color: '#2f8f6b',
  },
  targeting_scope: {
    id: 'targeting_scope',
    name: 'Targeting Scope',
    shortName: 'Scope',
    crate: 'accessories',
    type: 'accessory',
    rarity: 'milspec',
    desc: 'Tighter gun spread (−35%).',
    effect: { spreadMult: 0.65 },
    color: '#c8a060',
  },
  jump_boosters: {
    id: 'jump_boosters',
    name: 'Jump Boosters',
    shortName: 'Boosters',
    crate: 'accessories',
    type: 'accessory',
    rarity: 'restricted',
    desc: 'Jumps cost 2 ammo instead of 5.',
    effect: { jumpAmmoCost: 2 },
    color: '#ff8a1a',
  },
  reactive_shield: {
    id: 'reactive_shield',
    name: 'Reactive Shield',
    shortName: 'Shield',
    crate: 'accessories',
    type: 'accessory',
    rarity: 'covert',
    desc: 'Once per round: survive a killing blow at 1 HP.',
    effect: { lastStand: true },
    color: '#e4ae39',
  },
};

export function warheadsPool() {
  return Object.values(GEAR_ITEMS).filter((i) => i.crate === 'warheads');
}

export function accessoriesPool() {
  return Object.values(GEAR_ITEMS).filter((i) => i.crate === 'accessories');
}

export function rollItemFromPool(pool, weightBoost = {}) {
  if (!pool?.length) return null;
  const weighted = pool.map((item) => ({
    item,
    w: (RARITY_WEIGHT[item.rarity] || 1) * (weightBoost[item.rarity] || 1),
  }));
  const total = weighted.reduce((a, b) => a + b.w, 0);
  let r = Math.random() * total;
  for (const row of weighted) {
    r -= row.w;
    if (r <= 0) return row.item;
  }
  return weighted[weighted.length - 1].item;
}

/** Simple canvas tile for gear drops */
export function gearItemImageDataUrl(item, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const accent = item.color || '#888';
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, accent);
  g.addColorStop(1, '#0a1016');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(size * 0.12, size * 0.2, size * 0.76, size * 0.55);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.strokeRect(size * 0.12, size * 0.2, size * 0.76, size * 0.55);

  // Glyph by type
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${Math.floor(size * 0.12)}px "Barlow Condensed", sans-serif`;
  ctx.textAlign = 'center';
  const label = item.type === 'accessory' ? 'MOD' : 'ORD';
  ctx.fillText(label, size / 2, size * 0.14);

  ctx.font = `700 ${Math.floor(size * 0.1)}px "Barlow Condensed", sans-serif`;
  const name = (item.shortName || item.name || '').toUpperCase();
  ctx.fillText(name.slice(0, 14), size / 2, size * 0.52);

  ctx.fillStyle = accent;
  ctx.fillRect(0, size - size * 0.06, size, size * 0.06);
  return canvas.toDataURL('image/png');
}
