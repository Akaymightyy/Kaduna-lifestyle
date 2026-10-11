// src/places/university.js — Kaduna Polytechnic campus
import * as THREE from "three";
import { box, mergedMesh, signMesh, floor, interiorLights, disposeGroup } from "./_helpers.js";
import { rng } from "../config.js";

let _built = false, _cache = null;

export async function build(scene, ctx) {
  if (_built) return _cache;
  const R = rng(20251021);
  const group = new THREE.Group();
  group.name = "university_campus"; group.visible = false;

  group.add(floor(90, 70, 0x5a8a3a));
  // Football field
  const field = new THREE.Mesh(new THREE.PlaneGeometry(30, 18), new THREE.MeshLambertMaterial({ color: 0x4a7a2a }));
  field.rotation.x = -Math.PI / 2; field.position.set(0, 0.02, 5); group.add(field);
  // Center line + circle
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const cl = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 18), lineMat); cl.rotation.x = -Math.PI / 2; cl.position.set(0, 0.03, 5); group.add(cl);
  const cc = new THREE.Mesh(new THREE.RingGeometry(2.5, 2.7, 24), lineMat); cc.rotation.x = -Math.PI / 2; cc.position.set(0, 0.03, 5); group.add(cc);
  // Goalposts
  for (const gx of [-15, 15]) {
    for (const gz of [2, 8]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }));
      p.position.set(gx, 1.25, gz); group.add(p);
    }
    const cb = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    cb.rotation.x = Math.PI / 2; cb.position.set(gx, 2.5, 5); group.add(cb);
  }
  // Lecture hall (north)
  group.add(_buildLectureHall(R));
  // Hostel (east)
  const hostel = _buildHostel(R); hostel.position.set(35, 0, 0); group.add(hostel);
  // Cafeteria (west)
  const cafeteria = _buildCafeteria(R); cafeteria.position.set(-35, 0, 0); group.add(cafeteria);
  // Trees
  for (let i = 0; i < 12; i++) {
    const tree = _buildTree(R);
    tree.position.set((R() - 0.5) * 80, 0, (R() - 0.5) * 60);
    if (Math.abs(tree.position.x) < 20 && tree.position.z > -5 && tree.position.z < 20) tree.position.x = (tree.position.x > 0 ? 1 : -1) * (20 + R() * 15);
    group.add(tree);
  }
  // Signs
  const sign = signMesh("KADUNA POLYTECHNIC", 10, 1.5, { width: 500, height: 75, bg: "#1d5fa8", fg: "#fff", size: 30 });
  sign.position.set(0, 4, 32); group.add(sign);
  // Lighting
  group.add(interiorLights({ ambient: 0.7, points: [{ x: 0, y: 4, z: -25, color: 0xfff0e0, intensity: 0.7, distance: 14 }, { x: 33, y: 3, z: 0, color: 0xffe0a0, intensity: 0.5, distance: 10 }, { x: -33, y: 3.5, z: 0, color: 0xfff0c0, intensity: 0.6, distance: 12 }] }));
  // Colliders
  const colliders = [
    { minX: -5, maxX: 5, minZ: -35, maxZ: -25 },
    { minX: 31, maxX: 39, minZ: -4, maxZ: 4 },
    { minX: -40, maxX: -30, minZ: -4, maxZ: 4 },
    { minX: -16, maxX: -14, minZ: 1, maxZ: 9 }, { minX: 14, maxX: 16, minZ: 1, maxZ: 9 },
  ];
  scene.add(group);
    let _people = null;
  spawnPeople(group, [
    { id: "lecturer1", name: "Dr. Aminu", role: "lecturer", outfit: "kaftan", pose: "stand", x: 0, z: -30, ry: 0, top: "#1d5fa8" },
    { id: "student1", name: "Fatima", role: "student", outfit: "casual", pose: "sit", x: -3, z: -27, ry: 0, top: "#c0392b" },
    { id: "student2", name: "Chidi", role: "student", outfit: "casual", pose: "sit", x: 0, z: -27, ry: 0, top: "#2e7d4f" },
    { id: "student3", name: "Aisha", role: "student", outfit: "casual", pose: "sit", x: 3, z: -27, ry: 0, top: "#f2b134" },
    { id: "student4", name: "Student", role: "student", outfit: "casual", pose: "sit", x: -3, z: -25, ry: 0 },
    { id: "student5", name: "Student", role: "student", outfit: "kaftan", pose: "sit", x: 0, z: -25, ry: 0 },
    { id: "student6", name: "Student", role: "student", outfit: "casual", pose: "sit", x: 3, z: -25, ry: 0 },
    { id: "walker1", name: "Student", role: "student", outfit: "casual", pose: "stand", x: -20, z: 0, ry: 0, route: [{ x: -20, z: 0 }, { x: 20, z: 0 }], speed: 0.8 },
    { id: "walker2", name: "Student", role: "student", outfit: "kaftan", pose: "stand", x: 20, z: 10, ry: Math.PI, route: [{ x: 20, z: 10 }, { x: -20, z: 10 }], speed: 0.7 },
    { id: "cafeteria1", name: "Aunty Rabi", role: "cafeteria cook", outfit: "casual", pose: "stand", x: -35, z: -3, ry: 0, top: "#d98e2b" },
    { id: "player1", name: "Ahmed", role: "footballer", outfit: "casual", pose: "stand", x: -5, z: 5, ry: 0, top: "#c0392b", route: [{ x: -5, z: 5 }, { x: 5, z: 5 }], speed: 1.5 },
  ]).then((p) => { _people = p; });

  const handle = {
    group, colliders,
    enter(ps) { ps.pos.set(0, 0, 28); ps.heading = Math.PI; },
    exit() {}, update(dt, now, px, pz) { if (_people) _people.update(dt, now, px, pz); },
    dispose() { if (_people) _people.dispose(); scene.remove(group); disposeGroup(group); _built = false; _cache = null; },
    people: () => _people,
    onUIEvent(eid) {
      if (eid === "talk" && arguments[1]?.personId) _talk(ctx, arguments[1].personId);
      if (eid === "attend_lecture") _act(ctx, -500, "🎓 Attended lecture! ₦500 stipend. Energy -20", { energy: -20, fun: -5 }, true);
      else if (eid === "eat_cafeteria") _act(ctx, 400, "🍝 Student meal! Hunger +50", { hunger: 50, fun: 5 });
      else if (eid === "play_football") _act(ctx, 0, "⚽ Football! Fun +25, Social +15", { fun: 25, social: 15, energy: -15 });
      else if (eid === "rest_hostel") _act(ctx, 0, "😴 Rested at hostel. Energy +40", { energy: 40 });
    },
  };
  _built = true; _cache = handle; return handle;
}

function _act(ctx, cost, msg, effects, earn) {
  if (!ctx.game) return;
  if (earn) { ctx.game.state.money += Math.abs(cost); }
  else { if (ctx.game.state.money < cost) { ctx.toast("Need ₦" + cost); return; } ctx.game.state.money -= cost; }
  if (effects.hunger) ctx.game.state.needs.hunger = Math.min(100, Math.max(0, (ctx.game.state.needs.hunger || 0) + effects.hunger));
  if (effects.fun) ctx.game.state.needs.fun = Math.min(100, Math.max(0, (ctx.game.state.needs.fun || 0) + effects.fun));
  if (effects.energy) ctx.game.state.needs.energy = Math.min(100, Math.max(0, (ctx.game.state.needs.energy || 0) + effects.energy));
  if (effects.social) ctx.game.state.needs.social = Math.min(100, Math.max(0, (ctx.game.state.needs.social || 0) + effects.social));
  ctx.game.save?.(); ctx.updateHUD?.(); ctx.toast(msg);
}

function _buildLectureHall(R) {
  const g = new THREE.Group(); g.position.set(0, 0, -28);
  g.add(mergedMesh([box(12, 5, 8, 0, 2.5, 0, 0xf4f1ea), box(12, 0.3, 8, 0, 4.85, 0, 0x1d5fa8), box(1.2, 2.2, 0.2, 0, 1.1, 4, 0x5a4a30)]));
  const board = new THREE.Mesh(new THREE.PlaneGeometry(6, 2), new THREE.MeshLambertMaterial({ color: 0x1a3a2a }));
  board.position.set(0, 2.5, -3.95); g.add(board);
  g.add(mergedMesh([box(2, 0.1, 1, 0, 0.95, -3, 0x8a6a45), box(0.1, 0.95, 0.1, -0.9, 0.47, -3.4, 0x5a4a30), box(0.1, 0.95, 0.1, 0.9, 0.47, -3.4, 0x5a4a30), box(0.1, 0.95, 0.1, -0.9, 0.47, -2.6, 0x5a4a30), box(0.1, 0.95, 0.1, 0.9, 0.47, -2.6, 0x5a4a30)]));
  for (let row = 0; row < 4; row++) {
    const z = -2 + row * 1.5, y = 0.3 + row * 0.15;
    g.add(mergedMesh([box(8, 0.08, 0.6, 0, y, z, 0xbfa070), box(8, 0.5, 0.05, 0, y - 0.25, z + 0.3, 0x8a6a45), box(0.08, y, 0.08, -3.5, y / 2, z - 0.25, 0x5a4a30), box(0.08, y, 0.08, 1.2, y / 2, z - 0.25, 0x5a4a30), box(0.08, y, 0.08, 3.5, y / 2, z - 0.25, 0x5a4a30)]));
  }
  return g;
}
function _buildHostel(R) {
  const g = new THREE.Group();
  g.add(mergedMesh([box(10, 4, 8, 0, 2, 0, 0xe8d3b0), box(10, 0.3, 8, 0, 3.85, 0, 0x2e7d4f), box(1.2, 2.2, 0.2, 0, 1.1, 4, 0x5a4a30)]));
  for (let i = 0; i < 3; i++) {
    const bunk = mergedMesh([box(2, 0.1, 1, 0, 0.6, 0, 0x8a6a45), box(2, 0.1, 1, 0, 1.8, 0, 0x8a6a45), box(0.1, 2.4, 0.1, -0.95, 1.2, -0.45, 0x5a4a30), box(0.1, 2.4, 0.1, 0.95, 1.2, -0.45, 0x5a4a30), box(0.1, 2.4, 0.1, -0.95, 1.2, 0.45, 0x5a4a30), box(0.1, 2.4, 0.1, 0.95, 1.2, 0.45, 0x5a4a30), box(1.8, 0.15, 0.9, 0, 0.7, 0, 0xc0392b), box(1.8, 0.15, 0.9, 0, 1.9, 0, 0x1d5fa8)]);
    bunk.position.set(-3 + i * 3, 0, -1); g.add(bunk);
  }
  return g;
}
function _buildCafeteria(R) {
  const g = new THREE.Group();
  g.add(mergedMesh([box(12, 4, 8, 0, 2, 0, 0xf4f1ea), box(12, 0.3, 8, 0, 3.85, 0, 0xf2b134), box(1.2, 2.2, 0.2, 0, 1.1, 4, 0x5a4a30)]));
  g.add(mergedMesh([box(8, 1, 0.6, 0, 0.5, -3.5, 0x8a6a45), box(8, 0.1, 0.7, 0, 1.05, -3.5, 0xbfa070), box(8, 0.6, 0.05, 0, 1.5, -3.4, 0x9fc2d9)]));
  for (let i = 0; i < 4; i++) {
    const foodColors = [0xc0392b, 0xf2b134, 0x2e7d4f, 0x8a5a3c];
    const pan = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 0.5), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6, roughness: 0.3 }));
    pan.position.set(-3 + i * 2, 1.15, -3.5); g.add(pan);
    const food = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.4), new THREE.MeshLambertMaterial({ color: foodColors[i] }));
    food.position.set(-3 + i * 2, 1.24, -3.5); g.add(food);
  }
  for (const [tx, tz] of [[-2.5, 0], [2.5, 0], [-2.5, 2], [2.5, 2]]) {
    const table = mergedMesh([box(1.5, 0.08, 1, tx, 0.8, tz, 0xbfa070), box(0.1, 0.8, 0.1, tx - 0.65, 0.4, tz - 0.4, 0x5a4a30), box(0.1, 0.8, 0.1, tx + 0.65, 0.4, tz - 0.4, 0x5a4a30), box(0.1, 0.8, 0.1, tx - 0.65, 0.4, tz + 0.4, 0x5a4a30), box(0.1, 0.8, 0.1, tx + 0.65, 0.4, tz + 0.4, 0x5a4a30)]);
    g.add(table);
  }
  return g;
}
function _buildTree(R) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2.5, 6), new THREE.MeshLambertMaterial({ color: 0x7a5a3a }));
  trunk.position.y = 1.25; g.add(trunk);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 + R() * 0.5, 0), new THREE.MeshLambertMaterial({ color: R() < 0.5 ? 0x3d8c3a : 0x4f9c43 }));
  crown.position.y = 3.5; crown.scale.y = 0.8; g.add(crown);
  return g;
}
