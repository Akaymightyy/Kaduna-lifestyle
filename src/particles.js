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
let _rainGroup = null;
let _rainActive = false;

// ---- textures (procedural, no asset files) ----
let _confettiTex = null;
let _dustTex = null;
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
