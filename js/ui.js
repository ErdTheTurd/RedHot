import {
  CATEGORIES, VEHICLES, GEAR, formatMoney, formatTime, TEAMS, BOT_NAMES,
  BUY_VOTE_OPTIONS, BUY_TIME_MAX,
} from './config.js';
import { CASES, KEYS, SKINS, RARITY, rarityColor, shopSkinCatalog } from './skins.js';
import { GEAR_ITEMS, gearItemImageDataUrl } from './gearItems.js';
import { skinImageDataUrl } from './skinArt.js';
import { SFX } from './audio.js';
import {
  MAPS, MODES, isMapUnlocked, isModeUnlocked, xpProgress,
} from './progression.js';
import { MAX_ADS_PER_DAY } from './ads.js';
import { getGraphicsPreset, setGraphicsPreset } from './graphics.js';
import { pickTriviaQuestions, defaultPassNeed, isTriviaSkipped } from './trivia.js';
import {
  hasAccount, getAccount, isLoggedIn, createAccount, loginAccount, renameAccount,
} from './account.js';
import { isDevOperator, isDevName } from './dev.js';

const CHAT_EMOJIS = ['🔥', '💀', '😎', '🚀', '💥', '🎯', '🏆', '👀', '😂', '🫡', '⚡', '🛡️'];

function skinImg(skin) {
  const domain = VEHICLES[skin.vehicleId]?.domain || 'land';
  return skinImageDataUrl(skin, domain, 256);
}

function vehicleImg(vehicle) {
  return vehicle.image || `./assets/vehicles/${vehicle.id}.png`;
}

function gearImg(item) {
  return item.image || gearItemImageDataUrl(item);
}

export function createUI(game, inventory, opts = {}) {
  const $ = (id) => document.getElementById(id);
  const net = opts.net || null;

  const screens = {
    auth: $('screen-auth'),
    menu: $('screen-menu'),
    howto: $('screen-howto'),
    ops: $('screen-ops'),
    team: $('screen-team'),
    buy: $('screen-buy'),
    shop: $('screen-shop'),
    inventory: $('screen-inventory'),
    crate: $('screen-crate'),
  };

  let shopTab = 'cases';
  let invTab = 'vehicles';
  let selectedInv = null;
  let crateFocus = null;
  let lastOpenedVehicle = null;
  let lastOpenedItem = null;
  let lastOpenKind = 'vehicle';
  let reelSpinning = false;
  let opsMap = inventory.profile?.selectedMap || 'ironfront';
  let opsMode = inventory.profile?.selectedMode || 'strike';
  let pendingAdOffer = null;
  let triviaBusy = false;
  let triviaResolver = null;

  const TEAM_SIZE = 4;
  const MM_WAIT_SEC = 60;
  const FAKE_JOIN_NAMES = {
    raiders: ['Ashwake', 'RedKeel', 'DustFang', 'IronHowl', 'Cinder', 'EmberFox', 'RustPike'],
    sentinels: ['BlueDock', 'Tidewall', 'FrostBit', 'Harbor', 'Vigil', 'NorthLock', 'Seaglass'],
  };
  let mmTimer = null;
  let mmHelloTimer = null;
  let mmSecondsLeft = MM_WAIT_SEC;
  let mmTeam = TEAMS.RAIDERS;
  let mmRoster = { raiders: [], sentinels: [] };
  let mmLobbyMembers = new Map(); // clientId -> { username, team }
  let mmNetMode = false;
  let mmLaunching = false;
  let unsubLobby = null;
  let unsubChat = null;
  let myBuyVote = null;
  let chatOpen = false;

  function callsign() {
    return inventory.profile?.callsign || getAccount()?.username || 'You';
  }

  function iAmDev() {
    return isDevOperator(callsign());
  }

  function updateMmDeployLabel() {
    const btn = $('btn-mm-deploy');
    if (!btn) return;
    if (!mmNetMode) {
      btn.textContent = 'DEPLOY NOW';
      btn.disabled = false;
      return;
    }
    const host = !!(net?.isLobbyHost || iAmDev());
    btn.disabled = false;
    btn.textContent = host
      ? (iAmDev() ? 'DEV DEPLOY' : 'DEPLOY NOW (HOST)')
      : 'WAITING FOR HOST…';
  }

  function pushChat(msg) {
    const log = $('chat-log');
    if (!log || !msg) return;
    const row = document.createElement('div');
    row.className = `chat-line${msg.admin ? ' chat-admin' : ''}`;
    const who = document.createElement('strong');
    who.textContent = msg.username || 'Operator';
    const body = document.createElement('span');
    body.textContent = ` ${msg.text || ''}`;
    row.appendChild(who);
    row.appendChild(body);
    log.appendChild(row);
    while (log.children.length > 40) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
    $('chat-panel')?.classList.remove('hidden');
  }

  function openChat() {
    const panel = $('chat-panel');
    const input = $('chat-input');
    if (!panel || !input) return;
    chatOpen = true;
    panel.classList.remove('hidden');
    panel.classList.add('chat-open');
    game.input?.exitLock?.();
    input.value = '';
    setTimeout(() => input.focus(), 0);
  }

  function closeChat(reLock = true) {
    const panel = $('chat-panel');
    const input = $('chat-input');
    chatOpen = false;
    panel?.classList.remove('chat-open');
    input?.blur();
    if (reLock && game.running && !game.buyOpen) game.input?.requestLock?.();
  }

  function submitChat() {
    const input = $('chat-input');
    if (!input) return;
    const text = input.value.trim();
    input.value = '';
    closeChat(true);
    if (!text) return;
    if (text.startsWith('/')) {
      game.handleCommand?.(text);
      return;
    }
    game.sendChat?.(text);
  }

  function paintChatEmojis() {
    const bar = $('chat-emojis');
    if (!bar || bar.dataset.ready) return;
    bar.dataset.ready = '1';
    for (const emo of CHAT_EMOJIS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chat-emoji-btn';
      b.textContent = emo;
      b.title = emo;
      b.onclick = () => {
        const input = $('chat-input');
        if (!input) return;
        input.value = `${input.value}${emo}`;
        input.focus();
      };
      bar.appendChild(b);
    }
  }

  function emptySlot() {
    return { name: 'Open seat', kind: 'empty', clientId: null };
  }

  function blankRoster(playerTeam) {
    const youName = callsign();
    const raiders = Array.from({ length: TEAM_SIZE }, emptySlot);
    const sentinels = Array.from({ length: TEAM_SIZE }, emptySlot);
    const selfId = net?.clientId || 'local';
    if (playerTeam === TEAMS.RAIDERS) {
      raiders[0] = { name: youName, kind: 'you', clientId: selfId };
    } else {
      sentinels[0] = { name: youName, kind: 'you', clientId: selfId };
    }
    return { raiders, sentinels };
  }

  function renderMmSlots() {
    const paint = (listId, slots) => {
      const ul = $(listId);
      if (!ul) return;
      ul.innerHTML = '';
      slots.forEach((slot, i) => {
        const li = document.createElement('li');
        const filled = slot.kind !== 'empty';
        if (filled) li.classList.add('filled');
        if (slot.kind === 'you') li.classList.add('you');
        if (slot.kind === 'human') li.classList.add('human');
        const kindLabel = slot.kind === 'you' ? 'YOU'
          : slot.kind === 'human' ? 'PLAYER'
            : slot.kind === 'ai' ? 'AI' : 'OPEN';
        li.innerHTML = `<span>${filled ? slot.name : `Slot ${i + 1}`}</span><span class="mm-kind ${slot.kind}">${kindLabel}</span>`;
        ul.appendChild(li);
      });
    };
    paint('mm-slots-raiders', mmRoster.raiders);
    paint('mm-slots-sentinels', mmRoster.sentinels);
  }

  function formatMmClock(sec) {
    const s = Math.max(0, sec | 0);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }

  function humanCountInRoster(roster = mmRoster) {
    let n = 0;
    for (const team of ['raiders', 'sentinels']) {
      for (const s of roster[team] || []) {
        if (s.kind === 'you' || s.kind === 'human') n += 1;
      }
    }
    return n;
  }

  function seatMember(member) {
    if (!member?.clientId) return;
    const team = member.team === TEAMS.SENTINELS ? 'sentinels' : 'raiders';
    const selfId = net?.clientId;
    // Already seated?
    for (const t of ['raiders', 'sentinels']) {
      const idx = mmRoster[t].findIndex((s) => s.clientId === member.clientId);
      if (idx >= 0) {
        mmRoster[t][idx] = {
          name: member.username,
          kind: member.clientId === selfId ? 'you' : 'human',
          clientId: member.clientId,
        };
        return;
      }
    }
    // Prefer keeping local player on seat 0 of their team
    let idx = mmRoster[team].findIndex((s) => s.kind === 'empty');
    if (idx < 0) return;
    if (member.clientId === selfId) {
      // Ensure you are seat 0
      const empty0 = mmRoster[team][0]?.kind === 'empty';
      idx = empty0 ? 0 : idx;
    }
    mmRoster[team][idx] = {
      name: member.username,
      kind: member.clientId === selfId ? 'you' : 'human',
      clientId: member.clientId,
    };
  }

  function rebuildRosterFromMembers() {
    mmRoster = blankRoster(mmTeam);
    // Clear auto-you then re-seat everyone including self from members map
    for (const team of ['raiders', 'sentinels']) {
      mmRoster[team] = Array.from({ length: TEAM_SIZE }, emptySlot);
    }
    const ordered = [...mmLobbyMembers.values()].sort((a, b) => a.clientId.localeCompare(b.clientId));
    for (const m of ordered) seatMember(m);
    // Ensure local player always present
    if (net?.clientId && ![...mmLobbyMembers.keys()].includes(net.clientId)) {
      seatMember({ clientId: net.clientId, username: callsign(), team: mmTeam });
    }
    renderMmSlots();
  }

  function stopMatchmaking(resetUi = true, { preserveMatch = false } = {}) {
    if (mmTimer) {
      clearInterval(mmTimer);
      mmTimer = null;
    }
    if (mmHelloTimer) {
      clearInterval(mmHelloTimer);
      mmHelloTimer = null;
    }
    if (typeof unsubLobby === 'function') {
      unsubLobby();
      unsubLobby = null;
    }
    if (!preserveMatch) mmLaunching = false;
    mmNetMode = false;
    mmLobbyMembers = new Map();
    if (net) {
      if (preserveMatch || net.status === 'match') {
        // Keep matchId / unit channel; only drop lobby binding
        net.clearLobby?.();
      } else if (net.status === 'searching' || net.status === 'lobby') {
        net.leaveLobby();
      }
    }
    if (resetUi) {
      $('team-matchmaking')?.classList.add('hidden');
      $('team-pick')?.classList.remove('hidden');
      if ($('mm-status')) $('mm-status').textContent = 'SEARCHING FOR OPERATORS';
      if ($('mm-sub')) $('mm-sub').textContent = 'Looking for players on both fleets…';
    }
  }

  /** Wire roster: every seated live operator is kind human + clientId (no local 'you'). */
  function rosterForNet(roster) {
    const mapSide = (slots) => (slots || []).map((s) => {
      if ((s.kind === 'you' || s.kind === 'human') && s.clientId) {
        return { name: s.name, kind: 'human', clientId: s.clientId };
      }
      return { ...s };
    });
    return {
      raiders: mapSide(roster.raiders),
      sentinels: mapSide(roster.sentinels),
    };
  }

  function fillRemainingWithAi(keepHumans = false) {
    for (const team of ['raiders', 'sentinels']) {
      const pool = [...(BOT_NAMES[team] || FAKE_JOIN_NAMES[team])];
      const used = new Set(mmRoster[team].filter((s) => s.kind !== 'empty').map((s) => s.name));
      mmRoster[team] = mmRoster[team].map((slot) => {
        if (slot.kind === 'you') return slot;
        if (slot.kind === 'human') {
          // Only keep real networked operators — theatrical “humans” have no clientId
          return keepHumans && slot.clientId
            ? slot
            : { name: slot.name, kind: 'ai', clientId: null };
        }
        if (slot.kind !== 'empty') return slot;
        let name = pool.find((n) => !used.has(n)) || `AI-${team[0].toUpperCase()}${used.size}`;
        used.add(name);
        return { name, kind: 'ai', clientId: null };
      });
    }
    renderMmSlots();
  }

  function tryFakeJoin() {
    // Only pad with theatrical joins when nobody else is actually online in this lobby
    if (mmNetMode && mmLobbyMembers.size > 1) return;
    const teams = ['raiders', 'sentinels'];
    const order = Math.random() > 0.5 ? teams : teams.slice().reverse();
    for (const team of order) {
      const idx = mmRoster[team].findIndex((s) => s.kind === 'empty');
      if (idx < 0) continue;
      const pool = FAKE_JOIN_NAMES[team].filter(
        (n) => !mmRoster[team].some((s) => s.name === n)
      );
      if (!pool.length) continue;
      if (Math.random() > 0.55) continue;
      const name = pool[Math.floor(Math.random() * pool.length)];
      mmRoster[team][idx] = { name, kind: 'human', clientId: null };
      if ($('mm-sub')) $('mm-sub').textContent = `${name} joined ${team === 'raiders' ? 'Raiders' : 'Sentinels'}`;
      SFX.ui();
      renderMmSlots();
      return;
    }
  }

  function publishHostLobbyState() {
    if (!net?.isLobbyHost) return;
    net.publishLobbyState({
      secondsLeft: mmSecondsLeft,
      mapId: opsMap,
      modeId: opsMode,
      roster: {
        raiders: mmRoster.raiders.map((s) => ({ ...s })),
        sentinels: mmRoster.sentinels.map((s) => ({ ...s })),
      },
      members: [...mmLobbyMembers.values()],
    });
  }

  function launchMatchFromMm(fromNetStart = null) {
    if (mmLaunching) return;
    mmLaunching = true;

    // Capture BEFORE teardown — stopMatchmaking used to zero mmNetMode / leaveLobby
    // (clearing isLobbyHost + lobbyId) so publishMatchStart never ran and humans
    // were stripped to AI. Match sync must happen while the lobby is still live.
    const netMode = mmNetMode;
    const isHost = !!net?.isLobbyHost;

    // Stop countdown / hello spam only; keep lobby MQTT + flags until start is published
    if (mmTimer) {
      clearInterval(mmTimer);
      mmTimer = null;
    }
    if (mmHelloTimer) {
      clearInterval(mmHelloTimer);
      mmHelloTimer = null;
    }

    let roster;
    let team = mmTeam;
    let mapId = opsMap;
    let modeId = opsMode;
    let matchId = null;
    let netHumans = [];

    if (fromNetStart) {
      roster = fromNetStart.roster;
      mapId = fromNetStart.mapId || opsMap;
      modeId = fromNetStart.modeId || opsMode;
      matchId = fromNetStart.matchId;
      mmRoster = {
        raiders: (roster.raiders || []).map((s) => ({ ...s })),
        sentinels: (roster.sentinels || []).map((s) => ({ ...s })),
      };
      fillRemainingWithAi(true);
      roster = rosterForNet({
        raiders: mmRoster.raiders.map((s) => ({ ...s })),
        sentinels: mmRoster.sentinels.map((s) => ({ ...s })),
      });
      team = mmTeam;
      for (const side of ['raiders', 'sentinels']) {
        if (roster[side].some((s) => s.clientId && s.clientId === net?.clientId)) {
          team = side;
          break;
        }
      }
      if (net && matchId) {
        net.attachMatch(matchId, fromNetStart.hostId === net.clientId);
      }
    } else {
      if ($('mm-status')) $('mm-status').textContent = 'LOCKING ROSTER';
      if ($('mm-sub')) {
        $('mm-sub').textContent = humanCountInRoster() > 1
          ? 'Deploying live operators + AI fill…'
          : 'Empty seats filled with AI. Deploying…';
      }
      // Always rebuild from live members so peers hello'd in are on the start roster
      if (netMode && net) {
        if (iAmDev()) net.forceLobbyHost?.();
        net.electLobbyHost?.();
        rebuildRosterFromMembers();
      }
      fillRemainingWithAi(netMode && (mmLobbyMembers.size > 1 || humanCountInRoster() > 1));
      roster = {
        raiders: mmRoster.raiders.map((s) => ({ ...s })),
        sentinels: mmRoster.sentinels.map((s) => ({ ...s })),
      };
      const hostNow = !!(netMode && net && (net.isLobbyHost || iAmDev()));
      if (netMode && hostNow && net) {
        if (iAmDev() && !net.isLobbyHost) net.forceLobbyHost?.();
        matchId = `M${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        roster = rosterForNet(roster);
        // Guarantee every lobby member is on the published roster
        for (const m of mmLobbyMembers.values()) {
          if (!m.clientId) continue;
          const side = m.team === TEAMS.SENTINELS ? 'sentinels' : 'raiders';
          const exists = roster[side].some((s) => s.clientId === m.clientId)
            || roster.raiders.some((s) => s.clientId === m.clientId)
            || roster.sentinels.some((s) => s.clientId === m.clientId);
          if (!exists) {
            const slot = { name: m.username || 'Operator', kind: 'human', clientId: m.clientId };
            const empty = roster[side].findIndex((s) => s.kind === 'ai' || s.kind === 'empty');
            if (empty >= 0) roster[side][empty] = slot;
            else roster[side].push(slot);
          }
        }
        net.publishMatchStart({
          matchId,
          mapId,
          modeId,
          team,
          roster,
        });
        net.attachMatch(matchId, true);
      } else if (netMode && !hostNow) {
        // Non-host Deploy must not start a solo offline match — wait for host start
        mmLaunching = false;
        if ($('mm-status')) $('mm-status').textContent = 'WAITING FOR HOST';
        if ($('mm-sub')) {
          $('mm-sub').textContent = iAmDev()
            ? 'DEV: claim host failed — retry Deploy'
            : 'Only the lobby host can Deploy. Hang tight…';
        }
        toast('Waiting for lobby host to Deploy…');
        // Restart hello clock bits if needed
        if (!mmHelloTimer && net) {
          mmHelloTimer = setInterval(() => net.publishHello(), 3000);
        }
        return;
      }
    }

    for (const side of ['raiders', 'sentinels']) {
      for (const s of roster[side]) {
        if ((s.kind === 'human' || s.kind === 'you') && s.clientId) {
          netHumans.push({
            clientId: s.clientId,
            username: s.name,
            team: side,
          });
        }
      }
    }

    const delay = fromNetStart ? 200 : 650;
    setTimeout(() => {
      stopMatchmaking(true, { preserveMatch: !!matchId });
      game.startMatch({
        team,
        mapId,
        modeId,
        roster,
        net: net && matchId ? {
          enabled: true,
          matchId,
          isHost: !!net.isMatchHost,
          humans: netHumans,
          clientId: net.clientId,
        } : null,
      });
    }, delay);
  }

  function onLobbyMessage(msg) {
    if (!msg) return;
    if (msg.type === 'hello' && msg.data) {
      const d = msg.data;
      if (!d.clientId) return;
      mmLobbyMembers.set(d.clientId, {
        clientId: d.clientId,
        username: d.username || 'Operator',
        team: d.team === TEAMS.SENTINELS ? TEAMS.SENTINELS : TEAMS.RAIDERS,
      });
      net?.electLobbyHost?.();
      updateMmDeployLabel();
      if (net?.isLobbyHost) {
        rebuildRosterFromMembers();
        publishHostLobbyState();
        const n = mmLobbyMembers.size;
        if ($('mm-sub')) {
          $('mm-sub').textContent = n > 1
            ? `${n} live operators in lobby — you are HOST · Deploy when ready`
            : 'Waiting for other operators on this theater…';
        }
        if ($('mm-status') && n > 1) $('mm-status').textContent = 'LIVE LOBBY · HOST';
      } else if ($('mm-sub')) {
        const n = mmLobbyMembers.size;
        $('mm-sub').textContent = n > 1
          ? `${n} operators linked — waiting for host Deploy`
          : 'Joined theater lobby — waiting for host…';
        if ($('mm-status') && n > 1) $('mm-status').textContent = 'LIVE LOBBY';
      }
    } else if (msg.type === 'state' && msg.data && !net?.isLobbyHost) {
      const d = msg.data;
      if (typeof d.secondsLeft === 'number') {
        mmSecondsLeft = d.secondsLeft;
        if ($('mm-countdown')) $('mm-countdown').textContent = formatMmClock(mmSecondsLeft);
      }
      if (d.roster?.raiders && d.roster?.sentinels) {
        mmRoster = {
          raiders: d.roster.raiders.map((s) => ({ ...s })),
          sentinels: d.roster.sentinels.map((s) => ({ ...s })),
        };
        // Mark local seat as you
        for (const side of ['raiders', 'sentinels']) {
          mmRoster[side] = mmRoster[side].map((s) => (
            s.clientId && s.clientId === net?.clientId
              ? { ...s, kind: 'you' }
              : s
          ));
        }
        renderMmSlots();
      }
      if (Array.isArray(d.members)) {
        mmLobbyMembers = new Map(d.members.map((m) => [m.clientId, m]));
      }
      const n = humanCountInRoster();
      if ($('mm-status')) {
        $('mm-status').textContent = n > 1 ? 'LIVE LOBBY' : 'SEARCHING FOR OPERATORS';
      }
      if ($('mm-sub') && n > 1) {
        $('mm-sub').textContent = `${n} operators locked in — host controls the clock`;
      }
    } else if (msg.type === 'start' && msg.data) {
      // Host already launching; also ignore MQTT echo after attachMatch clears isLobbyHost
      if (net?.isLobbyHost || mmLaunching) return;
      launchMatchFromMm(msg.data);
    }
  }

  function startMatchmaking(team) {
    stopMatchmaking(false);
    mmTeam = team;
    mmSecondsLeft = MM_WAIT_SEC;
    mmRoster = blankRoster(team);
    mmLobbyMembers = new Map();
    mmLaunching = false;
    $('team-pick')?.classList.add('hidden');
    $('team-matchmaking')?.classList.remove('hidden');
    if ($('mm-status')) $('mm-status').textContent = 'SEARCHING FOR OPERATORS';
    if ($('mm-countdown')) $('mm-countdown').textContent = formatMmClock(mmSecondsLeft);
    renderMmSlots();
    SFX.ui();

    mmNetMode = !!(net?.connected);
    if (mmNetMode) {
      const { isHost } = net.enterSearch({ mapId: opsMap, modeId: opsMode, team });
      mmLobbyMembers.set(net.clientId, {
        clientId: net.clientId,
        username: callsign(),
        team,
      });
      unsubLobby = net.on('lobby', onLobbyMessage);
      if (!unsubChat) {
        unsubChat = net.on('chat', (data) => {
          if (!data || data.clientId === net?.clientId) return;
          pushChat(data);
        });
      }
      net.publishHello();
      mmHelloTimer = setInterval(() => {
        net.electLobbyHost?.();
        net.publishHello();
        updateMmDeployLabel();
        if (net.isLobbyHost) publishHostLobbyState();
      }, 2500);
      if (isHost || net.isLobbyHost) {
        rebuildRosterFromMembers();
        publishHostLobbyState();
      }
      updateMmDeployLabel();
      if ($('mm-sub')) {
        $('mm-sub').textContent = (isHost || net.isLobbyHost)
          ? 'Live relay up — shared theater lobby · you may be HOST'
          : 'Joining shared theater lobby — wait for host Deploy';
      }
    } else if ($('mm-sub')) {
      $('mm-sub').textContent = team === TEAMS.RAIDERS
        ? 'Offline search — Raiders locked. AI will fill empty seats…'
        : 'Offline search — Sentinels locked. AI will fill empty seats…';
    }

    mmTimer = setInterval(() => {
      // Host (or offline) owns the countdown
      if (!mmNetMode || net?.isLobbyHost) {
        mmSecondsLeft -= 1;
        if (mmSecondsLeft > 3 && mmSecondsLeft % 7 === 0) tryFakeJoin();
        if (mmNetMode && net?.isLobbyHost) publishHostLobbyState();
        if (mmSecondsLeft <= 0) {
          launchMatchFromMm();
          return;
        }
      }
      if ($('mm-countdown')) $('mm-countdown').textContent = formatMmClock(mmSecondsLeft);
    }, 1000);
  }

  function showScreen(name) {
    Object.entries(screens).forEach(([k, el]) => {
      if (el) el.classList.toggle('active', k === name);
    });
    if (net) {
      if (name === 'menu') net.setStatus('menu', {});
      else if (name === 'ops') net.setStatus('ops', { mapId: opsMap, modeId: opsMode });
    }
  }

  function hideAllScreens() {
    Object.values(screens).forEach((el) => el?.classList.remove('active'));
  }

  function refreshMeta() {
    const w = formatMoney(inventory.wallet);
    if ($('menu-wallet')) {
      const p = inventory.profile || {};
      const lvl = p.level || 1;
      $('menu-wallet').textContent = iAmDev()
        ? `BANK ${w} · LV ${lvl} · DEV`
        : `BANK ${w} · LV ${lvl}`;
    }
    if ($('shop-wallet')) $('shop-wallet').textContent = w;
    if ($('inv-wallet')) $('inv-wallet').textContent = w;
    if ($('menu-callsign')) {
      $('menu-callsign').textContent = iAmDev() ? `${callsign()} · DEV ADMIN` : callsign();
    }
    $('dev-badge')?.classList.toggle('hidden', !iAmDev());
  }

  function closeTrivia(result) {
    $('trivia-modal')?.classList.add('hidden');
    triviaBusy = false;
    const resolve = triviaResolver;
    triviaResolver = null;
    if (resolve) resolve(!!result);
  }

  /**
   * Modal Catholic Trivia quiz.
   * @returns {Promise<boolean>} whether the player met the pass threshold
   */
  function askTrivia({
    count = 1,
    passNeed = null,
    title = 'CATHOLIC TRIVIA',
    reason = '',
    kicker = 'CATHOLIC TRIVIA',
    cancellable = true,
  } = {}) {
    if (isTriviaSkipped() || iAmDev()) return Promise.resolve(true);
    if (triviaBusy) return Promise.resolve(false);
    const questions = pickTriviaQuestions(count);
    const need = passNeed ?? defaultPassNeed(questions.length);
    let index = 0;
    let correct = 0;
    let locked = false;

    triviaBusy = true;
    game.input?.exitLock?.();

    const modal = $('trivia-modal');
    const choicesEl = $('trivia-choices');
    const feedback = $('trivia-feedback');
    if (!modal || !choicesEl) return Promise.resolve(true);

    if ($('trivia-kicker')) $('trivia-kicker').textContent = kicker;
    if ($('trivia-title')) $('trivia-title').textContent = title;
    if ($('trivia-reason')) $('trivia-reason').textContent = reason || `Need ${need} of ${questions.length} correct.`;
    if ($('btn-trivia-cancel')) {
      $('btn-trivia-cancel').classList.toggle('hidden', !cancellable);
      $('btn-trivia-cancel').onclick = () => {
        SFX.ui();
        closeTrivia(false);
      };
    }

    modal.classList.remove('hidden');
    feedback?.classList.add('hidden');

    function paintProgress() {
      if ($('trivia-progress-label')) {
        $('trivia-progress-label').textContent = `${Math.min(index + 1, questions.length)} / ${questions.length}`;
      }
      if ($('trivia-score-label')) {
        $('trivia-score-label').textContent = `${correct} correct · need ${need}`;
      }
      if ($('trivia-progress-fill')) {
        const pct = (index / questions.length) * 100;
        $('trivia-progress-fill').style.width = `${pct}%`;
      }
    }

    function showQuestion() {
      locked = false;
      paintProgress();
      const item = questions[index];
      if ($('trivia-question')) $('trivia-question').textContent = item.q;
      feedback?.classList.add('hidden');
      choicesEl.innerHTML = '';
      item.choices.forEach((label, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        btn.onclick = () => onPick(i, btn);
        choicesEl.appendChild(btn);
      });
    }

    function onPick(choiceIndex, btn) {
      if (locked) return;
      locked = true;
      const item = questions[index];
      const ok = choiceIndex === item.answer;
      choicesEl.querySelectorAll('button').forEach((b, i) => {
        b.disabled = true;
        if (i === item.answer) b.classList.add('correct');
        else if (b === btn && !ok) b.classList.add('wrong');
      });
      if (ok) {
        correct += 1;
        SFX.ui();
        if (feedback) {
          feedback.textContent = item.note || 'Correct.';
          feedback.classList.remove('hidden', 'bad');
        }
      } else {
        SFX.hit();
        if (feedback) {
          feedback.textContent = `Not quite. Answer: ${item.choices[item.answer]}${item.note ? ` — ${item.note}` : ''}`;
          feedback.classList.remove('hidden');
          feedback.classList.add('bad');
        }
      }
      paintProgress();
      setTimeout(() => {
        index += 1;
        if (index >= questions.length) {
          const passed = correct >= need;
          if ($('trivia-progress-fill')) $('trivia-progress-fill').style.width = '100%';
          closeTrivia(passed);
          return;
        }
        showQuestion();
      }, ok ? 650 : 1100);
    }

    showQuestion();

    return new Promise((resolve) => {
      triviaResolver = resolve;
    });
  }

  function renderOnlinePanel(list) {
    const ul = $('online-list');
    const count = $('online-count');
    const hint = $('online-hint');
    const label = $('menu-online-label');
    if (!ul) return;
    const others = (list || []).filter((p) => p.clientId !== net?.clientId);
    const total = others.length + (net?.connected ? 1 : 0);
    if (count) count.textContent = String(total);
    ul.innerHTML = '';
    const rows = net?.connected
      ? [{ username: callsign(), status: 'you', clientId: net.clientId }, ...others]
      : others;
    for (const p of rows.slice(0, 12)) {
      const li = document.createElement('li');
      const st = p.clientId === net?.clientId ? 'you' : (p.status || 'online');
      li.innerHTML = `<span>${p.username}</span><em class="st-${st}">${st === 'you' ? 'YOU' : String(st).toUpperCase()}</em>`;
      ul.appendChild(li);
    }
    if (hint) {
      if (!net?.connected) hint.textContent = 'Relay offline — solo / AI matchmaking available.';
      else if (others.length === 0) hint.textContent = 'You are alone online. Open this page on another device/browser to co-op.';
      else hint.textContent = 'Deploy into the same map & mode to share a live lobby.';
    }
    if (label) {
      label.textContent = net?.connected
        ? `ONLINE · ${total} OPERATOR${total === 1 ? '' : 'S'}`
        : 'OFFLINE · LOCAL PLAY';
    }
  }

  function wireAuth() {
    const createPanel = $('auth-create-panel');
    const loginPanel = $('auth-login-panel');
    const existing = getAccount();

    if (existing) {
      createPanel?.classList.add('hidden');
      loginPanel?.classList.remove('hidden');
      if ($('auth-login-user')) $('auth-login-user').value = existing.username;
      if (!existing.passHash) {
        $('auth-login-pass-wrap')?.classList.add('hidden');
      }
    } else {
      createPanel?.classList.remove('hidden');
      loginPanel?.classList.add('hidden');
    }

    const showErr = (id, msg) => {
      const el = $(id);
      if (!el) return;
      el.textContent = msg || '';
      el.classList.toggle('hidden', !msg);
    };

    $('btn-auth-create')?.addEventListener('click', async () => {
      showErr('auth-create-error', '');
      const res = await createAccount(
        $('auth-create-user')?.value,
        $('auth-create-pass')?.value
      );
      if (!res.ok) {
        showErr('auth-create-error', res.reason);
        return;
      }
      inventory.setCallsign(res.account.username);
      SFX.ui();
      await finishAuth(res.account);
    });

    $('btn-auth-login')?.addEventListener('click', async () => {
      showErr('auth-login-error', '');
      const res = await loginAccount(
        $('auth-login-user')?.value,
        $('auth-login-pass')?.value
      );
      if (!res.ok) {
        showErr('auth-login-error', res.reason);
        return;
      }
      inventory.setCallsign(res.account.username);
      SFX.ui();
      await finishAuth(res.account);
    });

    // Enter key submits
    for (const id of ['auth-create-user', 'auth-create-pass']) {
      $(id)?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') $('btn-auth-create')?.click();
      });
    }
    for (const id of ['auth-login-user', 'auth-login-pass']) {
      $(id)?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') $('btn-auth-login')?.click();
      });
    }
  }

  async function finishAuth(account) {
    if (net) {
      net.account = account;
      try {
        await net.connect();
        toast('Online relay connected');
      } catch (e) {
        console.warn(e);
        toast('Playing offline — relay unavailable');
      }
    }
    inventory.setCallsign(account.username);
    refreshMeta();
    renderOnlinePanel(net?.onlineOperators?.() || []);
    paintChatEmojis();
    if (isDevName(account.username)) {
      toast('DEV privileges online — full admin, chat, match control', 3200);
    }
    showScreen('menu');
  }

  function gateAuthOrMenu() {
    wireAuth();
    if (isLoggedIn() && hasAccount()) {
      const acc = getAccount();
      inventory.setCallsign(acc.username);
      finishAuth(acc);
    } else {
      showScreen('auth');
    }
  }

  function renderBuyVote() {
    const el = $('buy-vote');
    if (!el) return;
    const humans = game.netHumans?.length || 0;
    const show = game.running && game.phase === 'buy' && humans >= 2;
    el.classList.toggle('hidden', !show);
    if (!show) return;
    const votes = game.buyVotes || {};
    const tallies = {};
    for (const v of Object.values(votes)) {
      tallies[v] = (tallies[v] || 0) + 1;
    }
    const parts = BUY_VOTE_OPTIONS.map((sec) => {
      const n = tallies[sec] || 0;
      return n ? `${formatMmClock(sec)}×${n}` : null;
    }).filter(Boolean);
    if ($('buy-vote-status')) {
      const mine = myBuyVote ? `You voted ${formatMmClock(myBuyVote)}. ` : '';
      $('buy-vote-status').textContent = mine + (parts.length ? parts.join(' · ') : 'Waiting for votes…');
    }
    $('buy-vote-opts')?.querySelectorAll('button').forEach((btn) => {
      const sec = Number(btn.dataset.sec);
      btn.classList.toggle('selected', myBuyVote === sec);
    });
  }

  function wireBuyVote() {
    $('buy-vote-opts')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-sec]');
      if (!btn) return;
      const sec = Number(btn.dataset.sec);
      if (!BUY_VOTE_OPTIONS.includes(sec)) return;
      myBuyVote = sec;
      game.castBuyVote?.(sec);
      SFX.ui();
      renderBuyVote();
      toast(`Voted for ${formatMmClock(sec)} buy phase`);
    });
  }

  // —— Menu ——
  wireBuyVote();
  gateAuthOrMenu();

  if (net) {
    net.on('presence', (list) => renderOnlinePanel(list));
    net.on('connection', () => renderOnlinePanel(net.onlineOperators()));
  }

  const robloxChk = $('chk-roblox-look');
  if (robloxChk) {
    robloxChk.checked = game.input?.lookMode === 'roblox';
    robloxChk.onchange = () => {
      const mode = robloxChk.checked ? 'roblox' : 'default';
      game.input?.setLookMode?.(mode);
      SFX.ui();
      toast(mode === 'roblox' ? 'Roblox look on — hold RMB to turn' : 'Classic mouse look on');
    };
  }

  const lowPolyChk = $('chk-low-poly');
  if (lowPolyChk) {
    // Prefer live game quality; fall back to saved preset (UI boots before Game exists).
    const savedLow = getGraphicsPreset() === 'low';
    lowPolyChk.checked = !!(game.quality?.low || game.quality?.preset === 'low' || savedLow);
    lowPolyChk.onchange = () => {
      const preset = setGraphicsPreset(lowPolyChk.checked ? 'low' : 'high');
      const q = game.setGraphicsQuality?.(preset);
      SFX.ui();
      toast(q?.low || preset === 'low'
        ? 'Low poly on — lighter map & effects'
        : 'Ultra graphics on — rebuilt battlefield');
    };
  }

  $('btn-play').onclick = async () => {
    SFX.ui();
    const ok = await askTrivia({
      count: 5,
      passNeed: 4,
      title: 'PRE-DEPLOY CATECHESIS',
      reason: 'Answer five Catholic Trivia questions before operations. You need at least four correct to deploy.',
      kicker: 'CATHOLIC TRIVIA',
      cancellable: true,
    });
    if (!ok) {
      toast('Deploy locked — take the catechesis again when ready');
      return;
    }
    toast('Catechesis passed — choose your operation');
    renderOps();
    showScreen('ops');
  };
  $('btn-howto').onclick = () => { SFX.ui(); showScreen('howto'); };
  $('btn-howto-back').onclick = () => { SFX.ui(); showScreen('menu'); };
  $('btn-ops-back').onclick = () => { SFX.ui(); showScreen('menu'); };
  $('btn-team-back').onclick = () => {
    SFX.ui();
    stopMatchmaking(true);
    renderOps();
    showScreen('ops');
  };
  $('btn-ops-continue').onclick = () => {
    SFX.ui();
    const mode = MODES[opsMode] || MODES.strike;
    if (!isMapUnlocked(opsMap, inventory.profile) || !isModeUnlocked(opsMode, inventory.profile)) {
      toast('Selection locked');
      return;
    }
    inventory.setOps(opsMap, opsMode);
    if (mode.teams) {
      stopMatchmaking(true);
      showScreen('team');
    } else {
      game.startMatch({ team: TEAMS.RAIDERS, mapId: opsMap, modeId: opsMode });
    }
  };
  $('pick-raiders').onclick = () => startMatchmaking(TEAMS.RAIDERS);
  $('pick-sentinels').onclick = () => startMatchmaking(TEAMS.SENTINELS);
  $('btn-mm-cancel').onclick = () => {
    SFX.ui();
    stopMatchmaking(true);
  };
  $('btn-mm-deploy').onclick = () => {
    SFX.ui();
    if (mmNetMode && net && !net.isLobbyHost && !iAmDev()) {
      toast('Only the lobby host can Deploy — hang tight for the start signal');
      updateMmDeployLabel();
      return;
    }
    if (mmNetMode && iAmDev() && net && !net.isLobbyHost) {
      net.forceLobbyHost?.();
      toast('DEV forced lobby host');
    }
    launchMatchFromMm();
  };
  $('btn-buy-close').onclick = () => game.closeBuyMenu();

  // Chat panel
  paintChatEmojis();
  $('btn-chat-send')?.addEventListener('click', () => submitChat());
  $('btn-chat-close')?.addEventListener('click', () => closeChat(true));
  $('chat-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitChat();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeChat(true);
    }
  });
  $('btn-become-dev')?.addEventListener('click', async () => {
    SFX.ui();
    const res = await renameAccount('DEV');
    if (!res.ok) {
      toast(res.reason || 'Could not set DEV');
      return;
    }
    if (net) net.account = res.account;
    inventory.setCallsign('DEV');
    refreshMeta();
    toast('Callsign is now DEV — full admin unlocked. Reload if multiplayer was mid-match.');
  });

  function renderOps() {
    const profile = inventory.profile || {};
    const wins = inventory.data?.stats?.wins || 0;
    const prog = xpProgress(profile.xp || 0);
    if ($('ops-rank')) $('ops-rank').textContent = `LEVEL ${prog.level} · ${wins} WINS`;
    if ($('ops-xp-fill')) {
      const pct = prog.need > 0 ? Math.min(100, (prog.into / prog.need) * 100) : 100;
      $('ops-xp-fill').style.width = `${pct}%`;
    }
    if ($('ops-xp-label')) $('ops-xp-label').textContent = `${prog.into} / ${prog.need}`;

    if (!isMapUnlocked(opsMap, profile)) opsMap = 'ironfront';
    if (!isModeUnlocked(opsMode, profile)) opsMode = 'strike';

    const mapsEl = $('ops-maps');
    mapsEl.innerHTML = '';
    for (const map of Object.values(MAPS)) {
      const unlocked = isMapUnlocked(map.id, profile);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `ops-card map-${map.id}${opsMap === map.id ? ' selected' : ''}${unlocked ? '' : ' locked'}`;
      card.disabled = !unlocked;
      const lock = unlocked
        ? ''
        : `<span class="ops-lock">WIN ${map.winsRequired}</span>`;
      card.innerHTML = `
        <span class="ops-card-glow" style="background:radial-gradient(ellipse at center, ${map.accent}59, transparent 70%)"></span>
        <span class="ops-card-tag">${map.theme.toUpperCase()}</span>
        <strong>${map.name}</strong>
        <p>${map.blurb}</p>
        ${lock}
      `;
      card.onclick = () => {
        if (!unlocked) return;
        SFX.ui();
        opsMap = map.id;
        renderOps();
      };
      mapsEl.appendChild(card);
    }

    const modesEl = $('ops-modes');
    modesEl.innerHTML = '';
    for (const mode of Object.values(MODES)) {
      const unlocked = isModeUnlocked(mode.id, profile);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `ops-card mode-${mode.id}${opsMode === mode.id ? ' selected' : ''}${unlocked ? '' : ' locked'}`;
      card.disabled = !unlocked;
      const lock = unlocked
        ? ''
        : `<span class="ops-lock">LV ${mode.levelRequired}</span>`;
      card.innerHTML = `
        <span class="ops-card-tag">${mode.freeRoam ? 'SOLO' : mode.teams ? 'TEAM' : 'SOLO'}</span>
        <strong>${mode.name}</strong>
        <p>${mode.blurb}</p>
        ${lock}
      `;
      card.onclick = () => {
        if (!unlocked) return;
        SFX.ui();
        opsMode = mode.id;
        renderOps();
      };
      modesEl.appendChild(card);
    }

    const mapName = MAPS[opsMap]?.name || opsMap;
    const modeName = MODES[opsMode]?.name || opsMode;
    if ($('ops-summary')) $('ops-summary').textContent = `${mapName} · ${modeName}`;
  }

  $('btn-shop').onclick = () => {
    SFX.ui();
    shopTab = 'cases';
    renderShop();
    showScreen('shop');
  };
  $('btn-shop-back').onclick = () => { SFX.ui(); refreshMeta(); showScreen('menu'); };

  $('btn-inventory').onclick = () => {
    SFX.ui();
    invTab = 'vehicles';
    selectedInv = null;
    renderInventory();
    showScreen('inventory');
  };
  $('btn-inv-back').onclick = () => { SFX.ui(); refreshMeta(); showScreen('menu'); };

  document.querySelectorAll('[data-shop-tab]').forEach((btn) => {
    btn.onclick = () => {
      shopTab = btn.dataset.shopTab;
      document.querySelectorAll('[data-shop-tab]').forEach((b) => b.classList.toggle('active', b === btn));
      SFX.ui();
      renderShop();
    };
  });

  document.querySelectorAll('[data-inv-tab]').forEach((btn) => {
    btn.onclick = () => {
      invTab = btn.dataset.invTab;
      selectedInv = null;
      document.querySelectorAll('[data-inv-tab]').forEach((b) => b.classList.toggle('active', b === btn));
      SFX.ui();
      renderInventory();
    };
  });

  function offerAdPurchase(offer) {
    pendingAdOffer = offer;
    const modal = $('ad-modal');
    if (!modal) {
      toast(offer.reason || 'Not enough credits');
      return;
    }
    const left = inventory.adsLeft();
    $('ad-modal-title').textContent = offer.title || 'Watch an ad to buy?';
    $('ad-modal-body').textContent = offer.body
      || `You're short ${formatMoney(offer.shortfall)}. Watch a short ad to get exactly enough.`;
    $('ad-modal-meta').textContent = inventory.canWatchAd()
      ? `Ads left today: ${left} / ${MAX_ADS_PER_DAY}`
      : `Daily limit reached (${MAX_ADS_PER_DAY}/day) — play matches to earn bank.`;
    const watch = $('btn-ad-watch');
    watch.disabled = !inventory.canWatchAd();
    watch.textContent = inventory.canWatchAd() ? 'WATCH AD' : 'LIMIT REACHED';
    modal.classList.remove('hidden');
  }

  function closeAdModal() {
    $('ad-modal')?.classList.add('hidden');
    pendingAdOffer = null;
  }

  $('btn-ad-cancel').onclick = () => {
    SFX.ui();
    closeAdModal();
  };

  $('btn-ad-watch').onclick = async () => {
    if (!pendingAdOffer || !inventory.canWatchAd()) return;
    const offer = pendingAdOffer;
    $('btn-ad-watch').disabled = true;
    $('btn-ad-watch').textContent = 'LOADING…';
    const res = await inventory.watchAdForFunds({
      shortfall: offer.shortfall,
      currency: offer.currency || 'wallet',
      onMatchGrant: offer.onMatchGrant,
    });
    if (!res.ok) {
      toast(res.reason || 'Ad not completed');
      $('btn-ad-watch').disabled = !inventory.canWatchAd();
      $('btn-ad-watch').textContent = inventory.canWatchAd() ? 'WATCH AD' : 'LIMIT REACHED';
      $('ad-modal-meta').textContent = `Ads left today: ${inventory.adsLeft()} / ${MAX_ADS_PER_DAY}`;
      return;
    }
    SFX.buy();
    toast(`+${formatMoney(res.granted)} · ${res.adsLeft} ads left today`);
    closeAdModal();
    if (typeof offer.retry === 'function') offer.retry();
    refreshMeta();
    if (shopTab) renderShop();
  };

  function renderShop() {
    refreshMeta();
    const grid = $('shop-grid');
    grid.innerHTML = '';
    if (shopTab === 'cases') {
      for (const c of Object.values(CASES)) {
        const card = document.createElement('article');
        card.className = 'shop-card';
        card.innerHTML = `
          <div class="shop-art">
            <img src="${c.image}" alt="${c.name}" width="512" height="512" loading="lazy" />
          </div>
          <h3>${c.name}</h3>
          <p>${c.desc}</p>
          <div class="shop-card-foot">
            <strong>${formatMoney(c.price)}</strong>
            <span>Owned: ${inventory.caseCount(c.id)}</span>
          </div>
          <button class="btn btn-primary">BUY CASE</button>
        `;
        card.querySelector('button').onclick = async () => {
          const short = inventory.wallet < c.price;
          const blessed = await askTrivia({
            count: 1,
            title: short ? 'ALMS FOR THE ARMORY' : 'ARMORY BLESSING',
            reason: short
              ? `Short ${formatMoney(c.price - inventory.wallet)} for ${c.name}. Answer correctly for alms.`
              : `Bless the purchase of ${c.name}.`,
          });
          if (!blessed) {
            toast('Purchase withheld — faith check failed');
            if (short) {
              offerAdPurchase({
                shortfall: c.price - inventory.wallet,
                currency: 'wallet',
                title: `Need ${formatMoney(c.price - inventory.wallet)} more`,
                body: `Watch an ad to afford the ${c.name}.`,
                retry: () => {
                  const r2 = inventory.buyCase(c.id);
                  if (r2.ok) { SFX.buy(); toast(`Purchased ${c.name}`); }
                  else toast(r2.reason);
                  renderShop();
                },
              });
            }
            return;
          }
          if (inventory.wallet < c.price) {
            const shortfall = c.price - inventory.wallet;
            inventory.data.wallet += shortfall;
            inventory.persist?.();
            toast(`Alms +${formatMoney(shortfall)}`);
          }
          const res = inventory.buyCase(c.id);
          if (!res.ok) toast(res.reason);
          else { SFX.buy(); toast(`Purchased ${c.name}`); }
          renderShop();
        };
        grid.appendChild(card);
      }
    } else if (shopTab === 'keys') {
      for (const k of Object.values(KEYS)) {
        const card = document.createElement('article');
        card.className = 'shop-card';
        card.innerHTML = `
          <div class="shop-art">
            <img src="${k.image}" alt="${k.name}" width="512" height="512" loading="lazy" />
          </div>
          <h3>${k.name}</h3>
          <p>${k.desc}</p>
          <div class="shop-card-foot">
            <strong>${formatMoney(k.price)}</strong>
            <span>Owned: ${inventory.keyCount(k.id)}</span>
          </div>
          <button class="btn btn-primary">BUY KEY</button>
        `;
        card.querySelector('button').onclick = async () => {
          const short = inventory.wallet < k.price;
          const blessed = await askTrivia({
            count: 1,
            title: short ? 'ALMS FOR THE ARMORY' : 'ARMORY BLESSING',
            reason: short
              ? `Short ${formatMoney(k.price - inventory.wallet)} for ${k.name}. Answer correctly for alms.`
              : `Bless the purchase of ${k.name}.`,
          });
          if (!blessed) {
            toast('Purchase withheld — faith check failed');
            if (short) {
              offerAdPurchase({
                shortfall: k.price - inventory.wallet,
                currency: 'wallet',
                title: `Need ${formatMoney(k.price - inventory.wallet)} more`,
                body: `Watch an ad to afford the ${k.name}.`,
                retry: () => {
                  const r2 = inventory.buyKey(k.id);
                  if (r2.ok) { SFX.buy(); toast(`Purchased ${k.name}`); }
                  else toast(r2.reason);
                  renderShop();
                },
              });
            }
            return;
          }
          if (inventory.wallet < k.price) {
            const shortfall = k.price - inventory.wallet;
            inventory.data.wallet += shortfall;
            inventory.persist?.();
            toast(`Alms +${formatMoney(shortfall)}`);
          }
          const res = inventory.buyKey(k.id);
          if (!res.ok) toast(res.reason);
          else { SFX.buy(); toast(`Purchased ${k.name}`); }
          renderShop();
        };
        grid.appendChild(card);
      }
    } else {
      // Skins shop — buy paints separately (for craft you already unlocked)
      const ownedVids = new Set(inventory.ownedVehicleList().map((v) => v.id));
      const list = shopSkinCatalog().filter(
        (s) => ownedVids.has(s.vehicleId) && !(inventory.data.skins[s.id] > 0)
      );
      // Prefer showing a mix of rarities / vehicles
      for (const s of list) {
        const card = document.createElement('article');
        card.className = 'shop-card';
        card.innerHTML = `
          <div class="shop-art">
            <img src="${skinImg(s)}" alt="${s.name}" width="512" height="512" loading="lazy" />
          </div>
          <h3>${s.shortName}</h3>
          <p style="color:${rarityColor(s.rarity)}">${RARITY[s.rarity]?.label || ''} · ${VEHICLES[s.vehicleId]?.name || ''}</p>
          <div class="shop-card-foot">
            <strong>${formatMoney(s.price)}</strong>
            <span>Paint kit</span>
          </div>
          <button class="btn btn-primary">BUY SKIN</button>
        `;
        card.querySelector('button').onclick = async () => {
          const short = inventory.wallet < s.price;
          const blessed = await askTrivia({
            count: 1,
            title: short ? 'ALMS FOR THE ARMORY' : 'ARMORY BLESSING',
            reason: short
              ? `Short ${formatMoney(s.price - inventory.wallet)} for ${s.shortName}. Answer correctly for alms.`
              : `Bless the purchase of ${s.shortName}.`,
          });
          if (!blessed) {
            toast('Purchase withheld — faith check failed');
            if (short) {
              offerAdPurchase({
                shortfall: s.price - inventory.wallet,
                currency: 'wallet',
                title: `Need ${formatMoney(s.price - inventory.wallet)} more`,
                body: `Watch an ad to buy ${s.name}.`,
                retry: () => {
                  const r2 = inventory.buySkin(s.id);
                  if (r2.ok) { SFX.buy(); toast(`Purchased ${s.shortName}`); }
                  else toast(r2.reason);
                  renderShop();
                },
              });
            }
            return;
          }
          if (inventory.wallet < s.price) {
            const shortfall = s.price - inventory.wallet;
            inventory.data.wallet += shortfall;
            inventory.persist?.();
            toast(`Alms +${formatMoney(shortfall)}`);
          }
          const res = inventory.buySkin(s.id);
          if (!res.ok) toast(res.reason);
          else { SFX.buy(); toast(`Purchased ${s.shortName}`); }
          renderShop();
        };
        grid.appendChild(card);
      }
      if (!list.length) {
        grid.innerHTML = '<p class="muted" style="padding:1rem">You own every listed paint kit. New finishes appear as the catalog grows.</p>';
      }
    }
  }

  function renderInventory() {
    refreshMeta();
    const grid = $('inv-grid');
    const detail = $('inv-detail');
    grid.innerHTML = '';

    if (invTab === 'vehicles') {
      const owned = inventory.ownedVehicleList();
      for (const v of owned) {
        const eq = inventory.getEquippedFleet(v.domain)?.id === v.id;
        const el = document.createElement('button');
        el.className = `inv-item${selectedInv === v.id ? ' selected' : ''}${eq ? ' equipped' : ''}`;
        el.style.setProperty('--rarity', rarityColor(v.rarity || 'milspec'));
        el.innerHTML = `
          <img class="inv-swatch" src="${vehicleImg(v)}" alt="${v.name}" width="256" height="256" loading="lazy" />
          <strong>${v.name}</strong>
          <span>${v.className} · ${v.domain.toUpperCase()}</span>
          <em>${RARITY[v.rarity || 'milspec']?.label || ''}${eq ? ' · EQUIPPED' : ''}</em>
        `;
        el.onclick = () => {
          selectedInv = v.id;
          renderInventory();
        };
        grid.appendChild(el);
      }

      if (selectedInv && VEHICLES[selectedInv] && inventory.ownsVehicle(selectedInv)) {
        const v = VEHICLES[selectedInv];
        const skin = inventory.getEquipped(v.id);
        detail.innerHTML = `
          <span style="color:${rarityColor(v.rarity || 'milspec')}">${RARITY[v.rarity || 'milspec']?.label || ''}</span>
          <h3>${v.name}</h3>
          <img class="inv-swatch-lg" src="${vehicleImg(v)}" alt="${v.name}" width="256" height="256" />
          <p class="muted">${v.desc}</p>
          <div class="stat-row"><span>Class</span><strong>${v.className}</strong></div>
          <div class="stat-row"><span>Domain</span><strong>${v.domain.toUpperCase()}</strong></div>
          <div class="stat-row"><span>Paint</span><strong style="color:${rarityColor(skin.rarity)}">${skin.shortName}</strong></div>
          <div class="stat-row"><span>Damage</span><strong>${v.damage}</strong></div>
          <div class="stat-row"><span>Speed</span><strong>${v.speed}</strong></div>
          <button class="btn btn-primary" style="width:100%;margin-top:1rem" id="btn-equip-fleet">EQUIP ${v.domain.toUpperCase()} SLOT</button>
        `;
        $('btn-equip-fleet').onclick = () => {
          const res = inventory.equipFleet(v.id);
          if (!res.ok) toast(res.reason);
          else { SFX.buy(); toast(`Equipped ${v.name}`); }
          renderInventory();
        };
      } else {
        detail.innerHTML = '<p class="muted">Select a craft to equip into your land / sea / air fleet slot</p>';
      }
    } else if (invTab === 'skins') {
      const owned = inventory.ownedSkins();
      const defaults = Object.values(SKINS)
        .filter((s) => s.isDefault && inventory.ownsVehicle(s.vehicleId))
        .map((s) => ({ skin: s, count: 1, isDefault: true }));
      const list = [...owned, ...defaults];
      for (const row of list) {
        const s = row.skin;
        const equipped = inventory.getEquipped(s.vehicleId)?.id === s.id;
        const el = document.createElement('button');
        el.className = `inv-item${selectedInv === s.id ? ' selected' : ''}${equipped ? ' equipped' : ''}${row.isDefault ? ' is-stock' : ''}`;
        el.style.setProperty('--rarity', rarityColor(s.rarity));
        el.innerHTML = `
          <img class="inv-swatch" src="${skinImg(s)}" alt="${s.name}" width="256" height="256" loading="lazy" />
          <strong>${s.shortName}</strong>
          <span>${VEHICLES[s.vehicleId]?.name || ''} · ${RARITY[s.rarity]?.label || ''}</span>
          <em>${row.isDefault ? 'STOCK' : `x${row.count}`}${equipped ? ' · EQUIPPED' : ''}</em>
        `;
        el.onclick = () => {
          selectedInv = s.id;
          renderInventory();
        };
        grid.appendChild(el);
      }

      if (selectedInv && SKINS[selectedInv]) {
        const s = SKINS[selectedInv];
        detail.innerHTML = `
          <span style="color:${rarityColor(s.rarity)}">${RARITY[s.rarity].label}</span>
          <h3>${s.name}</h3>
          <img class="inv-swatch-lg" src="${skinImg(s)}" alt="${s.name}" width="256" height="256" />
          <div class="stat-row"><span>Vehicle</span><strong>${VEHICLES[s.vehicleId]?.name}</strong></div>
          <div class="stat-row"><span>Pattern</span><strong>${(s.pattern || 'solid').toUpperCase()}</strong></div>
          <div class="stat-row"><span>Sell value</span><strong>${formatMoney(s.sellPrice)}</strong></div>
          <button class="btn btn-primary" style="width:100%;margin-top:1rem" id="btn-equip-skin">EQUIP PAINT</button>
          ${s.isDefault ? '' : '<button class="btn btn-ghost" style="width:100%;margin-top:0.5rem" id="btn-sell-skin">SELL TO ARMORY</button>'}
        `;
        $('btn-equip-skin').onclick = () => {
          inventory.equip(s.id);
          SFX.buy();
          toast(`Equipped ${s.shortName}`);
          renderInventory();
        };
        const sellBtn = $('btn-sell-skin');
        if (sellBtn) {
          sellBtn.onclick = () => {
            const res = inventory.sellSkin(s.id);
            if (!res.ok) toast(res.reason);
            else {
              SFX.ui();
              toast(`Sold for ${formatMoney(res.gained)}`);
              selectedInv = null;
              renderInventory();
            }
          };
        }
      } else {
        detail.innerHTML = '<p class="muted">Buy skins in the Armory, then equip them here</p>';
      }
    } else if (invTab === 'cases') {
      for (const c of Object.values(CASES)) {
        const n = inventory.caseCount(c.id);
        const el = document.createElement('button');
        el.className = 'inv-item';
        el.innerHTML = `
          <img class="inv-thumb" src="${c.image}" alt="${c.name}" width="128" height="128" loading="lazy" />
          <strong>${c.name}</strong>
          <span>${c.desc}</span>
          <em>x${n}</em>
        `;
        el.onclick = () => {
          if (n <= 0) { toast('Buy this case in the Armory'); return; }
          openCrateScreen(c.id);
        };
        grid.appendChild(el);
      }
      detail.innerHTML = '<p class="muted">Click a case to unlock fleet craft, warheads, or accessories with a matching key</p>';
    } else if (invTab === 'warheads') {
      const owned = inventory.ownedConsumables();
      const loadout = inventory.data.loadoutConsumables || [];
      for (const row of owned) {
        const item = row.item;
        const equipped = loadout.includes(item.id);
        const el = document.createElement('button');
        el.className = `inv-item${selectedInv === item.id ? ' selected' : ''}${equipped ? ' equipped' : ''}`;
        el.style.setProperty('--rarity', rarityColor(item.rarity));
        el.innerHTML = `
          <img class="inv-swatch" src="${gearImg(item)}" alt="${item.name}" width="256" height="256" loading="lazy" />
          <strong>${item.name}</strong>
          <span>${item.desc}</span>
          <em>x${row.count}${equipped ? ' · MATCH LOADOUT' : ''}</em>
        `;
        el.onclick = () => {
          selectedInv = item.id;
          renderInventory();
        };
        grid.appendChild(el);
      }
      if (!owned.length) {
        grid.innerHTML = '<p class="muted" style="padding:1rem">Open Warheads Cases for ammo, bombs, torpedoes, and landmines. Equip up to 4 for your next match.</p>';
      }
      if (selectedInv && GEAR_ITEMS[selectedInv]?.type === 'consumable') {
        const item = GEAR_ITEMS[selectedInv];
        const equipped = loadout.includes(item.id);
        detail.innerHTML = `
          <span style="color:${rarityColor(item.rarity)}">${RARITY[item.rarity]?.label || ''}</span>
          <h3>${item.name}</h3>
          <img class="inv-swatch-lg" src="${gearImg(item)}" alt="${item.name}" width="256" height="256" />
          <p class="muted">${item.desc}</p>
          <div class="stat-row"><span>Owned</span><strong>x${inventory.itemCount(item.id)}</strong></div>
          <div class="stat-row"><span>Loadout</span><strong>${loadout.length}/4</strong></div>
          <button class="btn btn-primary" style="width:100%;margin-top:1rem" id="btn-equip-warhead">${equipped ? 'REMOVE FROM MATCH' : 'EQUIP FOR MATCH'}</button>
        `;
        $('btn-equip-warhead').onclick = () => {
          inventory.toggleLoadoutConsumable(item.id);
          SFX.buy();
          toast(equipped ? `Removed ${item.shortName}` : `Equipped ${item.shortName} for next match`);
          renderInventory();
        };
      } else {
        detail.innerHTML = '<p class="muted">Equip up to 4 warheads. They are consumed when a match starts.</p>';
      }
    } else if (invTab === 'accessories') {
      const owned = inventory.ownedAccessories();
      for (const item of owned) {
        const el = document.createElement('button');
        el.className = `inv-item${selectedInv === item.id ? ' selected' : ''} equipped`;
        el.style.setProperty('--rarity', rarityColor(item.rarity));
        el.innerHTML = `
          <img class="inv-swatch" src="${gearImg(item)}" alt="${item.name}" width="256" height="256" loading="lazy" />
          <strong>${item.name}</strong>
          <span>${item.desc}</span>
          <em>PERMANENT</em>
        `;
        el.onclick = () => {
          selectedInv = item.id;
          renderInventory();
        };
        grid.appendChild(el);
      }
      if (!owned.length) {
        grid.innerHTML = '<p class="muted" style="padding:1rem">Open Accessories Cases for permanent mods: mine detector, engines, plating, scopes, and more.</p>';
      }
      if (selectedInv && GEAR_ITEMS[selectedInv]?.type === 'accessory') {
        const item = GEAR_ITEMS[selectedInv];
        detail.innerHTML = `
          <span style="color:${rarityColor(item.rarity)}">${RARITY[item.rarity]?.label || ''}</span>
          <h3>${item.name}</h3>
          <img class="inv-swatch-lg" src="${gearImg(item)}" alt="${item.name}" width="256" height="256" />
          <p class="muted">${item.desc}</p>
          <div class="stat-row"><span>Status</span><strong>ALWAYS ON</strong></div>
        `;
      } else {
        detail.innerHTML = '<p class="muted">Accessories unlock permanently and apply automatically in every match.</p>';
      }
    } else {
      for (const k of Object.values(KEYS)) {
        const n = inventory.keyCount(k.id);
        const el = document.createElement('button');
        el.className = 'inv-item';
        el.innerHTML = `
          <img class="inv-thumb" src="${k.image}" alt="${k.name}" width="128" height="128" loading="lazy" />
          <strong>${k.name}</strong>
          <span>${k.desc}</span>
          <em>x${n}</em>
        `;
        el.onclick = () => toast(`Owned: ${n}`);
        grid.appendChild(el);
      }
      detail.innerHTML = '<p class="muted">Keys open matching cases</p>';
    }
  }

  function openCrateScreen(caseId) {
    crateFocus = caseId;
    lastOpenedVehicle = null;
    lastOpenedItem = null;
    lastOpenKind = CASES[caseId]?.kind || 'vehicle';
    reelSpinning = false;
    const c = CASES[caseId];
    const key = KEYS[c.keyId];
    $('crate-title').textContent = c.name;
    const hero = $('crate-hero');
    if (hero) {
      hero.innerHTML = `
        <img class="crate-hero-case" src="${c.image}" alt="${c.name}" />
        <img class="crate-hero-key" src="${key.image}" alt="${key.name}" />
      `;
    }
    $('crate-result').classList.add('hidden');
    $('btn-crate-open').classList.remove('hidden');
    $('btn-crate-open').disabled = !inventory.canOpen(caseId);
    $('btn-crate-open').textContent = inventory.canOpen(caseId)
      ? 'UNLOCK WITH KEY'
      : 'NEED CASE + KEY';
    const equipBtn = $('btn-crate-equip');
    if (equipBtn) {
      if (c.kind === 'item') {
        equipBtn.textContent = c.id === 'accessories_case' ? 'VIEW ACCESSORIES' : 'ADD TO MATCH LOADOUT';
      } else {
        equipBtn.textContent = 'EQUIP TO FLEET';
      }
    }
    buildReelPreview(caseId);
    showScreen('crate');
  }

  function reelThumb(entry, caseId) {
    const c = CASES[caseId];
    if (c?.kind === 'item') {
      return gearImg(entry);
    }
    return vehicleImg(entry);
  }

  function buildReelPreview(caseId) {
    const reel = $('crate-reel');
    reel.style.transition = 'none';
    reel.style.transform = 'translateX(0)';
    reel.innerHTML = '';
    const pool = CASES[caseId].contains().slice().sort(() => Math.random() - 0.5);
    while (pool.length < 40) pool.push(...CASES[caseId].contains());
    pool.slice(0, 48).forEach((v) => {
      const cell = document.createElement('div');
      cell.className = 'reel-cell';
      cell.style.borderBottom = `3px solid ${rarityColor(v.rarity || 'milspec')}`;
      cell.innerHTML = `
        <img src="${reelThumb(v, caseId)}" alt="${v.name}" />
        <span>${v.name}</span>
      `;
      reel.appendChild(cell);
    });
  }

  $('btn-crate-back').onclick = () => {
    if (reelSpinning) return;
    SFX.ui();
    renderInventory();
    showScreen('inventory');
  };

  $('btn-crate-open').onclick = () => {
    if (reelSpinning || !crateFocus) return;
    if (!inventory.canOpen(crateFocus)) {
      toast('Need a matching case and key');
      return;
    }
    const res = inventory.openCase(crateFocus);
    if (!res.ok) { toast(res.reason); return; }
    if (res.kind === 'item') {
      lastOpenedItem = res.item;
      lastOpenedVehicle = null;
      lastOpenKind = 'item';
      animateCrateReveal(res.item, res.duplicate, 'item');
    } else {
      lastOpenedVehicle = res.vehicle;
      lastOpenedItem = null;
      lastOpenKind = 'vehicle';
      animateCrateReveal(res.vehicle, res.duplicate, 'vehicle');
    }
  };

  function animateCrateReveal(prize, duplicate = false, kind = 'vehicle') {
    reelSpinning = true;
    $('btn-crate-open').classList.add('hidden');
    $('crate-result').classList.add('hidden');
    SFX.crateStart();

    const reel = $('crate-reel');
    reel.innerHTML = '';
    const cells = [];
    const pool = CASES[crateFocus].contains();
    for (let i = 0; i < 50; i++) {
      cells.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    const winIndex = 42;
    cells[winIndex] = prize;
    cells.forEach((v) => {
      const cell = document.createElement('div');
      cell.className = 'reel-cell';
      cell.style.borderBottom = `3px solid ${rarityColor(v.rarity || 'milspec')}`;
      cell.innerHTML = `
        <img src="${reelThumb(v, crateFocus)}" alt="${v.name}" />
        <span>${v.name}</span>
      `;
      reel.appendChild(cell);
    });

    const cellW = 120;
    const offset = winIndex * cellW - (reel.parentElement.clientWidth / 2) + cellW / 2;
    requestAnimationFrame(() => {
      reel.style.transition = 'transform 4.2s cubic-bezier(0.12, 0.75, 0.08, 1)';
      reel.style.transform = `translateX(${-offset}px)`;
    });

    setTimeout(() => {
      SFX.crateLand(prize.rarity || 'milspec');
      let badge = RARITY[prize.rarity || 'milspec']?.label || '';
      if (kind === 'item') {
        if (prize.type === 'accessory') {
          badge += duplicate ? ' · DUPLICATE MOD' : ' · NEW ACCESSORY';
        } else {
          badge += ' · WARHEAD';
        }
      } else {
        badge += duplicate ? ' · DUPLICATE' : ' · NEW FLEET CRAFT';
      }
      $('crate-rarity').textContent = badge;
      $('crate-rarity').style.color = rarityColor(prize.rarity || 'milspec');
      $('crate-skin-name').textContent = prize.name;
      const sw = $('crate-swatch');
      sw.style.background = 'transparent';
      sw.style.boxShadow = `0 0 40px ${rarityColor(prize.rarity || 'milspec')}`;
      const imgSrc = kind === 'item' ? gearImg(prize) : vehicleImg(prize);
      sw.innerHTML = `<img src="${imgSrc}" alt="${prize.name}" style="width:100%;height:100%;object-fit:cover" />`;
      $('crate-result').classList.remove('hidden');
      reelSpinning = false;
      refreshMeta();
      if (kind === 'item' && prize.type === 'accessory' && duplicate) {
        toast('Already owned — accessory stays unlocked');
      } else if (kind === 'vehicle' && duplicate) {
        toast('Duplicate — already in your fleet');
      }
    }, 4300);
  }

  $('btn-crate-equip').onclick = () => {
    if (lastOpenKind === 'item' && lastOpenedItem) {
      if (lastOpenedItem.type === 'consumable') {
        const res = inventory.toggleLoadoutConsumable(lastOpenedItem.id);
        if (res.loadout?.includes(lastOpenedItem.id)) {
          SFX.buy();
          toast(`Added ${lastOpenedItem.shortName} to match loadout`);
        } else {
          toast('Removed from loadout or loadout full (max 4)');
        }
      } else {
        invTab = 'accessories';
        selectedInv = lastOpenedItem.id;
        SFX.ui();
        renderInventory();
        showScreen('inventory');
      }
      return;
    }
    if (!lastOpenedVehicle) return;
    inventory.equipFleet(lastOpenedVehicle.id);
    SFX.buy();
    toast(`Equipped ${lastOpenedVehicle.name}`);
  };

  $('btn-crate-done').onclick = () => {
    SFX.ui();
    if (lastOpenKind === 'item') {
      invTab = lastOpenedItem?.type === 'accessory' ? 'accessories' : 'warheads';
      selectedInv = lastOpenedItem?.id || null;
    } else {
      invTab = 'vehicles';
      selectedInv = lastOpenedVehicle?.id || null;
    }
    renderInventory();
    showScreen('inventory');
  };

  // —— Buy menu (in-match) ——
  let buyCat = 'sidearm';
  let selectedId = null;

  function renderBuyCats() {
    const root = $('buy-cats');
    root.innerHTML = '';
    for (const c of CATEGORIES) {
      const b = document.createElement('button');
      b.className = `buy-cat${c.id === buyCat ? ' active' : ''}`;
      b.textContent = c.label;
      b.onclick = () => {
        buyCat = c.id;
        selectedId = null;
        SFX.ui();
        renderBuy();
      };
      root.appendChild(b);
    }
  }

  function renderBuyList() {
    const root = $('buy-list');
    root.innerHTML = '';
    const player = game.player;
    if (!player) return;

    if (buyCat === 'gear') {
      for (const g of Object.values(GEAR)) {
        if (g.id === 'defuse_kit' && player.team !== TEAMS.SENTINELS) continue;
        const btn = document.createElement('button');
        const cant = player.money < g.price;
        btn.className = `buy-item${cant ? ' cant' : ''}${selectedId === g.id ? ' selected' : ''}`;
        btn.innerHTML = `<div class="name">${g.name}</div><div class="meta">UTILITY</div><div class="price">${formatMoney(g.price)}</div>`;
        btn.onclick = () => { selectedId = g.id; renderBuy(); };
        btn.ondblclick = () => tryBuyGear(g.id);
        root.appendChild(btn);
      }
      return;
    }

    // Arsenal: only craft unlocked from crates (plus the 3 starter hulls)
    const list = Object.values(VEHICLES).filter(
      (v) => v.category === buyCat && inventory.ownsVehicle(v.id)
    );
    if (!list.length) {
      root.innerHTML = `<p class="muted" style="padding:1rem">No unlocked craft in this class.<br/>Open Tank / Ship / Jet cases in Inventory to unlock matching craft.</p>`;
      return;
    }
    for (const v of list) {
      const owned = player.loadout.includes(v.id);
      const cant = player.money < v.price && !owned;
      const skin = inventory.getEquipped(v.id);
      const btn = document.createElement('button');
      btn.className = `buy-item buy-item-skin${cant ? ' cant' : ''}${owned ? ' owned' : ''}${selectedId === v.id ? ' selected' : ''}`;
      btn.innerHTML = `
        <img class="buy-thumb" src="${vehicleImg(v)}" alt="" width="64" height="64" />
        <div class="name">${v.name}</div>
        <div class="meta">${v.className} · ${skin?.shortName || 'Stock'}</div>
        <div class="price">${formatMoney(v.price)}</div>`;
      btn.onclick = () => { selectedId = v.id; renderBuy(); };
      btn.ondblclick = () => tryBuyVehicle(v.id);
      root.appendChild(btn);
    }
  }

  async function tryBuyVehicle(id) {
    const v = VEHICLES[id];
    if (!v) return;
    if (!inventory.ownsVehicle(id)) {
      toast('Only craft unlocked from crates can be used');
      return;
    }
    const p = game.player;
    if (!p) return;
    if (p.loadout.includes(id)) {
      game.buyVehicle(id);
      return;
    }

    const short = p.money < v.price;
    const blessed = await askTrivia({
      count: 1,
      title: short ? 'ALMS & ARSENAL' : 'ARSENAL BLESSING',
      reason: short
        ? `You're short ${formatMoney(v.price - p.money)} for ${v.name}. Answer correctly for blessed alms to cover it.`
        : `Bless the requisition of ${v.name} with one Catholic Trivia answer.`,
    });
    if (!blessed) {
      toast('Purchase withheld — faith check failed');
      if (short) {
        offerAdPurchase({
          shortfall: v.price - p.money,
          currency: 'match',
          title: `Need ${formatMoney(v.price - p.money)} more`,
          body: `Watch an ad to deploy the ${v.name} this round.`,
          onMatchGrant: (n) => {
            p.money = Math.min(16000, p.money + n);
          },
          retry: () => game.buyVehicle(id),
        });
      }
      return;
    }

    if (p.money < v.price) {
      const shortfall = v.price - p.money;
      p.money = Math.min(16000, p.money + shortfall);
      toast(`Alms +${formatMoney(shortfall)} — go with God`);
    }
    game.buyVehicle(id);
  }

  async function tryBuyGear(id) {
    const g = GEAR[id];
    const p = game.player;
    if (!g || !p) return;

    const short = p.money < g.price;
    const blessed = await askTrivia({
      count: 1,
      title: short ? 'ALMS FOR GEAR' : 'GEAR BLESSING',
      reason: short
        ? `Short ${formatMoney(g.price - p.money)} for ${g.name}. A correct answer covers the gap.`
        : `One Catholic Trivia question to requisition ${g.name}.`,
    });
    if (!blessed) {
      toast('Purchase withheld — faith check failed');
      if (short) {
        offerAdPurchase({
          shortfall: g.price - p.money,
          currency: 'match',
          title: `Need ${formatMoney(g.price - p.money)} more`,
          body: `Watch an ad to buy ${g.name}.`,
          onMatchGrant: (n) => {
            p.money = Math.min(16000, p.money + n);
          },
          retry: () => game.buyGear(id),
        });
      }
      return;
    }

    if (p.money < g.price) {
      const shortfall = g.price - p.money;
      p.money = Math.min(16000, p.money + shortfall);
      toast(`Alms +${formatMoney(shortfall)}`);
    }
    game.buyGear(id);
  }

  function renderBuyDetail() {
    const root = $('buy-detail');
    if (!selectedId) {
      root.innerHTML = '<p class="muted">Select a vehicle<br/>Double-click to purchase</p>';
      return;
    }
    const v = VEHICLES[selectedId] || GEAR[selectedId];
    if (!v) return;
    if (GEAR[selectedId]) {
      root.innerHTML = `
        <span class="muted">GEAR</span>
        <h3>${v.name}</h3>
        <p class="muted">${v.desc}</p>
        <div class="stat-row"><span>Price</span><strong>${formatMoney(v.price)}</strong></div>
        <button class="btn btn-primary" style="margin-top:1rem;width:100%" id="btn-buy-confirm">PURCHASE</button>
      `;
      $('btn-buy-confirm').onclick = () => tryBuyGear(selectedId);
      return;
    }
    const skin = inventory.getEquipped(v.id);
    const unlocked = inventory.ownsVehicle(v.id);
    if (!unlocked) {
      root.innerHTML = `
        <span class="muted">${v.className}</span>
        <h3>${v.name}</h3>
        <p class="muted">Locked. Open fleet cases to unlock this craft — you can only deploy vehicles you own.</p>
      `;
      return;
    }
    root.innerHTML = `
      <span class="muted">${v.className}</span>
      <h3>${v.name}</h3>
      <img class="inv-swatch-lg" src="${vehicleImg(v)}" alt="${v.name}" width="256" height="256" style="margin:0.5rem 0" />
      <p class="muted">${v.desc}</p>
      <div class="stat-row"><span>Fleet</span><strong>UNLOCKED</strong></div>
      <div class="stat-row"><span>Paint</span><strong style="color:${rarityColor(skin.rarity)}">${skin.shortName}</strong></div>
      <div class="stat-row"><span>Damage</span><strong>${v.damage}</strong></div>
      <div class="stat-row"><span>Fire rate</span><strong>${v.fireRate}/s</strong></div>
      <div class="stat-row"><span>Speed</span><strong>${v.speed}</strong></div>
      <div class="stat-row"><span>Domain</span><strong>${v.domain.toUpperCase()}</strong></div>
      <div class="stat-row"><span>Deploy</span><strong>${formatMoney(v.price)}</strong></div>
      <button class="btn btn-primary" style="margin-top:1rem;width:100%" id="btn-buy-confirm">DEPLOY</button>
    `;
    $('btn-buy-confirm').onclick = () => tryBuyVehicle(selectedId);
  }

  function renderLoadout() {
    const root = $('buy-loadout');
    const player = game.player;
    if (!player) return;
    root.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const id = player.loadout[i];
      const v = id ? VEHICLES[id] : null;
      const div = document.createElement('div');
      div.className = 'loadout-slot';
      const skin = v ? inventory.getEquipped(v.id) : null;
      div.innerHTML = `<span>SLOT ${i + 1}</span><strong>${v ? v.name : '— EMPTY —'}</strong><em>${skin ? skin.shortName : ''}</em>`;
      root.appendChild(div);
    }
  }

  function renderBuy() {
    if (!game.player) return;
    $('buy-credits').textContent = formatMoney(game.player.money);
    renderBuyCats();
    renderBuyList();
    renderBuyDetail();
    renderLoadout();
  }

  function openBuy() {
    buyCat = 'sidearm';
    selectedId = null;
    screens.buy.classList.add('active');
    renderBuy();
  }

  function closeBuy() {
    screens.buy.classList.remove('active');
  }

  function toast(msg, ms = 1800) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), ms);
  }

  function killFeed(killer, victim, weaponName) {
    const root = $('killfeed');
    const row = document.createElement('div');
    row.className = 'kill-row';
    const kc = killer.team === 'raiders' ? 'r' : 's';
    const vc = victim.team === 'raiders' ? 'r' : 's';
    row.innerHTML = `<span class="${kc}">${killer.name}</span><span class="weapon">[${weaponName}]</span><span class="${vc}">${victim.name}</span>`;
    root.prepend(row);
    setTimeout(() => row.remove(), 4500);
    while (root.children.length > 6) root.lastChild.remove();
  }

  function showBanner(title, sub = '') {
    const el = $('round-banner');
    $('round-banner-title').textContent = title;
    $('round-banner-sub').textContent = sub;
    el.classList.remove('hidden');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(() => el.classList.add('hidden'), 2400);
  }

  function showNiceTry(ms = 3000) {
    const el = $('nice-try');
    if (!el) return;
    el.classList.remove('hidden');
    // Retrigger slam animation
    el.style.animation = 'none';
    // eslint-disable-next-line no-unused-expressions
    el.offsetHeight;
    el.style.animation = '';
    clearTimeout(showNiceTry._t);
    showNiceTry._t = setTimeout(() => el.classList.add('hidden'), ms);
    SFX.ui?.();
  }

  function updateHud() {
    const p = game.player;
    if (!p) return;
    $('hud').classList.remove('hidden');
    // Chat log visible during match; compose opens on Enter
    const chat = $('chat-panel');
    if (chat && game.netEnabled) {
      chat.classList.remove('hidden');
    }
    $('hud-team-a').textContent = game.score.raiders;
    $('hud-team-b').textContent = game.score.sentinels;
    $('hud-phase').textContent = game.phaseLabel;
    $('hud-timer').textContent = formatTime(game.timer);
    renderBuyVote();
    if (game.phase !== 'buy') myBuyVote = null;
    $('hud-hp').textContent = Math.max(0, Math.ceil(p.hp));
    $('hud-armor').textContent = Math.max(0, Math.ceil(p.armor));
    $('hud-money').textContent = formatMoney(p.money);
    const v = p.vehicle;
    const skin = inventory.getEquipped(v.id);
    $('hud-vehicle-class').textContent = v.className;
    $('hud-vehicle-name').textContent = v.name;
    if ($('hud-skin-name')) {
      $('hud-skin-name').textContent = skin.shortName;
      $('hud-skin-name').style.color = rarityColor(skin.rarity);
    }
    const ammo = p.ammo[v.id] || { mag: 0, reserve: 0 };
    $('hud-ammo').textContent = p.reloadT > 0 ? 'RELOADING…' : `${ammo.mag} / ${ammo.reserve}`;
    const ord = $('hud-ordnance');
    if (ord) {
      const bits = [];
      if (v.domain === 'air') bits.push(`BOMBS ${p.bombs || 0}`);
      if (v.domain === 'sea') bits.push(`TORPEDOES ${p.torpedoes || 0}`);
      if ((p.landmines || 0) > 0 || v.domain === 'land') bits.push(`MINES ${p.landmines || 0}`);
      ord.textContent = bits.join(' · ');
      ord.style.display = bits.length ? '' : 'none';
    }

    const hint = $('hud-hint');
    if (hint) {
      if (game.input?.cmdMode) {
        hint.textContent = `CMD ${game.input.cmdBuffer || '/'}  ·  Enter run · Esc cancel`;
        hint.style.color = '#ffe08a';
      } else if (game.mode?.freeRoam) {
        hint.textContent = 'Vigilante · F Gun · Shift+↑/↓ aim · Shift+W/S jet alt · B Bombs · X Mine · C Arsenal · Esc Extract';
        hint.style.color = '';
      } else if (v.domain === 'air') {
        hint.textContent = 'F Gun · Shift+↑/↓ aim · Shift+W/S altitude · B Bombs · R Reload · 1–3 Transform';
        hint.style.color = '';
      } else if (v.domain === 'sea') {
        hint.textContent = 'F Gun · Shift+↑/↓ aim · T Torpedo · X Mine · R Reload · Space Jump';
        hint.style.color = '';
      } else {
        hint.textContent = 'WASD/←→ · Mouse look · Shift+↑/↓ aim · F Gun · B Buy · X Mine · R Reload';
        hint.style.color = '';
      }
      if (game.input?.lookMode === 'roblox' && !game.input?.cmdMode) {
        hint.textContent = `${hint.textContent} · Hold RMB to look`;
      }
    }

    const slots = $('hud-slots');
    slots.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const id = p.loadout[i];
      if (!id) continue;
      const def = VEHICLES[id];
      const chip = document.createElement('div');
      chip.className = `slot-chip${i === p.activeSlot ? ' active' : ''}`;
      chip.innerHTML = `<span>${i + 1}</span><b>${def.className}</b>${def.name}`;
      slots.appendChild(chip);
    }

    const obj = $('hud-objective');
    const mode = game.mode;
    if (mode?.freeRoam) {
      obj.textContent = `VIGILANTE · ${p.kills} kills · Esc to extract`;
    } else if (mode?.fragLimit) {
      obj.textContent = `SKIRMISH · ${game.frags?.raiders || 0} – ${game.frags?.sentinels || 0} · first to ${mode.fragLimit}`;
    } else if (mode?.bots === 'waves') {
      obj.textContent = `SIEGE · ${game.waveKills || 0} / ${mode.waveKills} hostiles down`;
    } else if (game.bomb.planted) {
      obj.textContent = `WARHEAD LIVE · SITE ${game.bomb.site} · ${formatTime(game.bomb.timer)}`;
    } else if (game.phase === 'buy') {
      obj.textContent = 'BUY PHASE — Press B for arsenal';
    } else if (p.team === 'raiders') {
      obj.textContent = p.hasBomb ? 'YOU CARRY THE WARHEAD — Plant at A or B' : 'Eliminate Sentinels · Escort the warhead';
    } else {
      obj.textContent = 'Defend sites A / B · Stop the plant';
    }

    $('damage-fx').style.opacity = p.alive ? Math.min(0.85, (100 - p.hp) / 140) : 0.5;
    drawMinimap(game);
  }

  function drawMinimap(game) {
    const canvas = $('minimap');
    if (!canvas || !game.player) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const mm = game.map?.minimap || {};
    const waterTint = mm.waterTint || '#0c2837';
    const landTint = mm.landTint || '#465a41';
    ctx.fillStyle = waterTint.length === 7
      ? `rgba(${parseInt(waterTint.slice(1, 3), 16)},${parseInt(waterTint.slice(3, 5), 16)},${parseInt(waterTint.slice(5, 7), 16)},0.95)`
      : 'rgba(12, 40, 55, 0.95)';
    ctx.fillRect(0, 0, w, h);
    const scale = w / 110;
    const toX = (x) => w / 2 + x * scale;
    const toY = (z) => h / 2 + z * scale;
    const land = mm.land || [-40, -35, 70, 55];
    ctx.fillStyle = landTint.length === 7
      ? `rgba(${parseInt(landTint.slice(1, 3), 16)},${parseInt(landTint.slice(3, 5), 16)},${parseInt(landTint.slice(5, 7), 16)},0.88)`
      : 'rgba(70, 90, 65, 0.85)';
    ctx.fillRect(toX(land[0]), toY(land[1]), land[2] * scale, land[3] * scale);

    // Layout-specific water cuts on the minimap
    const layout = game.map?.layout;
    if (layout === 'canyon') {
      ctx.fillStyle = ctx.fillStyle.replace('0.88', '0.95');
      ctx.strokeStyle = waterTint;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(toX(2), toY(-36));
      ctx.lineTo(toX(0), toY(32));
      ctx.stroke();
    } else if (layout === 'ice') {
      ctx.fillStyle = waterTint;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(toX(-40), toY(-5), 80 * scale, 6 * scale);
      ctx.fillRect(toX(3), toY(-28), 5 * scale, 50 * scale);
      ctx.globalAlpha = 1;
    } else if (layout === 'yard') {
      ctx.strokeStyle = waterTint;
      ctx.lineWidth = 4;
      ctx.strokeRect(toX(-34), toY(-30), 68 * scale, 56 * scale);
      ctx.beginPath();
      ctx.moveTo(toX(-28), toY(2));
      ctx.lineTo(toX(28), toY(2));
      ctx.moveTo(toX(-2), toY(-22));
      ctx.lineTo(toX(-2), toY(20));
      ctx.stroke();
    }

    const siteA = game.map?.sites?.A;
    const siteB = game.map?.sites?.B;
    if (siteA) {
      ctx.fillStyle = '#e85d04';
      ctx.beginPath();
      ctx.arc(toX(siteA.x), toY(siteA.z), 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (siteB) {
      ctx.fillStyle = '#1d9bf0';
      ctx.beginPath();
      ctx.arc(toX(siteB.x), toY(siteB.z), 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (game.bomb.planted && game.bomb.position) {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(toX(game.bomb.position.x) - 3, toY(game.bomb.position.z) - 3, 6, 6);
    }
    for (const u of game.units) {
      if (!u.alive) continue;
      ctx.fillStyle = u.team === 'raiders' ? '#e85d04' : '#1d9bf0';
      const x = toX(u.mesh.position.x);
      const y = toY(u.mesh.position.z);
      if (u.isPlayer) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, y, u.isPlayer ? 3 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function updateScoreboard(show) {
    const el = $('scoreboard');
    el.classList.toggle('hidden', !show);
    if (!show) return;
    const fill = (tableId, team) => {
      const tb = $(tableId).querySelector('tbody');
      tb.innerHTML = '';
      game.units
        .filter((u) => u.team === team)
        .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
        .forEach((u) => {
          const tr = document.createElement('tr');
          if (u.isPlayer) tr.className = 'you';
          tr.innerHTML = `<td>${u.name}${u.alive ? '' : ' ✕'}</td><td>${u.kills}</td><td>${u.deaths}</td><td>${u.assists}</td><td>${formatMoney(u.money)}</td>`;
          tb.appendChild(tr);
        });
    };
    fill('sb-raiders', 'raiders');
    fill('sb-sentinels', 'sentinels');
  }

  refreshMeta();

  return {
    showScreen,
    hideAllScreens,
    openBuy,
    closeBuy,
    renderBuy,
    toast,
    killFeed,
    showBanner,
    showNiceTry,
    updateHud,
    updateScoreboard,
    refreshMeta,
    offerAdPurchase,
    askTrivia,
    renderBuyVote,
    gateAuthOrMenu,
    pushChat,
    openChat,
    closeChat,
    isChatOpen: () => chatOpen,
  };
}
