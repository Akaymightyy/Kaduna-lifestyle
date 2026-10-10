import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { WORLD_HALF_X, SIDE_STREETS, rng } from "./config.js";

// Kenney "City Kit Suburban" (CC0, see public/models/city/KENNEY-LICENSE.txt).
// Houses line the road; everything is baked into ONE mesh (one draw call).
const HOUSES = "abcdefghijklmnopqrstu".split("").map((c) => `building-type-${c}`);
const EXTRA = ["tree-large", "tree-small", "fence-low", "planter"];
const HOUSE_SCALE = 8.5;          // Kenney houses are ~1.3 units wide
const FRONT_FACES_PLUS_Z = true;  // which way the front door of the model points

function firstMesh(root) { let m = null; root.traverse((o) => { if (!m && o.isMesh) m = o; }); return m; }

export async function addCity(scene, world, manager) {
  const loader = new GLTFLoader(manager);
  const names = [...HOUSES, ...EXTRA];
  const loaded = {};
  await Promise.all(names.map(async (n) => {
    try {
      const g = await loader.loadAsync(`/models/city/${n}.glb`);
      g.scene.updateMatrixWorld(true);
      const mesh = firstMesh(g.scene);
      if (!mesh) return;
      const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      geo.computeBoundingBox();
      loaded[n] = { geo, mat: mesh.material, size: geo.boundingBox.getSize(new THREE.Vector3()) };
    } catch (e) { console.warn("city model missing:", n); }
  }));
  const houseNames = HOUSES.filter((n) => loaded[n]);
  if (!houseNames.length) return false;               // fall back to the procedural buildings
  const material = loaded[houseNames[0]].mat.clone();
  material.roughness = 1; material.metalness = 0;
  const R = rng(4242);
  const parts = [];
  const place = (n, x, z, rotY, s) => {
    const L = loaded[n]; if (!L) return null;
    const g = L.geo.clone();
    // keep only position/normal/uv so every part merges
    for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), new THREE.Vector3(s, s, s)));
    parts.push(g);
    return L.size;
  };
  const skip = (side, cx, w) =>
    SIDE_STREETS.some((sx) => Math.abs(cx - sx) < w / 2 + 9) ||
    (side === 1 && cx > 18 && cx < 78) ||      // mosque
    (side === -1 && cx > -56 && cx < -4) ||    // market
    (side === 1 && cx > -126 && cx < -90);     // petrol station
  for (const side of [1, -1]) {
    let x = -WORLD_HALF_X + 24;
    while (x < WORLD_HALF_X - 24) {
      const n = houseNames[Math.floor(R() * houseNames.length)];
      const L = loaded[n];
      const w = L.size.x * HOUSE_SCALE, d = L.size.z * HOUSE_SCALE;
      const cx = x + w / 2;
      if (!skip(side, cx, w)) {
        const cz = side * (17 + d / 2 + 1.5);
        const rot = side === 1 ? (FRONT_FACES_PLUS_Z ? Math.PI : 0) : (FRONT_FACES_PLUS_Z ? 0 : Math.PI);
        place(n, cx, cz, rot, HOUSE_SCALE);
        world.colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
        world.mapShapes.buildings.push({ x: cx, z: cz, w, d });
        // low fence along the front, and a tree in the garden
        place("fence-low", cx, side * 16.4, 0, HOUSE_SCALE * 0.9);
        if (R() < 0.7) place(R() < 0.5 ? "tree-large" : "tree-small", cx + (R() - 0.5) * w * 0.7, side * (18 + R() * 2), R() * 6, HOUSE_SCALE * (0.9 + R() * 0.4));
      }
      x += w + 3 + R() * 4;
    }
  }
  const mesh = new THREE.Mesh(mergeGeometries(parts), material);
  mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
  return true;
}
