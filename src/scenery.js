// src/scenery.js — the "big city" extras: roundabouts, a lake, hills and an airport.
// Everything is built once from merged geometry (about 8 draw calls in total) so it costs almost nothing.
// Original low-poly shapes only. Does not touch game data.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { WIDE_AVENUES_X, WIDE_CROSS_Z, rng } from "./config.js";

export const LAKE = { x: 0, z: 500, rx: 190, rz: 95 };
export const AIRPORT = { x: 640, z: 0 };
export const SCENERY_LABELS = [
  { name: "🛫 Kaduna Airport", x: AIRPORT.x, z: AIRPORT.z },
  { name: "🌊 Kangimi Lake", x: LAKE.x, z: LAKE.z - 20 },
  { name: "⛰️ Kufena Hills", x: -520, z: 380 },
  { name: "⛰️ Kajuru Hills", x: 560, z: -420 },
];

const paint = (g, hex) => {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3)); return g;
};
const nonIdx = (g) => (g.index ? g.toNonIndexed() : g);
const box = (L, x, y, z, w, h, d, hex, ry = 0) => {
  const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); L.push(paint(nonIdx(g), hex));
};
const flat = (L, g, x, y, z, hex) => { g.rotateX(-Math.PI / 2); g.translate(x, y, z); L.push(paint(nonIdx(g), hex)); };
const mesh = (scene, L, mat) => {
  const g = mergeGeometries(L.map((q) => { q.deleteAttribute("uv"); return q; }), false);
  const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false; m.receiveShadow = false; scene.add(m); return m;
};

export function addScenery(scene, world) {
  const vc = () => new THREE.MeshLambertMaterial({ vertexColors: true });
  const col = world.colliders;
  const R = rng(20261015);

  // ---------- ROUNDABOUTS (8 big junctions between the district rows) ----------
  const rb = [];
  for (const ax of WIDE_AVENUES_X) for (const cz of [-195, 195]) {
    if (!WIDE_CROSS_Z.includes(cz)) continue;
    flat(rb, new THREE.RingGeometry(10, 20, 40), ax, 0.022, cz, 0x3a3a3f);        // ring road
    flat(rb, new THREE.RingGeometry(19.4, 20, 40), ax, 0.026, cz, 0xf0f0f0);      // white outer edge
    flat(rb, new THREE.RingGeometry(10, 10.5, 40), ax, 0.03, cz, 0xe9d36a);       // yellow inner edge
    flat(rb, new THREE.CircleGeometry(10, 32), ax, 0.05, cz, 0x6fa04a);           // grass island
    flat(rb, new THREE.RingGeometry(8.6, 10, 32), ax, 0.06, cz, 0xcfcfc8);        // kerb
    // trees + a small monument on the island
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2, r = 5.2;
      const tx = ax + Math.cos(a) * r, tz = cz + Math.sin(a) * r;
      box(rb, tx, 0.9, tz, 0.35, 1.8, 0.35, 0x6b4a2b);
      const cone = new THREE.ConeGeometry(1.6, 3.2, 6); cone.translate(tx, 3.1, tz); rb.push(paint(nonIdx(cone), k % 2 ? 0x2f7d3e : 0x3c9449));
    }
    box(rb, ax, 1.1, cz, 2.2, 2.2, 2.2, 0xe8e2d0); box(rb, ax, 3.2, cz, 1.2, 2.2, 1.2, 0x0f7a4a);
  }
  if (rb.length) mesh(scene, rb, vc());

  // ---------- LAKE (north) with sandy shore + reeds ----------
  const lakeL = [], sand = [];
  const ell = (rx, rz, seg) => { const s = new THREE.Shape(); for (let i = 0; i < seg; i++) { const a = i / seg * Math.PI * 2, w = 1 + 0.06 * Math.sin(a * 5) + 0.04 * Math.cos(a * 3); const x = Math.cos(a) * rx * w, y = Math.sin(a) * rz * w; i ? s.lineTo(x, y) : s.moveTo(x, y); } return new THREE.ShapeGeometry(s); };
  flat(sand, ell(LAKE.rx + 16, LAKE.rz + 14, 48), LAKE.x, 0.05, LAKE.z, 0xd9c98f);
  const water = new THREE.Mesh(ell(LAKE.rx, LAKE.rz, 48).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x3f93c9, transparent: true, opacity: 0.92 }));
  water.position.set(LAKE.x, 0.12, LAKE.z); scene.add(water);
  mesh(scene, sand, vc());
  // a wooden jetty + two boats
  const jt = []; box(jt, LAKE.x, 0.5, LAKE.z - LAKE.rz + 2, 5, 0.3, 40, 0x8a6a42);
  for (const bx of [-60, 55]) { box(jt, LAKE.x + bx, 0.3, LAKE.z - 30, 3, 0.8, 8, 0xc9a86a, 0.3); box(jt, LAKE.x + bx, 1.2, LAKE.z - 30, 0.2, 3, 0.2, 0xeeeeee); }
  mesh(scene, jt, vc());

  // ---------- HILLS (ring around the city, all low-poly) ----------
  const hl = [];
  const hillPos = [];
  for (let i = 0; i < 34; i++) {
    const a = i / 34 * Math.PI * 2 + R() * 0.15;
    const rx = 900 + R() * 250, rz = 700 + R() * 200;
    const x = Math.cos(a) * rx, z = Math.sin(a) * rz;
    if (Math.abs(x - AIRPORT.x) < 220 && Math.abs(z) < 300) continue;      // keep the airport area open
    hillPos.push([x, z]);
  }
  for (const [x, z] of [[-520, 400], [-440, 470], [-640, 330], [560, -430], [640, -360], [470, -480], [-640, -300], [-560, -420]]) hillPos.push([x, z]);
  for (const [x, z] of hillPos) {
    const s = 60 + R() * 90, h = 40 + R() * 90;
    const g = new THREE.IcosahedronGeometry(1, 1); g.scale(s, h, s * (0.8 + R() * 0.4)); g.rotateY(R() * 6);
    g.translate(x, -h * 0.25, z);
    hl.push(paint(nonIdx(g), [0x6f8f4a, 0x7c9a52, 0x8a8a5a, 0x5f7f45][(R() * 4) | 0]));
  }
  mesh(scene, hl, vc());

  // ---------- AIRPORT (east) ----------
  const ap = [], ax0 = AIRPORT.x, az0 = AIRPORT.z;
  box(ap, ax0 + 60, 0.04, az0, 44, 0.08, 520, 0x2f2f34);                              // runway
  for (let z = -240; z <= 240; z += 24) box(ap, ax0 + 60, 0.1, az0 + z, 1, 0.04, 10, 0xf4f4f4);   // centre dashes
  for (let k = -1; k <= 1; k += 2) { box(ap, ax0 + 60 + k * 20, 0.1, az0, 0.5, 0.04, 520, 0xf4f4f4); for (let z of [-250, 250]) for (let q = -3; q <= 3; q++) box(ap, ax0 + 60 + q * 5, 0.1, az0 + z, 2, 0.04, 14, 0xf4f4f4); }
  box(ap, ax0 + 25, 0.05, az0, 30, 0.07, 150, 0x4a4a50);                             // apron
  box(ap, ax0 + 38, 0.05, az0 - 100, 26, 0.07, 12, 0x3d3d42);                        // taxiway
  // terminal
  box(ap, ax0 - 5, 6, az0 - 10, 28, 12, 90, 0xe6e0d2); box(ap, ax0 - 5, 12.4, az0 - 10, 30, 1.2, 92, 0x0f7a4a);
  for (let z = -45; z <= 45; z += 7) box(ap, ax0 + 9.2, 5, az0 - 10 + z, 0.3, 5, 4.4, 0x6fb7d6);
  box(ap, ax0 - 5, 15, az0 - 10, 10, 5, 36, 0xf2efe6);
  // control tower
  box(ap, ax0 - 10, 14, az0 + 70, 5, 28, 5, 0xdedbd0); box(ap, ax0 - 10, 30, az0 + 70, 9, 5, 9, 0x6fb7d6); box(ap, ax0 - 10, 33.4, az0 + 70, 10.5, 1.4, 10.5, 0x0f7a4a);
  // hangars
  for (const hz of [-130, -165]) { box(ap, ax0 - 5, 6, az0 + hz, 30, 12, 28, 0xc9c9c2); box(ap, ax0 - 5, 12.6, az0 + hz, 31, 1.2, 29, 0x8a8f95); }
  mesh(scene, ap, vc());
  col.push({ minX: ax0 - 20, maxX: ax0 + 10, minZ: az0 - 55, maxZ: az0 + 35 });
  col.push({ minX: ax0 - 13, maxX: ax0 - 7, minZ: az0 + 67, maxZ: az0 + 73 });
  col.push({ minX: ax0 - 21, maxX: ax0 + 10, minZ: az0 - 179, maxZ: az0 - 116 });

  // parked planes (original simple jet shape)
  const pl = [];
  const jet = (x, z, ry, body, tail) => {
    const put = (g, hex) => { g.rotateY(ry); g.translate(x, 0, z); pl.push(paint(nonIdx(g), hex)); };
    put(new THREE.CylinderGeometry(2.1, 1.6, 32, 10).rotateX(Math.PI / 2).translate(0, 3.2, 0), body);   // fuselage
    put(new THREE.ConeGeometry(2.1, 5, 10).rotateX(Math.PI / 2).translate(0, 3.2, 18.5), body);          // nose
    put(new THREE.BoxGeometry(34, 0.5, 6).translate(0, 3, 1), body);                                      // wings
    put(new THREE.BoxGeometry(0.5, 7, 5).translate(0, 6.8, -14), tail);                                   // tail fin
    put(new THREE.BoxGeometry(12, 0.4, 3.5).translate(0, 4.2, -14.5), body);                              // tail wing
    col.push({ minX: x - 17, maxX: x + 17, minZ: z - 17, maxZ: z + 17 });
  };
  jet(ax0 + 27, az0 - 20, 0, 0xf2f2f2, 0x0f7a4a);
  jet(ax0 + 27, az0 + 35, 0, 0xe8eef2, 0xc0392b);
  const planes = mesh(scene, pl, vc());
  void planes;
  return { roundabouts: WIDE_AVENUES_X.length * 2 };
}
