import {
  CATEGORIES, VEHICLES, GEAR, formatMoney, formatTime, TEAMS,
} from './config.js';
import { SFX } from './audio.js';

export function createUI(game) {
  const $ = (id) => document.getElementById(id);

  const screens = {
    menu: $('screen-menu'),
    howto: $('screen-howto'),
    team: $('screen-team'),
    buy: $('screen-buy'),
  };

  function showScreen(name) {
    Object.entries(screens).forEach(([k, el]) => {
      el.classList.toggle('active', k === name);
    });
  }

  function hideAllScreens() {
    Object.values(screens).forEach((el) => el.classList.remove('active'));
  }

  // Menu bindings
  $('btn-play').onclick = () => {
    SFX.ui();
    showScreen('team');
  };
  $('btn-howto').onclick = () => {
    SFX.ui();
    showScreen('howto');
  };
  $('btn-howto-back').onclick = () => {
    SFX.ui();
    showScreen('menu');
  };
  $('pick-raiders').onclick = () => game.startMatch(TEAMS.RAIDERS);
  $('pick-sentinels').onclick = () => game.startMatch(TEAMS.SENTINELS);
  $('btn-buy-close').onclick = () => game.closeBuyMenu();

  // Buy menu state
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
        btn.onclick = () => {
          selectedId = g.id;
          renderBuy();
        };
        btn.ondblclick = () => game.buyGear(g.id);
        root.appendChild(btn);
      }
      return;
    }

    const list = Object.values(VEHICLES).filter((v) => v.category === buyCat);
    for (const v of list) {
      const owned = player.loadout.includes(v.id);
      const cant = player.money < v.price && !owned;
      const btn = document.createElement('button');
      btn.className = `buy-item${cant ? ' cant' : ''}${owned ? ' owned' : ''}${selectedId === v.id ? ' selected' : ''}`;
      btn.innerHTML = `<div class="name">${v.name}</div><div class="meta">${v.className} · ${v.domain.toUpperCase()}</div><div class="price">${formatMoney(v.price)}</div>`;
      btn.onclick = () => {
        selectedId = v.id;
        renderBuy();
      };
      btn.ondblclick = () => game.buyVehicle(v.id);
      root.appendChild(btn);
    }
  }

  function renderBuyDetail() {
    const root = $('buy-detail');
    if (!selectedId) {
      root.innerHTML = '<p class="muted">Select a vehicle<br/>Double-click or press Buy</p>';
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
      $('btn-buy-confirm').onclick = () => game.buyGear(selectedId);
      return;
    }
    root.innerHTML = `
      <span class="muted">${v.className}</span>
      <h3>${v.name}</h3>
      <p class="muted">${v.desc}</p>
      <div class="stat-row"><span>Damage</span><strong>${v.damage}</strong></div>
      <div class="stat-row"><span>Fire rate</span><strong>${v.fireRate}/s</strong></div>
      <div class="stat-row"><span>Speed</span><strong>${v.speed}</strong></div>
      <div class="stat-row"><span>Armor pen</span><strong>${Math.round(v.armorPen * 100)}%</strong></div>
      <div class="stat-row"><span>Domain</span><strong>${v.domain.toUpperCase()}</strong></div>
      <div class="stat-row"><span>Price</span><strong>${formatMoney(v.price)}</strong></div>
      <button class="btn btn-primary" style="margin-top:1rem;width:100%" id="btn-buy-confirm">PURCHASE</button>
    `;
    $('btn-buy-confirm').onclick = () => game.buyVehicle(selectedId);
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
      div.innerHTML = `<span>SLOT ${i + 1}</span><strong>${v ? v.name : '— EMPTY —'}</strong>`;
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

  function updateHud() {
    const p = game.player;
    if (!p) return;
    $('hud').classList.remove('hidden');
    $('hud-team-a').textContent = game.score.raiders;
    $('hud-team-b').textContent = game.score.sentinels;
    $('hud-phase').textContent = game.phaseLabel;
    $('hud-timer').textContent = formatTime(game.timer);
    $('hud-hp').textContent = Math.max(0, Math.ceil(p.hp));
    $('hud-armor').textContent = Math.max(0, Math.ceil(p.armor));
    $('hud-money').textContent = formatMoney(p.money);
    const v = p.vehicle;
    $('hud-vehicle-class').textContent = v.className;
    $('hud-vehicle-name').textContent = v.name;
    const ammo = p.ammo[v.id] || { mag: 0, reserve: 0 };
    $('hud-ammo').textContent = p.reloadT > 0 ? 'RELOADING…' : `${ammo.mag} / ${ammo.reserve}`;

    // slots
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

    // objective text
    const obj = $('hud-objective');
    if (game.bomb.planted) {
      obj.textContent = `WARHEAD LIVE · SITE ${game.bomb.site} · ${formatTime(game.bomb.timer)}`;
    } else if (game.phase === 'buy') {
      obj.textContent = 'BUY PHASE — Press B for arsenal';
    } else if (p.team === 'raiders') {
      obj.textContent = p.hasBomb ? 'YOU CARRY THE WARHEAD — Plant at A or B' : 'Eliminate Sentinels · Escort the warhead';
    } else {
      obj.textContent = 'Defend sites A / B · Stop the plant';
    }

    // damage fx
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
    ctx.fillStyle = 'rgba(12, 40, 55, 0.95)';
    ctx.fillRect(0, 0, w, h);

    const scale = w / 110;
    const toX = (x) => w / 2 + x * scale;
    const toY = (z) => h / 2 + z * scale;

    // land blob
    ctx.fillStyle = 'rgba(70, 90, 65, 0.85)';
    ctx.fillRect(toX(-40), toY(-35), 70 * scale, 55 * scale);

    // sites
    ctx.fillStyle = '#e85d04';
    ctx.beginPath();
    ctx.arc(toX(-28), toY(22), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d9bf0';
    ctx.beginPath();
    ctx.arc(toX(30), toY(18), 5, 0, Math.PI * 2);
    ctx.fill();

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

  return {
    showScreen,
    hideAllScreens,
    openBuy,
    closeBuy,
    renderBuy,
    toast,
    killFeed,
    showBanner,
    updateHud,
    updateScoreboard,
  };
}
