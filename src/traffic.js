// src/traffic.js — improved vehicles with windshields, bumpers + okada motorcycle
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { LANES, WORLD_HALF_X, rng } from "./config.js";

function part(w, h, d, x, y, z, hex) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}
const GLASS = 0x2a3a4a, TYRE = 0x15171a, BODY = 0xffffff, CHROME = 0xc0c4cc;

function wheels(L, W, r, y) {
  const o = [];
  for (const x of [-L * 0.32, L * 0.32]) for (const z of [-W / 2, W / 2]) o.push(part(r * 1.6, r * 2, 0.22, x, r, z, TYRE));
  return o;
}
function lightsGeo(L, W, y, hh = 0.16) {
  const o = [];
  for (const z of [-W * 0.34, W * 0.34]) {
    o.push(part(0.08, hh, 0.3, L / 2 + 0.02, y, z, 0xfff3c4));
    o.push(part(0.08, hh, 0.3, -L / 2 - 0.02, y, z, 0xff2a2a));
  }
  return o;
}

const TYPES = {
  sedan: {
    L: 4.4, W: 1.8,
    body: () => [
      part(4.4, 0.7, 1.8, 0, 0.62, 0, BODY),
      part(2.3, 0.62, 1.64, -0.2, 1.25, 0, GLASS),    // cabin
      part(2.1, 0.08, 1.6, -0.2, 1.58, 0, BODY),       // roof
      part(0.15, 0.3, 1.85, 2.2, 0.8, 0, CHROME),      // front bumper
      part(0.15, 0.3, 1.85, -2.2, 0.8, 0, CHROME),     // rear bumper
      part(0.1, 0.4, 1.4, 1.8, 1.0, 0, GLASS),         // windshield
      part(0.1, 0.4, 1.4, -1.5, 1.0, 0, GLASS),        // rear window
      part(0.15, 0.1, 0.1, 2.1, 1.1, 0.85, CHROME),    // side mirror R
      part(0.15, 0.1, 0.1, 2.1, 1.1, -0.85, CHROME),   // side mirror L
      ...wheels(4.4, 1.8, 0.33)
    ],
    lights: () => lightsGeo(4.4, 1.8, 0.7), weight: 4
  },
  hatch: {
    L: 3.7, W: 1.7,
    body: () => [
      part(3.7, 0.7, 1.7, 0, 0.6, 0, BODY),
      part(2.2, 0.66, 1.56, -0.25, 1.22, 0, GLASS),
      part(2.0, 0.08, 1.5, -0.25, 1.57, 0, BODY),
      part(0.12, 0.25, 1.75, 1.85, 0.7, 0, CHROME),
      part(0.12, 0.25, 1.75, -1.85, 0.7, 0, CHROME),
      part(0.1, 0.35, 1.3, 1.5, 0.95, 0, GLASS),
      ...wheels(3.7, 1.7, 0.31)
    ],
    lights: () => lightsGeo(3.7, 1.7, 0.68), weight: 3
  },
  suv: {
    L: 4.7, W: 1.95,
    body: () => [
      part(4.7, 0.95, 1.95, 0, 0.82, 0, BODY),
      part(3.2, 0.7, 1.8, -0.35, 1.62, 0, GLASS),
      part(3.0, 0.08, 1.75, -0.35, 2.0, 0, BODY),
      part(0.15, 0.35, 2.0, 2.35, 0.9, 0, CHROME),
      part(0.15, 0.35, 2.0, -2.35, 0.9, 0, CHROME),
      part(0.1, 0.45, 1.55, 1.9, 1.3, 0, GLASS),
      part(0.15, 0.1, 0.1, 2.25, 1.4, 0.9, CHROME),
      part(0.15, 0.1, 0.1, 2.25, 1.4, -0.9, CHROME),
      ...wheels(4.7, 1.95, 0.4)
    ],
    lights: () => lightsGeo(4.7, 1.95, 0.95, 0.2), weight: 3
  },
  bus: {
    L: 6.2, W: 2.1,
    body: () => [
      part(6.2, 1.5, 2.1, 0, 1.15, 0, BODY),
      part(5.8, 0.7, 2.14, -0.1, 1.7, 0, GLASS),
      part(6.2, 0.1, 2.1, 0, 1.92, 0, BODY),
      part(6.2, 0.18, 2.12, 0, 0.82, 0, 0x0f4d3a),     // green stripe
      part(0.15, 0.4, 2.15, 3.1, 1.2, 0, GLASS),        // windshield
      ...wheels(6.2, 2.1, 0.4)
    ],
    lights: () => lightsGeo(6.2, 2.1, 0.95, 0.2), weight: 2, fixedColors: [0xf2f2ee, 0xf6c445]
  },
  keke: {
    L: 2.7, W: 1.3,
    body: () => [
      part(2.7, 0.55, 1.3, 0, 0.6, 0, 0xf2c230),       // yellow body
      part(1.5, 1.0, 1.28, -0.45, 1.3, 0, 0xf2c230),   // cabin
      part(1.55, 0.1, 1.32, -0.45, 1.85, 0, 0x1d3b2f), // dark roof
      part(0.1, 0.5, 1.1, 0.35, 1.25, 0, GLASS),       // windshield
      part(0.5, 0.3, 0.5, 1.0, 0.95, 0, 0x2a2a2a),     // front (engine cover)
      part(0.5, 0.5, 0.2, 1.1, 0.25, 0.7, TYRE),
      part(0.5, 0.5, 0.2, -0.9, 0.25, 0.7, TYRE),
      part(0.5, 0.5, 0.2, -0.9, 0.25, -0.7, TYRE),
      part(0.08, 0.12, 0.15, 1.4, 0.8, 0, 0xfff3c4),   // headlight
    ],
    lights: () => [part(0.08, 0.16, 0.2, 1.38, 0.8, 0, 0xfff3c4), part(0.08, 0.16, 0.2, -1.38, 0.8, 0.4, 0xff2a2a), part(0.08, 0.16, 0.2, -1.38, 0.8, -0.4, 0xff2a2a)],
    weight: 5, fixedColors: [0xf2c230]
  },
  // Okada (motorcycle taxi) — new
  okada: {
    L: 1.8, W: 0.6,
    body: () => [
      part(1.8, 0.4, 0.6, 0, 0.7, 0, 0xe11d48),        // red body
      part(0.6, 0.5, 0.5, 0.5, 1.0, 0, 0x1a1a1a),      // seat
      part(0.3, 0.3, 0.3, 0.9, 0.9, 0, CHROME),        // handlebar
      part(0.15, 0.3, 0.15, -0.5, 1.0, 0.2, 0x1a1a1a), // passenger seat
      part(0.3, 0.5, 0.1, 1.0, 0.5, 0, 0x2a2a2a),      // front fork
      part(0.3, 0.5, 0.1, -1.0, 0.5, 0, 0x2a2a2a),     // rear frame
      part(0.3, 0.3, 0.1, -1.0, 0.3, 0, TYRE),         // rear wheel
      part(0.3, 0.3, 0.1, 1.0, 0.3, 0, TYRE),          // front wheel
    ],
    lights: () => [part(0.06, 0.1, 0.1, 1.0, 0.8, 0, 0xfff3c4), part(0.06, 0.1, 0.1, -1.0, 0.6, 0, 0xff2a2a)],
    weight: 3, fixedColors: [0xe11d48, 0x1a1a1a, 0x1d5fa8]
  },
};

const BODY_COLORS = [0xf2f2ee, 0x1f2a36, 0xb7bcc4, 0xa32b2b, 0x1d5fa8, 0x2e7d4f, 0xd98e2b, 0x6b4a8a, 0x8a8f96];

export function createTraffic(scene) {
  const R = rng(777);
  const names = Object.keys(TYPES);
  const bag = []; names.forEach((n) => { for (let i = 0; i < TYPES[n].weight; i++) bag.push(n); });
  const len = WORLD_HALF_X * 2;
  const cars = [];
  LANES.forEach((lane, li) => {
    const n = 9;
    const gap = len / n;
    for (let i = 0; i < n; i++) {
      const type = bag[Math.floor(R() * bag.length)];
      const T = TYPES[type];
      const pool = T.fixedColors || BODY_COLORS;
      cars.push({ lane, type, offset: i * gap + (R() - 0.5) * gap * 0.35, color: new THREE.Color(pool[Math.floor(R() * pool.length)]) });
    }
  });
  const meshes = {};
  for (const name of names) {
    const T = TYPES[name];
    const count = cars.filter((c) => c.type === name).length;
    if (!count) continue;
    const body = new THREE.InstancedMesh(mergeGeometries(T.body()), new THREE.MeshLambertMaterial({ vertexColors: true }), count);
    const lights = new THREE.InstancedMesh(mergeGeometries(T.lights()), new THREE.MeshBasicMaterial({ vertexColors: true }), count);
    body.frustumCulled = lights.frustumCulled = false;
    body.castShadow = false;
    scene.add(body, lights);
    meshes[name] = { body, lights, i: 0, count };
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  const white = new THREE.Color(1, 1, 1);
  const positions = [];

  function update(tSeconds) {
    for (const k in meshes) meshes[k].i = 0;
    positions.length = 0;
    for (const c of cars) {
      const mm = meshes[c.type];
      let s = (c.offset + c.lane.speed * tSeconds) % len;
      if (s < 0) s += len;
      const x = c.lane.dir > 0 ? -WORLD_HALF_X + s : WORLD_HALF_X - s;
      p.set(x, 0.02, c.lane.z);
      q.setFromAxisAngle(up, c.lane.dir > 0 ? 0 : Math.PI);
      m.compose(p, q, one);
      mm.body.setMatrixAt(mm.i, m); mm.body.setColorAt(mm.i, c.color);
      mm.lights.setMatrixAt(mm.i, m); mm.lights.setColorAt(mm.i, white);
      mm.i++;
      positions.push({ x, z: c.lane.z, hl: TYPES[c.type].L / 2, hw: TYPES[c.type].W / 2, dir: c.lane.dir, speed: c.lane.speed });
    }
    for (const k in meshes) {
      const mm = meshes[k];
      mm.body.instanceMatrix.needsUpdate = mm.lights.instanceMatrix.needsUpdate = true;
      if (mm.body.instanceColor) mm.body.instanceColor.needsUpdate = true;
      if (mm.lights.instanceColor) mm.lights.instanceColor.needsUpdate = true;
    }
  }
  function setNight(night) {
    for (const k in meshes) meshes[k].lights.material.color.setScalar(night ? 1 : 0.7);
  }
  return { update, setNight, positions, cars };
}
