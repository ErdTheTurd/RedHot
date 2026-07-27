import * as THREE from 'three';

/** Procedural PBR helper maps for military vehicles */
export function makePanelNormalMap(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(40,40,120,0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i < size; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
  }
  // rivets
  for (let y = 16; y < size; y += 32) {
    for (let x = 16; x < size; x += 32) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, 4);
      g.addColorStop(0, '#c0c0ff');
      g.addColorStop(1, '#6060cc');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

export function makeNoiseTexture(size = 256, opts = {}) {
  const {
    base = [40, 55, 45],
    variance = 28,
    stripes = false,
    grid = false,
  } = opts;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let n = (Math.random() - 0.5) * variance;
      if (stripes) n += Math.sin(x * 0.35) * 10;
      if (grid && (x % 32 < 1 || y % 32 < 1)) n -= 20;
      img.data[i] = Math.max(0, Math.min(255, base[0] + n));
      img.data[i + 1] = Math.max(0, Math.min(255, base[1] + n));
      img.data[i + 2] = Math.max(0, Math.min(255, base[2] + n));
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

export function makeWaterTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#0a3048');
  g.addColorStop(0.5, '#0e4a66');
  g.addColorStop(1, '#082838');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.15;
  for (let i = 0; i < 80; i++) {
    ctx.strokeStyle = i % 2 ? '#7ec8e3' : '#1a6a88';
    ctx.beginPath();
    const y = Math.random() * size;
    ctx.moveTo(0, y);
    for (let x = 0; x < size; x += 20) {
      ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 6);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  return tex;
}

export function makeSkyDome() {
  const geo = new THREE.SphereGeometry(180, 48, 24);
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#4a7aa0');
  g.addColorStop(0.35, '#7eb0d0');
  g.addColorStop(0.55, '#b8d4e8');
  g.addColorStop(0.72, '#d8c8a8');
  g.addColorStop(0.88, '#9aaa7a');
  g.addColorStop(1, '#5a6a50');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 512);
  // clouds
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 1024;
    const y = 80 + Math.random() * 180;
    const r = 40 + Math.random() * 90;
    const cg = ctx.createRadialGradient(x, y, 0, x, y, r);
    cg.addColorStop(0, 'rgba(255,255,255,0.9)');
    cg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const sun = ctx.createRadialGradient(780, 120, 4, 780, 120, 90);
  sun.addColorStop(0, 'rgba(255,244,200,1)');
  sun.addColorStop(0.25, 'rgba(255,210,140,0.55)');
  sun.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, 1024, 512);

  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false });
  return new THREE.Mesh(geo, mat);
}

export function makeMuzzleFlashTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 60);
  g.addColorStop(0, 'rgba(255,255,220,1)');
  g.addColorStop(0.2, 'rgba(255,200,80,0.9)');
  g.addColorStop(0.5, 'rgba(255,100,20,0.45)');
  g.addColorStop(1, 'rgba(255,40,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  // star spikes
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.strokeStyle = 'rgba(255,230,160,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(64, 64);
    ctx.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}
