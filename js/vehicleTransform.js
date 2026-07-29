/** Vehicle domain-change transform choreography (transformer fold → reform). */

import * as THREE from 'three';
import { VEHICLES } from './config.js';

export function transformKind(fromDomain, toDomain) {
  if (!fromDomain || !toDomain || fromDomain === toDomain) return 'morph';
  if (fromDomain === 'air' && toDomain === 'land') return 'drop';
  if (fromDomain === 'air' && toDomain === 'sea') return 'splash';
  if ((fromDomain === 'land' || fromDomain === 'sea') && toDomain === 'air') return 'hover';
  if (fromDomain === 'land' && toDomain === 'sea') return 'roll';
  if (fromDomain === 'sea' && toDomain === 'land') return 'beach';
  return 'morph';
}

export function transformDuration(kind) {
  if (kind === 'hover' || kind === 'drop') return 1.05;
  if (kind === 'splash' || kind === 'roll') return 1.15;
  return 0.75;
}

/**
 * Ease helpers
 */
function smooth(t) {
  return t * t * (3 - 2 * t);
}
function easeIn(t) {
  return t * t;
}
function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

/**
 * Build a transform state. Mesh swap happens at mid (swapAt).
 */
export function createTransformState(unit, toVehicleId, opts = {}) {
  const fromId = unit.vehicle?.id;
  const fromDomain = VEHICLES[fromId]?.domain || 'land';
  const toDomain = VEHICLES[toVehicleId]?.domain || 'land';
  const kind = transformKind(fromDomain, toDomain);
  return {
    t: 0,
    duration: opts.duration || transformDuration(kind),
    swapAt: 0.42,
    swapped: false,
    kind,
    fromDomain,
    toDomain,
    fromId,
    toId: toVehicleId,
    startX: unit.mesh.position.x,
    startY: unit.mesh.position.y,
    startZ: unit.mesh.position.z,
    startYaw: unit.yaw || unit.mesh.rotation.y || 0,
    targetY: toDomain === 'air' ? (unit.flightAlt || 8) : toDomain === 'sea' ? 0.25 : 1.0,
    fxFired: false,
    remote: !!opts.remote,
  };
}

/**
 * Advance one frame. Returns { done, justSwapped, fx } for the game to react.
 */
export function tickTransform(unit, dt, helpers = {}) {
  const tr = unit.transform;
  if (!tr) return { done: true };
  tr.t += dt;
  const u = Math.min(1, tr.t / tr.duration);
  const mesh = unit.mesh;
  if (!mesh) return { done: true };

  let justSwapped = false;
  let fx = null;

  // —— Phase A: fold / spin current craft ——
  if (!tr.swapped) {
    const p = smooth(Math.min(1, u / tr.swapAt));
    const squash = 1 - p * 0.72;
    const stretch = 1 + p * 0.55;
    mesh.scale.set(squash, stretch, squash);
    mesh.rotation.y = tr.startYaw + p * Math.PI * 2.4;
    mesh.rotation.x = Math.sin(p * Math.PI) * 0.8;
    mesh.rotation.z = Math.sin(p * Math.PI * 2) * 0.45;
    // Lift slightly while folding
    mesh.position.y = tr.startY + Math.sin(p * Math.PI) * 1.8;

    if (u >= tr.swapAt) {
      tr.swapped = true;
      justSwapped = true;
      // Caller swaps mesh; we reset pose for phase B
    }
  }

  // —— Phase B: reform into new domain motion ——
  if (tr.swapped) {
    const p = smooth((u - tr.swapAt) / (1 - tr.swapAt));
    const mesh2 = unit.mesh;
    const grow = 0.25 + p * 0.75;
    mesh2.scale.set(grow, grow, grow);
    mesh2.rotation.y = tr.startYaw + (1 - p) * Math.PI * 0.6;

    if (tr.kind === 'drop') {
      // Jet → tank: fall from altitude
      const fromY = Math.max(tr.startY, 10);
      mesh2.position.y = fromY + (tr.targetY - fromY) * easeIn(p);
      mesh2.rotation.x = (1 - p) * 0.9;
      if (p > 0.85 && !tr.fxFired) {
        tr.fxFired = true;
        fx = 'impact';
      }
    } else if (tr.kind === 'splash') {
      const fromY = Math.max(tr.startY, 10);
      mesh2.position.y = fromY + (0.2 - fromY) * easeIn(p);
      mesh2.rotation.x = (1 - p) * 1.1;
      // Drift toward water if a helper provided a sea target
      if (helpers.seaTarget) {
        mesh2.position.x = THREE.MathUtils.lerp(tr.startX, helpers.seaTarget.x, easeOut(p));
        mesh2.position.z = THREE.MathUtils.lerp(tr.startZ, helpers.seaTarget.z, easeOut(p));
      }
      if (p > 0.75 && !tr.fxFired) {
        tr.fxFired = true;
        fx = 'splash';
      }
    } else if (tr.kind === 'hover') {
      // Tank/ship → jet: lift off
      const fromY = tr.startY;
      const toY = tr.targetY;
      mesh2.position.y = fromY + (toY - fromY) * easeOut(p);
      mesh2.rotation.x = -Math.sin(p * Math.PI) * 0.35;
      if (p > 0.2 && !tr.fxFired) {
        tr.fxFired = true;
        fx = 'thrust';
      }
    } else if (tr.kind === 'roll') {
      // Tank → ship: tumble toward water
      mesh2.rotation.z = p * Math.PI * 1.15;
      mesh2.rotation.x = Math.sin(p * Math.PI) * 0.4;
      mesh2.position.y = tr.startY + Math.sin(p * Math.PI) * 1.2 * (1 - p) + tr.targetY * p;
      if (helpers.seaTarget) {
        mesh2.position.x = THREE.MathUtils.lerp(tr.startX, helpers.seaTarget.x, easeOut(p));
        mesh2.position.z = THREE.MathUtils.lerp(tr.startZ, helpers.seaTarget.z, easeOut(p));
      }
      if (p > 0.7 && !tr.fxFired) {
        tr.fxFired = true;
        fx = 'splash';
      }
    } else if (tr.kind === 'beach') {
      // Ship → tank: surge onto land
      mesh2.rotation.z = (1 - p) * 0.5;
      mesh2.position.y = THREE.MathUtils.lerp(0.2, tr.targetY, easeOut(p));
      if (helpers.landTarget) {
        mesh2.position.x = THREE.MathUtils.lerp(tr.startX, helpers.landTarget.x, easeOut(p));
        mesh2.position.z = THREE.MathUtils.lerp(tr.startZ, helpers.landTarget.z, easeOut(p));
      }
      if (p > 0.5 && !tr.fxFired) {
        tr.fxFired = true;
        fx = 'impact';
      }
    } else {
      // Same-domain morph
      mesh2.position.y = THREE.MathUtils.lerp(tr.startY, tr.targetY, p);
      mesh2.rotation.y = tr.startYaw + (1 - p) * Math.PI;
    }
  }

  if (u >= 1) {
    // Finalize
    unit.mesh.scale.set(1, 1, 1);
    unit.mesh.rotation.x = 0;
    unit.mesh.rotation.z = 0;
    unit.mesh.rotation.y = unit.yaw || tr.startYaw;
    unit.transform = null;
    unit.transformLock = false;
    return { done: true, justSwapped, fx };
  }

  return { done: false, justSwapped, fx };
}
