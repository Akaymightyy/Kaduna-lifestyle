// src/street.js — street life: electric poles + sagging wires, potholes, speed bumps, drains, roadside traders,
// rubbish piles, generators + soft blob shadows. One merged mesh + one line set (2 draw calls), all original shapes.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ROAD_HALF, WORLD_HALF_X, WIDE_AVENUES_X, WIDE_CROSS_Z, MAP_HALF_X, MAP_HALF_Z, rng } from "./config.js";

const L = [];                                       // geometry list (vertex colours)
const paint = (g, hex) => { const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute("color", new THREE.BufferAttribute(a, 3)); g.deleteAttribute("uv"); return g; };
const box = (w, h, d, x, y, z, hex, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); L.push(paint(g, hex)); };
const cyl = (r0, r1, h, x, y, z, hex, seg = 8) => { const g = new THREE.CylinderGeometry(r0, r1, h, seg); g.translate(x, y, z); L.push(paint(g, hex)); };
const disc = (r, x, z, hex, sx = 1, sz = 1, y = 0.034) => { const g = new THREE.CircleGeometry(r, 14); g.rotateX(-Math.PI / 2); g.scale(sx, 1, sz); g.translate(x, y, z); L.push(paint(g, hex)); };

const wires = [];                                   // flat list of segment endpoints
function pole(x, z, rot) {                          // wooden/concrete pole with a cross-arm and 3 insulators
  cyl(0.11, 0.15, 8.2, x, 4.1, z, 0x8a8478, 8);
  const c = Math.cos(rot), s = Math.sin(rot);
  box(2.2, 0.14, 0.14, x, 7.7, z, 0x5a4632, rot);
  for (const o of [-0.9, 0, 0.9]) cyl(0.05, 0.05, 0.18, x + c * o, 7.86, z - s * o, 0xe9e4d4, 6);
  if (((x * 7 + z * 3) | 0) % 5 === 0) { box(0.7, 0.9, 0.5, x + s * 0.5, 6.3, z + c * 0.5, 0x6b7078); }   // transformer on some poles
}
function sag(ax, az, bx, bz, y, off) {              // catenary-ish wire between two poles
  const N = 6; let px = ax, pz = az, py = y;
  for (let i = 1; i <= N; i++) {
    const t = i / N, x = ax + (bx - ax) * t, z = az + (bz - az) * t, yy = y - Math.sin(t * Math.PI) * 0.7;
    wires.push(px, py, pz, x, yy, z); px = x; pz = z; py = yy;
  }
}
function line(pts, rotAlong) {                      // pts: [{x,z}], rotAlong: yaw of cross-arm
  for (let i = 0; i < pts.length; i++) {
    pole(pts[i].x, pts[i].z, rotAlong);
    if (i) {
      const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1, nx = -dz / d, nz = dx / d;
      for (const o of [-0.9, 0, 0.9]) sag(a.x + nx * o, a.z + nz * o, b.x + nx * o, b.z + nz * o, 7.85, o);
    }
  }
}

function trader(x, z, face, R) {                    // umbrella + table + crates, a little roadside trade
  const col = [0xe4572e, 0x2e86ab, 0xf2b134, 0x2e7d4f, 0x8a4fff][Math.floor(R() * 5)];
  cyl(0.03, 0.03, 2.1, x, 1.05, z, 0x555555, 6);
  const g = new THREE.ConeGeometry(1.45, 0.55, 8); g.translate(x, 2.3, z); L.push(paint(g, col));
  box(1.3, 0.06, 0.7, x, 0.75, z + face * 0.5, 0xb8844a);
  for (const dx of [-0.55, 0.55]) box(0.06, 0.74, 0.06, x + dx, 0.37, z + face * 0.5, 0x7a5a3a);
  for (let i = 0; i < 4; i++) box(0.22, 0.22, 0.22, x - 0.45 + i * 0.3, 0.9, z + face * 0.5, [0xd9402a, 0xf2b134, 0x4aa04a, 0xe8dcc0][i]);
  box(0.5, 0.35, 0.5, x + 1.1, 0.18, z + face * 0.2, 0xc9a56a); box(0.5, 0.35, 0.5, x + 1.1, 0.53, z + face * 0.2, 0xb8946a);
}

export function buildStreetDetail(scene, colliders, areas = []) {
  const R = rng(777);
  const pts = (arr) => arr;
  // ---- main street: poles on both pavements, every ~36 m ----
  for (const sgn of [1, -1]) {
    const row = []; for (let x = -WORLD_HALF_X + 10; x <= WORLD_HALF_X - 10; x += 36) row.push({ x: x + (sgn > 0 ? 0 : 18), z: sgn * (ROAD_HALF + 5.4) });
    line(row, 0);
    for (const p of row) colliders.push({ minX: p.x - 0.2, maxX: p.x + 0.2, minZ: p.z - 0.2, maxZ: p.z + 0.2 });
  }
  // traders on the main-street pavements (between the poles)
  for (let i = 0; i < 12; i++) {
    const x = -WORLD_HALF_X + 24 + i * 33 + R() * 6, sgn = i % 2 ? 1 : -1, z = sgn * (ROAD_HALF + 4.2);
    trader(x, z, -sgn, R);
    colliders.push({ minX: x - 1.1, maxX: x + 1.6, minZ: z - 0.6, maxZ: z + 0.6 });
  }
  // ---- avenues + cross streets: poles on one side (every ~45 m) ----
  for (const ax of WIDE_AVENUES_X) for (const sg of [1, -1]) {
    const row = []; for (let z = ROAD_HALF + 20; z < MAP_HALF_Z - 18; z += 45) row.push({ x: ax + 6.8, z: sg * z });
    line(row, Math.PI / 2);
    for (const p of row) colliders.push({ minX: p.x - 0.2, maxX: p.x + 0.2, minZ: p.z - 0.2, maxZ: p.z + 0.2 });
  }
  for (const cz of WIDE_CROSS_Z) {
    const row = []; for (let x = -MAP_HALF_X + 24; x < MAP_HALF_X - 20; x += 45) { if (WIDE_AVENUES_X.some(a => Math.abs(a - x) < 14)) continue; row.push({ x, z: cz - 6.8 }); }
    // keep each wire span short: split where an avenue was skipped
    let seg = []; for (const p of row) { if (seg.length && p.x - seg[seg.length - 1].x > 60) { line(seg, 0); seg = []; } seg.push(p); } if (seg.length) line(seg, 0);
    for (const p of row) colliders.push({ minX: p.x - 0.2, maxX: p.x + 0.2, minZ: p.z - 0.2, maxZ: p.z + 0.2 });
  }
  // ---- road surface details ----
  for (let i = 0; i < 46; i++) {                                    // potholes on the main street + avenues
    const onMain = i < 22, x = onMain ? -190 + R() * 380 : WIDE_AVENUES_X[i % 4] + (R() - 0.5) * 6, z = onMain ? (R() < 0.5 ? 1 : -1) * (1.5 + R() * 5.5) : (R() < 0.5 ? 1 : -1) * (ROAD_HALF + 30 + R() * (MAP_HALF_Z - 80));
    const r = 0.35 + R() * 0.4; disc(r + 0.12, x, z, 0x2b2d31, 1.3, 1, 0.032); disc(r, x, z, 0x1b1c1f, 1.3, 1, 0.034);
  }
  for (const x of [-120, 60, 150]) for (let k = 0; k < 6; k++) box(0.5, 0.06, 7.6, x + k * 0.55, 0.05, 0, k % 2 ? 0x222222 : 0xe8c02a);   // speed bump (rumble strip) across the main street
  for (const sgn of [1, -1]) for (let x = -190; x < 190; x += 14) box(2.4, 0.04, 0.55, x + 3, 0.03, sgn * (ROAD_HALF + 0.35), 0x1d1e22);           // gutter covers along the kerb
  // ---- tidy bins along the main street pavements ----
  for (let i = 0; i < 22; i++) {
    const x = -190 + i * 17.5 + R() * 5, sgn = i % 2 ? 1 : -1, z = sgn * (ROAD_HALF + 1.0);
    cyl(0.3, 0.26, 0.85, x, 0.43, z, [0x2e7d4f, 0x2e6fa5, 0x555a60][i % 3], 10); cyl(0.32, 0.32, 0.07, x, 0.88, z, 0x222222, 10);
  }
  for (let i = 0; i < 9; i++) { const x = -170 + i * 42 + R() * 10, sgn = i % 2 ? 1 : -1, z = sgn * (ROAD_HALF + 7.6); box(1.0, 0.8, 0.6, x, 0.4, z, 0x7a8088); box(1.02, 0.14, 0.62, x, 0.82, z, 0xe08a20); cyl(0.05, 0.05, 0.5, x + 0.3, 1.05, z, 0x333333, 6); colliders.push({ minX: x - 0.55, maxX: x + 0.55, minZ: z - 0.35, maxZ: z + 0.35 }); }

  // ---- every district: poles + wires along its own road, bins, potholes, a speed bump, drain covers, a generator ----
  for (const a of areas) {
    const row = []; for (let x = a.x - 56; x <= a.x + 60; x += 28) row.push({ x: x + (((Math.round(x / 28) % 2) + 2) % 2) * 0, z: a.z + (Math.round((x - a.x) / 28) % 2 ? 4.7 : -4.7) });
    for (let i = row.length - 1; i >= 0; i--) if (WIDE_AVENUES_X.some((ax) => Math.abs(row[i].x - ax) < 9) || Math.abs(row[i].x) < 0) row.splice(i, 1);   // never a pole on an avenue
    let seg = []; for (const p of row) { if (seg.length && p.x - seg[seg.length - 1].x > 40) { line(seg, 0); seg = []; } seg.push(p); } if (seg.length) line(seg, 0);
    for (const p of row) colliders.push({ minX: p.x - 0.2, maxX: p.x + 0.2, minZ: p.z - 0.2, maxZ: p.z + 0.2 });
    for (let i = 0; i < 5; i++) { const x = a.x - 50 + i * 24 + R() * 6, z = a.z + (i % 2 ? 4.55 : -4.55); cyl(0.28, 0.24, 0.8, x, 0.4, z, [0x2e7d4f, 0x2e6fa5, 0x555a60][i % 3], 10); cyl(0.3, 0.3, 0.07, x, 0.83, z, 0x222222, 10); }
    for (let i = 0; i < 4; i++) { const x = a.x - 52 + R() * 104, z = a.z + (R() - 0.5) * 3.6, r = 0.3 + R() * 0.35; disc(r + 0.12, x, z, 0x2b2d31, 1.3, 1, 0.034); disc(r, x, z, 0x1b1c1f, 1.3, 1, 0.036); }
    for (let k = 0; k < 5; k++) box(0.5, 0.06, 5.4, a.x - 20 + k * 0.55, 0.05, a.z, k % 2 ? 0x222222 : 0xe8c02a);
    for (let x = -48; x < 52; x += 16) box(2.2, 0.04, 0.5, a.x + x, 0.03, a.z + 3.0, 0x1d1e22);
    const gx = a.x - 36 + R() * 8; box(1.0, 0.8, 0.6, gx, 0.4, a.z - 4.9, 0x7a8088); box(1.02, 0.14, 0.62, gx, 0.82, a.z - 4.9, 0xe08a20);
    colliders.push({ minX: gx - 0.55, maxX: gx + 0.55, minZ: a.z - 5.25, maxZ: a.z - 4.55 });
  }

  const geo = mergeGeometries(L); L.length = 0;
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  mesh.matrixAutoUpdate = false; mesh.frustumCulled = false;
  const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(wires), 3));
  const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x1b1b1b }));
  lines.frustumCulled = false;
  const g = new THREE.Group(); g.add(mesh, lines); scene.add(g);
  return g;
}

// ---- soft blob shadows (one instanced disc mesh; call set(i,x,z,sx,sz,yaw) each frame) ----
export function makeBlobShadows(scene, count) {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d"), gr = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, "rgba(0,0,0,0.55)"); gr.addColorStop(0.6, "rgba(0,0,0,0.25)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, count);
  mesh.frustumCulled = false; mesh.renderOrder = 2;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), Z = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, Z);
  scene.add(mesh);
  return {
    mesh,
    set(i, x, z, sx, sz, yaw = 0) { p.set(x, 0.045, z); q.setFromAxisAngle(up, yaw); s.set(sx, 1, sz); m.compose(p, q, s); mesh.setMatrixAt(i, m); },
    hide(i) { mesh.setMatrixAt(i, Z); },
    done() { mesh.instanceMatrix.needsUpdate = true; },
  };
}
