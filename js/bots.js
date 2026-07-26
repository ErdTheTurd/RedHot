import * as THREE from 'three';
import { VEHICLES } from './config.js';

export function updateBot(bot, game, dt) {
  if (!bot.alive) return;

  const enemies = game.units.filter((u) => u.alive && u.team !== bot.team);
  const pos = bot.mesh.position;

  // Objective bias
  let targetPos = null;
  let shootTarget = null;

  // Find nearest enemy
  let nearest = null;
  let nearestDist = Infinity;
  for (const e of enemies) {
    const d = pos.distanceTo(e.mesh.position);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = e;
    }
  }

  if (bot.team === 'raiders') {
    if (bot.hasBomb && !game.bomb.planted) {
      const site = Math.hypot(pos.x + 28, pos.z - 22) < Math.hypot(pos.x - 30, pos.z - 18)
        ? game.map.sites.A
        : game.map.sites.B;
      targetPos = site;
      if (pos.distanceTo(site) < 4.5 && (!nearest || nearestDist > 18)) {
        bot.plantProgress += dt;
        if (bot.plantProgress >= game.plantTime) {
          game.plantBomb(bot, site === game.map.sites.A ? 'A' : 'B');
        }
      } else {
        bot.plantProgress = 0;
      }
    } else if (game.bomb.planted) {
      // hold site / hunt
      targetPos = game.bomb.position;
    } else {
      // push a site
      targetPos = game.roundNumber % 2 === 0 ? game.map.sites.A : game.map.sites.B;
    }
  } else {
    // sentinels
    if (game.bomb.planted) {
      targetPos = game.bomb.position;
      if (pos.distanceTo(game.bomb.position) < 4 && (!nearest || nearestDist > 14)) {
        const need = bot.hasDefuseKit ? game.defuseTime * 0.5 : game.defuseTime;
        bot.defuseProgress += dt;
        if (bot.defuseProgress >= need) game.defuseBomb(bot);
      } else {
        bot.defuseProgress = 0;
      }
    } else {
      // rotate between sites / mid
      const t = (performance.now() * 0.0001 + bot.id.length) % 1;
      targetPos = t < 0.45 ? game.map.sites.A : t < 0.75 ? game.map.sites.B : new THREE.Vector3(0, 0, 0);
    }
  }

  if (nearest && nearestDist < bot.vehicle.range * 0.95) {
    shootTarget = nearest;
  }

  // Aim
  const lookAt = shootTarget ? shootTarget.mesh.position : targetPos;
  if (lookAt) {
    const dx = lookAt.x - pos.x;
    const dz = lookAt.z - pos.z;
    const desired = Math.atan2(dx, dz);
    let diff = desired - bot.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    bot.yaw += Math.max(-bot.vehicle.turn * dt, Math.min(bot.vehicle.turn * dt, diff));
    bot.mesh.rotation.y = bot.yaw;
  }

  // Move
  if (targetPos && (!shootTarget || nearestDist > 22)) {
    const forward = new THREE.Vector3(Math.sin(bot.yaw), 0, Math.cos(bot.yaw));
    const to = targetPos.clone().sub(pos);
    to.y = 0;
    if (to.length() > 3) {
      const speed = bot.vehicle.speed * (shootTarget ? 0.7 : 1);
      // steer somewhat toward target
      const desired = Math.atan2(to.x, to.z);
      let diff = desired - bot.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      bot.yaw += Math.max(-bot.vehicle.turn * dt, Math.min(bot.vehicle.turn * dt, diff * 0.8));
      bot.mesh.rotation.y = bot.yaw;
      const next = pos.clone().add(forward.multiplyScalar(speed * dt));
      game.moveUnit(bot, next);
    }
  } else if (shootTarget && nearestDist < 14) {
    // strafe
    const right = new THREE.Vector3(Math.cos(bot.yaw), 0, -Math.sin(bot.yaw));
    const dir = Math.sin(performance.now() * 0.002 + bot.id.charCodeAt(0)) > 0 ? 1 : -1;
    const next = pos.clone().add(right.multiplyScalar(dir * bot.vehicle.speed * 0.55 * dt));
    game.moveUnit(bot, next);
  }

  bot._adjustHeight();

  // Shoot
  if (shootTarget && (game.phase === 'live' || game.phase === 'bomb')) {
    const aimYaw = Math.atan2(
      shootTarget.mesh.position.x - pos.x,
      shootTarget.mesh.position.z - pos.z
    );
    let los = ((aimYaw - bot.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    los = Math.abs(los);
    if (los < 0.35 && nearestDist < bot.vehicle.range) {
      game.tryFire(bot);
    }
  }

  // Buy brain during buy phase (simple)
  if (game.phase === 'buy' && !bot._bought) {
    botBuy(bot, game);
    bot._bought = true;
  }
  if (game.phase !== 'buy') bot._bought = false;
}

function botBuy(bot, game) {
  const money = bot.money;
  // plating
  if (money >= 1000 && bot.armor < 50) {
    bot.money -= 1000;
    bot.armor = 100;
  }
  if (bot.team === 'sentinels' && bot.money >= 400 && !bot.hasDefuseKit) {
    bot.money -= 400;
    bot.hasDefuseKit = true;
  }

  const picks = Object.values(VEHICLES)
    .filter((v) => v.price <= bot.money)
    .sort((a, b) => b.price - a.price);

  if (picks.length) {
    // diversify domains a bit by bot index
    const preferred = bot.id.charCodeAt(bot.id.length - 1) % 3;
    const domains = ['land', 'air', 'sea'];
    const want = domains[preferred];
    const pick = picks.find((p) => p.domain === want) || picks[0];
    bot.money -= pick.price;
    bot.equip(pick.id, 0);
  }
}
