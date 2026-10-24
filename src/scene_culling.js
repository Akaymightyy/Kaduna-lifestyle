// src/scene_culling.js — chunked frustum + distance culling for STATIC
// InstancedMeshes, adapted from mrdoob/slop-newyork js/scene-culling.js
// (MIT, © 2026 Mr.doob) — ideas only, our own WebGL code (handoff RULE 04).
//
// Two independent layers:
//
// 1) GENERIC (auto, 2s after boot): every InstancedMesh still on
//    frustumCulled=false gets a tight bounding sphere from its instance
//    positions + frustumCulled=true. Same as the Oct 23 build — lets Three.js
//    cull whole off-screen meshes. Never touches .visible (life.js owns that).
//
// 2) CHUNKED (opt-in, TODO #4 Oct 24): static meshes registered with
//    registerCullChunks() are sorted ONCE into spatial grid chunks. Every
//    frame, tickSceneCulling(camera) copies only the chunks that pass a
//    frustum test AND are inside maxDist into the front of the instance
//    buffer and sets .count — off-screen / far chunks cost ZERO GPU work
//    instead of relying on per-instance GPU cull. Matrices are copied from a
//    private scratch copy, so the next frame just recomputes .count — no
//    visible flag is ever touched, so life.js / traffic.js / areas_world.js
//    keep full control of their own meshes.
//
//    Register STATIC meshes only (lamp posts, road dashes, zebra, trees) —
//    meshes whose instances move (traffic, pedestrians) would go stale.

import * as THREE from "three";

let _scene = null;
let _meshes = [];

// ---- layer 2 state ----
const _chunks = [];                       // { mesh, ranges:[{start,end,cx,cz,r}], scratch:Float32Array, maxDist }
const _frustum = new THREE.Frustum();
const _projScreen = new THREE.Matrix4();
const _sphere = new THREE.Sphere();

export function initSceneCulling(scene) {
  _scene = scene;
  _meshes = [];
  // Scan for InstancedMeshes after the world + life + traffic are built
  setTimeout(() => _scanScene(), 2000);
}

function _scanScene() {
  if (!_scene) return;
  _scene.traverse((obj) => {
    if (obj.isInstancedMesh && obj.frustumCulled === false && obj.count > 0 && !obj.userData.cullChunks) {
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

/**
 * TODO #4 (Oct 24): register a STATIC InstancedMesh for chunked culling.
 * Reorders its instance matrices into spatial chunks (grid of `chunkSize` m)
 * once, then tickSceneCulling() streams only the visible chunks to the GPU.
 * Call AFTER the instance matrices are set. Never set .visible — count only.
 */
export function registerCullChunks(mesh, { chunkSize = 40, maxDist = 260 } = {}) {
  if (!mesh || !mesh.isInstancedMesh || !mesh.count) return;
  const count = mesh.count;
  if (count < 24) return;                                    // not worth the CPU
  const m = new THREE.Matrix4();
  const cells = new Map();
  for (let i = 0; i < count; i++) {
    mesh.getMatrixAt(i, m);
    const e = m.elements;
    const key = Math.floor(e[12] / chunkSize) + ":" + Math.floor(e[14] / chunkSize);
    let list = cells.get(key);
    if (!list) { list = []; cells.set(key, list); }
    list.push(Array.from(e));
  }
  const scratch = new Float32Array(count * 16);
  const ranges = [];
  let w = 0;
  for (const list of cells.values()) {
    const start = w;
    let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9;
    for (const e of list) {
      scratch.set(e, w * 16);
      if (e[12] < mnx) mnx = e[12]; if (e[12] > mxx) mxx = e[12];
      if (e[14] < mnz) mnz = e[14]; if (e[14] > mxz) mxz = e[14];
      w++;
    }
    ranges.push({ start, end: w, cx: (mnx + mxx) / 2, cz: (mnz + mxz) / 2, r: Math.max(mxx - mnx, mxz - mnz) / 2 + 6 });
  }
  mesh.instanceMatrix.array.set(scratch);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;                               // we cull per chunk ourselves
  mesh.userData.cullChunks = true;                          // keep the 2s auto-scan off this mesh
  _chunks.push({ mesh, ranges, scratch, maxDist });
  console.log("[culling] chunked", mesh.name || "instanced", "—", count, "instances in", ranges.length, "chunks");
}

/**
 * Every frame, after all gameplay updates and before render (main.js calls it
 * right there). Rebuilds each registered mesh's .count from the chunks that
 * pass frustum + distance tests. All other meshes are untouched.
 */
export function tickSceneCulling(camera) {
  if (!_chunks.length) return;
  _projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _frustum.setFromProjectionMatrix(_projScreen);
  const cam = camera.position;
  for (const ch of _chunks) {
    const arr = ch.mesh.instanceMatrix.array;
    let w = 0;
    for (let k = 0; k < ch.ranges.length; k++) {
      const rg = ch.ranges[k];
      const dx = rg.cx - cam.x, dz = rg.cz - cam.z;
      if (dx * dx + dz * dz > ch.maxDist * ch.maxDist) continue;          // too far — skip
      _sphere.center.set(rg.cx, 0, rg.cz); _sphere.radius = rg.r;
      if (!_frustum.intersectsSphere(_sphere)) continue;                  // off-screen — skip
      arr.set(ch.scratch.subarray(rg.start * 16, rg.end * 16), w * 16);
      w += rg.end - rg.start;
    }
    if (ch.mesh.count !== w) {
      ch.mesh.count = w;
      ch.mesh.instanceMatrix.needsUpdate = true;
    } else if (w > 0) {
      // same count but different visible chunks — matrices changed, re-upload
      ch.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

// ---- test hook (headless checks): how many chunks exist per mesh ----
export function cullStats() {
  return { meshes: _chunks.length, chunks: _chunks.reduce((a, c) => a + c.ranges.length, 0) };
}
