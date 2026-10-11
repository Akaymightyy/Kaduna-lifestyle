// src/places/river_park.js — Kaduna River Park
import * as THREE from "three";
import { box, mergedMesh, signMesh, floor, interiorLights, disposeGroup } from "./_helpers.js";
import { rng } from "../config.js";
import { spawnPeople, getNamedDialogue, getDialogue } from "./people.js";

let _built = false, _cache = null;

export async function build(scene, ctx) {
  if (_built) return _cache;
  const R = rng(20251026);
  const group = new THREE.Group();
  group.name = "river_park"; group.visible = false;

  // Grass ground
  group.add(floor(80, 60, 0x4a8a3a));
  // River (large blue plane on the north side)
  const river = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 25),
    new THREE.MeshLambertMaterial({ color: 0x2a6a9a, transparent: true, opacity: 0.85 })
  );
  river.rotation.x = -Math.PI / 2; river.position.set(0, 0.02, -20); group.add(river);
  // River edge (sandy bank)
  const bank = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 3),
    new THREE.MeshLambertMaterial({ color: 0xc8b890 })
  );
  bank.rotation.x = -Math.PI / 2; bank.position.set(0, 0.03, -8); group.add(bank);
  // Wooden jetty (extends into the river)
  const jetty = mergedMesh([
    box(3, 0.2, 8, 0, 0.1, -14, 0x8a6a45),
    box(0.2, 0.5, 8, -1.4, 0.05, -14, 0x5a4a30),
    box(0.2, 0.5, 8, 1.4, 0.05, -14, 0x5a4a30),
  ]);
  group.add(jetty);
  // Boats (2, moored at the jetty)
  for (const [bx, bz] of [[-4, -16], [4, -16]]) {
    const boat = _buildBoat(R); boat.position.set(bx, 0, bz); group.add(boat);
  }
  // Picnic tables (4, on the grass)
  for (const [tx, tz] of [[-15, 5], [15, 5], [-15, 15], [15, 15]]) {
    const table = mergedMesh([
      box(2, 0.08, 1.2, tx, 0.8, tz, 0x8a6a45),
      box(0.1, 0.8, 0.1, tx - 0.8, 0.4, tz - 0.5, 0x5a4a30),
      box(0.1, 0.8, 0.1, tx + 0.8, 0.4, tz - 0.5, 0x5a4a30),
      box(0.1, 0.8, 0.1, tx - 0.8, 0.4, tz + 0.5, 0x5a4a30),
      box(0.1, 0.8, 0.1, tx + 0.8, 0.4, tz + 0.5, 0x5a4a30),
      // Benches
      box(2, 0.08, 0.4, tx, 0.5, tz - 0.8, 0x8a6a45),
      box(2, 0.08, 0.4, tx, 0.5, tz + 0.8, 0x8a6a45),
    ]);
    group.add(table);
  }
  // Trees (riverbank willows)
  for (let i = 0; i < 10; i++) {
    const tree = _buildWillow(R);
    tree.position.set((R() - 0.5) * 70, 0, -5 + R() * 20);
    if (tree.position.z < -7 && Math.abs(tree.position.x) < 4) tree.position.x = (tree.position.x > 0 ? 1 : -1) * 5;
    group.add(tree);
  }
  // Park benches (facing the river)
  for (const [bx, bz] of [[-10, -3], [10, -3], [0, 0]]) {
    const bench = mergedMesh([
      box(2, 0.1, 0.5, bx, 0.5, bz, 0x8a6a45),
      box(2, 0.4, 0.1, bx, 0.7, bz + 0.2, 0x8a6a45),
      box(0.1, 0.5, 0.1, bx - 0.9, 0.25, bz, 0x5a4a30),
      box(0.1, 0.5, 0.1, bx + 0.9, 0.25, bz, 0x5a4a30),
    ]);
    group.add(bench);
  }
  // Sign
  const sign = signMesh("KADUNA RIVER PARK", 10, 1.5, { width: 500, height: 75, bg: "#0ea5e9", fg: "#fff", size: 30 });
  sign.position.set(0, 4, 27); group.add(sign);
  // Lighting (natural)
  group.add(interiorLights({ ambient: 0.8, points: [{ x: 0, y: 4, z: -14, color: 0xfff0e0, intensity: 0.4, distance: 15 }] }));
  // Colliders
  const colliders = [
    { minX: -2, maxX: 2, minZ: -18, maxZ: -10 }, // jetty
    { minX: -6, maxX: -2, minZ: -18, maxZ: -14 }, // boat 1
    { minX: 2, maxX: 6, minZ: -18, maxZ: -14 }, // boat 2
    { minX: -16, maxX: -14, minZ: 4, maxZ: 6 }, { minX: 14, maxX: 16, minZ: 4, maxZ: 6 },
    { minX: -16, maxX: -14, minZ: 14, maxZ: 16 }, { minX: 14, maxX: 16, minZ: 14, maxZ: 16 },
  ];
  scene.add(group);

    let _people = null;
  spawnPeople(group, [
    { id: "fisher1", name: "Pa Audu", role: "fisherman", outfit: "kaftan", pose: "stand", x: 0, z: -14, ry: 0, top: "#c9b38a" },
    { id: "guard2", name: "Sergeant Idris", role: "park ranger", outfit: "casual", pose: "stand", x: 0, z: 25, ry: Math.PI, top: "#2e7d4f" },
    { id: "jogger1", name: "Jogger", role: "park ranger", outfit: "casual", pose: "stand", x: -20, z: 0, ry: 0, top: "#1d5fa8", route: [{ x: -20, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 20 }, { x: -20, z: 20 }], speed: 2.0 },
    { id: "jogger2", name: "Jogger", role: "park ranger", outfit: "casual", pose: "stand", x: 20, z: 5, ry: Math.PI, top: "#c0392b", route: [{ x: 20, z: 5 }, { x: -20, z: 5 }, { x: -20, z: 15 }, { x: 20, z: 15 }], speed: 1.8 },
    { id: "couple1", name: "Couple", role: "park ranger", outfit: "casual", pose: "sit", x: -15, z: 5, ry: 0 },
    { id: "couple2", name: "Couple", role: "park ranger", outfit: "kaftan", pose: "sit", x: 15, z: 15, ry: Math.PI },
    { id: "relax1", name: "Visitor", role: "park ranger", outfit: "casual", pose: "sit", x: -15, z: 15, ry: 0 },
    { id: "relax2", name: "Visitor", role: "park ranger", outfit: "kaftan", pose: "sit", x: 15, z: 5, ry: Math.PI },
  ]).then((p) => { _people = p; });

  const handle = {
    group, colliders,
    enter(ps) { ps.pos.set(0, 0, 25); ps.heading = Math.PI; },
    exit() {}, update(dt, now, px, pz) { if (_people) _people.update(dt, now, px, pz); },
    dispose() { if (_people) _people.dispose(); scene.remove(group); disposeGroup(group); _built = false; _cache = null; },
    people: () => _people,
    onUIEvent(eid) {
      if (eid === "talk" && arguments[1]?.personId) _talk(ctx, arguments[1].personId);
      if (eid === "fish") _act(ctx, 0, "🎣 You caught a fish!", { _earn: 200 + Math.floor(Math.random() * 600), fun: 10, energy: -10 });
      else if (eid === "picnic") _act(ctx, 0, "🧺 Lovely picnic! Mood +25, Fun +15", { fun: 15, social: 25 });
      else if (eid === "boat_ride") _act(ctx, 1000, "🚣 Romantic boat ride! Mood +30", { fun: 30, social: 15 });
      else if (eid === "relax") _act(ctx, 0, "🌊 Relaxed by the water. Energy +20, Mood +10", { energy: 20, fun: 10 });
    },
  };
  _built = true; _cache = handle; return handle;
}

function _act(ctx, cost, msg, effects) {
  if (!ctx.game) return;
  if (effects._earn) { ctx.game.state.money += effects._earn; msg = "🎣 You caught a fish! Sold for ₦" + effects._earn.toLocaleString(); }
  else { if (ctx.game.state.money < cost) { ctx.toast("Need ₦" + cost.toLocaleString()); return; } ctx.game.state.money -= cost; }
  for (const k of ["hunger", "fun", "social", "energy"]) {
    if (effects[k]) ctx.game.state.needs[k] = Math.min(100, Math.max(0, (ctx.game.state.needs[k] || 0) + effects[k]));
  }
  ctx.game.save?.(); ctx.updateHUD?.(); ctx.toast(msg);
}

function _buildBoat(R) {
  const g = new THREE.Group();
  const color = [0x8a5a3c, 0x5a4a30, 0x6a4020][Math.floor(R() * 3)];
  // Hull
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 4), new THREE.MeshLambertMaterial({ color }));
  hull.position.y = 0.3; g.add(hull);
  // Interior
  const interior = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 3.6), new THREE.MeshLambertMaterial({ color: 0x4a3010 }));
  interior.position.y = 0.5; g.add(interior);
  // Seat
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.5), new THREE.MeshLambertMaterial({ color: 0x5a4a30 }));
  seat.position.set(0, 0.55, 0); g.add(seat);
  return g;
}
function _buildWillow(R) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 3, 6), new THREE.MeshLambertMaterial({ color: 0x7a5a3a }));
  trunk.position.y = 1.5; g.add(trunk);
  // Drooping crown (flattened sphere)
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2 + R() * 0.5, 0), new THREE.MeshLambertMaterial({ color: 0x4a8a3a }));
  crown.position.y = 3.5; crown.scale.y = 0.6; g.add(crown);
  return g;
}
