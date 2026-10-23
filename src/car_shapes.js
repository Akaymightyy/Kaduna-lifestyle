// src/car_shapes.js — Low-poly 3D car bodies using a loft approach.
//
// Inspired by mrdoob/slop-newyork (MIT, © 2026 Mr.doob) — the idea: define
// cross-sections along the car length (front bumper, hood, windshield base,
// roof, rear window, trunk, rear bumper), loft (skin) between them to create
// one smooth body, then add windshield, bumpers, mirrors, lights, wheels.
//
// This is our OWN WebGL implementation using plain THREE.BufferGeometry +
// vertex colours. No TSL/WebGPU. © 2026 Mr.doob — loft idea adapted from
// slop-newyork/js/actor-models.js (MIT).
//
// FIX v2 (Oct 23): rewrote cross-sections — 16 points per section (was 8),
// 8 sections (was 6), curved silhouettes (not just rounded rectangles).
// Cars now look much more like real cars, not boxes.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// ---- Vertex colour constants ----
const C_BODY = 1.0;
const C_GLASS = 0.18;
const C_CHROME = 0.55;
const C_HEAD = [1.0, 0.95, 0.69];
const C_TAIL = [1.0, 0.16, 0.16];
const C_TYRE = 0.05;
const C_DARK = 0.12;

function safeMerge(parts) {
  const same = parts.map((g) => {
    const q = g.index ? g.toNonIndexed() : g;
    if (q.attributes.uv) q.deleteAttribute("uv");
    if (q.attributes.uv1) q.deleteAttribute("uv1");
    if (!q.attributes.normal) q.computeVertexNormals();
    return q;
  });
  const merged = mergeGeometries(same, true);
  if (!merged) throw new Error("car_shapes: merge failed");
  return merged;
}

function vcol(geo, r, g, b) {
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i*3] = r; col[i*3+1] = g; col[i*3+2] = b; }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geo;
}
function box(w, h, d, x, y, z, c) { return vcol(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c, c, c); }
function boxRGB(w, h, d, x, y, z, r, g, b) { return vcol(new THREE.BoxGeometry(w, h, d).translate(x, y, z), r, g, b); }

// ---- 16-point cross-section: proper car silhouette ----
// Points go clockwise: bottom-left → left-bottom → left → left-top → top-left
// → top → top-right → right-top → right → right-bottom → bottom-right → bottom
// → bottom-left-curve → left-bottom-curve → right-bottom-curve → bottom-mid
//
// The cross-section is shaped like a real car: flat bottom, flared sides
// (tumblehome), rounded roof, slightly tapered bottom.
function cs16(hw, ht, yC) {
  // hw = half-width at widest point, ht = total height, yC = center height
  const tb = hw * 0.82;   // bottom half-width (tucked in — tumblehome)
  const tt = hw * 0.75;   // top half-width (narrower — roof slope)
  const yB = yC - ht / 2;  // bottom y
  const yT = yC + ht / 2;  // top y
  const yS = yC + ht * 0.15; // shoulder line y (where sides start curving in)
  return [
    [-tb * 0.7, yB],              // 0: bottom-left curve
    [-tb, yB + ht * 0.1],         // 1: left-bottom
    [-tb, yC - ht * 0.05],        // 2: left-mid (widest point)
    [-hw, yS],                     // 3: left-shoulder (flare out)
    [-hw * 0.95, yS + ht * 0.1],  // 4: left-upper-shoulder
    [-tt, yT - ht * 0.08],        // 5: left-top (narrowing)
    [-tt * 0.6, yT],              // 6: top-left
    [0, yT + ht * 0.02],          // 7: top-center (slight crown)
    [tt * 0.6, yT],               // 8: top-right
    [tt, yT - ht * 0.08],         // 9: right-top
    [hw * 0.95, yS + ht * 0.1],  // 10: right-upper-shoulder
    [hw, yS],                     // 11: right-shoulder
    [tb, yC - ht * 0.05],        // 12: right-mid
    [tb, yB + ht * 0.1],         // 13: right-bottom
    [tb * 0.7, yB],              // 14: bottom-right curve
    [0, yB - ht * 0.02],         // 15: bottom-center (slight underbody curve)
  ];
}

// ---- Loft: build body from 16-point cross-sections ----
function loftBody(sections) {
  const positions = [];
  const colors = [];
  const indices = [];
  for (const s of sections) {
    for (const [w, h] of s.pts) {
      positions.push(s.x, h, w);
      colors.push(C_BODY, C_BODY, C_BODY);
    }
  }
  const npts = sections[0].pts.length;
  for (let s = 0; s < sections.length - 1; s++) {
    for (let p = 0; p < npts; p++) {
      const p2 = (p + 1) % npts;
      const a = s * npts + p, b = s * npts + p2;
      const c = (s + 1) * npts + p2, d = (s + 1) * npts + p;
      indices.push(a, b, c, a, c, d);
    }
  }
  // Cap front
  for (let p = 1; p < npts - 1; p++) indices.push(0, p, p + 1);
  // Cap rear
  const ls = (sections.length - 1) * npts;
  for (let p = 1; p < npts - 1; p++) indices.push(ls, ls + p + 1, ls + p);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function wheelGeo(r, x, z) {
  const g = new THREE.CylinderGeometry(r, r, 0.22, 12);
  g.rotateZ(Math.PI / 2);
  g.translate(x, r, z);
  return vcol(g, C_TYRE, C_TYRE, C_TYRE);
}
function lightGeo(L, W, y, isHead) {
  const r = isHead ? C_HEAD[0] : C_TAIL[0], g2 = isHead ? C_HEAD[1] : C_TAIL[1], b = isHead ? C_HEAD[2] : C_TAIL[2];
  const xOff = isHead ? L/2 + 0.02 : -L/2 - 0.02;
  return [boxRGB(0.08, 0.16, 0.3, xOff, y, W*0.34, r, g2, b), boxRGB(0.08, 0.16, 0.3, xOff, y, -W*0.34, r, g2, b)];
}

// ===== CAR BUILDERS (v2 — 8 sections × 16 points = 256 verts body) =====

export function buildSedan() {
  const L = 4.4, W = 1.8;
  const body = loftBody([
    { x: -L/2,     pts: cs16(W*0.82, 0.65, 0.38) },  // rear bumper (narrow, low)
    { x: -L*0.38,  pts: cs16(W*0.92, 0.95, 0.55) },  // trunk (full, mid)
    { x: -L*0.20,  pts: cs16(W*0.88, 1.35, 0.72) },  // rear roof (tall)
    { x: -L*0.05,  pts: cs16(W*0.87, 1.42, 0.76) },  // peak roof
    { x:  L*0.10,  pts: cs16(W*0.87, 1.38, 0.74) },  // front roof
    { x:  L*0.25,  pts: cs16(W*0.90, 1.1, 0.62) },    // windshield base (transition)
    { x:  L*0.38,  pts: cs16(W*0.93, 0.95, 0.55) },  // hood (full, mid)
    { x:  L/2,     pts: cs16(W*0.82, 0.65, 0.38) },  // front bumper (narrow, low)
  ]);
  return safeMerge([
    body,
    boxRGB(0.06, 0.45, W*0.82, L*0.23, 1.02, 0, C_GLASS, C_GLASS, C_GLASS),  // windshield
    boxRGB(0.06, 0.45, W*0.82, -L*0.23, 1.02, 0, C_GLASS, C_GLASS, C_GLASS),  // rear window
    box(0.1, 0.22, W*0.93, L/2 - 0.05, 0.48, 0, C_CHROME),  // front bumper
    box(0.1, 0.22, W*0.93, -L/2 + 0.05, 0.48, 0, C_CHROME),  // rear bumper
    box(0.08, 0.06, 0.08, L*0.25, 1.02, W*0.5, C_CHROME),  // mirror R
    box(0.08, 0.06, 0.08, L*0.25, 1.02, -W*0.5, C_CHROME),  // mirror L
    box(0.03, 0.12, W*0.55, L/2 - 0.02, 0.52, 0, C_DARK),  // grille
    wheelGeo(0.33, -L*0.32, W/2), wheelGeo(0.33, -L*0.32, -W/2),
    wheelGeo(0.33, L*0.32, W/2), wheelGeo(0.33, L*0.32, -W/2),
    ...lightGeo(L, W, 0.43, true), ...lightGeo(L, W, 0.43, false),
  ]);
}

export function buildHatchback() {
  const L = 3.7, W = 1.7;
  const body = loftBody([
    { x: -L/2,     pts: cs16(W*0.82, 0.60, 0.35) },
    { x: -L*0.32,  pts: cs16(W*0.92, 1.25, 0.66) },  // tall rear (hatch)
    { x: -L*0.12,  pts: cs16(W*0.87, 1.32, 0.72) },
    { x:  L*0.05,  pts: cs16(W*0.87, 1.28, 0.70) },
    { x:  L*0.20,  pts: cs16(W*0.90, 1.0, 0.56) },   // windshield base
    { x:  L*0.35,  pts: cs16(W*0.92, 0.85, 0.50) },  // hood
    { x:  L/2,     pts: cs16(W*0.82, 0.60, 0.35) },
    { x:  L*0.42,  pts: cs16(W*0.85, 0.7, 0.42) },   // extra section for smoother front
  ]);
  return safeMerge([
    body,
    boxRGB(0.06, 0.38, W*0.80, L*0.18, 0.95, 0, C_GLASS, C_GLASS, C_GLASS),
    boxRGB(0.06, 0.38, W*0.80, -L*0.18, 0.95, 0, C_GLASS, C_GLASS, C_GLASS),
    box(0.1, 0.2, W*0.90, L/2 - 0.05, 0.45, 0, C_CHROME),
    box(0.1, 0.2, W*0.90, -L/2 + 0.05, 0.45, 0, C_CHROME),
    box(0.08, 0.06, 0.08, L*0.20, 0.95, W*0.5, C_CHROME),
    box(0.08, 0.06, 0.08, L*0.20, 0.95, -W*0.5, C_CHROME),
    wheelGeo(0.31, -L*0.32, W/2), wheelGeo(0.31, -L*0.32, -W/2),
    wheelGeo(0.31, L*0.32, W/2), wheelGeo(0.31, L*0.32, -W/2),
    ...lightGeo(L, W, 0.40, true), ...lightGeo(L, W, 0.40, false),
  ]);
}

export function buildSUV() {
  const L = 4.7, W = 1.95;
  const body = loftBody([
    { x: -L/2,     pts: cs16(W*0.82, 0.85, 0.48) },
    { x: -L*0.38,  pts: cs16(W*0.92, 1.55, 0.82) },
    { x: -L*0.18,  pts: cs16(W*0.88, 1.85, 0.98) },
    { x:  L*0.0,   pts: cs16(W*0.87, 1.88, 1.0) },   // peak roof (tall, like real SUV)
    { x:  L*0.15,  pts: cs16(W*0.87, 1.80, 0.96) },
    { x:  L*0.28,  pts: cs16(W*0.90, 1.35, 0.72) },  // windshield base
    { x:  L*0.38,  pts: cs16(W*0.93, 1.1, 0.60) },   // hood
    { x:  L/2,     pts: cs16(W*0.82, 0.85, 0.48) },
  ]);
  return safeMerge([
    body,
    boxRGB(0.06, 0.55, W*0.83, L*0.24, 1.32, 0, C_GLASS, C_GLASS, C_GLASS),  // windshield
    boxRGB(0.06, 0.55, W*0.83, -L*0.24, 1.32, 0, C_GLASS, C_GLASS, C_GLASS),  // rear window
    box(0.12, 0.28, W*0.95, L/2 - 0.07, 0.58, 0, C_CHROME),  // front bumper
    box(0.12, 0.28, W*0.95, -L/2 + 0.07, 0.58, 0, C_CHROME),  // rear bumper
    box(0.1, 0.08, 0.1, L*0.28, 1.28, W*0.5, C_CHROME),  // mirror R
    box(0.1, 0.08, 0.1, L*0.28, 1.28, -W*0.5, C_CHROME),  // mirror L
    box(0.03, 0.18, W*0.58, L/2 - 0.02, 0.62, 0, C_DARK),  // grille
    wheelGeo(0.4, -L*0.32, W/2), wheelGeo(0.4, -L*0.32, -W/2),
    wheelGeo(0.4, L*0.32, W/2), wheelGeo(0.4, L*0.32, -W/2),
    ...lightGeo(L, W, 0.52, true), ...lightGeo(L, W, 0.52, false),
  ]);
}

export function buildTaxi() {
  const L = 4.4, W = 1.8;
  const body = loftBody([
    { x: -L/2,     pts: cs16(W*0.82, 0.65, 0.38) },
    { x: -L*0.38,  pts: cs16(W*0.92, 0.95, 0.55) },
    { x: -L*0.20,  pts: cs16(W*0.88, 1.35, 0.72) },
    { x: -L*0.05,  pts: cs16(W*0.87, 1.42, 0.76) },
    { x:  L*0.10,  pts: cs16(W*0.87, 1.38, 0.74) },
    { x:  L*0.25,  pts: cs16(W*0.90, 1.1, 0.62) },
    { x:  L*0.38,  pts: cs16(W*0.93, 0.95, 0.55) },
    { x:  L/2,     pts: cs16(W*0.82, 0.65, 0.38) },
  ]);
  return safeMerge([
    body,
    boxRGB(0.06, 0.45, W*0.82, L*0.23, 1.02, 0, C_GLASS, C_GLASS, C_GLASS),
    boxRGB(0.06, 0.45, W*0.82, -L*0.23, 1.02, 0, C_GLASS, C_GLASS, C_GLASS),
    box(0.1, 0.22, W*0.93, L/2 - 0.05, 0.48, 0, C_CHROME),
    box(0.1, 0.22, W*0.93, -L/2 + 0.05, 0.48, 0, C_CHROME),
    box(0.08, 0.06, 0.08, L*0.25, 1.02, W*0.5, C_CHROME),
    box(0.08, 0.06, 0.08, L*0.25, 1.02, -W*0.5, C_CHROME),
    // Taxi roof sign
    boxRGB(0.45, 0.1, 0.25, 0, 1.50, 0, C_DARK, C_DARK, C_DARK),
    wheelGeo(0.33, -L*0.32, W/2), wheelGeo(0.33, -L*0.32, -W/2),
    wheelGeo(0.33, L*0.32, W/2), wheelGeo(0.33, L*0.32, -W/2),
    ...lightGeo(L, W, 0.43, true), ...lightGeo(L, W, 0.43, false),
  ]);
}

export function buildPickup() {
  const L = 5.0, W = 1.9;
  const body = loftBody([
    { x: -L/2,     pts: cs16(W*0.82, 0.75, 0.42) },
    { x: -L*0.38,  pts: cs16(W*0.92, 0.85, 0.48) },  // flat bed
    { x: -L*0.20,  pts: cs16(W*0.88, 0.85, 0.48) },  // bed continues flat
    { x: -L*0.10,  pts: cs16(W*0.87, 1.25, 0.68) },  // cabin rear (jumps up)
    { x:  L*0.05,  pts: cs16(W*0.87, 1.28, 0.70) },  // cabin front
    { x:  L*0.22,  pts: cs16(W*0.90, 0.95, 0.55) },  // windshield base
    { x:  L*0.38,  pts: cs16(W*0.93, 0.85, 0.50) },  // hood
    { x:  L/2,     pts: cs16(W*0.82, 0.75, 0.42) },
  ]);
  return safeMerge([
    body,
    boxRGB(0.06, 0.42, W*0.80, L*0.0, 0.98, 0, C_GLASS, C_GLASS, C_GLASS),  // cabin glass
    boxRGB(0.06, 0.35, W*0.80, -L*0.15, 0.98, 0, C_GLASS, C_GLASS, C_GLASS),  // rear cabin glass
    // Bed walls
    box(L*0.28, 0.35, 0.08, -L*0.20, 0.65, W*0.47, C_DARK),
    box(L*0.28, 0.35, 0.08, -L*0.20, 0.65, -W*0.47, C_DARK),
    box(0.08, 0.35, W*0.93, -L*0.34, 0.65, 0, C_DARK),
    box(0.1, 0.22, W*0.93, L/2 - 0.05, 0.48, 0, C_CHROME),
    box(0.1, 0.22, W*0.93, -L/2 + 0.05, 0.48, 0, C_CHROME),
    box(0.08, 0.06, 0.08, L*0.15, 0.98, W*0.5, C_CHROME),
    box(0.08, 0.06, 0.08, L*0.15, 0.98, -W*0.5, C_CHROME),
    wheelGeo(0.38, -L*0.32, W/2), wheelGeo(0.38, -L*0.32, -W/2),
    wheelGeo(0.38, L*0.32, W/2), wheelGeo(0.38, L*0.32, -W/2),
    ...lightGeo(L, W, 0.45, true), ...lightGeo(L, W, 0.45, false),
  ]);
}

export function buildDanfoBus() {
  const L = 8.0, W = 2.4;
  const body = loftBody([
    { x: -L/2,     pts: cs16(W*0.82, 2.3, 1.25) },
    { x: -L*0.38,  pts: cs16(W*0.92, 2.5, 1.35) },
    { x: -L*0.15,  pts: cs16(W*0.92, 2.5, 1.35) },
    { x:  L*0.05,  pts: cs16(W*0.92, 2.5, 1.35) },
    { x:  L*0.22,  pts: cs16(W*0.90, 2.3, 1.25) },  // sloped front
    { x:  L*0.38,  pts: cs16(W*0.85, 1.8, 1.0) },   // windshield area
    { x:  L*0.46,  pts: cs16(W*0.82, 1.5, 0.85) },  // front taper
    { x:  L/2,     pts: cs16(W*0.78, 1.2, 0.70) },  // nose (narrow, low)
  ]);
  return safeMerge([
    body,
    // Green stripe
    box(L*0.88, 0.25, 0.04, 0, 0.95, W*0.48, 0.06),
    box(L*0.88, 0.25, 0.04, 0, 0.95, -W*0.48, 0.06),
    // Windshield
    boxRGB(0.06, 1.1, W*0.78, L*0.42, 1.75, 0, C_GLASS, C_GLASS, C_GLASS),
    // Side windows (5)
    ...Array.from({length: 5}, (_, i) => boxRGB(0.05, 0.65, W*0.82, -L*0.35 + i * L*0.16, 1.75, 0, C_GLASS, C_GLASS, C_GLASS)),
    // Headlights
    boxRGB(0.1, 0.28, 0.35, L/2 + 0.02, 0.75, W*0.28, C_HEAD[0], C_HEAD[1], C_HEAD[2]),
    boxRGB(0.1, 0.28, 0.35, L/2 + 0.02, 0.75, -W*0.28, C_HEAD[0], C_HEAD[1], C_HEAD[2]),
    // Taillights
    boxRGB(0.1, 0.28, 0.35, -L/2 - 0.02, 0.75, W*0.28, C_TAIL[0], C_TAIL[1], C_TAIL[2]),
    boxRGB(0.1, 0.28, 0.35, -L/2 - 0.02, 0.75, -W*0.28, C_TAIL[0], C_TAIL[1], C_TAIL[2]),
    // Wheels (6)
    wheelGeo(0.45, -L*0.35, W/2), wheelGeo(0.45, -L*0.35, -W/2),
    wheelGeo(0.45, 0, W/2), wheelGeo(0.45, 0, -W/2),
    wheelGeo(0.45, L*0.35, W/2), wheelGeo(0.45, L*0.35, -W/2),
  ]);
}

// ---- Convenience ----
const _cache = {};
export function getCarShape(type) {
  if (_cache[type]) return _cache[type];
  let geo;
  switch (type) {
    case "sedan": geo = buildSedan(); break;
    case "hatch": case "hatchback": geo = buildHatchback(); break;
    case "suv": case "jeep": geo = buildSUV(); break;
    case "taxi": geo = buildTaxi(); break;
    case "pickup": geo = buildPickup(); break;
    case "bus": case "danfo": geo = buildDanfoBus(); break;
    default: geo = buildSedan();
  }
  _cache[type] = geo;
  return geo;
}
export function carShapeNew() { return getCarShape("sedan"); }
export function busShapeNew() { return getCarShape("bus"); }
export const CAR_TYPES = ["sedan", "hatch", "suv", "taxi", "pickup"];
export const CAR_WEIGHTS = [4, 3, 3, 2, 1];
