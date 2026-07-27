import * as THREE from 'three';
import {
  makeMuzzleFlashTexture,
  makeExplosionTexture,
  makeSmokeTexture,
  makeShockwaveTexture,
} from './textures.js';

let muzzleTex = null;
let boomTex = null;
let smokeTex = null;
let shockTex = null;

function getMuzzleTex() {
  if (!muzzleTex) muzzleTex = makeMuzzleFlashTexture();
  return muzzleTex;
}
function getBoomTex() {
  if (!boomTex) boomTex = makeExplosionTexture();
  return boomTex;
}
function getSmokeTex() {
  if (!smokeTex) smokeTex = makeSmokeTexture();
  return smokeTex;
}
function getShockTex() {
  if (!shockTex) shockTex = makeShockwaveTexture();
  return shockTex;
}

/** High-detail shell / rocket / cannon round */
export function createProjectileMesh(heavy = false) {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({
    color: heavy ? 0xc8a050 : 0xd8dde0,
    metalness: 0.92,
    roughness: 0.18,
    emissive: heavy ? 0x402000 : 0x202428,
    emissiveIntensity: 0.4,
  });
  const tipMat = new THREE.MeshStandardMaterial({
    color: heavy ? 0xff6622 : 0xffcc66,
    metalness: 0.5,
    roughness: 0.28,
    emissive: heavy ? 0xff4400 : 0xffaa33,
    emissiveIntensity: 0.9,
  });

  const length = heavy ? 1.15 : 0.58;
  const radius = heavy ? 0.095 : 0.048;

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.85, radius, length * 0.7, 12),
    steel
  );
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = length * 0.05;
  g.add(shaft);

  const tip = new THREE.Mesh(new THREE.ConeGeometry(radius, length * 0.35, 12), tipMat);
  tip.rotation.x = -Math.PI / 2;
  tip.position.z = -length * 0.4;
  g.add(tip);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.15, radius * 0.9, length * 0.12, 12),
    steel
  );
  base.rotation.x = Math.PI / 2;
  base.position.z = length * 0.38;
  g.add(base);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.5, 10, 10),
    new THREE.MeshBasicMaterial({
      color: heavy ? 0xff6622 : 0xffe088,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    })
  );
  g.add(glow);

  const trail = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2.4, length * (heavy ? 5.2 : 3.6)),
    new THREE.MeshBasicMaterial({
      color: heavy ? 0xff7530 : 0xffe0a0,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
  );
  trail.rotation.x = Math.PI / 2;
  trail.position.z = length * 1.25;
  g.add(trail);
  g.userData.trail = trail;
  g.userData.glow = glow;

  return g;
}

/** Air-dropped freefall bomb */
export function createBombMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.18, 0.7, 10),
    new THREE.MeshStandardMaterial({ color: 0x2a3038, metalness: 0.7, roughness: 0.35 })
  );
  g.add(body);
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.28, 10),
    new THREE.MeshStandardMaterial({ color: 0x1a1e24, metalness: 0.6, roughness: 0.4, emissive: 0x401000, emissiveIntensity: 0.3 })
  );
  nose.position.y = -0.45;
  g.add(nose);
  const finMat = new THREE.MeshStandardMaterial({ color: 0x4a5560, metalness: 0.5, roughness: 0.45 });
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.18), finMat);
    const a = (i / 4) * Math.PI * 2;
    fin.position.set(Math.cos(a) * 0.16, 0.28, Math.sin(a) * 0.16);
    g.add(fin);
  }
  return g;
}

/** Ship torpedo — long sleek water weapon */
export function createTorpedoMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.12, 1.4, 12),
    new THREE.MeshStandardMaterial({ color: 0x3a6a58, metalness: 0.85, roughness: 0.25, emissive: 0x0a3020, emissiveIntensity: 0.25 })
  );
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.35, 12),
    new THREE.MeshStandardMaterial({ color: 0xc8a040, metalness: 0.7, roughness: 0.3, emissive: 0x604000, emissiveIntensity: 0.4 })
  );
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -0.85;
  g.add(nose);
  const trail = new THREE.Mesh(
    new THREE.PlaneGeometry(0.25, 1.8),
    new THREE.MeshBasicMaterial({
      color: 0x88ffe0,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
  );
  trail.rotation.x = Math.PI / 2;
  trail.position.z = 1.1;
  g.add(trail);
  g.userData.trail = trail;
  return g;
}

export function spawnMuzzleFlash(scene, position, direction, heavy = false) {
  const tex = getMuzzleTex();
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 1,
  });
  const sprite = new THREE.Sprite(mat);
  const scale = heavy ? 3.6 : 1.9;
  sprite.scale.set(scale * 1.35, scale * 0.85, 1);
  sprite.position.copy(position).addScaledVector(direction, 0.85);
  sprite.userData.life = 0.09;
  sprite.userData.maxLife = 0.09;
  scene.add(sprite);

  // Secondary flash disc
  const disc = new THREE.Sprite(mat.clone());
  disc.scale.set(scale * 0.6, scale * 0.6, 1);
  disc.position.copy(sprite.position).addScaledVector(direction, 0.35);
  disc.userData.life = 0.06;
  disc.userData.maxLife = 0.06;
  scene.add(disc);

  const light = new THREE.PointLight(heavy ? 0xff7722 : 0xffcc66, heavy ? 28 : 14, heavy ? 18 : 10, 2);
  light.position.copy(sprite.position);
  light.userData.life = 0.08;
  light.userData.maxLife = 0.08;
  scene.add(light);

  const sparks = [];
  for (let i = 0; i < (heavy ? 14 : 8); i++) {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.035 + Math.random() * 0.05, 5, 5),
      new THREE.MeshBasicMaterial({ color: Math.random() > 0.4 ? 0xffcc55 : 0xff5522 })
    );
    s.position.copy(sprite.position);
    s.userData.vel = direction.clone()
      .add(new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5).multiplyScalar(2.2))
      .multiplyScalar(10 + Math.random() * 14);
    s.userData.life = 0.18 + Math.random() * 0.2;
    scene.add(s);
    sparks.push(s);
  }

  return { sprite, disc, light, sparks };
}

export function spawnImpact(scene, position, heavy = false) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.userData.life = heavy ? 0.7 : 0.5;
  group.userData.isImpact = true;

  const flash = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getBoomTex(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  flash.scale.set(heavy ? 2.8 : 1.5, heavy ? 2.8 : 1.5, 1);
  group.add(flash);

  for (let i = 0; i < (heavy ? 18 : 12); i++) {
    const shard = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, 0.16 + Math.random() * 0.22),
      new THREE.MeshStandardMaterial({
        color: Math.random() > 0.4 ? 0xffaa44 : 0x888888,
        metalness: 0.75,
        roughness: 0.3,
        emissive: 0xff6622,
        emissiveIntensity: 0.55,
      })
    );
    shard.position.set((Math.random() - 0.5) * 0.5, Math.random() * 0.35, (Math.random() - 0.5) * 0.5);
    shard.userData.vel = new THREE.Vector3(
      (Math.random() - 0.5) * 14,
      5 + Math.random() * 12,
      (Math.random() - 0.5) * 14
    );
    shard.userData.spin = new THREE.Vector3(Math.random(), Math.random(), Math.random());
    group.add(shard);
  }

  const light = new THREE.PointLight(0xff8833, heavy ? 22 : 12, 14, 2);
  light.userData.fadeLight = true;
  group.add(light);

  scene.add(group);
  return group;
}

/** Layered fireball + shock ring + debris — COD kill pop */
export function spawnExplosion(scene, position, scale = 1) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.userData.life = 1.15;
  group.userData.maxLife = 1.15;
  group.userData.isExplosion = true;

  const core = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getBoomTex(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 1,
    })
  );
  core.scale.set(3.5 * scale, 3.5 * scale, 1);
  core.userData.expand = 14;
  group.add(core);

  const fire = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getBoomTex(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.9,
      color: 0xff6622,
    })
  );
  fire.scale.set(5 * scale, 5 * scale, 1);
  fire.userData.expand = 10;
  group.add(fire);

  const shock = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getShockTex(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.95,
    })
  );
  shock.scale.set(2 * scale, 2 * scale, 1);
  shock.userData.expand = 28;
  shock.userData.isShock = true;
  group.add(shock);

  // Rising smoke puffs
  for (let i = 0; i < 6; i++) {
    const puff = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: getSmokeTex(),
        transparent: true,
        depthWrite: false,
        opacity: 0.55,
        color: 0xb0b8c0,
      })
    );
    puff.position.set(
      (Math.random() - 0.5) * 1.5,
      0.4 + Math.random(),
      (Math.random() - 0.5) * 1.5
    );
    puff.scale.set(2.2 * scale, 2.2 * scale, 1);
    puff.userData.vel = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      2 + Math.random() * 3,
      (Math.random() - 0.5) * 2
    );
    puff.userData.expand = 3;
    puff.userData.isSmoke = true;
    group.add(puff);
  }

  // Debris
  for (let i = 0; i < 20; i++) {
    const shard = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.25 + Math.random() * 0.3),
      new THREE.MeshStandardMaterial({
        color: Math.random() > 0.5 ? 0xffaa44 : 0x555555,
        metalness: 0.7,
        roughness: 0.35,
        emissive: 0xff4400,
        emissiveIntensity: 0.6,
      })
    );
    shard.userData.vel = new THREE.Vector3(
      (Math.random() - 0.5) * 22,
      8 + Math.random() * 16,
      (Math.random() - 0.5) * 22
    );
    shard.userData.spin = new THREE.Vector3(Math.random(), Math.random(), Math.random());
    group.add(shard);
  }

  const light = new THREE.PointLight(0xff6622, 28 * scale, 28, 2);
  light.userData.fadeLight = true;
  group.add(light);

  scene.add(group);
  return group;
}

/** Billboard smoke barrage cloud */
export function spawnSmokeCloud(scene, position) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.userData.life = 12;
  group.userData.maxLife = 12;
  group.userData.isSmokeField = true;

  for (let i = 0; i < 16; i++) {
    const puff = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: getSmokeTex(),
        transparent: true,
        depthWrite: false,
        opacity: 0.45 + Math.random() * 0.25,
        color: 0xc0c8d0,
      })
    );
    const a = (i / 16) * Math.PI * 2;
    const r = 1.5 + Math.random() * 4;
    puff.position.set(Math.cos(a) * r, Math.random() * 2.5, Math.sin(a) * r);
    const s = 4 + Math.random() * 5;
    puff.scale.set(s, s, 1);
    puff.userData.vel = new THREE.Vector3(
      (Math.random() - 0.5) * 0.6,
      0.35 + Math.random() * 0.5,
      (Math.random() - 0.5) * 0.6
    );
    puff.userData.spin = (Math.random() - 0.5) * 0.4;
    group.add(puff);
  }

  scene.add(group);
  return group;
}

/** Expanding EMP torus + flash */
export function spawnEmpBurst(scene, position) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.userData.life = 0.85;
  group.userData.maxLife = 0.85;
  group.userData.isEmp = true;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, 0.12, 10, 48),
    new THREE.MeshBasicMaterial({
      color: 0x88e8ff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  ring.rotation.x = Math.PI / 2;
  ring.userData.expand = 36;
  group.add(ring);

  const ring2 = ring.clone();
  ring2.scale.setScalar(0.7);
  ring2.material = ring.material.clone();
  ring2.material.color.set(0xffffff);
  ring2.userData.expand = 42;
  group.add(ring2);

  const flash = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getMuzzleTex(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xaaffff,
      opacity: 1,
    })
  );
  flash.scale.set(8, 8, 1);
  group.add(flash);

  const light = new THREE.PointLight(0x88e8ff, 40, 40, 2);
  light.userData.fadeLight = true;
  group.add(light);

  scene.add(group);
  return group;
}

export function orientProjectile(mesh, dir) {
  const look = dir.clone().normalize();
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), look);
}

export function updateVfxList(list, dt, scene) {
  const keep = [];
  for (const fx of list) {
    if (fx.isMuzzle) {
      fx.sprite.userData.life -= dt;
      const t = fx.sprite.userData.life / fx.sprite.userData.maxLife;
      fx.sprite.material.opacity = Math.max(0, t);
      fx.sprite.scale.multiplyScalar(1 + dt * 10);
      if (fx.disc) {
        fx.disc.userData.life -= dt;
        fx.disc.material.opacity = Math.max(0, fx.disc.userData.life / fx.disc.userData.maxLife);
        fx.disc.scale.multiplyScalar(1 + dt * 12);
        if (fx.disc.userData.life <= 0) scene.remove(fx.disc);
      }
      if (fx.light) {
        fx.light.userData.life -= dt;
        fx.light.intensity *= Math.max(0, 1 - dt * 14);
        if (fx.light.userData.life <= 0) scene.remove(fx.light);
      }
      for (const s of fx.sparks) {
        s.userData.life -= dt;
        s.position.addScaledVector(s.userData.vel, dt);
        s.userData.vel.y -= 22 * dt;
        if (s.userData.life <= 0) scene.remove(s);
      }
      fx.sparks = fx.sparks.filter((s) => s.userData.life > 0);
      if (fx.sprite.userData.life <= 0) {
        scene.remove(fx.sprite);
      } else keep.push(fx);
      continue;
    }

    fx.userData.life -= dt;
    const lifeT = fx.userData.maxLife ? fx.userData.life / fx.userData.maxLife : fx.userData.life;

    fx.children.forEach((ch) => {
      if (ch.userData?.vel) {
        ch.position.addScaledVector(ch.userData.vel, dt);
        if (!ch.userData.isSmoke) ch.userData.vel.y -= 18 * dt;
        if (ch.userData.spin && ch.rotation) {
          if (typeof ch.userData.spin === 'number') {
            ch.material.rotation = (ch.material.rotation || 0) + ch.userData.spin * dt;
          } else {
            ch.rotation.x += ch.userData.spin.x * dt * 10;
            ch.rotation.y += ch.userData.spin.y * dt * 10;
          }
        }
      }
      if (ch.userData?.expand) {
        const grow = 1 + ch.userData.expand * dt;
        ch.scale.multiplyScalar(grow);
      }
      if (ch.isSprite) {
        if (ch.userData?.isShock) {
          ch.material.opacity = Math.max(0, lifeT * 1.2);
        } else if (ch.userData?.isSmoke) {
          ch.material.opacity = Math.max(0, lifeT * 0.55);
        } else {
          ch.material.opacity = Math.max(0, lifeT * 1.4);
        }
      }
      if (ch.userData?.fadeLight || ch.isLight) {
        ch.intensity = Math.max(0, (ch.intensity || 0) * (1 - dt * 3.5));
      }
      if (ch.geometry?.type === 'TorusGeometry' && ch.material) {
        ch.material.opacity = Math.max(0, lifeT);
        const grow = 1 + (ch.userData.expand || 20) * dt;
        ch.scale.multiplyScalar(grow);
      }
    });

    if (fx.userData.isSmokeField) {
      fx.children.forEach((ch) => {
        if (ch.isSprite) {
          ch.material.opacity = Math.max(0, Math.min(0.65, lifeT * 0.7));
          ch.scale.multiplyScalar(1 + dt * 0.15);
        }
      });
    }

    if (fx.userData.life <= 0) scene.remove(fx);
    else keep.push(fx);
  }
  return keep;
}
