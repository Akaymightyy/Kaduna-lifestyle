// src/billboards.js — Ad signboards/billboards in the 3D world + minimap.
//
// Billboards are placed at strategic positions along main roads + avenues.
// Each shows "YOUR AD HERE" by default. Players can buy ad space
// (₦X for 7 days) → the screen texture updates to show their ad image
// (loaded from Cloudinary URL). Ads expire automatically.
//
// Firebase data shape:
//   billboards/{billboardId} = { ownerId, ownerName, imageUrl, text, expiresAt, price }

import * as THREE from "three";
import { db } from "./firebase.js";
import { ref, get, set, update, onValue } from "firebase/database";
import { AREAS } from "./areas.js";

// ---- Billboard positions (along main road + avenues + cross streets) ----
const _MAIN_POSITIONS = [
  { id: "bb1", x: -40, z: 14, rot: 0, name: "AB Road West" },
  { id: "bb2", x: 40, z: -14, rot: Math.PI, name: "AB Road East" },
  { id: "bb3", x: -100, z: 14, rot: 0, name: "Buhari Way" },
  { id: "bb4", x: 100, z: -14, rot: Math.PI, name: "Independence Way" },
  { id: "bb5", x: 0, z: 14, rot: 0, name: "Central AB" },
  { id: "bb6", x: -130, z: -14, rot: Math.PI, name: "Tudun Wada Rd" },
  { id: "bb7", x: 130, z: 14, rot: 0, name: "Sabon Gari Rd" },
  { id: "bb8", x: -60, z: -14, rot: Math.PI, name: "Waff Road" },
  { id: "bb9", x: 60, z: 14, rot: 0, name: "Kawo Junction" },
  { id: "bb10", x: -160, z: 14, rot: 0, name: "City Edge West" },
];

// 10 billboards in EVERY district, along the district's own road (5 each side, facing the road)
function _districtBillboards() {
  const out = [];
  for (const a of AREAS) {
    for (let i = 0; i < 10; i++) {
      const north = i % 2 === 0;
      out.push({
        id: a.id + "_bb" + (i + 1),
        x: Math.round(a.x - 45 + i * 10),
        z: a.z + (north ? -5.4 : 5.4),
        rot: north ? 0 : Math.PI,
        name: a.name + " Billboard " + (i + 1),
      });
    }
  }
  return out;
}
export const BILLBOARD_POSITIONS = _MAIN_POSITIONS.concat(_districtBillboards());

const AD_PRICE = 50000;  // ₦50,000 per 7 days
const AD_DURATION_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days in ms

// ---- State ----
let _scene = null;
let _billboards = [];  // [{ def, group, screenMesh, screenTexture, screenCanvas, screenCtx, adData }]
let _subscriptions = {};

let _sharedScreenGeo = null, _sharedDefaultMat = null;
function _defaultMat() {
  if (_sharedDefaultMat) return _sharedDefaultMat;
  const c = document.createElement("canvas"); c.width = 512; c.height = 320;
  _drawDefaultAd(c.getContext("2d"), { name: "Kaduna" });
  _sharedDefaultMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide });
  return _sharedDefaultMat;
}
// own canvas texture, only for boards that show a real ad
function _ownScreen(bb) {
  if (bb.screenCtx) return;
  const c = document.createElement("canvas"); c.width = 512; c.height = 320;
  bb.screenCanvas = c; bb.screenCtx = c.getContext("2d");
  bb.screenTexture = new THREE.CanvasTexture(c);
  bb.screenMesh.material = new THREE.MeshBasicMaterial({ map: bb.screenTexture, side: THREE.DoubleSide });
}

// ---- Build a single billboard mesh (pole + screen) ----
function _buildBillboard(def) {
  const group = new THREE.Group();
  group.name = "billboard_" + def.id;

  // Pole (dark grey cylinder)
  const poleGeo = new THREE.CylinderGeometry(0.15, 0.2, 5, 8);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = 2.5;
  pole.castShadow = false;
  group.add(pole);

  // Screen frame (dark border around the screen)
  const frameGeo = new THREE.BoxGeometry(4.5, 2.8, 0.15);
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.position.set(0, 5.5, 0);
  frame.castShadow = false;
  group.add(frame);

  // Screen: shares one "YOUR AD HERE" texture until an ad is bought (keeps 150+ boards cheap)
  const screenGeo = _sharedScreenGeo || (_sharedScreenGeo = new THREE.PlaneGeometry(4.2, 2.5));
  const screenMesh = new THREE.Mesh(screenGeo, _defaultMat());
  screenMesh.position.set(0, 5.5, 0.08);
  screenMesh.userData = { isBillboard: true, billboardId: def.id };
  group.add(screenMesh);

  // Position the whole billboard
  group.position.set(def.x, 0, def.z);
  group.rotation.y = def.rot;

  return { group, screenMesh, screenTexture: null, screenCanvas: null, screenCtx: null };
}

// ---- Draw the default "YOUR AD HERE" screen ----
function _drawDefaultAd(ctx, def) {
  // Gradient background
  const grad = ctx.createLinearGradient(0, 0, 512, 320);
  grad.addColorStop(0, "#1a1a4e");
  grad.addColorStop(0.5, "#4a1a8e");
  grad.addColorStop(1, "#2a1a5e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 320);

  // "MEGA SCREEN" label at top
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(0, 0, 512, 30);
  ctx.fillStyle = "#f2b134";
  ctx.font = "bold 14px Poppins, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("📢 MEGA SCREEN · " + def.name, 256, 15);

  // Main text
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 52px Poppins, Arial, sans-serif";
  ctx.fillText("YOUR AD HERE", 256, 130);

  // Price
  ctx.fillStyle = "#4ade80";
  ctx.font = "bold 28px Poppins, Arial, sans-serif";
  ctx.fillText("₦" + AD_PRICE.toLocaleString() + " / 7 days", 256, 180);

  // Footer
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "12px Poppins, Arial, sans-serif";
  ctx.fillText("Tap the billboard to advertise · kaduna-lifestyle.vercel.app", 256, 250);
}

// ---- Draw an active ad (with image if available) ----
function _drawActiveAd(ctx, def, adData, done) {
  if (adData.imageUrl) {
    // Load the image + draw it on the canvas
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Draw the image filling the screen
      ctx.drawImage(img, 0, 0, 512, 320);
      // Overlay: advertiser name at bottom
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(0, 280, 512, 40);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px Poppins, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("📢 " + (adData.ownerName || "Sponsored") + " · " + def.name, 256, 300);
      done && done();
    };
    img.onerror = () => { _drawDefaultAd(ctx, def); done && done(); };  // fallback if image fails
    img.src = adData.imageUrl;
  } else {
    // Text-only ad
    ctx.fillStyle = adData.bgColor || "#1a4a2e";
    ctx.fillRect(0, 0, 512, 320);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(0, 0, 512, 30);
    ctx.fillStyle = "#f2b134";
    ctx.font = "bold 14px Poppins, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("📢 " + def.name, 256, 15);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 36px Poppins, Arial, sans-serif";
    // Wrap text
    const words = (adData.text || "Your message here").split(" ");
    let line = "", y = 100;
    for (const w of words) {
      const test = line + w + " ";
      if (ctx.measureText(test).width > 460) { ctx.fillText(line, 256, y); line = w + " "; y += 40; }
      else line = test;
    }
    if (line) ctx.fillText(line, 256, y);
    // Advertiser
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "14px Poppins, Arial, sans-serif";
    ctx.fillText("Sponsored by " + (adData.ownerName || "Player"), 256, 280);
  }
}

// ---- Init: build billboard meshes + subscribe to Firebase ----
export function initBillboards(scene) {
  _scene = scene;
  const byId = {};
  for (const def of BILLBOARD_POSITIONS) {
    const bb = _buildBillboard(def);
    bb.def = def; bb.adData = null;
    _scene.add(bb.group);
    _billboards.push(bb);
    byId[def.id] = bb;
  }
  // ONE listener for every billboard
  _subscriptions.all = onValue(ref(db, "billboards"), (snap) => {
    const all = snap.val() || {};
    for (const id in byId) {
      const bb = byId[id], data = all[id] || null;
      bb.adData = data;
      const live = data && data.expiresAt > Date.now();
      if (live) { _ownScreen(bb); _drawActiveAd(bb.screenCtx, bb.def, data, () => { bb.screenTexture.needsUpdate = true; }); bb.screenTexture.needsUpdate = true; }
      else if (bb.screenCtx) { bb.screenMesh.material = _defaultMat(); }
    }
  }, () => {});
  console.log("[billboards] Built " + _billboards.length + " billboards");
}

// ---- Get all billboard meshes (for tap-raycaster) ----
export function getBillboards() { return _billboards; }

// ---- Get billboard positions (for minimap markers) ----
export function getBillboardPositions() {
  return BILLBOARD_POSITIONS.map(b => ({ ...b, icon: "📢" }));
}

// ---- Buy ad space on a billboard ----
export async function buyBillboardAd(billboardId, uid, name, imageUrl, text, gameState, toastFn) {
  if (!uid) { toastFn?.("Sign in first"); return false; }
  if ((gameState.money || 0) < AD_PRICE) { toastFn?.("Need ₦" + AD_PRICE.toLocaleString()); return false; }
  try {
    const expiresAt = Date.now() + AD_DURATION_MS;
    await set(ref(db, "billboards/" + billboardId), {
      ownerId: uid,
      ownerName: name,
      imageUrl: imageUrl || "",
      text: text || "",
      expiresAt,
      price: AD_PRICE,
      createdAt: Date.now(),
    });
    gameState.money -= AD_PRICE;
    toastFn?.("📢 Ad placed on " + (BILLBOARD_POSITIONS.find(b => b.id === billboardId)?.name || "billboard") + "! Runs for 7 days.");
    return true;
  } catch (e) {
    console.warn("[billboards] buy failed:", e.message);
    toastFn?.("Ad buy failed — try again");
    return false;
  }
}

// ---- Get billboard ad info (for tap prompt) ----
export function getBillboardAdInfo(billboardId) {
  const bb = _billboards.find(b => b.def.id === billboardId);
  if (!bb) return null;
  return {
    id: bb.def.id,
    name: bb.def.name,
    price: AD_PRICE,
    adData: bb.adData,
    isAvailable: !bb.adData || bb.adData.expiresAt <= Date.now(),
  };
}

// ---- Dispose ----
export function disposeBillboards() {
  for (const bb of _billboards) {
    _scene?.remove(bb.group);
    bb.screenTexture?.dispose();
    bb.screenMesh.geometry?.dispose();
    bb.screenMesh.material?.dispose();
  }
  for (const id in _subscriptions) { try { _subscriptions[id](); } catch (e) {} }
  _billboards = [];
  _subscriptions = {};
}
