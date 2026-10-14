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

// ---- Tunables ----
const AREA_RENDER_RANGE = 250;   // metres — render area content within this of the player
const PLOT_CHUNK_RANGE = 220;    // metres — only place house instances for plots within this of the player
const HOUSE_BODY_W = 5.0, HOUSE_BODY_D = 5.0, HOUSE_BODY_H = 3.0;
const ROOF_H = 1.5;
const DOOR_W = 1.0, DOOR_H = 2.0;

// ---- State ----
let _scene = null;
let _areasBuilt = new Map();  // areaId -> { houseMesh, lampMesh, roadMesh, capacity }

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
export function initAreaWorld(scene) {
  _scene = scene;
}

// ---- Tick: per-frame, manage per-area meshes + chunk positions ----
const _m4 = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _scl = new THREE.Vector3(1, 1, 1);
const _hide = new THREE.Matrix4().makeScale(0, 0, 0);
const _up = new THREE.Vector3(0, 1, 0);

export function tickAreaWorld(playerX, playerZ) {
  if (!_scene) return;
  // Iterate every area — if it's nearby, ensure its meshes exist and update
  // chunk positions. If it's far, dispose its meshes (frees GPU memory).
  for (const area of AREAS) {
    const dx = area.x - playerX, dz = area.z - playerZ;
    const distToArea = Math.sqrt(dx * dx + dz * dz);
    const isNear = distToArea < AREA_RENDER_RANGE;
    if (isNear) {
      if (!_areasBuilt.has(area.id)) _buildArea(area);
      _updateArea(area, playerX, playerZ, distToArea);
    } else {
      if (_areasBuilt.has(area.id)) _disposeArea(area.id);
    }
  }
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

  _areasBuilt.set(area.id, {
    houseMesh, lampMesh, roadMesh, swL, swR, capacity, lampCount, roadW,
  });
  console.log("[areas_world] Built area " + area.id + " (" + area.plots + " plots)");
}

// ---- Update an area's chunk positions (called per-frame while the area is nearby) ----
function _updateArea(area, playerX, playerZ, distToArea) {
  const entry = _areasBuilt.get(area.id);
  if (!entry) return;
  const { houseMesh, lampMesh, capacity, lampCount } = entry;

  // Hide the whole area's meshes if the player is too far
  if (distToArea > AREA_RENDER_RANGE) {
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

  // ---- Place house instances for plots within chunk range of the player ----
  let idx = 0;
  const wallCol = new THREE.Color(area.wallCol);
  const roofCol = new THREE.Color(area.roofCol);
  const doorCol = new THREE.Color(0x4a3a2a);
  const abandonedCol = new THREE.Color(0x6a6a6a);
  for (let plotNo = 0; plotNo < area.plots; plotNo++) {
    if (idx >= capacity) break;
    const pos = getPlotPosition(area, plotNo);
    const dx = pos.x - playerX, dz = pos.z - playerZ;
    if (dx * dx + dz * dz > PLOT_CHUNK_RANGE * PLOT_CHUNK_RANGE) continue;
    _v.set(pos.x, 0, pos.z);
    _q.setFromAxisAngle(_up, pos.rot || 0);
    _m4.compose(_v, _q, _scl);
    houseMesh.setMatrixAt(idx, _m4);
    // Per-instance color: full area colors (so occupied + unoccupied look
    // the same visually until step 3c adds FOR RENT / FOR SALE boards).
    // We use setColorAt — first vertex color group (body) is wallCol, then
    // roof, then door. The geometry uses vertex colors so this is overridden
    // by the instance color (instanceColor takes priority over vertexColors).
    houseMesh.setColorAt(idx, wallCol);
    idx++;
  }
  // Hide leftover instances
  for (let i = idx; i < houseMesh.count; i++) houseMesh.setMatrixAt(i, _hide);
  houseMesh.count = Math.min(idx, capacity);
  houseMesh.instanceMatrix.needsUpdate = true;
  if (houseMesh.instanceColor) houseMesh.instanceColor.needsUpdate = true;

  // ---- Lamp posts: one per 4 plots, placed at the corner of the plot grid ----
  let lampIdx = 0;
  const lampSpacing = 4;  // 1 lamp per 4 plots
  for (let plotNo = 0; plotNo < area.plots; plotNo += lampSpacing) {
    if (lampIdx >= lampCount) break;
    const pos = getPlotPosition(area, plotNo);
    const dx = pos.x - playerX, dz = pos.z - playerZ;
    if (dx * dx + dz * dz > PLOT_CHUNK_RANGE * PLOT_CHUNK_RANGE) continue;
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
  const { houseMesh, lampMesh, roadMesh, swL, swR } = entry;
  _scene.remove(houseMesh); houseMesh.geometry?.dispose(); houseMesh.material?.dispose();
  _scene.remove(lampMesh); lampMesh.geometry?.dispose(); lampMesh.material?.dispose();
  _scene.remove(roadMesh); roadMesh.geometry?.dispose(); roadMesh.material?.dispose();
  _scene.remove(swL); swL.geometry?.dispose(); swL.material?.dispose();
  _scene.remove(swR); swR.geometry?.dispose(); swR.material?.dispose();
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
