/** DEV operator privileges — callsign / account username "DEV" (case-insensitive). */

import { getAccount } from './account.js';

export function normalizeDevName(name) {
  return String(name || '').trim().toUpperCase();
}

export function isDevName(name) {
  return normalizeDevName(name) === 'DEV';
}

/** True when this browser's operator is DEV (account username or active callsign). */
export function isDevOperator(callsign = null) {
  const account = getAccount();
  if (isDevName(account?.username)) return true;
  if (callsign != null && isDevName(callsign)) return true;
  return false;
}

/** DEV unlocks: full admin over match, lobby, cheats, events, chat moderation. */
export const DEV_POWERS = {
  forceHost: true,
  skipTrivia: true,
  godCheats: true,
  matchControl: true,
  chatMod: true,
  allUnlocks: true,
};
