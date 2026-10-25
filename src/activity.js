// src/activity.js — REAL activities: the character walks to the spot, sits / lies / swims / eats for a few seconds
// (with a small prop: stool, table + bowl, toilet cabin, bed...), a progress bar shows, and only THEN the effect is applied.
import * as THREE from "three";

let _scene = null, _cur = null, _bar = null;
export function initActivity(scene) { _scene = scene; }
export const isBusy = () => !!_cur;
export const currentActivity = () => _cur && _cur.spec;

// ---------- tiny prop kit (all boxes/cylinders, original) ----------
const M = (hex) => new THREE.MeshLambertMaterial({ color: hex });
const box = (g, w, h, d, x, y, z, hex) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(hex)); m.position.set(x, y, z); g.add(m); return m; };
const cyl = (g, r, h, x, y, z, hex, seg = 12) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), M(hex)); m.position.set(x, y, z); g.add(m); return m; };
export const PROPS = {
  // stool under the sitter (sitter hips are ~0.45 above the ground)
  stool(g) { box(g, 0.42, 0.06, 0.42, 0, 0.42, 0, 0xb8844a); for (const [x, z] of [[-.15, -.15], [.15, -.15], [-.15, .15], [.15, .15]]) box(g, 0.05, 0.4, 0.05, x, 0.2, z, 0x8a5a3c); },
  // small table in front (+z) with a bowl
  table(g) { box(g, 0.9, 0.05, 0.7, 0, 0.78, 0.85, 0xd8c7a0); for (const [x, z] of [[-.4, .55], [.4, .55], [-.4, 1.15], [.4, 1.15]]) box(g, 0.05, 0.76, 0.05, x, 0.38, z, 0x8a5a3c); cyl(g, 0.17, 0.09, 0, 0.85, 0.85, 0xf4f1ea); cyl(g, 0.13, 0.05, 0, 0.9, 0.85, 0xc0732a); },
  // toilet cabin round the sitter (open at the front, +z)
  cabin(g) { box(g, 1.5, 2.3, 0.08, 0, 1.15, -0.75, 0x2e86ab); box(g, 0.08, 2.3, 1.5, -0.75, 1.15, 0, 0x2e86ab); box(g, 0.08, 2.3, 1.5, 0.75, 1.15, 0, 0x2e86ab); box(g, 1.6, 0.08, 1.6, 0, 2.34, 0, 0xf2f2ee); box(g, 0.5, 0.28, 0.5, 0, 0.14, -0.1, 0xf4f4f4); box(g, 0.44, 0.06, 0.44, 0, 0.3, -0.1, 0xf4f4f4); box(g, 0.5, 0.5, 0.15, 0, 0.55, -0.42, 0xf4f4f4); },
  toilet(g) { box(g, 0.5, 0.28, 0.5, 0, 0.14, -0.1, 0xf4f4f4); box(g, 0.44, 0.06, 0.44, 0, 0.3, -0.1, 0xf4f4f4); box(g, 0.5, 0.5, 0.15, 0, 0.55, -0.42, 0xf4f4f4); },
  bed(g, o) { const z = (o && o.z) ?? -0.85; box(g, 1.1, 0.45, 2.1, 0, 0.22, z, 0x7a5a3a); box(g, 1.02, 0.12, 2.0, 0, 0.5, z, 0xf2f2ee); box(g, 0.7, 0.1, 0.4, 0, 0.62, z - 0.7, 0xdfe7f2); box(g, 1.02, 0.06, 1.1, 0, 0.58, z + 0.35, 0x3c8dbc); },
  shower(g) { box(g, 1.3, 0.05, 1.3, 0, 0.03, 0, 0xdfe7f2); box(g, 0.05, 2.3, 0.05, -0.6, 1.15, -0.6, 0xaab4c0); box(g, 0.05, 2.3, 0.05, 0.6, 1.15, -0.6, 0xaab4c0); box(g, 1.3, 0.05, 0.05, 0, 2.3, -0.6, 0xaab4c0); cyl(g, 0.14, 0.04, 0, 2.15, -0.25, 0xcfd6de); const w = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.2, 2, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x8fd0f0, transparent: true, opacity: 0.35, side: THREE.DoubleSide })); w.position.set(0, 1.1, -0.25); g.add(w); },
  bench(g) { box(g, 1.5, 0.08, 0.45, 0, 0.44, 0, 0xa07040); box(g, 1.5, 0.45, 0.06, 0, 0.7, -0.22, 0xa07040); box(g, 0.08, 0.42, 0.4, -0.65, 0.21, 0, 0x555555); box(g, 0.08, 0.42, 0.4, 0.65, 0.21, 0, 0x555555); },
  // football that moves with the kicks
  ball(g) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), M(0xf4f1ea)); m.position.set(0.1, 0.16, 0.9); g.add(m); g.userData.upd = (t) => { const k = Math.sin(t * 3.0); m.position.z = 1.2 + Math.max(0, k) * 2.2; m.position.y = 0.16 + Math.max(0, k) * Math.max(0, k) * 0.9; m.rotation.x = t * 6; }; },
  tball(g) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), M(0xd6f04a)); g.add(m); g.userData.upd = (t) => { const k = Math.sin(t * 2.4); m.position.set(0.3, 1.0 + Math.abs(k) * 0.9, 1.4 + k * 1.5); }; },
};

function _buildProps(spec, x, z, yaw) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw;
  const subs = [];
  for (const p of spec.props || []) { const sg = new THREE.Group(); const [name, o] = Array.isArray(p) ? p : [p]; PROPS[name](sg, o); g.add(sg); subs.push(sg); }
  g.userData.subs = subs; _scene.add(g); return g;
}
function _disposeProps(g) { if (!g) return; _scene.remove(g); g.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }

// ---------- progress bar ----------
function _showBar(spec) {
  if (!_bar) {
    _bar = document.createElement("div");
    _bar.style.cssText = "position:fixed;left:50%;top:calc(64px + env(safe-area-inset-top));transform:translateX(-50%);z-index:70;width:min(300px,86vw);background:rgba(23,24,27,.92);color:#f2f2f4;border-radius:14px;padding:9px 12px;font:600 13px Poppins,system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.4);display:none;";
    _bar.innerHTML = '<div style="display:flex;align-items:center;gap:8px;"><div id="act-txt" style="flex:1;"></div><button id="act-x" style="background:#33363e;border:none;color:#fff;border-radius:8px;padding:4px 9px;font-size:12px;cursor:pointer;">✕ Stop</button></div><div style="height:6px;border-radius:3px;background:#33363e;margin-top:7px;overflow:hidden;"><div id="act-fill" style="height:100%;width:0;background:#4ade80;"></div></div>';
    document.body.appendChild(_bar);
    _bar.querySelector("#act-x").onclick = () => cancelActivity();
  }
  _bar.style.display = "block";
  _bar.querySelector("#act-txt").textContent = spec.icon + " " + spec.label;
  _bar.querySelector("#act-fill").style.width = "0%";
}
const _hideBar = () => { if (_bar) _bar.style.display = "none"; };

/** Start an activity.
 *  spec: { label, icon, anim, seconds, path:[{x,z,face?}] (walk there first), face (heading when acting), props:[...], yOff, cancelOnMove, onDone(ok) } */
export function startActivity(spec, player, rig) {
  if (_cur) cancelActivity();
  _cur = { spec, player, rig, phase: spec.path && spec.path.length ? "walk" : "act", wp: 0, t: 0, walkT: 0, props: null };
  _showBar({ ...spec, label: (spec.walkLabel || "Going there...") });
  if (_cur.phase === "act") _beginAct();
  return true;
}
function _beginAct() {
  const c = _cur, sp = c.spec, pl = c.player;
  c.phase = "act"; c.t = 0; pl.speed = 0;
  if (sp.face != null) pl.heading = sp.face;
  const yaw = pl.heading;
  if (sp.props && sp.props.length) c.props = _buildProps(sp, pl.pos.x, pl.pos.z, yaw);
  pl.yOff = sp.yOff || 0;
  c.rig?.animate?.emote?.(sp.anim, sp.seconds + 0.3);
  try { window.__actAnim && window.__actAnim(sp.anim, sp.seconds + 0.3); } catch (e) {}      // other players see it too
  _showBar(sp);
}
function _finish(ok) {
  const c = _cur; if (!c) return;
  _cur = null; _hideBar();
  _disposeProps(c.props);
  c.player.yOff = 0; c.player.speed = 0;
  c.rig?.animate?.stopEmote?.();
  try { window.__actAnim && window.__actAnim("", 0); } catch (e) {}
  try { c.spec.onDone && c.spec.onDone(ok); } catch (e) { console.warn(e); }
}
export function cancelActivity() { if (_cur) _finish(false); }

/** Call every frame BEFORE normal movement. Returns true while an activity owns the player (ignore the joystick). */
export function tickActivity(dt, moveIntent) {
  const c = _cur; if (!c) return false;
  const pl = c.player, sp = c.spec;
  if (moveIntent > 0.35 && (sp.cancelOnMove !== false) && c.phase === "act") { _finish(false); return false; }
  if (c.phase === "walk") {
    const w = sp.path[c.wp]; c.walkT += dt;
    const dx = w.x - pl.pos.x, dz = w.z - pl.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.2 || c.walkT > 14) {
      pl.pos.x = w.x; pl.pos.z = w.z;
      if (++c.wp >= sp.path.length) { if (w.face != null && sp.face == null) sp.face = w.face; _beginAct(); }
      c.walkT = 0; return true;
    }
    const want = Math.atan2(dx, dz);
    let dh = want - pl.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    pl.heading += dh * (1 - Math.exp(-dt * 10));
    const sp2 = Math.min(2.6, d * 3 + 0.6);
    pl.speed = sp2; pl.pos.x += (dx / d) * sp2 * dt; pl.pos.z += (dz / d) * sp2 * dt;
    return true;
  }
  c.t += dt; pl.speed = 0;
  if (c.props) for (const sg of c.props.userData.subs) if (sg.userData.upd) sg.userData.upd(c.t);
  if (_bar) _bar.querySelector("#act-fill").style.width = Math.min(100, (c.t / sp.seconds) * 100) + "%";
  if (c.t >= sp.seconds) _finish(true);
  return true;
}

// ---------- ready-made specs ----------
const FACE = (dx, dz) => Math.atan2(dx, dz);
/** sit-down meal where the player stands (stool + small table with a bowl) */
export function eatSpec(player, onDone, seconds = 6) {
  return { label: "Eating...", icon: "🍛", anim: "eat", seconds, props: ["stool", "table"], face: player.heading, onDone };
}
export function toiletSpec(player, onDone, seconds = 5) {
  return { label: "Using the toilet...", icon: "🚽", anim: "toilet", seconds, props: ["cabin"], face: player.heading, onDone };
}
export function sitSpec(player, onDone, seconds = 12) {
  return { label: "Sitting...", icon: "🪑", anim: "sitwatch", seconds, props: ["stool"], face: player.heading, cancelOnMove: true, onDone };
}

/** local (lx,lz) of a fun place -> world */
function toWorld(f, lx, lz) { const c = Math.cos(f.rot || 0), s = Math.sin(f.rot || 0); return { x: f.x + lx * c + lz * s, z: f.z - lx * s + lz * c }; }
const via = (f, lx, lz, flx, flz) => { const p = toWorld(f, lx, lz), q = toWorld(f, flx, flz); return { x: p.x, z: p.z, face: FACE(q.x - p.x, q.z - p.z) }; };

/** activity for a fun place (f = layout entry {kind,x,z,rot,w,d}); returns a spec */
export function funSpec(f, act, player, onDone) {
  const k = f.kind;
  const base = { label: act.label + "...", icon: act.icon, onDone };
  switch (k) {
    case "bukka": { const s = via(f, -3, 2.3, -3, 1.5); return { ...base, label: "Eating at the bukka...", anim: "eat", seconds: 7, path: [s], face: s.face, walkLabel: "Going to a seat..." }; }
    case "suya": { const s = via(f, 0, f.d / 2 + 0.9, 0, 0); return { ...base, label: "Eating suya...", anim: "eat", seconds: 6, path: [s], props: ["stool", "table"], face: s.face, walkLabel: "Going to the suya spot..." }; }
    case "pool": { const s = via(f, -5.6, 0, 0, 0); return { ...base, label: "Swimming...", anim: "swim", seconds: 9, path: [s, via(f, -1.5, 0, 4, 0)], yOff: 0.18, face: FACE(...(() => { const a = toWorld(f, -1.5, 0), b = toWorld(f, 4, 0); return [b.x - a.x, b.z - a.z]; })()), walkLabel: "Going to the pool..." }; }
    case "pitch": { const s = via(f, -3, 0, 3, 0); return { ...base, label: "Playing football...", anim: "kick", seconds: 8, path: [s], props: ["ball"], face: s.face, walkLabel: "Going onto the pitch..." }; }
    case "tennis": { const s = via(f, -4, 1.5, 4, 1.5); return { ...base, label: "Playing tennis...", anim: "swing", seconds: 8, path: [s], props: ["tball"], face: s.face, walkLabel: "Going onto the court..." }; }
    case "park": { const s = via(f, 3.4, 3, 0, 0); return { ...base, label: "Relaxing in the park...", anim: "sitwatch", seconds: 8, path: [s], props: ["bench"], face: s.face, cancelOnMove: false, walkLabel: "Finding a bench..." }; }
    case "playground": { const s = via(f, 0, 0, 0, 3); return { ...base, label: "Playing...", anim: "jump", seconds: 6, path: [s], face: s.face, walkLabel: "Going to the playground..." }; }
    case "hotel": { const s = via(f, 0, f.d / 2 + 1.6, 0, 0); return { ...base, label: "Resting in a room...", anim: "sleep", seconds: 8, path: [s], props: [["bed", { z: -0.85 }]], yOff: 0.6, face: s.face + Math.PI, fade: true, walkLabel: "Going to the hotel..." }; }
    case "borehole": { const s = via(f, 0, f.d / 2 + 0.9, 0, 0); return { ...base, label: "Drinking water...", anim: "drink", seconds: 3.5, path: [s], face: s.face, walkLabel: "Going to the borehole..." }; }
    case "petrol": { const s = via(f, 0, f.d / 2 + 0.9, 0, 0); return { ...base, label: "Buying fuel...", anim: "point", seconds: 3.5, path: [s], face: s.face, walkLabel: "Going to the pump..." }; }
    case "bazaar": case "shops": { const a = via(f, -f.w / 3, f.d / 2 + 0.9, -f.w / 3, 0), b = via(f, f.w / 3, f.d / 2 + 0.9, f.w / 3, 0); return { ...base, label: "Browsing...", anim: "point", seconds: 4, path: [a, b], face: b.face, walkLabel: "Walking the stalls..." }; }
    default: return { ...base, anim: "wave", seconds: 3 };
  }
}

// ---------- activities that start from a place menu (market, mosque, home...) ----------
const EAT_IDS = new Set(["eat", "order_suya", "eat_park", "eat_cafeteria", "eat_foodcourt", "buy_snacks", "picnic"]);
const DRINK_IDS = new Set(["drink_zobo", "buy_drink"]);
const SIT_IDS = { haircut: "Getting a haircut...", beard_trim: "Beard trim...", shave: "Shaving...", watch_movie: "Watching the movie...", watch_match: "Watching the match...", attend_service: "In the service...", attend_lecture: "In the lecture...", read_quran: "Reading...", relax: "Relaxing...", socialize: "Gisting...", vip: "VIP table..." };
const BACKROOMS = new Set(["bed", "master", "bath", "study"]);

function _roomPath(rooms, kinds, player, inx = 0, inz = 0) {
  const r = rooms.find((q) => kinds.includes(q.kind)); if (!r) return null;
  const path = [];
  if (BACKROOMS.has(r.kind)) path.push({ x: r.x, z: r.z + r.d / 2 + 1.0 });   // line up with the room's door first
  path.push({ x: r.x + inx, z: r.z + inz });
  return path;
}

export function placeSpec(placeId, eid, handle, player, onDone) {
  const base = { onDone };
  if (placeId === "home") {
    const rooms = handle?.getRooms?.() || [], placed = handle?.getPlaced?.() || [];
    const fx = (id) => placed.find((f) => f.id && f.id.includes(id));
    if (eid === "sleep") {
      const b = fx("bed") || fx("mattress");
      const path = b ? [{ x: b.x, z: b.z + 1.0 }] : _roomPath(rooms, ["bed", "master"], player, 0, 1.0);
      return { ...base, label: "Sleeping...", icon: "😴", anim: "sleep", seconds: 8, path: path || undefined, props: b ? [] : [["bed", { z: -0.85 }]], yOff: 0.6, face: 0, walkLabel: "Going to bed..." };
    }
    if (eid === "toilet") {
      const t = fx("toilet");
      const path = t ? [{ x: t.x, z: t.z + 0.1 }] : _roomPath(rooms, ["bath"], player, 0, 0.6);
      return { ...base, label: "Using the toilet...", icon: "🚽", anim: "toilet", seconds: 5, path: path || undefined, props: t ? [] : ["toilet"], face: Math.PI, walkLabel: "Going to the toilet..." };
    }
    if (eid === "shower") {
      const sh = fx("shower");
      const path = sh ? [{ x: sh.x, z: sh.z + 0.4 }] : _roomPath(rooms, ["bath"], player, 0, 0.2);
      return { ...base, label: "Taking a shower...", icon: "🚿", anim: "shower", seconds: 6, path: path || undefined, props: sh ? [] : ["shower"], face: Math.PI, walkLabel: "Going to shower..." };
    }
    if (eid === "eat_home") {
      const f = fx("fridge");
      const path = f ? [{ x: f.x, z: f.z + 1.1 }] : _roomPath(rooms, ["kitchen"], player, 0, 0);
      return { ...base, label: "Eating from the fridge...", icon: "🍛", anim: f ? "drink" : "eat", seconds: 5, path: path || undefined, props: f ? [] : ["stool", "table"], face: Math.PI, walkLabel: "Going to the kitchen..." };
    }
    if (eid === "tv") {
      const sofa = fx("sofa");
      const path = sofa ? [{ x: sofa.x, z: sofa.z }] : _roomPath(rooms, ["living"], player, 0, 0);
      return { ...base, label: "Watching TV...", icon: "📺", anim: "sitwatch", seconds: 7, path: path || undefined, props: sofa ? [] : ["stool"], face: Math.PI, cancelOnMove: false, walkLabel: "Going to the living room..." };
    }
  }
  if (placeId === "kasu") {
    // KASU campus activities — real character animations so it feels alive
    if (eid === "study_library") return { ...base, label: "Studying in the library...", icon: "📚", anim: "sitwatch", seconds: 8, props: ["stool"], face: player.heading, cancelOnMove: false };
    if (eid === "bookshop") return { ...base, label: "Browsing textbooks...", icon: "📖", anim: "point", seconds: 4, face: player.heading };
    if (eid === "play_basketball") return { ...base, label: "Playing basketball...", icon: "🏀", anim: "jump", seconds: 7, face: player.heading };
    if (eid === "play_volleyball") return { ...base, label: "Playing volleyball...", icon: "🏐", anim: "jump", seconds: 7, face: player.heading };
    if (eid === "sprint_race") return { ...base, label: "Sprinting the 100m dash...", icon: "🏃", anim: "jump", seconds: 5, face: player.heading };
    if (eid === "quiz_night") return { ...base, label: "Taking the quiz...", icon: "🧠", anim: "point", seconds: 4, face: player.heading, cancelOnMove: false };
    if (eid === "karaoke") return { ...base, label: "Singing on stage...", icon: "🎤", anim: "dance", seconds: 8, face: player.heading };
    if (eid === "talent_show") return { ...base, label: "Performing on stage...", icon: "🎭", anim: "dance", seconds: 8, face: player.heading };
    if (eid === "debate_club") return { ...base, label: "Debating...", icon: "🗣️", anim: "point", seconds: 6, face: player.heading };
    if (eid === "campus_party") return { ...base, label: "Party time!...", icon: "🎉", anim: "dance", seconds: 9, face: player.heading };
    if (eid === "hangout") return { ...base, label: "Gisting under the mango tree...", icon: "🌳", anim: "sitwatch", seconds: 8, props: ["stool"], face: player.heading, cancelOnMove: false };
    if (eid === "graduation") return { ...base, label: "Graduating! Confetti time!...", icon: "🎓", anim: "dance", seconds: 9, face: player.heading };
    if (eid === "write_exam") return { ...base, label: "Writing the exam...", icon: "📝", anim: "point", seconds: 8, face: player.heading, cancelOnMove: false };
    if (eid === "hostel_party") return { ...base, label: "Hostel block-o!...", icon: "🪩", anim: "dance", seconds: 8, face: player.heading, cancelOnMove: false };
  }
  if (placeId === "university") {
    // KADPOLY campus activities — real character animations so it feels alive
    if (eid === "study_library") return { ...base, label: "Studying in the library...", icon: "📚", anim: "sitwatch", seconds: 8, props: ["stool"], face: player.heading, cancelOnMove: false };
    if (eid === "bookshop") return { ...base, label: "Browsing textbooks...", icon: "📖", anim: "point", seconds: 4, face: player.heading };
    if (eid === "play_basketball") return { ...base, label: "Playing basketball...", icon: "🏀", anim: "jump", seconds: 7, face: player.heading };
    if (eid === "play_volleyball") return { ...base, label: "Playing volleyball...", icon: "🏐", anim: "jump", seconds: 7, face: player.heading };
    if (eid === "sprint_race") return { ...base, label: "Sprinting the 100m dash...", icon: "🏃", anim: "jump", seconds: 5, face: player.heading };
    if (eid === "workshop_practice") return { ...base, label: "Welding in the workshop...", icon: "🔧", anim: "point", seconds: 8, face: player.heading };
    if (eid === "fix_engine") return { ...base, label: "Fixing the engine...", icon: "🛠️", anim: "point", seconds: 7, face: player.heading };
    if (eid === "quiz_night") return { ...base, label: "Taking the quiz...", icon: "🧠", anim: "point", seconds: 4, face: player.heading, cancelOnMove: false };
    if (eid === "karaoke") return { ...base, label: "Singing on stage...", icon: "🎤", anim: "dance", seconds: 8, face: player.heading };
    if (eid === "talent_show") return { ...base, label: "Performing on stage...", icon: "🎭", anim: "dance", seconds: 8, face: player.heading };
    if (eid === "debate_club") return { ...base, label: "Debating...", icon: "🗣️", anim: "point", seconds: 6, face: player.heading };
    if (eid === "campus_party") return { ...base, label: "Party time!...", icon: "🎉", anim: "dance", seconds: 9, face: player.heading };
    if (eid === "hangout") return { ...base, label: "Gisting under the neem tree...", icon: "🌳", anim: "sitwatch", seconds: 8, props: ["stool"], face: player.heading, cancelOnMove: false };
    if (eid === "graduation") return { ...base, label: "Graduating! Confetti time!...", icon: "🎓", anim: "dance", seconds: 9, face: player.heading };
    if (eid === "write_exam") return { ...base, label: "Writing the exam...", icon: "📝", anim: "point", seconds: 8, face: player.heading, cancelOnMove: false };
    if (eid === "hostel_party") return { ...base, label: "Hostel block-o!...", icon: "🪩", anim: "dance", seconds: 8, face: player.heading, cancelOnMove: false };
  }
  if (placeId === "zoo") {
    // Kaduna Zoo activities — walk to the enclosure, interact, watch the animals
    if (eid === "feed_lion") return { ...base, label: "Feeding Simba the lion...", icon: "🦁", anim: "point", seconds: 6, face: player.heading };
    if (eid === "feed_elephant") return { ...base, label: "Feeding the elephants...", icon: "🐘", anim: "point", seconds: 6, face: player.heading };
    if (eid === "monkey_watch") return { ...base, label: "Watching the monkeys...", icon: "🐒", anim: "sitwatch", seconds: 6, props: ["stool"], face: player.heading, cancelOnMove: false };
    if (eid === "croc_pond") return { ...base, label: "Peeping at the crocodiles...", icon: "🐊", anim: "sitwatch", seconds: 5, props: ["stool"], face: player.heading, cancelOnMove: false };
    if (eid === "snake_show") return { ...base, label: "Braving the snake show...", icon: "🐍", anim: "point", seconds: 6, face: player.heading };
    if (eid === "ostrich_feed") return { ...base, label: "Feeding the ostriches...", icon: "🪶", anim: "point", seconds: 5, face: player.heading };
    if (eid === "guided_tour") return { ...base, label: "On the guided tour...", icon: "🚶", anim: "walk", seconds: 10, face: player.heading };
    if (eid === "learn_centre") return { ...base, label: "Conservation class...", icon: "🎓", anim: "sitwatch", seconds: 7, props: ["stool"], face: player.heading, cancelOnMove: false };
    if (eid === "post_animal") return { ...base, label: "Filming a viral video...", icon: "📹", anim: "point", seconds: 5, face: player.heading };
    if (eid === "gift_shop") return { ...base, label: "Shopping for souvenirs...", icon: "🎁", anim: "point", seconds: 4, face: player.heading };
    if (eid === "zoo_picnic") return { ...base, label: "Picnic on the zoo lawn...", icon: "🧺", anim: "sitwatch", seconds: 9, props: ["stool"], face: player.heading, cancelOnMove: false };
  }
  if (placeId === "carnival") {
    // Kaduna Carnival activities — rides, games, dance-off mini-game, parade
    if (eid === "ride_ferris") return { ...base, label: "Riding the Ferris wheel...", icon: "🎡", anim: "sitwatch", seconds: 9, face: player.heading, cancelOnMove: false };
    if (eid === "ride_carousel") return { ...base, label: "On the carousel...", icon: "🎠", anim: "sitwatch", seconds: 7, face: player.heading, cancelOnMove: false };
    if (eid === "dance_contest") return { ...base, label: "Dance-Off! Hit the beat!...", icon: "💃", anim: "dance", seconds: 4, face: player.heading, cancelOnMove: false };
    if (eid === "watch_parade") return { ...base, label: "Watching the parade...", icon: "🎺", anim: "sitwatch", seconds: 7, face: player.heading, cancelOnMove: false };
    if (eid === "drum_circle") return { ...base, label: "Playing the gangan...", icon: "🥁", anim: "point", seconds: 7, face: player.heading };
    if (eid === "ring_toss") return { ...base, label: "Tossing the ring...", icon: "🎯", anim: "point", seconds: 4, face: player.heading, cancelOnMove: false };
    if (eid === "balloon_dart") return { ...base, label: "Throwing darts...", icon: "🎈", anim: "point", seconds: 4, face: player.heading, cancelOnMove: false };
    if (eid === "face_paint") return { ...base, label: "Getting face paint...", icon: "🎨", anim: "sitwatch", seconds: 5, props: ["stool"], face: player.heading, cancelOnMove: false };
    if (eid === "costume_parade") return { ...base, label: "Masquerade parade!...", icon: "🥳", anim: "dance", seconds: 8, face: player.heading };
    if (eid === "fireworks") return { ...base, label: "Watching fireworks!...", icon: "🎆", anim: "point", seconds: 6, face: player.heading, cancelOnMove: false };
  }
  if (EAT_IDS.has(eid)) return { ...base, label: "Eating...", icon: "🍛", anim: "eat", seconds: 6, props: ["stool", "table"], face: player.heading };
  if (DRINK_IDS.has(eid)) return { ...base, label: "Drinking...", icon: "🥤", anim: "drink", seconds: 3.5, face: player.heading };
  if (eid === "dance") return { ...base, label: "Dancing...", icon: "💃", anim: "dance", seconds: 6, face: player.heading };
  if (eid === "play_football" || eid === "play_match") return { ...base, label: "Playing football...", icon: "⚽", anim: "kick", seconds: 7, props: ["ball"], face: player.heading };
  if (eid === "pray" || eid === "pray_church" || eid === "choir") return { ...base, label: "Praying...", icon: "🙏", anim: "pray", seconds: 6, face: player.heading };
  if (eid === "rest_hostel" || eid === "rest" || eid === "sleep") return { ...base, label: "Resting...", icon: "😴", anim: "sleep", seconds: 7, props: [["bed", { z: -0.85 }]], yOff: 0.6, face: player.heading + Math.PI };
  if (eid === "shower") return { ...base, label: "Taking a shower...", icon: "🚿", anim: "shower", seconds: 6, props: ["shower"], face: player.heading };
  if (eid === "toilet") return { ...base, label: "Using the toilet...", icon: "🚽", anim: "toilet", seconds: 5, props: ["cabin"], face: player.heading };
  if (SIT_IDS[eid]) return { ...base, label: SIT_IDS[eid], icon: "🪑", anim: "sitwatch", seconds: 5, props: ["stool"], face: player.heading, cancelOnMove: false };
  return null;
}
