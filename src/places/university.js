// src/places/university.js — Kaduna Polytechnic (KADPOLY) main campus
// FEATURE (Oct 25): full KASU-style expansion requested by the owner — the poly
// now packs 20 FUN activities: lectures, library, textbook shop, football /
// basketball / volleyball, sprint race, WORKSHOP practice (welding) + engine
// repair (the polytechnic signature!), KADPOLY QUIZ mini-game with real prize
// money, karaoke, talent show, debate club, campus party, neem-tree hangout,
// hostel rest + the big three: EXAM SEASON, HOSTEL PARTY and GRADUATION.
import * as THREE from "three";
import { box, mergedMesh, signMesh, floor, interiorLights, disposeGroup } from "./_helpers.js";
import { rng } from "../config.js";
import { spawnPeople, getNamedDialogue, getDialogue } from "./people.js";
import { celebrate } from "../celebrate.js";

let _built = false, _cache = null;

export async function build(scene, ctx) {
  if (_built) return _cache;
  const R = rng(20251025);
  const group = new THREE.Group();
  group.name = "university_campus"; group.visible = false;

  group.add(floor(90, 70, 0x5a8a3a));
  // Entrance plaza circle
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(6, 24), new THREE.MeshLambertMaterial({ color: 0xd8cfb4 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.022, 26); group.add(plaza);

  // ---- Football field ----
  const field = new THREE.Mesh(new THREE.PlaneGeometry(30, 18), new THREE.MeshLambertMaterial({ color: 0x4a7a2a }));
  field.rotation.x = -Math.PI / 2; field.position.set(0, 0.02, 5); group.add(field);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const cl = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 18), lineMat); cl.rotation.x = -Math.PI / 2; cl.position.set(0, 0.03, 5); group.add(cl);
  const cc = new THREE.Mesh(new THREE.RingGeometry(2.5, 2.7, 24), lineMat); cc.rotation.x = -Math.PI / 2; cc.position.set(0, 0.03, 5); group.add(cc);
  for (const gx of [-15, 15]) {
    for (const gz of [2, 8]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }));
      p.position.set(gx, 1.25, gz); group.add(p);
    }
    const cb = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    cb.rotation.x = Math.PI / 2; cb.position.set(gx, 2.5, 5); group.add(cb);
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), new THREE.MeshLambertMaterial({ color: 0xf4f1ea }));
  ball.position.set(0, 0.3, 5); group.add(ball);

  // ---- Landmarks ----
  group.add(_buildLectureHall(R));
  group.add(_buildAdmin());
  group.add(_buildLibrary());
  const hostel = _buildHostel(R); hostel.position.set(35, 0, 0); group.add(hostel);
  const cafeteria = _buildCafeteria(R); cafeteria.position.set(-35, 0, 0); group.add(cafeteria);
  group.add(_buildWorkshop());
  group.add(_buildArena());
  group.add(_buildBasketballCourt());
  group.add(_buildVolleyballCourt());
  group.add(_buildBookshop());
  const _flagpole = _buildFlagPole(); group.add(_flagpole);
  group.add(_buildGearObelisk());

  // Trees
  for (let i = 0; i < 12; i++) {
    const tree = _buildTree(R);
    tree.position.set((R() - 0.5) * 80, 0, (R() - 0.5) * 60);
    if (Math.abs(tree.position.x) < 20 && tree.position.z > -5 && tree.position.z < 20) tree.position.x = (tree.position.x > 0 ? 1 : -1) * (20 + R() * 15);
    group.add(tree);
  }
  // Benches (the "gist under the tree" spots)
  for (const [bx, bz, br] of [[-16, 14.6, Math.PI], [16, 12.6, Math.PI], [-24, -10.4, 0], [22, -10.4, 0]]) {
    group.add(mergedMesh([
      box(1.8, 0.1, 0.5, bx, 0.5, bz, 0xa07040),
      box(1.8, 0.45, 0.08, bx, 0.75, bz - 0.24, 0xa07040),
      box(0.1, 0.5, 0.45, bx - 0.8, 0.25, bz, 0x5a4a30),
      box(0.1, 0.5, 0.45, bx + 0.8, 0.25, bz, 0x5a4a30),
    ]));
  }
  // Signs
  const sign = signMesh("KADUNA POLYTECHNIC", 10, 1.5, { width: 500, height: 75, bg: "#1d5fa8", fg: "#fff", size: 30 });
  sign.position.set(0, 4, 32); group.add(sign);
  // Lighting
  group.add(interiorLights({ ambient: 0.7, points: [
    { x: 0, y: 4, z: -25, color: 0xfff0e0, intensity: 0.7, distance: 14 },
    { x: 33, y: 3, z: 0, color: 0xffe0a0, intensity: 0.5, distance: 10 },
    { x: -33, y: 3.5, z: 0, color: 0xfff0c0, intensity: 0.6, distance: 12 },
    { x: -28, y: 4.5, z: 18, color: 0xf2b134, intensity: 0.8, distance: 16 },
    { x: 31, y: 5, z: 13, color: 0xffd9a0, intensity: 0.7, distance: 16 },
  ] }));
  // Colliders
  const colliders = [
    { minX: -5, maxX: 5, minZ: -35, maxZ: -25 },                    // lecture hall
    { minX: 31, maxX: 39, minZ: -4, maxZ: 4 },                      // hostel
    { minX: -40, maxX: -30, minZ: -4, maxZ: 4 },                    // cafeteria
    { minX: -16, maxX: -14, minZ: 1, maxZ: 9 }, { minX: 14, maxX: 16, minZ: 1, maxZ: 9 },  // goalposts
    { minX: -27, maxX: -13, minZ: -32.5, maxZ: -23.5 },             // admin block
    { minX: 13, maxX: 27, minZ: -33, maxZ: -23 },                   // library
    { minX: 24, maxX: 38, minZ: 9, maxZ: 13.5 },                    // workshop machine bay (front open to walk)
    { minX: -32.5, maxX: -23.5, minZ: 14, maxZ: 22 },               // arena stage
    { minX: -15, maxX: -9, minZ: -16.5, maxZ: -11.5 },              // bookshop
  ];
  scene.add(group);
  let _people = null;
  spawnPeople(group, [
    { id: "lecturer1", name: "Dr. Aminu", role: "lecturer", outfit: "kaftan", pose: "stand", x: 0, z: -30, ry: 0, top: "#1d5fa8" },
    { id: "student1", name: "Fatima", role: "student", outfit: "casual", pose: "sit", x: -3, z: -27, ry: 0, top: "#c0392b" },
    { id: "student2", name: "Chidi", role: "student", outfit: "casual", pose: "sit", x: 0, z: -27, ry: 0, top: "#2e7d4f" },
    { id: "student3", name: "Aisha", role: "student", outfit: "casual", pose: "sit", x: 3, z: -27, ry: 0, top: "#f2b134" },
    { id: "student4", name: "Student", role: "student", outfit: "casual", pose: "sit", x: -3, z: -25, ry: 0 },
    { id: "student5", name: "Student", role: "student", outfit: "kaftan", pose: "sit", x: 0, z: -25, ry: 0 },
    { id: "student6", name: "Student", role: "student", outfit: "casual", pose: "sit", x: 3, z: -25, ry: 0 },
    { id: "walker1", name: "Student", role: "student", outfit: "casual", pose: "stand", x: -20, z: 0, ry: 0, route: [{ x: -20, z: 0 }, { x: 20, z: 0 }], speed: 0.8 },
    { id: "walker2", name: "Student", role: "student", outfit: "kaftan", pose: "stand", x: 20, z: 10, ry: Math.PI, route: [{ x: 20, z: 10 }, { x: -20, z: 10 }], speed: 0.7 },
    { id: "cafeteria1", name: "Aunty Rabi", role: "cafeteria cook", outfit: "casual", pose: "stand", x: -35, z: -3, ry: 0, top: "#d98e2b" },
    { id: "player1", name: "Ahmed", role: "footballer", outfit: "casual", pose: "stand", x: -5, z: 5, ry: 0, top: "#c0392b", route: [{ x: -5, z: 5 }, { x: 5, z: 5 }], speed: 1.5 },
    // ---- New KADPOLY cast (Oct 25 expansion) ----
    { id: "kadpoly_rector", name: "Engr. Dr. Bala", role: "rector", outfit: "kaftan", pose: "stand", x: -20, z: -23, ry: 0, top: "#1d5fa8" },
    { id: "kadpoly_exam", name: "Mrs. Okolo", role: "exam officer", outfit: "casual", pose: "stand", x: -24, z: -23, ry: 0, top: "#34495e" },
    { id: "kadpoly_books", name: "Mallam Shehu", role: "bookseller", outfit: "kaftan", pose: "stand", x: -12, z: -10.2, ry: 0, top: "#8a5a3c" },
    { id: "kadpoly_quiz", name: "Mr. Sani", role: "quiz master", outfit: "kaftan", pose: "stand", x: -22.5, z: 20, ry: 0, top: "#1d5fa8" },
    { id: "kadpoly_dj", name: "DJ Bash", role: "DJ", outfit: "casual", pose: "stand", x: -22.5, z: 16, ry: 0, top: "#6b21a8" },
    { id: "kadpoly_grad", name: "Chief Audi", role: "graduation marshal", outfit: "kaftan", pose: "stand", x: -33.8, z: 20, ry: 0, top: "#8a5a3c" },
    { id: "kadpoly_wsi", name: "Engr. Nuhu", role: "workshop instructor", outfit: "casual", pose: "stand", x: 30, z: 8, ry: 0, top: "#f26522" },
    { id: "kadpoly_mech", name: "Uche", role: "mechanic", outfit: "casual", pose: "stand", x: 34, z: 8, ry: 0, top: "#2c3e50" },
    { id: "kadpoly_host", name: "Bilkisu", role: "party host", outfit: "casual", pose: "stand", x: 35, z: 6, ry: Math.PI, top: "#c0392b" },
    { id: "kadpoly_coach", name: "Coach Tunde", role: "coach", outfit: "casual", pose: "stand", x: -18, z: 5, ry: 0, top: "#2e7d4f" },
  ]).then((p) => { _people = p; });

  const _flag = _flagpole.userData.univFlag, _gear = _flagpole.userData.univGear;
  const handle = {
    group, colliders,
    enter(ps) { ps.pos.set(0, 0, 28); ps.heading = Math.PI; },
    exit() {},
    update(dt, now, px, pz) {
      if (_people) _people.update(dt, now, px, pz);
      const t = now / 1000;
      if (_flag) _flag.rotation.y = Math.sin(t * 2.2) * 0.18;
      if (_gear) _gear.rotation.z = t * 0.5;   // the technical-school emblem slowly turns
    },
    dispose() { if (_people) _people.dispose(); scene.remove(group); disposeGroup(group); _built = false; _cache = null; },
    people: () => _people,
    onUIEvent(eid, payload) {
      if (eid === "talk" && payload?.personId) _talk(ctx, payload.personId, _people);
      else if (eid === "attend_lecture") _act(ctx, 0, "🎓 Attended Engineering Maths at LT1! ₦500 stipend. Energy -20", { fun: 5, social: 5, energy: -20, _earn: 500 });
      else if (eid === "study_library") _act(ctx, 0, "📚 You studied hard at KADPOLY Library! Brain +10. Textbook owners ace Quiz Night!", { fun: 8, energy: -15 });
      else if (eid === "eat_cafeteria") _act(ctx, 400, "🍝 Aunty Rabi served rice & beans! Hunger +50", { hunger: 50, fun: 5 });
      else if (eid === "bookshop") _buyTextbook(ctx);
      else if (eid === "play_football") _act(ctx, 0, "⚽ You netted a goal on the KADPOLY field! Fun +25", { fun: 25, social: 15, energy: -15 });
      else if (eid === "play_basketball") _act(ctx, 0, "🏀 Slam dunk! The court dey hot! Fun +22", { fun: 22, social: 10, energy: -18 });
      else if (eid === "play_volleyball") _act(ctx, 0, "🏐 Sweet spike! Your set won the rally! Fun +20", { fun: 20, social: 15, energy: -15 });
      else if (eid === "sprint_race") _act(ctx, 0, "🏃 100m dash in 11.5s! Coach Tunde dey shout 'carry go!'", { fun: 15, energy: -20 });
      else if (eid === "workshop_practice") _act(ctx, 0, "🔧 Workshop practical done — clean welds! A client paid you ₦900!", { fun: 12, energy: -20, _earn: 900 });
      else if (eid === "fix_engine") _act(ctx, 0, "🛠️ You fixed the okada engine first try! Uche gave you ₦800!", { fun: 12, social: 8, energy: -18, _earn: 800 });
      else if (eid === "quiz_night") _openQuiz(ctx);
      else if (eid === "karaoke") _act(ctx, 300, "🎤 You sang 'African Queen' at KADPOLY Arena — the crowd went wild! Fun +30", { fun: 30, social: 15, energy: -10 });
      else if (eid === "talent_show") _act(ctx, 0, "🎭 Your comedy set killed it! Students tipped you ₦800!", { fun: 25, social: 20, energy: -15, _earn: 800 });
      else if (eid === "debate_club") _act(ctx, 0, "🗣️ You won the debate: 'HND vs BSc — which get value?' ₦500 prize!", { social: 25, energy: -10, _earn: 500 });
      else if (eid === "campus_party") _act(ctx, 1000, "🎉 KADPOLY extravaganza turnt! DJ Bash scatter the place!", { fun: 40, social: 25, energy: -15 });
      else if (eid === "hangout") _act(ctx, 0, "🌳 You gisted under the neem tree till sunset. Social +20", { social: 20, fun: 10, energy: -5 });
      else if (eid === "rest_hostel") _act(ctx, 0, "😴 You rested at Block C Hostel. Energy +40", { energy: 40 });
      else if (eid === "write_exam") _writeExam(ctx);
      else if (eid === "hostel_party") _act(ctx, 800, "🪩 Block C block-o! You even did the Risky dance! Fun +35", { fun: 35, social: 25, energy: -15 });
      else if (eid === "graduation") _graduate(ctx);
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

function _graduate(ctx) {
  if (!ctx.game) return;
  if (ctx.game.state.money < 5000) { ctx.toast("Need ₦5,000 for the graduation fee"); return; }
  ctx.game.state.money -= 5000;
  ctx.game.state.kadpolyGraduate = true;
  celebrate("🎓 CONGRATULATIONS, GRADUATE!", "KADPOLY set of '26 — your family dey proud of you!");
  _act(ctx, 0, "🎓 Certificate collected — ND/HND na your own! The Rector shook your hand, confetti everywhere! Fun +50", { fun: 50, social: 30, energy: -20 });
}

function _writeExam(ctx) {
  if (!ctx.game) return;
  const passed = !!ctx.game.state.kadpolyTextbook || Math.random() < 0.55;
  if (passed) {
    celebrate("📝 EXAM PASSED!", "Distinction energy — well done!");
    _act(ctx, 0, "📝 Engineering Maths exam — PASSED! ₦1,500 scholarship alert!" + (ctx.game.state.kadpolyTextbook ? " (textbook carry-over dey work!)" : ""), { fun: 20, social: 5, energy: -25, _earn: 1500 });
  } else {
    _act(ctx, 0, "📝 Chai! The exam tough o. Buy the textbook at the bookshop for a guaranteed pass!", { fun: 5, energy: -25 });
  }
}

function _buyTextbook(ctx) {
  if (!ctx.game) return;
  if (ctx.game.state.money < 600) { ctx.toast("Need ₦600 for the textbook"); return; }
  ctx.game.state.money -= 600;
  ctx.game.state.kadpolyTextbook = true;
  ctx.game.save?.(); ctx.updateHUD?.();
  ctx.toast("📖 Bought 'Engineering Mathematics'! Quiz Night winnings now ×1.5!");
}

function _talk(ctx, personId, people) {
  const p = people?.getPersonById?.(personId) || (people?.people || []).find((q) => q.id === personId);
  if (!p) return;
  const line = getNamedDialogue(p.name) || getDialogue(p.role, p.name) || "Sannu!";
  ctx.toast("👤 " + p.name + ": " + line);
}

// ---------- builders (all hand-made from primitives, campus style) ----------

function _buildLectureHall(R) {
  const g = new THREE.Group(); g.position.set(0, 0, -28);
  g.add(mergedMesh([box(12, 5, 8, 0, 2.5, 0, 0xf4f1ea), box(12, 0.3, 8, 0, 4.85, 0, 0x1d5fa8), box(1.2, 2.2, 0.2, 0, 1.1, 4, 0x5a4a30)]));
  const board = new THREE.Mesh(new THREE.PlaneGeometry(6, 2), new THREE.MeshLambertMaterial({ color: 0x1a3a2a }));
  board.position.set(0, 2.5, -3.95); g.add(board);
  g.add(mergedMesh([box(2, 0.1, 1, 0, 0.95, -3, 0x8a6a45), box(0.1, 0.95, 0.1, -0.9, 0.47, -3.4, 0x5a4a30), box(0.1, 0.95, 0.1, 0.9, 0.47, -3.4, 0x5a4a30), box(0.1, 0.95, 0.1, -0.9, 0.47, -2.6, 0x5a4a30), box(0.1, 0.95, 0.1, 0.9, 0.47, -2.6, 0x5a4a30)]));
  for (let row = 0; row < 4; row++) {
    const z = -2 + row * 1.5, y = 0.3 + row * 0.15;
    g.add(mergedMesh([box(8, 0.08, 0.6, 0, y, z, 0xbfa070), box(8, 0.5, 0.05, 0, y - 0.25, z + 0.3, 0x8a6a45), box(0.08, y, 0.08, -3.5, y / 2, z - 0.25, 0x5a4a30), box(0.08, y, 0.08, 1.2, y / 2, z - 0.25, 0x5a4a30), box(0.08, y, 0.08, 3.5, y / 2, z - 0.25, 0x5a4a30)]));
  }
  const s = signMesh("ABDULLAHI ALIYU LECTURE THEATRE", 9.5, 1.1, { width: 520, height: 70, bg: "#1d5fa8", fg: "#fff", size: 26 });
  s.position.set(0, 5.9, 4.2); g.add(s);
  return g;
}

function _buildAdmin() {
  // 2-storey admin block — Rector's office (KADPOLY blue band)
  const g = new THREE.Group(); g.position.set(-20, 0, -28);
  g.add(mergedMesh([
    box(14, 8, 8, 0, 4, 0, 0xf4f1ea),
    box(14, 1, 8.3, 0, 5.6, 0, 0x1d5fa8),
    box(14.6, 0.5, 8.6, 0, 8.2, 0, 0x1d5fa8),
    box(14, 0.4, 8.4, 0, 0.3, 0, 0xb5a68b),
  ]));
  for (const cx of [-5, -2.5, 0, 2.5, 5]) g.add(mergedMesh([box(0.9, 5.5, 0.9, cx, 2.75, 4.3, 0xe8e2d2)]));
  g.add(mergedMesh([box(4, 3, 0.4, 0, 1.5, 4.15, 0x7ec8ff)]));
  for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) {
    if (r === 0 && Math.abs(-6 + i * 3) < 2.5) continue;
    g.add(mergedMesh([box(1.6, 1.5, 0.2, -6 + i * 3, 4.4 + r * 2.4, -4.05, 0x7ec8ff)]));
  }
  const s1 = signMesh("KADPOLY ADMIN BLOCK", 9, 1.3, { width: 480, height: 76, bg: "#1d5fa8", fg: "#fff", size: 30 });
  s1.position.set(0, 6.9, 4.4); g.add(s1);
  const s2 = signMesh("RECTOR'S OFFICE", 5.5, 0.8, { width: 400, height: 60, bg: "#ffffff", fg: "#1d5fa8", size: 24 });
  s2.position.set(0, 3.6, 4.45); g.add(s2);
  return g;
}

function _buildLibrary() {
  const g = new THREE.Group(); g.position.set(20, 0, -28);
  g.add(mergedMesh([
    box(15, 6.5, 10, 0, 3.25, 0, 0xf1ece0),
    box(15.5, 0.5, 10.5, 0, 6.7, 0, 0x1d5fa8),
    box(3.2, 1.1, 3.4, 0, 7.4, 0, 0xf1ece0),
    box(1, 2.6, 0.4, 0, 1.3, 5.05, 0x5a4a30),
  ]));
  for (let i = 0; i < 5; i++) g.add(mergedMesh([box(1.7, 3.2, 0.2, -5.5 + i * 2.75, 3.6, 5.05, 0x9fc2d9)]));
  g.add(mergedMesh([box(6, 0.25, 1.2, 0, 0.12, 5.8, 0xd8cfb4), box(6, 0.25, 1.2, 0, 0.36, 5.2, 0xcfc5a8)]));
  const s1 = signMesh("KADPOLY LIBRARY", 8, 1.4, { width: 460, height: 80, bg: "#1d5fa8", fg: "#f2b134", size: 32 });
  s1.position.set(0, 5.9, 5.25); g.add(s1);
  return g;
}

function _buildHostel(R) {
  const g = new THREE.Group();
  g.add(mergedMesh([box(10, 4, 8, 0, 2, 0, 0xe8d3b0), box(10, 0.3, 8, 0, 3.85, 0, 0x2e7d4f), box(1.2, 2.2, 0.2, 0, 1.1, 4, 0x5a4a30)]));
  for (let i = 0; i < 3; i++) {
    const bunk = mergedMesh([box(2, 0.1, 1, 0, 0.6, 0, 0x8a6a45), box(2, 0.1, 1, 0, 1.8, 0, 0x8a6a45), box(0.1, 2.4, 0.1, -0.95, 1.2, -0.45, 0x5a4a30), box(0.1, 2.4, 0.1, 0.95, 1.2, -0.45, 0x5a4a30), box(0.1, 2.4, 0.1, -0.95, 1.2, 0.45, 0x5a4a30), box(0.1, 2.4, 0.1, 0.95, 1.2, 0.45, 0x5a4a30), box(1.8, 0.15, 0.9, 0, 0.7, 0, 0xc0392b), box(1.8, 0.15, 0.9, 0, 1.9, 0, 0x1d5fa8)]);
    bunk.position.set(-3 + i * 3, 0, -1); g.add(bunk);
  }
  const s1 = signMesh("BLOCK C HOSTEL", 6.5, 1, { width: 420, height: 70, bg: "#2e7d4f", fg: "#fff", size: 28 });
  s1.position.set(0, 4.9, 4.2); g.add(s1);
  return g;
}

function _buildCafeteria(R) {
  const g = new THREE.Group();
  g.add(mergedMesh([box(12, 4, 8, 0, 2, 0, 0xf4f1ea), box(12, 0.3, 8, 0, 3.85, 0, 0xf2b134), box(1.2, 2.2, 0.2, 0, 1.1, 4, 0x5a4a30)]));
  g.add(mergedMesh([box(8, 1, 0.6, 0, 0.5, -3.5, 0x8a6a45), box(8, 0.1, 0.7, 0, 1.05, -3.5, 0xbfa070), box(8, 0.6, 0.05, 0, 1.5, -3.4, 0x9fc2d9)]));
  for (let i = 0; i < 4; i++) {
    const foodColors = [0xc0392b, 0xf2b134, 0x2e7d4f, 0x8a5a3c];
    const pan = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 0.5), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6, roughness: 0.3 }));
    pan.position.set(-3 + i * 2, 1.15, -3.5); g.add(pan);
    const food = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.4), new THREE.MeshLambertMaterial({ color: foodColors[i] }));
    food.position.set(-3 + i * 2, 1.24, -3.5); g.add(food);
  }
  for (const [tx, tz] of [[-2.5, 0], [2.5, 0], [-2.5, 2], [2.5, 2]]) {
    const table = mergedMesh([box(1.5, 0.08, 1, tx, 0.8, tz, 0xbfa070), box(0.1, 0.8, 0.1, tx - 0.65, 0.4, tz - 0.4, 0x5a4a30), box(0.1, 0.8, 0.1, tx + 0.65, 0.4, tz - 0.4, 0x5a4a30), box(0.1, 0.8, 0.1, tx - 0.65, 0.4, tz + 0.4, 0x5a4a30), box(0.1, 0.8, 0.1, tx + 0.65, 0.4, tz + 0.4, 0x5a4a30)]);
    g.add(table);
  }
  const s1 = signMesh("KADPOLY CAFETERIA", 8, 1.2, { width: 460, height: 76, bg: "#d98e2b", fg: "#fff", size: 30 });
  s1.position.set(0, 5, 4.3); g.add(s1);
  return g;
}

function _buildWorkshop() {
  // The polytechnic signature: an open Engineering Workshop — corrugated roof
  // on steel pillars, lathe benches, anvil, tool racks and an okada on blocks.
  const g = new THREE.Group(); g.position.set(31, 0, 13);
  // Concrete slab + roof
  g.add(mergedMesh([box(16, 0.15, 12, 0, 0.08, 0, 0xb9b3a4)]));
  g.add(mergedMesh([box(16.5, 0.4, 12.5, 0, 5.4, 0, 0x8f979e)]));
  g.add(mergedMesh([box(16.8, 0.3, 0.4, 0, 5.15, 6.1, 0xf26522)]));
  for (const [px, pz] of [[-7.5, -5.5], [0, -5.5], [7.5, -5.5], [-7.5, 5.5], [0, 5.5], [7.5, 5.5]]) {
    g.add(mergedMesh([box(0.4, 5.2, 0.4, px, 2.6, pz, 0x3a3f45)]));
  }
  // Machine bay (collider behind): 3 lathes + benches
  g.add(mergedMesh([box(10, 1, 1.4, 0, 0.5, -3.4, 0x8a6a45)]));
  for (let i = 0; i < 3; i++) {
    const lx = -3.5 + i * 3.5;
    g.add(mergedMesh([
      box(1.8, 0.5, 0.9, lx, 1.25, -3.4, 0x2f7d4f),
      box(0.14, 0.9, 0.14, lx + 0.5, 1.95, -3.4, 0xdadada),
      box(0.5, 0.35, 0.4, lx - 0.4, 1.7, -3.4, 0x3a3f45),
    ]));
  }
  // Tool wall + anvil
  g.add(mergedMesh([box(4, 2.2, 0.25, 6.5, 1.1, -5.7, 0x5a4a30)]));
  for (let i = 0; i < 5; i++) g.add(mergedMesh([box(0.12, 0.7, 0.12, 5 + i * 0.7, 1.4, -5.5, [0xc0392b, 0xf2b134, 0x2e7d4f, 0x1d5fa8, 0x8a5a3c][i])]));
  g.add(mergedMesh([box(0.9, 0.55, 0.45, -5.5, 0.85, -3.4, 0x4a4f55), box(0.35, 0.75, 0.35, -5.5, 0.38, -3.4, 0x3a3f45)]));
  // Okada on repair blocks (Uche's bay)
  const bike = mergedMesh([
    box(2.2, 0.35, 0.5, 0, 0.85, 3.5, 0xc0392b),
    box(0.9, 0.5, 0.4, -0.4, 1.2, 3.5, 0x2b2f35),
    box(0.12, 0.9, 0.12, 1.05, 0.45, 3.5, 0x3a3f45),
    box(0.12, 0.9, 0.12, -1.05, 0.45, 3.5, 0x3a3f45),
    box(1.6, 0.15, 0.35, 0.2, 1.5, 3.5, 0x2b2f35),
  ]);
  g.add(bike);
  // Welding sparks glow
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc24d }));
  spark.position.set(-3.5, 1.8, -3); g.add(spark);
  g.userData.univSpark = spark;
  const s1 = signMesh("ENGINEERING WORKSHOP", 10, 1.3, { width: 500, height: 76, bg: "#f26522", fg: "#fff", size: 30 });
  s1.position.set(0, 4.4, 6.4); g.add(s1);
  return g;
}

function _buildArena() {
  // Open-air KADPOLY Arena: karaoke, talent show, quiz night, parties
  const g = new THREE.Group(); g.position.set(-28, 0, 18);
  g.add(mergedMesh([
    box(9, 1.2, 8, 0, 0.6, 0, 0x8a5a3c),
    box(9, 0.15, 8, 0, 1.27, 0, 0xa07040),
    box(9.6, 0.4, 0.4, 0, 1.45, -3.9, 0x1d5fa8),
  ]));
  g.add(mergedMesh([box(9, 5, 0.5, 0, 3.5, -3.6, 0x123c66)]));
  const bd = signMesh("★ KADPOLY ARENA ★", 8, 1.6, { width: 500, height: 100, bg: "#123c66", fg: "#f2b134", size: 36 });
  bd.position.set(0, 4.6, -3.3); g.add(bd);
  g.add(mergedMesh([
    box(0.08, 1.3, 0.08, 0, 1.95, 1.5, 0x3a3f45),
    box(0.3, 0.18, 0.3, 0, 2.68, 1.5, 0x2b2f35),
  ]));
  for (const sx of [-4, 4]) {
    g.add(mergedMesh([
      box(1, 1.8, 0.8, sx, 0.9, 1.2, 0x2b2f35),
      box(0.6, 0.6, 0.05, sx, 1.1, 1.62, 0x55585e),
      box(0.3, 0.3, 0.05, sx, 1.7, 1.62, 0x55585e),
    ]));
  }
  g.add(mergedMesh([box(8.4, 0.18, 0.18, 0, 6.2, 0.5, 0x3a3f45)]));
  const disco = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshStandardMaterial({ color: 0xc0c8d4, metalness: 0.95, roughness: 0.15 }));
  disco.position.set(0, 5.5, 0.5); g.add(disco);
  const lightColors = [0xe11d48, 0xf2b134, 0x0ea5e9, 0x7a3b8f];
  for (let i = 0; i < 4; i++) {
    const spot = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 8), new THREE.MeshBasicMaterial({ color: lightColors[i] }));
    spot.position.set(-3 + i * 2, 5.9, 0.8); spot.rotation.z = Math.PI; g.add(spot);
  }
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 7; j++) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe6a0 }));
      bulb.position.set(-3.4 + j * 1.15, 4.6 - Math.sin(j / 6 * Math.PI) * 0.5, 4.5 + i * 1.6); g.add(bulb);
    }
  }
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

function _buildBasketballCourt() {
  const g = new THREE.Group(); g.position.set(10, 0, 25);
  const court = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshLambertMaterial({ color: 0xc96f3b }));
  court.rotation.x = -Math.PI / 2; court.position.y = 0.03; g.add(court);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mid = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 7.6), lineMat); mid.rotation.x = -Math.PI / 2; mid.position.y = 0.04; g.add(mid);
  const cc = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.55, 20), lineMat); cc.rotation.x = -Math.PI / 2; cc.position.y = 0.04; g.add(cc);
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
  const g = new THREE.Group(); g.position.set(28, 0, 25);
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

function _buildBookshop() {
  const g = new THREE.Group(); g.position.set(-12, 0, -14);
  g.add(mergedMesh([
    box(6, 3.6, 4.5, 0, 1.8, 0, 0xe9c9a4),
    box(6.5, 0.35, 5, 0, 3.75, 0, 0x1d5fa8),
    box(1.4, 2.3, 0.3, 0, 1.15, 2.3, 0x5a4a30),
  ]));
  for (let i = 0; i < 3; i++) {
    const shelf = mergedMesh([
      box(2.2, 0.08, 0.5, 1.9, 0.7 + i * 0.8, 1.4, 0x8a6a45),
      box(0.9, 0.5, 0.36, 1.6, 0.98 + i * 0.8, 1.4, [0xc0392b, 0x1d5fa8, 0x2e7d4f][i]),
      box(0.9, 0.5, 0.36, 2.5, 0.98 + i * 0.8, 1.4, [0xf2b134, 0x7a3b8f, 0xc0392b][i]),
    ]);
    g.add(shelf);
  }
  const s1 = signMesh("KADPOLY BOOKSHOP", 5, 1, { width: 420, height: 70, bg: "#1d5fa8", fg: "#fff", size: 26 });
  s1.position.set(0, 4.4, 2.4); g.add(s1);
  return g;
}

function _buildFlagPole() {
  const g = new THREE.Group(); g.position.set(7, 0, 30);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 9, 8), new THREE.MeshLambertMaterial({ color: 0xdadada }));
  pole.position.y = 4.5; g.add(pole);
  const flagG = new THREE.Group();
  flagG.add(new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.75), new THREE.MeshLambertMaterial({ color: 0x1f7a5a, side: THREE.DoubleSide })));
  const wm = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.75), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  wm.position.x = 1.1; flagG.add(wm);
  const gm = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.75), new THREE.MeshLambertMaterial({ color: 0x1f7a5a, side: THREE.DoubleSide }));
  gm.position.x = 2.2; flagG.add(gm);
  flagG.position.set(0.06, 7.8, 0);
  g.add(flagG);
  g.userData.univFlag = flagG;
  return g;
}

function _buildGearObelisk() {
  // KADPOLY monument: a stone obelisk crowned with a slowly turning gear
  const g = new THREE.Group(); g.position.set(0, 0, 18);
  g.add(mergedMesh([
    box(2.6, 0.5, 2.6, 0, 0.25, 0, 0xb5a68b),
    box(1.8, 3.2, 1.8, 0, 2, 0, 0xd8cfb4),
    box(1.2, 1.6, 1.2, 0, 4.3, 0, 0xcfc5a8),
  ]));
  const gear = new THREE.Group();
  gear.add(new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.18, 8, 18), new THREE.MeshStandardMaterial({ color: 0xf2b134, metalness: 0.7, roughness: 0.3 })));
  for (let i = 0; i < 8; i++) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshStandardMaterial({ color: 0xf2b134, metalness: 0.7, roughness: 0.3 }));
    const a = (i / 8) * Math.PI * 2;
    tooth.position.set(Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0); tooth.rotation.z = a;
    gear.add(tooth);
  }
  gear.position.set(0, 6, 0); g.add(gear);
  g.userData.univGear = gear;
  const plq = signMesh("KADPOLY • EST. 1956", 3.4, 0.6, { width: 400, height: 60, bg: "#1d5fa8", fg: "#fff", size: 26 });
  plq.position.set(0, 1.4, 1.35); g.add(plq);
  return g;
}

function _buildTree(R) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2.5, 6), new THREE.MeshLambertMaterial({ color: 0x7a5a3a }));
  trunk.position.y = 1.25; g.add(trunk);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 + R() * 0.5, 0), new THREE.MeshLambertMaterial({ color: R() < 0.5 ? 0x3d8c3a : 0x4f9c43 }));
  crown.position.y = 3.5; crown.scale.y = 0.8; g.add(crown);
  return g;
}

// ---------- KADPOLY QUIZ NIGHT mini-game (same rules as KASU Quiz Night) ----------
const QUIZ_BANK = [
  { q: "What does KADPOLY stand for?", opts: ["Kano Polytechnic", "Kaduna Polytechnic", "Kogi Polytechnic", "Kwara Polytechnic"], a: 1 },
  { q: "In what year was Kaduna Polytechnic established?", opts: ["1956", "1968", "1977", "1983"], a: 0 },
  { q: "A polytechnic awards which certificates?", opts: ["SSCE only", "ND and HND", "BSc and MSc", "Diploma only"], a: 1 },
  { q: "The head of a polytechnic is called the…?", opts: ["Vice Chancellor", "Provost", "Rector", "Dean"], a: 2 },
  { q: "The name 'Kaduna' comes from the Hausa word for…?", opts: ["Lions", "Elephants", "Crocodiles", "Rivers"], a: 2 },
  { q: "SIWES stands for…?", opts: ["Students Industrial Work Experience Scheme", "School of International Studies", "Skill Improvement & Work Exam Scheme", "Student Internship Weekend Scheme"], a: 0 },
  { q: "Which river flows through Kaduna city?", opts: ["River Niger", "River Benue", "Kaduna River", "Hadejia River"], a: 2 },
  { q: "Nigeria's capital city is…?", opts: ["Lagos", "Abuja", "Kano", "Port Harcourt"], a: 1 },
  { q: "Nigeria's official currency is the…?", opts: ["Cedi", "Naira", "Rand", "Shilling"], a: 1 },
  { q: "Nigeria's national football team is called…?", opts: ["Super Eagles", "Red Devils", "Black Stars", "Chipolopolo"], a: 0 },
  { q: "The highest naira note in circulation is…?", opts: ["₦500", "₦200", "₦1000", "₦100"], a: 2 },
  { q: "A lathe is a machine used to…?", opts: ["Paint walls", "Shape metal by turning", "Mix cement", "Print books"], a: 1 },
  { q: "Welding joins two pieces of metal using…?", opts: ["Glue", "Ropes", "Heat", "Screws"], a: 2 },
  { q: "Ahmadu Bello University (ABU) is located in…?", opts: ["Lagos", "Ibadan", "Kano", "Zaria"], a: 3 },
  { q: "Kaduna State is popularly called the ______ of Learning.", opts: ["Garden", "Centre", "Heart", "Home"], a: 1 },
];

function _shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function _openQuiz(ctx) {
  if (document.getElementById("kadpoly-quiz-modal")) return;
  if (!ctx.game) return;
  const textbook = !!ctx.game.state.kadpolyTextbook;
  const MULT = textbook ? 1.5 : 1;
  const QUESTIONS = _shuffle(QUIZ_BANK).slice(0, 5);
  let qi = 0, won = 0, correct = 0;

  const overlay = document.createElement("div");
  overlay.id = "kadpoly-quiz-modal";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(6,18,34,.88);z-index:95;display:flex;align-items:center;justify-content:center;padding:14px;";
  overlay.innerHTML =
    '<div style="width:min(420px,94vw);background:linear-gradient(160deg,#123c66,#1d5fa8);border-radius:18px;padding:18px;color:#fff;font-family:Poppins,system-ui,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.18);">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
        '<div style="font-size:20px;font-weight:800;flex:1;">🧠 KADPOLY QUIZ NIGHT</div>' +
        '<button id="kadpoly-quiz-x" style="background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:10px;padding:5px 10px;font-weight:700;cursor:pointer;">✕</button>' +
      '</div>' +
      '<div style="font-size:11px;opacity:.85;margin-bottom:10px;">' + (textbook ? "📖 Textbook bonus ACTIVE — winnings ×1.5!" : "Mr. Sani hosts! ₦500 per correct answer + ₦2000 for 5/5") + '</div>' +
      '<div style="height:7px;background:rgba(255,255,255,.18);border-radius:4px;overflow:hidden;margin-bottom:14px;"><div id="kadpoly-quiz-prog" style="height:100%;width:0;background:#f2b134;border-radius:4px;transition:width .3s;"></div></div>' +
      '<div id="kadpoly-quiz-q" style="font-size:15px;font-weight:700;margin-bottom:12px;min-height:44px;"></div>' +
      '<div id="kadpoly-quiz-opts" style="display:flex;flex-direction:column;gap:8px;"></div>' +
      '<div id="kadpoly-quiz-fb" style="margin-top:10px;font-size:13px;font-weight:700;min-height:18px;"></div>' +
      '<button id="kadpoly-quiz-next" style="display:none;width:100%;margin-top:6px;background:#f2b134;color:#123c66;border:none;border-radius:12px;padding:11px;font:800 14px Poppins,sans-serif;cursor:pointer;">Next question →</button>' +
    '</div>';
  document.body.appendChild(overlay);

  const $ = (id) => document.getElementById(id);
  const qEl = $("kadpoly-quiz-q"), optsEl = $("kadpoly-quiz-opts"), fbEl = $("kadpoly-quiz-fb"), nextEl = $("kadpoly-quiz-next"), progEl = $("kadpoly-quiz-prog");
  let finished = false, collected = false;

  function close() { overlay.remove(); }
  $("kadpoly-quiz-x").onclick = () => {
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
      b.style.cssText = "text-align:left;background:rgba(255,255,255,.94);color:#123c66;border:none;border-radius:11px;padding:11px 13px;font:700 13px Poppins,sans-serif;cursor:pointer;transition:transform .12s;";
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
    if (correct === 5) rank = "🏆 PERFECT SCORE! You be distinction KADPOLY student!";
    else if (correct >= 3) rank = "🎖️ Solid performance! Upper credit level!";
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
    done.style.cssText = "width:100%;margin-top:10px;background:#f2b134;color:#123c66;border:none;border-radius:12px;padding:11px;font:800 14px Poppins,sans-serif;cursor:pointer;";
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
