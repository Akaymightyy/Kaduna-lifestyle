// src/world/osmCity.js — ADDITIVE city-density layer: real Kaduna buildings
// from OpenStreetMap, generated procedurally in the exact art style of the
// existing hand-built city (window texture + night window-glow, plaster/zinc
// pattern codes, the same palette and rooftop props).
//
// Inspired by mrdoob/slop-newyork (MIT): real map footprints → simple clean
// extrusions, merged into spatial chunks for few draw calls + frustum culling.
//
// SAFETY CONTRACT (see OSM-CITY-README.md):
//   1. Nothing existing is ever moved, removed or re-rendered. This module
//      only ADDS meshes into world.world (hidden together with the city when
//      you enter a place), pushes colliders, and appends avenue lamps.
//   2. Every candidate footprint is tested against protectedZones.js —
//      anything that would overlap an existing building, road, district,
//      place entrance or landing point is DROPPED.
//   3. Fully reversible: set OSM_CITY.enabled=false in config.js (or let the
//      data file 404) and the game boots exactly like before.
//   4. Fail-safe: any error here is caught and logged; the game continues
//      with the unchanged procedural city.
//
// Data © OpenStreetMap contributors (ODbL) — generated offline by
// tools/fetch-kaduna-osm.mjs. The game NEVER calls Overpass.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { OSM_CITY, WIDE_AVENUES_X, WIDE_CROSS_Z, MAP_HALF_Z, rng } from "../config.js";
import { stylize } from "../art/style.js";
import { registerCullChunks } from "../scene_culling.js";
import { hitsProtectedZone, addPlaceEntranceZones, protectedZoneCount } from "./protectedZones.js";
import { windowTexture, windowBox, withPat, part, addWindowGlow } from "../world.js";
import { listPlaces } from "../places/registry.js";

const OL = (o) => stylize(new THREE.MeshLambertMaterial(o), { pat: true, ao: true, fake: false });

// Same wall palette as world.js (the existing street rows) so the new
// buildings read as part of the same city, plus a few earthy Kaduna tones.
const PALETTE = [0xf1e6cf, 0xe8d3b0, 0xd9a273, 0xf4f1ea, 0xcfe0c5, 0xe9c9a4, 0xf0d8c8, 0xc7d9e6, 0xe2b98f, 0xd9c9a8, 0xc9b295, 0xe6d8c2];
const ZINC = [0xa8483a, 0x8c9399, 0x7a4a32, 0xb5603f, 0x9aa3a8];

// ---- geometry helpers (attributes must match mergeGeometries pools) ----
function paintPat(g, hex, code) {
  const c = new THREE.Color(hex), n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aPat", new THREE.BufferAttribute(new Float32Array(n).fill(code), 1));
  return g;
}

// Gable zinc roof: triangular prism, ridge along the local X axis, eaves at y=0.
function gableGeo(w, d, gh, hex) {
  const r = (d + 0.8) / Math.sqrt(3);
  const g = new THREE.CylinderGeometry(r, r, w + 0.6, 3, 1, false, Math.PI / 2);
  g.rotateZ(Math.PI / 2);                       // axis → X, one vertex up
  const s = gh / (1.5 * r);
  g.scale(1, s, 1);
  g.translate(0, 0.5 * r * s, 0);               // eaves to y=0, ridge at gh
  return paintPat(g, hex, 4);
}

// AABB half-extents of an oriented box.
function boxHalfExtents(w, d, ry) {
  const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
  return [c * w / 2 + s * d / 2, s * w / 2 + c * d / 2];
}

// ---- main entry ----
let _done = false;

export async function initOsmCity(world) {
  if (_done || !OSM_CITY.enabled) return null;
  _done = true;
  try {
    const res = await fetch(OSM_CITY.dataUrl, { cache: "force-cache" });
    if (!res.ok) throw new Error("data HTTP " + res.status);
    const data = await res.json();
    if (!Array.isArray(data.buildings) || !data.buildings.length) throw new Error("no buildings in data");
    addPlaceEntranceZones(listPlaces);            // registry is loaded by now
    const stats = buildOsmCity(world, data);
    console.log(`[osmCity] +${stats.buildings} real-Kaduna buildings in ${stats.chunks} chunks ` +
      `(${stats.rejected} dropped by protected zones, ${stats.props} rooftop props, ${stats.roadPieces} side-road pieces)`);
    return stats;
  } catch (e) {
    console.warn("[osmCity] not added this session (" + (e && e.message) + ") — city unchanged");
    return null;
  }
}

function buildOsmCity(world, data) {
  const R = rng(20261025);
  const group = new THREE.Group();
  group.name = "osm_city";
  world.world.add(group);                        // hides with the city on place enter

  const B = OSM_CITY.bounds;
  const stats = { buildings: 0, rejected: 0, chunks: 0, props: 0, roadPieces: 0 };

  // ---- 1. Filter: drop anything that touches a protected zone or the bounds ----
  const kept = [];
  const dropBy = {};                             // zone tag -> count (boot-log diagnostics)
  for (const b of data.buildings) {
    const [x, z, w, d, ry] = b;
    if (x < B.minX || x > B.maxX || z < B.minZ || z > B.maxZ) { dropBy.out_of_bounds = (dropBy.out_of_bounds || 0) + 1; continue; }
    const [hw, hd] = boxHalfExtents(w, d, ry);
    const margin = 1.4;                          // breathing room around walls
    const hit = hitsProtectedZone(x - hw - margin, z - hd - margin, x + hw + margin, z + hd + margin);
    if (hit) { dropBy[hit] = (dropBy[hit] || 0) + 1; stats.rejected++; continue; }
    kept.push(b);
  }
  // Oct 25: only keep buildings that belong to a real neighbourhood (>= 8 other buildings within 45 m).
  // Lone roofs scattered in empty fields looked like floating houses, so they are dropped.
  { const near2 = 45 * 45, all = kept.slice();
    for (let i = kept.length - 1; i >= 0; i--) {
      let n = 0; const a = kept[i];
      for (const o of all) { if (o !== a && (o[0] - a[0]) ** 2 + (o[1] - a[1]) ** 2 < near2 && ++n >= 8) break; }
      if (n < 8) { kept.splice(i, 1); dropBy.lone = (dropBy.lone || 0) + 1; }
    } }
  const topDrops = Object.entries(dropBy).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([t, n]) => t + ":" + n).join(", ");
  console.log("[osmCity] drops by zone → " + topDrops);
  // Safety cap: keep the ones closest to the city centre.
  if (kept.length > OSM_CITY.maxBuildings) {
    kept.sort((a, b) => (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]));
    kept.length = OSM_CITY.maxBuildings;
  }

  window.__osmKept = kept.map((b) => [Math.round(b[0]), Math.round(b[1])]);   // debug: where the neighbourhoods are
  // ---- 2. Generate: per-chunk merged geometry (walls share the window material) ----
  const cell = OSM_CITY.chunkSize;
  const chunks = new Map();                      // "cx,cz" -> { wallGeos: [], detGeos: [] }
  const tanks = [], acs = [];
  for (const [x, z, w, d, ry, h, kind, gable] of kept) {
    const color = new THREE.Color(PALETTE[Math.floor(R() * PALETTE.length)]);
    const zinc = ZINC[Math.floor(R() * ZINC.length)];
    const light = color.clone().lerp(new THREE.Color(0xffffff), 0.35).getHex();
    const base = color.clone().multiplyScalar(0.78).getHex();
    const rot = (g) => { if (ry) g.rotateY(ry); g.translate(x, 0, z); return g; };
    const list = chunks.get(((x / cell) | 0) + "," + ((z / cell) | 0)) || { wallGeos: [], detGeos: [] };
    chunks.set(((x / cell) | 0) + "," + ((z / cell) | 0), list);

    // paved compound apron around the house, so neighbourhoods read as plots, not floating roofs
    list.detGeos.push(rot(part(w + 2.6, 0.06, d + 2.6, 0, 0.03, 0, 0xcdbb94, 9)));
    // walls with the tiled window picture (same pipeline as the street rows)
    list.wallGeos.push(rot(windowBox(w, h, d, color)));
    // stone plinth
    list.detGeos.push(rot(part(w + 0.5, 0.7, d + 0.5, 0, 0.35, 0, base, 5)));
    if (gable) {
      // zinc gable: eaves at the wall top, ridge above
      const g = gableGeo(w, d, 1.2 + R() * 0.8, zinc);
      g.translate(0, h, 0);
      list.detGeos.push(rot(g));
    } else {
      // parapet + cornice + (sometimes) a zinc roof sheet
      list.wallGeos.push(rot(windowBox(w + 0.3, 0.5, d + 0.3, new THREE.Color(0xb5a68b)).translate(0, h + 0.25, 0)));
      list.detGeos.push(rot(part(w + 0.9, 0.3, d + 0.9, 0, h - 0.15, 0, light, 9)));
      if (R() < 0.55) list.detGeos.push(rot(part(w + 0.7, 0.3, d + 0.7, 0, h + 0.55, 0, zinc, 4)));
      // rooftop props on flat roofs
      if (w * d > 70 && h > 4) {
        if (R() < 0.5) tanks.push([x + (R() - 0.5) * w * 0.5, h + 0.9, z + (R() - 0.5) * d * 0.5]);
        else if (R() < 0.5) acs.push([x + (R() - 0.5) * w * 0.4, h + 0.65, z + (R() - 0.5) * d * 0.4]);
      }
    }
    // collider (AABB of the oriented box) — new buildings are solid
    const [hw, hd] = boxHalfExtents(w, d, ry);
    world.colliders.push({ minX: x - hw - 0.2, maxX: x + hw + 0.2, minZ: z - hd - 0.2, maxZ: z + hd + 0.2 });
    stats.buildings++;
  }

  // ---- 3. Merge chunks → few meshes with tight bounds (three.js frustum-culls each) ----
  const wallMat = addWindowGlow(OL({ map: windowTexture(), vertexColors: true }));
  const detMat = OL({ vertexColors: true });
  for (const { wallGeos, detGeos } of chunks.values()) {
    if (wallGeos.length) {
      const m = new THREE.Mesh(mergeGeometries(wallGeos), wallMat);
      m.receiveShadow = true; m.castShadow = false;
      group.add(m);
    }
    if (detGeos.length) {
      const m = new THREE.Mesh(mergeGeometries(detGeos), detMat);
      m.receiveShadow = true; m.castShadow = false;
      group.add(m);
    }
  }
  stats.chunks = chunks.size;

  // ---- 4. Rooftop props (instanced + chunk-culled, same as the street trees) ----
  if (tanks.length) {
    const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.75, 0.75, 1.2, 8).translate(0, 0.6, 0), OL({ color: 0xffffff }), tanks.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
    tanks.forEach(([x, y, z], i) => { m4.compose(new THREE.Vector3(x, y, z), q, sc); im.setMatrixAt(i, m4); im.setColorAt(i, new THREE.Color(R() < 0.7 ? 0x4a90d9 : 0xe8e8e8)); });
    im.castShadow = false; im.receiveShadow = true;
    group.add(im); registerCullChunks(im, { chunkSize: 48, maxDist: 280 });
    stats.props += tanks.length;
  }
  if (acs.length) {
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1.0, 0.55, 0.7).translate(0, 0.28, 0), OL({ color: 0x8a8f96 }), acs.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
    acs.forEach(([x, y, z], i) => { m4.compose(new THREE.Vector3(x, y, z), q, sc); im.setMatrixAt(i, m4); });
    im.castShadow = false; im.receiveShadow = true;
    group.add(im); registerCullChunks(im, { chunkSize: 48, maxDist: 280 });
    stats.props += acs.length;
  }

  // ---- 5. Real side streets in the open fields (visual-only, no gameplay) ----
  stats.roadPieces = buildSideRoads(group, data);

  // ---- 6. Avenue sidewalks + kerbs + trees + lamps (better roads, Phase 3) ----
  buildAvenueDressing(group, world);

  return stats;
}

// Visual-only side streets: real OSM roads rendered ONLY in the open fields
// (outside the main-street band and away from avenues/cross streets/districts).
// They never carry traffic or gameplay — pure city feel.
function buildSideRoads(group, data) {
  if (!Array.isArray(data.roads) || !data.roads.length) return 0;
  const geos = [];
  const nearCorridor = (x, z, pad) => {
    for (const ax of WIDE_AVENUES_X) if (Math.abs(x - ax) < 11 + pad) return true;
    for (const cz of WIDE_CROSS_Z) if (Math.abs(z - cz) < 11 + pad) return true;
    if (Math.abs(z) < 20 + pad) return true;     // main road band
    return false;
  };
  for (const road of data.roads) {
    const w = Math.min(road.w || 5.5, 8);
    if (road.t === "primary" || road.t === "trunk") continue; // big roads stay the game's own
    const pts = road.pts;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 6 || len > 160) continue;        // skip slivers + long expressway bits
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      if (Math.abs(mx) > 470 || Math.abs(mz) > 340) continue;
      if (nearCorridor(ax, az, w) || nearCorridor(bx, bz, w)) continue;
      // keep out of district yards, place fronts, landing points etc.
      if (hitsProtectedZone(Math.min(ax, bx) - w, Math.min(az, bz) - w, Math.max(ax, bx) + w, Math.max(az, bz) + w)) continue;
      const g = new THREE.PlaneGeometry(len, w);
      g.rotateX(-Math.PI / 2);
      g.rotateY(-Math.atan2(bz - az, bx - ax));
      g.translate(mx, 0.011, mz);
      geos.push(withPat(g, 13));
    }
  }
  if (!geos.length) return 0;
  const mat = stylize(new THREE.MeshLambertMaterial({ color: 0x7d8085, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), { pat: true, ao: false, fake: false });
  const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
  mesh.receiveShadow = true;
  group.add(mesh);
  return geos.length;
}

// Sidewalks + kerbs + neem trees + lamp posts along the four avenues — the
// existing avenues are bare asphalt strips; this makes them feel like real
// Kaduna streets without touching any gameplay road logic.
function buildAvenueDressing(group, world) {
  const paveGeos = [], kerbGeos = [];
  const treePts = [], lampPts = [];
  const zFrom = 20, zTo = MAP_HALF_Z - 20;
  const nearCross = (z) => WIDE_CROSS_Z.some((cz) => Math.abs(z - cz) < 16);
  for (const ax of WIDE_AVENUES_X) {
    for (const side of [1, -1]) {
      // pavement in pieces that skip the cross-street junctions
      let z = zFrom;
      while (z < zTo) {
        if (nearCross(z)) { z += 4; continue; }
        let zEnd = z + 12;
        while (zEnd < zTo && !nearCross(zEnd)) zEnd += 12;
        const len = Math.min(zEnd, zTo) - z;
        if (len > 4) {
          const g = new THREE.BoxGeometry(6, 0.16, len);
          g.translate(ax + side * 8, 0.08, z + len / 2);
          paveGeos.push(withPat(g, 1));
          const k = new THREE.BoxGeometry(0.3, 0.22, len);
          k.translate(ax + side * 5.2, 0.11, z + len / 2);
          kerbGeos.push(k);
        }
        z = zEnd;
      }
      // trees + lamps along both pavements
      for (let tz = zFrom + 8; tz < zTo; tz += 22) {
        if (nearCross(tz)) continue;
        treePts.push([ax + side * 8.6, tz]);
      }
      for (let lz = zFrom + 12; lz < zTo; lz += 26) {
        if (nearCross(lz)) continue;
        lampPts.push([ax + side * 6.4, lz]);
      }
    }
  }
  if (paveGeos.length) {
    const pm = OL({ color: 0xd2bf9c });
    const m = new THREE.Mesh(mergeGeometries(paveGeos), pm);
    m.receiveShadow = true;
    group.add(m);
  }
  if (kerbGeos.length) {
    const km = OL({ color: 0xaaa49a });
    const m = new THREE.Mesh(mergeGeometries(kerbGeos), km);
    group.add(m);
  }
  // trees (instanced, chunk-culled — same shapes as the street trees)
  if (treePts.length) {
    const tm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.7, 1, 1, 6).translate(0, 0.5, 0), OL({ color: 0x7a5a3a }), treePts.length);
    const cm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), OL({ color: 0xffffff }), treePts.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    treePts.forEach(([x, z], i) => {
      m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(0.24, 2.6, 0.24)); tm.setMatrixAt(i, m4);
      const s = 2.2 + Math.random() * 0.6;
      m4.compose(new THREE.Vector3(x, 3.4, z), q, new THREE.Vector3(s, s * 0.8, s)); cm.setMatrixAt(i, m4);
      cm.setColorAt(i, new THREE.Color(Math.random() < 0.5 ? 0x3d8c3a : 0x4f9c43));
    });
    tm.castShadow = false; cm.castShadow = false;
    group.add(tm, cm);
    registerCullChunks(tm, { chunkSize: 48, maxDist: 280 });
    registerCullChunks(cm, { chunkSize: 48, maxDist: 280 });
  }
  // lamps (visible poles + heads; the night light pool follows the player and
  // now also finds these because we append to world.lampPositions)
  if (lampPts.length) {
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.1, 6.2, 6).translate(0, 3.1, 0), OL({ color: 0x4a4f55 }), lampPts.length);
    const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.18, 0.45).translate(-0.6, 0, 0), new THREE.MeshStandardMaterial({ color: 0xfff0b0, emissive: 0xffd070, emissiveIntensity: 0.6 }), lampPts.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    lampPts.forEach(([x, z], i) => {
      m4.makeTranslation(x, 0, z); poles.setMatrixAt(i, m4);
      m4.makeTranslation(x, 6.2, z); heads.setMatrixAt(i, m4);
    });
    group.add(poles, heads);
    registerCullChunks(poles, { chunkSize: 40, maxDist: 260 });
    registerCullChunks(heads, { chunkSize: 40, maxDist: 260 });
    if (Array.isArray(world.lampPositions)) world.lampPositions.push(...lampPts);
  }
}
