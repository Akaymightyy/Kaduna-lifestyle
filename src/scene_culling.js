// src/scene_culling.js — Simple frustum culling enabler for InstancedMeshes.
//
// Adapted from mrdoob/slop-newyork js/scene-culling.js (MIT, © 2026 Mr.doob).
// Our version is simpler and SAFER: instead of hiding far meshes (which
// interfered with life.js's own visibility management — see the bug where
// pedestrians vanished), we ONLY:
//   1. Compute a tight bounding sphere from instance positions
//   2. Set frustumCulled = true (lets Three.js cull off-screen meshes)
//
// We do NOT set visible=false — life.js manages its own visibility per frame
// (pm[k].visible = show, pm[k].count = nj). Setting visible=false here
// would override life.js and make pedestrians disappear.

import * as THREE from "three";

let _scene = null;
let _meshes = [];

export function initSceneCulling(scene) {
  _scene = scene;
  _meshes = [];
  // Scan for InstancedMeshes after the world + life + traffic are built
  setTimeout(() => _scanScene(), 2000);
}

function _scanScene() {
  if (!_scene) return;
  _scene.traverse((obj) => {
    if (obj.isInstancedMesh && obj.frustumCulled === false && obj.count > 0) {
      // Compute center from instance positions
      const m = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      let sx = 0, sz = 0, n = 0;
      const step = Math.max(1, Math.floor(obj.count / 50));
      for (let i = 0; i < obj.count; i += step) {
        obj.getMatrixAt(i, m);
        pos.setFromMatrixPosition(m);
        sx += pos.x; sz += pos.z; n++;
      }
      if (n > 0) {
        const cx = sx / n, cz = sz / n;
        // Compute max distance from center to any sampled instance
        let maxD = 0;
        for (let i = 0; i < obj.count; i += step) {
          obj.getMatrixAt(i, m);
          pos.setFromMatrixPosition(m);
          const d = Math.hypot(pos.x - cx, pos.z - cz);
          if (d > maxD) maxD = d;
        }
        // Set a tight bounding sphere centered on the instances
        obj.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, 0, cz), maxD + 20);
        // Enable frustum culling — Three.js will now cull this mesh when off-screen
        obj.frustumCulled = true;
        _meshes.push({ mesh: obj, cx, cz });
      }
    }
  });
  console.log("[culling] found", _meshes.length, "InstancedMeshes, frustum culling enabled");
}

// Per-frame tick — currently a no-op (frustum culling is automatic once enabled).
// Kept for future distance-based culling if needed, but NOT touching visible flag
// to avoid conflicting with life.js's own visibility management.
export function tickSceneCulling(camera) {
  // No-op — frustum culling is handled by Three.js automatically once
  // frustumCulled = true and boundingSphere is set.
  // We intentionally do NOT set mesh.visible = false here — that broke
  // pedestrian visibility (life.js sets visible per frame and our override
  // was clobbering it).
}
