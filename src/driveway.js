// src/driveway.js — CARS OUTSIDE YOUR HOUSE (Nov 4, Claude fix-list #3:
// "let you see your cars on the street outside your house too").
//
// Cars that are NOT parked in a garage and NOT being ridden "rest" in the
// driveway in front of your owned houses (up to 2 per house). Walk to one and
// you get the same "Bring am out 🟢" prompt the garage gives — Enter/click and
// the car spawns right there, mounted and ready.
//
// Design notes:
//   • display-only meshes (the real ride spawns through the same onTakeOut
//     callback main.js gives the garage — one pipeline, no duplication)
//   • spot probe: 2 slots in front of the plot, scored against world colliders
//     (same idea as garage.js — a car never parks inside a wall)
//   • repaint (homeservice.js) fires a `kl_vehcolor` event; we rebuild that
//     car's display so the new colour shows outside too.

import * as THREE from "three";
import { db } from "./firebase.js";
import { ref, onValue } from "firebase/database";
import { getVehicle, getOwned, ownsVehicle, buildRemoteVehicleMesh, getVehHp, getVehColor } from "./vehicles.js";
import { getCarShape } from "./car_shapes.js";
import { garageContains } from "./garage.js";
import { getRideId } from "./vehicles.js";

const REFRESH_EVERY = 2.0;          // seconds between ownership/garage re-syncs
const PROMPT_DIST = 3.2;            // metres to show "Bring am out"
const PER_HOME = 2;                 // cars shown per house

let _scene = null, _cols = null, _getHomes = null, _onTakeOut = null;
let _uid = null;
let _homes = [];                    // [{a,p,x,z,rot}]
let _cars = [];                     // display records [{key, vid, grp, home, slot}]
let _syncT = 0, _promptEl = null, _promptKey = "", _pendingTake = null;
const _colorSubs = new Map();       // uid -> unsub (one live listener)

// ---- box-car shape fallback (mirror of garage.js SHAPE_OF) ----
const SHAPE_OF = { ksr_cruiser: "sedan", okada: "bike", keke: "keke", danfo: "van", bus: "van", truck: "truck", pickup: "pickup", jeep: "jeep", sport: "sport", ferrari: "sport", benz: "sedan", corolla: "sedan", taxi: "sedan", golf: "hatch", volkswagen: "hatch" };

export function initDriveway({ scene, colliders, getHomes, onTakeOut, uid }) {
  _scene = scene; _cols = colliders; _getHomes = getHomes; _onTakeOut = onTakeOut;
  if (uid != null) _setUid(uid);
  if (!_promptEl) {
    _promptEl = document.createElement("div");
    _promptEl.style.cssText = "position:fixed;left:50%;bottom:23%;transform:translateX(-50%);background:rgba(15,77,58,.95);color:#fff;padding:10px 18px;border-radius:12px;font:600 13px Poppins,sans-serif;display:none;z-index:30;cursor:pointer;pointer-events:auto;box-shadow:0 4px 14px rgba(0,0,0,.4);";
    _promptEl.addEventListener("click", () => { if (_pendingTake) _takeOut(_pendingTake); });
    document.body.appendChild(_promptEl);
    window.addEventListener("keydown", (e) => {
      if ((e.key === "e" || e.key === "E") && _pendingTake) { e.preventDefault(); _takeOut(_pendingTake); }
    });
  }
  // repaint events → rebuild the affected display car
  window.addEventListener("kl_vehcolor", (e) => {
    const vid = e.detail?.vid;
    for (const c of _cars) if (c.vid === vid && c.mesh) { _rebuildMesh(c); break; }
  });
}

export function drivewaySetUid(uid) { _setUid(uid); }

function _setUid(uid) {
  if (_uid === uid) return;
  _uid = uid;
  for (const un of _colorSubs.values()) { try { un(); } catch (e) {} }
  _colorSubs.clear();
  if (uid && db) {
    // colours live on players/{uid}/vehicleColors/{vid} = "#rrggbb" (homeservice writes)
    const un = onValue(ref(db, "players/" + uid + "/vehicleColors"), () => {
      for (const c of _cars) _rebuildMesh(c);
    }, () => {});
    _colorSubs.set(uid, un);
  }
}

// ---- public sync (main.js already pushes homes to the garage; reuse it) ----
export function drivewaySyncHomes(homes) {
  const want = new Map();
  for (const h of homes || []) if (h.own) want.set(h.a + "/" + h.p, h);
  let changed = want.size !== _homes.length;
  if (!changed) for (const h of _homes) { const w = want.get(h.a + "/" + h.p); if (!w || w.x !== h.x || w.z !== h.z) { changed = true; break; } }
  if (!changed) return;
  for (const c of _cars) _disposeCar(c);
  _cars = [];
  _homes = [...want.values()];
  _refresh();
}

function _carIdsForHome(homeKey) {
  // owned → not riding → not in a garage → first PER_HOME in stable order
  const owned = Object.keys(getOwned() || {}).filter((id) => ownsVehicle(id));
  const riding = getRideId();
  const free = owned.filter((id) => id !== riding && !garageContains(id)).sort();
  const per = Math.ceil(free.length / Math.max(1, _homes.length)) || PER_HOME;
  const idx = _homes.findIndex((h) => h.a + "/" + h.p === homeKey);
  return free.slice(idx * per, idx * per + PER_HOME);
}

function _refresh() {
  if (!_scene) return;
  const want = [];
  for (const h of _homes) {
    const vids = _carIdsForHome(h.a + "/" + h.p);
    vids.forEach((vid, i) => {
      const spot = _spotFor(h, i);
      if (spot) want.push({ key: h.a + "/" + h.p + ":" + i, vid, home: h, slot: i, x: spot.x, z: spot.z, heading: spot.heading });
    });
  }
  const have = new Map(_cars.map((c) => [c.key, c]));
  for (const c of _cars) if (!want.find((w) => w.key === c.key)) { _disposeCar(c); have.delete(c.key); }
  for (const w of want) {
    const cur = have.get(w.key);
    if (cur && cur.vid === w.vid && cur.mesh) continue;
    if (cur) { _disposeCar(cur); have.delete(w.key); }
    const grp = new THREE.Group();
    grp.position.set(w.x, 0, w.z);
    grp.rotation.y = w.heading;
    _scene.add(grp);
    const rec = { key: w.key, vid: w.vid, grp, home: w.home, slot: w.slot, mesh: null };
    _cars.push(rec);
    _rebuildMesh(rec);
  }
}

function _rebuildMesh(rec) {
  if (!rec) return;
  if (rec.mesh) { rec.grp.remove(rec.mesh); rec.mesh = null; }
  const token = (rec._tok = (rec._tok || 0) + 1);
  buildRemoteVehicleMesh(rec.vid).then((m) => {
    if (!m) m = _boxMesh(rec.vid);
    if (!m || rec._tok !== token || !_cars.includes(rec)) { try { m && _trash(m); } catch (e) {} return; }
    _tint(m, rec.vid);
    rec.mesh = m;
    rec.grp.add(m);
  }).catch(() => {
    const m = _boxMesh(rec.vid);
    if (m && rec._tok === token && _cars.includes(rec)) { _tint(m, rec.vid); rec.mesh = m; rec.grp.add(m); }
  });
}

function _boxMesh(vid) {
  const v = getVehicle(vid);
  if (!v) return null;
  const geo = getCarShape(SHAPE_OF[vid] || "sedan");
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.castShadow = false; mesh.frustumCulled = false;
  return mesh;
}

// full respray for the driveway display (real ride repaint lives in homeservice)
function _tint(m, vid) {
  const hex = getVehColor(vid);
  const hp = getVehHp(vid);
  if (!hex && hp >= 100) return;
  const shade = hp < 100 ? 1 - 0.55 * (100 - hp) / 100 : 1;
  m.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const next = list.map((mat) => {
      const c = mat.clone();
      if (hex && c.color) c.color.set(hex);
      if (shade < 1 && c.color) c.color.multiplyScalar(shade);
      return c;
    });
    o.material = Array.isArray(o.material) ? next : next[0];
  });
}

function _trash(m) { m.traverse((o) => { if (o.geometry) { try { o.geometry.dispose(); } catch (e) {} } }); }

function _disposeCar(c) {
  if (c.mesh) { c.grp.remove(c.mesh); _trash(c.mesh); }
  _scene.remove(c.grp);
  const i = _cars.indexOf(c);
  if (i >= 0) _cars.splice(i, 1);
}

// ---- driveway spots: two slots in front of the plot, collider-probed ----
function _spotFor(h, slot) {
  // front = towards the area road (plots face ±z by rot). Probe a small fan.
  const front = (h.rot === Math.PI) ? -1 : 1;
  const cands = [];
  for (const [dx, dz] of [[-1.5, 3.9], [1.5, 3.9], [0, 4.3], [-1.8, 3.4], [1.8, 3.4]]) {
    cands.push({ x: h.x + dx, z: h.z + front * dz * (h.rot === Math.PI ? -1 : 1), heading: front > 0 ? Math.PI / 2 : -Math.PI / 2 });
  }
  let best = null, bestScore = Infinity;
  for (const c of cands) {
    const s = _overlap(c.x, c.z, 2.4, 4.6);
    if (s < bestScore) { bestScore = s; best = c; }
  }
  if (!best || bestScore > 6) return null;          // too blocked — no driveway here
  // spread the two slots apart along x
  return { x: best.x + (slot === 0 ? -0.9 : 0.9), z: best.z, heading: best.heading };
}

function _overlap(cx, cz, hw, hd) {
  let overlap = 0;
  if (_cols) {
    for (const c of _cols) {
      if (c.minX >= cx + hw || c.maxX <= cx - hw || c.minZ >= cz + hd || c.maxZ <= cz - hd) continue;
      const ox = Math.min(c.maxX, cx + hw) - Math.max(c.minX, cx - hw);
      const oz = Math.min(c.maxZ, cz + hd) - Math.max(c.minZ, cz - hd);
      if (ox > 0 && oz > 0) overlap += ox * oz;
    }
  }
  return overlap;
}

// ---- per-frame prompt ----
export function tickDriveway(px, pz, dt, riding) {
  if (!_scene) return;
  _syncT -= dt;
  if (_syncT <= 0) { _syncT = REFRESH_EVERY; try { const hs = _getHomes && _getHomes(); if (hs) drivewaySyncHomes(hs); } catch (e) {} }
  let prompt = null, bestD = PROMPT_DIST * PROMPT_DIST;
  for (const c of _cars) {
    if (!c.mesh) continue;
    const d2 = (c.grp.position.x - px) * (c.grp.position.x - px) + (c.grp.position.z - pz) * (c.grp.position.z - pz);
    if (d2 < bestD) { bestD = d2; prompt = c; }
  }
  const pk = prompt ? prompt.key + "|" + prompt.vid : "";
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

function _takeOut(rec) {
  if (!rec || !_onTakeOut) return;
  if (!ownsVehicle(rec.vid)) { _refresh(); return; }   // sold while displayed
  _disposeCar(rec);                                     // it leaves the driveway
  _onTakeOut(rec.vid, { x: rec.grp.position.x, z: rec.grp.position.z }, rec.grp.rotation.y);
  if (_promptEl) { _promptEl.style.display = "none"; _promptKey = ""; _pendingTake = null; }
}

export function drivewayDbg() {
  return {
    homes: _homes.map((h) => h.a + "/" + h.p),
    cars: _cars.map((c) => ({ key: c.key, vid: c.vid, x: +c.grp.position.x.toFixed(1), z: +c.grp.position.z.toFixed(1), mesh: !!c.mesh })),
    promptKey: _promptKey,
  };
}
