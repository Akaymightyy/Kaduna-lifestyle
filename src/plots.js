// src/plots.js — Per-plot world doors with owner-name signs.
//
// Renders a cheap "door gate" marker (two posts + a top beam + a sign board)
// at every OCCUPIED plot position within ~250m of the player. The sign shows
// the owner's name. Walking close to a plot door triggers the knock/enter
// prompt handled by main.js.
//
// PERF:
//   - All door gates share ONE InstancedMesh (one geometry, one material).
//     n plots = 1 draw call. n plots = 0 individual mesh allocations.
//   - Owner-name labels use a small POOL of sprites (default 12). When the
//     player walks past a new plot, the oldest label is recycled. Sprites
//     outside ~60m of the player are hidden entirely.
//   - Subscriptions are per-area, only for areas within ~300m of the player.
//     We never listen to the whole `houses` node.
//
// KNOCK FLOW (uses houses.js helpers from step 2a):
//   1. Player walks near a friend's plot door.
//   2. tickPlotDoors detects a plot within KNOCK_RANGE metres.
//   3. main.js shows "🏠 @ownerName's Home — Press here to knock" prompt.
//   4. Player taps → knockOnDoor(ownerUid, visitorUid, ...) writes a knock.
//   5. Visitor listens for the reply via listenForKnockReply.
//   6. Owner (online) gets a real-time prompt: Accept / Deny.
//   7. Owner taps Accept → knock status becomes "accepted".
//   8. Visitor's listener fires → enterPlaceAsVisitor(houseInfo, ...).

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { db } from "./firebase.js";
import { ref, onValue } from "firebase/database";
import { AREAS, getArea, getPlotPosition } from "./areas.js";
import {
  knockOnDoor,
  listenForKnockReply,
  loadHouse,
} from "./houses.js";

// ---- Tunables ----
const RENDER_RANGE = 250;     // metres — only render plots within this of the player
const LABEL_RANGE = 60;       // metres — only show owner-name labels within this
const LABEL_POOL_SIZE = 12;   // max simultaneous label sprites (recycled LRU)
const KNOCK_RANGE = 6;         // metres — within this, show knock/enter prompt

// FEATURE 3: chunk-streamed plot grids. Each nearby area renders a grid of
// small plot-boundary markers (cheap InstancedMesh of cubes). Only plots within
// AREA_GRID_RANGE of the player get markers. The whole grid is hidden when the
// player is too far away. ONE InstancedMesh per area, allocated once when the
// area first becomes nearby, disposed when the area unsubscribes.
const AREA_GRID_RANGE = 180;  // metres — show plot grid markers within this of area center
const AREA_NAME_RANGE = 120; // metres — show area name sign within this of area center (was 320 — too far, every area in the city was visible)

// ---- State ----
let _scene = null;
let _doorMesh = null;          // InstancedMesh of the door-gate geometry
let _labelGroup = null;        // THREE.Group holding the label sprites
let _labelPool = [];           // array of { sprite, canvas, ctx, texture, plotId }
let _subscriptions = new Map(); // areaId -> unsubscribe fn
let _nearbyAreas = new Set();  // areaIds currently subscribed
let _houses = {};              // areaId -> { plotNo: houseRecord }
let _player = { x: 0, z: 0 };
let _myUid = null;
let _nearestFriendPlot = null; // { areaId, plotNo, ownerUid, ownerName, locked, dist }
let _toast = null;
let _onPromptUpdate = null;    // callback to update the prompt UI
let _pendingKnock = null;      // { knockId, ownerUid } when waiting for a knock reply
let _unsubKnockReply = null;

// FEATURE 3: per-area chunk-streamed plot grids + name signs
let _areaGridMeshes = new Map(); // areaId -> { mesh: InstancedMesh, allocated: int }
let _areaNameSprites = new Map(); // areaId -> { sprite, canvas, ctx, texture }
let _labelTextureCache = new Map(); // text -> CanvasTexture (for area name signs)

// ---- Build the door-gate geometry (merged, reused for every plot) ----
// Two posts + top beam + sign board, all in one merged BufferGeometry.
function _buildDoorGeometry() {
  const postGeo = new THREE.CylinderGeometry(0.12, 0.15, 3.0, 6);
  const beamGeo = new THREE.BoxGeometry(2.4, 0.2, 0.15);
  const signGeo = new THREE.BoxGeometry(2.0, 0.6, 0.08);
  const beam = beamGeo.clone();
  beam.translate(0, 3.0, 0);
  const sign = signGeo.clone();
  sign.translate(0, 3.4, 0);
  // Posts: left at x=-1.0, right at x=+1.0
  const postL = postGeo.clone();
  postL.translate(-1.0, 1.5, 0);
  const postR = postGeo.clone();
  postR.translate(1.0, 1.5, 0);
  // Merge — mergeGeometries is imported at the top of this file
  return mergeGeometries([postL, postR, beam, sign], true);
}

// (The duplicate `import { mergeGeometries }` line was moved to the top of the file.)

// ---- Init the door mesh + label pool ----
export function initPlotDoors(scene, myUid, toast, onPromptUpdate) {
  _scene = scene;
  _myUid = myUid;
  _toast = toast;
  _onPromptUpdate = onPromptUpdate;

  // Door InstancedMesh — start with a small count, grow if needed
  const geo = _buildDoorGeometry();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: false, color: 0x8a6a45 });
  _doorMesh = new THREE.InstancedMesh(geo, mat, 256);
  _doorMesh.frustumCulled = false;
  _doorMesh.count = 0;
  // Hide all instances by default (scale 0)
  const m = new THREE.Matrix4();
  m.makeScale(0, 0, 0);
  for (let i = 0; i < 256; i++) _doorMesh.setMatrixAt(i, m);
  _doorMesh.instanceMatrix.needsUpdate = true;
  _scene.add(_doorMesh);

  // Label sprite pool
  _labelGroup = new THREE.Group();
  _scene.add(_labelGroup);
  for (let i = 0; i < LABEL_POOL_SIZE; i++) {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext("2d");
    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.visible = false;
    sprite.scale.set(4, 1, 1);
    _labelGroup.add(sprite);
    _labelPool.push({ sprite, canvas, ctx, texture: tex, plotId: null, areaId: null, plotNo: null });
  }
}

// ---- Per-frame tick: update subscriptions + instance positions ----
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _scl = new THREE.Vector3(1, 1, 1);
const _UP = new THREE.Vector3(0, 1, 0);
const _HIDE = new THREE.Matrix4().makeScale(0, 0, 0);

let _housesVersion = 0, _simVersion = -1, _simX = 1e9, _simZ = 1e9, _simT = 0, _simInfo = null;
export function tickPlotDoors(playerX, playerZ) {
  if (!_doorMesh) return; // not initialised yet (before sign-in) — nothing to draw
  _player.x = playerX;
  _player.z = playerZ;

  // 1. Re-evaluate which areas should be subscribed
  const newAreas = new Set();
  for (const area of AREAS) {
    const dx = area.x - playerX, dz = area.z - playerZ;
    if (dx * dx + dz * dz < 300 * 300) newAreas.add(area.id);
  }
  // Subscribe to new areas
  for (const areaId of newAreas) {
    if (!_subscriptions.has(areaId)) {
      const unsub = onValue(ref(db, "houses/" + areaId), (snap) => {
        _houses[areaId] = snap.val() || {};
        _housesVersion++;
      });
      _subscriptions.set(areaId, unsub);
      _nearbyAreas.add(areaId);
    }
  }
  // Unsubscribe from areas no longer nearby
  for (const areaId of Array.from(_nearbyAreas)) {
    if (!newAreas.has(areaId)) {
      const unsub = _subscriptions.get(areaId);
      if (unsub) { try { unsub(); } catch (e) {} }
      _subscriptions.delete(areaId);
      _nearbyAreas.delete(areaId);
      delete _houses[areaId];
      // FEATURE 3: dispose this area's grid mesh + name sign
      _disposeAreaGrid(areaId);
      _disposeAreaName(areaId);
    }
  }

  // FEATURE 3: For each nearby area, ensure a chunk-streamed plot grid
  // InstancedMesh + a name sign billboard exist. Then update visibility
  // based on player distance.
  for (const areaId of _nearbyAreas) {
    const area = getArea(areaId);
    if (!area) continue;
    const dx = area.x - playerX, dz = area.z - playerZ;
    const distToArea = Math.sqrt(dx * dx + dz * dz);
    // Ensure grid mesh exists
    if (!_areaGridMeshes.has(areaId)) _buildAreaGrid(areaId, area);
    // Update grid visibility + instance positions
    _updateAreaGrid(areaId, area, playerX, playerZ);
    // Ensure name sign exists
    if (!_areaNameSprites.has(areaId)) _buildAreaName(areaId, area);
    // Toggle visibility based on distance
    const nameEntry = _areaNameSprites.get(areaId);
    if (nameEntry) nameEntry.sprite.visible = distToArea < AREA_NAME_RANGE;
  }

  // Doors / labels / knock-prompt only need recomputing when the player moved a bit, the houses changed, or 300 ms passed.
  const _now = performance.now();
  const _mx = playerX - _simX, _mz = playerZ - _simZ;
  if (_simVersion === _housesVersion && _mx * _mx + _mz * _mz < 0.25 && _now - _simT < 300) {
    if (_onPromptUpdate) _onPromptUpdate(_simInfo);
    return;
  }
  _simVersion = _housesVersion; _simX = playerX; _simZ = playerZ; _simT = _now;

  // 2. Collect all occupied plots within RENDER_RANGE
  const nearbyPlots = [];
  for (const areaId of _nearbyAreas) {
    const houses = _houses[areaId];
    if (!houses) continue;
    const area = getArea(areaId);
    if (!area) continue;
    for (const [plotNoStr, houseRec] of Object.entries(houses)) {
      const plotNo = parseInt(plotNoStr, 10);
      if (!houseRec || !houseRec.ownerUid) continue;
      const pos = getPlotPosition(area, plotNo);
      const dx = pos.x - playerX, dz = pos.z - playerZ;
      const d2 = dx * dx + dz * dz;
      if (d2 > RENDER_RANGE * RENDER_RANGE) continue;
      nearbyPlots.push({ areaId, plotNo, area, pos, house: houseRec, dist: Math.sqrt(d2) });
    }
  }

  // 3. Place door instance matrices for nearby plots
  // Cap at 256 (the InstancedMesh capacity)
  let idx = 0;
  for (const p of nearbyPlots) {
    if (idx >= 256) break;
    _v.set(p.pos.x, 0, p.pos.z);
    _q.setFromAxisAngle(_UP, p.pos.rot || 0);
    _m4.compose(_v, _q, _scl);
    _doorMesh.setMatrixAt(idx, _m4);
    idx++;
  }
  // Hide any leftover instances from the previous frame
  for (let i = idx; i < _doorMesh.count; i++) _doorMesh.setMatrixAt(i, _HIDE);
  _doorMesh.count = idx;
  _doorMesh.instanceMatrix.needsUpdate = true;

  // 4. Update label sprites (only plots within LABEL_RANGE, LRU recycling)
  const labelPlots = nearbyPlots.filter(p => p.dist < LABEL_RANGE);
  // Sort by distance ascending so the nearest ones get the labels
  labelPlots.sort((a, b) => a.dist - b.dist);
  for (let i = 0; i < _labelPool.length; i++) {
    const lp = _labelPool[i];
    const p = labelPlots[i];
    if (!p) { lp.sprite.visible = false; lp.plotId = null; continue; }
    const plotId = p.areaId + "/" + p.plotNo;
    if (lp.plotId !== plotId) {
      // Redraw the label
      const isMyHouse = p.house.ownerUid === _myUid;
      const label = isMyHouse ? "🏠 My Home" : ("🏠 " + (p.house.ownerName || "Owner"));
      _drawLabel(lp.canvas, lp.ctx, label, isMyHouse ? "#4ade80" : "#f2b134");
      lp.texture.needsUpdate = true;
      lp.plotId = plotId;
      lp.areaId = p.areaId;
      lp.plotNo = p.plotNo;
    }
    lp.sprite.position.set(p.pos.x, 4.2, p.pos.z);
    lp.sprite.visible = true;
  }

  // 5. Find nearest friend's plot within KNOCK_RANGE
  let nearest = null;
  for (const p of nearbyPlots) {
    if (p.house.ownerUid === _myUid) continue; // skip own house (handled by existing home entrance)
    if (p.dist < KNOCK_RANGE) {
      if (!nearest || p.dist < nearest.dist) nearest = p;
    }
  }
  _nearestFriendPlot = nearest;

  // 6. Notify main.js about the prompt update
  _simInfo = nearest ? {
      areaId: nearest.areaId,
      plotNo: nearest.plotNo,
      ownerUid: nearest.house.ownerUid,
      ownerName: nearest.house.ownerName || "Friend",
      locked: nearest.house.locked,
      dist: nearest.dist,
    } : null;
  if (_onPromptUpdate) {
    _onPromptUpdate(nearest ? {
      areaId: nearest.areaId,
      plotNo: nearest.plotNo,
      ownerUid: nearest.house.ownerUid,
      ownerName: nearest.house.ownerName || "Friend",
      locked: nearest.house.locked,
      dist: nearest.dist,
    } : null);
  }
}

export function getNearestFriendPlot() { return _nearestFriendPlot; }

// FEATURE: expose the cached houses data so areas_world.js can render
// house exteriors ONLY at occupied plots (not every plot in the area).
export function getAreaHouses(areaId) {
  return _houses[areaId] || {};
}

// FEATURE: expose the area name sprites map so main.js's tap-raycaster can
// detect when the player taps a floating area name sign → travel there.
export function getAreaNameSprites() {
  return _areaNameSprites;
}

// ---- Draw a label onto a canvas (called only when the label changes) ----
function _drawLabel(canvas, ctx, text, accent) {
  ctx.fillStyle = "rgba(15,15,15,0.85)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = accent || "#f2b134";
  ctx.fillRect(0, 0, 4, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 22px Poppins, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 130, 32, 240);
}

// ---- Knock on the nearest friend's plot ----
// Returns true if a knock was sent. Caller (main.js) handles the reply listener.
export async function knockOnNearest(visitorName) {
  if (!_nearestFriendPlot) return false;
  if (!_myUid) return false;
  const p = _nearestFriendPlot;
  try {
    const knockId = await knockOnDoor(p.house.ownerUid, _myUid, visitorName, p.areaId, p.plotNo);
    if (!knockId) { _toast?.("Could not knock — try again"); return false; }
    // Listen for the reply
    if (_unsubKnockReply) { try { _unsubKnockReply(); } catch (e) {} }
    _pendingKnock = { knockId, ownerUid: p.house.ownerUid, ownerName: p.house.ownerName };
    _toast?.("🚪 Knocking on " + (p.house.ownerName || "friend") + "'s door...");
    return true;
  } catch (e) {
    console.warn("[plots] knockOnDoor failed:", e.message);
    _toast?.("Knock failed — try again");
    return false;
  }
}

// ---- Listen for the knock reply (called by main.js after knockOnNearest succeeds) ----
export function listenForKnockReplyNow(onReply) {
  if (!_pendingKnock) return;
  const { knockId, ownerUid, ownerName } = _pendingKnock;
  _unsubKnockReply = listenForKnockReply(ownerUid, knockId, (v) => {
    if (!v) {
      // Knock was deleted (timeout or owner cleared it)
      onReply({ status: "timeout", ownerName });
      _pendingKnock = null;
      _unsubKnockReply = null;
      return;
    }
    if (v.status === "accepted" || v.status === "denied") {
      onReply({ status: v.status, ownerName, ownerUid: v.visitorUid });
      _pendingKnock = null;
      _unsubKnockReply = null;
    }
  });
}

// ---- Enter directly if the friend's house is unlocked ----
// Returns the house info needed for enterPlaceAsVisitor, or null.
export function getUnlockedVisitInfo() {
  if (!_nearestFriendPlot) return null;
  if (_nearestFriendPlot.house.locked) return null;
  return {
    ownerUid: _nearestFriendPlot.house.ownerUid,
    ownerName: _nearestFriendPlot.house.ownerName || "Friend",
    areaId: _nearestFriendPlot.areaId,
    plotNo: _nearestFriendPlot.plotNo,
  };
}

// ---- Cleanup ----
export function disposePlotDoors() {
  for (const unsub of _subscriptions.values()) {
    try { unsub(); } catch (e) {}
  }
  _subscriptions.clear();
  _nearbyAreas.clear();
  if (_unsubKnockReply) { try { _unsubKnockReply(); } catch (e) {} _unsubKnockReply = null; }
  if (_doorMesh) {
    _scene?.remove(_doorMesh);
    _doorMesh.geometry?.dispose();
    _doorMesh.material?.dispose();
    _doorMesh = null;
  }
  // FEATURE 3: dispose all area grids + name signs
  for (const areaId of Array.from(_areaGridMeshes.keys())) _disposeAreaGrid(areaId);
  for (const areaId of Array.from(_areaNameSprites.keys())) _disposeAreaName(areaId);
  if (_labelGroup) {
    _scene?.remove(_labelGroup);
    for (const lp of _labelPool) {
      lp.texture?.dispose();
      lp.sprite.material?.dispose();
    }
    _labelPool = [];
    _labelGroup = null;
  }
}

// ---- FEATURE 3: per-area plot grid (chunk-streamed) ----
// Each nearby area gets ONE InstancedMesh of small plot-boundary markers
// (4 thin posts forming a square). Capacity = area.plots. The mesh is
// allocated once when the area first becomes nearby, disposed when the
// area unsubscribes. Per-frame we just update visibility based on distance.
function _buildAreaGrid(areaId, area) {
  // 4 thin posts per plot — merged into one geometry, instanced
  const postGeo = new THREE.BoxGeometry(0.12, 0.6, 0.12);
  // Translate to 4 corners of a 7m x 7m square (plot size minus 1m gap)
  const cornerPositions = [
    [-3.5, 0.3, -3.5],
    [ 3.5, 0.3, -3.5],
    [-3.5, 0.3,  3.5],
    [ 3.5, 0.3,  3.5],
  ];
  const parts = cornerPositions.map(([x, y, z]) => {
    const g = postGeo.clone();
    g.translate(x, y, z);
    return g;
  });
  const merged = mergeGeometries(parts, true);
  // Color by area tier: cheap=grey, middle=green, rich=gold
  const tierCol = area.tier === "rich" ? 0xf2b134 :
                  area.tier === "middle" ? 0x4a9a5a :
                  0x8a8f96;
  const mat = new THREE.MeshLambertMaterial({ color: tierCol });
  // Capacity: 4 posts per plot × area.plots
  const capacity = area.plots;               // ONE instance per plot (the 4 corner posts are inside the geometry)
  const mesh = new THREE.InstancedMesh(merged, mat, capacity);
  mesh.frustumCulled = false;
  // Positions never change, so place every plot ONCE here (not every frame).
  const m4 = new THREE.Matrix4(), v = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  for (let plotNo = 0; plotNo < capacity; plotNo++) {
    const pos = getPlotPosition(area, plotNo);
    v.set(pos.x, 0, pos.z); q.setFromAxisAngle(up, pos.rot || 0); m4.compose(v, q, sc);
    mesh.setMatrixAt(plotNo, m4);
  }
  mesh.count = capacity;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.visible = false;
  _scene.add(mesh);
  _areaGridMeshes.set(areaId, { mesh, capacity });
}

// Per frame: only flip visibility (no loops, no allocations, no GPU re-upload).
function _updateAreaGrid(areaId, area, playerX, playerZ) {
  const entry = _areaGridMeshes.get(areaId);
  if (!entry) return;
  const dx = area.x - playerX, dz = area.z - playerZ;
  entry.mesh.visible = dx * dx + dz * dz <= AREA_GRID_RANGE * AREA_GRID_RANGE;
}

function _disposeAreaGrid(areaId) {
  const entry = _areaGridMeshes.get(areaId);
  if (!entry) return;
  _scene?.remove(entry.mesh);
  entry.mesh.geometry?.dispose();
  entry.mesh.material?.dispose();
  _areaGridMeshes.delete(areaId);
}

// ---- FEATURE 3: per-area name sign billboard ----
// A canvas-textured sprite showing "<Name> · <tier emoji> · rent ₦X / buy ₦Y".
// Always faces the camera. Only visible within AREA_NAME_RANGE.
function _buildAreaName(areaId, area) {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const tierEmoji = area.tier === "rich" ? "💎" : area.tier === "middle" ? "🏠" : "🏘️";
  const text = area.name + " " + tierEmoji;
  const subtext = "Rent ₦" + area.rentPrice.toLocaleString() + " · Buy ₦" + area.buyPrice.toLocaleString();
  // Background
  const bgCol = area.tier === "rich" ? "#1a1a2e" : area.tier === "middle" ? "#0f4d3a" : "#3a2a1a";
  const accentCol = area.tier === "rich" ? "#f2b134" : area.tier === "middle" ? "#4ade80" : "#9aa0a6";
  ctx.fillStyle = bgCol;
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = accentCol;
  ctx.fillRect(0, 0, 6, 128);
  // Name
  ctx.fillStyle = "#fff";
  ctx.font = "bold 36px Poppins, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 42, 500);
  // Subtext (prices)
  ctx.fillStyle = accentCol;
  ctx.font = "600 22px Poppins, Arial, sans-serif";
  ctx.fillText(subtext, 256, 88, 500);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(area.x, 12, area.z);
  sprite.scale.set(16, 4, 1);
  sprite.visible = false; // tickPlotDoors will toggle based on distance
  // FEATURE: tag the area name sprite with userData so main.js's tap-raycaster
  // can detect when the player taps an area name → travel there.
  sprite.userData = { isAreaName: true, areaId: area.id, areaName: area.name };
  _scene.add(sprite);
  _areaNameSprites.set(areaId, { sprite, canvas, ctx, texture: tex });
}

function _disposeAreaName(areaId) {
  const entry = _areaNameSprites.get(areaId);
  if (!entry) return;
  _scene?.remove(entry.sprite);
  entry.texture?.dispose();
  entry.sprite.material?.dispose();
  _areaNameSprites.delete(areaId);
}
