// Kaduna Lifestyle — Road Events (rain, traffic jam, checkpoint)
// Lightweight, time + location based. Designed to be ticked every frame
// from main.js but checks itself throttled to ~1s to save CPU.
//
// Wire-up (in main.js):
//   import { initRoadEvents, tickRoadEvents, getCurrentWeather, isCheckpointAhead } from "./road_events.js";
//   initRoadEvents({ scene, playerGetPos, toast, gameHourGet });
//   tickRoadEvents(dt);                 // every frame
//   const w = getCurrentWeather();      // { type: "rain"|"clear", intensity: 0..1 }

import { startRain, stopRain, isRaining } from "./particles.js";
import { sfx } from "./sfx.js";

let _scene = null;
let _playerGetPos = () => ({ x: 0, z: 0 });
let _gameHourGet = () => 12;
let _toast = () => {};

// ---- weather state ----
let _weather = "clear";        // "clear" | "rain"
let _weatherTimer = 0;          // s until next weather decision
let _rainIntensity = 0;        // 0..1, smooth lerp
let _nextWeatherCheck = 0;     // throttle (s)

// ---- checkpoint state ----
let _checkpoint = null;         // { x, z, radius, label, fee, hit }
let _checkpointCooldown = 0;    // s until another checkpoint can spawn

// ---- traffic jam state ----
let _jam = null;                // { x, z, radius, remaining, slowFactor }
let _jamCooldown = 0;

const ROAD_POSITIONS = [        // known main road corridors — checkpoints spawn near these
  { x: 0, z: 0 },              // Ahmadu Bella Way
  { x: 0, z: 100 },            // Kawo approach
  { x: 100, z: 0 },            // Sabon Tasha side
  { x: -80, z: 60 },           // Barnawa side
  { x: 60, z: -50 },           // Back road
];

const CHECKPOINT_LABELS = [
  { label: "Police Checkpoint", fee: 100, msg: "🚨 Police checkpoint! Show your papers. -₦100" },
  { label: "LASTMA Stop", fee: 50, msg: "🚦 LASTMA stop! Pay ₦50 fine for unclear plates." },
  { label: "Road Safety", fee: 0, msg: "🛡️ FRSC check. You pass. Have a safe trip!" },
];

export function initRoadEvents({ scene, playerGetPos, gameHourGet, toast }) {
  _scene = scene;
  _playerGetPos = playerGetPos || _playerGetPos;
  _gameHourGet = gameHourGet || _gameHourGet;
  _toast = toast || _toast;
}

export function getCurrentWeather() {
  return { type: _weather, intensity: _rainIntensity };
}

// ---- internal: pick a random spawn point near player but on a road ----
function _nearbyRoadPoint() {
  const p = _playerGetPos();
  // pick a road corridor, offset 50-150m from player
  const base = ROAD_POSITIONS[Math.floor(Math.random() * ROAD_POSITIONS.length)];
  const ang = Math.random() * Math.PI * 2;
  const r = 60 + Math.random() * 60;
  return { x: p.x + Math.cos(ang) * r, z: p.z + Math.sin(ang) * r, base };
}

// ---- internal: decide weather (every ~120s of game-time, i.e. 2 game hours) ----
function _decideWeather() {
  const hour = _gameHourGet();
  // Kaduna rainy season Apr-Oct ish — boost rain odds
  // We don't have the real month, so use a flat 18% chance every check
  const roll = Math.random();
  if (_weather === "clear" && roll < 0.18) {
    _weather = "rain";
    if (_toast) _toast("🌧️ Rain don start. Drive careful!");
    try { sfx.resume(); } catch (e) {}
    startRain();
    try { sfx.rain(true); } catch (e) {}
  } else if (_weather === "rain" && roll > 0.55) {
    _weather = "clear";
    if (_toast) _toast("☀️ Rain don stop. Road don dry back.");
    stopRain();
    try { sfx.rain(false); } catch (e) {}
  }
  _weatherTimer = 100 + Math.random() * 80;  // next decision in ~100-180s
}

// ---- internal: maybe spawn a checkpoint ahead ----
function _maybeSpawnCheckpoint() {
  if (_checkpoint || _jam) return;  // one road event at a time
  if (_checkpointCooldown > 0) return;
  const pt = _nearbyRoadPoint();
  const cfg = CHECKPOINT_LABELS[Math.floor(Math.random() * CHECKPOINT_LABELS.length)];
  _checkpoint = { ...pt, radius: 6, ...cfg, hit: false };
  _checkpointCooldown = 180;  // at least 3 game-hours before next
}

// ---- internal: maybe spawn a traffic jam ----
function _maybeSpawnJam() {
  if (_checkpoint || _jam) return;
  if (_jamCooldown > 0) return;
  const pt = _nearbyRoadPoint();
  _jam = { ...pt, radius: 25, remaining: 60 + Math.random() * 60, slowFactor: 0.35 };
  _jamCooldown = 240;
  if (_toast) _toast("🚗 Traffic jam for front! Hold your brake.");
}

// ---- per-frame tick (called from main.js main loop) ----
export function tickRoadEvents(dt) {
  // weather throttle
  _weatherTimer -= dt;
  if (_weatherTimer <= 0) _decideWeather();

  // smooth rain intensity (for graphics/effects integration)
  const target = _weather === "rain" ? 1 : 0;
  _rainIntensity += (target - _rainIntensity) * Math.min(1, dt * 1.5);

  // checkpoint cooldown
  if (_checkpointCooldown > 0) _checkpointCooldown -= dt;
  if (_jamCooldown > 0) _jamCooldown -= dt;

  // checkpoint logic: spawn with small random chance per second
  if (!_checkpoint && !_jam) {
    if (Math.random() < dt * 0.05) _maybeSpawnCheckpoint();
    else if (Math.random() < dt * 0.04) _maybeSpawnJam();
  }

  // active checkpoint: check player approach
  if (_checkpoint && !_checkpoint.hit) {
    const p = _playerGetPos();
    const dx = p.x - _checkpoint.x, dz = p.z - _checkpoint.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < _checkpoint.radius + 4) {
      _checkpoint.hit = true;
      // collect fee, notify, then expire after 3s
      if (_toast) _toast(_checkpoint.msg);
      try { sfx.horn(); } catch (e) {}
      setTimeout(() => { _checkpoint = null; }, 3000);
    }
  }

  // jam decay
  if (_jam) {
    _jam.remaining -= dt;
    if (_jam.remaining <= 0) {
      if (_toast) _toast("✅ Traffic don clear. Road don free.");
      _jam = null;
    }
  }
}

// ---- exposed getters ----
export function isCheckpointActive() { return !!_checkpoint; }
export function getCheckpoint() { return _checkpoint; }
export function isJamActive() { return !!_jam; }
export function getJam() { return _jam; }

// traffic multiplier for nearby vehicles: 1.0 normal, lower = slower
export function trafficSpeedMultiplierAt(x, z) {
  if (_jam) {
    const dx = x - _jam.x, dz = z - _jam.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < _jam.radius) return _jam.slowFactor;
  }
  return 1.0;
}

// reset (e.g. on game reload)
export function resetRoadEvents() {
  stopRain();
  try { sfx.rain(false); } catch (e) {}
  _weather = "clear";
  _rainIntensity = 0;
  _weatherTimer = 60;
  _checkpoint = null;
  _jam = null;
  _checkpointCooldown = 60;
  _jamCooldown = 120;
}
