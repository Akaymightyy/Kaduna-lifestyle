// src/areas_world.js — Chunk-streamed area infrastructure: roads + simple
// NPC houses + lamp posts inside each area.
//
// The problem this solves
// -----------------------
// Feature 3a expanded the walkable bounds, but the areas themselves were
// still just empty grass with a grid of plot-boundary markers (the chunk-
// streamed grid from step 3a's plots.js, which the other assistant reverted).
// Walking to an area felt empty — no roads, no houses, no lights at night.
//
// This module adds the area infrastructure that should have been there:
//   1. A road running through the area center (one PlaneGeometry per area,
//      only visible within ~250m of the player).
//   2. Simple NPC house exteriors at every plot position — a merged body +
//      roof + door geometry, rendered as ONE InstancedMesh per area with
//      per-instance color from the area's wallCol / roofCol. Houses at
//      unoccupied plots are smaller and tinted grey (abandoned look) —
//      occupied plots get full-color houses with a door.
//   3. Lamp posts along the area road (one InstancedMesh per area, capacity
//      based on area plot count). Emissive heads glow at night.
//
// Performance
// -----------
//   - ONE InstancedMesh per area for houses (body+roof+door merged into one
//     geometry). N plots = 1 draw call.
//   - ONE InstancedMesh per area for lamp posts (post + head merged).
//     N/4 lamps = 1 draw call.
//   - ONE PlaneGeometry per area for the road (a flat plane, very cheap).
//   - Worst case: ~5 nearby areas × 3 draw calls = 15 draw calls. Well
//     under the 150-draw-call target.
//   - Chunk streaming: only plots within ~220m of the player get real
//     instance matrices. Far plots stay at scale 0 (no GPU cost).
//   - Meshes are allocated once when an area first becomes nearby,
//     disposed when the area unsubscribes (no GPU leak).

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { AREAS, getArea, getPlotPosition } from "./areas.js";
// FEATURE 3b: get the cached houses data from plots.js so we only render
// house exteriors at OCCUPIED plots. Without this, every plot gets a house
// (up to 100 per area × 5 nearby areas = 500 houses visible at once,
// choking the screen + tanking perf).
import { getAreaHouses } from "./plots.js";

// ---- Tunables ----
const AREA_RENDER_RANGE = 250;   // metres — render area content within this of the player
const PLOT_CHUNK_RANGE = 220;    // metres — only place house instances for plots within this of the player
const HOUSE_BODY_W = 5.0, HOUSE_BODY_D = 5.0, HOUSE_BODY_H = 3.0;
const ROOF_H = 1.5;
const DOOR_W = 1.0, DOOR_H = 2.0;

// ---- State ----
let _scene = null;
let _worldColliders = null;   // FEATURE: ref to world.colliders so we can push house footprints
let _areasBuilt = new Map();  // areaId -> { houseMesh, lampMesh, roadMesh, capacity }
// FEATURE: FOR RENT / FOR SALE sign pool — shows at empty plots within range.
let _rentSignPool = [];
let _rentSignGroup = null;
const RENT_SIGN_RANGE = 45;
const RENT_SIGN_POOL_SIZE = 16;

// ---- Build the merged house geometry (body + roof + door), used for every instance ----
// The geometry is the SAME for every house — only the per-instance color varies
// (set via setColorAt on the InstancedMesh).
function _buildHouseGeometry() {
  // Body: a box
  const bodyGeo = new THREE.BoxGeometry(HOUSE_BODY_W, HOUSE_BODY_H, HOUSE_BODY_D);
  bodyGeo.translate(0, HOUSE_BODY_H / 2, 0);
  // Roof: a 4-sided pyramid (ConeGeometry with 4 sides)
  const roofGeo = new THREE.ConeGeometry(HOUSE_BODY_W * 0.85, ROOF_H, 4);
  roofGeo.rotateY(Math.PI / 4);
  roofGeo.translate(0, HOUSE_BODY_H + ROOF_H / 2, 0);
  // Door: a thin box on the front (+Z) face
  const doorGeo = new THREE.BoxGeometry(DOOR_W, DOOR_H, 0.1);
  doorGeo.translate(0, DOOR_H / 2, HOUSE_BODY_D / 2 + 0.05);
  // Merge — set vertex colors so per-instance color works
  return mergeGeometries([_withColor(bodyGeo, 0xffffff), _withColor(roofGeo, 0xffffff), _withColor(doorGeo, 0xffffff)], true);
}

// Add a "color" attribute (all 1s — the actual color is set per-instance via instanceColor).
function _withColor(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geo;
}

// ---- Build the merged lamp-post geometry (post + head) ----
function _buildLampGeometry() {
  const postGeo = new THREE.CylinderGeometry(0.07, 0.1, 5.5, 6);
  postGeo.translate(0, 2.75, 0);
  const headGeo = new THREE.BoxGeometry(0.45, 0.18, 0.3);
  headGeo.translate(0, 5.5, 0);
  return mergeGeometries([_withColor(postGeo, 0x4a4f55), _withColor(headGeo, 0xfff0b0)], true);
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
const _hide = new THREE.Matrix4().makeScale(0, 0, 0);
const _up = new THREE.Vector3(0, 1, 0);

let _tkX = 1e9, _tkZ = 1e9, _tkT = 0;
export function tickAreaWorld(playerX, playerZ, range) {
  if (!_scene) return;
  // Houses/lamps only need refreshing when the player moved ~1 m or every 300 ms (was every single frame)
  const _now = performance.now(), _dx = playerX - _tkX, _dz = playerZ - _tkZ;
  if (_dx * _dx + _dz * _dz < 1 && _now - _tkT < 300) return;
  _tkX = playerX; _tkZ = playerZ; _tkT = _now;
  // Iterate every area — if it's nearby, ensure its meshes exist and update
  // chunk positions. If it's far, dispose its meshes (frees GPU memory).
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
  // FEATURE: update FOR RENT / FOR SALE signs at empty plots near the player
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
    for (let plotNo = 0; plotNo < area.plots; plotNo += 3) {
      // Skip if occupied
      if (houses[plotNo]) continue;
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
    slot.sprite.position.set(c.pos.x, 3.5, c.pos.z);
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

// ---- Build all the meshes for one area (called once when the area first becomes nearby) ----
function _buildArea(area) {
  // Capacity: enough instances for all plots in the area
  const capacity = area.plots;
  // ---- House InstancedMesh ----
  const houseGeo = _buildHouseGeometry();
  const houseMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const houseMesh = new THREE.InstancedMesh(houseGeo, houseMat, capacity);
  houseMesh.frustumCulled = false;
  houseMesh.count = 0;
  for (let i = 0; i < capacity; i++) houseMesh.setMatrixAt(i, _hide);
  houseMesh.instanceMatrix.needsUpdate = true;
  _scene.add(houseMesh);

  // ---- Lamp InstancedMesh (1 lamp per 4 plots, max 30 lamps per area) ----
  const lampCount = Math.min(30, Math.ceil(area.plots / 4));
  const lampGeo = _buildLampGeometry();
  const lampMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xffd070, emissiveIntensity: 0.6 });
  const lampMesh = new THREE.InstancedMesh(lampGeo, lampMat, lampCount);
  lampMesh.frustumCulled = false;
  lampMesh.count = 0;
  for (let i = 0; i < lampCount; i++) lampMesh.setMatrixAt(i, _hide);
  lampMesh.instanceMatrix.needsUpdate = true;
  _scene.add(lampMesh);

  // ---- Road plane (one PlaneGeometry per area, runs along X through area center) ----
  const roadW = Math.min(120, area.plots * 0.8);  // length of the area road in metres
  const roadGeo = new THREE.PlaneGeometry(roadW, 6);
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3d43 });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.rotation.x = -Math.PI / 2;
  roadMesh.position.set(area.x, 0.015, area.z);
  roadMesh.receiveShadow = true;
  _scene.add(roadMesh);

  // ---- Sidewalk planes (two thin strips either side of the road) ----
  const swMat = new THREE.MeshLambertMaterial({ color: 0xd2bf9c });
  const swGeo = new THREE.PlaneGeometry(roadW, 1.5);
  const swL = new THREE.Mesh(swGeo, swMat);
  swL.rotation.x = -Math.PI / 2;
  swL.position.set(area.x, 0.012, area.z + 3.75);
  swL.receiveShadow = true;
  _scene.add(swL);
  const swR = new THREE.Mesh(swGeo, swMat);
  swR.rotation.x = -Math.PI / 2;
  swR.position.set(area.x, 0.012, area.z - 3.75);
  swR.receiveShadow = true;
  _scene.add(swR);

  // FEATURE: pre-allocate a per-area collider pool. Each occupied-plot house
  // gets a collider object. We mutate these in place each frame (avoiding GC
  // pressure from push/splice on world.colliders). When a house disappears,
  // we set the collider to a degenerate box (minX=Infinity, maxX=-Infinity)
  // so it never triggers a collision.
  const maxHouses = Math.min(64, capacity);  // cap at 64 houses per area
  const houseColliders = [];
  for (let i = 0; i < maxHouses; i++) {
    const c = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, _areaId: area.id };
    houseColliders.push(c);
    if (_worldColliders) _worldColliders.push(c);  // push to world.colliders ONCE
  }

  _areasBuilt.set(area.id, {
    houseMesh, lampMesh, roadMesh, swL, swR, capacity, lampCount, roadW,
    houseColliders,  // FEATURE: per-area collider pool, mutated in place each frame
    // PERF FIX: track which house instance slots have been colored + the
    // last reported colored count. Used to skip setColorAt + instanceColor
    // upload when nothing changed frame-to-frame.
    coloredSlots: 0,
    lastColoredSlots: 0,
  });
  console.log("[areas_world] Built area " + area.id + " (" + area.plots + " plots, " + maxHouses + " collider slots)");
}

// ---- Update an area's chunk positions (called per-frame while the area is nearby) ----
function _updateArea(area, playerX, playerZ, distToArea, range) {
  const entry = _areasBuilt.get(area.id);
  if (!entry) return;
  const { houseMesh, lampMesh, capacity, lampCount } = entry;

  // Hide the whole area's meshes if the player is too far
  if (distToArea > range + 80) {
    houseMesh.visible = false;
    lampMesh.visible = false;
    entry.roadMesh.visible = false;
    entry.swL.visible = false;
    entry.swR.visible = false;
    return;
  }
  houseMesh.visible = true;
  lampMesh.visible = true;
  entry.roadMesh.visible = true;
  entry.swL.visible = true;
  entry.swR.visible = true;

  // ---- Place house instances for OCCUPIED plots within chunk range of the player ----
  // PERF FIX: previously placed a house at EVERY plot (up to 100 per area),
  // which choked the screen with houses and tanked perf. Now we only place
  // houses at occupied plots (player-owned). Empty plots are just bare grass.
  // The "FOR RENT / FOR SALE boards on empty plots" is Feature 2 (separate step).
  const houses = getAreaHouses(area.id);
  let idx = 0;
  const wallCol = new THREE.Color(area.wallCol);
  const houseColliders = entry.houseColliders || [];
  const houseHW = HOUSE_BODY_W / 2;  // 2.5m
  const houseHD = HOUSE_BODY_D / 2;  // 2.5m
  for (const [plotNoStr, houseRec] of Object.entries(houses)) {
    if (idx >= capacity) break;
    if (!houseRec || !houseRec.ownerUid) continue; // not actually occupied
    const plotNo = parseInt(plotNoStr, 10);
    const pos = getPlotPosition(area, plotNo);
    const dx = pos.x - playerX, dz = pos.z - playerZ;
    if (dx * dx + dz * dz > (range - 30) * (range - 30)) continue;
    _v.set(pos.x, 0, pos.z);
    _q.setFromAxisAngle(_up, pos.rot || 0);
    _m4.compose(_v, _q, _scl);
    houseMesh.setMatrixAt(idx, _m4);
    // PERF FIX: only set the instance color ONCE per slot. We track which
    // slots have been colored via entry.coloredSlots. If this slot was
    // already colored (we're re-using it from a previous frame's plot),
    // skip the setColorAt call. This avoids forcing instanceColor upload
    // to GPU every frame.
    if (entry.coloredSlots < idx + 1) {
      houseMesh.setColorAt(idx, wallCol);
      entry.coloredSlots = idx + 1;
    }
    // FEATURE: also update the corresponding house collider to match this
    // house's footprint. The collider was pre-allocated in _buildArea and
    // pushed to world.colliders ONCE. We mutate it in place (no GC pressure)
    // to match the house's current position.
    if (idx < houseColliders.length) {
      const c = houseColliders[idx];
      c.minX = pos.x - houseHW;
      c.maxX = pos.x + houseHW;
      c.minZ = pos.z - houseHD;
      c.maxZ = pos.z + houseHD;
    }
    idx++;
  }
  // FEATURE: deactivate leftover colliders for slots that no longer have a
  // house (e.g. a player moved out, or a previously-visible house is now
  // out of chunk range). Set them to a degenerate box that never triggers.
  for (let i = idx; i < houseColliders.length; i++) {
    const c = houseColliders[i];
    c.minX = Infinity; c.maxX = -Infinity;
    c.minZ = Infinity; c.maxZ = -Infinity;
  }
  // Hide leftover instances from the previous frame (if any)
  for (let i = idx; i < houseMesh.count; i++) houseMesh.setMatrixAt(i, _hide);
  houseMesh.count = Math.min(idx, capacity);
  houseMesh.instanceMatrix.needsUpdate = true;
  // PERF FIX: only mark instanceColor dirty if we actually wrote a NEW color
  // this frame. (When the slot count didn't grow, the GPU color buffer is
  // unchanged — no need to re-upload it.)
  if (entry.coloredSlots > entry.lastColoredSlots) {
    if (houseMesh.instanceColor) houseMesh.instanceColor.needsUpdate = true;
    entry.lastColoredSlots = entry.coloredSlots;
  }
  // PERF FIX: if the houses data shrunk (player left and someone moved out),
  // reset the colored tracker so the next grow re-colors fresh slots.
  if (idx < entry.lastColoredSlots) {
    entry.coloredSlots = idx;
    entry.lastColoredSlots = idx;
  }

  // ---- Lamp posts: one per 4 plots, placed at the corner of the plot grid ----
  let lampIdx = 0;
  const lampSpacing = 4;  // 1 lamp per 4 plots
  for (let plotNo = 0; plotNo < area.plots; plotNo += lampSpacing) {
    if (lampIdx >= lampCount) break;
    const pos = getPlotPosition(area, plotNo);
    const dx = pos.x - playerX, dz = pos.z - playerZ;
    if (dx * dx + dz * dz > (range - 30) * (range - 30)) continue;
    // Offset lamp to the corner of the plot (so it doesn't clip into the house)
    _v.set(pos.x + 3.5, 0, pos.z + 3.5);
    _q.identity();
    _m4.compose(_v, _q, _scl);
    lampMesh.setMatrixAt(lampIdx, _m4);
    lampIdx++;
  }
  for (let i = lampIdx; i < lampMesh.count; i++) lampMesh.setMatrixAt(i, _hide);
  lampMesh.count = Math.min(lampIdx, lampCount);
  lampMesh.instanceMatrix.needsUpdate = true;
}

// ---- Dispose an area's meshes (called when the player walks away) ----
function _disposeArea(areaId) {
  const entry = _areasBuilt.get(areaId);
  if (!entry) return;
  const { houseMesh, lampMesh, roadMesh, swL, swR, houseColliders } = entry;
  _scene.remove(houseMesh); houseMesh.geometry?.dispose(); houseMesh.material?.dispose();
  _scene.remove(lampMesh); lampMesh.geometry?.dispose(); lampMesh.material?.dispose();
  _scene.remove(roadMesh); roadMesh.geometry?.dispose(); roadMesh.material?.dispose();
  _scene.remove(swL); swL.geometry?.dispose(); swL.material?.dispose();
  _scene.remove(swR); swR.geometry?.dispose(); swR.material?.dispose();
  // FEATURE: remove this area's house colliders from world.colliders.
  // Filter by _areaId tag so we don't accidentally splice another area's colliders.
  if (_worldColliders && houseColliders) {
    for (let i = _worldColliders.length - 1; i >= 0; i--) {
      if (_worldColliders[i]._areaId === areaId) _worldColliders.splice(i, 1);
    }
  }
  _areasBuilt.delete(areaId);
  console.log("[areas_world] Disposed area " + areaId);
}

// ---- Set night mode on area lamps (called from main.js when time-of-day changes) ----
export function setAreaLampsNight(night) {
  for (const entry of _areasBuilt.values()) {
    entry.lampMesh.material.emissiveIntensity = night ? 0.6 : 0.0;
  }
}

// ---- Cleanup all areas (called on logout) ----
export function disposeAreaWorld() {
  for (const areaId of Array.from(_areasBuilt.keys())) _disposeArea(areaId);
}
