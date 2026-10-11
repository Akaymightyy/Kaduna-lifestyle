// src/places/barber.js — Musa's Barber Shop
import * as THREE from "three";
import { box, mergedMesh, signMesh, floor, interiorLights, disposeGroup } from "./_helpers.js";
import { rng } from "../config.js";
import { spawnPeople, getNamedDialogue, getDialogue } from "./people.js";

let _built = false, _cache = null;

export async function build(scene, ctx) {
  if (_built) return _cache;
  const R = rng(20251028);
  const group = new THREE.Group();
  group.name = "barber"; group.visible = false;

  // Checkered tile floor
  group.add(floor(25, 20, 0x222222));
  for (let x = -11; x <= 11; x += 2) for (let z = -9; z <= 9; z += 2) {
    const tile = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshLambertMaterial({ color: (Math.floor(x / 2) + Math.floor(z / 2)) % 2 ? 0xffffff : 0x222222 }));
    tile.rotation.x = -Math.PI / 2; tile.position.set(x, 0.01, z); group.add(tile);
  }
  // Walls (dark with wood paneling feel)
  group.add(mergedMesh([box(25, 4, 0.4, 0, 2, -10, 0x3a2a1a), box(25, 4, 0.4, 0, 2, 10, 0x3a2a1a), box(0.4, 4, 20, -12, 2, 0, 0x3a2a1a), box(0.4, 4, 20, 12, 2, 0, 0x3a2a1a)]));
  // 3 barber chairs (against north wall, facing mirrors)
  for (let i = 0; i < 3; i++) {
    const station = _buildBarberStation(R);
    station.position.set(-7 + i * 7, 0, -6);
    group.add(station);
  }
  // Waiting bench
  const bench = mergedMesh([box(4, 0.1, 0.6, 0, 0.5, 7, 0x8a6a45), box(4, 0.4, 0.1, 0, 0.7, 7.2, 0x8a6a45), box(0.1, 0.5, 0.1, -1.8, 0.25, 7, 0x5a4a30), box(0.1, 0.5, 0.1, 1.8, 0.25, 7, 0x5a4a30)]);
  group.add(bench);
  // Magazine rack
  const rack = mergedMesh([box(2, 1, 0.3, -8, 0.5, 8, 0x4a4f55), box(2, 0.05, 0.4, -8, 1, 7.8, 0x8a6a45)]);
  group.add(rack);
  // Hair products shelf (against east wall)
  const shelf = mergedMesh([box(0.4, 0.1, 4, 11.7, 1.5, 0, 0x5a4a30), box(0.4, 0.1, 4, 11.7, 2.5, 0, 0x5a4a30), box(0.4, 0.1, 4, 11.7, 3.5, 0, 0x5a4a30)]);
  group.add(shelf);
  // Product bottles on shelf
  for (let i = 0; i < 6; i++) {
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.4, 6), new THREE.MeshLambertMaterial({ color: [0xc0392b, 0x1d5fa8, 0xf2b134, 0x2e7d4f, 0x7a3b8f, 0xe67e22][i] }));
    bottle.position.set(11.5, 1.8 + (i % 3) * 1.0, -2 + i * 1.2); group.add(bottle);
  }
  // Ceiling fan
  const fan = new THREE.Group();
  const fm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 8), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  fm.position.y = 3.7; fan.add(fm);
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.12), new THREE.MeshLambertMaterial({ color: 0x8a6a45 })); b.position.y = 3.65; b.rotation.y = (i * Math.PI) / 2; b.translateX(0.75); fan.add(b); }
  group.add(fan);
  // Sign
  const sign = signMesh("MUSA'S BARBER SHOP", 8, 1, { width: 400, height: 50, bg: "#1a1a2e", fg: "#f2b134", size: 24 });
  sign.position.set(0, 4, 9.7); group.add(sign);
  // Barber pole (red-white-blue striped cylinder by the door)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  pole.position.set(-10, 1, 9.7); group.add(pole);
  // Stripes
  for (let i = 0; i < 6; i++) { const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.15, 12), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xe11d48 : 0x1d5fa8 })); stripe.position.set(-10, 0.3 + i * 0.35, 9.7); group.add(stripe); }
  // Lighting
  group.add(interiorLights({ ambient: 0.75, points: [{ x: -7, y: 3, z: -6, color: 0xfff0e0, intensity: 0.7, distance: 8 }, { x: 0, y: 3, z: -6, color: 0xfff0e0, intensity: 0.7, distance: 8 }, { x: 7, y: 3, z: -6, color: 0xfff0e0, intensity: 0.7, distance: 8 }, { x: 0, y: 3, z: 5, color: 0xfff0e0, intensity: 0.5, distance: 10 }] }));
  // Colliders
  const colliders = [
    { minX: -9, maxX: -5, minZ: -8, maxZ: -4 },
    { minX: -2, maxX: 2, minZ: -8, maxZ: -4 },
    { minX: 5, maxX: 9, minZ: -8, maxZ: -4 },
    { minX: -2, maxX: 2, minZ: 6, maxZ: 8 }, // bench
    { minX: -9, maxX: -7, minZ: 7, maxZ: 9 }, // rack
  ];
  scene.add(group);

    let _people = null;
  spawnPeople(group, [
    { id: "barber1", name: "Musa", role: "barber", outfit: "casual", pose: "stand", x: -7, z: -6, ry: Math.PI, top: "#1a1a2e" },
    { id: "customer1", name: "Sani", role: "customer", outfit: "kaftan", pose: "sit", x: 0, z: -6, ry: 0, top: "#c9b38a" },
    { id: "wait1", name: "Customer", role: "customer", outfit: "casual", pose: "sit", x: -1, z: 7, ry: 0 },
    { id: "wait2", name: "Customer", role: "customer", outfit: "kaftan", pose: "sit", x: 1, z: 7, ry: 0 },
  ]).then((p) => { _people = p; });

  const handle = {
    group, colliders,
    enter(ps) { ps.pos.set(0, 0, 8); ps.heading = Math.PI; },
    exit() {}, update(dt, now, px, pz) { if (_people) _people.update(dt, now, px, pz); },
    dispose() { if (_people) _people.dispose(); scene.remove(group); disposeGroup(group); _built = false; _cache = null; },
    people: () => _people,
    onUIEvent(eid) {
      if (eid === "talk" && arguments[1]?.personId) _talk(ctx, arguments[1].personId);
      if (eid === "haircut") _act(ctx, 500, "✂️ Fresh haircut! Hygiene +20, Fun +10", { hygiene: 20, fun: 10 });
      else if (eid === "beard_trim") _act(ctx, 300, "🧔 Beard trimmed. Hygiene +10", { hygiene: 10 });
      else if (eid === "shave") _act(ctx, 400, "🪒 Clean shave! Hygiene +25", { hygiene: 25 });
      else if (eid === "gossip") _act(ctx, 0, "🗣️ Gisted with Musa. Social +15", { social: 15 });
    },
  };
  _built = true; _cache = handle; return handle;
}

function _act(ctx, cost, msg, effects) {
  if (!ctx.game) return;
  if (ctx.game.state.money < cost) { ctx.toast("Need ₦" + cost.toLocaleString()); return; }
  ctx.game.state.money -= cost;
  for (const k of ["hunger", "fun", "social", "energy", "hygiene"]) {
    if (effects[k]) ctx.game.state.needs[k] = Math.min(100, Math.max(0, (ctx.game.state.needs[k] || 0) + effects[k]));
  }
  ctx.game.save?.(); ctx.updateHUD?.(); ctx.toast(msg);
}

function _buildBarberStation(R) {
  const g = new THREE.Group();
  // Chair (red leather barber chair)
  const chair = mergedMesh([
    box(0.8, 0.15, 0.8, 0, 0.6, 0, 0xc0392b), // seat
    box(0.8, 0.6, 0.15, 0, 0.9, -0.35, 0xc0392b), // backrest
    box(0.6, 0.05, 0.4, 0, 0.5, 0.4, 0xc0392b), // footrest
    box(0.1, 0.5, 0.1, 0, 0.25, 0, 0x4a4f55), // pedestal
    box(0.4, 0.05, 0.4, 0, 0.05, 0, 0x4a4f55), // base
  ]);
  g.add(chair);
  // Mirror (against wall)
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.5), new THREE.MeshLambertMaterial({ color: 0xc8d8e0, transparent: true, opacity: 0.6 }));
  mirror.position.set(0, 1.5, -3.9); g.add(mirror);
  // Mirror frame
  const frame = mergedMesh([box(1.4, 0.1, 0.1, 0, 2.3, -3.9, 0x5a4a30), box(1.4, 0.1, 0.1, 0, 0.7, -3.9, 0x5a4a30), box(0.1, 1.6, 0.1, -0.65, 1.5, -3.9, 0x5a4a30), box(0.1, 1.6, 0.1, 0.65, 1.5, -3.9, 0x5a4a30)]);
  g.add(frame);
  // Counter with sink
  const counter = mergedMesh([box(2, 0.9, 0.6, 0, 0.45, -2.5, 0x8a6a45), box(2, 0.1, 0.7, 0, 0.95, -2.5, 0xbfa070)]);
  g.add(counter);
  // Sink basin
  const sink = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.15, 12), new THREE.MeshLambertMaterial({ color: 0xf0f0ec }));
  sink.position.set(0, 1.0, -2.5); g.add(sink);
  // Clippers + comb on counter
  const clippers = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.3), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  clippers.position.set(-0.5, 1.05, -2.5); g.add(clippers);
  return g;
}

// ---- Talk to a person ----
function _talk(ctx, personId) {
  const handle = _cache;
  if (!handle?.people) return;
  const people = handle.people();
  if (!people) return;
  const person = people.getPersonById?.(personId);
  if (!person) return;
  const line = getNamedDialogue(person.name) || getDialogue(person.role, person.name);
  ctx.toast("💬 " + person.name + ': "' + line + '"');
  if (ctx.game) {
    ctx.game.state.needs.social = Math.min(100, (ctx.game.state.needs.social || 0) + 1);
    ctx.game.save?.();
    ctx.updateHUD?.();
  }
}
