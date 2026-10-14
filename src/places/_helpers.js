// src/places/_helpers.js
// Shared low-level helpers for building places. NEVER layouts, props or art.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { styledMaterial, stylize } from "../art/style.js";

// Make a BoxGeometry with per-face vertex colours (so a single merged mesh can have differently-coloured
// faces). Color is a THREE.Color or hex int. `pat` = optional surface pattern (see src/art/style.js PAT).
export function box(w, h, d, x = 0, y = 0, z = 0, color = 0xffffff, pat = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3), p = new Float32Array(n).fill(pat);
  for (let i = 0; i < n; i++) {
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aPat", new THREE.BufferAttribute(p, 1));
  return g;
}

// Make sure every geometry has the same attributes so mergeGeometries never fails (custom geometries welcome).
function normalise(geos) {
  const prepared = geos.map((g) => {
    let q = g;
    if (!q.index && q.attributes.position) { /* keep as is: mixed indexed/non-indexed is fixed below */ }
    if (!q.attributes.aPat) q.setAttribute("aPat", new THREE.BufferAttribute(new Float32Array(q.attributes.position.count), 1));
    if (!q.attributes.color) { const n = q.attributes.position.count; q.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3)); }
    return q;
  });
  const anyIndexed = prepared.some((g) => g.index), anyFlat = prepared.some((g) => !g.index);
  if (anyIndexed && anyFlat) return prepared.map((g) => (g.index ? g.toNonIndexed() : g));
  return prepared;
}

// Merge a list of geometries into one mesh with vertex colors + the stylised interior material.
export function mergedMesh(geos, materialOpts = {}) {
  const merged = mergeGeometries(normalise(geos));
  const custom = Object.keys(materialOpts).length > 0;
  const mat = custom
    ? stylize(new THREE.MeshLambertMaterial({ vertexColors: true, ...materialOpts }), { pat: true, ao: true, fake: true })
    : styledMaterial("interior");
  const m = new THREE.Mesh(merged, mat);
  m.castShadow = false; m.receiveShadow = false; // interiors never need real shadows
  return m;
}

// Canvas-textured label/sign
export function signTexture(text, opts = {}) {
  const w = opts.width ?? 512, h = opts.height ?? 128;
  const bg = opts.bg ?? "#0f4d3a", fg = opts.fg ?? "#ffffff";
  const size = opts.size ?? 56;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (opts.border !== false) {
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
  }
  g.fillStyle = fg;
  g.font = '700 ' + size + 'px Poppins, Arial, sans-serif';
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, w / 2, h / 2 + 4, w - 40);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function signMesh(text, w, h, opts = {}) {
  const t = signTexture(text, opts);
  return new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide })
  );
}

// Floor plane. `pat` = pattern code (default: 9 concrete). 1 = tiles, 2 = wood planks. See src/art/style.js.
export function floor(w, d, color = 0xbfb39a, pat = 9) {
  const geo = new THREE.PlaneGeometry(w, d);
  geo.setAttribute("aPat", new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(pat), 1));
  const c = new THREE.Color(color), n = geo.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, styledMaterial("interior"));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

// Add a basic interior lighting rig: warm ambient + a few point lights
export function interiorLights({ ambient = 0.5, points = [] } = {}) {
  // PERFORMANCE: real point lights are evaluated for EVERY pixel of EVERY surface and force the
  // shaders to recompile for each place (that was the lag when entering a building).
  // We fold their brightness into one ambient light instead: same bright room, fraction of the cost.
  const group = new THREE.Group();
  const extra = points.reduce((s, p) => s + (p.intensity ?? 1) * 0.3, 0);
  const amb = new THREE.AmbientLight(0xfff0d0, Math.min(1.3, Math.max(0.55, ambient + extra)));
  group.add(amb);
  return group;
}

// Smoke particle system (for suya grill). Returns { group, update(dt) }.
export function smokeSystem({ x, y, z, count = 30, color = 0xcccccc } = {}) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  const geo = new THREE.SphereGeometry(0.2, 6, 4);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  group.add(mesh);
  const particles = [];
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    particles.push({
      x: (Math.random() - 0.5) * 0.6,
      y: Math.random() * 0.4,
      z: (Math.random() - 0.5) * 0.6,
      vy: 0.3 + Math.random() * 0.3,
      vx: (Math.random() - 0.5) * 0.1,
      vz: (Math.random() - 0.5) * 0.1,
      life: Math.random() * 4,
      scale: 0.5 + Math.random() * 0.7,
    });
  }
  function update(dt) {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.life += dt;
      p.y += p.vy * dt;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      if (p.y > 2.5) {
        p.y = 0; p.x = (Math.random() - 0.5) * 0.6; p.z = (Math.random() - 0.5) * 0.6;
        p.life = 0;
      }
      const opacity = Math.max(0, 0.5 - p.life * 0.15);
      const scale = p.scale * (1 + p.life * 0.3);
      mesh.setColorAt?.(i, new THREE.Color(color).multiplyScalar(opacity * 2));
      m4.compose(
        new THREE.Vector3(p.x, p.y, p.z),
        new THREE.Quaternion(),
        new THREE.Vector3(scale, scale, scale)
      );
      mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  return { group, update };
}

// Strip-light: long thin glowing plane (for ceiling strip lights, string lights)
export function stripLight({ x, y, z, w = 2, h = 0.1, color = 0xfff0b0, intensity = 0.6 }) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, 0.15),
    new THREE.MeshBasicMaterial({ color })
  );
  mesh.position.set(x, y, z);
  group.add(mesh);
  return group;
}

// Dispose everything in a group (recursive)
export function disposeGroup(group) {
  if (!group) return;
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (m.userData && m.userData.shared) return; // shared stylised materials are reused by every place
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
}
