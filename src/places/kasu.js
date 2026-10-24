// src/places/kasu.js — Kaduna State University (KASU) main campus
// FEATURE (Oct 24): brand-new place requested by the owner. A big open campus
// packed with FUN activities: lectures, library, cafeteria, textbook shop,
// football / basketball / volleyball, sprint race, QUIZ NIGHT mini-game with
// real prize money, karaoke, talent show, debate club, campus party, mango-tree
// hangout spot and hostel rest — 16 activities in total.
import * as THREE from "three";
import { box, mergedMesh, signMesh, floor, interiorLights, disposeGroup } from "./_helpers.js";
import { rng } from "../config.js";
import { spawnPeople, getNamedDialogue, getDialogue } from "./people.js";
import { celebrate } from "../celebrate.js";

let _built = false, _cache = null;

export async function build(scene, ctx) {
  if (_built) return _cache;
  const R = rng(20251024);
  const group = new THREE.Group();
  group.name = "kasu_campus"; group.visible = false;

  // ---- Ground: big green campus lawn ----
  group.add(floor(110, 82, 0x4f8a3d));
  // Concrete walkways (main path + cross path)
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(4, 58), new THREE.MeshLambertMaterial({ color: 0xcfc5a8 }));
  walk.rotation.x = -Math.PI / 2; walk.position.set(0, 0.02, 4); group.add(walk);
  const walk2 = new THREE.Mesh(new THREE.PlaneGeometry(86, 3.4), new THREE.MeshLambertMaterial({ color: 0xcfc5a8 }));
  walk2.rotation.x = -Math.PI / 2; walk2.position.set(0, 0.021, -8); group.add(walk2);
  // Entrance plaza circle
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(7, 28), new THREE.MeshLambertMaterial({ color: 0xd8cfb4 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.022, 28); group.add(plaza);

  // ---- Landmarks ----
  const _fountain = _buildFountain(); group.add(_fountain);
  const _flagpole = _buildFlagPole(); group.add(_flagpole);
  group.userData.kasuWater = _fountain.userData.kasuWater;
  group.userData.kasuFlag = _flagpole.userData.kasuFlag;
  group.add(_buildSenate());
  group.add(_buildFaculty());
  group.add(_buildLibrary());
  group.add(_buildHostel());
  group.add(_buildCafeteria());
  group.add(_buildBookshop());
  group.add(_buildFootballField());
  group.add(_buildBasketballCourt());
  group.add(_buildVolleyballCourt());
  group.add(_buildStage());

  // ---- Trees: mango trees + palms scattered around campus ----
  const treeSpots = [
    [-16, 18], [16, 16], [-12, 6], [14, 4], [-22, -14], [20, -14],
    [-34, 22], [34, 20], [-8, -30], [8, -34], [26, 8], [-28, 10],
  ];
  for (const [tx, tz] of treeSpots) {
    const tree = _buildMangoTree(R);
    tree.position.set(tx, 0, tz); group.add(tree);
  }
  for (let i = 0; i < 8; i++) {
    const palm = _buildPalm(R);
    const px = i < 4 ? -48 : 48;
    palm.position.set(px + (R() - 0.5) * 4, 0, -30 + i * 8); group.add(palm);
  }
  // Benches under the trees (the famous "mango tree hangout")
  for (const [bx, bz, br] of [[-16, 15.2, Math.PI], [16, 13.2, Math.PI], [-22, -11, 0], [26, 8, -Math.PI / 2]]) {
    const bench = mergedMesh([
      box(2.4, 0.1, 0.7, 0, 0.5, 0, 0xa07040), box(2.4, 0.5, 0.08, 0, 0.8, -0.3, 0xa07040),
      box(0.1, 0.5, 0.6, -1.05, 0.25, 0, 0x5a4a30), box(0.1, 0.5, 0.6, 1.05, 0.25, 0, 0x5a4a30),
    ]);
    bench.position.set(bx, 0, bz); bench.rotation.y = br; group.add(bench);
  }
  // Lamps along the main walkway
  for (let i = 0; i < 5; i++) {
    const lamp = mergedMesh([
      box(0.16, 4.2, 0.16, 0, 2.1, 0, 0x3a3f45),
      box(0.5, 0.18, 0.5, 0, 4.25, 0, 0xfff0b0),
    ]);
    lamp.position.set(i % 2 ? 2.8 : -2.8, 0, 26 - i * 12); group.add(lamp);
  }

  // ---- Perimeter fence with a gate opening at the south ----
  const fenceMat = new THREE.MeshLambertMaterial({ color: 0xe8e2d2 });
  for (const [fx, fz, fw, fd] of [
    [0, -41, 112, 0.5], [-55, 0, 0.5, 82], [55, 0, 0.5, 82],
    [-31, 41, 48, 0.5], [31, 41, 48, 0.5],
  ]) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(fw, 2.2, fd), fenceMat);
    seg.position.set(fx, 1.1, fz); group.add(seg);
  }
  for (const gx of [-7.5, 7.5]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(1, 5, 1), new THREE.MeshLambertMaterial({ color: 0x1f7a5a }));
    post.position.set(gx, 2.5, 41); group.add(post);
  }
  const gateBeam = new THREE.Mesh(new THREE.BoxGeometry(16, 1.4, 1.2), new THREE.MeshLambertMaterial({ color: 0x1f7a5a }));
  gateBeam.position.set(0, 5.4, 41); group.add(gateBeam);
  const gateSign = signMesh("KADUNA STATE UNIVERSITY (KASU)", 14, 1.9, { width: 760, height: 100, bg: "#1f7a5a", fg: "#ffffff", size: 34 });
  gateSign.position.set(0, 7.2, 40.6); group.add(gateSign);
  const motto = signMesh("• CENTRE OF LEARNING •", 8, 0.9, { width: 500, height: 60, bg: "#ffffff", fg: "#1f7a5a", size: 26 });
  motto.position.set(0, 5.6, 40.6); group.add(motto);

  // ---- Lighting ----
  group.add(interiorLights({ ambient: 0.75, points: [{ x: 0, y: 6, z: -25, color: 0xfff0e0, intensity: 0.6, distance: 20 }, { x: 38, y: 4, z: -4, color: 0xffe0a0, intensity: 0.5, distance: 14 }] }));

  // ---- Colliders (AABB walls the player can't walk through) ----
  const colliders = [
    { minX: -13, maxX: 13, minZ: -34, maxZ: -22 },   // senate building
    { minX: -41, maxX: -25, minZ: -27, maxZ: -17 },  // faculty block
    { minX: 23, maxX: 38, minZ: -29, maxZ: -19 },    // library
    { minX: 37, maxX: 49, minZ: -8, maxZ: 8 },       // hostel
    { minX: -48, maxX: -36, minZ: -4, maxZ: 8 },     // cafeteria
    { minX: -17, maxX: -11, minZ: -19, maxZ: -14 },  // bookshop
    { minX: 34, maxX: 43, minZ: -9, maxZ: -1 },      // stage platform
    { minX: -3, maxX: 3, minZ: 21, maxZ: 27 },       // fountain
    { minX: 7.4, maxX: 8.6, minZ: 29.4, maxZ: 30.6 },// flag pole
  ];

  scene.add(group);

  // ---- People of KASU ----
  let _people = null;
  spawnPeople(group, [
    { id: "kasu_vc", name: "Prof. Abdullahi", role: "vice chancellor", outfit: "kaftan", pose: "stand", x: 0, z: -20.5, ry: 0, top: "#1f4d2e" },
    { id: "kasu_sec", name: "Officer Yusuf", role: "guard", outfit: "casual", pose: "stand", x: 4, z: 33, ry: Math.PI, top: "#2c3e50" },
    { id: "kasu_lect1", name: "Dr. Yakubu", role: "lecturer", outfit: "kaftan", pose: "stand", x: -30, z: -15.5, ry: 0, top: "#1d5fa8" },
    { id: "kasu_lect2", name: "Dr. (Mrs) Eze", role: "lecturer", outfit: "casual", pose: "stand", x: -34, z: -15.5, ry: 0, top: "#7a3b8f" },
    { id: "kasu_stud1", name: "Hauwa", role: "student", outfit: "casual", pose: "sit", x: 28, z: -18.4, ry: 0, top: "#c0392b" },
    { id: "kasu_stud2", name: "Emeka", role: "student", outfit: "casual", pose: "sit", x: 31, z: -18.4, ry: 0, top: "#f2b134" },
    { id: "kasu_stud3", name: "Aisha", role: "student", outfit: "casual", pose: "sit", x: -15.8, z: 17.8, ry: Math.PI, top: "#2e7d4f" },
    { id: "kasu_stud4", name: "Bashir", role: "student", outfit: "kaftan", pose: "stand", x: -3, z: 10, ry: 0, route: [{ x: -3, z: 10 }, { x: 3, z: 10 }, { x: 3, z: -6 }, { x: -3, z: -6 }], speed: 0.7 },
    { id: "kasu_stud5", name: "Student", role: "student", outfit: "casual", pose: "stand", x: 12, z: -6, ry: Math.PI, route: [{ x: 12, z: -6 }, { x: -10, z: -6 }], speed: 0.8 },
    { id: "kasu_stud6", name: "Student", role: "student", outfit: "casual", pose: "stand", x: -10, z: -6, ry: 0, route: [{ x: -10, z: -6 }, { x: 12, z: -6 }], speed: 0.75 },
    { id: "kasu_vendor", name: "Mama Ngozi", role: "cafeteria cook", outfit: "casual", pose: "stand", x: -42, z: 9.2, ry: 0, top: "#d98e2b" },
    { id: "kasu_books", name: "Mallam Bala", role: "bookseller", outfit: "kaftan", pose: "stand", x: -14, z: -13.2, ry: 0, top: "#8a5a3c" },
    { id: "kasu_coach", name: "Coach Emeka", role: "coach", outfit: "casual", pose: "stand", x: -22, z: 9, ry: 0, top: "#2e7d4f" },
    { id: "kasu_dj", name: "DJ Zainab", role: "DJ", outfit: "casual", pose: "stand", x: 36.5, z: 0.2, ry: Math.PI / 2, top: "#6b21a8" },
    { id: "kasu_quiz", name: "Mr. Danjuma", role: "quiz master", outfit: "kaftan", pose: "stand", x: 40.5, z: 0.2, ry: Math.PI / 2, top: "#1d5fa8" },
    { id: "kasu_fan1", name: "Cheerleader", role: "student", outfit: "casual", pose: "sit", x: 33, z: 3.4, ry: Math.PI, top: "#f2b134" },
    { id: "kasu_fan2", name: "Cheerleader", role: "student", outfit: "casual", pose: "sit", x: 35, z: 3.4, ry: Math.PI, top: "#c0392b" },
    { id: "kasu_fan3", name: "Cheerleader", role: "student", outfit: "casual", pose: "sit", x: 37, z: 3.4, ry: Math.PI, top: "#1d5fa8" },
    { id: "kasu_exam", name: "Mrs. Danladi", role: "exam officer", outfit: "casual", pose: "stand", x: -28, z: -15, ry: 0, top: "#34495e" },
    { id: "kasu_grad", name: "Chief Bello", role: "graduation marshal", outfit: "kaftan", pose: "stand", x: 41.5, z: -2.8, ry: Math.PI / 2, top: "#8a5a3c" },
    { id: "kasu_hostel", name: "Blessing", role: "party host", outfit: "casual", pose: "stand", x: 43, z: 9.5, ry: Math.PI, top: "#c0392b" },
  ]).then((p) => { _people = p; });

  // Animated bits: flag ripple + fountain water bob
  const _flag = group.userData.kasuFlag, _water = group.userData.kasuWater;
  const handle = {
    group, colliders,
    enter(ps) { ps.pos.set(0, 0, 32); ps.heading = Math.PI; },
    exit() {},
    update(dt, now, px, pz) {
      if (_people) _people.update(dt, now, px, pz);
      const t = now / 1000;
      if (_flag) _flag.rotation.y = Math.sin(t * 2.2) * 0.18;
      if (_water) _water.scale.y = 1 + Math.sin(t * 3.1) * 0.22;
    },
    dispose() { if (_people) _people.dispose(); scene.remove(group); disposeGroup(group); _built = false; _cache = null; },
    people: () => _people,
    onUIEvent(eid, payload) {
      if (eid === "talk" && payload?.personId) _talk(ctx, payload.personId, _people);
      else if (eid === "attend_lecture") _act(ctx, 0, "🎓 Attended GNS 101 at LT1! ₦500 TAKE-HOME stipend. Energy -20", { fun: 5, social: 5, energy: -20, _earn: 500 });
      else if (eid === "study_library") _act(ctx, 0, "📚 You studied hard! Brain +10. Textbook owners ace Quiz Night!", { fun: 8, energy: -15 });
      else if (eid === "eat_cafeteria") _act(ctx, 400, "🍝 Mama Ngozi served rice & stew! Hunger +50", { hunger: 50, fun: 5 });
      else if (eid === "bookshop") _buyTextbook(ctx);
      else if (eid === "play_football") _act(ctx, 0, "⚽ You scored a goal on KASU field! Fun +25", { fun: 25, social: 15, energy: -15 });
      else if (eid === "play_basketball") _act(ctx, 0, "🏀 Slam dunk! The court dey hot! Fun +22", { fun: 22, social: 10, energy: -18 });
      else if (eid === "play_volleyball") _act(ctx, 0, "🏐 Nice spike! Your team dey hail you! Fun +20", { fun: 20, social: 15, energy: -15 });
      else if (eid === "sprint_race") _act(ctx, 0, "🏃 100m dash done in 11.8s! Coach Emeka dey clap for you!", { fun: 15, energy: -20 });
      else if (eid === "quiz_night") _openQuiz(ctx);
      else if (eid === "karaoke") _act(ctx, 300, "🎤 You sang 'African Queen' — the crowd went wild! Fun +30", { fun: 30, social: 15, energy: -10 });
      else if (eid === "talent_show") _act(ctx, 0, "🎭 Your performance killed it! Students tipped you ₦800!", { fun: 25, social: 20, energy: -15, _earn: 800 });
      else if (eid === "debate_club") _act(ctx, 0, "🗣️ You won the debate: 'Japa vs Build Nigeria'! ₦500 prize!", { social: 25, energy: -10, _earn: 500 });
      else if (eid === "campus_party") _act(ctx, 1000, "🎉 Campus party turnt! DJ Zainab played your song all night!", { fun: 40, social: 25, energy: -15 });
      else if (eid === "hangout") _act(ctx, 0, "🌳 You gisted under the mango tree till sunset. Social +20", { social: 20, fun: 10, energy: -5 });
      else if (eid === "rest_hostel") _act(ctx, 0, "😴 You rested at Amina Hostel. Energy +40", { energy: 40 });
      else if (eid === "graduation") _graduate(ctx);
      else if (eid === "write_exam") _writeExam(ctx);
      else if (eid === "hostel_party") _act(ctx, 800, "🪩 Hostel block-o at Amina! You even did the Risky dance! Fun +35", { fun: 35, social: 25, energy: -15 });
    },
  };
  _built = true; _cache = handle; return handle;
}

// ---------- money / needs helper (same pattern as stadium.js) ----------
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

function _graduate(ctx) {
  if (!ctx.game) return;
  if (ctx.game.state.money < 5000) { ctx.toast("Need ₦5,000 for the graduation fee"); return; }
  ctx.game.state.money -= 5000;
  ctx.game.state.kasuGraduate = true;
  celebrate("🎓 CONGRATULATIONS, GRADUATE!", "KASU Class of '26 — your family dey proud of you!");
  _act(ctx, 0, "🎓 Degree collected! The VC shook your hand, confetti everywhere! Fun +50", { fun: 50, social: 30, energy: -20 });
}

function _writeExam(ctx) {
  if (!ctx.game) return;
  const passed = !!ctx.game.state.kasuTextbook || Math.random() < 0.55;
  if (passed) {
    celebrate("📝 EXAM PASSED!", "Straight-A energy — well done!");
    _act(ctx, 0, "📝 GNS 102 exam — PASSED! ₦1,500 scholarship alert!" + (ctx.game.state.kasuTextbook ? " (textbook carry-over dey work!)" : ""), { fun: 20, social: 5, energy: -25, _earn: 1500 });
  } else {
    _act(ctx, 0, "📝 Chai! The exam hard o. Buy the textbook at the bookshop for a guaranteed pass!", { fun: 5, energy: -25 });
  }
}

function _buyTextbook(ctx) {
  if (!ctx.game) return;
  if (ctx.game.state.money < 600) { ctx.toast("Need ₦600 for the textbook"); return; }
  ctx.game.state.money -= 600;
  ctx.game.state.kasuTextbook = true;
  ctx.game.save?.(); ctx.updateHUD?.();
  ctx.toast("📖 Bought 'Essential Textbook'! Quiz Night winnings now ×1.5!");
}

function _talk(ctx, personId, people) {
  const p = people?.getPersonById?.(personId) || (people?.people || []).find((q) => q.id === personId);
  if (!p) return;
  const line = getNamedDialogue(p.name) || getDialogue(p.role, p.name) || "Sannu!";
  ctx.toast("👤 " + p.name + ": " + line);
}

// ---------- builders (all hand-made from primitives, campus style) ----------

function _buildFountain() {
  const g = new THREE.Group(); g.position.set(0, 0, 24);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.3, 0.8, 20), new THREE.MeshLambertMaterial({ color: 0xd8cfb4 }));
  basin.position.y = 0.4; g.add(basin);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.5, 20), new THREE.MeshLambertMaterial({ color: 0x4ab3d4, transparent: true, opacity: 0.75 }));
  water.position.y = 0.7; g.add(water);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 1.6, 10), new THREE.MeshLambertMaterial({ color: 0xd8cfb4 }));
  col.position.y = 1.6; g.add(col);
  const jet = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshLambertMaterial({ color: 0x8fd0f0, transparent: true, opacity: 0.8 }));
  jet.position.y = 2.6; g.add(jet);
  g.userData.kasuWater = water;
  return g;
}

function _buildFlagPole() {
  const g = new THREE.Group(); g.position.set(8, 0, 30);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 9, 8), new THREE.MeshLambertMaterial({ color: 0xdadada }));
  pole.position.y = 4.5; g.add(pole);
  // Nigerian flag: green-white-green
  const flagG = new THREE.Group();
  flagG.add(new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.75), new THREE.MeshLambertMaterial({ color: 0x1f7a5a, side: THREE.DoubleSide })));
  const wm = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.75), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  wm.position.x = 1.1; flagG.add(wm);
  const gm = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.75), new THREE.MeshLambertMaterial({ color: 0x1f7a5a, side: THREE.DoubleSide }));
  gm.position.x = 2.2; flagG.add(gm);
  flagG.position.set(0.06, 7.8, 0);
  g.add(flagG);
  g.userData.kasuFlag = flagG;
  return g;
}

function _buildSenate() {
  // The iconic KASU Senate Building: white body, green band, clock tower
  const g = new THREE.Group(); g.position.set(0, 0, -28);
  g.add(mergedMesh([
    box(26, 9, 10, 0, 4.5, 0, 0xf4f1ea),
    box(26, 1.2, 10.3, 0, 6.4, 0, 0x1f7a5a),
    box(26.6, 0.5, 10.6, 0, 9.1, 0, 0x1f7a5a),
    box(26, 0.5, 10.4, 0, 0.35, 0, 0xb5a68b),
  ]));
  // Columns + glass doors
  for (const cx of [-9, -4.5, 0, 4.5, 9]) {
    g.add(mergedMesh([box(1, 6, 1, cx, 3, 5.2, 0xe8e2d2)]));
  }
  g.add(mergedMesh([
    box(6, 3.4, 0.4, 0, 1.7, 5.1, 0x7ec8ff),
    box(5.4, 0.3, 0.5, 0, 3.5, 5.1, 0x1f7a5a),
  ]));
  // Windows (3 rows)
  for (let r = 0; r < 2; r++) for (let i = 0; i < 8; i++) {
    if (r === 0 && Math.abs(-10.5 + i * 3) < 4) continue;
    g.add(mergedMesh([box(1.8, 1.6, 0.2, -10.5 + i * 3, 4.2 + r * 2.6, -5.05, 0x7ec8ff)]));
  }
  // Clock tower
  g.add(mergedMesh([
    box(4, 14, 4, 0, 7, -2, 0xf4f1ea),
    box(4.6, 0.6, 4.6, 0, 14.3, -2, 0x1f7a5a),
  ]));
  const clock = new THREE.Mesh(new THREE.CircleGeometry(1.3, 20), new THREE.MeshBasicMaterial({ color: 0xfff8e8 }));
  clock.position.set(0, 11.5, 0.05); clock.position.z = 2.06; g.add(clock);
  const handH = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 0.06), new THREE.MeshBasicMaterial({ color: 0x1f4d2e }));
  handH.position.set(0, 11.8, 2.1); g.add(handH);
  const handM = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.06), new THREE.MeshBasicMaterial({ color: 0x1f4d2e }));
  handM.position.set(0.3, 11.3, 2.1); handM.rotation.z = Math.PI / 3; g.add(handM);
  // KASU name board
  const board = signMesh("KASU SENATE BUILDING", 9, 1.4, { width: 500, height: 78, bg: "#1f4d2e", fg: "#ffffff", size: 30 });
  board.position.set(0, 7.8, 5.3); g.add(board);
  return g;
}

function _buildFaculty() {
  // Two lecture-theatre blocks + connecting arcade
  const g = new THREE.Group(); g.position.set(-33, 0, -22);
  for (const [lx, col] of [[-4, 0xe8d3b0], [4, 0xd9e3ec]]) {
    g.add(mergedMesh([
      box(7.5, 5.5, 8, lx, 2.75, 0, col),
      box(7.9, 0.4, 8.4, lx, 5.7, 0, 0x1d5fa8),
      box(1.4, 2.4, 0.3, lx, 1.2, 4.05, 0x5a4a30),
    ]));
    for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) {
      g.add(mergedMesh([box(1.6, 1.3, 0.2, lx - 2.2 + i * 2.2, 3.4 + r * 1.8, -4.05, 0x7ec8ff)]));
    }
  }
  g.add(mergedMesh([box(4, 0.4, 8, 0, 4.2, 0, 0xbfa070)]));
  const s1 = signMesh("FACULTY OF SCIENCE", 7.5, 1.2, { width: 480, height: 76, bg: "#1d5fa8", fg: "#fff", size: 28 });
  s1.position.set(0, 6.3, 4.2); g.add(s1);
  const s2 = signMesh("LECTURE THEATRE LT1", 5.5, 0.9, { width: 420, height: 66, bg: "#ffffff", fg: "#1d5fa8", size: 24 });
  s2.position.set(-4, 2.9, 4.3); g.add(s2);
  const s3 = signMesh("LECTURE THEATRE LT2", 5.5, 0.9, { width: 420, height: 66, bg: "#ffffff", fg: "#1d5fa8", size: 24 });
  s3.position.set(4, 2.9, 4.3); g.add(s3);
  return g;
}

function _buildLibrary() {
  const g = new THREE.Group(); g.position.set(30.5, 0, -24);
  g.add(mergedMesh([
    box(15, 6.5, 10, 0, 3.25, 0, 0xf1ece0),
    box(15.5, 0.5, 10.5, 0, 6.7, 0, 0x1f7a5a),
    box(3.2, 1.1, 3.4, 0, 7.4, 0, 0xf1ece0),
    box(1, 2.6, 0.4, 0, 1.3, 5.05, 0x5a4a30),
  ]));
  // Tall arched-style windows
  for (let i = 0; i < 5; i++) {
    g.add(mergedMesh([box(1.7, 3.2, 0.2, -5.5 + i * 2.75, 3.6, 5.05, 0x9fc2d9)]));
  }
  // Steps
  g.add(mergedMesh([box(6, 0.25, 1.2, 0, 0.12, 5.8, 0xd8cfb4), box(6, 0.25, 1.2, 0, 0.36, 5.2, 0xcfc5a8)]));
  const s1 = signMesh("KASU LIBRARY", 8, 1.4, { width: 460, height: 80, bg: "#1f4d2e", fg: "#f2b134", size: 32 });
  s1.position.set(0, 5.9, 5.25); g.add(s1);
  return g;
}

function _buildHostel() {
  const g = new THREE.Group(); g.position.set(43, 0, 0);
  g.add(mergedMesh([
    box(10, 7, 15, 0, 3.5, 0, 0xe8d3b0),
    box(10.5, 0.5, 15.5, 0, 7.2, 0, 0x2e7d4f),
    box(1.6, 2.6, 0.3, 0, 1.3, 7.55, 0x5a4a30),
  ]));
  for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) {
    g.add(mergedMesh([box(1.7, 1.5, 0.2, -3.4 + i * 1.7, 3.4 + r * 2.6, 7.55, 0x7ec8ff)]));
  }
  // Water tank on top (very KASU)
  g.add(mergedMesh([box(1.6, 1.6, 1.6, 2.5, 8.2, -3, 0x4a90d9)]));
  const s1 = signMesh("AMINA HOSTEL", 6.5, 1.1, { width: 420, height: 70, bg: "#2e7d4f", fg: "#fff", size: 28 });
  s1.position.set(0, 6.2, 7.7); g.add(s1);
  return g;
}

function _buildCafeteria() {
  const g = new THREE.Group(); g.position.set(-42, 0, 2);
  g.add(mergedMesh([
    box(12, 4.5, 10, 0, 2.25, 0, 0xf4f1ea),
    box(12.5, 0.4, 10.5, 0, 4.7, 0, 0xf2b134),
    box(1.6, 2.4, 0.3, 0, 1.2, 5.05, 0x5a4a30),
  ]));
  // Serving counter with food pots
  g.add(mergedMesh([box(8, 1, 0.6, 0, 0.5, 2, 0x8a6a45), box(8, 0.1, 0.7, 0, 1.05, 2, 0xbfa070)]));
  const foodColors = [0xc0392b, 0xf2b134, 0x2e7d4f, 0x8a5a3c];
  for (let i = 0; i < 4; i++) {
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6, roughness: 0.3 }));
    pan.position.set(-3 + i * 2, 1.25, 2); g.add(pan);
    const food = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 12), new THREE.MeshLambertMaterial({ color: foodColors[i] }));
    food.position.set(-3 + i * 2, 1.45, 2); g.add(food);
  }
  // Outdoor umbrella tables
  for (const [tx, tz] of [[-4, 10], [4, 10], [0, 13]]) {
    const tbl = mergedMesh([box(1.6, 0.08, 1.6, 0, 0.75, 0, 0xbfa070), box(0.1, 0.75, 0.1, 0, 0.37, 0, 0x5a4a30)]);
    tbl.position.set(tx, 0, tz); g.add(tbl);
    const um = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.8, 10), new THREE.MeshLambertMaterial({ color: tx === 0 ? 0xc0392b : 0xf2b134 }));
    um.position.set(tx, 2.4, tz); g.add(um);
    const umPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), new THREE.MeshLambertMaterial({ color: 0x8a8f96 }));
    umPole.position.set(tx, 1.3, tz); g.add(umPole);
  }
  const s1 = signMesh("KASU CAFETERIA", 8, 1.3, { width: 460, height: 76, bg: "#d98e2b", fg: "#fff", size: 30 });
  s1.position.set(0, 5.4, 5.3); g.add(s1);
  return g;
}

function _buildBookshop() {
  const g = new THREE.Group(); g.position.set(-14, 0, -16.5);
  g.add(mergedMesh([
    box(6, 3.6, 4.5, 0, 1.8, 0, 0xe9c9a4),
    box(6.5, 0.35, 5, 0, 3.75, 0, 0x1d5fa8),
    box(1.4, 2.3, 0.3, 0, 1.15, 2.3, 0x5a4a30),
  ]));
  // Shelves with colourful books visible at the open front
  for (let i = 0; i < 3; i++) {
    const shelf = mergedMesh([
      box(2.2, 0.08, 0.5, 1.9, 0.7 + i * 0.8, 1.4, 0x8a6a45),
      box(0.9, 0.5, 0.36, 1.6, 0.98 + i * 0.8, 1.4, [0xc0392b, 0x1d5fa8, 0x2e7d4f][i]),
      box(0.9, 0.5, 0.36, 2.5, 0.98 + i * 0.8, 1.4, [0xf2b134, 0x7a3b8f, 0xc0392b][i]),
    ]);
    g.add(shelf);
  }
  const s1 = signMesh("KASU BOOKSHOP", 5, 1, { width: 420, height: 70, bg: "#1d5fa8", fg: "#fff", size: 26 });
  s1.position.set(0, 4.4, 2.4); g.add(s1);
  return g;
}

// ---------- sports & stage ----------

function _buildFootballField() {
  const g = new THREE.Group(); g.position.set(-24, 0, 18);
  const field = new THREE.Mesh(new THREE.PlaneGeometry(30, 18), new THREE.MeshLambertMaterial({ color: 0x4a7a2a }));
  field.rotation.x = -Math.PI / 2; field.position.y = 0.03; g.add(field);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const cl = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 17), lineMat); cl.rotation.x = -Math.PI / 2; cl.position.y = 0.04; g.add(cl);
  const cc = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.6, 24), lineMat); cc.rotation.x = -Math.PI / 2; cc.position.y = 0.04; g.add(cc);
  const box1 = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.2), lineMat); box1.rotation.x = -Math.PI / 2; box1.position.set(-12, 0.04, 0); g.add(box1);
  const box2 = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.2), lineMat); box2.rotation.x = -Math.PI / 2; box2.position.set(12, 0.04, 0); g.add(box2);
  for (const gx of [-15, 15]) {
    for (const gz of [-2.5, 2.5]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }));
      p.position.set(gx, 1.25, gz); g.add(p);
    }
    const cb = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5.4, 6), lineMat);
    cb.rotation.x = Math.PI / 2; cb.position.set(gx, 2.5, 0); g.add(cb);
  }
  // Corner flags
  for (const [fx, fz] of [[-14.6, -8.6], [-14.6, 8.6], [14.6, -8.6], [14.6, 8.6]]) {
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), new THREE.MeshLambertMaterial({ color: 0xf2b134, side: THREE.DoubleSide }));
    fl.position.set(fx, 1.6, fz); g.add(fl);
    const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.7, 6), new THREE.MeshLambertMaterial({ color: 0xdddddd }));
    fp.position.set(fx, 0.85, fz); g.add(fp);
  }
  // Ball resting on the centre spot
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), new THREE.MeshLambertMaterial({ color: 0xf4f1ea }));
  ball.position.set(0, 0.3, 0); g.add(ball);
  return g;
}

function _buildBasketballCourt() {
  const g = new THREE.Group(); g.position.set(8, 0, 20);
  const court = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshLambertMaterial({ color: 0xc96f3b }));
  court.rotation.x = -Math.PI / 2; court.position.y = 0.03; g.add(court);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mid = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 7.6), lineMat); mid.rotation.x = -Math.PI / 2; mid.position.y = 0.04; g.add(mid);
  const cc = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.55, 20), lineMat); cc.rotation.x = -Math.PI / 2; cc.position.y = 0.04; g.add(cc);
  const border = new THREE.Mesh(new THREE.RingGeometry(3.9, 4.05, 4, 1, 0, Math.PI * 2), lineMat);
  border.rotation.x = -Math.PI / 2; border.scale.set(1.75, 1, 1); border.position.y = 0.04; g.add(border);
  for (const hx of [-6.6, 6.6]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.6, 8), new THREE.MeshLambertMaterial({ color: 0x3a3f45 }));
    pole.position.set(hx, 1.8, 0); g.add(pole);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 1.8), new THREE.MeshLambertMaterial({ color: 0xf4f1ea }));
    board.position.set(hx + (hx < 0 ? 0.3 : -0.3), 3.2, 0); g.add(board);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 8, 16), new THREE.MeshStandardMaterial({ color: 0xf26522, metalness: 0.4, roughness: 0.4 }));
    ring.rotation.x = Math.PI / 2; ring.position.set(hx + (hx < 0 ? 0.75 : -0.75), 2.85, 0); g.add(ring);
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), new THREE.MeshLambertMaterial({ color: 0xd9722c }));
  ball.position.set(-1, 0.24, 1.5); g.add(ball);
  return g;
}

function _buildVolleyballCourt() {
  const g = new THREE.Group(); g.position.set(25, 0, 20);
  const court = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), new THREE.MeshLambertMaterial({ color: 0xd9b38a }));
  court.rotation.x = -Math.PI / 2; court.position.y = 0.03; g.add(court);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mid = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 5.7), lineMat); mid.rotation.x = -Math.PI / 2; mid.position.y = 0.04; g.add(mid);
  for (const px of [-5.3, 5.3]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 8), new THREE.MeshLambertMaterial({ color: 0x8a8f96 }));
    post.position.set(px, 1.25, 0); g.add(post);
  }
  const net = new THREE.Mesh(new THREE.BoxGeometry(10.6, 1, 0.04), new THREE.MeshLambertMaterial({ color: 0x2b2f35, transparent: true, opacity: 0.7 }));
  net.position.set(0, 1.85, 0); g.add(net);
  const netBand = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.08, 0.06), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  netBand.position.set(0, 2.32, 0); g.add(netBand);
  const vb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshLambertMaterial({ color: 0xf2e14c }));
  vb.position.set(2, 0.22, 1.6); g.add(vb);
  return g;
}

function _buildStage() {
  // Open-air amphitheatre stage: talent shows, karaoke, quiz night, parties
  const g = new THREE.Group(); g.position.set(38.5, 0, -5);
  g.add(mergedMesh([
    box(9, 1.2, 8, 0, 0.6, 0, 0x8a5a3c),            // wooden platform
    box(9, 0.15, 8, 0, 1.27, 0, 0xa07040),           // deck
    box(9.6, 0.4, 0.4, 0, 1.45, -3.9, 0x1f7a5a),     // front skirt
  ]));
  // Backdrop wall + KASU ARENA sign
  g.add(mergedMesh([box(9, 5, 0.5, 0, 3.5, -3.6, 0x1f4d2e)]));
  const bd = signMesh("★ KASU ARENA ★", 8, 1.6, { width: 500, height: 100, bg: "#1f4d2e", fg: "#f2b134", size: 36 });
  bd.position.set(0, 4.6, -3.3); g.add(bd);
  // Microphone stand
  g.add(mergedMesh([
    box(0.08, 1.3, 0.08, 0, 1.95, 1.5, 0x3a3f45),
    box(0.3, 0.18, 0.3, 0, 2.68, 1.5, 0x2b2f35),
  ]));
  // Speakers left & right
  for (const sx of [-4, 4]) {
    g.add(mergedMesh([
      box(1, 1.8, 0.8, sx, 0.9, 1.2, 0x2b2f35),
      box(0.6, 0.6, 0.05, sx, 1.1, 1.62, 0x55585e),
      box(0.3, 0.3, 0.05, sx, 1.7, 1.62, 0x55585e),
    ]));
  }
  // Disco ball + coloured stage lights on a truss
  g.add(mergedMesh([box(8.4, 0.18, 0.18, 0, 6.2, 0.5, 0x3a3f45)]));
  const disco = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshStandardMaterial({ color: 0xc0c8d4, metalness: 0.95, roughness: 0.15 }));
  disco.position.set(0, 5.5, 0.5); g.add(disco);
  const lightColors = [0xe11d48, 0xf2b134, 0x0ea5e9, 0x7a3b8f];
  for (let i = 0; i < 4; i++) {
    const spot = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 8), new THREE.MeshBasicMaterial({ color: lightColors[i] }));
    spot.position.set(-3 + i * 2, 5.9, 0.8); spot.rotation.z = Math.PI; g.add(spot);
  }
  // String lights zig-zagging to the audience benches
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 7; j++) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe6a0 }));
      bulb.position.set(-3.4 + j * 1.15, 4.6 - Math.sin(j / 6 * Math.PI) * 0.5, 4.5 + i * 1.6); g.add(bulb);
    }
    g.add(mergedMesh([box(0.03, 0.03, 0.03, 0, 0, 0, 0x3a3f45)])); // anchor
  }
  // Audience bench rows (3 rows)
  for (let r = 0; r < 3; r++) {
    const row = mergedMesh([
      box(10, 0.14, 0.6, 0, 0.5 + r * 0.45, 6.5 + r * 1.7, 0xa07040),
      box(10, 0.5, 0.08, 0, 0.78 + r * 0.45, 6.2 + r * 1.7, 0xa07040),
      box(0.1, 0.5 + r * 0.45, 0.55, -4.9, (0.5 + r * 0.45) / 2, 6.5 + r * 1.7, 0x5a4a30),
      box(0.1, 0.5 + r * 0.45, 0.55, 4.9, (0.5 + r * 0.45) / 2, 6.5 + r * 1.7, 0x5a4a30),
    ]);
    g.add(row);
  }
  return g;
}

function _buildMangoTree(R) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 2.8, 7), new THREE.MeshLambertMaterial({ color: 0x6a4a2e }));
  trunk.position.y = 1.4; trunk.rotation.z = (R() - 0.5) * 0.15; g.add(trunk);
  for (const [ox, oz, s] of [[0, 0, 1.7], [0.9, 0.4, 1.2], [-0.8, 0.3, 1.1], [0.2, -0.9, 1.0]]) {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), new THREE.MeshLambertMaterial({ color: R() < 0.5 ? 0x2e7d32 : 0x3d8c3a }));
    crown.position.set(ox, 3.1 + s * 0.4, oz); g.add(crown);
  }
  // A few ripe mangoes
  for (let i = 0; i < 4; i++) {
    const mango = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshLambertMaterial({ color: 0xf2a83b }));
    mango.position.set((R() - 0.5) * 2.4, 2.1 + R() * 0.8, (R() - 0.5) * 2.4); g.add(mango);
  }
  return g;
}

function _buildPalm(R) {
  const g = new THREE.Group();
  for (let s = 0; s < 5; s++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.16 - s * 0.012, 0.2 - s * 0.012, 1.1, 6), new THREE.MeshLambertMaterial({ color: 0x9a7a4e }));
    seg.position.set(Math.sin(s * 0.5) * 0.18, 0.55 + s * 1.05, 0); seg.rotation.z = Math.sin(s * 0.5) * 0.12; g.add(seg);
  }
  for (let i = 0; i < 7; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.4, 5), new THREE.MeshLambertMaterial({ color: R() < 0.5 ? 0x2e8b3a : 0x37a344 }));
    frond.position.y = 5.9;
    frond.rotation.z = 1.9; frond.rotation.y = (i / 7) * Math.PI * 2;
    const frondG = new THREE.Group();
    frondG.add(frond); frondG.rotation.y = (i / 7) * Math.PI * 2;
    frond.position.set(0, 0, 0); frond.rotation.set(0, 0, 1.9); frond.rotation.x = 0.35;
    frondG.add(frond);
    frondG.position.y = 5.8;
    g.add(frondG);
  }
  return g;
}

// ---------- QUIZ NIGHT mini-game (the crown jewel of KASU fun) ----------
const QUIZ_BANK = [
  { q: "What does KASU stand for?", opts: ["Kano State University", "Kaduna State University", "Katsina State University", "Kwara State University"], a: 1 },
  { q: "In what year was KASU founded?", opts: ["1996", "2004", "2010", "1988"], a: 1 },
  { q: "The name 'Kaduna' comes from the Hausa word for…?", opts: ["Lions", "Elephants", "Crocodiles", "Rivers"], a: 2 },
  { q: "Which river flows through Kaduna city?", opts: ["River Niger", "River Benue", "Kaduna River", "Hadejia River"], a: 2 },
  { q: "Nigeria's capital city is…?", opts: ["Lagos", "Abuja", "Kano", "Port Harcourt"], a: 1 },
  { q: "How many states does Nigeria have?", opts: ["30", "25", "42", "36"], a: 3 },
  { q: "Nigeria's official currency is the…?", opts: ["Cedi", "Naira", "Rand", "Shilling"], a: 1 },
  { q: "Nigeria's national football team is called…?", opts: ["Super Eagles", "Red Devils", "Black Stars", "Chipolopolo"], a: 0 },
  { q: "The highest naira note in circulation is…?", opts: ["₦500", "₦200", "₦1000", "₦100"], a: 2 },
  { q: "Kaduna State is popularly called the ______ of Learning.", opts: ["Garden", "Centre", "Heart", "Home"], a: 1 },
  { q: "The historic emirate based in Zaria, Kaduna State is…?", opts: ["Sokoto Emirate", "Kano Emirate", "Zazzau Emirate", "Bida Emirate"], a: 2 },
  { q: "Kachia in Kaduna State is famous for producing…?", opts: ["Cocoa", "Palm oil", "Rubber", "Ginger"], a: 3 },
  { q: "Ahmadu Bello University (ABU) is located in…?", opts: ["Lagos", "Ibadan", "Kano", "Zaria"], a: 3 },
  { q: "Who was the Sardauna of Sokoto and Premier of Northern Nigeria?", opts: ["Obafemi Awolowo", "Ahmadu Bello", "Nnamdi Azikiwe", "Michael Okpara"], a: 1 },
  { q: "Nigeria's first Executive President (1979) was…?", opts: ["Shehu Shagari", "Olusegun Obasanjo", "Tafawa Balewa", "Ernest Shonekan"], a: 0 },
];

function _shuffle(arr, R) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor((R ? R() : Math.random()) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function _openQuiz(ctx) {
  if (document.getElementById("kasu-quiz-modal")) return;
  if (!ctx.game) return;
  const textbook = !!ctx.game.state.kasuTextbook;
  const MULT = textbook ? 1.5 : 1;
  const QUESTIONS = _shuffle(QUIZ_BANK).slice(0, 5);
  let qi = 0, won = 0, correct = 0;

  const overlay = document.createElement("div");
  overlay.id = "kasu-quiz-modal";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(6,22,15,.88);z-index:95;display:flex;align-items:center;justify-content:center;padding:14px;";
  overlay.innerHTML =
    '<div style="width:min(420px,94vw);background:linear-gradient(160deg,#0f4d3a,#1f7a5a);border-radius:18px;padding:18px;color:#fff;font-family:Poppins,system-ui,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.18);">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
        '<div style="font-size:20px;font-weight:800;flex:1;">🧠 KASU QUIZ NIGHT</div>' +
        '<button id="kasu-quiz-x" style="background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:10px;padding:5px 10px;font-weight:700;cursor:pointer;">✕</button>' +
      '</div>' +
      '<div style="font-size:11px;opacity:.85;margin-bottom:10px;">' + (textbook ? "📖 Textbook bonus ACTIVE — winnings ×1.5!" : "Mr. Danjuma hosts! ₦500 per correct answer + ₦2000 for 5/5") + '</div>' +
      '<div style="height:7px;background:rgba(255,255,255,.18);border-radius:4px;overflow:hidden;margin-bottom:14px;"><div id="kasu-quiz-prog" style="height:100%;width:0;background:#f2b134;border-radius:4px;transition:width .3s;"></div></div>' +
      '<div id="kasu-quiz-q" style="font-size:15px;font-weight:700;margin-bottom:12px;min-height:44px;"></div>' +
      '<div id="kasu-quiz-opts" style="display:flex;flex-direction:column;gap:8px;"></div>' +
      '<div id="kasu-quiz-fb" style="margin-top:10px;font-size:13px;font-weight:700;min-height:18px;"></div>' +
      '<button id="kasu-quiz-next" style="display:none;width:100%;margin-top:6px;background:#f2b134;color:#0f4d3a;border:none;border-radius:12px;padding:11px;font:800 14px Poppins,sans-serif;cursor:pointer;">Next question →</button>' +
    '</div>';
  document.body.appendChild(overlay);

  const $ = (id) => document.getElementById(id);
  const qEl = $("kasu-quiz-q"), optsEl = $("kasu-quiz-opts"), fbEl = $("kasu-quiz-fb"), nextEl = $("kasu-quiz-next"), progEl = $("kasu-quiz-prog");
  let finished = false, collected = false;

  function close() { overlay.remove(); }
  $("kasu-quiz-x").onclick = () => {
    close();
    if (!finished && qi > 0) _act(ctx, 0, "🧠 Quiz closed early — you won ₦" + Math.round(won) + "!", { fun: 10 + correct * 3, energy: -5 });
  };

  function showQ() {
    const q = QUESTIONS[qi];
    progEl.style.width = (qi / QUESTIONS.length) * 100 + "%";
    fbEl.textContent = ""; fbEl.style.color = "#fff";
    nextEl.style.display = "none";
    qEl.textContent = "Q" + (qi + 1) + "/5: " + q.q;
    optsEl.innerHTML = "";
    q.opts.forEach((opt, idx) => {
      const b = document.createElement("button");
      b.style.cssText = "text-align:left;background:rgba(255,255,255,.94);color:#0f4d3a;border:none;border-radius:11px;padding:11px 13px;font:700 13px Poppins,sans-serif;cursor:pointer;transition:transform .12s;";
      b.textContent = String.fromCharCode(65 + idx) + ". " + opt;
      b.onmouseenter = () => { b.style.transform = "scale(1.02)"; };
      b.onmouseleave = () => { b.style.transform = "scale(1)"; };
      b.onclick = () => {
        const isCorrect = idx === q.a;
        Array.from(optsEl.children).forEach((btn, i) => {
          btn.style.opacity = "0.65"; btn.style.cursor = "default"; btn.onclick = null;
          if (i === q.a) { btn.style.background = "#4ade80"; btn.style.opacity = "1"; }
          else if (i === idx && !isCorrect) { btn.style.background = "#f87171"; btn.style.color = "#fff"; btn.style.opacity = "1"; }
        });
        if (isCorrect) {
          correct++;
          const prize = Math.round(500 * MULT);
          won += prize;
          fbEl.style.color = "#4ade80";
          fbEl.textContent = "✅ Correct! +₦" + prize.toLocaleString() + (MULT > 1 ? " (×1.5 textbook bonus!)" : "");
        } else {
          fbEl.style.color = "#fca5a5";
          fbEl.textContent = "❌ Chai! The answer na " + String.fromCharCode(65 + q.a) + ". " + q.opts[q.a];
        }
        nextEl.style.display = "block";
        nextEl.textContent = qi >= QUESTIONS.length - 1 ? "See my results 🏆" : "Next question →";
      };
      optsEl.appendChild(b);
    });
  }

  nextEl.onclick = () => {
    if (finished) return;                      // GUARD: results screen already shown
    qi++;
    if (qi < QUESTIONS.length) { showQ(); return; }
    finished = true;
    // ---- Final results ----
    progEl.style.width = "100%";
    qEl.style.display = "none"; optsEl.style.display = "none";
    nextEl.style.display = "none";
    fbEl.style.color = "#fff";
    let rank;
    if (correct === 5) rank = "🏆 PERFECT SCORE! You be first-class KASU student!";
    else if (correct >= 3) rank = "🎖️ Solid performance! 2:1 level!";
    else if (correct >= 1) rank = "📚 You try! Read your textbook next time!";
    else rank = "😅 Na wa o. Come back next Friday!";
    const bonus = correct === 5 ? Math.round(2000 * MULT) : 0;
    won += bonus;
    fbEl.innerHTML =
      '<div style="background:rgba(0,0,0,.25);border-radius:14px;padding:14px;text-align:center;">' +
        '<div style="font-size:26px;font-weight:800;margin-bottom:4px;">' + correct + '/5 correct</div>' +
        '<div style="font-size:13px;margin-bottom:8px;">' + rank + '</div>' +
        (bonus ? '<div style="font-size:12px;color:#f2b134;font-weight:700;margin-bottom:4px;">+ ₦' + bonus.toLocaleString() + ' perfect-score bonus!</div>' : '') +
        '<div style="font-size:20px;font-weight:800;color:#f2b134;">You won ₦' + Math.round(won).toLocaleString() + '</div>' +
      '</div>';
    const done = document.createElement("button");
    done.style.cssText = "width:100%;margin-top:10px;background:#f2b134;color:#0f4d3a;border:none;border-radius:12px;padding:11px;font:800 14px Poppins,sans-serif;cursor:pointer;";
    done.textContent = "Collect winnings & close";
    done.onclick = () => {
      if (collected) return;                   // GUARD: never pay out twice
      collected = true;
      close();
      _act(ctx, 0, "🧠 Quiz Night done! " + correct + "/5 — you won ₦" + Math.round(won).toLocaleString() + "!", { fun: 15 + correct * 4, social: 10, energy: -10, _earn: Math.round(won) });
    };
    fbEl.parentElement.appendChild(done);
  };

  showQ();
}
