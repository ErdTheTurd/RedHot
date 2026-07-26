import {
  CATEGORIES, VEHICLES, GEAR, formatMoney, formatTime, TEAMS,
} from './config.js';
import { CASES, KEYS, SKINS, RARITY, rarityColor } from './skins.js';
import { SFX } from './audio.js';

export function createUI(game, inventory) {
  const $ = (id) => document.getElementById(id);

  const screens = {
    menu: $('screen-menu'),
    howto: $('screen-howto'),
    team: $('screen-team'),
    buy: $('screen-buy'),
    shop: $('screen-shop'),
    inventory: $('screen-inventory'),
    crate: $('screen-crate'),
  };

  let shopTab = 'cases';
  let invTab = 'skins';
  let selectedInv = null;
  let crateFocus = null;
  let lastOpenedSkin = null;
  let reelSpinning = false;

  function showScreen(name) {
    Object.entries(screens).forEach(([k, el]) => {
      if (el) el.classList.toggle('active', k === name);
    });
  }

  function hideAllScreens() {
    Object.values(screens).forEach((el) => el?.classList.remove('active'));
  }

  function refreshMeta() {
    const w = formatMoney(inventory.wallet);
    if ($('menu-wallet')) $('menu-wallet').textContent = `BANK ${w}`;
    if ($('shop-wallet')) $('shop-wallet').textContent = w;
    if ($('inv-wallet')) $('inv-wallet').textContent = w;
  }

  // —— Menu ——
  $('btn-play').onclick = () => { SFX.ui(); showScreen('team'); };
  $('btn-howto').onclick = () => { SFX.ui(); showScreen('howto'); };
  $('btn-howto-back').onclick = () => { SFX.ui(); showScreen('menu'); };
  $('btn-team-back').onclick = () => { SFX.ui(); showScreen('menu'); };
  $('pick-raiders').onclick = () => game.startMatch(TEAMS.RAIDERS);
  $('pick-sentinels').onclick = () => game.startMatch(TEAMS.SENTINELS);
  $('btn-buy-close').onclick = () => game.closeBuyMenu();

  $('btn-shop').onclick = () => {
    SFX.ui();
    shopTab = 'cases';
    renderShop();
    showScreen('shop');
  };
  $('btn-shop-back').onclick = () => { SFX.ui(); refreshMeta(); showScreen('menu'); };

  $('btn-inventory').onclick = () => {
    SFX.ui();
    invTab = 'skins';
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

  function renderShop() {
    refreshMeta();
    const grid = $('shop-grid');
    grid.innerHTML = '';
    if (shopTab === 'cases') {
      for (const c of Object.values(CASES)) {
        const card = document.createElement('article');
        card.className = 'shop-card';
        card.innerHTML = `
          <div class="shop-case-art" style="--case:${c.color}"></div>
          <h3>${c.name}</h3>
          <p>${c.desc}</p>
          <div class="shop-card-foot">
            <strong>${formatMoney(c.price)}</strong>
            <span>Owned: ${inventory.caseCount(c.id)}</span>
          </div>
          <button class="btn btn-primary">BUY CASE</button>
        `;
        card.querySelector('button').onclick = () => {
          const res = inventory.buyCase(c.id);
          if (!res.ok) toast(res.reason);
          else { SFX.buy(); toast(`Purchased ${c.name}`); }
          renderShop();
        };
        grid.appendChild(card);
      }
    } else {
      for (const k of Object.values(KEYS)) {
        const card = document.createElement('article');
        card.className = 'shop-card';
        card.innerHTML = `
          <div class="shop-key-art"></div>
          <h3>${k.name}</h3>
          <p>${k.desc}</p>
          <div class="shop-card-foot">
            <strong>${formatMoney(k.price)}</strong>
            <span>Owned: ${inventory.keyCount(k.id)}</span>
          </div>
          <button class="btn btn-primary">BUY KEY</button>
        `;
        card.querySelector('button').onclick = () => {
          const res = inventory.buyKey(k.id);
          if (!res.ok) toast(res.reason);
          else { SFX.buy(); toast(`Purchased ${k.name}`); }
          renderShop();
        };
        grid.appendChild(card);
      }
    }
  }

  function renderInventory() {
    refreshMeta();
    const grid = $('inv-grid');
    const detail = $('inv-detail');
    grid.innerHTML = '';

    if (invTab === 'skins') {
      const owned = inventory.ownedSkins();
      // Always show factory defaults as equippable
      const defaults = Object.values(SKINS).filter((s) => s.isDefault);
      const list = [
        ...defaults.map((s) => ({ skin: s, count: 1, isDefault: true })),
        ...owned,
      ];
      if (!owned.length) {
        // still show defaults
      }
      for (const row of list) {
        const s = row.skin;
        const equipped = inventory.getEquipped(s.vehicleId)?.id === s.id;
        const el = document.createElement('button');
        el.className = `inv-item${selectedInv === s.id ? ' selected' : ''}${equipped ? ' equipped' : ''}`;
        el.style.borderColor = rarityColor(s.rarity);
        el.innerHTML = `
          <i class="inv-swatch" style="background:${'#' + s.color.toString(16).padStart(6, '0')}"></i>
          <strong>${s.shortName}</strong>
          <span>${VEHICLES[s.vehicleId]?.name || ''} · ${RARITY[s.rarity]?.label || ''}</span>
          <em>${row.isDefault ? 'DEFAULT' : `x${row.count}`}${equipped ? ' · EQUIPPED' : ''}</em>
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
          <div class="inv-swatch-lg" style="background:${'#' + s.color.toString(16).padStart(6, '0')}"></div>
          <div class="stat-row"><span>Vehicle</span><strong>${VEHICLES[s.vehicleId]?.name}</strong></div>
          <div class="stat-row"><span>Sell value</span><strong>${formatMoney(s.sellPrice)}</strong></div>
          <button class="btn btn-primary" style="width:100%;margin-top:1rem" id="btn-equip-skin">EQUIP</button>
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
        detail.innerHTML = '<p class="muted">Select a skin to equip or sell</p>';
      }
    } else if (invTab === 'cases') {
      for (const c of Object.values(CASES)) {
        const n = inventory.caseCount(c.id);
        const el = document.createElement('button');
        el.className = 'inv-item';
        el.innerHTML = `
          <i class="inv-swatch" style="background:${c.color}"></i>
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
      detail.innerHTML = '<p class="muted">Click a case to unlock it with a key</p>';
    } else {
      for (const k of Object.values(KEYS)) {
        const n = inventory.keyCount(k.id);
        const el = document.createElement('button');
        el.className = 'inv-item';
        el.innerHTML = `
          <i class="inv-swatch" style="background:#c9a227"></i>
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
    lastOpenedSkin = null;
    reelSpinning = false;
    const c = CASES[caseId];
    $('crate-title').textContent = c.name;
    $('crate-result').classList.add('hidden');
    $('btn-crate-open').classList.remove('hidden');
    $('btn-crate-open').disabled = !inventory.canOpen(caseId);
    $('btn-crate-open').textContent = inventory.canOpen(caseId)
      ? 'UNLOCK WITH KEY'
      : 'NEED CASE + KEY';
    buildReelPreview(caseId);
    showScreen('crate');
  }

  function buildReelPreview(caseId) {
    const reel = $('crate-reel');
    reel.style.transition = 'none';
    reel.style.transform = 'translateX(0)';
    reel.innerHTML = '';
    const pool = CASES[caseId].contains().slice().sort(() => Math.random() - 0.5).slice(0, 40);
    // pad if small pool
    while (pool.length < 40) pool.push(...CASES[caseId].contains());
    pool.slice(0, 48).forEach((s) => {
      const cell = document.createElement('div');
      cell.className = 'reel-cell';
      cell.style.borderBottom = `3px solid ${rarityColor(s.rarity)}`;
      cell.innerHTML = `
        <i style="background:${'#' + s.color.toString(16).padStart(6, '0')}"></i>
        <span>${s.shortName}</span>
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
    lastOpenedSkin = res.skin;
    animateCrateReveal(res.skin);
  };

  function animateCrateReveal(skin) {
    reelSpinning = true;
    $('btn-crate-open').classList.add('hidden');
    $('crate-result').classList.add('hidden');
    SFX.crateStart();

    const reel = $('crate-reel');
    reel.innerHTML = '';
    const cells = [];
    for (let i = 0; i < 50; i++) {
      const filler = CASES[crateFocus].contains()[Math.floor(Math.random() * CASES[crateFocus].contains().length)];
      cells.push(filler);
    }
    const winIndex = 42;
    cells[winIndex] = skin;
    cells.forEach((s) => {
      const cell = document.createElement('div');
      cell.className = 'reel-cell';
      cell.style.borderBottom = `3px solid ${rarityColor(s.rarity)}`;
      cell.innerHTML = `
        <i style="background:${'#' + s.color.toString(16).padStart(6, '0')}"></i>
        <span>${s.shortName}</span>
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
      SFX.crateLand(skin.rarity);
      $('crate-rarity').textContent = RARITY[skin.rarity].label;
      $('crate-rarity').style.color = rarityColor(skin.rarity);
      $('crate-skin-name').textContent = skin.name;
      $('crate-swatch').style.background = '#' + skin.color.toString(16).padStart(6, '0');
      $('crate-swatch').style.boxShadow = `0 0 40px ${rarityColor(skin.rarity)}`;
      $('crate-result').classList.remove('hidden');
      reelSpinning = false;
      refreshMeta();
    }, 4300);
  }

  $('btn-crate-equip').onclick = () => {
    if (!lastOpenedSkin) return;
    inventory.equip(lastOpenedSkin.id);
    SFX.buy();
    toast(`Equipped ${lastOpenedSkin.shortName}`);
  };

  $('btn-crate-done').onclick = () => {
    SFX.ui();
    invTab = 'skins';
    selectedInv = lastOpenedSkin?.id || null;
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
        btn.ondblclick = () => game.buyGear(g.id);
        root.appendChild(btn);
      }
      return;
    }

    const list = Object.values(VEHICLES).filter((v) => v.category === buyCat);
    for (const v of list) {
      const owned = player.loadout.includes(v.id);
      const cant = player.money < v.price && !owned;
      const skin = inventory.getEquipped(v.id);
      const btn = document.createElement('button');
      btn.className = `buy-item${cant ? ' cant' : ''}${owned ? ' owned' : ''}${selectedId === v.id ? ' selected' : ''}`;
      btn.innerHTML = `<div class="name">${v.name}</div><div class="meta">${v.className} · ${skin?.shortName || 'Factory'}</div><div class="price">${formatMoney(v.price)}</div>`;
      btn.onclick = () => { selectedId = v.id; renderBuy(); };
      btn.ondblclick = () => game.buyVehicle(v.id);
      root.appendChild(btn);
    }
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
      $('btn-buy-confirm').onclick = () => game.buyGear(selectedId);
      return;
    }
    const skin = inventory.getEquipped(v.id);
    root.innerHTML = `
      <span class="muted">${v.className}</span>
      <h3>${v.name}</h3>
      <p class="muted">${v.desc}</p>
      <div class="stat-row"><span>Equipped skin</span><strong style="color:${rarityColor(skin.rarity)}">${skin.shortName}</strong></div>
      <div class="stat-row"><span>Damage</span><strong>${v.damage}</strong></div>
      <div class="stat-row"><span>Fire rate</span><strong>${v.fireRate}/s</strong></div>
      <div class="stat-row"><span>Speed</span><strong>${v.speed}</strong></div>
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
    const skin = inventory.getEquipped(v.id);
    $('hud-vehicle-class').textContent = v.className;
    $('hud-vehicle-name').textContent = v.name;
    if ($('hud-skin-name')) {
      $('hud-skin-name').textContent = skin.shortName;
      $('hud-skin-name').style.color = rarityColor(skin.rarity);
    }
    const ammo = p.ammo[v.id] || { mag: 0, reserve: 0 };
    $('hud-ammo').textContent = p.reloadT > 0 ? 'RELOADING…' : `${ammo.mag} / ${ammo.reserve}`;

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
    if (game.bomb.planted) {
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
    ctx.fillStyle = 'rgba(12, 40, 55, 0.95)';
    ctx.fillRect(0, 0, w, h);
    const scale = w / 110;
    const toX = (x) => w / 2 + x * scale;
    const toY = (z) => h / 2 + z * scale;
    ctx.fillStyle = 'rgba(70, 90, 65, 0.85)';
    ctx.fillRect(toX(-40), toY(-35), 70 * scale, 55 * scale);
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
    updateHud,
    updateScoreboard,
    refreshMeta,
  };
}
