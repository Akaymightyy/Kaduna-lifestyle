// src/places/suya_spot.js
// Mai Suya Spot — outdoor evening suya grill.
// Layout: open-air courtyard with charcoal grill at center, plastic chairs
// and benches around it, string lights overhead, the suya seller (Mallam Audu)
// behind the grill. Order beef/chicken suya with yaji pepper. Restores hunger.
// Hand-built: grill body, charcoal embers, skewers, wooden bench seats, jerry-can table.

import * as THREE from "three";
import { box, mergedMesh, signMesh, floor, interiorLights, smokeSystem, stripLight, disposeGroup } from "./_helpers.js";
import { rng } from "../config.js";
import { spawnPeople, getNamedDialogue, getDialogue } from "./people.js";

let _built = false;
let _cache = null;

export async function build(scene, ctx) {
  if (_built) return _cache;
  const R = rng(20251012);
  const group = new THREE.Group();
  group.name = "suya_spot";
  group.visible = false;

  // ---- ground: packed earth with a few concrete pavers ----
  const groundFloor = floor(40, 30, 0x6a4a2a);
  group.add(groundFloor);
  // Pavers around the grill
  for (let i = 0; i < 6; i++) {
    const paver = floor(2, 2, 0xc8c2b0);
    paver.position.set(-5 + i * 2, 0.01, 0);
    group.add(paver);
  }

  // ---- perimeter: low fence + gate ----
  const fenceColor = 0x5a4a30;
  const fenceGeos = [];
  for (let x = -19; x <= 19; x += 2) {
    fenceGeos.push(box(0.1, 1.0, 0.1, x, 0.5, -15, fenceColor));
    fenceGeos.push(box(0.1, 1.0, 0.1, x, 0.5, 15, fenceColor));
  }
  for (let z = -15; z <= 15; z += 2) {
    fenceGeos.push(box(0.1, 1.0, 0.1, -19, 0.5, z, fenceColor));
    fenceGeos.push(box(0.1, 1.0, 0.1, 19, 0.5, z, fenceColor));
  }
  group.add(mergedMesh(fenceGeos));

  // ---- Charcoal grill (centerpiece) ----
  const grillGroup = new THREE.Group();
  grillGroup.position.set(0, 0, -3);
  // Brick base
  const brickBase = mergedMesh([
    box(2.4, 0.6, 1.4, 0, 0.3, 0, 0x8a3a20),
    box(2.4, 0.6, 1.4, 0, 0.9, 0, 0x6a2a15),
  ]);
  grillGroup.add(brickBase);
  // Metal grill top
  const grillTop = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.05, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.4 })
  );
  grillTop.position.y = 1.25;
  grillGroup.add(grillTop);
  // Glowing charcoal embers (small emissive spheres)
  const emberMat = new THREE.MeshBasicMaterial({ color: 0xff6020 });
  const emberGeo = new THREE.SphereGeometry(0.06, 6, 4);
  const emberCount = 18;
  const embers = new THREE.InstancedMesh(emberGeo, emberMat, emberCount);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < emberCount; i++) {
    m4.makeTranslation(
      (R() - 0.5) * 1.8,
      1.3,
      (R() - 0.5) * 0.9
    );
    embers.setMatrixAt(i, m4);
  }
  grillGroup.add(embers);
  // Suya skewers (6) laid across the grill
  const skewerMat = new THREE.MeshLambertMaterial({ color: 0x6a3a10 });
  const skewerGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.0, 6);
  for (let i = 0; i < 6; i++) {
    const skewer = new THREE.Mesh(skewerGeo, skewerMat);
    skewer.rotation.z = Math.PI / 2;
    skewer.position.set(0, 1.4, -0.5 + i * 0.18);
    grillGroup.add(skewer);
    // Meat chunks on the skewer
    for (let j = 0; j < 5; j++) {
      const meat = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.12, 0.12),
        new THREE.MeshLambertMaterial({ color: 0x6a2010 })
      );
      meat.position.set(-0.8 + j * 0.4, 1.4, -0.5 + i * 0.18);
      grillGroup.add(meat);
    }
  }
  group.add(grillGroup);

  // ---- Smoke rising from the grill ----
  const smoke = smokeSystem({ x: 0, y: 1.5, z: -3, count: 24, color: 0xbbbbbb });
  grillGroup.add(smoke.group);

  // ---- Wooden benches + plastic chairs around ----
  const benchPositions = [
    { x: -8, z: -3, rot: 0 }, { x: 8, z: -3, rot: 0 },
    { x: -8, z: 3, rot: 0 }, { x: 8, z: 3, rot: 0 },
  ];
  for (const bp of benchPositions) {
    const bench = _buildBench();
    bench.position.set(bp.x, 0, bp.z);
    bench.rotation.y = bp.rot;
    group.add(bench);
  }
  // Plastic chairs (the iconic Nigerian white plastic chair)
  const chairPositions = [
    { x: -4, z: -6 }, { x: 4, z: -6 }, { x: -4, z: 6 }, { x: 4, z: 6 },
    { x: 0, z: -8 }, { x: 0, z: 8 },
  ];
  for (const cp of chairPositions) {
    const chair = _buildPlasticChair(R);
    chair.position.set(cp.x, 0, cp.z);
    group.add(chair);
  }

  // ---- Jerry-can table (where Mallam Audu cuts the meat) ----
  const tableGroup = new THREE.Group();
  tableGroup.position.set(-6, 0, -6);
  // Jerry cans as legs (yellow, like Nigerian jerrycans)
  const jerry1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.9, 0.3),
    new THREE.MeshLambertMaterial({ color: 0xf2b134 })
  );
  jerry1.position.set(-1, 0.45, 0);
  tableGroup.add(jerry1);
  const jerry2 = jerry1.clone(); jerry2.position.set(1, 0.45, 0);
  tableGroup.add(jerry2);
  // Plywood top
  const tabletop = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.1, 1.0),
    new THREE.MeshLambertMaterial({ color: 0xbfa070 })
  );
  tabletop.position.y = 0.95;
  tableGroup.add(tabletop);
  // Knife on the table
  const knife = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.02, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 })
  );
  knife.position.set(0, 1.0, 0);
  tableGroup.add(knife);
  // Cutting board
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.04, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x8a5a30 })
  );
  board.position.set(0.5, 1.0, 0);
  tableGroup.add(board);
  group.add(tableGroup);

  // ---- String lights overhead (zig-zag between posts) ----
  const stringLightColors = [0xffd070, 0xff8030, 0xffe090, 0xfff0b0];
  const lightPosts = [[-15, -12], [15, -12], [-15, 12], [15, 12]];
  for (const [px, pz] of lightPosts) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 4.5, 6),
      new THREE.MeshLambertMaterial({ color: 0x4a4f55 })
    );
    post.position.set(px, 2.25, pz);
    group.add(post);
  }
  // String of bulbs between posts (4 strings: square pattern)
  const stringPairs = [
    [[-15, -12], [15, -12]], [[-15, 12], [15, 12]],
    [[-15, -12], [-15, 12]], [[15, -12], [15, 12]],
  ];
  for (let s = 0; s < stringPairs.length; s++) {
    const [a, b] = stringPairs[s];
    const bulbs = 14;
    for (let i = 0; i < bulbs; i++) {
      const t = i / (bulbs - 1);
      const x = a[0] + (b[0] - a[0]) * t;
      const z = a[1] + (b[1] - a[1]) * t;
      // Slight droop in the middle
      const y = 4.2 - Math.sin(t * Math.PI) * 0.4;
      const bulbColor = stringLightColors[(i + s) % stringLightColors.length];
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 6, 4),
        new THREE.MeshBasicMaterial({ color: bulbColor })
      );
      bulb.position.set(x, y, z);
      group.add(bulb);
    }
  }
  // Real point lights at the center for the warm glow
  group.add(interiorLights({
    ambient: 0.35,
    points: [
      { x: 0, y: 4, z: -3, color: 0xff8030, intensity: 1.5, distance: 14 },
      { x: -8, y: 3, z: -3, color: 0xffa050, intensity: 0.6, distance: 8 },
      { x: 8, y: 3, z: -3, color: 0xffa050, intensity: 0.6, distance: 8 },
      { x: -6, y: 3, z: 6, color: 0xffd070, intensity: 0.5, distance: 8 },
      { x: 6, y: 3, z: 6, color: 0xffd070, intensity: 0.5, distance: 8 },
    ],
  }));

  // ---- Sign ----
  const sign = signMesh("MAI SUYA AUDU", 8, 1.2, {
    width: 400, height: 60, bg: "#6a2010", fg: "#ffd070", size: 32,
  });
  sign.position.set(0, 4.5, -14.7);
  group.add(sign);

  // ---- Order menu floating panel (shown via UI event) ----
  const colliders = [
    // Grill
    { minX: -1.5, maxX: 1.5, minZ: -4.5, maxZ: -1.5 },
    // Jerry-can table
    { minX: -7.5, maxX: -4.5, minZ: -7, maxZ: -5 },
    // Benches (approximate)
    { minX: -9.5, maxX: -6.5, minZ: -4, maxZ: -2 },
    { minX: 6.5, maxX: 9.5, minZ: -4, maxZ: -2 },
    { minX: -9.5, maxX: -6.5, minZ: 2, maxZ: 4 },
    { minX: 6.5, maxX: 9.5, minZ: 2, maxZ: 4 },
  ];

  scene.add(group);

  // ---- People: Mallam Audu at grill + 4 sitting on benches + 2 standing + Yaro running ----
  let _people = null;
  spawnPeople(group, [
    { id: "suya1", name: "Mallam Audu", role: "suya seller", outfit: "kaftan", pose: "stand", x: 0, z: -5, ry: Math.PI, top: "#c9b38a" },
    { id: "boy1", name: "Yaro", role: "errand boy", outfit: "casual", pose: "stand", x: -6, z: -6, ry: 0, top: "#1d5fa8", route: [{ x: -6, z: -6 }, { x: 6, z: -6 }, { x: 6, z: 6 }, { x: -6, z: 6 }], speed: 1.2 },
    { id: "cust1", name: "Customer", role: "customer", outfit: "casual", pose: "sit", x: -8, z: -3, ry: Math.PI / 2 },
    { id: "cust2", name: "Customer", role: "customer", outfit: "kaftan", pose: "sit", x: 8, z: -3, ry: -Math.PI / 2 },
    { id: "cust3", name: "Customer", role: "customer", outfit: "casual", pose: "sit", x: -8, z: 3, ry: Math.PI / 2 },
    { id: "cust4", name: "Customer", role: "customer", outfit: "kaftan", pose: "sit", x: 8, z: 3, ry: -Math.PI / 2 },
    { id: "stand1", name: "Chidi", role: "customer", outfit: "casual", pose: "stand", x: -4, z: 0, ry: Math.PI / 2, top: "#2e7d4f" },
    { id: "stand2", name: "Bala", role: "customer", outfit: "casual", pose: "stand", x: 4, z: 0, ry: -Math.PI / 2, top: "#c0392b" },
  ]).then((p) => { _people = p; });

  let _smokeAcc = 0;
  const handle = {
    group,
    enter(playerState) {
      playerState.pos.set(0, 0, 12);
      playerState.heading = Math.PI;
    },
    exit() {},
    update(dt, now, px, pz) {
      _smokeAcc += dt;
      if (_smokeAcc > 0.05) { _smokeAcc = 0; smoke.update(0.05); }
      if (_people) _people.update(dt, now, px, pz);
    },
    dispose() {
      if (_people) _people.dispose();
      scene.remove(group);
      disposeGroup(group);
      _built = false;
      _cache = null;
    },
    onUIEvent(eventId, payload) {
      if (eventId === "order") _orderSuya(payload?.item, ctx);
      else if (eventId === "talk" && payload?.personId) _talk(ctx, payload.personId);
    },
    people: () => _people,
    colliders,
  };

  _built = true;
  _cache = handle;
  return handle;
}

function _buildBench() {
  const g = new THREE.Group();
  const seat = box(2.5, 0.1, 0.5, 0, 0.5, 0, 0x8a6a45);
  const parts = [seat];
  // Legs
  for (const sx of [-1.1, 1.1]) {
    for (const sz of [-0.2, 0.2]) {
      const leg = box(0.1, 0.5, 0.1, sx, 0.25, sz, 0x5a4a30);
      parts.push(leg);
    }
  }
  g.add(mergedMesh(parts));
  return g;
}

function _buildPlasticChair(R) {
  const g = new THREE.Group();
  // Seat
  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.05, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xf0f0e8 })
  );
  seat.position.y = 0.45;
  const parts = [seat];
  // Back
  const back = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.05),
    new THREE.MeshLambertMaterial({ color: 0xf0f0e8 })
  );
  back.position.set(0, 0.7, -0.225);
  g.add(back);
  // Legs
  for (const sx of [-0.22, 0.22]) {
    for (const sz of [-0.22, 0.22]) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.45, 0.05),
        new THREE.MeshLambertMaterial({ color: 0xf0f0e8 })
      );
      leg.position.set(sx, 0.22, sz);
      parts.push(leg);
    }
  }
  return g;
}

function _orderSuya(item, ctx) {
  const menu = {
    beef: { name: "Beef Suya", price: 1200, hunger: 50, fun: 15 },
    chicken: { name: "Chicken Suya", price: 1500, hunger: 60, fun: 18 },
    ram: { name: "Ram Suya", price: 2000, hunger: 70, fun: 22 },
    zobo: { name: "Chilled Zobo", price: 200, hunger: 6, fun: 8, energy: 5 },
  };
  const m = menu[item];
  if (!m) { ctx.toast("Unknown item: " + item); return; }
  if (!ctx.game) return;
  if (ctx.game.state.money < m.price) {
    ctx.toast("Not enough money for " + m.name);
    return;
  }
  ctx.game.state.money -= m.price;
  ctx.game.state.needs.hunger = Math.min(100, (ctx.game.state.needs.hunger || 0) + m.hunger);
  ctx.game.state.needs.fun = Math.min(100, (ctx.game.state.needs.fun || 0) + (m.fun || 0));
  if (m.energy) ctx.game.state.needs.energy = Math.min(100, (ctx.game.state.needs.energy || 0) + m.energy);
  ctx.game.save?.();
  ctx.updateHUD?.();
  ctx.toast("🍢 " + m.name + "! Yaji pepper scatter. Hunger +" + m.hunger);
}

// ---- Talk to a person ----
function _talk(ctx, personId) {
  const handle = _cache;
  if (!handle?.people) return;
  const people = handle.people();
  if (!people) return;
  const person = people.getPersonById?.(personId);
  if (!person) return;
  const line = getNamedDialogue(person.name) || getDialogue(person.role, person.name);
  ctx.toast("💬 " + person.name + ': "' + line + '"');
  if (ctx.game) {
    ctx.game.state.needs.social = Math.min(100, (ctx.game.state.needs.social || 0) + 1);
    ctx.game.save?.();
    ctx.updateHUD?.();
  }
}
