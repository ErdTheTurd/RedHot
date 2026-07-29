/** /lucky — overpowered cheat toggle (persists in localStorage). */

const STORAGE_KEY = 'vehicle_strike_lucky';

export function isLucky() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setLucky(on) {
  const next = !!on;
  try {
    if (next) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return next;
}

/** Toggle lucky mode. Returns the new enabled state. */
export function toggleLucky() {
  return setLucky(!isLucky());
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
