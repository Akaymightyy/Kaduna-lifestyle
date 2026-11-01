// src/collision.js — SOLID WORLD (Nov 1)
// The user's complaint: "I'll be driving and entering through houses, cars, poles —
// that's not right". This module makes EVERYTHING solid, for walking AND driving:
//   * statics  — the existing world.colliders AABBs ({minX,maxX,minZ,maxZ}, same
//     format cityFill/world/street/areas_world already push). Nothing changes for
//     the producers — we just consume them smarter.
//   * dynamics — characters (remote multiplayer avatars, NPCs, life.js pedestrians)
//     register a small circle each frame via setDyn(); the local player and the
//     driven vehicle cannot ghost through them.
//   * vehicles — while riding, the player is no longer a 0.55 m capsule: the whole
//     VEHICLE BODY (a 3-circle chain along its heading) is resolved, so the nose,
//     tail and sides stop at walls, slide along them and lose speed on impact.
//
// PERFORMANCE (mobile-first): the full city has 2-3.5k colliders. We keep a hot
// near-list (everything within 120 m of the caller) rebuilt at most every 0.5 s —
// the same windowed pattern traffic.js and life.js already use — so the per-frame
// cost only depends on what is around you, not on city size.
//
// This file imports ONLY config.js (pure data) — no three.js, no Firebase, no
// circular imports. Every other module can safely import from here.

import { PLAYER_LIMIT_X, PLAYER_LIMIT_Z } from "./config.js";

// ---- Vehicle body sizes (metres from centre: hl = half length, hw = half width) ----
// Measured against the same numbers traffic.js/life.js use for car shadows and
// push-out (cars 5.2 x 2.6, danfo 9.2 x 3.0); okada/bicycle/keke are smaller.
export const VEH_BOX = {
  okada: { hl: 1.05, hw: 0.45 },
  bicycle: { hl: 0.85, hw: 0.35 },
  keke: { hl: 1.55, hw: 0.85 },
  bus: { hl: 4.6, hw: 1.5 },
  jeep: { hl: 2.6, hw: 1.35 },
  ferrari: { hl: 2.4, hw: 1.15 },
  _default: { hl: 2.6, hw: 1.25 },   // sedan / hatch / suv / sports / luxury / KSR cars
};
export function vehBoxOf(id) { return VEH_BOX[id] || VEH_BOX._default; }

// ---- State ----
let _cols = null;            // the live world.colliders array (streamed: rows come and go)
let _near = [];              // windowed hot subset (rebuilt every 0.5 s)
let _nearX = 0, _nearZ = 0, _nearT = -1e9;
const WIN = 120;             // metres of statics kept around the caller
const REBUILD = 0.5;         // seconds between near-list rebuilds
const _out = { x: 0, z: 0 }; // reusable push-out vector (no per-frame allocation)
const _dyn = new Map();      // id -> { x, z, r, t }  (characters; expires if not refreshed)

export function initCollision(colliders) { _cols = colliders; }

// ---- Dynamic circles (characters) ----
// Call EVERY FRAME (or at least every ~0.5 s) while the character is active;
// entries that stop being refreshed expire automatically after 1.2 s, so a
// despawned/hidden avatar never leaves an invisible wall behind.
export function setDyn(id, x, z, r) {
  const t = performance.now() / 1000;
  const d = _dyn.get(id);
  if (d) { d.x = x; d.z = z; d.r = r; d.t = t; }
  else _dyn.set(id, { x, z, r, t });
}
export function clearDyn(id) { _dyn.delete(id); }

function _purgeDyn(now) { for (const [k, d] of _dyn) if (now - d.t > 1.2) _dyn.delete(k); }

function _refreshNear(x, z) {
  const now = performance.now() / 1000;
  if (_nearT > -1e8 && now - _nearT < REBUILD && Math.abs(x - _nearX) < 40 && Math.abs(z - _nearZ) < 40) { _purgeDyn(now); return; }
  _nearT = now; _nearX = x; _nearZ = z;
  _near.length = 0;
  if (_cols) for (const b of _cols) {
    if (!isFinite(b.minX) || b.minX > b.maxX || b.minZ > b.maxZ) continue;   // degenerate/disabled slots
    if (b.maxX < x - WIN || b.minX > x + WIN || b.maxZ < z - WIN || b.minZ > z + WIN) continue;
    _near.push(b);
  }
  _purgeDyn(now);
}

// Debug / tests: how many colliders are live right now?
export function collisionStats() {
  return { total: _cols ? _cols.length : 0, near: _near.length, dyn: _dyn.size };
}

// ---- Core: push a circle OUT of one AABB ----
// Writes the push vector into _out and returns true when they overlapped.
// If the circle centre is INSIDE the box, pushes out along the smallest
// penetration axis (the old collide() always shoved +X, which teleported
// players sideways inside big buildings).
function _pushBox(px, pz, r, b, out) {
  if (!isFinite(b.minX) || b.minX > b.maxX || b.minZ > b.maxZ || b.off) return false;
  const cx = Math.max(b.minX, Math.min(px, b.maxX));
  const cz = Math.max(b.minZ, Math.min(pz, b.maxZ));
  const dx = px - cx, dz = pz - cz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 > 1e-6) {
    const d = Math.sqrt(d2), f = (r - d) / d;
    out.x = dx * f; out.z = dz * f;
    return true;
  }
  // centre exactly inside — escape along the nearest face (+ stand-off radius)
  const l = px - b.minX, ri = b.maxX - px, t = pz - b.minZ, bo = b.maxZ - pz;
  const m = Math.min(l, ri, t, bo);
  if (m === l) { out.x = -(l + r); out.z = 0; }
  else if (m === ri) { out.x = ri + r; out.z = 0; }
  else if (m === t) { out.x = 0; out.z = -(t + r); }
  else { out.x = 0; out.z = bo + r; }
  return true;
}

// Resolve `pos` against an explicit array of AABBs (3 relaxation iterations so
// corners with 2+ overlapping boxes can't tunnel). Honours b.off (disabled
// furniture while you sit on it). Returns the number of pushes applied.
export function resolveBoxed(pos, r, arr) {
  if (!arr || !arr.length) return 0;
  let hits = 0;
  for (let iter = 0; iter < 3; iter++) {
    let any = false;
    for (const b of arr) {
      if (_pushBox(pos.x, pos.z, r, b, _out)) { pos.x += _out.x; pos.z += _out.z; hits++; any = true; }
    }
    if (!any) break;
  }
  return hits;
}

// Resolve `pos` against the dynamic character circles (soft: pushes the LOCAL
// body out; remotes/NPCs are authoritative over their own positions).
export function resolveDyn(pos, r) {
  if (!_dyn.size) return 0;
  let hits = 0;
  for (let iter = 0; iter < 2; iter++) {
    let any = false;
    for (const d of _dyn.values()) {
      const dx = pos.x - d.x, dz = pos.z - d.z, rr = r + d.r, d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const dd = Math.sqrt(d2), f = (rr - dd) / dd;
        pos.x += dx * f; pos.z += dz * f; hits++; any = true;
      }
    }
    if (!any) break;
  }
  return hits;
}

// ---- Walking player: world bounds + windowed statics + characters ----
export function resolvePlayerMove(pos, r = 0.55) {
  pos.x = Math.max(-PLAYER_LIMIT_X, Math.min(PLAYER_LIMIT_X, pos.x));
  pos.z = Math.max(-PLAYER_LIMIT_Z, Math.min(PLAYER_LIMIT_Z, pos.z));
  _refreshNear(pos.x, pos.z);
  let hits = resolveBoxed(pos, r, _near);
  hits += resolveDyn(pos, r);
  return hits;
}

// ---- Driven vehicle: 3-circle body chain vs statics + characters ----
// The circles sit at the nose / centre / tail (offset ±(hl-hw) so the chain
// covers the full length). On impact the velocity component driving INTO the
// obstacle is removed (the car slides along the wall like a real car) and the
// remaining speed is cut — no more ghosting, and no hard stop dead in tracks.
export function resolveVehicleMove(player, rideId, dt) {
  const box = vehBoxOf(rideId);
  const pos = player.pos;
  pos.x = Math.max(-PLAYER_LIMIT_X, Math.min(PLAYER_LIMIT_X, pos.x));
  pos.z = Math.max(-PLAYER_LIMIT_Z, Math.min(PLAYER_LIMIT_Z, pos.z));
  _refreshNear(pos.x, pos.z);
  const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
  const off = Math.max(0, box.hl - box.hw);
  const offs = off > 0.01 ? [off, -off, 0] : [0];
  let hits = 0, nX = 0, nZ = 0;
  for (let iter = 0; iter < 3; iter++) {
    let any = false;
    for (const s of offs) {
      const cx = pos.x + fx * s, cz = pos.z + fz * s;
      for (const b of _near) {
        if (_pushBox(cx, cz, box.hw, b, _out)) {
          pos.x += _out.x; pos.z += _out.z; hits++; any = true;
          nX += _out.x; nZ += _out.z;
        }
      }
      for (const d of _dyn.values()) {
        const dx = cx - d.x, dz = cz - d.z, rr = box.hw + d.r, d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-6) {
          const dd = Math.sqrt(d2), f = (rr - dd) / dd;
          pos.x += dx * f; pos.z += dz * f; hits++; any = true;
          nX += dx * f; nZ += dz * f;
        }
      }
    }
    if (!any) break;
  }
  if (hits) {
    const l = Math.hypot(nX, nZ) || 1;
    const nx = nX / l, nz = nZ / l;                       // average push direction (away from the obstacle)
    if (player.kvel) {                                     // KSR cars: slide along the wall, keep some speed
      const d = player.kvel.x * nx + player.kvel.z * nz;
      if (d < 0) { player.kvel.x -= nx * d; player.kvel.z -= nz * d; }
      player.kvel.x *= 0.55; player.kvel.z *= 0.55;
    }
    if (player.speed) player.speed *= 0.5;                 // classic driveStep + HUD feel
  }
  return hits;
}

// ---- Test/debug helper: would a circle at (x,z) overlap a nearby static? ----
export function probeBlocked(x, z, r) {
  _refreshNear(x, z);
  for (const b of _near) if (_pushBox(x, z, r, b, _out)) return true;
  return false;
}

// Debug: return the FIRST static box a circle at (x,z) overlaps (or null).
export function firstHit(x, z, r) {
  _refreshNear(x, z);
  for (const b of _near) if (_pushBox(x, z, r, b, _out)) return { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ, off: !!b.off, lamp: !!b._lamp, tree: !!b._tree };
  return null;
}
