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
  ctx.fillStyle = '#0d1116';
  roundRect(ctx, -58, 8, 20, 44, 4); ctx.fill();
  roundRect(ctx, 38, 8, 20, 44, 4); ctx.fill();
  ctx.fillStyle = '#1a222c';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(-54, 12 + i * 8, 12, 3);
    ctx.fillRect(42, 12 + i * 8, 12, 3);
  }
  // hull with pattern clipped
  ctx.save();
  roundRect(ctx, -46, -14, 92, 48, 7);
  ctx.clip();
  ctx.drawImage(skinTexCanvas, -46, -14, 92, 48);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  roundRect(ctx, -46, -14, 92, 48, 7);
  ctx.stroke();
  // turret
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, -10, 28, 20, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(skinTexCanvas, -28, -30, 56, 40);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(0, -10, 28, 20, 0, 0, Math.PI * 2);
  ctx.stroke();
  // barrel
  ctx.fillStyle = '#0d1116';
  roundRect(ctx, -8, -58, 16, 48, 3); ctx.fill();
  ctx.fillStyle = shade('#0d1116', 30);
  roundRect(ctx, -6, -58, 12, 8, 2); ctx.fill();
  ctx.restore();
}

function drawShip(ctx, cx, cy, scale, skinTexCanvas) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(0, -54);
  ctx.lineTo(34, 10);
  ctx.lineTo(24, 42);
  ctx.lineTo(-24, 42);
  ctx.lineTo(-34, 10);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  ctx.drawImage(skinTexCanvas, -36, -54, 72, 100);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#0d1116';
  roundRect(ctx, -14, -8, 28, 26, 3); ctx.fill();
  ctx.fillStyle = 'rgba(160,210,255,0.35)';
  roundRect(ctx, -8, -2, 16, 10, 2); ctx.fill();
  ctx.restore();
}

function drawJet(ctx, cx, cy, scale, skinTexCanvas) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  // wings
  ctx.beginPath();
  ctx.moveTo(-68, 14);
  ctx.lineTo(0, -10);
  ctx.lineTo(68, 14);
  ctx.lineTo(48, 28);
  ctx.lineTo(0, 14);
  ctx.lineTo(-48, 28);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  ctx.drawImage(skinTexCanvas, -68, -10, 136, 42);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // fuselage
  ctx.beginPath();
  ctx.moveTo(0, -52);
  ctx.quadraticCurveTo(16, -10, 12, 34);
  ctx.lineTo(-12, 34);
  ctx.quadraticCurveTo(-16, -10, 0, -52);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  ctx.drawImage(skinTexCanvas, -16, -52, 32, 90);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.stroke();
  ctx.fillStyle = 'rgba(160,210,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(0, -16, 8, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0d1116';
  ctx.beginPath();
  ctx.moveTo(-3, 20);
  ctx.lineTo(-3, 42);
  ctx.lineTo(16, 32);
  ctx.closePath();
  ctx.fill();
  // afterburner glow
  ctx.fillStyle = 'rgba(80,180,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(0, 36, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Full-bleed CS-style skin tile: pattern fills the square edge-to-edge,
 * with a huge vehicle silhouette cut from the same finish.
 */
export function skinImageDataUrl(skin, domain = 'land', size = 256) {
  const key = `prev2:${skin.id}|${domain}|${size}`;
  if (previewCache.has(key)) return previewCache.get(key);

  const patSize = Math.max(512, size * 2);
  const pat = document.createElement('canvas');
  pat.width = pat.height = patSize;
  paintPattern(pat.getContext('2d'), patSize, patSize, skin);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const accent = rarityHex(skin.rarity);
  const seed = (skin.id || '').length + (skin.color | 0);

  // Edge-to-edge finish — the square IS the skin
  ctx.drawImage(pat, 0, 0, size, size);

  // Depth vignette so the silhouette reads
  const vig = ctx.createRadialGradient(size * 0.5, size * 0.45, size * 0.15, size * 0.5, size * 0.55, size * 0.78);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(0.55, 'rgba(0,0,0,0.12)');
  vig.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, size, size);

  // Giant patterned vehicle filling most of the tile
  const cx = size / 2;
  const cy = size * 0.5;
  const scale = size / 105;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = size * 0.08;
  ctx.shadowOffsetY = size * 0.02;
  if (domain === 'sea') drawShip(ctx, cx, cy, scale, pat);
  else if (domain === 'air') drawJet(ctx, cx, cy, scale, pat);
  else drawTank(ctx, cx, cy, scale, pat);
  ctx.restore();

  // Specular slash across the finish
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const slash = ctx.createLinearGradient(0, 0, size, size);
  slash.addColorStop(0, 'rgba(255,255,255,0)');
  slash.addColorStop(0.42, 'rgba(255,255,255,0)');
  slash.addColorStop(0.5, 'rgba(255,255,255,0.22)');
  slash.addColorStop(0.58, 'rgba(255,255,255,0)');
  slash.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = slash;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  // High-tier emissive bloom
  const glowTiers = { restricted: 0.12, classified: 0.18, covert: 0.24, extraordinary: 0.32 };
  const glowA = glowTiers[skin.rarity] || 0;
  if (glowA > 0) {
    const bloom = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.1, size * 0.5, size * 0.5, size * 0.65);
    bloom.addColorStop(0, hexToRgba(accent, glowA));
    bloom.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bloom;
    ctx.globalCompositeOperation = 'screen';
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';
  }

  // Micro scuffs for lower grades / stock
  if (skin.isDefault || skin.rarity === 'consumer' || skin.rarity === 'industrial') {
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const x = hash(seed + i * 17) * size;
      const y = hash(seed + i * 29) * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 8 + hash(i) * 18, y + (hash(i + 3) - 0.5) * 10);
      ctx.stroke();
    }
  }

  // Rarity edge rail (CS inventory accent)
  const rail = Math.max(4, Math.floor(size * 0.045));
  ctx.fillStyle = accent;
  ctx.fillRect(0, size - rail, size, rail);
  // soft inner highlight on top edge
  const topG = ctx.createLinearGradient(0, 0, 0, size * 0.18);
  topG.addColorStop(0, 'rgba(255,255,255,0.22)');
  topG.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = topG;
  ctx.fillRect(0, 0, size, size * 0.18);

  // Thin outer frame
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, size - 1, size - 1);

  const url = canvas.toDataURL('image/png');
  previewCache.set(key, url);
  return url;
}

function hexToRgba(hex, a) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
