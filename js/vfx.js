import * as THREE from 'three';
import { makeMuzzleFlashTexture } from './textures.js';

let muzzleTex = null;
function getMuzzleTex() {
  if (!muzzleTex) muzzleTex = makeMuzzleFlashTexture();
  return muzzleTex;
}

/** High-detail shell / rocket / cannon round (not a sphere). */
export function createProjectileMesh(heavy = false) {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({
    color: heavy ? 0xc8a050 : 0xd8dde0,
    metalness: 0.9,
    roughness: 0.2,
    emissive: heavy ? 0x402000 : 0x202428,
    emissiveIntensity: 0.35,
  });
  const tipMat = new THREE.MeshStandardMaterial({
    color: heavy ? 0xff6622 : 0xffcc66,
    metalness: 0.5,
    roughness: 0.3,
    emissive: heavy ? 0xff4400 : 0xffaa33,
    emissiveIntensity: 0.8,
  });

  const length = heavy ? 1.1 : 0.55;
  const radius = heavy ? 0.09 : 0.045;

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.85, radius, length * 0.7, 10),
    steel
  );
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = length * 0.05;
  g.add(shaft);

  const tip = new THREE.Mesh(new THREE.ConeGeometry(radius, length * 0.35, 10), tipMat);
  tip.rotation.x = -Math.PI / 2;
  tip.position.z = -length * 0.4;
  g.add(tip);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.1, radius * 0.9, length * 0.12, 10),
    steel
  );
  base.rotation.x = Math.PI / 2;
  base.position.z = length * 0.38;
  g.add(base);

  // Additive glow core
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.4, 8, 8),
    new THREE.MeshBasicMaterial({
      color: heavy ? 0xff6622 : 0xffe088,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
  );
  g.add(glow);

  // Trail ribbon (elongated billboard-ish quad)
  const trail = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2.2, length * (heavy ? 4.5 : 3.2)),
    new THREE.MeshBasicMaterial({
      color: heavy ? 0xff7530 : 0xffe0a0,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
  );
  trail.rotation.x = Math.PI / 2;
  trail.position.z = length * 1.2;
  g.add(trail);
  g.userData.trail = trail;
  g.userData.glow = glow;

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
  const scale = heavy ? 3.2 : 1.6;
  sprite.scale.set(scale, scale, 1);
  sprite.position.copy(position).addScaledVector(direction, 0.8);
  sprite.userData.life = 0.08;
  sprite.userData.maxLife = 0.08;
  scene.add(sprite);

  // Secondary sparks
  const sparks = [];
  for (let i = 0; i < (heavy ? 10 : 6); i++) {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.04 + Math.random() * 0.05, 5, 5),
      new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xffaa33 : 0xff6622 })
    );
    s.position.copy(sprite.position);
    s.userData.vel = direction.clone()
      .add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2))
      .multiplyScalar(8 + Math.random() * 10);
    s.userData.life = 0.2 + Math.random() * 0.15;
    scene.add(s);
    sparks.push(s);
  }

  return { sprite, sparks };
}

export function spawnImpact(scene, position, heavy = false) {
  const group = new THREE.Group();
  group.position.copy(position);

  const flash = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getMuzzleTex(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  flash.scale.set(heavy ? 2.5 : 1.4, heavy ? 2.5 : 1.4, 1);
  group.add(flash);

  for (let i = 0; i < (heavy ? 16 : 10); i++) {
    const shard = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 0.18 + Math.random() * 0.2),
      new THREE.MeshStandardMaterial({
        color: Math.random() > 0.4 ? 0xffaa44 : 0x888888,
        metalness: 0.7,
        roughness: 0.35,
        emissive: 0xff6622,
        emissiveIntensity: 0.5,
      })
    );
    shard.position.set((Math.random() - 0.5) * 0.4, Math.random() * 0.3, (Math.random() - 0.5) * 0.4);
    shard.userData.vel = new THREE.Vector3(
      (Math.random() - 0.5) * 12,
      4 + Math.random() * 10,
      (Math.random() - 0.5) * 12
    );
    shard.userData.spin = new THREE.Vector3(Math.random(), Math.random(), Math.random());
    group.add(shard);
  }

  group.userData.life = 0.55;
  group.userData.isImpact = true;
  scene.add(group);
  return group;
}

export function orientProjectile(mesh, dir) {
  // Shell local +Z is trail, tip faces -Z; align -Z with direction of travel
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
      fx.sprite.scale.multiplyScalar(1 + dt * 8);
      for (const s of fx.sparks) {
        s.userData.life -= dt;
        s.position.addScaledVector(s.userData.vel, dt);
        s.userData.vel.y -= 20 * dt;
        if (s.userData.life <= 0) scene.remove(s);
      }
      fx.sparks = fx.sparks.filter((s) => s.userData.life > 0);
      if (fx.sprite.userData.life <= 0) {
        scene.remove(fx.sprite);
      } else keep.push(fx);
      continue;
    }

    // impact group / explosion
    fx.userData.life -= dt;
    fx.children.forEach((ch) => {
      if (ch.userData?.vel) {
        ch.position.addScaledVector(ch.userData.vel, dt);
        ch.userData.vel.y -= 18 * dt;
        if (ch.userData.spin) {
          ch.rotation.x += ch.userData.spin.x * dt * 10;
          ch.rotation.y += ch.userData.spin.y * dt * 10;
        }
      }
      if (ch.isSprite) {
        ch.material.opacity = Math.max(0, fx.userData.life * 2);
      }
    });
    if (fx.userData.life <= 0) scene.remove(fx);
    else keep.push(fx);
  }
  return keep;
}
