import {
  CATEGORIES, VEHICLES, GEAR, formatMoney, formatTime, TEAMS,
} from './config.js';
import { CASES, KEYS, SKINS, RARITY, rarityColor, shopSkinCatalog } from './skins.js';
import { GEAR_ITEMS, gearItemImageDataUrl } from './gearItems.js';
import { skinImageDataUrl, vehicleImageDataUrl } from './skinArt.js';
import { SFX } from './audio.js';
import {
  MAPS, MODES, isMapUnlocked, isModeUnlocked, xpProgress,
} from './progression.js';
import { MAX_ADS_PER_DAY } from './ads.js';

function skinImg(skin) {
  const domain = VEHICLES[skin.vehicleId]?.domain || 'land';
  return skinImageDataUrl(skin, domain, 256);
}

function vehicleImg(vehicle, inventory) {
  const skin = inventory?.getEquipped?.(vehicle.id) || null;
  return vehicleImageDataUrl(vehicle, skin, 256);
}

export function createUI(game, inventory) {
  const $ = (id) => document.getElementById(id);

  const screens = {
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
    if ($('menu-wallet')) {
      const p = inventory.profile || {};
      const lvl = p.level || 1;
      $('menu-wallet').textContent = `BANK ${w} · LV ${lvl}`;
    }
    if ($('shop-wallet')) $('shop-wallet').textContent = w;
    if ($('inv-wallet')) $('inv-wallet').textContent = w;
  }

  // —— Menu ——
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
    lowPolyChk.checked = game.quality?.low || game.quality?.preset === 'low';
    lowPolyChk.onchange = () => {
      const preset = lowPolyChk.checked ? 'low' : 'high';
      try {
        localStorage.setItem('vehicle_strike_gfx', preset);
      } catch { /* ignore */ }
      const q = game.setGraphicsQuality?.(preset);
      SFX.ui();
      toast(q?.low
        ? 'Low poly on — lighter map & effects'
        : 'Ultra graphics on — rebuilt battlefield');
    };
  }

  $('btn-play').onclick = () => {
    SFX.ui();
    renderOps();
    showScreen('ops');
  };
  $('btn-howto').onclick = () => { SFX.ui(); showScreen('howto'); };
  $('btn-howto-back').onclick = () => { SFX.ui(); showScreen('menu'); };
  $('btn-ops-back').onclick = () => { SFX.ui(); showScreen('menu'); };
  $('btn-team-back').onclick = () => {
    SFX.ui();
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
      showScreen('team');
    } else {
      game.startMatch({ team: TEAMS.RAIDERS, mapId: opsMap, modeId: opsMode });
    }
  };
  $('pick-raiders').onclick = () => game.startMatch({
    team: TEAMS.RAIDERS,
    mapId: opsMap,
    modeId: opsMode,
  });
  $('pick-sentinels').onclick = () => game.startMatch({
    team: TEAMS.SENTINELS,
    mapId: opsMap,
    modeId: opsMode,
  });
  $('btn-buy-close').onclick = () => game.closeBuyMenu();

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
        card.querySelector('button').onclick = () => {
          const res = inventory.buyCase(c.id);
          if (!res.ok) {
            if (res.shortfall) {
              offerAdPurchase({
                ...res,
                title: `Need ${formatMoney(res.shortfall)} more`,
                body: `Watch an ad to afford the ${c.name}.`,
                retry: () => {
                  const r2 = inventory.buyCase(c.id);
                  if (r2.ok) { SFX.buy(); toast(`Purchased ${c.name}`); }
                  else toast(r2.reason);
                  renderShop();
                },
              });
            } else toast(res.reason);
          } else { SFX.buy(); toast(`Purchased ${c.name}`); }
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
        card.querySelector('button').onclick = () => {
          const res = inventory.buyKey(k.id);
          if (!res.ok) {
            if (res.shortfall) {
              offerAdPurchase({
                ...res,
                title: `Need ${formatMoney(res.shortfall)} more`,
                body: `Watch an ad to afford the ${k.name}.`,
                retry: () => {
                  const r2 = inventory.buyKey(k.id);
                  if (r2.ok) { SFX.buy(); toast(`Purchased ${k.name}`); }
                  else toast(r2.reason);
                  renderShop();
                },
              });
            } else toast(res.reason);
          } else { SFX.buy(); toast(`Purchased ${k.name}`); }
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
        card.querySelector('button').onclick = () => {
          const res = inventory.buySkin(s.id);
          if (!res.ok) {
            if (res.shortfall) {
              offerAdPurchase({
                ...res,
                title: `Need ${formatMoney(res.shortfall)} more`,
                body: `Watch an ad to buy ${s.name}.`,
                retry: () => {
                  const r2 = inventory.buySkin(s.id);
                  if (r2.ok) { SFX.buy(); toast(`Purchased ${s.shortName}`); }
                  else toast(r2.reason);
                  renderShop();
                },
              });
            } else toast(res.reason);
          } else { SFX.buy(); toast(`Purchased ${s.shortName}`); }
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
          <img class="inv-swatch" src="${vehicleImg(v, inventory)}" alt="${v.name}" width="256" height="256" loading="lazy" />
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
          <img class="inv-swatch-lg" src="${vehicleImg(v, inventory)}" alt="${v.name}" width="256" height="256" />
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
          <img class="inv-swatch" src="${gearItemImageDataUrl(item)}" alt="${item.name}" width="256" height="256" loading="lazy" />
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
          <img class="inv-swatch-lg" src="${gearItemImageDataUrl(item)}" alt="${item.name}" width="256" height="256" />
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
          <img class="inv-swatch" src="${gearItemImageDataUrl(item)}" alt="${item.name}" width="256" height="256" loading="lazy" />
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
          <img class="inv-swatch-lg" src="${gearItemImageDataUrl(item)}" alt="${item.name}" width="256" height="256" />
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
      return gearItemImageDataUrl(entry);
    }
    return vehicleImg(entry, inventory);
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
      const imgSrc = kind === 'item' ? gearItemImageDataUrl(prize) : vehicleImg(prize, inventory);
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
      root.innerHTML = `<p class="muted" style="padding:1rem">No unlocked craft in this class.<br/>Open fleet cases in Inventory to unlock tanks, ships, and jets.</p>`;
      return;
    }
    for (const v of list) {
      const owned = player.loadout.includes(v.id);
      const cant = player.money < v.price && !owned;
      const skin = inventory.getEquipped(v.id);
      const btn = document.createElement('button');
      btn.className = `buy-item buy-item-skin${cant ? ' cant' : ''}${owned ? ' owned' : ''}${selectedId === v.id ? ' selected' : ''}`;
      btn.innerHTML = `
        <img class="buy-thumb" src="${vehicleImg(v, inventory)}" alt="" width="64" height="64" />
        <div class="name">${v.name}</div>
        <div class="meta">${v.className} · ${skin?.shortName || 'Stock'}</div>
        <div class="price">${formatMoney(v.price)}</div>`;
      btn.onclick = () => { selectedId = v.id; renderBuy(); };
      btn.ondblclick = () => tryBuyVehicle(v.id);
      root.appendChild(btn);
    }
  }

  function tryBuyVehicle(id) {
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
    if (p.money < v.price) {
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
      return;
    }
    game.buyVehicle(id);
  }

  function tryBuyGear(id) {
    const g = GEAR[id];
    const p = game.player;
    if (!g || !p) return;
    if (p.money < g.price) {
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
      return;
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
      <img class="inv-swatch-lg" src="${vehicleImg(v, inventory)}" alt="${v.name}" width="256" height="256" style="margin:0.5rem 0" />
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
        hint.textContent = 'Vigilante · F Gun · Shift+W/S aim · B Bombs · X Mine · C Arsenal · Esc Extract';
        hint.style.color = '';
      } else if (v.domain === 'air') {
        hint.textContent = 'F Gun · Shift+W/S aim · B Bombs · R Reload · Space Jump · 1–3 Slots';
        hint.style.color = '';
      } else if (v.domain === 'sea') {
        hint.textContent = 'F Gun · Shift+W/S aim · T Torpedo · X Mine · R Reload · Space Jump';
        hint.style.color = '';
      } else {
        hint.textContent = 'WASD/←→ · Mouse look · Shift+W/S aim · F Gun · B Buy · X Mine · R Reload';
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
    offerAdPurchase,
  };
}
