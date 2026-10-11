// src/places/hospital.js — Barau Dikko Hospital
import * as THREE from "three";
import { box, mergedMesh, signMesh, floor, interiorLights, disposeGroup } from "./_helpers.js";
import { rng } from "../config.js";

let _built = false, _cache = null;

export async function build(scene, ctx) {
  if (_built) return _cache;
  const R = rng(20251023);
  const group = new THREE.Group();
  group.name = "hospital"; group.visible = false;

  // White tile floor
  group.add(floor(50, 40, 0xf0f0ec));
  for (let x = -23; x <= 23; x += 4) for (let z = -18; z <= 18; z += 4) {
    const tile = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.8), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    tile.rotation.x = -Math.PI / 2; tile.position.set(x, 0.01, z); group.add(tile);
  }
  // Walls (white with red cross accents)
  group.add(mergedMesh([box(50, 5, 0.4, 0, 2.5, -20, 0xffffff), box(50, 5, 0.4, 0, 2.5, 20, 0xffffff), box(0.4, 5, 40, -25, 2.5, 0, 0xffffff), box(0.4, 5, 40, 25, 2.5, 0, 0xffffff)]));
  // Reception desk
  const reception = mergedMesh([box(6, 1.1, 1, 0, 0.55, -16, 0xf4f1ea), box(6, 0.1, 1.1, 0, 1.15, -16, 0xbfa070)]);
  group.add(reception);
  // Red cross sign above reception
  const cross = _buildRedCross();
  cross.position.set(0, 3.5, -19.7); group.add(cross);
  // Hospital beds (4 in a row)
  for (let i = 0; i < 4; i++) {
    const bed = _buildBed(R); bed.position.set(-12 + i * 8, 0, -8); group.add(bed);
  }
  // IV stands next to each bed
  for (let i = 0; i < 4; i++) {
    const iv = _buildIVStand(); iv.position.set(-9 + i * 8, 0, -10); group.add(iv);
  }
  // Medicine cabinet (against north wall)
  const cabinet = mergedMesh([box(8, 3, 0.6, 0, 1.5, -19.5, 0xf4f1ea), box(8, 0.1, 0.7, 0, 3.1, -19.5, 0x8a6a45)]);
  group.add(cabinet);
  // Cabinet glass doors (dark)
  for (let i = 0; i < 4; i++) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.6, 0.05), new THREE.MeshLambertMaterial({ color: 0x9fc2d9, transparent: true, opacity: 0.4 }));
    door.position.set(-3 + i * 2, 1.5, -19.15); group.add(door);
  }
  // Doctor's desk + chair
  const desk = mergedMesh([box(3, 0.1, 1.5, 12, 0.85, 5, 0x8a6a45), box(0.1, 0.85, 0.1, 10.5, 0.42, 5, 0x5a4a30), box(0.1, 0.85, 0.1, 13.5, 0.42, 5, 0x5a4a30)]);
  group.add(desk);
  // Sign
  const sign = signMesh("BARAU DIKKO HOSPITAL", 10, 1.2, { width: 500, height: 60, bg: "#e11d48", fg: "#fff", size: 26 });
  sign.position.set(0, 5, 19.7); group.add(sign);
  // Lighting (bright clinical white)
  group.add(interiorLights({ ambient: 0.9, points: [{ x: -12, y: 4, z: -8, color: 0xffffff, intensity: 0.8, distance: 12 }, { x: -4, y: 4, z: -8, color: 0xffffff, intensity: 0.8, distance: 12 }, { x: 4, y: 4, z: -8, color: 0xffffff, intensity: 0.8, distance: 12 }, { x: 12, y: 4, z: -8, color: 0xffffff, intensity: 0.8, distance: 12 }, { x: 0, y: 4, z: 5, color: 0xffffff, intensity: 0.8, distance: 12 }] }));
  // Colliders
  const colliders = [
    { minX: -3, maxX: 3, minZ: -17, maxZ: -15 }, // reception
    { minX: -14, maxX: -10, minZ: -10, maxZ: -6 }, // bed 1
    { minX: -6, maxX: -2, minZ: -10, maxZ: -6 }, // bed 2
    { minX: 2, maxX: 6, minZ: -10, maxZ: -6 }, // bed 3
    { minX: 10, maxX: 14, minZ: -10, maxZ: -6 }, // bed 4
    { minX: -4, maxX: 4, minZ: -20, maxZ: -19 }, // cabinet
    { minX: 10.5, maxX: 13.5, minZ: 4, maxZ: 6 }, // desk
  ];
  scene.add(group);

    let _people = null;
  spawnPeople(group, [
    { id: "doctor1", name: "Dr. Okafor", role: "doctor", outfit: "casual", pose: "stand", x: 12, z: 5, ry: Math.PI, top: "#ffffff" },
    { id: "nurse1", name: "Nurse Aisha", role: "nurse", outfit: "casual", pose: "stand", x: 0, z: -16, ry: 0, top: "#e11d48", route: [{ x: 0, z: -16 }, { x: -12, z: -8 }, { x: 12, z: -8 }, { x: 0, z: 5 }], speed: 0.6 },
    { id: "patient1", name: "Patient", role: "patient", outfit: "casual", pose: "sit", x: -8, z: 10, ry: 0 },
    { id: "patient2", name: "Patient", role: "patient", outfit: "kaftan", pose: "sit", x: 8, z: 10, ry: 0 },
    { id: "patient3", name: "Patient", role: "patient", outfit: "casual", pose: "sit", x: -8, z: 14, ry: Math.PI },
    { id: "patient4", name: "Patient", role: "patient", outfit: "casual", pose: "sit", x: 8, z: 14, ry: Math.PI },
    { id: "visitor1", name: "Visitor", role: "patient", outfit: "kaftan", pose: "stand", x: 0, z: 5, ry: Math.PI, route: [{ x: 0, z: 5 }, { x: -12, z: -8 }], speed: 0.5 },
    { id: "visitor2", name: "Visitor", role: "patient", outfit: "casual", pose: "stand", x: -15, z: 0, ry: 0, route: [{ x: -15, z: 0 }, { x: 15, z: 0 }], speed: 0.4 },
  ]).then((p) => { _people = p; });

  const handle = {
    group, colliders,
    enter(ps) { ps.pos.set(0, 0, 18); ps.heading = Math.PI; },
    exit() {}, update(dt, now, px, pz) { if (_people) _people.update(dt, now, px, pz); },
    dispose() { if (_people) _people.dispose(); scene.remove(group); disposeGroup(group); _built = false; _cache = null; },
    people: () => _people,
    onUIEvent(eid) {
      if (eid === "talk" && arguments[1]?.personId) _talk(ctx, arguments[1].personId);
      if (eid === "treat") _act(ctx, 2000, "💊 Full treatment! Health restored.", { hunger: 0, fun: 0, energy: 50, social: 0, hygiene: 30, bladder: 0, _all: 100 });
      else if (eid === "checkup") _act(ctx, 500, "🩺 Checkup done. You're healthy!", {});
      else if (eid === "buy_drugs") _act(ctx, 200, "💊 Drugs bought. Hygiene +20", { hygiene: 20 });
      else if (eid === "rest") _act(ctx, 1000, "😴 Rested in ward. Energy +30", { energy: 30 });
    },
  };
  _built = true; _cache = handle; return handle;
}

function _act(ctx, cost, msg, effects) {
  if (!ctx.game) return;
  if (ctx.game.state.money < cost) { ctx.toast("Need ₦" + cost.toLocaleString()); return; }
  ctx.game.state.money -= cost;
  if (effects._all) { for (const k of ["hunger", "fun", "social", "hygiene", "bladder"]) ctx.game.state.needs[k] = Math.min(100, Math.max(0, (ctx.game.state.needs[k] || 0) + effects._all)); }
  for (const k of ["hunger", "fun", "social", "energy", "hygiene", "bladder"]) {
    if (effects[k]) ctx.game.state.needs[k] = Math.min(100, Math.max(0, (ctx.game.state.needs[k] || 0) + effects[k]));
  }
  ctx.game.save?.(); ctx.updateHUD?.(); ctx.toast(msg);
}

function _buildRedCross() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xe11d48 });
  const v = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.1), mat); g.add(v);
  const h = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.1), mat); g.add(h);
  return g;
}
function _buildBed(R) {
  return mergedMesh([
    box(2, 0.5, 1, 0, 0.3, 0, 0xf4f1ea), // frame
    box(2, 0.15, 1, 0, 0.6, 0, 0xffffff), // mattress
    box(0.5, 0.1, 0.8, -0.7, 0.65, 0, 0xb0d8e0), // pillow
    box(0.1, 0.5, 0.1, -0.95, 0.05, -0.45, 0x4a4f55), // legs
    box(0.1, 0.5, 0.1, 0.95, 0.05, -0.45, 0x4a4f55),
    box(0.1, 0.5, 0.1, -0.95, 0.05, 0.45, 0x4a4f55),
    box(0.1, 0.5, 0.1, 0.95, 0.05, 0.45, 0x4a4f55),
    box(2, 0.4, 0.1, 0, 0.8, 0.5, 0xf4f1ea), // headboard
  ]);
}
function _buildIVStand() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2, 6), new THREE.MeshLambertMaterial({ color: 0x4a4f55 }));
  pole.position.y = 1; g.add(pole);
  const bag = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshLambertMaterial({ color: 0xb0d8e0, transparent: true, opacity: 0.7 }));
  bag.scale.y = 1.5; bag.position.y = 1.8; g.add(bag);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.1, 8), new THREE.MeshLambertMaterial({ color: 0x4a4f55 }));
  base.position.y = 0.05; g.add(base);
  return g;
}
