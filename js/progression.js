/** Progression — levels, unlockable maps & modes */

export const XP_PER_LEVEL = [
  0, 500, 1200, 2200, 3500, 5200, 7200, 9600, 12500, 16000,
  20000, 24500, 29500, 35000, 41000, 48000, 56000, 65000, 75000, 87000,
];

export function levelFromXp(xp) {
  let lvl = 1;
  for (let i = 1; i < XP_PER_LEVEL.length; i++) {
    if (xp >= XP_PER_LEVEL[i]) lvl = i + 1;
    else break;
  }
  return Math.min(lvl, XP_PER_LEVEL.length);
}

export function xpProgress(xp) {
  const level = levelFromXp(xp);
  const floor = XP_PER_LEVEL[level - 1] || 0;
  const next = XP_PER_LEVEL[level] || floor + 10000;
  return { level, floor, next, into: xp - floor, need: next - floor };
}

export const MAPS = {
  ironfront: {
    id: 'ironfront',
    name: 'Ironfront Harbor',
    blurb: 'Coastal docks, river cut, and island warhead sites.',
    accent: '#e85d04',
    unlock: { type: 'default' },
    winsRequired: 0,
    theme: 'harbor',
  },
  dustfall: {
    id: 'dustfall',
    name: 'Dustfall Mesa',
    blurb: 'North–south wadi canyon, mesa bowls, and sand spires.',
    accent: '#d4a017',
    unlock: { type: 'default' },
    winsRequired: 0,
    theme: 'desert',
  },
  frostbite: {
    id: 'frostbite',
    name: 'Frostbite Sound',
    blurb: 'Fractured ice shelves split by black-water channels.',
    accent: '#7ec8e8',
    unlock: { type: 'default' },
    winsRequired: 0,
    theme: 'arctic',
  },
  blacksite: {
    id: 'blacksite',
    name: 'Blacksite Yard',
    blurb: 'Enclosed neon industrial yard with a canal moat.',
    accent: '#ff3b7a',
    unlock: { type: 'default' },
    winsRequired: 0,
    theme: 'night',
  },
};

export const MODES = {
  strike: {
    id: 'strike',
    name: 'Strike',
    blurb: 'Classic plant / defuse. First to 5 rounds.',
    unlock: { type: 'default' },
    levelRequired: 1,
    teams: true,
    plant: true,
    roundsToWin: 5,
    buyPhase: true,
    bots: 'full',
  },
  skirmish: {
    id: 'skirmish',
    name: 'Skirmish',
    blurb: 'Team deathmatch. First to 8 kills. No warhead.',
    unlock: { type: 'level', min: 3 },
    levelRequired: 3,
    teams: true,
    plant: false,
    fragLimit: 8,
    buyPhase: true,
    bots: 'full',
  },
  siege: {
    id: 'siege',
    name: 'Siege Wave',
    blurb: 'Hold the line against endless hostile fleets.',
    unlock: { type: 'level', min: 6 },
    levelRequired: 6,
    teams: false,
    plant: false,
    buyPhase: true,
    bots: 'waves',
    waveKills: 12,
  },
  vigilante: {
    id: 'vigilante',
    name: 'Vigilante',
    blurb: 'Solo free roam. No rules. Extract whenever you want.',
    unlock: { type: 'level', min: 10 },
    levelRequired: 10,
    teams: false,
    plant: false,
    buyPhase: false,
    freeRoam: true,
    bots: 'hostiles',
    hostileCount: 6,
  },
};

export function isMapUnlocked(mapId, profile) {
  const m = MAPS[mapId];
  if (!m) return false;
  if (m.unlock.type === 'default') return true;
  if (m.unlock.type === 'wins') return (profile.stats?.wins || 0) >= m.unlock.count;
  return (profile.unlockedMaps || []).includes(mapId);
}

export function isModeUnlocked(modeId, profile) {
  const m = MODES[modeId];
  if (!m) return false;
  if (m.unlock.type === 'default') return true;
  const level = profile.level || levelFromXp(profile.xp || 0);
  if (m.unlock.type === 'level') return level >= m.unlock.min;
  return (profile.unlockedModes || []).includes(modeId);
}

export function awardXp(profile, amount) {
  const xp = (profile.xp || 0) + Math.max(0, Math.floor(amount));
  const level = levelFromXp(xp);
  const unlockedModes = new Set(profile.unlockedModes || ['strike']);
  const unlockedMaps = new Set(profile.unlockedMaps || ['ironfront']);
  for (const mode of Object.values(MODES)) {
    if (isModeUnlocked(mode.id, { ...profile, xp, level })) unlockedModes.add(mode.id);
  }
  for (const map of Object.values(MAPS)) {
    if (isMapUnlocked(map.id, { ...profile, stats: profile.stats, xp, level })) unlockedMaps.add(map.id);
  }
  return {
    ...profile,
    xp,
    level,
    unlockedModes: [...unlockedModes],
    unlockedMaps: [...unlockedMaps],
  };
}
