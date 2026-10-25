// src/route.js — the blue DIRECTION LINE from you to your 📍 pin, following the real roads of the city
// (main street, 4 avenues, 4 cross streets). Pure maths + one flat ribbon mesh; nothing here moves anything.
//   getRoute(from, to) -> [{x,z}, ...]     (you -> nearest road -> along the roads -> road nearest the pin -> pin)
//   initRoute(scene)  /  tickRoute(playerPos, dt)   keeps a blue ribbon on the ground + window._route for the maps
import * as THREE from "three";
import { WORLD_HALF_X, WIDE_AVENUES_X, WIDE_CROSS_Z, MAP_HALF_X, MAP_HALF_Z } from "./config.js";

// roads as straight lines: { a: "z"|"x" (what is fixed), v: fixed value, lo, hi: extent along the road }
const ROADS = [{ a: "z", v: 0, lo: -WORLD_HALF_X, hi: WORLD_HALF_X }];
for (const z of WIDE_CROSS_Z) ROADS.push({ a: "z", v: z, lo: -MAP_HALF_X + 15, hi: MAP_HALF_X - 15 });
for (const x of WIDE_AVENUES_X) ROADS.push({ a: "x", v: x, lo: -MAP_HALF_Z + 15, hi: MAP_HALF_Z - 15 });

const P = (r, t) => (r.a === "z" ? { x: t, z: r.v } : { x: r.v, z: t });
const alongOf = (r, p) => (r.a === "z" ? p.x : p.z);
function snap(p) {                                        // nearest point that lies on any road
  let best = null;
  ROADS.forEach((r, i) => {
    const t = Math.max(r.lo, Math.min(r.hi, alongOf(r, p))), q = P(r, t), d = Math.hypot(q.x - p.x, q.z - p.z);
    if (!best || d < best.d) best = { i, t, q, d };
  });
  return best;
}

export function getRoute(from, to) {
  const s = snap(from), e = snap(to);
  const nodes = [], key = new Map(), stops = ROADS.map(() => []);
  const node = (x, z, ri, t) => { const k = x.toFixed(1) + "," + z.toFixed(1); let id = key.get(k); if (id === undefined) { id = nodes.length; key.set(k, id); nodes.push({ x, z, adj: [] }); } if (ri !== undefined) stops[ri].push({ t, id }); return id; };
  // junctions
  ROADS.forEach((ra, i) => ROADS.forEach((rb, j) => {
    if (ra.a === "z" && rb.a === "x" && rb.v >= ra.lo && rb.v <= ra.hi && ra.v >= rb.lo && ra.v <= rb.hi) { const id = node(rb.v, ra.v); stops[i].push({ t: rb.v, id }); stops[j].push({ t: ra.v, id }); }
  }));
  const sId = node(s.q.x, s.q.z, s.i, s.t), eId = node(e.q.x, e.q.z, e.i, e.t);
  stops.forEach((list) => { list.sort((m, n) => m.t - n.t); for (let k = 0; k + 1 < list.length; k++) { const a = list[k].id, b = list[k + 1].id; if (a === b) continue; const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z); nodes[a].adj.push([b, d]); nodes[b].adj.push([a, d]); } });
  const dist = nodes.map(() => Infinity), prev = nodes.map(() => -1), done = nodes.map(() => false); dist[sId] = 0;
  for (let n = 0; n < nodes.length; n++) {
    let u = -1; for (let k = 0; k < nodes.length; k++) if (!done[k] && (u < 0 || dist[k] < dist[u])) u = k;
    if (u < 0 || dist[u] === Infinity) break; done[u] = true; if (u === eId) break;
    for (const [v, d] of nodes[u].adj) if (dist[u] + d < dist[v]) { dist[v] = dist[u] + d; prev[v] = u; }
  }
  const path = []; for (let u = eId; u >= 0; u = prev[u]) path.push({ x: nodes[u].x, z: nodes[u].z });
  path.reverse();
  return [{ x: from.x, z: from.z }, ...path, { x: to.x, z: to.z }];
}

// ---- the blue ribbon on the ground ----
let _scene = null, _mesh = null, _key = "", _t = 0;
const _mat = new THREE.MeshBasicMaterial({ color: 0x2f7bff, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8, side: THREE.DoubleSide });
export function initRoute(scene) { _scene = scene; }
function ribbon(pts, w) {
  const pos = [], idx = []; let k = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz); if (L < 0.01) continue;
    const nx = (-dz / L) * w / 2, nz = (dx / L) * w / 2, y = 0.3;
    pos.push(a.x + nx, y, a.z + nz, a.x - nx, y, a.z - nz, b.x + nx, y, b.z + nz, b.x - nx, y, b.z - nz);
    idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); k += 4;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
}
function clear() { if (_mesh) { _scene.remove(_mesh); _mesh.geometry.dispose(); _mesh = null; } window._route = null; _key = ""; }

/** every frame (cheap: only recomputes once a second, and only if you or the pin moved). */
export function tickRoute(pp, dt, toast) {
  if (!_scene) return;
  const md = window._markedDest;
  if (!md) { if (_mesh || window._route) clear(); return; }
  if (Math.hypot(md.x - pp.x, md.z - pp.z) < 7) { clear(); window._markedDest = null; if (toast) toast("📍 You don reach your pin!"); return; }
  _t += dt; if (_t < 1 && _mesh) return; _t = 0;
  const key = Math.round(pp.x / 4) + ":" + Math.round(pp.z / 4) + ":" + Math.round(md.x) + ":" + Math.round(md.z);
  if (key === _key && _mesh) return; _key = key;
  const pts = getRoute({ x: pp.x, z: pp.z }, md); window._route = pts;
  if (_mesh) { _scene.remove(_mesh); _mesh.geometry.dispose(); }
  _mesh = new THREE.Mesh(ribbon(pts, 3.2), _mat); _mesh.frustumCulled = false; _mesh.renderOrder = 6; _scene.add(_mesh);
}
