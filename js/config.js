/** Vehicle Strike — CS2-style catalog, economy, and constants */

export const TEAMS = {
  RAIDERS: 'raiders',
  SENTINELS: 'sentinels',
};

export const PHASE = {
  BUY: 'buy',
  LIVE: 'live',
  BOMB: 'bomb',
  END: 'end',
};

export const BUY_TIME = 15;
export const ROUND_TIME = 115;
export const BOMB_TIME = 40;
export const DEFUSE_TIME = 5;
export const PLANT_TIME = 3.5;
export const ROUNDS_TO_WIN = 5;
export const START_MONEY = 800;
export const MAX_MONEY = 16000;
export const WIN_REWARD = 3250;
export const LOSS_REWARDS = [1400, 1900, 2400, 2900, 3400];
export const KILL_REWARD = 300;
export const PLANT_REWARD = 300;

/** Categories mirror CS2 buy tabs, remapped to vehicles */
export const CATEGORIES = [
  { id: 'sidearm', label: 'LIGHT CRAFT' },
  { id: 'smg', label: 'FAST ATTACK' },
  { id: 'rifle', label: 'FRONTLINE' },
  { id: 'heavy', label: 'CAPITAL' },
  { id: 'gear', label: 'GEAR' },
];

/**
 * Vehicles replace guns.
 * domain: land | air | sea — affects movement zones
 */
export const VEHICLES = {
  // Light / sidearm equivalents
  scout_tracker: {
    id: 'scout_tracker',
    name: 'Scout Tracker',
    className: 'TANK',
    category: 'sidearm',
    domain: 'land',
    price: 200,
    damage: 28,
    fireRate: 3.2,
    magSize: 24,
    reserves: 72,
    reload: 1.6,
    speed: 18,
    turn: 2.8,
    armorPen: 0.55,
    range: 55,
    spread: 0.04,
    recoil: 0.018,
    color: 0x6b7c3a,
    desc: 'Light tracked recon. Cheap entry hull for early rounds.',
  },
  coastal_skiff: {
    id: 'coastal_skiff',
    name: 'Coastal Skiff',
    className: 'SHIP',
    category: 'sidearm',
    domain: 'sea',
    price: 200,
    damage: 26,
    fireRate: 3.5,
    magSize: 20,
    reserves: 60,
    reload: 1.7,
    speed: 16,
    turn: 2.4,
    armorPen: 0.5,
    range: 50,
    spread: 0.05,
    recoil: 0.02,
    color: 0x3a6b7c,
    desc: 'Fast inshore boat. Ideal for water-lane peeks.',
  },
  wasp_drone: {
    id: 'wasp_drone',
    name: 'Wasp Drone',
    className: 'JET',
    category: 'sidearm',
    domain: 'air',
    price: 300,
    damage: 22,
    fireRate: 5.5,
    magSize: 30,
    reserves: 90,
    reload: 1.4,
    speed: 26,
    turn: 3.4,
    armorPen: 0.4,
    range: 45,
    spread: 0.06,
    recoil: 0.012,
    color: 0x7c6b3a,
    desc: 'Ultralight VTOL. High rate of fire, soft shells.',
  },

  // Fast attack / SMG equivalents
  apc_crusher: {
    id: 'apc_crusher',
    name: 'APC Crusher',
    className: 'TANK',
    category: 'smg',
    domain: 'land',
    price: 1500,
    damage: 24,
    fireRate: 7.5,
    magSize: 35,
    reserves: 105,
    reload: 2.0,
    speed: 15,
    turn: 2.2,
    armorPen: 0.65,
    range: 48,
    spread: 0.055,
    recoil: 0.014,
    color: 0x5a6a40,
    desc: 'Close-range armored carrier with rotary cannon.',
  },
  patrol_cutter: {
    id: 'patrol_cutter',
    name: 'Patrol Cutter',
    className: 'SHIP',
    category: 'smg',
    domain: 'sea',
    price: 1700,
    damage: 27,
    fireRate: 6.2,
    magSize: 32,
    reserves: 96,
    reload: 2.1,
    speed: 17,
    turn: 2.0,
    armorPen: 0.6,
    range: 52,
    spread: 0.05,
    recoil: 0.015,
    color: 0x2f5f74,
    desc: 'Agile cutter. Shreds soft targets on the coast.',
  },
  falcon_interceptor: {
    id: 'falcon_interceptor',
    name: 'Falcon Interceptor',
    className: 'JET',
    category: 'smg',
    domain: 'air',
    price: 2000,
    damage: 23,
    fireRate: 8.5,
    magSize: 40,
    reserves: 120,
    reload: 1.9,
    speed: 30,
    turn: 3.8,
    armorPen: 0.55,
    range: 50,
    spread: 0.048,
    recoil: 0.011,
    color: 0x8a7040,
    desc: 'Dogfighter. Run-and-gun across the skybox.',
  },

  // Frontline / rifle equivalents
  mbt_anvil: {
    id: 'mbt_anvil',
    name: 'MBT Anvil',
    className: 'TANK',
    category: 'rifle',
    domain: 'land',
    price: 2700,
    damage: 36,
    fireRate: 5.0,
    magSize: 30,
    reserves: 90,
    reload: 2.3,
    speed: 13,
    turn: 1.8,
    armorPen: 0.85,
    range: 70,
    spread: 0.028,
    recoil: 0.02,
    color: 0x4f5d34,
    desc: 'Standard battle tank. The AK of the armored line.',
  },
  destroyer_hull: {
    id: 'destroyer_hull',
    name: 'Destroyer Hull',
    className: 'SHIP',
    category: 'rifle',
    domain: 'sea',
    price: 3100,
    damage: 38,
    fireRate: 4.4,
    magSize: 28,
    reserves: 84,
    reload: 2.4,
    speed: 12,
    turn: 1.5,
    armorPen: 0.88,
    range: 75,
    spread: 0.026,
    recoil: 0.022,
    color: 0x24566a,
    desc: 'Destroyer-class gunship. Accurate coastal pressure.',
  },
  raptor_strike: {
    id: 'raptor_strike',
    name: 'Raptor Strike Jet',
    className: 'JET',
    category: 'rifle',
    domain: 'air',
    price: 3300,
    damage: 34,
    fireRate: 5.8,
    magSize: 30,
    reserves: 90,
    reload: 2.2,
    speed: 28,
    turn: 3.0,
    armorPen: 0.8,
    range: 72,
    spread: 0.03,
    recoil: 0.017,
    color: 0x7a5a30,
    desc: 'Multirole strike jet. Balanced air superiority.',
  },

  // Capital / AWP & heavy equivalents
  siege_titan: {
    id: 'siege_titan',
    name: 'Siege Titan',
    className: 'TANK',
    category: 'heavy',
    domain: 'land',
    price: 4750,
    damage: 95,
    fireRate: 0.85,
    magSize: 5,
    reserves: 15,
    reload: 3.2,
    speed: 9,
    turn: 1.1,
    armorPen: 1.0,
    range: 110,
    spread: 0.008,
    recoil: 0.06,
    color: 0x3d4528,
    desc: 'Rail siege cannon. One clean hit ends most hulls.',
  },
  battleship_kronos: {
    id: 'battleship_kronos',
    name: 'Battleship Kronos',
    className: 'SHIP',
    category: 'heavy',
    domain: 'sea',
    price: 5000,
    damage: 110,
    fireRate: 0.7,
    magSize: 4,
    reserves: 12,
    reload: 3.5,
    speed: 8,
    turn: 0.9,
    armorPen: 1.0,
    range: 120,
    spread: 0.01,
    recoil: 0.07,
    color: 0x1a3f50,
    desc: 'Capital naval gun. Slow traverse, devastating salvo.',
  },
  stealth_bomber: {
    id: 'stealth_bomber',
    name: 'Stealth Bomber',
    className: 'JET',
    category: 'heavy',
    domain: 'air',
    price: 5200,
    damage: 100,
    fireRate: 0.75,
    magSize: 4,
    reserves: 12,
    reload: 3.4,
    speed: 22,
    turn: 1.6,
    armorPen: 1.0,
    range: 115,
    spread: 0.012,
    recoil: 0.055,
    color: 0x2a2e35,
    desc: 'High-altitude payload. Punishes static defenses.',
  },
};

export const GEAR = {
  plating: {
    id: 'plating',
    name: 'Reactive Plating',
    category: 'gear',
    price: 1000,
    desc: '+100 plating. Absorbs hull damage first.',
  },
  kit_smoke: {
    id: 'kit_smoke',
    name: 'Smoke Barrage',
    category: 'gear',
    price: 300,
    desc: 'Deploys a smoke screen at aim point.',
  },
  kit_emp: {
    id: 'kit_emp',
    name: 'EMP Flash',
    category: 'gear',
    price: 200,
    desc: 'Briefly blinds optics in a radius.',
  },
  defuse_kit: {
    id: 'defuse_kit',
    name: 'Fast Defuse Kit',
    category: 'gear',
    price: 400,
    desc: 'Halves warhead defuse time. Sentinels only.',
  },
};

export const BOT_NAMES = {
  raiders: ['Ashwake', 'RedKeel', 'DustFang', 'IronHowl', 'Cinder'],
  sentinels: ['BlueDock', 'Tidewall', 'FrostBit', 'Harbor', 'Vigil'],
};

export function formatMoney(n) {
  return `$${Math.floor(n).toLocaleString('en-US')}`;
}

export function formatTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
