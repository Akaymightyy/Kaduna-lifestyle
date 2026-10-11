// src/places/_helpers.js
// Shared low-level helpers for building places. NEVER layouts, props or art.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Make a BoxGeometry with per-face vertex colours (so a single merged mesh
// can have differently-coloured faces). Color is a THREE.Color or hex int.
export function box(w, h, d, x = 0, y = 0, z = 0, color = 0xffffff) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

// Merge a list of geometries into one mesh with vertex colors + Lambert material.
export function mergedMesh(geos, materialOpts = {}) {
  const merged = mergeGeometries(geos);
  const mat = new THREE.MeshLambertMaterial({
    vertexColors: true,
    ...materialOpts,
  });
  const m = new THREE.Mesh(merged, mat);
  m.castShadow = true; m.receiveShadow = true;
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

// Floor plane with simple checker or solid color
export function floor(w, d, color = 0xbfb39a) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshLambertMaterial({ color })
  );
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

// Add a basic interior lighting rig: warm ambient + a few point lights
export function interiorLights({ ambient = 0.5, points = [] } = {}) {
  const group = new THREE.Group();
  const amb = new THREE.AmbientLight(0xfff0d0, ambient);
  group.add(amb);
  const hemi = new THREE.HemisphereLight(0xfff0d0, 0x4a3a20, 0.4);
  group.add(hemi);
  for (const p of points) {
    const pl = new THREE.PointLight(p.color ?? 0xffd070, p.intensity ?? 1.0, p.distance ?? 18, 2.0);
    pl.position.set(p.x, p.y ?? 4, p.z);
    pl.castShadow = !!p.shadow;
    group.add(pl);
  }
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
  const pl = new THREE.PointLight(color, intensity, 12, 2.0);
  pl.position.set(x, y - 0.2, z);
  group.add(pl);
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
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
}
