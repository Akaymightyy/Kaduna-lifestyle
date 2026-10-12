// src/characters.js — every character in the game (other players, NPCs) is made from YOUR male.glb
// with different clothes / skin colours. No third-party character files.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng } from "./config.js";

const SHIRTS = ["#1f7a5a", "#c0392b", "#f2f2ee", "#1d5fa8", "#d98e2b", "#6b4a8a", "#2e2e2e", "#e8c547", "#3c8dbc", "#a23b72"];
const TROUSERS = ["#2b3a55", "#1f2a36", "#6b5a45", "#3b3b3b", "#7a6a52", "#44546a"];
const KAFTANS = ["#f4efe4", "#9fc2d9", "#c9b38a", "#7aa58a", "#2d3a4a", "#d9c7a0", "#8a9bb5"]; // long top + trousers in one colour
const SKINS = ["#8a5a3c", "#6b4429", "#a5714a", "#5a3825", "#c28a5c", "#7a4b2e"];
const HAIRS = ["#111111", "#1b1b1b", "#2a1e14"];

let basePromise = null, baseInfo = null;
const PART = { clothing: 0, skin: 2, hair: 3, shoes: 4 };

// male.glb is split into ~240 tiny skinned meshes. Drawing 9 people = 2000+ draw calls (the lag).
// Here they are merged ONCE into a handful of meshes: one "paintable" mesh (clothes/skin/hair/shoes
// coloured per vertex) + one mesh per remaining material (eyes, brows...).
// Drop vertices no triangle uses. The GLB shares ONE 11,862-vertex buffer between all 242 pieces, so merging
// them without this made a 2,194,782-vertex mesh (26 MB of colours PER CHARACTER). After: ~10k vertices.
function compactGeometry(g) {
  const old = g.index.array, map = new Int32Array(g.attributes.position.count).fill(-1);
  let n = 0;
  for (let i = 0; i < old.length; i++) if (map[old[i]] < 0) map[old[i]] = n++;
  const ng = new THREE.BufferGeometry();
  for (const k of Object.keys(g.attributes)) {
    const a = g.attributes[k], arr = new a.array.constructor(n * a.itemSize), sz = a.itemSize;
    for (let v = 0; v < map.length; v++) { const t = map[v]; if (t >= 0) for (let c = 0; c < sz; c++) arr[t * sz + c] = a.array[v * sz + c]; }
    ng.setAttribute(k, new THREE.BufferAttribute(arr, sz, a.normalized));
  }
  const ni = new (n > 65535 ? Uint32Array : Uint16Array)(old.length);
  for (let i = 0; i < old.length; i++) ni[i] = map[old[i]];
  ng.setIndex(new THREE.BufferAttribute(ni, 1));
  return ng;
}
const _sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const _gs = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
// Feminine shape (waist, hips, bust, rear) applied to the bind-pose vertices. H = body height, y0 = feet, z0 = body centre.
function feminize(g, H, y0, z0) {
  const pos = g.attributes.position, nor = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const u = (y - y0) / H, ax = Math.abs(x) / H;
    const torso = _sm(0.2, 0.13, ax);                       // only the trunk, not the arms
    const waist = _gs(u, 0.615, 0.05) * torso, hips = _gs(u, 0.5, 0.065);
    x *= 1 - 0.22 * waist + 0.2 * hips;                     // narrow waist, wide hips
    z = z0 + (z - z0) * (1 - 0.1 * waist);
    x *= 1 - 0.07 * _gs(u, 0.81, 0.05) * torso;             // slightly narrower shoulders
    const dz = z - z0;
    const bust = _gs(u, 0.715, 0.036) * _gs(Math.abs(x) / H, 0.05, 0.04) * _sm(0, 0.02 * H, dz);
    const rear = _gs(u, 0.49, 0.042) * _gs(Math.abs(x) / H, 0.047, 0.045) * _sm(0, 0.02 * H, -dz);
    z += bust * 0.058 * H - rear * 0.062 * H;
    pos.setXYZ(i, x, y, z);
    if (nor) { const nz = nor.getZ(i); nor.setZ(i, nz + (bust * 0.5 - rear * 0.5) * Math.sign(dz || 1) * 0); }
  }
}
// split beard/moustache triangles (hair-material triangles around the chin/mouth) out of a hair geometry.
// Returns { rest, beard } index arrays; the beard triangles get painted as SKIN for women (dropping them leaves holes).
function splitBeard(g, H, y0, z0) {
  const pos = g.attributes.position, ix = g.index.array, keep = [], beard = [];
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t], b = ix[t + 1], c = ix[t + 2];
    const y = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3, z = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
    const u = (y - y0) / H;
    (u > 0.80 && u < 0.93 && z > z0 - 0.045 * H ? beard : keep).push(a, b, c);
  }
  const mk = (arr) => new THREE.BufferAttribute(new (pos.count > 65535 ? Uint32Array : Uint16Array)(arr), 1);
  return { keep: mk(keep), beard: beard.length ? mk(beard) : null };
}

function mergeSkinned(model, opts = {}) {
  const skinned = [];
  model.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
  if (skinned.length < 2) return;
  // the main body mesh owns the OUTERMOST copy of the skeleton (the one the posing code moves)
  const ref = skinned.reduce((a, m) => (m.geometry.attributes.position.count > a.geometry.attributes.position.count ? m : a), skinned[0]), refBones = ref.skeleton.bones;
  const idx = new Map(refBones.map((b, i) => [b.name, i]));
  const paint = [], others = new Map(), skinFill = [];
  ref.geometry.computeBoundingBox();
  const RB = ref.geometry.boundingBox, BY0 = RB.min.y, BH = Math.max(1e-6, RB.max.y - RB.min.y), BZ0 = (RB.min.z + RB.max.z) / 2;
  for (const m of skinned) {
    let g = m.geometry.clone();
    g.morphAttributes = {}; g.morphTargetsRelative = false;
    if (!g.index) { const c = g.attributes.position.count, ix = new (c > 65535 ? Uint32Array : Uint16Array)(c); for (let i = 0; i < c; i++) ix[i] = i; g.setIndex(new THREE.BufferAttribute(ix, 1)); }
    g = compactGeometry(g);
    if (opts.female) {
      feminize(g, BH, BY0, BZ0);
      if (((Array.isArray(m.material) ? m.material[0] : m.material).name || "").toLowerCase().includes("hair")) {
        const sp = splitBeard(g, BH, BY0, BZ0);
        if (sp.beard) { const bg = g.clone(); bg.setIndex(sp.beard); skinFill.push(compactGeometry(bg)); }
        g.setIndex(sp.keep);
      }
    }
    // remap bone indices into the reference skeleton (matched by bone name)
    if (m.skeleton !== ref.skeleton) {
      const map = m.skeleton.bones.map((b) => idx.get(b.name) ?? 0);
      const si = g.attributes.skinIndex;
      for (let i = 0; i < si.array.length; i++) si.array[i] = map[si.array[i]];
    }
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const n = (mats[0].name || "").toLowerCase();
    const part = Object.keys(PART).find((k) => n.includes(k));
    if (part && mats.length === 1) {
      const y0 = BY0, y1 = BY0 + BH, pos = g.attributes.position;
      const hy = new Float32Array(pos.count), pt = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) { hy[i] = (pos.getY(i) - y0) / Math.max(1e-6, y1 - y0); pt[i] = PART[part]; }
      g.setAttribute("hy", new THREE.BufferAttribute(hy, 1)); g.setAttribute("part", new THREE.BufferAttribute(pt, 1));
      for (const k of Object.keys(g.attributes)) if (!["position", "normal", "skinIndex", "skinWeight", "hy", "part"].includes(k)) g.deleteAttribute(k);
      paint.push(g);
    } else {
      let key = mats[0].uuid, om = mats[0];
      if (opts.female && n.includes("lips")) { key = "lips-f"; om = om.clone(); om.color = new THREE.Color("#8f3a47"); }   // lips are near-black on the male model
      if (!others.has(key)) others.set(key, { mat: om, geos: [] });
      others.get(key).geos.push(g);
    }
  }
  for (const bg of skinFill) {                         // women: former beard area becomes skin
    const pos = bg.attributes.position, hy = new Float32Array(pos.count), pt = new Float32Array(pos.count).fill(PART.skin);
    for (let i = 0; i < pos.count; i++) hy[i] = (pos.getY(i) - BY0) / BH;
    bg.setAttribute("hy", new THREE.BufferAttribute(hy, 1)); bg.setAttribute("part", new THREE.BufferAttribute(pt, 1));
    for (const k of Object.keys(bg.attributes)) if (!["position", "normal", "skinIndex", "skinWeight", "hy", "part"].includes(k)) bg.deleteAttribute(k);
    paint.push(bg);
  }
  const parent = ref.parent || model;
  const add = (geos, mat, name) => {
    // keep only attributes every geometry has, so they merge
    const keep = Object.keys(geos[0].attributes).filter((k) => geos.every((g) => g.attributes[k]));
    for (const g of geos) for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
    const mesh = new THREE.SkinnedMesh(mergeGeometries(geos), mat);
    mesh.name = name; mesh.frustumCulled = false;
    mesh.bind(ref.skeleton, ref.bindMatrix);
    parent.add(mesh); parent.updateMatrixWorld(true);
    mesh.computeBoundingSphere();            // once, here: clones copy it (computing it per character = CPU skinning of every vertex)
    if (mesh.boundingSphere) mesh.boundingSphere.radius *= 1.5;
    parent.remove(mesh);
    made.push(mesh);
  };
  const made = [];
  if (paint.length) add(paint, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }), "__paint");
  for (const { mat, geos } of others.values()) add(geos, mat, "__other");
  // only now (everything merged fine) swap the old meshes for the new ones
  for (const m of skinned) m.parent && m.parent.remove(m);
  for (const m of made) parent.add(m);
}

function loadOne(manager, url, opts = {}) {
  return new GLTFLoader(manager).loadAsync(url).then((g) => {
    const model = g.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    model.userData.info = { box, size, center };
    try { mergeSkinned(model, opts); } catch (e) { console.warn("character merge failed", e); }
    return model;
  });
}
// gender "male" -> /models/male.glb. gender "female" -> /models/female.glb if you add one,
// otherwise the male rig is reused with a slimmer build (src.userData.fallback = true).
const _bases = {};
export function loadCharacterBase(manager, gender = "male") {
  const g = gender === "female" ? "female" : "male";
  if (!_bases[g]) {
    if (g === "female") {
      _bases[g] = loadOne(manager, "/models/female.glb").catch(() => loadOne(manager, "/models/male.glb", { female: true }).then((m) => { m.userData.fallback = true; return m; }));
    } else _bases[g] = loadOne(manager, "/models/male.glb");
  }
  return _bases[g];
}

// body build: slim / normal / big (applies to the model scale; the name tag is not affected)
const BUILD = { slim: [0.9, 1.0], normal: [1.0, 1.0], big: [1.3, 1.0] };
function _outerBone(model, name) {
  let f = null;
  model.traverse((o) => { if (o.isBone && base(o.name) === name && !(o.parent && base(o.parent.name) === name) && !f) f = o; });
  return f;
}
const ACC_MAT = { kufi: new THREE.MeshStandardMaterial({ color: 0xf6f2e8, roughness: 0.9 }), watch: new THREE.MeshStandardMaterial({ color: 0xe0b020, roughness: 0.3, metalness: 0.8 }) };
// wearable extras (cap, watch) attached to bones; sizes are in metres, compensated for the bone's world scale
function applyAccessories(model, look) {
  const old = []; model.traverse((o) => { if (o.userData.acc) old.push(o); });
  for (const o of old) { o.parent && o.parent.remove(o); o.geometry?.dispose(); }
  const w = look.worn || {};
  model.updateWorldMatrix(true, true);
  const attach = (boneName, mesh, offY, rotX) => {
    const bone = _outerBone(model, boneName); if (!bone) return;
    const sc = bone.getWorldScale(new THREE.Vector3()).x || 1;
    mesh.userData.acc = true; mesh.castShadow = false;
    mesh.scale.setScalar(1 / sc); mesh.position.set(0, offY / sc, 0); if (rotX) mesh.rotation.x = rotX;
    bone.add(mesh);
  };
  const bs = look.bottomStyle;
  if (bs === "skirt" || bs === "gown") {            // skirt to the knee, gown almost to the floor (attached to the hips)
    const long = bs === "gown", hem = long ? 0.82 : 0.5, r1 = long ? 0.38 : 0.31;
    const pts = [[0.17, 0.12], [0.185, 0.02], [0.23, -0.22], [r1 * 0.85, -hem * 0.7], [r1, -hem]].map(([x, y]) => new THREE.Vector2(x, y));
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(long ? look.top : look.bottom), roughness: 0.85, side: THREE.DoubleSide });
    attach("Hips", new THREE.Mesh(new THREE.LatheGeometry(pts, 24), mat), 0.0, 0);
  }
  if (look.gender === "female" && w.head !== "kufi") {  // long hair
    const hm = new THREE.MeshStandardMaterial({ color: new THREE.Color(look.hair || "#111111"), roughness: 0.9 });
    const cg = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); cg.scale(0.116, 0.12, 0.122); cg.translate(0, 0.15, -0.012);
    const bg = new THREE.SphereGeometry(1, 14, 10); bg.scale(0.112, 0.2, 0.05); bg.translate(0, 0.02, -0.092);
    attach("Head", new THREE.Mesh(cg, hm), 0, 0);
    attach("Head", new THREE.Mesh(bg, hm), 0, 0);
  }
  if (w.head === "kufi") {
    const g = new THREE.CylinderGeometry(0.088, 0.1, 0.085, 20);
    attach("Head", new THREE.Mesh(g, ACC_MAT.kufi), 0.215, 0);
  }
  if (w.wrist === "watch") {
    const g = new THREE.TorusGeometry(0.034, 0.009, 8, 20);
    attach("LeftHand", new THREE.Mesh(g, ACC_MAT.watch), 0.0, Math.PI / 2);
  }
}

function applyBuild(model, look) {
  const k = model.userData._k; if (!k) return;
  const [w, h] = BUILD[look.build] || BUILD.normal;
  const f = look.gender === "female" ? 0.97 : 1;
  model.scale.set(k * w * f, k * h, k * w * f);
}

const _q = new THREE.Quaternion(), _ax = new THREE.Vector3(1, 0, 0);
const base = (n) => n.replace(/^mixamorig[:_]?/i, "").replace(/_\d+$/, "");
const SIT_HIP = -1.45; // thigh swing for sitting (negative = forward)
const WANT = ["LeftArm", "RightArm", "LeftForeArm", "RightForeArm", "LeftUpLeg", "RightUpLeg", "LeftLeg", "RightLeg"];

function makeRig(group, model, baseY, pose = "stand") {
  const bones = {};
  model.traverse((o) => {
    if (!o.isBone) return;
    const key = base(o.name);
    if (!WANT.includes(key) || (o.parent && base(o.parent.name) === key)) return; // outermost bone of each chain only
    (bones[key] ||= []).push({ bone: o, rest: o.quaternion.clone() });
  });
  const turn = (name, a) => { _q.setFromAxisAngle(_ax, a); for (const b of bones[name] || []) b.bone.quaternion.copy(b.rest).multiply(_q); };
  // arms are aimed along a world direction so they hang free of the body whatever the rig's local axes are
  const kid = (bone, key) => { let f = null; bone.traverse((o) => { if (!f && o !== bone && o.isBone && base(o.name) === key) f = o; }); return f; };
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), d = new THREE.Vector3(), t = new THREE.Vector3();
  const bq = new THREE.Quaternion(), pq = new THREE.Quaternion(), q1 = new THREE.Quaternion(), gq = new THREE.Quaternion();
  const limbs = {};
  group.updateMatrixWorld(true);
  for (const [name, childKey] of [["LeftArm", "LeftForeArm"], ["RightArm", "RightForeArm"], ["LeftForeArm", "LeftHand"], ["RightForeArm", "RightHand"]]) {
    const e = (bones[name] || [])[0]; if (!e) continue;
    const child = kid(e.bone, childKey); if (!child) continue;
    e.bone.getWorldPosition(p0);
    limbs[name] = { e, child, side: Math.sign(group.worldToLocal(p0.clone()).x) || 1 };
  }
  function aim(name, tx, ty, tz) {
    const L = limbs[name]; if (!L) return;
    const b = L.e.bone;
    b.quaternion.copy(L.e.rest); b.updateWorldMatrix(true, true);
    b.getWorldPosition(p0); L.child.getWorldPosition(p1); d.subVectors(p1, p0).normalize();
    group.getWorldQuaternion(gq);
    t.set(tx * L.side, ty, tz).normalize().applyQuaternion(gq);
    q1.setFromUnitVectors(d, t);
    b.getWorldQuaternion(bq); bq.premultiply(q1); b.parent.getWorldQuaternion(pq);
    b.quaternion.copy(pq.invert().multiply(bq));
  }
  const arms = (a, aR, f, fR, inward = 0.08) => { aim("LeftArm", 0.16, -Math.cos(a), Math.sin(a)); aim("RightArm", 0.16, -Math.cos(aR), Math.sin(aR)); aim("LeftForeArm", inward, -Math.cos(f), Math.sin(f)); aim("RightForeArm", inward, -Math.cos(fR), Math.sin(fR)); };
  let phase = Math.random() * 6.28;
  function animate(dt, speed = 0) {
    phase += dt * (6 + speed * 1.6);
    const sw = Math.sin(phase), amp = Math.min(1, speed / 3.2);
    if (speed > 0.15) {
      model.position.y = baseY + Math.abs(sw) * 0.04 * amp;
      turn("LeftUpLeg", sw * 0.6 * amp); turn("RightUpLeg", -sw * 0.6 * amp);
      turn("LeftLeg", Math.max(0, -sw) * 0.8 * amp); turn("RightLeg", Math.max(0, sw) * 0.8 * amp);
      arms(-sw * 0.55 * amp, sw * 0.55 * amp, 0.3 + Math.max(0, -sw) * 0.5 * amp, 0.3 + Math.max(0, sw) * 0.5 * amp);
    } else if (pose === "pray") {          // standing, hands folded in front of the chest
      model.position.y = baseY;
      turn("LeftUpLeg", 0); turn("RightUpLeg", 0); turn("LeftLeg", 0); turn("RightLeg", 0);
      arms(0.12, 0.12, 1.45, 1.45, -0.55);
    } else if (pose === "sit") {           // sitting on the floor / a bench
      model.position.y = baseY - 0.45;
      turn("LeftUpLeg", SIT_HIP); turn("RightUpLeg", SIT_HIP); turn("LeftLeg", -SIT_HIP * 0.95); turn("RightLeg", -SIT_HIP * 0.95);
      arms(0.1, 0.1, 0.9, 0.9, -0.2);
    } else {
      model.position.y = baseY;
      turn("LeftUpLeg", 0); turn("RightUpLeg", 0); turn("LeftLeg", 0); turn("RightLeg", 0);
      arms(0.02, 0.02, 0.18, 0.18);
    }
  }
  animate(0, 0);
  return animate;
}

/** Make one character. opts: { seed, height, outfit, pose, look } or individual colours.
 *  look = { top, bottom, skin, hair, shoes, topStyle, bottomStyle } */
export async function createCharacter(opts = {}) {
  const lk0 = (opts.look && opts.look.gender) || opts.gender || "male";
  const src = await loadCharacterBase(null, lk0);
  const info = src.userData.info;
  const R = rng((opts.seed ?? 1) * 7919 + 13);
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const outfit = opts.outfit || (R() < 0.3 ? "kaftan" : "casual");
  const lk = opts.look || {};
  const top = lk.top || opts.top || (outfit === "kaftan" ? pick(KAFTANS) : pick(SHIRTS));
  const bottom = lk.bottom || opts.bottom || (outfit === "kaftan" ? top : pick(TROUSERS));
  const skin = lk.skin || opts.skin || pick(SKINS);
  const hair = lk.hair || opts.hair || pick(HAIRS);
  const shoes = lk.shoes || opts.shoes || (R() < 0.5 ? "#f2f2ee" : "#222222");
  const fullLook = { top, bottom, skin, hair, shoes, topStyle: lk.topStyle || outfit, bottomStyle: lk.bottomStyle || "trousers", gender: lk0, build: lk.build || "normal", created: !!lk.created, owned: lk.owned || [], worn: lk.worn || {}, base: lk.base || null };

  const model = cloneSkinned(src);
  const height = opts.height || 1.75;
  const k = height / info.size.y;
  model.userData._k = k;
  const baseY = -info.box.min.y * k;
  model.position.set(-info.center.x * k, baseY, -info.center.z * k);

  model.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = true; } });
  _applyLook(model, fullLook);
  applyBuild(model, fullLook);
  applyAccessories(model, fullLook);
  const group = new THREE.Group();
  group.add(model);
  group.userData.look = fullLook;
  const animate = makeRig(group, model, baseY, opts.pose || "stand");
  return { group, model, animate, look: fullLook };
}

// Recolour an existing character in place (cheap: rewrites one vertex-colour attribute).
export function recolorCharacter(ch, look) {
  if (!ch?.model) return;
  _applyLook(ch.model, look);
  applyBuild(ch.model, look);
  applyAccessories(ch.model, look);
  if (ch.group) ch.group.userData.look = look;
}

function _applyLook(model, look) {
  const top = new THREE.Color(look.top || "#1f7a5a"), bottom = new THREE.Color(look.bottom || "#2b3a55");
  const skin = new THREE.Color(look.skin || "#8a5a3c"), hair = new THREE.Color(look.hair || "#111111");
  const shoes = new THREE.Color(look.shoes || "#222222");
  const kaftan = look.topStyle === "kaftan";
  if (look.bottomStyle === "skirt") bottom.copy(skin);      // bare legs under a skirt
  if (look.bottomStyle === "gown") bottom.copy(top);        // long gown covers the legs
  const hipFrac = kaftan ? 0.32 : 0.5;
  const cols = [top, bottom, null, hair, shoes];
  model.traverse((o) => {
    if (!o.isMesh || o.name !== "__paint") return;
    let g = o.geometry;
    if (!o.userData._own) {           // first time: own colour attribute, share everything else
      const s = g, ng = new THREE.BufferGeometry();
      for (const key of Object.keys(s.attributes)) if (key !== "hy" && key !== "part") ng.setAttribute(key, s.attributes[key]);
      if (s.index) ng.setIndex(s.index);
      ng.boundingSphere = s.boundingSphere ? s.boundingSphere.clone() : null;
      o.userData._own = { hy: s.attributes.hy.array, pt: s.attributes.part.array };
      ng.setAttribute("color", new THREE.BufferAttribute(new Float32Array(s.attributes.position.count * 3), 3));
      o.geometry = g = ng;
    }
    const { hy, pt } = o.userData._own, col = g.attributes.color.array, n = hy.length;
    for (let i = 0; i < n; i++) {
      const p = pt[i] | 0;
      const c = p === 0 ? (kaftan || hy[i] > hipFrac ? top : bottom) : p === 2 ? skin : cols[p];
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.attributes.color.needsUpdate = true;
  });
}
