// src/vehicles.js — Buyable vehicles catalog + owned vehicles + ride system.
//
// Buy a vehicle → deduct money → write to Firebase players/{uid}/vehicles/{id} = true.
// Ride → spawn the vehicle mesh at the player's position + boost movement speed.
// Dismount → despawn the mesh + remove the speed boost.
//
// The vehicle mesh reuses the traffic.js geometry builders (sedan, hatch, suv,
// bus, REMOVEDkeke, okada) so there's no new geometry to author.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { db } from "./firebase.js";
import { ref, get, set, update, onValue } from "firebase/database";

// ---- Catalog ----
export const VEHICLE_CATALOG = [
  { id: "okada",   name: "Okada (Motorcycle)",  emoji: "🏍️",  price: 15000,  speed: 5.5, desc: "Fast + cheap. Zips through traffic." },
  { id: "keke",    name: "Keke Napep",           emoji: "🛺",   price: 25000,  speed: 4.0, desc: "The Kaduna classic. Steady + reliable." },
  { id: "bicycle", name: "Bicycle",              emoji: "🚲",   price: 8000,   speed: 3.0, desc: "Eco-friendly. No fuel needed." },
  { id: "sedan",   name: "Sedan",                emoji: "🚗",   price: 80000,  speed: 5.5, desc: "Comfortable daily driver. AC + stereo." },
  { id: "hatch",   name: "Hatchback",           emoji: "🚙",   price: 55000,  speed: 5.0, desc: "Compact + nimble. Easy to park." },
  { id: "suv",     name: "SUV",                  emoji: "🚐",   price: 150000, speed: 4.8, desc: "Big + bold. Handles any road." },
  { id: "bus",     name: "Danfo Bus",            emoji: "🚌",   price: 120000, speed: 3.5, desc: "Carry passengers. Slow but steady." },
  { id: "sports",  name: "Sports Car",           emoji: "🏎️",   price: 500000, speed: 7.0, desc: "Flashy + fast. The ultimate flex." },
  { id: "luxury",  name: "Luxury Sedan",         emoji: "🚘",   price: 1000000,speed: 6.5, desc: "VIP ride. Big oga energy." },
];

export function getVehicle(id) { return VEHICLE_CATALOG.find(v => v.id === id); }

// ---- State ----
let _uid = null, _owned = {}, _onUpdate = null;
let _riding = null;       // { vehicleId, speed, mesh } or null
let _scene = null;

// ---- Init: subscribe to owned vehicles from Firebase ----
export function initVehicles(scene, uid, onUpdate) {
  _scene = scene; _uid = uid; _onUpdate = onUpdate;
  if (!uid) return;
  onValue(ref(db, "players/" + uid + "/vehicles"), (snap) => {
    _owned = snap.val() || {};
    _onUpdate?.();
  });
}

export function getOwned() { return _owned; }
export function ownsVehicle(id) { return !!_owned[id]; }
export function isRiding() { return _riding !== null; }
export function getRideSpeed() { return _riding ? _riding.speed : 0; }
export function getRideId() { return _riding ? _riding.vehicleId : null; }

// ---- Buy a vehicle ----
export async function buyVehicle(vehicleId, gameState, toast) {
  if (!_uid) { toast?.("Sign in first"); return false; }
  const v = getVehicle(vehicleId);
  if (!v) { toast?.("Unknown vehicle"); return false; }
  if (ownsVehicle(vehicleId)) { toast?.("You already own " + v.name); return false; }
  if ((gameState.money || 0) < v.price) { toast?.("Not enough money — need ₦" + v.price.toLocaleString()); return false; }
  try {
    // Deduct money + write to Firebase
    gameState.money -= v.price;
    await update(ref(db, "economy/" + _uid), { balance: gameState.money });
    await set(ref(db, "players/" + _uid + "/vehicles/" + vehicleId), true);
    toast?.("🎉 Bought " + v.name + "! Find it in your Garage.");
    return true;
  } catch (e) {
    console.warn("[vehicles] buy failed:", e.message);
    toast?.("Buy failed — try again");
    return false;
  }
}

// ---- Build a single vehicle mesh (reuses traffic.js geometry builders) ----
// We import the TYPES from traffic.js lazily to avoid circular deps.
let _trafficTypes = null;
async function _getTrafficTypes() {
  if (_trafficTypes) return _trafficTypes;
  const mod = await import("./traffic.js");
  // traffic.js doesn't export TYPES, so we re-create the builders here
  // (simplified versions — just enough to look like the vehicle).
  _trafficTypes = _buildSimplifiedTypes();
  return _trafficTypes;
}

// Simplified vehicle geometry builders (don't need to match traffic.js exactly —
// just need to look like a car/keke/okada at the player's position).
function _buildSimplifiedTypes() {
  const part = (w, h, d, x, y, z, hex) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    const c = new THREE.Color(hex);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b; }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  };
  return {
    okada: () => [
      part(1.8, 0.4, 0.6, 0, 0.7, 0, 0xe11d48),
      part(0.6, 0.5, 0.5, 0.5, 1.0, 0, 0x1a1a1a),
      part(0.3, 0.3, 0.3, 0.9, 0.9, 0, 0x9aa0a6),
      part(0.3, 0.3, 0.1, -1.0, 0.3, 0, 0x15171a),
      part(0.3, 0.3, 0.1, 1.0, 0.3, 0, 0x15171a),
    ],
    keke: () => [
      part(2.7, 0.55, 1.3, 0, 0.6, 0, 0xf2c230),
      part(1.5, 1.0, 1.28, -0.45, 1.3, 0, 0xf2c230),
      part(1.55, 0.1, 1.32, -0.45, 1.85, 0, 0x1d3b2f),
      part(0.5, 0.5, 0.2, 1.1, 0.25, 0.7, 0x15171a),
      part(0.5, 0.5, 0.2, -0.9, 0.25, 0.7, 0x15171a),
      part(0.5, 0.5, 0.2, -0.9, 0.25, -0.7, 0x15171a),
    ],
    bicycle: () => [
      part(0.06, 0.5, 0.06, 0, 0.7, 0, 0x1a1a1a),
      part(0.06, 0.5, 0.06, 0, 0.7, 0.4, 0x1a1a1a),
      part(0.5, 0.05, 0.15, 0, 1.0, 0.2, 0x1a1a1a),
      part(0.3, 0.3, 0.06, 0, 0.3, 0.5, 0x15171a),
      part(0.3, 0.3, 0.06, 0, 0.3, -0.5, 0x15171a),
    ],
    sedan: () => [
      part(4.4, 0.7, 1.8, 0, 0.62, 0, 0xf2f2ee),
      part(2.3, 0.62, 1.64, -0.2, 1.25, 0, 0x2a3a4a),
      part(2.1, 0.08, 1.6, -0.2, 1.58, 0, 0xf2f2ee),
      part(0.33, 0.33, 0.22, -1.4, 0.33, 0.65, 0x15171a),
      part(0.33, 0.33, 0.22, -1.4, 0.33, -0.65, 0x15171a),
      part(0.33, 0.33, 0.22, 1.4, 0.33, 0.65, 0x15171a),
      part(0.33, 0.33, 0.22, 1.4, 0.33, -0.65, 0x15171a),
    ],
    hatch: () => [
      part(3.7, 0.7, 1.7, 0, 0.6, 0, 0xb7bcc4),
      part(2.2, 0.66, 1.56, -0.25, 1.22, 0, 0x2a3a4a),
      part(2.0, 0.08, 1.5, -0.25, 1.57, 0, 0xb7bcc4),
      part(0.31, 0.31, 0.22, -1.2, 0.31, 0.6, 0x15171a),
      part(0.31, 0.31, 0.22, -1.2, 0.31, -0.6, 0x15171a),
      part(0.31, 0.31, 0.22, 1.2, 0.31, 0.6, 0x15171a),
      part(0.31, 0.31, 0.22, 1.2, 0.31, -0.6, 0x15171a),
    ],
    suv: () => [
      part(4.7, 0.95, 1.95, 0, 0.82, 0, 0x2e7d4f),
      part(3.2, 0.7, 1.8, -0.35, 1.62, 0, 0x2a3a4a),
      part(3.0, 0.08, 1.75, -0.35, 2.0, 0, 0x2e7d4f),
      part(0.4, 0.4, 0.22, -1.5, 0.4, 0.7, 0x15171a),
      part(0.4, 0.4, 0.22, -1.5, 0.4, -0.7, 0x15171a),
      part(0.4, 0.4, 0.22, 1.5, 0.4, 0.7, 0x15171a),
      part(0.4, 0.4, 0.22, 1.5, 0.4, -0.7, 0x15171a),
    ],
    bus: () => [
      part(6.2, 1.5, 2.1, 0, 1.15, 0, 0xf2f2ee),
      part(5.8, 0.7, 2.14, -0.1, 1.7, 0, 0x2a3a4a),
      part(6.2, 0.18, 2.12, 0, 0.82, 0, 0x0f4d3a),
      part(0.4, 0.4, 0.22, -2.0, 0.4, 0.75, 0x15171a),
      part(0.4, 0.4, 0.22, -2.0, 0.4, -0.75, 0x15171a),
      part(0.4, 0.4, 0.22, 2.0, 0.4, 0.75, 0x15171a),
      part(0.4, 0.4, 0.22, 2.0, 0.4, -0.75, 0x15171a),
    ],
    sports: () => [
      part(4.2, 0.5, 1.8, 0, 0.5, 0, 0xe11d48),
      part(2.0, 0.45, 1.5, -0.3, 1.0, 0, 0x1a1a2e),
      part(0.1, 0.3, 1.3, 1.6, 0.8, 0, 0x2a3a4a),
      part(0.35, 0.35, 0.22, -1.3, 0.35, 0.65, 0x15171a),
      part(0.35, 0.35, 0.22, -1.3, 0.35, -0.65, 0x15171a),
      part(0.35, 0.35, 0.22, 1.3, 0.35, 0.65, 0x15171a),
      part(0.35, 0.35, 0.22, 1.3, 0.35, -0.65, 0x15171a),
    ],
    luxury: () => [
      part(5.0, 0.7, 1.9, 0, 0.65, 0, 0x1a1a2e),
      part(2.5, 0.6, 1.7, -0.3, 1.25, 0, 0x2a3a4a),
      part(2.3, 0.08, 1.65, -0.3, 1.58, 0, 0x1a1a2e),
      part(0.38, 0.38, 0.22, -1.6, 0.38, 0.7, 0x15171a),
      part(0.38, 0.38, 0.22, -1.6, 0.38, -0.7, 0x15171a),
      part(0.38, 0.38, 0.22, 1.6, 0.38, 0.7, 0x15171a),
      part(0.38, 0.38, 0.22, 1.6, 0.38, -0.7, 0x15171a),
    ],
  };
}

// ---- Spawn a ride vehicle at the player's position ----
export async function spawnRideVehicle(vehicleId, playerPos, playerHeading) {
  if (_riding) despawnRideVehicle();
  const v = getVehicle(vehicleId);
  if (!v) return false;
  const types = await _getTrafficTypes();
  const builder = types[vehicleId];
  if (!builder) {
    console.warn("[vehicles] no builder for", vehicleId);
    return false;
  }
  const parts = builder();
  const merged = mergeGeometries(parts, true);
  parts.forEach(g => g.dispose());
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(merged, mat);
  mesh.castShadow = false; // perf — only the player character casts shadows
  mesh.frustumCulled = false;
  // Position at the player's spot, slightly lowered so the player "sits" on/in it
  mesh.position.set(playerPos.x, 0, playerPos.z);
  mesh.rotation.y = playerHeading;
  _scene.add(mesh);
  _riding = { vehicleId, speed: v.speed, mesh };
  console.log("[vehicles] Riding " + v.name + " (speed boost +" + v.speed + ")");
  return true;
}

// ---- Despawn the ride vehicle ----
export function despawnRideVehicle() {
  if (!_riding) return;
  _scene.remove(_riding.mesh);
  _riding.mesh.geometry?.dispose();
  _riding.mesh.material?.dispose();
  _riding = null;
}

// ---- Update the ride vehicle position (called from main.js every frame) ----
export function tickRideVehicle(playerPos, playerHeading) {
  if (!_riding) return;
  _riding.mesh.position.set(playerPos.x, 0, playerPos.z);
  _riding.mesh.rotation.y = playerHeading;
}
