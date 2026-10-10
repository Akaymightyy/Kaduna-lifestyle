import * as THREE from "three";
import { buildWorld } from "./world.js";
import { createTraffic } from "./traffic.js";
import { loadPlayer, collide } from "./player.js";
import { createControls, updateCamera } from "./controls.js";
import { createMinimap } from "./minimap.js";
import { addCity } from "./city.js";
import { TIPS, NEEDS, FOOD_ITEMS, JOBS, RANKS } from "./config.js";
import { createGameState } from "./needs.js";

const $ = (id) => document.getElementById(id);
const showError = (m) => { const e = $("err"); e.style.display = "flex"; e.textContent = m; };
addEventListener("error", (e) => showError("Something broke: " + e.message));

// ---- loading screen ----
let tipI = 0;
$("ltip").textContent = TIPS[0];
setInterval(() => { tipI = (tipI + 1) % TIPS.length; $("ltip").textContent = TIPS[tipI]; }, 2600);
const manager = new THREE.LoadingManager();
manager.onProgress = (_u, l, t) => setProgress(l / t);
function setProgress(p) { const v = Math.round(Math.min(1, p) * 100); $("bar").firstElementChild.style.width = v + "%"; $("pct").textContent = v + "%"; }

// ---- renderer / scene ----
const canvas = $("game");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xa9d6f2, 60, 150);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
const hemi = new THREE.HemisphereLight(0xdfeeff, 0x8a7a55, 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d6, 1.8);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);

function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();

const world = buildWorld(scene);
const traffic = createTraffic(scene);
let mmDraw = () => {};
const ctl = createControls(canvas, camera, { joy: $("joy"), knob: $("knob") });

// ---- game state (needs, money, etc.) ----
const game = createGameState();

// ---- day / night ----
const SKY = [
  [0, 0x0b1230, 0.0, 0.25, 0x8899ff], [5, 0x1b2548, 0.0, 0.3, 0x8899ff], [6.5, 0xf3a56b, 0.9, 0.7, 0xffb070],
  [9, 0x9fd4f5, 1.8, 1.0, 0xfff2d6], [16, 0x9fd4f5, 1.8, 1.0, 0xfff2d6], [18, 0xf08a5d, 1.0, 0.75, 0xff9a5a],
  [19.5, 0x2a2f55, 0.1, 0.35, 0x8899ff], [24, 0x0b1230, 0.0, 0.25, 0x8899ff],
];
function skyAt(h) {
  let i = 0; while (i < SKY.length - 2 && h >= SKY[i + 1][0]) i++;
  const a = SKY[i], b = SKY[i + 1], t = (h - a[0]) / (b[0] - a[0]);
  const lc = (x, y) => new THREE.Color(x).lerp(new THREE.Color(y), t);
  return { sky: lc(a[1], b[1]), sun: a[2] + (b[2] - a[2]) * t, hemi: a[3] + (b[3] - a[3]) * t, sunCol: lc(a[4], b[4]) };
}
const qs = new URLSearchParams(location.search);
const fixedHour = qs.has("t") ? parseFloat(qs.get("t")) : null;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
let lastClock = "";
function applyTime() {
  const mins = Date.now() / 60000;
  const hour = fixedHour ?? (mins % 24);
  const k = skyAt(hour);
  scene.background = k.sky; scene.fog.color.copy(k.sky);
  sun.intensity = k.sun; sun.color.copy(k.sunCol); hemi.intensity = k.hemi;
  const ang = ((hour - 6) / 12) * Math.PI;
  sun.position.set(player.pos.x + Math.cos(ang) * 40, Math.max(8, Math.sin(ang) * 60), player.pos.z + 20);
  sun.target.position.set(player.pos.x, 0, player.pos.z);
  const night = hour < 6 || hour > 18.7;
  traffic.setNight(night);
  world.lamps.material.color.set(night ? 0xfff0b0 : 0x555555);
  const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
  const txt = `${DAYS[Math.floor(mins / 24) % 7]} · ${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`;
  if (txt !== lastClock) { lastClock = txt; $("clock").textContent = txt; $("sun").textContent = night ? "🌙" : "☀️"; }
}

// ---- player ----
const player = { pos: new THREE.Vector3(-9, 0, 11), heading: Math.PI, speed: 0 };
let rig;
let toastT = 0;
function toast(m) { const t = $("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 1800); }

// ---- HUD: needs bar + money + rank ----
function updateHUD() {
  const s = game.state;
  $("money-val").textContent = "₦" + s.money.toLocaleString();
  const rank = game.getRank();
  $("rank-val").textContent = rank.name;
  $("rank-val").style.color = rank.color;
  // Needs bars
  for (const need of NEEDS) {
    const bar = $("need-" + need.key);
    if (bar) {
      const val = s.needs[need.key] ?? 0;
      bar.style.width = val + "%";
      bar.style.background = val < 20 ? "#e11d48" : val < 40 ? "#f2b134" : "#2e7d4f";
    }
  }
}

// ---- Phone UI ----
function openPhone() {
  $("phone-modal").classList.add("show");
  showPhoneApp("home");
}
function closePhone() { $("phone-modal").classList.remove("show"); }
window.closePhone = closePhone;

function showPhoneApp(appId) {
  const content = $("phone-content");
  if (appId === "home") {
    const apps = [
      { id: "food", icon: "🍛", label: "Chop" },
      { id: "jobs", icon: "💼", label: "Hustle" },
      { id: "bank", icon: "🏦", label: "Bank" },
      { id: "health", icon: "💊", label: "Health" },
      { id: "ride", icon: "🛺", label: "Ride" },
      { id: "messages", icon: "✉️", label: "Messages" },
      { id: "boutique", icon: "👕", label: "Boutique" },
      { id: "news", icon: "📰", label: "News" },
      { id: "settings", icon: "⚙️", label: "Settings" },
    ];
    content.innerHTML = '<div style="font-size:13px;color:var(--ink);margin-bottom:10px;font-weight:600;">Kaduna Phone</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">' +
      apps.map(a => `<button onclick="window.showApp('${a.id}')" style="background:var(--cream);border:2px solid var(--green);border-radius:12px;padding:12px 6px;cursor:pointer;font-family:inherit;"><div style="font-size:24px;">${a.icon}</div><div style="font-size:11px;color:var(--green);font-weight:600;">${a.label}</div></button>`).join("") +
      '</div>';
  } else if (appId === "food") {
    content.innerHTML = '<div style="font-size:13px;margin-bottom:10px;font-weight:600;">Buy Food</div>' +
      FOOD_ITEMS.map(f => `<div style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid #ddd;"><span style="font-size:20px;">${f.emoji}</span><div style="flex:1;"><div style="font-size:13px;font-weight:600;">${f.name}</div><div style="font-size:11px;color:#666;">Hunger +${f.hunger}${f.fun ? ` · Fun +${f.fun}` : ""}${f.energy ? ` · Energy +${f.energy}` : ""}</div></div><button onclick="window.buyFood('${f.id}')" style="background:var(--green);color:#fff;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:12px;font-weight:600;">₦${f.price}</button></div>`).join("") +
      '<button onclick="window.showApp(\'home\')" style="margin-top:10px;background:transparent;border:none;color:var(--green);cursor:pointer;font-size:13px;">← Back</button>';
  } else if (appId === "jobs") {
    content.innerHTML = '<div style="font-size:13px;margin-bottom:10px;font-weight:600;">Find Work</div>' +
      JOBS.map(j => `<div style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid #ddd;"><div style="flex:1;"><div style="font-size:13px;font-weight:600;">${j.name}</div><div style="font-size:11px;color:#666;">${j.desc} · Pays ₦${j.pay}</div></div><button onclick="window.doJob('${j.id}')" style="background:var(--green);color:#fff;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:12px;font-weight:600;">Work</button></div>`).join("") +
      '<button onclick="window.showApp(\'home\')" style="margin-top:10px;background:transparent;border:none;color:var(--green);cursor:pointer;font-size:13px;">← Back</button>';
  } else if (appId === "bank") {
    content.innerHTML = `<div style="text-align:center;padding:20px 0;"><div style="font-size:28px;font-weight:800;color:var(--green);">₦${game.state.money.toLocaleString()}</div><div style="font-size:12px;color:#666;margin-top:4px;">Your Balance</div><div style="margin-top:12px;font-size:13px;">Rank: <span style="color:${game.getRank().color};font-weight:600;">${game.getRank().name}</span></div></div><button onclick="window.showApp('home')" style="margin-top:10px;background:transparent;border:none;color:var(--green);cursor:pointer;font-size:13px;">← Back</button>`;
  } else if (appId === "health") {
    content.innerHTML = '<div style="font-size:13px;margin-bottom:10px;font-weight:600;">Health & Boosters</div><div style="padding:12px;text-align:center;color:#666;font-size:12px;">Pharmacy coming soon! For now, eat well and rest.</div><button onclick="window.showApp(\'home\')" style="margin-top:10px;background:transparent;border:none;color:var(--green);cursor:pointer;font-size:13px;">← Back</button>';
  } else {
    content.innerHTML = `<div style="padding:20px;text-align:center;color:#666;font-size:13px;">${appId.charAt(0).toUpperCase() + appId.slice(1)} coming soon!</div><button onclick="window.showApp('home')" style="margin-top:10px;background:transparent;border:none;color:var(--green);cursor:pointer;font-size:13px;">← Back</button>`;
  }
}
window.showApp = showPhoneApp;
window.showPhoneApp = showPhoneApp;
window.buyFood = (id) => { const r = game.eat(id); toast(r.msg || r.error); updateHUD(); if (r.ok) showPhoneApp("food"); };
window.doJob = (id) => { const r = game.work(id); toast(r.msg || r.error); updateHUD(); if (r.ok) showPhoneApp("jobs"); };

// ---- UI buttons ----
$("zin").onclick = () => ctl.zoom(-1.8);
$("zout").onclick = () => ctl.zoom(1.8);
$("fit").onclick = () => { ctl.yaw = player.heading + Math.PI; ctl.pitch = 0.38; ctl.dist = 6.5; };
$("eye").onclick = () => $("ui").classList.add("hidden");
$("eye-solo").onclick = () => $("ui").classList.remove("hidden");
$("jog").onclick = () => { ctl.jog = !ctl.jog; $("jog").classList.toggle("on", ctl.jog); $("jog-t").textContent = ctl.jog ? "Jog" : "Walk"; };
$("phone-btn").onclick = openPhone;
$("phone-close").onclick = closePhone;
setTimeout(() => { const t = $("tip"); if (t) t.style.display = "none"; }, 15000);

// ---- main loop ----
const clock = new THREE.Clock();
let mmT = 0, hitCool = 0, hudT = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = Date.now() / 1000;
  // move
  const it = ctl.intent();
  const maxSpd = ctl.jog ? 4.8 : 2.1;
  const target = it.mag * maxSpd;
  player.speed += (target - player.speed) * (1 - Math.exp(-dt * 9));
  if (it.mag > 0) {
    const want = Math.atan2(it.x, it.z);
    let d = want - player.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
    player.heading += d * (1 - Math.exp(-dt * 12));
    player.pos.x += it.x * player.speed * dt; player.pos.z += it.z * player.speed * dt;
  }
  collide(player.pos, world.colliders);
  traffic.update(now);
  hitCool -= dt;
  for (const c of traffic.positions) {
    if (Math.abs(player.pos.x - c.x) < c.hl + 0.4 && Math.abs(player.pos.z - c.z) < c.hw + 0.4) {
      player.pos.z += (player.pos.z >= c.z ? 1 : -1) * 0.25; player.pos.x += c.dir * c.speed * dt * 0.8;
      if (hitCool <= 0) { toast("Eyah! Watch the road, use the zebra"); hitCool = 2.5; }
    }
  }
  if (rig) { rig.group.position.copy(player.pos); rig.group.rotation.y = player.heading; rig.animate(dt, player.speed); }
  updateCamera(camera, ctl, player.pos, world.colliders, dt);
  applyTime();
  // Update needs every frame, HUD every 0.5s
  game.updateNeeds(dt);
  hudT += dt; if (hudT > 0.5) { hudT = 0; updateHUD(); }
  mmT += dt; if (mmT > 0.1) { mmT = 0; mmDraw(player.pos.x, player.pos.z, ctl.yaw, player.heading, traffic.positions); }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

Promise.all([loadPlayer(manager, scene), addCity(scene, world, manager)]).then(([r]) => {
  mmDraw = createMinimap($("mm"), world.mapShapes);
  rig = r; rig.group.castShadow = true;
  setProgress(1);
  ctl.yaw = player.heading + Math.PI;
  updateHUD();
  frame();
  $("loading").classList.add("done");
  window.__ready = true;
  window.__dbg = { player, ctl, camera, game };
}).catch((e) => showError("Could not load the game: " + e.message));
