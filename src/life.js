// src/life.js — things that MOVE, so the big city never feels empty:
//   - cars driving the 4 avenues and 4 cross streets (and round the roundabouts)
//   - people walking along every district road
//   - boats on the lake, and a plane that takes off and lands at the airport
// Everything is instanced / merged (6 draw calls in total) and costs almost nothing on the CPU.
import * as THREE from "three";
import { WIDE_AVENUES_X, WIDE_CROSS_Z, MAP_HALF_X, MAP_HALF_Z } from "./config.js";
import { AREAS } from "./areas.js";
import { LAKE, AIRPORT } from "./scenery.js";
import { carShape, busShape, personBody, personHead, hash2, paint, flatten, B, done } from "./town.js";

let _scene = null, _on = false, _t = 0, _last = 0;
let carMesh = null, busMesh = null, bodyMesh = null, headMesh = null, boats = [], plane = null;
const cars = [], buses = [], people = [];
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0), _col = new THREE.Color();
const RB = [];                                       // roundabout centres
for (const ax of WIDE_AVENUES_X) for (const cz of [-195, 195]) RB.push([ax, cz]);

// ---- road path: position at arc-length s along a lane (bends round roundabouts) ----
function lanePos(c, s, out) {
  const len = c.len;
  let t = ((s % len) + len) % len;
  const along = c.dir > 0 ? -len / 2 + t : len / 2 - t;
  let x, z;
  if (c.axis === "z") { x = c.fix + c.off; z = along; } else { x = along; z = c.fix + c.off; }
  for (const [rx, rz] of RB) {                       // go round the island instead of through it
    const dx = x - rx, dz = z - rz;
    if (c.axis === "z" && Math.abs(c.fix - rx) < 1 && Math.abs(dz) < 16) { const b = Math.sqrt(Math.max(0, 15 * 15 - dz * dz)); x = rx + Math.sign(c.off) * Math.max(Math.abs(c.off), b); }
    else if (c.axis === "x" && Math.abs(c.fix - rz) < 1 && Math.abs(dx) < 16) { const b = Math.sqrt(Math.max(0, 15 * 15 - dx * dx)); z = rz + Math.sign(c.off) * Math.max(Math.abs(c.off), b); }
  }
  out.set(x, 0, z); return out;
}

export function initLife(scene) {
  _scene = scene;
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  // roads: lane offset +-2.8, 3 cars per lane, 2 buses per avenue
  const lanes = [];
  for (const ax of WIDE_AVENUES_X) for (const off of [-2.8, 2.8]) lanes.push({ axis: "z", fix: ax, off, dir: off > 0 ? 1 : -1, len: MAP_HALF_Z * 2 - 30 });
  for (const cz of WIDE_CROSS_Z) for (const off of [-2.8, 2.8]) lanes.push({ axis: "x", fix: cz, off, dir: off > 0 ? 1 : -1, len: MAP_HALF_X * 2 - 30 });
  lanes.forEach((ln, li) => {
    for (let k = 0; k < 3; k++) cars.push({ ln, s: (k / 3) * ln.len + hash2("c" + li, k) * 60, v: 9 + hash2("v" + li, k) * 6, hue: hash2("h" + li, k) });
    if (li % 2 === 0) buses.push({ ln, s: hash2("b" + li, 1) * ln.len, v: 6 + hash2("bv" + li, 1) * 2 });
  });
  carMesh = new THREE.InstancedMesh(carShape(), mat, cars.length); carMesh.frustumCulled = false;
  cars.forEach((c, i) => carMesh.setColorAt(i, _col.setHSL(c.hue, 0.6, 0.5)));
  busMesh = new THREE.InstancedMesh(busShape(), mat, buses.length); busMesh.frustumCulled = false;
  buses.forEach((c, i) => busMesh.setColorAt(i, _col.set(0xf2b134)));
  scene.add(carMesh, busMesh);

  // people: 6 per district walking along the pavements of the district road
  const skins = [0x3b2418, 0x5a3a26, 0x7a4e32, 0x2a1810, 0x9a6a46];
  let pi = 0;
  for (const a of AREAS) for (let k = 0; k < 6; k++) {
    const side = k % 2 ? 1 : -1;
    people.push({ ax: a.x, az: a.z + side * (3.6 + hash2(a.id, "pz" + k) * 0.6), span: 40 + hash2(a.id, "ps" + k) * 22, ph: hash2(a.id, "pp" + k) * 100, sp: 1.1 + hash2(a.id, "pv" + k) * 0.7, skin: skins[(pi++) % skins.length] });
  }
  bodyMesh = new THREE.InstancedMesh(personBody(), mat, people.length); headMesh = new THREE.InstancedMesh(personHead(), mat, people.length);
  bodyMesh.frustumCulled = headMesh.frustumCulled = false;
  people.forEach((p, i) => { bodyMesh.setColorAt(i, _col.setHSL(hash2("pc", i), 0.6, 0.5)); headMesh.setColorAt(i, _col.set(p.skin)); });
  scene.add(bodyMesh, headMesh);

  // boats on the lake
  for (let i = 0; i < 3; i++) {
    const L = []; B(L, 2.2, 0.7, 5.5, 0, 0.35, 0, 0x8a5a2b); B(L, 0.12, 5, 0.12, 0, 3, 0.3, 0xdddddd);
    const sail = new THREE.ConeGeometry(1.6, 4.2, 3); sail.rotateY(Math.PI / 2); sail.translate(0.05, 3.2, 0.4); sail.scale(0.15, 1, 1); L.push(paint(flatten(sail), [0xffffff, 0xf2b134, 0xe4572e][i]));
    const g = done(L); const m = new THREE.Mesh(g, mat); m.frustumCulled = false; scene.add(m);
    boats.push({ m, ph: i * 2.1, rx: LAKE.rx * (0.45 + i * 0.12), rz: LAKE.rz * (0.4 + i * 0.1), sp: 0.035 + i * 0.01 });
  }
  // plane (original jet shape)
  const P = []; const put = (g, v) => { P.push(paint(flatten(g), v)); };
  put(new THREE.CylinderGeometry(2.1, 1.6, 32, 10).rotateX(Math.PI / 2).translate(0, 3.2, 0), 0xf2f2f2);
  put(new THREE.ConeGeometry(2.1, 5, 10).rotateX(Math.PI / 2).translate(0, 3.2, 18.5), 0xf2f2f2);
  put(new THREE.BoxGeometry(34, 0.5, 6).translate(0, 3, 1), 0xe8eef2);
  put(new THREE.BoxGeometry(0.5, 7, 5).translate(0, 6.8, -14), 0x0f7a4a);
  put(new THREE.BoxGeometry(12, 0.4, 3.5).translate(0, 4.2, -14.5), 0xe8eef2);
  plane = new THREE.Mesh(done(P), mat); plane.frustumCulled = false; plane.rotation.order = "YXZ"; scene.add(plane);
  _on = true;
}

/** call every frame. `show=false` hides everything (inside a building). */
export function tickLife(px, pz, show = true) {
  if (!_on) return;
  const now = performance.now() / 1000, dt = Math.min(0.1, _last ? now - _last : 0.016); _last = now; _t += dt;
  for (const m of [carMesh, busMesh, bodyMesh, headMesh]) m.visible = show;
  for (const b of boats) b.m.visible = show;
  plane.visible = show;
  if (!show) return;

  // cars + buses
  const dir = new THREE.Vector3(), nx = new THREE.Vector3();
  const place = (mesh, i, c) => {
    c.s += c.v * dt; lanePos(c.ln, c.s, _p); lanePos(c.ln, c.s + 1.5, nx);
    const yaw = Math.atan2(-(nx.z - _p.z), nx.x - _p.x);
    _q.setFromAxisAngle(_up, yaw); _m.compose(_p, _q, _s); mesh.setMatrixAt(i, _m);
  };
  cars.forEach((c, i) => place(carMesh, i, c)); buses.forEach((c, i) => place(busMesh, i, c));
  carMesh.instanceMatrix.needsUpdate = true; busMesh.instanceMatrix.needsUpdate = true;

  // people (only the ones near the player are drawn)
  people.forEach((p, i) => {
    const ph = (_t * p.sp + p.ph) / p.span, f = ph % 2, u = f < 1 ? f : 2 - f;      // ping-pong along the road
    const x = p.ax - p.span + u * p.span * 2, facing = f < 1 ? Math.PI / 2 : -Math.PI / 2;
    const dx = x - px, dz = p.az - pz;
    if (dx * dx + dz * dz > 320 * 320) { _m.makeScale(0, 0, 0); bodyMesh.setMatrixAt(i, _m); headMesh.setMatrixAt(i, _m); return; }
    const bob = Math.abs(Math.sin(_t * p.sp * 5 + p.ph)) * 0.05;
    _p.set(x, bob, p.az); _q.setFromAxisAngle(_up, facing); _m.compose(_p, _q, _s);
    bodyMesh.setMatrixAt(i, _m); headMesh.setMatrixAt(i, _m);
  });
  bodyMesh.instanceMatrix.needsUpdate = true; headMesh.instanceMatrix.needsUpdate = true;

  // boats drift in slow ovals
  boats.forEach((b) => {
    const a = _t * b.sp + b.ph, x = LAKE.x + Math.cos(a) * b.rx, z = LAKE.z + Math.sin(a) * b.rz;
    b.m.position.set(x, 0.12, z); b.m.rotation.y = Math.atan2(-Math.cos(a) * b.rz, -Math.sin(a) * b.rx) + Math.PI / 2;
  });

  // plane: 160 s cycle  (wait -> take off -> away -> come back -> land -> park)
  const T = _t % 160, rx = AIRPORT.x + 60;
  let z = 230, y = 0, pitch = 0;
  if (T < 20) { z = 230; }
  else if (T < 45) { const k = (T - 20) / 25; z = 230 - k * k * 330; y = k > 0.85 ? (k - 0.85) * 60 : 0; pitch = k > 0.85 ? 0.2 : 0; }
  else if (T < 75) { const k = (T - 45) / 30; z = -100 - k * 700; y = 9 + k * 160; pitch = 0.22; }
  else if (T < 100) { z = -9999; y = -50; }
  else if (T < 125) { const k = (T - 100) / 25; z = -800 + k * 700; y = 140 * (1 - k) * (1 - k); pitch = -0.12 * (1 - k); }
  else if (T < 145) { const k = (T - 125) / 20; z = -100 + k * 330; }
  plane.position.set(rx, y, z); plane.rotation.set(-pitch, T >= 100 ? 0 : Math.PI, 0);   // leaves toward -z, comes back heading +z
  plane.visible = z > -3000;
}
