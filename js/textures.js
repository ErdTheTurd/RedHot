import * as THREE from 'three';

/** Canvas-based textures for richer in-game materials */
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
  const geo = new THREE.SphereGeometry(180, 32, 16);
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#6eb0d4');
  g.addColorStop(0.45, '#9ec8e0');
  g.addColorStop(0.7, '#c5d8e4');
  g.addColorStop(0.85, '#d4c4a8');
  g.addColorStop(1, '#8a9a7a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);
  // soft sun
  const sun = ctx.createRadialGradient(380, 80, 4, 380, 80, 60);
  sun.addColorStop(0, 'rgba(255,244,200,0.95)');
  sun.addColorStop(0.4, 'rgba(255,210,140,0.35)');
  sun.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, 512, 256);

  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'skydome';
  return mesh;
}
