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
  tex.colorSpace = THREE.NoColorSpace;
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
      // low-freq blotches
      n += Math.sin(x * 0.04 + y * 0.03) * (variance * 0.25);
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
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeTerrainTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  // Base olive earth
  ctx.fillStyle = '#4a5a3c';
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const n1 = Math.sin(x * 0.02) * Math.cos(y * 0.017) * 14;
      const n2 = Math.sin(x * 0.07 + y * 0.05) * 8;
      const n3 = (Math.random() - 0.5) * 16;
      const dirt = (Math.sin(x * 0.011 + 1.7) * Math.cos(y * 0.013) + 1) * 0.5;
      const patch = dirt > 0.62 ? 1 : dirt < 0.35 ? -0.4 : 0;
      img.data[i] = Math.max(0, Math.min(255, 58 + dirt * 28 + n1 * 0.6 + n2 + n3 + patch * 12));
      img.data[i + 1] = Math.max(0, Math.min(255, 68 + (1 - dirt) * 18 + n1 * 0.7 + n3));
      img.data[i + 2] = Math.max(0, Math.min(255, 40 + dirt * 14 + n2 * 0.5 + n3 * 0.4));
    }
  }
  ctx.putImageData(img, 0, 0);
  // Soft scorch / track strokes (not hard grid)
  ctx.lineCap = 'round';
  for (let i = 0; i < 10; i++) {
    ctx.strokeStyle = `rgba(35,28,18,${0.08 + Math.random() * 0.1})`;
    ctx.lineWidth = 4 + Math.random() * 10;
    ctx.beginPath();
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (Math.random() - 0.5) * 80;
      y += (Math.random() - 0.5) * 80;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 4);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeAsphaltTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2a2e34';
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    img.data[i] = Math.max(0, Math.min(255, 42 + n));
    img.data[i + 1] = Math.max(0, Math.min(255, 46 + n));
    img.data[i + 2] = Math.max(0, Math.min(255, 52 + n));
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = 'rgba(220,200,140,0.55)';
  ctx.lineWidth = 4;
  ctx.setLineDash([18, 16]);
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 10);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeWaterTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  // Deep multi-band ocean
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#031820');
  g.addColorStop(0.25, '#0a3550');
  g.addColorStop(0.55, '#0c4a6a');
  g.addColorStop(0.8, '#0a3a58');
  g.addColorStop(1, '#052838');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Caustic-like blotches
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 12 + Math.random() * 40;
    const cg = ctx.createRadialGradient(x, y, 0, x, y, r);
    cg.addColorStop(0, 'rgba(120, 220, 255, 0.16)');
    cg.addColorStop(0.5, 'rgba(40, 140, 180, 0.06)');
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Wave crests
  for (let i = 0; i < 160; i++) {
    ctx.globalAlpha = 0.06 + Math.random() * 0.14;
    ctx.strokeStyle = i % 3 === 0 ? '#c8f0ff' : i % 3 === 1 ? '#2a7a98' : '#0e5068';
    ctx.lineWidth = 1 + Math.random() * 2.5;
    ctx.beginPath();
    const y0 = Math.random() * size;
    ctx.moveTo(0, y0);
    for (let x = 0; x < size; x += 12) {
      ctx.lineTo(
        x,
        y0
          + Math.sin(x * 0.035 + i) * (5 + Math.random() * 6)
          + Math.sin(x * 0.01 + i * 0.4) * 3
      );
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Specular glitter
  for (let i = 0; i < 220; i++) {
    ctx.fillStyle = `rgba(220,245,255,${0.05 + Math.random() * 0.18})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeSkyCanvas() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#1a3a5c');
  g.addColorStop(0.28, '#3a6a98');
  g.addColorStop(0.5, '#7eb0d0');
  g.addColorStop(0.62, '#c8dce8');
  g.addColorStop(0.72, '#e0c8a0');
  g.addColorStop(0.85, '#8a9a6a');
  g.addColorStop(1, '#4a5a40');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 512);
  // volumetric cloud banks
  for (let i = 0; i < 55; i++) {
    const x = Math.random() * 1024;
    const y = 60 + Math.random() * 200;
    const r = 50 + Math.random() * 110;
    ctx.globalAlpha = 0.12 + Math.random() * 0.2;
    const cg = ctx.createRadialGradient(x, y, 0, x, y, r);
    cg.addColorStop(0, 'rgba(255,255,255,0.95)');
    cg.addColorStop(0.45, 'rgba(220,230,240,0.4)');
    cg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const sun = ctx.createRadialGradient(820, 100, 4, 820, 100, 120);
  sun.addColorStop(0, 'rgba(255,250,220,1)');
  sun.addColorStop(0.2, 'rgba(255,210,140,0.65)');
  sun.addColorStop(0.5, 'rgba(255,180,100,0.2)');
  sun.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, 1024, 512);
  return c;
}

export function makeSkyDome() {
  const geo = new THREE.SphereGeometry(220, 64, 32);
  const tex = new THREE.CanvasTexture(makeSkyCanvas());
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false });
  return new THREE.Mesh(geo, mat);
}

/** Equirect sky used for PMREM environment reflections */
export function makeEnvMapTexture() {
  const tex = new THREE.CanvasTexture(makeSkyCanvas());
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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

export function makeExplosionTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 4, 128, 128, 120);
  g.addColorStop(0, 'rgba(255,255,240,1)');
  g.addColorStop(0.15, 'rgba(255,220,80,0.95)');
  g.addColorStop(0.35, 'rgba(255,100,20,0.75)');
  g.addColorStop(0.6, 'rgba(80,30,10,0.35)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 40 + Math.random() * 70;
    const x = 128 + Math.cos(a) * r * 0.4;
    const y = 128 + Math.sin(a) * r * 0.4;
    const blob = ctx.createRadialGradient(x, y, 0, x, y, 20 + Math.random() * 30);
    blob.addColorStop(0, 'rgba(255,180,60,0.8)');
    blob.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = blob;
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}

export function makeSmokeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 18; i++) {
    const x = 60 + Math.random() * 136;
    const y = 60 + Math.random() * 136;
    const r = 35 + Math.random() * 55;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(200,210,220,${0.35 + Math.random() * 0.35})`);
    g.addColorStop(1, 'rgba(160,170,180,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}

export function makeShockwaveTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  const g = ctx.createRadialGradient(128, 128, 70, 128, 128, 120);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.7, 'rgba(255,240,200,0)');
  g.addColorStop(0.85, 'rgba(255,220,160,0.85)');
  g.addColorStop(1, 'rgba(255,180,80,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(c);
}
