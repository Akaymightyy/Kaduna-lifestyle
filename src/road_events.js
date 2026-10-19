// Kaduna Lifestyle — Road Events (rain, traffic jam, checkpoint)
// Lightweight, time + location based. Designed to be ticked every frame
// from main.js but checks itself throttled to ~1s to save CPU.
//
// SYNC (Oct 19): weather is now synced via Firebase under `weather/world`
// so all clients in the same world see the same rain. First-writer-wins:
// if `weather/<worldId>` is empty or stale, the first client to roll a
// weather change writes it. Otherwise clients subscribe to the existing
// value and apply it locally. Checkpoints + traffic jams are still local
// per-player (they happen TO the player, not to the world).
//
// Wire-up (in main.js):
//   import { initRoadEvents, tickRoadEvents, getCurrentWeather as getRoadWeather,
//            resetRoadEvents, trafficSpeedMultiplierAt } from "./road_events.js";
//   initRoadEvents({ scene, playerGetPos, gameHourGet, toast, db, worldId });
//   tickRoadEvents(dt);                 // every frame
//   const w = getRoadWeather();          // { type: "rain"|"clear", intensity: 0..1 }

import { startRain, stopRain, isRaining } from "./particles.js";
import { sfx } from "./sfx.js";
import { ref, onValue, set, get } from "firebase/database";

let _scene = null;
let _playerGetPos = () => ({ x: 0, z: 0 });
let _gameHourGet = () => 12;
let _toast = () => {};
let _db = null;
let _worldId = "kaduna";  // single shared world for now
let _unsubWeather = null;

// ---- weather state ----
let _weather = "clear";        // "clear" | "rain"
let _weatherTimer = 0;          // s until next weather decision
let _rainIntensity = 0;        // 0..1, smooth lerp

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

export function initRoadEvents({ scene, playerGetPos, gameHourGet, toast, db, worldId }) {
  _scene = scene;
  _playerGetPos = playerGetPos || _playerGetPos;
  _gameHourGet = gameHourGet || _gameHourGet;
  _toast = toast || _toast;
  _db = db;
  _worldId = worldId || "kaduna";

  // ---- Subscribe to shared weather ----
  if (_db) {
    const wRef = ref(_db, "weather/" + _worldId);
    _unsubWeather = onValue(wRef, (snap) => {
      const v = snap.val();
      if (!v) {
        // No weather decided yet — I'll decide if I roll rain in my tick
        return;
      }
      // Apply the shared weather locally
      const sharedType = v.type || "clear";
      if (sharedType !== _weather) {
        _weather = sharedType;
        if (_weather === "rain") {
          if (_toast) _toast("🌧️ Rain don start. Drive careful!");
          try { sfx.resume(); } catch (e) {}
          startRain();
          try { sfx.rain(true); } catch (e) {}
        } else {
          if (_toast) _toast("☀️ Rain don stop. Road don dry back.");
          stopRain();
          try { sfx.rain(false); } catch (e) {}
        }
      }
      _weatherTimer = 100 + Math.random() * 80;
    });
    // SYNC FIX (Oct 19): we do NOT call onDisconnect(wRef).remove() here.
    // If we did, ANY client that closes the tab/app would wipe the shared
    // weather state → when one player exits, rain stops for everyone else
    // (the user reported exactly this bug). Instead, the weather persists
    // until another client rolls a stop (see _decideWeather) — that client
    // writes the new state, and all subscribed clients apply it.
  }
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

// ---- internal: decide weather — now writes to Firebase so all clients agree ----
async function _decideWeather() {
  if (!_db) return;
  try {
    const wRef = ref(_db, "weather/" + _worldId);
    const snap = await get(wRef);
    const cur = snap.val();
    const now = Date.now();

    // If existing weather is fresh (< 60s old), don't touch it — someone
    // else just decided, give it time to play out.
    if (cur && (now - (cur.ts || 0)) < 60000) return;

    const roll = Math.random();
    if (!cur || cur.type === "clear") {
      if (roll < 0.18) {
        // START rain — write to Firebase; all subscribed clients apply it
        await set(wRef, { type: "rain", ts: now, owner: "auto" });
      }
    } else if (cur.type === "rain" && roll > 0.55) {
      // STOP rain
      await set(wRef, { type: "clear", ts: now, owner: "auto" });
    }
  } catch (e) {
    // permission denied or network error — silently fall back to local-only
    console.warn("weather sync failed:", e.message);
  }
  _weatherTimer = 100 + Math.random() * 80;
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
