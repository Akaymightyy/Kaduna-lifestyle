// src/places/stadium.js — Ahmadu Bello Stadium
import * as THREE from "three";
import { box, mergedMesh, signMesh, floor, interiorLights, disposeGroup } from "./_helpers.js";
import { rng } from "../config.js";
import { spawnPeople, getNamedDialogue, getDialogue } from "./people.js";

let _built = false, _cache = null;

export async function build(scene, ctx) {
  if (_built) return _cache;
  const R = rng(20251025);
  const group = new THREE.Group();
  group.name = "stadium"; group.visible = false;

  // Grass pitch
  const pitch = floor(80, 60, 0x3a7a2a);
  group.add(pitch);
  // Field markings
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  // Boundary
  const boundary = new THREE.Mesh(new THREE.RingGeometry(28, 28.3, 4, 1, 0, Math.PI * 2), lineMat);
  boundary.rotation.x = -Math.PI / 2; boundary.scale.set(1.3, 1, 1); boundary.position.y = 0.02;
  group.add(boundary);
  // Center circle
  const cc = new THREE.Mesh(new THREE.RingGeometry(5, 5.2, 24), lineMat);
  cc.rotation.x = -Math.PI / 2; cc.position.y = 0.02; group.add(cc);
  // Center line
  const cl = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 50), lineMat);
  cl.rotation.x = -Math.PI / 2; cl.position.y = 0.02; group.add(cl);
  // Goalposts (both ends)
  for (const gx of [-35, 35]) {
    for (const gz of [-5, 5]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 4, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }));
      p.position.set(gx, 2, gz); group.add(p);
    }
    const cb = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 10, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    cb.rotation.x = Math.PI / 2; cb.position.set(gx, 4, 0); group.add(cb);
  }
  // Tiered seating (4 sides, raised)
  for (const [side, rotY] of [[0, 0], [Math.PI, 0]]) {
    for (let row = 0; row < 6; row++) {
      const seatRow = mergedMesh([]);
      // Build a row of seats
      const parts = [];
      for (let i = 0; i < 20; i++) {
        parts.push(box(1.2, 0.4, 0.8, -30 + i * 3, 0.5 + row * 0.6, side > 0 ? (20 + row * 1.2) : -(20 + row * 1.2), [0xc0392b, 0x1d5fa8, 0xf2b134, 0x2e7d4f, 0x7a3b8f, 0xe11d48][row % 6]));
      }
      group.add(mergedMesh(parts));
    }
  }
  // Side seating (left and right)
  for (const sideX of [-1, 1]) {
    for (let row = 0; row < 6; row++) {
      const parts = [];
      for (let i = 0; i < 14; i++) {
        parts.push(box(0.8, 0.4, 1.2, sideX * (22 + row * 1.2), 0.5 + row * 0.6, -18 + i * 3, [0xc0392b, 0x1d5fa8, 0xf2b134, 0x2e7d4f, 0x7a3b8f, 0xe11d48][row % 6]));
      }
      group.add(mergedMesh(parts));
    }
  }
  // Floodlight towers (4 corners)
  for (const [fx, fz] of [[-35, -25], [35, -25], [-35, 25], [35, 25]]) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 12, 8), new THREE.MeshLambertMaterial({ color: 0x4a4f55 }));
    tower.position.set(fx, 6, fz); group.add(tower);
    // Light panel
    const panel = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 0.2), new THREE.MeshBasicMaterial({ color: 0xfff0b0 }));
    panel.position.set(fx, 12, fz); group.add(panel);
    // Actual light
    const pl = new THREE.PointLight(0xfff0b0, 0, 40, 2.0);
    pl.position.set(fx, 12, fz); group.add(pl);
    if (!group.userData.floodLights) group.userData.floodLights = [];
    group.userData.floodLights.push(pl);
  }
  // Scoreboard
  const scoreboard = signMesh("KADUNA UTD 2 - 1 RANGERS", 8, 1.5, { width: 400, height: 75, bg: "#222", fg: "#f2b134", size: 28 });
  scoreboard.position.set(0, 8, -28); group.add(scoreboard);
  // Entrance sign
  const sign = signMesh("AHMADU BELLO STADIUM", 10, 1.5, { width: 500, height: 75, bg: "#2e7d4f", fg: "#fff", size: 30 });
  sign.position.set(0, 5, 28); group.add(sign);
  // Lighting
  group.add(interiorLights({ ambient: 0.7, points: [{ x: 0, y: 8, z: 0, color: 0xfff0e0, intensity: 0.5, distance: 30 }] }));
  // Colliders
  const colliders = [
    { minX: -36, maxX: -34, minZ: -6, maxZ: 6 }, // goal 1
    { minX: 34, maxX: 36, minZ: -6, maxZ: 6 }, // goal 2
  ];
  scene.add(group);

    let _people = null;
  const _players = [];
  for (let i = 0; i < 5; i++) {
    _players.push({ id: "p_red_" + i, name: "Player", role: "footballer", outfit: "casual", pose: "stand", x: -10 + i * 5, z: 0 + (i % 2 ? 3 : -3), ry: 0, top: "#c0392b", route: [{ x: -10 + i * 5, z: i % 2 ? 3 : -3 }, { x: -10 + i * 5, z: i % 2 ? -3 : 3 }], speed: 1.0 + i * 0.2 });
  }
  for (let i = 0; i < 5; i++) {
    _players.push({ id: "p_blue_" + i, name: "Player", role: "footballer", outfit: "casual", pose: "stand", x: 10 - i * 5, z: 0 + (i % 2 ? -3 : 3), ry: Math.PI, top: "#1d5fa8", route: [{ x: 10 - i * 5, z: i % 2 ? -3 : 3 }, { x: 10 - i * 5, z: i % 2 ? 3 : -3 }], speed: 1.0 + i * 0.2 });
  }
  spawnPeople(group, [
    { id: "coach1", name: "Coach Daniel", role: "coach", outfit: "casual", pose: "stand", x: -25, z: 0, ry: Math.PI / 2, top: "#2e7d4f" },
    ..._players,
    { id: "spec1", name: "Spectator", role: "footballer", outfit: "casual", pose: "sit", x: -15, z: 22, ry: 0, top: "#f2b134" },
    { id: "spec2", name: "Spectator", role: "footballer", outfit: "kaftan", pose: "sit", x: 0, z: 22, ry: 0 },
    { id: "spec3", name: "Spectator", role: "footballer", outfit: "casual", pose: "sit", x: 15, z: 22, ry: 0, top: "#c0392b" },
  ]).then((p) => { _people = p; });

  const handle = {
    group, colliders,
    enter(ps) { ps.pos.set(0, 0, 25); ps.heading = Math.PI; },
    exit() {}, update(dt, now, px, pz) { if (_people) _people.update(dt, now, px, pz); },
    dispose() { if (_people) _people.dispose(); scene.remove(group); disposeGroup(group); _built = false; _cache = null; },
    people: () => _people,
    onUIEvent(eid) {
      if (eid === "talk" && arguments[1]?.personId) _talk(ctx, arguments[1].personId);
      if (eid === "watch_match") _act(ctx, 500, "⚽ Watched the match! Fun +30", { fun: 30, social: 5 });
      else if (eid === "play_match") _act(ctx, 0, "⚽ You scored! Earned ₦1000", { fun: 20, energy: -20, _earn: 1000 });
      else if (eid === "buy_ticket") _act(ctx, 5000, "🎟️ Season ticket bought! Discounts unlocked.", { fun: 10 });
      else if (eid === "buy_snacks") _act(ctx, 300, "🍿 Snacks! Hunger +20", { hunger: 20 });
    },
  };
  _built = true; _cache = handle; return handle;
}

function _act(ctx, cost, msg, effects) {
  if (!ctx.game) return;
  if (effects._earn) { ctx.game.state.money += effects._earn; }
  else { if (ctx.game.state.money < cost) { ctx.toast("Need ₦" + cost.toLocaleString()); return; } ctx.game.state.money -= cost; }
  for (const k of ["hunger", "fun", "social", "energy"]) {
    if (effects[k]) ctx.game.state.needs[k] = Math.min(100, Math.max(0, (ctx.game.state.needs[k] || 0) + effects[k]));
  }
  ctx.game.save?.(); ctx.updateHUD?.(); ctx.toast(msg);
}
