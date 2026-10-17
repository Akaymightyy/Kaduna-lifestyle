// src/fun.js — "fun places" that make every district a real neighbourhood, not just rows of houses:
// football pitch, park, playground, suya spot, bazaar, petrol station, hotel, shops, borehole, bukka, pool club, tennis court.
// Original low-poly shapes (plain boxes / cones). Every district gets 3 of them, picked by its price tier.
// Colours are real colours (this geometry is merged into the district's static mesh).
import * as THREE from "three";
import { B, done, paint, flatten, hash2 } from "./town.js";

export const FUN_INFO = {
  pitch:      { name: "Football Pitch",   icon: "⚽", w: 17, d: 11, solid: false },
  park:       { name: "Community Park",   icon: "🌳", w: 16, d: 12, solid: false },
  playground: { name: "Playground",       icon: "🛝", w: 12, d: 10, solid: false },
  suya:       { name: "Suya Spot",        icon: "🍢", w: 10, d: 8,  solid: true },
  bazaar:     { name: "Bazaar",           icon: "🛍️", w: 16, d: 9,  solid: false },
  petrol:     { name: "Petrol Station",   icon: "⛽", w: 15, d: 11, solid: true },
  hotel:      { name: "Hotel",            icon: "🏨", w: 15, d: 10, solid: true },
  shops:      { name: "Shops & Salon",    icon: "🏪", w: 16, d: 6,  solid: true },
  borehole:   { name: "Borehole",         icon: "💧", w: 8,  d: 8,  solid: true },
  bukka:      { name: "Mama Put Bukka",   icon: "🍲", w: 11, d: 8,  solid: false },
  pool:       { name: "Pool Club",        icon: "🏊", w: 16, d: 11, solid: false },
  tennis:     { name: "Tennis Court",     icon: "🎾", w: 16, d: 10, solid: false },
};
const POOLS = {
  cheap:  ["pitch", "suya", "shops", "borehole", "bukka", "playground", "bazaar"],
  middle: ["pitch", "park", "playground", "petrol", "shops", "suya", "bukka", "bazaar"],
  rich:   ["park", "hotel", "pool", "tennis", "petrol", "shops", "playground"],
};
export function funKinds(area) {                                   // 3 distinct kinds, stable per district
  const pool = POOLS[area.tier] || POOLS.cheap, out = [];
  for (let i = 0; out.length < 3 && i < 30; i++) { const k = pool[Math.floor(hash2(area.id, "fun" + i) * pool.length) % pool.length]; if (!out.includes(k)) out.push(k); }
  return out;
}

const quad = (L, w, d, x, y, z, c) => { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.translate(x, y, z); L.push(paint(flatten(g), c)); };
const cone = (L, r, h, x, y, z, c, seg = 6) => { const g = new THREE.ConeGeometry(r, h, seg); g.translate(x, y + h / 2, z); L.push(paint(flatten(g), c)); };
const ball = (L, r, x, y, z, c) => { const g = new THREE.SphereGeometry(r, 8, 6); g.translate(x, y, z); L.push(paint(flatten(g), c)); };
const tree = (L, x, z, s = 1) => { B(L, 0.3 * s, 1.6 * s, 0.3 * s, x, 0.8 * s, z, 0x6b4a2b); ball(L, 1.3 * s, x, 2.5 * s, z, 0x3f8f4a); ball(L, 0.9 * s, x + 0.5 * s, 3.2 * s, z, 0x4fa35a); };
const bench = (L, x, z, ry = 0) => { B(L, 1.5, 0.12, 0.45, x, 0.45, z, 0x8a5a2b, ry); B(L, 1.5, 0.4, 0.1, x, 0.75, z - 0.2, 0x8a5a2b, ry); B(L, 0.1, 0.45, 0.4, x - 0.6, 0.22, z, 0x4a4f55, ry); B(L, 0.1, 0.45, 0.4, x + 0.6, 0.22, z, 0x4a4f55, ry); };
const umbrella = (L, x, z, c) => { B(L, 0.08, 2.2, 0.08, x, 1.1, z, 0xdddddd); cone(L, 1.5, 0.5, x, 2.1, z, c, 8); };
const table = (L, x, z) => { B(L, 1.1, 0.08, 0.8, x, 0.75, z, 0xe8e2d0); B(L, 0.08, 0.75, 0.08, x - 0.45, 0.37, z - 0.3, 0x777777); B(L, 0.08, 0.75, 0.08, x + 0.45, 0.37, z + 0.3, 0x777777); };
const chair = (L, x, z, c = 0xc0392b) => { B(L, 0.42, 0.06, 0.42, x, 0.45, z, c); B(L, 0.42, 0.45, 0.06, x, 0.7, z - 0.2, c); B(L, 0.06, 0.45, 0.06, x - 0.17, 0.22, z - 0.17, 0x777777); B(L, 0.06, 0.45, 0.06, x + 0.17, 0.22, z + 0.17, 0x777777); };

const MAKERS = {
  pitch(L) {
    quad(L, 17, 11, 0, 0.03, 0, 0x4f9a43); for (let i = -3; i <= 3; i += 2) quad(L, 2, 11, i * 2.3, 0.035, 0, 0x57a64a);
    quad(L, 16, 0.12, 0, 0.04, 5, 0xffffff); quad(L, 16, 0.12, 0, 0.04, -5, 0xffffff); quad(L, 0.12, 10, -8, 0.04, 0, 0xffffff); quad(L, 0.12, 10, 8, 0.04, 0, 0xffffff); quad(L, 0.12, 10, 0, 0.04, 0, 0xffffff);
    for (const s of [-1, 1]) { const x = s * 8; B(L, 0.1, 2.2, 0.1, x, 1.1, -1.8, 0xffffff); B(L, 0.1, 2.2, 0.1, x, 1.1, 1.8, 0xffffff); B(L, 0.1, 0.1, 3.7, x, 2.2, 0, 0xffffff); B(L, 1.2, 0.05, 3.6, x + s * 0.6, 1.0, 0, 0xd8d8d8); }
    B(L, 6, 0.4, 0.8, 0, 0.2, 6.3, 0xb0a99a); B(L, 6, 0.4, 0.8, 0, 0.6, 6.9, 0xb0a99a);
  },
  park(L) {
    quad(L, 16, 12, 0, 0.03, 0, 0x6cb35a); quad(L, 1.6, 12, 0, 0.04, 0, 0xd8c9a0); quad(L, 16, 1.6, 0, 0.04, 0, 0xd8c9a0);
    B(L, 3.2, 0.5, 3.2, 0, 0.25, 0, 0xb8b2a4); B(L, 2.2, 0.7, 2.2, 0, 0.6, 0, 0x4aa3d0); B(L, 0.3, 1.6, 0.3, 0, 1.3, 0, 0xcfcabd); ball(L, 0.5, 0, 2.2, 0, 0x9bd6ee);
    [[-6, -4], [6, -4.5], [-6, 4], [6, 4.5], [-3.5, -4.6], [3.5, 4.6]].forEach(([x, z], i) => tree(L, x, z, 0.9 + (i % 3) * 0.12));
    bench(L, -2.8, -1.5); bench(L, 2.8, 1.5, Math.PI); bench(L, -2.8, 1.6); bench(L, 2.8, -1.6, Math.PI);
  },
  playground(L) {
    quad(L, 12, 10, 0, 0.03, 0, 0xd9c48b);
    for (const x of [-1.6, 1.6]) { B(L, 0.12, 2.6, 0.12, x, 1.3, -2, 0xe4572e); B(L, 0.12, 2.6, 0.12, x, 1.3, -3.4, 0xe4572e); B(L, 0.12, 0.12, 1.5, x, 2.6, -2.7, 0xe4572e); }
    B(L, 3.5, 0.12, 0.12, 0, 2.6, -2.7, 0x555555); B(L, 0.6, 0.06, 0.4, -0.9, 0.7, -2.7, 0x2e86ab); B(L, 0.6, 0.06, 0.4, 0.9, 0.7, -2.7, 0xf2b134);
    B(L, 2, 2.4, 1.8, 3.6, 1.2, 1.5, 0x2e86ab); const sl = new THREE.BoxGeometry(1.2, 0.12, 3.2); sl.rotateX(-0.62); sl.translate(3.6, 1.15, 3.7); L.push(paint(flatten(sl), 0xf2b134));
    B(L, 3, 0.35, 3, -3.6, 0.18, 2, 0xc9a96b); B(L, 2.6, 0.3, 2.6, -3.6, 0.42, 2, 0xe8d49a);
    B(L, 3.2, 0.14, 0.4, 0, 0.55, 3.2, 0x7bc86c); B(L, 0.2, 0.55, 0.3, 0, 0.27, 3.2, 0x555555);
  },
  suya(L) {
    B(L, 5, 0.12, 4, 0, 2.8, 0, 0xe4572e); B(L, 5, 0.14, 4, 0, 2.78, 0, 0xffffff); for (let i = -2; i <= 2; i++) B(L, 0.9, 0.16, 4.02, i * 1, 2.82, 0, i % 2 ? 0xe4572e : 0xffffff);
    for (const [x, z] of [[-2.4, -1.9], [2.4, -1.9], [-2.4, 1.9], [2.4, 1.9]]) B(L, 0.12, 2.8, 0.12, x, 1.4, z, 0x6b4a2b);
    B(L, 3, 0.9, 1.1, 0, 0.45, -1.2, 0x3a3a3e); B(L, 2.7, 0.08, 0.8, 0, 0.93, -1.2, 0xe25822); for (let i = -2; i <= 2; i++) B(L, 0.05, 0.05, 1.2, i * 0.5, 1.05, -1.2, 0xb88a5a);
    B(L, 3.4, 0.95, 0.6, 0, 0.5, -2.6, 0xf2b134); table(L, -3.3, 2.5); table(L, 3.3, 2.5); chair(L, -3.3, 3.4); chair(L, -2.4, 2.6, 0x2e86ab); chair(L, 3.3, 3.4); chair(L, 4.2, 2.6, 0x2e86ab);
    B(L, 3.2, 0.9, 0.12, 0, 3.4, 2.1, 0x1f1f24); B(L, 2.8, 0.55, 0.14, 0, 3.4, 2.12, 0xf2b134);
  },
  bazaar(L) {
    for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) {
      const x = -6 + i * 4, z = -2.4 + r * 4.8, c = [0xe4572e, 0xf2b134, 0x2e86ab, 0x7bc86c, 0xb565a7, 0xff8c42, 0x3aa6a0, 0xc0392b][(i + r * 4) % 8];
      B(L, 2.8, 0.9, 1.4, x, 0.45, z, 0xd8c7a0); const rf = new THREE.BoxGeometry(3.2, 0.12, 2.4); rf.rotateX(r ? -0.18 : 0.18); rf.translate(x, 2.2, z); L.push(paint(flatten(rf), c));
      for (const dx of [-1.4, 1.4]) B(L, 0.1, 2.2, 0.1, x + dx, 1.1, z + (r ? -1 : 1) * 1.0, 0x6b4a2b);
      B(L, 0.5, 0.35, 0.5, x - 0.7, 1.05, z, 0x7bc86c); B(L, 0.5, 0.35, 0.5, x + 0.5, 1.05, z, 0xf2b134);
    }
  },
  petrol(L) {
    quad(L, 15, 11, 0, 0.03, 0, 0x55585e);
    B(L, 12, 0.4, 6, -0.5, 4.6, 1, 0xe8e8e8); B(L, 12.2, 0.18, 6.2, -0.5, 4.35, 1, 0xd02f2f); for (const x of [-5, 4]) B(L, 0.4, 4.4, 0.4, x, 2.2, 1, 0xcfcfcf);
    for (const x of [-3, 2.2]) { B(L, 0.9, 1.7, 0.6, x, 0.85, 1, 0xd02f2f); B(L, 0.7, 0.5, 0.05, x, 1.35, 1.32, 0x2a2a2e); B(L, 1.4, 0.2, 1.4, x, 0.1, 1, 0x888888); }
    B(L, 5, 3, 3, 4.6, 1.5, -3.6, 0xf1efe8); B(L, 5.4, 0.3, 3.4, 4.6, 3.1, -3.6, 0xd02f2f); B(L, 2.4, 1.6, 0.1, 4.6, 1.3, -2.05, 0x4a6177);
    B(L, 0.3, 6, 0.3, -6.2, 3, -4.5, 0xcfcfcf); B(L, 2.2, 1.6, 0.2, -6.2, 6.2, -4.5, 0xd02f2f); B(L, 1.8, 0.5, 0.22, -6.2, 6.2, -4.5, 0xffffff);
  },
  hotel(L) {
    B(L, 14, 9, 7, 0, 4.5, -1.5, 0xf0e3c8); B(L, 14.4, 0.5, 7.4, 0, 9.2, -1.5, 0x8a5a3c);
    for (let f = 0; f < 3; f++) for (let i = 0; i < 6; i++) B(L, 1.4, 1.3, 0.12, -5.5 + i * 2.2, 1.6 + f * 2.8, 2.06, 0x2a6d8a);
    B(L, 4.4, 3.2, 3, 0, 1.6, 3.6, 0xe8d6b0); B(L, 5, 0.3, 3.6, 0, 3.3, 3.6, 0x8a5a3c); B(L, 2, 2.6, 0.12, 0, 1.3, 5.15, 0x4a3a2a);
    B(L, 0.25, 3, 0.25, -2, 1.5, 5.2, 0xd8c9a0); B(L, 0.25, 3, 0.25, 2, 1.5, 5.2, 0xd8c9a0); B(L, 6, 1.1, 0.2, 0, 10, -1.5, 0x1f1f24); B(L, 5.4, 0.6, 0.22, 0, 10, -1.5, 0xe8c04a);
    tree(L, -6.5, 4, 0.8); tree(L, 6.5, 4, 0.8);
  },
  shops(L) {
    const cs = [0xe4572e, 0x2e86ab, 0xf2b134, 0x7bc86c];
    for (let i = 0; i < 4; i++) { const x = -6 + i * 4; B(L, 3.8, 3.2, 4, x, 1.6, 0, 0xe8dcc0); B(L, 4, 0.25, 4.2, x, 3.3, 0, 0x8a8f96); B(L, 3.2, 0.7, 0.14, x, 2.8, 2.05, cs[i]); B(L, 2.4, 1.7, 0.1, x, 0.95, 2.02, 0x4a6177); B(L, 0.8, 2, 0.1, x + 1.1, 1, 2.04, 0x6b4a2b); B(L, 3.4, 0.14, 1.2, x, 2.3, 2.6, cs[(i + 1) % 4]); }
  },
  borehole(L) {
    quad(L, 8, 8, 0, 0.03, 0, 0xc9bc9a); B(L, 0.3, 3.2, 0.3, -1.4, 1.6, -1.4, 0x6b6f75); B(L, 0.3, 3.2, 0.3, 1.4, 1.6, -1.4, 0x6b6f75); B(L, 0.3, 3.2, 0.3, -1.4, 1.6, 1.4, 0x6b6f75); B(L, 0.3, 3.2, 0.3, 1.4, 1.6, 1.4, 0x6b6f75);
    const t = new THREE.CylinderGeometry(1.6, 1.6, 2.4, 14); t.translate(0, 4.4, 0); L.push(paint(flatten(t), 0x2e6fb5)); B(L, 3.4, 0.25, 3.4, 0, 3.1, 0, 0x6b6f75);
    B(L, 0.25, 3.2, 0.25, 1.9, 1.6, 0, 0x888888); B(L, 0.9, 0.25, 0.25, 2.3, 0.9, 0, 0x888888);
    for (let i = 0; i < 6; i++) { const x = 2.5 + (i % 3) * 0.5 - 1, z = 2.2 + (i >> 1) * 0.55; B(L, 0.34, 0.55, 0.26, x - 3 + (i % 3) * 0.5, 0.28, z - 0.5, [0xf2b134, 0xe4572e, 0x2e86ab][i % 3]); }
  },
  bukka(L) {
    B(L, 4.5, 2.6, 3, 0, 1.3, -2.4, 0xe8dcc0); B(L, 5, 0.25, 3.4, 0, 2.7, -2.4, 0x8a5a3c); B(L, 3.4, 0.8, 0.14, 0, 2.2, -0.88, 0x2e7d4f); B(L, 2.6, 0.5, 0.16, 0, 2.2, -0.86, 0xf4f1ea);
    B(L, 3, 0.9, 0.7, 0, 0.45, -0.9, 0x8a6a42); ball(L, 0.35, -0.8, 1.1, -0.9, 0x555555); ball(L, 0.35, 0.8, 1.1, -0.9, 0xc0392b);
    umbrella(L, -3, 1.5, 0xe4572e); umbrella(L, 3, 1.5, 0x2e86ab); table(L, -3, 1.5); table(L, 3, 1.5);
    for (const [x, z] of [[-3.7, 1.5], [-2.3, 1.5], [-3, 2.3], [3.7, 1.5], [2.3, 1.5], [3, 2.3]]) chair(L, x, z, 0xf2b134);
  },
  pool(L) {
    quad(L, 16, 11, 0, 0.03, 0, 0xd9d3c2); B(L, 10.4, 0.35, 5.6, 0, 0.12, 0, 0xf0f0f0); quad(L, 10, 5.2, 0, 0.32, 0, 0x37a8d8); quad(L, 10, 0.2, 0, 0.34, 0, 0x9ad6ee);
    for (let i = 0; i < 4; i++) { B(L, 0.7, 0.18, 1.8, -5.4 + i * 1.3, 0.2, 4.3, 0xf4f1ea); B(L, 0.7, 0.4, 0.5, -5.4 + i * 1.3, 0.35, 3.6, 0xf4f1ea); }
    umbrella(L, 5.8, 3.8, 0xe4572e); umbrella(L, -5.8, -4, 0x2e86ab); B(L, 3, 2.6, 2.2, 5.4, 1.3, -3.4, 0xf0e3c8); B(L, 3.4, 0.25, 2.6, 5.4, 2.7, -3.4, 0x4a6177);
    tree(L, -7, 0, 0.9); tree(L, 7.2, 4.4, 0.8);
  },
  tennis(L) {
    quad(L, 16, 10, 0, 0.03, 0, 0x2f7a4a); quad(L, 11.6, 6, 0, 0.04, 0, 0x2f8bd0);
    quad(L, 11.6, 0.1, 0, 0.05, 3, 0xffffff); quad(L, 11.6, 0.1, 0, 0.05, -3, 0xffffff); quad(L, 0.1, 6, -5.8, 0.05, 0, 0xffffff); quad(L, 0.1, 6, 5.8, 0.05, 0, 0xffffff); quad(L, 0.1, 6, 0, 0.05, 0, 0xffffff);
    B(L, 0.08, 1, 6.4, 0, 0.5, 0, 0xf4f4f4); B(L, 0.12, 1.1, 0.12, 0, 0.55, -3.2, 0x333333); B(L, 0.12, 1.1, 0.12, 0, 0.55, 3.2, 0x333333);
    for (const z of [-5.1, 5.1]) B(L, 16, 3.2, 0.06, 0, 1.6, z, 0x2f7a4a); B(L, 0.06, 3.2, 10, -8, 1.6, 0, 0x2f7a4a); B(L, 0.06, 3.2, 10, 8, 1.6, 0, 0x2f7a4a);
    bench(L, -4, 5.8);
  },
};

const _cache = {};
export function funGeometry(kind) {                                // merged, centred on (0,0), real colours
  if (_cache[kind]) return _cache[kind];
  const L = []; (MAKERS[kind] || MAKERS.park)(L);
  return (_cache[kind] = done(L));
}
