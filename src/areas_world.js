// src/areas_world.js — the districts: every district is now a small town, not an empty field.
//
// Per district (built when you get near, freed when you leave):
//   - a ground pad, the district road with pavements + centre line, a landmark (mosque / church / school / market)
//   - a house on EVERY plot: 3 different house shapes, each in its own colour, with a compound wall and a tree
//     - plots that belong to a player show that player's house (own colour from their id)
//     - about 35% of the other plots are vacant houses with a FOR RENT / FOR SALE board
//     - the rest are lived-in by NPC neighbours
//   - parked cars, little kiosks on the pavement, lamp posts
// Everything is instanced / merged (about 9 draw calls per district) and only the plots near you are filled in.
// Moving cars and walking people live in life.js.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { AREAS, getArea, getPlotPosition } from "./areas.js";
import { getAreaHouses } from "./plots.js";
import { WIDE_CROSS_Z, WIDE_AVENUES_X } from "./config.js";
import { stylize, NIGHT_GLOW } from "./art/style.js";
import { funKinds, funGeometry, FUN_INFO } from "./fun.js";
import { tierShapes, npcTier, wallRing, treeShape, carShape, kioskShape, landmark, landmarkKind, hash2, isVacantPlot, plotArchetype, paint, flatten } from "./town.js";

// ---- Tunables ----
const AREA_RENDER_RANGE = 250;   // metres — render area content within this of the player
const WALL_TREE_RANGE = 120;     // metres — compound walls + trees only this close (saves triangles)
const COLLIDE_HALF = 2.7;        // house collider half-size (metres)

// ---- State ----
let _scene = null;
let _worldColliders = null;
let _areasBuilt = new Map();
let _rentSignPool = [];
let _rentSignGroup = null;
const RENT_SIGN_RANGE = 45;
const RENT_SIGN_POOL_SIZE = 16;
let _shapes = null;
let _vcMat = null;

function _lampGeometry() {
  const post = new THREE.CylinderGeometry(0.07, 0.1, 5.5, 6); post.translate(0, 2.75, 0);
  const head = new THREE.BoxGeometry(0.45, 0.18, 0.3); head.translate(0, 5.5, 0);
  return mergeGeometries([paint(flatten(post), 0x4a4f55), paint(flatten(head), 0xfff0b0)], false);
}

// ---- district surface patterns: give every vertex an aPat code so roads, pavements, walls, roofs and windows get the textured look ----
function _patFor(r) {                                           // house parts are painted with a grey value; it tells us what they are
  if (r >= 0.99) return 3;                                      // walls -> plaster
  if (r >= 0.8) return 9;                                       // columns, steps, balconies -> concrete
  if (r >= 0.4 && r <= 0.62) return 4;                          // roofs -> zinc / tile
  if (r >= 0.24 && r <= 0.3) return 2;                          // doors -> wood
  if (r > 0.1 && r < 0.14) return 14;                           // windows -> glass that glows at night
  return 0;
}
function _patify(g, code) {
  const n = g.attributes.position.count, a = new Float32Array(n), c = g.attributes.color;
  for (let i = 0; i < n; i++) a[i] = code != null ? code : (c ? _patFor(c.getX(i)) : 0);
  g.setAttribute("aPat", new THREE.BufferAttribute(a, 1)); return g;
}
const _DGLOW = `
#ifdef ART_PAT
if (vPat > 13.5 && vPat < 14.5) {
  float on = step(0.38, fract(sin(dot(vColor.rgb, vec3(12.9898, 78.233, 37.719))) * 43758.5453));
  outgoingLight = mix(outgoingLight, vec3(1.0, 0.78, 0.4) * 1.05, on * uNightGlow * 0.9);
}
#endif
`;
function _districtMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  stylize(m, { pat: true, ao: true, fake: false });
  const prev = m.onBeforeCompile, key = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    prev(sh, r); sh.uniforms.uNightGlow = NIGHT_GLOW;
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uNightGlow;").replace("#include <opaque_fragment>", _DGLOW + "\n#include <opaque_fragment>");
  };
  m.customProgramCacheKey = () => key.call(m) + "|dglow";
  return m;
}
function _getShapes() {
  if (_shapes) return _shapes;
  _shapes = { houses: tierShapes(), wall: wallRing(), tree: treeShape(), car: carShape(), kiosk: kioskShape(), lamp: _lampGeometry(), lm: {} };
  for (const g of _shapes.houses) _patify(g); _patify(_shapes.wall, 5);
  _vcMat = _districtMaterial();
  return _shapes;
}

// ---- Init ----
export function initAreaWorld(scene, worldColliders) {
  _scene = scene;
  _worldColliders = worldColliders;
  // FEATURE: create the FOR RENT / FOR SALE sign pool (16 sprites, recycled LRU)
  _rentSignGroup = new THREE.Group();
  _rentSignGroup.name = "rent_signs";
  _scene.add(_rentSignGroup);
  for (let i = 0; i < RENT_SIGN_POOL_SIZE; i++) {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 96;
    const ctx = canvas.getContext("2d");
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    sprite.scale.set(4, 1.5, 1);
    sprite.userData = {};
    _rentSignGroup.add(sprite);
    _rentSignPool.push({ sprite, canvas, ctx, texture: tex, plotKey: null });
  }
}

// FEATURE: expose the rent sign pool for the tap-raycaster
export function getRentSigns() { return _rentSignPool; }

// ---- Tick: per-frame, manage per-area meshes + chunk positions ----
const _m4 = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _scl = new THREE.Vector3(1, 1, 1);
const _scl8 = new THREE.Vector3(0.85, 0.85, 0.85);
const _hide = new THREE.Matrix4().makeScale(0, 0, 0);
const _up = new THREE.Vector3(0, 1, 0);
const _col = new THREE.Color(), _hsl = {};

let _tkX = 1e9, _tkZ = 1e9, _tkT = 0;
export function tickAreaWorld(playerX, playerZ, range) {
  if (!_scene) return;
  const _now = performance.now(), _dx = playerX - _tkX, _dz = playerZ - _tkZ;
  if (_dx * _dx + _dz * _dz < 1 && _now - _tkT < 300) return;
  _tkX = playerX; _tkZ = playerZ; _tkT = _now;
  for (const area of AREAS) {
    const dx = area.x - playerX, dz = area.z - playerZ;
    const distToArea = Math.sqrt(dx * dx + dz * dz);
    const isNear = distToArea < (range || AREA_RENDER_RANGE) + 80;
    if (isNear) {
      if (!_areasBuilt.has(area.id)) _buildArea(area);
      _updateArea(area, playerX, playerZ, distToArea, range || AREA_RENDER_RANGE);
    } else {
      if (_areasBuilt.has(area.id)) _disposeArea(area.id);
    }
  }
  _updateRentSigns(playerX, playerZ);
}

// ---- FEATURE: Update FOR RENT / FOR SALE signs ----
// Collects empty plots within RENT_SIGN_RANGE across all nearby areas.
// Assigns the nearest N to the sprite pool (LRU recycled). Each sprite
// shows "FOR RENT ₦X/wk" or "FOR SALE ₦X" and is tappable.
function _updateRentSigns(playerX, playerZ) {
  if (!_rentSignPool.length) return;
  // Collect empty plots within range
  const candidates = [];
  for (const [areaId, entry] of _areasBuilt) {
    const area = getArea(areaId);
    if (!area) continue;
    const houses = getAreaHouses(areaId);
    // Iterate a sample of plots (every 3rd plot to avoid checking all 100+)
    for (let plotNo = 0; plotNo < area.plots; plotNo++) {
      // Skip if occupied, or lived-in by an NPC neighbour (only vacant houses carry a board)
      if (houses[plotNo]) continue;
      if (!isVacantPlot(areaId, plotNo)) continue;
      const pos = getPlotPosition(area, plotNo);
      const dx = pos.x - playerX, dz = pos.z - playerZ;
      const d2 = dx * dx + dz * dz;
      if (d2 > RENT_SIGN_RANGE * RENT_SIGN_RANGE) continue;
      candidates.push({ areaId, plotNo, area, pos, dist: Math.sqrt(d2) });
    }
  }
  // Sort by distance — nearest first
  candidates.sort((a, b) => a.dist - b.dist);
  // Assign to pool
  for (let i = 0; i < _rentSignPool.length; i++) {
    const slot = _rentSignPool[i];
    const c = candidates[i];
    if (!c) { slot.sprite.visible = false; slot.plotKey = null; continue; }
    const plotKey = c.areaId + "/" + c.plotNo;
    if (slot.plotKey !== plotKey) {
      // Redraw the sign canvas
      const isForSale = c.area.tier === "rich";  // rich areas show FOR SALE, others FOR RENT
      _drawRentSign(slot.canvas, slot.ctx, isForSale, c.area);
      slot.texture.needsUpdate = true;
      slot.plotKey = plotKey;
    }
    slot.sprite.position.set(c.pos.x, 4.8, c.pos.z);
    slot.sprite.visible = true;
    // Tag for tap-raycaster
    slot.sprite.userData = {
      isForRent: true,
      areaId: c.areaId,
      plotNo: c.plotNo,
      rentPrice: c.area.rentPrice,
      buyPrice: c.area.buyPrice,
      areaName: c.area.name,
    };
  }
}

function _drawRentSign(canvas, ctx, isForSale, area) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const bg = isForSale ? "#1a2a5a" : "#2a5a1a";
  const accent = isForSale ? "#60a5fa" : "#4ade80";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 5, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 28px Poppins, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(isForSale ? "FOR SALE" : "FOR RENT", 128, 30);
  ctx.font = "bold 20px Poppins, Arial, sans-serif";
  ctx.fillStyle = accent;
  const price = isForSale ? "₦" + area.buyPrice.toLocaleString() : "₦" + area.rentPrice.toLocaleString() + "/wk";
  ctx.fillText(price, 128, 68);
}

// ---- Static part of a district: ground pad, road, pavements, centre line, landmark ----
function _quad(L, w, d, x, y, z, color, code = 0) {
  const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.translate(x, y, z); L.push(_patify(paint(flatten(g), color), code));
}
// Where the landmark and the fun places of a district go (shared by the 3D build and the map labels).
const _layouts = new Map();
export function districtLayout(area) {
  if (_layouts.has(area.id)) return _layouts.get(area.id);
  let zmin = 1e9, zmax = -1e9;
  for (let p = 0; p < area.plots; p++) { const pos = getPlotPosition(area, p); zmin = Math.min(zmin, pos.z); zmax = Math.max(zmax, pos.z); }
  const clearZ = (z, d) => WIDE_CROSS_Z.every((c) => Math.abs(z - c) > d / 2 + 7) && Math.abs(z) > d / 2 + 66;
  const kind = landmarkKind(area), depth = kind === "school" ? 8 : kind === "market" ? 3 : kind === "church" ? 18 : 14;
  const spots = [zmin - 4.5 - depth / 2, zmax + 4.5 + depth / 2];
  if (hash2(area.id, "side") < 0.5) spots.reverse();
  let lz = null;
  for (const z of spots) if (clearZ(z, depth)) { lz = z; break; }
  // fun places. Best spots first: the four corners where the district road ends (right where you walk), then the
  // north / south edges beside the landmark.
  const mid = (zmin + zmax) / 2, fun = [], used = new Set(), slots = [];
  for (const [dx, side] of [[54, -1], [54, 1], [-56, -1], [-56, 1]]) slots.push({ corner: true, dx, side });
  for (const side of [1, -1]) {
    const lmHere = lz != null && Math.sign(lz - mid) === side;
    for (const dx of (lmHere ? [-36, 24, 40] : [-34, -8, 20, 42])) slots.push({ side, dx });
  }
  for (const fk of funKinds(area)) {
    const info = FUN_INFO[fk];
    for (let i = 0; i < slots.length; i++) {
      if (used.has(i)) continue;
      const sl = slots[i], x = area.x + sl.dx;
      const z = sl.corner ? area.z + sl.side * (6 + info.d / 2) : (sl.side < 0 ? zmin - 4.5 : zmax + 4.5) + sl.side * (info.d / 2 + 1);
      if (!sl.corner && !clearZ(z, info.d)) continue;
      if (!WIDE_AVENUES_X.every((ax) => Math.abs(x - ax) > info.w / 2 + 9)) continue;
      if (fun.some((o) => Math.abs(o.x - x) < (o.w + info.w) / 2 + 1 && Math.abs(o.z - z) < (o.d + info.d) / 2 + 1)) continue;
      used.add(i); fun.push({ kind: fk, x, z, rot: sl.side > 0 ? Math.PI : 0, name: info.name, icon: info.icon, w: info.w, d: info.d, solid: info.solid }); break;
    }
  }
  const out = { zmin, zmax, kind, depth, lz, fun };
  _layouts.set(area.id, out); return out;
}
export function districtFunLabels() {                              // for the live map
  const out = [];
  for (const a of AREAS) districtLayout(a).fun.forEach((f, i) => out.push({ id: "fun:" + a.id + ":" + i, name: f.icon + " " + f.name, x: f.x, z: f.z }));
  return out;
}
function _buildStatic(area) {
  const L = [], lay = districtLayout(area), { zmin, zmax, kind, depth, lz } = lay;
  const padCol = area.tier === "rich" ? 0x8fbf7a : area.tier === "middle" ? 0xa9bf86 : 0xbfae85;
  _quad(L, 92, zmax - zmin + 14, area.x - 4, 0.008, (zmin + zmax) / 2, padCol, 12);
  const roadW = 124;
  _quad(L, roadW, 6, area.x, 0.015, area.z, 0x5c6068, 13);
  _quad(L, roadW, 1.5, area.x, 0.012, area.z + 3.75, 0xd2bf9c, 9);
  _quad(L, roadW, 1.5, area.x, 0.012, area.z - 3.75, 0xd2bf9c, 9);
  for (let x = -roadW / 2 + 4; x < roadW / 2 - 3; x += 8) _quad(L, 3.5, 0.16, area.x + x, 0.02, area.z, 0xe9d36a);
  const boxes = [];
  if (lz != null) {
    const g = landmark(kind); g.translate(area.x - 6, 0.02, lz); L.push(_patify(g, 0));
    if (kind !== "market") boxes.push({ minX: area.x - 6 - 6, maxX: area.x - 6 + 6, minZ: lz - depth / 2, maxZ: lz + depth / 2 });
  }
  for (const f of lay.fun) {                                       // fun places
    const g = funGeometry(f.kind).clone(); g.rotateY(f.rot); g.translate(f.x, 0.02, f.z); L.push(_patify(g, 0));
    if (f.solid) boxes.push({ minX: f.x - f.w / 2 + 1, maxX: f.x + f.w / 2 - 1, minZ: f.z - f.d / 2 + 1, maxZ: f.z + f.d / 2 - 1 });
  }
  const geo = mergeGeometries(L, false);
  return { geo, boxes };
}

function _buildArea(area) {
  const S = _getShapes();
  const capacity = area.plots;
  const mk = (geo, cap, tint) => {
    const m = new THREE.InstancedMesh(geo, _vcMat, cap);
    m.frustumCulled = false; m.count = 0;
    for (let i = 0; i < cap; i++) { m.setMatrixAt(i, _hide); if (tint) m.setColorAt(i, _col.set(0xffffff)); }
    m.instanceMatrix.needsUpdate = true; if (tint && m.instanceColor) m.instanceColor.needsUpdate = true;
    _scene.add(m); return m;
  };
  const houses = S.houses.map((g) => mk(g, capacity, true));
  const wallMesh = mk(S.wall, capacity, true);
  const treeMesh = mk(S.tree, capacity, true);

  // parked cars along the pavements + kiosks
  const CAR_N = 12, KIOSK_N = 8;
  const carMesh = mk(S.car, CAR_N, true);
  for (let i = 0; i < CAR_N; i++) {
    const side = i % 2 ? 1 : -1;
    const x = area.x - 50 + (i >> 1) * 19 + (hash2(area.id, "cx" + i) * 6 - 3), z = area.z + side * 2.0;
    _q.setFromAxisAngle(_up, side > 0 ? 0 : Math.PI); _v.set(x, 0, z); _m4.compose(_v, _q, _scl);
    carMesh.setMatrixAt(i, _m4);
    _col.setHSL(hash2(area.id, "cc" + i), 0.55, 0.5); carMesh.setColorAt(i, _col);
  }
  carMesh.count = CAR_N; carMesh.instanceMatrix.needsUpdate = true; carMesh.instanceColor.needsUpdate = true;
  // solid parked cars: you can no longer walk through them
  const parkColliders = [];
  for (let i = 0; i < CAR_N; i++) {
    const side = i % 2 ? 1 : -1;
    const x = area.x - 50 + (i >> 1) * 19 + (hash2(area.id, "cx" + i) * 6 - 3), z = area.z + side * 2.0;
    const c = { minX: x - 2.7, maxX: x + 2.7, minZ: z - 1.4, maxZ: z + 1.4, _areaId: area.id };
    parkColliders.push(c); if (_worldColliders) _worldColliders.push(c);
  }
  // real jeep model instead of the box (light model, ~11k triangles); the box stays as a fallback until it loads
  const carGlbRef = { mesh: null };
  if (false) import("./life.js").then(async (L) => {   // disabled: box cars look better than the untextured jeep
    try {
      const im = await L.glbInstanced("jeep", CAR_N); if (!im) return;
      for (let i = 0; i < CAR_N; i++) { carMesh.getMatrixAt(i, _m4); im.setMatrixAt(i, _m4); carMesh.getColorAt(i, _col); im.setColorAt(i, _col.clone().offsetHSL(0, 0, 0.15)); }
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      if (!_areasBuilt.has(area.id)) { im.dispose(); return; }
      carMesh.visible = false; carMesh.userData.swapped = true; _scene.add(im); carGlbRef.mesh = im;
      const e = _areasBuilt.get(area.id); if (e) e.carGlb = im;
    } catch (e) { console.warn("parked car glb failed", e); }
  });
  const kioskMesh = mk(S.kiosk, KIOSK_N, true);
  for (let i = 0; i < KIOSK_N; i++) {
    const side = i % 2 ? 1 : -1;
    const x = area.x - 44 + (i >> 1) * 24 + (hash2(area.id, "kx" + i) * 8 - 4), z = area.z + side * 4.1;
    _q.setFromAxisAngle(_up, side > 0 ? Math.PI : 0); _v.set(x, 0, z); _scl.set(0.75, 0.75, 0.75); _m4.compose(_v, _q, _scl); _scl.set(1, 1, 1);
    kioskMesh.setMatrixAt(i, _m4);
    _col.setHSL(hash2(area.id, "kc" + i), 0.7, 0.55); kioskMesh.setColorAt(i, _col);
  }
  kioskMesh.count = KIOSK_N; kioskMesh.instanceMatrix.needsUpdate = true; kioskMesh.instanceColor.needsUpdate = true;
  for (let i = 0; i < KIOSK_N; i++) {   // kiosks are solid too
    const side = i % 2 ? 1 : -1;
    const x = area.x - 44 + (i >> 1) * 24 + (hash2(area.id, "kx" + i) * 8 - 4), z = area.z + side * 4.1;
    const c = { minX: x - 1.2, maxX: x + 1.2, minZ: z - 1.0, maxZ: z + 1.0, _areaId: area.id };
    if (_worldColliders) _worldColliders.push(c);
  }

  // lamps (1 per 4 plots, max 30)
  const lampCount = Math.min(30, Math.ceil(area.plots / 4));
  const lampMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xffd070, emissiveIntensity: 0.6 });
  const lampMesh = new THREE.InstancedMesh(S.lamp, lampMat, lampCount);
  lampMesh.frustumCulled = false; lampMesh.count = 0;
  for (let i = 0; i < lampCount; i++) lampMesh.setMatrixAt(i, _hide);
  _scene.add(lampMesh);

  // static ground / road / landmark
  const st = _buildStatic(area);
  const staticMesh = new THREE.Mesh(st.geo, _vcMat);
  staticMesh.matrixAutoUpdate = false; staticMesh.receiveShadow = true; _scene.add(staticMesh);

  // colliders: one per plot (mutated in place) + the landmark
  const houseColliders = [];
  for (let i = 0; i < capacity; i++) {
    const c = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, _areaId: area.id };
    houseColliders.push(c); if (_worldColliders) _worldColliders.push(c);
  }
  let lmCollider = null;
  for (const bx of st.boxes) { const c = { ...bx, _areaId: area.id }; lmCollider = c; if (_worldColliders) _worldColliders.push(c); }

  _areasBuilt.set(area.id, { houses, wallMesh, treeMesh, carMesh, kioskMesh, lampMesh, lampMat, staticMesh, capacity, lampCount, houseColliders, lmCollider });
}

function _wallColor(area, plotNo, rec) {
  if (rec && rec.ownerUid) {                                   // a real player's house: its own bright colour
    const h = hash2(rec.ownerUid, "h"), s = 0.38 + hash2(rec.ownerUid, "s") * 0.3;
    return _col.setHSL(h, s, 0.7);
  }
  if (isVacantPlot(area.id, plotNo)) return _col.setHSL(0.1, 0.07, 0.62 + hash2(area.id, plotNo + "l") * 0.1);
  _col.set(area.wallCol); _col.getHSL(_hsl);
  return _col.setHSL((_hsl.h + (hash2(area.id, plotNo + "h") - 0.5) * 0.12 + 1) % 1, Math.min(1, _hsl.s * (0.8 + hash2(area.id, plotNo + "s") * 0.5)), Math.max(0.3, Math.min(0.88, _hsl.l + (hash2(area.id, plotNo + "l") - 0.5) * 0.22)));
}

// ---- Update an area's chunk positions (called per-frame while the area is nearby) ----
function _updateArea(area, playerX, playerZ, distToArea, range) {
  const entry = _areasBuilt.get(area.id);
  if (!entry) return;
  const { houses, wallMesh, treeMesh, carMesh, kioskMesh, lampMesh, staticMesh, capacity, lampCount, houseColliders } = entry;
  const vis = distToArea <= range + 80;
  for (const m of [...houses, wallMesh, treeMesh, carMesh, kioskMesh, lampMesh, staticMesh]) m.visible = vis;
  if (carMesh.userData.swapped) carMesh.visible = false;
  if (entry.carGlb) entry.carGlb.visible = vis;
  if (!vis) return;

  const occupied = getAreaHouses(area.id);
  const counts = [0, 0, 0, 0, 0, 0]; let wn = 0, tn = 0, ci = 0;
  const r2 = (range - 30) * (range - 30), n2 = WALL_TREE_RANGE * WALL_TREE_RANGE;
  for (let plotNo = 0; plotNo < capacity; plotNo++) {
    const pos = getPlotPosition(area, plotNo);
    const dx = pos.x - playerX, dz = pos.z - playerZ, d2 = dx * dx + dz * dz;
    if (d2 > r2) continue;
    const rec = occupied[plotNo];
    const tier = (rec && rec.tier >= 1 && rec.tier <= 6) ? Math.round(rec.tier) : npcTier(area, plotNo), a = tier - 1;
    _v.set(pos.x, 0, pos.z); _q.setFromAxisAngle(_up, pos.rot || 0); _m4.compose(_v, _q, _scl);
    const slot = counts[a]++;
    houses[a].setMatrixAt(slot, _m4);
    const wc = _wallColor(area, plotNo, rec);
    houses[a].setColorAt(slot, wc);
    if (ci < houseColliders.length) {
      const c = houseColliders[ci++];
      const ch = tier >= 5 ? 3.3 : COLLIDE_HALF; c.minX = pos.x - ch; c.maxX = pos.x + ch; c.minZ = pos.z - ch; c.maxZ = pos.z + ch;
    }
    if (d2 < n2) {
      wallMesh.setMatrixAt(wn, _m4); wallMesh.setColorAt(wn, _col.copy(wc).offsetHSL(0, -0.1, 0.12)); wn++;
      if (hash2(area.id, plotNo + "t") < 0.8) {
        _v.set(pos.x, 0, pos.z); _q.setFromAxisAngle(_up, (pos.rot || 0)); _m4.compose(_v.add(_tmp.set(2.9, 0, -2.9).applyQuaternion(_q)), _q, _scl8);
        treeMesh.setMatrixAt(tn, _m4); treeMesh.setColorAt(tn, _col.setHSL(0.3 + hash2(area.id, plotNo + "g") * 0.06, 0.45, 0.62 + hash2(area.id, plotNo + "gl") * 0.3)); tn++;
      }
    }
  }
  for (let i = ci; i < houseColliders.length; i++) { const c = houseColliders[i]; c.minX = Infinity; c.maxX = -Infinity; c.minZ = Infinity; c.maxZ = -Infinity; }
  for (let a = 0; a < 6; a++) { houses[a].count = counts[a]; houses[a].instanceMatrix.needsUpdate = true; if (houses[a].instanceColor) houses[a].instanceColor.needsUpdate = true; }
  wallMesh.count = wn; wallMesh.instanceMatrix.needsUpdate = true; if (wallMesh.instanceColor) wallMesh.instanceColor.needsUpdate = true;
  treeMesh.count = tn; treeMesh.instanceMatrix.needsUpdate = true; if (treeMesh.instanceColor) treeMesh.instanceColor.needsUpdate = true;

  // lamps
  let lampIdx = 0;
  for (let plotNo = 0; plotNo < area.plots; plotNo += 4) {
    if (lampIdx >= lampCount) break;
    const pos = getPlotPosition(area, plotNo);
    const dx = pos.x - playerX, dz = pos.z - playerZ;
    if (dx * dx + dz * dz > r2) continue;
    _v.set(pos.x + 4.2, 0, pos.z + 4.2); _q.identity(); _m4.compose(_v, _q, _scl);
    lampMesh.setMatrixAt(lampIdx++, _m4);
  }
  lampMesh.count = lampIdx; lampMesh.instanceMatrix.needsUpdate = true;
}
const _tmp = new THREE.Vector3();

// ---- Dispose an area's meshes (shared geometry + material stay) ----
function _disposeArea(areaId) {
  const e = _areasBuilt.get(areaId);
  if (!e) return;
  for (const m of [...e.houses, e.wallMesh, e.treeMesh, e.carMesh, e.kioskMesh, e.lampMesh]) { _scene.remove(m); m.dispose(); }
  if (e.carGlb) { _scene.remove(e.carGlb); e.carGlb.dispose(); }
  e.lampMat.dispose();
  _scene.remove(e.staticMesh); e.staticMesh.geometry.dispose();
  if (_worldColliders) for (let i = _worldColliders.length - 1; i >= 0; i--) if (_worldColliders[i]._areaId === areaId) _worldColliders.splice(i, 1);
  _areasBuilt.delete(areaId);
}

export function setAreaLampsNight(night) {
  for (const e of _areasBuilt.values()) e.lampMat.emissiveIntensity = night ? 0.6 : 0.0;
}
export function disposeAreaWorld() {
  for (const id of Array.from(_areasBuilt.keys())) _disposeArea(id);
}
