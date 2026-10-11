// src/places/nightclub.js — Kajuru Nightclub
import * as THREE from "three";
import { box, mergedMesh, signMesh, floor, interiorLights, disposeGroup } from "./_helpers.js";
import { rng } from "../config.js";

let _built = false, _cache = null;
const _state = { lights: [], t: 0 };

export async function build(scene, ctx) {
  if (_built) return _cache;
  const R = rng(20251029);
  const group = new THREE.Group();
  group.name = "nightclub"; group.visible = false;

  // Dark dance floor (glossy black)
  group.add(floor(40, 30, 0x0a0a14));
  // Dance floor with LED grid
  const danceFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 10),
    new THREE.MeshBasicMaterial({ color: 0x111122 })
  );
  danceFloor.rotation.x = -Math.PI / 2; danceFloor.position.set(0, 0.01, 0); group.add(danceFloor);
  // LED tiles on the dance floor (animated colors)
  const ledColors = [0xff0066, 0x00ff66, 0x0066ff, 0xffff00, 0xff00ff, 0x00ffff];
  const ledTiles = [];
  for (let x = -5; x <= 5; x += 1.5) for (let z = -4; z <= 4; z += 1.5) {
    const tile = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.4),
      new THREE.MeshBasicMaterial({ color: 0x222244 })
    );
    tile.rotation.x = -Math.PI / 2;
    tile.position.set(x, 0.02, z);
    group.add(tile);
    ledTiles.push(tile);
  }
  _state.ledTiles = ledTiles;
  // Walls (dark with neon accents)
  group.add(mergedMesh([box(40, 5, 0.4, 0, 2.5, -15, 0x1a0a2a), box(40, 5, 0.4, 0, 2.5, 15, 0x1a0a2a), box(0.4, 5, 30, -20, 2.5, 0, 0x1a0a2a), box(0.4, 5, 30, 20, 2.5, 0, 0x1a0a2a)]));
  // Neon strips on walls (animated colors)
  for (let i = 0; i < 8; i++) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(8, 0.15, 0.05), new THREE.MeshBasicMaterial({ color: ledColors[i % ledColors.length] }));
    strip.position.set(-8 + (i % 4) * 5, 1 + Math.floor(i / 4) * 2.5, i < 4 ? -14.7 : 14.7);
    if (i >= 4) strip.rotation.y = Math.PI;
    group.add(strip);
    _state.lights.push({ mesh: strip, baseColor: ledColors[i % ledColors.length] });
  }
  // DJ booth (elevated platform at north)
  const djBooth = mergedMesh([box(5, 1.2, 2, 0, 0.6, -10, 0x222230), box(5, 0.1, 2, 0, 1.25, -10, 0x4a4f55), box(0.4, 0.5, 0.4, -1.5, 1.5, -10, 0x222230), box(0.4, 0.5, 0.4, 1.5, 1.5, -10, 0x222230)]);
  group.add(djBooth);
  // DJ equipment (turntables + mixer)
  for (const tx of [-1.2, 1.2]) {
    const turntable = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.4 }));
    turntable.position.set(tx, 1.35, -10); group.add(turntable);
  }
  const mixer = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 0.4), new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.5, roughness: 0.5 }));
  mixer.position.set(0, 1.35, -10); group.add(mixer);
  // DJ booth neon sign
  const djSign = signMesh("DJ ZEE", 3, 0.8, { width: 200, height: 50, bg: "#000", fg: "#ff00ff", size: 28, border: false });
  djSign.position.set(0, 2.5, -10); group.add(djSign);
  // Bar counter (south side)
  const bar = mergedMesh([box(12, 1.2, 0.8, 0, 0.6, 12, 0x222230), box(12, 0.1, 0.9, 0, 1.25, 12, 0x4a4f55)]);
  group.add(bar);
  // Bar stools (5)
  for (let i = 0; i < 5; i++) {
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.7, 8), new THREE.MeshLambertMaterial({ color: 0x6b21a8 }));
    stool.position.set(-5 + i * 2.5, 0.35, 10.8); group.add(stool);
  }
  // Bottles behind the bar
  for (let i = 0; i < 12; i++) {
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.4, 6), new THREE.MeshLambertMaterial({ color: [0x2e7d4f, 0xc0392b, 0xf2b134, 0x1d5fa8, 0x7a3b8f][i % 5] }));
    bottle.position.set(-5 + i * 1, 1.6, 11.6); group.add(bottle);
  }
  // VIP area (raised platform, east corner)
  const vipPlatform = mergedMesh([box(6, 0.3, 5, 15, 0.15, -8, 0x1a0a2a), box(6, 0.05, 5, 15, 0.32, -8, 0x4a4f55)]);
  group.add(vipPlatform);
  // VIP couch (purple leather)
  const vipCouch = mergedMesh([box(4, 0.5, 1.5, 15, 0.8, -7, 0x6b21a8), box(4, 0.6, 0.3, 15, 1.1, -7.6, 0x6b21a8)]);
  group.add(vipCouch);
  // VIP rope
  const rope = mergedMesh([box(0.05, 1, 0.05, 12, 0.5, -5, 0xf2b134), box(0.05, 1, 0.05, 18, 0.5, -5, 0xf2b134), box(6, 0.03, 0.03, 15, 1, -5, 0xf2b134)]);
  group.add(rope);
  // Disco ball (hanging from ceiling)
  const discoBall = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 2), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.1 }));
  discoBall.position.set(0, 4.5, 0); group.add(discoBall);
  _state.discoBall = discoBall;
  // Spotlight cones (visual, pointing at the dance floor)
  for (let i = 0; i < 4; i++) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.5, 4, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: ledColors[i], transparent: true, opacity: 0.15, side: THREE.DoubleSide })
    );
    cone.position.set(-5 + i * 3.3, 4, 0);
    cone.rotation.x = Math.PI;
    group.add(cone);
    _state.lights.push({ mesh: cone, baseColor: ledColors[i] });
  }
  // Sign
  const sign = signMesh("KAJURU NIGHTCLUB", 8, 1.2, { width: 400, height: 60, bg: "#000", fg: "#ff00ff", size: 28, border: false });
  sign.position.set(0, 5, 14.7); group.add(sign);
  // Lighting (dark + colored spots)
  group.add(interiorLights({ ambient: 0.15, points: [{ x: 0, y: 4, z: 0, color: 0xff00ff, intensity: 0.5, distance: 15 }, { x: -5, y: 4, z: 0, color: 0x00ffff, intensity: 0.4, distance: 12 }, { x: 5, y: 4, z: 0, color: 0xffff00, intensity: 0.4, distance: 12 }, { x: 0, y: 3, z: 12, color: 0xff0066, intensity: 0.3, distance: 10 }, { x: 15, y: 3, z: -8, color: 0xff00ff, intensity: 0.3, distance: 8 }] }));
  // Colliders
  const colliders = [
    { minX: -3, maxX: 3, minZ: -11, maxZ: -9 }, // DJ booth
    { minX: -7, maxX: 7, minZ: 11, maxZ: 13 }, // bar
    { minX: 12, maxX: 18, minZ: -10, maxZ: -6 }, // VIP
    { minX: 11.5, maxX: 12.5, minZ: -6, maxZ: -4 }, // rope post 1
    { minX: 17.5, maxX: 18.5, minZ: -6, maxZ: -4 }, // rope post 2
  ];
  scene.add(group);

  const handle = {
    group, colliders,
    enter(ps) { ps.pos.set(0, 0, 13); ps.heading = Math.PI; },
    exit() {}, update(dt) {
      _state.t += dt;
      // Animate LED tiles
      if (_state.ledTiles) {
        for (let i = 0; i < _state.ledTiles.length; i++) {
          const phase = _state.t * 2 + i * 0.3;
          const c = Math.floor(phase) % 6;
          _state.ledTiles[i].material.color.setHex([0xff0066, 0x00ff66, 0x0066ff, 0xffff00, 0xff00ff, 0x00ffff][c]);
        }
      }
      // Rotate disco ball
      if (_state.discoBall) _state.discoBall.rotation.y += dt * 1.5;
      // Animate neon strips + spotlight cones
      for (const L of _state.lights) {
        L.mesh.material.color.setHex(L.baseColor);
        // Pulse opacity for cones
        if (L.mesh.geometry.type === "ConeGeometry") {
          L.mesh.material.opacity = 0.1 + Math.sin(_state.t * 3 + L.mesh.position.x) * 0.05;
        }
      }
    },
    dispose() { scene.remove(group); disposeGroup(group); _built = false; _cache = null; _state.lights = []; _state.ledTiles = null; _state.discoBall = null; },
    onUIEvent(eid) {
      if (eid === "dance") _act(ctx, 1000, "🪩 Danced all night! Fun +30", { fun: 30, energy: -10, social: 10 });
      else if (eid === "buy_drink") _act(ctx, 500, "🍹 Bought a drink. Social +10", { social: 10, fun: 5 });
      else if (eid === "socialize") _act(ctx, 0, "💬 Socialized. Social +20", { social: 20 });
      else if (eid === "vip") _act(ctx, 5000, "👑 VIP table! Fun +40, Social +30", { fun: 40, social: 30 });
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
