// src/car_shapes.js — Low-poly 3D car bodies using a simple loft approach.
//
// Inspired by mrdoob/slop-newyork (MIT, © 2026 Mr.doob) — the idea: define
// cross-sections along the car length (front bumper, hood, windshield base,
// roof, rear window, trunk, rear bumper), loft (skin) between them to create
// one smooth body, then add windshield, bumpers, mirrors, lights, wheels.
//
// This is our OWN WebGL implementation using plain THREE.BufferGeometry +
// vertex colours (same style as carShape() in src/town.js). No TSL/WebGPU.
//
// Each car is max 3,000-5,000 triangles. Body paint comes from instance
// colour (vertex colour = white); glass, tyres, chrome, lights use fixed
// vertex colours (dark/silver/yellow/red) that get subtly tinted but still
// read correctly.
//
// © 2026 Mr.doob — loft idea adapted from slop-newyork/js/actor-models.js (MIT).
// Implementation written from scratch for WebGL/Kaduna Lifestyle.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// ---- Vertex colour constants ----
const C_BODY = 1.0;       // white — tinted by instance colour (body paint)
const C_GLASS = 0.18;     // dark — tinted (reads as tinted glass)
const C_CHROME = 0.55;    // silver — tinted (reads as metallic trim)
const C_HEAD = [1.0, 0.95, 0.69]; // warm yellow (headlights)
const C_TAIL = [1.0, 0.16, 0.16]; // red (taillights)
const C_TYRE = 0.05;      // near-black (tyres)
const C_DARK = 0.12;      // dark plastic (grille, trim)


// ---- Safe merge ----
// mergeGeometries() returns NULL (it does not throw) if the parts do not have exactly the same attributes. The hand-built loft
// has no "uv" but boxes and cylinders do, so every car merge silently failed, the cars became meshes with NO geometry, and the
// renderer then crashed every frame ("Cannot read properties of null (reading 'id')"). Same rule as town.js flatten():
// every part is made non-indexed and loses its uv, so all parts always match.
function safeMerge(parts, useGroups) {
  const same = parts.map((g) => {
    const q = g.index ? g.toNonIndexed() : g;
    if (q.attributes.uv) q.deleteAttribute("uv");
    if (q.attributes.uv1) q.deleteAttribute("uv1");
    if (!q.attributes.normal) q.computeVertexNormals();
    return q;
  });
  const merged = mergeGeometries(same, useGroups);
  if (!merged) throw new Error("car_shapes: could not merge car parts");   // fail loudly here, not later inside the renderer
  return merged;
}

// ---- Helper: create a box geometry with vertex colours ----
function vcol(geo, r, g, b) {
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i*3] = r; col[i*3+1] = g; col[i*3+2] = b; }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geo;
}
function box(w, h, d, x, y, z, c) {
  return vcol(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c, c, c);
}
function boxRGB(w, h, d, x, y, z, r, g, b) {
  return vcol(new THREE.BoxGeometry(w, h, d).translate(x, y, z), r, g, b);
}

// ---- Simple loft: build a body from cross-sections ----
// Each cross-section is { x, pts: [[w,h], ...] } where w = half-width, h = y-centre.
// pts defines the outline at that x position (going clockwise: bottom-left, left, top-left, top, top-right, right, bottom-right, bottom).
// We use 8 points per cross-section for a rounded look.
//
// The loft connects adjacent cross-sections with triangle strips.
function loftBody(sections) {
  const positions = [];
  const colors = [];
  const indices = [];

  // Build vertex list
  for (const s of sections) {
    for (const [w, h] of s.pts) {
      // Each point is [halfWidthOffset, y]
      positions.push(s.x, h, w);
      colors.push(C_BODY, C_BODY, C_BODY); // body paint — tinted by instance colour
    }
  }

  const npts = sections[0].pts.length; // vertices per cross-section
  // Connect adjacent cross-sections with quads (2 triangles)
  for (let s = 0; s < sections.length - 1; s++) {
    for (let p = 0; p < npts; p++) {
      const p2 = (p + 1) % npts;
      const a = s * npts + p;
      const b = s * npts + p2;
      const c = (s + 1) * npts + p2;
      const d = (s + 1) * npts + p;
      indices.push(a, b, c, a, c, d);
    }
  }

  // Cap front and rear (fan from first/last vertex)
  // Front cap (section 0)
  for (let p = 1; p < npts - 1; p++) {
    indices.push(0, p, p + 1);
  }
  // Rear cap (last section)
  const lastStart = (sections.length - 1) * npts;
  for (let p = 1; p < npts - 1; p++) {
    indices.push(lastStart, lastStart + p + 1, lastStart + p);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ---- Cross-section generator: 8-point rounded rectangle ----
function cs(width, height, yCenter) {
  const hw = width / 2;
  return [
    [-hw * 0.7, yCenter - height / 2],  // bottom-left
    [-hw, yCenter - height * 0.2],       // left-bottom
    [-hw, yCenter + height * 0.2],       // left-top
    [-hw * 0.7, yCenter + height / 2],  // top-left
    [hw * 0.7, yCenter + height / 2],   // top-right
    [hw, yCenter + height * 0.2],        // right-top
    [hw, yCenter - height * 0.2],        // right-bottom
    [hw * 0.7, yCenter - height / 2],   // bottom-right
  ];
}

// ---- Wheel helper ----
function wheelGeo(r, x, z) {
  // Cylinder for tyre (dark) — laid flat (rotated)
  const g = new THREE.CylinderGeometry(r, r, 0.22, 10);
  g.rotateZ(Math.PI / 2);
  g.translate(x, r, z);
  return vcol(g, C_TYRE, C_TYRE, C_TYRE);
}

// ---- Light helper (headlight or taillight) ----
function lightGeo(L, W, y, isHead) {
  const r = isHead ? C_HEAD[0] : C_TAIL[0];
  const g = isHead ? C_HEAD[1] : C_TAIL[1];
  const b = isHead ? C_HEAD[2] : C_TAIL[2];
  const xOff = isHead ? L / 2 + 0.02 : -L / 2 - 0.02;
  return [
    boxRGB(0.08, 0.16, 0.3, xOff, y, W * 0.34, r, g, b),
    boxRGB(0.08, 0.16, 0.3, xOff, y, -W * 0.34, r, g, b),
  ];
}

// ===== CAR TYPE BUILDERS =====
// Each returns a merged BufferGeometry with vertex colours.

export function buildSedan() {
  const L = 4.4, W = 1.8;
  const body = loftBody([
    { x: -L/2,       pts: cs(W*0.85, 0.7, 0.42) },  // rear bumper (narrow, low)
    { x: -L*0.35,    pts: cs(W*0.95, 1.0, 0.58) },  // trunk (full width, mid)
    { x: -L*0.15,    pts: cs(W*0.90, 1.4, 0.75) },  // rear roof (full, tall)
    { x:  L*0.15,    pts: cs(W*0.90, 1.4, 0.75) },  // front roof (full, tall)
    { x:  L*0.35,    pts: cs(W*0.95, 1.0, 0.58) },  // hood (full, mid)
    { x:  L/2,       pts: cs(W*0.85, 0.7, 0.42) },  // front bumper (narrow, low)
  ]);
  const parts = [
    body,
    // Windshield (glass)
    boxRGB(0.08, 0.5, W*0.85, L*0.22, 1.05, 0, C_GLASS, C_GLASS, C_GLASS),
    // Rear window (glass)
    boxRGB(0.08, 0.5, W*0.85, -L*0.22, 1.05, 0, C_GLASS, C_GLASS, C_GLASS),
    // Front bumper (chrome)
    box(0.12, 0.25, W*0.95, L/2 - 0.06, 0.5, 0, C_CHROME),
    // Rear bumper (chrome)
    box(0.12, 0.25, W*0.95, -L/2 + 0.06, 0.5, 0, C_CHROME),
    // Side mirrors (chrome)
    box(0.1, 0.08, 0.08, L*0.25, 1.05, W*0.5, C_CHROME),
    box(0.1, 0.08, 0.08, L*0.25, 1.05, -W*0.5, C_CHROME),
    // Grille (dark)
    box(0.04, 0.15, W*0.6, L/2 - 0.02, 0.55, 0, C_DARK),
    // Wheels
    wheelGeo(0.33, -L*0.32, W/2), wheelGeo(0.33, -L*0.32, -W/2),
    wheelGeo(0.33, L*0.32, W/2), wheelGeo(0.33, L*0.32, -W/2),
    // Lights
    ...lightGeo(L, W, 0.45, true),   // headlights
    ...lightGeo(L, W, 0.45, false),  // taillights
  ];
  return safeMerge(parts, true);
}

export function buildHatchback() {
  const L = 3.7, W = 1.7;
  const body = loftBody([
    { x: -L/2,       pts: cs(W*0.85, 0.65, 0.40) },
    { x: -L*0.30,    pts: cs(W*0.95, 1.3, 0.70) },  // tall rear (hatchback shape)
    { x: -L*0.10,    pts: cs(W*0.90, 1.35, 0.75) },
    { x:  L*0.15,    pts: cs(W*0.90, 1.25, 0.70) },
    { x:  L*0.35,    pts: cs(W*0.95, 0.9, 0.55) },
    { x:  L/2,       pts: cs(W*0.85, 0.65, 0.40) },
  ]);
  const parts = [
    body,
    boxRGB(0.08, 0.4, W*0.82, L*0.20, 0.98, 0, C_GLASS, C_GLASS, C_GLASS),
    boxRGB(0.08, 0.4, W*0.82, -L*0.20, 0.98, 0, C_GLASS, C_GLASS, C_GLASS),
    box(0.12, 0.22, W*0.92, L/2 - 0.06, 0.48, 0, C_CHROME),
    box(0.12, 0.22, W*0.92, -L/2 + 0.06, 0.48, 0, C_CHROME),
    box(0.1, 0.08, 0.08, L*0.22, 0.98, W*0.5, C_CHROME),
    box(0.1, 0.08, 0.08, L*0.22, 0.98, -W*0.5, C_CHROME),
    wheelGeo(0.31, -L*0.32, W/2), wheelGeo(0.31, -L*0.32, -W/2),
    wheelGeo(0.31, L*0.32, W/2), wheelGeo(0.31, L*0.32, -W/2),
    ...lightGeo(L, W, 0.42, true),
    ...lightGeo(L, W, 0.42, false),
  ];
  return safeMerge(parts, true);
}

export function buildSUV() {
  const L = 4.7, W = 1.95;
  const body = loftBody([
    { x: -L/2,       pts: cs(W*0.85, 0.9, 0.50) },
    { x: -L*0.35,    pts: cs(W*0.95, 1.6, 0.85) },
    { x: -L*0.15,    pts: cs(W*0.90, 1.9, 1.0) },
    { x:  L*0.15,    pts: cs(W*0.90, 1.9, 1.0) },
    { x:  L*0.35,    pts: cs(W*0.95, 1.4, 0.75) },
    { x:  L/2,       pts: cs(W*0.85, 0.9, 0.50) },
  ]);
  const parts = [
    body,
    boxRGB(0.08, 0.6, W*0.85, L*0.22, 1.35, 0, C_GLASS, C_GLASS, C_GLASS),
    boxRGB(0.08, 0.6, W*0.85, -L*0.22, 1.35, 0, C_GLASS, C_GLASS, C_GLASS),
    box(0.15, 0.3, W*0.97, L/2 - 0.08, 0.6, 0, C_CHROME),
    box(0.15, 0.3, W*0.97, -L/2 + 0.08, 0.6, 0, C_CHROME),
    box(0.12, 0.1, 0.1, L*0.28, 1.3, W*0.5, C_CHROME),
    box(0.12, 0.1, 0.1, L*0.28, 1.3, -W*0.5, C_CHROME),
    box(0.04, 0.2, W*0.6, L/2 - 0.02, 0.65, 0, C_DARK),
    wheelGeo(0.4, -L*0.32, W/2), wheelGeo(0.4, -L*0.32, -W/2),
    wheelGeo(0.4, L*0.32, W/2), wheelGeo(0.4, L*0.32, -W/2),
    ...lightGeo(L, W, 0.55, true),
    ...lightGeo(L, W, 0.55, false),
  ];
  return safeMerge(parts, true);
}

export function buildTaxi() {
  // Kaduna taxi: yellow body with black roof sign
  const L = 4.4, W = 1.8;
  const body = loftBody([
    { x: -L/2,       pts: cs(W*0.85, 0.7, 0.42) },
    { x: -L*0.35,    pts: cs(W*0.95, 1.0, 0.58) },
    { x: -L*0.15,    pts: cs(W*0.90, 1.4, 0.75) },
    { x:  L*0.15,    pts: cs(W*0.90, 1.4, 0.75) },
    { x:  L*0.35,    pts: cs(W*0.95, 1.0, 0.58) },
    { x:  L/2,       pts: cs(W*0.85, 0.7, 0.42) },
  ]);
  const parts = [
    body,
    boxRGB(0.08, 0.5, W*0.85, L*0.22, 1.05, 0, C_GLASS, C_GLASS, C_GLASS),
    boxRGB(0.08, 0.5, W*0.85, -L*0.22, 1.05, 0, C_GLASS, C_GLASS, C_GLASS),
    box(0.12, 0.25, W*0.95, L/2 - 0.06, 0.5, 0, C_CHROME),
    box(0.12, 0.25, W*0.95, -L/2 + 0.06, 0.5, 0, C_CHROME),
    box(0.1, 0.08, 0.08, L*0.25, 1.05, W*0.5, C_CHROME),
    box(0.1, 0.08, 0.08, L*0.25, 1.05, -W*0.5, C_CHROME),
    // Taxi roof sign (dark — "TAXI" text area)
    boxRGB(0.5, 0.12, 0.3, 0, 1.55, 0, C_DARK, C_DARK, C_DARK),
    wheelGeo(0.33, -L*0.32, W/2), wheelGeo(0.33, -L*0.32, -W/2),
    wheelGeo(0.33, L*0.32, W/2), wheelGeo(0.33, L*0.32, -W/2),
    ...lightGeo(L, W, 0.45, true),
    ...lightGeo(L, W, 0.45, false),
  ];
  return safeMerge(parts, true);
}

export function buildPickup() {
  const L = 5.0, W = 1.9;
  const body = loftBody([
    { x: -L/2,       pts: cs(W*0.85, 0.8, 0.45) },
    { x: -L*0.35,    pts: cs(W*0.95, 0.9, 0.50) },  // flat bed rear
    { x: -L*0.15,    pts: cs(W*0.90, 1.3, 0.70) },  // cabin rear
    { x:  L*0.05,    pts: cs(W*0.90, 1.3, 0.70) },  // cabin front
    { x:  L*0.30,    pts: cs(W*0.95, 1.0, 0.58) },  // hood
    { x:  L/2,       pts: cs(W*0.85, 0.8, 0.45) },
  ]);
  const parts = [
    body,
    // Cabin glass
    boxRGB(0.08, 0.5, W*0.82, L*0.0, 1.0, 0, C_GLASS, C_GLASS, C_GLASS),
    boxRGB(0.08, 0.4, W*0.82, -L*0.15, 1.0, 0, C_GLASS, C_GLASS, C_GLASS),
    // Bed walls (dark)
    box(L*0.3, 0.4, 0.1, -L*0.2, 0.7, W*0.48, C_DARK),
    box(L*0.3, 0.4, 0.1, -L*0.2, 0.7, -W*0.48, C_DARK),
    box(0.1, 0.4, W*0.95, -L*0.35, 0.7, 0, C_DARK),
    // Bumpers
    box(0.12, 0.25, W*0.95, L/2 - 0.06, 0.5, 0, C_CHROME),
    box(0.12, 0.25, W*0.95, -L/2 + 0.06, 0.5, 0, C_CHROME),
    // Mirrors
    box(0.1, 0.08, 0.08, L*0.15, 1.0, W*0.5, C_CHROME),
    box(0.1, 0.08, 0.08, L*0.15, 1.0, -W*0.5, C_CHROME),
    wheelGeo(0.38, -L*0.32, W/2), wheelGeo(0.38, -L*0.32, -W/2),
    wheelGeo(0.38, L*0.32, W/2), wheelGeo(0.38, L*0.32, -W/2),
    ...lightGeo(L, W, 0.48, true),
    ...lightGeo(L, W, 0.48, false),
  ];
  return safeMerge(parts, true);
}

export function buildDanfoBus() {
  const L = 8.0, W = 2.4;
  const body = loftBody([
    { x: -L/2,       pts: cs(W*0.85, 2.4, 1.3) },
    { x: -L*0.40,    pts: cs(W*0.95, 2.6, 1.4) },
    { x: -L*0.10,    pts: cs(W*0.95, 2.6, 1.4) },
    { x:  L*0.10,    pts: cs(W*0.95, 2.6, 1.4) },
    { x:  L*0.35,    pts: cs(W*0.90, 2.4, 1.3) },  // sloped front
    { x:  L/2,       pts: cs(W*0.85, 1.8, 1.0) },  // front narrower
  ]);
  const parts = [
    body,
    // Green stripe (along the side — like Lagos danfo)
    box(L*0.9, 0.3, 0.05, 0, 1.0, W*0.48, 0.06),
    box(L*0.9, 0.3, 0.05, 0, 1.0, -W*0.48, 0.06),
    // Windshield
    boxRGB(0.08, 1.2, W*0.8, L*0.4, 1.8, 0, C_GLASS, C_GLASS, C_GLASS),
    // Side windows (5 per side)
    ...Array.from({length: 5}, (_, i) => boxRGB(0.06, 0.7, W*0.85, -L*0.35 + i * L*0.16, 1.8, 0, C_GLASS, C_GLASS, C_GLASS)),
    // Headlights
    boxRGB(0.1, 0.3, 0.4, L/2 + 0.02, 0.8, W*0.3, C_HEAD[0], C_HEAD[1], C_HEAD[2]),
    boxRGB(0.1, 0.3, 0.4, L/2 + 0.02, 0.8, -W*0.3, C_HEAD[0], C_HEAD[1], C_HEAD[2]),
    // Taillights
    boxRGB(0.1, 0.3, 0.4, -L/2 - 0.02, 0.8, W*0.3, C_TAIL[0], C_TAIL[1], C_TAIL[2]),
    boxRGB(0.1, 0.3, 0.4, -L/2 - 0.02, 0.8, -W*0.3, C_TAIL[0], C_TAIL[1], C_TAIL[2]),
    // Wheels (6 — 3 per side)
    wheelGeo(0.45, -L*0.35, W/2), wheelGeo(0.45, -L*0.35, -W/2),
    wheelGeo(0.45, 0, W/2), wheelGeo(0.45, 0, -W/2),
    wheelGeo(0.45, L*0.35, W/2), wheelGeo(0.45, L*0.35, -W/2),
  ];
  return safeMerge(parts, true);
}

// ---- Convenience: get a car shape by type name ----
// Returns a merged BufferGeometry with vertex colours, ready for InstancedMesh.
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

// ---- Replacements for town.js carShape() and busShape() ----
// These are used by life.js (avenue traffic) and areas_world.js (parked cars).
export function carShapeNew() { return getCarShape("sedan"); }
export function busShapeNew() { return getCarShape("bus"); }

// ---- All 5 car types for traffic.js ----
// traffic.js picks a random type per car (weighted). Each type is a separate
// InstancedMesh so body colour can vary per instance.
export const CAR_TYPES = ["sedan", "hatch", "suv", "taxi", "pickup"];
export const CAR_WEIGHTS = [4, 3, 3, 2, 1]; // sedan common, pickup rare
