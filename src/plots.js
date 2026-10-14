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

export function tickPlotDoors(playerX, playerZ) {
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
    }
  }

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
    _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.pos.rot || 0);
    _m4.compose(_v, _q, _scl);
    _doorMesh.setMatrixAt(idx, _m4);
    idx++;
  }
  // Hide any leftover instances from the previous frame
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = idx; i < _doorMesh.count; i++) _doorMesh.setMatrixAt(i, hide);
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
