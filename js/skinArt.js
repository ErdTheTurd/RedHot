/** Procedural skin / vehicle preview art for inventory & buy menus */

const cache = new Map();

function hex(n) {
  return `#${n.toString(16).padStart(6, '0')}`;
}

function rarityHex(rarity) {
  return ({
    consumer: '#b0c3d9',
    industrial: '#5e98d9',
    milspec: '#4b69ff',
    restricted: '#8847ff',
    classified: '#d32ce6',
    covert: '#eb4b4b',
    extraordinary: '#e4ae39',
  })[rarity] || '#b0c3d9';
}

function drawTank(ctx, cx, cy, scale, body, accent, dark) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  // tracks
  ctx.fillStyle = dark;
  roundRect(ctx, -52, 8, 18, 36, 4); ctx.fill();
  roundRect(ctx, 34, 8, 18, 36, 4); ctx.fill();
  // hull
  const g = ctx.createLinearGradient(-40, -20, 40, 30);
  g.addColorStop(0, body);
  g.addColorStop(1, shade(body, -30));
  ctx.fillStyle = g;
  roundRect(ctx, -40, -10, 80, 40, 6); ctx.fill();
  // turret
  ctx.beginPath();
  ctx.ellipse(0, -6, 22, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = shade(body, 10);
  ctx.fill();
  // barrel
  ctx.fillStyle = dark;
  roundRect(ctx, -6, -48, 12, 40, 3); ctx.fill();
  // accent stripe
  ctx.fillStyle = accent;
  roundRect(ctx, -28, 4, 56, 6, 2); ctx.fill();
  ctx.restore();
}

function drawShip(ctx, cx, cy, scale, body, accent, dark) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  const g = ctx.createLinearGradient(0, -30, 0, 40);
  g.addColorStop(0, body);
  g.addColorStop(1, shade(body, -40));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -46);
  ctx.lineTo(28, 10);
  ctx.lineTo(22, 34);
  ctx.lineTo(-22, 34);
  ctx.lineTo(-28, 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = dark;
  roundRect(ctx, -12, -8, 24, 22, 3); ctx.fill();
  ctx.fillStyle = accent;
  roundRect(ctx, -3, -40, 6, 28, 2); ctx.fill();
  ctx.restore();
}

function drawJet(ctx, cx, cy, scale, body, accent, dark) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  // wings
  ctx.fillStyle = shade(body, -15);
  ctx.beginPath();
  ctx.moveTo(-58, 10);
  ctx.lineTo(0, -6);
  ctx.lineTo(58, 10);
  ctx.lineTo(40, 22);
  ctx.lineTo(0, 10);
  ctx.lineTo(-40, 22);
  ctx.closePath();
  ctx.fill();
  // fuselage
  const g = ctx.createLinearGradient(0, -40, 0, 30);
  g.addColorStop(0, body);
  g.addColorStop(1, shade(body, -25));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -44);
  ctx.quadraticCurveTo(14, -10, 10, 28);
  ctx.lineTo(-10, 28);
  ctx.quadraticCurveTo(-14, -10, 0, -44);
  ctx.fill();
  // canopy
  ctx.fillStyle = 'rgba(160,210,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(0, -12, 7, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  // tail
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(-2, 16);
  ctx.lineTo(-2, 36);
  ctx.lineTo(14, 28);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = accent;
  roundRect(ctx, -3, -30, 6, 40, 2); ctx.fill();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shade(hexColor, amount) {
  const n = typeof hexColor === 'number' ? hexColor : parseInt(String(hexColor).replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function patternOverlay(ctx, w, h, rarity, body) {
  ctx.save();
  ctx.globalAlpha = 0.12;
  if (rarity === 'extraordinary' || rarity === 'covert') {
    for (let i = 0; i < 18; i++) {
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(Math.random() * w, Math.random() * h);
      ctx.lineTo(Math.random() * w, Math.random() * h);
      ctx.stroke();
    }
  } else if (rarity === 'classified' || rarity === 'restricted') {
    for (let y = 0; y < h; y += 8) {
      ctx.fillStyle = y % 16 === 0 ? '#fff' : '#000';
      ctx.fillRect(0, y, w, 1);
    }
  } else {
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000';
      ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    }
  }
  ctx.restore();
  // gloss
  const gloss = ctx.createLinearGradient(0, 0, 0, h);
  gloss.addColorStop(0, 'rgba(255,255,255,0.18)');
  gloss.addColorStop(0.45, 'rgba(255,255,255,0)');
  gloss.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = gloss;
  ctx.fillRect(0, 0, w, h);
}

/**
 * @param {object} skin
 * @param {'tank'|'ship'|'jet'|string} domain
 * @param {number} size
 */
export function skinImageDataUrl(skin, domain = 'land', size = 256) {
  const key = `${skin.id}|${domain}|${size}`;
  if (cache.has(key)) return cache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const body = hex(skin.color);
  const accent = rarityHex(skin.rarity);
  const dark = '#1a1f24';
  const team = accent;

  // background
  const bg = ctx.createRadialGradient(size * 0.35, size * 0.3, 10, size * 0.5, size * 0.55, size * 0.7);
  bg.addColorStop(0, shade(skin.color, 40));
  bg.addColorStop(0.55, '#121820');
  bg.addColorStop(1, '#070b10');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  patternOverlay(ctx, size, size, skin.rarity, body);

  // rarity frame
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(3, size * 0.02);
  ctx.strokeRect(size * 0.04, size * 0.04, size * 0.92, size * 0.92);

  const cx = size / 2;
  const cy = size * 0.52;
  const scale = size / 220;

  if (domain === 'sea') drawShip(ctx, cx, cy, scale, body, team, dark);
  else if (domain === 'air') drawJet(ctx, cx, cy, scale, body, team, dark);
  else drawTank(ctx, cx, cy, scale, body, team, dark);

  // label bar
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, size * 0.78, size, size * 0.22);
  ctx.fillStyle = accent;
  ctx.font = `700 ${Math.floor(size * 0.07)}px "Barlow Condensed", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(skin.shortName.toUpperCase(), size / 2, size * 0.9);

  const url = canvas.toDataURL('image/png');
  cache.set(key, url);
  return url;
}
