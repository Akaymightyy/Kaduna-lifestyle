import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PLAYER_LIMIT_X, PLAYER_LIMIT_Z } from "./config.js";

const ARM_DOWN = 1.25;
const _q = new THREE.Quaternion(), _ax = new THREE.Vector3();

export async function loadPlayer(manager, scene) {
  const gltf = await new GLTFLoader(manager).loadAsync("/models/male.glb");
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const k = 1.8 / Math.max(size.x, size.y, size.z) * (Math.max(size.x, size.y, size.z) / size.y); // ~1.8 m tall
  model.scale.setScalar(k);
  model.position.set(-center.x * k, -box.min.y * k, -center.z * k);
  const SHIRT = new THREE.Color(0x1f7a5a), TROUSER = new THREE.Color(0x2b3a55);
  const LOOK = { skin: 0x8a5a3c, clothing: 0xffffff, hair: 0x111111, shoes: 0xf2f2ee };
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.frustumCulled = false;
    // shirt on top, trousers below: colour the clothing by height (vertex colours)
    const geo = o.geometry;
    if (geo && !geo.attributes.color && geo.attributes.position) {
      geo.computeBoundingBox();
      const y0 = geo.boundingBox.min.y, y1 = geo.boundingBox.max.y, hip = y0 + (y1 - y0) * 0.5;
      const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) { const c = pos.getY(i) > hip ? SHIRT : TROUSER; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const fixed = mats.map((m) => {
      const mm = m.clone();
      const n = (mm.name || "").toLowerCase();
      const key = Object.keys(LOOK).find((kk) => n.includes(kk));
      if (key) { mm.map = null; mm.color.setHex(LOOK[key]); if (key === "clothing") mm.vertexColors = true; }
      mm.metalness = 0; mm.roughness = 0.85;
      if (!key && window.__logMats) console.log("MAT", mm.name);
      return mm;
    });
    o.material = Array.isArray(o.material) ? fixed : fixed[0];
  });
  const group = new THREE.Group();
  group.add(model);
  scene.add(group);

  // Mixamo rig: pose only the OUTERMOST bone of each chain (the file repeats bones as nested copies)
  const want = ["LeftArm", "RightArm", "LeftForeArm", "RightForeArm", "LeftUpLeg", "RightUpLeg", "LeftLeg", "RightLeg"];
  const base = (n) => n.replace(/^mixamorig[:_]?/i, "").replace(/_\d+$/, "");
  const bones = {};
  model.traverse((o) => {
    if (!o.isBone) return;
    const key = base(o.name);
    if (!want.includes(key) || (o.parent && base(o.parent.name) === key)) return;
    (bones[key] ||= []).push({ bone: o, rest: o.quaternion.clone() });
  });
  // Aim a bone so that the line bone -> child points along a wanted direction (in the character's own frame).
  // This is robust against whatever local axes the rig uses, which is what made the arms stick to the body.
  const _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3(), _d = new THREE.Vector3(), _t = new THREE.Vector3();
  const _bq = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _q1 = new THREE.Quaternion(), _gq = new THREE.Quaternion();
  const kid = (bone, key) => { let f = null; bone.traverse((o) => { if (!f && o !== bone && o.isBone && base(o.name) === key) f = o; }); return f; };
  const turn = (name, angle) => { // legs: plain turn about X (works for this rig)
    _ax.set(1, 0, 0); _q.setFromAxisAngle(_ax, angle);
    for (const b of bones[name] || []) b.bone.quaternion.copy(b.rest).multiply(_q);
  };
  const limbs = {};
  group.updateMatrixWorld(true);
  for (const [name, childKey] of [["LeftArm", "LeftForeArm"], ["RightArm", "RightForeArm"], ["LeftForeArm", "LeftHand"], ["RightForeArm", "RightHand"]]) {
    const e = (bones[name] || [])[0]; if (!e) continue;
    const child = kid(e.bone, childKey); if (!child) continue;
    e.bone.getWorldPosition(_p0);
    limbs[name] = { e, child, side: Math.sign(group.worldToLocal(_p0.clone()).x) || 1 };
  }
  function aim(name, tx, ty, tz) {
    const L = limbs[name]; if (!L) return;
    const b = L.e.bone;
    b.quaternion.copy(L.e.rest);
    b.updateWorldMatrix(true, true);
    b.getWorldPosition(_p0); L.child.getWorldPosition(_p1);
    _d.subVectors(_p1, _p0).normalize();
    group.getWorldQuaternion(_gq);
    _t.set(tx * L.side, ty, tz).normalize().applyQuaternion(_gq);
    _q1.setFromUnitVectors(_d, _t);
    b.getWorldQuaternion(_bq); _bq.premultiply(_q1);
    b.parent.getWorldQuaternion(_pq);
    b.quaternion.copy(_pq.invert().multiply(_bq));
  }
  const arms = (a, aR, fa, faR) => {
    aim("LeftArm", 0.16, -Math.cos(a), Math.sin(a));
    aim("RightArm", 0.16, -Math.cos(aR), Math.sin(aR));
    aim("LeftForeArm", 0.08, -Math.cos(fa), Math.sin(fa));
    aim("RightForeArm", 0.08, -Math.cos(faR), Math.sin(faR));
  };
  let phase = 0;
  function animate(dt, speed) {
    phase += dt * (6 + speed * 1.6);
    const sw = Math.sin(phase), amp = Math.min(1, speed / 3.2);
    if (speed > 0.15) {
      model.position.y = -box.min.y * k + Math.abs(sw) * 0.04 * amp;
      turn("LeftUpLeg", sw * 0.6 * amp); turn("RightUpLeg", -sw * 0.6 * amp);
      turn("LeftLeg", Math.max(0, -sw) * 0.8 * amp); turn("RightLeg", Math.max(0, sw) * 0.8 * amp);
      arms(-sw * 0.55 * amp, sw * 0.55 * amp, 0.3 + Math.max(0, -sw) * 0.5 * amp, 0.3 + Math.max(0, sw) * 0.5 * amp);
    } else {
      model.position.y = -box.min.y * k;
      turn("LeftUpLeg", 0); turn("RightUpLeg", 0); turn("LeftLeg", 0); turn("RightLeg", 0);
      arms(0.02, 0.02, 0.18, 0.18);
    }
  }
  animate(0, 0);
  return { group, animate, height: 1.8 };
}

// circle (player) vs AABB list; pushes the player out
export function collide(pos, colliders, r = 0.45) {
  pos.x = Math.max(-PLAYER_LIMIT_X, Math.min(PLAYER_LIMIT_X, pos.x));
  pos.z = Math.max(-PLAYER_LIMIT_Z, Math.min(PLAYER_LIMIT_Z, pos.z));
  for (const b of colliders) {
    const cx = Math.max(b.minX, Math.min(pos.x, b.maxX)), cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) { const d = Math.sqrt(d2), f = (r - d) / d; pos.x += dx * f; pos.z += dz * f; }
      else pos.x = b.minX - r;
    }
  }
}
