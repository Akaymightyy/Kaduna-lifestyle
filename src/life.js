// src/life.js — things that MOVE, so the big city never feels empty:
//   - cars driving the 4 avenues and 4 cross streets (and round the roundabouts)
//   - people walking along every district road
//   - boats on the lake, and a plane that takes off and lands at the airport
// Everything is instanced / merged (6 draw calls in total) and costs almost nothing on the CPU.
import * as THREE from "three";
import { WIDE_AVENUES_X, WIDE_CROSS_Z, MAP_HALF_X, MAP_HALF_Z } from "./config.js";
import { AREAS } from "./areas.js";
import { LAKE, AIRPORT } from "./scenery.js";
import { makeBlobShadows } from "./street.js";
import { NIGHT_GLOW } from "./art/style.js";
import { getCarShape } from "./car_shapes.js";
import { carShape, busShape, personParts, hash2, paint, flatten, B, done } from "./town.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createCharacter, loadCharacterBase } from "./characters.js";

// ---- real 3D vehicles (same models as the main street) swapped in for the box cars ----
let carG = [], busG = null, glbReady = false;
export async function glbInstanced(vehicleId, count) {
  const { loadFittedModel } = await import("./vehicles.js");
  const holder = await loadFittedModel(vehicleId); if (!holder) return null;
  holder.updateMatrixWorld(true);
  const buckets = new Map();
  holder.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry) return;
    let g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (g.index) g = g.toNonIndexed();
    const mt = o.material; if (!buckets.has(mt)) buckets.set(mt, []); buckets.get(mt).push(g);
  });
  if (!buckets.size) return null;
  const mats = [], geos = [];
  for (const [mt, list] of buckets) {
    geos.push(mergeGeometries(list, false));
    const lm = new THREE.MeshLambertMaterial({ color: mt.color ? mt.color.clone() : 0xffffff, map: mt.map || null, transparent: !!mt.transparent, opacity: mt.opacity == null ? 1 : mt.opacity, side: mt.side });
    if (mt.map) lm.map.colorSpace = THREE.SRGBColorSpace;
    mats.push(lm);
  }
  const im = new THREE.InstancedMesh(mergeGeometries(geos, true), mats, Math.max(1, count));
  im.frustumCulled = false;
  for (let i = 0; i < count; i++) im.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
  return im;
}

// ---- real people: a small pool of full character models is lent to the walkers nearest the player ----
const POOL = 10, RIGS = [];                 // { ch, who:-1 }
const SHOW_R = 55, CROWD_R = 300;  // Oct 23: was 150 — too small for 580m map, pedestrians invisible in outer districts
const slotOwner = [];                       // which person each packed crowd slot currently shows
let PEOPLE_COLS = [];

let _scene = null, _on = false, _t = 0, _last = 0;
let _collidersRef = [];  // FIX (Oct 23): store collider reference for runtime guard
let _colliderRebuildT = 0;  // timer: rebuild nearby collider list every 0.5s
let _nearbyColliders = [];  // cached list of colliders near the player
let carX = [], BEAM = null, SH = null, carMesh = null, busMesh = null, pm = null, boats = [], plane = null;
const cars = [], buses = [], people = [];
const _pv = { x: 0, z: 0, on: false };             // the player's own vehicle: cars wait for it
export function setLifePlayerVehicle(x, z, on) { _pv.x = x; _pv.z = z; _pv.on = !!on; }
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0), _col = new THREE.Color(), _mb = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _m3 = new THREE.Matrix4(), _Z = new THREE.Matrix4().makeScale(0, 0, 0), _s2 = new THREE.Vector3();
const RB = [];                                       // roundabout centres
for (const ax of WIDE_AVENUES_X) for (const cz of [-195, 195]) RB.push([ax, cz]);

// ---- road path: position at arc-length s along a lane (bends round roundabouts) ----
function lanePos(c, s, out) {
  const len = c.len;
  let t = ((s % len) + len) % len;
  const mid = c.mid || 0, along = c.dir > 0 ? mid - len / 2 + t : mid + len / 2 - t;
  let x, z;
  if (c.axis === "z") { x = c.fix + c.off; z = along; } else { x = along; z = c.fix + c.off; }
  for (const [rx, rz] of RB) {                       // go round the island instead of through it
    const dx = x - rx, dz = z - rz;
    if (c.axis === "z" && Math.abs(c.fix - rx) < 1 && Math.abs(dz) < 16) { const b = Math.sqrt(Math.max(0, 15 * 15 - dz * dz)); x = rx + Math.sign(c.off) * Math.max(Math.abs(c.off), b); }
    else if (c.axis === "x" && Math.abs(c.fix - rz) < 1 && Math.abs(dx) < 16) { const b = Math.sqrt(Math.max(0, 15 * 15 - dx * dx)); z = rz + Math.sign(c.off) * Math.max(Math.abs(c.off), b); }
  }
  out.set(x, 0, z); return out;
}

// Split a lane into the stretches where a car really fits: anywhere a building, wall, gate or kiosk sits on the road,
// that bit is cut out and cars never enter it (they loop inside each clear stretch and shrink away at the ends).
function clearStretches(ln, cols) {
  const tmp = { axis: ln.axis, fix: ln.fix, off: ln.off, dir: 1, len: ln.len, mid: 0 }, P = new THREE.Vector3();
  const cx = ln.axis === "z" ? ln.fix + ln.off : 0, cz = ln.axis === "x" ? ln.fix + ln.off : 0;
  const near = cols.filter((c) => c.minX < c.maxX && (ln.axis === "z" ? (c.maxX > cx - 30 && c.minX < cx + 30) : (c.maxZ > cz - 30 && c.minZ < cz + 30)));
  const hx = ln.axis === "z" ? 1.5 : 3.2, hz = ln.axis === "z" ? 3.2 : 1.5;
  const segs = []; let start = null;
  for (let a = -ln.len / 2; a <= ln.len / 2; a += 1) {
    lanePos(tmp, a + ln.len / 2, P);
    let blocked = false;
    for (const c of near) if (P.x + hx > c.minX && P.x - hx < c.maxX && P.z + hz > c.minZ && P.z - hz < c.maxZ) { blocked = true; break; }
    if (!blocked && start === null) start = a;
    if ((blocked || a + 1 > ln.len / 2) && start !== null) { const b = a - (blocked ? 1.5 : 0); if (b - start >= 28) segs.push({ axis: ln.axis, fix: ln.fix, off: ln.off, dir: ln.dir, len: b - start - 3, mid: (start + b) / 2 }); start = null; }
  }
  return segs.length ? segs : [ln];
}
const pickSeg = (segs, f) => { const tot = segs.reduce((a, g) => a + g.len, 0); let x = (f % 1) * tot; for (const g of segs) { if (x < g.len) return g; x -= g.len; } return segs[segs.length - 1]; };

// ---- TODO #5 (Oct 24): junction give-way + IDM-lite gap keeping ----
// _lifePos: our own vehicle positions, read by traffic.js (via a provider
// wired in main.js) so main-street cars stop at the avenue junctions.
// _crossProv: the other direction — set by main.js to () => traffic.positions
// so OUR cars stop before crossing the main street.
const _lifePos = [];
export function lifeTrafficPositions() { return _lifePos; }
let _crossProv = null;
export function setLifeCrossTrafficProvider(fn) { _crossProv = fn; }
const _snapAll = [];                                   // per-vehicle { ln, x, z } snapshot from before this frame's advance

export function initLife(scene, colliders = []) {
  _scene = scene;
  _collidersRef = colliders;  // FIX (Oct 23): store for runtime guard
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  // roads: lane offset +-2.8, 3 cars per lane, 2 buses per avenue
  const lanes = [];
  for (const ax of WIDE_AVENUES_X) for (const off of [-2.8, 2.8]) lanes.push({ axis: "z", fix: ax, off, dir: off > 0 ? 1 : -1, len: MAP_HALF_Z * 2 - 30 });
  for (const cz of WIDE_CROSS_Z) for (const off of [-2.8, 2.8]) lanes.push({ axis: "x", fix: cz, off, dir: off > 0 ? 1 : -1, len: MAP_HALF_X * 2 - 30 });
  lanes.forEach((full, li) => {
    const segs = clearStretches(full, colliders);
    (window.__laneSegs = window.__laneSegs || []).push({ axis: full.axis, fix: full.fix, off: full.off, segs: segs.map((g) => [Math.round(g.mid - g.len / 2), Math.round(g.mid + g.len / 2)]) });
    for (let k = 0; k < 3; k++) { const ln = pickSeg(segs, (k + 0.5) / 3 + hash2("cs" + li, k) * 0.1); cars.push({ ln, s: hash2("c" + li, k) * ln.len, v: 9 + hash2("v" + li, k) * 6, hue: hash2("h" + li, k) }); }
    if (li % 2 === 0) { const ln = pickSeg(segs, hash2("bs" + li, 1)); buses.push({ ln, s: hash2("b" + li, 1) * ln.len, v: 6 + hash2("bv" + li, 1) * 2 }); }
  });
  carMesh = new THREE.InstancedMesh(carShape(), mat, cars.length); carMesh.frustumCulled = false;
  cars.forEach((c, i) => carMesh.setColorAt(i, _col.setHSL(c.hue, 0.6, 0.5)));
  busMesh = new THREE.InstancedMesh(busShape(), mat, buses.length); busMesh.frustumCulled = false;
  buses.forEach((c, i) => busMesh.setColorAt(i, _col.set(0xf2b134)));
  // variety: every 4th car is a hatchback / SUV / pickup (own instanced meshes, still just a few draw calls)
  cars.forEach((c, i) => { c.t = i % 4; });
  carX = ["hatch", "suv", "pickup"].map((k, ki) => { const m = new THREE.InstancedMesh(getCarShape(k), mat, cars.length); m.frustumCulled = false; cars.forEach((c, i) => m.setColorAt(i, _col.setHSL(c.hue, 0.6, 0.5))); for (let i = 0; i < cars.length; i++) m.setMatrixAt(i, _Z); scene.add(m); return m; });
  scene.add(carMesh, busMesh);
  (async () => {
    try {
      const kinds = [];   // box cars restored (the jeep model looked half-made: its texture is missing). Danfo bus keeps the real model.
      // const kinds = ["jeep"];   // light model only (jeep ~11k tris, danfo ~20k). Ferrari (311k) and keke (126k) per instance would freeze phones
      const list = await Promise.all(kinds.map((k, ki) => glbInstanced(k, cars.length)));
      const bus = await glbInstanced("bus", buses.length);
      if (list.every(Boolean)) { carG = list; carG.forEach((m) => { cars.forEach((c, i) => m.setColorAt(i, _col.setHSL(c.hue, 0.55, 0.62))); m.instanceColor.needsUpdate = true; scene.add(m); }); }
      if (bus) { busG = bus; scene.add(bus); }
      glbReady = true;
    } catch (e) { console.warn("[life] glb vehicles failed", e); }
  })();
  (async () => {
    try { await loadCharacterBase(THREE.DefaultLoadingManager, "male"); } catch (e) { console.warn("[life] base load failed", e); return; }
    for (let i = 0; i < POOL; i++) {
      try {
        const ch = await createCharacter({ seed: 900 + i * 31, height: 1.62 + hash2("ph", i) * 0.22, outfit: i % 3 === 0 ? "kaftan" : "casual" });
        ch.group.visible = false; ch.group.traverse((o) => { if (o.isMesh) { o.frustumCulled = true; o.castShadow = false; } });
        scene.add(ch.group); RIGS.push({ ch, who: -1 });
      } catch (e) { console.warn("[life] rig failed", e); break; }
      await new Promise((r) => setTimeout(r, 60));
    }
  })();

  // people: 6 per district — 4 walkers on the pavements + 2 neighbours standing to chat.
  // Every walker has swinging legs and arms, a different height, and one of 3 outfits (shirt & trousers, kaftan, gown & hijab).
  const PP = personParts(), PER = 22, N = AREAS.length * PER;
  const SKINS = [0x3b2418, 0x5a3a26, 0x7a4e32, 0x2a1810, 0x9a6a46, 0x6b4429];
  const SHIRTS = [0xe8e2d0, 0x2f6fb5, 0xc0392b, 0x2e7d4f, 0xf2b134, 0x6b4a8a, 0x1f1f24, 0xd98e2b, 0x3aa6a0];
  const TROUS = [0x1f2a36, 0x2a2a2e, 0x4a3b2a, 0x3b4f72, 0x5a5a5e];
  const ROBES = [0xf4f1ea, 0xe8dcc0, 0x3b4a8a, 0x6a4a2a, 0x2e5d4a, 0x8a8f96];
  const GOWNS = [0xd98e2b, 0xa23b72, 0x1a8a7a, 0xe06a5a, 0x6b4a8a, 0xc0392b, 0x3b7ac0];
  const pick = (arr, a, b) => arr[Math.floor(hash2(a, b) * arr.length) % arr.length];
  let pi = 0;
  for (const a of AREAS) {
    for (let k = 0; k < PER; k++, pi++) {
      const q = (k - 16) >> 1, cx = a.x + (hash2(a.id, "chat" + q) - 0.5) * 80;
      const side = k % 2 ? 1 : -1, id = a.id + k, r = hash2(id, "type");
      const type = r < 0.5 ? 0 : r < 0.72 ? 1 : 2, kid = type === 0 && hash2(id, "kid") < 0.14;
      const p = { type, sc: kid ? 0.62 : 0.93 + hash2(id, "h") * 0.14, skin: pick(SKINS, id, "s"), az: a.z + side * (3.6 + hash2(a.id, "pz" + k) * 0.6), ax: a.x,
        span: 40 + hash2(a.id, "ps" + k) * 22, ph: hash2(a.id, "pp" + k) * 100, sp: (kid ? 1.8 : 1.1) + hash2(a.id, "pv" + k) * 0.7, chat: k >= 16 };
      p.top = type === 0 ? pick(SHIRTS, id, "t") : type === 1 ? pick(ROBES, id, "r") : pick(GOWNS, id, "g"); p.bot = pick(TROUS, id, "b");
      if (p.chat) { const lead = k % 2 === 0; p.az = a.z + (lead ? -1 : 1) * 3.9; p.cx = cx + (lead ? -0.6 : 0.6); p.face = lead ? Math.PI / 2 : -Math.PI / 2; }
      people.push(p);
    }
  }
  const mk = (geo) => { const m = new THREE.InstancedMesh(geo, mat, N); m.frustumCulled = false; m.count = 0; scene.add(m); return m; };
  pm = { torso: mk(PP.torso), kaftan: mk(PP.kaftan), gown: mk(PP.gown), legL: mk(PP.leg), legR: mk(PP.leg), armL: mk(PP.arm), armR: mk(PP.arm), hair: mk(PP.headHair), cap: mk(PP.headCap), bare: mk(PP.headBare) };
  PEOPLE_COLS = [[pm.torso, (p) => p.top], [pm.kaftan, (p) => p.top], [pm.gown, (p) => p.top], [pm.legL, (p) => p.bot], [pm.legR, (p) => p.bot], [pm.armL, (p) => p.top], [pm.armR, (p) => p.top], [pm.hair, (p) => p.skin], [pm.cap, (p) => p.skin], [pm.bare, (p) => p.skin]].map(([m, c]) => ({ m, c }));
  people.forEach((p, i) => {
    const sleeve = _col.set(p.top);
    pm.torso.setColorAt(i, _col.set(p.top)); pm.kaftan.setColorAt(i, _col.set(p.top)); pm.gown.setColorAt(i, _col.set(p.top));
    pm.legL.setColorAt(i, _col.set(p.bot)); pm.legR.setColorAt(i, _col.set(p.bot));
    pm.armL.setColorAt(i, _col.set(p.top)); pm.armR.setColorAt(i, _col.set(p.top));
    for (const h of [pm.hair, pm.cap, pm.bare]) h.setColorAt(i, _col.set(p.skin));
  });
  for (const k in pm) if (pm[k].instanceColor) pm[k].instanceColor.needsUpdate = true;

  // boats on the lake
  for (let i = 0; i < 3; i++) {
    const L = []; B(L, 2.2, 0.7, 5.5, 0, 0.35, 0, 0x8a5a2b); B(L, 0.12, 5, 0.12, 0, 3, 0.3, 0xdddddd);
    const sail = new THREE.ConeGeometry(1.6, 4.2, 3); sail.rotateY(Math.PI / 2); sail.translate(0.05, 3.2, 0.4); sail.scale(0.15, 1, 1); L.push(paint(flatten(sail), [0xffffff, 0xf2b134, 0xe4572e][i]));
    const g = done(L); const m = new THREE.Mesh(g, mat); m.frustumCulled = false; scene.add(m);
    boats.push({ m, ph: i * 2.1, rx: LAKE.rx * (0.45 + i * 0.12), rz: LAKE.rz * (0.4 + i * 0.1), sp: 0.035 + i * 0.01 });
  }
  // plane (original jet shape)
  const P = []; const put = (g, v) => { P.push(paint(flatten(g), v)); };
  put(new THREE.CylinderGeometry(2.1, 1.6, 32, 10).rotateX(Math.PI / 2).translate(0, 3.2, 0), 0xf2f2f2);
  put(new THREE.ConeGeometry(2.1, 5, 10).rotateX(Math.PI / 2).translate(0, 3.2, 18.5), 0xf2f2f2);
  put(new THREE.BoxGeometry(34, 0.5, 6).translate(0, 3, 1), 0xe8eef2);
  put(new THREE.BoxGeometry(0.5, 7, 5).translate(0, 6.8, -14), 0x0f7a4a);
  put(new THREE.BoxGeometry(12, 0.4, 3.5).translate(0, 4.2, -14.5), 0xe8eef2);
  plane = new THREE.Mesh(done(P), mat); plane.frustumCulled = false; plane.rotation.order = "YXZ"; scene.add(plane);
  { const bg = new THREE.BufferGeometry(), v = [2.3, 0.07, -0.7, 2.3, 0.07, 0.7, 11, 0.07, 2.6, 11, 0.07, -2.6], a = [0, 1, 2, 0, 2, 3, 2.3, 0.07, -0.7];
    bg.setAttribute("position", new THREE.BufferAttribute(new Float32Array([v[0],v[1],v[2], v[3],v[4],v[5], v[6],v[7],v[8], v[0],v[1],v[2], v[6],v[7],v[8], v[9],v[10],v[11]]), 3));
    bg.setAttribute("color", new THREE.BufferAttribute(new Float32Array([1,1,1, 1,1,1, 0,0,0, 1,1,1, 0,0,0, 0,0,0]), 3));
    const bm = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xffe2a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -7 });
    BEAM = new THREE.InstancedMesh(bg, bm, cars.length + buses.length); BEAM.frustumCulled = false; BEAM.visible = false; scene.add(BEAM); }
  SH = makeBlobShadows(scene, cars.length + buses.length + people.length);
  for (let i = 0; i < cars.length + buses.length; i++) { _lifePos.push({ x: 0, z: 0 }); _snapAll.push({ ln: null, x: 0, z: 0 }); }
  _on = true;
}

/** call every frame. `show=false` hides everything (inside a building). */
export function tickLife(px, pz, show = true) {
  if (!_on) return;
  const now = performance.now() / 1000, dt = Math.min(0.1, _last ? now - _last : 0.016); _last = now; _t += dt;
  carMesh.visible = show && !(glbReady && carG.length); carX.forEach((m) => { m.visible = show; }); busMesh.visible = show && !(glbReady && busG); carG.forEach((m) => { m.visible = show; }); if (busG) busG.visible = show; for (const k in pm) pm[k].visible = show;
  for (const b of boats) b.m.visible = show;
  plane.visible = show;
  if (SH) SH.mesh.visible = show;
  if (BEAM) { BEAM.visible = show && NIGHT_GLOW.value > 0.05; BEAM.material.opacity = NIGHT_GLOW.value * 0.5; }
  if (!show) return;

  // FIX (Oct 23): runtime guard — every 0.5s, rebuild nearby colliders list
  // (includes lazily-built area colliders from areas_world.js). Per-frame,
  // hide cars that are inside a collider (cars don't drive through houses).
  _colliderRebuildT += dt;
  if (_colliderRebuildT > 0.5) {
    _colliderRebuildT = 0;
    const r = 80; // only check colliders within 80m of player
    _nearbyColliders = _collidersRef.filter((c) =>
      c.minX < c.maxX && c.maxX > px - r && c.minX < px + r &&
      c.maxZ > pz - r && c.minZ < pz + r
    );
  }

  // cars + buses
  const dir = new THREE.Vector3(), nx = new THREE.Vector3();
  // TODO #5: snapshot every vehicle BEFORE anyone moves this frame, so the
  // gap check below sees a consistent picture (1-frame lag, cheap + stable)
  for (let i = 0; i < cars.length; i++) { lanePos(cars[i].ln, cars[i].s, _p); const s = _snapAll[i]; s.ln = cars[i].ln; s.x = _p.x; s.z = _p.z; }
  for (let i = 0; i < buses.length; i++) { lanePos(buses[i].ln, buses[i].s, _p); const s = _snapAll[cars.length + i]; s.ln = buses[i].ln; s.x = _p.x; s.z = _p.z; }
  const place = (mesh, i, c, gi) => {
    lanePos(c.ln, c.s, _p);
    let go = 1;
    if (_pv.on) { const fx = c.ln.axis === "x" ? c.ln.dir : 0, fz = c.ln.axis === "z" ? c.ln.dir : 0, ddx = _pv.x - _p.x, ddz = _pv.z - _p.z, along = ddx * fx + ddz * fz, lat = Math.abs(ddx * fz - ddz * fx); if (along > -1.5 && along < 9 && lat < 2.8) go = along < 5 ? 0 : (along - 5) / 4; }
    // TODO #5 (Oct 24): IDM-lite — keep a gap to the vehicle ahead in the SAME stretch
    for (let j = 0; j < _snapAll.length; j++) {
      if (j === gi) continue;
      const o = _snapAll[j];
      if (!o.ln || o.ln !== c.ln) continue;
      const d = (c.ln.axis === "x" ? o.x - _p.x : o.z - _p.z) * c.ln.dir - 5.2;
      if (d > -0.5 && d < 9) go = Math.min(go, d < 4.5 ? 0 : (d - 4.5) / 4.5);
    }
    // TODO #5 (Oct 24): give way before crossing the main street (avenues only)
    if (go > 0 && _crossProv && c.ln.axis === "z") {
      const dJ = (0 - _p.z) * c.ln.dir;
      if (dJ > 0 && dJ < 30) {
        const cross = _crossProv();
        for (let k = 0; k < cross.length; k++) {
          const o = cross[k];
          if (Math.abs(o.x - _p.x) > 14) continue;       // not at this avenue
          if (Math.abs(o.z) > 9) continue;               // not on the main street
          go = 0; break;
        }
      }
    }
    c.s += c.v * dt * go; lanePos(c.ln, c.s, _p); lanePos(c.ln, c.s + 1.5, nx);
    // FIX (Oct 23): runtime guard — if car position overlaps a nearby collider
    // (house/building/lamp/kiosk), hide it (scale to 0) so it doesn't show
    // inside the building. Cars are assigned to clear stretches at init time,
    // but lazily-built area colliders may not have existed then.
    let overlap = false;
    for (const col of _nearbyColliders) {
      if (_p.x + 1.5 > col.minX && _p.x - 1.5 < col.maxX && _p.z + 3.2 > col.minZ && _p.z - 3.2 < col.maxZ) { overlap = true; break; }
    }
    const lt = ((c.s % c.ln.len) + c.ln.len) % c.ln.len, ek = overlap ? 0 : Math.max(0, Math.min(1, Math.min(lt, c.ln.len - lt) / 3));
    _s2.setScalar(ek);
    const yaw = Math.atan2(-(nx.z - _p.z), nx.x - _p.x);
    _q.setFromAxisAngle(_up, yaw); _m.compose(_p, _q, _s2); if (mesh === carMesh && c.t > 0) { carMesh.setMatrixAt(i, _Z); for (let k = 0; k < 3; k++) carX[k].setMatrixAt(i, k === c.t - 1 ? _m : _Z); } else mesh.setMatrixAt(i, _m); if (glbReady) { if (mesh === carMesh) { if (carG.length) carG[0].setMatrixAt(i, _m); } else if (busG) busG.setMatrixAt(i, _m); } BEAM.setMatrixAt(mesh === carMesh ? i : cars.length + i, _m);
    SH.set(mesh === carMesh ? i : cars.length + i, _p.x, _p.z, (mesh === carMesh ? 2.6 : 3.4) * ek, (mesh === carMesh ? 5.4 : 12) * ek, yaw + Math.PI / 2);
    // publish position for traffic.js's junction give-way (main street side)
    if (gi < _lifePos.length) { _lifePos[gi].x = _p.x; _lifePos[gi].z = _p.z; }
  };
  cars.forEach((c, i) => place(carMesh, i, c, i)); buses.forEach((c, i) => place(busMesh, i, c, cars.length + i));
  carMesh.instanceMatrix.needsUpdate = true; carX.forEach((m) => { m.instanceMatrix.needsUpdate = true; }); busMesh.instanceMatrix.needsUpdate = true; carG.forEach((m) => { m.instanceMatrix.needsUpdate = true; }); if (busG) busG.instanceMatrix.needsUpdate = true;

  // real people for the nearest walkers
  const near = [];
  people.forEach((p, i) => {
    let x; if (p.chat) x = p.cx; else { const ph = (_t * p.sp + p.ph) / p.span, f = ph % 2, u = f < 1 ? f : 2 - f; x = p.ax - p.span + u * p.span * 2; }
    const dx = x - px, dz = p.az - pz, d2 = dx * dx + dz * dz;
    if (d2 < SHOW_R * SHOW_R) near.push([d2, i, x]);
  });
  near.sort((a, b) => a[0] - b[0]);
  const chosen = new Map(); for (let k = 0; k < Math.min(near.length, RIGS.length); k++) chosen.set(near[k][1], near[k][2]);
  for (const r of RIGS) if (r.who >= 0 && !chosen.has(r.who)) { r.ch.group.visible = false; r.who = -1; }
  for (const [i] of chosen) { if (RIGS.some((r) => r.who === i)) continue; const r = RIGS.find((q) => q.who < 0); if (r) r.who = i; }
  for (const r of RIGS) {
    if (r.who < 0) continue;
    const p = people[r.who], x = chosen.get(r.who), moving = !p.chat;
    r.ch.group.visible = show; if (!show) continue;
    const ph = (_t * p.sp + p.ph) / p.span, f = ph % 2;
    r.ch.group.position.set(x, 0, p.az);
    r.ch.group.rotation.y = p.chat ? p.face : (f < 1 ? Math.PI / 2 : -Math.PI / 2);
    r.ch.animate(dt, moving ? p.sp * 1.6 : 0);
  }
  const hasRig = new Set(RIGS.filter((r) => r.who >= 0).map((r) => r.who));

  // people (only the ones near the player are drawn)
  let nj = 0;                                    // crowd is packed into the first nj slots: far people cost nothing on the GPU
  people.forEach((p, i) => {
    let x, z = p.az, yaw, moving = true;
    if (p.chat) { x = p.cx; yaw = p.face; moving = false; }
    else { const ph = (_t * p.sp + p.ph) / p.span, f = ph % 2, u = f < 1 ? f : 2 - f; x = p.ax - p.span + u * p.span * 2; yaw = f < 1 ? Math.PI / 2 : -Math.PI / 2; }
    const dx = x - px, dz = z - pz;
    const si = cars.length + buses.length + i;
    if (hasRig.has(i) || dx * dx + dz * dz > CROWD_R * CROWD_R) { SH.hide(si); return; }
    const j = nj++;
    if (slotOwner[j] !== i) { slotOwner[j] = i; for (const h of PEOPLE_COLS) h.m.setColorAt(j, _col.set(h.c(p))); for (const k in pm) if (pm[k].instanceColor) pm[k].instanceColor.needsUpdate = true; }
    SH.set(si, x, z, 0.9 * p.sc, 0.9 * p.sc);
    const w = _t * p.sp * (p.sc < 0.7 ? 7 : 5.2) + p.ph, sw = moving ? Math.sin(w) * 0.62 : 0, bob = moving ? Math.abs(Math.sin(w)) * 0.035 * p.sc : 0;
    const g = moving ? 0 : Math.sin(_t * 1.7 + p.ph) * 0.3;                                   // chatting: little arm gestures + head-nod sway
    _p.set(x, bob, z); _q.setFromAxisAngle(_up, yaw + (moving ? 0 : Math.sin(_t * 0.8 + p.ph) * 0.12)); _s2.setScalar(p.sc); _mb.compose(_p, _q, _s2);
    const part = (mesh, px_, py_, ang) => { _m2.makeTranslation(px_, py_, 0); if (ang) _m2.multiply(_m3.makeRotationX(ang)); mesh.setMatrixAt(j, _m.multiplyMatrices(_mb, _m2)); };
    pm.torso.setMatrixAt(j, p.type === 0 ? _mb : _Z); pm.kaftan.setMatrixAt(j, p.type === 1 ? _mb : _Z); pm.gown.setMatrixAt(j, p.type === 2 ? _mb : _Z);
    pm.hair.setMatrixAt(j, p.type === 0 ? _mb : _Z); pm.cap.setMatrixAt(j, p.type === 1 ? _mb : _Z); pm.bare.setMatrixAt(j, p.type === 2 ? _mb : _Z);
    if (p.type === 0) { part(pm.legL, -0.11, 0.9, sw); part(pm.legR, 0.11, 0.9, -sw); } else { pm.legL.setMatrixAt(j, _Z); pm.legR.setMatrixAt(j, _Z); }
    part(pm.armL, -0.28, 1.5, moving ? -sw * 0.8 : -0.5 + g); part(pm.armR, 0.28, 1.5, moving ? sw * 0.8 : -0.9 - g);
  });
  for (const k in pm) pm[k].count = nj;
  for (const k in pm) pm[k].instanceMatrix.needsUpdate = true;
  SH.done(); BEAM.instanceMatrix.needsUpdate = true;

  // boats drift in slow ovals
  boats.forEach((b) => {
    const a = _t * b.sp + b.ph, x = LAKE.x + Math.cos(a) * b.rx, z = LAKE.z + Math.sin(a) * b.rz;
    b.m.position.set(x, 0.12, z); b.m.rotation.y = Math.atan2(-Math.cos(a) * b.rz, -Math.sin(a) * b.rx) + Math.PI / 2;
  });

  // plane: 160 s cycle  (wait -> take off -> away -> come back -> land -> park)
  const T = _t % 160, rx = AIRPORT.x + 60;
  let z = 230, y = 0, pitch = 0;
  if (T < 20) { z = 230; }
  else if (T < 45) { const k = (T - 20) / 25; z = 230 - k * k * 330; y = k > 0.85 ? (k - 0.85) * 60 : 0; pitch = k > 0.85 ? 0.2 : 0; }
  else if (T < 75) { const k = (T - 45) / 30; z = -100 - k * 700; y = 9 + k * 160; pitch = 0.22; }
  else if (T < 100) { z = -9999; y = -50; }
  else if (T < 125) { const k = (T - 100) / 25; z = -800 + k * 700; y = 140 * (1 - k) * (1 - k); pitch = -0.12 * (1 - k); }
  else if (T < 145) { const k = (T - 125) / 20; z = -100 + k * 330; }
  plane.position.set(rx, y, z); plane.rotation.set(-pitch, T >= 100 ? 0 : Math.PI, 0);   // leaves toward -z, comes back heading +z
  plane.visible = z > -3000;
}
