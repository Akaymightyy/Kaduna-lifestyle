// src/npcs.js — AI pedestrians walking on sidewalks (real GLB human models)
// PERFORMANCE: NPCs are created lazily AFTER the loading screen finishes,
// staggered across frames (one per frame) so the main thread never blocks.
// Meshes have frustumCulled=true (default) and animations are skipped when
// the NPC is far from the player.
import * as THREE from "three";
import { createCharacter } from "./characters.js";
import { ROAD_HALF, WORLD_HALF_X, CROSSINGS, rng } from "./config.js";
import { collide } from "./player.js";

const NPC_COUNT = 3;            // reduced for perf (240 meshes per character)
const ANIM_DISTANCE = 30;       // metres — skip animation beyond this
const DRAW_DISTANCE = 60;       // metres — hide entirely beyond this

export function createNPCs(scene, colliders = []) {
  const R = rng(9988);
  const npcs = [];
  let spawnIdx = 0;

  // Spawn NPC state first (positions, directions) — no models yet
  for (let i = 0; i < NPC_COUNT; i++) {
    const side = R() < 0.5 ? 1 : -1;
    npcs.push({
      x: -WORLD_HALF_X + R() * WORLD_HALF_X * 2,
      z: side * (ROAD_HALF + 3 + R() * 3),
      dir: R() < 0.5 ? 1 : -1,
      speed: 0.7 + R() * 0.5,
      heading: 0,
      walkPhase: R() * Math.PI * 2,
      group: null,
      walker: null,
      ready: false,
      loading: false,
    });
  }

  // Spawn one NPC per frame (staggered) so we never block the main thread.
  // Returns true while still spawning.
  function spawnTick() {
    if (spawnIdx >= npcs.length) return false;
    const npc = npcs[spawnIdx];
    spawnIdx++;
    if (npc.loading || npc.ready) return spawnIdx < npcs.length;
    npc.loading = true;
    // Defer the actual createCharacter to next microtask so this frame stays cheap
    createCharacter({ seed: 500 + spawnIdx * 37, height: 1.7 + R() * 0.15 })
      .then((ch) => {
        // Re-enable frustum culling so off-screen NPCs don't draw
        ch.group.traverse((o) => {
          if (o.isMesh) { o.frustumCulled = true; o.castShadow = true; }
        });
        scene.add(ch.group);
        npc.group = ch.group;
        npc.walker = ch;
        npc.ready = true;
        npc.loading = false;
      })
      .catch(() => { npc.loading = false; npc.ready = false; });
    return true;
  }

  // Reusable vectors to avoid per-frame allocation
  const _tmpVec = new THREE.Vector3();
  const _npcPos = new THREE.Vector3();

  function update(dt, now, playerX, playerZ) {
    // Spawn one NPC per frame until all are loaded
    spawnTick();

    for (const n of npcs) {
      // Walk along X
      n.x += n.dir * n.speed * dt;
      n.walkPhase += dt * (4 + n.speed * 2);

      // Wrap around world
      if (n.x > WORLD_HALF_X) n.x = -WORLD_HALF_X;
      if (n.x < -WORLD_HALF_X) n.x = WORLD_HALF_X;

      // Occasionally cross the road at a zebra crossing
      if (Math.random() < 0.001) {
        const nearest = CROSSINGS.reduce((p, c) => Math.abs(c - n.x) < Math.abs(p - n.x) ? c : p);
        if (Math.abs(n.x - nearest) < 5) n.z = -n.z;
      }

      n.heading = n.dir > 0 ? Math.PI / 2 : -Math.PI / 2;

      if (!n.ready || !n.group) continue;

      // Distance culling — skip everything if far from player
      const dx = n.x - (playerX || 0), dz = n.z - (playerZ || 0);
      const distSq = dx * dx + dz * dz;

      if (distSq > DRAW_DISTANCE * DRAW_DISTANCE) {
        // Hide entirely — saves draw calls
        n.group.visible = false;
        continue;
      }
      // Oct 25 FIX ("characters walk through buildings / everything is
      // untouchable"): NPCs used to ghost straight through houses, kiosks and
      // the PLAYER. Now they (a) push out of world colliders (only computed
      // while near the player — far NPCs are invisible anyway) and (b) step
      // aside when the player gets too close.
      if (colliders.length) {
        _npcPos.set(n.x, 0, n.z);
        collide(_npcPos, colliders, 0.35);
        n.x = _npcPos.x; n.z = _npcPos.z;
      }
      if (distSq < 0.81 && distSq > 1e-4) {           // player's 0.9 m personal bubble
        const pd = Math.sqrt(distSq), push = (0.9 - pd) / pd;
        n.x += dx * push; n.z += dz * push;
      }
      n.group.visible = true;
      n.group.position.set(n.x, 0, n.z);
      n.group.rotation.y = n.heading;

      // Only animate if close enough to be seen
      if (distSq < ANIM_DISTANCE * ANIM_DISTANCE) {
        n.walker.animate(dt, n.speed);
      }
    }
  }

  return { update, npcs };
}
