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

// NOTE: mergeSkinned was removed — it broke bone animation (caused T-pose/floating).
// The function merged ~240 skinned meshes into ~5, but bound them to a skeleton
// that lived on the original meshes which were then deleted → orphaned skeleton.
// Characters now use original meshes with frustum culling + distance culling.

export function loadCharacterBase(manager) {
  if (!basePromise) {
    basePromise = new GLTFLoader(manager).loadAsync("/models/male.glb").then((g) => {
      const model = g.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
      baseInfo = { box, size, center };
      // NOTE: mergeSkinned is NOT called here — it breaks cloneSkinned's bone
      // rebinding, causing T-pose. Instead, each character merges its own clone.
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

/** Make one character. opts: { seed, height, outfit, pose, look } or individual colours.
 *  look = { top, bottom, skin, hair, shoes, topStyle, bottomStyle } — overrides seed colours.
 */
export async function createCharacter(opts = {}) {
  const src = await loadCharacterBase();
  const R = rng((opts.seed ?? 1) * 7919 + 13);
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const outfit = opts.outfit || (R() < 0.3 ? "kaftan" : "casual");

  // Build the look object from opts or random seed
  const look = opts.look || {};
  const top = look.top || opts.top || (outfit === "kaftan" ? pick(KAFTANS) : pick(SHIRTS));
  const bottom = look.bottom || opts.bottom || (outfit === "kaftan" ? top : pick(TROUSERS));
  const skin = look.skin || opts.skin || pick(SKINS);
  const hair = look.hair || opts.hair || pick(HAIRS);
  const shoes = look.shoes || opts.shoes || (R() < 0.5 ? "#f2f2ee" : "#222222");
  const fullLook = { top, bottom, skin, hair, shoes, topStyle: look.topStyle || outfit, bottomStyle: look.bottomStyle || "trousers" };

  const model = cloneSkinned(src);
  const height = opts.height || 1.75;
  const k = height / baseInfo.size.y;
  model.scale.setScalar(k);
  const baseY = -baseInfo.box.min.y * k;
  model.position.set(-baseInfo.center.x * k, baseY, -baseInfo.center.z * k);

  // Apply colours by material name (no mergeSkinned — keeps bone animation working)
  _applyLook(model, fullLook);

  const group = new THREE.Group();
  group.add(model);
  group.userData.look = fullLook; // store for recolorCharacter
  const animate = makeRig(group, model, baseY, opts.pose || "stand");
  return { group, model, animate, look: fullLook };
}

// Recolour an existing character in-place (no model reload).
// ch = { group, model } from createCharacter. look = { top, bottom, skin, hair, shoes, topStyle, bottomStyle }
export function recolorCharacter(ch, look) {
  if (!ch?.model) return;
  _applyLook(ch.model, look);
  if (ch.group) ch.group.userData.look = look;
}

// Internal: apply colours to a model's meshes by material name.
// The GLB has materials named with keywords: "clothing"/"shirt"/"pant", "skin", "hair", "shoes".
function _applyLook(model, look) {
  const top = new THREE.Color(look.top || "#1f7a5a");
  const bottom = new THREE.Color(look.bottom || "#2b3a55");
  const skin = new THREE.Color(look.skin || "#8a5a3c");
  const hair = new THREE.Color(look.hair || "#111111");
  const shoes = new THREE.Color(look.shoes || "#222222");
  const isKaftan = look.topStyle === "kaftan";
  const isShorts = look.bottomStyle === "shorts";

  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = false; o.frustumCulled = true;

    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const fixed = mats.map((m) => {
      const mm = m.clone();
      const n = (mm.name || "").toLowerCase();
      mm.metalness = 0; mm.roughness = 0.85;

      if (n.includes("skin") || n.includes("body") || n.includes("face") || n.includes("hand") || n.includes("arm") || n.includes("leg")) {
        // Skin — but if it's a leg mesh and shorts style, keep skin (bare legs)
        mm.map = null; mm.color.copy(skin);
      } else if (n.includes("hair") || n.includes("head_top")) {
        mm.map = null; mm.color.copy(hair);
      } else if (n.includes("shoe") || n.includes("foot") || n.includes("sole")) {
        mm.map = null; mm.color.copy(shoes);
      } else if (n.includes("cloth") || n.includes("shirt") || n.includes("pant") || n.includes("trouser") || n.includes("jean")) {
        // Clothing — determine if top or bottom by mesh height
        mm.map = null;
        if (isKaftan) {
          mm.color.copy(top); // kaftan = one colour everywhere
        } else {
          // Check mesh height to decide top vs bottom
          o.geometry.computeBoundingBox();
          const bb = o.geometry.boundingBox;
          const meshCenterY = (bb.min.y + bb.max.y) / 2;
          const modelHeight = bb.max.y - bb.min.y;
          // If the mesh center is in the upper half, it's a top; lower half = bottom
          if (meshCenterY > modelHeight * 0.5) {
            mm.color.copy(top);
          } else {
            mm.color.copy(bottom);
          }
        }
      } else if (n.includes("eye") || n.includes("brow") || n.includes("mouth") || n.includes("teeth")) {
        // Leave facial features as-is
      } else {
        // Unknown material — try to colour as clothing
        mm.map = null; mm.color.copy(top);
      }
      return mm;
    });
    o.material = Array.isArray(o.material) ? fixed : fixed[0];
  });
}
