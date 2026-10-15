import * as THREE from "three";
import { loadCharacterBase, createCharacter, recolorCharacter } from "./characters.js";
import { PLAYER_LIMIT_X, PLAYER_LIMIT_Z } from "./config.js";

const ARM_DOWN = 1.25;
const _q = new THREE.Quaternion(), _ax = new THREE.Vector3();

export async function loadPlayer(manager, scene, look) {
  // The player uses the same character as everybody else, with the saved look.
  await loadCharacterBase(manager, look && look.gender);
  const ch = await createCharacter({ seed: 1, height: 1.8, look: look || {} });
  ch.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = true; } });
  scene.add(ch.group);
  // Expose recolor so main.js can change clothes live
  return { group: ch.group, model: ch.model, animate: ch.animate, height: 1.8, recolor: (newLook) => recolorCharacter(ch, newLook) };
}

export function collide(pos, colliders, r = 0.55) {
  // FEATURE: clamp to world bounds first (so the player can't walk off the map).
  pos.x = Math.max(-PLAYER_LIMIT_X, Math.min(PLAYER_LIMIT_X, pos.x));
  pos.z = Math.max(-PLAYER_LIMIT_Z, Math.min(PLAYER_LIMIT_Z, pos.z));
  // BUGFIX: was a single pass — if the player is in a corner (touching 2+ walls),
  // the single push-out could push them INTO another wall, then they'd tunnel.
  // Now 3 iterations of push-out — each iteration resolves the closest
  // collision, then the next iteration catches any new collisions introduced
  // by the first push. This handles corners + overlapping colliders correctly.
  // Also bumped the player radius from 0.45 to 0.55 for more forgiving hits
  // (was too tight, the player could squeeze through gaps between colliders).
  for (let iter = 0; iter < 3; iter++) {
    let anyHit = false;
    for (const b of colliders) {
      // Skip degenerate colliders (e.g. area-house slots with no house this frame)
      if (!isFinite(b.minX) || b.minX > b.maxX || b.minZ > b.maxZ) continue;
      const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        anyHit = true;
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2), f = (r - d) / d;
          pos.x += dx * f;
          pos.z += dz * f;
        } else {
          // Player is exactly inside the box center — push out along +X
          pos.x = b.maxX + r;
        }
      }
    }
    if (!anyHit) break;  // no collisions this pass — done
  }
}
