// src/places/home.js — Player home interior with tier-dependent rooms + furniture placement.
//
// IMPORTANT: The home is rebuilt EVERY time the player enters (not cached). This is
// because (a) different players have different furniture, and (b) different origin
// tiers get completely different room sizes and wall colours. Caching would show
// player A's furniture when player B enters on the same browser.
//
// Tier mapping (from origins.js HOUSE_TIERS):
//   1 = Face-Me-I-Face-You Room   (Dan Talaka / Lapo start) — 6x5m, shared look
//   2 = 1-Bedroom Flat             (Dan Attajiri / Nepo start) — 12x10m, nicer
//   3 = 3-Bedroom Bungalow         — 16x12m
//   4 = Duplex                     — 18x14m
//   5 = Mansion                    — 22x16m
//   6 = Private Estate             — 28x20m

import * as THREE from "three";
import { box, mergedMesh, floor, interiorLights, disposeGroup } from "./_helpers.js";
import { dressRoom } from "../art/dress.js";
import { getItem, makeFurnitureMesh, calcComfort } from "../furniture.js";
import { getMyUid } from "../multiplayer.js";
// FIX: Use static imports instead of dynamic imports — dynamic import chains in
// _saveFurniture were fire-and-forget with no error handling, causing silent save failures.
import { ref, get, set } from "firebase/database";
import { db } from "../firebase.js";
// FEATURE: per-account house record — furniture now lives at
// houses/{areaId}/{plotNo}/furniture so visitors can read it (visitors can't
// read players/{otherUid}). Migration from the old path is handled automatically.
import {
  resolvePlayerHouseKey,
  loadHouseFurniture,
  saveHouseFurniture,
  returnToStorage as houseReturnToStorage,
  migrateFurnitureIfNeeded,
  loadHouse,
} from "../houses.js";
import { homeLayout } from "./home_layout.js";

// Tier -> room dimensions + wall color + floor color + description
const TIER_CONFIG = {
  1: { w: 6,  d: 5,  wallCol: 0xd4c5a0, floorCol: 0x8a7a5a, name: "Face-Me-I-Face-You Room", desc: "Small room in a shared compound. Window faces the corridor." },
  2: { w: 12, d: 10, wallCol: 0xf4f1ea, floorCol: 0x9a7b4a, name: "1-Bedroom Flat",         desc: "Self-contained flat with kitchen and bathroom." },
  3: { w: 16, d: 12, wallCol: 0xe8e0d0, floorCol: 0xa08350, name: "3-Bedroom Bungalow",     desc: "Spacious bungalow with compound." },
  4: { w: 18, d: 14, wallCol: 0xf0e8d8, floorCol: 0xb09060, name: "Duplex",                 desc: "Two-storey duplex with car park." },
  5: { w: 22, d: 16, wallCol: 0xf8f0e0, floorCol: 0xc0a070, name: "Mansion",                desc: "Luxury mansion with everything." },
  6: { w: 28, d: 20, wallCol: 0xfff8e8, floorCol: 0xd0b080, name: "Private Estate",         desc: "Your own private estate — ultimate flex." },
};

export async function build(scene, ctx) {
  // ---- Determine the player's current home tier ----
  // game.state.homeTier is set by the origin selection (attajiri=2, talaka=1)
  // and can be upgraded via the Real Estate app.
  // The size comes from THAT house's record (you can own many houses of different sizes).
  let tier = (ctx.game?.state?.homeTier) || 1;
  try {
    const _k = ctx.visitingHouse ? ctx.visitingHouse : (window.__homeDoorHouse || null);
    const _aid = _k && (_k.areaId), _pno = _k && (_k.plotNo);
    if (_aid && _pno != null) { const rec = await loadHouse(_aid, _pno); if (rec && rec.tier) tier = rec.tier; }
  } catch (e) { /* keep fallback tier */ }
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG[1];
  const W = cfg.w, D = cfg.d;
  const HW = W / 2, HD = D / 2;

  const group = new THREE.Group();
  group.name = "player_home";
  group.visible = false;

  // ---- Build the room based on tier ----
  // Rooms come from the layout for this tier (tier 1 = one room, bigger budget = more rooms).
  const layout = homeLayout(tier, W, D);
  for (const f of layout.floors) {
    const fl = floor(f.w, f.d, f.color == null ? cfg.floorCol : f.color, f.kind === "bath" ? 1 : (tier <= 2 ? 1 : 2));
    fl.position.set(f.x, 0, f.z); group.add(fl);
  }
  if (layout.patio) { const pf = floor(layout.patio.w, layout.patio.d, 0x9ca3af, 9); pf.position.set(layout.patio.x, 0, layout.patio.z); group.add(pf); }

  const wallMat = cfg.wallCol;
  const windowMat = 0x4a6177;
  // Walls adapt to room size. Door gap on the front wall (south, +Z).
  const doorWidth = Math.min(2.4, W * 0.2);
  const doorSide = (W - doorWidth) / 2;
  group.add(mergedMesh([
    // Back wall (north, -Z)
    box(W, 4, 0.3, 0, 2, -HD, wallMat, 3),
    // Left wall (west, -X)
    box(0.3, 4, D, -HW, 2, 0, wallMat, 3),
    // Right wall (east, +X)
    box(0.3, 4, D, HW, 2, 0, wallMat, 3),
    // Front wall (south, +Z) — two segments with door gap
    box(doorSide, 4, 0.3, -(doorWidth / 2 + doorSide / 2), 2, HD, wallMat, 3),
    box(doorSide, 4, 0.3,  (doorWidth / 2 + doorSide / 2), 2, HD, wallMat, 3),
    // Windows (only for tier 2+ — tier 1 rooms have small vent windows)
    ...(tier >= 2 ? [
      box(Math.max(2, W * 0.15), 1.5, 0.05, -W * 0.25, 2.5, -HD + 0.05, windowMat),
      box(Math.max(2, W * 0.15), 1.5, 0.05,  W * 0.25, 2.5, -HD + 0.05, windowMat),
    ] : [
      // Tier 1: small vent window high on the back wall
      box(1.2, 0.6, 0.05, 0, 3.4, -HD + 0.05, windowMat),
    ]),
    // partition walls (waist-high so the camera can still see into every room) + a darker cap strip
    ...layout.walls.flatMap((w) => {
      const horiz = Math.abs(w.z1 - w.z0) < 0.001, len = horiz ? Math.abs(w.x1 - w.x0) : Math.abs(w.z1 - w.z0);
      const cx = (w.x0 + w.x1) / 2, cz = (w.z0 + w.z1) / 2;
      return horiz
        ? [box(len, 1.5, 0.18, cx, 0.75, cz, wallMat, 3), box(len, 0.08, 0.24, cx, 1.54, cz, 0x6b5a45)]
        : [box(0.18, 1.5, len, cx, 0.75, cz, wallMat, 3), box(0.24, 0.08, len, cx, 1.54, cz, 0x6b5a45)];
    }),
  ]));

  // ---- Stylised dressing: trims, windows, curtains, pictures, props (never blocks the room) ----
  try { dressRoom(group, { W, D, tier, wallCol: cfg.wallCol, seed: tier * 7 + 3 }); } catch (e) { console.warn("[art] dressRoom failed", e); }

  // ---- Lighting: tier 1 is dimmer (single bulb), tier 2+ has multiple lights ----
  if (tier === 1) {
    group.add(interiorLights({ ambient: 0.6, points: [
      { x: 0, y: 3.5, z: 0, color: 0xffe8c0, intensity: 0.5, distance: 8 },
    ] }));
  } else {
    group.add(interiorLights({ ambient: 0.85, points: layout.lights.map((l, i) => ({ x: l.x, y: 3.6, z: l.z, color: 0xfff0e0, intensity: i === 0 ? 0.7 : 0.45, distance: Math.max(10, Math.min(18, W * 0.6)) })) }));
  }

  // ---- Load furniture ----
  // FEATURE: If ctx.visitingHouse is set (visitor mode), load the visited
  // house's furniture from houses/{areaId}/{plotNo}/furniture (readable by
  // anyone per Firebase rules). Otherwise load the local player's own house
  // (using their homeArea/homePlot resolved from Firebase).
  //
  // Visitor mode disables furniture editing — visitors can look but not touch.
  const _isVisitor = !!ctx.visitingHouse;
  let _houseAreaId = null, _housePlotNo = null, _ownerUidForStorage = null;
  let _visitorName = "";
  if (_isVisitor) {
    _houseAreaId = ctx.visitingHouse.areaId;
    _housePlotNo = ctx.visitingHouse.plotNo;
    _ownerUidForStorage = ctx.visitingHouse.ownerUid;
    _visitorName = ctx.visitingHouse.ownerName || "Friend";
  }
  let _placedFurniture = [];
  let _furnitureGroup = new THREE.Group();
  group.add(_furnitureGroup);

  if (_isVisitor) {
    // Visitor: load furniture from the visited house record
    try {
      _placedFurniture = await loadHouseFurniture(_houseAreaId, _housePlotNo);
      console.log("[home] Visitor loaded " + _placedFurniture.length + " items from " + _visitorName + "'s house (" + _houseAreaId + "/" + _housePlotNo + ")");
      _rebuildFurniture();
      const comfort = calcComfort(_placedFurniture);
      ctx.toast("🏠 " + _visitorName + "'s Home · Comfort: " + comfort);
    } catch (e) {
      console.error("[home] Visitor furniture load failed:", e.message);
      ctx.toast("⚠️ Could not load " + _visitorName + "'s furniture");
    }
  } else {
    // Owner: load from own house record (with migration from old per-player path)
    const uid = getMyUid();
    const _door = window.__homeDoorHouse;                                 // the house whose door you walked through
    const houseKey = (_door && _door.areaId && _door.plotNo != null) ? { areaId: _door.areaId, plotNo: _door.plotNo, uid } : await resolvePlayerHouseKey(uid);
    if (houseKey) {
      _houseAreaId = houseKey.areaId;
      _housePlotNo = houseKey.plotNo;
      _ownerUidForStorage = uid;
      await migrateFurnitureIfNeeded(uid, _houseAreaId, _housePlotNo);
    }
    if (uid && _houseAreaId && _housePlotNo != null) {
      try {
        _placedFurniture = await loadHouseFurniture(_houseAreaId, _housePlotNo);
        console.log("[home] Loaded " + _placedFurniture.length + " furniture items from houses/" + _houseAreaId + "/" + _housePlotNo);
        _rebuildFurniture();
        if (_placedFurniture.length > 0) {
          const comfort = calcComfort(_placedFurniture);
          ctx.toast("🏠 " + cfg.name + " · Comfort: " + comfort);
        } else {
          ctx.toast("🏠 " + cfg.name + " — " + cfg.desc);
        }
      } catch (e) {
        console.error("[home] Could not load furniture:", e.message);
        ctx.toast("⚠️ Could not load furniture: " + e.message);
      }
    } else if (uid) {
      // Fallback to the old per-player path (no plot claimed yet)
      try {
        const snap = await get(ref(db, "players/" + uid + "/homeFurniture"));
        const val = snap.val();
        if (Array.isArray(val)) _placedFurniture = val;
        else if (val && typeof val === "object") _placedFurniture = Object.values(val);
        else _placedFurniture = [];
        console.warn("[home] No house plot claimed — falling back to players/{uid}/homeFurniture (" + _placedFurniture.length + " items).");
        _rebuildFurniture();
        ctx.toast("🏠 " + cfg.name + " — pick an area to save furniture properly");
      } catch (e) {
        console.error("[home] Fallback load failed:", e.message);
        ctx.toast("🏠 " + cfg.name + " — pick an area to start furnishing");
      }
    } else {
      console.warn("[home] getMyUid() returned null — furniture will not load");
      ctx.toast("🏠 " + cfg.name);
    }
  }

  function _rebuildFurniture() {
    while (_furnitureGroup.children.length) {
      const child = _furnitureGroup.children[0];
      _furnitureGroup.remove(child);
      child.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !(o.material.userData && o.material.userData.shared)) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
    }
    for (const p of _placedFurniture) {
      const item = getItem(p.id);
      if (!item) continue;
      const mesh = makeFurnitureMesh(item, p.color);
      mesh.position.set(p.x || 0, 0, p.z || 0);
      mesh.rotation.y = p.rot || 0;
      mesh.userData.placedIdx = _placedFurniture.indexOf(p);
      mesh.userData.isFurniture = true;
      // FEATURE: visitors can't edit furniture — disable the click handler entirely
      // (the furniture is read-only for them; they just see the owner's setup).
      if (!_isVisitor) {
        mesh.userData.onClick = () => _selectFurniture(mesh.userData.placedIdx);
      }
      _furnitureGroup.add(mesh);
    }
  }

  // ---- Decorate mode: place / move furniture ----
  let _decorateMode = false;
  let _pendingItem = null;     // item being placed (from storage)
  let _selectedIdx = -1;       // currently selected placed item (for move/rotate/remove)
  let _ghostMesh = null;       // preview mesh while placing
  let _placeMarker = null;     // ground marker showing where item will go

  // Colliders adapt to room size
  const colliders = [
    { minX: -HW - 0.2, maxX: -HW + 0.2, minZ: -HD, maxZ: HD },  // left wall
    { minX:  HW - 0.2, maxX:  HW + 0.2, minZ: -HD, maxZ: HD },  // right wall
    { minX: -HW, maxX: HW, minZ: -HD - 0.2, maxZ: -HD + 0.2 },  // back wall
    { minX: -HW, maxX: -doorSide - doorWidth/2, minZ: HD - 0.2, maxZ: HD + 0.2 }, // front-left
    { minX:  doorSide + doorWidth/2, maxX: HW, minZ: HD - 0.2, maxZ: HD + 0.2 },  // front-right
    ...layout.colliders,
  ];

  scene.add(group);

  // ---- Raycaster for tap-to-place ----
  const _raycaster = new THREE.Raycaster();
  const _pointer = new THREE.Vector2();
  let _floorMesh = group.children.find(c => c.isMesh && c.geometry?.attributes?.position);

  function _onCanvasTap(e) {
    if (!_decorateMode) return;
    // Cast a ray from the tap point to find where on the floor to place the item
    const rect = e.target.getBoundingClientRect();
    _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    _raycaster.setFromCamera(_pointer, ctx.camera);
    const hits = _raycaster.intersectObject(group, true);
    if (hits.length === 0) return;
    const hit = hits[0];
    // Clamp to room bounds (with a small margin so items don't clip into walls)
    const margin = 0.5;
    const x = Math.max(-HW + margin, Math.min(HW - margin, hit.point.x));
    const z = Math.max(-HD + margin, Math.min(HD - margin, hit.point.z));
    if (_pendingItem) {
      _pendingItem.x = x;
      _pendingItem.z = z;
      _updateGhost(x, z);
    }
  }

  function _updateGhost(x, z) {
    if (!_ghostMesh) return;
    _ghostMesh.position.set(x, 0, z);
    _ghostMesh.rotation.y = _pendingItem?.rot || 0;
    if (_placeMarker) {
      _placeMarker.position.set(x, 0.01, z);
    }
  }

  function _selectFurniture(idx) {
    if (idx < 0 || idx >= _placedFurniture.length) return;
    _selectedIdx = idx;
    _showFurnitureControls(idx);
  }

  function _showFurnitureControls(idx) {
    const item = _placedFurniture[idx];
    const it = getItem(item.id);
    if (!it) return;
    // Show a small control bar with Rotate / Move / Remove buttons
    let bar = document.getElementById("furniture-controls");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "furniture-controls";
      bar.style.cssText =
        "position:fixed;left:50%;bottom:calc(140px + env(safe-area-inset-bottom));" +
        "transform:translateX(-50%);background:rgba(11,11,12,.95);color:#fff;" +
        "padding:8px;gap:6px;border-radius:12px;display:flex;z-index:35;" +
        "border:1px solid #f2b134;max-width:90vw;flex-wrap:wrap;justify-content:center;";
      document.body.appendChild(bar);
    }
    bar.innerHTML =
      '<span style="font-size:11px;font-weight:600;color:#f2b134;padding:4px 8px;">' + (it.emoji || '🛋') + ' ' + it.name + '</span>' +
      '<button onclick="window._furnitureAction(\'rotate\')" style="background:#f2b134;color:#000;border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font:600 11px Poppins,sans-serif;">↻ Rotate</button>' +
      '<button onclick="window._furnitureAction(\'move\')" style="background:#60a5fa;color:#fff;border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font:600 11px Poppins,sans-serif;">✥ Move</button>' +
      '<button onclick="window._furnitureAction(\'remove\')" style="background:#e11d48;color:#fff;border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font:600 11px Poppins,sans-serif;">✕ Remove</button>' +
      '<button onclick="window._furnitureAction(\'done\')" style="background:#4ade80;color:#000;border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font:600 11px Poppins,sans-serif;">✓ Done</button>';
    bar.style.display = "flex";
  }

  function _hideFurnitureControls() {
    const bar = document.getElementById("furniture-controls");
    if (bar) bar.style.display = "none";
  }

  // ---- Global furniture actions (called from control bar buttons) ----
  window._furnitureAction = (action) => {
    if (_selectedIdx < 0) return;
    const item = _placedFurniture[_selectedIdx];
    if (!item) return;
    if (action === "rotate") {
      item.rot = (item.rot || 0) + Math.PI / 2;
      _rebuildFurniture();
      _saveFurniture();
      ctx.toast("↻ Rotated");
    } else if (action === "move") {
      // Enter move mode: pick up the item and place it again
      _pendingItem = { ...item };
      _placedFurniture.splice(_selectedIdx, 1);
      _rebuildFurniture();
      _startPlaceMode(ctx, _pendingItem);
      _hideFurnitureControls();
    } else if (action === "remove") {
      // Return to storage
      _placedFurniture.splice(_selectedIdx, 1);
      _rebuildFurniture();
      _saveFurniture();
      _returnToStorage(item.id, item.color);
      ctx.toast("📦 " + (getItem(item.id)?.name || "Item") + " returned to storage");
      _hideFurnitureControls();
      _selectedIdx = -1;
    } else if (action === "done") {
      _selectedIdx = -1;
      _hideFurnitureControls();
    }
  };

  // FEATURE: Return an item to the OWNER's storage (called from the remove action).
  // Storage stays per-player (it's the player's inventory, not the house's).
  async function _returnToStorage(itemId, color) {
    const uid = getMyUid();
    if (!uid) return;
    try {
      const snap = await get(ref(db, "players/" + uid + "/storage"));
      const storage = snap.val() || [];
      const cleaned = Array.isArray(storage) ? storage : Object.values(storage);
      cleaned.push({ id: itemId, color: color || getItem(itemId)?.colors?.[0] });
      await set(ref(db, "players/" + uid + "/storage"), cleaned);
      console.log("[home] Returned " + itemId + " to storage");
    } catch (e) { console.error("[home] _returnToStorage failed:", e.message); }
  }

  // FEATURE: Save the furniture array to the HOUSE RECORD (not players/{uid}).
  // Falls back to the old path if the player hasn't claimed a plot yet.
  async function _saveFurniture() {
    const uid = getMyUid();
    if (!uid) { console.error("[home] _saveFurniture: no uid — furniture NOT saved"); ctx.toast("⚠️ Could not save furniture (no user)"); return; }
    const cleanArray = _placedFurniture.map(f => ({ id: f.id, x: f.x || 0, z: f.z || 0, rot: f.rot || 0, color: f.color }));
    // Try the new house record path first
    if (_houseAreaId && _housePlotNo != null) {
      const ok = await saveHouseFurniture(_houseAreaId, _housePlotNo, cleanArray);
      if (ok) {
        console.log(`[home] Saved ${cleanArray.length} furniture items to houses/${_houseAreaId}/${_housePlotNo}`);
        return;
      }
      // Save failed — fall through to old path as a safety net
      console.warn("[home] saveHouseFurniture failed — trying old path as fallback");
    }
    // Fallback: old per-player path
    try {
      await set(ref(db, "players/" + uid + "/homeFurniture"), cleanArray);
      console.log("[home] Saved " + cleanArray.length + " furniture items (FALLBACK path)");
    } catch (e) {
      console.error("[home] _saveFurniture FAILED (both paths):", e.message);
      ctx.toast("⚠️ Could not save furniture: " + e.message);
    }
  }

  const handle = {
    group, colliders,
    enter(ps) { ps.pos.set(0, 0, HD - 1); ps.heading = Math.PI; },
    exit() { _decorateMode = false; _pendingItem = null; _hideFurnitureControls(); _hidePlaceUI(); },
    update() {},
    dispose() {
      scene.remove(group);
      disposeGroup(group);
      _hideFurnitureControls();
      _hidePlaceUI();
      // Remove canvas tap listener
      ctx.canvas?.removeEventListener?.("pointerdown", _onCanvasTap);
    },
    onUIEvent(eid, payload) {
      if (eid === "sleep") _doAction(ctx, "😴 Slept. Energy +40", "energy", 40);
      else if (eid === "eat_home") _doAction(ctx, "🍛 Ate from fridge. Hunger +30", "hunger", 30);
      else if (eid === "tv") _doAction(ctx, "📺 Watched TV. Fun +20", "fun", 20);
      else if (eid === "shower") _doAction(ctx, "🚿 Showered. Hygiene +30", "hygiene", 30);
      else if (eid === "toilet") _doAction(ctx, "🚽 Bladder relieved.", "bladder", 40);
      // FEATURE: furniture editing actions are blocked for visitors — they can
      // use the room (sleep/eat/tv) but can't move/remove/place furniture.
      else if (eid === "place_furniture") { if (_isVisitor) ctx.toast("🔒 Only " + _visitorName + " can rearrange their own furniture"); else _startPlaceMode(ctx, payload); }
      else if (eid === "rotate_furniture") { if (!_isVisitor && _pendingItem) { _pendingItem.rot = (_pendingItem.rot || 0) + Math.PI / 2; _updateGhost(_pendingItem?.x || 0, _pendingItem?.z || 0); } }
      else if (eid === "confirm_place") { if (!_isVisitor) _confirmPlace(ctx); }
      else if (eid === "cancel_place") _cancelPlace();
    },
    getComfort() { return calcComfort(_placedFurniture); },
    getPlaced() { return _placedFurniture; },
    isDecorating() { return _decorateMode; },
    isVisitor() { return _isVisitor; },
    getOwnerName() { return _visitorName; },
    getTier() { return tier; },
    getTierName() { return cfg.name; },
  };

  function _doAction(ctx, msg, need, amount) {
    if (!ctx.game) return;
    // Check if the required furniture is placed
    const needMap = { sleep: "bed", eat_home: "fridge", tv: "tv", shower: "shower", toilet: "toilet" };
    const reqId = needMap[need];
    if (reqId && !_placedFurniture.some(f => f.id.includes(reqId))) {
      ctx.toast("You need a " + (reqId === "tv" ? "TV" : reqId) + "! Buy one from HomeStore.");
      return;
    }
    ctx.game.state.needs[need] = Math.min(100, (ctx.game.state.needs[need] || 0) + amount);
    ctx.game.save?.(); ctx.updateHUD?.();
    ctx.toast(msg);
  }

  function _startPlaceMode(ctx, payload) {
    _decorateMode = true;
    _pendingItem = { ...payload, x: 0, z: 0, rot: payload.rot || 0 };
    // Create ghost preview mesh
    const item = getItem(payload.id);
    if (item) {
      _ghostMesh = makeFurnitureMesh(item, payload.color);
      _ghostMesh.traverse(o => {
        if (o.material) {
          o.material = o.material.clone();
          o.material.transparent = true;
          o.material.opacity = 0.5;
        }
      });
      group.add(_ghostMesh);
      // Ground marker
      const markerGeo = new THREE.RingGeometry(0.3, 0.5, 16);
      const markerMat = new THREE.MeshBasicMaterial({ color: 0xf2b134, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
      _placeMarker = new THREE.Mesh(markerGeo, markerMat);
      _placeMarker.rotation.x = -Math.PI / 2;
      group.add(_placeMarker);
    }
    _showPlaceUI(ctx);
    ctx.toast("📋 Tap in the room to place " + (getItem(payload.id)?.name || "item") + ". Then tap ✓ Confirm.");
    // Listen for taps on the canvas
    ctx.canvas?.addEventListener?.("pointerdown", _onCanvasTap);
  }

  function _showPlaceUI(ctx) {
    let bar = document.getElementById("place-ui");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "place-ui";
      bar.style.cssText =
        "position:fixed;left:50%;bottom:calc(140px + env(safe-area-inset-bottom));" +
        "transform:translateX(-50%);background:rgba(11,11,12,.95);color:#fff;" +
        "padding:8px;gap:6px;border-radius:12px;display:flex;z-index:35;" +
        "border:1px solid #f2b134;max-width:90vw;";
      document.body.appendChild(bar);
    }
    bar.innerHTML =
      '<button onclick="window.placeAction(\'rotate_furniture\')" style="background:#f2b134;color:#000;border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font:600 11px Poppins,sans-serif;">↻ Rotate</button>' +
      '<button onclick="window.placeAction(\'confirm_place\')" style="background:#4ade80;color:#000;border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font:600 11px Poppins,sans-serif;">✓ Confirm Place</button>' +
      '<button onclick="window.placeAction(\'cancel_place\')" style="background:#e11d48;color:#fff;border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font:600 11px Poppins,sans-serif;">✕ Cancel</button>';
    bar.style.display = "flex";
  }

  function _hidePlaceUI() {
    const bar = document.getElementById("place-ui");
    if (bar) bar.style.display = "none";
    if (_ghostMesh) { group.remove(_ghostMesh); _ghostMesh = null; }
    if (_placeMarker) { group.remove(_placeMarker); _placeMarker = null; }
    ctx.canvas?.removeEventListener?.("pointerdown", _onCanvasTap);
  }

  // FIX: Make _confirmPlace async so it can await _saveFurniture — was calling
  // _saveFurniture() without await, so the success toast showed before the save completed.
  async function _confirmPlace(ctx) {
    if (!_pendingItem) return;
    // Clamp position to room bounds
    const margin = 0.5;
    _pendingItem.x = Math.max(-HW + margin, Math.min(HW - margin, _pendingItem.x || 0));
    _pendingItem.z = Math.max(-HD + margin, Math.min(HD - margin, _pendingItem.z || 0));
    _placedFurniture.push({ ..._pendingItem });
    _rebuildFurniture();
    // FIX: Await the save before showing success toast
    await _saveFurniture();
    ctx.toast("✅ " + (getItem(_pendingItem.id)?.name || "Item") + " placed! Tap it to move/rotate/remove.");
    _pendingItem = null;
    _decorateMode = false;
    _hidePlaceUI();
  }

  function _cancelPlace() {
    _pendingItem = null;
    _decorateMode = false;
    _hidePlaceUI();
  }

  return handle;
}
