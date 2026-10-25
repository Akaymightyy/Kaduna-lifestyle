// src/world/cityFill.js — OUR OWN city filler: procedural Kaduna-style
// buildings (zinc roofs, walled compounds, shop rows) generated on boot.
//
// WHY THIS EXISTS (Oct 25, Claude advice #3): the real-map (OSM) layer
// dropped most footprints because real Kaduna map data no match the game's
// own roads, and the survivors looked scattered. This module fills the city
// with OUR OWN buildings instead — laid out ON PURPOSE:
//   • shop rows + houses lining both sides of every avenue
//   • shop rows + houses fronting the cross streets
//   • walled family compounds (gate + zinc-roof houses + yard) arranged
//     along dirt lanes in the open fields — how Kaduna neighborhoods read
//   • avenue sidewalks, neem trees + lamp posts (moved here from osmCity so
//     turning the real-map layer off does not strip the avenues bare)
//
// SAFETY CONTRACT (same as osmCity.js — see OSM-CITY-README.md):
//   1. ADDITIVE ONLY. Nothing existing is moved, removed or re-rendered.
//      New meshes go into their own group (world.world child) that hides
//      together with the city when you enter a place.
//   2. EVERY footprint (building, compound wall, dirt-lane segment) is
//      tested against protectedZones.js — anything that would overlap an
//      existing building, road, district, place entrance, landing point or
//      landmark is DROPPED. Central Mosque, market stalls, petrol station,
//      keke park, all place gates, all 14 district plot grids: untouchable.
//   3. REVERSIBLE: set CITY_FILL.enabled = false in config.js and the game
//      boots exactly like before.
//   4. FAIL-SAFE: any error here is caught and logged; the game continues
//      with the unchanged procedural city.
//
// PERFORMANCE: buildings merge into 180m chunks (2 draw calls per chunk),
// rooftop tanks/AC units + trees are InstancedMeshes registered with
// registerCullChunks() (the project's own slop-style chunk culling), and
// heights stay low (1–3 storeys) like real Kaduna. No OSM data, no fetch.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CITY_FILL, WIDE_AVENUES_X, WIDE_CROSS_Z, MAP_HALF_X, MAP_HALF_Z, rng } from "../config.js";
import { stylize } from "../art/style.js";
import { registerCullChunks } from "../scene_culling.js";
import { hitsProtectedZone, addPlaceEntranceZones } from "./protectedZones.js";
import { windowTexture, windowBox, withPat, part, addWindowGlow } from "../world.js";
import { listPlaces } from "../places/registry.js";

const OL = (o) => stylize(new THREE.MeshLambertMaterial(o), { pat: true, ao: true, fake: false });

// Same wall palette as world.js / osmCity.js so the new buildings read as
// part of the same city, plus earthy Kaduna compound-wall tones.
const PALETTE = [0xf1e6cf, 0xe8d3b0, 0xd9a273, 0xf4f1ea, 0xcfe0c5, 0xe9c9a4, 0xf0d8c8, 0xc7d9e6, 0xe2b98f, 0xd9c9a8, 0xc9b295, 0xe6d8c2];
const ZINC = [0xa8483a, 0x8c9399, 0x7a4a32, 0xb5603f, 0x9aa3a8];
const WALL_EARTH = [0xcbb98e, 0xd8c9a3, 0xc2ad83, 0xd9c8a8, 0xbfa47a];

function paintPat(g, hex, code) {
  const c = new THREE.Color(hex), n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aPat", new THREE.BufferAttribute(new Float32Array(n).fill(code), 1));
  return g;
}

// Zinc gable roof: triangular prism, ridge along the local X axis, eaves at
// y=0 (drop it on top of a wall with .translate(x, h, z)). Same recipe as
// osmCity.js — proven shape, matches the existing street-row roofs.
function gableGeo(w, d, gh, hex, ridgeZ) {
  const r = (d + 0.8) / Math.sqrt(3);
  const g = new THREE.CylinderGeometry(r, r, w + 0.6, 3, 1, false, Math.PI / 2);
  g.rotateZ(Math.PI / 2);                       // axis → X, one vertex up
  const s = gh / (1.5 * r);
  g.scale(1, s, 1);
  g.translate(0, 0.5 * r * s, 0);               // eaves to y=0, ridge at gh
  if (ridgeZ) g.rotateY(Math.PI / 2);           // ridge along Z instead
  return paintPat(g, hex, 4);
}

let _done = false;

export async function initCityFill(world) {
  if (_done || !CITY_FILL.enabled) return null;
  _done = true;
  try {
    addPlaceEntranceZones(listPlaces);          // idempotent — safe with osmCity off
    const stats = buildCityFill(world);
    console.log(`[cityFill] +${stats.buildings} Kaduna-style buildings ` +
      `(${stats.compounds} walled compounds, ${stats.shops} shops) in ${stats.chunks} chunks ` +
      `— ${stats.rejected} footprints dropped by protected zones`);
    return stats;
  } catch (e) {
    console.warn("[cityFill] skipped this session (" + (e && e.message) + ") — city unchanged");
    return null;
  }
}

function buildCityFill(world) {
  const R = rng(CITY_FILL.seed);
  const group = new THREE.Group();
  group.name = "city_fill";
  world.world.add(group);                       // hides with the city on place enter

  const stats = { buildings: 0, compounds: 0, shops: 0, rejected: 0, chunks: 0, props: 0 };
  const cell = CITY_FILL.chunkSize;
  const chunks = new Map();                     // "cx,cz" -> { wallGeos, detGeos }
  const tanks = [], acs = [], treePts = [];
  const laneGeos = [];

  const chunkFor = (x, z) => {
    const key = ((x / cell) | 0) + "," + ((z / cell) | 0);
    let list = chunks.get(key);
    if (!list) { list = { wallGeos: [], detGeos: [] }; chunks.set(key, list); }
    return list;
  };

  // ---- ONE building (axis-aligned, w = X extent, d = Z extent) ----
  // walls carry the tiled window texture, roof = zinc gable OR flat with
  // parapet (+ sometimes a zinc sheet), stone plinth, paved apron, collider.
  function addBuilding(cx, cz, w, d, h, { gable, ridgeZ, noApron, shop } = {}) {
    if (stats.buildings >= CITY_FILL.maxBuildings) { stats.rejected++; return false; }
    const m = 1.4;                              // breathing room around walls
    if (hitsProtectedZone(cx - w / 2 - m, cz - d / 2 - m, cx + w / 2 + m, cz + d / 2 + m)) { stats.rejected++; return false; }
    const color = new THREE.Color(PALETTE[(R() * PALETTE.length) | 0]);
    const zinc = ZINC[(R() * ZINC.length) | 0];
    const light = color.clone().lerp(new THREE.Color(0xffffff), 0.35).getHex();
    const base = color.clone().multiplyScalar(0.72).getHex();
    const list = chunkFor(cx, cz);
    if (!noApron) list.detGeos.push(part(w + 2.4, 0.06, d + 2.4, cx, 0.03, cz, 0xcdbb94, 9));
    list.wallGeos.push(windowBox(w, h, d, color).translate(cx, h / 2, cz));   // 0..h (centered box lifted by h/2)
    list.detGeos.push(part(w + 0.5, 0.55, d + 0.5, cx, 0.27, cz, base, 5));   // stone plinth
    let hasZincSheet = false;
    if (gable) {
      const g = gableGeo(w, d, 1.1 + R() * 0.9, zinc, ridgeZ);
      list.detGeos.push(g.translate(cx, h, cz));                              // eaves on the wall top
    } else {
      list.wallGeos.push(windowBox(w + 0.3, 0.5, d + 0.3, new THREE.Color(0xb5a68b)).translate(cx, h + 0.25, cz)); // parapet
      list.detGeos.push(part(w + 0.9, 0.3, d + 0.9, cx, h - 0.15, cz, light, 9));                                  // cornice
      if (R() < 0.62) { list.detGeos.push(part(w + 0.7, 0.28, d + 0.7, cx, h + 0.52, cz, zinc, 4)); hasZincSheet = true; }
      // rooftop props sit ON the roof deck (base at y=h, geometry is base-origin)
      if (w * d > 55) {
        if (R() < 0.55) tanks.push([cx + (R() - 0.5) * 1.4, h + 0.03, cz + (R() - 0.5) * 1.4]);
        else if (R() < 0.45) acs.push([cx + (R() - 0.5) * 1.2, h + (hasZincSheet ? 0.74 : 0.03), cz + (R() - 0.5) * 1.2]);
      }
    }
    world.colliders.push({ minX: cx - w / 2 - 0.2, maxX: cx + w / 2 + 0.2, minZ: cz - d / 2 - 0.2, maxZ: cz + d / 2 + 0.2 });
    stats.buildings++;
    if (shop) stats.shops++;
    return true;
  }

  // ---- ONE walled compound: low wall + gate gap + 1–3 zinc-roof houses ----
  // gateSide: 0 = north (-z), 1 = south (+z), 2 = west (-x), 3 = east (+x)
  function addCompound(cx, cz, w, d, gateSide) {
    if (stats.compounds >= CITY_FILL.maxCompounds || stats.buildings >= CITY_FILL.maxBuildings) { stats.rejected++; return false; }
    const m = 1.6;
    if (hitsProtectedZone(cx - w / 2 - m, cz - d / 2 - m, cx + w / 2 + m, cz + d / 2 + m)) { stats.rejected++; return false; }
    const list = chunkFor(cx, cz);
    const wallH = 2.0, th = 0.24, GATE = 3.6;
    const wallCol = WALL_EARTH[(R() * WALL_EARTH.length) | 0];
    // dirt yard inside
    list.detGeos.push(part(w - 0.7, 0.05, d - 0.7, cx, 0.028, cz, 0xc2ae85, 9));
    // wall helpers: each segment = visual box + AABB collider
    const wallSeg = (sx, sz, sw, sd) => {
      list.detGeos.push(part(sw, wallH, sd, sx, wallH / 2, sz, wallCol, 3));
      world.colliders.push({ minX: sx - sw / 2, maxX: sx + sw / 2, minZ: sz - sd / 2 - 0.1, maxZ: sz + sd / 2 + 0.1 });
    };
    const alongX = gateSide === 0 || gateSide === 1;
    const segLen = (alongX ? w : d) - GATE;
    // north + south walls (along X)
    if (gateSide === 0) { wallSeg(cx - (w + GATE) / 4 + th, cz - d / 2, segLen / 2, th); wallSeg(cx + (w + GATE) / 4 - th, cz - d / 2, segLen / 2, th); }
    else wallSeg(cx, cz - d / 2, w + th, th);
    if (gateSide === 1) { wallSeg(cx - (w + GATE) / 4 + th, cz + d / 2, segLen / 2, th); wallSeg(cx + (w + GATE) / 4 - th, cz + d / 2, segLen / 2, th); }
    else wallSeg(cx, cz + d / 2, w + th, th);
    // west + east walls (along Z)
    if (gateSide === 2) { wallSeg(cx - w / 2, cz - (d + GATE) / 4 + th, th, segLen / 2); wallSeg(cx - w / 2, cz + (d + GATE) / 4 - th, th, segLen / 2); }
    else wallSeg(cx - w / 2, cz, th, d + th);
    if (gateSide === 3) { wallSeg(cx + w / 2, cz - (d + GATE) / 4 + th, th, segLen / 2); wallSeg(cx + w / 2, cz + (d + GATE) / 4 - th, th, segLen / 2); }
    else wallSeg(cx + w / 2, cz, th, d + th);
    // 1–3 zinc-roof houses in a row at the BACK (away from the gate), yard open at the front
    const backSign = gateSide === 1 ? -1 : 1;                        // gate south → houses north
    const rowAlongX = gateSide === 0 || gateSide === 1;
    const nH = 1 + (R() < 0.65 ? 1 : 0) + (R() < 0.3 ? 1 : 0);
    const rowC = rowAlongX
      ? cz + backSign * (d / 2 - 3.4)
      : cx + backSign * (w / 2 - 3.4);
    let cursor = (rowAlongX ? cx : cz) - (nH * 7.5) / 2 + 2;
    for (let i = 0; i < nH; i++) {
      const hw = 5.5 + R() * 2.5, hd = 4.5 + R() * 2.0, hh = 2.9 + R() * 0.5;
      if (rowAlongX) addBuilding(cursor + hw / 2, rowC, hw, hd, hh, { gable: true, noApron: true });
      else addBuilding(rowC, cursor + hw / 2, hd, hw, hh, { gable: true, ridgeZ: true, noApron: true });
      cursor += 7.5 + 1.1;
    }
    if (R() < 0.55) treePts.push([cx + (R() - 0.5) * (w - 6), 0, cz + (R() - 0.5) * (d - 6)]);
    stats.compounds++;
    return true;
  }

  // ---- 1. Avenue frontage: shops + houses lining both sides of the 4 avenues ----
  function makeSpec(far) {
    const r = R();
    let type;
    if (far < 130) type = r < 0.72 ? "shop" : "block";                       // near main road = commercial
    else if (far < 240) type = r < 0.35 ? "shop" : (r < 0.75 ? "house" : "house2");
    else type = r < 0.55 ? "house" : (r < 0.85 ? "house2" : "block");
    if (type === "shop") return { w: 7 + R() * 7, d: 6 + R() * 1.5, h: R() < 0.15 ? 6.3 : 3.4, shop: true };
    if (type === "house") return { w: 7 + R() * 4, d: 6 + R() * 3, h: 3.0 + R() * 0.6, gable: true };
    if (type === "house2") return { w: 9 + R() * 4, d: 7 + R() * 2, h: 6.2 + R() * 0.8, gable: R() < 0.3 };
    return { w: 13 + R() * 6, d: 7.5 + R(), h: 9.0 + R() * 0.7 };            // tenant block, 3 floors
  }
  function avenueFrontage() {
    for (const ax of WIDE_AVENUES_X) {
      for (const side of [1, -1]) {
        let z = -MAP_HALF_Z + 40;
        while (z < MAP_HALF_Z - 40 && stats.buildings < CITY_FILL.maxBuildings) {
          if (WIDE_CROSS_Z.some((cz) => Math.abs(z - cz) < 16)) { z += 6; continue; }
          const spec = makeSpec(Math.abs(z));
          const cx = ax + side * (11 + 2.6 + spec.d / 2 + R() * 1.2);
          const cz = z + spec.w / 2;
          addBuilding(cx, cz, spec.d, spec.w, spec.h, spec);                 // width runs ALONG the avenue (Z)
          z += spec.w + (spec.shop ? 0.35 : 1.6 + R() * 2.4);
        }
      }
    }
  }

  // ---- 2. Cross-street frontage: same idea along the 4 E-W streets ----
  function crossFrontage() {
    for (const czz of WIDE_CROSS_Z) {
      for (const side of [1, -1]) {
        let x = -MAP_HALF_X + 60;
        while (x < MAP_HALF_X - 60 && stats.buildings < CITY_FILL.maxBuildings) {
          if (WIDE_AVENUES_X.some((ax) => Math.abs(x - ax) < 16)) { x += 6; continue; }
          const spec = makeSpec(Math.abs(czz));
          const cz = czz + side * (11 + 2.6 + spec.d / 2 + R() * 1.2);
          const cx = x + spec.w / 2;
          addBuilding(cx, cz, spec.w, spec.d, spec.h, spec);                 // width runs ALONG the street (X)
          x += spec.w + (spec.shop ? 0.35 : 1.6 + R() * 2.4);
        }
      }
    }
  }

  // ---- 3. Compound lanes: walled compounds along dirt lanes in the fields ----
  function compoundLanes() {
    const laneZs = [-295, -262, -230, -180, -122, -70, 70, 122, 180, 230, 262, 295];
    for (const lz of laneZs) {
      // dirt lane in 24m segments, skipping anything protected
      for (let x = -MAP_HALF_X + 60; x < MAP_HALF_X - 60; x += 24) {
        const len = Math.min(MAP_HALF_X - 60 - x, 24);
        if (hitsProtectedZone(x, lz - 2.4, x + len, lz + 2.4)) continue;
        laneGeos.push(withPat(new THREE.PlaneGeometry(len, 4.6).rotateX(-Math.PI / 2).translate(x + len / 2, 0.012, lz), 13));
      }
      // compounds on both sides of the lane
      for (const sideSign of [-1, 1]) {
        let x = -MAP_HALF_X + 70;
        while (x < MAP_HALF_X - 70 && stats.buildings < CITY_FILL.maxBuildings && stats.compounds < CITY_FILL.maxCompounds) {
          const w = 18 + R() * 8, d = 15 + R() * 7;
          const cz = lz + sideSign * (d / 2 + 3.2);
          const gateSide = sideSign < 0 ? 1 : 0;                             // gate faces the lane
          const added = addCompound(x + w / 2, cz, w, d, gateSide);
          x += w + 5 + R() * 5;
          if (!added && stats.rejected > 0) { /* skipped by a protected zone — next slot */ }
        }
      }
    }
  }

  // ---- 3b. Field probe: fill the pockets BETWEEN districts with compounds ----
  // Jittered grid over the open land — every candidate is still tested against
  // the protected zones, so districts, place fronts and landmarks stay clear.
  function fieldProbe() {
    for (let gx = -MAP_HALF_X + 80; gx < MAP_HALF_X - 80; gx += 78) {
      for (let gz = -MAP_HALF_Z + 60; gz < MAP_HALF_Z - 60; gz += 72) {
        if (stats.compounds >= CITY_FILL.maxCompounds || stats.buildings >= CITY_FILL.maxBuildings) return;
        if (R() < 0.45) continue;                                  // natural gaps
        const w = 17 + R() * 8, d = 14 + R() * 7;
        const cx = gx + (R() - 0.5) * 26 + w / 2;
        const cz = gz + (R() - 0.5) * 24 + d / 2;
        addCompound(cx, cz, w, d, (R() * 4) | 0);                  // random gate side
      }
    }
  }

  // ---- 4. Avenue dressing: sidewalks + kerbs + neem trees + lamp posts ----
  // (moved here from osmCity.js so the avenues stay dressed with the real-map layer off)
  function avenueDressing() {
    const paveGeos = [], kerbGeos = [];
    const lampPts = [];
    const zFrom = 20, zTo = MAP_HALF_Z - 20;
    const nearCross = (z) => WIDE_CROSS_Z.some((cz) => Math.abs(z - cz) < 16);
    for (const ax of WIDE_AVENUES_X) {
      for (const side of [1, -1]) {
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
        for (let tz = zFrom + 8; tz < zTo; tz += 22) {
          if (nearCross(tz)) continue;
          treePts.push([ax + side * 8.6, 0, tz]);
        }
        for (let lz = zFrom + 12; lz < zTo; lz += 26) {
          if (nearCross(lz)) continue;
          lampPts.push([ax + side * 6.4, lz]);
        }
      }
    }
    if (paveGeos.length) { const m = new THREE.Mesh(mergeGeometries(paveGeos), OL({ color: 0xd2bf9c })); m.receiveShadow = true; group.add(m); }
    if (kerbGeos.length) { group.add(new THREE.Mesh(mergeGeometries(kerbGeos), OL({ color: 0xaaa49a }))); }
    if (lampPts.length) {
      const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.1, 6.2, 6).translate(0, 3.1, 0), OL({ color: 0x4a4f55 }), lampPts.length);
      const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.18, 0.45).translate(-0.6, 0, 0), new THREE.MeshStandardMaterial({ color: 0xfff0b0, emissive: 0xffd070, emissiveIntensity: 0.6 }), lampPts.length);
      const m4 = new THREE.Matrix4();
      lampPts.forEach(([x, z], i) => { m4.makeTranslation(x, 0, z); poles.setMatrixAt(i, m4); m4.makeTranslation(x, 6.2, z); heads.setMatrixAt(i, m4); });
      group.add(poles, heads);
      registerCullChunks(poles, { chunkSize: 40, maxDist: 260 });
      registerCullChunks(heads, { chunkSize: 40, maxDist: 260 });
      if (Array.isArray(world.lampPositions)) world.lampPositions.push(...lampPts);
    }
  }

  // ---- run the generator (order matters: frontage first claims the best spots) ----
  avenueFrontage();
  crossFrontage();
  compoundLanes();
  fieldProbe();
  avenueDressing();

  // ---- merge chunks → few meshes with tight bounds (three.js frustum-culls each) ----
  const wallMat = addWindowGlow(OL({ map: windowTexture(), vertexColors: true }));
  const detMat = OL({ vertexColors: true });
  for (const { wallGeos, detGeos } of chunks.values()) {
    if (wallGeos.length) { const m = new THREE.Mesh(mergeGeometries(wallGeos), wallMat); m.receiveShadow = true; m.castShadow = false; group.add(m); }
    if (detGeos.length) { const m = new THREE.Mesh(mergeGeometries(detGeos), detMat); m.receiveShadow = true; m.castShadow = false; group.add(m); }
  }
  stats.chunks = chunks.size;

  // ---- dirt lanes (one merged mesh, visual-only, no gameplay) ----
  if (laneGeos.length) {
    const mat = stylize(new THREE.MeshLambertMaterial({ color: 0xb59f78, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), { pat: true, ao: false, fake: false });
    const m = new THREE.Mesh(mergeGeometries(laneGeos), mat);
    m.receiveShadow = true;
    group.add(m);
  }

  // ---- rooftop props (instanced + chunk-culled) ----
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
  if (treePts.length) {
    const tm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.7, 1, 1, 6).translate(0, 0.5, 0), OL({ color: 0x7a5a3a }), treePts.length);
    const cm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), OL({ color: 0xffffff }), treePts.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    treePts.forEach(([x, , z], i) => {
      m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(0.24, 2.6, 0.24)); tm.setMatrixAt(i, m4);
      const s = 2.2 + R() * 0.6;
      m4.compose(new THREE.Vector3(x, 3.4, z), q, new THREE.Vector3(s, s * 0.8, s)); cm.setMatrixAt(i, m4);
      cm.setColorAt(i, new THREE.Color(R() < 0.5 ? 0x3d8c3a : 0x4f9c43));
    });
    tm.castShadow = false; cm.castShadow = false;
    group.add(tm, cm);
    registerCullChunks(tm, { chunkSize: 48, maxDist: 280 });
    registerCullChunks(cm, { chunkSize: 48, maxDist: 280 });
    stats.props += treePts.length;
  }

  return stats;
}
