import * as THREE from "three";
import { loadCharacterBase, createCharacter } from "./characters.js";
import { PLAYER_LIMIT_X, PLAYER_LIMIT_Z } from "./config.js";

const ARM_DOWN = 1.25;
const _q = new THREE.Quaternion(), _ax = new THREE.Vector3();

export async function loadPlayer(manager, scene) {
  // The player uses the same (merged, light) character as everybody else.
  await loadCharacterBase(manager);
  const ch = await createCharacter({ seed: 1, height: 1.8, outfit: "casual", top: "#1f7a5a", bottom: "#2b3a55", skin: "#8a5a3c", hair: "#111111", shoes: "#f2f2ee" });
  ch.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = true; } });
  scene.add(ch.group);
  return { group: ch.group, animate: ch.animate, height: 1.8 };
}

export function collide(pos, colliders, r = 0.45) {
  pos.x = Math.max(-PLAYER_LIMIT_X, Math.min(PLAYER_LIMIT_X, pos.x));
  pos.z = Math.max(-PLAYER_LIMIT_Z, Math.min(PLAYER_LIMIT_Z, pos.z));
  for (const b of colliders) {
    const cx = Math.max(b.minX, Math.min(pos.x, b.maxX)), cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) { const d = Math.sqrt(d2), f = (r - d) / d; pos.x += dx * f; pos.z += dz * f; }
      else pos.x = b.minX - r;
    }
  }
}
