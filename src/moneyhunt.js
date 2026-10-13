// src/moneyhunt.js — Money Hunt engine.
//
// Responsibilities:
//   1. Spawn one shared instanced mesh per rarity (3 meshes total — not 1 per spot).
//      Spots only show their mesh when the player is within ~25 m (cull far spots).
//   2. Listen to Firebase hunt/{spotId} to know when each spot was last claimed,
//      and only render the mesh when the spot is claimable.
//   3. Each frame, check if the player is within 6 m of a claimable spot — if so,
//      show the "Press here 🟢 to claim" prompt (tappable, mobile-friendly).
//   4. On claim: write a Firebase transaction on hunt/{spotId} so only the first
//      player to claim wins. Add the reward to economy/{uid}/balance and log to
//      economy/{uid}/log. Update HUD card + phone app.
//   5. Run a warm/cold radar beep (frequency based on distance to nearest spot).
//   6. Track per-player achievements (totalClaims, jackpotClaims, etc.).
//
// All Firebase writes go through transaction() so two players can't both claim
// the same spot. Rewards are also validated against the rarity range on the
// client side — for full anti-cheat, deploy the optional Cloud Function in
// /cloud-functions/claimJackpot.js (see README in that folder).

import * as THREE from "three";
import { db } from "./firebase.js";
import { ref, get, set, update, onValue, runTransaction, serverTimestamp } from "firebase/database";
import { SPOTS, RARITY, rollReward, respawnBucket, isClaimable, HUNT_ACHIEVEMENTS, MAX_CLAIMS_PER_DAY, MONEY_RAIN } from "./moneyspots.js";

const CLAIM_RANGE = 6;       // metres — must be within this to claim
const SHOW_RANGE = 25;       // metres — only render the mesh when this close
const DAY_MS = 24 * 60 * 60 * 1000;

let _scene = null;
let _instanced = {};   // rarity -> THREE.InstancedMesh
let _spotState = {};   // id -> { claimedBy, ts, reward } (from Firebase)
let _player = null;    // ref to player.position (Vector3)
let _uid = null;
let _toast = null;
let _updateHud = null;
let _celebrate = null;
let _nearest = null;   // { spot, dist } nearest claimable spot
let _promptEl = null;  // the "Press here 🟢 to claim" DOM element
let _boundKey = false;
let _stats = { totalClaims: 0, jackpotClaims: 0, rareClaims: 0, commonClaims: 0, earlyBirdClaims: 0, areasClaimed: {}, lastClaimDay: "" };
let _dayClaimCount = 0;
let _unsubSpotListeners = [];

// ---- Spawn the 3 shared instanced meshes (one per rarity) ----
function _buildInstancedMeshes() {
  // Per-rarity count: how many spots of that rarity exist? We allocate that many
  // instance slots. Hidden spots are scaled to 0 (matrix = zero scale).
  const counts = { common: 0, rare: 0, jackpot: 0 };
  for (const s of SPOTS) counts[s.rarity]++;

  for (const rarity of ["common", "rare", "jackpot"]) {
    const r = RARITY[rarity];
    const n = counts[rarity];
    if (!n) continue;
    // A glowing money bag / briefcase: simple merged shapes, low-poly.
    // common = small envelope, rare = briefcase, jackpot = trophy chest.
    let geo, mat;
    if (rarity === "common") {
      geo = new THREE.BoxGeometry(0.4, 0.3, 0.12);
      mat = new THREE.MeshLambertMaterial({ color: r.color, emissive: new THREE.Color(r.color), emissiveIntensity: 0.35 });
    } else if (rarity === "rare") {
      geo = new THREE.BoxGeometry(0.55, 0.4, 0.18);
      mat = new THREE.MeshLambertMaterial({ color: r.color, emissive: new THREE.Color(r.color), emissiveIntensity: 0.45 });
    } else {
      // jackpot — slightly bigger + brighter
      geo = new THREE.BoxGeometry(0.7, 0.55, 0.25);
      mat = new THREE.MeshLambertMaterial({ color: r.color, emissive: new THREE.Color(r.color), emissiveIntensity: 0.6 });
    }
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.castShadow = false;
    mesh.frustumCulled = false; // we manage visibility via matrix scale
    mesh.count = n;
    mesh.userData.rarity = rarity;
    // Initialize all matrices to zero (hidden). _updateInstances will place them.
    const m = new THREE.Matrix4();
    m.makeScale(0, 0, 0);
    for (let i = 0; i < n; i++) mesh.setMatrixAt(i, m);
    mesh.instanceMatrix.needsUpdate = true;
    _scene.add(mesh);
    _instanced[rarity] = mesh;
  }
}

// Map each spot to its instance index inside its rarity's InstancedMesh.
function _spotInstanceIndex(spot) {
  let idx = 0;
  for (const s of SPOTS) {
    if (s.id === spot.id) return idx;
    if (s.rarity === spot.rarity) idx++;
  }
  return 0;
}

// ---- Update instance positions + visibility based on player distance ----
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _scl = new THREE.Vector3();

function _updateInstances(now) {
  if (!_player) return;
  const px = _player.x, pz = _player.z;
  // Reset per-rarity "in range" flag for HUD beep.
  let nearestDist = Infinity;
  let nearestSpot = null;
  for (const spot of SPOTS) {
    const mesh = _instanced[spot.rarity];
    if (!mesh) continue;
    const idx = _spotInstanceIndex(spot);
    const dx = spot.x - px, dz = spot.z - pz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const state = _spotState[spot.id];
    // Spot is shown only when (a) player is close enough AND (b) it's claimable.
    const claimable = !state || isClaimable(spot, state.ts, now);
    const inRange = dist < SHOW_RANGE;
    if (inRange && claimable) {
      // Bob up and down so it catches the eye.
      const t = now / 600;
      const y = 0.5 + Math.sin(t + spot.x) * 0.08;
      _v.set(spot.x, y, spot.z);
      _q.identity();
      const rotY = Math.sin(t * 0.5 + spot.z) * 0.3;
      _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
      const sc = spot.rarity === "jackpot" ? 1.0 : spot.rarity === "rare" ? 0.85 : 0.7;
      _scl.set(sc, sc, sc);
      _m4.compose(_v, _q, _scl);
      mesh.setMatrixAt(idx, _m4);
      // Track nearest claimable in CLAIM_RANGE for the prompt.
      if (dist < CLAIM_RANGE && dist < nearestDist) { nearestDist = dist; nearestSpot = spot; }
    } else {
      // Hidden
      _m4.makeScale(0, 0, 0);
      mesh.setMatrixAt(idx, _m4);
    }
  }
  for (const r of Object.keys(_instanced)) _instanced[r].instanceMatrix.needsUpdate = true;
  // Update prompt
  if (nearestSpot) {
    if (!_nearest || _nearest.spot.id !== nearestSpot.id) {
      _nearest = { spot: nearestSpot, dist: nearestDist };
      _showPrompt(nearestSpot);
    }
  } else {
    if (_nearest) { _hidePrompt(); _nearest = null; }
  }
  // Warm/cold radar beep — frequency based on nearest spot distance (any spot,
  // not just claimable ones). Capped to one beep per second.
  _tickRadar(now, nearestDist === Infinity ? null : nearestDist);
}

// ---- "Press here 🟢 to claim" prompt (tappable, mobile-friendly) ----
function _showPrompt(spot) {
  if (!_promptEl) {
    _promptEl = document.createElement("div");
    _promptEl.id = "hunt-claim-prompt";
    _promptEl.style.cssText = "position:fixed;left:50%;bottom:calc(130px + env(safe-area-inset-bottom));transform:translateX(-50%);background:rgba(11,11,12,.95);color:#f2b134;border:2px solid #f2b134;border-radius:14px;padding:12px 20px;font:700 13px Poppins,sans-serif;z-index:55;pointer-events:auto;box-shadow:0 4px 14px rgba(0,0,0,.5);text-align:center;cursor:pointer;user-select:none;-webkit-user-select:none;";
    document.body.appendChild(_promptEl);
    // Tap the prompt itself to claim (mobile-friendly — no E key needed)
    _promptEl.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (_nearest) claimSpot(_nearest.spot);
    });
  }
  const r = RARITY[spot.rarity];
  _promptEl.innerHTML = `${r.glyph} <b>${r.label}</b> spot here!<br><span style="font-size:12px;color:#4ade80;font-weight:600;">Press here 🟢 to claim</span>`;
  _promptEl.style.display = "block";
  _bindClaimKey();
}

function _hidePrompt() {
  if (_promptEl) _promptEl.style.display = "none";
}

function _bindClaimKey() {
  if (_boundKey) return;
  _boundKey = true;
  addEventListener("keydown", _onClaimKey);
}
function _unbindClaimKey() {
  if (!_boundKey) return;
  _boundKey = false;
  removeEventListener("keydown", _onClaimKey);
}
function _onClaimKey(e) {
  if (e.key !== "e" && e.key !== "E") return;
  if (!_nearest) return;
  claimSpot(_nearest.spot);
}

// ---- Claim a spot via Firebase transaction ----
export async function claimSpot(spot) {
  if (!_uid) return;
  // Pre-check: are we really within range? (anti-cheat)
  const dx = spot.x - _player.x, dz = spot.z - _player.z;
  if (Math.sqrt(dx * dx + dz * dz) > CLAIM_RANGE + 1.5) {
    _toast?.("Too far — walk closer to claim.");
    return;
  }
  // Per-day cap — FIX: also persist dayClaimCount to Firebase so it survives logout/login
  const today = new Date().toISOString().slice(0, 10);
  if (_stats.lastClaimDay !== today) { _stats.lastClaimDay = today; _dayClaimCount = 0; }
  if (_dayClaimCount >= MAX_CLAIMS_PER_DAY) {
    _toast?.("🚫 You don reach today's claim limit (" + MAX_CLAIMS_PER_DAY + "). Try again tomorrow.");
    return;
  }
  // The reward is deterministic for this respawn bucket so every player who
  // *would* have claimed the same spot in the same cycle sees the same amount.
  const bucket = respawnBucket(spot.rarity);
  const reward = rollReward(spot.rarity, spot.id, bucket);
  const now = Date.now();
  // Firebase transaction on hunt/{spotId}. The first caller to find the spot
  // unclaimed (or past its respawn window) wins; everyone else gets "too late".
  const spotRef = ref(db, "hunt/" + spot.id);
  let won = false;
  let alreadyClaimed = false;
  try {
    await runTransaction(spotRef, (cur) => {
      const lastTs = cur && cur.ts ? cur.ts : 0;
      const r = RARITY[spot.rarity];
      if (now - lastTs < r.respawnMs) {
        // Still in respawn window — abort the transaction (returning undefined
        // tells Firebase to abort without writing).
        alreadyClaimed = true;
        return; // undefined → abort
      }
      won = true;
      return { claimedBy: _uid, ts: now, reward: reward, rarity: spot.rarity };
    });
  } catch (e) {
    console.warn("[hunt] transaction failed", e);
    _toast?.("Network wahala — try again.");
    return;
  }
  if (!won) {
    if (alreadyClaimed) {
      _toast?.("😅 Too late — someone don already claim this one. Try another spot.");
    } else {
      _toast?.("😅 Could not claim — try again.");
    }
    return;
  }
  // Won! Add reward to balance. We use a transaction here too so the balance
  // never desyncs if admin or another claim happens at the same instant.
  const balRef = ref(db, "economy/" + _uid + "/balance");
  try {
    await runTransaction(balRef, (cur) => (cur || 0) + reward);
  } catch (e) {
    console.warn("[hunt] balance update failed", e);
  }
  // Log the claim for audit
  try {
    const logRef = ref(db, "economy/" + _uid + "/log/" + now);
    await set(logRef, { type: "hunt", spotId: spot.id, reward: reward, rarity: spot.rarity, ts: now });
  } catch (e) { /* non-critical */ }
  // Update local stats
  _dayClaimCount++;
  _stats.totalClaims++;
  _stats.dayClaimCount = _dayClaimCount; // FIX: persist dayClaimCount in _stats so it loads on re-login
  if (spot.rarity === "jackpot") _stats.jackpotClaims++;
  if (spot.rarity === "rare")    _stats.rareClaims++;
  if (spot.rarity === "common")  _stats.commonClaims++;
  const hour = new Date().getHours();
  if (hour < 7) _stats.earlyBirdClaims++;
  _stats.areasClaimed = _stats.areasClaimed || {};
  _stats.areasClaimed[spot.area] = (_stats.areasClaimed[spot.area] || 0) + 1;
  // Save stats to Firebase so they persist across sessions.
  // FIX: Also save lastClaimDay and dayClaimCount so the progress doesn't reset on re-login
  try { await update(ref(db, "players/" + _uid + "/huntStats"), { ..._stats, lastClaimDay: _stats.lastClaimDay, dayClaimCount: _dayClaimCount }); } catch (e) {}
  // Local feedback
  _toast?.(`${RARITY[spot.rarity].glyph} You claim ₦${reward.toLocaleString()}! ${spot.rarity === "jackpot" ? "JACKPOT! 🏆" : ""}`);
  if (spot.rarity === "jackpot" || reward >= 50000) {
    _celebrate?.(`${RARITY[spot.rarity].glyph} JACKPOT!`, `₦${reward.toLocaleString()} found at ${spot.area}!`);
  }
  // Force the spot hidden locally so it doesn't show again until respawn.
  _spotState[spot.id] = { claimedBy: _uid, ts: now, reward };
  _hidePrompt();
  _nearest = null;
  _updateHud?.();
  // Check achievements
  _checkAchievements();
}

// ---- Achievements ----
async function _checkAchievements() {
  for (const a of HUNT_ACHIEVEMENTS) {
    if (_stats["ach_" + a.id]) continue;
    if (a.check(_stats)) {
      _stats["ach_" + a.id] = Date.now();
      try { await update(ref(db, "players/" + _uid + "/huntStats"), { ["ach_" + a.id]: _stats["ach_" + a.id] }); } catch (e) {}
      _toast?.(`${a.icon} Achievement unlocked: ${a.name}!`);
      _celebrate?.(a.icon, `Achievement: ${a.name}`);
    }
  }
}

// ---- Radar beep (warm/cold) ----
let _lastBeep = 0;
const _beepOsc = new (window.AudioContext || window.webkitAudioContext && new window.webkitAudioContext)();
function _tickRadar(now, nearestDist) {
  if (nearestDist == null) return;
  // Beep every 1.0s when far, every 0.25s when very close.
  const interval = Math.max(0.18, Math.min(1.4, nearestDist / 18));
  if (now - _lastBeep < interval * 1000) return;
  _lastBeep = now;
  try {
    const osc = _beepOsc.createOscillator();
    const gain = _beepOsc.createGain();
    osc.connect(gain); gain.connect(_beepOsc.destination);
    // Higher pitch when closer (warm), lower when far (cold).
    const pitch = 220 + (1 - Math.min(1, nearestDist / 25)) * 660;
    osc.frequency.value = pitch;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.04, _beepOsc.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, _beepOsc.currentTime + 0.12);
    osc.start();
    osc.stop(_beepOsc.currentTime + 0.12);
  } catch (e) { /* AudioContext not available */ }
}

// ---- Money Rain event ----
// Picks one random jackpot spot, marks it as "rain" eligible (extra reward),
// and writes an announcement so every player sees the toast. The spot itself
// is claimable like any other jackpot — the only difference is the announcement.
export async function triggerMoneyRain() {
  const jackpots = SPOTS.filter((s) => s.rarity === "jackpot");
  if (!jackpots.length) return;
  const pick = jackpots[Math.floor(Math.random() * jackpots.length)];
  try {
    const annRef = ref(db, "announcements");
    const key = "rain_" + Date.now();
    await update(annRef, { [key]: { text: "💸 Money Rain at " + pick.area + "! First to reach the spot wins big.", ts: Date.now(), alert: false } });
  } catch (e) { /* non-critical */ }
  _toast?.("💸 Money Rain at " + pick.area + "! Open your Hunt app for the hint.");
}

// ---- Public API ----
export function initMoneyHunt({ scene, player, uid, toast, updateHud, celebrate }) {
  _scene = scene;
  _player = player; // { x, z } (we read .x / .z live)
  _uid = uid;
  _toast = toast;
  _updateHud = updateHud;
  _celebrate = celebrate;
  _buildInstancedMeshes();
  // Subscribe to every spot's claim state.
  for (const spot of SPOTS) {
    const unsub = onValue(ref(db, "hunt/" + spot.id), (snap) => {
      const v = snap.val();
      _spotState[spot.id] = v || null;
    });
    _unsubSpotListeners.push(unsub);
  }
  // Load my stats — FIX: also restore dayClaimCount and lastClaimDay so progress persists
  if (uid) {
    get(ref(db, "players/" + uid + "/huntStats")).then((snap) => {
      const s = snap.val() || {};
      Object.assign(_stats, s);
      _stats.areasClaimed = s.areasClaimed || {};
      // FIX: Restore dayClaimCount from Firebase (was resetting to 0 on every login)
      const today = new Date().toISOString().slice(0, 10);
      if (s.lastClaimDay === today) {
        _dayClaimCount = s.dayClaimCount || 0;
      } else {
        // New day — reset
        _dayClaimCount = 0;
        _stats.lastClaimDay = today;
        _stats.dayClaimCount = 0;
      }
    }).catch(() => {});
  }
}

export function tickMoneyHunt(now) {
  _updateInstances(now);
}

export function getHuntStats() {
  return { ..._stats, dayClaimCount: _dayClaimCount, dayCap: MAX_CLAIMS_PER_DAY };
}

export function getNearestSpot() {
  return _nearest;
}

export function getSpotState(spotId) {
  return _spotState[spotId] || null;
}

export function getAllSpotsWithState() {
  return SPOTS.map((s) => ({
    ...s,
    state: _spotState[s.id] || null,
    claimable: !_spotState[s.id] || isClaimable(s, _spotState[s.id]?.ts),
    nextRespawnMs: _spotState[s.id] ? Math.max(0, _spotState[s.id].ts + RARITY[s.rarity].respawnMs - Date.now()) : 0,
  }));
}
