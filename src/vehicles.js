// src/vehicles.js — Buyable vehicles catalog + owned vehicles + ride system.
//
// Buy a vehicle → deduct money → write to Firebase players/{uid}/vehicles/{id} = true.
// Ride → spawn the vehicle mesh at the player's position + boost movement speed.
// Dismount → despawn the mesh + remove the speed boost.
//
// Vehicles with a `glbPath` load a real 3D GLB model (Ferrari, Jeep, Danfo Bus, Keke).
// Others use simplified box-geometry builders.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { db } from "./firebase.js";
import { ref, get, set, update, onValue } from "firebase/database";

// ---- Catalog ----
// glbPath = path to a real 3D model (loaded lazily via GLTFLoader on first ride)
// fit = how to stand the model on the ground, centred, facing +X (the way every built-in car faces):
//   s = scale, cx/cz = where the model's centre is, minY = lowest point, rotY = turn needed so its FRONT points to +X,
//   hide = junk parts to hide. Measured from the real files (the bus was 2 m long and half under the road, the keke had
//   a big flat disc under it, the jeep's pivot was 0.3 m off-centre, the Ferrari's nose points to -Z).
export const VEHICLE_CATALOG = [
  { id: "okada", seat: { f: 0.1, y: 0.45, s: 0 },   name: "Okada (Motorcycle)",  emoji: "🏍️",  price: 15000,  speed: 5.5, desc: "Fast + cheap. Zips through traffic." },
  { id: "keke", seat: { f: 0.65, y: 0.5, s: 0 },    name: "Keke Napep",           emoji: "🛺",   price: 25000,  speed: 4.0, desc: "The Kaduna classic. Steady + reliable.",
    glbPath: "/models/vehicles/keke_napep.glb", fit: { s: 1.0, cx: 0.15, cz: 0.01, minY: 0.11, rotY: 0, hide: ["Object_89"] } },
  { id: "bicycle", seat: { f: 0, y: 0.55, s: 0 }, name: "Bicycle",              emoji: "🚲",   price: 8000,   speed: 3.0, desc: "Eco-friendly. No fuel needed." },
  { id: "sedan",   seat: { f: 0.3, y: 0.5, s: 0.4 },  name: "Sedan",                emoji: "🚗",   price: 80000,  speed: 5.5, desc: "Comfortable daily driver. AC + stereo." },
  { id: "hatch",   seat: { f: 0.2, y: 0.5, s: 0.35 }, name: "Hatchback",           emoji: "🚙",   price: 55000,  speed: 5.0, desc: "Compact + nimble. Easy to park." },
  { id: "jeep", seat: { f: 0.3, y: 0.5, s: 0.4 },    name: "Jeep Wrangler",       emoji: "🚙",   price: 300000, speed: 5.2, desc: "Rugged + bold. Conquers any terrain.",
    glbPath: "/models/vehicles/jeep.glb", fit: { s: 0.8, cx: -0.31, cz: 0, minY: -0.41, rotY: 0 } },
  { id: "suv",     seat: { f: 0.3, y: 0.55, s: 0.4 }, name: "SUV",                  emoji: "🚐",   price: 150000, speed: 4.8, desc: "Big + bold. Handles any road." },
  { id: "bus", seat: { f: 1.5, y: 0.5, s: 0.4 }, name: "Lagos Danfo Bus",      emoji: "🚌",   price: 120000, speed: 3.5, desc: "The iconic yellow bus. Carry passengers.",
    glbPath: "/models/vehicles/lagos_danfo_bus.glb", fit: { s: 2.9, cx: 0, cz: 0, minY: -0.45, rotY: 0 } },
  { id: "sports",  seat: { f: 0.2, y: 0.35, s: 0.3 }, name: "Sports Car",           emoji: "🏎️",   price: 500000, speed: 7.0, desc: "Flashy + fast. The ultimate flex." },
  { id: "ferrari", seat: { f: 0.2, y: 0.3, s: 0.35 }, name: "Ferrari",              emoji: "🏎️",   price: 2000000,speed: 8.5, desc: "Italian Stallion. The peak of Kaduna flex.",
    glbPath: "/models/vehicles/ferrari.glb", fit: { s: 1.0, cx: 0, cz: 0.02, minY: 0, rotY: -Math.PI / 2 } },
  { id: "luxury",  seat: { f: 0.3, y: 0.5, s: 0.4 }, name: "Luxury Sedan",         emoji: "🚘",   price: 1000000,speed: 6.5, desc: "VIP ride. Big oga energy." },
];

// Where the driver sits (metres from the middle): f = forward (+X local), y = height of the seat above the ground,
// s = towards the driver's side (left, -Z local). The character is positioned at (s, y, f) in avatar-group space
// (the same -PI/2 rotation that aligns the vehicle's nose to +Z group maps vehicle-local (f, y, -s) → group (s, y, f)).
// Closed vehicles (bus, jeep, ferrari) define a seat so the driver shows INSIDE the cabin, visible through the windows.
// Open vehicles (okada, keke, bicycle) define a seat so the driver sits on top.
// Vehicles with NO seat (sedan, hatch, suv, sports, luxury) keep the driver hidden — no clean place to put them.
export const DEFAULT_SEAT = { f: 0.3, y: 0.4, s: 0.4 };
export function getSeat(id) { const v = getVehicle(id); return (v && v.seat) || null; }
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

// ---- GLB model loading (lazy + cached) ----
// GLB models are loaded via GLTFLoader on first ride, then cached.
// The GLTFLoader is dynamically imported so it doesn't bloat the main bundle.
let _glbCache = new Map();   // vehicleId → THREE.Group (the loaded model, cloned per spawn)
let _glbLoader = null;

async function _getGlbLoader() {
  if (_glbLoader) return _glbLoader;
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  // The vehicle models are meshopt-compressed (~65% smaller download), so the loader needs the decoder.
  const { MeshoptDecoder } = await import("three/examples/jsm/libs/meshopt_decoder.module.js");
  _glbLoader = new GLTFLoader();
  _glbLoader.setMeshoptDecoder(MeshoptDecoder);
  return _glbLoader;
}

async function _loadGlbModel(vehicleId, vehicle) {
  if (_glbCache.has(vehicleId)) return _glbCache.get(vehicleId);
  const loader = await _getGlbLoader();
  return new Promise((resolve) => {
    loader.load(
      vehicle.glbPath,
      (gltf) => {
        const model = gltf.scene;
        // Perf: disable shadows on the model (only player character casts)
        model.traverse((o) => {
          if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; }
        });
        _glbCache.set(vehicleId, model);
        console.log("[vehicles] GLB loaded:", vehicle.glbPath);
        resolve(model);
      },
      undefined,
      (err) => {
        console.warn("[vehicles] GLB load failed:", vehicle.glbPath, err.message);
        resolve(null);  // fall back to simplified mesh
      }
    );
  });
}

// Stand a loaded model inside a pivot group: centred on the pivot, wheels on the ground, front pointing +X.
export function fitModel(model, fit) {
  const f = Object.assign({ s: 1, cx: 0, cz: 0, minY: 0, rotY: 0 }, fit || {});
  const holder = new THREE.Group();
  model.scale.setScalar(f.s);
  model.rotation.set(0, f.rotY, 0);
  const c = Math.cos(f.rotY), sn = Math.sin(f.rotY);
  const rx = f.cx * c + f.cz * sn, rz = -f.cx * sn + f.cz * c;     // the model's centre after it is turned
  model.position.set(-rx * f.s, -f.minY * f.s, -rz * f.s);
  if (f.hide) model.traverse((o) => { if (f.hide.includes(o.name)) o.visible = false; });
  holder.add(model);
  return holder;
}
// Where the pivot must point: the car's front (+X) goes along the player's forward (sin h, cos h) — the same
// "forward" the walking code and the driving code use.
export const pivotRotY = (heading) => heading - Math.PI / 2;

// ---- Spawn a ride vehicle at the player's position ----
export async function spawnRideVehicle(vehicleId, playerPos, playerHeading, toastFn) {
  if (_riding) despawnRideVehicle();
  const v = getVehicle(vehicleId);
  if (!v) return false;

  let mesh = null, own = null;

  // Try GLB model first (if the vehicle has one)
  if (v.glbPath) {
    if (toastFn) toastFn("Loading " + v.name + " model...");
    const glbModel = await _loadGlbModel(vehicleId, v);
    if (glbModel) mesh = fitModel(glbModel.clone(true), v.fit);
  }

  // Fall back to simplified box-geometry mesh if no GLB or GLB failed
  if (!mesh) {
    const types = await _getTrafficTypes();
    // Map new vehicle IDs to existing simplified builders as fallback
    const fallbackType = vehicleId === "ferrari" ? "sports" : vehicleId === "jeep" ? "suv" : vehicleId;
    const builder = types[fallbackType];
    if (!builder) {
      console.warn("[vehicles] no builder for", vehicleId, "(fallback:", fallbackType, ")");
      return false;
    }
    const parts = builder();
    const merged = mergeGeometries(parts, true);
    parts.forEach(g => g.dispose());
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const body = new THREE.Mesh(merged, mat);
    body.castShadow = false;
    body.frustumCulled = false;
    mesh = new THREE.Group();
    mesh.add(body);                       // built-in cars are modelled front = +X, centred, wheels on the ground
    own = [merged, mat];
  }

  mesh.position.set(playerPos.x, 0, playerPos.z);
  mesh.rotation.y = pivotRotY(playerHeading);
  _scene.add(mesh);
  _riding = { vehicleId, speed: v.speed, mesh, own };
  console.log("[vehicles] Riding " + v.name + " (speed boost +" + v.speed + ")");
  return true;
}

// ---- Despawn the ride vehicle ----
export function despawnRideVehicle() {
  if (!_riding) return;
  _scene.remove(_riding.mesh);
  // only free what we built ourselves: GLB geometry is shared with the cache and the next ride
  if (_riding.own) _riding.own.forEach((o) => o.dispose());
  _riding = null;
}

// ---- Update the ride vehicle position (called from main.js every frame) ----
export function tickRideVehicle(playerPos, playerHeading) {
  if (!_riding) return;
  _riding.mesh.position.set(playerPos.x, 0, playerPos.z);
  _riding.mesh.rotation.y = pivotRotY(playerHeading);
}

// ---- Build a vehicle mesh for a REMOTE player (Oct 19) ----
// Used by multiplayer.js when a remote player is riding — we want to show
// the ACTUAL VEHICLE 3D model at their position (with their name tag
// above), NOT a walking avatar with an emoji badge.
//
// Returns: Promise<THREE.Object3D|null> — the vehicle mesh (GLB if
// available, otherwise the simplified box-geometry builder). Caller is
// responsible for adding to scene + positioning + disposing.
export async function buildRemoteVehicleMesh(vehicleId) {
  const v = getVehicle(vehicleId);
  if (!v) return null;
  let mesh = null;
  // Try GLB first
  if (v.glbPath) {
    try {
      const glbModel = await _loadGlbModel(vehicleId, v);
      if (glbModel) {
        mesh = fitModel(glbModel.clone(true), v.fit);      // same stand-up + facing as the one you ride (nose = +X)
        mesh.userData.shared = true;                       // geometry belongs to the cache: never dispose it
      }
    } catch (e) { console.warn("[vehicles] remote GLB failed:", e.message); }
  }
  // Fall back to box-geometry builder
  if (!mesh) {
    try {
      const types = await _getTrafficTypes();
      const fallbackType = vehicleId === "ferrari" ? "sports" : vehicleId === "jeep" ? "suv" : vehicleId;
      const builder = types[fallbackType] || types["sedan"];
      if (builder) {
        const parts = builder();
        const merged = mergeGeometries(parts, true);
        parts.forEach(g => g.dispose());
        const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
        const body = new THREE.Mesh(merged, mat);
        body.castShadow = false;
        body.frustumCulled = false;
        mesh = new THREE.Group(); mesh.add(body);
      }
    } catch (e) { console.warn("[vehicles] remote box-geometry failed:", e.message); }
  }
  return mesh;
}

// A fitted, ready-to-use copy of a vehicle's 3D model (wheels on the ground, nose = +X). Used for traffic too.
export async function loadFittedModel(vehicleId) {
  const veh = getVehicle(vehicleId);
  if (!veh || !veh.glbPath) return null;
  const glb = await _loadGlbModel(vehicleId, veh);
  return glb ? fitModel(glb.clone(true), veh.fit) : null;
}
