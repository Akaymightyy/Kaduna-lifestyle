import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { WORLD_HALF_X, SIDE_STREETS, rng } from "./config.js";
import { NIGHT_GLOW } from "./art/style.js";

// ---- Night window glow for the Kenney houses ----
// The houses are baked into ONE mesh using a colour-palette picture. The glass panes are the only saturated blue in that
// palette, so we find every pane once per house model, give each pane its own random number (attribute aWin), and at night
// the shader lights some of the panes warm yellow. One mesh, one draw call, nothing extra by day.
function loadAtlasPixels(urls) {
  return new Promise((resolve) => {
    const tryNext = (i) => {
      if (i >= urls.length) return resolve(null);
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
          const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0);
          resolve({ w: c.width, h: c.height, d: g.getImageData(0, 0, c.width, c.height).data });
        } catch (e) { resolve(null); }
      };
      img.onerror = () => tryNext(i + 1);
      img.src = urls[i];
    };
    tryNext(0);
  });
}
function paneIds(geo, atlas) {                        // per vertex: 0 = not a window, else a random 0.03..1 number shared by the whole pane
  const pos = geo.attributes.position, uv = geo.attributes.uv, n = pos.count, isWin = new Uint8Array(n);
  if (!uv) return new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = Math.min(atlas.w - 1, Math.max(0, Math.floor(uv.getX(i) * atlas.w))), y = Math.min(atlas.h - 1, Math.max(0, Math.floor(uv.getY(i) * atlas.h)));
    const k = (y * atlas.w + x) * 4, r = atlas.d[k], g = atlas.d[k + 1], b = atlas.d[k + 2];
    isWin[i] = (b - r > 62 && b - g > 34) ? 1 : 0;   // glass blue; frames, walls, doors and roofs all fail this
  }
  const key = (i) => Math.round(pos.getX(i) * 400) + "," + Math.round(pos.getY(i) * 400) + "," + Math.round(pos.getZ(i) * 400);
  const parent = new Map(), find = (a) => { while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a))); a = parent.get(a); } return a; };
  const union = (a, b) => { if (!parent.has(a)) parent.set(a, a); if (!parent.has(b)) parent.set(b, b); parent.set(find(a), find(b)); };
  const idx = geo.index ? geo.index.array : null, tri = idx ? idx.length / 3 : n / 3;
  for (let t = 0; t < tri; t++) {
    const a = idx ? idx[t * 3] : t * 3, b = idx ? idx[t * 3 + 1] : t * 3 + 1, c = idx ? idx[t * 3 + 2] : t * 3 + 2;
    if (isWin[a] && isWin[b] && isWin[c]) { const ka = key(a), kb = key(b), kc = key(c); union(ka, kb); union(kb, kc); }
  }
  const out = new Float32Array(n), rnd = new Map();
  for (let i = 0; i < n; i++) {
    if (!isWin[i]) continue;
    const root = find(key(i)); if (!rnd.has(root)) { let h = 2166136261; for (let q = 0; q < root.length; q++) h = Math.imul(h ^ root.charCodeAt(q), 16777619); rnd.set(root, 0.03 + ((h >>> 0) % 9700) / 10000); }
    out[i] = rnd.get(root);
  }
  return out;
}
const CITY_WIN_VERT = "attribute float aWin;\nvarying float vWin;\n";
const CITY_WIN_FRAG = `
uniform float uNightGlow;
varying float vWin;
`;
const CITY_WIN_BODY = `
if (uNightGlow > 0.01 && vWin > 0.0) {
  float on = step(0.40, vWin);
  float cool = step(0.90, fract(vWin * 13.7));
  vec3 wcol = mix(vec3(1.0, 0.78, 0.38), vec3(0.78, 0.9, 1.0), cool);
  outgoingLight = mix(outgoingLight, wcol * 1.05, on * uNightGlow * 0.95);
}
`;
function addCityWindowGlow(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNightGlow = NIGHT_GLOW;
    sh.vertexShader = CITY_WIN_VERT + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvWin = aWin;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\n" + CITY_WIN_FRAG).replace("#include <opaque_fragment>", CITY_WIN_BODY + "\n#include <opaque_fragment>");
  };
  mat.customProgramCacheKey = () => "citywinglow";
  return mat;
}

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
  const atlas = await loadAtlasPixels(["/models/city/texture/colormap.png", "/models/city/Textures/colormap.png"]);
  if (atlas) for (const n of HOUSES) if (loaded[n]) loaded[n].win = paneIds(loaded[n].geo, atlas);
  const houseNames = HOUSES.filter((n) => loaded[n]);
  if (!houseNames.length) return false;               // fall back to the procedural buildings
  const material = loaded[houseNames[0]].mat.clone();
  material.roughness = 1; material.metalness = 0;
  addCityWindowGlow(material);
  // The colour atlas: works whether the folder is called "texture" or "Textures"
  const tl = new THREE.TextureLoader();
  const useAtlas = (url, next) => tl.load(url, (t) => {
    t.flipY = false; t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
    material.map = t; material.needsUpdate = true;
  }, undefined, () => { if (next) useAtlas(next); });
  useAtlas("/models/city/texture/colormap.png", "/models/city/Textures/colormap.png");
  const R = rng(4242);
  const parts = [];
  const place = (n, x, z, rotY, s) => {
    const L = loaded[n]; if (!L) return null;
    const g = L.geo.clone();
    // keep only position/normal/uv so every part merges
    for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), new THREE.Vector3(s, s, s)));
    const nV = g.attributes.position.count, aw = new Float32Array(nV);
    if (L.win) {
      const inst = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;     // per house, not from the layout random numbers
      for (let i = 0; i < nV; i++) if (L.win[i] > 0) aw[i] = 0.03 + ((L.win[i] + inst) % 1) * 0.96;
    }
    g.setAttribute("aWin", new THREE.BufferAttribute(aw, 1));
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
  mesh.castShadow = false; mesh.receiveShadow = true; // big merged city mesh — receive only, don't cast (saves shadow map cost)
  scene.add(mesh);
  return true;
}
