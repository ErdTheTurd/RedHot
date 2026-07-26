import * as THREE from 'three';

const MAP_SIZE = 120;

export function createMap(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // Ocean plane
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_SIZE * 2.5, MAP_SIZE * 2.5),
    new THREE.MeshStandardMaterial({
      color: 0x0c3a52,
      metalness: 0.65,
      roughness: 0.25,
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.2;
  water.receiveShadow = true;
  group.add(water);

  // Mainland (center-north)
  const landMat = new THREE.MeshStandardMaterial({ color: 0x3d4a38, roughness: 0.95 });
  const land = new THREE.Mesh(new THREE.BoxGeometry(70, 1.2, 55), landMat);
  land.position.set(-5, 0.4, -8);
  land.receiveShadow = true;
  land.castShadow = true;
  group.add(land);

  // Peninsula / site islands
  const sandMat = new THREE.MeshStandardMaterial({ color: 0x6a5a3e, roughness: 0.9 });
  const siteA = new THREE.Mesh(new THREE.CylinderGeometry(10, 12, 1.0, 8), sandMat);
  siteA.position.set(-28, 0.3, 22);
  siteA.receiveShadow = true;
  group.add(siteA);

  const siteB = new THREE.Mesh(new THREE.CylinderGeometry(9, 11, 1.0, 8), sandMat);
  siteB.position.set(30, 0.3, 18);
  siteB.receiveShadow = true;
  group.add(siteB);

  // Causeways
  const dockMat = new THREE.MeshStandardMaterial({ color: 0x4a4034 });
  const bridgeA = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 18), dockMat);
  bridgeA.position.set(-18, 0.15, 8);
  group.add(bridgeA);
  const bridgeB = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 16), dockMat);
  bridgeB.position.set(18, 0.15, 6);
  group.add(bridgeB);

  // Cover blocks / hangars / crates
  const coverMat = new THREE.MeshStandardMaterial({ color: 0x2c3540, metalness: 0.4, roughness: 0.6 });
  const covers = [
    [-20, 1.5, -15, 6, 3, 4],
    [-8, 1.2, -22, 4, 2.4, 8],
    [10, 1.8, -18, 5, 3.6, 5],
    [22, 1.4, -6, 3, 2.8, 7],
    [-30, 1.2, -5, 4, 2.4, 4],
    [5, 1.0, 5, 8, 2, 2],
    [-12, 1.5, 2, 2, 3, 6],
    [14, 1.5, -2, 2, 3, 6],
    [-26, 1.0, 22, 3, 2, 3],
    [28, 1.0, 18, 3, 2, 3],
  ];
  for (const [x, y, z, w, h, d] of covers) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), coverMat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }

  // Hangar arches
  const hangarMat = new THREE.MeshStandardMaterial({ color: 0x3a4552, metalness: 0.5, roughness: 0.55 });
  for (const x of [-16, 0, 16]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 1), hangarMat);
    h.position.set(x, 2.5, -28);
    h.castShadow = true;
    group.add(h);
  }

  // Site markers
  const sites = {
    A: new THREE.Vector3(-28, 0.9, 22),
    B: new THREE.Vector3(30, 0.9, 18),
  };

  for (const [label, pos] of Object.entries(sites)) {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.2, 0.15, 16),
      new THREE.MeshStandardMaterial({
        color: label === 'A' ? 0xe85d04 : 0x1d9bf0,
        emissive: label === 'A' ? 0xe85d04 : 0x1d9bf0,
        emissiveIntensity: 0.35,
        metalness: 0.3,
        roughness: 0.5,
      })
    );
    pad.position.copy(pos);
    group.add(pad);

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#d7e4ec';
    ctx.font = 'bold 90px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 64, 64);
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sprite.position.set(pos.x, 4.5, pos.z);
    sprite.scale.set(4, 4, 1);
    group.add(sprite);
  }

  // Soft fog / sky feel via hemisphere + directional already in main
  const grid = new THREE.GridHelper(MAP_SIZE, 40, 0x243040, 0x1a2430);
  grid.position.y = 0.02;
  grid.material.opacity = 0.35;
  grid.material.transparent = true;
  group.add(grid);

  return {
    group,
    sites,
    colliders: covers.map(([x, y, z, w, h, d]) => ({
      min: new THREE.Vector3(x - w / 2, 0, z - d / 2),
      max: new THREE.Vector3(x + w / 2, h * 2, z + d / 2),
      center: new THREE.Vector3(x, y, z),
      half: new THREE.Vector3(w / 2, h / 2, d / 2),
    })),
    isWater(x, z) {
      // rough: mainland AABB and site islands are land
      const onLand =
        (x > -40 && x < 30 && z > -35.5 && z < 19.5) ||
        (Math.hypot(x + 28, z - 22) < 11) ||
        (Math.hypot(x - 30, z - 18) < 10) ||
        (x > -22 && x < -14 && z > -1 && z < 17) ||
        (x > 14 && x < 22 && z > -2 && z < 14);
      return !onLand;
    },
  };
}

export function getSpawns(team) {
  if (team === 'raiders') {
    return [
      { x: -8, y: 0.15, z: -32, yaw: 0 },
      { x: 0, y: 0.15, z: -34, yaw: 0 },
      { x: 8, y: 0.15, z: -32, yaw: 0 },
      { x: -14, y: 0.15, z: -30, yaw: 0.2 },
      { x: 14, y: 0.15, z: -30, yaw: -0.2 },
    ];
  }
  return [
    { x: -24, y: 0.15, z: 26, yaw: Math.PI },
    { x: -30, y: 0.15, z: 20, yaw: Math.PI },
    { x: 26, y: 0.15, z: 22, yaw: Math.PI },
    { x: 32, y: 0.15, z: 16, yaw: Math.PI },
    { x: 4, y: 0.15, z: 10, yaw: Math.PI },
  ];
}

export { MAP_SIZE };
