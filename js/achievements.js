/** Commendations / achievements catalog + unlock helpers. */

export const ACHIEVEMENTS = {
  first_deploy: {
    id: 'first_deploy',
    name: 'First Deploy',
    desc: 'Finish your first match.',
    hint: 'Complete any operation.',
  },
  first_blood: {
    id: 'first_blood',
    name: 'First Blood',
    desc: 'Score your first career kill.',
    hint: 'Destroy an enemy vehicle.',
  },
  first_win: {
    id: 'first_win',
    name: 'First Victory',
    desc: 'Win a match.',
    hint: 'Take a round or objective for the win.',
  },
  veteran: {
    id: 'veteran',
    name: 'Veteran',
    desc: 'Play 10 matches.',
    hint: 'Deploy again and again.',
  },
  campaigner: {
    id: 'campaigner',
    name: 'Campaigner',
    desc: 'Win 5 matches.',
    hint: 'Stack victories in the bank.',
  },
  ace: {
    id: 'ace',
    name: 'Ace',
    desc: 'Get 5 kills in a single match.',
    hint: 'Hot streak in one deployment.',
  },
  warhead_planter: {
    id: 'warhead_planter',
    name: 'Demolitions',
    desc: 'Plant a warhead on site.',
    hint: 'Raiders · hold E on A/B.',
  },
  wire_cutter: {
    id: 'wire_cutter',
    name: 'Wire Cutters',
    desc: 'Defuse a planted warhead.',
    hint: 'Sentinels · hold E on the device.',
  },
  case_cracker: {
    id: 'case_cracker',
    name: 'Case Cracker',
    desc: 'Open 5 crates.',
    hint: 'Armory cases + matching keys.',
  },
  quartermaster: {
    id: 'quartermaster',
    name: 'Quartermaster',
    desc: 'Open 25 crates.',
    hint: 'Keep cracking cases.',
  },
  bankroll: {
    id: 'bankroll',
    name: 'Bankroll',
    desc: 'Hold $20,000 in the bank.',
    hint: 'Cash out match payouts.',
  },
  ghost_protocol: {
    id: 'ghost_protocol',
    name: 'Ghost Protocol',
    desc: 'Extract from Vigilante free-roam.',
    hint: 'Esc to extract in Vigilante.',
  },
  strike_champ: {
    id: 'strike_champ',
    name: 'Strike Champion',
    desc: 'Win a Strike match.',
    hint: 'Plant, defuse, or eliminate.',
  },
  skirmish_ace: {
    id: 'skirmish_ace',
    name: 'Skirmish Ace',
    desc: 'Win a Skirmish match.',
    hint: 'Unlock Skirmish at level 3.',
  },
  siege_held: {
    id: 'siege_held',
    name: 'Siege Held',
    desc: 'Win a Siege Wave match.',
    hint: 'Unlock Siege at level 6.',
  },
  theater_ironfront: {
    id: 'theater_ironfront',
    name: 'Ironfront Bound',
    desc: 'Finish a match on Ironfront Harbor.',
    hint: 'Deploy to Ironfront.',
  },
  theater_dustfall: {
    id: 'theater_dustfall',
    name: 'Dustfall Bound',
    desc: 'Finish a match on Dustfall Mesa.',
    hint: 'Unlock Dustfall and deploy.',
  },
  theater_frostbite: {
    id: 'theater_frostbite',
    name: 'Frostbite Bound',
    desc: 'Finish a match on Frostbite Sound.',
    hint: 'Unlock Frostbite and deploy.',
  },
  theater_blacksite: {
    id: 'theater_blacksite',
    name: 'Blacksite Bound',
    desc: 'Finish a match on Blacksite Yard.',
    hint: 'Unlock Blacksite and deploy.',
  },
  fleet_builder: {
    id: 'fleet_builder',
    name: 'Fleet Builder',
    desc: 'Own 6 vehicles.',
    hint: 'Open tank, ship, and jet cases.',
  },
  online_link: {
    id: 'online_link',
    name: 'Live Link',
    desc: 'Finish a multiplayer match with another operator.',
    hint: 'Deploy with a live teammate or rival.',
  },
};

export function achievementList() {
  return Object.values(ACHIEVEMENTS);
}

/**
 * Evaluate unlocks from current inventory + optional match context.
 * Mutates `data.achievements` / stats when unlocking.
 * @returns {{ id: string, def: object }[]} newly unlocked
 */
export function evaluateAchievements(data, ctx = {}) {
  if (!data) return [];
  if (!data.achievements || typeof data.achievements !== 'object') data.achievements = {};
  if (!data.stats || typeof data.stats !== 'object') data.stats = {};

  const stats = data.stats;
  const ownedCount = Object.keys(data.ownedVehicles || {}).filter((id) => data.ownedVehicles[id]).length;
  const checks = {
    first_deploy: () => (stats.matches || 0) >= 1,
    first_blood: () => (stats.kills || 0) >= 1,
    first_win: () => (stats.wins || 0) >= 1,
    veteran: () => (stats.matches || 0) >= 10,
    campaigner: () => (stats.wins || 0) >= 5,
    ace: () => (ctx.matchKills || 0) >= 5 || (stats.bestKills || 0) >= 5,
    warhead_planter: () => (stats.plants || 0) >= 1,
    wire_cutter: () => (stats.defuses || 0) >= 1,
    case_cracker: () => (stats.opens || 0) >= 5,
    quartermaster: () => (stats.opens || 0) >= 25,
    bankroll: () => (data.wallet || 0) >= 20000,
    ghost_protocol: () => (stats.extracts || 0) >= 1,
    strike_champ: () => (stats.winsStrike || 0) >= 1,
    skirmish_ace: () => (stats.winsSkirmish || 0) >= 1,
    siege_held: () => (stats.winsSiege || 0) >= 1,
    theater_ironfront: () => !!(stats.mapsPlayed || {}).ironfront,
    theater_dustfall: () => !!(stats.mapsPlayed || {}).dustfall,
    theater_frostbite: () => !!(stats.mapsPlayed || {}).frostbite,
    theater_blacksite: () => !!(stats.mapsPlayed || {}).blacksite,
    fleet_builder: () => ownedCount >= 6,
    online_link: () => (stats.mpMatches || 0) >= 1,
  };

  const unlocked = [];
  for (const def of achievementList()) {
    if (data.achievements[def.id]) continue;
    const ok = checks[def.id];
    if (ok && ok()) {
      data.achievements[def.id] = { at: Date.now() };
      unlocked.push({ id: def.id, def });
    }
  }
  return unlocked;
}
