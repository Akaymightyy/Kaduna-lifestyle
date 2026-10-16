// src/town.js — low-poly pieces used to make every district feel like a real neighbourhood:
// 3 house shapes, compound walls, trees, parked cars, kiosks, and a landmark (mosque / church / school / market).
// All shapes are original and built from plain boxes / cones. Colours are baked as "multipliers" so one
// per-instance colour (the wall colour) tints the whole house: white = wall, grey = darker roof, near-black = windows.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// ---------- tiny helpers ----------
export function hash2(a, b) {                      // deterministic 0..1 from a string + number
  let h = 2166136261 >>> 0;
  const s = a + "#" + b;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
export const paint = (g, v) => {
  const c = v <= 1 ? new THREE.Color(v, v, v) : new THREE.Color(v);
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  return g;
};
export const flatten = (g) => { const q = g.index ? g.toNonIndexed() : g; q.deleteAttribute("uv"); return q; };
export const B = (L, w, h, d, x, y, z, v, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); L.push(paint(flatten(g), v)); };
export const done = (L) => mergeGeometries(L, false);

// ---------- house shapes (all about 5 x 5 m, door on +Z) ----------
function prismRoof(len, width, height, baseY, color) {          // gable roof running along X
  const g = new THREE.CylinderGeometry(1, 1, len, 3);
  g.rotateY(Math.PI / 2); g.rotateZ(Math.PI / 2);
  g.computeBoundingBox();
  const bb = g.boundingBox, sx = 1, sy = height / (bb.max.y - bb.min.y), sz = width / (bb.max.z - bb.min.z);
  g.scale(sx, sy, sz); g.computeBoundingBox();
  g.translate(0, baseY - g.boundingBox.min.y, 0);
  return paint(flatten(g), color);
}
function windows(L, w, d, y, n, face) {                          // dark window slabs on the front / back faces
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * (w / (n + 0.4));
    B(L, 0.8, 0.75, 0.08, x, y, d / 2 + 0.03, 0.12);
    if (face) B(L, 0.8, 0.75, 0.08, x, y, -d / 2 - 0.03, 0.12);
  }
}
export function houseShapes() {
  // A — cottage with hip roof
  const A = []; B(A, 5, 3, 5, 0, 1.5, 0, 1);
  { const r = new THREE.ConeGeometry(3.9, 1.7, 4); r.rotateY(Math.PI / 4); r.translate(0, 3 + 0.85, 0); A.push(paint(flatten(r), 0.55)); }
  B(A, 1, 2, 0.1, 0, 1, 2.55, 0.28); windows(A, 5, 5, 1.7, 2, true); B(A, 5.3, 0.25, 0.9, 0, 2.95, 2.8, 0.7);
  // B — long bungalow with zinc gable roof + porch
  const Bg = []; B(Bg, 5.8, 2.8, 4.4, 0, 1.4, 0, 1);
  Bg.push(prismRoof(6.4, 5.2, 1.9, 2.8, 0.6));
  B(Bg, 1, 2, 0.1, 1.2, 1, 2.25, 0.28); windows(Bg, 3.6, 4.4, 1.6, 2, true); B(Bg, 2.4, 0.18, 1.3, 1.2, 2.3, 2.85, 0.7); B(Bg, 0.18, 2.3, 0.18, 0.1, 1.15, 3.3, 0.7); B(Bg, 0.18, 2.3, 0.18, 2.3, 1.15, 3.3, 0.7);
  // C — two-storey block with flat roof, balcony and water tank
  const C = []; B(C, 5, 5.4, 4.6, 0, 2.7, 0, 1);
  B(C, 5.2, 0.3, 4.8, 0, 5.55, 0, 0.5); B(C, 1, 2, 0.1, -1.4, 1, 2.35, 0.28); windows(C, 4.8, 4.6, 1.8, 2, true); windows(C, 4.8, 4.6, 4.1, 3, true);
  B(C, 3.2, 0.18, 1.1, 0.4, 3.1, 2.9, 0.7); B(C, 3.2, 0.8, 0.08, 0.4, 3.6, 3.4, 0.45);
  B(C, 1.1, 1.2, 1.1, 1.5, 6.2, -1.2, 0.35);
  return [done(A), done(Bg), done(C)];
}

// ---------- compound wall (a ring with a gate gap at the front) ----------
export function wallRing() {
  const L = [], h = 0.95, t = 0.22, s = 7.2;
  B(L, s, h, t, 0, h / 2, -s / 2, 0.92); B(L, t, h, s, -s / 2, h / 2, 0, 0.92); B(L, t, h, s, s / 2, h / 2, 0, 0.92);
  B(L, 2.7, h, t, -2.25, h / 2, s / 2, 0.92); B(L, 2.7, h, t, 2.25, h / 2, s / 2, 0.92);
  B(L, 0.35, 1.5, 0.35, -0.95, 0.75, s / 2, 0.8); B(L, 0.35, 1.5, 0.35, 0.95, 0.75, s / 2, 0.8);
  return done(L);
}

// ---------- tree ----------
export function treeShape() {
  const L = []; B(L, 0.35, 2.2, 0.35, 0, 1.1, 0, 0x6b4a2b);
  const c1 = new THREE.ConeGeometry(1.7, 2.8, 7); c1.translate(0, 3.2, 0); L.push(paint(flatten(c1), 0x2f7d3e));
  const c2 = new THREE.ConeGeometry(1.2, 2.2, 7); c2.translate(0, 4.7, 0); L.push(paint(flatten(c2), 0x3c9449));
  return done(L);
}

// ---------- parked / driving car (length along X) ----------
export function carShape() {
  const L = [];
  B(L, 4.1, 0.75, 1.8, 0, 0.7, 0, 1); B(L, 2.1, 0.65, 1.6, -0.2, 1.4, 0, 0.4);
  B(L, 0.2, 0.45, 1.65, 0.85, 1.4, 0, 0.1); B(L, 0.2, 0.45, 1.65, -1.25, 1.4, 0, 0.1);
  for (const x of [-1.3, 1.3]) for (const z of [-0.85, 0.85]) B(L, 0.7, 0.7, 0.3, x, 0.35, z, 0.04);
  B(L, 0.06, 0.3, 0.5, 2.06, 0.75, 0.6, 0xfff2b0); B(L, 0.06, 0.3, 0.5, 2.06, 0.75, -0.6, 0xfff2b0);
  return done(L);
}
export function busShape() {                                      // yellow danfo-style bus, original box shape
  const L = [];
  B(L, 8, 2.6, 2.4, 0, 1.9, 0, 1); B(L, 8.05, 0.5, 2.45, 0, 1.1, 0, 0.12);
  for (let i = 0; i < 5; i++) { B(L, 1.1, 0.8, 0.06, -3 + i * 1.5, 2.3, 1.22, 0.12); B(L, 1.1, 0.8, 0.06, -3 + i * 1.5, 2.3, -1.22, 0.12); }
  B(L, 0.06, 1, 2.0, 4.0, 2.4, 0, 0.12);
  for (const x of [-2.6, 2.6]) for (const z of [-1.1, 1.1]) B(L, 1, 1, 0.35, x, 0.5, z, 0.04);
  return done(L);
}

// ---------- kiosk / market stall ----------
export function kioskShape() {
  const L = []; B(L, 2.2, 1.0, 1.6, 0, 0.5, 0, 1); B(L, 0.12, 1.9, 0.12, -1.05, 0.95, 0.85, 0.4); B(L, 0.12, 1.9, 0.12, 1.05, 0.95, 0.85, 0.4);
  const r = new THREE.BoxGeometry(2.8, 0.12, 2.0); r.rotateX(0.18); r.translate(0, 1.95, 0.2); L.push(paint(flatten(r), 0.75));
  B(L, 1.8, 0.4, 0.6, 0, 1.15, 0.45, 0.55);
  return done(L);
}

// ---------- people ----------
export function personBody() {
  // FEATURE: improved proportions + shoes + belt for a more human look (was basic boxes = robotic)
  const L = [];
  B(L, 0.42, 0.55, 0.24, 0, 1.28, 0, 1);       // torso (tinted shirt)
  B(L, 0.38, 0.12, 0.22, 0, 0.98, 0, 0.15);    // belt/waist (dark)
  B(L, 0.15, 0.82, 0.17, -0.11, 0.41, 0, 0.22); // left leg (dark trousers)
  B(L, 0.15, 0.82, 0.17, 0.11, 0.41, 0, 0.22);  // right leg (dark trousers)
  B(L, 0.10, 0.50, 0.12, -0.28, 1.25, 0, 0.85); // left arm (skin tone)
  B(L, 0.10, 0.50, 0.12, 0.28, 1.25, 0, 0.85);   // right arm (skin tone)
  B(L, 0.17, 0.08, 0.26, -0.11, 0.04, 0.03, 0.08); // left shoe (dark)
  B(L, 0.17, 0.08, 0.26, 0.11, 0.04, 0.03, 0.08);  // right shoe (dark)
  return done(L);
}
export function personHead() {
  // FEATURE: head + hair cap for a more human look (was a bare sphere = robotic)
  const g = new THREE.SphereGeometry(0.17, 12, 10);
  g.translate(0, 1.72, 0);
  // Hair: half-sphere on top, dark, slightly wider than the head
  const hair = new THREE.SphereGeometry(0.19, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.55);
  hair.translate(0, 1.72, 0);
  hair.scale(1, 0.7, 1);
  return done([paint(flatten(g), 1), paint(flatten(hair), 0.10)]); // head=skin(1), hair=dark(0.10)
}

// ---------- landmark per district (merged, true colours) ----------
export function landmark(kind) {
  const L = [];
  const dome = (x, y, z, r, c) => { const g = new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); g.translate(x, y, z); L.push(paint(flatten(g), c)); };
  if (kind === "mosque") {
    B(L, 12, 5, 10, 0, 2.5, 0, 0xf2eee0); B(L, 12.4, 0.4, 10.4, 0, 5.2, 0, 0xcfc8b4);
    dome(0, 5.4, 0, 3.6, 0x1f8f5f); dome(-4, 5.4, -3.5, 1.5, 0x1f8f5f); dome(4, 5.4, -3.5, 1.5, 0x1f8f5f);
    for (const x of [-6.8, 6.8]) { B(L, 1.3, 11, 1.3, x, 5.5, 4.5, 0xf2eee0); B(L, 1.7, 0.4, 1.7, x, 8.8, 4.5, 0xcfc8b4); dome(x, 11, 4.5, 0.9, 0x1f8f5f); B(L, 0.12, 1.2, 0.12, x, 12.5, 4.5, 0xe8c04a); }
    B(L, 3, 3.2, 0.2, 0, 1.6, 5.1, 0x6b4a2b);
    for (const x of [-4, 4]) B(L, 1.4, 1.6, 0.15, x, 2.8, 5.1, 0x2a6d8a);
  } else if (kind === "church") {
    B(L, 10, 6, 14, 0, 3, 0, 0xf4f0e6); L.push(paint(flatten(roofAlongZ(14.6, 10.4, 3.4, 6)), 0x8a4a3a));
    B(L, 3, 11, 3, 0, 5.5, 8, 0xf4f0e6); const sp = new THREE.ConeGeometry(2.2, 4.5, 4); sp.rotateY(Math.PI / 4); sp.translate(0, 13.2, 8); L.push(paint(flatten(sp), 0x8a4a3a));
    B(L, 0.25, 2, 0.25, 0, 16.4, 8, 0xe8c04a); B(L, 1.2, 0.25, 0.25, 0, 16.7, 8, 0xe8c04a); B(L, 2.2, 3, 0.2, 0, 1.5, 9.6, 0x6b4a2b);
  } else if (kind === "school") {
    B(L, 20, 4, 7, 0, 2, 0, 0xf2d98a); B(L, 20.6, 0.4, 7.6, 0, 4.2, 0, 0xc0392b);
    for (let i = 0; i < 6; i++) B(L, 1.4, 1.2, 0.1, -8 + i * 3.2, 2.4, 3.55, 0x2a6d8a);
    B(L, 2.2, 2.8, 0.2, 0, 1.4, 3.6, 0x6b4a2b); B(L, 0.18, 9, 0.18, 12, 4.5, 4, 0xdddddd); B(L, 1.6, 1, 0.05, 12.9, 8.4, 4, 0x1f8f5f); B(L, 1.6, 0.5, 0.05, 12.9, 8.4, 4.02, 0xffffff);
  } else {                                                        // market row
    for (let i = 0; i < 6; i++) {
      const c = [0xe4572e, 0xf2b134, 0x2e86ab, 0x7bc86c, 0xb565a7, 0xff8c42][i];
      B(L, 2.6, 1, 1.8, -7 + i * 2.8, 0.5, 0, 0xd8c7a0); const r = new THREE.BoxGeometry(3.0, 0.12, 2.4); r.rotateX(0.18); r.translate(-7 + i * 2.8, 2.1, 0.3); L.push(paint(flatten(r), c));
      B(L, 0.12, 2, 0.12, -8.2 + i * 2.8, 1, 1.1, 0x8a6a42); B(L, 0.12, 2, 0.12, -5.8 + i * 2.8, 1, 1.1, 0x8a6a42);
    }
  }
  return done(L);
}
function roofAlongZ(len, width, height, baseY) {                 // gable roof running along Z
  const g = new THREE.CylinderGeometry(1, 1, len, 3);
  g.rotateY(Math.PI / 2); g.rotateZ(Math.PI / 2); g.rotateY(Math.PI / 2);
  g.computeBoundingBox(); const bb = g.boundingBox;
  g.scale(width / (bb.max.x - bb.min.x), height / (bb.max.y - bb.min.y), 1); g.computeBoundingBox();
  g.translate(0, baseY - g.boundingBox.min.y, 0);
  return g;
}
export const LANDMARK_KINDS = ["mosque", "church", "school", "market"];
export function landmarkKind(area) {                              // stable per district; cheap areas get markets, GRA gets churches / schools
  const h = hash2(area.id, "lm");
  if (area.tier === "cheap") return h < 0.45 ? "market" : h < 0.8 ? "mosque" : "school";
  if (area.tier === "middle") return h < 0.4 ? "mosque" : h < 0.7 ? "church" : "school";
  return h < 0.5 ? "church" : h < 0.8 ? "mosque" : "school";
}

// which plots in a district are "vacant" (FOR RENT / FOR SALE) and which are lived-in by NPC neighbours
export function isVacantPlot(areaId, plotNo) { return hash2(areaId, plotNo + "v") < 0.35; }
export function plotArchetype(areaId, plotNo) { return Math.floor(hash2(areaId, plotNo + "a") * 3) % 3; }
