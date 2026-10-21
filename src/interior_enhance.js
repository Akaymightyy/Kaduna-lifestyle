// src/interior_enhance.js — post-build interior enhancement for ALL places.
//
// Runs AFTER each interior place is built. Adds common props that make
// interiors feel alive (like MyAbujaLife's police station + mall):
//   - Potted plants near the entrance
//   - Visible ceiling light fixtures (warm glow)
//   - Wooden bench near the entrance
//   - Wall painting decoration
//
// Does NOT touch individual place files — just adds to the group after
// build(). Safe, reversible, can be toggled by quality setting.
//
// Wire-up (in main.js, after initPlaceManager):
//   import { enhanceInterior } from "./interior_enhance.js";
//   // Called from the place manager's build callback — see patch below

import * as THREE from "three";

// ---- Potted plant (tall green thing in a pot) ----
function _plant(x, z, scale = 1) {
  const g = new THREE.Group();
  // Pot (terracotta)
  const potGeo = new THREE.CylinderGeometry(0.25 * scale, 0.3 * scale, 0.4 * scale, 8);
  const potMat = new THREE.MeshLambertMaterial({ color: 0xa05a3c });
  const pot = new THREE.Mesh(potGeo, potMat);
  pot.position.y = 0.2 * scale;
  g.add(pot);
  // Stem
  const stemGeo = new THREE.CylinderGeometry(0.04 * scale, 0.04 * scale, 1.2 * scale, 6);
  const stemMat = new THREE.MeshLambertMaterial({ color: 0x4a6a3a });
  const stem = new THREE.Mesh(stemGeo, stemMat);
  stem.position.y = 0.8 * scale;
  g.add(stem);
  // Leaves (3 spheres at different heights)
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e7d4f });
  for (let i = 0; i < 4; i++) {
    const r = (0.25 + Math.random() * 0.15) * scale;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 5), leafMat);
    leaf.position.set(
      (Math.random() - 0.5) * 0.3 * scale,
      (0.8 + i * 0.35) * scale,
      (Math.random() - 0.5) * 0.3 * scale
    );
    g.add(leaf);
  }
  g.position.set(x, 0, z);
  return g;
}

// ---- Wooden bench (2-seater, like in a waiting room) ----
function _bench(x, z, rot = 0) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x8a6a45 });
  // Seat
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.5), mat);
  seat.position.y = 0.45;
  g.add(seat);
  // Back
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.06), mat);
  back.position.set(0, 0.7, -0.22);
  g.add(back);
  // Legs (4)
  const legMat = new THREE.MeshLambertMaterial({ color: 0x5a4a30 });
  for (const sx of [-0.8, 0.8]) {
    for (const sz of [-0.2, 0.2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.08), legMat);
      leg.position.set(sx, 0.225, sz);
      g.add(leg);
    }
  }
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  return g;
}

// ---- Ceiling light fixture (visible warm light panel) ----
function _ceilingLight(x, y, z) {
  const g = new THREE.Group();
  // Housing (dark frame)
  const frameGeo = new THREE.BoxGeometry(0.6, 0.08, 0.3);
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  g.add(frame);
  // Light panel (emissive warm white)
  const panelGeo = new THREE.PlaneGeometry(0.5, 0.2);
  const panelMat = new THREE.MeshBasicMaterial({ color: 0xfff0d0 });
  const panel = new THREE.Mesh(panelGeo, panelMat);
  panel.rotation.x = Math.PI / 2;
  panel.position.y = -0.04;
  g.add(panel);
  g.position.set(x, y, z);
  return g;
}

// ---- Wall painting (simple framed rectangle) ----
function _wallPainting(x, y, z, w = 1.2, h = 0.8, rotY = 0) {
  const g = new THREE.Group();
  // Frame (dark wood)
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x5a4a30 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.04), frameMat);
  g.add(frame);
  // Canvas (colored — abstract art)
  const colors = [0x4a6a8a, 0x8a4a4a, 0x4a8a5a, 0x8a8a4a, 0x6a4a8a];
  const canvasMat = new THREE.MeshLambertMaterial({ color: colors[Math.floor(Math.random() * colors.length)] });
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), canvasMat);
  canvas.position.z = 0.03;
  g.add(canvas);
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  return g;
}

// ---- Main enhancement function ----
// Called after each interior place is built. Adds props based on the
// place definition. Safe to call on outdoor places (returns early).
export function enhanceInterior(group, placeDef) {
  if (!group || !placeDef) return;
  // Only enhance interior places
  if (placeDef.type !== "interior") return;
  // Don't enhance home (player builds their own furniture there)
  if (placeDef.id === "home") return;
  // Don't enhance dealership (already has custom props)
  if (placeDef.id === "dealership") return;

  // Add 2 potted plants near the entrance (south side)
  group.add(_plant(-3, 12));
  group.add(_plant(3, 12));

  // Add 1 bench near the entrance (for waiting)
  group.add(_bench(0, 10, 0));

  // Add 2-3 ceiling lights (spread across the interior)
  for (let i = -1; i <= 1; i++) {
    group.add(_ceilingLight(i * 6, 4.5, 0));
  }

  // Add 2 wall paintings (on the back/north wall)
  group.add(_wallPainting(-5, 3, -14.85, 1.2, 0.8, 0));
  group.add(_wallPainting(5, 3, -14.85, 1.0, 0.7, 0));

  // Add 2 more plants in the back corners
  group.add(_plant(-15, -12, 0.8));
  group.add(_plant(15, -12, 0.8));
}
