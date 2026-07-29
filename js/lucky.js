/** /lucky and /semi-lucky cheat modes. */

const LUCKY_KEY = 'vehicle_strike_lucky';
const SEMI_UNTIL_KEY = 'vehicle_strike_semi_lucky_until';
export const SEMI_LUCKY_MS = 10 * 60 * 1000; // 10 minutes

export function isLucky() {
  try {
    return localStorage.getItem(LUCKY_KEY) === '1';
  } catch {
    return false;
  }
}

export function setLucky(on) {
  const next = !!on;
  try {
    if (next) {
      localStorage.setItem(LUCKY_KEY, '1');
      // Full lucky supersedes semi
      localStorage.removeItem(SEMI_UNTIL_KEY);
    } else {
      localStorage.removeItem(LUCKY_KEY);
    }
  } catch {
    /* ignore */
  }
  return next;
}

/** Toggle full lucky mode. Returns the new enabled state. */
export function toggleLucky() {
  return setLucky(!isLucky());
}

function readSemiUntil() {
  try {
    return Number(localStorage.getItem(SEMI_UNTIL_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

export function clearSemiLucky() {
  try {
    localStorage.removeItem(SEMI_UNTIL_KEY);
  } catch {
    /* ignore */
  }
}

/** Active timed semi-lucky (ignored if full lucky is on). */
export function isSemiLucky() {
  if (isLucky()) return false;
  const until = readSemiUntil();
  if (!until) return false;
  if (Date.now() >= until) {
    clearSemiLucky();
    return false;
  }
  return true;
}

/** Start / refresh a 10-minute semi-lucky window. Returns expiry timestamp (ms). */
export function activateSemiLucky(durationMs = SEMI_LUCKY_MS) {
  const until = Date.now() + Math.max(1000, durationMs);
  try {
    localStorage.setItem(SEMI_UNTIL_KEY, String(until));
    // Don't leave full lucky on while using semi
    localStorage.removeItem(LUCKY_KEY);
  } catch {
    /* ignore */
  }
  return until;
}

export function semiLuckyRemainingMs() {
  if (!isSemiLucky()) return 0;
  return Math.max(0, readSemiUntil() - Date.now());
}

export function semiLuckyRemainingLabel() {
  const ms = semiLuckyRemainingMs();
  if (ms <= 0) return '0:00';
  const sec = Math.ceil(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Combat / loot tier: 'lucky' | 'semi' | null */
export function luckTier() {
  if (isLucky()) return 'lucky';
  if (isSemiLucky()) return 'semi';
  return null;
}

/** Rarity rank — higher is better. */
export const LUCKY_RARITY_RANK = {
  consumer: 0,
  industrial: 1,
  milspec: 2,
  restricted: 3,
  classified: 4,
  covert: 5,
  extraordinary: 6,
};

export function rarityRank(id) {
  return LUCKY_RARITY_RANK[id] ?? 0;
}

/** Pick the best-rarity entry from a list (`item.rarity` or string). */
export function pickBestByRarity(list, getRarity = (x) => x?.rarity) {
  if (!list?.length) return null;
  let best = list[0];
  let bestR = rarityRank(getRarity(best));
  for (let i = 1; i < list.length; i += 1) {
    const r = rarityRank(getRarity(list[i]));
    if (r > bestR) {
      best = list[i];
      bestR = r;
    }
  }
  return best;
}

/**
 * Semi-lucky loot: prefer top rarities in the pool, but not always #1.
 * Picks randomly among the best ~40% of the pool by rarity rank.
 */
export function pickSemiLuckyByRarity(list, getRarity = (x) => x?.rarity) {
  if (!list?.length) return null;
  const ranked = [...list].sort(
    (a, b) => rarityRank(getRarity(b)) - rarityRank(getRarity(a))
  );
  const topN = Math.max(1, Math.ceil(ranked.length * 0.4));
  const top = ranked.slice(0, topN);
  return top[Math.floor(Math.random() * top.length)];
}
