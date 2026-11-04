// src/race.js — MAIN STREET RACE (Nov 4, Claude fix-list #4: "Car meets or
// races with friends, using the KSR cars").
//
// A checkpoint drag race on the main street. Bring ANY ride (KSR cars included),
// walk to the 🏁 start beacon at the west end of the main street, press E:
//   3…2…1…GO → slalom through 6 glowing gates (they alternate left/right) →
//   finish near the zoo for your time.
//
//   • Personal best: localStorage (kl_race_pb)
//   • Server leaderboard: races/mainst/{uid} = { name, best, ts } (RTDB
//     transaction keeps the LOWEST time — everyone sees the top runners)
//   • Prize: ₦20,000 first finish of the day, ₦2,000 after that (through the
//     money guard → /api/money with reason "race_win", capped server-side)
//   • Dismount or leaving the road = DNF, no prize
//
// Gates sit on the main street (the x-axis road at z = 0), so the route can
// never drift out of the world: every x is inside ±WORLD_HALF_X.

import * as THREE from "three";
import { db } from "./firebase.js";
import { ref, runTransaction, get } from "firebase/database";
import { WORLD_HALF_X } from "./config.js";
import { earnMoney } from "./moneyapi.js";   // tagged "race_win" → server cap ₦25k

const START_X = -100, GATE_Z = 1.5;
const GATES = [
  { x: -88, z: -3 },   // slalom left
  { x: -53, z: 3 },    // right
  { x: 0, z: -3 },
  { x: 48, z: 3 },
  { x: 98, z: -3 },
  { x: 160, z: 3 },
];
const FINISH_X = Math.min(WORLD_HALF_X - 30, 200);
const PASS_DIST = 7.5;              // metres to pass a gate
const START_DIST = 6;               // metres to reach the start beacon
const PRIZE_FIRST = 20_000, PRIZE_AFTER = 2_000;

let _scene = null, _player = null, _playerFn = null, _isRiding = null, _toast = null, _game = null, _gameFn = null, _updateHUD = null;
function _P() { if (!_player) _player = _playerFn ? _playerFn() : null; return _player; }
function _G() { if (!_game) _game = _gameFn ? _gameFn() : null; return _game; }
let _name = () => "Player", _uid = () => null;
let _markers = [], _hud = null, _beacon = null;
let _state = "idle";                 // idle | waiting(countdown) | running
let _nextGate = 0, _t0 = 0, _countdownEnd = 0, _promptEl = null, _promptOn = false;
let _pb = null;
try { _pb = parseFloat(localStorage.getItem("kl_race_pb")) || null; } catch (e) {}

export function initRace({ scene, getPlayer, player, isRiding, toast, getGame, game, updateHUD, getName, getUid }) {
  // getPlayer/getGame are lazy getters — player/game are created later in main.js (TDZ-safe)
  _scene = scene; _playerFn = getPlayer || (player ? () => player : null); _isRiding = isRiding; _toast = toast || (() => {});
  _gameFn = getGame || (game ? () => game : null); _updateHUD = updateHUD || (() => {});
  _name = getName || _name; _uid = getUid || _uid;
  _buildCourse();
  if (!_promptEl) {
    _promptEl = document.createElement("div");
    _promptEl.style.cssText = "position:fixed;left:50%;bottom:23%;transform:translateX(-50%);background:rgba(140,20,20,.95);color:#fff;padding:10px 18px;border-radius:12px;font:600 13px Poppins,sans-serif;display:none;z-index:30;cursor:pointer;pointer-events:auto;box-shadow:0 4px 14px rgba(0,0,0,.4);";
    _promptEl.addEventListener("click", () => _tryStart());
    document.body.appendChild(_promptEl);
    window.addEventListener("keydown", (e) => {
      if ((e.key === "e" || e.key === "E") && _promptOn) { e.preventDefault(); _tryStart(); }
    });
  }
  if (!_hud) {
    _hud = document.createElement("div");
    _hud.style.cssText = "position:fixed;top:70px;left:50%;transform:translateX(-50%);background:rgba(20,24,28,.92);color:#fff;padding:10px 20px;border-radius:12px;font:700 16px Poppins,sans-serif;display:none;z-index:31;text-align:center;pointer-events:none;border:1px solid #e11d48;";
    document.body.appendChild(_hud);
  }
}

function _buildCourse() {
  if (!_scene || _markers.length) return;
  const pillarGeo = new THREE.BoxGeometry(0.5, 6, 0.5);
  const ringGeo = new THREE.TorusGeometry(3.2, 0.22, 8, 26);
  const mk = (x, z, color, isStart) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const mat = new THREE.MeshBasicMaterial({ color });
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(pillarGeo, mat);
      p.position.set(0, 3, s * 3.4);
      g.add(p);
    }
    const ring = new THREE.Mesh(ringGeo, mat.clone());
    ring.position.y = 3.2;
    ring.rotation.y = Math.PI / 2;
    g.add(ring);
    if (isStart) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 60, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xe11d48, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
      beam.position.y = 30;
      g.add(beam);
    }
    _scene.add(g);
    return { grp: g, ring };
  };
  _beacon = mk(START_X, GATE_Z, 0xe11d48, true);
  for (const gt of GATES) _markers.push(mk(gt.x, gt.z, 0xf2b134, false));
  const fin = mk(FINISH_X, GATE_Z, 0x2e7d4f, false);
  fin.finish = true;
  _markers.push(fin);
}

// per-frame: pulse the next gate, track passes, prompts, HUD
export function tickRace(px, pz, dt, now) {
  if (!_scene) return;
  const t = (now || performance.now()) / 1000;
  const pulse = 1 + Math.sin(t * 6) * 0.12;
  if (_beacon) _beacon.ring.scale.setScalar(pulse);
  _markers.forEach((m, i) => {
    if (!m.ring) return;
    const active = _state === "running" && i === _nextGate;
    m.ring.material.color.setHex(active ? 0x4ade80 : i === _markers.length - 1 ? 0x2e7d4f : 0xf2b134);
    m.ring.scale.setScalar(active ? pulse * 1.15 : pulse);
  });

  // start prompt (only on foot or already riding — you need a ride to race)
  if (_state === "idle") {
    const d2 = (START_X - px) * (START_X - px) + (GATE_Z - pz) * (GATE_Z - pz);
    const want = d2 < START_DIST * START_DIST;
    if (want !== _promptOn) {
      _promptOn = want;
      if (_promptEl) {
        _promptEl.textContent = "🏁 Street race — start 🟢 (bring your ride!)";
        _promptEl.style.display = want ? "block" : "none";
      }
    }
  } else if (_promptOn) {
    _promptOn = false;
    if (_promptEl) _promptEl.style.display = "none";
  }

  if (_state === "waiting") {
    const left = Math.ceil((_countdownEnd - Date.now()) / 1000);
    if (left > 0) { _hud.textContent = "🏁 " + left + "…"; return; }
    _state = "running"; _t0 = Date.now();
    _hud.textContent = "GO! 🏁";
    return;
  }
  if (_state !== "running") return;

  // dismount = DNF
  if (!_isRiding()) { _dnf("You come down from the ride — race don end."); return; }

  const gate = _markers[_nextGate];
  const gx = gate.finish ? FINISH_X : GATES[_nextGate].x;
  const gz = gate.finish ? GATE_Z : GATES[_nextGate].z;
  const d = Math.hypot(gx - px, gz - pz);
  const secs = (Date.now() - _t0) / 1000;
  _hud.textContent = "🏁 Gate " + (_nextGate + 1) + "/" + (_markers.length) + " — " + Math.round(d) + "m — ⏱ " + secs.toFixed(1) + "s";
  if (d < PASS_DIST) {
    if (gate.finish) { _finish(secs); return; }
    _nextGate++;
    _toast?.("✅ Gate " + _nextGate + "/" + GATES.length + "!");
  }
}

function _tryStart() {
  if (_state !== "idle") return;
  if (!_isRiding()) { _toast?.("You need a ride! Enter any car/bike/keke first, then come back."); return; }
  _nextGate = 0;
  _state = "waiting";
  _countdownEnd = Date.now() + 3200;
  if (_hud) _hud.style.display = "block";
  _toast?.("🏁 Race dey start — follow the green gate!");
}

function _dnf(why) {
  _state = "idle";
  if (_hud) _hud.style.display = "none";
  _toast?.("❌ " + why);
}

async function _finish(secs) {
  _state = "idle";
  if (_hud) _hud.style.display = "none";
  const isPB = !_pb || secs < _pb;
  if (isPB) { _pb = secs; try { localStorage.setItem("kl_race_pb", String(secs)); } catch (e) {} }
  _toast?.("🏁 FINISH! ⏱ " + secs.toFixed(1) + "s" + (isPB ? " — NEW PERSONAL BEST! 🏆" : " (PB " + _pb.toFixed(1) + "s)"));
  // prize: first finish of the day pays big (client date key, server caps anyway)
  let key = null;
  try { key = "kl_race_day_" + new Date().toISOString().slice(0, 10); } catch (e) {}
  let first = true;
  try { if (key && localStorage.getItem(key)) first = false; } catch (e) {}
  const prize = first ? PRIZE_FIRST : PRIZE_AFTER;
  if (key) { try { localStorage.setItem(key, "1"); } catch (e) {} }
  if (_G()) {
    earnMoney(prize, "race_win");        // trusted add + tagged op (server caps ₦25k/op)
    _updateHUD?.();
    _toast?.("💰 ₦" + prize.toLocaleString() + (first ? " — first race win of the day!" : " race bonus!"));
  }
  // leaderboard + tag the reason so the server cap is the right one
  _settleLeaderboard(secs);
}

async function _settleLeaderboard(secs) {
  const uid = _uid();
  if (!uid || !db) return;
  const rec = { name: (_name() || "Player").slice(0, 24), best: Math.round(secs * 10) / 10, ts: Date.now() };
  try {
    await runTransaction(ref(db, "races/mainst/" + uid), (cur) => {
      if (cur && typeof cur.best === "number" && cur.best <= rec.best) return cur;   // keep the better time
      return rec;
    });
  } catch (e) { console.warn("[race] leaderboard", e); }
}

export async function raceLeaderboard() {
  try { const snap = await get(ref(db, "races/mainst")); return snap.val() || {}; } catch (e) { return {}; }
}

export function raceDbg() {
  return {
    state: _state, nextGate: _nextGate, pb: _pb,
    beacon: _beacon ? [+_beacon.grp.position.x.toFixed(1), +_beacon.grp.position.z.toFixed(1)] : null,
    gates: _markers.length, hudShown: !!(_hud && _hud.style.display !== "none"),
  };
}
