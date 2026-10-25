#!/usr/bin/env node
// tools/fetch-kaduna-osm.mjs — OFFLINE pipeline for the city density upgrade.
// Inspired by mrdoob/slop-newyork's tools/ (MIT): fetch real OpenStreetMap data
// once, align it to the game's world frame, simplify, and write a compact JSON
// the game imports at boot. The game NEVER calls Overpass.
//
// Usage:  node tools/fetch-kaduna-osm.mjs
// Output: public/data/kaduna-osm.json
//
// Frame alignment (IMPORTANT):
//   The game world has Ahmadu Bello Way as the main street running along the X
//   axis (z=0, east = +x, south = +z). This script rotates the raw OSM data so
//   the real Ahmadu Bello Way centreline becomes horizontal, then anchors the
//   point of that road closest to the city-centre anchor (Central Mosque) at
//   game (0, 0). Real footprints then fall around the existing hand-built city
//   in the right orientation; the game filters overlaps at runtime
//   (src/world/protectedZones.js) — the data file stays "raw but aligned".
//
// Data © OpenStreetMap contributors (ODbL). Attribution lives in CREDITS.md
// and inside the generated JSON.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUTPUT = resolve(ROOT, "public/data/kaduna-osm.json");

// ---- Area of interest ----
// Anchor = Kaduna city centre (Central Mosque) — same anchor as kaduna.json.
// FETCH area: the city CORE (avenues + district belt) ~900 x 660 m. Real
// Kaduna street grid is dense here, so this already yields hundreds of
// footprints; widen BBOX later for more.
const ANCHOR = { lat: 10.5226, lon: 7.4408, name: "Kaduna Central Mosque" };
const FETCH_HALF = { x: 460, z: 345 };
// Game-space import bounds (metres): keep a margin inside the city map
// (map half 360x340, districts live inside). Corridor/zone filtering happens
// in-game, but data outside these bounds is dead weight.
const BOUNDS = { minX: -555, maxX: 555, minZ: -330, maxZ: 330 };
// Fetch bbox (degrees): covers the import bounds plus rotation margin.
const REACH_M = Math.hypot(FETCH_HALF.x, FETCH_HALF.z) + 60; // ~585 m
const BBOX = {
  south: ANCHOR.lat - REACH_M / 111000,
  north: ANCHOR.lat + REACH_M / 111000,
  west: ANCHOR.lon - REACH_M / (111000 * Math.cos((ANCHOR.lat * Math.PI) / 180)),
  east: ANCHOR.lon + REACH_M / (111000 * Math.cos((ANCHOR.lat * Math.PI) / 180)),
};

// ---- Projection: lon/lat → local metres (equirectangular, +x east, +z south) ----
const LAT_M = 111000;
const LON_M = 111000 * Math.cos((ANCHOR.lat * Math.PI) / 180);
const toXY = (lon, lat) => [(lon - ANCHOR.lon) * LON_M, -(lat - ANCHOR.lat) * LAT_M];

// ---- Ramer–Douglas–Peucker simplification (same idea as slop's rdp) ----
function rdp(pts, tol) {
  if (pts.length < 3) return pts.slice();
  const sqTol = tol * tol;
  const sqSegDist = (p, a, b) => {
    let dx = b[0] - a[0], dz = b[1] - a[1];
    if (dx === 0 && dz === 0) return (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)));
    const px = a[0] + t * dx, pz = a[1] + t * dz;
    return (p[0] - px) ** 2 + (p[1] - pz) ** 2;
  };
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxD = 0, idx = -1;
    for (let i = first + 1; i < last; i++) {
      const d = sqSegDist(pts[i], pts[first], pts[last]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > sqTol && idx > 0) {
      keep[idx] = 1;
      stack.push([first, idx], [idx, last]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

// ---- Ring helpers ----
const ringArea = (pts) => {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % n];
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
};
const centroid = (pts) => {
  let x = 0, z = 0;
  for (const p of pts) { x += p[0]; z += p[1]; }
  return [x / pts.length, z / pts.length];
};
// PCA angle → oriented box (w along the principal axis, d across), like slop's site fitting.
function orientedBox(pts) {
  const [mx, mz] = centroid(pts);
  let sxx = 0, szz = 0, sxz = 0;
  for (const [x, z] of pts) { const dx = x - mx, dz = z - mz; sxx += dx * dx; szz += dz * dz; sxz += dx * dz; }
  const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz);
  const c = Math.cos(ang), s = Math.sin(ang);
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const [x, z] of pts) {
    const u = (x - mx) * c + (z - mz) * s;
    const v = -(x - mx) * s + (z - mz) * c;
    if (u < minU) minU = u; if (u > maxU) maxU = u;
    if (v < minV) minV = v; if (v > maxV) maxV = v;
  }
  // Normalise angle into [-PI/4, PI/4] around the long axis so boxes stay "sideways-stable"
  let w = maxU - minU, d = maxV - minV, ry = -ang;
  if (w < d) { const t = w; w = d; d = t; ry = -(ang + Math.PI / 2); }
  while (ry > Math.PI / 4) ry -= Math.PI / 2;
  while (ry < -Math.PI / 4) ry += Math.PI / 2;
  return { cx: mx, cz: mz, w, d, ry };
}

// ---- Overpass fetch with retries across endpoints (slop's overpass.sh idea) ----
// Central Kaduna is DENSE and the public Overpass gateways time out on big
// queries, so the fetch uses SMALL micro-tiles (8x8 grid of the bbox) and
// recursively splits any tile that still fails. Responses stay < ~300 KB each.
const TILE_LAT = 0.0025;   // ~280 m — safely below the gateway budget
const TILE_LON = 0.0028;   // ~340 m
const ENDPOINTS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter", // reachable + global (tested 2026-10)
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const MAX_SPLIT_DEPTH = 2; // (kept for reference; splitting disabled in favour of retry rounds)

const tileQuery = (s, w, n, e) => `[out:json][timeout:60];(
  way["building"](${s},${w},${n},${e});
  way["highway"~"^(primary|trunk|secondary|tertiary|residential|unclassified)$"](${s},${w},${n},${e});
);out geom;`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().slice(11, 19);

async function fetchOnce(s, w, n, e) {
  const body = "data=" + encodeURIComponent(tileQuery(s, w, n, e));
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "kaduna-lifestyle-city-density/1.0 (three.js game)" },
        body,
        signal: AbortSignal.timeout(40000),
      });
      if (!res.ok) { console.warn(`    [${stamp()}] HTTP ${res.status} ${url.split("/")[2]}`); continue; }
      const data = await res.json();
      if (!Array.isArray(data.elements) || data.remark) { console.warn("    bad payload"); continue; }
      return data.elements;
    } catch (err) {
      console.warn(`    [${stamp()}] failed ${url.split("/")[2]}: ${String(err.message).slice(0, 50)}`);
    }
  }
  return null;
}

async function fetchAllTiles() {
  const byId = new Map();
  const done = new Set();
  // Resume support: previous partial runs keep a snapshot in tools/data/.
  const SNAP = resolve(__dirname, "data/osm-raw-snapshot.json");
  mkdirSync(resolve(__dirname, "data"), { recursive: true });
  if (existsSync(SNAP)) {
    try {
      const snap = JSON.parse(readFileSync(SNAP, "utf8"));
      for (const el of snap.ways || []) byId.set(el.id, el);
      for (const k of snap.doneTiles || []) done.add(k);
      if (byId.size) console.log(`[${stamp()}] Resuming: ${byId.size} ways, ${done.size} tiles already fetched`);
    } catch { /* fresh start */ }
  }
  const rows = Math.ceil((BBOX.north - BBOX.south) / TILE_LAT);
  const cols = Math.ceil((BBOX.east - BBOX.west) / TILE_LON);
  const tiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const s = BBOX.south + r * TILE_LAT, n = Math.min(BBOX.north, s + TILE_LAT + 0.0002);
      const w = BBOX.west + c * TILE_LON, e = Math.min(BBOX.east, w + TILE_LON + 0.0002);
      tiles.push([s, w, n, e, `${s.toFixed(5)},${w.toFixed(5)}`]);
    }
  }
  console.log(`[${stamp()}] ${tiles.length} micro-tiles (${rows}x${cols}), ${done.size} already done`);
  const saveSnap = () => writeFileSync(SNAP, JSON.stringify({ ways: [...byId.values()], doneTiles: [...done] }));

  // The public gateways rate-limit hard, so: ONE attempt per tile per round,
  // polite gaps, failed tiles go to a retry queue (no recursive splitting —
  // that just multiplies requests against a rate limiter).
  let queue = tiles.filter(([,, , , key]) => !done.has(key));
  for (let round = 1; round <= 6 && queue.length; round++) {
    console.log(`[${stamp()}] round ${round}: ${queue.length} tiles to go`);
    const next = [];
    for (const [s, w, n, e, key] of queue) {
      const els = await fetchOnce(s, w, n, e);
      if (els) {
        let fresh = 0;
        for (const el of els) if (el.type === "way" && !byId.has(el.id)) { byId.set(el.id, el); fresh++; }
        done.add(key);
        console.log(`    [${stamp()}] tile ok: ${els.length} els, ${fresh} new (total ${byId.size})`);
        saveSnap();
        await sleep(15000);
      } else {
        next.push([s, w, n, e, key]);
        await sleep(round < 3 ? 25000 : 60000);  // let the rate limiter cool
      }
    }
    queue = next;
  }
  if (byId.size < 50) throw new Error("Too little data fetched — aborting (world stays unchanged)");
  console.log(`[${stamp()}] DONE: ${byId.size} ways from ${done.size}/${tiles.length} tiles`);
  return { elements: [...byId.values()] };
}

// ---- Main ----
const osm = await fetchAllTiles();
console.log(`Got ${osm.elements.length} unique ways`);

// Pass 1: collect ways.
const buildings = [], roads = [];
for (const el of osm.elements) {
  if (el.type !== "way" || !Array.isArray(el.geometry)) continue;
  const tags = el.tags || {};
  const pts = el.geometry.filter((g) => g && isFinite(g.lon) && isFinite(g.lat)).map((g) => toXY(g.lon, g.lat));
  if (pts.length < (tags.building ? 4 : 2)) continue;
  if (tags.building) buildings.push({ pts, tags });
  else if (tags.highway) roads.push({ pts, tags, type: tags.highway, name: tags.name || "" });
}

// Pass 2: find the alignment road near the anchor: prefer "Ahmadu Bello Way",
// else the highest-class / longest named-or-unnamed road within 900 m.
const CLASS_RANK = { primary: 0, trunk: 1, secondary: 2, tertiary: 3, unclassified: 4, residential: 5 };
let roadPts = [];
for (const r of roads) {
  if (!/ahmadu|bello/i.test(r.name)) continue;
  if (r.pts.length > roadPts.length) roadPts = r.pts;
}
if (roadPts.length < 2) {
  let best = null, bestKey = null;
  const wayLen = (pts) => pts.reduce((t, p, i) => (i ? t + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
  for (const r of roads) {
    const [cx, cz] = centroid(r.pts);
    if (Math.hypot(cx, cz) > 900) continue;
    const rank = CLASS_RANK[r.type] ?? 9;
    const key = [rank, -Math.round(wayLen(r.pts))];  // lowest class rank, then longest
    if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) { best = r; bestKey = key; }
  }
  roadPts = best ? best.pts : [];
  if (roadPts.length >= 2) console.log(`ABW not found near anchor — aligning to "${best?.name || best?.type}" instead`);
}
if (roadPts.length < 2) { console.error("No main road found — aborting (world stays unchanged)"); process.exit(1); }

// Mean direction of road segments within 600 m of the anchor (keep it pointing ~east).
let vx = 0, vz = 0;
for (let i = 1; i < roadPts.length; i++) {
  const mx = (roadPts[i][0] + roadPts[i - 1][0]) / 2, mz = (roadPts[i][1] + roadPts[i - 1][1]) / 2;
  if (Math.hypot(mx, mz) > 600) continue;
  let dx = roadPts[i][0] - roadPts[i - 1][0], dz = roadPts[i][1] - roadPts[i - 1][1];
  const l = Math.hypot(dx, dz);
  if (l < 1) continue;
  if (dx < 0) { dx = -dx; dz = -dz; }      // orient east-ish
  vx += dx / l; vz += dz / l;
}
const phi = Math.atan2(vz, vx);            // current angle of the road in raw frame
const alpha = -phi;                        // rotate by this to lay the road on the X axis
const cosA = Math.cos(alpha), sinA = Math.sin(alpha);
const rot = ([x, z]) => [x * cosA - z * sinA, x * sinA + z * cosA];
console.log(`Main road bearing ${(phi * 180) / Math.PI.toFixed(1)}° → rotating by ${(-alpha * 180) / Math.PI.toFixed(1)}°`);

// Anchor: point of the rotated road closest to the (rotated) anchor — maps to game (0,0).
const roadRot = roadPts.map(rot);
let anchor = roadRot[0], anchorD = Infinity;
for (const p of roadRot) { const d = p[0] * p[0] + p[1] * p[1]; if (d < anchorD) { anchorD = d; anchor = p; } }
const tr = ([x, z]) => [x - anchor[0], z - anchor[1]];
const toGame = (p) => tr(rot(p));
const roadGame = roadRot.map(tr);
const zs = roadGame.filter((p) => Math.abs(p[0]) < 300).map((p) => Math.abs(p[1]));
console.log(`Anchor set. Road flatness near centre: mean|z|=${(zs.reduce((a, b) => a + b, 0) / zs.length).toFixed(1)}m max=${Math.max(...zs).toFixed(1)}m (should be small)`);

// Pass 3: buildings → oriented boxes in game space.
const KINDS = ["yes", "residential", "house", "apartments", "commercial", "retail", "office", "school", "church", "mosque", "industrial", "hotel", "hospital"];
const kindIdx = (t) => {
  const b = String(t || "yes").toLowerCase();
  const i = KINDS.indexOf(b);
  return i >= 0 ? i : 0;
};
const q1 = (v) => Math.round(v * 10) / 10;      // 0.1 m
const outBuildings = [];
let rejectedSmall = 0, rejectedOOB = 0;
for (const b of buildings) {
  const ring = rdp(b.pts.slice(0, -1), 1.2);
  if (ring.length < 3) continue;
  const area = Math.abs(ringArea(ring));
  if (area < 18 || area > 6000) { rejectedSmall++; continue; }
  const box = orientedBox(ring);
  if (box.w < 3.5 || box.d < 3.5) { rejectedSmall++; continue; }
  const [cx, cz] = toGame([box.cx, box.cz]);
  if (cx < BOUNDS.minX || cx > BOUNDS.maxX || cz < BOUNDS.minZ || cz > BOUNDS.maxZ) { rejectedOOB++; continue; }

  // Height: real tags first, then a deterministic Nigerian-city mix from the footprint hash.
  let h = 0, levels = parseInt(b.tags["building:levels"] || "", 10);
  if (b.tags.height && parseFloat(b.tags.height) > 0) h = Math.min(30, parseFloat(b.tags.height));
  else if (levels >= 1) h = Math.min(30, levels * 3.3);
  if (!h) {
    let seed = 2166136261 >>> 0;
    const skey = `${Math.round(box.cx)},${Math.round(box.cz)}`;
    for (let i = 0; i < skey.length; i++) { seed ^= skey.charCodeAt(i); seed = Math.imul(seed, 16777619) >>> 0; }
    const rr = ((seed ^ (seed >>> 15)) >>> 0) / 4294967296;
    const rr2 = ((seed ^ (seed >>> 7)) >>> 0) / 4294967296;
    if (area < 90) h = rr < 0.7 ? 3.3 : 6.6;                                   // small compounds: 1-2 storeys
    else if (area < 300) h = [3.3, 3.3, 6.6, 6.6, 9.9, 13.2][Math.floor(rr * 6)];
    else h = [6.6, 9.9, 9.9, 13.2, 16.5, 19.8][Math.floor(rr * 6)];
    if (area < 420 && rr2 < 0.02) h = 22 + Math.floor(rr * 6) * 1.8;           // rare tower
  }
  // Roof: small single-storey houses often get a zinc gable; bigger = flat + parapet.
  const gable = h <= 3.4 && area < 140 && ((cx * 13 + cz * 7) | 0) % 10 < 6;
  outBuildings.push([q1(cx), q1(cz), q1(box.w), q1(box.d), Math.round(box.ry * 1000) / 1000, q1(h), kindIdx(b.tags.building), gable ? 1 : 0]);
}
console.log(`Buildings: ${outBuildings.length} kept (${rejectedSmall} too small/degenerate, ${rejectedOOB} out of bounds)`);

// Pass 4: roads → simplified polylines in game space (visual-only use).
const outRoads = [];
for (const r of roads) {
  if (r.pts.length < 2) continue;
  const pts = rdp(r.pts.map(toGame), 3).map(([x, z]) => [q1(x), q1(z)]);
  if (pts.length < 2) continue;
  const width = r.type === "primary" || r.type === "trunk" ? 14 : r.type === "secondary" ? 10 : r.type === "tertiary" ? 8 : 5.5;
  outRoads.push({ t: r.type, n: r.name, w: width, pts });
}
console.log(`Roads: ${outRoads.length} polylines`);

const OUT = {
  _attribution: "© OpenStreetMap contributors (ODbL) — data fetched via Overpass API",
  _generated: new Date().toISOString(),
  _tool: "tools/fetch-kaduna-osm.mjs",
  frame: {
    anchor: ANCHOR,
    rotationDeg: Math.round(((-alpha * 180) / Math.PI) * 100) / 100,
    units: "metres, +x east, +z south, origin: point on Ahmadu Bello Way closest to the anchor",
    bounds: BOUNDS,
  },
  kinds: KINDS,
  buildings: outBuildings,   // [x, z, w, d, rotY(rad), height(m), kindIdx, gableRoof(0/1)]
  roads: outRoads,
};
writeFileSync(OUTPUT, JSON.stringify(OUT));
console.log(`Wrote ${OUTPUT} (${(JSON.stringify(OUT).length / 1024).toFixed(0)} KB)`);
