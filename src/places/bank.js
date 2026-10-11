// src/places/bank.js — First Bank Kaduna branch
import * as THREE from "three";
import { box, mergedMesh, signMesh, floor, interiorLights, disposeGroup } from "./_helpers.js";
import { rng } from "../config.js";
import { spawnPeople, getNamedDialogue, getDialogue } from "./people.js";

let _built = false, _cache = null;

export async function build(scene, ctx) {
  if (_built) return _cache;
  const R = rng(20251024);
  const group = new THREE.Group();
  group.name = "bank"; group.visible = false;

  // Marble floor (light gray with pattern)
  group.add(floor(45, 35, 0xd8d4c8));
  for (let x = -20; x <= 20; x += 5) for (let z = -15; z <= 15; z += 5) {
    const tile = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.5), new THREE.MeshLambertMaterial({ color: 0xe8e4d8 }));
    tile.rotation.x = -Math.PI / 2; tile.position.set(x, 0.01, z); group.add(tile);
  }
  // Walls (cream with dark green trim)
  group.add(mergedMesh([box(45, 5, 0.4, 0, 2.5, -17, 0xf4f1ea), box(45, 5, 0.4, 0, 2.5, 17, 0xf4f1ea), box(0.4, 5, 35, -22, 2.5, 0, 0xf4f1ea), box(0.4, 5, 35, 22, 2.5, 0, 0xf4f1ea), box(45, 0.3, 0.4, 0, 4.85, -17, 0x1a5a3a), box(45, 0.3, 0.4, 0, 4.85, 17, 0x1a5a3a)]));
  // Teller counters (4 along north wall)
  for (let i = 0; i < 4; i++) {
    const teller = mergedMesh([box(4, 1.2, 1.2, -12 + i * 8, 0.6, -14, 0x8a6a45), box(4, 0.1, 1.3, -12 + i * 8, 1.25, -14, 0x5a4a30), box(4, 0.8, 0.1, -12 + i * 8, 1.7, -13.4, 0x9fc2d9)]);
    group.add(teller);
    // "Teller N" sign
    const sign = signMesh("TELLER " + (i + 1), 2, 0.4, { width: 120, height: 24, bg: "#1a5a3a", fg: "#fff", size: 16, border: false });
    sign.position.set(-12 + i * 8, 2.5, -13.3); group.add(sign);
  }
  // ATM machines (2, against west wall)
  for (let i = 0; i < 2; i++) {
    const atm = mergedMesh([box(1.5, 2.5, 1, -21, 1.25, -5 + i * 4, 0x4a6177), box(1.2, 1, 0.1, -20.4, 1.5, -5 + i * 4, 0x1a1a2a), box(0.3, 0.2, 0.05, -20.4, 1.3, -5 + i * 4, 0x2a8a5a)]);
    group.add(atm);
  }
  // Waiting chairs (row in center)
  for (let i = 0; i < 5; i++) {
    const chair = mergedMesh([box(0.6, 0.05, 0.6, -6 + i * 3, 0.5, 5, 0x1a5a3a), box(0.6, 0.4, 0.1, -6 + i * 3, 0.7, 4.7, 0x1a5a3a), box(0.1, 0.5, 0.1, -6 + i * 3 - 0.25, 0.25, 5.2, 0x4a4f55), box(0.1, 0.5, 0.1, -6 + i * 3 + 0.25, 0.25, 5.2, 0x4a4f55)]);
    group.add(chair);
  }
  // Vault door (decorative, against east wall)
  const vault = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.4, 16), new THREE.MeshStandardMaterial({ color: 0x6a7078, metalness: 0.8, roughness: 0.3 }));
  vault.rotation.z = Math.PI / 2; vault.position.set(21.5, 2, 0); group.add(vault);
  // Vault wheel
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.08, 8, 16), new THREE.MeshStandardMaterial({ color: 0x4a4f55, metalness: 0.7, roughness: 0.3 }));
  wheel.position.set(21.3, 2, 0); wheel.rotation.y = Math.PI / 2; group.add(wheel);
  // Sign
  const sign = signMesh("FIRST BANK — KADUNA", 10, 1.2, { width: 500, height: 60, bg: "#1a5a3a", fg: "#fff", size: 26 });
  sign.position.set(0, 5, 16.7); group.add(sign);
  // Lighting (bright office)
  group.add(interiorLights({ ambient: 0.85, points: [{ x: -12, y: 4, z: -10, color: 0xfff0e0, intensity: 0.8, distance: 12 }, { x: -4, y: 4, z: -10, color: 0xfff0e0, intensity: 0.8, distance: 12 }, { x: 4, y: 4, z: -10, color: 0xfff0e0, intensity: 0.8, distance: 12 }, { x: 12, y: 4, z: -10, color: 0xfff0e0, intensity: 0.8, distance: 12 }, { x: 0, y: 4, z: 5, color: 0xfff0e0, intensity: 0.8, distance: 12 }] }));
  // Colliders
  const colliders = [
    { minX: -14, maxX: -10, minZ: -15, maxZ: -13 }, { minX: -6, maxX: -2, minZ: -15, maxZ: -13 },
    { minX: 2, maxX: 6, minZ: -15, maxZ: -13 }, { minX: 10, maxX: 14, minZ: -15, maxZ: -13 },
    { minX: -21.5, maxX: -20, minZ: -6, maxZ: -4 }, { minX: -21.5, maxX: -20, minZ: -2, maxZ: 2 },
    { minX: 21, maxX: 22, minZ: -2, maxZ: 2 }, // vault
  ];
  scene.add(group);

    let _people = null;
  spawnPeople(group, [
    { id: "teller1", name: "Mr. Bello", role: "teller", outfit: "casual", pose: "stand", x: -12, z: -14, ry: Math.PI, top: "#1a5a3a" },
    { id: "teller2", name: "Teller", role: "teller", outfit: "casual", pose: "stand", x: -4, z: -14, ry: Math.PI, top: "#1a5a3a" },
    { id: "teller3", name: "Teller", role: "teller", outfit: "casual", pose: "stand", x: 4, z: -14, ry: Math.PI, top: "#1a5a3a" },
    { id: "teller4", name: "Teller", role: "teller", outfit: "casual", pose: "stand", x: 12, z: -14, ry: Math.PI, top: "#1a5a3a" },
    { id: "manager1", name: "Mrs. Okon", role: "branch manager", outfit: "casual", pose: "stand", x: 0, z: 0, ry: Math.PI, top: "#7a3b8f" },
    { id: "queue1", name: "Customer", role: "customer", outfit: "casual", pose: "stand", x: -6, z: 5, ry: 0 },
    { id: "queue2", name: "Customer", role: "customer", outfit: "kaftan", pose: "stand", x: -6, z: 5.7, ry: 0 },
    { id: "queue3", name: "Customer", role: "customer", outfit: "casual", pose: "stand", x: -6, z: 6.4, ry: 0 },
  ]).then((p) => { _people = p; });

  const handle = {
    group, colliders,
    enter(ps) { ps.pos.set(0, 0, 15); ps.heading = Math.PI; },
    exit() {}, update(dt, now, px, pz) { if (_people) _people.update(dt, now, px, pz); },
    dispose() { if (_people) _people.dispose(); scene.remove(group); disposeGroup(group); _built = false; _cache = null; },
    people: () => _people,
    onUIEvent(eid) {
      if (eid === "talk" && arguments[1]?.personId) _talk(ctx, arguments[1].personId);
      if (eid === "deposit") _act(ctx, 0, "🏦 Money deposited safely.", { _msg: "deposit" });
      else if (eid === "withdraw") _act(ctx, 0, "💸 Money withdrawn.", { _msg: "withdraw" });
      else if (eid === "loan") _act(ctx, 0, "📋 Loan application submitted. ₦50,000 approved!", { _msg: "loan" });
      else if (eid === "transfer") _act(ctx, 0, "💸 Transfer initiated. Enter recipient.", { _msg: "transfer" });
    },
  };
  _built = true; _cache = handle; return handle;
}

function _act(ctx, cost, msg, effects) {
  if (!ctx.game) return;
  if (effects._msg === "loan") { ctx.game.state.money += 50000; ctx.toast(msg); ctx.updateHUD?.(); return; }
  if (effects._msg === "deposit" || effects._msg === "withdraw" || effects._msg === "transfer") { ctx.toast(msg); return; }
  ctx.toast(msg);
}
