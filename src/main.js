import * as THREE from "three";
import { buildWorld } from "./world.js";
import { createTraffic } from "./traffic.js";
import { loadPlayer, collide } from "./player.js";
import { createControls, updateCamera } from "./controls.js";
import { createMinimap } from "./minimap.js";
import { addCity } from "./city.js";
import { TIPS, NEEDS, FOOD_ITEMS, JOBS, RANKS, ZONES, RIDES, MAP_LOCATIONS, DAILY_QUESTS, DAILY_REWARDS } from "./config.js";
import { createGameState } from "./needs.js";
import { auth, db } from "./firebase.js";
import { initAuth, showAuthModal, wireAuthUI, logout, isAuthed } from "./auth.js";
import { initMultiplayer, sendPosition, sendChat, getMyUid, getMyName, setMyPosition } from "./multiplayer.js";
import { startRide, travelToZone, travelToPlace, getDestinations } from "./travel.js";
import { subscribeRichList } from "./economy.js";
import { createNPCs } from "./npcs.js";
import { initAdmin, showAdminDashboard, hideAdminDashboard, isAdmin, adminTab } from "./admin.js";
import { checkDailyReward, getDailyStatus, claimQuestReward } from "./daily.js";
import { ref, onValue, update } from "firebase/database";
import { openCreator } from "./creator.js";
import { outfitsFor, BUILDS, SHOP, SLOT_KEYS } from "./outfits.js";
import { initPlaceManager, tickEntrancePrompt, updateActive, bindInteractKey, getActivePlace, enterPlace, exitPlace, sendUIEvent } from "./places/manager.js";
import { listPlaces, getPlace } from "./places/registry.js";
import { initMissions, getActiveMission, getAllChapters, getDailyMissions, getWeeklyMissions, checkStep, createMissionState, claimDailyReward, claimWeeklyReward } from "./missions.js";

const $ = (id) => document.getElementById(id);
const showError = (m) => { const e = $("err"); e.style.display = "flex"; e.textContent = m; };
// A stray runtime error must not kill the whole game screen: log it, only load failures are fatal.
addEventListener("error", (e) => { console.error("[game error]", e.message); });

// ---- Prevent back button from exiting the site ----
// Push a dummy history state so the browser's back button stays in the app
// instead of navigating away. If the user presses back again, show a confirm.
history.pushState({ app: true }, "");
addEventListener("popstate", (e) => {
  if (!e.state?.app) {
    if (confirm("Leave Kaduna Lifestyle?")) {
      history.back();
    } else {
      history.pushState({ app: true }, "");
    }
  }
});

let tipI = 0;
$("ltip").textContent = TIPS[0];
setInterval(() => { tipI = (tipI + 1) % TIPS.length; $("ltip").textContent = TIPS[tipI]; }, 2600);
const manager = new THREE.LoadingManager();
manager.onProgress = (_u, l, t) => setProgress(l / t);
function setProgress(p) { const v = Math.round(Math.min(1, p) * 100); $("bar").firstElementChild.style.width = v + "%"; $("pct").textContent = v + "%"; }

// ---- Quality auto-detect for low-end phones ----
// Heuristics: CPU cores, deviceMemory, screen size, mobile UA, touch
const _isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const _cores = navigator.hardwareConcurrency || 4;
const _mem = navigator.deviceMemory || 4; // GB (Chrome only)
const _smallScreen = Math.min(innerWidth, innerHeight) < 480;
const LOW_END = _isMobile && (_cores <= 4 || _mem <= 3 || _smallScreen);
const MID_END = _isMobile && !LOW_END;
// Quality presets
const Q = LOW_END
  ? { pixelRatio: 1.0, shadowMap: 512,  antialias: false, fogNear: 40, fogFar: 100, shadows: true }
  : MID_END
  ? { pixelRatio: 1.5, shadowMap: 1024, antialias: false, fogNear: 50, fogFar: 130, shadows: true }
  : { pixelRatio: Math.min(devicePixelRatio, 2), shadowMap: 1024, antialias: true, fogNear: 60, fogFar: 150, shadows: true };
if (LOW_END) console.log("[quality] LOW_END preset:", Q);
else if (MID_END) console.log("[quality] MID_END preset:", Q);

const canvas = $("game");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: Q.antialias, powerPreference: "high-performance" });
renderer.setPixelRatio(Q.pixelRatio);
renderer.shadowMap.enabled = Q.shadows;
renderer.shadowMap.type = THREE.PCFShadowMap;  // cheaper than PCFSoft on phones
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xa9d6f2, Q.fogNear, Q.fogFar);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
const hemi = new THREE.HemisphereLight(0xdfeeff, 0x8a7a55, 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d6, 1.8);
sun.castShadow = Q.shadows;
if (Q.shadows) sun.shadow.mapSize.set(Q.shadowMap, Q.shadowMap);
Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 100 });
sun.shadow.bias = -0.0004; scene.add(sun, sun.target);

function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();

const world = buildWorld(scene);
const traffic = createTraffic(scene);
let mmDraw = createMinimap($("mm"), world.mapShapes);
const ctl = createControls(canvas, camera, { joy: $("joy"), knob: $("knob") });
const game = createGameState();
const npcs = createNPCs(scene);
const missionState = createMissionState();
let _activeMission = null;

// ---- day/night ----
const SKY = [[0,0x0b1230,0.0,0.25,0x8899ff],[5,0x1b2548,0.0,0.3,0x8899ff],[6.5,0xf3a56b,0.9,0.7,0xffb070],[9,0x9fd4f5,1.8,1.0,0xfff2d6],[16,0x9fd4f5,1.8,1.0,0xfff2d6],[18,0xf08a5d,1.0,0.75,0xff9a5a],[19.5,0x2a2f55,0.1,0.35,0x8899ff],[24,0x0b1230,0.0,0.25,0x8899ff]];
function skyAt(h) { let i=0; while(i<SKY.length-2&&h>=SKY[i+1][0])i++; const a=SKY[i],b=SKY[i+1],t=(h-a[0])/(b[0]-a[0]); const lc=(x,y)=>new THREE.Color(x).lerp(new THREE.Color(y),t); return {sky:lc(a[1],b[1]),sun:a[2]+(b[2]-a[2])*t,hemi:a[3]+(b[3]-a[3])*t,sunCol:lc(a[4],b[4])}; }
const qs = new URLSearchParams(location.search);
const fixedHour = qs.has("t") ? parseFloat(qs.get("t")) : null;
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const INTERIOR_BG = new THREE.Color(0x1a1510);
let lastClock = "";
// ALWAYS DAYTIME: the clock still runs (for opening hours) but the sky/light stay bright.
const DAY_SKY = skyAt(12);
let _dayApplied = false;
function applyTime() {
  const mins = Date.now()/60000; const hour = fixedHour ?? (mins%24);
  if (!_dayApplied) {
    _dayApplied = true;
    scene.background = DAY_SKY.sky; scene.fog.color.copy(DAY_SKY.sky);
    sun.intensity = DAY_SKY.sun; sun.color.copy(DAY_SKY.sunCol); hemi.intensity = DAY_SKY.hemi;
    traffic.setNight(false);
    world.lamps.material.color.set(0x555555);
    if (world.lampLights) for (const pl of world.lampLights) { pl.intensity = 0; pl.visible = false; }
  }
  // sun follows the player (shadows) at a fixed high angle
  sun.position.set(player.pos.x + 25, 55, player.pos.z + 20);
  sun.target.position.set(player.pos.x, 0, player.pos.z);
  const night = false;
  const hh=Math.floor(hour),mm=Math.floor((hour-hh)*60);
  const txt = `${DAYS[Math.floor(mins/24)%7]} · ${((hh+11)%12)+1}:${String(mm).padStart(2,"0")} ${hh<12?"AM":"PM"}`;
  if(txt!==lastClock){lastClock=txt;const cEl=$("clock");if(cEl)cEl.textContent=txt;const sEl=$("sun");if(sEl)sEl.textContent=night?"🌙":"☀️";
    const tpClock=$("tp-clock");if(tpClock){const hh2=Math.floor(hour),mm2=Math.floor((hour-hh2)*60);tpClock.textContent="☀ "+((hh2+11)%12+1)+":"+String(mm2).padStart(2,"0")+" "+(hh2<12?"AM":"PM");}}
}

const player = { pos: new THREE.Vector3(-9,0,11), heading: Math.PI, speed: 0 };
// Remember where the player was, so a refresh does not send them back to the start.
try {
  const sp = JSON.parse(localStorage.getItem("kaduna-pos"));
  if (sp && Number.isFinite(sp.x) && Number.isFinite(sp.z)) { player.pos.set(sp.x, 0, sp.z); if (Number.isFinite(sp.h)) player.heading = sp.h; }
} catch (e) {}
let _posSaveT = 0;
function savePos(dt) {
  _posSaveT += dt; if (_posSaveT < 2) return; _posSaveT = 0;
  try { localStorage.setItem("kaduna-pos", JSON.stringify({ x: +player.pos.x.toFixed(1), z: +player.pos.z.toFixed(1), h: +player.heading.toFixed(2) })); } catch (e) {}
}
let rig; let toastT=0;
function toast(m){const t=$("toast");t.textContent=m;t.classList.add("show");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("show"),2000);}

// ---- Place Manager init ----
// The shared context that every place module can use.
const placeCtx = {
  game,
  toast,
  updateHUD: () => updateHUD(),
  onPlaceChange: (def) => {
    // Update the HUD chip + show activity buttons when inside a place
    const titleEl = document.querySelector(".chip.title");
    if (titleEl) {
      titleEl.firstChild.textContent = def ? "📍 " + def.name : "📍 Ahmadu Bello Way";
    }
    const subEl = document.getElementById("zone-sub");
    if (subEl) subEl.textContent = def ? (def.type === "interior" ? "Inside" : "At") : "Kaduna";
    // Show/hide place actions bar
    _renderPlaceActions(def);
  },
};
initPlaceManager({ scene, worldGroup: world.world, ctx: placeCtx });
bindInteractKey(
  () => ({ pos: player.pos, heading: player.heading }),
  () => _gameHour()
);
function _gameHour() {
  if (fixedHour != null) return fixedHour;
  return (Date.now() / 60000) % 24;
}
function _renderPlaceActions(def) {
  let bar = document.getElementById("place-actions");
  if (!def) { if (bar) bar.style.display = "none"; return; }
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "place-actions";
    bar.style.cssText =
      "position:fixed;left:50%;bottom:calc(120px + env(safe-area-inset-bottom));" +
      "transform:translateX(-50%);background:rgba(15,77,58,.95);color:#fff;" +
      "padding:8px;gap:6px;border-radius:14px;display:none;z-index:30;" +
      "border:1px solid rgba(255,255,255,.2);max-width:90vw;flex-wrap:wrap;" +
      "justify-content:center;";
    document.body.appendChild(bar);
  }
  bar.innerHTML = def.activities.map(a =>
    '<button onclick="window.placeAction(\'' + a.id + '\')" ' +
    'style="background:#fff;color:#0f4d3a;border:none;border-radius:8px;padding:6px 10px;' +
    'cursor:pointer;font:600 12px Poppins,sans-serif;">' + a.label + '</button>'
  ).join("");
  bar.style.display = "flex";
}
window.placeAction = (eventId) => sendUIEvent(eventId, {});

function updateHUD() {
  const s=game.state;
  const tpMoney=$("tp-money-val"); if(tpMoney) tpMoney.textContent=s.money.toLocaleString();
  const mv=$("money-val"); if(mv) mv.textContent="₦"+s.money.toLocaleString();
  const rank=game.getRank(); const rv=$("rank-val"); if(rv){rv.textContent=rank.name;rv.style.color=rank.color;}
  for(const need of NEEDS){const bar=$("need-"+need.key);if(bar){const val=s.needs[need.key]??0;bar.style.width=val+"%";bar.style.background=val<20?"#e11d48":val<40?"#f2b134":"#2e7d4f";}}
  // Mood face + word in top pill
  const avg=((s.needs.hunger||0)+(s.needs.energy||0)+(s.needs.fun||0)+(s.needs.social||0)+(s.needs.hygiene||0)+(s.needs.bladder||0))/6;
  const moodEl=$("tp-mood");
  if(moodEl){let f,w;if(avg>75){f="😊";w="Happy";}else if(avg>50){f="😐";w="Fine";}else if(avg>25){f="😟";w="Stressed";}else{f="😫";w="Suffering";}moodEl.textContent=f+" "+w;}
}

// ---- Phone UI (chat moved inside phone) ----
function openPhone(){$("phone-modal").classList.add("show");showPhoneApp("home");}
function closePhone(){$("phone-modal").classList.remove("show");}
window.closePhone=closePhone;

function _showPhoneApp(appId) {
  const c=$("phone-content");
  const backBtn='<button onclick="window.showApp(\'home\')" style="margin-top:14px;background:transparent;border:none;color:var(--green);cursor:pointer;font-size:13px;font-weight:600;">← Back to Phone</button>';
  if(appId==="home"){
    const apps=[
      {id:"food",icon:"🍛",label:"Chop"},
      {id:"jobs",icon:"💼",label:"Hustle"},
      {id:"bank",icon:"🏦",label:"Bank"},
      {id:"ride",icon:"🛺",label:"Ride"},
      {id:"chat",icon:"💬",label:"Chat"},
      {id:"map",icon:"🗺️",label:"Map"},
      {id:"missions",icon:"🎯",label:"Missions"},
      {id:"daily",icon:"🎁",label:"Daily"},
      {id:"health",icon:"💊",label:"Health"},
      {id:"richlist",icon:"🏆",label:"Rich List"},
      {id:"profile",icon:"👤",label:"Profile"},
      {id:"events",icon:"🎉",label:"Events"},
      {id:"news",icon:"📰",label:"Gist"},
      {id:"boutique",icon:"👕",label:"Boutique"},
      {id:"myoutfits",icon:"👜",label:"My Outfits"},
      {id:"wardrobe",icon:"👔",label:"Wardrobe"},
      {id:"contacts",icon:"📲",label:"Contacts"},
      {id:"settings",icon:"⚙️",label:"Settings"}
    ];
    if(isAdmin()) apps.push({id:"admin",icon:"🔐",label:"Admin"});
    const COL={food:["#f59e0b","#f97316"],jobs:["#8b5cf6","#6366f1"],bank:["#3b82f6","#2563eb"],ride:["#10b981","#059669"],chat:["#22c55e","#16a34a"],map:["#06b6d4","#0891b2"],daily:["#ec4899","#db2777"],health:["#ef4444","#dc2626"],richlist:["#f59e0b","#d97706"],profile:["#6366f1","#4f46e5"],events:["#d946ef","#c026d3"],news:["#64748b","#475569"],boutique:["#d946ef","#a855f7"],myoutfits:["#f97316","#ea580c"],wardrobe:["#14b8a6","#0d9488"],contacts:["#6366f1","#818cf8"],settings:["#64748b","#475569"],admin:["#ef4444","#b91c1c"]};
    const now=new Date(), hh=String(now.getHours()).padStart(2,"0"), mm=String(now.getMinutes()).padStart(2,"0");
    const dateTxt=now.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})+" · Kaduna";
    c.innerHTML='<div class="ph-home-clock">'+hh+':'+mm+'</div><div class="ph-home-date">'+dateTxt+'</div><div class="ph-home-bal"><span>₦'+(game.state.money||0).toLocaleString()+'</span></div>'+
      '<div class="ph-grid">'+apps.map(a=>{const k=COL[a.id]||["#64748b","#475569"];return '<button class="ph-app" onclick="window.showApp(\''+a.id+'\')"><div class="ph-ic" style="background:linear-gradient(145deg,'+k[0]+','+k[1]+')">'+a.icon+'</div>'+a.label+'</button>';}).join("")+'</div>';
    const pt=$("phone-time"); if(pt) pt.textContent=hh+':'+mm;
    return;
  }
  if(appId==="food"){
    c.innerHTML='<div style="font-size:14px;margin-bottom:10px;font-weight:700;color:var(--green);">🍛 Kaduna Buka — Buy Food</div>'+FOOD_ITEMS.map(f=>{const extras=(f.fun?' · Fun +'+f.fun:'')+(f.energy?' · Energy +'+f.energy:'');return '<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid #eee;border-radius:8px;margin-bottom:6px;"><span style="font-size:24px;">'+f.emoji+'</span><div style="flex:1;"><div style="font-size:13px;font-weight:600;">'+f.name+'</div><div style="font-size:11px;color:#666;">Hunger +'+f.hunger+extras+'</div></div><button onclick="window.buyFood(\''+f.id+'\')" style="background:var(--green);color:#fff;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:12px;font-weight:600;">₦'+f.price+'</button></div>';}).join("")+backBtn;
    return;
  }
  if(appId==="jobs"){
    c.innerHTML='<div style="font-size:14px;margin-bottom:10px;font-weight:700;color:var(--green);">💼 Hustle — Find Work</div>'+JOBS.map(j=>'<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid #eee;border-radius:8px;margin-bottom:6px;"><div style="flex:1;"><div style="font-size:13px;font-weight:600;">'+j.name+'</div><div style="font-size:11px;color:#666;">'+j.desc+' · Pays ₦'+j.pay+' · '+j.time+'s</div></div><button onclick="window.doJob(\''+j.id+'\')" style="background:var(--green);color:#fff;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:12px;font-weight:600;">Work</button></div>').join("")+backBtn;
    return;
  }
  if(appId==="bank"){
    const rank=game.getRank();
    c.innerHTML='<div style="font-size:14px;margin-bottom:10px;font-weight:700;color:var(--green);">🏦 Kaduna Bank</div><div style="text-align:center;padding:18px 0;background:linear-gradient(135deg,var(--green),#1a1a2e);color:#fff;border-radius:14px;margin-bottom:14px;"><div style="font-size:11px;opacity:0.8;">Your Balance</div><div style="font-size:30px;font-weight:800;margin-top:4px;">₦'+game.state.money.toLocaleString()+'</div><div style="margin-top:8px;font-size:11px;opacity:0.9;">Rank: <span style="color:'+rank.color+';font-weight:600;">'+rank.name+'</span></div></div><div style="background:var(--cream);border-radius:10px;padding:10px;margin-bottom:8px;"><div style="font-size:11px;color:#666;">Next rank:</div>'+(rank.id==="bigoga"?'<div style="font-size:13px;font-weight:600;">Maximum rank achieved 🏆</div>':'<div style="font-size:13px;font-weight:600;color:var(--green);">'+RANKS[RANKS.findIndex(r=>r.id===rank.id)+1].name+' at ₦'+RANKS[RANKS.findIndex(r=>r.id===rank.id)+1].minMoney.toLocaleString()+'</div>')+'</div>'+backBtn;
    return;
  }
  if(appId==="ride"){
    // Use the place registry for destinations (places + legacy zones)
    const dests = getDestinations(_gameHour());
    const rideOpts = [
      { id: "walk", name: "Walk", price: 0, time: 8, icon: "🚶" },
      { id: "keke", name: "Keke Napep", price: 300, time: 3, icon: "🛺" },
      { id: "bus", name: "Bus", price: 200, time: 5, icon: "🚌" },
      { id: "okada", name: "Okada", price: 500, time: 2, icon: "🏍️" },
      { id: "taxi", name: "Taxi", price: 1500, time: 2, icon: "🚕" },
    ];
    c.innerHTML='<div style="font-size:14px;margin-bottom:8px;font-weight:700;color:var(--green);">🛺 Book a Ride</div>'+
      '<div style="font-size:11px;color:#666;margin-bottom:8px;">Pick where you want to go:</div>'+
      '<select id="ride-dest-select" style="width:100%;padding:8px;border:1.5px solid var(--green);border-radius:8px;font-family:inherit;font-size:13px;margin-bottom:12px;">'+
        dests.map(d => '<option value="'+d.id+'"'+(d.open===false?' disabled':'')+'>'+(d.icon||'📍')+' '+d.name+(d.open===false?' (closed)':'')+'</option>').join('')+
      '</select>'+
      '<div style="font-size:11px;color:#666;margin-bottom:8px;">Choose how to get there:</div>'+
      rideOpts.map(r => '<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid #eee;border-radius:8px;margin-bottom:6px;"><span style="font-size:24px;">'+r.icon+'</span><div style="flex:1;"><div style="font-size:13px;font-weight:600;">'+r.name+'</div><div style="font-size:11px;color:#666;">'+r.time+'s ride · '+(r.price===0?'Free':'₦'+r.price)+'</div></div><button onclick="window.bookRide(\''+r.id+'\')" style="background:var(--green);color:#fff;border:none;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:12px;font-weight:600;">Go</button></div>').join("")+
      backBtn;
    return;
  }
  if(appId==="chat"){
    c.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #ddd;margin-bottom:8px;"><span style="font-size:14px;font-weight:700;color:var(--green);">💬 Kaduna Chat</span><span id="online-count" style="font-size:11px;color:#999;">1 here</span></div><div id="chat-log" style="height:240px;overflow-y:auto;font-size:12px;margin-bottom:8px;border:1px solid #eee;border-radius:8px;padding:8px;background:#fff;"></div><div style="display:flex;gap:4px;"><input id="chat-input" type="text" placeholder="Type message..." style="flex:1;padding:8px 10px;border:1px solid #ddd;border-radius:8px;font-family:inherit;font-size:12px;" onkeydown="if(event.key===\'Enter\')sendChatMsg()" /><button onclick="sendChatMsg()" style="background:var(--green);color:#fff;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:12px;font-weight:600;">Send</button></div>'+backBtn;
    return;
  }
  if(appId==="map"){
    // Visual drone-style top-down map (canvas) + place list below
    const places = listPlaces();
    const gameHour = _gameHour();
    // Map bounds: x from -160 to 160, z from -50 to 50
    const MAP_W = 300, MAP_H = 120;
    const minWX = -160, maxWX = 160, minWZ = -50, maxWZ = 50;
    const toMapX = (wx) => ((wx - minWX) / (maxWX - minWX)) * MAP_W;
    const toMapZ = (wz) => ((wz - minWZ) / (maxWZ - minWZ)) * MAP_H;
    // Player position
    const px = player.pos.x, pz = player.pos.z;
    // Build SVG (crisp, tappable)
    let svg = '<svg width="100%" viewBox="0 0 '+MAP_W+' '+MAP_H+'" style="background:#9aab62;border-radius:12px;display:block;touch-action:manipulation;">';
    // Grass background already set. Draw road (gray horizontal strip)
    svg += '<rect x="0" y="'+(toMapZ(-9))+'" width="'+MAP_W+'" height="'+(toMapZ(9)-toMapZ(-9))+'" fill="#555a62"/>';
    // Road markings (dashed center line)
    svg += '<line x1="0" y1="'+toMapZ(0)+'" x2="'+MAP_W+'" y2="'+toMapZ(0)+'" stroke="#fff" stroke-width="0.8" stroke-dasharray="4,3"/>';
    // Side streets
    for (const sx of [-90, 90]) {
      svg += '<rect x="'+(toMapX(sx)-2)+'" y="0" width="4" height="'+MAP_H+'" fill="#555a62"/>';
    }
    // Buildings strip (top + bottom)
    svg += '<rect x="0" y="0" width="'+MAP_W+'" height="'+toMapZ(-12)+'" fill="#8f7a5e"/>';
    svg += '<rect x="0" y="'+toMapZ(12)+'" width="'+MAP_W+'" height="'+(MAP_H-toMapZ(12))+'" fill="#8f7a5e"/>';
    // Place markers (tappable)
    for (const p of places) {
      const mx = toMapX(p.entranceX), mz = toMapZ(p.entranceZ);
      const open = (p.hours == null) ? true : (gameHour >= p.hours.open && gameHour < p.hours.close);
      const color = "#" + (p.minimapColor || 0xc0392b).toString(16).padStart(6, "0");
      svg += '<g style="cursor:pointer;" onclick="window.travelToPlace(\''+p.id+'\')">';
      // Glow ring (open only)
      if (open) svg += '<circle cx="'+mx+'" cy="'+mz+'" r="7" fill="'+color+'" opacity="0.25"/>';
      // Main dot
      svg += '<circle cx="'+mx+'" cy="'+mz+'" r="4.5" fill="'+color+'" stroke="#fff" stroke-width="1.5"/>';
      // Label (short)
      const shortName = p.name.split(" ").slice(0, 2).join(" ");
      svg += '<text x="'+mx+'" y="'+(mz-7)+'" text-anchor="middle" font-size="6" font-weight="700" fill="#fff" style="paint-order:stroke;stroke:#000;stroke-width:1.5;">'+shortName+'</text>';
      svg += '</g>';
    }
    // Player position (pulsing red dot)
    const pmx = toMapX(px), pmz = toMapZ(pz);
    svg += '<circle cx="'+pmx+'" cy="'+pmz+'" r="6" fill="#ff6a3d" opacity="0.3"><animate attributeName="r" values="6;9;6" dur="1.5s" repeatCount="indefinite"/></circle>';
    svg += '<circle cx="'+pmx+'" cy="'+pmz+'" r="3.5" fill="#ff6a3d" stroke="#fff" stroke-width="1.5"/>';
    // "YOU" label
    svg += '<text x="'+pmx+'" y="'+(pmz+10)+'" text-anchor="middle" font-size="5" font-weight="700" fill="#fff" style="paint-order:stroke;stroke:#000;stroke-width:1.5;">YOU</text>';
    svg += '</svg>';
    // Legend
    const legend = '<div style="display:flex;gap:10px;font-size:9px;color:#666;margin:6px 0 10px;flex-wrap:wrap;">'+
      '<span><span style="display:inline-block;width:8px;height:8px;background:#ff6a3d;border-radius:50%;border:1px solid #fff;"></span> You</span>'+
      '<span><span style="display:inline-block;width:8px;height:8px;background:#2e7d4f;border-radius:50%;"></span> Open place</span>'+
      '<span><span style="display:inline-block;width:8px;height:8px;background:#e11d48;border-radius:50%;"></span> Closed place</span>'+
      '<span>👆 Tap a place to travel</span>'+
    '</div>';
    // Place list (tappable)
    const placeList = places.map(p => {
      const open = (p.hours == null) ? true : (gameHour >= p.hours.open && gameHour < p.hours.close);
      const openBadge = open ? '<span style="color:#2e7d4f;font-size:10px;">● open</span>' : '<span style="color:#e11d48;font-size:10px;">● closed</span>';
      const color = "#" + (p.minimapColor || 0xc0392b).toString(16).padStart(6, "0");
      return '<div onclick="window.travelToPlace(\''+p.id+'\')" style="padding:8px;background:'+(open?'#e8f5e9':'#f5e8e8')+';border-radius:8px;margin-bottom:5px;font-size:12px;font-weight:600;color:var(--green);cursor:pointer;border-left:4px solid '+color+';">'+p.minimapIcon+' '+p.name+' '+openBadge+'<div style="font-size:10px;color:#666;font-weight:400;margin-top:2px;">'+(p.type==='interior'?'Interior':'Outdoor')+' · '+p.activities.length+' activities</div></div>';
    }).join("");
    c.innerHTML='<div style="font-size:14px;margin-bottom:8px;font-weight:700;color:var(--green);">🗺️ Kaduna Map</div>'+svg+legend+'<div style="font-size:11px;font-weight:600;margin:8px 0 6px;color:#666;">All Places:</div>'+placeList+backBtn;
    return;
  }
  if(appId==="daily"){
    c.innerHTML='<div style="font-size:14px;margin-bottom:8px;font-weight:700;color:var(--green);">🎁 Daily Rewards</div><div id="daily-content" style="font-size:12px;color:#666;">Loading...</div><div style="font-size:14px;margin:14px 0 8px;font-weight:700;color:var(--green);">Daily Quests</div><div id="quests-content" style="font-size:12px;color:#666;">Loading...</div>'+backBtn;
    loadDaily();
    return;
  }
  if(appId==="richlist"){
    c.innerHTML='<div style="font-size:14px;margin-bottom:10px;font-weight:700;color:var(--green);">🏆 Kaduna Rich List</div><div id="richlist-content" style="font-size:12px;color:#666;">Loading...</div>'+backBtn;
    subscribeRichList((list)=>{const el=document.getElementById("richlist-content");if(el)el.innerHTML=list.length?list.map((p,i)=>'<div style="display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid #eee;"><span style="font-weight:600;">'+(i+1)+'. '+p.name+'</span><span style="font-weight:700;color:var(--green);">₦'+p.balance.toLocaleString()+'</span></div>').join(""):"No data yet.";});
    return;
  }
  if(appId==="health"){
    const s=game.state;
    const sickness = (s.needs.hygiene<15)?"🤒 Sick — low hygiene":(s.needs.energy<10)?"😴 Exhausted — sleep needed":"😊 Healthy";
    const sicknessColor = (s.needs.hygiene<15||s.needs.energy<10)?"#e11d48":"#2e7d4f";
    const meds=[
      {id:"panadol",name:"Panadol",emoji:"💊",price:200,desc:"Cures headache · Energy +10"},
      {id:"antimalarial",name:"Antimalarial",emoji:"💉",price:800,desc:"Cures malaria · Hygiene +20"},
      {id:"energydrink",name:"Energy Drink",emoji:"🥤",price:350,desc:"Energy +30"},
      {id:"vitamins",name:"Vitamins",emoji:"🍊",price:500,desc:"Boost all needs +5"},
    ];
    c.innerHTML='<div style="font-size:14px;margin-bottom:10px;font-weight:700;color:var(--green);">💊 Health Clinic</div><div style="background:'+sicknessColor+';color:#fff;border-radius:10px;padding:14px;margin-bottom:14px;text-align:center;"><div style="font-size:20px;font-weight:700;">'+sickness+'</div><div style="font-size:11px;opacity:0.85;margin-top:4px;">Hygiene: '+Math.round(s.needs.hygiene)+'% · Energy: '+Math.round(s.needs.energy)+'%</div></div><div style="font-size:12px;font-weight:600;margin-bottom:6px;color:#666;">Pharmacy:</div>'+meds.map(m=>'<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid #eee;border-radius:8px;margin-bottom:6px;"><span style="font-size:22px;">'+m.emoji+'</span><div style="flex:1;"><div style="font-size:13px;font-weight:600;">'+m.name+'</div><div style="font-size:11px;color:#666;">'+m.desc+'</div></div><button onclick="window.buyMed(\''+m.id+'\')" style="background:var(--green);color:#fff;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:12px;font-weight:600;">₦'+m.price+'</button></div>').join("")+backBtn;
    return;
  }
  if(appId==="profile"){
    const rank=game.getRank();
    const needs=game.state.needs;
    c.innerHTML='<div style="font-size:14px;margin-bottom:10px;font-weight:700;color:var(--green);">👤 Your Profile</div><div style="text-align:center;padding:14px;background:linear-gradient(135deg,var(--green),#1a1a2e);color:#fff;border-radius:14px;margin-bottom:14px;"><div style="font-size:48px;">🧑</div><div style="font-size:16px;font-weight:700;margin-top:6px;">'+(getMyName()||"Player")+'</div><div style="font-size:11px;opacity:0.85;margin-top:2px;">UID: '+(getMyUid()||"guest").slice(0,12)+'</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;"><div style="background:var(--cream);border-radius:10px;padding:10px;text-align:center;"><div style="font-size:11px;color:#666;">Rank</div><div style="font-size:14px;font-weight:700;color:'+rank.color+';">'+rank.name+'</div></div><div style="background:var(--cream);border-radius:10px;padding:10px;text-align:center;"><div style="font-size:11px;color:#666;">Balance</div><div style="font-size:14px;font-weight:700;color:var(--green);">₦'+game.state.money.toLocaleString()+'</div></div></div><div style="background:var(--cream);border-radius:10px;padding:10px;"><div style="font-size:12px;font-weight:600;margin-bottom:6px;color:var(--green);">Needs Status</div>'+NEEDS.map(n=>{const v=Math.round(needs[n.key]||0);const color=v<20?'#e11d48':v<40?'#f2b134':'#2e7d4f';return '<div style="display:flex;align-items:center;gap:6px;font-size:11px;margin-bottom:4px;"><span>'+n.icon+'</span><div style="flex:1;height:6px;background:#e0ddd5;border-radius:3px;overflow:hidden;"><div style="height:100%;width:'+v+'%;background:'+color+';transition:width .3s;"></div></div><span style="width:30px;text-align:right;color:#666;">'+v+'%</span></div>';}).join("")+'</div>'+backBtn;
    return;
  }
  if(appId==="events"){
    c.innerHTML='<div style="font-size:14px;margin-bottom:10px;font-weight:700;color:var(--green);">🎉 Live Events</div><div id="events-content" style="font-size:12px;color:#666;">Loading active events...</div>'+backBtn;
    onValue(ref(db,"events"),(snap)=>{
      const data=snap.val()||{};
      const list=Object.entries(data).filter(([,e])=>!e.endsAt||e.endsAt>Date.now());
      const el=document.getElementById("events-content");
      if(el) el.innerHTML=list.length?list.map(([k,e])=>{
        const left=e.endsAt?Math.max(0,Math.floor((e.endsAt-Date.now())/60000))+" min left":"";
        return '<div style="padding:10px;background:#fff3e0;border-radius:10px;margin-bottom:8px;"><div style="font-size:14px;font-weight:600;color:var(--green);">'+(e.icon||"🎉")+' '+e.name+'</div><div style="font-size:11px;color:#666;margin-top:2px;">'+(e.bonus||"")+'</div>'+(left?'<div style="font-size:10px;color:#999;margin-top:4px;">⏱ '+left+'</div>':'')+'</div>';
      }).join(""):'<div style="text-align:center;color:#999;padding:20px;">No active events right now. Check back later!</div>';
    });
    return;
  }
  if(appId==="news"){
    const news=[
      {time:"Today",title:"Sallah Festival Approaching",body:"Hamdala Hotel preparing for the biggest Sallah celebration in Kaduna. Free food for all residents!"},
      {time:"Yesterday",title:"Kaduna Poly Students Win Tech Competition",body:"Students from Kaduna Polytechnic took first place at the Northern Nigeria tech hackathon."},
      {time:"This Week",title:"Market Day at Kawo",body:"Kawo Market now open late. Best suya spots and fresh produce. Bring your keke!"},
      {time:"This Week",title:"Football Match at Ahmadu Bello Stadium",body:"Kaduna United vs Rangers — Friday 4 PM. Free entry for first 100 students."},
      {time:"Recent",title:"Railway Station Modernization",body:"Rigasa Train Station gets new Lagos-Kaduna route. Travel time now under 3 hours."},
    ];
    c.innerHTML='<div style="font-size:14px;margin-bottom:10px;font-weight:700;color:var(--green);">📰 Kaduna Gist</div>'+news.map(n=>'<div style="padding:10px;border-bottom:1px solid #eee;margin-bottom:6px;"><div style="font-size:10px;color:#999;text-transform:uppercase;">'+n.time+'</div><div style="font-size:13px;font-weight:600;color:var(--ink);margin-top:2px;">'+n.title+'</div><div style="font-size:11px;color:#666;margin-top:4px;line-height:1.4;">'+n.body+'</div></div>').join("")+backBtn;
    return;
  }
  if(appId==="boutique"){
    const L=game.state.look, g=L.gender==="female"?"f":"m", owned=L.owned||[];
    const items=SHOP.filter(it=>it.for==="any"||it.for===g);
    c.innerHTML='<div style="font-size:14px;margin-bottom:10px;font-weight:700;color:var(--green);">👕 Kaduna Boutique</div>'+
      '<button onclick="window.showApp(\'myoutfits\')" style="width:100%;background:var(--gold,#f2b134);color:#1a1a1a;border:none;border-radius:10px;padding:10px;margin-bottom:10px;font-weight:700;font-size:13px;cursor:pointer;">👜 My Outfits ('+owned.length+')</button>'+
      items.map(it=>'<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid #eee;border-radius:8px;margin-bottom:6px;"><span style="font-size:24px;">'+it.emoji+'</span><div style="flex:1;"><div style="font-size:13px;font-weight:600;">'+it.name+'</div><div style="font-size:11px;color:#666;">'+it.desc+'</div></div>'+
        (owned.includes(it.id)?'<span style="font-size:11px;font-weight:700;color:var(--green);">✓ Owned</span>':'<button onclick="window.buyClothing(\''+it.id+'\')" style="background:var(--green);color:#fff;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:12px;font-weight:600;">₦'+it.price+'</button>')+'</div>').join("")+backBtn;
    return;
  }
  if(appId==="myoutfits"){
    const L=game.state.look, owned=(L.owned||[]).map(id=>SHOP.find(x=>x.id===id)).filter(Boolean), worn=L.worn||{};
    c.innerHTML='<div style="font-size:14px;margin-bottom:10px;font-weight:700;color:var(--green);">👜 My Outfits</div>'+
      (owned.length?owned.map(it=>{const on=worn[it.slot]===it.id;return '<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid '+(on?'var(--green)':'#eee')+';border-radius:8px;margin-bottom:6px;"><span style="font-size:24px;">'+it.emoji+'</span><div style="flex:1;"><div style="font-size:13px;font-weight:600;">'+it.name+'</div><div style="font-size:11px;color:#666;">'+(on?'Wearing now':'In your wardrobe')+'</div></div><button onclick="window._'+(on?'removeItem':'wearItem')+'(\''+it.id+'\')" style="background:'+(on?'#e11d48':'var(--green)')+';color:#fff;border:none;border-radius:8px;padding:7px 14px;cursor:pointer;font-size:12px;font-weight:700;">'+(on?'Remove':'Wear')+'</button></div>';}).join(""):'<div style="color:#888;font-size:12px;padding:10px 0;">You have not bought any outfit yet. Visit the Boutique.</div>')+
      '<button onclick="window.showApp(\'boutique\')" style="width:100%;margin-top:8px;background:var(--green);color:#fff;border:none;border-radius:10px;padding:11px;font-weight:700;font-size:13px;cursor:pointer;">🛍 Go to Boutique</button>'+backBtn;
    return;
  }
  if(appId==="wardrobe"){
    // THE WARDROBE — change clothes live with colour swatches + style cards
    const look = game.state.look;
    const colours = ["#1f7a5a","#c0392b","#f2f2ee","#1d5fa8","#d98e2b","#6b4a8a","#2e2e2e","#e8c547","#3c8dbc","#a23b72","#f4efe4","#9fc2d9","#c9b38a","#7aa58a","#2d3a4a","#d9c7a0","#8a9bb5","#2b3a55","#1f2a36","#6b5a45"];
    const skinColours = ["#8a5a3c","#6b4429","#a5714a","#5a3825","#c28a5c","#7a4b2e"];
    const hairColours = ["#111111","#1b1b1b","#2a1e14"];
    const shoeColours = ["#f2f2ee","#222222","#8a5a3c","#c0392b"];
    const swatch = (col, current, key) => '<div onclick="window._setLook(\''+key+'\',\''+col+'\')" style="width:28px;height:28px;border-radius:50%;background:'+col+';cursor:pointer;border:'+(current===col?'3px solid var(--green)':'1px solid #ddd')+';display:inline-block;margin:2px;"></div>';
    const styleCard = (label, val, key) => '<div onclick="window._setLook(\''+key+'\',\''+val+'\')" style="padding:6px 12px;background:'+(look[key]===val?'var(--green)':'var(--cream)')+';color:'+(look[key]===val?'#fff':'var(--green)')+';border-radius:8px;cursor:pointer;font-size:11px;font-weight:600;margin:2px;display:inline-block;">'+label+'</div>';
    const gOn=(look.gender==="female")?"female":"male";
    const pill=(label,on,fn)=>'<div onclick="'+fn+'" style="padding:6px 12px;background:'+(on?'var(--green)':'var(--cream)')+';color:'+(on?'#fff':'var(--green)')+';border-radius:8px;cursor:pointer;font-size:11px;font-weight:600;margin:2px;display:inline-block;">'+label+'</div>';
    c.innerHTML='<div style="font-size:14px;margin-bottom:10px;font-weight:700;color:var(--green);">👕 Wardrobe</div>'+
      '<div style="background:var(--cream);border-radius:10px;padding:10px;margin-bottom:8px;"><div style="font-size:12px;font-weight:600;margin-bottom:6px;">🧍 Character</div>'+pill("👦 Man",gOn==="male","window._setGender(\'male\')")+pill("👧 Woman",gOn==="female","window._setGender(\'female\')")+' '+BUILDS.map(b=>pill(b.label,(look.build||"normal")===b.id,"window._setLook(\'build\',\'"+b.id+"\')")).join("")+'</div>'+
      '<div style="background:var(--cream);border-radius:10px;padding:10px;margin-bottom:8px;"><div style="font-size:12px;font-weight:600;margin-bottom:6px;">'+(gOn==="female"?"👗 Women\'s outfits":"👔 Men\'s outfits")+'</div>'+outfitsFor(gOn).map(o=>pill(o.name,look.outfitId===o.id,"window._setOutfit(\'"+o.id+"\')")).join("")+'</div>'+
      '<div style="background:var(--cream);border-radius:10px;padding:10px;margin-bottom:8px;"><div style="font-size:12px;font-weight:600;margin-bottom:6px;">🎨 Top Colour</div><div style="display:flex;flex-wrap:wrap;">'+colours.map(c=>swatch(c,look.top,"top")).join("")+'</div></div>'+
      '<div style="background:var(--cream);border-radius:10px;padding:10px;margin-bottom:8px;"><div style="font-size:12px;font-weight:600;margin-bottom:6px;">👖 Bottom Colour</div><div style="display:flex;flex-wrap:wrap;">'+colours.map(c=>swatch(c,look.bottom,"bottom")).join("")+'</div></div>'+
      '<div style="background:var(--cream);border-radius:10px;padding:10px;margin-bottom:8px;"><div style="font-size:12px;font-weight:600;margin-bottom:6px;">🧦 Shoes</div><div style="display:flex;flex-wrap:wrap;">'+shoeColours.map(c=>swatch(c,look.shoes,"shoes")).join("")+'</div></div>'+
      '<div style="background:var(--cream);border-radius:10px;padding:10px;margin-bottom:8px;"><div style="font-size:12px;font-weight:600;margin-bottom:6px;">🧑 Skin Tone</div><div style="display:flex;flex-wrap:wrap;">'+skinColours.map(c=>swatch(c,look.skin,"skin")).join("")+'</div></div>'+
      '<div style="background:var(--cream);border-radius:10px;padding:10px;margin-bottom:8px;"><div style="font-size:12px;font-weight:600;margin-bottom:6px;">💇 Hair</div><div style="display:flex;flex-wrap:wrap;">'+hairColours.map(c=>swatch(c,look.hair,"hair")).join("")+'</div></div>'+
      '<div style="background:var(--cream);border-radius:10px;padding:10px;margin-bottom:8px;"><div style="font-size:12px;font-weight:600;margin-bottom:6px;">👔 Top Style</div>'+styleCard("Casual","casual","topStyle")+styleCard("Kaftan","kaftan","topStyle")+'</div>'+
      '<div style="background:var(--cream);border-radius:10px;padding:10px;margin-bottom:8px;"><div style="font-size:12px;font-weight:600;margin-bottom:6px;">👖 Bottom Style</div>'+styleCard("Trousers","trousers","bottomStyle")+styleCard("Shorts","shorts","bottomStyle")+'</div>'+
      '<button onclick="window._saveLook()" style="width:100%;background:var(--green);color:#fff;border:none;border-radius:10px;padding:14px;cursor:pointer;font-size:14px;font-weight:700;margin-top:6px;">✓ Save Outfit</button>'+
      backBtn;
    return;
  }
  if(appId==="contacts"){
    c.innerHTML='<div style="font-size:14px;margin-bottom:10px;font-weight:700;color:var(--green);">📲 Contacts</div><div id="contacts-list" style="font-size:12px;">Loading players...</div>'+backBtn;
    onValue(ref(db,"players"),(snap)=>{
      const data=snap.val()||{};
      const myUid=getMyUid();
      const list=Object.entries(data).filter(([uid])=>uid!==myUid).slice(0,20);
      const el=document.getElementById("contacts-list");
      if(el) el.innerHTML=list.length?list.map(([uid,p])=>{const nm=(p.name||"Player").replace(/'/g,"");return '<div style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid #eee;"><div style="width:32px;height:32px;background:var(--green);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;">'+(p.name||"?").charAt(0).toUpperCase()+'</div><div style="flex:1;"><div style="font-size:13px;font-weight:600;">'+(p.name||"Unknown")+'</div><div style="font-size:10px;color:#999;">'+(p.x||0).toFixed(0)+', '+(p.z||0).toFixed(0)+'</div></div><button onclick="window.sendMessage(\''+uid+'\',\''+nm+'\')" style="background:var(--green);color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;">Wave 👋</button></div>';}).join(""):'<div style="text-align:center;padding:20px;color:#999;">No other players online right now.</div>';
    });
    return;
  }
  if(appId==="missions"){
    const chapters=getAllChapters();const dailies=getDailyMissions();const weeklies=getWeeklyMissions();
    let h='<div style="font-size:15px;margin-bottom:10px;font-weight:700;color:#f2f2f4;">🎯 Missions</div>';
    h+='<div style="font-size:12px;font-weight:600;margin-bottom:6px;color:#f2b134;">📖 Story Chapters</div>';
    for(const ch of chapters){const p=ch.progress;const isDone=p.done;const sn=p.step||0;const ts=ch.steps.length;const pct=isDone?100:Math.round((sn/ts)*100);const cs=ch.currentStep;
      h+='<div style="background:#17181b;border-radius:10px;padding:10px;margin-bottom:8px;">';
      h+='<div style="display:flex;justify-content:space-between;align-items:center;"><span style="font-size:13px;font-weight:700;color:'+(isDone?'#4ade80':'#f2f2f4')+';">'+(isDone?'✅ ':'')+'Ch '+ch.id.slice(-1)+': '+ch.title+'</span>'+(isDone?'<span style="font-size:10px;color:#4ade80;">Claimed</span>':'<span style="font-size:10px;color:#f2b134;">'+pct+'%</span>')+'</div>';
      if(!isDone&&cs){h+='<div style="font-size:11px;color:#9b9ba4;margin-top:4px;">Step '+(sn+1)+'/'+ts+': '+cs.text+'</div><div style="height:4px;background:#26272b;border-radius:2px;margin-top:6px;overflow:hidden;"><div style="height:100%;width:'+pct+'%;background:#f2b134;border-radius:2px;"></div></div>';}
      h+='<div style="font-size:10px;color:#6b7280;margin-top:4px;">Reward: ₦'+ch.reward.toLocaleString()+(ch.badge?' + "'+ch.badge+'"':'')+'</div></div>';
    }
    h+='<div style="font-size:12px;font-weight:600;margin:12px 0 6px;color:#f2b134;">📅 Daily Missions</div>';
    for(const d of dailies){h+='<div style="background:#17181b;border-radius:8px;padding:8px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;"><span style="font-size:11px;color:'+(d.done?'#4ade80':'#f2f2f4')+';">'+(d.done?'✅':'⬜')+' '+d.text+'</span>'+(d.done?'<span style="font-size:10px;color:#4ade80;">+₦'+d.reward.toLocaleString()+'</span>':'<button onclick="window._claimDaily(\''+d.id+'\')" style="background:#f2b134;color:#000;border:none;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px;font-weight:600;">Claim ₦'+d.reward.toLocaleString()+'</button>')+'</div>';}
    h+='<div style="font-size:12px;font-weight:600;margin:12px 0 6px;color:#f2b134;">🗓️ Weekly Missions</div>';
    for(const w of weeklies){h+='<div style="background:#17181b;border-radius:8px;padding:8px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;"><span style="font-size:11px;color:'+(w.done?'#4ade80':'#f2f2f4')+';">'+(w.done?'✅':'⬜')+' '+w.text+'</span>'+(w.done?'<span style="font-size:10px;color:#4ade80;">+₦'+w.reward.toLocaleString()+'</span>':'<button onclick="window._claimWeekly(\''+w.id+'\')" style="background:#f2b134;color:#000;border:none;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px;font-weight:600;">Claim ₦'+w.reward.toLocaleString()+'</button>')+'</div>';}
    h+=backBtn;c.innerHTML=h;return;
  }
  if(appId==="settings"){
    const s=game.state;
    c.innerHTML='<div style="font-size:14px;margin-bottom:10px;font-weight:700;color:var(--green);">⚙️ Settings</div>'+
      '<div style="background:var(--cream);border-radius:10px;padding:12px;margin-bottom:8px;">'+
        '<div style="font-size:12px;font-weight:600;margin-bottom:8px;">Game</div>'+
        '<button onclick="window.saveGame()" style="width:100%;background:var(--green);color:#fff;border:none;border-radius:8px;padding:10px;cursor:pointer;font-size:13px;font-weight:600;margin-bottom:6px;">💾 Save Game</button>'+
        '<button onclick="window.resetGame()" style="width:100%;background:#e11d48;color:#fff;border:none;border-radius:8px;padding:10px;cursor:pointer;font-size:13px;font-weight:600;">🗑 Reset Game (lose all progress)</button>'+
      '</div>'+
      '<div style="background:var(--cream);border-radius:10px;padding:12px;margin-bottom:8px;">'+
        '<div style="font-size:12px;font-weight:600;margin-bottom:6px;">Account</div>'+
        '<div style="font-size:11px;color:#666;margin-bottom:4px;">Signed in as: <b>'+(getMyName()||"Guest")+'</b></div>'+
        '<div style="font-size:10px;color:#999;margin-bottom:10px;">UID: '+(getMyUid()||"guest").slice(0,20)+'</div>'+
        '<button onclick="window.logout()" style="width:100%;background:#e11d48;color:#fff;border:none;border-radius:8px;padding:10px;cursor:pointer;font-size:13px;font-weight:600;">🚪 Log Out</button>'+
      '</div>'+
      '<div style="background:var(--cream);border-radius:10px;padding:12px;">'+
        '<div style="font-size:12px;font-weight:600;margin-bottom:6px;">About</div>'+
        '<div style="font-size:11px;color:#666;line-height:1.5;">Kaduna Lifestyle v0.3 — A 3D multiplayer life-sim set in Kaduna, Nigeria. Built with Three.js + Firebase.</div>'+
      '</div>'+backBtn;
    return;
  }
  if(appId==="admin"){
    if(!isAdmin()){toast("Admin access required");return;}
    showAdminDashboard(); closePhone();
    return;
  }
  // fallback (shouldn't reach here)
  c.innerHTML='<div style="padding:20px;text-align:center;color:#666;font-size:13px;">App "'+appId+'" not found.</div>'+backBtn;
}
function showPhoneApp(appId){
  _showPhoneApp(appId);
  const c=$("phone-content"); if(!c) return;
  if(appId!=="home" && !c.querySelector(".ph-back")) c.insertAdjacentHTML("afterbegin",'<button class="ph-back" onclick="window.showApp(\'home\')">← Back</button>');
  c.scrollTop=0;
}
window.showApp=showPhoneApp;
window.buyFood=(id)=>{const r=game.eat(id);toast(r.msg||r.error);updateHUD();if(r.ok)showPhoneApp("food");};
window.doJob=(id)=>{const r=game.work(id);toast(r.msg||r.error);updateHUD();if(r.ok)showPhoneApp("jobs");};
window.buyMed=(id)=>{
  const meds={panadol:{price:200,energy:10,hygiene:0,all:0},antimalarial:{price:800,energy:0,hygiene:20,all:0},energydrink:{price:350,energy:30,hygiene:0,all:0},vitamins:{price:500,energy:5,hygiene:5,all:5}};
  const m=meds[id]; if(!m){toast("Unknown medicine");return;}
  if(game.state.money<m.price){toast("Not enough money");return;}
  game.state.money-=m.price;
  game.state.needs.energy=Math.min(100,(game.state.needs.energy||0)+m.energy);
  game.state.needs.hygiene=Math.min(100,(game.state.needs.hygiene||0)+m.hygiene);
  if(m.all){for(const n of NEEDS){game.state.needs[n.key]=Math.min(100,(game.state.needs[n.key]||0)+m.all);}}
  game.save?.(); updateHUD(); toast("Medicine taken! Feel better now.");
  showPhoneApp("health");
};
function _pushLook(){ clearTimeout(window._lookT); window._lookT=setTimeout(()=>{const u=getMyUid(); if(u) update(ref(db,"players/"+u+"/look"),game.state.look).catch(()=>{});},300); }
window.buyClothing=(id)=>{
  const it=SHOP.find(x=>x.id===id); if(!it) return;
  const L=game.state.look; L.owned=L.owned||[];
  if(L.owned.includes(id)){toast("You already own "+it.name);return;}
  if(game.state.money<it.price){toast("Not enough money for "+it.name);return;}
  game.state.money-=it.price; L.owned.push(id);
  game.state.needs.fun=Math.min(100,(game.state.needs.fun||0)+(it.fun||10));
  game.state.needs.social=Math.min(100,(game.state.needs.social||0)+(it.social||5));
  game.save?.(); updateHUD(); _pushLook();
  toast(it.name+" bought! Saved in My Outfits.");
  window._wearItem(id, true);
};
window._wearItem=(id,fromBuy)=>{
  const it=SHOP.find(x=>x.id===id), L=game.state.look; if(!it||!(L.owned||[]).includes(id)) return;
  L.worn=L.worn||{};
  if(!L.base) L.base={top:L.top,bottom:L.bottom,topStyle:L.topStyle,bottomStyle:L.bottomStyle,shoes:L.shoes}; // what you wore before
  if(it.patch) Object.assign(L,it.patch);
  L.worn[it.slot]=id;
  game.save?.(); _pushLook(); if(rig?.recolor) rig.recolor(L);
  if(!fromBuy) toast("Wearing "+it.name);
  showPhoneApp(fromBuy?"boutique":"myoutfits");
};
window._removeItem=(id)=>{
  const it=SHOP.find(x=>x.id===id), L=game.state.look; if(!it) return;
  L.worn=L.worn||{}; if(L.worn[it.slot]!==id) return;
  L.worn[it.slot]=null;
  if(L.base) for(const k of (SLOT_KEYS[it.slot]||[])) if(L.base[k]!=null) L[k]=L.base[k];
  game.save?.(); _pushLook(); if(rig?.recolor) rig.recolor(L);
  toast(it.name+" removed");
  showPhoneApp("myoutfits");
};
// ---- Character creator (after sign-up) + gender/build/outfit presets ----
const _loadedGender = game.state.look.gender || "male";
window._openCreator = () => {
  window.closeSheet?.();
  openCreator({
    look: game.state.look,
    onChange: (L) => { game.state.look = L; game.save?.(); if (rig?.recolor) rig.recolor(L); },
    onDone: async (L) => {
      game.state.look = L; game.save?.();
      const uid = getMyUid();
      try { if (uid) await update(ref(db, "players/" + uid + "/look"), L); } catch (e) {}
      if ((L.gender || "male") !== _loadedGender) location.reload(); // swap to the other body model
      else toast("Welcome to Kaduna! 🎉");
    },
  });
};
window._setOutfit = (id) => {
  const o = outfitsFor(game.state.look.gender).find((x) => x.id === id); if (!o) return;
  Object.assign(game.state.look, o, { outfitId: id });
  window._setLook("outfitId", id);
};
window._setGender = async (g) => {
  const l = game.state.look; if ((l.gender || "male") === g) return;
  Object.assign(l, outfitsFor(g)[0], { gender: g, outfitId: outfitsFor(g)[0].id });
  game.save?.();
  const uid = getMyUid(); try { if (uid) await update(ref(db, "players/" + uid + "/look"), l); } catch (e) {}
  location.reload();
};
// ---- Wardrobe: live colour/style change ----
window._setLook=(key,val)=>{
  game.state.look[key]=val;
  game.save?.();
  // push to the account right away so your other devices follow
  clearTimeout(window._lookT); window._lookT=setTimeout(()=>{const u=getMyUid(); if(u) update(ref(db,"players/"+u+"/look"),game.state.look).catch(()=>{});},400);
  // Apply live to player model (no reload)
  if(rig?.recolor) rig.recolor(game.state.look);
  // Refresh the wardrobe UI to highlight the new selection
  showPhoneApp("wardrobe");
};
window._saveLook=()=>{
  game.save?.();
  // Write to Firebase so other players see it
  const uid=getMyUid();
  if(uid) update(ref(db,"players/"+uid+"/look"),game.state.look);
  toast("✓ Outfit saved! Other players can see it.");
};
window.travelToPlace=(placeId)=>{
  // Called from the map app: open the ride app with this place preselected
  toast("Opening travel to " + (getPlace(placeId)?.name || placeId) + "...");
  showPhoneApp("ride");
  // Preselect the destination in the dropdown
  setTimeout(() => {
    const sel = document.getElementById("ride-dest-select");
    if (sel) sel.value = placeId;
  }, 50);
};
window.sendMessage=(uid,name)=>{
  sendChat("👋 Hi "+name+"!");
  toast("Waved at "+name);
};
window.saveGame=()=>{game.save?.();toast("Game saved!");};
window.logout=async()=>{ if(confirm("Log out of Kaduna Lifestyle?")){ await logout(); } };
window.resetGame=()=>{
  if(!confirm("Reset all progress? You'll lose your money, needs, and rank."))return;
  localStorage.removeItem("kaduna-state"); localStorage.removeItem("kaduna-pos");
  location.reload();
};
window.bookRide=(rideId)=>{
  const destSel=document.getElementById("ride-dest-select");
  if(!destSel){toast("No destination selected");return;}
  const destId=destSel.value;
  // Determine fare from the new ride list (walk=0, keke=300, bus=200, okada=500, taxi=1500)
  const fareMap={walk:0,keke:300,bus:200,okada:500,taxi:1500};
  const fare=fareMap[rideId] ?? 0;
  if(game.state.money<fare){toast("Not enough money");return;}
  game.state.money-=fare;
  closePhone();
  startRide(rideId,destId,game.state.money,()=>{},(result)=>{
    if(result.ok){
      toast("Welcome to "+result.dest.name+"!");
      updateHUD();
      // If destination is a place, move player to its entrance
      if(result.dest.isPlace && result.dest.entrance){
        player.pos.set(result.dest.entrance.x, 0, result.dest.entrance.z);
        player.heading = Math.PI; // face the door
        travelToPlace(getMyUid(), result.dest.id);
      } else {
        // Legacy zone — reset to default position
        player.pos.set(-9,0,11);
        player.heading=Math.PI;
        travelToZone(getMyUid(), result.dest.id);
      }
      const titleEl=document.querySelector(".chip.title");
      if(titleEl) titleEl.firstChild.textContent = "📍 "+result.dest.name;
      const subEl=document.getElementById("zone-sub");
      if(subEl) subEl.textContent = result.dest.isPlace ? "At entrance" : "Kaduna";
    } else {
      toast(result.error||"Travel failed");
    }
  });
};
window.sendChatMsg=function(){const i=$("chat-input");if(i&&i.value.trim()){sendChat(i.value);i.value="";}};

// ---- Daily rewards ----
async function loadDaily() {
  const uid = getMyUid();
  if (!uid) {
    const el = document.getElementById("daily-content");
    if (el) el.innerHTML = "Sign in to claim daily rewards.";
    return;
  }
  const status = await getDailyStatus(uid);
  const dcEl = document.getElementById("daily-content");
  if (dcEl) {
    if (status.claimed) {
      dcEl.innerHTML = '<div style="padding:10px;background:#e8f5e9;border-radius:8px;color:var(--green);font-weight:600;">✓ Claimed today! Streak: '+status.streak+' days</div>';
    } else {
      const nextReward = DAILY_REWARDS[Math.min(status.streak, 6)];
      dcEl.innerHTML = '<div style="padding:10px;background:#fff3e0;border-radius:8px;"><div style="font-weight:600;color:var(--green);">Day '+(status.streak + 1)+': ₦'+nextReward.money.toLocaleString()+'</div><button onclick="window.claimDaily()" style="margin-top:6px;background:var(--green);color:#fff;border:none;border-radius:6px;padding:6px 16px;cursor:pointer;font-size:12px;font-weight:600;">Claim Now</button></div>';
    }
  }
  const qEl = document.getElementById("quests-content");
  if (qEl) {
    qEl.innerHTML = status.quests.map(q => '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #eee;"><div style="flex:1;">'+q.desc+'</div><div style="font-size:11px;color:var(--green);font-weight:600;">₦'+q.reward+'</div>'+(q.done ? '<span style="color:#2e7d4f;">✓</span>' : '<button onclick="window.claimQuest(\''+q.id+'\')" style="background:var(--green);color:#fff;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:10px;">Claim</button>')+'</div>').join("");
  }
}
window.claimDaily = async function() {
  const uid = getMyUid();
  if (!uid) return;
  const reward = await checkDailyReward(uid);
  if (reward) {
    game.state.money += reward.money;
    game.save?.();
    updateHUD();
    toast(reward.label+' claimed!');
    loadDaily();
  } else {
    toast("Already claimed today!");
  }
};
window.claimQuest = async function(questId) {
  const uid = getMyUid();
  if (!uid) return;
  const reward = await claimQuestReward(uid, questId);
  if (reward) {
    game.state.money += reward;
    updateHUD();
    toast('Quest reward: ₦'+reward);
    loadDaily();
  }
};

// ---- UI buttons ----
$("zin").onclick=()=>ctl.zoom(-1.8); $("zout").onclick=()=>ctl.zoom(1.8);
$("fit").onclick=()=>{ctl.yaw=player.heading+Math.PI;ctl.pitch=0.38;ctl.dist=6.5;};
$("eye-solo").onclick=()=>$("ui").classList.remove("hidden");
$("jog").onclick=()=>{ctl.jog=!ctl.jog;$("jog").classList.toggle("on",ctl.jog);$("jog-t").textContent=ctl.jog?"Jog":"Walk";};
$("phone-close").onclick=closePhone;
// Top pill buttons
$("tp-plus")?.addEventListener("click",()=>{openPhone();setTimeout(()=>showPhoneApp("daily"),50);});
$("tp-sound")?.addEventListener("click",()=>{const b=$("tp-sound");b.textContent=b.textContent==="🔊"?"🔇":"🔊";toast(b.textContent==="🔊"?"Sound on":"Sound off");});
$("tp-clean")?.addEventListener("click",()=>$("ui").classList.add("hidden"));
// Bottom nav
document.querySelectorAll("#bottom-nav .nav-btn").forEach(btn=>{
  btn.addEventListener("click",()=>{
    if(btn.classList.contains("disabled")){toast("Buy mode available at home — coming soon!");return;}
    document.querySelectorAll("#bottom-nav .nav-btn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const n=btn.dataset.nav;
    if(n==="phone")openPhone();
    else if(n==="map"){openPhone();setTimeout(()=>showPhoneApp("map"),50);}
    else if(n==="home"){closePhone();$("profile-sheet")?.classList.remove("show");}
  });
});
// Avatar + needs chip → profile sheet
$("avatar-bubble")?.addEventListener("click",()=>_openSheet("profile"));
$("needs-chip")?.addEventListener("click",()=>_openSheet("needs"));
// Profile sheet tabs
document.querySelectorAll(".ps-tab").forEach(t=>{
  t.addEventListener("click",()=>{document.querySelectorAll(".ps-tab").forEach(x=>x.classList.remove("active"));t.classList.add("active");_renderSheet(t.dataset.ps);});
});
function _openSheet(tab){const sh=$("profile-sheet");sh.classList.add("show");document.querySelectorAll(".ps-tab").forEach(t=>t.classList.remove("active"));document.querySelector('.ps-tab[data-ps="'+tab+'"]')?.classList.add("active");_renderSheet(tab);}
window._openSheet=_openSheet;
window.closeSheet=()=>$("profile-sheet")?.classList.remove("show");
function _renderSheet(tab){
  const el=$("ps-content");if(!el)return;const s=game.state;
  if(tab==="profile"){
    const rank=game.getRank();
    el.innerHTML='<div style="text-align:center;margin-bottom:14px;"><div style="width:60px;height:60px;border-radius:50%;background:var(--green);color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 8px;">🧑</div><div style="font-size:16px;font-weight:700;color:var(--green);">'+(getMyName()||"Player")+'</div><div style="font-size:11px;color:#999;margin-top:2px;">'+(getMyUid()||"guest").slice(0,16)+'…</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;"><div style="background:#fff;border-radius:10px;padding:10px;text-align:center;"><div style="font-size:11px;color:#666;">Rank</div><div style="font-size:14px;font-weight:700;color:'+rank.color+';">'+rank.name+'</div></div><div style="background:#fff;border-radius:10px;padding:10px;text-align:center;"><div style="font-size:11px;color:#666;">Balance</div><div style="font-size:14px;font-weight:700;color:var(--green);">₦'+s.money.toLocaleString()+'</div></div></div><button onclick="window.openPhone();window.showApp(\'wardrobe\')" style="width:100%;background:var(--green);color:#fff;border:none;border-radius:10px;padding:12px;cursor:pointer;font-size:13px;font-weight:600;margin-bottom:6px;">👕 Wardrobe</button><button onclick="window.closeSheet()" style="width:100%;background:rgba(0,0,0,.05);color:#666;border:none;border-radius:10px;padding:12px;cursor:pointer;font-size:13px;font-weight:600;">Close</button>';
  } else if(tab==="needs"){
    const feelings=[];
    if(s.needs.hunger<30)feelings.push({n:"Hungry",v:-20,i:"🍛"});else feelings.push({n:"Well Fed",v:10,i:"🍛"});
    if(s.needs.energy<30)feelings.push({n:"Exhausted",v:-15,i:"⚡"});else feelings.push({n:"Energetic",v:8,i:"⚡"});
    if(s.needs.fun<30)feelings.push({n:"Bored",v:-10,i:"🎉"});else feelings.push({n:"Having Fun",v:10,i:"🎉"});
    if(s.needs.hygiene<30)feelings.push({n:"Needs Wash",v:-12,i:"🫧"});else feelings.push({n:"Fresh & Clean",v:10,i:"🫧"});
    if(s.needs.social<30)feelings.push({n:"Lonely",v:-8,i:"💬"});else feelings.push({n:"Social",v:5,i:"💬"});
    if(s.money>50000)feelings.push({n:"Big Oga",v:15,i:"💰"});
    if(s.money<1000)feelings.push({n:"Broke",v:-10,i:"💸"});
    const mood=feelings.reduce((s,f)=>s+f.v,0);
    el.innerHTML='<div style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--green);">Needs</div>'+NEEDS.map(n=>{const v=Math.round(s.needs[n.key]||0);const c=v<20?"#e11d48":v<40?"#f2b134":"#2e7d4f";return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><span style="font-size:14px;">'+n.icon+'</span><div style="flex:1;height:8px;background:#e0ddd5;border-radius:4px;overflow:hidden;"><div style="height:100%;width:'+v+'%;background:'+c+';"></div></div><span style="font-size:11px;color:#666;width:30px;text-align:right;">'+v+'%</span></div>';}).join("")+'<div style="font-size:13px;font-weight:700;margin:14px 0 8px;color:var(--green);">Feelings</div><div style="font-size:11px;color:#666;margin-bottom:8px;">Mood: <b style="color:'+(mood>20?"#2e7d4f":mood>0?"#f2b134":"#e11d48")+';">'+(mood>20?"Happy":mood>0?"Fine":mood>-20?"Stressed":"Suffering")+'</b> ('+mood+')</div>'+feelings.map(f=>'<div class="feeling-card"><span>'+f.i+' '+f.n+'</span><span class="fc-val" style="color:'+(f.v>0?"#2e7d4f":"#e11d48")+';">'+(f.v>0?"+":"")+f.v+'</span></div>').join("")+'<button onclick="window.closeSheet()" style="width:100%;background:rgba(0,0,0,.05);color:#666;border:none;border-radius:10px;padding:12px;cursor:pointer;font-size:13px;font-weight:600;margin-top:10px;">Close</button>';
  } else if(tab==="goals"){
    el.innerHTML='<div style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--green);">Daily Goals</div><div class="feeling-card"><span>🍛 Eat something</span><span style="color:#2e7d4f;">+₦300</span></div><div class="feeling-card"><span>💼 Complete a job</span><span style="color:#2e7d4f;">+₦500</span></div><div class="feeling-card"><span>💬 Send a chat</span><span style="color:#2e7d4f;">+₦200</span></div><div class="feeling-card"><span>🛺 Travel to a place</span><span style="color:#2e7d4f;">+₦400</span></div><div class="feeling-card"><span>👕 Change your clothes</span><span style="color:#2e7d4f;">+₦100</span></div><div style="font-size:13px;font-weight:700;margin:14px 0 8px;color:var(--green);">Weekly Goals</div><div class="feeling-card"><span>🏆 Reach Hustler rank (₦10k)</span><span style="color:#999;">In progress</span></div><div class="feeling-card"><span>🏠 Rent a home</span><span style="color:#999;">Coming soon</span></div><div class="feeling-card"><span>👥 Make 5 friends</span><span style="color:#999;">0/5</span></div><button onclick="window.closeSheet()" style="width:100%;background:rgba(0,0,0,.05);color:#666;border:none;border-radius:10px;padding:12px;cursor:pointer;font-size:13px;font-weight:600;margin-top:10px;">Close</button>';
  }
}
window.openPhone=openPhone;
// ---- Mission tracker + claim functions ----
window._claimDaily=(id)=>claimDailyReward(id);
window._claimWeekly=(id)=>claimWeeklyReward(id);
function _updateMissionTracker(){
  const el=$("qc-main");if(!el)return;
  if(!_activeMission){el.querySelector(".qc-title").textContent="All Chapters Complete!";el.querySelector(".qc-desc").textContent="You're a City Legend! 🏆";return;}
  if(_activeMission.isComplete){el.querySelector(".qc-title").textContent="🎉 "+_activeMission.chapter.title+" Complete!";el.querySelector(".qc-desc").textContent="Reward: ₦"+_activeMission.chapter.reward.toLocaleString();return;}
  const ch=_activeMission.chapter;const step=_activeMission.step;const pct=Math.round((_activeMission.stepIdx/ch.steps.length)*100);
  el.querySelector(".qc-icon").textContent="🎯";el.querySelector(".qc-title").textContent="Ch "+ch.id.slice(-1)+": "+ch.title+" ("+pct+"%)";el.querySelector(".qc-desc").textContent=step?step.text:"Complete!";
}
setTimeout(()=>{const t=$("tip");if(t)t.style.display="none";},15000);

// ---- Auth + Multiplayer + Admin ----
wireAuthUI();
initAuth((user) => {
  // ---- Init missions ----
  initMissions(user.uid, (active) => { _activeMission = active; _updateMissionTracker(); });
  initMultiplayer(scene, (count) => {
    const el=$("online-count"); if(el) el.textContent=count+" here";
    const hudEl=$("online-count-hud"); if(hudEl) hudEl.textContent=count;
  },
    (msg) => {
      const log=$("chat-log"); if(!log)return;
      const div=document.createElement("div");
      div.style.cssText="padding:4px 6px;border-bottom:1px solid #eee;";
      div.innerHTML='<b style="color:'+(msg.uid===getMyUid()?"var(--green)":"#1d5fa8")+';">'+msg.name+':</b> '+msg.text;
      log.appendChild(div); log.scrollTop=log.scrollHeight;
      while(log.children.length>30) log.removeChild(log.firstChild);
    });
  // Check daily reward on login
  checkDailyReward(user.uid).then((reward) => {
    if (reward) { game.state.money += reward.money; updateHUD(); toast(reward.label+'! Welcome back.'); }
  });
  // ---- SYNC: listen to Firebase economy/{uid}/balance so admin credits work ----
  // When admin credits/deducts money, the player's game detects it and updates.
  let _lastFirebaseBal = null;
  onValue(ref(db, "economy/" + user.uid + "/balance"), (snap) => {
    const fbBal = snap.val();
    if (fbBal == null) return; // no economy entry yet
    if (_lastFirebaseBal === null) {
      // First load — if Firebase has a balance, use it (admin may have set it)
      _lastFirebaseBal = fbBal;
      if (fbBal !== game.state.money) {
        game.state.money = fbBal;
        game.save?.();
        updateHUD();
      }
    } else if (fbBal !== _lastFirebaseBal) {
      // Balance changed in Firebase (admin credited/deducted)
      _lastFirebaseBal = fbBal;
      game.state.money = fbBal;
      game.save?.();
      updateHUD();
      toast("💰 Balance updated to ₦" + fbBal.toLocaleString());
    }
  });
  // ---- Also write player's name to economy node so admin shows it ----
  const playerName = user.displayName || user.email?.split("@")[0] || "Player";
  update(ref(db, "economy/" + user.uid), { name: playerName, balance: game.state.money });
  // ---- Sync look across devices: the account's saved outfit in Firebase WINS over this device's local copy ----
  let _lookFirst = true;
  onValue(ref(db, "players/" + user.uid + "/look"), (snap) => {
    const fb = snap.val();
    const first = _lookFirst; _lookFirst = false;
    if (first) {
      // new account (no saved character yet) -> character creator after the world has loaded
      const needCreate = !(fb && fb.created);
      if (needCreate) {
        if (fb) game.state.look = { ...game.state.look, ...fb };
        game.state.look.created = false;
        const t = setInterval(() => { if (!rig) return; clearInterval(t); window._openCreator(); }, 400);
      }
    }
    if (!fb) { if (first) update(ref(db, "players/" + user.uid + "/look"), game.state.look); return; }
    if (JSON.stringify(fb) === JSON.stringify(game.state.look)) return;
    game.state.look = { ...game.state.look, ...fb };
    game.save?.();
    if (rig?.recolor) rig.recolor(game.state.look);
  });
});
initAdmin((user) => {
  toast("Admin access detected — welcome, " + (user.email || "Admin"));
  const badge = document.getElementById("admin-user-badge");
  if (badge) badge.textContent = user.email ? user.email.split("@")[0] : "Admin";
});

// Wire admin HUD button (revealed automatically when isAdmin becomes true)
$("admin-hud-btn")?.addEventListener("click", () => {
  if (isAdmin()) showAdminDashboard();
  else toast("Admin access required");
});

// Listen for global announcements → show as toast
let _lastAnnounceTs = Date.now();
onValue(ref(db, "announcements"), (snap) => {
  const data = snap.val() || {};
  const list = Object.values(data).sort((a,b) => (a.ts||0)-(b.ts||0));
  for (const a of list) {
    if ((a.ts||0) > _lastAnnounceTs) {
      const prefix = a.alert ? "⚠️ " : "📢 ";
      toast(prefix + (a.text || ""));
    }
  }
  if (list.length) _lastAnnounceTs = list[list.length-1].ts || _lastAnnounceTs;
});

// Listen for live events → show as toast
let _shownEvents = {};
onValue(ref(db, "events"), (snap) => {
  const data = snap.val() || {};
  for (const [k, e] of Object.entries(data)) {
    if (!_shownEvents[k] && e.icon && e.name) {
      _shownEvents[k] = true;
      toast(e.icon+' '+e.name+'! '+(e.bonus || ""));
    }
  }
});

// ---- Main loop ----
const clock = new THREE.Clock();
let mmT=0, hitCool=0, hudT=0, _missionCheckT=0;
// ---- Automatic speed governor: if the phone is slow, lower quality step by step ----
let _gAcc = 0, _gN = 0, _gLevel = 0, _gWarm = 0;
function governor(raw) {
  if (raw > 0.25) return;                 // tab was hidden / big hitch: ignore
  _gWarm += raw; if (_gWarm < 4) return;  // let loading finish first
  _gAcc += raw; _gN++;
  if (_gAcc < 2.5) return;
  const fps = _gN / _gAcc; _gAcc = 0; _gN = 0;
  if (fps >= 42 || _gLevel >= 4) return;
  _gLevel++;
  const pr = renderer.getPixelRatio();
  if (_gLevel === 1) renderer.setPixelRatio(Math.max(1, pr * 0.8));
  else if (_gLevel === 2) renderer.setPixelRatio(1);
  else if (_gLevel === 3) { renderer.shadowMap.enabled = false; sun.castShadow = false; scene.traverse((o) => { if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach((x) => { x.needsUpdate = true; }); } }); }
  else if (_gLevel === 4) { renderer.setPixelRatio(0.75); scene.fog.near = 30; scene.fog.far = 90; }
  console.log("[quality] fps", fps.toFixed(0), "-> level", _gLevel);
}

function frame() {
  // Nothing runs until the player has signed in / signed up.
  if (!isAuthed && !window.__bypassAuth) { clock.getDelta(); renderer.render(scene, camera); requestAnimationFrame(frame); return; }
  const _raw = clock.getDelta(); governor(_raw);
  const dt = Math.min(_raw, 0.05);
  const now = Date.now() / 1000;
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
  const active = getActivePlace();
  if (!active) collide(player.pos, world.colliders);
  // If we're inside a place, also collide with the place's local colliders
  if (active?.handle?.colliders) {
    for (const c of active.handle.colliders) {
      const cx = Math.max(c.minX, Math.min(player.pos.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(player.pos.z, c.maxZ));
      const dx = player.pos.x - cx, dz = player.pos.z - cz, d2 = dx * dx + dz * dz;
      const r = 0.45;
      if (d2 < r * r) {
        if (d2 > 1e-6) { const d = Math.sqrt(d2), f = (r - d) / d; player.pos.x += dx * f; player.pos.z += dz * f; }
        else player.pos.x = c.minX - r;
      }
    }
  }
  // Update active place (NPC animations, smoke, etc.)
  updateActive(dt, now);
  // Show entrance/exit prompt
  tickEntrancePrompt(player.pos.x, player.pos.z, _gameHour());

  // Hide traffic when inside a place (fixes "cars inside buildings" bug)
  traffic.setVisible?.(!active);
  if (!active) traffic.update(now);
  if (!active) npcs.update(dt, now, player.pos.x, player.pos.z);
  hitCool -= dt;
  if (!active) {
    for (const c of traffic.positions) {
      if (Math.abs(player.pos.x - c.x) < c.hl + 0.4 && Math.abs(player.pos.z - c.z) < c.hw + 0.4) {
        player.pos.z += (player.pos.z >= c.z ? 1 : -1) * 0.25; player.pos.x += c.dir * c.speed * dt * 0.8;
        if (hitCool <= 0) { toast("Eyah! Watch the road, use the zebra"); hitCool = 2.5; }
      }
    }
  }
  if (rig) { rig.group.position.copy(player.pos); rig.group.rotation.y = player.heading; rig.animate(dt, player.speed); }
  updateCamera(camera, ctl, player.pos, active ? (active.handle.colliders || []) : world.colliders, dt);
  applyTime();
  if (active) { scene.background = INTERIOR_BG; scene.fog.color.copy(INTERIOR_BG); sun.intensity = 0; hemi.intensity = 0.8; _dayApplied = false; }
  renderer.shadowMap.autoUpdate = !active;   // no shadow pass inside buildings
  game.updateNeeds(dt);
  // ---- Mission tracking ----
  if(player.speed>0.5){missionState.totalDistance+=player.speed*dt;}
  missionState.money=game.state.money;
  _missionCheckT+=dt;if(_missionCheckT>2){_missionCheckT=0;checkStep(missionState);_updateMissionTracker();}
  hudT += dt; if (hudT > 0.5) { hudT = 0; updateHUD(); }
  if (!active) savePos(dt);
  sendPosition(player.pos.x, player.pos.z, player.heading);
  setMyPosition(player.pos.x, player.pos.z);
  mmT += dt; if (mmT > 0.1) { mmT = 0; mmDraw(player.pos.x, player.pos.z, ctl.yaw, player.heading, traffic.positions); }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

Promise.all([loadPlayer(manager, scene, game.state.look), addCity(scene, world, manager)]).then(([r]) => {
  mmDraw = createMinimap($("mm"), world.mapShapes);
  rig = r; rig.group.castShadow = true;
  if (rig.recolor) rig.recolor(game.state.look); // in case the account outfit arrived while loading
  setProgress(1);
  ctl.yaw = player.heading + Math.PI;
  updateHUD();
  
  frame();
  $("loading").classList.add("done");
  window.__dbg = { player, ctl, npcs, renderer, scene, game };
  window.__ready = true;
}).catch((e) => showError("Could not load the game: " + e.message));
