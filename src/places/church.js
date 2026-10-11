// src/places/church.js — St. Bartholomew's Church
import * as THREE from "three";
import { box, mergedMesh, signMesh, floor, interiorLights, disposeGroup } from "./_helpers.js";
import { rng } from "../config.js";

let _built = false, _cache = null;

export async function build(scene, ctx) {
  if (_built) return _cache;
  const R = rng(20251027);
  const group = new THREE.Group();
  group.name = "church"; group.visible = false;

  // Stone tile floor
  group.add(floor(40, 30, 0xc8c2b0));
  // Walls (cream stone)
  group.add(mergedMesh([box(40, 6, 0.4, 0, 3, -15, 0xf4f1ea), box(40, 6, 0.4, 0, 3, 15, 0xf4f1ea), box(0.4, 6, 30, -20, 3, 0, 0xf4f1ea), box(0.4, 6, 30, 20, 3, 0, 0xf4f1ea)]));
  // Altar (raised platform at north)
  const altar = mergedMesh([box(8, 0.4, 4, 0, 0.2, -11, 0xd4c5a0), box(2, 1, 0.8, 0, 0.9, -12, 0xbfa070)]);
  group.add(altar);
  // Cross on the wall behind altar
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2, 0.1), new THREE.MeshBasicMaterial({ color: 0xf2b134 }));
  crossV.position.set(0, 4, -14.7); group.add(crossV);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 0.1), new THREE.MeshBasicMaterial({ color: 0xf2b134 }));
  crossH.position.set(0, 4.4, -14.7); group.add(crossH);
  // Pulpit
  const pulpit = mergedMesh([box(1.5, 1.2, 1, 5, 0.6, -12, 0x8a6a45), box(1.5, 0.1, 1, 5, 1.25, -12, 0xbfa070)]);
  group.add(pulpit);
  // Wooden pews (8 rows × 6 pews each)
  for (let row = 0; row < 8; row++) {
    const z = -5 + row * 2;
    for (let i = 0; i < 6; i++) {
      const pew = mergedMesh([
        box(1.5, 0.1, 0.5, -7.5 + i * 3, 0.5, z, 0x8a6a45), // seat
        box(1.5, 0.5, 0.1, -7.5 + i * 3, 0.7, z - 0.2, 0x8a6a45), // backrest
        box(0.1, 0.5, 0.1, -8.2 + i * 3, 0.25, z, 0x5a4a30), // legs
        box(0.1, 0.5, 0.1, -6.8 + i * 3, 0.25, z, 0x5a4a30),
      ]);
      group.add(pew);
    }
  }
  // Stained glass windows (3 on each side wall)
  const glassColors = [0xc0392b, 0x1d5fa8, 0xf2b134, 0x2e7d4f, 0x7a3b8f, 0xe67e22];
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -19.7 : 19.7;
    const z = -10 + (i % 3) * 8;
    const w = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 4),
      new THREE.MeshBasicMaterial({ color: glassColors[i], transparent: true, opacity: 0.7 })
    );
    w.position.set(side, 3, z);
    if (i >= 3) w.rotation.y = Math.PI;
    group.add(w);
  }
  // Ceiling fan
  const fan = new THREE.Group();
  const fanMotor = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 8), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  fanMotor.position.y = 5.7; fan.add(fanMotor);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.15), new THREE.MeshLambertMaterial({ color: 0xc8b890 }));
    blade.position.y = 5.65; blade.rotation.y = (i * Math.PI) / 2; blade.translateX(0.9);
    fan.add(blade);
  }
  group.add(fan);
  // Sign
  const sign = signMesh("ST. BARTHOLOMEW'S CHURCH", 10, 1.2, { width: 500, height: 60, bg: "#c8b890", fg: "#1a1a2e", size: 26 });
  sign.position.set(0, 6, 14.7); group.add(sign);
  // Lighting (warm calm)
  group.add(interiorLights({ ambient: 0.6, points: [{ x: 0, y: 5, z: -11, color: 0xfff0e0, intensity: 0.6, distance: 12 }, { x: 0, y: 5, z: 0, color: 0xfff0e0, intensity: 0.6, distance: 14 }, { x: 0, y: 5, z: 10, color: 0xfff0e0, intensity: 0.5, distance: 12 }] }));
  // Colliders
  const colliders = [
    { minX: -4, maxX: 4, minZ: -13, maxZ: -9 }, // altar
    { minX: 4, maxX: 6, minZ: -13, maxZ: -11 }, // pulpit
  ];
  scene.add(group);

  const handle = {
    group, colliders,
    enter(ps) { ps.pos.set(0, 0, 13); ps.heading = Math.PI; },
    exit() {}, update() {},
    dispose() { scene.remove(group); disposeGroup(group); _built = false; _cache = null; },
    onUIEvent(eid) {
      if (eid === "pray_church") _act(ctx, 0, "🙏 Prayed. Mood +25, Social +10", { fun: 25, social: 10 });
      else if (eid === "attend_service") _act(ctx, 0, "⛪ Attended service. Mood +30", { fun: 30, social: 15 });
      else if (eid === "choir") _act(ctx, 0, "🎵 Choir practice! Fun +15, Social +15", { fun: 15, social: 15 });
      else if (eid === "donate") _act(ctx, 500, "💖 Donated ₦500. Mood +20", { fun: 20 });
    },
  };
  _built = true; _cache = handle; return handle;
}

function _act(ctx, cost, msg, effects) {
  if (!ctx.game) return;
  if (ctx.game.state.money < cost) { ctx.toast("Need ₦" + cost.toLocaleString()); return; }
  ctx.game.state.money -= cost;
  for (const k of ["hunger", "fun", "social", "energy"]) {
    if (effects[k]) ctx.game.state.needs[k] = Math.min(100, Math.max(0, (ctx.game.state.needs[k] || 0) + effects[k]));
  }
  ctx.game.save?.(); ctx.updateHUD?.(); ctx.toast(msg);
}
