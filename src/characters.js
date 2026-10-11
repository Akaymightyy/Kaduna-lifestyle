// src/characters.js — every character in the game (other players, NPCs) is made from YOUR male.glb
// with different clothes / skin colours. No third-party character files.
//
// PERFORMANCE: We do NOT merge skinned meshes (mergeSkinned breaks bone animation
// because the merged SkinnedMesh binds to a skeleton that gets removed). Instead,
// we rely on frustum culling + distance culling (in npcs.js / people.js) to keep
// draw calls manageable. male.glb has ~240 tiny meshes, but only a few are visible
// at any time due to culling.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { rng } from "./config.js";

const SHIRTS = ["#1f7a5a", "#c0392b", "#f2f2ee", "#1d5fa8", "#d98e2b", "#6b4a8a", "#2e2e2e", "#e8c547", "#3c8dbc", "#a23b72"];
const TROUSERS = ["#2b3a55", "#1f2a36", "#6b5a45", "#3b3b3b", "#7a6a52", "#44546a"];
const KAFTANS = ["#f4efe4", "#9fc2d9", "#c9b38a", "#7aa58a", "#2d3a4a", "#d9c7a0", "#8a9bb5"];
const SKINS = ["#8a5a3c", "#6b4429", "#a5714a", "#5a3825", "#c28a5c", "#7a4b2e"];
const HAIRS = ["#111111", "#1b1b1b", "#2a1e14"];
const SHOES = ["#f2f2ee", "#222222"];

let basePromise = null, baseInfo = null;

export function loadCharacterBase(manager) {
  if (!basePromise) {
    basePromise = new GLTFLoader(manager).loadAsync("/models/male.glb").then((g) => {
      const model = g.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
      baseInfo = { box, size, center };
      return model;
    });
  }
  return basePromise;
}

const _q = new THREE.Quaternion(), _ax = new THREE.Vector3(1, 0, 0);
const base = (n) => n.replace(/^mixamorig[:_]?/i, "").replace(/_\d+$/, "");
const SIT_HIP = -1.45;
const WANT = ["LeftArm", "RightArm", "LeftForeArm", "RightForeArm", "LeftUpLeg", "RightUpLeg", "LeftLeg", "RightLeg"];

function makeRig(group, model, baseY, pose = "stand") {
  const bones = {};
  model.traverse((o) => {
    if (!o.isBone) return;
    const key = base(o.name);
    if (!WANT.includes(key) || (o.parent && base(o.parent.name) === key)) return;
    (bones[key] ||= []).push({ bone: o, rest: o.quaternion.clone() });
  });
  const turn = (name, a) => { _q.setFromAxisAngle(_ax, a); for (const b of bones[name] || []) b.bone.quaternion.copy(b.rest).multiply(_q); };
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
    } else if (pose === "pray") {
      model.position.y = baseY;
      turn("LeftUpLeg", 0); turn("RightUpLeg", 0); turn("LeftLeg", 0); turn("RightLeg", 0);
      arms(0.12, 0.12, 1.45, 1.45, -0.55);
    } else if (pose === "sit") {
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

/** Make one character. opts: { seed, height, outfit, pose, top, bottom, skin, hair, shoes } */
export async function createCharacter(opts = {}) {
  const src = await loadCharacterBase();
  const R = rng((opts.seed ?? 1) * 7919 + 13);
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const outfit = opts.outfit || (R() < 0.3 ? "kaftan" : "casual");
  const top = new THREE.Color(opts.top || (outfit === "kaftan" ? pick(KAFTANS) : pick(SHIRTS)));
  const bottom = opts.bottom ? new THREE.Color(opts.bottom) : outfit === "kaftan" ? top.clone().multiplyScalar(0.92) : new THREE.Color(pick(TROUSERS));
  const skin = new THREE.Color(opts.skin || pick(SKINS));
  const hair = new THREE.Color(opts.hair || pick(HAIRS));
  const shoes = new THREE.Color(opts.shoes || pick(SHOES));

  const model = cloneSkinned(src);
  const height = opts.height || 1.75;
  const k = height / baseInfo.size.y;
  model.scale.setScalar(k);
  const baseY = -baseInfo.box.min.y * k;
  model.position.set(-baseInfo.center.x * k, baseY, -baseInfo.center.z * k);

  // Colour the clothing/skin/hair/shoes meshes by material name.
  // No merging — keep the original skinned meshes so bone animation works.
  const LOOK = { skin, clothing: top, hair, shoes };
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = false; // PERFORMANCE: shadows off on characters (was 240 draw calls into shadow map)
    o.frustumCulled = true; // let Three.js skip off-screen meshes
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const fixed = mats.map((m) => {
      const mm = m.clone();
      const n = (mm.name || "").toLowerCase();
      const key = Object.keys(LOOK).find((kk) => n.includes(kk));
      if (key) { mm.map = null; mm.color.copy(LOOK[key]); }
      else if (outfit === "kaftan") {
        // For kaftan, colour any "clothing" material as the kaftan colour
        if (n.includes("cloth") || n.includes("shirt") || n.includes("pant") || n.includes("trouser")) {
          mm.map = null; mm.color.copy(top);
        }
      }
      mm.metalness = 0; mm.roughness = 0.85;
      return mm;
    });
    o.material = Array.isArray(o.material) ? fixed : fixed[0];
  });

  const group = new THREE.Group();
  group.add(model);
  const animate = makeRig(group, model, baseY, opts.pose || "stand");
  return { group, model, animate };
}
