// src/places/home.js — Player home interior
// A simple one-room interior that reads the player's furniture from Firebase
// and builds the room. Functional: bed=sleep, fridge=eat, TV=fun, shower=hygiene, toilet=bladder.
import * as THREE from "three";
import { box, mergedMesh, floor, interiorLights, disposeGroup } from "./_helpers.js";
import { FURNITURE_CATALOG, getItem, makeFurnitureMesh, calcComfort } from "../furniture.js";

let _built = false, _cache = null;

export async function build(scene, ctx) {
  if (_built) return _cache;
  const group = new THREE.Group();
  group.name = "player_home";
  group.visible = false;

  // Floor (wooden)
  group.add(floor(20, 16, 0x8b6a3c));
  // Walls (cream)
  group.add(mergedMesh([
    box(20, 4, 0.3, 0, 2, -8, 0xf4f1ea),
    box(0.3, 4, 16, -10, 2, 0, 0xf4f1ea),
    box(0.3, 4, 16, 10, 2, 0, 0xf4f1ea),
  ]));
  // Lighting (bright ambient)
  group.add(interiorLights({ ambient: 0.9, points: [{ x: 0, y: 4, z: 0, color: 0xfff0e0, intensity: 0.8, distance: 16 }] }));
  // Sign
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1), new THREE.MeshBasicMaterial({ color: 0x0f4d3a }));
  sign.position.set(0, 3.5, -7.9); group.add(sign);

  // Load placed furniture from Firebase
  let _placedFurniture = [];
  let _furnitureGroup = new THREE.Group();
  group.add(_furnitureGroup);

  // Load from Firebase
  const uid = ctx?.game?.state?.uid || (typeof getMyUid === "function" ? getMyUid() : null);
  if (uid && ctx?.db) {
    import("firebase/database").then(({ ref, get }) => {
      get(ref(ctx.db, "players/" + uid + "/homeFurniture")).then((snap) => {
        _placedFurniture = snap.val() || [];
        _rebuildFurniture();
      });
    });
  }

  function _rebuildFurniture() {
    // Clear old
    while (_furnitureGroup.children.length) _furnitureGroup.remove(_furnitureGroup.children[0]);
    // Build placed items
    for (const p of _placedFurniture) {
      const item = getItem(p.id);
      if (!item) continue;
      const mesh = makeFurnitureMesh(item, p.color);
      mesh.position.set(p.x || 0, 0, p.z || 0);
      mesh.rotation.y = p.rot || 0;
      _furnitureGroup.add(mesh);
    }
    // Update comfort
    const comfort = calcComfort(_placedFurniture);
    ctx.toast("🏠 Home comfort: " + comfort);
  }

  const colliders = [
    { minX: -10.2, maxX: -9.8, minZ: -8, maxZ: 8 }, // left wall
    { minX: 9.8, maxX: 10.2, minZ: -8, maxZ: 8 },   // right wall
    { minX: -10, maxX: 10, minZ: -8.2, maxZ: -7.8 }, // back wall
  ];

  scene.add(group);

  const handle = {
    group, colliders,
    enter(ps) { ps.pos.set(0, 0, 6); ps.heading = Math.PI; },
    exit() {},
    update() {},
    dispose() { scene.remove(group); disposeGroup(group); _built = false; _cache = null; },
    onUIEvent(eid) {
      if (eid === "sleep") _sleep(ctx);
      else if (eid === "eat_home") _eatHome(ctx);
      else if (eid === "tv") _watchTV(ctx);
      else if (eid === "shower") _shower(ctx);
      else if (eid === "toilet") _useToilet(ctx);
    },
    getComfort() { return calcComfort(_placedFurniture); },
    getPlaced() { return _placedFurniture; },
  };

  _built = true;
  _cache = handle;
  return handle;
}

function _sleep(ctx) {
  if (!ctx.game) return;
  ctx.game.state.needs.energy = Math.min(100, (ctx.game.state.needs.energy || 0) + 40);
  ctx.game.save?.(); ctx.updateHUD?.();
  ctx.toast("😴 You slept. Energy +40");
}
function _eatHome(ctx) {
  if (!ctx.game) return;
  ctx.game.state.needs.hunger = Math.min(100, (ctx.game.state.needs.hunger || 0) + 30);
  ctx.game.save?.(); ctx.updateHUD?.();
  ctx.toast("🍛 Ate from fridge. Hunger +30");
}
function _watchTV(ctx) {
  if (!ctx.game) return;
  ctx.game.state.needs.fun = Math.min(100, (ctx.game.state.needs.fun || 0) + 20);
  ctx.game.save?.(); ctx.updateHUD?.();
  ctx.toast("📺 Watched TV. Fun +20");
}
function _shower(ctx) {
  if (!ctx.game) return;
  ctx.game.state.needs.hygiene = Math.min(100, (ctx.game.state.needs.hygiene || 0) + 30);
  ctx.game.save?.(); ctx.updateHUD?.();
  ctx.toast("🚿 Showered. Hygiene +30");
}
function _useToilet(ctx) {
  if (!ctx.game) return;
  ctx.game.state.needs.bladder = Math.min(100, (ctx.game.state.needs.bladder || 0) + 40);
  ctx.game.save?.(); ctx.updateHUD?.();
  ctx.toast("🚽 Bladder relieved.");
}
