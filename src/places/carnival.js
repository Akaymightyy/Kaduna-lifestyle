// src/places/carnival.js — Kaduna Carnival at Murtala Square
// FEATURE (Oct 24): festival grounds with an ANIMATED Ferris wheel, spinning
// carousel, parade floats, drummers' stage, food stalls and game booths.
// 13 activities including the CARNIVAL DANCE-OFF rhythm mini-game
// (win up to ₦4,000), masquerade parade and fireworks with confetti.
import * as THREE from "three";
import { box, mergedMesh, signMesh, floor, interiorLights, disposeGroup } from "./_helpers.js";
import { rng } from "../config.js";
import { spawnPeople, getNamedDialogue, getDialogue } from "./people.js";
import { celebrate } from "../celebrate.js";

let _built = false, _cache = null;

export async function build(scene, ctx) {
  if (_built) return _cache;
  const R = rng(20251026);
  const group = new THREE.Group();
  group.name = "carnival_grounds"; group.visible = false;

  // ---- Ground: red-earth festival ground ----
  group.add(floor(90, 66, 0xb5651d));
  const danceFloor = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), new THREE.MeshLambertMaterial({ color: 0x1f4d2e }));
  danceFloor.rotation.x = -Math.PI / 2; danceFloor.position.set(0, 0.03, 2); group.add(danceFloor);
  // Checker tiles on the dance floor
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    if ((i + j) % 2) continue;
    const tile = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshLambertMaterial({ color: 0xf2b134 }));
    tile.rotation.x = -Math.PI / 2; tile.position.set(-6 + i * 4, 0.04, 4 - j * 4); group.add(tile);
  }
  // Entrance plaza
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(6, 24), new THREE.MeshLambertMaterial({ color: 0xd8cfb4 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.023, 26); group.add(plaza);

  // ---- Rides & structures ----
  const ferris = _buildFerrisWheel(); group.add(ferris);
  const carousel = _buildCarousel(); group.add(carousel);
  group.add(_buildStage());
  group.add(_buildBouncyCastle());
  group.add(_buildBooth("🎯 RING TOSS", 24, 18, 0x1d5fa8));
  group.add(_buildBooth("🎈 BALLOON DARTS", 24, 8, 0xc0392b));
  group.add(_buildFoodStall("🍢 SUYA STAND", -26, 18, 0xd98e2b));
  group.add(_buildFoodStall("🥛 FURA & KUNU", -26, 8, 0xf4f1ea));
  group.add(_buildFloat(-40, -14, 0xf2b134, "🎺"));
  group.add(_buildFloat(-14, -20, 0x7a3b8f, "🥁"));

  // ---- Flags + bunting + lights ----
  const flagCols = [0xe11d48, 0xf2b134, 0x1d5fa8, 0x2e7d4f, 0x7a3b8f];
  for (let i = 0; i < 8; i++) {
    const pole = mergedMesh([box(0.12, 5, 0.12, 0, 2.5, 0, 0x8a8f96)]);
    pole.position.set(-35 + i * 10, 0, 30); group.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), new THREE.MeshLambertMaterial({ color: flagCols[i % 5], side: THREE.DoubleSide }));
    flag.position.set(-34.6 + i * 10, 4.4, 30); group.add(flag);
  }
  // String lights across the dance floor
  const _bulbs = [];
  for (let j = 0; j < 9; j++) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe6a0 }));
    bulb.position.set(-12 + j * 3, 4.2 - Math.sin((j / 8) * Math.PI) * 0.7, 2); group.add(bulb);
    _bulbs.push(bulb);
  }

  // ---- Trees around the edge ----
  for (const [tx, tz] of [[-40, 26], [40, 26], [-42, -2], [42, -2], [-38, -24], [38, -24], [-8, 28], [8, 28]]) {
    const tree = _buildTree(R);
    tree.position.set(tx, 0, tz); group.add(tree);
  }

  // ---- Perimeter fence + gate (Murtala Square festival arch) ----
  const fenceMat = new THREE.MeshLambertMaterial({ color: 0xd8c8a8 });
  for (const [fx, fz, fw, fd] of [
    [0, -33, 92, 0.5], [-45, 0, 0.5, 66], [45, 0, 0.5, 66],
    [-24, 33, 42, 0.5], [24, 33, 42, 0.5],
  ]) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(fw, 2.2, fd), fenceMat);
    seg.position.set(fx, 1.1, fz); group.add(seg);
  }
  for (const gx of [-7, 7]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 1), new THREE.MeshLambertMaterial({ color: 0xe11d48 }));
    post.position.set(gx, 3, 33); group.add(post);
  }
  const gateBeam = new THREE.Mesh(new THREE.BoxGeometry(15, 1.5, 1.2), new THREE.MeshLambertMaterial({ color: 0xe11d48 }));
  gateBeam.position.set(0, 6.2, 33); group.add(gateBeam);
  // Little tent roofs on the gate posts
  for (const gx of [-7, 7]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.2, 8), new THREE.MeshLambertMaterial({ color: 0xf2b134 }));
    cone.position.set(gx, 6.7, 33); group.add(cone);
  }
  const gateSign = signMesh("🎪 KADUNA CARNIVAL 🎪", 13, 1.9, { width: 760, height: 100, bg: "#e11d48", fg: "#ffffff", size: 32 });
  gateSign.position.set(0, 8.1, 32.6); group.add(gateSign);
  const motto = signMesh("MURTALA SQUARE FESTIVAL • FUN FOR EVERYBODY", 10, 0.9, { width: 720, height: 60, bg: "#ffffff", fg: "#e11d48", size: 24 });
  motto.position.set(0, 6.3, 32.6); group.add(motto);

  // ---- Lighting ----
  group.add(interiorLights({ ambient: 0.78, points: [{ x: 0, y: 6, z: 2, color: 0xffe0b0, intensity: 0.65, distance: 24 }, { x: 30, y: 5, z: 14, color: 0xff9a5a, intensity: 0.5, distance: 16 }, { x: -30, y: 5, z: 14, color: 0xff9a5a, intensity: 0.5, distance: 16 }] }));

  // ---- Colliders ----
  const colliders = [
    { minX: -33, maxX: -19, minZ: 20, maxZ: 26 },    // ferris base
    { minX: 19, maxX: 27, minZ: 16, maxZ: 24 },      // carousel
    { minX: -9, maxX: 9, minZ: -22, maxZ: -14 },     // stage
    { minX: 18, maxX: 30, minZ: 14, maxZ: 22 },      // ring toss booth
    { minX: 18, maxX: 30, minZ: 4, maxZ: 12 },       // balloon darts booth
    { minX: -30, maxX: -18, minZ: 14, maxZ: 22 },    // suya stand
    { minX: -30, maxX: -18, minZ: 4, maxZ: 12 },     // fura stand
    { minX: 16, maxX: 30, minZ: 26, maxZ: 31 },      // bouncy castle
    { minX: -44, maxX: -34, minZ: -18, maxZ: -8 },   // float 1
    { minX: -18, maxX: -8, minZ: -24, maxZ: -14 },   // float 2
  ];

  scene.add(group);

  // ---- People of the Carnival ----
  let _people = null;
  spawnPeople(group, [
    { id: "carn_mc", name: "Queen Ada", role: "carnival MC", outfit: "casual", pose: "stand", x: 0, z: -12.5, ry: 0, top: "#e11d48" },
    { id: "carn_drums", name: "Baba Ola", role: "drummer", outfit: "kaftan", pose: "stand", x: -3.5, z: -12.8, ry: 0, top: "#8a5a3c" },
    { id: "carn_drums2", name: "Drummer", role: "drummer", outfit: "kaftan", pose: "stand", x: 3.5, z: -12.8, ry: 0, top: "#7a4413" },
    { id: "carn_paint", name: "Ngozi", role: "face painter", outfit: "casual", pose: "stand", x: 21, z: 3, ry: 0, top: "#7a3b8f" },
    { id: "carn_booth", name: "Eddy", role: "booth attendant", outfit: "casual", pose: "stand", x: 21, z: 13, ry: 0, top: "#1d5fa8" },
    { id: "carn_suya", name: "Mallam Bello", role: "zoo vendor", outfit: "kaftan", pose: "stand", x: -23, z: 13, ry: 0, top: "#d98e2b" },
    { id: "carn_dancer1", name: "Dancer", role: "visitor", outfit: "casual", pose: "sit", x: -4, z: 8.5, ry: Math.PI, top: "#f2b134" },
    { id: "carn_dancer2", name: "Dancer", role: "visitor", outfit: "casual", pose: "sit", x: 4, z: 8.5, ry: Math.PI, top: "#2e7d4f" },
    { id: "carn_walker1", name: "Visitor", role: "visitor", outfit: "casual", pose: "stand", x: 0, z: 20, ry: Math.PI, route: [{ x: 0, z: 20 }, { x: 16, z: 20 }, { x: 16, z: 0 }], speed: 0.8 },
    { id: "carn_walker2", name: "Visitor", role: "visitor", outfit: "casual", pose: "stand", x: -16, z: 0, ry: 0, route: [{ x: -16, z: 0 }, { x: -16, z: 20 }, { x: 0, z: 20 }], speed: 0.75 },
  ]).then((p) => { _people = p; });

  // Animated bits: ferris + carousel + bulbs glow
  const _fWheel = group.userData.carnFerris, _cTurn = group.userData.carnCarousel, _cHorses = group.userData.carnHorses;
  const handle = {
    group, colliders,
    enter(ps) { ps.pos.set(0, 0, 28); ps.heading = Math.PI; },
    exit() {},
    update(dt, now, px, pz) {
      if (_people) _people.update(dt, now, px, pz);
      const t = now / 1000;
      if (_fWheel) {
        _fWheel.rotation.z = t * 0.22;                       // wheel turns
        for (const gondola of _fWheel.userData.gondolas) gondola.rotation.z = -t * 0.22;  // they stay upright
      }
      if (_cTurn) _cTurn.rotation.y = t * 0.55;
      if (_cHorses) for (let i = 0; i < _cHorses.length; i++) _cHorses[i].position.y = 1.35 + Math.sin(t * 3 + i * 1.3) * 0.22;
      const glow = 0.7 + Math.sin(t * 2.4) * 0.3;
      for (const b of _bulbs) b.material.color.setRGB(glow, glow * 0.9, glow * 0.62);
    },
    dispose() { if (_people) _people.dispose(); scene.remove(group); disposeGroup(group); _built = false; _cache = null; },
    people: () => _people,
    onUIEvent(eid, payload) {
      if (eid === "talk" && payload?.personId) _talk(ctx, payload.personId, _people);
      else if (eid === "ride_ferris") _act(ctx, 1000, "🎡 The Ferris wheel lifted you high — you saw the WHOLE city! Fun +35", { fun: 35, social: 10, energy: -5 });
      else if (eid === "ride_carousel") _act(ctx, 500, "🎠 Round and round on the carousel — pure classic joy! Fun +22", { fun: 22, energy: -5 });
      else if (eid === "dance_contest") _openDanceOff(ctx);
      else if (eid === "watch_parade") _act(ctx, 0, "🎺 The parade floated past with dancers and drummers — sweet vibes!", { fun: 20, social: 8, energy: -5 });
      else if (eid === "drum_circle") _act(ctx, 0, "🥁 Baba Ola taught you the gangan rhythm — gbam gbam PA! Social +20", { fun: 18, social: 20, energy: -8 });
      else if (eid === "ring_toss") _boothGame(ctx, 300, 1000, 0.35, "🎯", "ring toss");
      else if (eid === "balloon_dart") _boothGame(ctx, 300, 1200, 0.3, "🎈", "balloon darts");
      else if (eid === "festival_food") _act(ctx, 500, "🍢 Suya hot suya! Kilishi sef dey! Hunger +45", { hunger: 45, fun: 8 });
      else if (eid === "fura_drink") _act(ctx, 300, "🥛 Fura da nono — cold and creamy! Hunger +25", { hunger: 25, fun: 5 });
      else if (eid === "face_paint") _act(ctx, 400, "🎨 Ngozi painted a lion face on you — everybody dey hail you! Fun +18", { fun: 18, social: 12 });
      else if (eid === "costume_parade") _act(ctx, 0, "🥳 You joined the masquerade parade and danced through the grounds!", { fun: 30, social: 20, energy: -12 });
      else if (eid === "fireworks") { celebrate("🎆 KABOOM! FIREWORKS!", "Kaduna Carnival lights up the sky!"); _act(ctx, 0, "🎆 The fireworks painted the whole sky! Kaduna no dey disappoint!", { fun: 30, social: 10 }); }
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

function _talk(ctx, personId, people) {
  const p = people?.getPersonById?.(personId) || (people?.people || []).find((q) => q.id === personId);
  if (!p) return;
  const line = getNamedDialogue(p.name) || getDialogue(p.role, p.name) || "Sannu!";
  ctx.toast("👤 " + p.name + ": " + line);
}

function _boothGame(ctx, entry, prize, chance, icon, name) {
  if (!ctx.game) return;
  if (ctx.game.state.money < entry) { ctx.toast("Need ₦" + entry.toLocaleString() + " to play"); return; }
  ctx.game.state.money -= entry;
  if (Math.random() < chance) {
    celebrate(icon + " YOU WIN!", "₦" + prize.toLocaleString() + " from the " + name + " booth!");
    _act(ctx, 0, icon + " " + name.toUpperCase() + " JACKPOT! You won ₦" + prize.toLocaleString() + "! Fun +25", { fun: 25, social: 8, _earn: prize });
  } else {
    _act(ctx, 0, icon + " Osofa! You missed. Try again — the next one fit enter!", { fun: 8, social: 4 });
  }
}

// ---------- CARNIVAL DANCE-OFF rhythm mini-game ----------
// 5 beats: a marker slides across a bar; tap "HIT!" when it's in the green
// zone. Perfect (±9%) = ₦600, Good (±22%) = ₦300, Miss = ₦0.
// ₦1,000 bonus for 5 perfects. Max ₦4,000.
function _openDanceOff(ctx) {
  if (document.getElementById("carn-dance-modal")) return;
  if (!ctx.game) return;
  const BEATS = 5;
  let beat = 0, pos = 0, dir = 1, speed = 0.55, won = 0, perfects = 0, raf = 0, finished = false, collected = false, locked = false;

  const overlay = document.createElement("div");
  overlay.id = "carn-dance-modal";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(30,6,14,.9);z-index:95;display:flex;align-items:center;justify-content:center;padding:14px;";
  overlay.innerHTML =
    '<div style="width:min(420px,94vw);background:linear-gradient(160deg,#e11d48,#7a1030);border-radius:18px;padding:18px;color:#fff;font-family:Poppins,system-ui,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.2);">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
        '<div style="font-size:20px;font-weight:800;flex:1;">💃 CARNIVAL DANCE-OFF</div>' +
        '<button id="carn-dance-x" style="background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:10px;padding:5px 10px;font-weight:700;cursor:pointer;">✕</button>' +
      '</div>' +
      '<div style="font-size:11px;opacity:.85;margin-bottom:10px;">Queen Ada hosts! Hit the beat: PERFECT = ₦600 · GOOD = ₦300 · 5 perfects = ₦1,000 bonus!</div>' +
      '<div id="carn-dance-count" style="font-size:13px;font-weight:800;color:#f2b134;margin-bottom:6px;">Beat 1 of 5</div>' +
      '<div style="position:relative;height:34px;background:rgba(0,0,0,.35);border-radius:10px;overflow:hidden;margin-bottom:6px;">' +
        '<div style="position:absolute;left:41%;width:18%;top:0;bottom:0;background:rgba(242,177,52,.35);"></div>' +
        '<div style="position:absolute;left:47.5%;width:5%;top:0;bottom:0;background:#4ade80;"></div>' +
        '<div id="carn-dance-marker" style="position:absolute;top:2px;bottom:2px;width:6px;background:#fff;border-radius:3px;left:0;box-shadow:0 0 8px rgba(255,255,255,.8);"></div>' +
      '</div>' +
      '<div id="carn-dance-fb" style="margin:8px 0;font-size:15px;font-weight:800;min-height:22px;text-align:center;"></div>' +
      '<button id="carn-dance-hit" style="width:100%;background:#f2b134;color:#7a1030;border:none;border-radius:12px;padding:14px;font:800 17px Poppins,sans-serif;cursor:pointer;">HIT THE BEAT! 🥁</button>' +
      '<button id="carn-dance-collect" style="display:none;width:100%;margin-top:8px;background:#4ade80;color:#0f2d1e;border:none;border-radius:12px;padding:12px;font:800 14px Poppins,sans-serif;cursor:pointer;">Collect winnings & close</button>' +
    '</div>';
  document.body.appendChild(overlay);
  const $ = (id) => document.getElementById(id);
  const markerEl = $("carn-dance-marker"), fbEl = $("carn-dance-fb"), countEl = $("carn-dance-count");
  const hitEl = $("carn-dance-hit"), collectEl = $("carn-dance-collect");
  let last = performance.now();

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!locked && !finished) {
      pos += dir * speed * dt * 100;
      if (pos > 100) { pos = 100; dir = -1; }
      if (pos < 0) { pos = 0; dir = 1; }
      markerEl.style.left = "calc(" + pos.toFixed(2) + "% - 3px)";
    }
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  function close() { cancelAnimationFrame(raf); overlay.remove(); }
  $("carn-dance-x").onclick = () => {
    close();
    if (!finished && beat > 0) _act(ctx, 0, "💃 Dance-Off closed early — you won ₦" + won.toLocaleString() + "!", { fun: 10, energy: -5 });
  };

  hitEl.onclick = () => {
    if (finished || locked) return;
    locked = true;
    const off = Math.abs(pos - 50);
    let prize = 0, label = "", col = "#fff";
    if (off <= 9) { prize = 600; perfects++; label = "PERFECT! +₦600"; col = "#4ade80"; }
    else if (off <= 22) { prize = 300; label = "GOOD! +₦300"; col = "#f2b134"; }
    else { label = "MISS! Off-beat 😅"; col = "#fca5a5"; }
    won += prize;
    fbEl.style.color = col;
    fbEl.textContent = label;
    setTimeout(() => {
      locked = false; pos = 0; dir = 1; speed += 0.16;
      beat++;
      if (beat < BEATS) { countEl.textContent = "Beat " + (beat + 1) + " of 5"; fbEl.textContent = ""; }
      else {
        finished = true;
        cancelAnimationFrame(raf);
        hitEl.style.display = "none";
        const bonus = perfects === BEATS ? 1000 : 0;
        won += bonus;
        let rank;
        if (perfects === 5) rank = "🏆 DANCE CHAMPION! Queen Ada bow for you!";
        else if (perfects >= 3) rank = "🎖️ Sweet moves! The crowd dey shout!";
        else if (won > 0) rank = "🕺 You try! Practice makes perfect!";
        else rank = "😅 Two left feet! Come back tomorrow!";
        if (won > 0) celebrate("💃 DANCE-OFF RESULT!", "You won ₦" + won.toLocaleString() + "!");
        fbEl.style.color = "#fff";
        fbEl.innerHTML =
          '<div style="background:rgba(0,0,0,.3);border-radius:12px;padding:12px;text-align:center;">' +
            '<div style="font-size:13px;margin-bottom:4px;">' + rank + '</div>' +
            (bonus ? '<div style="font-size:12px;color:#f2b134;font-weight:800;margin-bottom:4px;">+ ₦1,000 ALL-PERFECT BONUS!</div>' : '') +
            '<div style="font-size:22px;font-weight:800;color:#f2b134;">You won ₦' + won.toLocaleString() + '</div>' +
          '</div>';
        collectEl.style.display = "block";
      }
    }, 550);
  };

  collectEl.onclick = () => {
    if (collected) return;
    collected = true;
    close();
    _act(ctx, 0, "💃 Dance-Off done! " + perfects + "/5 perfect beats — you won ₦" + won.toLocaleString() + "!", { fun: 15 + perfects * 4, social: 12, energy: -12, _earn: won });
  };
}

// ---------- builders ----------

function _buildFerrisWheel() {
  // Animated Ferris wheel — wheel spins, gondolas stay upright (handled in update)
  const g = new THREE.Group(); g.position.set(-26, 0, 23);
  g.add(mergedMesh([
    box(10, 1, 3, 0, 0.5, 0, 0x8a6a45),
    box(1.2, 11, 1.2, -3.4, 5.5, 0, 0x9aa2ad),
    box(1.2, 11, 1.2, 3.4, 5.5, 0, 0x9aa2ad),
  ]));
  const wheel = new THREE.Group();
  wheel.position.set(0, 10.5, 0);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(8.2, 0.3, 8, 30), new THREE.MeshLambertMaterial({ color: 0xe11d48 }));
  wheel.add(rim);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf2b134, metalness: 0.5, roughness: 0.4 }));
  wheel.add(hub);
  const spokeMat = new THREE.MeshLambertMaterial({ color: 0xf4f1ea });
  const gondolas = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 8.2, 5), spokeMat);
    spoke.position.set(Math.cos(a) * 4.1, Math.sin(a) * 4.1, 0);
    spoke.rotation.z = a + Math.PI / 2;
    wheel.add(spoke);
    const gondola = new THREE.Group();
    gondola.position.set(Math.cos(a) * 8.2, Math.sin(a) * 8.2, 0);
    const cab = mergedMesh([
      box(1.5, 1.1, 1.1, 0, -0.55, 0, i % 2 ? 0xf2b134 : 0x1d5fa8),
      box(1.3, 0.1, 1, 0, 0.02, 0, 0x2b2f35),
    ]);
    gondola.add(cab);
    wheel.add(gondola);
    gondolas.push(gondola);
  }
  g.add(wheel);
  g.userData.gondolas = gondolas;
  const s1 = signMesh("🎡 FERRIS WHEEL", 7, 1.2, { width: 460, height: 76, bg: "#e11d48", fg: "#fff", size: 28 });
  s1.position.set(0, 2.2, 1.7); g.add(s1);
  g.userData.carnFerris = wheel;
  return g;
}

function _buildCarousel() {
  // Spinning carousel with bobbing horses
  const g = new THREE.Group(); g.position.set(23, 0, 20);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.6, 0.7, 22), new THREE.MeshLambertMaterial({ color: 0xd8c8a8 }));
  base.position.y = 0.35; g.add(base);
  const turn = new THREE.Group();
  turn.position.y = 0.7;
  turn.add(new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.3, 22), new THREE.MeshLambertMaterial({ color: 0xe11d48 })));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(6.8, 2.2, 16), new THREE.MeshLambertMaterial({ color: 0xf2b134 }));
  roof.position.y = 6.4; turn.add(roof);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 6, 10), new THREE.MeshLambertMaterial({ color: 0xf4f1ea }));
  pole.position.y = 3.2; turn.add(pole);
  const horses = [];
  const horseCols = [0xf4f1ea, 0x7a3b8f, 0x1d5fa8, 0x2e7d4f, 0xf2b134, 0xc0392b];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const h = new THREE.Group();
    h.position.set(Math.cos(a) * 4.3, 1.35, Math.sin(a) * 4.3);
    h.rotation.y = -a;
    const c = horseCols[i];
    h.add(mergedMesh([
      box(1.15, 0.55, 0.42, 0, 0.35, 0, c),                       // body
      box(0.4, 0.45, 0.3, 0.62, 0.75, 0, c),                      // head
      box(0.08, 0.5, 0.08, 0.66, 1.1, 0, 0x5a4a30),               // ears/crest
    ]));
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 4.6, 6), new THREE.MeshStandardMaterial({ color: 0xf2b134, metalness: 0.6, roughness: 0.3 }));
    rod.position.y = 1.9; h.add(rod);
    turn.add(h);
    horses.push(h);
  }
  g.add(turn);
  g.userData.carnCarousel = turn;
  g.userData.carnHorses = horses;
  const s1 = signMesh("🎠 CAROUSEL", 5, 1, { width: 400, height: 66, bg: "#7a1030", fg: "#f2b134", size: 26 });
  s1.position.set(0, 8.4, 0); g.add(s1);
  return g;
}

function _buildStage() {
  // Carnival main stage — drummers, MC, confetti cannons
  const g = new THREE.Group();
  g.add(mergedMesh([
    box(18, 1.4, 8, 0, 0.7, -18, 0x8a5a3c),
    box(18, 0.15, 8, 0, 1.48, -18, 0xa07040),
    box(18.6, 0.5, 0.5, 0, 1.7, -13.9, 0xe11d48),
  ]));
  g.add(mergedMesh([box(18, 5.5, 0.5, 0, 4, -21.6, 0x7a1030)]));
  const bd = signMesh("★ CARNIVAL MAIN STAGE ★", 12, 1.7, { width: 680, height: 100, bg: "#7a1030", fg: "#f2b134", size: 34 });
  bd.position.set(0, 5.6, -21.3); g.add(bd);
  // Drum kits (gangan + congas)
  for (const dx of [-3.5, 3.5]) {
    g.add(mergedMesh([
      box(0.9, 0.7, 0.9, dx, 1.9, -17.5, 0xb5651d),
      box(1, 0.08, 1, dx, 2.28, -17.5, 0xe8d3b0),
    ]));
  }
  // Speakers
  for (const sx of [-8.5, 8.5]) {
    g.add(mergedMesh([box(1.4, 2.4, 1, sx, 2.6, -15, 0x2b2f35), box(0.8, 0.8, 0.08, sx, 2.9, -14.5, 0x55585e)]));
  }
  // Confetti cannons angled at the sky
  for (const cx of [-7, 7]) {
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 2, 8), new THREE.MeshLambertMaterial({ color: 0xf2b134 }));
    cannon.position.set(cx, 2.2, -15.5); cannon.rotation.z = cx < 0 ? 0.5 : -0.5; g.add(cannon);
  }
  // Colour spot lights on a truss
  g.add(mergedMesh([box(16, 0.2, 0.2, 0, 7, -16, 0x3a3f45)]));
  const cols = [0xe11d48, 0xf2b134, 0x0ea5e9, 0x7a3b8f];
  for (let i = 0; i < 4; i++) {
    const spot = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 8), new THREE.MeshBasicMaterial({ color: cols[i] }));
    spot.position.set(-6 + i * 4, 6.6, -15.8); spot.rotation.z = Math.PI; g.add(spot);
  }
  return g;
}

function _buildBouncyCastle() {
  const g = new THREE.Group(); g.position.set(23, 0, 28.5);
  g.add(mergedMesh([
    box(14, 3, 6, 0, 1.5, 0, 0x1d5fa8),
    box(14.4, 0.5, 6.4, 0, 3.1, 0, 0xf2b134),
  ]));
  // Turrets
  for (const tx of [-6.2, 6.2]) {
    g.add(mergedMesh([box(1.4, 4.4, 1.4, tx, 2.2, 0, 0xe11d48)]));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.1, 8), new THREE.MeshLambertMaterial({ color: 0xf2b134 }));
    cone.position.set(tx, 4.9, 0); g.add(cone);
  }
  const s1 = signMesh("🏰 BOUNCY CASTLE", 6, 1, { width: 430, height: 66, bg: "#1d5fa8", fg: "#fff", size: 26 });
  s1.position.set(0, 5.9, 0); g.add(s1);
  return g;
}

function _buildBooth(title, x, z, col) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  g.add(mergedMesh([
    box(9, 3.4, 4, 0, 1.7, 0, 0xf4e4c4),
    box(9.6, 0.5, 4.6, 0, 3.6, 0, col),
    box(0.18, 2.6, 0.18, -3.6, 1.3, 2.2, 0x5a4a30),
    box(0.18, 2.6, 0.18, 3.6, 1.3, 2.2, 0x5a4a30),
  ]));
  const counter = mergedMesh([box(8, 0.7, 0.4, 0, 1.05, 2.1, 0x8a6a45)]);
  g.add(counter);
  // Prizes on the counter
  for (let i = 0; i < 3; i++) {
    const prize = new THREE.Mesh(new THREE.SphereGeometry(0.22, 7, 6), new THREE.MeshLambertMaterial({ color: [0xf2b134, 0xc0392b, 0x2e7d4f][i] }));
    prize.position.set(-1.5 + i * 1.5, 1.62, 2.1); g.add(prize);
  }
  const s1 = signMesh(title, 6.5, 1.1, { width: 480, height: 70, bg: "#7a1030", fg: "#fff", size: 28 });
  s1.position.set(0, 4.6, 2.2); g.add(s1);
  return g;
}

function _buildFoodStall(title, x, z, col) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  g.add(mergedMesh([
    box(8, 3, 4, 0, 1.5, 0, 0xe8d3b0),
    box(9, 0.35, 5, 0, 3.2, 0, col),
    box(0.16, 2.4, 0.16, -3.2, 1.2, 2.4, 0x5a4a30),
    box(0.16, 2.4, 0.16, 3.2, 1.2, 2.4, 0x5a4a30),
  ]));
  // Grill + pots
  g.add(mergedMesh([box(4.4, 0.5, 0.7, 0, 0.95, 2, 0x3a3f45)]));
  for (let i = 0; i < 3; i++) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.28, 10), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.55, roughness: 0.35 }));
    pot.position.set(-1.2 + i * 1.2, 1.35, 2); g.add(pot);
  }
  const s1 = signMesh(title, 5.8, 1, { width: 440, height: 66, bg: col === 0xf4f1ea ? "#1d5fa8" : "#b5651d", fg: "#fff", size: 26 });
  s1.position.set(0, 4.2, 2.3); g.add(s1);
  return g;
}

function _buildFloat(x, z, col, emoji) {
  // Parade float parked along the perimeter road
  const g = new THREE.Group(); g.position.set(x, 0, z);
  g.add(mergedMesh([
    box(8, 1, 4.5, 0, 0.9, 0, 0x8a5a3c),
    box(8.4, 0.3, 4.8, 0, 1.5, 0, col),
  ]));
  for (const [wx, wz] of [[-2.8, 2], [2.8, 2], [-2.8, -2], [2.8, -2]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 12), new THREE.MeshLambertMaterial({ color: 0x2b2f35 }));
    wheel.rotation.x = Math.PI / 2; wheel.position.set(wx, 0.55, wz); g.add(wheel);
  }
  // Deck: dancers' platform props
  g.add(mergedMesh([box(1.6, 2.2, 0.3, 0, 2.7, -1.9, 0xf4f1ea)]));
  const back = signMesh(emoji + " PARADE FLOAT", 4.5, 1, { width: 420, height: 70, bg: "#7a1030", fg: "#f2b134", size: 26 });
  back.position.set(0, 2.75, -1.7); g.add(back);
  // Balloon bunches
  for (const bx of [-3, 3]) {
    const balloons = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 7), new THREE.MeshLambertMaterial({ color: [0xe11d48, 0xf2b134, 0x1d5fa8, 0x2e7d4f][i] }));
      b.position.set((i - 1.5) * 0.3, 3.6 + (i % 2) * 0.35, 0); balloons.add(b);
    }
    balloons.position.set(bx, 0, 1.8); g.add(balloons);
    g.add(mergedMesh([box(0.05, 2.4, 0.05, bx, 1.8, 1.8, 0xf4f1ea)]));
  }
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
