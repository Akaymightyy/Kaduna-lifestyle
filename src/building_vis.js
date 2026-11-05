// src/building_vis.js — the CONSTRUCTION SITE visuals (Phase 1 house building).
//
// Every site is a tiny THREE.Group whose parts come from CACHED merged geometries,
// so two sites of the same type share every vertex buffer. Per frame we only touch
// transforms (scale/position/visibility) — no geometry rebuilds, no per-frame
// allocations. A finished site is at most ~9 draw calls, and only sites within
// ~160 m of the player are visible at all (weak-phone friendly).
//
// What you see per stage:
//   land   : sand pad, orange pegs, low fence ring, signboard with the owner's name
//   1 Found: foundation slab growing out of the ground + sand pile + cement + blocks
//   2 Walls: block walls rising storey by storey (scaffold poles while active)
//   3 Roof : timber trusses rise, then red-zinc sheets close the top
//   4 Fin. : plaster-coloured walls, door + windows pop in, paint job
//   done   : the site removes itself — areas_world renders the real house record.
//
// 2-4 low-poly workers (vest + helmet colours) bend/carry on site while a stage is
// ACTIVE (timestamps), and disappear when the stage is idle or done.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { stylize } from "./art/style.js";

// ---- tunables ----
const SITE_RANGE = 160;      // metres — hide the whole site beyond this
const SIGN_RANGE = 70;       // metres — show the signboard sprite within this
const SIGN_UPDATE_EVERY = 1; // seconds between sign text refreshes

// ---- palette (Kaduna Lifestyle's own colours: warm plaster, red zinc, laterite dirt) ----
const COL = {
  dirt: 0xc9b68a, sand: 0xd8c79a, laterite: 0xb0603a,
  slab: 0x8f9298, block: 0xb8b2a6, plaster: 0xf1e6cf,
  wood: 0x8a5a3c, zinc: 0x9b4a35, peg: 0xf2b134,
  door: 0x4a3322, glass: 0xc7d9e6, vest: 0xf2b134, skin: 0x8a5a3c, trouser: 0x2e3138, helmet: 0xf4f1ea,
};

// ---- shared material (ONE program for every site) ----
let _mat = null;
function mat() {
  if (!_mat) {
    _mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    stylize(_mat, { pat: false, ao: true, fake: false });
  }
  return _mat;
}

// ---- geometry helpers ----
function paint(g, hex) {                       // fill every vertex with a colour (town.js-style)
  const n = g.attributes.position.count, c = new Float32Array(n * 3), col = new THREE.Color(hex);
  for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  g.setAttribute("color", new THREE.BufferAttribute(c, 1));
  return g;
}
function box(w, h, d, x, y, z, hex) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return paint(g, hex);
}
function cone(r, h, x, y, z, hex, seg = 7) {
  const g = new THREE.ConeGeometry(r, h, seg);
  g.translate(x, y, z);
  return paint(g, hex);
}
function cyl(r, h, x, y, z, hex, seg = 6) {
  const g = new THREE.CylinderGeometry(r, r, h, seg);
  g.translate(x, y, z);
  return paint(g, hex);
}

// ---- dimensions per house type ----
const DIMS = {
  bungalow: { w: 6.2, d: 5.0, wallH: 2.8, roofH: 1.4 },
  duplex:   { w: 6.2, d: 5.0, wallH: 5.2, roofH: 1.5 },
  mansion:  { w: 6.6, d: 5.4, wallH: 5.8, roofH: 1.7 },
};
function dimsOf(type) { return DIMS[type] || DIMS.bungalow; }

// ---- cached geometry sets ----
const _geoCache = new Map();   // key -> { slab, walls, wallsPainted, roofFrame, roofSheet, finish, staticLand, staticFence, blocks, cement, sand, worker }
function geoFor(key, maker) {
  if (!_geoCache.has(key)) _geoCache.set(key, maker());
  return _geoCache.get(key);
}

function slabGeo(type) {
  const d = dimsOf(type);
  const parts = [box(d.w, 0.3, d.d, 0, 0.15, 0, COL.slab)];
  // a small step at the front
  parts.push(box(1.6, 0.18, 0.5, 0, 0.09, d.d / 2 + 0.25, 0x9a9da3));
  return mergeGeometries(parts, false);
}
function wallsGeo(type, painted) {
  const d = dimsOf(type);
  const t = 0.18, h = d.wallH, col = painted ? COL.plaster : COL.block;
  const w = d.w - 0.3, dd = d.d - 0.3;
  const parts = [
    box(w, h, t, 0, h / 2 + 0.3, -dd / 2 + t / 2, col),   // back
    box(w, h, t, 0, h / 2 + 0.3, dd / 2 - t / 2, col),    // front
    box(t, h, dd, -w / 2 + t / 2, h / 2 + 0.3, 0, col),   // left
    box(t, h, dd, w / 2 - t / 2, h / 2 + 0.3, 0, col),    // right
  ];
  if (painted) {
    // door + windows + a belt course, so the finished shell reads as a real house
    parts.push(box(0.95, 2.05, 0.1, 0.6, 0.3 + 1.02, dd / 2 - t / 2, COL.door));
    parts.push(box(1.1, 0.95, 0.1, -1.4, 0.3 + 1.5, dd / 2 - t / 2, COL.glass));
    parts.push(box(1.1, 0.95, 0.1, 1.9, 0.3 + 1.5, dd / 2 - t / 2, COL.glass));
    parts.push(box(t * 1.2, 0.9, 1.1, -w / 2 + t / 2, 0.3 + 1.5, -0.9, COL.glass));
    parts.push(box(w + 0.12, 0.22, dd + 0.12, 0, h + 0.3, 0, COL.plaster));   // top ring
  }
  return mergeGeometries(parts, false);
}
function roofFrameGeo(type) {
  const d = dimsOf(type);
  const span = d.d + 0.5, half = span / 2;
  const parts = [];
  for (let i = -1; i <= 1; i++) {                          // 3 trusses across the width
    const x = i * (d.w / 2 - 0.4);
    parts.push(box(0.12, d.roofH, 0.12, x, d.wallH + 0.3 + d.roofH / 2, -half / 2, COL.wood));
    parts.push(box(0.12, d.roofH, 0.12, x, d.wallH + 0.3 + d.roofH / 2, half / 2, COL.wood));
  }
  parts.push(box(0.14, 0.14, span, 0, d.wallH + 0.3 + d.roofH, 0, COL.wood));   // ridge beam
  return mergeGeometries(parts, false);
}
function roofSheetGeo(type) {
  const d = dimsOf(type);
  const slopeLen = Math.sqrt(Math.pow(d.d / 2 + 0.5, 2) + Math.pow(d.roofH, 2)) + 0.2;
  const ang = Math.atan2(d.roofH, d.d / 2 + 0.5);
  const back = box(d.w + 0.5, 0.09, slopeLen, 0, 0, 0, COL.zinc);
  back.rotateX(ang); back.translate(0, d.wallH + 0.3 + d.roofH / 2, -(d.d / 2 + 0.5) / 2);
  const front = box(d.w + 0.5, 0.09, slopeLen, 0, 0, 0, COL.zinc);
  front.rotateX(-ang); front.translate(0, d.wallH + 0.3 + d.roofH / 2, (d.d / 2 + 0.5) / 2);
  return mergeGeometries([back, front], false);
}
function finishGeo(type) {
  const d = dimsOf(type);
  const dd = d.d - 0.3;
  const parts = [
    box(0.95, 2.05, 0.12, 0.6, 0.3 + 1.02, dd / 2, COL.door),
    box(1.1, 0.95, 0.12, -1.4, 0.3 + 1.5, dd / 2, COL.glass),
    box(1.1, 0.95, 0.12, 1.9, 0.3 + 1.5, dd / 2, COL.glass),
  ];
  return mergeGeometries(parts, false);
}
// land (no project yet): sand pad + 4 pegs + signboard posts
function landStaticGeo() {
  const parts = [
    box(7.0, 0.05, 7.0, 0, 0.025, 0, COL.sand),
    cyl(0.07, 0.75, -3.2, 0.375, -3.2, COL.peg, 5),
    cyl(0.07, 0.75, 3.2, 0.375, -3.2, COL.peg, 5),
    cyl(0.07, 0.75, -3.2, 0.375, 3.2, COL.peg, 5),
    cyl(0.07, 0.75, 3.2, 0.375, 3.2, COL.peg, 5),
    cyl(0.06, 1.5, -2.4, 0.75, 3.3, COL.wood, 5),          // sign posts
    cyl(0.06, 1.5, -0.9, 0.75, 3.3, COL.wood, 5),
  ];
  return mergeGeometries(parts, false);
}
// site fence ring (while building) — thin low wall, gap at the front
function fenceStaticGeo() {
  const parts = [
    box(6.9, 0.5, 0.1, 0, 0.3, -3.45, COL.block),
    box(0.1, 0.5, 6.9, -3.45, 0.3, 0, COL.block),
    box(0.1, 0.5, 6.9, 3.45, 0.3, 0, COL.block),
    box(2.0, 0.5, 0.1, -2.4, 0.3, 3.45, COL.block),        // front left
    box(2.0, 0.5, 0.1, 2.4, 0.3, 3.45, COL.block),         // front right (gap = entrance)
    box(3.4, 0.05, 3.4, 0, 0.025, 0, COL.dirt),            // dirt work pad
  ];
  return mergeGeometries(parts, false);
}
// materials piles (shrink as stages complete)
function pilesGeo() {
  const parts = [];
  const bx = -2.55, bz = 1.6;                              // block stack
  for (let r = 0; r < 3; r++) for (let c2 = 0; c2 < 3 - r; c2++)
    parts.push(box(0.42, 0.22, 0.24, bx + c2 * 0.46 + r * 0.22, 0.13 + r * 0.24, bz, COL.block));
  const cx = 2.45;                                         // cement bags
  for (let i = 0; i < 3; i++) parts.push(box(0.5, 0.26, 0.34, cx + (i % 2) * 0.08, 0.15 + Math.floor(i / 2) * 0.28, 1.55 + (i % 2) * 0.4, 0xd8cfa8));
  parts.push(cone(0.85, 0.75, 2.45, 0.37, -1.7, COL.sand, 8));   // sand pile
  return mergeGeometries(parts, false);
}
// scaffold poles (visible while walls go up)
function scaffoldGeo(type) {
  const d = dimsOf(type);
  const w = d.w / 2 + 0.35, dd = d.d / 2 + 0.35, h = d.wallH + 0.5;
  const parts = [
    cyl(0.05, h, -w, h / 2, -dd, COL.wood, 5), cyl(0.05, h, w, h / 2, -dd, COL.wood, 5),
    cyl(0.05, h, -w, h / 2, dd, COL.wood, 5), cyl(0.05, h, w, h / 2, dd, COL.wood, 5),
    box(w * 2 + 0.1, 0.08, 0.08, 0, h * 0.55, -dd, COL.wood),
    box(w * 2 + 0.1, 0.08, 0.08, 0, h * 0.55, dd, COL.wood),
  ];
  return mergeGeometries(parts, false);
}
// one low-poly worker (vest + helmet + skin), shared by all workers
function workerGeo() {
  const parts = [
    box(0.4, 0.52, 0.24, 0, 0.86, 0, COL.vest),            // torso
    box(0.24, 0.24, 0.22, 0, 1.26, 0, COL.skin),           // head
    box(0.3, 0.1, 0.28, 0, 1.4, 0, COL.helmet),            // helmet
    box(0.11, 0.44, 0.13, -0.27, 0.92, 0, COL.skin),       // arms
    box(0.11, 0.44, 0.13, 0.27, 0.92, 0, COL.skin),
    box(0.13, 0.5, 0.15, -0.11, 0.25, 0, COL.trouser),     // legs
    box(0.13, 0.5, 0.15, 0.11, 0.25, 0, COL.trouser),
  ];
  return mergeGeometries(parts, false);
}

// ---- state ----
let _scene = null, _cols = null;
let _sites = new Map();        // key -> record
let _signPool = [];            // sprite per site (created with the site)

function _disposeSite(rec) {
  if (rec.collider && _cols) {
    const i = _cols.indexOf(rec.collider);
    if (i >= 0) _cols.splice(i, 1);
  }
  _scene.remove(rec.grp);
  rec.grp.traverse((o) => {
    if (o.isSprite && o.material && o.material.map) { o.material.map.dispose(); o.material.dispose(); }
  });
}

export function initBuildingVis(scene, colliders) {
  _scene = scene;
  _cols = colliders;
  workerGeo();   // warm the cache
}

// called ~1×/s from building.js with every visible site (mine + other players')
export function syncSites(sites) {
  if (!_scene) return;
  const want = new Map();
  for (const s of sites) want.set(s.key, s);
  // remove gone / finalized sites
  for (const [key, rec] of Array.from(_sites)) {
    if (!want.has(key)) { _disposeSite(rec); _sites.delete(key); }
  }
  // create / update
  for (const [key, s] of want) {
    let rec = _sites.get(key);
    if (!rec) { rec = _makeSite(s); _sites.set(key, rec); }
    const stageChanged = rec.stage !== s.stage || rec.typeId !== s.type || rec.started !== s.started;
    rec.data = s;
    rec.stage = s.stage; rec.typeId = s.type; rec.started = s.started;
    if (stageChanged) _layoutSite(rec, s);
  }
}

function _makeSite(s) {
  const grp = new THREE.Group();
  grp.position.set(s.x, 0, s.z);
  grp.rotation.y = s.rot || 0;
  _scene.add(grp);
  const rec = { key: s.key, grp, stage: -1, typeId: null, started: null, data: s, collider: null, sign: null, parts: {} };

  // static land parts (pad + pegs + sign posts) — shared geometry, one draw call
  const land = geoFor("land", landStaticGeo);
  rec.parts.land = new THREE.Mesh(land, mat());
  rec.parts.land.frustumCulled = false;
  grp.add(rec.parts.land);

  // signboard sprite (owner name + stage + countdown)
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 120;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false, transparent: true }));
  sprite.position.set(-1.65, 2.5, 3.3);
  sprite.scale.set(4.6, 2.15, 1);
  sprite.userData = { isBuildSign: true, siteKey: s.key };
  grp.add(sprite);
  rec.sign = { sprite, canvas, ctx: canvas.getContext("2d"), tex: sprite.material.map, text: "" };

  if (_cols) {
    rec.collider = { minX: s.x - 3.4, maxX: s.x + 3.4, minZ: s.z - 3.4, maxZ: s.z + 3.4, _kbSite: s.key };
    _cols.push(rec.collider);
  }
  return rec;
}

// rebuild the stage-dependent parts of a site (called only when stage/type changes)
function _layoutSite(rec, s) {
  const grp = rec.grp, P = rec.parts;
  for (const k of ["fence", "slab", "walls", "wallsPainted", "roofFrame", "roofSheet", "finish", "scaffold", "piles", "workers"]) {
    if (P[k]) { grp.remove(P[k]); P[k] = null; }
  }
  const type = s.type || "bungalow";

  // fence ring appears once a project starts (land keeps just pegs)
  if (s.type) {
    const fence = geoFor("fence", fenceStaticGeo);
    P.fence = new THREE.Mesh(fence, mat());
    P.fence.frustumCulled = false;
    grp.add(P.fence);
  }

  if (s.type && s.stage >= 1) {
    P.slab = new THREE.Mesh(geoFor("slab_" + type, () => slabGeo(type)), mat());
    P.walls = new THREE.Mesh(geoFor("walls_" + type, () => wallsGeo(type, false)), mat());
    P.roofFrame = new THREE.Mesh(geoFor("rframe_" + type, () => roofFrameGeo(type)), mat());
    P.roofSheet = new THREE.Mesh(geoFor("rsheet_" + type, () => roofSheetGeo(type)), mat());
    P.finish = new THREE.Mesh(geoFor("fin_" + type, () => finishGeo(type)), mat());
    P.wallsPainted = new THREE.Mesh(geoFor("wallsP_" + type, () => wallsGeo(type, true)), mat());
    P.scaffold = new THREE.Mesh(geoFor("scaf_" + type, () => scaffoldGeo(type)), mat());
    for (const k of ["slab", "walls", "roofFrame", "roofSheet", "finish", "wallsPainted", "scaffold"]) {
      P[k].frustumCulled = false;
      grp.add(P[k]);
    }
    // piles of blocks / cement / sand
    P.piles = new THREE.Mesh(geoFor("piles", pilesGeo), mat());
    P.piles.frustumCulled = false;
    grp.add(P.piles);
  }

  // workers (2-4) while a stage is actively running
  if (s.type && s.started) {
    const n = Math.min(4, 2 + (s.rooms >= 4 ? 1 : 0) + (type === "mansion" ? 1 : 0));
    const wg = geoFor("worker", workerGeo);
    P.workers = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(wg, mat());
      m.frustumCulled = false;
      m.userData.i = i;
      P.workers.add(m);
    }
    grp.add(P.workers);
  }
}

// ---- per-frame: transforms only ----
let _signT = 0;
const _workPhase = { t: 0 };
export function tickBuildingVis(dt, px, pz) {
  if (!_scene) return;
  _workPhase.t += dt;
  _signT -= dt;
  const doSigns = _signT <= 0;
  if (doSigns) _signT = SIGN_UPDATE_EVERY;

  for (const [key, rec] of _sites) {
    const s = rec.data;
    if (!s) continue;
    const dx = s.x - px, dz = s.z - pz, d2 = dx * dx + dz * dz;
    rec.grp.visible = d2 < SITE_RANGE * SITE_RANGE;
    if (!rec.grp.visible) continue;

    const prog = s.prog || 0;
    const P = rec.parts;
    // foundation grows during stage 1
    if (P.slab) {
      const k = s.stage === 1 ? (0.25 + 0.75 * prog) : 1;
      P.slab.scale.set(k, s.stage === 1 ? (0.3 + 2.3 * prog) : 1, k);
    }
    // walls rise during stage 2
    if (P.walls) {
      const rise = s.stage === 2 ? prog : (s.stage >= 3 ? 1 : 0);
      P.walls.scale.y = Math.max(0.02, rise);
      P.walls.visible = s.stage >= 2 && !(s.stage === 4 && prog > 0.45);
    }
    if (P.wallsPainted) {
      const k = s.stage === 4 ? Math.max(0.02, Math.min(1, (prog - 0.35) / 0.3)) : (s.stage >= 4 ? 1 : 0);
      P.wallsPainted.scale.y = k;
      P.wallsPainted.visible = s.stage === 4 && prog > 0.35;
    }
    // scaffold only while walls or roof are actively going up
    if (P.scaffold) {
      P.scaffold.visible = (s.stage === 2 && s.active) || (s.stage === 3 && s.active);
    }
    // trusses rise, then sheets close the roof
    if (P.roofFrame) {
      const k = s.stage === 3 ? Math.max(0.02, prog) : (s.stage >= 4 ? 1 : 0);
      P.roofFrame.scale.set(1, k, 1);
      P.roofFrame.visible = s.stage >= 3 && !(s.stage >= 4);
    }
    if (P.roofSheet) {
      const k = s.stage === 3 ? Math.max(0.02, (prog - 0.55) / 0.45) : (s.stage >= 4 ? 1 : 0);
      P.roofSheet.scale.set(1, Math.min(1, k), Math.min(1, k));
      P.roofSheet.visible = s.stage === 4 || (s.stage === 3 && prog > 0.55);
    }
    if (P.finish) {
      const k = s.stage === 4 ? Math.max(0.02, (prog - 0.45) / 0.4) : 0;
      P.finish.scale.set(Math.min(1, k), Math.min(1, k), Math.min(1, k));
      P.finish.visible = s.stage === 4 && prog > 0.45;
    }
    // materials shrink as the build advances
    if (P.piles) {
      const overall = s.type ? Math.min(1, ((s.stage - 1) + prog) / 4) : 1;
      const k = Math.max(0.15, 1 - overall);
      P.piles.scale.set(k, k, k);
      P.piles.visible = s.stage >= 1 && s.stage < 4;
    }
    // workers bend / carry between the pile and the wall
    if (P.workers) {
      P.workers.visible = !!s.active;
      if (s.active) {
        const t = _workPhase.t;
        let i = 0;
        for (const w of P.workers.children) {
          const ph = t * 0.55 + i * 0.41;
          const u = (Math.sin(ph) + 1) / 2;                    // 0 = pile, 1 = wall
          w.position.set(-2.45 + u * 2.45, Math.abs(Math.sin(ph * 4)) * 0.07, 1.6 - u * 3.0);
          w.rotation.y = u > 0.5 ? Math.PI / 2 : -Math.PI / 2;
          w.rotation.x = Math.sin(ph * 4) * 0.12;              // bend
          i++;
        }
      }
    }
    // sign text (1 Hz, only when it changed)
    if (rec.sign && doSigns) _updateSign(rec, s, d2 < SIGN_RANGE * SIGN_RANGE);
  }
}

function _updateSign(rec, s, inRange) {
  rec.sign.sprite.visible = inRange;
  if (!inRange) return;
  let l1, l2;
  if (!s.type) { l1 = "📌 " + s.ownerName; l2 = s.mine ? "Open 🧱 Build to plan" : "Plot #" + s.plotNo; }
  else if (s.active) { l1 = "🏗️ " + s.ownerName; l2 = s.stageName + " · " + _left(s) + " left"; }
  else if (s.mine) { l1 = "🏗️ " + s.ownerName; l2 = "Pay make e continue →"; }
  else { l1 = "🏗️ " + s.ownerName; l2 = "Building don pause"; }
  const text = l1 + "|" + l2;
  if (text === rec.sign.text) return;
  rec.sign.text = text;
  const { canvas, ctx } = rec.sign;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(15,40,30,0.88)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(0, 0, canvas.width, canvas.height, 14); else ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.fill();
  ctx.fillStyle = "#f2b134";
  ctx.fillRect(0, 0, 6, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 26px Poppins, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(l1, 132, 36, 236);
  ctx.fillStyle = "#f2b134";
  ctx.font = "600 22px Poppins, Arial, sans-serif";
  ctx.fillText(l2, 132, 82, 236);
  rec.sign.tex.needsUpdate = true;
}
function _left(s) {
  const end = (s.stageStartedAt || 0) + (s.stageDuration || 0);
  const ms = Math.max(0, end - Date.now());
  const m = Math.max(1, Math.round(ms / 60000));
  return m >= 60 ? Math.floor(m / 60) + "h" + (m % 60 ? " " + (m % 60) + "m" : "") : m + "m";
}

// building.js passes stageStartedAt/stageDuration through the site record so the
// sign can count down without another data path.
export function attachSignTimes(s) { return s; }

export function disposeBuildingVis() {
  for (const [, rec] of _sites) _disposeSite(rec);
  _sites.clear();
}
