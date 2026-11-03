// src/garage.js — GTA-STYLE GARAGE (Nov 2): "garages in expensive houses so I can
// be seeing my cars in it and I can go back to park my cars there too. I move
// closer to the garage it opened, I go to the car I want to ride, it brings out
// enter button, I enter" (user, Nov 2).
//
// Every OWNED house of tier >= 5 (Mansion, Estate, Villa, Mega-Mansion,
// Presidential) gets a standalone garage block (Nigerian "boys quarter" style:
// it sits behind the house, its roller door facing the street side). Plots are
// packed tight (houses 6.6 m wide, rows 8 m apart) so placement is PROBED: four
// candidate spots around the plot are scored against the live world colliders
// and the cleanest one wins — the garage never blocks the house front door.
//
// The roller shutter opens when you (or your ride) come within ~8 m, and rolls
// back down when you leave. Your parked cars stand INSIDE, nose to the door.
// Walk up to one -> an "Enter" prompt appears -> tap (or press E) -> the car
// pulls out to the mouth of the garage with you in it. Dismount inside the
// garage zone -> the car is parked in a free slot. Dismount anywhere else ->
// the car goes to rest in your first garage (so a car is never "lost").
//
// Contents live in Firebase at players/{uid}/garage = { "areaId/plotNo": { s0:
// "ferrari", s1: null, ... } } — the same account everywhere, live-synced.

import * as THREE from "three";
import { db } from "./firebase.js";
import { ref, set, onValue } from "firebase/database";
import { getCarShape } from "./car_shapes.js";
import { getVehicle } from "./vehicles.js";
import { buildKsrMesh } from "./ksr_cars.js";

const TIER_MIN = 5;                 // first tier that comes with a garage
const slotsFor = (t) => (t >= 7 ? 3 : 2);
const DOOR_OPEN_DIST = 8;           // roller door opens within this range
const CAR_PROMPT_DIST = 2.7;        // "Enter" prompt range around a parked car
const SYNC_EVERY = 2.0;             // seconds between homes diff-syncs
// Display shape per catalog id (car_shapes are low-poly, cheap, always loaded)
const SHAPE_OF = {
  sedan: "sedan", hatch: "hatch", suv: "suv", jeep: "suv", taxi: "taxi",
  bus: "bus", pickup: "pickup", luxury: "sedan", sports: "sedan",
  ferrari: "sedan", keke: "hatch", okada: "hatch", bicycle: "hatch",
};
const SLOT_KEYS = ["s0", "s1", "s2"];

// ---- module state ----
let _scene = null, _cols = null, _uid = null, _getHomes = null, _takeOut = null;
let _garages = new Map();       // "a/p" -> garage record
let _contents = {};             // "a/p" -> { s0: id, s1: id, ... } (mirror of Firebase)
let _syncT = 0, _unsub = null;
let _promptEl = null, _promptKey = "", _pendingTake = null;

// ---- init: call once after the world exists ----
export function initGarage({ scene, colliders, getHomes, onTakeOut }) {
  _scene = scene; _cols = colliders; _getHomes = getHomes || null; _takeOut = onTakeOut || null;
  if (!_promptEl && typeof document !== "undefined") {
    const p = document.createElement("div");
    p.id = "garage-prompt";
    p.style.cssText = "position:fixed;left:50%;bottom:calc(26% + env(safe-area-inset-bottom));" +
      "transform:translateX(-50%);background:rgba(15,77,58,.85);color:#fff;" +
      "padding:8px 15px;border-radius:14px;font:600 12px Poppins,sans-serif;" +
      "box-shadow:0 4px 14px rgba(0,0,0,.35);display:none;z-index:31;" +
      "border:1.5px solid rgba(242,177,52,.7);text-align:center;max-width:88vw;cursor:pointer;";
    p.addEventListener("click", () => { if (_pendingTake) _doTakeOut(_pendingTake.g, _pendingTake.slot); });
    document.body.appendChild(p);
    _promptEl = p;
    window.addEventListener("keydown", (e) => {
      if ((e.key === "e" || e.key === "E") && _pendingTake) { e.preventDefault(); _doTakeOut(_pendingTake.g, _pendingTake.slot); }
    });
  }
}

// ---- account: (re)subscribe to this uid's garage contents ----
export function garageSetUid(uid) {
  if (uid === _uid) return;
  _uid = uid;
  if (_unsub) { try { _unsub(); } catch (e) {} _unsub = null; }
  _contents = {};
  if (!uid || !db) return;
  _unsub = onValue(ref(db, "players/" + uid + "/garage"), (snap) => {
    // Firebase layout: garage/{areaId}/{plotNo} = { s0: id, ... } — flatten to "a/p" keys
    const v = snap.val() || {}, out = {};
    for (const a of Object.keys(v)) {
      if (!v[a] || typeof v[a] !== "object") continue;
      for (const p of Object.keys(v[a])) if (v[a][p] && typeof v[a][p] === "object") out[a + "/" + p] = v[a][p];
    }
    _contents = out;
    for (const g of _garages.values()) _renderCars(g);   // live update every open garage
  });
}

// ---- homes diff-sync: main.js gives [{ a, p, tier, own }] — cheap every 2 s ----
export function garageSyncHomes(homes) {
  if (!homes) return;
  const want = new Map();
  for (const h of homes) {
    if (!h || !h.a || h.p == null || !h.own || (h.tier || 1) < TIER_MIN) continue;
    want.set(h.a + "/" + h.p, h);
  }
  let changed = want.size !== _garages.size;
  for (const [k, h] of want) {
    const g = _garages.get(k);
    if (!g || g.tier !== h.tier) { changed = true; break; }
  }
  if (!changed) return;
  for (const [k, g] of _garages) if (!want.has(k)) _disposeGarage(k);
  for (const [k, h] of want) if (!_garages.has(k)) _buildGarage(h);
}

// ---- build one garage (probe 4 spots, keep the cleanest) ----
function _buildGarage(h) {
  const key = h.a + "/" + h.p;
  // probe candidates: [dx, dz, mouthDir] — mouth points away from the house
  const CAND = [[0, -5.2, -1], [0, 5.2, 1], [0, -5.9, -1], [0, 5.9, 1]];
  const slots = slotsFor(h.tier || 5);
  const W = slots >= 3 ? 8.1 : 5.8, D = 4.6;
  let best = null, bestScore = Infinity;
  for (const [dx, dz, m] of CAND) {
    const cx = h.x + dx, cz = h.z + dz;
    const s = _overlapScore(cx, cz, W, D, m);
    if (s.score < bestScore) { bestScore = s.score; best = { cx, cz, m, ...s }; }
  }
  if (!best) return;
  const mouth = best.m;                                   // -1 door faces -z, +1 faces +z
  const grp = new THREE.Group();
  grp.position.set(best.cx, 0, best.cz);
  grp.rotation.y = mouth > 0 ? 0 : Math.PI;               // group-local +z is always the mouth side
  _scene.add(grp);

  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const box = (w, hh, d, x, y, z, c) => {
    const ms = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), mat(c));
    ms.position.set(x, y, z); ms.castShadow = false; ms.receiveShadow = false;
    grp.add(ms); return ms;
  };
  // slab, walls (back = local -z, sides = ±x), roof — local mouth at +z
  box(W, 0.1, D, 0, 0.05, 0, 0x303338);                          // floor
  box(W, 2.5, 0.16, 0, 1.25, -D / 2 + 0.08, 0x9c8f7a);           // back wall
  box(0.16, 2.5, D, -W / 2 + 0.08, 1.25, 0, 0x94876f);           // left wall
  box(0.16, 2.5, D, W / 2 - 0.08, 1.25, 0, 0x94876f);            // right wall
  box(W + 0.5, 0.16, D + 0.4, 0, 2.58, 0, 0x7a2e2b);             // roof
  // roller shutter: origin at its BOTTOM edge so scale.y coils it upward
  const doorGeo = new THREE.BoxGeometry(W - 0.3, 2.35, 0.1);
  doorGeo.translate(0, 1.175, 0);
  const door = new THREE.Mesh(doorGeo, mat(0xb8860b));
  door.position.set(0, 0.06, D / 2 - 0.12);
  grp.add(door);
  // lintel over the mouth
  box(W - 0.2, 0.22, 0.24, 0, 2.42, D / 2 - 0.12, 0x9c8f7a);

  // colliders for the three walls (world-space AABBs; mouth stays open)
  const coss = Math.cos(grp.rotation.y), sinn = Math.sin(grp.rotation.y);
  const toWorld = (lx, lz) => [best.cx + lx * coss + lz * sinn, best.cz - lx * sinn + lz * coss];
  const cols = [];
  const addCol = (lx, lz, hw, hd) => {
    const [wx, wz] = toWorld(lx, lz);
    const c = { minX: wx - hw, maxX: wx + hw, minZ: wz - hd, maxZ: wz + hd, _garage: key };
    _cols.push(c); cols.push(c);
  };
  addCol(0, -D / 2 + 0.08, W / 2, 0.1);                          // back wall
  addCol(-W / 2 + 0.08, 0, 0.1, D / 2);                          // left
  addCol(W / 2 - 0.08, 0, 0.1, D / 2);                           // right

  // slot positions (nose to the door): spread across the width in front of the back wall
  const slotPos = [];
  for (let i = 0; i < slots; i++) {
    const lx = slots === 1 ? 0 : -W / 2 + 1.35 + (i * (W - 2.7)) / (slots - 1);
    slotPos.push(lx);
  }
  const g = { key, tier: h.tier || 5, grp, door, cols, slotPos, slots, W, D,
              cx: best.cx, cz: best.cz, mouth, doorOpen: 0, cars: new Map() };
  _garages.set(key, g);
  _renderCars(g);
}

// overlap area between the garage AABB (axis-aligned — mouth is ±z) and world colliders
function _overlapScore(cx, cz, W, D, mouth) {
  const hw = W / 2, hd = D / 2;
  // shift the box slightly towards the mouth so the CLOSED side never clips the house
  const zc = cz + mouth * 0.35;
  let overlap = 0;
  if (_cols) {
    for (const c of _cols) {
      if (c.minX >= cx + hw || c.maxX <= cx - hw || c.minZ >= zc + hd || c.maxZ <= zc - hd) continue;
      const ox = Math.min(c.maxX, cx + hw) - Math.max(c.minX, cx - hw);
      const oz = Math.min(c.maxZ, zc + hd) - Math.max(c.minZ, zc - hd);
      if (ox > 0 && oz > 0) overlap += ox * oz;
    }
  }
  return { score: overlap, overlap };
}

// ---- parked car meshes for one garage ----
function _renderCars(g) {
  const have = _contents[g.key] || {};
  for (let i = 0; i < g.slots; i++) {
    const k = SLOT_KEYS[i], vid = have[k] || null;
    const cur = g.cars.get(k);
    if (!vid && cur) { g.grp.remove(cur.mesh); g.cars.delete(k); continue; }
    if (vid && cur && cur.vid === vid) continue;
    if (cur) { g.grp.remove(cur.mesh); g.cars.delete(k); }
    if (!vid) continue;
    const mesh = _displayMesh(vid);
    if (!mesh) continue;
    const lx = g.slotPos[i], lz = -g.D / 2 + 2.35;         // nose towards the mouth
    mesh.position.set(lx, 0.05, lz);
    mesh.rotation.y = -Math.PI / 2;                         // car front (+X) faces local +z (the mouth)
    g.grp.add(mesh);
    g.cars.set(k, { vid, mesh });
  }
}

function _displayMesh(vid) {
  const v = getVehicle(vid);
  if (!v) return null;
  if (vid.startsWith("ksr_")) {
    try { const m = buildKsrMesh(vid); if (m) { m.position?.set?.(0, 0, 0); return m; } } catch (e) {}
  }
  const geo = getCarShape(SHAPE_OF[vid] || "sedan");
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.castShadow = false; mesh.frustumCulled = false;
  return mesh;
}

// ---- per-frame: doors, prompt, diff-sync ----
export function tickGarage(px, pz, dt, riding) {
  if (!_scene) return;
  _syncT -= dt;
  if (_syncT <= 0) {
    _syncT = SYNC_EVERY;
    try { const homes = _getHomes && _getHomes(); if (homes) garageSyncHomes(homes); } catch (e) {}
  }
  let prompt = null, bestD = CAR_PROMPT_DIST * CAR_PROMPT_DIST;
  for (const g of _garages.values()) {
    // door: open when the player (or the ride) is near the mouth
    const mx = g.cx, mz = g.cz + g.mouth * (g.D / 2 + 1.2);
    const dd = (mx - px) * (mx - px) + (mz - pz) * (mz - pz);
    const want = dd < DOOR_OPEN_DIST * DOOR_OPEN_DIST ? 1 : 0;
    g.doorOpen += (want - g.doorOpen) * Math.min(1, dt * 4.5);
    if (g.doorOpen < 0.004) g.doorOpen = 0; else if (g.doorOpen > 0.996) g.doorOpen = 1;
    g.door.scale.y = 1 - 0.88 * g.doorOpen;                 // roller coils up
    g.door.position.y = 0.06 + 0.1 * g.doorOpen;
    if (!riding && g.doorOpen > 0.25) {
      // nearest parked car inside an OPEN garage gets the prompt
      const coss = Math.cos(g.grp.rotation.y), sinn = Math.sin(g.grp.rotation.y);
      for (const [k, car] of g.cars) {
        const lx = car.mesh.position.x, lz = car.mesh.position.z;
        const wx = g.cx + lx * coss + lz * sinn, wz = g.cz - lx * sinn + lz * coss;
        const d2 = (wx - px) * (wx - px) + (wz - pz) * (wz - pz);
        if (d2 < bestD) { bestD = d2; prompt = { g, slot: k, vid: car.vid, x: wx, z: wz }; }
      }
    }
  }
  // DOM prompt with key-diffing (no innerHTML churn at 60fps)
  const pk = prompt ? prompt.g.key + "|" + prompt.slot + "|" + prompt.vid : "";
  if (pk !== _promptKey) {
    _promptKey = pk; _pendingTake = prompt;
    if (!_promptEl) return;
    if (prompt) {
      const v = getVehicle(prompt.vid);
      _promptEl.textContent = (v ? v.emoji + " " + v.name : "🚗 Car") + " — Bring am out 🟢";
      _promptEl.style.display = "block";
    } else _promptEl.style.display = "none";
  }
}

function _doTakeOut(g, slot) {
  const vid = (_contents[g.key] || {})[slot];
  if (!vid || !_takeOut) return;
  const coss = Math.cos(g.grp.rotation.y), sinn = Math.sin(g.grp.rotation.y);
  const lx = 0, lz = g.D / 2 + 3.0;                          // pull out to just outside the mouth
  const wx = g.cx + lx * coss + lz * sinn, wz = g.cz - lx * sinn + lz * coss;
  const heading = g.mouth > 0 ? 0 : Math.PI;                 // forward = (sin h, cos h) → face the mouth
  // free the slot FIRST (Firebase), then mount — onValue re-renders the empty slot
  const next = { ...(_contents[g.key] || {}) }; delete next[slot];
  _writeGarage(g.key, next);
  try { _takeOut(vid, { x: wx, z: wz }, heading); } catch (e) { console.warn("[garage] takeOut", e); }
  if (_promptEl) { _promptEl.style.display = "none"; _promptKey = ""; _pendingTake = null; }
}

// ---- parking ----
export function garagePark(garageKey, vehicleId) {
  const g = garageKey ? _garages.get(garageKey) : _garages.values().next().value;
  if (!g || !vehicleId) return false;
  const have = { ...(_contents[g.key] || {}) };
  let slot = -1;
  for (let i = 0; i < g.slots; i++) if (!have[SLOT_KEYS[i]]) { slot = i; break; }
  if (slot < 0) return false;
  have[SLOT_KEYS[slot]] = vehicleId;
  _writeGarage(g.key, have);
  return true;
}

// is the point inside/near THIS garage (for dismount auto-park)? apron included.
export function garageZoneAt(px, pz) {
  for (const g of _garages.values()) {
    const dx = px - g.cx, dz = pz - g.cz;
    if (Math.abs(dx) < g.W / 2 + 1.6 && Math.abs(dz) < g.D / 2 + 3.4) return g.key;  // apron included
  }
  return null;
}

export function garageContains(vehicleId) {
  for (const c of Object.values(_contents)) for (const k of SLOT_KEYS) if (c && c[k] === vehicleId) return true;
  return false;
}

export function garageCount() { return _garages.size; }

function _writeGarage(key, slotsObj) {
  _contents[key] = slotsObj;
  if (_uid && db) {
    // nested path players/{uid}/garage/{areaId}/{plotNo} — area ids contain "_"
    // (ungwan_rimi) so the separator must never be stored INSIDE one key
    const si = key.indexOf("/");
    const path = "players/" + _uid + "/garage/" + key.slice(0, si) + "/" + key.slice(si + 1);
    set(ref(db, path), slotsObj).catch((e) => console.warn("[garage] save", e));
  }
  const g = _garages.get(key);
  if (g) _renderCars(g);
}

function _disposeGarage(key) {
  const g = _garages.get(key);
  if (!g) return;
  for (const c of g.cols) { const i = _cols.indexOf(c); if (i >= 0) _cols.splice(i, 1); }
  _scene.remove(g.grp);
  g.grp.traverse((o) => { if (o.geometry) { try { o.geometry.dispose(); } catch (e) {} } if (o.material) { try { o.material.dispose(); } catch (e) {} } });
  _garages.delete(key);
}

// ---- test hooks ----
export function garageDbg() {
  const out = [];
  for (const g of _garages.values()) {
    const cars = {};
    for (const [k, c] of g.cars) {
      const coss = Math.cos(g.grp.rotation.y), sinn = Math.sin(g.grp.rotation.y);
      cars[k] = { vid: c.vid, x: +(g.cx + c.mesh.position.x * coss + c.mesh.position.z * sinn).toFixed(2), z: +(g.cz - c.mesh.position.x * sinn + c.mesh.position.z * coss).toFixed(2) };
    }
    out.push({ key: g.key, tier: g.tier, door: +g.doorOpen.toFixed(2), slots: g.slots, cars, cx: +g.cx.toFixed(2), cz: +g.cz.toFixed(2), mouth: g.mouth });
  }
  return { garages: out, contents: _contents, promptShown: _promptEl ? _promptEl.style.display === "block" : false, promptKey: _promptKey };
}
