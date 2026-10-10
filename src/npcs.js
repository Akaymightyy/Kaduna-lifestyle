// src/npcs.js — AI pedestrians walking on sidewalks
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ROAD_HALF, WORLD_HALF_X, CROSSINGS, rng } from "./config.js";

const NPC_COLORS = [0x1f7a5a, 0x2b3a55, 0xc0392b, 0x1d5fa8, 0x7a3b8f, 0xd98e2b, 0x2e7d4f, 0x8a5a3c, 0x6b4a8a, 0x555a60];

export function createNPCs(scene) {
  const R = rng(9988);
  const count = 15;
  const npcs = [];

  // Build a simple pedestrian mesh (capsule body + sphere head) — one InstancedMesh
  const bodyGeo = new THREE.CapsuleGeometry(0.25, 0.6, 4, 6).translate(0, 0.55, 0);
  const headGeo = new THREE.SphereGeometry(0.22, 8, 6).translate(0, 1.15, 0);
  const merged = mergeGeometries([bodyGeo, headGeo]);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(merged, mat, count);
  mesh.castShadow = true;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  scene.add(mesh);

  // Initialize NPC positions — on sidewalks, walking along X
  for (let i = 0; i < count; i++) {
    const side = R() < 0.5 ? 1 : -1;
    npcs.push({
      x: -WORLD_HALF_X + R() * WORLD_HALF_X * 2,
      z: side * (ROAD_HALF + 3 + R() * 3),
      dir: R() < 0.5 ? 1 : -1,
      speed: 0.8 + R() * 0.6,
      heading: 0,
      color: new THREE.Color(NPC_COLORS[Math.floor(R() * NPC_COLORS.length)]),
      walkPhase: R() * Math.PI * 2,
    });
  }

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);

  function update(dt, now) {
    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i];
      // Walk along X
      n.x += n.dir * n.speed * dt;
      n.walkPhase += dt * (4 + n.speed * 2);

      // Wrap around world
      if (n.x > WORLD_HALF_X) n.x = -WORLD_HALF_X;
      if (n.x < -WORLD_HALF_X) n.x = WORLD_HALF_X;

      // Occasionally cross the road at a zebra crossing
      if (Math.random() < 0.001) {
        const nearest = CROSSINGS.reduce((prev, curr) => Math.abs(curr - n.x) < Math.abs(prev - n.x) ? curr : prev);
        if (Math.abs(n.x - nearest) < 5) {
          n.z = -n.z; // switch side
        }
      }

      // Set heading based on direction
      n.heading = n.dir > 0 ? Math.PI / 2 : -Math.PI / 2;

      // Bob up and down slightly (walking)
      const bob = Math.abs(Math.sin(n.walkPhase)) * 0.04;

      pos.set(n.x, bob, n.z);
      q.setFromAxisAngle(up, n.heading);
      m4.compose(pos, q, scl);
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, n.color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  return { update, npcs };
}
