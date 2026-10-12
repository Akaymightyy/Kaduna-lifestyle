// src/places/home.js — Player home interior with furniture placement
import * as THREE from "three";
import { box, mergedMesh, floor, interiorLights, disposeGroup } from "./_helpers.js";
import { getItem, makeFurnitureMesh, calcComfort } from "../furniture.js";

let _built = false, _cache = null;

export async function build(scene, ctx) {
  if (_built) return _cache;
  const group = new THREE.Group();
  group.name = "player_home";
  group.visible = false;

  // Standard room: 16x12m, wooden floor, painted walls with windows
  group.add(floor(16, 12, 0x9a7b4a));
  // Walls
  const wallMat = 0xf4f1ea;
  group.add(mergedMesh([
    box(16, 4, 0.3, 0, 2, -6, wallMat),
    box(0.3, 4, 12, -8, 2, 0, wallMat),
    box(0.3, 4, 12, 8, 2, 0, wallMat),
    // Door gap on front wall (two segments)
    box(5, 4, 0.3, -5.5, 2, 6, wallMat),
    box(5, 4, 0.3, 5.5, 2, 6, wallMat),
    // Window frames (dark)
    box(3, 2, 0.05, -4, 2.5, -5.95, 0x4a6177),
    box(3, 2, 0.05, 4, 2.5, -5.95, 0x4a6177),
    box(0.05, 2, 3, -7.95, 2.5, -2, 0x4a6177),
    box(0.05, 2, 3, -7.95, 2.5, 2, 0x4a6177),
    box(0.05, 2, 3, 7.95, 2.5, -2, 0x4a6177),
    box(0.05, 2, 3, 7.95, 2.5, 2, 0x4a6177),
  ]));
  // Ceiling light
  group.add(interiorLights({ ambient: 0.85, points: [
    { x: 0, y: 3.8, z: 0, color: 0xfff0e0, intensity: 0.7, distance: 14 },
    { x: -4, y: 3.8, z: -2, color: 0xfff0e0, intensity: 0.5, distance: 8 },
    { x: 4, y: 3.8, z: 2, color: 0xfff0e0, intensity: 0.5, distance: 8 },
  ] }));

  // Furniture container
  let _furnitureGroup = new THREE.Group();
  group.add(_furnitureGroup);
  let _placedFurniture = [];

  // Load placed furniture from Firebase
  const uid = typeof getMyUid === "function" ? getMyUid() : null;
  if (uid) {
    try {
      const { ref, get } = await import("firebase/database");
      const { db } = await import("../firebase.js");
      const snap = await get(ref(db, "players/" + uid + "/homeFurniture"));
      _placedFurniture = snap.val() || [];
      _rebuildFurniture();
      if (_placedFurniture.length > 0) ctx.toast("🏠 Home comfort: " + calcComfort(_placedFurniture));
    } catch (e) { console.warn("Could not load furniture", e); }
  }

  function _rebuildFurniture() {
    while (_furnitureGroup.children.length) {
      const child = _furnitureGroup.children[0];
      _furnitureGroup.remove(child);
      child.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
    }
    for (const p of _placedFurniture) {
      const item = getItem(p.id);
      if (!item) continue;
      const mesh = makeFurnitureMesh(item, p.color);
      mesh.position.set(p.x || 0, 0, p.z || 0);
      mesh.rotation.y = p.rot || 0;
      mesh.userData.placedIdx = _placedFurniture.indexOf(p);
      _furnitureGroup.add(mesh);
    }
  }

  // Decorate mode: place furniture from storage
  let _decorateMode = false;
  let _pendingItem = null; // item being placed

  const colliders = [
    { minX: -8.2, maxX: -7.8, minZ: -6, maxZ: 6 },
    { minX: 7.8, maxX: 8.2, minZ: -6, maxZ: 6 },
    { minX: -8, maxX: 8, minZ: -6.2, maxZ: -5.8 },
    { minX: -8, maxX: -3, minZ: 5.8, maxZ: 6.2 },
    { minX: 3, maxX: 8, minZ: 5.8, maxZ: 6.2 },
  ];

  scene.add(group);

  const handle = {
    group, colliders,
    enter(ps) { ps.pos.set(0, 0, 4); ps.heading = Math.PI; },
    exit() { _decorateMode = false; _pendingItem = null; },
    update() {},
    dispose() { scene.remove(group); disposeGroup(group); _built = false; _cache = null; },
    onUIEvent(eid, payload) {
      if (eid === "sleep") _doAction(ctx, "😴 Slept. Energy +40", "energy", 40);
      else if (eid === "eat_home") _doAction(ctx, "🍛 Ate from fridge. Hunger +30", "hunger", 30);
      else if (eid === "tv") _doAction(ctx, "📺 Watched TV. Fun +20", "fun", 20);
      else if (eid === "shower") _doAction(ctx, "🚿 Showered. Hygiene +30", "hygiene", 30);
      else if (eid === "toilet") _doAction(ctx, "🚽 Bladder relieved.", "bladder", 40);
      else if (eid === "place_furniture") _startPlaceMode(ctx, payload);
      else if (eid === "rotate_furniture") _rotatePending();
      else if (eid === "confirm_place") _confirmPlace(ctx);
      else if (eid === "cancel_place") _cancelPlace();
    },
    getComfort() { return calcComfort(_placedFurniture); },
    getPlaced() { return _placedFurniture; },
    isDecorating() { return _decorateMode; },
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
    _pendingItem = payload;
    ctx.toast("📋 Tap in the room to place " + (getItem(payload.id)?.name || "item"));
  }

  function _rotatePending() {
    if (!_pendingItem) return;
    _pendingItem.rot = (_pendingItem.rot || 0) + Math.PI / 2;
  }

  function _confirmPlace(ctx) {
    if (!_pendingItem) return;
    _placedFurniture.push({ ..._pendingItem });
    _rebuildFurniture();
    // Save to Firebase
    const uid = typeof getMyUid === "function" ? getMyUid() : null;
    if (uid) {
      import("firebase/database").then(({ ref, set }) => {
        import("../firebase.js").then(({ db }) => {
          set(ref(db, "players/" + uid + "/homeFurniture"), _placedFurniture);
        });
      });
    }
    ctx.toast("✅ " + (getItem(_pendingItem.id)?.name || "Item") + " placed!");
    _pendingItem = null;
    _decorateMode = false;
  }

  function _cancelPlace() {
    _pendingItem = null;
    _decorateMode = false;
  }

  _built = true;
  _cache = handle;
  return handle;
}
