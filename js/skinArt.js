/** Procedural skin textures + inventory preview art */

const previewCache = new Map();
const texCache = new Map();

export function hexColor(n) {
  if (typeof n === 'string') return n.startsWith('#') ? n : `#${n}`;
  return `#${n.toString(16).padStart(6, '0')}`;
}

export function rarityHex(rarity) {
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

function shade(hex, amount) {
  const n = typeof hex === 'number' ? hex : parseInt(String(hex).replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function rgb(hex) {
  const n = typeof hex === 'number' ? hex : parseInt(String(hex).replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
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

/** Deterministic noise from seed */
function hash(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Paint a finish pattern into an existing canvas context.
 * Patterns: solid, camo, digital, hex, carbon, tiger, rust, circuit, pearl, scale, stripes, mesh, splatter
 */
export function paintPattern(ctx, w, h, skin) {
  const primary = hexColor(skin.color);
  const secondary = hexColor(skin.secondary ?? shade(skin.color, -40));
  const tertiary = hexColor(skin.tertiary ?? shade(skin.color, 35));
  const pattern = skin.pattern || 'solid';
  const seed = skin.id?.length || 1;

  // base fill
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, w, h);

  if (pattern === 'solid') {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, shade(skin.color, 25));
    g.addColorStop(0.5, primary);
    g.addColorStop(1, shade(skin.color, -30));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else if (pattern === 'camo') {
    for (let i = 0; i < 48; i++) {
      const colors = [primary, secondary, tertiary, shade(skin.color, -55)];
      ctx.fillStyle = colors[i % colors.length];
      const x = hash(seed + i * 3) * w;
      const y = hash(seed + i * 7) * h;
      const rw = 18 + hash(seed + i * 11) * 40;
      const rh = 14 + hash(seed + i * 13) * 32;
      ctx.beginPath();
      ctx.ellipse(x, y, rw, rh, hash(i) * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (pattern === 'digital') {
    const cell = Math.max(6, Math.floor(w / 24));
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        const v = hash(seed + x * 0.1 + y * 3.1);
        ctx.fillStyle = v > 0.66 ? secondary : v > 0.33 ? tertiary : primary;
        ctx.fillRect(x, y, cell, cell);
      }
    }
  } else if (pattern === 'hex') {
    const size = 14;
    for (let row = 0; row < h / size + 2; row++) {
      for (let col = 0; col < w / size + 2; col++) {
        const x = col * size * 1.5;
        const y = row * size * 1.732 + (col % 2 ? size * 0.866 : 0);
        ctx.strokeStyle = secondary;
        ctx.fillStyle = hash(seed + row * 20 + col) > 0.5 ? primary : tertiary;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i;
          const px = x + size * Math.cos(a);
          const py = y + size * Math.sin(a);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  } else if (pattern === 'carbon') {
    ctx.fillStyle = shade(skin.color, -20);
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        ctx.fillStyle = ((x + y) / 4) % 2 === 0 ? secondary : tertiary;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(x, y, 4, 4);
      }
    }
    ctx.globalAlpha = 1;
  } else if (pattern === 'tiger') {
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = secondary;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      const x0 = hash(seed + i) * w;
      ctx.moveTo(x0, -10);
      ctx.bezierCurveTo(
        x0 + 20, h * 0.33,
        x0 - 30, h * 0.66,
        x0 + 10, h + 10
      );
      ctx.stroke();
    }
  } else if (pattern === 'rust') {
    for (let i = 0; i < 120; i++) {
      const v = hash(seed + i * 2);
      ctx.fillStyle = v > 0.5 ? secondary : tertiary;
      ctx.globalAlpha = 0.35 + v * 0.4;
      ctx.beginPath();
      ctx.arc(hash(i + 1) * w, hash(i + 2) * h, 2 + v * 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (pattern === 'circuit') {
    ctx.fillStyle = shade(skin.color, -40);
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = secondary;
    ctx.fillStyle = tertiary;
    ctx.lineWidth = 2;
    for (let i = 0; i < 28; i++) {
      const x = Math.floor(hash(seed + i) * 12) * (w / 12);
      const y = Math.floor(hash(seed + i + 9) * 12) * (h / 12);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (hash(i) > 0.5 ? w / 6 : 0), y);
      ctx.lineTo(x + (hash(i) > 0.5 ? w / 6 : 0), y + h / 6);
      ctx.stroke();
      ctx.fillRect(x - 2, y - 2, 5, 5);
    }
  } else if (pattern === 'pearl') {
    const g = ctx.createRadialGradient(w * 0.3, h * 0.3, 4, w * 0.5, h * 0.5, w * 0.7);
    g.addColorStop(0, tertiary);
    g.addColorStop(0.4, primary);
    g.addColorStop(0.75, secondary);
    g.addColorStop(1, shade(skin.color, -50));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(hash(i) * w, hash(i + 4) * h, 1 + hash(i + 8) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (pattern === 'scale') {
    const s = 12;
    for (let row = 0; row < h / s + 2; row++) {
      for (let col = 0; col < w / s + 2; col++) {
        const x = col * s + (row % 2 ? s / 2 : 0);
        const y = row * s * 0.75;
        ctx.fillStyle = (row + col) % 2 ? secondary : primary;
        ctx.beginPath();
        ctx.arc(x, y, s * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = tertiary;
        ctx.stroke();
      }
    }
  } else if (pattern === 'stripes') {
    const band = Math.max(8, w / 16);
    for (let x = 0; x < w; x += band) {
      ctx.fillStyle = (x / band) % 2 === 0 ? primary : secondary;
      ctx.fillRect(x, 0, band, h);
    }
    ctx.fillStyle = tertiary;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(0, h * 0.35, w, h * 0.12);
    ctx.globalAlpha = 1;
  } else if (pattern === 'mesh') {
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = secondary;
    ctx.lineWidth = 1;
    for (let i = 0; i < w; i += 8) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
    }
    ctx.strokeStyle = tertiary;
    for (let i = 0; i < w; i += 24) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
    }
  } else if (pattern === 'splatter') {
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = i % 3 === 0 ? secondary : i % 3 === 1 ? tertiary : shade(skin.color, 20);
      ctx.globalAlpha = 0.5 + hash(i) * 0.5;
      const x = hash(seed + i * 5) * w;
      const y = hash(seed + i * 9) * h;
      ctx.beginPath();
      ctx.ellipse(x, y, 3 + hash(i) * 16, 2 + hash(i + 1) * 10, hash(i) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // micro grain
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 16) {
    const n = (hash(i + seed) - 0.5) * 16;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  // gloss coat for metallic finishes
  if ((skin.metalness || 0) > 0.55) {
    const gloss = ctx.createLinearGradient(0, 0, 0, h);
    gloss.addColorStop(0, 'rgba(255,255,255,0.28)');
    gloss.addColorStop(0.35, 'rgba(255,255,255,0.05)');
    gloss.addColorStop(0.7, 'rgba(0,0,0,0)');
    gloss.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = gloss;
    ctx.fillRect(0, 0, w, h);
  }
}

/** CanvasTexture for 3D vehicle body (requires THREE passed in). */
export function makeSkinTexture(THREE, skin, size = 256) {
  const key = `tex:${skin.id}:${size}`;
  if (texCache.has(key)) return texCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  paintPattern(ctx, size, size, skin);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = 4;
  texCache.set(key, tex);
  return tex;
}

function drawTank(ctx, cx, cy, scale, skinTexCanvas) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  // tracks
  ctx.fillStyle = '#1a1f24';
  roundRect(ctx, -54, 6, 18, 40, 4); ctx.fill();
  roundRect(ctx, 36, 6, 18, 40, 4); ctx.fill();
  // hull with pattern clipped
  ctx.save();
  roundRect(ctx, -42, -12, 84, 44, 6);
  ctx.clip();
  ctx.drawImage(skinTexCanvas, -42, -12, 84, 44);
  ctx.restore();
  // turret
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, -8, 24, 17, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(skinTexCanvas, -24, -25, 48, 34);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, -8, 24, 17, 0, 0, Math.PI * 2);
  ctx.stroke();
  // barrel
  ctx.fillStyle = '#151a20';
  roundRect(ctx, -7, -52, 14, 42, 3); ctx.fill();
  ctx.restore();
}

function drawShip(ctx, cx, cy, scale, skinTexCanvas) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(0, -48);
  ctx.lineTo(30, 12);
  ctx.lineTo(22, 36);
  ctx.lineTo(-22, 36);
  ctx.lineTo(-30, 12);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  ctx.drawImage(skinTexCanvas, -32, -48, 64, 88);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.stroke();
  ctx.fillStyle = '#151a20';
  roundRect(ctx, -12, -6, 24, 22, 3); ctx.fill();
  ctx.restore();
}

function drawJet(ctx, cx, cy, scale, skinTexCanvas) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  // wings
  ctx.beginPath();
  ctx.moveTo(-60, 12);
  ctx.lineTo(0, -8);
  ctx.lineTo(60, 12);
  ctx.lineTo(42, 24);
  ctx.lineTo(0, 12);
  ctx.lineTo(-42, 24);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  ctx.drawImage(skinTexCanvas, -60, -8, 120, 36);
  ctx.restore();
  // fuselage
  ctx.beginPath();
  ctx.moveTo(0, -46);
  ctx.quadraticCurveTo(14, -10, 11, 30);
  ctx.lineTo(-11, 30);
  ctx.quadraticCurveTo(-14, -10, 0, -46);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  ctx.drawImage(skinTexCanvas, -14, -46, 28, 80);
  ctx.restore();
  ctx.fillStyle = 'rgba(160,210,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(0, -14, 7, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#151a20';
  ctx.beginPath();
  ctx.moveTo(-2, 18);
  ctx.lineTo(-2, 38);
  ctx.lineTo(14, 30);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Full inventory / shop preview: patterned vehicle on dark card.
 */
export function skinImageDataUrl(skin, domain = 'land', size = 256) {
  const key = `prev:${skin.id}|${domain}|${size}`;
  if (previewCache.has(key)) return previewCache.get(key);

  // pattern source
  const pat = document.createElement('canvas');
  pat.width = pat.height = 256;
  paintPattern(pat.getContext('2d'), 256, 256, skin);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  const accent = rarityHex(skin.rarity);

  // backdrop
  const bg = ctx.createRadialGradient(size * 0.35, size * 0.28, 8, size * 0.5, size * 0.55, size * 0.75);
  bg.addColorStop(0, shade(skin.color, 20));
  bg.addColorStop(0.45, '#141a22');
  bg.addColorStop(1, '#070b10');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // faint full-bleed pattern watermark
  ctx.globalAlpha = 0.18;
  ctx.drawImage(pat, 0, 0, size, size);
  ctx.globalAlpha = 1;

  // rarity frame
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(3, size * 0.025);
  ctx.strokeRect(size * 0.035, size * 0.035, size * 0.93, size * 0.93);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(size * 0.05, size * 0.05, size * 0.9, size * 0.9);

  const cx = size / 2;
  const cy = size * 0.48;
  const scale = size / 210;
  if (domain === 'sea') drawShip(ctx, cx, cy, scale, pat);
  else if (domain === 'air') drawJet(ctx, cx, cy, scale, pat);
  else drawTank(ctx, cx, cy, scale, pat);

  // pattern swatch strip so finish is obvious
  const swY = size * 0.72;
  const swH = size * 0.08;
  ctx.save();
  roundRect(ctx, size * 0.12, swY, size * 0.76, swH, 4);
  ctx.clip();
  ctx.drawImage(pat, size * 0.12, swY, size * 0.76, swH);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  roundRect(ctx, size * 0.12, swY, size * 0.76, swH, 4);
  ctx.stroke();

  // label
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(0, size * 0.82, size, size * 0.18);
  ctx.fillStyle = accent;
  ctx.font = `700 ${Math.floor(size * 0.065)}px "Barlow Condensed", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText((skin.shortName || 'Skin').toUpperCase(), size / 2, size * 0.915);
  ctx.fillStyle = 'rgba(215,228,236,0.55)';
  ctx.font = `600 ${Math.floor(size * 0.04)}px "IBM Plex Sans", sans-serif`;
  ctx.fillText((skin.pattern || 'solid').toUpperCase(), size / 2, size * 0.965);

  const url = canvas.toDataURL('image/png');
  previewCache.set(key, url);
  return url;
}

// silence unused
void rgb;
