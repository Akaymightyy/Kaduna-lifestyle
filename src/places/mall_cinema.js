// src/places/mall_cinema.js — Kaduna Mall & Cinema
import * as THREE from "three";
import { box, mergedMesh, signMesh, floor, interiorLights, disposeGroup } from "./_helpers.js";
import { rng } from "../config.js";
import { spawnPeople, getNamedDialogue, getDialogue } from "./people.js";

let _built = false, _cache = null;
const _state = { escalator: null };

export async function build(scene, ctx) {
  if (_built) return _cache;
  const R = rng(20251022);
  const group = new THREE.Group();
  group.name = "mall_cinema"; group.visible = false;

  group.add(floor(60, 50, 0xe8e8e0));
  // Tile pattern
  for (let x = -28; x <= 28; x += 4) for (let z = -23; z <= 23; z += 4) {
    const tile = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.8), new THREE.MeshLambertMaterial({ color: 0xf4f4ec }));
    tile.rotation.x = -Math.PI / 2; tile.position.set(x, 0.01, z); group.add(tile);
  }
  // Walls
  group.add(mergedMesh([box(60, 7, 0.4, 0, 3.5, -25, 0xf4f4ec), box(60, 7, 0.4, 0, 3.5, 25, 0xf4f4ec), box(0.4, 7, 50, -30, 3.5, 0, 0xf4f4ec), box(0.4, 7, 50, 30, 3.5, 0, 0xf4f4ec)]));
  // 5 shop storefronts
  const shops = [{ name: "BOUTIQUE", color: 0xc0392b, x: -20 }, { name: "PHONE STORE", color: 0x1d5fa8, x: -10 }, { name: "BOOKSHOP", color: 0x2e7d4f, x: 0 }, { name: "GADGETS", color: 0xf2b134, x: 10 }, { name: "COSMETICS", color: 0x7a3b8f, x: 20 }];
  const colliders = [];
  for (const shop of shops) {
    const sf = _buildStorefront(shop, R); sf.position.set(shop.x, 0, -22); group.add(sf);
    colliders.push({ minX: shop.x - 4, maxX: shop.x + 4, minZ: -25, maxZ: -19 });
  }
  // Escalator
  const escalatorGroup = _buildEscalator(); escalatorGroup.position.set(-12, 0, 0); group.add(escalatorGroup);
  _state.escalator = escalatorGroup;
  // Food court
  const foodCourt = _buildFoodCourt(R); foodCourt.position.set(15, 0, 10); group.add(foodCourt);
  // Cinema (upper level)
  const cinemaGroup = _buildCinema(R); cinemaGroup.position.set(18, 4, -18); group.add(cinemaGroup);
  // Stairs to cinema
  for (let i = 0; i < 5; i++) { const step = mergedMesh([box(4, 0.2, 1, 18, 0.1 + i * 0.8, -12 + i * 1.2, 0xc8c2b0)]); group.add(step); }
  // Indoor tree planter
  const planter = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 0.8, 12), new THREE.MeshLambertMaterial({ color: 0x8a6a45 }));
  planter.position.set(0, 0.4, 0); group.add(planter);
  const indoorTree = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 0), new THREE.MeshLambertMaterial({ color: 0x3d8c3a }));
  indoorTree.position.set(0, 2.2, 0); group.add(indoorTree);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.8, 6), new THREE.MeshLambertMaterial({ color: 0x7a5a3a }));
  trunk.position.set(0, 1.3, 0); group.add(trunk);
  // Signs
  const sign = signMesh("KADUNA MALL & CINEMA", 12, 1.5, { width: 600, height: 75, bg: "#7a3b8f", fg: "#fff", size: 32 });
  sign.position.set(0, 6, 24.7); group.add(sign);
  // Lighting
  group.add(interiorLights({ ambient: 0.8, points: [{ x: 0, y: 6, z: 0, color: 0xfff0e0, intensity: 1.2, distance: 20 }, { x: -20, y: 5, z: -20, color: 0xfff0e0, intensity: 0.8, distance: 12 }, { x: 0, y: 5, z: -20, color: 0xfff0e0, intensity: 0.8, distance: 12 }, { x: 20, y: 5, z: -20, color: 0xfff0e0, intensity: 0.8, distance: 12 }, { x: 15, y: 5, z: 10, color: 0xfff0c0, intensity: 0.8, distance: 14 }, { x: 18, y: 8, z: -18, color: 0xff8030, intensity: 0.5, distance: 12 }] }));
  colliders.push({ minX: -14, maxX: -10, minZ: -3, maxZ: 3 }, { minX: 16, maxX: 20, minZ: -13, maxZ: -7 }, { minX: -1.8, maxX: 1.8, minZ: -1.8, maxZ: 1.8 }, { minX: 11, maxX: 19, minZ: 5, maxZ: 7 });
  scene.add(group);

    let _people = null;
  spawnPeople(group, [
    { id: "cashier1", name: "Glory", role: "boutique cashier", outfit: "casual", pose: "stand", x: -20, z: -20, ry: Math.PI, top: "#c0392b" },
    { id: "usher1", name: "Emeka", role: "cinema usher", outfit: "casual", pose: "stand", x: 18, z: -8, ry: 0, top: "#1d5fa8" },
    { id: "shopper1", name: "Shopper", role: "shopper", outfit: "casual", pose: "stand", x: -10, z: 0, ry: 0, route: [{ x: -10, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: -10, z: 10 }], speed: 0.7 },
    { id: "shopper2", name: "Shopper", role: "shopper", outfit: "casual", pose: "stand", x: 10, z: 5, ry: Math.PI, route: [{ x: 10, z: 5 }, { x: -10, z: 5 }, { x: -10, z: -5 }, { x: 10, z: -5 }], speed: 0.6 },
    { id: "shopper3", name: "Shopper", role: "shopper", outfit: "kaftan", pose: "stand", x: 0, z: 10, ry: 0, route: [{ x: 0, z: 10 }, { x: -15, z: 0 }], speed: 0.5 },
    { id: "foodcourt1", name: "Mr. Tunde", role: "food court vendor", outfit: "casual", pose: "stand", x: 15, z: 10, ry: Math.PI, top: "#d98e2b" },
    { id: "queue1", name: "Moviegoer", role: "shopper", outfit: "casual", pose: "stand", x: 16, z: -6, ry: 0 },
    { id: "queue2", name: "Moviegoer", role: "shopper", outfit: "kaftan", pose: "stand", x: 16, z: -5.3, ry: 0 },
    { id: "queue3", name: "Moviegoer", role: "shopper", outfit: "casual", pose: "stand", x: 16, z: -4.6, ry: 0 },
    { id: "walker1", name: "Shopper", role: "shopper", outfit: "casual", pose: "stand", x: -15, z: 15, ry: 0, route: [{ x: -15, z: 15 }, { x: 5, z: 15 }], speed: 0.4 },
  ]).then((p) => { _people = p; });

  const handle = {
    group, colliders,
    enter(ps) { ps.pos.set(0, 0, 22); ps.heading = Math.PI; },
    exit() {}, update(dt) {
      if (_state.escalator) {
        _state.escalator.userData.stepOffset = (_state.escalator.userData.stepOffset || 0) + dt * 0.5;
        const steps = _state.escalator.userData.steps || [];
        for (let i = 0; i < steps.length; i++) {
          const t = ((i / steps.length) + _state.escalator.userData.stepOffset) % 1;
          steps[i].position.y = 0.1 + t * 3.5;
          steps[i].position.z = -2.5 + t * 5;
        }
      }
    },
    dispose() { if (_people) _people.dispose(); scene.remove(group); disposeGroup(group); _built = false; _cache = null; _state.escalator = null; },
    people: () => _people,
    onUIEvent(eid) {
      if (eid === "talk" && arguments[1]?.personId) _talk(ctx, arguments[1].personId);
      if (eid === "shop_clothes") { const cost = 3000 + Math.floor(Math.random() * 5000); _act(ctx, cost, "👗 Bought designer outfit! ₦" + cost.toLocaleString(), { fun: 20, social: 10 }); }
      else if (eid === "watch_movie") _act(ctx, 1500, "🎬 Watched a Nollywood premiere! Fun +20", { fun: 20, social: 10, energy: -5 });
      else if (eid === "eat_foodcourt") _act(ctx, 1000, "🍽️ Continental dish! Hunger +60", { hunger: 60, fun: 8 });
      else if (eid === "browse") _act(ctx, 0, "👀 Window shopping. Fun +5", { fun: 5 });
    },
  };
  _built = true; _cache = handle; return handle;
}

function _act(ctx, cost, msg, effects) {
  if (!ctx.game) return;
  if (cost > 0 && ctx.game.state.money < cost) { ctx.toast("Need ₦" + cost.toLocaleString()); return; }
  ctx.game.state.money -= cost;
  for (const k of ["hunger", "fun", "social", "energy"]) {
    if (effects[k]) ctx.game.state.needs[k] = Math.min(100, Math.max(0, (ctx.game.state.needs[k] || 0) + effects[k]));
  }
  ctx.game.save?.(); ctx.updateHUD?.(); ctx.toast(msg);
}

function _buildStorefront(shop, R) {
  const g = new THREE.Group();
  g.add(mergedMesh([box(8, 5, 0.3, 0, 2.5, -1, shop.color)]));
  const glass = new THREE.Mesh(new THREE.BoxGeometry(7.5, 3, 0.1), new THREE.MeshLambertMaterial({ color: 0x9fc2d9, transparent: true, opacity: 0.4 }));
  glass.position.set(0, 2.5, 1); g.add(glass);
  g.add(mergedMesh([box(8, 0.2, 0.2, 0, 1, 1, 0x222222), box(8, 0.2, 0.2, 0, 4, 1, 0x222222), box(0.2, 3, 0.2, -3.75, 2.5, 1, 0x222222), box(0.2, 3, 0.2, 3.75, 2.5, 1, 0x222222), box(0.2, 3, 0.2, 0, 2.5, 1, 0x222222)]));
  const m1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.0, 4, 8), new THREE.MeshLambertMaterial({ color: 0xe8c547 }));
  m1.position.set(-1.5, 1.8, 0); g.add(m1);
  const m2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.0, 4, 8), new THREE.MeshLambertMaterial({ color: 0xc0392b }));
  m2.position.set(1.5, 1.8, 0); g.add(m2);
  const sign = signMesh(shop.name, 6, 0.7, { width: 300, height: 36, bg: "#" + shop.color.toString(16).padStart(6, "0"), fg: "#fff", size: 22 });
  sign.position.set(0, 4.5, 0.2); g.add(sign);
  return g;
}
function _buildEscalator() {
  const g = new THREE.Group();
  g.add(mergedMesh([box(2, 4, 0.3, -1.2, 2, 0, 0x4a4f55), box(2, 4, 0.3, 1.2, 2, 0, 0x4a4f55), box(0.2, 0.2, 6, -1.4, 3.8, 0, 0x222222), box(0.2, 0.2, 6, 1.4, 3.8, 0, 0x222222)]));
  const steps = [];
  for (let i = 0; i < 10; i++) { const step = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0xc8c2b0 })); g.add(step); steps.push(step); }
  g.userData.steps = steps;
  return g;
}
function _buildFoodCourt(R) {
  const g = new THREE.Group();
  g.add(mergedMesh([box(8, 1.2, 1, 0, 0.6, 0, 0xc0392b), box(8, 0.1, 1.1, 0, 1.25, 0, 0xbfa070), box(8, 1.5, 0.1, 0, 2.5, -0.5, 0x222222)]));
  for (let i = 0; i < 3; i++) { const item = signMesh(["JOLLOF ₦1000", "FRIED RICE ₦1200", "CHICKEN ₦800"][i], 2.5, 0.4, { width: 150, height: 24, bg: [0xf2b134, 0x2e7d4f, 0xc0392b][i].toString(16).padStart(6, "0"), fg: "#fff", size: 14, border: false }); item.position.set(-2.5 + i * 2.5, 2.7, -0.45); g.add(item); }
  for (const [tx, tz] of [[-3, 4], [3, 4], [-3, 7], [3, 7]]) { g.add(mergedMesh([box(1.5, 0.08, 1, tx, 0.8, tz, 0xf4f1ea), box(0.1, 0.8, 0.1, tx - 0.65, 0.4, tz - 0.4, 0x4a4f55), box(0.1, 0.8, 0.1, tx + 0.65, 0.4, tz - 0.4, 0x4a4f55), box(0.1, 0.8, 0.1, tx - 0.65, 0.4, tz + 0.4, 0x4a4f55), box(0.1, 0.8, 0.1, tx + 0.65, 0.4, tz + 0.4, 0x4a4f55)])); }
  return g;
}
function _buildCinema(R) {
  const g = new THREE.Group();
  g.add(mergedMesh([box(14, 0.3, 10, 0, -0.15, 0, 0x222230)]));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshBasicMaterial({ color: 0xf0f0d0 }));
  screen.position.set(0, 2.5, -4); g.add(screen);
  g.add(mergedMesh([box(8.4, 0.2, 0.1, 0, 4.5, -4, 0x222222), box(8.4, 0.2, 0.1, 0, 0.5, -4, 0x222222), box(0.2, 4, 0.1, -4.2, 2.5, -4, 0x222222), box(0.2, 4, 0.1, 4.2, 2.5, -4, 0x222222)]));
  for (let row = 0; row < 4; row++) {
    const z = -2 + row * 1.4, y = 0.2 + row * 0.4;
    for (let i = 0; i < 8; i++) { g.add(mergedMesh([box(0.7, 0.5, 0.6, -3 + i * 0.85, y + 0.25, z, 0xc0392b), box(0.7, 0.6, 0.15, -3 + i * 0.85, y + 0.7, z - 0.25, 0x8a2030)])); }
  }
  return g;
}
