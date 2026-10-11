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
function mergeSkinned(model) {
  const skinned = [];
  model.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
  if (skinned.length < 2) return;
  const ref = skinned[0], refBones = ref.skeleton.bones;
  const idx = new Map(refBones.map((b, i) => [b.name, i]));
  const paint = [], others = new Map();
  for (const m of skinned) {
    const g = m.geometry.clone();
    g.morphAttributes = {}; g.morphTargetsRelative = false;
    if (!g.index) { const c = g.attributes.position.count, ix = new (c > 65535 ? Uint32Array : Uint16Array)(c); for (let i = 0; i < c; i++) ix[i] = i; g.setIndex(new THREE.BufferAttribute(ix, 1)); }
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
      g.computeBoundingBox();
      const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y, pos = g.attributes.position;
      const hy = new Float32Array(pos.count), pt = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) { hy[i] = (pos.getY(i) - y0) / Math.max(1e-6, y1 - y0); pt[i] = PART[part]; }
      g.setAttribute("hy", new THREE.BufferAttribute(hy, 1)); g.setAttribute("part", new THREE.BufferAttribute(pt, 1));
      for (const k of Object.keys(g.attributes)) if (!["position", "normal", "skinIndex", "skinWeight", "hy", "part"].includes(k)) g.deleteAttribute(k);
      paint.push(g);
    } else {
      const key = mats[0].uuid;
      if (!others.has(key)) others.set(key, { mat: mats[0], geos: [] });
      others.get(key).geos.push(g);
    }
  }
  const parent = ref.parent || model;
  const add = (geos, mat, name) => {
    // keep only attributes every geometry has, so they merge
    const keep = Object.keys(geos[0].attributes).filter((k) => geos.every((g) => g.attributes[k]));
    for (const g of geos) for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
    const mesh = new THREE.SkinnedMesh(mergeGeometries(geos), mat);
    mesh.name = name; mesh.frustumCulled = false;
    mesh.bind(ref.skeleton, ref.bindMatrix);
    made.push(mesh);
  };
  const made = [];
  if (paint.length) add(paint, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }), "__paint");
  for (const { mat, geos } of others.values()) add(geos, mat, "__other");
  // only now (everything merged fine) swap the old meshes for the new ones
  for (const m of skinned) m.parent && m.parent.remove(m);
  for (const m of made) parent.add(m);
}

export function loadCharacterBase(manager) {
  if (!basePromise) {
    basePromise = new GLTFLoader(manager).loadAsync("/models/male.glb").then((g) => {
      const model = g.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
      baseInfo = { box, size, center };
      try { mergeSkinned(model); } catch (e) { console.warn("character merge failed", e); }
      return model;
    });
  }
  return basePromise;
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

/** Make one character. opts: { seed, height, outfit: 'casual'|'kaftan' } */
export async function createCharacter(opts = {}) {
  const src = await loadCharacterBase();
  const R = rng((opts.seed ?? 1) * 7919 + 13);
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const outfit = opts.outfit || (R() < 0.3 ? "kaftan" : "casual");
  const top = new THREE.Color(opts.top || (outfit === "kaftan" ? pick(KAFTANS) : pick(SHIRTS)));
  const bottom = opts.bottom ? new THREE.Color(opts.bottom) : outfit === "kaftan" ? top.clone().multiplyScalar(0.92) : new THREE.Color(pick(TROUSERS));
  const skin = new THREE.Color(opts.skin || pick(SKINS)), hair = new THREE.Color(opts.hair || pick(HAIRS));
  const shoes = new THREE.Color(opts.shoes || (R() < 0.5 ? "#f2f2ee" : "#222222"));

  const model = cloneSkinned(src);
  const height = opts.height || 1.75;
  const k = height / baseInfo.size.y;
  model.scale.setScalar(k);
  const baseY = -baseInfo.box.min.y * k;
  model.position.set(-baseInfo.center.x * k, baseY, -baseInfo.center.z * k);

  const hipFrac = outfit === "kaftan" ? 0.32 : 0.5;
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.frustumCulled = false;
    if (o.name !== "__paint") return;
    // shared geometry, own colour attribute so every character wears different clothes
    const src = o.geometry, n = src.attributes.position.count, hy = src.attributes.hy.array, pt = src.attributes.part.array;
    const col = new Float32Array(n * 3), cols = [top, bottom, null, hair, shoes];
    for (let i = 0; i < n; i++) {
      const p = pt[i] | 0;
      const c = p === 0 ? (hy[i] > hipFrac ? top : bottom) : p === 2 ? skin : cols[p];
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    for (const k of Object.keys(src.attributes)) if (k !== "hy" && k !== "part") g.setAttribute(k, src.attributes[k]);
    if (src.index) g.setIndex(src.index);
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    o.geometry = g;
  });
  const group = new THREE.Group();
  group.add(model);
  const animate = makeRig(group, model, baseY, opts.pose || "stand");
  return { group, model, animate };
}
