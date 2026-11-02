// Kaduna Lifestyle — Particle System (Three.js sprites, no asset files)
// Confetti, dust puffs, rain drops, smoke.
//
// Wire-up (in main.js):
//   import { initParticles, emitConfetti, emitDust, startRain, stopRain, tickParticles } from "./particles.js";
//   initParticles(scene);                       // once after scene build
//   emitConfetti(player.position);              // celebrations
//   emitDust(player.position);                  // footstep puffs
//   startRain(); stopRain();                    // weather
//   tickParticles(dt, camera);                  // every frame

import * as THREE from "three";

let _scene = null;
let _confettiPool = [];
let _dustPool = [];
let _smokePool = [];   // VEHICLE DAMAGE (Nov 2): crash smoke + fire
let _firePool = [];
let _rainGroup = null;
let _rainActive = false;

// ---- textures (procedural, no asset files) ----
let _confettiTex = null;
let _dustTex = null;
let _smokeTex = null;
let _fireTex = null;
let _rainTex = null;

function _makeConfettiTex() {
  if (_confettiTex) return _confettiTex;
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 32, 32);
  _confettiTex = new THREE.CanvasTexture(c);
  return _confettiTex;
}
function _makeDustTex() {
  if (_dustTex) return _dustTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(180,150,110,0.7)");
  g.addColorStop(0.5, "rgba(140,110,80,0.3)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  _dustTex = new THREE.CanvasTexture(c);
  return _dustTex;
}
// VEHICLE DAMAGE (Nov 2): dark engine smoke — damaged cars breathe this from the hood
function _makeSmokeTex() {
  if (_smokeTex) return _smokeTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, "rgba(40,40,44,0.85)");
  g.addColorStop(0.55, "rgba(58,58,64,0.4)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  _smokeTex = new THREE.CanvasTexture(c);
  return _smokeTex;
}
// fire ball — additive orange/red for wrecked engines
function _makeFireTex() {
  if (_fireTex) return _fireTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 34, 2, 32, 32, 32);
  g.addColorStop(0, "rgba(255,240,180,0.95)");
  g.addColorStop(0.35, "rgba(255,140,40,0.8)");
  g.addColorStop(0.7, "rgba(220,50,10,0.35)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  _fireTex = new THREE.CanvasTexture(c);
  return _fireTex;
}
function _makeRainTex() {
  if (_rainTex) return _rainTex;
  const c = document.createElement("canvas");
  c.width = 8; c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, "rgba(180,200,230,0)");
  g.addColorStop(0.5, "rgba(180,200,230,0.7)");
  g.addColorStop(1, "rgba(180,200,230,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 64);
  _rainTex = new THREE.CanvasTexture(c);
  return _rainTex;
}

const CONFETTI_COLORS = [0xff5a5a, 0xffd93d, 0x6bcb77, 0x4d96ff, 0xff66c4, 0xff9f43];

export function initParticles(scene) {
  _scene = scene;
}

// ---- confetti burst at world position ----
export function emitConfetti(pos, count = 60) {
  if (!_scene) return;
  const tex = _makeConfettiTex();
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      transparent: true,
      opacity: 1,
      fog: false,
      depthWrite: false,
    });
    const s = new THREE.Sprite(mat);
    s.position.copy(pos);
    s.position.y += 1.5;
    s.position.x += (Math.random() - 0.5) * 2;
    s.position.z += (Math.random() - 0.5) * 2;
    const sc = 0.3 + Math.random() * 0.3;
    s.scale.set(sc, sc * 0.6, 1);
    s.userData = {
      vx: (Math.random() - 0.5) * 6,
      vy: 5 + Math.random() * 4,
      vz: (Math.random() - 0.5) * 6,
      life: 1.5 + Math.random() * 1.5,
      maxLife: 0,
      rot: (Math.random() - 0.5) * 6,
    };
    s.userData.maxLife = s.userData.life;
    _scene.add(s);
    _confettiPool.push(s);
  }
}

// ---- dust puff at ground level (footsteps, car wheels) ----
export function emitDust(pos, count = 5) {
  if (!_scene) return;
  const tex = _makeDustTex();
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0.6,
      fog: false,
      depthWrite: false,
    });
    const s = new THREE.Sprite(mat);
    s.position.copy(pos);
    s.position.y += 0.1;
    s.position.x += (Math.random() - 0.5) * 0.6;
    s.position.z += (Math.random() - 0.5) * 0.6;
    const sc = 0.4 + Math.random() * 0.4;
    s.scale.set(sc, sc, 1);
    s.userData = {
      vx: (Math.random() - 0.5) * 1.5,
      vy: 0.5 + Math.random() * 0.8,
      vz: (Math.random() - 0.5) * 1.5,
      life: 0.6 + Math.random() * 0.4,
      maxLife: 1,
      rot: 0,
    };
    s.userData.maxLife = s.userData.life;
    _scene.add(s);
    _dustPool.push(s);
  }
}

// ---- VEHICLE DAMAGE (Nov 2): engine smoke + fire ----
// emitSmoke: dark puffs that RISE and grow (broken engine / wrecked car).
// strength 0..1 scales size + count (use higher when close to death).
export function emitSmoke(pos, strength = 0.5) {
  if (!_scene) return;
  const tex = _makeSmokeTex();
  const n = 1 + Math.round(strength * 2);
  for (let i = 0; i < n; i++) {
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.55 + strength * 0.25, fog: false, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.position.copy(pos);
    s.position.x += (Math.random() - 0.5) * 0.3;
    s.position.z += (Math.random() - 0.5) * 0.3;
    const sc = (0.35 + Math.random() * 0.3) * (0.7 + strength * 0.8);
    s.scale.set(sc, sc, 1);
    s.userData = {
      vx: (Math.random() - 0.5) * 0.5,
      vy: 1.1 + Math.random() * 1.2 + strength,      // smoke goes UP
      vz: (Math.random() - 0.5) * 0.5,
      life: 1.1 + Math.random() * 0.9,
      maxLife: 2,
      rot: (Math.random() - 0.5) * 1.5,
    };
    s.userData.maxLife = s.userData.life;
    _scene.add(s);
    _smokePool.push(s);
  }
}

// emitFire: bright additive flames (wrecked vehicle). Short, violent, rises.
export function emitFire(pos) {
  if (!_scene) return;
  const tex = _makeFireTex();
  for (let i = 0; i < 2; i++) {
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.95, fog: false, depthWrite: false, blending: THREE.AdditiveBlending });
    const s = new THREE.Sprite(mat);
    s.position.copy(pos);
    s.position.x += (Math.random() - 0.5) * 0.5;
    s.position.z += (Math.random() - 0.5) * 0.5;
    const sc = 0.45 + Math.random() * 0.45;
    s.scale.set(sc, sc * 1.25, 1);
    s.userData = {
      vx: (Math.random() - 0.5) * 0.7,
      vy: 1.6 + Math.random() * 1.6,
      vz: (Math.random() - 0.5) * 0.7,
      life: 0.35 + Math.random() * 0.35,
      maxLife: 0.7,
      rot: (Math.random() - 0.5) * 2,
    };
    s.userData.maxLife = s.userData.life;
    _scene.add(s);
    _firePool.push(s);
  }
}

// ---- rain weather ----
const RAIN_COUNT = 800;
export function startRain() {
  if (!_scene || _rainActive) return;
  _rainActive = true;
  const tex = _makeRainTex();
  _rainGroup = new THREE.Group();
  _rainGroup.name = "rain";
  for (let i = 0; i < RAIN_COUNT; i++) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0.5,
      fog: false,
      depthWrite: false,
    });
    const s = new THREE.Sprite(mat);
    s.position.set(
      (Math.random() - 0.5) * 200,
      Math.random() * 60 + 10,
      (Math.random() - 0.5) * 200
    );
    s.scale.set(0.3, 2 + Math.random() * 1.5, 1);
    _rainGroup.add(s);
  }
  _scene.add(_rainGroup);
}

export function stopRain() {
  if (!_rainGroup) return;
  _scene.remove(_rainGroup);
  _rainGroup.traverse(o => { if (o.material) o.material.dispose(); });
  _rainGroup = null;
  _rainActive = false;
}

export function isRaining() { return _rainActive; }

// ---- per-frame: integrate particles, cull dead ones ----
export function tickParticles(dt, camera) {
  // confetti
  for (let i = _confettiPool.length - 1; i >= 0; i--) {
    const s = _confettiPool[i];
    const u = s.userData;
    u.life -= dt;
    if (u.life <= 0) {
      _scene.remove(s);
      if (s.material) s.material.dispose();
      _confettiPool.splice(i, 1);
      continue;
    }
    u.vy -= 9.8 * dt;            // gravity
    u.vx *= 0.99; u.vz *= 0.99;  // air drag
    s.position.x += u.vx * dt;
    s.position.y += u.vy * dt;
    s.position.z += u.vz * dt;
    s.material.rotation += u.rot * dt;
    s.material.opacity = Math.min(1, u.life / 0.5);  // fade out in last 0.5s
    if (s.position.y < 0.1) {
      u.vy *= -0.3;   // tiny bounce
      s.position.y = 0.1;
    }
  }
  // dust
  for (let i = _dustPool.length - 1; i >= 0; i--) {
    const s = _dustPool[i];
    const u = s.userData;
    u.life -= dt;
    if (u.life <= 0) {
      _scene.remove(s);
      if (s.material) s.material.dispose();
      _dustPool.splice(i, 1);
      continue;
    }
    u.vy -= 0.4 * dt;
    u.vx *= 0.95; u.vz *= 0.95;
    s.position.x += u.vx * dt;
    s.position.y += u.vy * dt;
    s.position.z += u.vz * dt;
    const grow = 1 + dt * 0.6;
    s.scale.multiplyScalar(grow);
    s.material.opacity = (u.life / u.maxLife) * 0.6;
  }
  // smoke (vehicle damage): rises, drifts, grows, fades
  for (let i = _smokePool.length - 1; i >= 0; i--) {
    const s = _smokePool[i];
    const u = s.userData;
    u.life -= dt;
    if (u.life <= 0) {
      _scene.remove(s);
      if (s.material) s.material.dispose();
      _smokePool.splice(i, 1);
      continue;
    }
    u.vx *= 0.98; u.vz *= 0.98;
    s.position.x += u.vx * dt;
    s.position.y += u.vy * dt;
    s.position.z += u.vz * dt;
    s.scale.multiplyScalar(1 + dt * 0.9);
    s.material.rotation += u.rot * dt;
    s.material.opacity = Math.min(0.8, (u.life / u.maxLife) * 0.8);
  }
  // fire (wrecked vehicle): fast rise, shrink then vanish
  for (let i = _firePool.length - 1; i >= 0; i--) {
    const s = _firePool[i];
    const u = s.userData;
    u.life -= dt;
    if (u.life <= 0) {
      _scene.remove(s);
      if (s.material) s.material.dispose();
      _firePool.splice(i, 1);
      continue;
    }
    s.position.x += u.vx * dt;
    s.position.y += u.vy * dt;
    s.position.z += u.vz * dt;
    s.material.rotation += u.rot * dt;
    const f = u.life / u.maxLife;
    s.material.opacity = Math.min(1, f * 1.4);
    s.scale.multiplyScalar(1 - dt * 0.5);
  }
  // rain
  if (_rainGroup && _rainActive) {
    // rain follows the camera (so it always feels like it's raining on you)
    if (camera) {
      _rainGroup.position.x = camera.position.x;
      _rainGroup.position.z = camera.position.z;
    }
    for (const s of _rainGroup.children) {
      s.position.y -= 50 * dt;
      if (s.position.y < 0) s.position.y = 50 + Math.random() * 20;
    }
  }
}
