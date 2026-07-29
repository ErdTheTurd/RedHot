/** First-time local operator account (username + optional password). */

const STORAGE_KEY = 'vehicle_strike_account_v1';
const SESSION_KEY = 'vehicle_strike_session_v1';

function bytesToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomId(bytes = 16) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return bytesToHex(arr);
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const dig = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(dig);
}

function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.username || !parsed?.clientId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveRaw(account) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
}

export function normalizeUsername(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-]/g, '')
    .slice(0, 16);
}

export function validateUsername(name) {
  const u = normalizeUsername(name);
  if (u.length < 3) return { ok: false, reason: 'Callsign needs at least 3 characters' };
  if (!/^[a-zA-Z]/.test(u)) return { ok: false, reason: 'Callsign must start with a letter' };
  return { ok: true, username: u };
}

export function hasAccount() {
  return !!loadRaw();
}

export function getAccount() {
  return loadRaw();
}

export function isLoggedIn() {
  try {
    if (!hasAccount()) return false;
    return localStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function setLoggedIn(on) {
  try {
    if (on) localStorage.setItem(SESSION_KEY, '1');
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * First-time only. Password is optional (“maybe a password”).
 * Stored locally — protects this browser profile, not a cloud login server.
 */
export async function createAccount(username, password = '') {
  if (hasAccount()) {
    return { ok: false, reason: 'An operator account already exists on this device' };
  }
  const check = validateUsername(username);
  if (!check.ok) return check;

  const pwd = String(password || '');
  if (pwd && pwd.length < 4) {
    return { ok: false, reason: 'Password must be at least 4 characters (or leave blank)' };
  }

  const salt = randomId(8);
  const passHash = pwd ? await sha256Hex(`${salt}:${pwd}`) : '';
  const account = {
    username: check.username,
    clientId: randomId(16),
    salt,
    passHash,
    createdAt: Date.now(),
  };
  saveRaw(account);
  setLoggedIn(true);
  return { ok: true, account };
}

export async function loginAccount(username, password = '') {
  const account = loadRaw();
  if (!account) return { ok: false, reason: 'No account on this device — create one first' };

  const check = validateUsername(username);
  if (!check.ok) return check;
  if (check.username.toLowerCase() !== account.username.toLowerCase()) {
    return { ok: false, reason: 'Callsign does not match this device account' };
  }

  if (account.passHash) {
    const hash = await sha256Hex(`${account.salt}:${String(password || '')}`);
    if (hash !== account.passHash) return { ok: false, reason: 'Incorrect password' };
  }

  setLoggedIn(true);
  return { ok: true, account };
}

export function logoutAccount() {
  setLoggedIn(false);
}

/** Rename the local operator callsign (needed to become DEV on an existing profile). */
export async function renameAccount(username) {
  const account = loadRaw();
  if (!account) return { ok: false, reason: 'No account on this device' };
  const check = validateUsername(username);
  if (!check.ok) return check;
  account.username = check.username;
  saveRaw(account);
  return { ok: true, account };
}

export function isDevAccount() {
  const a = loadRaw();
  return String(a?.username || '').trim().toUpperCase() === 'DEV';
}
