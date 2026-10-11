// src/places/kawo_park.js — Kawo Motor Park (transport hub)
import * as THREE from "three";
import { box, mergedMesh, signMesh, floor, interiorLights, disposeGroup } from "./_helpers.js";
import { rng } from "../config.js";

let _built = false, _cache = null;

export async function build(scene, ctx) {
  if (_built) return _cache;
  const R = rng(20251020);
  const group = new THREE.Group();
  group.name = "kawo_park";
  group.visible = false;

  group.add(floor(80, 60, 0x8a5a30));
  // Tire tracks
  for (let i = 0; i < 5; i++) {
    const track = new THREE.Mesh(new THREE.PlaneGeometry(70, 0.8), new THREE.MeshLambertMaterial({ color: 0x6a4020, transparent: true, opacity: 0.5 }));
    track.rotation.x = -Math.PI / 2; track.position.set(0, 0.01, -20 + i * 10);
    group.add(track);
  }
  // Perimeter wall + gate posts
  group.add(mergedMesh([
    box(80, 1.8, 0.4, 0, 0.9, -30, 0xa09080),
    box(0.4, 1.8, 60, -40, 0.9, 0, 0xa09080),
    box(0.4, 1.8, 60, 40, 0.9, 0, 0xa09080),
    box(1, 3, 1, -4, 1.5, 29.8, 0x555a60),
    box(1, 3, 1, 4, 1.5, 29.8, 0x555a60),
  ]));
  // 3 buses
  const busColors = [0xf2b134, 0xd4a020, 0xe67e22];
  for (let i = 0; i < 3; i++) {
    const bus = _buildBus(busColors[i], R);
    bus.position.set(-25 + i * 25, 0, -18); bus.rotation.y = Math.PI / 2;
    group.add(bus);
  }
  // 5 kekes
  for (let i = 0; i < 5; i++) {
    const keke = _buildKeke(R);
    keke.position.set(-20 + i * 10, 0, 5); keke.rotation.y = Math.PI / 2;
    group.add(keke);
  }
  // 4 okadas
  for (let i = 0; i < 4; i++) {
    const okada = _buildOkada(R);
    okada.position.set(-15 + i * 10, 0, 18); okada.rotation.y = -Math.PI / 2;
    group.add(okada);
  }
  // Zinc-roof shelter
  const shelterGroup = new THREE.Group(); shelterGroup.position.set(0, 0, -5);
  const posts = [];
  for (const [px, pz] of [[-6, -3], [6, -3], [-6, 3], [6, 3]]) posts.push(box(0.2, 3.5, 0.2, px, 1.75, pz, 0x5a4a30));
  shelterGroup.add(mergedMesh(posts));
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshLambertMaterial({ color: 0x8a9098, side: THREE.DoubleSide }));
  roof.rotation.x = -Math.PI / 2 + 0.1; roof.position.y = 3.6; shelterGroup.add(roof);
  for (let i = 0; i < 14; i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 8), new THREE.MeshLambertMaterial({ color: 0x6a7078 }));
    line.position.set(-6.8 + i * 0.95, 3.65, 0); shelterGroup.add(line);
  }
  for (const [bx, bz] of [[-4, 0], [4, 0]]) {
    shelterGroup.add(mergedMesh([box(3, 0.1, 0.5, bx, 0.5, bz, 0x8a6a45), box(0.1, 0.5, 0.4, bx - 1.3, 0.25, bz, 0x5a4a30), box(0.1, 0.5, 0.4, bx + 1.3, 0.25, bz, 0x5a4a30)]));
  }
  group.add(shelterGroup);
  // Ticket kiosk
  const ticketBooth = _buildKiosk("TICKETS", 0x1d5fa8, R); ticketBooth.position.set(-15, 0, -12); group.add(ticketBooth);
  // Food cart with umbrella
  const cartGroup = new THREE.Group(); cartGroup.position.set(15, 0, -12);
  cartGroup.add(mergedMesh([box(2.5, 1, 1.2, 0, 0.6, 0, 0xc0392b), box(2.5, 0.1, 1.2, 0, 1.15, 0, 0x8a6a45), box(0.1, 1, 0.1, -1.2, 0.5, -0.5, 0x222222), box(0.1, 1, 0.1, 1.2, 0.5, -0.5, 0x222222), box(0.1, 1, 0.1, -1.2, 0.5, 0.5, 0x222222), box(0.1, 1, 0.1, 1.2, 0.5, 0.5, 0x222222)]));
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.4, 10), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  pot.position.set(0, 1.4, 0); cartGroup.add(pot);
  const umbrella = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.8, 16), new THREE.MeshLambertMaterial({ color: 0xc0392b }));
  umbrella.position.set(0, 3, 0); cartGroup.add(umbrella);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  pole.position.set(0, 1.8, 0); cartGroup.add(pole);
  group.add(cartGroup);
  // Push carts
  for (const [lx, lz] of [[-30, 10], [30, 10]]) {
    const pushCart = mergedMesh([box(2, 0.1, 1.2, 0, 0.7, 0, 0x8a6a45), box(0.1, 0.7, 0.1, -0.9, 0.35, -0.5, 0x222222), box(0.1, 0.7, 0.1, 0.9, 0.35, -0.5, 0x222222), box(0.1, 0.7, 0.1, -0.9, 0.35, 0.5, 0x222222), box(0.1, 0.7, 0.1, 0.9, 0.35, 0.5, 0x222222), box(0.8, 0.6, 0.8, 0, 1.1, 0, 0xc8b890)]);
    pushCart.position.set(lx, 0, lz); group.add(pushCart);
  }
  // Signs
  const sign1 = signMesh("KAWO MOTOR PARK", 10, 1.5, { width: 500, height: 75, bg: "#f2b134", fg: "#12261e", size: 32 });
  sign1.position.set(0, 4, 28); group.add(sign1);
  const sign2 = signMesh("→ ZARIA → KANO → ABUJA", 8, 1, { width: 400, height: 50, bg: "#1d5fa8", fg: "#fff", size: 22 });
  sign2.position.set(0, 3, -19.7); group.add(sign2);
  // Lighting
  group.add(interiorLights({ ambient: 0.6, points: [{ x: 0, y: 3.4, z: -5, color: 0xffd070, intensity: 0.6, distance: 10 }, { x: -15, y: 3, z: -12, color: 0xffd070, intensity: 0.5, distance: 8 }, { x: 15, y: 3, z: -12, color: 0xff8030, intensity: 0.5, distance: 8 }] }));
  // Colliders
  const colliders = [
    { minX: -32, maxX: -18, minZ: -22, maxZ: -14 }, { minX: -7, maxX: 7, minZ: -22, maxZ: -14 }, { minX: 18, maxX: 32, minZ: -22, maxZ: -14 },
    { minX: -7, maxX: -5, minZ: -9, maxZ: -7 }, { minX: 5, maxX: 7, minZ: -9, maxZ: -7 }, { minX: -7, maxX: -5, minZ: -1, maxZ: 1 }, { minX: 5, maxX: 7, minZ: -1, maxZ: 1 },
    { minX: -17, maxX: -13, minZ: -14, maxZ: -10 }, { minX: 13, maxX: 17, minZ: -14, maxZ: -10 },
    { minX: -32, maxX: -28, minZ: 8, maxZ: 12 }, { minX: 28, maxX: 32, minZ: 8, maxZ: 12 },
  ];
  scene.add(group);

    let _people = null;
  spawnPeople(group, [
    { id: "conductor1", name: "Musa", role: "bus conductor", outfit: "casual", pose: "stand", x: -25, z: -15, ry: Math.PI, top: "#f2b134" },
    { id: "driver1", name: "Alhaji Tanko", role: "bus driver", outfit: "kaftan", pose: "stand", x: 0, z: -15, ry: Math.PI, top: "#c9b38a" },
    { id: "loader1", name: "Abdul", role: "load carrier", outfit: "casual", pose: "stand", x: -30, z: 10, ry: 0, top: "#2b3a55", route: [{ x: -30, z: 10 }, { x: 30, z: 10 }, { x: 30, z: -5 }, { x: -30, z: -5 }], speed: 0.7 },
    { id: "vendor1", name: "Mama Chinedu", role: "food vendor", outfit: "casual", pose: "stand", x: 15, z: -12, ry: Math.PI, top: "#c0392b" },
    { id: "tout1", name: "Bala", role: "park tout", outfit: "casual", pose: "stand", x: 10, z: 5, ry: 0, top: "#1d5fa8", route: [{ x: 10, z: 5 }, { x: -10, z: 5 }, { x: -10, z: -5 }, { x: 10, z: -5 }], speed: 0.9 },
    { id: "pass1", name: "Passenger", role: "passenger", outfit: "casual", pose: "sit", x: -4, z: -4, ry: 0 },
    { id: "pass2", name: "Passenger", role: "passenger", outfit: "kaftan", pose: "sit", x: 4, z: -4, ry: 0 },
    { id: "pass3", name: "Passenger", role: "passenger", outfit: "casual", pose: "sit", x: -4, z: 4, ry: Math.PI },
    { id: "pass4", name: "Passenger", role: "passenger", outfit: "kaftan", pose: "sit", x: 4, z: 4, ry: Math.PI },
    { id: "hawker1", name: "Hawker", role: "load carrier", outfit: "casual", pose: "stand", x: -20, z: 0, ry: 0, top: "#2e7d4f", route: [{ x: -20, z: 0 }, { x: 20, z: 0 }], speed: 0.6 },
    { id: "hawker2", name: "Hawker", role: "load carrier", outfit: "kaftan", pose: "stand", x: 20, z: 8, ry: Math.PI, top: "#d98e2b", route: [{ x: 20, z: 8 }, { x: -20, z: 8 }], speed: 0.5 },
  ]).then((p) => { _people = p; });

  const handle = {
    group, colliders,
    enter(ps) { ps.pos.set(0, 0, 22); ps.heading = Math.PI; },
    exit() {}, update(dt, now, px, pz) { if (_people) _people.update(dt, now, px, pz); },
    dispose() { if (_people) _people.dispose(); scene.remove(group); disposeGroup(group); _built = false; _cache = null; },
    people: () => _people,
    onUIEvent(eid) {
      if (eid === "talk" && arguments[1]?.personId) _talk(ctx, arguments[1].personId);
      if (eid === "board_bus") _act(ctx, 800, "🚌 Bus to Zaria boarded!", { energy: -10 });
      else if (eid === "hire_keke") _act(ctx, 200, "🛺 Keke hired!", {});
      else if (eid === "hire_okada") _act(ctx, 400, "🏍️ Okada hired!", {});
      else if (eid === "eat_park") _act(ctx, 300, "🥣 Kunu and kosai! Hunger +35", { hunger: 35, fun: 5 });
    },
  };
  _built = true; _cache = handle; return handle;
}

function _act(ctx, cost, msg, effects) {
  if (!ctx.game) return;
  if (ctx.game.state.money < cost) { ctx.toast("Need ₦" + cost); return; }
  ctx.game.state.money -= cost;
  if (effects.hunger) ctx.game.state.needs.hunger = Math.min(100, (ctx.game.state.needs.hunger || 0) + effects.hunger);
  if (effects.fun) ctx.game.state.needs.fun = Math.min(100, (ctx.game.state.needs.fun || 0) + effects.fun);
  if (effects.energy) ctx.game.state.needs.energy = Math.max(0, (ctx.game.state.needs.energy || 0) + effects.energy);
  ctx.game.save?.(); ctx.updateHUD?.(); ctx.toast(msg);
}

function _buildBus(color, R) {
  const g = new THREE.Group();
  g.add(mergedMesh([box(8, 2.8, 3, 0, 1.8, 0, color), box(8, 0.8, 3.1, 0, 3.4, 0, color), box(8, 0.1, 3, 0, 0.5, 0, 0x222222)]));
  const ws = new THREE.Mesh(new THREE.BoxGeometry(8.05, 0.8, 2.4), new THREE.MeshLambertMaterial({ color: 0x2a3a4a, transparent: true, opacity: 0.7 }));
  ws.position.set(0, 2.4, 0); g.add(ws);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(8.02, 0.3, 3.02), new THREE.MeshLambertMaterial({ color: 0xf2b134 }));
  stripe.position.set(0, 1.2, 0); g.add(stripe);
  for (const [wx, wz] of [[-3, -1.5], [3, -1.5], [-3, 1.5], [3, 1.5]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.4, 12), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.6, wz); g.add(w);
  }
  for (const hz of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0xfff0b0 })); l.position.set(4, 1.5, hz); g.add(l); }
  return g;
}
function _buildKeke(R) {
  const g = new THREE.Group();
  const color = [0xf2b134, 0x1d5fa8, 0xc0392b, 0x2e7d4f][Math.floor(R() * 4)];
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 1.4), new THREE.MeshLambertMaterial({ color }));
  body.position.y = 0.8; g.add(body);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.3, 1.3), new THREE.MeshLambertMaterial({ color: 0xf2b134 }));
  canopy.position.y = 1.55; g.add(canopy);
  const fw = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.25, 10), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  fw.rotation.z = Math.PI / 2; fw.position.set(1.2, 0.4, 0); g.add(fw);
  for (const rz of [-0.8, 0.8]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.25, 10), new THREE.MeshLambertMaterial({ color: 0x222222 })); w.rotation.z = Math.PI / 2; w.position.set(-0.8, 0.4, rz); g.add(w); }
  return g;
}
function _buildOkada(R) {
  const g = new THREE.Group();
  const color = [0xc0392b, 0x1d5fa8, 0x222222, 0x2e7d4f][Math.floor(R() * 4)];
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.3), new THREE.MeshLambertMaterial({ color }));
  frame.position.y = 0.6; g.add(frame);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.35), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  seat.position.set(-0.2, 0.85, 0); g.add(seat);
  for (const wx of [0.8, -0.8]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.15, 12), new THREE.MeshLambertMaterial({ color: 0x222222 })); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.45, 0); g.add(w); }
  return g;
}
function _buildKiosk(label, color, R) {
  const g = new THREE.Group();
  g.add(mergedMesh([box(4, 2.2, 2.5, 0, 1.1, 0, color), box(4.2, 0.1, 2.7, 0, 2.25, 0, 0x8a6a45)]));
  const win = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 0.1), new THREE.MeshLambertMaterial({ color: 0x1a1a2a }));
  win.position.set(0, 1.3, 1.28); g.add(win);
  const sign = signMesh(label, 3, 0.7, { width: 200, height: 48, bg: "#" + color.toString(16).padStart(6, "0"), fg: "#fff", size: 24 });
  sign.position.set(0, 2.7, 0); g.add(sign);
  return g;
}
