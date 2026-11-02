// src/damage.js — VEHICLE DAMAGE (Nov 2): "vehicles can be hit, bash to break, destroyed".
//
// Every ride the player mounts has a damage state:
//   hp 100  →  drives fine
//   hp < 55 →  dented (body tilts a touch, thin smoke from the hood)
//   hp < 30 →  heavy smoke, more tilt
//   hp <= 0 →  WRECKED: engine dead (gas does nothing), fire + thick smoke,
//              body sits crooked and dark. Dismount and find another ride.
//
// The module owns the visuals on the ride mesh (tilt + darkened materials) so
// main.js only has to call hitRide() on impacts and tickRideDamage() per frame.
// Materials are cloned ONCE per ride (GLB models share materials with the
// cache — darkening the shared ones would burn every future ride too) and are
// freed in clearRideDamage() when the ride despawns.

let _hp = 100, _dead = false, _mesh = null, _cloned = [];
let _smokeT = 0, _lastHitAt = 0, _crashCool = 0, _ownGeo = [];

export function resetRideDamage(mesh) {
  _hp = 100; _dead = false; _smokeT = 0; _crashCool = 0;
  _mesh = mesh || null;
  _lastHitAt = 0;
  _cloneMaterials();
  _applyVisuals();
}

export function clearRideDamage() {
  for (const m of _cloned) { try { m.dispose(); } catch (e) {} }
  _cloned = []; _mesh = null; _hp = 100; _dead = false;
  for (const g of _ownGeo) { try { g.dispose(); } catch (e) {} }
  _ownGeo = [];
}

export function rideHp() { return _hp; }
export function rideDead() { return _dead; }
// brief window after a fresh hit (used to avoid double-counting one crash)
export function crashCooldown() { return _crashCool > 0; }

// dmg = impact energy from main.js (based on the speed the crash killed).
// Returns the hp AFTER the hit.
export function hitRide(dmg, wx, wz) {
  if (_dead) return 0;
  if (!(dmg > 0)) return _hp;
  if (wx != null && wz != null) { try { _dent(dmg, wx, wz); } catch (e) { console.warn("[damage] dent failed", e); } }
  _hp = Math.max(0, _hp - dmg);
  _lastHitAt = performance.now();
  _crashCool = 0.6;
  if (_hp <= 0) _dead = true;
  _applyVisuals();
  return _hp;
}

// per-frame: schedules smoke/fire puffs, applies tilt/sink, cools the crash window.
// Returns { state: "ok"|"dented"|"smoking"|"wreck", smoke: Vector3|null, fire: Vector3|null }
export function tickRideDamage(dt, pos, heading) {
  if (_crashCool > 0) _crashCool -= dt;
  const out = { state: _dead ? "wreck" : _hp < 30 ? "smoking" : _hp < 55 ? "dented" : "ok", smoke: null, fire: null };
  if (!_mesh || !pos) return out;
  if (out.state === "ok") return out;
  _smokeT -= dt;
  if (_smokeT <= 0) {
    _smokeT = _dead ? 0.16 : _hp < 30 ? 0.28 : 0.55;
    // the hood: a bit ahead of centre, along the heading
    const p = { x: pos.x + Math.sin(heading) * 1.6, y: 0.9, z: pos.z + Math.cos(heading) * 1.6 };
    out.smoke = p;
    if (_dead) out.fire = p;
  }
  return out;
}

// ---- visuals ----
function _cloneMaterials() {
  _cloned = [];
  if (!_mesh) return;
  const seen = new Set();
  _mesh.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const next = mats.map((m) => {
      if (seen.has(m)) return m;
      seen.add(m);
      const c = m.clone();
      _cloned.push(c);
      return c;
    });
    o.material = Array.isArray(o.material) ? next : next[0];
  });
}

function _applyVisuals() {
  if (!_mesh) return;
  const hurt = (100 - _hp) / 100;                          // 0 = fresh, 1 = wrecked
  // body sits progressively crooked (one fixed random-ish side, not jittering)
  const side = _hp % 2 ? 1 : -1;
  _mesh.rotation.z = side * 0.018 * hurt * 10;             // up to ~10° roll when wrecked
  _mesh.rotation.x = hurt >= 1 ? 0.03 : 0;                 // nose dips when dead
  // darken the body as damage builds (cloned materials only — the model cache stays clean)
  const shade = 1 - 0.55 * hurt;
  for (const m of _cloned) {
    if (!m.color) continue;
    if (m.userData._baseR == null) m.userData._baseR = m.color.r, m.userData._baseG = m.color.g, m.userData._baseB = m.color.b;
    m.color.setRGB(m.userData._baseR * shade, m.userData._baseG * shade, m.userData._baseB * shade);
  }
}

// ---- real dents: vertices near the impact point are pushed INTO the car, with a little crumple noise ----
// Geometry is cloned once per ride (GLB / KSR geometries are shared with the cache) and freed on despawn.
let _tmpV = null;
function _dent(dmg, wx, wz) {
  if (!_mesh) return;
  if (!_tmpV) _tmpV = { v: null };
  const THREE_V = _mesh.position.constructor;           // THREE.Vector3 without importing three here
  _mesh.updateMatrixWorld(true);
  const hit = _mesh.worldToLocal(new THREE_V(wx, 0.6, wz));
  const R = 0.9 + dmg * 0.045, depth = Math.min(0.75, 0.05 + dmg * 0.014);
  const centre = new THREE_V(0, 0.6, 0), dir = centre.clone().sub(hit); dir.y = 0; if (dir.lengthSq() < 1e-6) dir.set(-1, 0, 0); dir.normalize();
  const w = new THREE_V(), l = new THREE_V();
  _mesh.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const pos0 = o.geometry.attributes.position;
    if (pos0.count > 80000) return;                      // huge scanned models: skip (too slow on a phone)
    if (!o.userData._dentGeo) { o.geometry = o.geometry.clone(); _ownGeo.push(o.geometry); o.userData._dentGeo = true; }
    const pos = o.geometry.attributes.position;
    o.updateMatrixWorld(true);
    let changed = false;
    for (let i = 0; i < pos.count; i++) {
      w.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      l.copy(w); _mesh.worldToLocal(l);
      const d = l.distanceTo(hit);
      if (d > R) continue;
      const f = Math.pow(1 - d / R, 1.4);
      const n = (Math.sin(i * 12.9898 + dmg) * 43758.5453) % 1;      // stable pseudo-random crumple
      const push = depth * f * (0.75 + 0.5 * Math.abs(n));
      l.addScaledVector(dir, push); l.y -= push * 0.15 * Math.abs(n);
      w.copy(l); _mesh.localToWorld(w); o.worldToLocal(w);
      pos.setXYZ(i, w.x, w.y, w.z); changed = true;
    }
    if (changed) { pos.needsUpdate = true; o.geometry.computeVertexNormals(); o.geometry.computeBoundingSphere(); }
  });
}
