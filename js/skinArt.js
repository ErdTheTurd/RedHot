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

/** Deterministic noise from seed */
function hash(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Paint a finish pattern into an existing canvas context.
 * Patterns: solid, camo, digital, hex, carbon, tiger, rust, circuit, pearl, scale,
 * stripes, mesh, splatter, magma, aurora, holo, plasma, prism, nova, obsidian, fractal
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
  } else if (pattern === 'magma') {
    ctx.fillStyle = shade(skin.color, -50);
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 36; i++) {
      const g = ctx.createRadialGradient(
        hash(seed + i) * w, hash(seed + i + 3) * h, 2,
        hash(seed + i) * w, hash(seed + i + 3) * h, 20 + hash(i) * 40
      );
      g.addColorStop(0, tertiary);
      g.addColorStop(0.45, secondary);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.55 + hash(i) * 0.4;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = tertiary;
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.moveTo(hash(i) * w, hash(i + 2) * h);
      ctx.bezierCurveTo(
        hash(i + 4) * w, hash(i + 5) * h,
        hash(i + 6) * w, hash(i + 7) * h,
        hash(i + 8) * w, hash(i + 9) * h
      );
      ctx.stroke();
    }
  } else if (pattern === 'aurora') {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, primary);
    g.addColorStop(0.35, secondary);
    g.addColorStop(0.65, tertiary);
    g.addColorStop(1, shade(skin.color, -40));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      ctx.strokeStyle = i % 2 ? tertiary : secondary;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 10 + hash(i) * 18;
      ctx.beginPath();
      const y0 = hash(seed + i) * h;
      ctx.moveTo(0, y0);
      for (let x = 0; x <= w; x += 24) {
        ctx.lineTo(x, y0 + Math.sin(x * 0.02 + i) * 28 * hash(i + 1));
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (pattern === 'holo') {
    for (let y = 0; y < h; y++) {
      const t = y / h;
      const r = Math.floor(120 + Math.sin(t * 6.2 + seed) * 100);
      const g = Math.floor(100 + Math.sin(t * 6.2 + 2.1) * 110);
      const b = Math.floor(140 + Math.sin(t * 6.2 + 4.2) * 100);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(0, y, w, 1);
    }
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 20; i++) {
      ctx.strokeStyle = tertiary;
      ctx.lineWidth = 2;
      const x = hash(seed + i) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (hash(i) - 0.5) * 40, h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (pattern === 'plasma') {
    ctx.fillStyle = shade(skin.color, -60);
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 55; i++) {
      const x = hash(seed + i * 2) * w;
      const y = hash(seed + i * 5) * h;
      const rad = 8 + hash(i) * 28;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, tertiary);
      g.addColorStop(0.4, secondary);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (pattern === 'prism') {
    for (let i = 0; i < 14; i++) {
      const colors = [primary, secondary, tertiary, shade(skin.color, 40), shade(skin.color, -30)];
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      const x0 = (i / 14) * w - 20;
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0 + w * 0.22, 0);
      ctx.lineTo(x0 + w * 0.08, h);
      ctx.lineTo(x0 - w * 0.12, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 0.3;
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.addColorStop(1, '#ffffff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  } else if (pattern === 'nova') {
    ctx.fillStyle = shade(skin.color, -70);
    ctx.fillRect(0, 0, w, h);
    const cx = w * 0.5;
    const cy = h * 0.45;
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      ctx.strokeStyle = i % 2 ? tertiary : secondary;
      ctx.globalAlpha = 0.35 + hash(i) * 0.5;
      ctx.lineWidth = 1 + hash(i) * 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * w * 0.7, cy + Math.sin(a) * h * 0.7);
      ctx.stroke();
    }
    const core = ctx.createRadialGradient(cx, cy, 2, cx, cy, w * 0.35);
    core.addColorStop(0, tertiary);
    core.addColorStop(0.4, secondary);
    core.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, w, h);
  } else if (pattern === 'obsidian') {
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = hash(i) > 0.5 ? secondary : tertiary;
      ctx.globalAlpha = 0.25 + hash(i + 2) * 0.35;
      ctx.beginPath();
      const x = hash(seed + i) * w;
      const y = hash(seed + i * 3) * h;
      ctx.moveTo(x, y);
      ctx.lineTo(x + 40 + hash(i) * 60, y + 10);
      ctx.lineTo(x + 20, y + 50 + hash(i) * 40);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const sheen = ctx.createLinearGradient(0, 0, w, h);
    sheen.addColorStop(0.2, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.45, 'rgba(255,255,255,0.2)');
    sheen.addColorStop(0.55, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, w, h);
  } else if (pattern === 'fractal') {
    ctx.fillStyle = shade(skin.color, -40);
    ctx.fillRect(0, 0, w, h);
    const drawBranch = (x, y, ang, len, depth) => {
      if (depth <= 0 || len < 3) return;
      const x2 = x + Math.cos(ang) * len;
      const y2 = y + Math.sin(ang) * len;
      ctx.strokeStyle = depth % 2 ? secondary : tertiary;
      ctx.globalAlpha = 0.35 + depth * 0.1;
      ctx.lineWidth = Math.max(1, depth * 0.7);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      drawBranch(x2, y2, ang - 0.45, len * 0.72, depth - 1);
      drawBranch(x2, y2, ang + 0.5, len * 0.68, depth - 1);
    };
    for (let i = 0; i < 6; i++) {
      drawBranch(w * 0.5, h * 0.85, -Math.PI / 2 + (i - 2.5) * 0.2, h * 0.22, 6);
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

/**
 * Full-bleed CS-style skin tile: the finish fills the square edge-to-edge.
 * Vehicle identity lives in the card text — the art is the paint job.
 */
export function skinImageDataUrl(skin, domain = 'land', size = 256) {
  const key = `prev3:${skin.id}|${domain}|${size}`;
  if (previewCache.has(key)) return previewCache.get(key);
  void domain; // kept in key/signature for callers & future domain accents

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

  // Soft perspective warp band (depth without shrinking the paint)
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.translate(size * 0.5, size * 0.55);
  ctx.scale(1.15, 0.55);
  ctx.rotate(-0.18);
  ctx.drawImage(pat, -size * 0.55, -size * 0.35, size * 1.1, size * 0.7);
  ctx.restore();
  ctx.globalAlpha = 1;

  // Corner light + bottom weight
  const corner = ctx.createRadialGradient(size * 0.18, size * 0.12, 2, size * 0.18, size * 0.12, size * 0.55);
  corner.addColorStop(0, 'rgba(255,255,255,0.28)');
  corner.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = corner;
  ctx.fillRect(0, 0, size, size);

  const floor = ctx.createLinearGradient(0, size * 0.55, 0, size);
  floor.addColorStop(0, 'rgba(0,0,0,0)');
  floor.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, size, size);

  // Specular slash
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const slash = ctx.createLinearGradient(0, 0, size, size);
  slash.addColorStop(0, 'rgba(255,255,255,0)');
  slash.addColorStop(0.44, 'rgba(255,255,255,0)');
  slash.addColorStop(0.5, 'rgba(255,255,255,0.28)');
  slash.addColorStop(0.56, 'rgba(255,255,255,0)');
  slash.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = slash;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  // High-tier emissive bloom
  const glowTiers = { restricted: 0.14, classified: 0.2, covert: 0.28, extraordinary: 0.36 };
  const glowA = glowTiers[skin.rarity] || 0;
  if (glowA > 0) {
    const bloom = ctx.createRadialGradient(size * 0.5, size * 0.45, size * 0.08, size * 0.5, size * 0.5, size * 0.7);
    bloom.addColorStop(0, hexToRgba(accent, glowA));
    bloom.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bloom;
    ctx.globalCompositeOperation = 'screen';
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';
  }

  // Micro scuffs for lower grades / stock
  if (skin.isDefault || skin.rarity === 'consumer' || skin.rarity === 'industrial') {
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const x = hash(seed + i * 17) * size;
      const y = hash(seed + i * 29) * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 10 + hash(i) * 22, y + (hash(i + 3) - 0.5) * 12);
      ctx.stroke();
    }
  }

  // Rarity edge rail
  const rail = Math.max(5, Math.floor(size * 0.05));
  ctx.fillStyle = accent;
  ctx.fillRect(0, size - rail, size, rail);
  // Thin accent tick on the left (CS vibe)
  ctx.fillRect(0, 0, Math.max(3, size * 0.018), size);

  const topG = ctx.createLinearGradient(0, 0, 0, size * 0.2);
  topG.addColorStop(0, 'rgba(255,255,255,0.2)');
  topG.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = topG;
  ctx.fillRect(0, 0, size, size * 0.2);

  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, size - 1, size - 1);

  const url = canvas.toDataURL('image/png');
  previewCache.set(key, url);
  return url;
}

/** Fleet craft card art — silhouette by domain/style with optional skin paint. */
export function vehicleImageDataUrl(vehicle, skin = null, size = 256) {
  const sid = skin?.id || 'stock';
  const key = `veh:${vehicle.id}|${sid}|${size}`;
  if (previewCache.has(key)) return previewCache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const col = skin?.color ?? vehicle.color ?? 0x888888;
  const sec = skin?.secondary ?? ((col >> 1) & 0x7f7f7f);
  const accent = rarityHex(vehicle.rarity || skin?.rarity || 'milspec');

  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, hexColor(sec));
  g.addColorStop(1, '#0a1016');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  if (skin && !skin.isDefault) {
    paintPattern(ctx, size, size, { ...skin, color: col, secondary: sec });
    ctx.fillStyle = 'rgba(8,12,18,0.35)';
    ctx.fillRect(0, 0, size, size);
  }

  ctx.fillStyle = hexColor(col);
  ctx.strokeStyle = hexColor(sec);
  ctx.lineWidth = 3;
  const cx = size * 0.5;
  const cy = size * 0.52;
  const domain = vehicle.domain;
  const style = vehicle.style || '';

  ctx.beginPath();
  if (domain === 'land') {
    // hull
    ctx.beginPath();
    ctx.rect(cx - size * 0.32, cy - size * 0.08, size * 0.64, size * 0.22);
    ctx.fill();
    // turret / plow / fang accents
    ctx.beginPath();
    if (style === 'apc') ctx.rect(cx - size * 0.22, cy - size * 0.18, size * 0.44, size * 0.14);
    else if (style === 'frost') {
      ctx.moveTo(cx - size * 0.38, cy + size * 0.02);
      ctx.lineTo(cx - size * 0.1, cy - size * 0.2);
      ctx.lineTo(cx + size * 0.38, cy + size * 0.02);
      ctx.closePath();
    } else if (style === 'fang' || style === 'titan') {
      ctx.ellipse(cx, cy - size * 0.05, size * 0.18, size * 0.12, 0, 0, Math.PI * 2);
    } else {
      ctx.ellipse(cx, cy - size * 0.06, size * 0.16, size * 0.11, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    // barrel
    ctx.fillRect(cx - size * 0.04, cy - size * 0.1, size * 0.08, -size * (style === 'fang' ? 0.32 : 0.22));
    // tracks
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(cx - size * 0.34, cy + size * 0.12, size * 0.68, size * 0.08);
  } else if (domain === 'sea') {
    ctx.moveTo(cx - size * 0.36, cy + size * 0.08);
    ctx.lineTo(cx - size * 0.28, cy - size * 0.06);
    ctx.lineTo(cx + size * 0.34, cy - size * 0.02);
    ctx.lineTo(cx + size * 0.3, cy + size * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    if (style === 'battleship' || style === 'leviathan') {
      ctx.rect(cx - size * 0.12, cy - size * 0.22, size * 0.24, size * 0.18);
      ctx.rect(cx - size * 0.28, cy - size * 0.14, size * 0.16, size * 0.1);
      ctx.rect(cx + size * 0.12, cy - size * 0.14, size * 0.16, size * 0.1);
    } else if (style === 'hydro') {
      ctx.moveTo(cx - size * 0.3, cy + size * 0.1);
      ctx.lineTo(cx - size * 0.35, cy + size * 0.22);
      ctx.lineTo(cx - size * 0.2, cy + size * 0.1);
      ctx.moveTo(cx + size * 0.3, cy + size * 0.1);
      ctx.lineTo(cx + size * 0.35, cy + size * 0.22);
      ctx.lineTo(cx + size * 0.2, cy + size * 0.1);
    } else {
      ctx.rect(cx - size * 0.1, cy - size * 0.18, size * 0.2, size * 0.14);
    }
    ctx.fill();
  } else {
    // jet / drone
    if (style === 'wasp') {
      ctx.ellipse(cx, cy, size * 0.16, size * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - size * 0.28, cy - size * 0.08, size * 0.14, size * 0.04, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + size * 0.28, cy - size * 0.08, size * 0.14, size * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (style === 'stealth' || style === 'eclipse') {
      ctx.moveTo(cx, cy - size * 0.12);
      ctx.lineTo(cx + size * 0.42, cy + size * 0.1);
      ctx.lineTo(cx, cy + size * 0.06);
      ctx.lineTo(cx - size * 0.42, cy + size * 0.1);
      ctx.closePath();
      ctx.fill();
    } else if (style === 'dart') {
      ctx.moveTo(cx, cy - size * 0.28);
      ctx.lineTo(cx + size * 0.1, cy + size * 0.2);
      ctx.lineTo(cx - size * 0.1, cy + size * 0.2);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.moveTo(cx, cy - size * 0.22);
      ctx.lineTo(cx + size * 0.12, cy);
      ctx.lineTo(cx + size * 0.38, cy + size * 0.06);
      ctx.lineTo(cx + size * 0.1, cy + size * 0.1);
      ctx.lineTo(cx, cy + size * 0.18);
      ctx.lineTo(cx - size * 0.1, cy + size * 0.1);
      ctx.lineTo(cx - size * 0.38, cy + size * 0.06);
      ctx.lineTo(cx - size * 0.12, cy);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.fillStyle = accent;
  ctx.fillRect(0, size - Math.max(5, size * 0.05), size, Math.max(5, size * 0.05));
  ctx.fillRect(0, 0, Math.max(3, size * 0.018), size);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `700 ${Math.floor(size * 0.07)}px "Barlow Condensed", sans-serif`;
  ctx.fillText((vehicle.className || domain).toUpperCase(), size * 0.06, size * 0.12);

  const url = canvas.toDataURL('image/png');
  previewCache.set(key, url);
  return url;
}

function hexToRgba(hex, a) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
