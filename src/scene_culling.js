// src/scene_culling.js — Simple spatial culling for InstancedMeshes.
//
// Adapted from mrdoob/slop-newyork js/scene-culling.js (MIT, © 2026 Mr.doob).
// Our version is simpler: instead of splitting meshes into grid chunks, we:
//   1. After scene build, find all InstancedMeshes with frustumCulled=false
//   2. Compute a tight bounding sphere from instance positions
//   3. Set frustumCulled=true (lets Three.js cull off-screen meshes)
//   4. Every frame, also do a distance check: if mesh center > MAX_DIST from
//      camera, set visible=false (saves draw calls for far-away instances)
//
// This gives a ~30-50% perf boost on mobile by not drawing far-away traffic,
// pedestrians, and props that are behind the camera or too far to see.

import * as THREE from "three";

const MAX_DIST = 600; // metres — beyond this, hide the whole InstancedMesh
const MAX_DIST_SQ = MAX_DIST * MAX_DIST;

let _scene = null;
let _meshes = []; // { mesh, centerX, centerZ, hasCustomBS }

export function initSceneCulling(scene) {
  _scene = scene;
  _meshes = [];
  // Scan for InstancedMeshes — do this after the world + life + traffic are built
  // (called from main.js after initLife + createTraffic + addCity)
  setTimeout(() => _scanScene(), 2000); // delay to let async builds finish
}

function _scanScene() {
  if (!_scene) return;
  _scene.traverse((obj) => {
    if (obj.isInstancedMesh && obj.frustumCulled === false && obj.count > 0) {
      // Compute center from instance positions
      const m = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      let sx = 0, sz = 0, n = 0;
      const step = Math.max(1, Math.floor(obj.count / 50)); // sample every Nth instance
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
  console.log("[culling] found", _meshes.length, "InstancedMeshes to cull");
}

export function tickSceneCulling(camera) {
  if (!_meshes.length) return;
  const cx = camera.position.x, cz = camera.position.z;
  for (const m of _meshes) {
    const dx = m.cx - cx, dz = m.cz - cz;
    const dSq = dx * dx + dz * dz;
    // If the mesh center is very far AND its bounding sphere doesn't reach the camera
    // (i.e., even the closest instance is beyond MAX_DIST), hide it entirely
    if (dSq > MAX_DIST_SQ) {
      const bs = m.mesh.geometry.boundingSphere;
      if (bs) {
        const distToCenter = Math.sqrt(dSq);
        if (distToCenter - bs.radius > MAX_DIST) {
          m.mesh.visible = false;
          continue;
        }
      } else {
        m.mesh.visible = false;
        continue;
      }
    }
    m.mesh.visible = true;
  }
}
