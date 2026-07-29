/** Realtime multiplayer via public MQTT broker (GitHub Pages friendly, no API keys). */

import mqtt from 'mqtt';

const ROOT = 'vs/redhot/v1';
const BROKER_URL = 'wss://broker.hivemq.com:8884/mqtt';
const PRESENCE_TTL_MS = 10000;
const PRESENCE_BEAT_MS = 2500;

function topic(...parts) {
  return [ROOT, ...parts].join('/');
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
    this._listeners = {
      presence: [],
      lobby: [],
      matchStart: [],
      unit: [],
      matchMeta: [],
      event: [],
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
    });
    this.client.on('close', () => {
      this.connected = false;
      this._emit('connection', { connected: false });
    });
    this.client.on('message', (t, buf) => this._onMessage(t, buf));

    this._resubscribe();
    this.publishPresence(true);
    this._beatTimer = setInterval(() => this.publishPresence(false), PRESENCE_BEAT_MS);
    return true;
  }

  _resubscribe() {
    if (!this.client) return;
    this.client.subscribe(topic('presence', '+'), { qos: 0 });
    if (this.lobbyId) {
      this.client.subscribe(topic('lobby', this.lobbyId, '#'), { qos: 0 });
    }
    if (this.matchId) {
      this.client.subscribe(topic('match', this.matchId, '#'), { qos: 0 });
    }
  }

  disconnect() {
    if (this._beatTimer) clearInterval(this._beatTimer);
    this._beatTimer = null;
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
   * Join or create a lobby for map/mode. Returns { lobbyId, isHost }.
   */
  enterSearch({ mapId, modeId, team }) {
    const peers = this.searchingPeers(mapId, modeId);
    const existing = peers.find((p) => p.lobbyId);
    let lobbyId;
    let isHost;
    if (existing?.lobbyId) {
      lobbyId = existing.lobbyId;
      isHost = false;
    } else {
      lobbyId = `L${this.clientId.slice(0, 10)}`;
      isHost = true;
    }
    this.lobbyId = lobbyId;
    this.isLobbyHost = isHost;
    this.matchId = null;
    this.isMatchHost = false;
    this._resubscribe();
    this.setStatus('searching', { mapId, modeId, team, lobbyId });
    this.publishHello();
    return { lobbyId, isHost };
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
      ts: Date.now(),
    };
    this.client.publish(topic('lobby', this.lobbyId, 'hello'), JSON.stringify(msg), { qos: 0 });
  }

  publishLobbyState(state) {
    if (!this.lobbyId || !this.isLobbyHost || !this.client?.connected) return;
    this.client.publish(
      topic('lobby', this.lobbyId, 'state'),
      JSON.stringify({ ...state, hostId: this.clientId, ts: Date.now() }),
      { qos: 0 }
    );
  }

  publishMatchStart(payload) {
    if (!this.lobbyId || !this.isLobbyHost || !this.client?.connected) return;
    const matchId = payload.matchId || `M${Date.now().toString(36)}`;
    const body = { ...payload, matchId, hostId: this.clientId, ts: Date.now() };
    this.client.publish(topic('lobby', this.lobbyId, 'start'), JSON.stringify(body), { qos: 0 });
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
  clearLobby() {
    this.lobbyId = null;
    this.isLobbyHost = false;
    this._resubscribe();
  }

  leaveLobby() {
    this.clearLobby();
    this.matchId = null;
    this.isMatchHost = false;
    this.setStatus('menu', {});
  }

  attachMatch(matchId, isHost) {
    this.matchId = matchId;
    this.isMatchHost = !!isHost;
    // Match channel only — lobby hello/state must not keep firing mid-match
    this.lobbyId = null;
    this.isLobbyHost = false;
    this._resubscribe();
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

  _onMessage(t, buf) {
    let data;
    try {
      const text = buf.toString();
      if (!text) {
        // retained clear
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
    // vs / redhot / v1 / ...
    const kind = parts[3];

    if (kind === 'presence') {
      const id = data.clientId || parts[4];
      if (!id) return;
      if (Date.now() - (data.ts || 0) > PRESENCE_TTL_MS * 2) return;
      this.presence.set(id, data);
      this._prunePresence();
      this._emit('presence', this.onlineOperators());
      return;
    }

    if (kind === 'lobby' && parts[4] === this.lobbyId) {
      const ch = parts[5];
      if (ch === 'state') this._emit('lobby', { type: 'state', data });
      else if (ch === 'hello') this._emit('lobby', { type: 'hello', data });
      else if (ch === 'start') this._emit('lobby', { type: 'start', data });
      return;
    }

    if (kind === 'match' && parts[4] === this.matchId) {
      const ch = parts[5];
      if (ch === 'unit') this._emit('unit', data);
      else if (ch === 'meta') this._emit('matchMeta', data);
      else if (ch === 'ai') this._emit('unit', { ...data, aiBundle: true });
      else if (ch === 'event') this._emit('event', data);
    }
  }

  _prunePresence() {
    const now = Date.now();
    for (const [id, rec] of this.presence) {
      if (now - (rec.ts || 0) > PRESENCE_TTL_MS) this.presence.delete(id);
    }
  }
}
