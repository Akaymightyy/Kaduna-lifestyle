// src/places/arena.js — Kaduna Arena (Social Game Hub).
//
// A lively entertainment area where players meet, chat, and play
// mini-games together. Inspired by MyAbujaLife's "Farm City" arena.
//
// Layout: indoor hall with:
//   - 2 bowling lanes (visual only — scoring system can be added later)
//   - 1 pool table (visual)
//   - 3 arcade machines (visual)
//   - Okada Dash screen (visual — endless runner cabinet)
//   - Benches + plants for hanging out
//   - Staff NPC "Attendant" at the entrance
//
// MVP: the visuals are there. Actual game mechanics (rolling a bowling
// ball, shooting pool, playing arcade) can be plugged in later as
// separate game modules that hook into the existing challenge_system.

import * as THREE from "three";
import { box, mergedMesh, signMesh, floor, interiorLights, disposeGroup } from "./_helpers.js";
import { rng } from "../config.js";
import { spawnPeople } from "./people.js";

let _built = false, _cache = null;

export async function build(scene, ctx) {
  if (_built) return _cache;
  const R = rng(20251021);
  const group = new THREE.Group();
  group.name = "arena";
  group.visible = false;

  // ---- Floor: polished concrete with lane markers ----
  group.add(floor(50, 40, 0x2a2a2a, 9));
  // Bowling lane wood flooring (2 strips)
  for (let li = 0; li < 2; li++) {
    const laneX = -15 + li * 30;
    const laneFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 25),
      new THREE.MeshLambertMaterial({ color: 0xd4a96a })
    );
    laneFloor.rotation.x = -Math.PI / 2;
    laneFloor.position.set(laneX, 0.01, -5);
    group.add(laneFloor);
  }

  // ---- Walls: opaque on all 4 sides ----
  group.add(mergedMesh([
    box(50, 5, 0.3, 0, 2.5, -20, 0x1a3b4a),
    box(0.3, 5, 40, -25, 2.5, 0, 0x1a3b4a),
    box(0.3, 5, 40, 25, 2.5, 0, 0x1a3b4a),
    // South wall split for entrance
    box(22, 5, 0.3, -14, 2.5, 20, 0x1a3b4a),
    box(22, 5, 0.3, 14, 2.5, 20, 0x1a3b4a),
  ]));
  // Gold door frame
  group.add(mergedMesh([
    box(0.2, 5, 0.2, -2.5, 2.5, 20, 0xf2b134),
    box(0.2, 5, 0.2, 2.5, 2.5, 20, 0xf2b134),
    box(5, 0.2, 0.2, 0, 5, 20, 0xf2b134),
  ]));
  // Roof
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(50, 0.2, 40),
    new THREE.MeshLambertMaterial({ color: 0x1a1a2a })
  );
  roof.position.set(0, 5.1, 0);
  group.add(roof);
  // Roof trim
  for (const [x, z, w, d] of [[0, -20, 50.2, 0.2], [0, 20, 50.2, 0.2], [-25, 0, 0.2, 40.2], [25, 0, 0.2, 40.2]]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), new THREE.MeshBasicMaterial({ color: 0xf2b134 }));
    trim.position.set(x, 5.05, z);
    group.add(trim);
  }

  // ---- Neon sign above entrance ----
  const sign = signMesh("KADUNA ARENA", 14, 1.8, {
    bg: "#0a0a1a", fg: "#f2b134", size: 78, border: true,
  });
  sign.position.set(0, 5.5, 19.95);
  sign.material.side = THREE.DoubleSide;
  group.add(sign);
  const subSign = signMesh("Games · Bowling · Pool · Arcade", 10, 0.5, {
    bg: "#0a0a1a", fg: "#9ec9b0", size: 18, border: false,
  });
  subSign.position.set(0, 4.2, 19.95);
  subSign.material.side = THREE.DoubleSide;
  group.add(subSign);

  // ---- Lighting: bright + warm ----
  group.add(interiorLights({ ambient: 0.9 }));
  // Neon strip lights (coloured — arcade vibe)
  const stripColors = [0xff2a6d, 0x05d9e8, 0xd1f7ff, 0xf2b134];
  for (let i = 0; i < 4; i++) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.06, 0.3),
      new THREE.MeshBasicMaterial({ color: stripColors[i] })
    );
    strip.position.set(-15 + i * 10, 4.8, 0);
    group.add(strip);
  }

  // ---- 2 Bowling lanes (visual: pins + gutter + ball return) ----
  for (let li = 0; li < 2; li++) {
    const laneX = -15 + li * 30;
    // Pin deck (10 pins in triangle formation)
    const pinMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const pinGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.5, 8);
    for (let row = 0; row < 4; row++) {
      for (let p = 0; p <= row; p++) {
        const pin = new THREE.Mesh(pinGeo, pinMat);
        pin.position.set(laneX + (p - row / 2) * 0.6, 0.25, -15 + row * 0.6);
        group.add(pin);
      }
    }
    // Red pin ring (accent)
    const ringMat = new THREE.MeshLambertMaterial({ color: 0xe11d48 });
    for (let row = 0; row < 4; row++) {
      for (let p = 0; p <= row; p++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 12), ringMat);
        ring.position.set(laneX + (p - row / 2) * 0.6, 0.12, -15 + row * 0.6);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
      }
    }
    // Lane sign
    const laneSign = signMesh("LANE " + (li + 1), 3, 0.5, {
      bg: "#1a1a1a", fg: "#f2b134", size: 16, border: false,
    });
    laneSign.position.set(laneX, 0.2, 8);
    group.add(laneSign);
    // Ball return (visual)
    const ballReturn = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.5, 1),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    ballReturn.position.set(laneX, 0.25, 7);
    group.add(ballReturn);
    // Bowling ball on the return
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0x1a1a8a, roughness: 0.3 })
    );
    ball.position.set(laneX, 0.6, 7);
    group.add(ball);
  }

  // ---- Pool table (centre) ----
  const poolTop = new THREE.Mesh(
    new THREE.BoxGeometry(3, 0.1, 1.5),
    new THREE.MeshLambertMaterial({ color: 0x0a4a2a })
  );
  poolTop.position.set(0, 0.8, 5);
  group.add(poolTop);
  // Pool table frame
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x5a3a1a });
  for (const [w, d, x, z] of [[3.3, 0.15, 0, 5.75], [3.3, 0.15, 0, 4.25], [0.15, 1.8, 1.575, 5], [0.15, 1.8, -1.575, 5]]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.15, d), frameMat);
    rail.position.set(x, 0.85, z);
    group.add(rail);
  }
  // Pool legs (4)
  for (const sx of [-1.4, 1.4]) for (const sz of [4.5, 5.5]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), frameMat);
    leg.position.set(sx, 0.4, sz);
    group.add(leg);
  }
  // Pool balls (6 coloured spheres)
  const ballColors = [0xffffff, 0xe11d48, 0x1d5fa8, 0xf2b134, 0x2e7d4f, 0x9333ea];
  for (let i = 0; i < 6; i++) {
    const pb = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 6),
      new THREE.MeshStandardMaterial({ color: ballColors[i], roughness: 0.2 })
    );
    const ang = (i / 6) * Math.PI * 2;
    pb.position.set(Math.cos(ang) * 0.4, 0.88, 5 + Math.sin(ang) * 0.3);
    group.add(pb);
  }
  // Pool table sign
  const poolSign = signMesh("POOL TABLE", 3, 0.4, {
    bg: "#1a1a1a", fg: "#4ade80", size: 14, border: false,
  });
  poolSign.position.set(0, 1.5, 5.8);
  group.add(poolSign);

  // ---- 3 Arcade machines (against east wall) ----
  const arcadeGames = ["RACING", "FIGHTER", "DANCE"];
  for (let i = 0; i < 3; i++) {
    const mx = -8 + i * 8;
    const mz = -17;
    // Cabinet body
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2.5, 1.0),
      new THREE.MeshLambertMaterial({ color: 0x1a1a2a })
    );
    cab.position.set(mx, 1.25, mz);
    group.add(cab);
    // Screen (glowing)
    const screenColor = [0x05d9e8, 0xff2a6d, 0xd1f7ff][i];
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.6),
      new THREE.MeshBasicMaterial({ color: screenColor })
    );
    screen.position.set(mx, 1.8, mz + 0.51);
    group.add(screen);
    // Game name
    const gameSign = signMesh(arcadeGames[i], 1.5, 0.3, {
      bg: "#1a1a1a", fg: "#f2b134", size: 12, border: false,
    });
    gameSign.position.set(mx, 2.55, mz + 0.51);
    group.add(gameSign);
    // Joystick (visual)
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6),
      new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.4 })
    );
    stick.position.set(mx, 1.0, mz + 0.55);
    group.add(stick);
    // Coin slot
    const slot = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.03, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x888888 })
    );
    slot.position.set(mx, 0.7, mz + 0.52);
    group.add(slot);
    // Collider
    // (added to colliders below)
  }

  // ---- Okada Dash screen (against west wall) ----
  const okadaScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 1.8),
    new THREE.MeshBasicMaterial({ color: 0x05d9e8 })
  );
  okadaScreen.position.set(-24.85, 2, 0);
  okadaScreen.rotation.y = Math.PI / 2;
  group.add(okadaScreen);
  const okadaSign = signMesh("OKADA DASH", 4, 0.5, {
    bg: "#1a1a1a", fg: "#05d9e8", size: 20, border: false,
  });
  okadaSign.position.set(-24.8, 3.2, 0);
  okadaSign.rotation.y = Math.PI / 2;
  group.add(okadaSign);
  // Okada cabinet body
  const okadaCab = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 2.5, 3.5),
    new THREE.MeshLambertMaterial({ color: 0x1a1a2a })
  );
  okadaCab.position.set(-24.5, 1.25, 0);
  group.add(okadaCab);
  // Handlebars (visual)
  const bars = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.03, 6, 12, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6, roughness: 0.3 })
  );
  bars.position.set(-24.1, 1.2, 0);
  bars.rotation.y = Math.PI / 2;
  group.add(bars);

  // ---- Hanging benches (2 rows for socialising) ----
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x8a6a45 });
  for (const bx of [-5, 5]) {
    for (let i = 0; i < 3; i++) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 0.5), benchMat);
      bench.position.set(bx, 0.45, -3 + i * 3);
      group.add(bench);
      // Back
      const back = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 0.06), benchMat);
      back.position.set(bx, 0.7, -3 + i * 3 - 0.22);
      group.add(back);
    }
  }

  // ---- Staff NPC at entrance ----
  let _people = null;
  spawnPeople(group, [
    { id: "attendant", name: "Sammie", role: "attendant", outfit: "casual", pose: "stand", x: 0, z: 16, ry: Math.PI, top: "#f2b134" },
    { id: "bowler1", name: "Chidi", role: "bowler", outfit: "casual", pose: "stand", x: -15, z: 5, ry: 0, top: "#1d5fa8" },
    { id: "bowler2", name: "Aisha", role: "bowler", outfit: "casual", pose: "stand", x: 15, z: 5, ry: 0, top: "#e11d48" },
    { id: "gamer1", name: "Tunde", role: "gamer", outfit: "casual", pose: "stand", x: -8, z: -14, ry: 0, top: "#9333ea" },
    { id: "chiller", name: "Zara", role: "visitor", outfit: "casual", pose: "stand", x: 5, z: -3, ry: Math.PI / 2, top: "#2e7d4f" },
  ]).then((p) => { _people = p; });

  // ---- Colliders ----
  const colliders = [
    // Walls
    { minX: -25, maxX: -24.7, minZ: -20, maxZ: 20 },
    { minX: 24.7, maxX: 25, minZ: -20, maxZ: 20 },
    { minX: -25, maxX: 25, minZ: -20, maxZ: -19.7 },
    // Pool table
    { minX: -1.6, maxX: 1.6, minZ: 4.2, maxZ: 5.8 },
    // Arcade cabinets
    { minX: -8.6, maxX: -7.4, minZ: -17.5, maxZ: -16.5 },
    { minX: -0.6, maxX: 0.6, minZ: -17.5, maxZ: -16.5 },
    { minX: 7.4, maxX: 8.6, minZ: -17.5, maxZ: -16.5 },
    // Okada cabinet
    { minX: -25, maxX: -24, minZ: -2, maxZ: 2 },
    // Bowling ball returns
    { minX: -16, maxX: -14, minZ: 6.5, maxZ: 7.5 },
    { minX: 14, maxX: 16, minZ: 6.5, maxZ: 7.5 },
  ];

  scene.add(group);

  const handle = {
    group,
    enter(ps) { ps.pos.set(0, 0, 17); ps.heading = Math.PI; },
    exit() {}, update(dt, now, px, pz) { if (_people) _people.update(dt, now, px, pz); },
    dispose() { if (_people) _people.dispose(); scene.remove(group); disposeGroup(group); _built = false; _cache = null; },
    colliders,
    onUIEvent(eid) {
      if (eid === "bowling") ctx.toast("🎳 Bowling — coming soon! Play setup in progress.");
      else if (eid === "pool") ctx.toast("🎱 Pool — coming soon! Rack 'em up.");
      else if (eid === "arcade") ctx.toast("🕹️ Arcade — coming soon! Insert coin.");
      else if (eid === "okada_dash") ctx.toast("🏍️ Okada Dash — coming soon! Endless runner.");
      else if (eid === "browse") ctx.toast("👀 Look around. Games coming soon!");
    },
  };

  _built = true; _cache = handle; return handle;
}
