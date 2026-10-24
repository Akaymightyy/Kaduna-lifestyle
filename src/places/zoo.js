// src/places/zoo.js — Kaduna Zoo (Kaduna Wildlife Park)
// FEATURE (Oct 24): brand-new place. A full wildlife park with SIX animal
// enclosures (lions, elephants, monkeys, crocodiles, ostriches, snakes),
// a bird aviary, snack kiosk, gift shop + education centre and 13 activities:
// feeding, guided tour, snake show, conservation class, viral videos, picnic.
import * as THREE from "three";
import { box, mergedMesh, signMesh, floor, interiorLights, disposeGroup } from "./_helpers.js";
import { rng } from "../config.js";
import { spawnPeople, getNamedDialogue, getDialogue } from "./people.js";

let _built = false, _cache = null;

export async function build(scene, ctx) {
  if (_built) return _cache;
  const R = rng(20251025);
  const group = new THREE.Group();
  group.name = "zoo_park"; group.visible = false;

  // ---- Ground: mixed savannah lawn ----
  group.add(floor(100, 70, 0x7ba34c));
  // Dirt paths: main walk from gate + loop around the park
  const path = new THREE.Mesh(new THREE.PlaneGeometry(4, 46), new THREE.MeshLambertMaterial({ color: 0xc9b18a }));
  path.rotation.x = -Math.PI / 2; path.position.set(0, 0.02, 8); group.add(path);
  const loop = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 62), new THREE.MeshLambertMaterial({ color: 0xc9b18a }));
  loop.rotation.x = -Math.PI / 2; loop.position.set(0, 0.021, -8); group.add(loop);
  const cross1 = new THREE.Mesh(new THREE.PlaneGeometry(56, 3.2), new THREE.MeshLambertMaterial({ color: 0xc9b18a }));
  cross1.rotation.x = -Math.PI / 2; cross1.position.set(0, 0.022, 12); group.add(cross1);
  const cross2 = new THREE.Mesh(new THREE.PlaneGeometry(56, 3.2), new THREE.MeshLambertMaterial({ color: 0xc9b18a }));
  cross2.rotation.x = -Math.PI / 2; cross2.position.set(0, 0.022, -26); group.add(cross2);
  // Entrance plaza
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(6, 24), new THREE.MeshLambertMaterial({ color: 0xd8cfb4 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.023, 26); group.add(plaza);

  // ---- Buildings & kiosks ----
  group.add(_buildKiosk());
  group.add(_buildGiftShop());
  group.add(_buildEduCentre());

  // ---- Animal enclosures ----
  const lions = _buildLionDen(); group.add(lions);
  const elephants = _buildElephantField(); group.add(elephants);
  const monkeys = _buildMonkeyIsland(); group.add(monkeys);
  const crocs = _buildCrocPond(); group.add(crocs);
  const ostriches = _buildOstrichRun(); group.add(ostriches);
  const snakes = _buildSnakeHouse(); group.add(snakes);
  const birds = _buildAviary(); group.add(birds);

  // ---- Trees, benches, lamps ----
  const treeSpots = [[-14, 18], [14, 16], [-10, -8], [12, -6], [-20, -20], [22, -18], [-8, 20], [9, 22], [-24, 2], [26, 4]];
  for (const [tx, tz] of treeSpots) {
    const tree = _buildTree(R);
    tree.position.set(tx, 0, tz); group.add(tree);
  }
  for (const [bx, bz, br] of [[-5, 14, Math.PI / 2], [5, 10, -Math.PI / 2], [0, -4, Math.PI], [-16, 12, 0]]) {
    const bench = mergedMesh([
      box(2.4, 0.1, 0.7, 0, 0.5, 0, 0xa07040), box(2.4, 0.5, 0.08, 0, 0.8, -0.3, 0xa07040),
      box(0.1, 0.5, 0.6, -1.05, 0.25, 0, 0x5a4a30), box(0.1, 0.5, 0.6, 1.05, 0.25, 0, 0x5a4a30),
    ]);
    bench.position.set(bx, 0, bz); bench.rotation.y = br; group.add(bench);
  }
  for (let i = 0; i < 4; i++) {
    const lamp = mergedMesh([box(0.14, 3.8, 0.14, 0, 1.9, 0, 0x6a5a3a), box(0.44, 0.16, 0.44, 0, 3.9, 0, 0xfff0b0)]);
    lamp.position.set(i % 2 ? 2.8 : -2.8, 0, 24 - i * 13); group.add(lamp);
  }

  // ---- Perimeter fence + gate ----
  const fenceMat = new THREE.MeshLambertMaterial({ color: 0xbfae8e });
  for (const [fx, fz, fw, fd] of [
    [0, -35, 102, 0.5], [-50, 0, 0.5, 70], [50, 0, 0.5, 70],
    [-26, 35, 48, 0.5], [26, 35, 48, 0.5],
  ]) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(fw, 2.4, fd), fenceMat);
    seg.position.set(fx, 1.2, fz); group.add(seg);
  }
  for (const gx of [-6, 6]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(1, 5, 1), new THREE.MeshLambertMaterial({ color: 0xb5651d }));
    post.position.set(gx, 2.5, 35); group.add(post);
  }
  const gateBeam = new THREE.Mesh(new THREE.BoxGeometry(13, 1.3, 1.2), new THREE.MeshLambertMaterial({ color: 0xb5651d }));
  gateBeam.position.set(0, 5.3, 35); group.add(gateBeam);
  const gateSign = signMesh("KADUNA ZOO — WILDLIFE PARK", 12, 1.8, { width: 780, height: 100, bg: "#7a4413", fg: "#ffd9a0", size: 30 });
  gateSign.position.set(0, 7, 34.6); group.add(gateSign);
  const motto = signMesh("LIONS · ELEPHANTS · MONKEYS · CROCS", 9, 0.9, { width: 640, height: 60, bg: "#fff", fg: "#7a4413", size: 24 });
  motto.position.set(0, 5.5, 34.6); group.add(motto);

  // ---- Lighting ----
  group.add(interiorLights({ ambient: 0.78, points: [{ x: 0, y: 6, z: -10, color: 0xfff0e0, intensity: 0.55, distance: 22 }, { x: 30, y: 4, z: 8, color: 0xffe0a0, intensity: 0.45, distance: 14 }] }));

  // ---- Colliders: buildings + enclosure walls ----
  const colliders = [
    { minX: -22, maxX: -14, minZ: 16, maxZ: 22 },    // snack kiosk
    { minX: 14, maxX: 24, minZ: 14, maxZ: 21 },      // gift shop
    { minX: -26, maxX: -14, minZ: -22, maxZ: -15 },  // education centre
    { minX: -44, maxX: -20, minZ: -34, maxZ: -20 },  // lion den
    { minX: 18, maxX: 44, minZ: -34, maxZ: -22 },    // elephant field
    { minX: -44, maxX: -26, minZ: -14, maxZ: -2 },   // monkey island
    { minX: -44, maxX: -24, minZ: 8, maxZ: 24 },     // croc pond
    { minX: 24, maxX: 44, minZ: -12, maxZ: 4 },      // ostrich run
    { minX: 12, maxX: 24, minZ: -22, maxZ: -15 },    // snake house
    { minX: -14, maxX: 14, minZ: -34, maxZ: -28 },   // aviary
    { minX: -2, maxX: 2, minZ: 23, maxZ: 27 },       // welcome statue
  ];

  scene.add(group);

  // ---- People of the Zoo ----
  let _people = null;
  spawnPeople(group, [
    { id: "zoo_keeper", name: "Alhaji Musa", role: "zookeeper", outfit: "kaftan", pose: "stand", x: -30, z: -18.5, ry: 0, top: "#7a4413" },
    { id: "zoo_guide", name: "Grace", role: "tour guide", outfit: "casual", pose: "stand", x: 2, z: 20, ry: Math.PI, top: "#2e7d4f" },
    { id: "zoo_vet", name: "Dr. Ngozi", role: "vet", outfit: "casual", pose: "stand", x: 18, z: -14, ry: 0, top: "#eef3f6" },
    { id: "zoo_vendor", name: "Hauwa", role: "zoo vendor", outfit: "casual", pose: "stand", x: -18, z: 14, ry: 0, top: "#d98e2b" },
    { id: "zoo_kid1", name: "Little Musa", role: "visitor", outfit: "casual", pose: "sit", x: 4.5, z: 11, ry: Math.PI, top: "#1d5fa8" },
    { id: "zoo_kid2", name: "Kiddo", role: "visitor", outfit: "casual", pose: "sit", x: -4.5, z: 11, ry: Math.PI, top: "#c0392b" },
    { id: "zoo_walker1", name: "Visitor", role: "visitor", outfit: "casual", pose: "stand", x: 0, z: 6, ry: Math.PI, route: [{ x: 0, z: 6 }, { x: 0, z: -24 }], speed: 0.7 },
    { id: "zoo_walker2", name: "Visitor", role: "visitor", outfit: "casual", pose: "stand", x: 0, z: -24, ry: 0, route: [{ x: 0, z: -24 }, { x: 0, z: 6 }], speed: 0.65 },
  ]).then((p) => { _people = p; });

  // Animated bits: birds circling overhead + gentle elephant sway
  const _birds = group.userData.zooBirds, _eleTrunk = group.userData.zooEleTrunk;
  const handle = {
    group, colliders,
    enter(ps) { ps.pos.set(0, 0, 28); ps.heading = Math.PI; },
    exit() {},
    update(dt, now, px, pz) {
      if (_people) _people.update(dt, now, px, pz);
      const t = now / 1000;
      if (_birds) {
        for (let i = 0; i < _birds.length; i++) {
          const b = _birds[i], a = t * (0.28 + i * 0.07) + i * 2.1;
          b.position.set(Math.cos(a) * (26 + i * 5), 14 + Math.sin(t * 0.9 + i) * 1.2, Math.sin(a) * (18 + i * 4));
          b.rotation.y = -a;
        }
      }
      if (_eleTrunk) _eleTrunk.rotation.x = Math.sin(t * 1.4) * 0.25;
    },
    dispose() { if (_people) _people.dispose(); scene.remove(group); disposeGroup(group); _built = false; _cache = null; },
    people: () => _people,
    onUIEvent(eid, payload) {
      if (eid === "talk" && payload?.personId) _talk(ctx, payload.personId, _people);
      else if (eid === "feed_lion") _act(ctx, 600, "🦁 You tossed meat to Simba — he ROARED! Fun +25", { fun: 25, social: 8, energy: -8 });
      else if (eid === "feed_elephant") _act(ctx, 400, "🐘 The elephant grabbed sugarcane with its trunk and hosed you playfully!", { fun: 22, social: 8, energy: -8 });
      else if (eid === "monkey_watch") _act(ctx, 0, "🐒 A monkey stole a kid's popcorn and did a backflip. Whole park dey laugh!", { fun: 18, social: 5, energy: -5 });
      else if (eid === "croc_pond") _act(ctx, 0, "🐊 The crocs lay dead-still... then one snapped a fish! Naija ogbonge!", { fun: 15, energy: -5 });
      else if (eid === "snake_show") _act(ctx, 0, "🐍 You let the python rest on your neck! Visitors tipped you ₦900!", { fun: 25, social: 15, energy: -8, _earn: 900 });
      else if (eid === "ostrich_feed") _act(ctx, 300, "🪶 The ostrich pecked so fast! It stared at you like say you owe am money.", { fun: 15, energy: -6 });
      else if (eid === "guided_tour") _act(ctx, 700, "🚶 Grace showed you every enclosure — 45 minutes of pure enjoyment! Fun +30", { fun: 30, social: 12, energy: -15 });
      else if (eid === "learn_centre") _act(ctx, 0, "🎓 Conservation class: 'Lions dey disappear from Nigeria.' Brain +8!", { fun: 10, energy: -8 });
      else if (eid === "post_animal") _act(ctx, 0, "📹 Your monkey video hit 50k views! Fans tipped you ₦700!", { fun: 15, social: 10, energy: -5, _earn: 700 });
      else if (eid === "buy_snack") _act(ctx, 300, "🍿 Hauwa's popcorn hot and sweet! Hunger +25", { hunger: 25, fun: 5 });
      else if (eid === "gift_shop") _buyPlushie(ctx);
      else if (eid === "zoo_picnic") _act(ctx, 0, "🧺 You chilled on the zoo lawn under the trees. Energy +25, Fun +15", { energy: 25, fun: 15, hunger: -5 });
    },
  };
  _built = true; _cache = handle; return handle;
}

// ---------- money / needs helper (same pattern as kasu.js) ----------
function _act(ctx, cost, msg, effects) {
  if (!ctx.game) return;
  if (effects._earn) { ctx.game.state.money += effects._earn; }
  else {
    if (ctx.game.state.money < cost) { ctx.toast("Need ₦" + cost.toLocaleString()); return; }
    ctx.game.state.money -= cost;
  }
  for (const k of ["hunger", "fun", "social", "energy", "hygiene", "bladder"]) {
    if (effects[k]) ctx.game.state.needs[k] = Math.min(100, Math.max(0, (ctx.game.state.needs[k] || 0) + effects[k]));
  }
  ctx.game.save?.(); ctx.updateHUD?.(); ctx.toast(msg);
}

function _buyPlushie(ctx) {
  if (!ctx.game) return;
  if (ctx.game.state.money < 900) { ctx.toast("Need ₦900 for the lion plushie"); return; }
  ctx.game.state.money -= 900;
  ctx.game.state.zooPlushie = true;
  ctx.game.save?.(); ctx.updateHUD?.();
  ctx.toast("🎁 Lion plushie bought! Every time you see it: mood boost. Fun +20");
  const needs = ctx.game.state.needs;
  needs.fun = Math.min(100, (needs.fun || 0) + 20);
  ctx.game.save?.(); ctx.updateHUD?.();
}

function _talk(ctx, personId, people) {
  const p = people?.getPersonById?.(personId) || (people?.people || []).find((q) => q.id === personId);
  if (!p) return;
  const line = getNamedDialogue(p.name) || getDialogue(p.role, p.name) || "Sannu!";
  ctx.toast("👤 " + p.name + ": " + line);
}

// ---------- builders ----------

function _buildKiosk() {
  // Hauwa's snack kiosk — striped roof, open counter
  const g = new THREE.Group(); g.position.set(-18, 0, 19);
  g.add(mergedMesh([
    box(7, 3, 5, 0, 1.5, 0, 0xf4e4c4),
    box(7.6, 0.5, 5.6, 0, 3.2, 0, 0xc0392b),
    box(1.4, 2.2, 0.3, 0, 1.1, 2.55, 0x5a4a30),
  ]));
  for (let i = 0; i < 4; i++) {
    g.add(mergedMesh([box(7.8, 0.28, 0.28, 0, 3.55, 2.1 - i * 0.001, i % 2 ? 0xf4f1ea : 0xc0392b)]));
    g.children[g.children.length - 1].rotation.x = 0.28;
    g.children[g.children.length - 1].position.z = 1.8 - i * 0.75;
  }
  const s1 = signMesh("🍿 SNACK KIOSK", 5.5, 1, { width: 420, height: 70, bg: "#c0392b", fg: "#fff", size: 26 });
  s1.position.set(0, 4, 2.5); g.add(s1);
  return g;
}

function _buildGiftShop() {
  const g = new THREE.Group(); g.position.set(19, 0, 17.5);
  g.add(mergedMesh([
    box(10, 4.5, 7, 0, 2.25, 0, 0xf1d9a0),
    box(10.5, 0.5, 7.5, 0, 4.7, 0, 0xb5651d),
    box(1.6, 2.5, 0.3, 0, 1.25, 3.55, 0x5a4a30),
  ]));
  // Shelf of plushies at the front
  for (let i = 0; i < 3; i++) {
    const shelf = mergedMesh([
      box(3, 0.1, 0.5, 2, 0.9 + i * 0.75, 3.3, 0x8a6a45),
      box(0.55, 0.5, 0.4, -0.6, 1.22 + i * 0.75, 3.3, 0xf2a83b),
      box(0.55, 0.5, 0.4, 0, 1.22 + i * 0.75, 3.3, 0xc0392b),
      box(0.55, 0.5, 0.4, 0.6, 1.22 + i * 0.75, 3.3, 0xf2b134),
    ]);
    g.add(shelf);
  }
  const s1 = signMesh("🎁 ZOO GIFT SHOP", 7, 1.2, { width: 460, height: 76, bg: "#b5651d", fg: "#fff", size: 28 });
  s1.position.set(0, 5.6, 3.6); g.add(s1);
  return g;
}

function _buildEduCentre() {
  const g = new THREE.Group(); g.position.set(-20, 0, -18.5);
  g.add(mergedMesh([
    box(11, 4.5, 7, 0, 2.25, 0, 0xe8e2d2),
    box(11.5, 0.5, 7.5, 0, 4.7, 0, 0x2e7d4f),
    box(1.6, 2.5, 0.3, 0, 1.25, 3.55, 0x5a4a30),
  ]));
  for (let i = 0; i < 4; i++) g.add(mergedMesh([box(1.7, 1.4, 0.2, -4 + i * 2.6, 3, 3.55, 0x9fc2d9)]));
  const s1 = signMesh("🎓 CONSERVATION CENTRE", 8.5, 1.2, { width: 560, height: 76, bg: "#2e7d4f", fg: "#fff", size: 26 });
  s1.position.set(0, 5.6, 3.6); g.add(s1);
  return g;
}

// ---------- animal builders (stylised low-poly, all primitives) ----------

function _buildLionDen() {
  // Rock outcrop den, west-north corner. Lion = "Simba" + two lionesses.
  const g = new THREE.Group();
  g.add(mergedMesh([box(24, 2, 14, -32, 1, -27, 0x9a8a6a)]));                       // den platform
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x8a7a5e });
  for (const [rx, ry, rz, s] of [[-40, 3, -30, 2.2], [-35, 4.5, -24, 3], [-26, 3.5, -30, 2.4], [-30, 5.8, -27, 2.6]]) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
    rock.position.set(rx, ry - 1, rz); g.add(rock);
  }
  g.add(_lion(-30, -24, 0.9));   // Simba, facing out
  g.add(_lion(-36, -30, -0.4));
  g.add(_lion(-24, -29, 2.4));
  // Shade tree in the den
  const tree = _buildTree(rng(7)); tree.position.set(-28, 2, -21); g.add(tree);
  const s1 = signMesh("🦁 LION DEN", 5, 1, { width: 380, height: 66, bg: "#7a4413", fg: "#ffd9a0", size: 26 });
  s1.position.set(-32, 4, -19.8); g.add(s1);
  return g;
}

function _lion(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 2, z); g.rotation.y = ry;
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.95, 0.95), new THREE.MeshLambertMaterial({ color: 0xc9932b }));
  body.position.y = 0.85; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.66, 0.7), new THREE.MeshLambertMaterial({ color: 0xd9a63c }));
  head.position.set(1.2, 1.25, 0); g.add(head);
  const mane = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 7), new THREE.MeshLambertMaterial({ color: 0x8a4a1a }));
  mane.position.set(1.2, 1.3, 0); g.add(mane);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.3), new THREE.MeshLambertMaterial({ color: 0xd9a63c }));
  face.position.set(1.5, 1.22, 0); g.add(face);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.1, 5), new THREE.MeshLambertMaterial({ color: 0xc9932b }));
  tail.position.set(-1.15, 1.1, 0); tail.rotation.z = -0.7; g.add(tail);
  for (const [lx, lz] of [[0.65, 0.32], [0.65, -0.32], [-0.65, 0.32], [-0.65, -0.32]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.8, 0.24), new THREE.MeshLambertMaterial({ color: 0xb9822a }));
    leg.position.set(lx, 0.4, lz); g.add(leg);
  }
  return g;
}

function _buildElephantField() {
  // Savannah field, east-north. Two elephants + mud pool.
  const g = new THREE.Group();
  g.add(mergedMesh([box(26, 1.6, 12, 31, 0.8, -28, 0xc2b280)]));                    // sand platform
  const mud = new THREE.Mesh(new THREE.CircleGeometry(3, 16), new THREE.MeshLambertMaterial({ color: 0x6e5a44 }));
  mud.rotation.x = -Math.PI / 2; mud.position.set(38, 1.62, -28); g.add(mud);
  g.add(_elephant(27, -27, 2.6, 1.15));
  const baby = _elephant(36, -30, 0.4, 0.8, true);
  g.add(baby);
  g.userData.zooEleTrunk = baby.userData.zooEleTrunk;   // baby elephant trunk sways in update()
  // Baobab-ish tree
  const t = mergedMesh([box(1.1, 4, 1.1, 24, 3, -24, 0x8a6a45)]);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 0), new THREE.MeshLambertMaterial({ color: 0x3d8c3a }));
  crown.position.set(24, 5.8, -24); g.add(crown); g.add(t);
  const s1 = signMesh("🐘 ELEPHANT SAVANNAH", 6.5, 1.1, { width: 480, height: 66, bg: "#7a4413", fg: "#ffd9a0", size: 24 });
  s1.position.set(31, 3.6, -21.8); g.add(s1);
  return g;
}

function _elephant(x, z, ry, s, baby) {
  const g = new THREE.Group(); g.position.set(x, 1.6, z); g.rotation.y = ry; g.scale.setScalar(s);
  const grey = new THREE.MeshLambertMaterial({ color: baby ? 0x9a9a98 : 0x8a8a88 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3, 1.7, 1.6), grey);
  body.position.y = 1.7; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.2, 1.05), grey);
  head.position.set(1.9, 2.1, 0); g.add(head);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.7, 7), grey);
  trunk.position.set(2.5, 1.15, 0); g.add(trunk);
  g.userData.isTrunk = trunk;
  for (const ex of [1.62, 2.18]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.6), grey);
    ear.position.set(ex, 2.3, 0.72); g.add(ear);
    const ear2 = ear.clone(); ear2.position.z = -0.72; g.add(ear2);
  }
  const tuskMat = new THREE.MeshLambertMaterial({ color: 0xf4f1ea });
  for (const tz of [0.3, -0.3]) {
    const tusk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.8, 5), tuskMat);
    tusk.position.set(2.35, 1.45, tz); tusk.rotation.z = -0.5; g.add(tusk);
  }
  for (const [lx, lz] of [[1, 0.55], [1, -0.55], [-1, 0.55], [-1, -0.55]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.7, 0.4), grey);
    leg.position.set(lx, 0.85, lz); g.add(leg);
  }
  if (g.userData.isTrunk) {
    // store the BABY's trunk for the sway animation (reused via group userData in build)
    g.userData.zooEleTrunk = trunk;
  }
  return g;
}

function _buildMonkeyIsland() {
  // Moated island, west-middle. 3 monkeys + climbing frame.
  const g = new THREE.Group();
  g.add(mergedMesh([box(18, 1.2, 12, -35, 0.6, -8, 0x88a860)]));                    // island
  const moat = new THREE.Mesh(new THREE.PlaneGeometry(20, 14), new THREE.MeshLambertMaterial({ color: 0x4ab3d4, transparent: true, opacity: 0.7 }));
  moat.rotation.x = -Math.PI / 2; moat.position.set(-35, 0.55, -8); g.add(moat);
  // Climbing frame: poles + crossbar
  g.add(mergedMesh([
    box(0.16, 3.4, 0.16, -38, 1.7 + 1.2, -5, 0x8a6a45), box(0.16, 3.4, 0.16, -32, 1.7 + 1.2, -5, 0x8a6a45),
    box(6.4, 0.14, 0.14, -35, 4.9, -5, 0x8a6a45),
  ]));
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 5), new THREE.MeshLambertMaterial({ color: 0xbfa070 }));
  rope.position.set(-34, 4, -5); g.add(rope);
  g.add(_monkey(-35, 4.6, 0));
  g.add(_monkey(-38.5, 1.9, 1.2));
  g.add(_monkey(-31.5, 1.9, -1.6));
  const tree = _buildTree(rng(9)); tree.position.set(-41, 1.2, -10); g.add(tree);
  const s1 = signMesh("🐒 MONKEY ISLAND", 5.5, 1, { width: 420, height: 66, bg: "#2e7d4f", fg: "#fff", size: 26 });
  s1.position.set(-35, 3.4, -1.6); g.add(s1);
  return g;
}

function _monkey(x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const brown = new THREE.MeshLambertMaterial({ color: 0x8a5a3c });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 7), brown);
  body.position.y = 0.4; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 7), brown);
  head.position.set(0, 0.95, 0); g.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.19, 7, 6), new THREE.MeshLambertMaterial({ color: 0xd9b38a }));
  face.position.set(0, 0.92, 0.17); g.add(face);
  for (const ez of [-0.16, 0.16]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), brown);
    ear.position.set(0.24, 1.02, ez); g.add(ear);
  }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 1, 5), brown);
  tail.position.set(-0.3, 0.75, -0.2); tail.rotation.z = 1.9; g.add(tail);
  return g;
}

function _buildCrocPond() {
  // Pond, west-south. 3 crocs lurking.
  const g = new THREE.Group();
  const water = new THREE.Mesh(new THREE.CircleGeometry(8.5, 22), new THREE.MeshLambertMaterial({ color: 0x3f7e8c, transparent: true, opacity: 0.85 }));
  water.rotation.x = -Math.PI / 2; water.position.set(-34, 0.06, 16); g.add(water);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(8.5, 0.4, 8, 26), new THREE.MeshLambertMaterial({ color: 0x9a8a6a }));
  rim.rotation.x = -Math.PI / 2; rim.position.set(-34, 0.15, 16); g.add(rim);
  for (const [cx, cz, ry] of [[-37, 14, 0.4], [-31, 18, -0.8], [-35, 19.5, 0.15]]) {
    const c = _croc(cx, cz, ry); g.add(c);
  }
  // Warning sign
  g.add(mergedMesh([box(0.12, 1.4, 0.12, -25.5, 0.7, 16, 0x5a4a30)]));
  const warn = signMesh("⚠ DANGER — CROCODILES", 2.6, 0.8, { width: 360, height: 64, bg: "#f2b134", fg: "#000", size: 22 });
  warn.position.set(-25.5, 1.55, 16); g.add(warn);
  const s1 = signMesh("🐊 CROCODILE POND", 5.5, 1, { width: 430, height: 66, bg: "#3f7e8c", fg: "#fff", size: 24 });
  s1.position.set(-34, 2.6, 8.6); g.add(s1);
  return g;
}

function _croc(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 0.18, z); g.rotation.y = ry;
  const green = new THREE.MeshLambertMaterial({ color: 0x4a7a3a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 0.9), green);
  body.position.y = 0.25; g.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.34, 0.5), green);
  tail.position.set(-1.9, 0.2, 0); tail.rotation.y = 0.14; g.add(tail);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1, 0.36, 0.55), green);
  head.position.set(1.75, 0.28, 0); g.add(head);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.14, 0.5), new THREE.MeshLambertMaterial({ color: 0x3d6a30 }));
  jaw.position.set(1.8, 0.12, 0); g.add(jaw);
  for (const ez of [-0.22, 0.22]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), new THREE.MeshLambertMaterial({ color: 0xf2b134 }));
    eye.position.set(1.95, 0.5, ez); g.add(eye);
  }
  for (let i = 0; i < 4; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 4), new THREE.MeshLambertMaterial({ color: 0x3d6a30 }));
    spike.position.set(-0.6 + i * 0.55, 0.56, 0); g.add(spike);
  }
  return g;
}

function _buildOstrichRun() {
  // Sandy run, east-middle. 2 ostriches + shade.
  const g = new THREE.Group();
  g.add(mergedMesh([box(20, 1, 16, 34, 0.5, -4, 0xd9b38a)]));
  g.add(_ostrich(31, -7, 0.5));
  g.add(_ostrich(38, -1, -2.4));
  const shade = mergedMesh([box(3.2, 0.16, 3.2, 34, 2.6, -4, 0xc9a25a)]);
  for (const [px, pz] of [[32.8, -5.2], [35.2, -5.2], [32.8, -2.8], [35.2, -2.8]]) {
    g.add(mergedMesh([box(0.12, 2.6, 0.12, px, 1.3, pz, 0x8a6a45)]));
  }
  g.add(shade);
  const s1 = signMesh("🪶 OSTRICH RUN", 5, 0.95, { width: 400, height: 66, bg: "#b5651d", fg: "#fff", size: 26 });
  s1.position.set(34, 2.4, 4.4); g.add(s1);
  return g;
}

function _ostrich(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 1, z); g.rotation.y = ry;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 9, 8), new THREE.MeshLambertMaterial({ color: 0x3a3f45 }));
  body.scale.set(1.25, 1, 0.9); body.position.y = 1.15; g.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 1.5, 6), new THREE.MeshLambertMaterial({ color: 0xe8d3b0 }));
  neck.position.set(0.45, 2.2, 0); neck.rotation.z = -0.15; g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 7, 6), new THREE.MeshLambertMaterial({ color: 0xe8d3b0 }));
  head.position.set(0.56, 2.95, 0); g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 5), new THREE.MeshLambertMaterial({ color: 0xd98e2b }));
  beak.position.set(0.78, 2.92, 0); beak.rotation.z = -Math.PI / 2; g.add(beak);
  for (const lx of [-0.15, 0.25]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.1, 5), new THREE.MeshLambertMaterial({ color: 0xd98e2b }));
    leg.position.set(lx, 0.55, 0); g.add(leg);
  }
  return g;
}

function _buildSnakeHouse() {
  // Small house with glass front, python coil visible inside.
  const g = new THREE.Group(); g.position.set(18, 0, -18.5);
  g.add(mergedMesh([
    box(9, 4, 6, 0, 2, 0, 0xe0d0a8),
    box(9.5, 0.5, 6.5, 0, 4.2, 0, 0x3d6a30),
  ]));
  const glass = new THREE.Mesh(new THREE.BoxGeometry(5.4, 2.3, 0.14), new THREE.MeshLambertMaterial({ color: 0x9fd8f0, transparent: true, opacity: 0.4 }));
  glass.position.set(0, 1.45, 3.05); g.add(glass);
  const door = mergedMesh([box(1.2, 2.2, 0.25, 3.4, 1.1, 3.05, 0x5a4a30)]);
  g.add(door);
  // Python coil on a rock inside
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.19, 8, 18), new THREE.MeshLambertMaterial({ color: 0x6a8a3a }));
  coil.rotation.x = Math.PI / 2; coil.position.set(-0.8, 0.5, 0.4); g.add(coil);
  const coil2 = coil.clone(); coil2.position.y = 0.82; coil2.scale.setScalar(0.78); g.add(coil2);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 7, 6), new THREE.MeshLambertMaterial({ color: 0x7a9a44 }));
  head.position.set(-0.1, 1, 0.55); g.add(head);
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 0), new THREE.MeshLambertMaterial({ color: 0x8a7a5e }));
  rock.position.set(-0.8, 0.4, 0.4); g.add(rock);
  const s1 = signMesh("🐍 SNAKE HOUSE", 5.5, 1, { width: 400, height: 66, bg: "#3d6a30", fg: "#fff", size: 26 });
  s1.position.set(0, 5.1, 3.2); g.add(s1);
  return g;
}

function _buildAviary() {
  // Open steel-frame aviary across the north edge — peacocks + circling birds.
  const g = new THREE.Group();
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x55705a });
  for (let i = 0; i < 6; i++) {
    g.add(mergedMesh([box(0.18, 4.6, 0.18, -14 + i * 5.6, 2.3, -31, 0x55705a)]));
  }
  g.add(mergedMesh([box(28.4, 0.18, 0.18, 0, 4.6, -31, 0x55705a), box(28.4, 0.14, 0.14, 0, 3.4, -31, 0x55705a)]));
  // Peacocks (body + fan tail)
  g.add(_peacock(-7, -29.4, 0.3, 0x1d5fa8));
  g.add(_peacock(2, -29.6, -0.5, 0x2e7d4f));
  g.add(_peacock(10, -29.2, 0.9, 0x7a3b8f));
  // Circling birds — animated in update()
  const birds = [];
  for (let i = 0; i < 3; i++) {
    const b = mergedMesh([
      box(0.55, 0.1, 0.16, 0, 0, 0, 0xf4f1ea),
      box(0.16, 0.09, 0.14, 0.24, 0.08, 0, 0xf4f1ea),
    ]);
    g.add(b); birds.push(b);
  }
  g.userData.zooBirds = birds;
  const s1 = signMesh("🕊 BIRD AVIARY", 6, 1, { width: 430, height: 66, bg: "#1d5fa8", fg: "#fff", size: 26 });
  s1.position.set(0, 5.4, -30.7); g.add(s1);
  return g;
}

function _peacock(x, z, ry, col) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.8, 7), new THREE.MeshLambertMaterial({ color: 0x1a5a8a }));
  body.position.y = 0.5; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 7, 6), new THREE.MeshLambertMaterial({ color: 0x1a5a8a }));
  head.position.set(0, 1.05, 0.12); g.add(head);
  const fan = new THREE.Mesh(new THREE.CircleGeometry(1.05, 14), new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
  fan.position.set(-0.15, 1.15, 0); fan.rotation.y = Math.PI / 2; g.add(fan);
  const eye = new THREE.Mesh(new THREE.CircleGeometry(0.12, 10), new THREE.MeshLambertMaterial({ color: 0xf2b134, side: THREE.DoubleSide }));
  eye.position.set(-0.14, 1.15, 0); eye.rotation.y = Math.PI / 2; g.add(eye);
  return g;
}

function _buildTree(R) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 2.6, 7), new THREE.MeshLambertMaterial({ color: 0x6a4a2e }));
  trunk.position.y = 1.3; g.add(trunk);
  for (const [ox, oz, s] of [[0, 0, 1.6], [0.8, 0.3, 1.1], [-0.7, 0.25, 1.05]]) {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), new THREE.MeshLambertMaterial({ color: R() < 0.5 ? 0x2e7d32 : 0x3d8c3a }));
    crown.position.set(ox, 2.9 + s * 0.35, oz); g.add(crown);
  }
  return g;
}
