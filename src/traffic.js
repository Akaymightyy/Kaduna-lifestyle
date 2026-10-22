// src/traffic.js — improved vehicles with windshields, bumpers + okada motorcycle
// FIX: Cars now YIELD at zebra crossings when a pedestrian is on or near the crossing
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { LANES, WORLD_HALF_X, CROSSINGS, rng } from "./config.js";

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

// ---- FIX: Pedestrian-aware traffic — cars yield at zebra crossings ----
let _pedestrianPos = { x: 0, z: 0 };
const CROSSING_YIELD_RANGE = 12;   // metres — car starts slowing within this of a crossing that has a ped
const CROSSING_STOP_RANGE = 5;    // metres — car stops completely when ped is this close to crossing center
const CROSSING_DETECT_WIDTH = 10;  // metres — ped must be within this Z of crossing center to trigger

export function setPedestrianPos(x, z) { _pedestrianPos.x = x; _pedestrianPos.z = z; }

function isPedAtCrossing(carX, laneZ, dir) {
  // Check if the pedestrian is near ANY crossing that this car is approaching
  for (const cx of CROSSINGS) {
    // Is the pedestrian within the crossing's Z range?
    if (Math.abs(_pedestrianPos.z - laneZ) > CROSSING_DETECT_WIDTH) continue;
    // Is the pedestrian near the crossing X?
    if (Math.abs(_pedestrianPos.x - cx) > CROSSING_STOP_RANGE) continue;
    // Is this car approaching the crossing?
    const distToCrossing = (cx - carX) * dir;
    if (distToCrossing > 0 && distToCrossing < CROSSING_YIELD_RANGE) {
      return { shouldStop: distToCrossing < CROSSING_STOP_RANGE, dist: distToCrossing };
    }
  }
  return null;
}


// ---- Night headlight glow (all cars share one small texture atlas + one extra instanced mesh per car type) ----
// Left half of the atlas = soft round halo (headlight / tail light). Right half = pool of light on the road ahead of the car.
function makeGlowAtlas() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 128;
  const g = c.getContext("2d"), img = g.createImageData(256, 128), d = img.data;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) {
    let a = 0;
    if (x < 128) {                                   // halo
      const dx = (x - 63.5) / 64, dy = (y - 63.5) / 64, r = Math.sqrt(dx * dx + dy * dy);
      a = r >= 1 ? 0 : Math.pow(1 - r, 2.2);
    } else {                                         // road pool: bright at the car, fades out ahead and to the sides
      const u = (x - 128) / 127, v = y / 127;
      const side = Math.max(0, 1 - Math.abs(v - 0.5) * 2);
      a = Math.pow(1 - u, 1.9) * Math.pow(side, 1.7) * Math.min(1, u * 10) * 0.5;
    }
    const i = (y * 256 + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function glowPaint(g, rgb) {
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = rgb[0]; col[i * 3 + 1] = rgb[1]; col[i * 3 + 2] = rgb[2]; }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3)); return g;
}
function glowUV(g, off) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, off + uv.getX(i) * 0.5, uv.getY(i)); return g; }
function glowGeometry(T) {
  const out = []; let frontX = T.L / 2;
  for (const lg of T.lights()) {                      // works for every car type: front lights are +x, tail lights are -x
    lg.computeBoundingBox();
    const c = lg.boundingBox.getCenter(new THREE.Vector3()), front = c.x > 0;
    if (front) frontX = Math.max(frontX, lg.boundingBox.max.x);
    const size = front ? 1.05 : 0.65, rgb = front ? [1.0, 0.9, 0.66] : [1.0, 0.12, 0.06];
    for (const ry of [0, Math.PI / 2]) {              // two crossed planes so the halo is visible from any side
      const h = glowUV(new THREE.PlaneGeometry(size, size), 0); h.rotateY(ry); h.translate(c.x + (front ? 0.1 : -0.1), c.y, c.z);
      out.push(glowPaint(h, rgb));
    }
  }
  const len = 8, wid = Math.max(2.4, T.W * 2.2);      // pool of light on the road
  const pool = glowUV(new THREE.PlaneGeometry(len, wid), 0.5); pool.rotateX(-Math.PI / 2); pool.translate(frontX + len / 2 - 0.3, 0.035, 0);
  out.push(glowPaint(pool, [1.0, 0.86, 0.55]));
  return mergeGeometries(out);
}

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
  const glowMat = new THREE.MeshBasicMaterial({ map: makeGlowAtlas(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  let glowOn = false;
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
    const glow = new THREE.InstancedMesh(glowGeometry(T), glowMat, count);
    glow.frustumCulled = false; glow.visible = false; glow.renderOrder = 3;
    scene.add(glow);
    meshes[name] = { body, lights, glow, i: 0, count };
  }
  // Real 3D keke napep + danfo bus models replace the box ones in traffic as soon as they have loaded
  const swapInGlb = async (type, vehicleId) => {
    const mm = meshes[type]; if (!mm) return;
    try {
      const { loadFittedModel } = await import("./vehicles.js");
      const holder = await loadFittedModel(vehicleId); if (!holder) return;
      holder.updateMatrixWorld(true);
      const buckets = new Map();
      holder.traverse((o) => {
        if (!o.isMesh || !o.visible || !o.geometry) return;
        let g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
        for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
        if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        if (!g.attributes.normal) g.computeVertexNormals();
        if (g.index) g = g.toNonIndexed();
        const mt = o.material; if (!buckets.has(mt)) buckets.set(mt, []); buckets.get(mt).push(g);
      });
      if (!buckets.size) return;
      const mats = [], geos = [];
      for (const [mt, list] of buckets) {
        geos.push(mergeGeometries(list, false));
        const lm = new THREE.MeshLambertMaterial({ color: mt.color ? mt.color.clone() : 0xffffff, map: mt.map || null, transparent: !!mt.transparent, opacity: mt.opacity == null ? 1 : mt.opacity, side: mt.side });
        if (mt.map) lm.map.colorSpace = THREE.SRGBColorSpace;
        mats.push(lm);
      }
      const geo = mergeGeometries(geos, true);
      const im = new THREE.InstancedMesh(geo, mats, mm.count);
      im.frustumCulled = false; im.castShadow = false;
      for (let i = 0; i < mm.count; i++) im.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
      scene.add(im); mm.glb = im; mm.body.visible = false; mm.lights.visible = false;
    } catch (e) { console.warn("[traffic] glb swap failed", type, e); }
  };
  swapInGlb("bus", "bus");   // keke GLB is 126k triangles per copy — far too heavy to instance dozens of times (that made the game slow); keke traffic stays light boxes
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  const white = new THREE.Color(1, 1, 1), sc = new THREE.Vector3(1, 1, 1);
  const positions = [];

  // ---- FIX: Per-car speed modifiers for yielding at crossings ----
  const carSpeedMods = cars.map(() => 1.0); // 1.0 = full speed, 0.0 = stopped
  const pv = { x: 0, z: 0, on: false };       // the vehicle the player is driving: traffic waits for it, never drives through it
  let prev = [];                               // last frame's car positions (to keep a gap to the car in front)
  const YIELD_GAP = 9, STOP_GAP = 4.8;

  function update(tSeconds) {
    for (const k in meshes) meshes[k].i = 0;
    positions.length = 0;
    const prevNext = [];
    for (let ci = 0; ci < cars.length; ci++) {
      const c = cars[ci];
      const mm = meshes[c.type];

      // ---- FIX: Check if car should yield at crossing ----
      let s = (c.offset + c.lane.speed * tSeconds) % len;
      if (s < 0) s += len;
      const x = c.lane.dir > 0 ? -WORLD_HALF_X + s : WORLD_HALF_X - s;

      const pedCheck = isPedAtCrossing(x, c.lane.z, c.lane.dir);
      if (pedCheck) {
        if (pedCheck.shouldStop) {
          carSpeedMods[ci] = 0; // full stop
        } else {
          // Slow down proportionally — closer = slower
          carSpeedMods[ci] = Math.max(0.15, pedCheck.dist / CROSSING_YIELD_RANGE);
        }
      } else {
        // Smoothly return to full speed
        carSpeedMods[ci] = Math.min(1.0, carSpeedMods[ci] + 0.05);
      }
      // ---- patience: wait for the player's vehicle or any car ahead in the same lane ----
      {
        const L0 = c.lane, dirc = L0.dir;
        let gap = 1e9;
        if (pv.on && Math.abs(pv.z - L0.z) < 2.6) { const d = (pv.x - x) * dirc; if (d > -1.5 && d < gap) gap = d; }
        for (let j = 0; j < prev.length; j++) { const o = prev[j]; if (o.lane === L0 && o.ci !== ci) { const d = (o.x - x) * dirc - (o.hl + TYPES[c.type].L / 2); if (d > -0.5 && d < gap) gap = d; } }
        if (gap < YIELD_GAP) carSpeedMods[ci] = Math.min(carSpeedMods[ci], gap < STOP_GAP ? 0 : (gap - STOP_GAP) / (YIELD_GAP - STOP_GAP));
      }

      // Apply speed modifier to this car's movement
      // We simulate the slowdown by adjusting the effective offset
      // (can't change c.lane.speed directly — it's shared)
      // Instead, we store a per-car delta that accumulates
      if (!c._yieldDelta) c._yieldDelta = 0;
      const speedMod = carSpeedMods[ci];
      c._yieldDelta += c.lane.speed * (1 - speedMod) * 0.016; // approx dt

      let sAdjusted = (c.offset + c.lane.speed * tSeconds - c._yieldDelta) % len;
      if (sAdjusted < 0) sAdjusted += len;
      const xAdjusted = c.lane.dir > 0 ? -WORLD_HALF_X + sAdjusted : WORLD_HALF_X - sAdjusted;

      p.set(xAdjusted, 0.02, c.lane.z);
      q.setFromAxisAngle(up, c.lane.dir > 0 ? 0 : Math.PI);
      const ek = Math.min(1, Math.min(sAdjusted, len - sAdjusted) / 6);   // shrink to nothing at the ends so cars never pop in/out of walls
      sc.setScalar(Math.max(0.001, ek));
      m.compose(p, q, sc);
      mm.body.setMatrixAt(mm.i, m); mm.body.setColorAt(mm.i, c.color);
      mm.lights.setMatrixAt(mm.i, m); mm.lights.setColorAt(mm.i, white);
      if (mm.glb) mm.glb.setMatrixAt(mm.i, m);
      if (glowOn) mm.glow.setMatrixAt(mm.i, m);
      mm.i++;
      prevNext.push({ x: xAdjusted, lane: c.lane, ci, hl: TYPES[c.type].L / 2 });
      positions.push({ x: xAdjusted, z: c.lane.z, hl: TYPES[c.type].L / 2, hw: TYPES[c.type].W / 2, dir: c.lane.dir, speed: c.lane.speed });
    }
    prev = prevNext;
    for (const k in meshes) {
      const mm = meshes[k];
      if (mm.glb) mm.glb.instanceMatrix.needsUpdate = true;
      mm.body.instanceMatrix.needsUpdate = mm.lights.instanceMatrix.needsUpdate = true;
      if (glowOn) mm.glow.instanceMatrix.needsUpdate = true;
      if (mm.body.instanceColor) mm.body.instanceColor.needsUpdate = true;
      if (mm.lights.instanceColor) mm.lights.instanceColor.needsUpdate = true;
    }
  }
  function setNight(night) {
    for (const k in meshes) meshes[k].lights.material.color.setScalar(night ? 1 : 0.7);
  }
  // v = 0 (day) .. 1 (night). Headlights/tail lights glow and light the road ahead. Costs nothing while it is day.
  function setGlow(v) {
    glowMat.opacity = Math.max(0, Math.min(1, v));
    const on = v > 0.02;
    if (on !== glowOn) { glowOn = on; for (const k in meshes) meshes[k].glow.visible = on && meshes[k].body.visible; }
  }
  return { update, setNight, setGlow, positions, cars, meshes, setPlayerVehicle(x, z, on) { pv.x = x; pv.z = z; pv.on = !!on; }, setVisible(v) { for (const k in meshes) { if (meshes[k].glb) meshes[k].glb.visible = v; meshes[k].body.visible = v && !meshes[k].glb; meshes[k].lights.visible = v && !meshes[k].glb; meshes[k].glow.visible = v && glowOn; } } };
}
