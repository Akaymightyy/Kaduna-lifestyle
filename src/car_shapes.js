// src/car_shapes.js — light low-poly cars, built by code (no model files). Our own WebGL code.
// Method: a car is a LOWER BODY (side silhouette extruded across the width, chamfered edges) + a narrower
// glass CABIN (also a side silhouette) + roof slab + pillars + bumpers, lights, grille and real wheels.
// Axes: +x = front of the car, +y up, z = width. Vertex colours: 1.0 = body paint (tinted per instance),
// small values = glass / tyres / trim. Every car is ~1.5-3k triangles so many can be instanced on a phone.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const C_GLASS = 0.16, C_CHROME = 0.6, C_TYRE = 0.05, C_DARK = 0.1;
const HEAD = [1.0, 0.95, 0.7], TAIL = [1.0, 0.12, 0.1];

function safeMerge(parts) {
  const same = parts.map((g) => {
    const q = g.index ? g.toNonIndexed() : g;
    if (q.attributes.uv) q.deleteAttribute("uv");
    if (q.attributes.uv1) q.deleteAttribute("uv1");
    if (!q.attributes.normal) q.computeVertexNormals();
    return q;
  });
  const m = mergeGeometries(same, false);
  if (!m) throw new Error("car_shapes: merge failed");
  return m;
}
function vcol(g, r, gg = r, b = r) {
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = r; a[i * 3 + 1] = gg; a[i * 3 + 2] = b; }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3)); return g;
}
const box = (w, h, d, x, y, z, c, g, b) => vcol(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c, g, b);

// side silhouette [[x,y],...] extruded across the width (total width w), slightly chamfered
function slab(poly, w, c, bev = 0.05) {
  const sh = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
  const depth = Math.max(0.01, w - bev * 2);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, steps: 1 });
  g.translate(0, 0, -depth / 2);
  return vcol(g, c);
}
function wheel(r, x, z, wd = 0.26) {
  const t = new THREE.CylinderGeometry(r, r, wd, 14).rotateX(Math.PI / 2).translate(x, r, z);
  const hub = new THREE.CylinderGeometry(r * 0.55, r * 0.55, wd + 0.04, 10).rotateX(Math.PI / 2).translate(x, r, z);
  return [vcol(t, C_TYRE), vcol(hub, C_CHROME)];
}
function lights(L, y, W, hy = 0.12, wd = 0.34) {
  return [
    box(0.08, hy, wd, L / 2 + 0.01, y, W * 0.33, ...HEAD), box(0.08, hy, wd, L / 2 + 0.01, y, -W * 0.33, ...HEAD),
    box(0.08, hy, wd, -L / 2 - 0.01, y, W * 0.33, ...TAIL), box(0.08, hy, wd, -L / 2 - 0.01, y, -W * 0.33, ...TAIL),
  ];
}
function wheels(r, xf, xr, W, wd) { return [...wheel(r, xf, W / 2 - 0.02, wd), ...wheel(r, xf, -W / 2 + 0.02, wd), ...wheel(r, xr, W / 2 - 0.02, wd), ...wheel(r, xr, -W / 2 + 0.02, wd)]; }

// generic passenger car: bodyPoly (lower body), cabinPoly (glass), roof [x0,x1,y], pillar x positions
function passenger(o) {
  const { L, W, body, cabin, roof, pillars = [], r = 0.34, xf, xr, ride = 0 } = o;
  const parts = [slab(body, W * 0.96, 1), slab(cabin, W * 0.8, C_GLASS, 0.04)];
  parts.push(box(roof[1] - roof[0], 0.07, W * 0.78, (roof[0] + roof[1]) / 2, roof[2], 0, 1));
  for (const [px, py0, py1] of pillars) parts.push(box(0.1, py1 - py0, W * 0.82, px, (py0 + py1) / 2, 0, 1));
  parts.push(box(0.16, 0.2, W * 0.98, L / 2 - 0.04, 0.42, 0, 0.35), box(0.16, 0.2, W * 0.98, -L / 2 + 0.04, 0.42, 0, 0.35));   // bumpers
  parts.push(box(0.04, 0.16, W * 0.5, L / 2 + 0.02, 0.62, 0, C_DARK));                                                          // grille
  parts.push(box(0.1, 0.07, 0.1, cabin[cabin.length - 1][0] - 0.05, cabin[cabin.length - 1][1] + 0.12, W * 0.5, 1), box(0.1, 0.07, 0.1, cabin[cabin.length - 1][0] - 0.05, cabin[cabin.length - 1][1] + 0.12, -W * 0.5, 1));   // mirrors
  parts.push(...lights(L, 0.68, W), ...wheels(r, xf, xr, W, 0.26));
  return parts;
}

export function buildSedan() {
  const L = 4.4, W = 1.8;
  return safeMerge(passenger({ L, W, r: 0.34, xf: 1.38, xr: -1.4,
    body: [[-2.2, 0.28], [-2.2, 0.8], [-1.55, 0.92], [1.35, 0.94], [2.2, 0.76], [2.2, 0.28]],
    cabin: [[-1.45, 0.9], [-0.9, 1.44], [0.5, 1.44], [1.12, 0.92]],
    roof: [-0.95, 0.55, 1.46], pillars: [[-0.18, 0.92, 1.44]] }));
}
export function buildHatchback() {
  const L = 3.8, W = 1.74;
  return safeMerge(passenger({ L, W, r: 0.32, xf: 1.2, xr: -1.15,
    body: [[-1.9, 0.28], [-1.9, 0.9], [1.2, 0.93], [1.9, 0.74], [1.9, 0.28]],
    cabin: [[-1.8, 0.92], [-1.3, 1.46], [0.4, 1.46], [0.98, 0.94]],
    roof: [-1.3, 0.45, 1.48], pillars: [[-0.3, 0.94, 1.46]] }));
}
export function buildSUV() {
  const L = 4.7, W = 1.95;
  return safeMerge(passenger({ L, W, r: 0.42, xf: 1.5, xr: -1.5,
    body: [[-2.35, 0.34], [-2.35, 1.0], [-1.9, 1.08], [1.5, 1.1], [2.35, 0.92], [2.35, 0.34]],
    cabin: [[-2.2, 1.06], [-2.05, 1.76], [0.55, 1.76], [1.15, 1.1]],
    roof: [-2.1, 0.6, 1.79], pillars: [[-0.5, 1.08, 1.76], [-1.35, 1.08, 1.76]] }));
}
export function buildTaxi() {
  const L = 4.4, W = 1.8, p = passenger({ L, W, r: 0.34, xf: 1.38, xr: -1.4,
    body: [[-2.2, 0.28], [-2.2, 0.8], [-1.55, 0.92], [1.35, 0.94], [2.2, 0.76], [2.2, 0.28]],
    cabin: [[-1.45, 0.9], [-0.9, 1.44], [0.5, 1.44], [1.12, 0.92]],
    roof: [-0.95, 0.55, 1.46], pillars: [[-0.18, 0.92, 1.44]] });
  p.push(box(0.5, 0.16, 0.26, -0.1, 1.58, 0, 0.95), box(0.52, 0.04, 0.28, -0.1, 1.51, 0, C_DARK));   // roof light
  return safeMerge(p);
}
export function buildPickup() {
  const L = 5.0, W = 1.9, p = [];
  p.push(slab([[-2.5, 0.34], [-2.5, 0.95], [-0.3, 0.96], [1.7, 0.98], [2.5, 0.82], [2.5, 0.34]], W * 0.96, 1));
  p.push(slab([[-0.4, 0.96], [-0.05, 1.62], [0.75, 1.62], [1.4, 0.98]], W * 0.8, C_GLASS, 0.04));
  p.push(box(0.9, 0.07, W * 0.78, 0.35, 1.65, 0, 1));
  for (const s of [1, -1]) p.push(box(2.1, 0.34, 0.07, -1.45, 1.1, s * (W / 2 - 0.05), 1));       // bed sides
  p.push(box(0.07, 0.34, W * 0.92, -2.47, 1.1, 0, 1), box(0.07, 0.34, W * 0.92, -0.45, 1.1, 0, 1));
  p.push(box(0.16, 0.2, W, L / 2 - 0.04, 0.46, 0, 0.35), box(0.16, 0.2, W, -L / 2 + 0.04, 0.46, 0, 0.35), box(0.04, 0.18, W * 0.5, L / 2 + 0.02, 0.66, 0, C_DARK));
  p.push(...lights(L, 0.72, W), ...wheels(0.4, 1.6, -1.55, W, 0.28));
  return safeMerge(p);
}
export function buildDanfoBus() {
  const L = 8.4, W = 2.3, p = [];
  p.push(slab([[-4.2, 0.4], [-4.2, 2.55], [3.0, 2.55], [4.2, 1.5], [4.2, 0.4]], W * 0.98, 1));
  p.push(slab([[-4.0, 1.42], [-4.0, 2.28], [3.0, 2.28], [3.95, 1.5]], W * 1.0, C_GLASS, 0.02));
  for (let i = 0; i < 7; i++) p.push(box(0.12, 0.9, W * 1.01, -3.3 + i * 1.0, 1.85, 0, 1));          // window posts
  p.push(box(8.3, 0.2, W * 1.005, 0, 1.2, 0, 0.06, 0.38, 0.12));                                       // green stripe (colour tinted by instance)
  p.push(box(0.2, 0.28, W * 0.98, 4.2, 0.55, 0, 0.35), box(0.2, 0.28, W * 0.98, -4.2, 0.55, 0, 0.35));
  p.push(box(0.1, 0.3, 0.4, 4.22, 0.95, 0.8, ...HEAD), box(0.1, 0.3, 0.4, 4.22, 0.95, -0.8, ...HEAD), box(0.1, 0.3, 0.4, -4.22, 0.95, 0.8, ...TAIL), box(0.1, 0.3, 0.4, -4.22, 0.95, -0.8, ...TAIL));
  p.push(...wheel(0.46, 2.6, W / 2 - 0.02, 0.32), ...wheel(0.46, 2.6, -W / 2 + 0.02, 0.32), ...wheel(0.46, -2.6, W / 2 - 0.02, 0.32), ...wheel(0.46, -2.6, -W / 2 + 0.02, 0.32));
  return safeMerge(p);
}

const _cache = {};
export function getCarShape(type) {
  if (_cache[type]) return _cache[type];
  let g;
  switch (type) {
    case "hatch": case "hatchback": g = buildHatchback(); break;
    case "suv": case "jeep": g = buildSUV(); break;
    case "taxi": g = buildTaxi(); break;
    case "pickup": g = buildPickup(); break;
    case "bus": case "danfo": g = buildDanfoBus(); break;
    default: g = buildSedan();
  }
  return (_cache[type] = g);
}
export function carShapeNew() { return getCarShape("sedan"); }
export function busShapeNew() { return getCarShape("bus"); }
export const CAR_TYPES = ["sedan", "hatch", "suv", "taxi", "pickup"];
export const CAR_WEIGHTS = [4, 3, 3, 2, 1];
