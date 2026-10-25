// src/traffic.js — improved vehicles with windshields, bumpers + okada motorcycle
// FIX: Cars now YIELD at zebra crossings when a pedestrian is on or near the crossing
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { LANES, WORLD_HALF_X, CROSSINGS, WIDE_AVENUES_X, rng } from "./config.js";

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
// Oct 25: default is now FAR AWAY. It used to default to (0,0) — the exact
// spot of the x=0 zebra crossing — and nothing ever called setPedestrianPos,
// so a phantom pedestrian stood on that crossing forever and EVERY lane
// queued up permanently 5m before it (cars frozen mid-road). main.js now
// feeds the real player position every frame (on foot only).
let _pedestrianPos = { x: 1e9, z: 1e9 };
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

export function createTraffic(scene, colliders = []) {
  const R = rng(777);
  const names = Object.keys(TYPES);
  const bag = []; names.forEach((n) => { for (let i = 0; i < TYPES[n].weight; i++) bag.push(n); });
  // Oct 25 FIX ("cars shrinking EVERYWHERE in the middle of roads"): two causes.
  //   1) The main-road asphalt is WORLD_HALF_X*2+200 long, but the lanes were
  //      only WORLD_HALF_X*2 — every car wrapped around (and hid) 100m BEFORE
  //      the road visually ends, in plain view mid-road.
  //   2) Cars used to LOOP INSIDE short collider-free stretches, so every
  //      stretch seam was a mid-road dive point — with the denser city the
  //      stretches got short and the dives were constant.
  // Now lanes span the full asphalt (wrap = at the visual end of the road, far
  // away), cars drive the WHOLE lane, and the only dives are: a blocked span
  // where a building genuinely stands on the road (rare — the OSM layer keeps
  // buildings off the lanes), and the road's own two ends.
  const len = WORLD_HALF_X * 2 + 200;
  const cars = [];
  // Walk each lane once: mark where a collider actually stands on the road
  // ("blocked" arcs, in lane arc-length s) and keep the clear runs for spawning.
  function _laneSpans(ln) {
    const near = colliders.filter((c) => isFinite(c.minX) && c.minX < c.maxX && c.minZ < c.maxZ && c.maxZ > ln.z - 6 && c.minZ < ln.z + 6);
    const blocked = []; let start = null;
    for (let a = 0; a <= len; a += 2) {
      const x = ln.dir > 0 ? -len / 2 + a : len / 2 - a;
      let hit = false;
      for (const c of near) if (x + 1.5 > c.minX && x - 1.5 < c.maxX && ln.z + 3.2 > c.minZ && ln.z - 3.2 < c.maxZ) { hit = true; break; }
      if (hit && start === null) start = a;
      if ((!hit || a >= len) && start !== null) { blocked.push({ a0: start - 4.5, a1: (hit ? a : a - 2) + 4.5 }); start = null; }
    }
    // clear spans = the complement (only used to spread the spawn points)
    const clear = []; let prev = 0;
    for (const b of blocked) { if (b.a0 - prev >= 14) clear.push({ a0: prev, a1: b.a0 }); prev = b.a1; }
    if (len - prev >= 14) clear.push({ a0: prev, a1: len });
    if (!clear.length) clear.push({ a0: 8, a1: len - 8 });
    return { blocked, clear };
  }
  const LANES_FULL = LANES.map((ln) => {
    const spans = _laneSpans(ln);
    console.log("[traffic] lane z=" + ln.z + " dir=" + ln.dir + " — " + spans.blocked.length + " blocked span(s) on " + len + "m");
    return { z: ln.z, dir: ln.dir, speed: ln.speed, len, spans };
  });
  LANES_FULL.forEach((L) => {
    const n = 9;
    const tot = L.spans.clear.reduce((a, g) => a + (g.a1 - g.a0), 0);
    for (let i = 0; i < n; i++) {
      const type = bag[Math.floor(R() * bag.length)];
      const T = TYPES[type];
      const pool = T.fixedColors || BODY_COLORS;
      // spread cars proportionally across the clear spans (never spawn inside a building)
      let u = ((i + 0.5) / n + (R() - 0.5) * (0.6 / n)) * tot;
      let s0 = L.spans.clear[0].a0 + (L.spans.clear[0].a1 - L.spans.clear[0].a0) / 2;
      for (const g of L.spans.clear) { const gl = g.a1 - g.a0; if (u < gl) { s0 = g.a0 + u; break; } u -= gl; }
      cars.push({ lane: L, type, offset: Math.max(8, Math.min(len - 8, s0)), color: new THREE.Color(pool[Math.floor(R() * pool.length)]) });
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
  const pv = { x: 0, z: 0, on: false };       // the vehicle the player is driving: traffic waits for it, never drives through it
  let prev = [];                               // last frame's car positions (to keep a gap to the car in front)
  const YIELD_GAP = 9, STOP_GAP = 4.8;
  // TODO #5 (Oct 24): junction give-way — the avenues (x = -230/-90/90/230)
  // cross the main street; traffic cars stop 30m before a junction while a
  // life.js car is on it. The cross positions come from a provider wired in
  // main.js (life.js keeps its own positions; no circular import).
  let _crossTraffic = null;
  function setCrossTrafficProvider(fn) { _crossTraffic = fn; }
  // TODO #2 (Oct 24): runtime guard — world.colliders GROW lazily as districts
  // stream in, so the init-time stretches can go stale. Every 0.5s rebuild the
  // list of colliders within 80m of the player (cheap: one pass, not per car
  // per frame). Any car that ends up inside one is hidden + frozen until clear.
  let _nearCols = [], _colT = 1, _lastT = -1;

  function update(tSeconds) {
    for (const k in meshes) meshes[k].i = 0;
    positions.length = 0;
    const dt = _lastT < 0 ? 0.016 : Math.min(0.1, Math.max(0, tSeconds - _lastT));
    _lastT = tSeconds;

    _colT += dt;
    if (_colT >= 0.5) {
      _colT = 0;
      _nearCols.length = 0;
      const r = 80;
      for (const c of colliders) {
        if (!isFinite(c.minX) || c.minX > c.maxX || c.minZ > c.maxZ) continue;
        if (c.maxX < pv.x - r || c.minX > pv.x + r || c.maxZ < pv.z - r || c.minZ > pv.z + r) continue;
        _nearCols.push(c);
      }
    }

    const prevNext = [];
    for (let ci = 0; ci < cars.length; ci++) {
      const c = cars[ci];
      const mm = meshes[c.type];
      const L = c.lane;
      if (c.s == null) c.s = ((c.offset % L.len) + L.len) % L.len;
      const x0 = L.dir > 0 ? -L.len / 2 + c.s : L.len / 2 - c.s;

      // ---- FIX: yield at zebra crossings ----
      let go = 1;
      const pedCheck = isPedAtCrossing(x0, L.z, L.dir);
      if (pedCheck) go = pedCheck.shouldStop ? 0 : Math.max(0.15, pedCheck.dist / CROSSING_YIELD_RANGE);

      // ---- patience: wait for the player's vehicle or any car ahead in the same stretch ----
      {
        let gap = 1e9;
        if (pv.on && Math.abs(pv.z - L.z) < 2.6) { const d = (pv.x - x0) * L.dir; if (d > -1.5 && d < gap) gap = d; }
        for (let j = 0; j < prev.length; j++) { const o = prev[j]; if (o.lane === L && o.ci !== ci) { const d = (o.x - x0) * L.dir - (o.hl + TYPES[c.type].L / 2); if (d > -0.5 && d < gap) gap = d; } }
        if (gap < YIELD_GAP) go = Math.min(go, gap < STOP_GAP ? 0 : (gap - STOP_GAP) / (YIELD_GAP - STOP_GAP));
      }

      // ---- TODO #5: junction give-way to avenue cross-traffic ----
      if (go > 0 && _crossTraffic) {
        const cross = _crossTraffic();
        for (const jx of WIDE_AVENUES_X) {
          const dJ = (jx - x0) * L.dir;                    // how far ahead the junction is
          if (dJ <= 0 || dJ >= 30) continue;
          for (let k = 0; k < cross.length; k++) {
            const o = cross[k];
            if (Math.abs(o.x - jx) > 14) continue;         // not at this junction
            if (Math.abs(o.z) > 9) continue;               // not on the main street
            go = 0; break;                                 // someone is crossing → give way
          }
          if (go === 0) break;
        }
      }

      // ---- advance along the WHOLE lane (wrap only at the road's two ends) ----
      if (c._go == null) c._go = 1;
      c._go += (go - c._go) * Math.min(1, dt * 6);          // smooth accel / brake (IDM-lite)
      if (c._go < 0.004) c._go = 0;
      const adv = L.speed * c._go * dt;
      c.s += adv;
      if (c.s >= L.len) c.s -= L.len;
      const x = L.dir > 0 ? -L.len / 2 + c.s : L.len / 2 - c.s;

      // ---- TODO #2 runtime guard: freeze + hide inside a lazily-built collider ----
      let overlap = false;
      if (Math.abs(x - pv.x) < 80 && Math.abs(L.z - pv.z) < 80) {
        for (const col of _nearCols) {
          if (x + 1.5 > col.minX && x - 1.5 < col.maxX && L.z + 3.2 > col.minZ && L.z - 3.2 < col.maxZ) { overlap = true; break; }
        }
      }
      // Oct 25 FIX, v2 ("cars shrinking EVERYWHERE"): the previous fix replaced
      // scale-0 with an eased dive, but the dive still fired at EVERY stretch
      // seam — dozens of upright cars sinking/rising in plain view each minute,
      // which still reads as "shrinking". Now the ONLY dives are: (a) this lane's
      // precomputed blocked spans (a building genuinely on the road — rare,
      // the OSM layer keeps buildings off the lanes), (b) the two road ends
      // where the asphalt stops, (c) lazily-added colliders (runtime guard).
      // The dive eases faster (dt*9) so the car is fully under before it
      // reaches the collider edge, and the margin below (4.5m) covers the
      // easing distance at top speed.
      const edge = Math.min(c.s, L.len - c.s);              // distance to the road end
      let inBlk = false;
      for (let bi = 0; bi < L.spans.blocked.length; bi++) { const b = L.spans.blocked[bi]; if (c.s > b.a0 && c.s < b.a1) { inBlk = true; break; } }
      const wantSink = (overlap || inBlk || edge < 2.5) ? 1 : 0;
      if (c._sk == null) c._sk = wantSink;
      c._sk += (wantSink - c._sk) * Math.min(1, dt * 9);    // ease the dive so nothing snaps
      if (c._sk > 0.995) c._sk = 1; else if (c._sk < 0.005) c._sk = 0;

      p.set(x, 0.02 - 2.7 * c._sk, L.z);
      q.setFromAxisAngle(up, L.dir > 0 ? 0 : Math.PI);
      sc.setScalar(1);
      m.compose(p, q, sc);
      mm.body.setMatrixAt(mm.i, m); mm.body.setColorAt(mm.i, c.color);
      mm.lights.setMatrixAt(mm.i, m); mm.lights.setColorAt(mm.i, white);
      if (mm.glb) mm.glb.setMatrixAt(mm.i, m);
      if (glowOn) mm.glow.setMatrixAt(mm.i, m);
      mm.i++;
      prevNext.push({ x, lane: L, ci, hl: TYPES[c.type].L / 2 });
      positions.push({ x, z: L.z, hl: TYPES[c.type].L / 2, hw: TYPES[c.type].W / 2, dir: L.dir, speed: L.speed * c._go });
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
  return { update, setNight, setGlow, positions, cars, meshes, setCrossTrafficProvider, setPlayerVehicle(x, z, on) { pv.x = x; pv.z = z; pv.on = !!on; }, setVisible(v) { for (const k in meshes) { if (meshes[k].glb) meshes[k].glb.visible = v; meshes[k].body.visible = v && !meshes[k].glb; meshes[k].lights.visible = v && !meshes[k].glb; meshes[k].glow.visible = v && glowOn; } } };
}
