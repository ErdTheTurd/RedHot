/** Realtime multiplayer via public MQTT broker (GitHub Pages friendly, no API keys). */

import mqtt from 'mqtt';

const ROOT = 'vs/redhot/v2';
const BROKER_URL = 'wss://broker.hivemq.com:8884/mqtt';
const PRESENCE_TTL_MS = 16000;
const PRESENCE_BEAT_MS = 2000;

function topic(...parts) {
  return [ROOT, ...parts].join('/');
}

/** Shared lobby room for a theater so simultaneous Deploy always merges. */
export function theaterLobbyId(mapId, modeId) {
  const raw = `T_${String(mapId || 'map')}_${String(modeId || 'mode')}`;
  return raw.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 48);
}

export class NetClient {
  constructor({ account }) {
    this.account = account;
    this.client = null;
    this.connected = false;
    this.presence = new Map(); // clientId -> record
    this.status = 'menu';
    this.meta = {};
    this.lobbyId = null;
    this.isLobbyHost = false;
    this.matchId = null;
    this.isMatchHost = false;
    this._beatTimer = null;
    this._visHandler = null;
    this._listeners = {
      presence: [],
      lobby: [],
      matchStart: [],
      unit: [],
      matchMeta: [],
      event: [],
      chat: [],
      connection: [],
    };
  }

  get clientId() {
    return this.account?.clientId || null;
  }

  get username() {
    return this.account?.username || 'Operator';
  }

  on(type, fn) {
    if (this._listeners[type]) this._listeners[type].push(fn);
    return () => {
      this._listeners[type] = (this._listeners[type] || []).filter((f) => f !== fn);
    };
  }

  _emit(type, payload) {
    for (const fn of this._listeners[type] || []) {
      try { fn(payload); } catch (e) { console.warn('net listener', type, e); }
    }
  }

  async connect() {
    if (!this.clientId) throw new Error('Account required before connecting');
    if (this.client) return this.connected;

    this.client = mqtt.connect(BROKER_URL, {
      clientId: `vs_${this.clientId.slice(0, 18)}`,
      clean: true,
      connectTimeout: 12000,
      reconnectPeriod: 4000,
      protocolVersion: 4,
    });

    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Online relay timed out')), 14000);
      this.client.once('connect', () => {
        clearTimeout(t);
        resolve();
      });
      this.client.once('error', (err) => {
        clearTimeout(t);
        reject(err);
      });
    });

    this.connected = true;
    this._emit('connection', { connected: true });

    this.client.on('reconnect', () => {
      this.connected = true;
      this._emit('connection', { connected: true, reconnected: true });
      this._resubscribe();
      this.publishPresence(true);
      if (this.lobbyId) this.electLobbyHost();
    });
    this.client.on('close', () => {
      this.connected = false;
      this._emit('connection', { connected: false });
    });
    this.client.on('message', (t, buf) => this._onMessage(t, buf));

    this._resubscribe();
    this.publishPresence(true);
    this._beatTimer = setInterval(() => {
      this.publishPresence(false);
      if (this.lobbyId && (this.status === 'searching' || this.status === 'lobby')) {
        this.electLobbyHost();
      }
    }, PRESENCE_BEAT_MS);

    // Tab focus — keep presence fresh so peers don't split lobbies
    this._visHandler = () => {
      if (document.visibilityState === 'visible') this.publishPresence(true);
    };
    document.addEventListener('visibilitychange', this._visHandler);

    return true;
  }

  _resubscribe() {
    if (!this.client) return;
    this.client.subscribe(topic('presence', '+'), { qos: 0 });
    if (this.lobbyId) {
      this.client.subscribe(topic('lobby', this.lobbyId, '#'), { qos: 1 });
    }
    if (this.matchId) {
      this.client.subscribe(topic('match', this.matchId, '#'), { qos: 1 });
    }
  }

  disconnect() {
    if (this._beatTimer) clearInterval(this._beatTimer);
    this._beatTimer = null;
    if (this._visHandler) {
      document.removeEventListener('visibilitychange', this._visHandler);
      this._visHandler = null;
    }
    try {
      if (this.client?.connected) {
        this.client.publish(topic('presence', this.clientId), '', { qos: 0, retain: true });
      }
      this.client?.end(true);
    } catch {
      /* ignore */
    }
    this.client = null;
    this.connected = false;
  }

  setStatus(status, meta = {}) {
    this.status = status;
    this.meta = { ...meta };
    this.publishPresence(true);
  }

  publishPresence(force = false) {
    if (!this.client?.connected || !this.clientId) return;
    const payload = {
      clientId: this.clientId,
      username: this.username,
      status: this.status,
      lobbyId: this.lobbyId,
      matchId: this.matchId,
      mapId: this.meta.mapId || null,
      modeId: this.meta.modeId || null,
      team: this.meta.team || null,
      ts: Date.now(),
      force: !!force,
    };
    this.client.publish(topic('presence', this.clientId), JSON.stringify(payload), {
      qos: 0,
      retain: true,
    });
  }

  onlineOperators() {
    const now = Date.now();
    const list = [];
    for (const [id, rec] of this.presence) {
      if (now - rec.ts > PRESENCE_TTL_MS) continue;
      list.push(rec);
    }
    return list.sort((a, b) => a.username.localeCompare(b.username));
  }

  searchingPeers(mapId, modeId) {
    return this.onlineOperators().filter((p) => (
      p.clientId !== this.clientId
      && (p.status === 'searching' || p.status === 'lobby')
      && p.mapId === mapId
      && p.modeId === modeId
    ));
  }

  /**
   * Lowest clientId in this lobby wins host. Re-run on presence/hello so
   * simultaneous Deploy never ends as two solo hosts.
   */
  electLobbyHost() {
    if (!this.lobbyId || !this.clientId) return false;
    const ids = new Set([this.clientId]);
    for (const p of this.onlineOperators()) {
      if (
        p.lobbyId === this.lobbyId
        && (p.status === 'searching' || p.status === 'lobby')
        && p.clientId
      ) {
        ids.add(p.clientId);
      }
    }
    const sorted = [...ids].sort();
    const next = sorted[0] === this.clientId;
    this.isLobbyHost = next;
    return next;
  }

  /** Force host claim (DEV only — caller must gate). */
  forceLobbyHost() {
    this.isLobbyHost = true;
  }

  /**
   * Join the shared theater lobby. Everyone on the same map/mode shares one room.
   */
  enterSearch({ mapId, modeId, team }) {
    const lobbyId = theaterLobbyId(mapId, modeId);
    this.lobbyId = lobbyId;
    this.matchId = null;
    this.isMatchHost = false;
    this._resubscribe();
    this.setStatus('searching', { mapId, modeId, team, lobbyId });
    this.electLobbyHost();
    this.publishHello();
    return { lobbyId, isHost: this.isLobbyHost };
  }

  publishHello() {
    if (!this.lobbyId || !this.client?.connected) return;
    const msg = {
      type: 'hello',
      clientId: this.clientId,
      username: this.username,
      team: this.meta.team,
      mapId: this.meta.mapId,
      modeId: this.meta.modeId,
      isHost: !!this.isLobbyHost,
      ts: Date.now(),
    };
    this.client.publish(topic('lobby', this.lobbyId, 'hello'), JSON.stringify(msg), { qos: 1 });
  }

  publishLobbyState(state) {
    if (!this.lobbyId || !this.isLobbyHost || !this.client?.connected) return;
    this.client.publish(
      topic('lobby', this.lobbyId, 'state'),
      JSON.stringify({ ...state, hostId: this.clientId, ts: Date.now() }),
      { qos: 1 }
    );
  }

  publishMatchStart(payload) {
    if (!this.lobbyId || !this.isLobbyHost || !this.client?.connected) return;
    const matchId = payload.matchId || `M${Date.now().toString(36)}`;
    const body = { ...payload, matchId, hostId: this.clientId, ts: Date.now() };
    // QoS 1 + retain so joiners who subscribe a moment late still get start
    this.client.publish(topic('lobby', this.lobbyId, 'start'), JSON.stringify(body), {
      qos: 1,
      retain: true,
    });
    // Re-fire a couple times in case the first packet races subscribe
    setTimeout(() => {
      if (this.client?.connected && this.matchId === matchId) {
        this.client.publish(topic('lobby', this.lobbyId || theaterLobbyId(payload.mapId, payload.modeId), 'start'), JSON.stringify(body), { qos: 1 });
      }
    }, 250);
    setTimeout(() => {
      if (this.client?.connected && this.matchId === matchId) {
        this.client.publish(
          topic('lobby', theaterLobbyId(payload.mapId, payload.modeId), 'start'),
          JSON.stringify(body),
          { qos: 1 }
        );
      }
    }, 700);
    this.matchId = matchId;
    this.isMatchHost = true;
    this._resubscribe();
    this.setStatus('match', {
      mapId: payload.mapId,
      modeId: payload.modeId,
      team: this.meta.team,
      lobbyId: this.lobbyId,
      matchId,
    });
  }

  /** Drop lobby subscription/state without touching an active match. */
  clearLobby({ clearStart = false } = {}) {
    // Only wipe retained start when abandoning a lobby (not when transitioning to a match)
    if (clearStart && this.lobbyId && this.client?.connected && !this.matchId) {
      try {
        this.client.publish(topic('lobby', this.lobbyId, 'start'), '', { qos: 1, retain: true });
      } catch {
        /* ignore */
      }
    }
    this.lobbyId = null;
    this.isLobbyHost = false;
    this._resubscribe();
  }

  leaveLobby() {
    this.clearLobby({ clearStart: true });
    this.matchId = null;
    this.isMatchHost = false;
    this.setStatus('menu', {});
  }

  attachMatch(matchId, isHost) {
    this.matchId = matchId;
    this.isMatchHost = !!isHost;
    // Keep lobbyId briefly for start re-publish, then drop hello/state noise
    const priorLobby = this.lobbyId;
    this.lobbyId = null;
    this.isLobbyHost = false;
    this._resubscribe();
    // Also subscribe prior lobby one more second for late start echoes (already launching)
    if (priorLobby && this.client) {
      this.client.subscribe(topic('lobby', priorLobby, '#'), { qos: 1 });
    }
    this.setStatus('match', {
      ...this.meta,
      matchId,
      lobbyId: null,
    });
  }

  publishUnit(state) {
    if (!this.matchId || !this.client?.connected) return;
    this.client.publish(
      topic('match', this.matchId, 'unit', this.clientId),
      JSON.stringify({ ...state, clientId: this.clientId, ts: Date.now() }),
      { qos: 0 }
    );
  }

  publishMatchMeta(meta) {
    if (!this.matchId || !this.isMatchHost || !this.client?.connected) return;
    this.client.publish(
      topic('match', this.matchId, 'meta'),
      JSON.stringify({ ...meta, hostId: this.clientId, ts: Date.now() }),
      { qos: 0 }
    );
  }

  publishAiUnits(units) {
    if (!this.matchId || !this.isMatchHost || !this.client?.connected) return;
    this.client.publish(
      topic('match', this.matchId, 'ai'),
      JSON.stringify({ units, ts: Date.now() }),
      { qos: 0 }
    );
  }

  publishEvent(event) {
    if (!this.matchId || !this.client?.connected) return;
    this.client.publish(
      topic('match', this.matchId, 'event'),
      JSON.stringify({ ...event, from: this.clientId, ts: Date.now() }),
      { qos: 0 }
    );
  }

  /** Match or lobby chat (emoji-safe UTF-8). */
  publishChat(text, extra = {}) {
    const body = {
      type: 'chat',
      clientId: this.clientId,
      username: this.username,
      text: String(text || '').slice(0, 180),
      ...extra,
      ts: Date.now(),
    };
    if (!this.client?.connected) return false;
    if (this.matchId) {
      this.client.publish(topic('match', this.matchId, 'chat'), JSON.stringify(body), { qos: 0 });
      return true;
    }
    if (this.lobbyId) {
      this.client.publish(topic('lobby', this.lobbyId, 'chat'), JSON.stringify(body), { qos: 0 });
      return true;
    }
    return false;
  }

  _onMessage(t, buf) {
    let data;
    try {
      const text = buf.toString();
      if (!text) {
        const parts = t.split('/');
        if (parts[3] === 'presence' && parts[4]) {
          this.presence.delete(parts[4]);
          this._emit('presence', this.onlineOperators());
        }
        return;
      }
      data = JSON.parse(text);
    } catch {
      return;
    }

    const parts = t.split('/');
    const kind = parts[3];

    if (kind === 'presence') {
      const id = data.clientId || parts[4];
      if (!id) return;
      if (Date.now() - (data.ts || 0) > PRESENCE_TTL_MS * 2) return;
      this.presence.set(id, data);
      this._prunePresence();
      this._emit('presence', this.onlineOperators());
      if (this.lobbyId && (this.status === 'searching' || this.status === 'lobby')) {
        this.electLobbyHost();
      }
      return;
    }

    if (kind === 'lobby' && parts[4] === this.lobbyId) {
      const ch = parts[5];
      if (ch === 'state') this._emit('lobby', { type: 'state', data });
      else if (ch === 'hello') this._emit('lobby', { type: 'hello', data });
      else if (ch === 'start') this._emit('lobby', { type: 'start', data });
      else if (ch === 'chat') this._emit('chat', data);
      return;
    }

    // Accept retained/late start for our theater even if lobbyId already cleared
    if (kind === 'lobby' && parts[5] === 'start' && data?.matchId && !this.matchId) {
      const expected = theaterLobbyId(this.meta.mapId, this.meta.modeId);
      if (parts[4] === expected || (data.mapId === this.meta.mapId && data.modeId === this.meta.modeId)) {
        this._emit('lobby', { type: 'start', data });
      }
      return;
    }

    if (kind === 'match' && parts[4] === this.matchId) {
      const ch = parts[5];
      if (ch === 'unit') this._emit('unit', data);
      else if (ch === 'meta') this._emit('matchMeta', data);
      else if (ch === 'ai') this._emit('unit', { ...data, aiBundle: true });
      else if (ch === 'event') this._emit('event', data);
      else if (ch === 'chat') this._emit('chat', data);
    }
  }

  _prunePresence() {
    const now = Date.now();
    for (const [id, rec] of this.presence) {
      if (now - (rec.ts || 0) > PRESENCE_TTL_MS) this.presence.delete(id);
    }
  }
}
