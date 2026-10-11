// src/npcs.js — AI pedestrians walking on sidewalks (real GLB human models)
import * as THREE from "three";
import { createCharacter } from "./characters.js";
import { ROAD_HALF, WORLD_HALF_X, CROSSINGS, rng } from "./config.js";

const NPC_COUNT = 14; // keep modest for perf

export function createNPCs(scene) {
  const R = rng(9988);
  const npcs = [];
  let loaded = 0;

  // Bone-rotation utility (same approach as player.js)
  const _ax = new THREE.Vector3(), _q = new THREE.Quaternion();
  const base = (n) => n.replace(/^mixamorig[:_]?/i, "").replace(/_\d+$/, "");
  const want = ["LeftArm","RightArm","LeftForeArm","RightForeArm","LeftUpLeg","RightUpLeg","LeftLeg","RightLeg"];
  function findBones(model) {
    const bones = {};
    model.traverse((o) => {
      if (!o.isBone) return;
      const key = base(o.name);
      if (!want.includes(key) || (o.parent && base(o.parent.name) === key)) return;
      (bones[key] ||= []).push({ bone: o, rest: o.quaternion.clone() });
    });
    return bones;
  }
  function turn(bones, name, angle) {
    _ax.set(1, 0, 0); _q.setFromAxisAngle(_ax, angle);
    for (const b of bones[name] || []) b.bone.quaternion.copy(b.rest).multiply(_q);
  }

  function makeWalker(model) {
    const bones = findBones(model);
    let phase = R() * Math.PI * 2;
    function animate(dt, speed) {
      phase += dt * (5 + speed * 1.4);
      const sw = Math.sin(phase), amp = Math.min(1, speed / 2.5);
      if (speed > 0.15) {
        model.position.y = Math.abs(sw) * 0.04 * amp;
        turn(bones, "LeftUpLeg", sw * 0.6 * amp);
        turn(bones, "RightUpLeg", -sw * 0.6 * amp);
        turn(bones, "LeftLeg", Math.max(0, -sw) * 0.8 * amp);
        turn(bones, "RightLeg", Math.max(0, sw) * 0.8 * amp);
        // Arm swing
        turn(bones, "LeftArm", -sw * 0.5 * amp);
        turn(bones, "RightArm", sw * 0.5 * amp);
      } else {
        turn(bones, "LeftUpLeg", 0); turn(bones, "RightUpLeg", 0);
        turn(bones, "LeftLeg", 0); turn(bones, "RightLeg", 0);
        turn(bones, "LeftArm", 0.04); turn(bones, "RightArm", 0.04);
      }
    }
    return { animate };
  }

  function normalizeModel(model, targetHeight = 1.75) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const k = targetHeight / size.y;
    model.scale.setScalar(k);
    model.position.set(-box.min.x * k - size.x * k / 2, -box.min.y * k, -box.min.z * k - size.z * k / 2);
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.frustumCulled = false;
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => { m.metalness = 0; m.roughness = 0.9; });
      }
    });
  }

  // Spawn NPC state first (positions, directions)
  for (let i = 0; i < NPC_COUNT; i++) {
    const side = R() < 0.5 ? 1 : -1;
    npcs.push({
      x: -WORLD_HALF_X + R() * WORLD_HALF_X * 2,
      z: side * (ROAD_HALF + 3 + R() * 3),
      dir: R() < 0.5 ? 1 : -1,
      speed: 0.7 + R() * 0.5,
      heading: 0,
      walkPhase: R() * Math.PI * 2,
      group: null,
      walker: null,
      ready: false,
    });
  }

  // Each NPC is built from male.glb with its own clothes and skin colour
  npcs.forEach((npc, i) => {
    createCharacter({ seed: 500 + i * 37, height: 1.7 + R() * 0.15 }).then((ch) => {
      scene.add(ch.group);
      npc.group = ch.group; npc.model = ch.model; npc.walker = ch; npc.ready = true;
    }).catch(() => { npc.ready = false; });
  });

  function update(dt, now) {
    for (const n of npcs) {
      // Walk along X
      n.x += n.dir * n.speed * dt;
      n.walkPhase += dt * (4 + n.speed * 2);

      // Wrap around world
      if (n.x > WORLD_HALF_X) n.x = -WORLD_HALF_X;
      if (n.x < -WORLD_HALF_X) n.x = WORLD_HALF_X;

      // Occasionally cross the road at a zebra crossing
      if (Math.random() < 0.001) {
        const nearest = CROSSINGS.reduce((p, c) => Math.abs(c - n.x) < Math.abs(p - n.x) ? c : p);
        if (Math.abs(n.x - nearest) < 5) n.z = -n.z;
      }

      n.heading = n.dir > 0 ? Math.PI / 2 : -Math.PI / 2;

      if (n.ready && n.group) {
        n.group.position.set(n.x, 0, n.z);
        n.group.rotation.y = n.heading;
        n.walker.animate(dt, n.speed);
      }
    }
  }

  return { update, npcs };
}
