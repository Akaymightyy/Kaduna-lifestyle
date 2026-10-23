import * as THREE from "three";
import { buildWorld } from "./world.js";
import { createTraffic } from "./traffic.js";
import { loadPlayer, collide } from "./player.js";
import { createControls, updateCamera } from "./controls.js";
import { createMinimap } from "./minimap.js";
import { addCity } from "./city.js";
import { WIDE_AVENUES_X, WIDE_CROSS_Z, MAP_HALF_X, MAP_HALF_Z } from "./config.js";
import { TIPS, NEEDS, FOOD_ITEMS, JOBS, RANKS, ZONES, RIDES, MAP_LOCATIONS, DAILY_QUESTS, DAILY_REWARDS, TIME_SCALE, REAL_MS_PER_GAME_HOUR, FIXED_HOUR, SHOW_NIGHT } from "./config.js";
import { createGameState } from "./needs.js";
import { auth, db } from "./firebase.js";
import { initAuth, showAuthModal, wireAuthUI, logout, isAuthed } from "./auth.js";
import { driveStep } from "./drive.js";
import { initMultiplayer, sendPosition, sendChat, getMyUid, getMyName, setMyPosition, getRemotePlayers, setMyPlace, setMyLook, setBlockedUids, setMyRiding, setMyPassengerOf, getPassengerUids, getRemotePlayerData } from "./multiplayer.js";
import { startRide, travelToZone, travelToPlace, getDestinations } from "./travel.js";
import { subscribeRichList } from "./economy.js";
import { createNPCs } from "./npcs.js";
import { initAdmin, showAdminDashboard, hideAdminDashboard, isAdmin, adminTab } from "./admin.js";
import { checkDailyReward, getDailyStatus, claimQuestReward } from "./daily.js";
import { ref, get, onValue, update, set } from "firebase/database";
import { openCreator } from "./creator.js";
import { mountPreview, setPreviewLook } from "./charpreview.js";
import { outfitsFor, BUILDS, SHOP, SLOT_KEYS } from "./outfits.js";
import { tickContext } from "./contextmenu.js";
import { peekWorld, initPlaceManager, tickEntrancePrompt, updateActive, bindInteractKey, getActivePlace, enterPlace, enterPlaceAsVisitor, exitPlace, sendUIEvent } from "./places/manager.js";
import { listPlaces, getPlace, updateHomeEntrance } from "./places/registry.js";
import { initMissions, getActiveMission, getAllChapters, getDailyMissions, getWeeklyMissions, checkStep, createMissionState, claimDailyReward, claimWeeklyReward, setCelebrateCallback } from "./missions.js";
import { FURNITURE_CATALOG, CATEGORIES, getItem, calcComfort } from "./furniture.js";
import { ORIGINS, HOUSE_TIERS, upgradeCost, getRentInfo, payRent, checkRentDue, applyOrigin, getOriginUI } from "./origins.js";
import { extendHouseTiers, getLuxuryTiers, isLuxuryTier } from "./housing_upgrade.js";
import { initPhotoMode, enterPhotoMode, exitPhotoMode, isPhotoMode } from "./photo_mode.js";
import { initChallengeSystem, subscribeToMyChallenges, getMyActiveMatches } from "./challenge_system.js";
import { initChallengeUI, openMatchForChallenge } from "./challenge_ui.js";
import { initTennisUI } from "./tennis_ui.js";
import { initPenaltyUI } from "./penalty_shootout_ui.js";
import { initSniperUI } from "./sniper_ui.js";
import { initBowlingUI } from "./bowling_ui.js";
import { initPoolUI } from "./pool_ui.js";
import { initHowToPlay, showHowToPlay } from "./how_to_play.js";
import { initSpyMissions, getSpyMissions, getMyUnlockTag } from "./spy_missions.js";
import { initSpyMissionsUI, renderSpyMissionsApp, openMission as openSpyMission } from "./spy_mission_ui.js";
import { initMoneyHunt, tickMoneyHunt, getHuntStats, getNearestSpot, getAllSpotsWithState, claimSpot, triggerMoneyRain } from "./moneyhunt.js";
import { HUNT_ACHIEVEMENTS, RARITY, SPOTS } from "./moneyspots.js";
import { celebrate } from "./celebrate.js";
import { initSfx, sfx, setMuted as setSfxMuted, isMuted as isSfxMuted } from "./sfx.js";
import { initParticles, emitConfetti, emitDust, tickParticles } from "./particles.js";
import { initRoadEvents, tickRoadEvents, getCurrentWeather as getRoadWeather, resetRoadEvents, trafficSpeedMultiplierAt } from "./road_events.js";
import { addScenery, SCENERY_LABELS } from "./scenery.js";
import { initLife, tickLife , setLifePlayerVehicle } from "./life.js";
import { initLiveMap, openLiveMap, closeLiveMap, isLiveMapOn, liveMapFrame } from "./livemap.js";
import { perfFrameStart, perfBeforeRender, perfAfterRender } from "./perf.js";
import { initGraphics, updateSky, nightAmount, tickGraphics, tickShadows, applyQuality, autoDetectQuality, getQuality, QUALITY_PRESETS } from "./graphics.js";
import { AREAS, getArea, claimPlot, getMyHouse, canPickArea, getPlotPosition } from "./areas.js";
import { resolvePlayerHouseKey, loadHouse, setHouseLocked, listenForKnocks, respondToKnock } from "./houses.js";
import {
  initPlotDoors,
  tickPlotDoors,
  knockOnNearest,
  listenForKnockReplyNow,
  getUnlockedVisitInfo,
  getNearestFriendPlot,
  disposePlotDoors,
  getAreaNameSprites,
} from "./plots.js";
import { initAreaWorld, tickAreaWorld, setAreaLampsNight, disposeAreaWorld, getRentSigns, districtFunLabels, districtLayout } from "./areas_world.js";
// FEATURE 3c: load real Kaduna road + river + building data from kaduna.json
// (a static OSM-derived file shipped in public/data/). The main Ahmadu Bello
// Way is filtered out (already rendered by world.js) to avoid double-render.
import { fetchKadunaData, buildRealMap } from "./realmap.js";
import { getSeat, VEHICLE_CATALOG, getVehicle, initVehicles, buyVehicle, getOwned, ownsVehicle, isRiding, getRideSpeed, getRideId, spawnRideVehicle, despawnRideVehicle, tickRideVehicle } from "./vehicles.js";
import { extendCatalog } from "./dealership_catalog.js";
import { buildStreetDetail, makeBlobShadows } from "./street.js";
import { initActivity, startActivity, tickActivity, isBusy, cancelActivity, eatSpec, toiletSpec, sitSpec, funSpec, placeSpec } from "./activity.js";
import { initWorldChat, toggleWorldChat, closeWorldChat, setChatBlocked, setChatOnline } from "./worldchat.js";
import { initBillboards, getBillboards, getBillboardPositions, getBillboardAdInfo, buyBillboardAd, reportBillboard } from "./billboards.js";
import { initEmoteBroadcast, sendEmote, clearEmote, EMOTES } from "./emote_broadcast.js";
import { initMessages, searchUsers, openDM, sendMessage, sendHouseInvite, openChat, closeChat, getChatList, sendMoney, createGroup, leaveGroup, blockUser, reportUser, getChatMeta, cleanupMessages, getPresence, listenToPresence, getProfile } from "./messages.js";
import { initEvents, tickNepa, isNepaCut, getNepaStatus, hasPowerBackup, getModifiedDrain, tickMoodlets, addMoodlet, getActiveMoodlets, getConsequences, getWalkSpeedMultiplier, MOODLET_DEFS } from "./events.js";
import { SKILLS, CAREERS, SHIFT_TONES, initCareers, getSkills, getCareer, getCareerDef, canJoinCareer, canPromote, joinCareer, promote, doShift, trainSkill } from "./careers.js";
import { WISH_POOL, PERKS, initWishes, getTodaysWishes, getWishPoints, getPerks, hasPerk, checkWishes, buyPerk } from "./wishes.js";
import { POLICIES, initElection, getElection, getWeekKey, isCandidate, hasVoted, registerCandidate, vote, tallyVotes, getActivePolicy, applyPolicy } from "./election.js";
import { initSocial, getFriends, addFriendByUsername, removeFriend, listenToDMs, sendDM, generateVisitLink, checkVisitLink } from "./social.js";
import { WEATHERS, HEADLINES, initFlavour, getTodayWeather, getCurrentWeather, tickHeadlines, getActiveHeadlines, getCombinedModifiers } from "./flavour.js";

const $ = (id) => document.getElementById(id);
const showError = (m) => { const e = $("err"); e.style.display = "flex"; e.textContent = m; };
// A stray runtime error must not kill the whole game screen: log it, only load failures are fatal.
addEventListener("error", (e) => { console.error("[game error]", e.message); });

// ---- PWA: Install App prompt ----
// When the browser detects the app is installable, it fires beforeinstallprompt.
// We capture it and show a floating "Install App" button. Tapping it triggers
// the browser's native install dialog.
let _deferredPrompt = null;
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  _deferredPrompt = e;
  // Show install button if not already shown + not already installed
  if (!_deferredPrompt || localStorage.getItem("kaduna-installed") === "1") return;
  let btn = document.getElementById("pwa-install-btn");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "pwa-install-btn";
    btn.style.cssText = "position:fixed;right:12px;top:calc(12px + env(safe-area-inset-top));" +
      "z-index:35;background:#f2b134;color:#000;border:none;border-radius:20px;padding:6px 14px;" +
      "font:700 12px Poppins,sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3);" +
      "display:flex;align-items:center;gap:4px;";
    btn.innerHTML = "📥 Install";
    btn.onclick = async () => {
      if (!_deferredPrompt) return;
      _deferredPrompt.prompt();
      const { outcome } = await _deferredPrompt.userChoice;
      if (outcome === "accepted") {
        localStorage.setItem("kaduna-installed", "1");
        toast("🎉 Kaduna Lifestyle installed! Find it on your home screen.");
      }
      _deferredPrompt = null;
      btn.remove();
    };
    document.body.appendChild(btn);
  }
});
// Hide install button if already installed (running in standalone mode)
addEventListener("appinstalled", () => {
  localStorage.setItem("kaduna-installed", "1");
  document.getElementById("pwa-install-btn")?.remove();
});
// Check if already running as installed PWA (standalone mode)
if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
  localStorage.setItem("kaduna-installed", "1");
}

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

// FEATURE: push the current balance to Firebase when the user closes the tab,
// refreshes, or backgrounds the app. Without this, money earned via med/clothing/
// ride/quest/job/daily-reward that didn't explicitly call update(economy/uid)
// would be lost on logout. Armed once per session (after first sign-in).
let _beforeUnloadArmed = false;
function _armBeforeUnload(uid) {
  if (_beforeUnloadArmed) return;
  _beforeUnloadArmed = true;
  addEventListener("beforeunload", () => {
    try {
      const u = uid || getMyUid();
      if (!u) return;
      update(ref(db, "economy/" + u), { balance: game.state.money });
    } catch (e) { /* non-critical */ }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      try {
        const u = uid || getMyUid();
        if (!u) return;
        update(ref(db, "economy/" + u), { balance: game.state.money });
      } catch (e) { /* non-critical */ }
    }
  });
}

// ---- FEATURE: Vehicle driving controls (on-screen buttons) ----
// When riding, dedicated left/right/accelerate/brake buttons appear.
// These set window._vehBtnSteer / window._vehBtnThrottle which the
// movement loop reads in addition to the joystick + keyboard.
let _vehControlsEl = null;
function _ensureVehicleControls() {
  if (_vehControlsEl) return;
  _vehControlsEl = document.createElement("div");
  _vehControlsEl.id = "vehicle-controls";
  _vehControlsEl.style.cssText =
    "position:fixed;inset:0;z-index:28;pointer-events:none;display:none;";
  // Acceleration (big green button, bottom-right) — hold to add speed
  const accelBtn = document.createElement("button");
  accelBtn.innerHTML = '<div style="line-height:1;font-size:28px;">▲</div><div style="font:800 8px Poppins,sans-serif;margin-top:2px">ACCELERATE</div>';
  accelBtn.style.cssText = "position:absolute;right:20px;bottom:calc(130px + env(safe-area-inset-bottom));" +
    "width:80px;height:80px;border-radius:50%;background:#4ade80;color:#000;border:3px solid #fff;display:flex;flex-direction:column;align-items:center;justify-content:center;" +
    "font-size:28px;font-weight:700;cursor:pointer;pointer-events:auto;touch-action:none;" +
    "box-shadow:0 4px 12px rgba(0,0,0,.4);user-select:none;-webkit-user-select:none;";
  // Brake (red button, left of accelerate) — press to stop
  const brakeBtn = document.createElement("button");
  brakeBtn.innerHTML = '<div style="line-height:1;font-size:24px;">■</div><div style="font:800 9px Poppins,sans-serif">BRAKE</div>';
  brakeBtn.style.cssText = "position:absolute;right:110px;bottom:calc(130px + env(safe-area-inset-bottom));" +
    "width:64px;height:64px;border-radius:50%;background:#e11d48;color:#fff;border:3px solid #fff;display:flex;flex-direction:column;align-items:center;justify-content:center;" +
    "font-size:24px;font-weight:700;cursor:pointer;pointer-events:auto;touch-action:none;" +
    "box-shadow:0 4px 12px rgba(0,0,0,.4);user-select:none;-webkit-user-select:none;";
  // NOTE: Left/right steering buttons REMOVED (Oct 21). Steering now comes
  // from the analog joystick only (left/right on the joystick = steer).
  // This is cleaner + more intuitive — like real driving games.
  // Wire up pointer events for each button
  const wireBtn = (el, steerVal, throttleVal) => {
    const start = (e) => { e.preventDefault(); if (steerVal !== undefined) window._vehBtnSteer = (window._vehBtnSteer || 0) + steerVal; if (throttleVal !== undefined) window._vehBtnThrottle = (window._vehBtnThrottle || 0) + throttleVal; el.style.transform = el.style.transform.replace("scale(1)", "scale(0.92)"); };
    const end = (e) => { e.preventDefault(); if (steerVal !== undefined) window._vehBtnSteer = (window._vehBtnSteer || 0) - steerVal; if (throttleVal !== undefined) window._vehBtnThrottle = (window._vehBtnThrottle || 0) - throttleVal; el.style.transform = el.style.transform.replace("scale(0.92)", "scale(1)"); };
    el.addEventListener("pointerdown", start);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("pointerleave", end);
  };
  wireBtn(accelBtn, undefined, 1);     // accelerate (hold to add speed)
  wireBtn(brakeBtn, undefined, -1);    // brake (press to stop — no reverse)
  _vehControlsEl.appendChild(accelBtn);
  _vehControlsEl.appendChild(brakeBtn);
  document.body.appendChild(_vehControlsEl);
}
// ---- PASSENGER "Get off ride" button (Oct 19) ----
let _getoffBtnEl = null;
function _ensureGetoffBtn() {
  if (_getoffBtnEl) return;
  _getoffBtnEl = document.createElement("button");
  _getoffBtnEl.innerHTML = "🛵<br><span style='font-size:11px;font-weight:600'>Get off ride</span>";
  _getoffBtnEl.style.cssText =
    "position:fixed;right:20px;bottom:calc(130px + env(safe-area-inset-bottom));" +
    "width:88px;height:88px;border-radius:50%;background:#e11d48;color:#fff;border:3px solid #fff;" +
    "font-size:22px;font-weight:700;cursor:pointer;pointer-events:auto;touch-action:none;" +
    "box-shadow:0 4px 12px rgba(0,0,0,.4);user-select:none;-webkit-user-select:none;display:none;z-index:28;text-align:center;line-height:1.1;";
  _getoffBtnEl.addEventListener("click", (e) => { e.preventDefault(); window._getOffRide(); });
  document.body.appendChild(_getoffBtnEl);
}

// ---- FEATURE: Periodic Firebase balance pusher ----
// Pushes the balance to Firebase every 5 seconds IF it changed since last push.
// More reliable than beforeunload on mobile (which can be unreliable).
let _lastPushedMoney = null;
let _balancePushT = null;
function _armBalancePusher(uid) {
  if (_balancePushT) return;
  _balancePushT = setInterval(() => {
    try {
      const u = uid || getMyUid();
      if (!u || !game.state) return;
      if (_lastPushedMoney !== game.state.money) {
        _lastPushedMoney = game.state.money;
        update(ref(db, "economy/" + u), { balance: game.state.money });
      }
    } catch (e) { /* non-critical */ }
  }, 5000);
}

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
// FIX: turn off autoUpdate so the shadow map doesn't re-render every frame.
// tickShadows() (in graphics.js) re-renders it only when the player moves
// >4m or the sun noticeably shifts. This is the #1 lag fix for Medium/High.
renderer.shadowMap.autoUpdate = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
// vivid colour grade for EVERY city, district, vehicle, character and sky (one place, nothing missed)
// NOTE: no CSS filter / drop-shadow on the WebGL canvas — it forces a full-screen GPU re-composite every frame, which tanks FPS
// and makes the adaptive governor drop the resolution (= blurry on High). Colour grade lives in the shaders instead.
// cinematic vignette (cheap CSS overlay) — frames the scene like a real camera lens
try { const v = document.createElement('div'); v.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2;background:radial-gradient(ellipse at 50% 45%,rgba(0,0,0,0) 55%,rgba(0,0,0,.34) 100%)'; document.body.appendChild(v); } catch (e) {}
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xa9d6f2, Q.fogNear, Q.fogFar);

// FEATURE: tap-raycaster for clicking remote player name tags (→ open DM)
// and area name signs (→ travel there). Detects taps on the canvas that
// aren't part of a drag (joystick) and raycasts against sprites + remote
// player groups in the scene.
const _tapRaycaster = new THREE.Raycaster();
const _tapPointer = new THREE.Vector2();
let _tapDown = null;
canvas.addEventListener("pointerdown", (e) => {
  _tapDown = { x: e.clientX, y: e.clientY, t: Date.now() };
});
canvas.addEventListener("pointerup", (e) => {
  if (!_tapDown) return;
  const dx = e.clientX - _tapDown.x, dy = e.clientY - _tapDown.y;
  const moved = Math.sqrt(dx * dx + dy * dy);
  const elapsed = Date.now() - _tapDown.t;
  _tapDown = null;
  if (moved > 10 || elapsed > 500) return;  // drag, not tap
  _handleWorldTap(e.clientX, e.clientY);
});

// ---- Tap a player's name tag -> options (Chat / Say Hello / Send money / Invite home) ----
function _plAvatar(look) {
  const l = look || {}, skin = l.skin || "#8a5a3c", top = l.top || "#1f7a5a", hair = l.hair || "#111111";
  return '<svg viewBox="0 0 58 58" width="56" height="56" style="border-radius:50%;flex:none;background:#dfe8d8"><path d="M6 58c0-14 10-21 23-21s23 7 23 21z" fill="' + top + '"/><circle cx="29" cy="24" r="12" fill="' + skin + '"/><path d="M17 23c0-9 6-13 12-13s12 4 12 13c-3-4-7-6-12-6s-9 2-12 6z" fill="' + hair + '"/></svg>';
}
function _showPlayerSheet(uid, name) {
  let el = document.getElementById("player-sheet");
  if (!el) { el = document.createElement("div"); el.id = "player-sheet"; document.body.appendChild(el); }
  const m = getRemotePlayers()[uid];
  window._plTarget = { uid, name };
  el.innerHTML = '<div class="pl-grab"></div>' +
    '<div class="pl-head">' + _plAvatar(m && m.look) + '<div><div class="pl-name">' + _mxEsc(name) + '</div><div class="pl-sub">Real player · nearby</div></div></div>' +
    '<button class="pl-btn primary" onclick="window._plChat()">💬 Chat</button>' +
    '<div class="pl-grid"><button class="pl-btn" onclick="window._plHello()">👋 Say Hello</button><button class="pl-btn" onclick="window._plMoney()">💸 Send money</button><button class="pl-btn" onclick="window._plInvite()">🏠 Invite to my home</button><button class="pl-btn" onclick="window._plPickup()">🛵 Pick up (give ride)</button><button class="pl-btn ghost" onclick="window._plClose()">Close</button></div>' +
    '<div class="pl-chips"><button onclick="window._plBlock()">🚫 Block</button><button onclick="window._plReport()">⚑ Report</button></div>';
  requestAnimationFrame(() => el.classList.add("show"));
}
async function _plOpenDM() {
  const t = window._plTarget; if (!t) throw new Error("no target");
  const r = await openDM(t.uid, t.name);
  if (!r) throw new Error("openDM failed");
  window._openChatId = r.chatId; window._openChatOtherUid = t.uid;
  window._openChatName = r.otherUsername ? "@" + r.otherUsername : (r.otherName || t.name);
  return r;
}
window._plClose = () => document.getElementById("player-sheet")?.classList.remove("show");
window._plChat = async () => { try { await _plOpenDM(); window._plClose(); showPhoneApp("messages"); } catch (e) { console.warn("[player] chat", e); toast("Could not open chat — try again"); } };
window._plHello = async () => { try { const r = await _plOpenDM(); await sendMessage(r.chatId, "👋 Hello!"); toast("👋 You said hello to " + window._plTarget.name); window._plClose(); } catch (e) { console.warn("[player] hello", e); toast("Could not send — try again"); } };
window._plMoney = async () => { try { await _plOpenDM(); window._plClose(); window._chatSendMoney(); } catch (e) { toast("Could not open — try again"); } };
window._plBlock = async () => { const t = window._plTarget; if (!t || !confirm("Block " + t.name + "? You will no longer see their character.")) return; try { await blockUser(t.uid); window._plClose(); } catch (e) { toast("Could not block — try again"); } };
window._plReport = async () => { const t = window._plTarget; if (!t) return; const why = prompt("Why are you reporting " + t.name + "?"); if (!why) return; try { await reportUser(t.uid, why.slice(0, 300)); toast("⚑ Report sent. Thank you."); window._plClose(); } catch (e) { toast("Could not send report — try again"); } };
window._plInvite = async () => { try { await _plOpenDM(); window._plClose(); await window._chatInvite(); } catch (e) { toast("Could not send invite — try again"); } };
// ---- PICKUP / PASSENGER SYNC (Oct 19) ----
// Driver taps "Pick up (give ride)" on a nearby player → sends them a chat
// message asking them to accept. If they tap "Accept" in the chat, their
// client sets live/<theirUid>/passengerOf = <myUid>. Their main loop then
// forces their position to follow mine. They can tap "Get off" anytime.
window._plPickup = async () => {
  const t = window._plTarget;
  if (!t) return;
  if (!isRiding()) { toast("You need to be on a vehicle first. Open Cars → Ride."); return; }
  // Check they're not already a passenger or riding themselves
  const rd = getRemotePlayerData(t.uid);
  if (rd && rd.riding) { toast(t.name + " is already on their own ride."); return; }
  if (rd && rd.passengerOf) { toast(t.name + " is already a passenger."); return; }
  // Send them a "pickup invite" message via chat (uses the house-invite UI
  // pattern but with type "pickup" so their chat shows an Accept button).
  try {
    const r = await _plOpenDM();
    await sendMessage(r.chatId, "🛵 Pickup invite — tap Accept to ride with me", "pickup", 0, {
      driverUid: getMyUid(),
      driverName: getMyName() || "Player",
      vehicleId: getRideId(),
    });
    toast("🛵 Pickup invite sent to " + t.name);
    window._plClose();
  } catch (e) {
    console.warn("[pickup] failed", e);
    toast("Could not send pickup — try again");
  }
};
// Passenger: when I'm a passenger on someone's ride, my position is
// force-set to their position each frame (with a small offset so I sit
// "behind" them on the bike). They drive, I ride.
// Also: tap "Get off" button to dismount at the current location.
function _tickPassenger(dt) {
  const driverUid = _myPassengerUid;
  if (!driverUid) return;
  const rd = getRemotePlayerData(driverUid);
  if (!rd) {
    // Driver logged off — auto-dismount
    _myPassengerUid = null;
    setMyPassengerOf(null);
    toast("🚶 Driver left — you're on foot.");
    return;
  }
  // Sit slightly behind + above the driver (pillion position)
  const back = 1.2;
  const fx = -Math.sin(rd.heading || 0), fz = -Math.cos(rd.heading || 0);
  player.pos.x = (rd.x || 0) - fx * back;
  player.pos.z = (rd.z || 0) - fz * back;
  player.heading = rd.heading || 0;
  player.speed = 0;
}
// Track who I'm a passenger of (local mirror of live/<myUid>/passengerOf)
let _myPassengerUid = null;
function setMyPassengerDriver(driverUid) {
  _myPassengerUid = driverUid || null;
  setMyPassengerOf(driverUid);
  if (driverUid) {
    // Hide the ride vehicle UI since the driver controls the bike, not me
    if (_vehControlsEl) _vehControlsEl.style.display = "none";
    toast("🛵 You're a passenger now. Tap the 🛵 button to get off.");
  } else {
    toast("🚶 You got off the ride.");
  }
}
// When the driver dismounts, kick all passengers off their ride
function _kickAllPassengers() {
  const uids = getPassengerUids(getMyUid());
  // Tell each passenger's local state to dismount — they'll see it next
  // time their _players map updates from Firebase. For an instant local
  // nudge, we'd need a separate "kick" signal — for now Firebase is fast
  // enough that the next onValue tick (within 1s) clears their passengerOf.
  // We just clear OUR state and trust their heartbeat to drop them.
  if (uids.length) toast("Dropped off " + uids.length + " passenger" + (uids.length > 1 ? "s" : ""));
}
window._getOffRide = () => {
  if (_myPassengerUid) {
    setMyPassengerDriver(null);
    return;
  }
  toast("You're not a passenger.");
};

function _handleWorldTap(clientX, clientY) {
  if (!camera || !scene) return;
  const rect = canvas.getBoundingClientRect();
  _tapPointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  _tapPointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  _tapRaycaster.setFromCamera(_tapPointer, camera);
  const targets = [];
  // Remote player groups
  const remotes = getRemotePlayers();
  for (const uid in remotes) {
    const m = remotes[uid];
    if (m.group && m.group.visible) targets.push(m.group);
  }
  // Area name sprites
  const areaSprites = getAreaNameSprites();
  for (const [areaId, entry] of areaSprites) {
    if (entry.sprite && entry.sprite.visible) targets.push(entry.sprite);
  }
  // FOR RENT / FOR SALE sign sprites
  const rentSigns = getRentSigns();
  for (const slot of rentSigns) {
    if (slot.sprite && slot.sprite.visible) targets.push(slot.sprite);
  }
  // Billboard screen meshes
  for (const bb of getBillboards()) {
    if (bb.screenMesh && bb.group.visible) targets.push(bb.screenMesh);
  }
  if (!targets.length) return;
  const hits = _tapRaycaster.intersectObjects(targets, true);
  if (!hits.length) return;
  let obj = hits[0].object;
  while (obj && !obj.userData?.isRemotePlayer && !obj.userData?.isAreaName && !obj.userData?.isForRent && !obj.userData?.isBillboard) obj = obj.parent;
  if (!obj) return;
  const ud = obj.userData;
  if (ud.isRemotePlayer) {
    const otherUid = ud.playerUid;
    const otherName = ud.playerName || "Player";
    if (!otherUid || otherUid === getMyUid()) return;
    _showPlayerSheet(otherUid, otherName);
  } else if (ud.isAreaName) {
    const areaId = ud.areaId;
    const areaName = ud.areaName;
    const a = getArea(areaId);
    if (!a) { toast("Unknown area"); return; }
    player.pos.set(a.x, 0, a.z);
    player.heading = 0;
    toast("📍 Travelled to " + areaName);
  } else if (ud.isForRent) {
    // Tap on a FOR RENT / FOR SALE sign → rent/buy prompt
    const area = getArea(ud.areaId);
    if (!area) { toast("Unknown area"); return; }
    if (!canPickArea(game.state.origin, area)) { toast("🔒 Your origin can't live here"); return; }
    const isForSale = area.tier === "rich";
    const price = isForSale ? ud.buyPrice : ud.rentPrice;
    const label = isForSale ? "Buy" : "Rent";
    if (game.state.money < price) { toast("Need ₦" + price.toLocaleString() + " to " + label.toLowerCase() + " here"); return; }
    if (!confirm(label + " a house in " + ud.areaName + " for ₦" + price.toLocaleString() + "?")) return;
    // Claim the plot
    const uid = getMyUid();
    if (!uid) { toast("Sign in first"); return; }
    const name = getMyName() || "Player";
    toast("🏠 Claiming plot in " + ud.areaName + "...");
    claimPlot(ud.areaId, uid, name, game.state.origin).then((r) => {
      if (r.ok) {
        game.state.money -= price;
        game.state.homeArea = ud.areaId;
        game.state.homePlot = r.plotNo;
        _registerHouse(ud.areaId, r.plotNo, isForSale, r.tier);
        if (r.tier) game.state.homeTier = r.tier;
        game.save?.();
        _syncHomeEntrance();
        update(ref(db, "economy/" + uid), { balance: game.state.money });
        update(ref(db, "players/" + uid), { homeArea: ud.areaId, homePlot: r.plotNo, homeTier: game.state.homeTier });
        toast("🎉 Plot " + r.plotNo + " in " + ud.areaName + " is yours!");
        const pos = getPlotPosition(area, r.plotNo);
        player.pos.set(pos.x, 0, pos.z + 4);
        player.heading = Math.PI;
        updateHUD();
      } else { toast("❌ " + (r.reason || "Could not claim — try another plot")); }
    }).catch((e) => { toast("Claim failed — try again"); console.warn(e); });
  } else if (ud.isBillboard) {
    // FEATURE: Tap on a billboard → show ad buy prompt
    const info = getBillboardAdInfo(ud.billboardId);
    if (!info) { toast("Unknown billboard"); return; }
    const uid = getMyUid();
    if (!uid) { toast("Sign in first"); return; }
    if (info.isAvailable) {
      // Billboard is available — show buy prompt
      const imageUrl = prompt("Enter image URL for your ad (leave blank for text-only):\n(Cloudinary URLs supported)");
      const text = imageUrl ? "" : (prompt("Enter your ad text:") || "Your message here");
      if (game.state.money < info.price) { toast("Need ₦" + info.price.toLocaleString()); return; }
      if (!confirm("Place ad on " + info.name + " for ₦" + info.price.toLocaleString() + "?\nRuns for 7 days.")) return;
      buyBillboardAd(ud.billboardId, uid, getMyName() || "Player", imageUrl, text, game.state, toast).then((ok) => {
        if (ok) { updateHUD(); const u = getMyUid(); if (u) update(ref(db, "economy/" + u), { balance: game.state.money }); }
      });
    } else {
      // Billboard has an active ad — show info
      const ad = info.adData;
      const daysLeft = Math.ceil((ad.expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
      toast("📢 " + info.name + " — Ad by " + (ad.ownerName || "Unknown") + " · " + daysLeft + " days left");
    }
  }
}
const camera = new THREE.PerspectiveCamera(60, 1, 0.6, 400);
const hemi = new THREE.HemisphereLight(0xdfeeff, 0x8a7a55, 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d6, 1.8);
sun.castShadow = Q.shadows;
if (Q.shadows) sun.shadow.mapSize.set(Q.shadowMap, Q.shadowMap);
Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 100 });
sun.shadow.bias = -0.0004; scene.add(sun, sun.target);

function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();

const world = buildWorld(scene);
world.world.add(buildStreetDetail(scene, world.colliders));
const _pShadow = makeBlobShadows(scene, 1);
addScenery(scene, world);
initLife(scene);
initActivity(scene);
const traffic = createTraffic(scene);
let mmDraw = createMinimap($("mm"), world.mapShapes);
// FEATURE 3b: init the chunk-streamed area world (roads + NPC houses + lamp posts).
// Pass world.colliders so per-area house footprints can be added as colliders.
// Must be called AFTER buildWorld() so world.colliders exists.
initAreaWorld(scene, world.colliders);
// FEATURE 3c: load real Kaduna road/river/building data from kaduna.json and
// render it on top of the procedural world. Pass world.world (the worldGroup)
// as the parent so the realmap meshes hide when the player enters a place.
fetchKadunaData().then((kadunaData) => {
  if (!kadunaData) { console.warn("[realmap] kaduna.json failed to load — using procedural world only"); return; }
  const realMap = buildRealMap(scene, kadunaData, world.world);
  if (realMap) {
    console.log("[realmap] Built " + kadunaData.roads.length + " roads + " + (kadunaData.buildings?.length || 0) + " buildings + " + (kadunaData.water?.length || 0) + " water polygons from kaduna.json");
    if (realMap.colliders) world.colliders.push(...realMap.colliders);
    if (realMap.mapShapes) {
      if (realMap.mapShapes.buildings) world.mapShapes.buildings.push(...realMap.mapShapes.buildings);
      if (realMap.mapShapes.roads) {
        world.mapShapes.roads = world.mapShapes.roads || [];
        world.mapShapes.roads.push(...realMap.mapShapes.roads);
      }
    }
  }
}).catch((e) => console.warn("[realmap] fetch failed:", e.message));
const ctl = createControls(canvas, camera, { joy: $("joy"), knob: $("knob") });
const game = createGameState();
const npcs = createNPCs(scene);
const missionState = createMissionState();
let _activeMission = null;

// ---- day/night (real cycle, not forced daytime) ----
const SKY = [[0,0x0b1230,0.0,0.25,0x8899ff],[5,0x1b2548,0.0,0.3,0x8899ff],[6.5,0xf3a56b,0.9,0.7,0xffb070],[9,0x9fd4f5,1.8,1.0,0xfff2d6],[16,0x9fd4f5,1.8,1.0,0xfff2d6],[18,0xf08a5d,1.0,0.75,0xff9a5a],[19.5,0x2a2f55,0.1,0.35,0x8899ff],[24,0x0b1230,0.0,0.25,0x8899ff]];
function skyAt(h) { let i=0; while(i<SKY.length-2&&h>=SKY[i+1][0])i++; const a=SKY[i],b=SKY[i+1],t=(h-a[0])/(b[0]-a[0]); const lc=(x,y)=>new THREE.Color(x).lerp(new THREE.Color(y),t); return {sky:lc(a[1],b[1]),sun:a[2]+(b[2]-a[2])*t,hemi:a[3]+(b[3]-a[3])*t,sunCol:lc(a[4],b[4])}; }
const qs = new URLSearchParams(location.search);
const fixedHour = qs.has("t") ? parseFloat(qs.get("t")) : FIXED_HOUR;  // FEATURE: default = evening (17.5) per config
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const INTERIOR_BG = new THREE.Color(0x1a1510);
let _outHid = null;
let lastClock = "";
let _graphicsInited = false;

// ---- Lamp pool repositioning (pre-allocated buffers, no per-frame GC) ----
// PERF: the old code created 30 new objects + a new array every frame, which
// built up GC pressure until the game stuttered. We pre-allocate one Float32Array
// of (lampPositions.length × 3) entries: [lx, lz, d2] per lamp. On every re-sort
// we reuse this array, compute fresh d2 values, then pick the 6 smallest.
let _lampReposT = 0;
let _lampDistBuf = null;        // Float32Array [lx0, lz0, d2_0, lx1, lz1, d2_1, ...]
let _lampIdxBuf = null;         // Uint16Array of indices, sorted by d2 ascending
function _repositionLampPool(px, pz) {
  if (!world.lampPositions || !world.lampLights) return;
  const n = world.lampPositions.length;
  if (!_lampDistBuf || _lampDistBuf.length !== n * 3) {
    _lampDistBuf = new Float32Array(n * 3);
    _lampIdxBuf = new Uint16Array(n);
  }
  // Fill distances
  for (let i = 0; i < n; i++) {
    const lp = world.lampPositions[i];
    const lx = lp[0], lz = lp[1];
    const dx = lx - px, dz = lz - pz;
    _lampDistBuf[i * 3] = lx;
    _lampDistBuf[i * 3 + 1] = lz;
    _lampDistBuf[i * 3 + 2] = dx * dx + dz * dz;
    _lampIdxBuf[i] = i;
  }
  // Selection sort the first 6 entries (k=6, n=~30 — selection sort is O(kn)
  // which is faster than quicksort for small k).
  for (let i = 0; i < 6 && i < n; i++) {
    let minIdx = i;
    let minD2 = _lampDistBuf[_lampIdxBuf[i] * 3 + 2];
    for (let j = i + 1; j < n; j++) {
      const d2 = _lampDistBuf[_lampIdxBuf[j] * 3 + 2];
      if (d2 < minD2) { minD2 = d2; minIdx = j; }
    }
    if (minIdx !== i) {
      const tmp = _lampIdxBuf[i];
      _lampIdxBuf[i] = _lampIdxBuf[minIdx];
      _lampIdxBuf[minIdx] = tmp;
    }
  }
  // Place the 6 nearest lamps onto the 6 PointLights
  for (let i = 0; i < world.lampLights.length && i < 6; i++) {
    const lampIdx = _lampIdxBuf[i];
    const pl = world.lampLights[i];
    pl.position.set(_lampDistBuf[lampIdx * 3], 6.0, _lampDistBuf[lampIdx * 3 + 1]);
  }
}
function applyTime() {
  // FEATURE: real-time clock (1 real hour = 1 game hour) clamped to daytime
  // (6am-6pm) so the player never sees night. During real-life night hours,
  // the game shows noon. Matches `_gameHour()` for consistency.
  const mins = Date.now() / REAL_MS_PER_GAME_HOUR + 1; // game-hours since epoch (+1 = Nigeria time, WAT)
  let rawHour = mins % 24;
  // FEATURE: clamp to daytime — never show night.
  const hour = fixedHour ?? (!SHOW_NIGHT && (rawHour < 6 || rawHour > 18) ? 12 : rawHour);   // SHOW_NIGHT (config.js): real night look. Shop hours still use _gameHour().
  // ---- Init graphics once (after scene/sun/hemi are ready) ----
  if (!_graphicsInited) {
    _graphicsInited = true;
    const autoQ = autoDetectQuality();
    // Fire and forget — the Sky addon loads async, but the game continues without it
    initGraphics({ renderer, scene, sun, hemi, quality: autoQ }).then(() => {
      applyQuality(autoQ, { renderer, sun, scene });
    });
    // ---- Init new systems (sfx, particles, road events) ----
    initSfx();
    initParticles(scene);
    initRoadEvents({
      scene,
      playerGetPos: () => ({ x: player.pos.x, z: player.pos.z }),
      gameHourGet: () => _gameHour(),
      toast,
      db,
      worldId: "kaduna",
    });
  }
  // ---- Update sky + sun + clouds based on hour ----
  updateSky(hour);
  if (traffic.setGlow) traffic.setGlow(nightAmount(hour));   // headlight + tail light glow, smooth at dusk/dawn
  _pShadow.set(0, player.pos.x, player.pos.z, 1.0, 1.0); _pShadow.done();
  const night = hour < 6.5 || hour > 19.5;
  // sun follows the player (shadows) — position set by updateSky, but we offset to follow player
  sun.position.x += player.pos.x;
  sun.position.z += player.pos.z;
  sun.target.position.set(player.pos.x, 0, player.pos.z);
  // Lamp lights at night
  if (night) {
    traffic.setNight(true);
    world.lamps.material.color.set(0xffd070);
    // FIX: brighter lamp pool (was 0.8 — too dim, streets felt unlit between lamps).
    // 1.3 gives a warm pool of light around each lamp post that overlaps with
    // the next one, so the player always has a lit path.
    if (world.lampLights) for (const pl of world.lampLights) { pl.intensity = 1.3; pl.visible = true; }
    // FEATURE 3b: area lamp posts glow at night too
    setAreaLampsNight(true);
  } else {
    traffic.setNight(false);
    world.lamps.material.color.set(0x555555);
    if (world.lampLights) for (const pl of world.lampLights) { pl.intensity = 0; pl.visible = false; }
    setAreaLampsNight(false);
  }
  // FIX: Reposition the lamp pool to the 6 nearest lamp posts around the player.
  // The pool of 6 PointLights follows the player so the streets around them look
  // lit no matter where they walk. Without this, the pool was stuck at the world
  // origin (0, 6, 0) and only lit a 22m circle there.
  //
  // PERF: throttled to every 0.3s (was every frame, which created 30 throwaway
  // objects + 1 array per frame = ~1800 allocations/sec, causing GC pressure
  // that built up until the game stuttered). Now we reuse one pre-allocated
  // array + index array, and only re-sort 3x per second.
  if (world.lampPositions && world.lampLights && night) {
    _lampReposT += 1/60; // approx dt — close enough for throttling
    if (_lampReposT >= 0.3) {
      _lampReposT = 0;
      _repositionLampPool(player.pos.x, player.pos.z);
    }
  }
  const hh=Math.floor(hour),mm=Math.floor((hour-hh)*60);
  const txt = `${DAYS[Math.floor(mins/24)%7]} · ${((hh+11)%12)+1}:${String(mm).padStart(2,"0")} ${hh<12?"AM":"PM"}`;
  if(txt!==lastClock){lastClock=txt;const cEl=$("clock");if(cEl)cEl.textContent=txt;const sEl=$("sun");if(sEl)sEl.textContent=night?"🌙":"☀️";
    const tpClock=$("tp-clock");if(tpClock){const hh2=Math.floor(hour),mm2=Math.floor((hour-hh2)*60);tpClock.textContent=(night?"🌙":"☀")+" "+((hh2+11)%12+1)+":"+String(mm2).padStart(2,"0")+" "+(hh2<12?"AM":"PM");}}
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
function toast(m){const t=$("toast");t.textContent=m;t.classList.add("show");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("show"),2000);
  // SFX: chime for toast notifications — money emoji = money sound, error words = error sound, default = tap
  try {
    if (/(₦|\+money|gained|paid|earned|reward|won|jackpot|claimed)/i.test(m)) sfx.money();
    else if (/(not enough|fail|error|can't|cannot|blocked|busy|already|invalid|unknown)/i.test(m)) sfx.error();
    else if (/(level|rank up|achievement|mission complete|done|success|unlocked|🎉|✅|🏆)/i.test(m)) sfx.success();
    else sfx.tap();
  } catch (e) {}
}

// ---- Place Manager init ----
// The shared context that every place module can use.
const placeCtx = {
  game,
  toast,
  updateHUD: () => updateHUD(),
  canvas: document.getElementById("game"),
  camera: camera,
  getPlayer: () => player,
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
  // FEATURE: real-time clock (1 real hour = 1 game hour) BUT clamped to
  // daytime (6am-6pm) so the player never sees night. During real-life
  // night hours, the game shows noon.
  const h = (Date.now() / REAL_MS_PER_GAME_HOUR + 1) % 24;
  if (h < 6 || h > 18) return 12;  // noon during night hours
  return h;
}
function _renderPlaceActions(def) {
  let bar = document.getElementById("place-actions");
  let toggle = document.getElementById("place-actions-toggle");
  if (!def) {
    if (bar) bar.style.display = "none";
    if (toggle) toggle.style.display = "none";
    return;
  }
  // ---- Create the toggle button (small, bottom-right) ----
  if (!toggle) {
    toggle = document.createElement("div");
    toggle.id = "place-actions-toggle";
    toggle.style.cssText =
      "position:fixed;right:16px;bottom:calc(120px + env(safe-area-inset-bottom));" +
      "width:50px;height:50px;border-radius:50%;background:var(--green);color:#fff;" +
      "display:flex;align-items:center;justify-content:center;font-size:22px;" +
      "cursor:pointer;z-index:31;box-shadow:0 4px 12px rgba(0,0,0,.35);" +
      "border:2px solid rgba(255,255,255,.25);user-select:none;";
    toggle.innerHTML = "📋";
    toggle.title = "Show actions";
    document.body.appendChild(toggle);
    toggle.addEventListener("click", () => {
      const b = document.getElementById("place-actions");
      if (!b) return;
      b.style.display = b.style.display === "none" ? "flex" : "none";
    });
  }
  // ---- Create the actions bar (hidden by default) ----
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "place-actions";
    bar.style.cssText =
      "position:fixed;left:50%;bottom:calc(175px + env(safe-area-inset-bottom));" +
      "transform:translateX(-50%);background:rgba(15,77,58,.95);color:#fff;" +
      "padding:8px;gap:6px;border-radius:14px;display:none;z-index:31;" +
      "border:1px solid rgba(255,255,255,.2);max-width:90vw;flex-wrap:wrap;" +
      "justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.35);";
    document.body.appendChild(bar);
  }
  bar.innerHTML = def.activities.map(a =>
    '<button onclick="window.placeAction(\'' + a.id + '\'); document.getElementById(\'place-actions\').style.display=\'none\';" ' +
    'style="background:#fff;color:#0f4d3a;border:none;border-radius:8px;padding:8px 12px;' +
    'cursor:pointer;font:600 12px Poppins,sans-serif;white-space:nowrap;">' + a.label + '</button>'
  ).join("");
  // Show the toggle, hide the bar (user taps to expand)
  toggle.style.display = "flex";
  bar.style.display = "none";
}
window.placeAction = (eventId) => {
  // PHOTO MODE (Oct 20): handle here so it works from any place that
  // declares the photo_mode activity (currently just home, but could be
  // added to dealership / arena / etc later).
  if (eventId === "photo_mode") {
    enterPhotoMode();
    return;
  }
  const ap = getActivePlace();
  const spec = ap && rig ? placeSpec(ap.id, eventId, ap.handle, player, (ok) => { if (ok) sendUIEvent(eventId, {}); }) : null;
  if (!spec) { sendUIEvent(eventId, {}); return; }
  closePhone?.(); startActivity(spec, player, rig);
};

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
function openPhone(){$("phone-modal").classList.add("show");showPhoneApp("home");try{sfx.click();}catch(e){}}
function closePhone(){$("phone-modal").classList.remove("show");try{sfx.back();}catch(e){}}
window.closePhone=closePhone;

function _showPhoneApp(appId) {
  const c=$("phone-content");
  _showingApp = appId;
  { const _mxLight = appId === "messages"; $("phone-card")?.classList.toggle("msg-kd", _mxLight); c.classList.toggle("msg-kd", _mxLight); }
  const backBtn='<button onclick="window.showApp(\'home\')" style="margin-top:14px;background:transparent;border:none;color:var(--green);cursor:pointer;font-size:13px;font-weight:600;">← Back to Phone</button>';
  if(appId==="home"){
    const apps=[
      {id:"messages",icon:"💬",label:"Messages"},
      {id:"food",icon:"🍛",label:"Chop"},
      {id:"jobs",icon:"💼",label:"Hustle"},
      {id:"bank",icon:"🏦",label:"Bank"},
      {id:"ride",icon:"🛺",label:"Ride"},
      {id:"cars",icon:"🚗",label:"Cars"},
      {id:"map",icon:"🗺️",label:"Map"},
      {id:"missions",icon:"🎯",label:"Missions"},
      {id:"daily",icon:"🎁",label:"Daily"},
      {id:"health",icon:"💊",label:"Health"},
      {id:"richlist",icon:"🏆",label:"Rich List"},
      {id:"profile",icon:"👤",label:"Profile"},
      {id:"events",icon:"🎉",label:"Events"},
      {id:"news",icon:"📰",label:"Gist"},
      {id:"realestate",icon:"🏡",label:"Houses"},
      {id:"homestore",icon:"🛋️",label:"HomeStore"},
      {id:"storage",icon:"📦",label:"Storage"},
      {id:"hunt",icon:"💎",label:"Hunt"},
      {id:"careers",icon:"💼",label:"Careers"},
      {id:"skills",icon:"📈",label:"Skills"},
      {id:"wishes",icon:"⭐",label:"Wishes"},
      {id:"election",icon:"🗳️",label:"Election"},
      {id:"friends",icon:"👥",label:"Friends"},
      {id:"weather",icon:"🌤️",label:"Weather"},
      {id:"boutique",icon:"👕",label:"Boutique"},
      {id:"myoutfits",icon:"👜",label:"My Outfits"},
      {id:"wardrobe",icon:"👔",label:"Wardrobe"},
      {id:"contacts",icon:"📲",label:"Contacts"},
      {id:"wallet",icon:"👛",label:"Wallet"},
      {id:"tunes",icon:"🎵",label:"Tunes"},
      {id:"gallery",icon:"📸",label:"Gallery"},
      {id:"invest",icon:"📈",label:"Invest"},
      {id:"nepa",icon:"⚡",label:"NEPA"},
      {id:"company",icon:"🏢",label:"Company"},
      {id:"spymissions",icon:"🕵️",label:"Spy Ops"},
      {id:"settings",icon:"⚙️",label:"Settings"}
    ];
    if(isAdmin()) apps.push({id:"admin",icon:"🔐",label:"Admin"});
    const COL={food:["#f59e0b","#f97316"],jobs:["#8b5cf6","#6366f1"],bank:["#3b82f6","#2563eb"],ride:["#10b981","#059669"],cars:["#6366f1","#4f46e5"],map:["#06b6d4","#0891b2"],daily:["#ec4899","#db2777"],health:["#ef4444","#dc2626"],richlist:["#f59e0b","#d97706"],profile:["#6366f1","#4f46e5"],events:["#d946ef","#c026d3"],news:["#64748b","#475569"],boutique:["#d946ef","#a855f7"],myoutfits:["#f97316","#ea580c"],wardrobe:["#14b8a6","#0d9488"],contacts:["#6366f1","#818cf8"],wallet:["#f59e0b","#d97706"],tunes:["#a855f7","#9333ea"],gallery:["#06b6d4","#0891b2"],invest:["#10b981","#059669"],settings:["#64748b","#475569"],admin:["#ef4444","#b91c1c"],hunt:["#f2b134","#d97706"],missions:["#dc2626","#b91c1c"],realestate:["#16a34a","#15803d"],homestore:["#ea580c","#c2410c"],storage:["#0891b2","#0e7490"],messages:["#22c55e","#16a34a"],nepa:["#facc15","#ca8a04"],company:["#1e40af","#1e3a8a"],spymissions:["#0a0a0a","#f2b134"]};
    const now=new Date(), hh=String(now.getHours()).padStart(2,"0"), mm=String(now.getMinutes()).padStart(2,"0");
    const dateTxt=now.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})+" · Kaduna";
    c.innerHTML='<div class="ph-home-clock">'+hh+':'+mm+'</div><div class="ph-home-date">'+dateTxt+'</div><div class="ph-home-bal"><span>₦'+(game.state.money||0).toLocaleString()+'</span></div>'+
      '<div class="ph-grid">'+apps.map(a=>{const k=COL[a.id]||["#64748b","#475569"];const badge=(a.id==="messages"&&_totalUnread>0)?'<span style="position:absolute;top:-2px;right:-2px;background:#e11d48;color:#fff;border-radius:10px;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;padding:0 4px;">'+_totalUnread+'</span>':'';return '<button class="ph-app" onclick="window.showApp(\''+a.id+'\')" style="position:relative;"><div class="ph-ic" style="background:linear-gradient(145deg,'+k[0]+','+k[1]+')">'+a.icon+'</div>'+a.label+badge+'</button>';}).join("")+'</div>';
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
    const dests = getDestinations(_gameHour());
    const rideOpts = [
      { id: "walk", name: "Walk", price: 0, time: 8, icon: "🚶" },
      { id: "keke", name: "Keke Napep", price: 300, time: 3, icon: "🛺" },
      { id: "bus", name: "Bus", price: 200, time: 5, icon: "🚌" },
      { id: "okada", name: "Okada", price: 500, time: 2, icon: "🏍️" },
      { id: "taxi", name: "Taxi", price: 1500, time: 2, icon: "🚕" },
    ];
    // Compact inline dropdown (flows with the page, not a big pop-up): Places / Areas / My Houses
    let h = '<div style="font-size:14px;margin-bottom:8px;font-weight:700;color:var(--green);">🛺 Book a Ride</div>';
    // MAP MARK (Oct 19): if the user tapped on the minimap to mark a spot,
    // show it at the top as the pre-selected destination.
    if (window._markedDest) {
      const md = window._markedDest;
      const dist = Math.sqrt(Math.pow(md.x - player.pos.x, 2) + Math.pow(md.z - player.pos.z, 2)).toFixed(0);
      h += '<div style="background:#1a2a1a;border:2px solid var(--gold);border-radius:10px;padding:8px 10px;margin-bottom:8px;display:flex;align-items:center;gap:8px;">' +
           '<span style="font-size:20px;">📍</span>' +
           '<div style="flex:1;font-size:12px;color:#f2f2f4;"><b>Map mark</b> · ' + dist + 'm away</div>' +
           '<button onclick="window._clearMarkedDest()" style="background:#e11d48;color:#fff;border:none;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:11px;font-weight:600;">✕</button></div>';
    }
    h += '<div style="font-size:11px;color:#666;margin-bottom:6px;">Pick where you want to go:</div>';
    const groups = [];
    groups.push({ t: "📍 Places", items: dests.map(d => ({ id: d.id, label: (d.icon || "📍") + " " + d.name, off: d.open === false })) });
    groups.push({ t: "🏘️ Areas", items: AREAS.map(a => ({ id: "area:" + a.id, label: "📍 " + a.name })) });
    const homes = _myHomesList();
    if (homes.length) groups.push({ t: "🏠 My Houses", items: homes.map(hm => ({ id: "house:" + hm.a + ":" + hm.p, label: "🏠 " + hm.name + " · Plot #" + hm.p })) });
    window._rdGroups = groups;
    // If user marked a spot on the map, pre-select it (dest = "mark:custom")
    if (window._markedDest) {
      window._rideDest = "mark:custom";
    } else if (!window._rideDest || !groups.some(g => g.items.some(i => i.id === window._rideDest && !i.off))) {
      const first = groups[0].items.find(i => !i.off) || groups[0].items[0]; window._rideDest = first ? first.id : "";
    }
    const cur = (window._rideDest === "mark:custom")
      ? { id: "mark:custom", label: "📍 Map mark (" + window._markedDest.x.toFixed(0) + ", " + window._markedDest.z.toFixed(0) + ")" }
      : groups.flatMap(g => g.items).find(i => i.id === window._rideDest);
    h += '<div id="rd-box" style="border:1.5px solid var(--green);border-radius:10px;margin-bottom:10px;background:#17181b;color:#f2f2f4;overflow:hidden;">' +
      '<div id="rd-cur" onclick="window._rdToggle()" style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;font-size:12px;font-weight:600;cursor:pointer;"><span id="rd-label">' + (cur ? cur.label : "Choose…") + '</span><span id="rd-arrow" style="font-size:10px;color:var(--green);">▼</span></div>' +
      '<div id="rd-list" style="display:none;max-height:150px;overflow-y:auto;border-top:1px solid #2c2e33;-webkit-overflow-scrolling:touch;"></div></div>';
    h += '<div style="font-size:11px;color:#666;margin-bottom:8px;">Choose how to get there:</div>';
    h += rideOpts.map(r => '<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid #eee;border-radius:8px;margin-bottom:6px;"><span style="font-size:24px;">'+r.icon+'</span><div style="flex:1;"><div style="font-size:13px;font-weight:600;">'+r.name+'</div><div style="font-size:11px;color:#666;">'+r.time+'s ride · '+(r.price===0?'Free':'₦'+r.price)+'</div></div><button onclick="window.bookRide(\''+r.id+'\')" style="background:var(--green);color:#fff;border:none;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:12px;font-weight:600;">Go</button></div>').join("");
    h += backBtn;
    c.innerHTML = h;
    return;
  }
  if(appId==="cars"){
    // FEATURE: Car Dealership + Garage + Ride/Dismount
    let h = '<div style="font-size:15px;margin-bottom:8px;font-weight:700;color:#f2f2f4;">🚗 Cars & Vehicles</div>';
    // Riding status + dismount button
    if (isRiding()) {
      const rideId = getRideId();
      const rv = getVehicle(rideId);
      h += '<div style="background:#1a2a1a;border:2px solid #4ade80;border-radius:10px;padding:10px;margin-bottom:10px;display:flex;align-items:center;gap:8px;">';
      h += '<span style="font-size:24px;">' + (rv?.emoji || "🚗") + '</span>';
      h += '<div style="flex:1;"><div style="font-size:13px;font-weight:600;color:#4ade80;">Riding ' + (rv?.name || rideId) + '</div>';
      h += '<div style="font-size:11px;color:#9b9ba4;">Speed boost +' + getRideSpeed() + ' m/s</div></div>';
      h += '<button onclick="window._dismountVehicle()" style="background:#e11d48;color:#fff;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;font:600 12px Poppins,sans-serif;">🛑 Dismount</button>';
      h += '</div>';
    }
    // Garage (owned vehicles)
    const owned = getOwned();
    const ownedIds = Object.keys(owned).filter(id => owned[id]);
    h += '<div style="font-size:12px;font-weight:600;margin:10px 0 6px;color:#f2b134;">🔧 Your Garage (' + ownedIds.length + ')</div>';
    if (ownedIds.length === 0) {
      h += '<div style="font-size:11px;color:#6b7280;padding:10px;text-align:center;background:#17181b;border-radius:8px;margin-bottom:10px;">No vehicles yet. Buy one below! 👇</div>';
    } else {
      for (const id of ownedIds) {
        const v = getVehicle(id);
        if (!v) continue;
        const isCurrentRide = isRiding() && getRideId() === id;
        h += '<div style="display:flex;align-items:center;gap:8px;padding:8px;background:#17181b;border-radius:8px;margin-bottom:5px;' + (isCurrentRide ? 'border:2px solid #4ade80;' : '') + '">';
        h += '<span style="font-size:24px;">' + v.emoji + '</span>';
        h += '<div style="flex:1;"><div style="font-size:12px;font-weight:600;color:#f2f2f4;">' + v.name + (isCurrentRide ? ' ✅' : '') + '</div>';
        h += '<div style="font-size:10px;color:#9b9ba4;">Speed +' + v.speed + '</div></div>';
        if (isCurrentRide) {
          h += '<span style="font-size:10px;color:#4ade80;">Riding</span>';
        } else {
          h += '<button onclick="window._rideVehicle(\'' + id + '\')" style="background:#4ade80;color:#000;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font:600 11px Poppins,sans-serif;"> Ride</button>';
        }
        h += '</div>';
      }
    }
    // Dealership (buy new vehicles)
    h += '<div style="font-size:12px;font-weight:600;margin:14px 0 6px;color:#f2b134;">🚗 Dealership</div>';
    h += '<div style="font-size:11px;color:#6b7280;margin-bottom:8px;">Balance: ₦' + game.state.money.toLocaleString() + '</div>';
    for (const v of VEHICLE_CATALOG) {
      const owns = ownsVehicle(v.id);
      const canAfford = game.state.money >= v.price;
      h += '<div style="display:flex;align-items:center;gap:8px;padding:8px;background:#17181b;border-radius:8px;margin-bottom:5px;' + (owns ? 'border:1px solid #4ade80;' : '') + '">';
      h += '<span style="font-size:24px;">' + v.emoji + '</span>';
      h += '<div style="flex:1;"><div style="font-size:12px;font-weight:600;color:#f2f2f4;">' + v.name + (owns ? ' ✅' : '') + '</div>';
      h += '<div style="font-size:10px;color:#9b9ba4;">' + v.desc + ' · Speed +' + v.speed + '</div></div>';
      if (owns) h += '<span style="font-size:10px;color:#4ade80;">Owned</span>';
      else if (canAfford) h += '<button onclick="window._buyVehicle(\'' + v.id + '\')" style="background:#f2b134;color:#000;border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font:600 11px Poppins,sans-serif;">₦' + v.price.toLocaleString() + '</button>';
      else h += '<span style="font-size:10px;color:#6b7280;">₦' + v.price.toLocaleString() + '</span>';
      h += '</div>';
    }
    h += '<div style="font-size:11px;color:#6b7280;margin-top:8px;text-align:center;">💡 Buy a vehicle → tap "Ride" in your Garage to spawn it + boost your speed.</div>';
    h += backBtn;
    c.innerHTML = h;
    return;
  }
  if(appId==="chat"){
    // FIX: Old "chat" app removed — redirect to "messages" app
    showPhoneApp("messages");
    return;
  }
  if(appId==="map"){
    // Visual drone-style top-down map (canvas) + place list below
    const places = listPlaces();
    const gameHour = _gameHour();
    // Map bounds = the WHOLE wide city (main street + 14 districts + avenues)
    const MAP_W = 300, MAP_H = Math.round(300 * (MAP_HALF_Z / MAP_HALF_X));
    const minWX = -MAP_HALF_X, maxWX = MAP_HALF_X, minWZ = -MAP_HALF_Z, maxWZ = MAP_HALF_Z;
    const toMapX = (wx) => ((wx - minWX) / (maxWX - minWX)) * MAP_W;
    const toMapZ = (wz) => ((wz - minWZ) / (maxWZ - minWZ)) * MAP_H;
    const sx1 = MAP_W / (maxWX - minWX), sz1 = MAP_H / (maxWZ - minWZ);   // metres -> svg units
    // Player position
    const px = player.pos.x, pz = player.pos.z;
    // Build SVG (crisp, tappable)
    let svg = '<svg width="100%" viewBox="0 0 '+MAP_W+' '+MAP_H+'" style="background:#9aab62;border-radius:12px;display:block;touch-action:manipulation;">';
    // Avenues + cross streets of the wide city
    for (const ax of WIDE_AVENUES_X) svg += '<rect x="'+(toMapX(ax)-5*sx1)+'" y="0" width="'+(10*sx1)+'" height="'+MAP_H+'" fill="#555a62"/>';
    for (const cz of WIDE_CROSS_Z) svg += '<rect x="0" y="'+(toMapZ(cz)-5*sz1)+'" width="'+MAP_W+'" height="'+(10*sz1)+'" fill="#555a62"/>';
    // Main street (gray horizontal strip) + centre line
    svg += '<rect x="0" y="'+(toMapZ(-9))+'" width="'+MAP_W+'" height="'+(toMapZ(9)-toMapZ(-9))+'" fill="#555a62"/>';
    svg += '<line x1="0" y1="'+toMapZ(0)+'" x2="'+MAP_W+'" y2="'+toMapZ(0)+'" stroke="#fff" stroke-width="0.6" stroke-dasharray="4,3"/>';
    // Building bands either side of the main street
    svg += '<rect x="'+toMapX(-200)+'" y="'+toMapZ(-60)+'" width="'+(400*sx1)+'" height="'+(51*sz1)+'" fill="#8f7a5e"/>';
    svg += '<rect x="'+toMapX(-200)+'" y="'+toMapZ(9)+'" width="'+(400*sx1)+'" height="'+(51*sz1)+'" fill="#8f7a5e"/>';
    // Districts (tappable blocks)
    for (const a of AREAS) {
      const fill = a.tier === "rich" ? "#e6d49a" : a.tier === "middle" ? "#b7d3a0" : "#d3c19a";
      svg += '<g style="cursor:pointer;" onclick="window.travelToArea(\''+a.id+'\')">'+
        '<rect x="'+toMapX(a.x-44)+'" y="'+toMapZ(a.z-40)+'" width="'+(88*sx1)+'" height="'+(96*sz1)+'" rx="2" fill="'+fill+'" stroke="#33413a" stroke-width="0.6"/>'+
        '<text x="'+toMapX(a.x)+'" y="'+(toMapZ(a.z+8)+2)+'" text-anchor="middle" font-size="5.5" font-weight="700" fill="#243028">'+a.name+'</text></g>';
    }
    // Place markers (tappable)
    for (const p of places) {
      const mx = toMapX(p.entranceX), mz = toMapZ(p.entranceZ);
      const open = (p.hours == null) ? true : (gameHour >= p.hours.open && gameHour < p.hours.close);
      const color = "#" + (p.minimapColor || 0xc0392b).toString(16).padStart(6, "0");
      svg += '<g style="cursor:pointer;" onclick="window.travelToPlace(\''+p.id+'\')">';
      // Glow ring (open only)
      if (open) svg += '<circle cx="'+mx+'" cy="'+mz+'" r="5" fill="'+color+'" opacity="0.25"/>';
      // Main dot
      svg += '<circle cx="'+mx+'" cy="'+mz+'" r="3" fill="'+color+'" stroke="#fff" stroke-width="1"/>';
      // Label (short)
      const shortName = p.name.split(" ").slice(0, 2).join(" ");
      svg += '<text x="'+mx+'" y="'+(mz-5)+'" text-anchor="middle" font-size="4.5" font-weight="700" fill="#fff" style="paint-order:stroke;stroke:#000;stroke-width:1.5;">'+shortName+'</text>';
      svg += '</g>';
    }
    // My home
    for (const hm of (window._myHomes && window._myHomes.length ? window._myHomes : (window._myHomePos ? [window._myHomePos] : []))) svg += '<text x="'+toMapX(hm.x)+'" y="'+(toMapZ(hm.z)+3)+'" text-anchor="middle" font-size="9">🏠</text>';
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
      '<span>👆 Tap a place or a district to travel</span>'+
    '</div>';
    // Place list (tappable)
    const placeList = places.map(p => {
      const open = (p.hours == null) ? true : (gameHour >= p.hours.open && gameHour < p.hours.close);
      const openBadge = open ? '<span style="color:#2e7d4f;font-size:10px;">● open</span>' : '<span style="color:#e11d48;font-size:10px;">● closed</span>';
      const color = "#" + (p.minimapColor || 0xc0392b).toString(16).padStart(6, "0");
      return '<div onclick="window.travelToPlace(\''+p.id+'\')" style="padding:8px;background:'+(open?'#e8f5e9':'#f5e8e8')+';border-radius:8px;margin-bottom:5px;font-size:12px;font-weight:600;color:var(--green);cursor:pointer;border-left:4px solid '+color+';">'+p.minimapIcon+' '+p.name+' '+openBadge+'<div style="font-size:10px;color:#666;font-weight:400;margin-top:2px;">'+(p.type==='interior'?'Interior':'Outdoor')+' · '+p.activities.length+' activities</div></div>';
    }).join("");
    const areaList = AREAS.map(a => {
      const tc = a.tier === "rich" ? "#f2b134" : a.tier === "middle" ? "#4a9a5a" : "#8a8f96";
      return '<div onclick="window.travelToArea(\''+a.id+'\')" style="padding:8px;background:#f1efe7;border-radius:8px;margin-bottom:5px;font-size:12px;font-weight:600;color:var(--green);cursor:pointer;border-left:4px solid '+tc+';">🏘️ '+a.name+' <span style="font-size:10px;color:#888;font-weight:400;">· '+a.tier+'</span><div style="font-size:10px;color:#666;font-weight:400;margin-top:2px;">Rent ₦'+a.rentPrice.toLocaleString()+' · Buy ₦'+a.buyPrice.toLocaleString()+' · Go there ₦'+AREA_TRAVEL_FARE+'</div></div>';
    }).join("");
    c.innerHTML='<div style="font-size:14px;margin-bottom:8px;font-weight:700;color:var(--green);">🗺️ Kaduna Map</div>'+svg+legend+'<div style="font-size:11px;font-weight:600;margin:8px 0 6px;color:#666;">Districts:</div>'+areaList+'<div style="font-size:11px;font-weight:600;margin:8px 0 6px;color:#666;">All Places:</div>'+placeList+backBtn;
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
    // Daily newspaper: rotate content by date so each day feels fresh.
    // Uses a seeded RNG based on YYYYMMDD so every reader sees the same
    // "today's edition" — feels like a real shared newspaper.
    const _today = new Date();
    const _dateKey = _today.getFullYear()*10000 + (_today.getMonth()+1)*100 + _today.getDate();
    function _seedRng(seed){let s=seed|0;return ()=>{s=(s*1664525+1013904223)|0;return ((s>>>0)%100000)/100000;};}
    const _rng=_seedRng(_dateKey);
    const _pick=(arr)=>arr[Math.floor(_rng()*arr.length)];
    const _dateStr=_today.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
    const _heads=[
      "Sallah Festival Approaching",
      "Kaduna Poly Students Win Tech Competition",
      "Market Day at Kawo",
      "Football Match at Ahmadu Bello Stadium",
      "Railway Station Modernization",
      "Harmattan Hits Hard This Year",
      "New Expressway Opens to Abuja",
      "NEPA Announces New Tariff",
      "Trader Wins Big at Money Hunt",
      "Local Football Team Signs New Coach",
      "Rain Forecast for the Week",
      "Governor Visits Sabon Tasha",
      "Barnawa River Festival Announced",
      "Keke Drivers Union Strike Averted",
      "New Suya Spot Opens Downtown",
    ];
    const _bodies={
      "Sallah Festival Approaching":"Hamdala Hotel preparing for the biggest Sallah celebration in Kaduna. Free food for all residents!",
      "Kaduna Poly Students Win Tech Competition":"Students from Kaduna Polytechnic took first place at the Northern Nigeria tech hackathon. Cash prize of ₦500,000 awarded.",
      "Market Day at Kawo":"Kawo Market now open late. Best suya spots and fresh produce. Bring your keke!",
      "Football Match at Ahmadu Bello Stadium":"Kaduna United vs Rangers — Friday 4 PM. Free entry for first 100 students.",
      "Railway Station Modernization":"Rigasa Train Station gets new Lagos-Kaduna route. Travel time now under 3 hours.",
      "Harmattan Hits Hard This Year":"Cold dry wind from the Sahara expected all week. Health officials advise drinking plenty water.",
      "New Expressway Opens to Abuja":"The new four-lane expressway cuts Abuja travel to 90 minutes. Toll: ₦500.",
      "NEPA Announces New Tariff":"Electricity tariff revised. Prepaid users to pay ₦50/kWh, up from ₦45. Top up early to avoid cutoff.",
      "Trader Wins Big at Money Hunt":"Local trader Mama Chidi found a ₦50,000 jackpot spot near Kawo Market yesterday.",
      "Local Football Team Signs New Coach":"Kaduna United signs Coach Musa from Kano. Fans hopeful for the season ahead.",
      "Rain Forecast for the Week":"Meteorological department predicts rain Tuesday through Thursday. Drive carefully on wet roads.",
      "Governor Visits Sabon Tasha":"Governor tours Sabon Tasha market, promises new road project within the year.",
      "Barnawa River Festival Announced":"Annual festival at River Kaduna set for next month. Boat racing, food stalls, live music.",
      "Keke Drivers Union Strike Averted":"After 6-hour meeting with the union, the government agreed to freeze fuel levies for 6 months.",
      "New Suya Spot Opens Downtown":"Malam Yusuf's spot on Ahmadu Bello Way now serving kilishi and ram suya. Long lines expected.",
    };
    const top1=_pick(_heads), top2=_pick(_heads.filter(h=>h!==top1)), top3=_pick(_heads.filter(h=>h!==top1&&h!==top2));
    const news=[
      {time:_dateStr+" · Top Story",title:top1,body:_bodies[top1]},
      {time:"Today · Sports",title:top2,body:_bodies[top2]},
      {time:"Today · Business",title:top3,body:_bodies[top3]},
    ];
    c.innerHTML='<div style="font-size:14px;margin-bottom:2px;font-weight:700;color:var(--green);">📰 Daily Kaduna Gist</div>'+
      '<div style="font-size:10px;color:#999;margin-bottom:10px;">'+_dateStr+' · Edition #'+(_dateKey%1000)+'</div>'+
      news.map(n=>'<div style="padding:10px;border-bottom:1px solid #eee;margin-bottom:6px;"><div style="font-size:10px;color:#999;text-transform:uppercase;">'+n.time+'</div><div style="font-size:13px;font-weight:600;color:var(--ink);margin-top:2px;">'+n.title+'</div><div style="font-size:11px;color:#666;margin-top:4px;line-height:1.4;">'+n.body+'</div></div>').join("")+
      '<div style="font-size:10px;color:#999;text-align:center;padding:8px;">📰 New edition daily. Come back tomorrow for fresh gist.</div>'+backBtn;
    return;
  }
  if(appId==="boutique"){
    const L=game.state.look, g=L.gender==="female"?"f":"m", owned=L.owned||[];
    const items=SHOP.filter(it=>it.for==="any"||it.for===g);
    c.innerHTML='<div style="font-size:14px;margin-bottom:10px;font-weight:700;color:var(--green);">👕 Kaduna Boutique</div>'+_cpSlotHtml('Tap 👁 Try to see it on you')+
      '<button onclick="window.showApp(\'myoutfits\')" style="width:100%;background:var(--gold,#f2b134);color:#1a1a1a;border:none;border-radius:10px;padding:10px;margin-bottom:10px;font-weight:700;font-size:13px;cursor:pointer;">👜 My Outfits ('+owned.length+')</button>'+
      items.map(it=>'<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid #eee;border-radius:8px;margin-bottom:6px;"><span style="font-size:24px;">'+it.emoji+'</span><div style="flex:1;"><div style="font-size:13px;font-weight:600;">'+it.name+'</div><div style="font-size:11px;color:#666;">'+it.desc+'</div></div>'+
        '<button onclick="window._tryItem(\''+it.id+'\')" style="background:#2a2c33;color:#f2f2f4;border:none;border-radius:8px;padding:6px 9px;cursor:pointer;font-size:12px;font-weight:600;margin-right:4px;">👁 Try</button>'+(owned.includes(it.id)?'<span style="font-size:11px;font-weight:700;color:var(--green);">✓ Owned</span>':'<button onclick="window.buyClothing(\''+it.id+'\')" style="background:var(--green);color:#fff;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:12px;font-weight:600;">₦'+it.price+'</button>')+'</div>').join("")+backBtn;
    _cpMount(L);
    return;
  }
  if(appId==="myoutfits"){
    const L=game.state.look, owned=(L.owned||[]).map(id=>SHOP.find(x=>x.id===id)).filter(Boolean), worn=L.worn||{};
    c.innerHTML='<div style="font-size:14px;margin-bottom:10px;font-weight:700;color:var(--green);">👜 My Outfits</div>'+_cpSlotHtml()+
      (owned.length?owned.map(it=>{const on=worn[it.slot]===it.id;return '<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid '+(on?'var(--green)':'#eee')+';border-radius:8px;margin-bottom:6px;"><span style="font-size:24px;">'+it.emoji+'</span><div style="flex:1;"><div style="font-size:13px;font-weight:600;">'+it.name+'</div><div style="font-size:11px;color:#666;">'+(on?'Wearing now':'In your wardrobe')+'</div></div><button onclick="window._'+(on?'removeItem':'wearItem')+'(\''+it.id+'\')" style="background:'+(on?'#e11d48':'var(--green)')+';color:#fff;border:none;border-radius:8px;padding:7px 14px;cursor:pointer;font-size:12px;font-weight:700;">'+(on?'Remove':'Wear')+'</button></div>';}).join(""):'<div style="color:#888;font-size:12px;padding:10px 0;">You have not bought any outfit yet. Visit the Boutique.</div>')+
      '<button onclick="window.showApp(\'boutique\')" style="width:100%;margin-top:8px;background:var(--green);color:#fff;border:none;border-radius:10px;padding:11px;font-weight:700;font-size:13px;cursor:pointer;">🛍 Go to Boutique</button>'+backBtn;
    _cpMount(L);
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
    c.innerHTML='<div style="font-size:14px;margin-bottom:10px;font-weight:700;color:var(--green);">👕 Wardrobe</div>'+_cpSlotHtml()+
      '<div style="background:var(--cream);border-radius:10px;padding:10px;margin-bottom:8px;"><div style="font-size:12px;font-weight:600;margin-bottom:6px;">🧍 Character</div>'+pill("👦 Man",gOn==="male","window._previewGender(\'male\')")+pill("👧 Woman",gOn==="female","window._previewGender(\'female\')")+' '+BUILDS.map(b=>pill(b.label,(look.build||"normal")===b.id,"window._setLook(\'build\',\'"+b.id+"\')")).join("")+'</div>'+
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
    _cpMount(look);
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
  if(appId==="realestate"){
    const rentInfo = getRentInfo(game.state);
    let h = '<div style="font-size:15px;margin-bottom:8px;font-weight:700;color:#f2f2f4;">🏡 Real Estate & Rent</div>';
    // ---- FEATURE 4/5: "My House" card with lock toggle ----
    if (game.state.homeArea && game.state.homePlot != null) {
      const myArea = getArea(game.state.homeArea);
      const myTier = HOUSE_TIERS.find(t => t.tier === (game.state.homeTier || 1));
      h += '<div style="background:#1a2a1a;border:2px solid #4ade80;border-radius:12px;padding:12px;margin-bottom:12px;">';
      h += '<div style="font-size:13px;font-weight:700;color:#4ade80;margin-bottom:4px;">🏠 Your House</div>';
      h += '<div style="font-size:12px;color:#f2f2f4;">📍 ' + (myArea ? myArea.name : 'Unknown') + ' · Plot #' + game.state.homePlot + '</div>';
      h += '<div style="font-size:11px;color:#9b9ba4;margin-top:2px;">' + (myTier ? myTier.emoji + ' ' + myTier.name : 'Tier ' + (game.state.homeTier || 1)) + '</div>';
      h += '<div id="my-house-lock-row" style="margin-top:8px;font-size:11px;color:#9b9ba4;">Loading lock status...</div>';
      h += '</div>';
      (async () => {
        try {
          const house = await loadHouse(game.state.homeArea, game.state.homePlot);
          const locked = house ? !!house.locked : false;
          const row = document.getElementById("my-house-lock-row");
          if (row) row.innerHTML = '<button onclick="window._toggleHouseLock(' + (locked ? 'false' : 'true') + ')" style="width:100%;background:' + (locked ? '#e11d48' : '#4ade80') + ';color:#000;border:none;border-radius:8px;padding:8px;cursor:pointer;font-size:12px;font-weight:600;">' + (locked ? '🔒 Locked — tap to UNLOCK' : '🔓 Unlocked — tap to LOCK') + '</button>';
        } catch (e) {
          const row = document.getElementById("my-house-lock-row");
          if (row) row.textContent = 'Could not load lock status';
        }
      })();
    } else {
      h += '<div style="background:#3a1a1a;border:1px solid #e11d48;border-radius:10px;padding:10px;margin-bottom:12px;font-size:12px;color:#e11d48;text-align:center;">You haven\'t picked an area yet. <button onclick="window._showAreaPicker()" style="margin-top:6px;background:#f2b134;color:#000;border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:11px;font-weight:600;">Pick an area now</button></div>';
    }
    // ---- My Houses (own / rent / upgrade) ----
    const _mh = game.state.myHouses || [];
    if (_mh.length) {
      h += '<div style="font-size:12px;font-weight:600;margin:6px 0;color:#f2b134;">🔑 My Houses</div>';
      for (const e of _mh) {
        const ar = getArea(e.a); if (!ar) continue;
        const t = HOUSE_TIERS.find(x => x.tier === (e.t || 1)) || HOUSE_TIERS[0];
        const nx = HOUSE_TIERS.find(x => x.tier === t.tier + 1), uc = upgradeCost(t.tier);
        const isHome = game.state.homeArea === e.a && game.state.homePlot === e.p;
        const bs = 'border:none;border-radius:6px;padding:6px 9px;cursor:pointer;font-size:11px;font-weight:600;margin:4px 4px 0 0;';
        h += '<div style="background:#17181b;border-radius:10px;padding:10px;margin-bottom:6px;'+(isHome?'border:2px solid #4ade80;':'')+'">';
        h += '<div style="font-size:12px;font-weight:700;color:#f2f2f4;">'+t.emoji+' '+t.name+(isHome?' ✅':'')+'</div>';
        h += '<div style="font-size:10px;color:#9b9ba4;">'+ar.name+' · Plot #'+e.p+' · '+(e.own?'<b style="color:#4ade80;">Owned</b>':'Renting ₦'+t.rent.toLocaleString()+'/wk')+'</div>';
        if (!isHome) h += '<button onclick="window._makeHome(\''+e.a+'\','+e.p+')" style="'+bs+'background:#f2b134;color:#000;">Make home</button>';
        if (!e.own) h += '<button onclick="window._buyOutHouse(\''+e.a+'\','+e.p+')" style="'+bs+'background:#3b82f6;color:#fff;">Buy ₦'+t.buyPrice.toLocaleString()+'</button>';
        else if (nx && uc != null) h += '<button onclick="window._upgradeHouse(\''+e.a+'\','+e.p+')" style="'+bs+'background:#4ade80;color:#000;">Upgrade → '+nx.emoji+' '+nx.name+' ₦'+uc.toLocaleString()+'</button>';
        else h += '<span style="font-size:10px;color:#4ade80;">Top house 👑</span>';
        h += '</div>';
      }
    }
    // Rent status
    h += '<div style="background:'+(rentInfo.due?'#3a1a1a':'#1a2a1a')+';border-radius:10px;padding:10px;margin-bottom:10px;border:1px solid '+(rentInfo.due?'#e11d48':'#2e7d4f')+';">';
    h += '<div style="font-size:12px;font-weight:600;color:'+(rentInfo.due?'#e11d48':'#4ade80')+';">'+(rentInfo.owned?'🔑 You own this home':rentInfo.due?'🔔 RENT DUE!':'✅ Rent paid')+'</div>';
    h += '<div style="font-size:11px;color:#9b9ba4;margin-top:2px;">'+rentInfo.tier.name+(rentInfo.owned?' — no rent':' — ₦'+rentInfo.amount.toLocaleString()+'/week');
    if (rentInfo.due) h += ' · <b style="color:#e11d48;">Pay now!</b>';
    else if (!rentInfo.owned) h += ' · Next due in '+rentInfo.nextDueText;
    h += '</div>';
    if (rentInfo.due) h += '<button onclick="window._payRent()" style="width:100%;margin-top:6px;background:#f2b134;color:#000;border:none;border-radius:8px;padding:8px;cursor:pointer;font-size:12px;font-weight:600;">Pay Rent ₦'+rentInfo.amount.toLocaleString()+'</button>';
    h += '</div>';
    // ---- FEATURE 5: Move to a new area ----
    h += '<div style="font-size:12px;font-weight:600;margin:14px 0 6px;color:#f2b134;">🏠 Move to a New Area</div>';
    h += '<div style="font-size:11px;color:#6b7280;margin-bottom:8px;">Balance: ₦'+game.state.money.toLocaleString()+' · Moving keeps your furniture (goes to storage)</div>';
    const tiers = [
      { id: "cheap",  label: "Budget Areas",   color: "#4ade80" },
      { id: "middle", label: "Mid-Tier Areas", color: "#f2b134" },
      { id: "rich",   label: "GRA / Upscale",  color: "#60a5fa" },
    ];
    for (const t of tiers) {
      const areaList = AREAS.filter(a => a.tier === t.id);
      if (!areaList.length) continue;
      h += '<div style="font-size:11px;font-weight:700;color:'+t.color+';margin:8px 0 4px;">'+t.label+'</div>';
      for (const a of areaList) {
        const isCurrent = game.state.homeArea === a.id;
        const canAfford = game.state.money >= a.buyPrice;
        const canPick = canPickArea(game.state.origin, a);
        h += '<div style="display:flex;align-items:center;gap:8px;padding:8px;background:#17181b;border-radius:8px;margin-bottom:5px;'+(isCurrent?'border:2px solid #4ade80;':'')+'">';
        h += '<div style="flex:1;"><div style="font-size:12px;font-weight:600;color:#f2f2f4;">'+a.name+(isCurrent?' ✅':'')+'</div>';
        h += '<div style="font-size:10px;color:#9b9ba4;">Rent ₦'+a.rentPrice.toLocaleString()+'/wk · Buy ₦'+a.buyPrice.toLocaleString()+'</div></div>';
        if (isCurrent) h += '<span style="font-size:10px;color:#4ade80;">Current</span>';
        else if (!canPick) h += '<span style="font-size:10px;color:#6b7280;">🔒 Origin</span>';
        else if (canAfford) h += '<button onclick="window._moveToArea(\''+a.id+'\')" style="background:#f2b134;color:#000;border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px;font-weight:600;">Move</button>';
        else h += '<span style="font-size:10px;color:#6b7280;">₦'+a.buyPrice.toLocaleString()+'</span>';
        h += '</div>';
      }
    }
    h += '<div style="font-size:11px;color:#6b7280;margin-top:12px;text-align:center;">💡 Walk to 🏠 My Home to enter. Lock your house so visitors must knock.</div>';
    h += backBtn;
    c.innerHTML = h;
    return;
  }
  if(appId==="homestore"){
    let _hsCat = window._hsCat || "All";
    const cats = ["All", ...CATEGORIES];
    let h = '<div style="font-size:15px;margin-bottom:8px;font-weight:700;color:#f2f2f4;">🛋️ HomeStore</div>';
    h += '<div style="display:flex;gap:4px;overflow-x:auto;margin-bottom:10px;padding-bottom:4px;">';
    for (const cat of cats) {
      const on = _hsCat === cat;
      h += '<button onclick="window._hsSetCat(\''+cat+'\')" style="white-space:nowrap;padding:6px 10px;border:none;border-radius:8px;background:'+(on?'#f2b134':'#17181b')+';color:'+(on?'#000':'#9b9ba4')+';font:600 11px Poppins,sans-serif;cursor:pointer;">'+cat+'</button>';
    }
    h += '</div>';
    const items = _hsCat === "All" ? FURNITURE_CATALOG : FURNITURE_CATALOG.filter(f => f.cat === _hsCat);
    h += '<div style="font-size:11px;color:#6b7280;margin-bottom:6px;">Balance: ₦'+game.state.money.toLocaleString()+'</div>';
    for (const it of items) {
      const colorDots = it.colors.map((c, i) => '<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:'+c+';border:1px solid #333;margin:0 1px;"></span>').join("");
      h += '<div style="display:flex;align-items:center;gap:8px;padding:10px;background:#17181b;border-radius:10px;margin-bottom:6px;">';
      h += '<span style="font-size:24px;">'+it.emoji+'</span>';
      h += '<div style="flex:1;"><div style="font-size:13px;font-weight:600;color:#f2f2f4;">'+it.name+'</div>';
      h += '<div style="font-size:10px;color:#9b9ba4;">'+it.cat+' · '+it.w+'×'+it.d+' grid · Comfort +'+it.comfort+'</div>';
      h += '<div style="margin-top:2px;">'+colorDots+'</div></div>';
      h += '<button onclick="window._buyFurniture(\''+it.id+'\')" style="background:#f2b134;color:#000;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:12px;font-weight:600;">₦'+it.price.toLocaleString()+'</button>';
      h += '</div>';
    }
    h += backBtn;
    c.innerHTML = h;
    return;
  }
  if(appId==="storage"){
    const uid = getMyUid();
    let h = '<div style="font-size:15px;margin-bottom:8px;font-weight:700;color:#f2f2f4;">📦 My Storage</div>';
    h += '<div id="storage-list" style="font-size:12px;">Loading...</div>';
    h += backBtn;
    c.innerHTML = h;
    if (uid) {
      import("firebase/database").then(({ ref, get }) => {
        get(ref(db, "players/"+uid+"/storage")).then((snap) => {
          const storage = snap.val() || [];
          const el = document.getElementById("storage-list");
          if (!el) return;
          if (!storage.length) {
            el.innerHTML = '<div style="text-align:center;padding:30px;color:#6b7280;">📦 Your storage is empty.<br>Buy furniture from the HomeStore!</div>';
            return;
          }
          el.innerHTML = storage.map((s, i) => {
            const it = getItem(s.id);
            if (!it) return '';
            return '<div style="display:flex;align-items:center;gap:8px;padding:10px;background:#17181b;border-radius:10px;margin-bottom:6px;"><span style="font-size:24px;">'+it.emoji+'</span><div style="flex:1;"><div style="font-size:13px;font-weight:600;color:#f2f2f4;">'+it.name+'</div><div style="font-size:10px;color:#9b9ba4;">Comfort +'+it.comfort+' · '+it.w+'×'+it.d+'</div></div><button onclick="window._placeInRoom('+i+')" style="background:#f2b134;color:#000;border:none;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:11px;font-weight:600;">📍 Place</button></div>';
          }).join("");
          // Store storage globally for place function
          window._storageCache = storage;
        });
      });
    }
    return;
  }
  if(appId==="hunt"){
    const stats = getHuntStats();
    const spots = getAllSpotsWithState();
    const myPos = player.pos;
    // Sort spots by distance from the player so the nearest hints show first.
    const withDist = spots.map((s) => {
      const dx = s.x - myPos.x, dz = s.z - myPos.z;
      return { ...s, dist: Math.sqrt(dx * dx + dz * dz) };
    });
    withDist.sort((a, b) => a.dist - b.dist);
    let h = '<div style="font-size:15px;margin-bottom:8px;font-weight:700;color:#f2f2f4;">💎 Money Hunt</div>';
    // Stats summary card
    h += '<div style="background:#17181b;border-radius:10px;padding:10px;margin-bottom:10px;">';
    h += '<div style="display:flex;justify-content:space-between;font-size:11px;color:#9b9ba4;margin-bottom:6px;"><span>Today</span><span><b style="color:#f2b134;">' + (stats.dayClaimCount || 0) + '</b>/' + stats.dayCap + '</span></div>';
    h += '<div style="display:flex;justify-content:space-between;font-size:11px;color:#9b9ba4;margin-bottom:6px;"><span>Total found</span><span style="color:#f2f2f4;font-weight:600;">' + (stats.totalClaims || 0) + '</span></div>';
    h += '<div style="display:flex;justify-content:space-between;font-size:11px;color:#9b9ba4;margin-bottom:6px;"><span>Rare finds</span><span style="color:#60a5fa;font-weight:600;">' + (stats.rareClaims || 0) + '</span></div>';
    h += '<div style="display:flex;justify-content:space-between;font-size:11px;color:#9b9ba4;"><span>Jackpots</span><span style="color:#f2b134;font-weight:600;">' + (stats.jackpotClaims || 0) + '</span></div>';
    h += '</div>';
    // Achievements row
    h += '<div style="font-size:12px;font-weight:600;margin:10px 0 6px;color:#f2b134;">🏅 Achievements</div>';
    h += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">';
    for (const a of HUNT_ACHIEVEMENTS) {
      const unlocked = !!stats["ach_" + a.id];
      h += '<div title="' + a.desc + '" style="flex:1;min-width:80px;background:' + (unlocked ? '#1a2a1a' : '#17181b') + ';border:1px solid ' + (unlocked ? '#4ade80' : '#26272b') + ';border-radius:8px;padding:8px;text-align:center;">';
      h += '<div style="font-size:20px;filter:' + (unlocked ? 'none' : 'grayscale(1)') + ';">' + a.icon + '</div>';
      h += '<div style="font-size:10px;color:' + (unlocked ? '#4ade80' : '#6b7280') + ';margin-top:2px;font-weight:600;">' + a.name + '</div>';
      h += '</div>';
    }
    h += '</div>';
    // Hints list — only show hint for spots the player is close to (within 60m);
    // the rest are shown as "???" so the hunt still requires exploration.
    h += '<div style="font-size:12px;font-weight:600;margin:10px 0 6px;color:#f2b134;">🗺️ Hints (nearest first)</div>';
    for (const s of withDist.slice(0, 8)) {
      const r = RARITY[s.rarity];
      const inRange = s.dist < 60;
      const claimableNow = s.claimable;
      const respawnMins = s.nextRespawnMs ? Math.ceil(s.nextRespawnMs / 60000) : 0;
      h += '<div style="background:#17181b;border-left:3px solid #' + r.color.toString(16).padStart(6, '0') + ';border-radius:8px;padding:8px 10px;margin-bottom:6px;">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
      h += '<span style="font-size:11px;font-weight:600;color:#f2f2f4;">' + r.glyph + ' ' + (inRange ? s.area : '???') + '</span>';
      h += '<span style="font-size:10px;color:#9b9ba4;">' + Math.round(s.dist) + 'm' + (claimableNow ? '' : ' · ⏳ ' + respawnMins + 'm') + '</span>';
      h += '</div>';
      if (inRange) {
        h += '<div style="font-size:11px;color:#9b9ba4;font-style:italic;line-height:1.3;">"' + s.hint + '"</div>';
        if (claimableNow && s.dist < 8) {
          h += '<button onclick="window._claimSpot(\'' + s.id + '\')" style="margin-top:6px;width:100%;background:#f2b134;color:#000;border:none;border-radius:6px;padding:6px;cursor:pointer;font-size:11px;font-weight:600;">Claim ' + r.glyph + '</button>';
        }
      } else {
        h += '<div style="font-size:11px;color:#6b7280;font-style:italic;">Walk closer to reveal the hint. Range: ' + Math.round(s.dist) + 'm away.</div>';
      }
      h += '</div>';
    }
    h += '<div style="font-size:10px;color:#6b7280;margin-top:10px;text-align:center;line-height:1.4;">💡 Listen for the beep — it speeds up as you get closer. Tap the prompt when you see it to claim.</div>';
    h += backBtn;
    c.innerHTML = h;
    return;
  }
  if(appId==="messages"){
    _showingApp = "messages";
    // If a chat is open, render the chat screen; otherwise render the list
    if (window._openChatId) { _renderChatScreen(c, window._openChatId, window._openChatName || "Chat"); return; }
    _renderMessagesList(c);
    return;
  }
  if(appId==="careers"){
    const career = getCareer();
    const skills = getSkills();
    let h = '<div style="font-size:15px;margin-bottom:8px;font-weight:700;color:#f2f2f4;">💼 Careers</div>';
    if (career.id) {
      const c = getCareerDef(career.id);
      const level = c.levels[career.level];
      h += '<div style="background:#17181b;border-radius:10px;padding:10px;margin-bottom:10px;border-left:3px solid #f2b134;">';
      h += '<div style="font-size:13px;font-weight:700;color:#f2b134;">' + c.icon + ' ' + c.name + ' — ' + level.title + '</div>';
      h += '<div style="font-size:11px;color:#9b9ba4;margin-top:4px;">Pay: ₦' + level.pay + ' per shift · Energy cost: ' + level.energyCost + '</div>';
      h += '<div style="font-size:11px;color:#9b9ba4;">XP: ' + career.xp + '/100 · Shifts: ' + (career.totalShifts || 0) + '</div>';
      const promoCheck = canPromote();
      if (promoCheck.ok) {
        h += '<button onclick="window._promoteCareer()" style="margin-top:6px;width:100%;background:#4ade80;color:#000;border:none;border-radius:8px;padding:8px;cursor:pointer;font:600 12px Poppins,sans-serif;">🎉 Promote to ' + promoCheck.nextLevel.title + '</button>';
      } else if (career.level >= c.levels.length - 1) {
        h += '<div style="font-size:11px;color:#4ade80;margin-top:4px;">🏆 Max level reached!</div>';
      } else {
        h += '<div style="font-size:10px;color:#9b9ba4;margin-top:4px;">Next: ' + promoCheck.reason + '</div>';
      }
      h += '</div>';
      // Shift tones
      h += '<div style="font-size:12px;font-weight:600;margin:10px 0 6px;color:#f2b134;">⚡ Do a Shift</div>';
      for (const t of SHIFT_TONES) {
        h += '<button onclick="window._doShift(\'' + t.id + '\')" style="width:100%;background:#17181b;color:#f2f2f4;border:1px solid #26272b;border-radius:8px;padding:8px 10px;margin-bottom:4px;cursor:pointer;text-align:left;font:600 11px Poppins,sans-serif;">' + t.icon + ' ' + t.label + ' <span style="color:#9b9ba4;font-weight:400;">— Pay x' + t.payMul + ' · Risk ' + Math.round(t.risk * 100) + '%</span></button>';
      }
    } else {
      h += '<div style="font-size:11px;color:#9b9ba4;margin-bottom:10px;">Join a career to start earning. Some careers need skill levels.</div>';
    }
    // Career list
    h += '<div style="font-size:12px;font-weight:600;margin:10px 0 6px;color:#f2b134;">📋 All Careers</div>';
    for (const c of CAREERS) {
      const skillVal = skills[c.skill] || 0;
      const canJoin = canJoinCareer(c.id);
      const isCurrent = career.id === c.id;
      h += '<div style="background:#17181b;border-radius:8px;padding:8px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;">';
      h += '<div><div style="font-size:12px;font-weight:600;color:' + (isCurrent ? '#4ade80' : '#f2f2f4') + ';">' + c.icon + ' ' + c.name + (isCurrent ? ' ✅' : '') + '</div>';
      h += '<div style="font-size:10px;color:#9b9ba4;">Needs ' + c.skill + ' lvl ' + c.levels[0].levelReq + ' (you: ' + skillVal + ')</div></div>';
      if (!isCurrent) {
        if (canJoin.ok) {
          h += '<button onclick="window._joinCareer(\'' + c.id + '\')" style="background:#f2b134;color:#000;border:none;border-radius:6px;padding:5px 10px;cursor:pointer;font:600 10px Poppins,sans-serif;">Join</button>';
        } else {
          h += '<span style="font-size:10px;color:#6b7280;">🔒</span>';
        }
      }
      h += '</div>';
    }
    h += backBtn;
    c.innerHTML = h;
    return;
  }
  if(appId==="skills"){
    const skills = getSkills();
    let h = '<div style="font-size:15px;margin-bottom:8px;font-weight:700;color:#f2f2f4;">📈 Skills</div>';
    h += '<div style="font-size:11px;color:#9b9ba4;margin-bottom:10px;">Train skills to unlock careers and earn more. Each training costs ₦1,000 + 20 energy.</div>';
    for (const s of SKILLS) {
      const val = skills[s.id] || 0;
      h += '<div style="background:#17181b;border-radius:8px;padding:10px;margin-bottom:6px;">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
      h += '<span style="font-size:13px;font-weight:600;color:#f2f2f4;">' + s.icon + ' ' + s.label + '</span>';
      h += '<span style="font-size:12px;font-weight:700;color:#f2b134;">' + val.toFixed(0) + '/100</span></div>';
      h += '<div style="height:6px;background:#26272b;border-radius:3px;overflow:hidden;margin-bottom:4px;"><div style="height:100%;width:' + val + '%;background:#f2b134;border-radius:3px;"></div></div>';
      h += '<div style="font-size:10px;color:#9b9ba4;margin-bottom:6px;">' + s.desc + '</div>';
      h += '<button onclick="window._trainSkill(\'' + s.id + '\')" style="width:100%;background:#0f4d3a;color:#fff;border:none;border-radius:6px;padding:6px;cursor:pointer;font:600 10px Poppins,sans-serif;">📚 Train (₦1,000)</button>';
      h += '</div>';
    }
    h += backBtn;
    c.innerHTML = h;
    return;
  }
  if(appId==="wishes"){
    const wishes = getTodaysWishes();
    const points = getWishPoints();
    const perks = getPerks();
    let h = '<div style="font-size:15px;margin-bottom:8px;font-weight:700;color:#f2f2f4;">⭐ Daily Wishes</div>';
    h += '<div style="background:#17181b;border-radius:10px;padding:10px;margin-bottom:10px;text-align:center;">';
    h += '<div style="font-size:11px;color:#9b9ba4;">Your Points</div>';
    h += '<div style="font-size:28px;font-weight:800;color:#f2b134;">' + points + '</div></div>';
    // Today's wishes
    h += '<div style="font-size:12px;font-weight:600;margin-bottom:6px;color:#f2b134;">🎯 Today\'s Wishes</div>';
    for (const w of wishes) {
      h += '<div style="background:' + (w.claimed ? '#1a2a1a' : '#17181b') + ';border-radius:8px;padding:8px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;">';
      h += '<span style="font-size:11px;color:' + (w.claimed ? '#4ade80' : '#f2f2f4') + ';">' + (w.claimed ? '✅ ' : '⬜ ') + w.text + '</span>';
      h += '<span style="font-size:11px;font-weight:600;color:#f2b134;">+' + w.points + '</span></div>';
    }
    // Perks shop
    h += '<div style="font-size:12px;font-weight:600;margin:12px 0 6px;color:#f2b134;">🏆 Perks Shop</div>';
    for (const p of PERKS) {
      const owned = perks.includes(p.id);
      const canBuy = !owned && points >= p.cost;
      h += '<div style="background:#17181b;border-radius:8px;padding:8px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;">';
      h += '<div style="flex:1;"><div style="font-size:12px;font-weight:600;color:' + (owned ? '#4ade80' : '#f2f2f4') + ';">' + p.icon + ' ' + p.name + (owned ? ' ✅' : '') + '</div>';
      h += '<div style="font-size:10px;color:#9b9ba4;">' + p.desc + '</div></div>';
      if (owned) {
        h += '<span style="font-size:10px;color:#4ade80;font-weight:600;">Owned</span>';
      } else {
        h += '<button onclick="window._buyPerk(\'' + p.id + '\')" ' + (canBuy ? '' : 'disabled') + ' style="background:' + (canBuy ? '#f2b134' : '#26272b') + ';color:' + (canBuy ? '#000' : '#6b7280') + ';border:none;border-radius:6px;padding:5px 10px;cursor:' + (canBuy ? 'pointer' : 'not-allowed') + ';font:600 10px Poppins,sans-serif;">' + p.cost + ' pts</button>';
      }
      h += '</div>';
    }
    h += backBtn;
    c.innerHTML = h;
    return;
  }
  if(appId==="election"){
    const election = getElection();
    const myUid = getMyUid();
    const isCand = isCandidate(myUid);
    const voted = hasVoted(myUid);
    const activePolicy = getActivePolicy();
    let h = '<div style="font-size:15px;margin-bottom:8px;font-weight:700;color:#f2f2f4;">🗳️ Kaduna Election</div>';
    h += '<div style="font-size:10px;color:#9b9ba4;margin-bottom:10px;">Week: ' + getWeekKey() + '</div>';
    // Active policy
    if (activePolicy) {
      h += '<div style="background:#1a2a1a;border:1px solid #4ade80;border-radius:10px;padding:10px;margin-bottom:10px;">';
      h += '<div style="font-size:11px;color:#4ade80;font-weight:600;">📋 Active Policy This Week</div>';
      h += '<div style="font-size:13px;color:#f2f2f4;margin-top:4px;">' + activePolicy.icon + ' ' + activePolicy.name + '</div>';
      h += '<div style="font-size:10px;color:#9b9ba4;">' + activePolicy.desc + '</div></div>';
    }
    // Register as candidate
    if (!isCand) {
      h += '<div style="background:#17181b;border-radius:10px;padding:10px;margin-bottom:10px;">';
      h += '<div style="font-size:12px;font-weight:600;color:#f2b134;margin-bottom:6px;">📝 Run for Governor</div>';
      h += '<div style="font-size:10px;color:#9b9ba4;margin-bottom:6px;">Fee: ₦10,000. Pick a policy + slogan.</div>';
      h += '<input id="el-slogan" type="text" placeholder="Your slogan (max 80 chars)" style="width:100%;padding:8px;border:1px solid #26272b;border-radius:6px;background:#0b0b0c;color:#fff;margin-bottom:6px;font-size:12px;" />';
      h += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;">';
      for (const p of POLICIES) {
        h += '<label style="display:flex;align-items:center;gap:4px;font-size:10px;color:#f2f2f4;cursor:pointer;"><input type="radio" name="el-policy" value="' + p.id + '" style="margin:0;" /> ' + p.icon + ' ' + p.name + '</label>';
      }
      h += '</div>';
      h += '<button onclick="window._registerCandidate()" style="width:100%;background:#f2b134;color:#000;border:none;border-radius:8px;padding:8px;cursor:pointer;font:600 12px Poppins,sans-serif;">Register (₦10,000)</button>';
      h += '</div>';
    } else {
      h += '<div style="background:#1a2a1a;border:1px solid #4ade80;border-radius:10px;padding:10px;margin-bottom:10px;text-align:center;">✅ You are a candidate this week!</div>';
    }
    // Candidates
    const candidates = Object.entries(election.candidates || {});
    h += '<div style="font-size:12px;font-weight:600;margin-bottom:6px;color:#f2b134;">📊 Candidates (' + candidates.length + ')</div>';
    if (candidates.length === 0) {
      h += '<div style="font-size:11px;color:#9b9ba4;text-align:center;padding:10px;">No candidates yet. Be the first!</div>';
    } else {
      // Count votes per candidate
      const voteCount = {};
      for (const v of Object.values(election.votes || {})) voteCount[v] = (voteCount[v] || 0) + 1;
      for (const [candUid, cand] of candidates) {
        const votes = voteCount[candUid] || 0;
        const policy = POLICIES.find(p => p.id === cand.policy);
        h += '<div style="background:#17181b;border-radius:8px;padding:10px;margin-bottom:6px;">';
        h += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        h += '<div><div style="font-size:12px;font-weight:600;color:#f2f2f4;">' + cand.name + '</div>';
        h += '<div style="font-size:10px;color:#9b9ba4;">' + (policy?.icon || '') + ' ' + (policy?.name || '') + ' · ' + votes + ' votes</div></div>';
        if (!voted && candUid !== myUid) {
          h += '<button onclick="window._vote(\'' + candUid + '\')" style="background:#0f4d3a;color:#fff;border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font:600 10px Poppins,sans-serif;">Vote</button>';
        } else if (voted) {
          h += '<span style="font-size:10px;color:#9b9ba4;">✓ Voted</span>';
        }
        h += '</div>';
        h += '<div style="font-size:11px;color:#9b9ba4;margin-top:4px;font-style:italic;">"' + cand.slogan + '"</div>';
        h += '</div>';
      }
    }
    h += backBtn;
    c.innerHTML = h;
    return;
  }
  if(appId==="friends"){
    const friends = getFriends();
    const friendList = Object.entries(friends);
    let h = '<div style="font-size:15px;margin-bottom:8px;font-weight:700;color:#f2f2f4;">👥 Friends</div>';
    // Add friend
    h += '<div style="background:#17181b;border-radius:10px;padding:10px;margin-bottom:10px;">';
    h += '<div style="font-size:12px;font-weight:600;color:#f2b134;margin-bottom:6px;">➕ Add Friend</div>';
    h += '<div style="display:flex;gap:4px;"><input id="fr-username" type="text" placeholder="Username" style="flex:1;padding:8px;border:1px solid #26272b;border-radius:6px;background:#0b0b0c;color:#fff;font-size:12px;" /><button onclick="window._addFriend()" style="background:#f2b134;color:#000;border:none;border-radius:6px;padding:8px 12px;cursor:pointer;font:600 11px Poppins,sans-serif;">Add</button></div>';
    h += '</div>';
    // Friend list
    h += '<div style="font-size:12px;font-weight:600;margin-bottom:6px;color:#f2b134;">📋 Your Friends (' + friendList.length + ')</div>';
    if (friendList.length === 0) {
      h += '<div style="font-size:11px;color:#9b9ba4;text-align:center;padding:20px;">No friends yet. Add someone by their username!</div>';
    } else {
      for (const [fUid, f] of friendList) {
        const level = f.level || 0;
        const levelLabel = ["Stranger", "Acquaintance", "Buddy", "Friend", "Close Friend", "Best Friend"][level];
        h += '<div style="background:#17181b;border-radius:8px;padding:10px;margin-bottom:6px;">';
        h += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        h += '<div><div style="font-size:12px;font-weight:600;color:#f2f2f4;">' + f.name + '</div>';
        h += '<div style="font-size:10px;color:#9b9ba4;">@' + (f.username || '?') + ' · ' + levelLabel + ' (Lvl ' + level + ')</div></div>';
        h += '<div style="display:flex;gap:4px;">';
        h += '<button onclick="window._dmFriend(\'' + fUid + '\',\'' + (f.name || '').replace(/'/g, "") + '\')" style="background:#0f4d3a;color:#fff;border:none;border-radius:6px;padding:5px 8px;cursor:pointer;font:600 10px Poppins,sans-serif;">💬 DM</button>';
        h += '<button onclick="window._visitFriend(\'' + (f.username || '') + '\')" style="background:#60a5fa;color:#fff;border:none;border-radius:6px;padding:5px 8px;cursor:pointer;font:600 10px Poppins,sans-serif;">🏠 Visit</button>';
        h += '</div></div></div>';
      }
    }
    // Visit link
    h += '<div style="background:#17181b;border-radius:10px;padding:10px;margin-top:10px;">';
    h += '<div style="font-size:11px;color:#9b9ba4;margin-bottom:4px;">🔗 Your visit link — share so friends can visit your home:</div>';
    const myName = (typeof getMyName === "function" ? getMyName() : "player");
    h += '<div style="font-size:10px;color:#f2b134;word-break:break-all;background:#0b0b0c;padding:6px;border-radius:4px;">' + generateVisitLink(myName) + '</div>';
    h += '</div>';
    h += backBtn;
    c.innerHTML = h;
    return;
  }
  if(appId==="weather"){
    const weather = getCurrentWeather();
    const headlines = getActiveHeadlines();
    let h = '<div style="font-size:15px;margin-bottom:8px;font-weight:700;color:#f2f2f4;">🌤️ Weather & News</div>';
    // Weather
    h += '<div style="background:#17181b;border-radius:10px;padding:14px;margin-bottom:10px;text-align:center;">';
    h += '<div style="font-size:40px;">' + weather.icon + '</div>';
    h += '<div style="font-size:16px;font-weight:700;color:#f2b134;margin-top:4px;">' + weather.label + '</div>';
    h += '<div style="font-size:11px;color:#9b9ba4;margin-top:2px;">' + weather.desc + '</div></div>';
    // Active headlines
    h += '<div style="font-size:12px;font-weight:600;margin-bottom:6px;color:#f2b134;">📰 Active Headlines</div>';
    if (headlines.length === 0) {
      h += '<div style="font-size:11px;color:#9b9ba4;text-align:center;padding:10px;">No active headlines. Check back later.</div>';
    } else {
      for (const hl of headlines) {
        const minsLeft = Math.ceil((hl.expires - Date.now()) / 60000);
        h += '<div style="background:#17181b;border-radius:8px;padding:8px;margin-bottom:4px;">';
        h += '<div style="font-size:11px;color:#f2f2f4;">' + hl.text + '</div>';
        h += '<div style="font-size:9px;color:#6b7280;margin-top:2px;">⏳ ' + minsLeft + ' min left</div></div>';
      }
    }
    h += backBtn;
    c.innerHTML = h;
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
  if(appId==="wallet"){
    const uid = getMyUid();
    let h = '<div style="font-size:14px;margin-bottom:10px;font-weight:700;color:var(--green);">👛 Wallet</div>';
    h += '<div style="text-align:center;padding:14px;background:linear-gradient(135deg,var(--green),#1a1a2e);color:#fff;border-radius:14px;margin-bottom:14px;">';
    h += '<div style="font-size:11px;opacity:0.8;">Balance</div><div style="font-size:28px;font-weight:800;margin-top:4px;">₦'+game.state.money.toLocaleString()+'</div></div>';
    h += '<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--green);">📋 Recent Transactions</div>';
    h += '<div id="wallet-transactions" style="font-size:12px;color:#666;">Loading...</div>';
    h += backBtn;
    c.innerHTML = h;
    // Async load transaction log from Firebase
    if (uid) {
      import("firebase/database").then(async ({ ref, get, query, limitToLast }) => {
        try {
          const snap = await get(query(ref(db, "economy/" + uid + "/log"), limitToLast(20)));
          const log = snap.val() || {};
          const entries = Object.entries(log).sort((a, b) => Number(b[0]) - Number(a[0]));
          const el = document.getElementById("wallet-transactions");
          if (!el) return;
          if (entries.length === 0) { el.innerHTML = '<div style="text-align:center;padding:10px;color:#999;">No transactions yet.</div>'; return; }
          el.innerHTML = entries.map(([ts, e]) => {
            const date = new Date(Number(ts)).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
            const isPos = e.type === "hunt" || e.type === "job" || e.type === "reward";
            const amt = (isPos ? "+" : "−") + "₦" + (e.reward || e.amount || 0).toLocaleString();
            const col = isPos ? "#4ade80" : "#e11d48";
            const icon = e.type === "hunt" ? "💎" : e.type === "job" ? "💼" : e.type === "money" ? "💸" : e.type === "reward" ? "🎁" : "💰";
            return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #eee;">'+
              '<span style="font-size:18px;">'+icon+'</span>'+
              '<div style="flex:1;"><div style="font-size:11px;font-weight:600;color:#333;">'+(e.type||"transaction")+'</div>'+
              '<div style="font-size:9px;color:#999;">'+date+'</div></div>'+
              '<span style="font-size:12px;font-weight:700;color:'+col+';">'+amt+'</span></div>';
          }).join("");
        } catch (e) { const el = document.getElementById("wallet-transactions"); if (el) el.textContent = "Could not load transactions"; }
      });
    } else { document.getElementById("wallet-transactions").innerHTML = "Sign in to see transactions"; }
    return;
  }
  if(appId==="tunes"){
    const stations = [
      { id: "afrobeat", name: "Afrobeat FM", emoji: "🎵", desc: "Burna Boy, Wizkid, Davido vibes" },
      { id: "hausa", name: "Hausa Traditional", emoji: "🥁", desc: "Mamman Shata, Dan Maraya" },
      { id: "hiphop", name: "Kaduna Hip-Hop", emoji: "🎤", desc: "Local rap + trap beats" },
      { id: "gospel", name: "Gospel FM", emoji: "🙏", desc: "Inspirational + worship" },
      { id: "oldies", name: "Old School Naija", emoji: "📼", desc: "Fela, Onyeka, Sonny Okosun" },
    ];
    let h = '<div style="font-size:14px;margin-bottom:10px;font-weight:700;color:var(--green);">🎵 Tunes</div>';
    h += '<div style="font-size:11px;color:#666;margin-bottom:8px;">Pick a station to vibe to:</div>';
    for (const st of stations) {
      const isPlaying = window._tuneStation === st.id;
      h += '<div onclick="window._playTune(\''+st.id+'\')" style="display:flex;align-items:center;gap:8px;padding:10px;background:'+(isPlaying?'#1a2a1a':'#f8f5e8')+';border-radius:8px;margin-bottom:6px;cursor:pointer;border:1px solid '+(isPlaying?'#4ade80':'#ddd')+';">';
      h += '<span style="font-size:24px;">'+st.emoji+'</span><div style="flex:1;"><div style="font-size:12px;font-weight:600;color:#333;">'+st.name+(isPlaying?' ✅':'')+'</div>';
      h += '<div style="font-size:10px;color:#999;">'+st.desc+'</div></div>';
      h += '<span style="font-size:18px;">'+(isPlaying?'⏸':'▶')+'</span></div>';
    }
    h += '<div style="font-size:10px;color:#999;margin-top:8px;text-align:center;">💡 Tunes play in the background while you play.</div>';
    h += backBtn;
    c.innerHTML = h;
    return;
  }
  if(appId==="gallery"){
    let h = '<div style="font-size:14px;margin-bottom:10px;font-weight:700;color:var(--green);">📸 Gallery</div>';
    h += '<button onclick="window._takeScreenshot()" style="width:100%;background:var(--green);color:#fff;border:none;border-radius:10px;padding:12px;cursor:pointer;font:600 13px Poppins,sans-serif;margin-bottom:10px;">📸 Take Screenshot</button>';
    let shots = [];
    try { shots = JSON.parse(localStorage.getItem("kaduna-screenshots") || "[]"); } catch (e) {}
    if (shots.length === 0) {
      h += '<div style="text-align:center;padding:20px;color:#999;font-size:12px;">No screenshots yet. Tap the button above to capture one!</div>';
    } else {
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">';
      for (let i = 0; i < shots.length; i++) {
        h += '<div style="position:relative;border-radius:8px;overflow:hidden;"><img src="'+shots[i]+'" style="width:100%;display:block;border-radius:8px;" /><button onclick="window._deleteScreenshot('+i+')" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:50%;width:20px;height:20px;font-size:10px;cursor:pointer;">✕</button></div>';
      }
      h += '</div>';
    }
    h += backBtn;
    c.innerHTML = h;
    return;
  }
  if(appId==="invest"){
    _settleInvestments();
    let h = '<div style="font-size:14px;margin-bottom:10px;font-weight:700;color:var(--green);">📈 Invest</div>';
    h += '<div style="font-size:11px;color:#666;margin-bottom:8px;">Balance: ₦'+game.state.money.toLocaleString()+'</div>';
    { const pend = game.state.investments || []; if (pend.length) { h += '<div style="background:#1a2a1a;border:1px solid #2e7d4f;border-radius:8px;padding:8px;margin-bottom:8px;font-size:11px;color:#4ade80;">⏳ Waiting: ' + pend.map(p => "₦" + p.amt.toLocaleString() + " (" + Math.max(1, Math.ceil((p.dueAt - Date.now()) / 3600000)) + " hr)").join(" · ") + '</div>'; } }
    const options = [
      { id: "treasury", name: "Treasury Bills", emoji: "🏦", min: 5000, rate: 1.10, days: 1, desc: "Safe. 10% return in 1 day." },
      { id: "keke-fund", name: "Keke Fleet", emoji: "🛺", min: 20000, rate: 1.25, days: 2, desc: "Buy a keke, hire a driver. 25% return." },
      { id: "realestate", name: "Land Flip", emoji: "🏠", min: 100000, rate: 1.50, days: 3, desc: "Buy land, sell for profit. 50% return." },
      { id: "crypto", name: "Crypto Trade", emoji: "₿", min: 50000, rate: 2.00, days: 1, desc: "High risk! 2x or lose 50%." },
    ];
    for (const opt of options) {
      const canAfford = game.state.money >= opt.min;
      h += '<div style="display:flex;align-items:center;gap:8px;padding:10px;background:#f8f5e8;border-radius:8px;margin-bottom:6px;'+(canAfford?'':'opacity:0.5;')+'">';
      h += '<span style="font-size:24px;">'+opt.emoji+'</span><div style="flex:1;"><div style="font-size:12px;font-weight:600;color:#333;">'+opt.name+'</div>';
      h += '<div style="font-size:10px;color:#999;">'+opt.desc+'</div></div>';
      if (canAfford) h += '<button onclick="window._invest(\''+opt.id+'\','+opt.min+','+opt.rate+','+opt.days+')" style="background:var(--green);color:#fff;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font:600 11px Poppins,sans-serif;">₦'+opt.min.toLocaleString()+'</button>';
      else h += '<span style="font-size:10px;color:#999;">₦'+opt.min.toLocaleString()+'</span>';
      h += '</div>';
    }
    h += backBtn;
    c.innerHTML = h;
    return;
  }
  if(appId==="settings"){
    const s=game.state;
    const curQ = getQuality();
    c.innerHTML='<div style="font-size:14px;margin-bottom:10px;font-weight:700;color:var(--green);">⚙️ Settings</div>'+
      '<div style="background:var(--cream);border-radius:10px;padding:12px;margin-bottom:8px;">'+
        '<div style="font-size:12px;font-weight:600;margin-bottom:8px;">🎨 Graphics Quality</div>'+
        '<div style="font-size:10px;color:#666;margin-bottom:8px;">Current: <b>'+curQ.toUpperCase()+'</b>. Lower = faster on slow phones. Higher = prettier.</div>'+
        '<div style="display:flex;gap:4px;">'+
          '<button onclick="window._setGraphicsQuality(\'low\')" style="flex:1;background:'+(curQ==='low'?'var(--green)':'#fff')+';color:'+(curQ==='low'?'#fff':'var(--green)')+';border:2px solid var(--green);border-radius:8px;padding:8px;cursor:pointer;font:600 11px Poppins,sans-serif;">Low</button>'+
          '<button onclick="window._setGraphicsQuality(\'medium\')" style="flex:1;background:'+(curQ==='medium'?'var(--green)':'#fff')+';color:'+(curQ==='medium'?'#fff':'var(--green)')+';border:2px solid var(--green);border-radius:8px;padding:8px;cursor:pointer;font:600 11px Poppins,sans-serif;">Medium</button>'+
          '<button onclick="window._setGraphicsQuality(\'high\')" style="flex:1;background:'+(curQ==='high'?'var(--green)':'#fff')+';color:'+(curQ==='high'?'#fff':'var(--green)')+';border:2px solid var(--green);border-radius:8px;padding:8px;cursor:pointer;font:600 11px Poppins,sans-serif;">High</button>'+
        '</div>'+
        '<div style="font-size:10px;color:#999;margin-top:6px;">Low: no shadows, simple sky. Medium: shadows + clouds. High: shadows + clouds + sun disc.</div>'+
      '</div>'+
      '<div style="background:var(--cream);border-radius:10px;padding:12px;margin-bottom:8px;">'+
        '<div style="font-size:12px;font-weight:600;margin-bottom:8px;">Game</div>'+
        '<button onclick="window.saveGame()" style="width:100%;background:var(--green);color:#fff;border:none;border-radius:8px;padding:10px;cursor:pointer;font-size:13px;font-weight:600;margin-bottom:6px;">💾 Save Game</button>'+
        '<button onclick="window.resetGame()" style="width:100%;background:#e11d48;color:#fff;border:none;border-radius:8px;padding:10px;cursor:pointer;font-size:13px;font-weight:600;">🗑 Reset Game (lose all progress)</button>'+
      '</div>'+
      '<div style="background:var(--cream);border-radius:10px;padding:12px;margin-bottom:8px;">'+
        '<div style="font-size:12px;font-weight:600;margin-bottom:6px;">🔊 Sound</div>'+
        '<div style="font-size:10px;color:#666;margin-bottom:8px;">UI clicks, money sounds, engine, rain. Auto-mutes if your phone is on silent.</div>'+
        '<button onclick="window._toggleSfxMute()" id="sfx-toggle-btn" style="width:100%;background:'+(isSfxMuted()?'#e11d48':'var(--green)')+';color:#fff;border:none;border-radius:8px;padding:10px;cursor:pointer;font-size:13px;font-weight:600;">'+(isSfxMuted()?'🔇 Sound: Off':'🔊 Sound: On')+'</button>'+
      '</div>'+
      '<div style="background:var(--cream);border-radius:10px;padding:12px;margin-bottom:8px;">'+
        '<div style="font-size:12px;font-weight:600;margin-bottom:6px;">Account</div>'+
        '<div style="font-size:11px;color:#666;margin-bottom:4px;">Signed in as: <b>'+(getMyName()||"Guest")+'</b></div>'+
        '<div style="font-size:10px;color:#999;margin-bottom:10px;">UID: '+(getMyUid()||"guest").slice(0,20)+'</div>'+
        '<button onclick="window.logout()" style="width:100%;background:#e11d48;color:#fff;border:none;border-radius:8px;padding:10px;cursor:pointer;font-size:13px;font-weight:600;">🚪 Log Out</button>'+
      '</div>'+
      '<div style="background:var(--cream);border-radius:10px;padding:12px;margin-bottom:8px;">'+
        '<div style="font-size:12px;font-weight:600;margin-bottom:6px;">📖 How to Play</div>'+
        '<div style="font-size:11px;color:#666;margin-bottom:8px;">New player? Read the quick guide on walking, driving, phone apps, challenges + more.</div>'+
        '<button onclick="window.showHowToPlay()" style="width:100%;background:var(--green);color:#fff;border:none;border-radius:8px;padding:10px;cursor:pointer;font-size:13px;font-weight:600;">📖 Open Guide</button>'+
      '</div>'+
      '<div style="background:var(--cream);border-radius:10px;padding:12px;">'+
        '<div style="font-size:12px;font-weight:600;margin-bottom:6px;">About</div>'+
        '<div style="font-size:11px;color:#666;line-height:1.5;">Kaduna Lifestyle v0.3 — A 3D multiplayer life-sim set in Kaduna, Nigeria. Built with Three.js + Firebase. © OpenStreetMap contributors for road data.</div>'+
      '</div>'+backBtn;
    return;
  }
  if(appId==="nepa"){
    const s=game.state;
    if(!s.nepa) s.nepa={ balance: 100, units: 0, lastTopup: 0, cutoff: false };
    const n=s.nepa;
    // consume ~0.5 units per real second (= 0.5 * REAL_MS_PER_GAME_HOUR/1000 game-hours per ms)
    // simplified: drain 1 unit per 60s real-time, cutoff at 0
    const nowMs=Date.now();
    if(!n.lastDrain) n.lastDrain=nowMs;
    const elapsedS=(nowMs-n.lastDrain)/1000;
    const consumed=elapsedS*(1/60);  // 1 unit per 60s
    if(n.units>0){
      n.units=Math.max(0, n.units-consumed);
      if(n.units===0 && !n.cutoff){
        n.cutoff=true;
        toast("⚡ NEPA don cut light! Top up to restore.");
      }
    }
    n.lastDrain=nowMs;
    const meterPct=Math.min(100,(n.units/50)*100);
    const meterColor=n.units<10?'#e11d48':n.units<25?'#f59e0b':'#16a34a';
    c.innerHTML='<div style="font-size:14px;margin-bottom:10px;font-weight:700;color:var(--green);">⚡ NEPA Prepaid Meter</div>'+
      '<div style="background:linear-gradient(145deg,#1a1a1a,#2a2a2a);border-radius:12px;padding:14px;margin-bottom:10px;color:#facc15;font-family:monospace;text-align:center;">'+
        '<div style="font-size:10px;color:#888;margin-bottom:4px;">METER NO: KD-'+(getMyUid()||"guest").slice(0,8).toUpperCase().padEnd(8,'0')+'</div>'+
        '<div style="font-size:32px;font-weight:700;letter-spacing:2px;">'+(n.cutoff?'—— ——':n.units.toFixed(1))+'</div>'+
        '<div style="font-size:10px;color:#888;margin-top:4px;">kWh remaining</div>'+
        '<div style="margin-top:10px;height:8px;border-radius:4px;background:#333;overflow:hidden;"><div style="height:100%;width:'+meterPct+'%;background:'+meterColor+';transition:width .3s;"></div></div>'+
        '<div style="margin-top:8px;font-size:10px;color:'+(n.cutoff?'#e11d48':'#888')+';">'+(n.cutoff?'⚠ LIGHT OFF — buy units':'✓ Light on')+'</div>'+
      '</div>'+
      '<div style="background:var(--cream);border-radius:10px;padding:10px;margin-bottom:10px;">'+
        '<div style="font-size:12px;font-weight:600;margin-bottom:8px;">Buy Units (Tariff: ₦50/kWh)</div>'+
        [[1000,20],[2000,40],[5000,100],[10000,200]].map(([p,u])=>'<button onclick="window._nepaTopup('+p+','+u+')" style="display:flex;justify-content:space-between;width:100%;background:#fff;border:2px solid var(--green);border-radius:8px;padding:9px 12px;margin-bottom:6px;cursor:pointer;font-size:12px;font-weight:600;color:var(--green);"><span>₦'+p.toLocaleString()+'</span><span>+'+u+' kWh</span></button>').join("")+
      '</div>'+
      '<div style="font-size:10px;color:#999;padding:0 4px;line-height:1.5;">When units reach 0, light goes off (cosmetic only for now — full house-light cut coming in a later build).</div>'+backBtn;
    return;
  }
  if(appId==="company"){
    const s=game.state;
    if(!s.company) s.company=null;
    const COMPANY_TYPES=[
      { id:"suya", name:"Suya Spot", icon:"🍢", cost:50000, dailyIncome:3000, desc:"Evening rush, weekend boost. The classic." },
      { id:"carwash", name:"Car Wash", icon:"🧽", cost:80000, dailyIncome:5000, desc:"Slow weekdays, jam Saturdays. Best near car parks." },
      { id:"boutique", name:"Fashion Boutique", icon:"👗", cost:150000, dailyIncome:9000, desc:"Steady sales, big festive spikes." },
      { id:"import", name:"Import/Export", icon:"📦", cost:300000, dailyIncome:18000, desc:"High risk, high reward. Lagos-Kano route." },
      { id:"pos", name:"POS & Banking Agent", icon:"💳", cost:120000, dailyIncome:7000, desc:"Steady traffic, low risk. Market spots best." },
    ];
    if(!s.company){
      c.innerHTML='<div style="font-size:14px;margin-bottom:10px;font-weight:700;color:var(--green);">🏢 Start a Company</div>'+
        '<div style="font-size:11px;color:#666;margin-bottom:10px;line-height:1.5;">Be your own boss. Pick a business type, pay the start cost, collect daily income (auto-paid at midnight game-time).</div>'+
        COMPANY_TYPES.map(t=>'<div style="display:flex;align-items:center;gap:8px;padding:10px;border:1px solid #eee;border-radius:8px;margin-bottom:6px;"><span style="font-size:24px;">'+t.icon+'</span><div style="flex:1;"><div style="font-size:13px;font-weight:600;">'+t.name+'</div><div style="font-size:11px;color:#666;line-height:1.3;">'+t.desc+'</div><div style="font-size:10px;color:var(--green);font-weight:600;margin-top:2px;">Income: ₦'+t.dailyIncome.toLocaleString()+'/day</div></div><button onclick="window._startCompany(\''+t.id+'\')" style="background:var(--green);color:#fff;border:none;border-radius:8px;padding:8px 12px;cursor:pointer;font-size:12px;font-weight:700;">₦'+t.cost.toLocaleString()+'</button></div>').join("")+backBtn;
    } else {
      const t=COMPANY_TYPES.find(x=>x.id===s.company.type);
      const since=s.company.lastCollect||Date.now();
      const elapsedDays=Math.floor((Date.now()-since)/86400000);
      const pending=elapsedDays*t.dailyIncome;
      c.innerHTML='<div style="font-size:14px;margin-bottom:10px;font-weight:700;color:var(--green);">🏢 '+t.name+' '+t.icon+'</div>'+
        '<div style="background:var(--cream);border-radius:10px;padding:12px;margin-bottom:10px;">'+
          '<div style="font-size:11px;color:#666;margin-bottom:6px;">Daily income: <b style="color:var(--green);">₦'+t.dailyIncome.toLocaleString()+'</b></div>'+
          '<div style="font-size:11px;color:#666;margin-bottom:6px;">Days owned: <b>'+Math.max(1,elapsedDays)+'</b></div>'+
          '<div style="font-size:11px;color:#666;margin-bottom:10px;">Pending collection: <b style="color:var(--gold);">₦'+pending.toLocaleString()+'</b></div>'+
          (pending>0?'<button onclick="window._collectCompany()" style="width:100%;background:var(--green);color:#fff;border:none;border-radius:8px;padding:11px;cursor:pointer;font-size:13px;font-weight:700;">💰 Collect ₦'+pending.toLocaleString()+'</button>':'<div style="font-size:11px;color:#999;text-align:center;padding:8px;">No income to collect yet — come back tomorrow.</div>')+
        '</div>'+
        '<button onclick="window._sellCompany()" style="width:100%;background:#e11d48;color:#fff;border:none;border-radius:8px;padding:10px;cursor:pointer;font-size:12px;font-weight:600;">Sell company (recover 50% of start cost)</button>'+backBtn;
    }
    return;
  }
  if(appId==="spymissions"){
    // 🕵️ Spy Missions phone app — calls into spy_mission_ui.js
    c.innerHTML = renderSpyMissionsApp(c);
    window._spyOpenMission = (id) => {
      closePhone();
      openSpyMission(id);
    };
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
const _cpSlotHtml = (label) => '<div id="cp-slot" style="position:relative;height:240px;border-radius:14px;overflow:hidden;margin-bottom:10px;background:radial-gradient(circle at 50% 35%,#3a4150,#14161a);"><div id="cp-label" style="position:absolute;left:0;right:0;bottom:0;padding:6px 10px;font-size:11px;color:#dfe3ea;background:linear-gradient(transparent,rgba(0,0,0,.65));text-align:center;pointer-events:none;">'+(label||'Drag to turn · this is how you look')+'</div></div><div id="cp-bar"></div>';
const _cpMount = (look) => mountPreview(document.getElementById("cp-slot"), look);
function _cpLabel(t) { const e = document.getElementById("cp-label"); if (e) e.textContent = t; }
// Boutique "Try on": dress the PREVIEW only (nothing is bought or worn for real)
window._tryItem = (id) => {
  const it = SHOP.find(x => x.id === id); if (!it) return;
  const L = game.state.look, T = { ...L, worn: { ...(L.worn || {}) } };
  if (it.patch) Object.assign(T, it.patch);
  T.worn[it.slot] = id;
  setPreviewLook(T);
  const owned = (L.owned || []).includes(id);
  _cpLabel("Trying: " + it.name + (owned ? " (you own this)" : " · ₦" + it.price.toLocaleString()));
  const bar = document.getElementById("cp-bar");
  if (bar) bar.innerHTML = '<div style="display:flex;gap:6px;margin:-4px 0 10px;">' + (owned ? '' : '<button onclick="window.buyClothing(\''+id+'\')" style="flex:1;background:var(--green);color:#fff;border:none;border-radius:10px;padding:10px;font-weight:700;font-size:12px;cursor:pointer;">Buy ₦'+it.price.toLocaleString()+'</button>') + '<button onclick="window._tryReset()" style="flex:1;background:#2a2c33;color:#f2f2f4;border:none;border-radius:10px;padding:10px;font-weight:700;font-size:12px;cursor:pointer;">↩ Back to my look</button></div>';
  document.getElementById("cp-slot")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
};
window._tryReset = () => { setPreviewLook(game.state.look); _cpLabel("Drag to turn · this is how you look"); const b = document.getElementById("cp-bar"); if (b) b.innerHTML = ""; };
// Wardrobe: look at the other gender before you switch (switching reloads the game)
window._previewGender = (g) => {
  const L = game.state.look;
  if ((L.gender || "male") === g) { window._tryReset(); return; }
  const o = outfitsFor(g)[0], T = { ...L, ...o, gender: g, outfitId: o.id, worn: {} };
  setPreviewLook(T);
  _cpLabel("Preview: " + (g === "female" ? "Woman" : "Man") + " — not saved yet");
  const bar = document.getElementById("cp-bar");
  if (bar) bar.innerHTML = '<div style="display:flex;gap:6px;margin:-4px 0 10px;"><button onclick="window._setGender(\''+g+'\')" style="flex:1;background:var(--green);color:#fff;border:none;border-radius:10px;padding:10px;font-weight:700;font-size:12px;cursor:pointer;">✓ Switch to '+(g==="female"?"Woman":"Man")+' (game reloads)</button><button onclick="window._tryReset()" style="flex:1;background:#2a2c33;color:#f2f2f4;border:none;border-radius:10px;padding:10px;font-weight:700;font-size:12px;cursor:pointer;">Cancel</button></div>';
};
function showPhoneApp(appId){
  _showPhoneApp(appId);
  const c=$("phone-content"); if(!c) return;
  if(appId!=="home" && !c.querySelector(".ph-back")) c.insertAdjacentHTML("afterbegin",'<button class="ph-back" onclick="window.showApp(\'home\')">← Back</button>');
  c.scrollTop=0;
}
window.showApp=showPhoneApp;
window.buyFood=(id)=>{
  const f=FOOD_ITEMS.find(x=>x.id===id); if(!f) return;
  if(game.state.money<f.price){toast("Not enough money");return;}
  if(!rig||isBusy()){const r=game.eat(id);toast(r.msg||r.error);updateHUD();return;}
  closePhone();
  startActivity(eatSpec(player,(ok)=>{ if(!ok){toast("You stopped eating — money not taken");return;} const r=game.eat(id);toast(r.msg||r.error);updateHUD(); }, 6), player, rig);
};
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
function _pushLook(){ setMyLook(game.state.look); clearTimeout(window._lookT); window._lookT=setTimeout(()=>{const u=getMyUid(); if(u) update(ref(db,"players/"+u+"/look"),game.state.look).catch(()=>{});},300); }
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
      if ((L.gender || "male") !== _loadedGender) { location.reload(); return; }
      toast("Welcome to Kaduna! 🎉");
      // Show origin selection if not yet chosen
      if (!game.state.origin) { setTimeout(() => _showOriginScreen(), 500); }
      else if (!game.state.homeArea) { setTimeout(() => _showAreaScreen(), 500); }
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
const AREA_TRAVEL_FARE = 300;
window.travelToArea=(areaId)=>{
  const a = getArea(areaId);
  if (!a) return;
  if (getActivePlace()) { toast("Leave the building first."); return; }
  if (game.state.money < AREA_TRAVEL_FARE) { toast("A keke to " + a.name + " costs ₦" + AREA_TRAVEL_FARE + " — you don't have enough."); return; }
  game.state.money -= AREA_TRAVEL_FARE;
  game.save?.();
  const uid = getMyUid();
  if (uid) update(ref(db, "economy/" + uid), { balance: game.state.money });
  // arrive on the district's own road, west end, facing east
  player.pos.x = a.x - 48; player.pos.z = a.z;
  ctl.yaw = -Math.PI / 2 + Math.PI;
  updateHUD();
  closePhone?.();
  toast("🛺 Welcome to " + a.name + " (−₦" + AREA_TRAVEL_FARE + ")");
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
// ---- SFX mute toggle (Oct 19) ----
window._toggleSfxMute = () => {
  setSfxMuted(!isSfxMuted());
  toast(isSfxMuted() ? "🔇 Sound off" : "🔊 Sound on");
  showPhoneApp("settings");
};
// ---- NEPA prepaid meter topup (Oct 19) ----
window._nepaTopup = (price, units) => {
  if (game.state.money < price) { toast("Not enough money for ₦" + price + " top-up"); return; }
  game.state.money -= price;
  const n = game.state.nepa || (game.state.nepa = { balance: 0, units: 0, cutoff: false });
  n.units = (n.units || 0) + units;
  n.cutoff = false;
  n.lastTopup = Date.now();
  n.lastDrain = Date.now();
  toast("⚡ Bought " + units + " kWh for ₦" + price.toLocaleString() + ". Light restored!");
  try { sfx.success(); } catch (e) {}
  try { emitConfetti(player.pos, 30); } catch (e) {}
  updateHUD();
  game.save?.();
  showPhoneApp("nepa");
};
// ---- Company start / collect / sell (Oct 19) ----
window._startCompany = (type) => {
  const TYPES = {
    suya:    { name: "Suya Spot",         cost: 50000,  daily: 3000  },
    carwash: { name: "Car Wash",          cost: 80000,  daily: 5000  },
    boutique:{ name: "Fashion Boutique",  cost: 150000, daily: 9000  },
    import:  { name: "Import/Export",     cost: 300000, daily: 18000 },
    pos:     { name: "POS & Banking",     cost: 120000, daily: 7000  },
  };
  const t = TYPES[type];
  if (!t) return;
  if (game.state.company) { toast("You already own a company. Sell it first."); return; }
  if (game.state.money < t.cost) { toast("Not enough money. Need ₦" + t.cost.toLocaleString()); return; }
  game.state.money -= t.cost;
  game.state.company = { type, name: t.name, started: Date.now(), lastCollect: Date.now() };
  toast("🎉 You now own a " + t.name + "! Check back daily for income.");
  try { sfx.success(); } catch (e) {}
  try { emitConfetti(player.pos, 60); } catch (e) {}
  updateHUD();
  game.save?.();
  showPhoneApp("company");
};
window._collectCompany = () => {
  const c = game.state.company;
  if (!c) return;
  const TYPES = { suya: 3000, carwash: 5000, boutique: 9000, import: 18000, pos: 7000 };
  const daily = TYPES[c.type] || 0;
  const days = Math.floor((Date.now() - (c.lastCollect || Date.now())) / 86400000);
  if (days <= 0) { toast("No income to collect yet — come back tomorrow."); return; }
  const payout = days * daily;
  game.state.money += payout;
  c.lastCollect = Date.now();
  toast("💰 Collected ₦" + payout.toLocaleString() + " from your " + c.name + ".");
  try { sfx.money(); } catch (e) {}
  try { emitConfetti(player.pos, 40); } catch (e) {}
  updateHUD();
  game.save?.();
  showPhoneApp("company");
};
window._sellCompany = () => {
  const c = game.state.company;
  if (!c) return;
  const TYPES = { suya: 50000, carwash: 80000, boutique: 150000, import: 300000, pos: 120000 };
  const refund = Math.floor((TYPES[c.type] || 0) * 0.5);
  game.state.money += refund;
  game.state.company = null;
  toast("Sold company. Recovered ₦" + refund.toLocaleString() + ".");
  try { sfx.money(); } catch (e) {}
  updateHUD();
  game.save?.();
  showPhoneApp("company");
};
window._setGraphicsQuality = (q) => {
  applyQuality(q, { renderer, sun, scene });
  _gLevel = 0; _gAcc = 0; _gN = 0; _gWarm = 0;
  // (no CSS filter on the canvas: it caused the High-quality blur/lag — see note near the renderer setup)
  try { renderer.domElement.style.filter = ''; } catch (e) {}
  toast("🎨 Graphics set to " + q.toUpperCase() + ". Governor reset.");
  showPhoneApp("settings");
};
// ---- HomeStore: buy furniture + category filter ----
window._hsSetCat = (cat) => { window._hsCat = cat; showPhoneApp("homestore"); };
window._buyFurniture = async (itemId) => {
  const it = getItem(itemId);
  if (!it) return;
  if (game.state.money < it.price) { toast("Not enough money for " + it.name); return; }
  game.state.money -= it.price;
  game.save?.();
  // Save money to Firebase — update() requires an object, not a number.
  const uid = getMyUid();
  if (uid) update(ref(db, "economy/" + uid), { balance: game.state.money });
  // Add to storage in Firebase
  if (uid) {
    import("firebase/database").then(({ ref, get, set }) => {
      get(ref(db, "players/"+uid+"/storage")).then((snap) => {
        const storage = snap.val() || [];
        storage.push({ id: itemId, color: it.colors[0] });
        set(ref(db, "players/"+uid+"/storage"), storage);
      });
    });
  }
  // Track for missions
  if (!missionState.ownedFurniture) missionState.ownedFurniture = [];
  missionState.ownedFurniture.push({ id: itemId });
  updateHUD();
  toast("🛋️ " + it.name + " bought! Check your Storage.");
  showPhoneApp("homestore");
};
// ---- Real Estate: buy/upgrade house ----
window._buyHouse = async (tier, price, name) => {
  if (game.state.money < price) { toast("Not enough money"); return; }
  game.state.money -= price;
  game.state.homeTier = tier;
  game.save?.();
  const uid = getMyUid();
  if (uid) {
    // update() requires an object, not a number — wrap balance in an object.
    update(ref(db, "economy/" + uid), { balance: game.state.money });
    update(ref(db, "players/" + uid), { homeTier: tier });
  }
  missionState.lastAction = "buyHouse";
  updateHUD();
  toast("🎉 Bought " + name + "! Walk to 🏠 My Home to enter.");
  celebrate("🏠 " + name, "Welcome to your new home!");
  showPhoneApp("realestate");
};
// ---- Pay rent ----
window._payRent = async () => {
  const uid = getMyUid();
  const r = await payRent(uid, game.state);
  toast(r.msg || r.error);
  updateHUD();
  if (r.ok) showPhoneApp("realestate");
};
// ---- Origin selection ----
window._pickOrigin = (originId) => {
  // Wrap everything in try/finally so the sheet is ALWAYS dismissed even if a
  // Firebase write throws synchronously (which was the previous bug: an invalid
  // update() call aborted the function before the sheet could be removed).
  try {
    const r = applyOrigin(game.state, originId);
    if (!r.ok) { toast(r.error || "Could not pick origin"); return; }
    const uid = getMyUid();
    if (uid) {
      // BUGFIX: previously this was `update(ref(db,"economy/"+uid+"/balance"), game.state.money)`
      // — passing a NUMBER as the second arg to update(). update() requires an OBJECT,
      // so it threw "values argument must be an object containing the children to replace"
      // and the origin sheet never got removed. Wrap the value in an object.
      update(ref(db, "economy/" + uid), { balance: game.state.money });
      update(ref(db, "players/" + uid), { homeTier: game.state.homeTier, origin: game.state.origin, lastRentPaid: game.state.lastRentPaid });
      if (r.origin.starterFurniture.length) {
        import("firebase/database").then(({ ref, get, set }) => {
          get(ref(db, "players/"+uid+"/storage")).then((snap) => {
            const storage = snap.val() || [];
            for (const fid of r.origin.starterFurniture) {
              const it = getItem(fid);
              if (it) storage.push({ id: fid, color: it.colors[0] });
            }
            set(ref(db, "players/"+uid+"/storage"), storage);
          }).catch((e) => console.warn("[origin] storage fetch failed", e));
        }).catch((e) => console.warn("[origin] firebase import failed", e));
      }
    }
    toast("🎉 You chose " + r.origin.name + "! Check your Storage for starter items.");
    try { updateHUD(); } catch (e) { console.warn("[origin] updateHUD failed", e); }
    if (!game.state.homeArea) { setTimeout(() => _showAreaScreen(), 600); }
  } catch (e) {
    console.error("[origin] _pickOrigin failed", e);
    toast("Could not save your origin — try again.");
  } finally {
    // No matter what went wrong above, the sheet must close so the player can continue.
    document.getElementById("origin-sheet")?.remove();
  }
};
function _showOriginScreen() {
  // Guard: if origin is already chosen (e.g. loaded from Firebase/localStorage
  // after the creator's onDone scheduled this call), do not show the picker again.
  if (game.state.origin) return;
  let el = document.getElementById("origin-sheet");
  if (el) el.remove();
  el = document.createElement("div");
  el.id = "origin-sheet";
  el.style.cssText = "position:fixed;inset:0;z-index:65;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:16px;";
  let h = '<div style="background:#0b0b0c;border-radius:20px;padding:24px;width:min(400px,92vw);max-height:80vh;overflow-y:auto;color:#f2f2f4;position:relative;">';
  h += '<div style="font-size:20px;font-weight:800;text-align:center;margin-bottom:6px;">🌍 Choose Your Origin</div>';
  h += '<div style="font-size:12px;color:#9b9ba4;text-align:center;margin-bottom:16px;">Your origin determines your starting money, home, and playstyle. Choose wisely — this is permanent!</div>';
  for (const o of ORIGINS) {
    h += '<div onclick="window._pickOrigin(\''+o.id+'\')" style="background:#17181b;border:2px solid '+o.color+';border-radius:14px;padding:14px;margin-bottom:10px;cursor:pointer;">';
    h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;"><span style="font-size:32px;">'+o.icon+'</span><div><div style="font-size:16px;font-weight:700;color:'+o.color+';">'+o.name+'</div></div></div>';
    h += '<div style="font-size:12px;color:#9b9ba4;line-height:1.4;">'+o.desc+'</div>';
    h += '<div style="font-size:11px;margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">';
    h += '<span style="background:#26272b;padding:3px 8px;border-radius:6px;">💰 ₦'+o.money.toLocaleString()+'</span>';
    h += '<span style="background:#26272b;padding:3px 8px;border-radius:6px;">🏠 '+HOUSE_TIERS.find(t=>t.tier===o.homeTier)?.name+'</span>';
    if (o.skillBonus) h += '<span style="background:#26272b;padding:3px 8px;border-radius:6px;">⚡ +'+(o.skillBonus*100)+'% skill growth</span>';
    if (o.weeklyDebt) h += '<span style="background:#26272b;padding:3px 8px;border-radius:6px;">📉 Owes ₦'+o.weeklyDebt+'/wk adashe</span>';
    h += '</div></div>';
  }
  h += '</div>';
  el.innerHTML = h;
  document.body.appendChild(el);
}
// ---- Messages app rendering ----
var _showingApp = null;
let _totalUnread = 0;
let _lastUnreadCount = 0;
function _updateUnreadBadge() {
  const chats = getChatList();
  _totalUnread = chats.reduce((s, c) => s + (c.unread || 0), 0);
  // Update phone button badge
  const phoneBtn = document.querySelector(".phone-btn");
  if (phoneBtn) {
    const existing = phoneBtn.querySelector(".phone-unread-badge");
    if (_totalUnread > 0) {
      if (existing) existing.textContent = _totalUnread;
      else {
        const badge = document.createElement("span");
        badge.className = "phone-unread-badge";
        badge.style.cssText = "position:absolute;top:-4px;right:-4px;background:#e11d48;color:#fff;border-radius:10px;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;padding:0 4px;z-index:5;";
        badge.textContent = _totalUnread;
        phoneBtn.style.position = "relative";
        phoneBtn.appendChild(badge);
      }
    } else if (existing) existing.remove();
  }
  // Toast on new message
  if (_totalUnread > _lastUnreadCount) {
    const newChats = chats.filter(c => (c.unread || 0) > 0);
    if (newChats.length > 0) {
      const latest = newChats[0];
      // Don't toast if phone is open AND we're in the messages app
      const phoneOpen = document.getElementById("phone-modal")?.classList.contains("show");
      const inMessages = _showingApp === "messages" && window._openChatId;
      if (!phoneOpen || !inMessages) {
        toast("💬 New message" + (_totalUnread > 1 ? " (" + _totalUnread + " unread)" : ""));
      }
    }
  }
  _lastUnreadCount = _totalUnread;
}
// ---- Messages app — Lagos-Life style (light theme, @username rows, Unread/Read filters) ----
window._msgTabName = "chats"; window._msgPill = "all"; window._msgQuery = "";
const _MX_COLORS = ["#0f4d3a", "#2e7d4f", "#c98a0b", "#b45309", "#7c5a2b", "#1d6f6b", "#8a3b2e", "#4d6b2f"];
function _mxEsc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
function _mxAvatar(label, key, size) {
  const ch = (String(label || "?").replace(/^@/, "").trim().charAt(0) || "?").toUpperCase();
  let h = 0; const k = String(key || label || ""); for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) | 0;
  return '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + _MX_COLORS[Math.abs(h) % _MX_COLORS.length] + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:' + Math.round(size * 0.42) + 'px;font-weight:700;flex:none;">' + _mxEsc(ch) + '</div>';
}
function _mxAgo(ts) {
  if (!ts) return "";
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "now"; if (m < 60) return m + "m";
  const h = Math.floor(m / 60); if (h < 24) return h + "h";
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function _mxRowsHtml() {
  const wantGroups = window._msgTabName === "groups", pill = window._msgPill;
  let list = getChatList().filter((c) => (wantGroups ? c.isGroup : !c.isGroup));
  if (pill === "unread") list = list.filter((c) => (c.unread || 0) > 0);
  else if (pill === "read") list = list.filter((c) => !(c.unread || 0));
  const q = (window._msgQuery || "").trim().toLowerCase().replace(/^@/, "");
  if (q) list = list.filter((c) => ((c.title || "") + " " + (c.username || "") + " " + (c.lastText || "")).toLowerCase().includes(q));
  if (!list.length) {
    if (q) return '<div class="mx-empty">No chats match "' + _mxEsc(q) + '"</div>';
    if (pill === "unread") return '<div class="mx-empty"><div style="font-size:34px">✅</div><div>No unread chats. You\'re all caught up ✓</div><button class="mx-link" onclick="window._msgSetPill(\'all\')">See all chats</button></div>';
    return '<div class="mx-empty">' + (wantGroups ? 'No groups yet. Tap "+ Group" to create one.' : 'No chats yet. Search for someone by @username to start chatting!') + '</div>';
  }
  return list.map((c) => {
    const unread = c.unread || 0;
    const name = c.isGroup ? c.title : (c.username ? "@" + c.username : (c.title || "Player"));
    return '<div class="mx-row" onclick="window._openChatView(\'' + c.chatId + '\')">' + _mxAvatar(name, c.otherUid || c.chatId, 44) +
      '<div class="mx-mid"><div class="mx-name">' + _mxEsc(name) + '</div><div class="mx-prev' + (unread ? ' unread' : '') + '">' + _mxEsc(c.lastText || "Tap to chat") + '</div></div>' +
      '<div class="mx-right"><div class="mx-time">' + _mxAgo(c.lastTs) + '</div>' + (unread ? '<span class="mx-badge">' + unread + '</span>' : '') + '</div></div>';
  }).join("");
}
function _renderMessagesList(c) {
  const total = getChatList().reduce((n, x) => n + (x.unread || 0), 0);
  const tab = window._msgTabName, pill = window._msgPill;
  let h = '<div class="mx">';
  h += '<div class="mx-head"><button class="ph-back mx-back" onclick="window.showApp(\'home\')">‹</button><div class="mx-title">Messages</div><div id="mx-total">' + (total > 0 ? '<span class="mx-badge">' + total + '</span>' : '') + '</div></div>';
  h += '<div class="mx-seg"><button id="msg-tab-chats" class="' + (tab === "chats" ? "on" : "") + '" onclick="window._msgTab(\'chats\')">Chats</button><button id="msg-tab-groups" class="' + (tab === "groups" ? "on" : "") + '" onclick="window._msgTab(\'groups\')">Groups</button></div>';
  h += '<div class="mx-new"><span>✏️</span><input id="msg-search" type="text" autocomplete="off" placeholder="Message someone: @username" oninput="window._searchUsers(this.value)" /><button class="mx-grp" onclick="window._newGroup()">+ Group</button></div>';
  h += '<div id="msg-search-results"></div>';
  h += '<div class="mx-pills">' + ["all", "unread", "read"].map((p) => '<button class="' + (pill === p ? "on" : "") + '" onclick="window._msgSetPill(\'' + p + '\')">' + p.charAt(0).toUpperCase() + p.slice(1) + '</button>').join("") + '</div>';
  h += '<input id="msg-filter" class="mx-filter" type="text" autocomplete="off" placeholder="Search your chats" value="' + _mxEsc(window._msgQuery || "") + '" oninput="window._msgFilter(this.value)" />';
  h += '<div id="msg-chat-list">' + _mxRowsHtml() + '</div></div>';
  c.innerHTML = h;
}
// Refresh only the list (keeps the keyboard / typed text) — used when chats update in the background.
window._msgRefreshList = () => {
  const el = document.getElementById("msg-chat-list"); if (!el) return;
  el.innerHTML = _mxRowsHtml();
  const t = document.getElementById("mx-total"); if (t) { const n = getChatList().reduce((s, x) => s + (x.unread || 0), 0); t.innerHTML = n > 0 ? '<span class="mx-badge">' + n + '</span>' : ""; }
};
window._msgSetPill = (p) => { window._msgPill = p; const c = $("phone-content"); if (c && _showingApp === "messages" && !window._openChatId) _renderMessagesList(c); };
window._msgFilter = (v) => { window._msgQuery = v; window._msgRefreshList(); };
window._msgTab = (t) => { window._msgTabName = t; const c = $("phone-content"); if (c) _renderMessagesList(c); };
function _renderChatScreen(c, chatId, otherName) {
  const nm = _mxEsc(otherName);
  let h = '<div class="mx mx-chat">';
  h += '<div class="mx-head"><button class="ph-back mx-back" onclick="window._closeChatView()">‹</button>' + _mxAvatar(otherName, window._openChatOtherUid || chatId, 34) + '<div class="mx-title" style="margin-left:6px;">' + nm + '</div></div>';
  h += '<div class="mx-actions"><button onclick="window._chatInvite()">🏠 Invite</button><button onclick="window._chatVisit()">🚪 Visit</button><button class="money" onclick="window._chatSendMoney()">💸 Send money</button></div>';
  h += '<div id="msg-bubbles" class="mx-bubbles"></div>';
  h += '<div class="mx-compose"><input id="msg-input" type="text" autocomplete="off" placeholder="Message..." onkeydown="if(event.key===\'Enter\')window._sendMsg()" /><button class="mx-send" onclick="window._sendMsg()">➤</button></div>';
  h += '</div>';
  c.innerHTML = h;
  // Listen to messages
  openChat(chatId, (msgs) => {
    const container = document.getElementById("msg-bubbles");
    if (!container) return;
    container.innerHTML = "";
    if (!msgs.length) { container.innerHTML = '<div class="mx-empty" style="margin-top:30px;">No messages yet. Say hi 👋</div>'; return; }
    for (const m of msgs) {
      const isMe = m.from === getMyUid();
      const time = new Date(m.ts || 0).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      if (m.type === "system") {
        const div = document.createElement("div");
        div.style.cssText = "text-align:center;margin:6px 0;color:#8e909a;font-size:11px;";
        div.textContent = m.text;
        container.appendChild(div);
      } else if (m.type === "money") {
        const div = document.createElement("div");
        div.style.cssText = "text-align:center;margin:8px auto;width:fit-content;background:rgba(242,177,52,.12);border:1px solid rgba(242,177,52,.3);border-radius:14px;padding:7px 14px;color:#f2b134;font-size:12px;font-weight:600;";
        div.textContent = "💸 " + (isMe ? "You sent" : "You received") + " ₦" + (m.amount || 0).toLocaleString();
        container.appendChild(div);
      } else if (m.type === "house_invite") {
        // FEATURE: house invite bubble — shows the inviter's name + a Visit button.
        // The button stores the invite payload globally so _visitFromInvite can use it.
        const div = document.createElement("div");
        div.style.cssText = "text-align:center;margin:8px auto;width:fit-content;max-width:85%;background:#1b1c20;border:1px solid rgba(242,177,52,.3);border-radius:14px;padding:9px 14px;color:#f2f2f4;font-size:12px;";
        const label = document.createElement("div");
        label.style.cssText = "font-weight:600;margin-bottom:6px;";
        const inviterName = (m.extra && m.extra.ownerName) || (isMe ? "You" : "Friend");
        label.textContent = "🏠 " + inviterName + " invited you to their home";
        div.appendChild(label);
        if (!isMe && m.extra) {
          // Only show the Visit button to the invitee (not the inviter)
          const visitBtn = document.createElement("button");
          visitBtn.textContent = "🚪 Visit now";
          visitBtn.style.cssText = "background:#f2b134;color:#000;border:none;border-radius:8px;padding:6px 14px;cursor:pointer;font:700 11px Poppins,sans-serif;";
          // Stash the invite payload on a global so the click handler can read it
          window._pendingVisitInvite = m.extra;
          visitBtn.onclick = () => {
            const invite = window._pendingVisitInvite;
            if (!invite || !invite.areaId || invite.plotNo == null || !invite.ownerUid) {
              toast("Stale invite — ask them to send a new one");
              return;
            }
            // Close the phone first so we see the world fade transition
            closePhone();
            setTimeout(async () => {
              try {
                const ok = await enterPlaceAsVisitor(invite, { pos: player.pos, heading: player.heading });
                if (!ok) toast("Could not visit — try again");
              } catch (e) {
                console.error("Visit failed:", e);
                toast("Visit failed: " + e.message);
              }
            }, 200);
          };
          div.appendChild(visitBtn);
        } else if (isMe) {
          const note = document.createElement("div");
          note.style.cssText = "font-size:10px;color:#9b9ba4;margin-top:4px;";
          note.textContent = "Waiting for them to accept...";
          div.appendChild(note);
        }
        container.appendChild(div);
      } else if (m.type === "pickup") {
        // PASSENGER (Oct 19): pickup invite from another player who is on
        // a ride. Shows an Accept button — tapping it makes me a passenger
        // on their ride (my position follows theirs each frame).
        const div = document.createElement("div");
        div.style.cssText = "text-align:center;margin:8px auto;width:fit-content;max-width:85%;background:#1b1c20;border:1px solid rgba(74,222,128,.4);border-radius:14px;padding:9px 14px;color:#f2f2f4;font-size:12px;";
        const label = document.createElement("div");
        label.style.cssText = "font-weight:600;margin-bottom:6px;";
        const driverName = (m.extra && m.extra.driverName) || "Player";
        label.textContent = "🛵 " + driverName + " wants to pick you up";
        div.appendChild(label);
        if (!isMe && m.extra && m.extra.driverUid) {
          const acceptBtn = document.createElement("button");
          acceptBtn.textContent = "🛵 Accept ride";
          acceptBtn.style.cssText = "background:#4ade80;color:#000;border:none;border-radius:8px;padding:6px 14px;cursor:pointer;font:700 11px Poppins,sans-serif;";
          acceptBtn.onclick = () => {
            // Set my local "passenger of X" state + push to Firebase so the
            // driver (and other players) see me as a passenger.
            setMyPassengerDriver(m.extra.driverUid);
            closePhone();
            toast("🛵 You're now a passenger on " + driverName + "'s ride.");
          };
          div.appendChild(acceptBtn);
        } else if (isMe) {
          const note = document.createElement("div");
          note.style.cssText = "font-size:10px;color:#9b9ba4;margin-top:4px;";
          note.textContent = "Waiting for them to accept...";
          div.appendChild(note);
        }
        container.appendChild(div);
      } else {
        const div = document.createElement("div");
        div.style.cssText = "display:flex;justify-content:" + (isMe ? "flex-end" : "flex-start") + ";margin:4px 0;";
        const bubble = document.createElement("div");
        bubble.style.cssText = "max-width:78%;padding:9px 13px;border-radius:18px;font-size:14px;line-height:1.35;word-break:break-word;" + (isMe ? "background:#12664b;color:#fff;border-bottom-right-radius:6px;" : "background:#202126;color:#f2f2f4;border-bottom-left-radius:6px;");
        bubble.textContent = m.text; // textContent — never innerHTML (blocks injection)
        const timeSpan = document.createElement("div");
        timeSpan.style.cssText = "font-size:9px;margin-top:2px;text-align:right;color:" + (isMe ? "rgba(255,255,255,.6)" : "#7d808a") + ";";
        timeSpan.textContent = time + (isMe ? " ✓" : "");
        bubble.appendChild(timeSpan);
        div.appendChild(bubble);
        container.appendChild(div);
      }
    }
    container.scrollTop = container.scrollHeight;
  });
}
// ---- Messages window functions ----
window._searchUsers = (q) => {
  clearTimeout(window._srchT);
  window._srchT = setTimeout(async () => {
    const results = await searchUsers(q);
    const el = document.getElementById("msg-search-results");
    if (!el) return;
    if (!results.length) { el.innerHTML = ""; return; }
    el.innerHTML = results.map((r) => '<div class="mx-row" onclick="window._startChat(\'' + r.uid + '\')">' + _mxAvatar(r.username || r.name, r.uid, 38) + '<div class="mx-mid"><div class="mx-name">' + _mxEsc(r.name) + '</div><div class="mx-prev">@' + _mxEsc(r.username) + '</div></div></div>').join("");
  }, 250);
};
window._startChat = async (uid, name) => {
  try {
    const r = await openDM(uid, name || "Chat");
    if (!r) return;
    window._openChatId = r.chatId;
    window._openChatName = r.otherUsername ? "@" + r.otherUsername : (r.otherName || name || "Chat");
    window._openChatOtherUid = uid;
    showPhoneApp("messages");
  } catch (e) { console.warn("[messages] startChat failed", e); toast("Could not open chat"); }
};
// Opens a chat from the list. Uses the person stored on the chat (or the public userProfiles node) —
// never players/{uid}, which only that player may read (that read used to fail and the DM never opened).
window._openChatView = async (chatId) => {
  try {
    const chat = getChatList().find((c) => c.chatId === chatId);
    window._openChatId = chatId;
    if (chat && chat.isGroup) {
      window._openChatName = chat.title || "👥 Group"; window._openChatOtherUid = null;
    } else {
      let otherUid = chat && chat.otherUid;
      if (!otherUid) { const meta = await getChatMeta(chatId); otherUid = meta && meta.members ? Object.keys(meta.members).find((u) => u !== getMyUid()) : null; }
      window._openChatOtherUid = otherUid || null;
      let nm = chat && (chat.username ? "@" + chat.username : chat.title);
      if (!nm && otherUid) { const p = await getProfile(otherUid); nm = p ? (p.username ? "@" + p.username : p.name) : ""; }
      window._openChatName = nm || "Chat";
    }
  } catch (e) { console.warn("[messages] openChatView failed", e); window._openChatName = window._openChatName || "Chat"; }
  showPhoneApp("messages");
};
window._closeChatView = () => {
  closeChat();
  window._openChatId = null;
  window._openChatName = null;
  window._openChatOtherUid = null;
  showPhoneApp("messages");
};
window._sendMsg = async () => {
  const input = document.getElementById("msg-input");
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = "";                                   // clear at once so sending feels instant
  let ok = false;
  try { ok = await sendMessage(window._openChatId, text); } catch (e) { console.warn("[messages] send failed", e); }
  if (!ok) { const box = document.getElementById("msg-input"); if (box && !box.value) box.value = text; }   // not sent: keep what was typed
};
window._chatSendMoney = () => {
  const amt = prompt("Send money to " + (window._openChatName || "user") + " — Enter amount ₦:");
  if (!amt) return;
  sendMoney(window._openChatId, window._openChatOtherUid, parseInt(amt), "", game.state).then((r) => {
    toast(r.msg);
    if (r.ok) updateHUD();
  });
};
window._chatInvite = async () => {
  // FEATURE: send a house invite message in this chat. The recipient sees a
  // "🚪 Visit now" button that calls enterPlaceAsVisitor with the embedded
  // house key (areaId, plotNo, ownerUid, ownerName).
  if (!window._openChatId) { toast("Open a chat first"); return; }
  const myUid = getMyUid();
  if (!myUid) { toast("Sign in first"); return; }
  // Resolve my own house key
  const houseKey = await resolvePlayerHouseKey(myUid);
  if (!houseKey) {
    toast("🏠 You haven't claimed a house yet. Pick an area first.");
    return;
  }
  // Look up the house record (for tier/colors if we want to show them later)
  const house = await loadHouse(houseKey.areaId, houseKey.plotNo);
  const ownerName = getMyName() || "Friend";
  const ok = await sendHouseInvite(window._openChatId, {
    areaId: houseKey.areaId,
    plotNo: houseKey.plotNo,
    ownerUid: myUid,
    ownerName: ownerName,
  });
  if (ok) toast("🏠 Invite sent to " + (window._openChatName || "user"));
  else toast("Could not send invite — try again");
};
window._chatVisit = () => {
  // Visitor taps the 🚪 Visit now button on a house_invite message.
  // The actual handler is set per-button in the chat bubble rendering below.
  toast("Tap the 🚪 Visit button on the latest house invite in this chat");
};
window._newGroup = () => {
  const name = prompt("Group name:");
  if (!name) return;
  const members = prompt("Add members by @username (comma-separated):");
  if (!members) return;
  // Parse usernames -> uids
  const usernames = members.split(",").map(s => s.trim().toLowerCase().replace(/^@/, "")).filter(Boolean);
  Promise.all(usernames.map(u => import("firebase/database").then(({ ref, get }) => get(ref(db, "usernames/" + u)).then(s => s.val())))).then((uids) => {
    const validUids = uids.filter(Boolean);
    if (validUids.length === 0) { toast("No valid usernames found"); return; }
    createGroup(name, "👥", validUids).then((r) => { toast(r.ok ? "🎉 Group created!" : r.msg); if (r.ok) showPhoneApp("messages"); });
  });
};
function _showAreaScreen() {
  if (game.state.homeArea) return;
  let el = document.getElementById("area-sheet");
  if (el) el.remove();
  el = document.createElement("div");
  el.id = "area-sheet";
  el.style.cssText = "position:fixed;inset:0;z-index:65;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:16px;";
  let h = '<div style="background:#0b0b0c;border-radius:20px;padding:24px;width:min(420px,92vw);max-height:85vh;overflow-y:auto;color:#f2f2f4;">';
  h += '<div style="font-size:20px;font-weight:800;text-align:center;margin-bottom:6px;">📍 Where do you want to live?</div>';
  h += '<div style="font-size:12px;color:#9b9ba4;text-align:center;margin-bottom:16px;">Pick your area. You can move later.</div>';
  const origin = game.state.origin || "talaka";
  const tiers = [
    { id: "cheap",  label: "🏠 Budget Areas",   color: "#4ade80" },
    { id: "middle", label: "🏡 Mid-Tier Areas",  color: "#f2b134" },
    { id: "rich",   label: "🏛️ GRA / Upscale",  color: "#60a5fa" },
  ];
  for (const t of tiers) {
    const areaList = AREAS.filter(a => a.tier === t.id);
    if (!areaList.length) continue;
    h += '<div style="font-size:13px;font-weight:700;color:' + t.color + ';margin:12px 0 6px;">' + t.label + '</div>';
    for (const a of areaList) {
      const canPick = canPickArea(origin, a);
      h += '<div onclick="' + (canPick ? "window._pickArea('" + a.id + "')" : "") + '" style="background:#17181b;border:2px solid ' + (canPick ? t.color : "#333") + ';border-radius:14px;padding:14px;margin-bottom:8px;cursor:' + (canPick ? "pointer" : "not-allowed") + ';opacity:' + (canPick ? "1" : "0.5") + ';">';
      h += '<div style="font-size:15px;font-weight:700;color:' + (canPick ? t.color : "#666") + ';">' + a.name + '</div>';
      h += '<div style="font-size:11px;color:#9b9ba4;line-height:1.4;margin-top:4px;">' + a.desc + '</div>';
      h += '<div style="font-size:10px;margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;">';
      h += '<span style="background:#26272b;padding:3px 8px;border-radius:6px;">💰 Rent ₦' + a.rentPrice.toLocaleString() + '/wk</span>';
      h += '<span style="background:#26272b;padding:3px 8px;border-radius:6px;">🏠 Buy ₦' + a.buyPrice.toLocaleString() + '</span>';
      h += '</div>';
      if (!canPick) h += '<div style="font-size:10px;color:#e11d48;margin-top:4px;">🔒 Dan Talaka no fit start here</div>';
      h += '</div>';
    }
  }
  h += '</div>';
  el.innerHTML = h;
  document.body.appendChild(el);
}
window._pickArea = async (areaId) => {
  const uid = getMyUid();
  if (!uid) { toast("Sign in first"); return; }
  const area = getArea(areaId);
  if (!area) return;
  if (!canPickArea(game.state.origin, area)) { toast("🔒 Your origin no fit start for this area"); return; }
  toast("🏠 Claiming your plot in " + area.name + "...");
  const name = (typeof getMyName === "function" ? getMyName() : "Player");
  const r = await claimPlot(areaId, uid, name, game.state.origin);
  if (r.ok) {
    game.state.homeArea = areaId; game.state.homePlot = r.plotNo;
    _registerHouse(areaId, r.plotNo, false, r.tier);
    if (r.tier) game.state.homeTier = r.tier;
    game.save?.();
    _syncHomeEntrance();
    toast("🎉 Plot " + r.plotNo + " in " + area.name + " is yours!");
    celebrate("🏠 " + area.name, "Plot " + r.plotNo);
    document.getElementById("area-sheet")?.remove();
    const pos = getPlotPosition(area, r.plotNo);
    player.pos.set(pos.x, 0, pos.z + 4); player.heading = Math.PI;
  } else { toast("❌ " + r.reason); }
};
window._moveToArea = async (areaId) => {
  const area = getArea(areaId);
  if (!area) return;
  if (game.state.homeArea === areaId) { toast("You already live here"); return; }
  const uid = getMyUid(); if (!uid) return;
  if (game.state.money < area.buyPrice) { toast("Need ₦" + area.buyPrice.toLocaleString()); return; }
  try {
    const { ref, get, set } = await import("firebase/database");
    const fSnap = await get(ref(db, "players/" + uid + "/homeFurniture"));
    const oldF = fSnap.val() || [];
    if (oldF.length > 0) {
      const sSnap = await get(ref(db, "players/" + uid + "/storage"));
      const storage = sSnap.val() || [];
      for (const f of oldF) storage.push({ id: f.id, color: f.color });
      await set(ref(db, "players/" + uid + "/storage"), storage);
      await set(ref(db, "players/" + uid + "/homeFurniture"), []);
    }
  } catch (e) {}
  const name = (typeof getMyName === "function" ? getMyName() : "Player");
  const r = await claimPlot(areaId, uid, name, game.state.origin);
  if (!r.ok) { toast("❌ " + r.reason); return; }
  game.state.money -= area.buyPrice;
  game.state.homeArea = areaId; game.state.homePlot = r.plotNo;
  _registerHouse(areaId, r.plotNo, true, r.tier);
  if (r.tier) game.state.homeTier = r.tier;
  game.state.lastRentPaid = Date.now(); game.save?.();
  _syncHomeEntrance();
  await update(ref(db, "economy/" + uid), { balance: game.state.money });
  await update(ref(db, "players/" + uid), { homeArea: areaId, homePlot: r.plotNo, homeTier: game.state.homeTier, lastRentPaid: game.state.lastRentPaid });
  toast("📦 Moved to " + area.name + "! Furniture in storage.");
  celebrate("🏠 " + area.name, "Plot " + r.plotNo);
  const pos = getPlotPosition(area, r.plotNo);
  player.pos.set(pos.x, 0, pos.z + 4); player.heading = Math.PI;
  updateHUD(); showPhoneApp("realestate");
};
// FEATURE 5: Toggle the player's house locked state.
window._toggleHouseLock = async (lock) => {
  const uid = getMyUid();
  if (!uid) { toast("Sign in first"); return; }
  if (!game.state.homeArea || game.state.homePlot == null) { toast("Pick an area first"); return; }
  try {
    await setHouseLocked(game.state.homeArea, game.state.homePlot, lock);
    toast(lock ? "🔒 House locked — visitors must knock" : "🔓 House unlocked — visitors can enter directly");
    showPhoneApp("realestate");
  } catch (e) {
    console.warn("[lock] toggle failed:", e.message);
    toast("Could not toggle lock — try again");
  }
};
// FEATURE 4: Surface the area picker from the Real Estate app.
window._showAreaPicker = () => {
  if (game.state.homeArea) {
    if (!confirm("You already live in " + (getArea(game.state.homeArea)?.name || "your area") + ". Open the area picker to MOVE?")) return;
  }
  _showAreaScreen();
};
// FEATURE: Buy a vehicle (deducts money, writes to Firebase)
window._buyVehicle = async (vehicleId) => {
  const ok = await buyVehicle(vehicleId, game.state, toast);
  if (ok) { updateHUD(); showPhoneApp("cars"); }
};
// FEATURE: Ride a vehicle (spawn mesh + boost speed)
window._rideVehicle = async (vehicleId) => {
  if (isRiding()) { toast("Already riding — dismount first"); return; }
  if (!ownsVehicle(vehicleId)) { toast("You don't own this vehicle"); return; }
  const ok = await spawnRideVehicle(vehicleId, player.pos, player.heading, toast);
  if (ok) {
    closePhone();
    const v = getVehicle(vehicleId);
    toast("🚗 Riding " + (v?.name || vehicleId) + "! Speed boosted.");
    try { sfx.engine(true, 0.4); } catch (e) {}
    setMyRiding(vehicleId);  // SYNC: tell other players I'm on this vehicle
  } else { toast("Could not spawn vehicle — try again"); }
};
// FEATURE: Dismount vehicle (despawn mesh + remove speed boost)
window._dismountVehicle = () => {
  despawnRideVehicle();
  toast("🚶 Dismounted. Walking now.");
  try { sfx.engine(false); } catch (e) {}
  setMyRiding(null);  // SYNC: tell other players I'm on foot again
  // Drop any passengers — they get off when the driver dismounts
  setMyPassengerOf(null);
  // Force-dismount any passenger that was on my ride
  _kickAllPassengers();
  showPhoneApp("cars");
};
// FEATURE: Tunes — play/stop radio station (toast only, no actual audio streaming yet)
window._playTune = (stationId) => {
  if (window._tuneStation === stationId) { window._tuneStation = null; toast("🔇 Tunes stopped"); }
  else { window._tuneStation = stationId; const names = { afrobeat: "Afrobeat FM", hausa: "Hausa Traditional", hiphop: "Kaduna Hip-Hop", gospel: "Gospel FM", oldies: "Old School Naija" }; toast("🎵 Now playing: " + (names[stationId] || stationId)); }
  showPhoneApp("tunes");
};
// FEATURE: Gallery — take a screenshot of the current canvas
window._takeScreenshot = () => {
  try {
    const canvas = document.getElementById("game");
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    let shots = JSON.parse(localStorage.getItem("kaduna-screenshots") || "[]");
    shots.unshift(dataUrl);
    if (shots.length > 12) shots = shots.slice(0, 12);
    localStorage.setItem("kaduna-screenshots", JSON.stringify(shots));
    toast("📸 Screenshot saved to Gallery!");
    showPhoneApp("gallery");
  } catch (e) { toast("Could not take screenshot — " + e.message); }
};
window._deleteScreenshot = (idx) => {
  try {
    let shots = JSON.parse(localStorage.getItem("kaduna-screenshots") || "[]");
    shots.splice(idx, 1);
    localStorage.setItem("kaduna-screenshots", JSON.stringify(shots));
    showPhoneApp("gallery");
  } catch (e) {}
};
// FEATURE: Invest — money is locked until it matures in REAL time (1 game-day = 1 real day, same as the clock).
// Pending investments are saved with the account, so closing the game or refreshing never loses them.
const DAY_MS = 24 * 60 * 60 * 1000;
function _settleInvestments() {
  const list = game.state.investments || []; if (!list.length) return;
  const now = Date.now(), keep = []; let changed = false;
  for (const iv of list) {
    if (iv.dueAt > now) { keep.push(iv); continue; }
    changed = true; game.state.money += iv.ret;
    const profit = iv.ret - iv.amt;
    toast(profit >= 0 ? "📈 Investment matured! +₦" + profit.toLocaleString() + " profit" : "📉 Investment lost ₦" + (-profit).toLocaleString());
  }
  if (!changed) return;
  game.state.investments = keep; game.save?.(); updateHUD();
  const uid = getMyUid(); if (uid) update(ref(db, "economy/" + uid), { balance: game.state.money });
}
window._invest = (id, min, rate, days) => {
  if (game.state.money < min) { toast("Need ₦" + min.toLocaleString()); return; }
  const isCrypto = id === "crypto";
  if (isCrypto && !confirm("⚠️ HIGH RISK! 60% chance you lose half of your money. Continue?")) return;
  if (!isCrypto && !confirm("Invest ₦" + min.toLocaleString() + "? Your money comes back with profit after " + days + " real day(s).")) return;
  game.state.money -= min;
  const win = isCrypto ? Math.random() > 0.6 : true;
  const ret = win ? Math.floor(min * rate) : Math.floor(min * 0.5);
  game.state.investments = (game.state.investments || []).concat([{ id, amt: min, ret, dueAt: Date.now() + days * DAY_MS }]);
  game.save?.(); updateHUD();
  const uid = getMyUid(); if (uid) update(ref(db, "economy/" + uid), { balance: game.state.money });
  toast("💰 Invested ₦" + min.toLocaleString() + ". Ready in " + days + " day(s).");
  showPhoneApp("invest");
};
// FEATURE: Activity interactions at fun places
// Each fun place type has an activity that boosts a need + costs money (or is free)
const FUN_ACTIVITIES = {
  pitch:      { label: "Play Football",    icon: "⚽", need: "fun",     amount: 25, cost: 100,  energyCost: 10 },
  park:       { label: "Relax in Park",   icon: "🌳", need: "energy",  amount: 20, cost: 0,    energyCost: 0 },
  playground: { label: "Play at Playground", icon: "🛝", need: "fun",  amount: 20, cost: 0,    energyCost: 5 },
  suya:       { label: "Buy Suya",         icon: "🍢", need: "hunger",  amount: 30, cost: 500,  energyCost: 0 },
  bazaar:     { label: "Shop at Bazaar",  icon: "🛍️", need: "fun",    amount: 15, cost: 1000, energyCost: 5 },
  petrol:     { label: "Buy Fuel",        icon: "⛽", need: "energy",  amount: 15, cost: 200,  energyCost: 0 },
  hotel:      { label: "Rest at Hotel",   icon: "🏨", need: "energy",  amount: 40, cost: 2000, energyCost: 0 },
  shops:      { label: "Browse Shops",    icon: "🏪", need: "fun",     amount: 10, cost: 0,    energyCost: 2 },
  borehole:   { label: "Drink Water",     icon: "💧", need: "hunger",  amount: 10, cost: 0,    energyCost: 0 },
  bukka:      { label: "Eat at Bukka",    icon: "🍲", need: "hunger",  amount: 35, cost: 800,  energyCost: 0 },
  pool:       { label: "Swim at Pool",    icon: "🏊", need: "fun",     amount: 30, cost: 1000, energyCost: 10 },
  tennis:     { label: "Play Tennis",      icon: "🎾", need: "fun",     amount: 25, cost: 500,  energyCost: 8 },
};
let _funActivityPromptEl = null;
let _nearestFunPlace = null;
function _checkFunPlaceProximity() {
  const px = player.pos.x, pz = player.pos.z;
  let nearest = null, nearestDist = 999;
  for (const area of AREAS) {
    const layout = districtLayout(area);
    if (!layout || !layout.fun) continue;
    for (const f of layout.fun) {
      const dx = f.x - px, dz = f.z - pz;
      const d2 = dx * dx + dz * dz;
      const range = Math.max(f.w, f.d) / 2 + 4;
      if (d2 < range * range && d2 < nearestDist) {
        nearest = { ...f, areaId: area.id, areaName: area.name, dist: Math.sqrt(d2) };
        nearestDist = d2;
      }
    }
  }
  _nearestFunPlace = nearest;
  if (!nearest) { if (_funActivityPromptEl) _funActivityPromptEl.style.display = "none"; return; }
  const act = FUN_ACTIVITIES[nearest.kind];
  if (!act) return;
  if (!_funActivityPromptEl) {
    _funActivityPromptEl = document.createElement("div");
    _funActivityPromptEl.id = "fun-activity-prompt";
    _funActivityPromptEl.style.cssText = "position:fixed;left:50%;bottom:calc(45% + env(safe-area-inset-bottom));transform:translateX(-50%);background:rgba(15,77,58,.92);color:#fff;padding:10px 18px;border-radius:14px;font:600 13px Poppins,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.3);display:none;z-index:30;border:1px solid rgba(255,255,255,.2);text-align:center;max-width:90vw;cursor:pointer;";
    document.body.appendChild(_funActivityPromptEl);
    _funActivityPromptEl.addEventListener("click", _onFunActivityTap);
  }
  const costStr = act.cost > 0 ? "₦" + act.cost : "Free";
  _funActivityPromptEl.innerHTML = act.icon + " <b>" + nearest.name + "</b><br><span style='color:#4ade80;font-weight:600;'>" + act.label + " (" + costStr + " · " + act.need + " +" + act.amount + ")</span>";
  _funActivityPromptEl.style.display = "block";
}
function _onFunActivityTap() {
  if (!_nearestFunPlace) return;
  const act = FUN_ACTIVITIES[_nearestFunPlace.kind];
  if (!act) return;
  window._funCool = window._funCool || {};
  const _left = (window._funCool[_nearestFunPlace.kind] || 0) - Date.now();
  if (_left > 0) { toast("⏳ Wait " + Math.ceil(_left / 1000) + "s before doing this again"); return; }
  if (isBusy()) return;
  if (act.cost > 0 && game.state.money < act.cost) { toast("Need ₦" + act.cost.toLocaleString()); return; }
  const place = _nearestFunPlace;
  const finish = (ok) => {
    if (!ok) { toast("You stopped — nothing was charged"); return; }
    window._funCool[place.kind] = Date.now() + 60000;
    if (act.cost > 0) game.state.money -= act.cost;
    if (act.energyCost > 0) game.state.needs.energy = Math.max(0, (game.state.needs.energy || 0) - act.energyCost);
    game.state.needs[act.need] = Math.min(100, (game.state.needs[act.need] || 0) + act.amount);
    game.save?.(); updateHUD();
    const uid = getMyUid();
    if (uid && act.cost > 0) update(ref(db, "economy/" + uid), { balance: game.state.money });
    toast(act.icon + " " + act.label + "! " + act.need + " +" + act.amount + (act.cost > 0 ? " (−₦" + act.cost.toLocaleString() + ")" : " (free)"));
  };
  if (!rig) { finish(true); return; }
  startActivity(funSpec(place, act, player, finish), player, rig);
}
// FEATURE: Emotes — REAL character animations via bone manipulation
window._emote = (type, duration = 3) => {
  if (!rig || !rig.animate || !rig.animate.emote) { toast("Character not loaded yet"); return; }
  if (isBusy()) cancelActivity();
  if (type === "sit") { startActivity(sitSpec(player, null, 25), player, rig); toast("🪑 You sat down on a stool (move to stand up)"); return; }
  rig.animate.emote(type, duration);
  const labels = { wave: "waved", dance: "is dancing", sit: "sat down", clap: "is clapping", jump: "jumped", squat: "squatted", point: "is pointing", laugh: "is laughing", pray: "is praying" };
  const icons = { wave: "👋", dance: "💃", sit: "🪑", clap: "👏", jump: "🦘", squat: "🏋️", point: "👆", laugh: "😂", pray: "🙏" };
  toast(icons[type] + " " + (getMyName() || "You") + " " + (labels[type] || type) + "!");
  // Send position update so other players see the emote state
  sendPosition(player.pos.x, player.pos.z, player.heading);
};
// ---- Money Hunt HUD update (called by moneyhunt.js after a successful claim) ----
function _updateHuntHud() {
  const stats = getHuntStats();
  const gemCard = $("qc-gems");
  if (gemCard) {
    const title = gemCard.querySelector(".qc-title");
    const desc = gemCard.querySelector(".qc-progress");
    if (title) title.textContent = "💎 Money Hunt";
    if (desc) {
      const todayCount = stats.dayClaimCount || 0;
      const total = stats.totalClaims || 0;
      desc.textContent = `${todayCount}/${stats.dayCap} today · ${total} total found`;
    }
  }
}
window._triggerMoneyRain = triggerMoneyRain;
window._claimSpot = (id) => {
  const spot = SPOTS.find((s) => s.id === id);
  if (spot) claimSpot(spot);
};
// ---- Phase 3-9 window functions ----
window._joinCareer = async (id) => { const r = await joinCareer(id); toast(r.msg || r.reason); showPhoneApp("careers"); };
window._promoteCareer = async () => { const r = await promote(); toast(r.msg || r.reason); if (r.ok) celebrate("🎉 Promotion!", r.msg); showPhoneApp("careers"); };
window._doShift = async (toneId) => { const r = await doShift(toneId, game.state); toast(r.msg); updateHUD(); if (r.ok) { missionState.jobsToday = (missionState.jobsToday || 0) + 1; missionState.earnedToday = (missionState.earnedToday || 0) + r.pay; } showPhoneApp("careers"); };
window._trainSkill = async (skillId) => { const r = await trainSkill(skillId, game.state); toast(r.msg); updateHUD(); showPhoneApp("skills"); };
window._buyPerk = async (perkId) => { const r = await buyPerk(perkId); toast(r.msg); showPhoneApp("wishes"); };
window._registerCandidate = async () => {
  const slogan = document.getElementById("el-slogan")?.value;
  const policy = document.querySelector('input[name="el-policy"]:checked')?.value;
  const r = await registerCandidate(slogan, policy, game.state);
  toast(r.msg); updateHUD(); showPhoneApp("election");
};
window._vote = async (candidateUid) => { const r = await vote(candidateUid); toast(r.msg); showPhoneApp("election"); };
window._addFriend = async () => {
  const username = document.getElementById("fr-username")?.value;
  if (!username || !username.trim()) { toast("Enter a username"); return; }
  const r = await addFriendByUsername(username.trim());
  toast(r.msg); showPhoneApp("friends");
};
window._dmFriend = async (fUid, name) => {
  // FIX: Open the Messages app DM with this friend (was opening the old "chat" app)
  const r = await openDM(fUid, name);
  if (r) {
    window._openChatId = r.chatId;
    window._openChatName = name;
    window._openChatOtherUid = fUid;
    openPhone();
    setTimeout(() => showPhoneApp("messages"), 100);
  } else {
    toast("💬 Could not open chat with " + name);
  }
};
window._visitFriend = (username) => {
  if (!username) { toast("Friend has no username"); return; }
  const link = generateVisitLink(username);
  toast("🔗 Visit link copied: " + link.slice(0, 40) + "...");
  // In full version: travel to friend's home. For now, go to your own home.
  const homeDef = getPlace("home");
  if (homeDef) { player.pos.set(homeDef.entranceX, 0, homeDef.entranceZ); player.heading = homeDef.entranceFacing; toast("🏠 Traveling to " + username + "'s home..."); }
};
// ---- Check rent every 60 seconds ----
let _rentCheckT = 0;
function _tickRent(dt) {
  _rentCheckT += dt;
  if (_rentCheckT > 60) {
    _rentCheckT = 0;
    checkRentDue(game.state, toast);
    _settleInvestments();
  }
}
// ---- Place furniture from storage into home ----
window._placeInRoom = async (storageIdx) => {
  const storage = window._storageCache || [];
  const item = storage[storageIdx];
  if (!item) return;
  const it = getItem(item.id);
  if (!it) return;
  closePhone();
  const active = getActivePlace();
  if (!active || active.id !== "home") {
    // Auto-enter the home: teleport to entrance, then enter the place
    const homeDef = getPlace("home");
    if (homeDef) {
      player.pos.set(homeDef.entranceX, 0, homeDef.entranceZ);
      player.heading = homeDef.entranceFacing;
      toast("🏠 Entering your home to place " + it.name + "...");
      // Wait for the place to load, then place the furniture
      try { await enterPlace("home", { pos: player.pos, heading: player.heading }); } catch (e) { console.warn("auto-enter failed", e); toast("Could not enter home. Walk to your house and tap to enter."); return; }
    } else { toast("No home found."); return; }
  }
  // Now inside the home — send the place event
  sendUIEvent("place_furniture", { id: item.id, color: item.color || it.colors[0], x: 0, z: 0, rot: 0 });
  // Remove from storage
  storage.splice(storageIdx, 1);
  window._storageCache = storage;
  const uid = getMyUid();
  if (uid) {
    import("firebase/database").then(({ ref, set }) => {
      set(ref(db, "players/"+uid+"/storage"), storage);
    });
  }
  toast("📍 " + it.name + " ready to place! Tap in the room to position it, then tap ✓ Confirm.");
};
window.logout=async()=>{ if(confirm("Log out of Kaduna Lifestyle?")){ await logout(); } };
window.resetGame=()=>{
  if(!confirm("Reset all progress? You'll lose your money, needs, and rank."))return;
  localStorage.removeItem("kaduna-state"); localStorage.removeItem("kaduna-pos");
  location.reload();
};
// ---- small inline dropdown for the Ride app ----
window._rdToggle=()=>{
  const list=document.getElementById("rd-list"), arrow=document.getElementById("rd-arrow"); if(!list) return;
  const open=list.style.display==="none";
  if(open){
    let h="";
    for(const g of (window._rdGroups||[])){
      h+='<div style="font:700 10px Poppins,sans-serif;color:#9b9ba4;padding:5px 10px 2px;background:#22242a;position:sticky;top:0;">'+g.t+'</div>';
      for(const it of g.items){
        const sel=it.id===window._rideDest;
        h+='<div '+(it.off?'':'onclick="window._rdPick(\''+it.id+'\')"')+' style="padding:6px 10px;font-size:12px;'+(it.off?'color:#666;':'cursor:pointer;color:#f2f2f4;')+(sel?'background:#1f3a2c;font-weight:700;':'')+'">'+it.label+(it.off?' (closed)':'')+'</div>';
      }
    }
    list.innerHTML=h;
  }
  list.style.display=open?"block":"none"; if(arrow) arrow.textContent=open?"▲":"▼";
};
window._rdPick=(id)=>{
  window._rideDest=id;
  const it=(window._rdGroups||[]).flatMap(g=>g.items).find(i=>i.id===id);
  const l=document.getElementById("rd-label"); if(l&&it) l.textContent=it.label;
  const list=document.getElementById("rd-list"); if(list) list.style.display="none";
  const arrow=document.getElementById("rd-arrow"); if(arrow) arrow.textContent="▼";
};
// MAP MARK (Oct 19): clear the marked destination if user doesn't want it
window._clearMarkedDest = () => {
  window._markedDest = null;
  window._rideDest = "";
  showPhoneApp("ride");
};
window.bookRide=(rideId)=>{
  const destId=window._rideDest||"";
  if(!destId){toast("Pick a destination first");return;}
  const fareMap={walk:0,keke:300,bus:200,okada:500,taxi:1500};
  const fare=fareMap[rideId] ?? 0;
  if(game.state.money<fare){toast("Not enough money");return;}
  game.state.money-=fare;
  closePhone();
  // MAP MARK (Oct 19): user tapped on the minimap → ride to that custom coord.
  if (destId === "mark:custom" && window._markedDest) {
    const md = window._markedDest;
    player.pos.set(md.x, 0, md.z);
    player.heading = 0;
    toast("📍 " + (rideId === "walk" ? "Walked" : "Rode to") + " map mark (" + md.x.toFixed(0) + ", " + md.z.toFixed(0) + ")");
    updateHUD();
    window._markedDest = null;  // clear after use
    return;
  }
  // FEATURE: handle new destination types — area:xxx and house:areaId:plotNo
  if (destId.startsWith("area:")) {
    const areaId = destId.slice(5);
    const area = getArea(areaId);
    if (area) {
      player.pos.set(area.x, 0, area.z);
      player.heading = 0;
      toast("📍 " + (rideId === "walk" ? "Walked" : "Rode to") + " " + area.name);
      updateHUD();
      const titleEl=document.querySelector(".chip.title");
      if(titleEl) titleEl.firstChild.textContent = "📍 " + area.name;
      return;
    }
  }
  if (destId.startsWith("house:")) {
    const parts = destId.split(":");
    const areaId = parts[1], plotNo = parseInt(parts[2], 10);
    const area = getArea(areaId);
    if (area) {
      const pos = getPlotPosition(area, plotNo);
      player.pos.set(pos.x, 0, pos.z + 4);
      player.heading = Math.PI;
      toast("🏠 " + (rideId === "walk" ? "Walked" : "Rode to") + " " + area.name + " · Plot #" + plotNo);
      updateHUD();
      _syncHomeEntrance();
      const titleEl=document.querySelector(".chip.title");
      if(titleEl) titleEl.firstChild.textContent = "📍 " + area.name;
      return;
    }
  }
  // Standard place / zone destination (existing flow)
  startRide(rideId,destId,game.state.money,()=>{},(result)=>{
    if(result.ok){
      toast("Welcome to "+result.dest.name+"!");
      updateHUD();
      if(result.dest.isPlace && result.dest.entrance){
        player.pos.set(result.dest.entrance.x, 0, result.dest.entrance.z);
        player.heading = Math.PI;
        travelToPlace(getMyUid(), result.dest.id);
      } else {
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
    if(n==="chat"){closePhone();$("profile-sheet")?.classList.remove("show");toggleWorldChat();btn.classList.remove("active");document.querySelector('#bottom-nav .nav-btn[data-nav="home"]')?.classList.add("active");}
    else if(n==="phone")openPhone();
    else if(n==="map"){closePhone();$("profile-sheet")?.classList.remove("show");const _ap=getActivePlace();if(_ap){const _d=getPlace(_ap.id);_mapMe=_d?{x:_d.entranceX,z:_d.entranceZ}:null;if(_mapMe)peekWorld(true);}else _mapMe=null;openLiveMap();}
    else if(n==="home"){
      closePhone();$("profile-sheet")?.classList.remove("show");
      // Travel to the player's home entrance (dynamic coordinates)
      const homeDef = getPlace("home");
      if (homeDef) {
        player.pos.set(homeDef.entranceX, 0, homeDef.entranceZ);
        player.heading = homeDef.entranceFacing;
        toast("🏠 Walking to your home in " + (getArea(game.state.homeArea)?.name || "Kaduna") + "...");
      }
    }
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
    el.innerHTML='<div style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--green);">Needs</div>'+NEEDS.map(n=>{const v=Math.round(s.needs[n.key]||0);const c=v<20?"#e11d48":v<40?"#f2b134":"#2e7d4f";return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><span style="font-size:14px;">'+n.icon+'</span><div style="flex:1;height:8px;background:#e0ddd5;border-radius:4px;overflow:hidden;"><div style="height:100%;width:'+v+'%;background:'+c+';"></div></div><span style="font-size:11px;color:#666;width:30px;text-align:right;">'+v+'%</span></div>';}).join("")+'<div style="font-size:13px;font-weight:700;margin:14px 0 8px;color:var(--green);">Feelings</div><div style="font-size:11px;color:#666;margin-bottom:8px;">Mood: <b style="color:'+(mood>20?"#2e7d4f":mood>0?"#f2b134":"#e11d48")+';">'+(mood>20?"Happy":mood>0?"Fine":mood>-20?"Stressed":"Suffering")+'</b> ('+mood+')</div>'+feelings.map(f=>'<div class="feeling-card"><span>'+f.i+' '+f.n+'</span><span class="fc-val" style="color:'+(f.v>0?"#2e7d4f":"#e11d48")+';">'+(f.v>0?"+":"")+f.v+'</span></div>').join("")+'<div style="display:flex;gap:6px;margin-top:10px;"><button onclick="window._doNeed(\'toilet\')" style="flex:1;background:#2e86ab;color:#fff;border:none;border-radius:10px;padding:10px 4px;font-size:12px;font-weight:700;cursor:pointer;">🚻 Toilet</button><button onclick="window._doNeed(\'shower\')" style="flex:1;background:#3c8dbc;color:#fff;border:none;border-radius:10px;padding:10px 4px;font-size:12px;font-weight:700;cursor:pointer;">🚿 Shower</button><button onclick="window._doNeed(\'sleep\')" style="flex:1;background:#6b4a8a;color:#fff;border:none;border-radius:10px;padding:10px 4px;font-size:12px;font-weight:700;cursor:pointer;">😴 Sleep</button></div>'+'<button onclick="window.closeSheet()" style="width:100%;background:rgba(0,0,0,.05);color:#666;border:none;border-radius:10px;padding:12px;cursor:pointer;font-size:13px;font-weight:600;margin-top:10px;">Close</button>';
  } else if(tab==="goals"){
    el.innerHTML='<div style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--green);">Daily Goals</div><div class="feeling-card"><span>🍛 Eat something</span><span style="color:#2e7d4f;">+₦300</span></div><div class="feeling-card"><span>💼 Complete a job</span><span style="color:#2e7d4f;">+₦500</span></div><div class="feeling-card"><span>💬 Send a chat</span><span style="color:#2e7d4f;">+₦200</span></div><div class="feeling-card"><span>🛺 Travel to a place</span><span style="color:#2e7d4f;">+₦400</span></div><div class="feeling-card"><span>👕 Change your clothes</span><span style="color:#2e7d4f;">+₦100</span></div><div style="font-size:13px;font-weight:700;margin:14px 0 8px;color:var(--green);">Weekly Goals</div><div class="feeling-card"><span>🏆 Reach Hustler rank (₦10k)</span><span style="color:#999;">In progress</span></div><div class="feeling-card"><span>🏠 Rent a home</span><span style="color:#999;">Coming soon</span></div><div class="feeling-card"><span>👥 Make 5 friends</span><span style="color:#999;">0/5</span></div><button onclick="window.closeSheet()" style="width:100%;background:rgba(0,0,0,.05);color:#666;border:none;border-radius:10px;padding:12px;cursor:pointer;font-size:13px;font-weight:600;margin-top:10px;">Close</button>';
  }
}
window._doNeed = (kind) => {
  window.closeSheet?.(); closePhone?.();
  if (!rig) return;
  if (isBusy()) { toast("Finish what you dey do first"); return; }
  const ap = getActivePlace();
  if (ap && ap.id === "home") { window.placeAction(kind); return; }
  if (kind === "toilet") {
    const fee = ap ? 0 : 50;
    if (game.state.money < fee) { toast("Need ₦" + fee + " for the public toilet"); return; }
    const spec = toiletSpec(player, (ok) => {
      if (!ok) return;
      game.state.money -= fee; game.state.needs.bladder = Math.min(100, (game.state.needs.bladder || 0) + 60);
      game.save?.(); updateHUD(); toast("🚽 Bladder relieved" + (fee ? " (−₦" + fee + ")" : ""));
    }, 5);
    startActivity(spec, player, rig); return;
  }
  toast(kind === "shower" ? "🚿 Go home to take a shower (or use a place's shower)" : "😴 Go home to sleep in your bed (or rest at the hostel/hospital)");
};
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
  // Wire celebration overlay for chapter rewards.
  setCelebrateCallback(celebrate);
  // ---- Init Money Hunt (instanced meshes + Firebase spot listeners) ----
  initMoneyHunt({
    scene,
    player: player.pos,   // Vector3 — moneyhunt reads .x / .z live
    uid: user.uid,
    toast,
    updateHud: _updateHuntHud,
    celebrate,
  });
  // Initial HUD refresh so the gem card shows real hunt stats right away.
  _updateHuntHud();
  // ---- Init Phase 2-9 systems ----
  initEvents();
  initCareers(user.uid, () => {});
  initWishes(user.uid, () => {});
  initElection(user.uid, () => {});
  initSocial(user.uid, () => {});
  // FEATURE: init the vehicles system (subscribes to owned vehicles from Firebase)
  initVehicles(scene, user.uid, () => {});
  // KADUNA MOTORS (Oct 20): extend VEHICLE_CATALOG with dealership-only luxury
  // cars (Lexus RX, Tesla, G-Wagon, Range Rover, etc). This MUST run after
  // initVehicles so the existing catalog is in place. Idempotent (uses a Set
  // internally) so safe to call multiple times. buyVehicle / spawnRideVehicle
  // will then find these cars by id when the player taps Buy in the showroom.
  try {
    extendCatalog(VEHICLE_CATALOG, getVehicle);
    console.log("[dealership] catalog extended with luxury cars");
  } catch (e) {
    console.warn("[dealership] extendCatalog failed:", e.message);
  }
  // HOUSING UPGRADE (Oct 20): extend HOUSE_TIERS with luxury tiers
  // (Tier 7: 5-Bedroom Villa ₦150M, Tier 8: Mega-Mansion ₦500M,
  // Tier 9: Presidential Estate ₦1.5B). upgradeCost() and the realestate
  // app pick them up automatically since they use HOUSE_TIERS.find().
  try {
    extendHouseTiers(HOUSE_TIERS);
    console.log("[housing] extended with", getLuxuryTiers().length, "luxury tiers");
  } catch (e) {
    console.warn("[housing] extendHouseTiers failed:", e.message);
  }
  // PHOTO MODE (Oct 20): let players capture their house / ride / fits for
  // flexing. Activated by pressing 'P' or via the 📸 button inside homes.
  // See src/photo_mode.js for full UI.
  try {
    initPhotoMode({ canvas: document.getElementById("game") });
    window.enterPhotoMode = enterPhotoMode;
    window.exitPhotoMode = exitPhotoMode;
    window.isPhotoMode = isPhotoMode;
    console.log("[photo] photo mode ready (press P or call window.enterPhotoMode)");
  } catch (e) {
    console.warn("[photo] initPhotoMode failed:", e.message);
  }
  // CHALLENGE ANYONE / WAGER SYSTEM (Oct 20): lets a player open a wager
  // challenge that any online player can accept. Stakes go into escrow,
  // winner takes 95% of the pot. Start with Capital Dice (first to 100).
  // See src/challenge_system.js (Firebase data layer) +
  //     src/capital_dice.js (game logic) +
  //     src/challenge_ui.js (HUD button + creator + match screen).
  let _activeMatchId = null;
  try {
    initChallengeSystem({
      db, auth,
      getUserId: () => getMyUid(),
      getUserName: () => getMyName() || "Player",
      getGameState: () => game,
      toast,
    });
    initChallengeUI({
      game, toast,
      getMyUid: () => getMyUid(),
      getMyName: () => getMyName() || "Player",
    });
    // Initialise the game-specific UIs for Tennis + Penalty Shoot-out.
    // These plug into the challenge_ui.js match dispatcher — when a match
    // has game === "tennis", openTennisMatchScreen() is called instead of
    // the default Capital Dice UI.
    initTennisUI({
      game, toast,
      getMyUid: () => getMyUid(),
      getMyName: () => getMyName() || "Player",
    });
    initPenaltyUI({
      game, toast,
      getMyUid: () => getMyUid(),
      getMyName: () => getMyName() || "Player",
    });
    // SNIPER DUEL (Oct 20): turn-based sniper match — pick aim position +
    // side, opponent picks dodge + posture. Damage based on hit/miss +
    // headshot bonus. 3 maps: Kawo Maize Farm, Barnawa Rooftops, River
    // Kaduna Banks. Reuses the challenge_system flow.
    try {
      initSniperUI({
        game, toast,
        getMyUid: () => getMyUid(),
        getMyName: () => getMyName() || "Player",
      });
      console.log("[sniper] sniper UI initialised");
    } catch (e) {
      console.warn("[sniper] initSniperUI failed:", e.message);
    }
    // BOWLING (Oct 21): turn-based bowling — 10 frames, pick angle + power,
    // strike/spare scoring. Plugs into challenge_system like tennis/sniper.
    try {
      initBowlingUI({
        game, toast,
        getMyUid: () => getMyUid(),
        getMyName: () => getMyName() || "Player",
      });
      console.log("[bowling] bowling UI initialised");
    } catch (e) {
      console.warn("[bowling] initBowlingUI failed:", e.message);
    }
    // POOL (Oct 21): turn-based pool — 7 rounds, pick angle + power, pot
    // balls. Plugs into challenge_system like bowling/sniper.
    try {
      initPoolUI({
        game, toast,
        getMyUid: () => getMyUid(),
        getMyName: () => getMyName() || "Player",
      });
      console.log("[pool] pool UI initialised");
    } catch (e) {
      console.warn("[pool] initPoolUI failed:", e.message);
    }
    // SPY MISSIONS (Oct 20): Capital Heat-style story-driven missions with
    // 6 chapters, cutscenes, code-breaking minigame, star ratings, big
    // money rewards (₦500k → ₦10M per mission). Total payout: ~₦27M.
    try {
      initSpyMissions({
        db, getUserId: () => getMyUid(),
        getGameState: () => game, toast,
        onUpdate: () => {
          if (_showingApp === "spymissions") showPhoneApp("spymissions");
        },
      });
      initSpyMissionsUI({ game, toast });
      window._spyOpenMission = (id) => openSpyMission(id);
      console.log("[spy] initialised with", getSpyMissions().length, "missions");
    } catch (e) {
      console.warn("[spy] initSpyMissions failed:", e.message);
    }
    // Subscribe to MY challenges so when an opponent accepts, the match
    // screen auto-opens for me too.
    subscribeToMyChallenges((mine) => {
      for (const ch of mine) {
        if (ch.status === "accepted" && ch.matchId && !_activeMatchId) {
          // Open the match screen — this fires for both the host and the
          // accepter when the challenge transitions to "accepted".
          _activeMatchId = ch.matchId;
          openMatchForChallenge(ch);
        }
      }
    });
    console.log("[challenge] challenge system ready (🎲 button visible in HUD)");
  } catch (e) {
    console.warn("[challenge] initChallengeSystem failed:", e.message);
  }
  // FEATURE: init billboard/ad system (10 billboards in every district + 10 on the main roads)
  initBillboards(scene);
  // HOW TO PLAY (Oct 21): show guide on first login + accessible from Settings
  initHowToPlay();
  window.showHowToPlay = showHowToPlay;
  // EMOTE BROADCAST (Oct 21): lets players send emotes (wave, dance, clap,
  // etc) that all nearby players see on their remote avatar. Writes to
  // live/{uid} = { emote, emoteDur, emoteTs }. Remote avatars render the
  // emote emoji above their name tag (handled in multiplayer.js _updateEmoteSprite).
  initEmoteBroadcast({ db, getUserId: () => getMyUid() });
  window._emote = (type) => sendEmote(type);
  window._clearEmote = () => clearEmote();
  // BILLBOARD REPORT (Oct 21): lets players report inappropriate billboard
  // ads. Writes to billboardReports/{reportId} for admin review.
  window._reportBillboard = (billboardId) => {
    const reason = prompt("Why are you reporting this billboard?");
    if (!reason) return;
    reportBillboard(billboardId, getMyUid(), reason, toast);
  };
  console.log("[emote+billboard] emote broadcast + billboard report initialised");
  // ---- Init Messages app ----
  const myName = user.displayName || user.email?.split("@")[0] || "Player";
  initMessages(user.uid, myName, toast, () => { _updateUnreadBadge(); if (_showingApp === "messages" && !window._openChatId) window._msgRefreshList?.(); });
  initFlavour((headline) => { if (headline) toast("📰 " + headline.text); });
  // ---- Sync home entrance to player's plot (so Home button + entrance prompt work) ----
  _syncHomeEntrance();
  // Check for visit link (?v=username)
  checkVisitLink((username) => {
    toast("👋 Visiting " + username + "'s home...");
    // Travel to home entrance (simplified — in full version would look up their home)
    const homeDef = getPlace("home");
    if (homeDef) {
      player.pos.set(homeDef.entranceX, 0, homeDef.entranceZ);
      player.heading = homeDef.entranceFacing;
    }
  });
  setMyLook(game.state.look);
  initWorldChat(user.uid, user.displayName || user.email?.split("@")[0] || "Player");
  initMultiplayer(scene, (count) => {
    setChatOnline(count);
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
  // SYNC (Oct 19): fetch Firebase server time so all browsers in this world
  // compute the same "now". Browser clocks can drift seconds→minutes, which
  // made NPC cars appear at different x-positions in different browsers.
  // We compute the offset ONCE here: offset = serverTime - localTime. The
  // main loop then uses (Date.now() + offset) as a server-aligned clock.
  get(ref(db, ".info/serverTimeOffset")).then((snap) => {
    const off = snap.val();
    _serverTimeOffset = (typeof off === "number") ? off : 0;
  }).catch(() => { _serverTimeOffset = 0; });
  // Check daily reward on login
  checkDailyReward(user.uid).then((reward) => {
    if (reward) { game.state.money += reward.money; updateHUD(); toast(reward.label+'! Welcome back.'); }
  });
  // ---- SYNC: listen to Firebase economy/{uid}/balance so admin credits work ----
  // When admin credits/deducts money, the player's game detects it and updates.
  let _lastFirebaseBal = null;
  onValue(ref(db, "economy/" + user.uid + "/balance"), (snap) => {
    const fbBal = snap.val();
    if (fbBal == null) {
      // FEATURE: Firebase has no balance entry yet (new account or first login
      // after the rules update). Write the local balance (5000 starting money,
      // or whatever localStorage had) to Firebase so it persists across
      // devices + logout. Without this, the balance stayed local-only and
      // was lost on logout (the user's "amount doesn't stay" complaint).
      if (_lastFirebaseBal === null) {
        update(ref(db, "economy/" + user.uid), { balance: game.state.money }).catch(() => {});
      }
      return;
    }
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
  // BUGFIX: only write the NAME here, NOT the balance. Writing the balance
  // here would overwrite whatever admin had credited while the user was
  // logged out (the "admin credit/debit not updating" complaint). The
  // onValue listener above handles balance sync in both directions.
  update(ref(db, "economy/" + user.uid), { name: playerName });
  // FEATURE: arm the beforeunload + visibilitychange handlers so the
  // current balance gets pushed to Firebase when the user closes the tab,
  // refreshes, or backgrounds the app.
  _armBeforeUnload(user.uid);
  _armBalancePusher(user.uid);
  _ensureVehicleControls();
  _ensureGetoffBtn();   // (Oct 19) passenger "Get off ride" button
  // FEATURE: emote FAB — expandable button on the RIGHT side (not covering joystick)
  if (!document.getElementById("emote-fab")) {
    const fab = document.createElement("div");
    fab.id = "emote-fab";
    fab.style.cssText = "position:fixed;right:14px;bottom:calc(170px + env(safe-area-inset-bottom));z-index:28;";
    // Main toggle button (SVG icon)
    const toggle = document.createElement("button");
    toggle.style.cssText = "width:44px;height:44px;border-radius:50%;background:rgba(15,77,58,.92);color:#fff;border:1px solid rgba(255,255,255,.2);cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;padding:0;";
    toggle.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><path d="M5 8h14M9 8v6M15 8v6M9 14l-2 6M15 14l2 6"/></svg>';
    toggle.title = "Emotes";
    // Expandable panel
    const panel = document.createElement("div");
    panel.style.cssText = "position:absolute;right:0;bottom:50px;display:none;flex-direction:column;gap:5px;pointer-events:auto;";
    const emotes = [
      { svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 11V6a2 2 0 0 1 4 0v5"/><path d="M7 11v6"/><path d="M11 11V4a2 2 0 0 1 4 0v7"/><path d="M15 11v5"/><path d="M3 11h18"/><path d="M3 11a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>', label: "Wave", type: "wave", dur: 3 },
      { svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3v6"/><path d="M15 3v6"/><path d="M5 9h14l-1 11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M9 14l2 2 4-4"/></svg>', label: "Dance", type: "dance", dur: 4 },
      { svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="14" width="16" height="2"/><path d="M6 16v3a1 1 0 0 0 1 1h1M18 16v3a1 1 0 0 0-1 1h-1"/></svg>', label: "Sit", type: "sit", dur: 5 },
      { svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 8l4-4 4 4M8 16l4 4 4-4M4 12h16"/></svg>', label: "Clap", type: "clap", dur: 3 },
      { svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4v10M7 8l5-4 5 4M5 14v6h14v-6"/></svg>', label: "Jump", type: "jump", dur: 2 },
      { svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 4v10a3 3 0 0 0 6 0V4M6 4h12"/></svg>', label: "Squat", type: "squat", dur: 4 },
      { svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v8M8 6l4-4 4 4M5 14a7 7 0 0 0 14 0v8"/></svg>', label: "Point", type: "point", dur: 3 },
      { svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>', label: "Laugh", type: "laugh", dur: 3 },
    ];
    for (const e of emotes) {
      const b = document.createElement("button");
      b.style.cssText = "width:38px;height:38px;border-radius:50%;background:rgba(15,77,58,.92);color:#fff;border:1px solid rgba(255,255,255,.2);cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;padding:0;";
      b.title = e.label;
      b.innerHTML = e.svg;
      b.addEventListener("click", () => {
        window._emote(e.type, e.dur);
        panel.style.display = "none";
      });
      panel.appendChild(b);
    }
    toggle.addEventListener("click", () => {
      panel.style.display = panel.style.display === "none" ? "flex" : "none";
    });
    fab.appendChild(panel);
    fab.appendChild(toggle);
    document.body.appendChild(fab);
  }
  // FEATURE: per-plot world doors + knock/invite flow (step 2c).
  // initPlotDoors subscribes to nearby areas' house records and renders door
  // markers. listenForKnocks lets the OWNER hear knocks from visitors in
  // real-time and respond with accept/deny prompts.
  try {
    initPlotDoors(scene, user.uid, toast, (info) => _onPlotPromptUpdate(info));
    listenForKnocks(user.uid, (knocks) => _onIncomingKnocks(knocks));
  } catch (e) { console.warn("[plots] init failed", e); }
  // ---- Sync look across devices: the account's saved outfit in Firebase WINS over this device's local copy ----
  onValue(ref(db, "blocks/" + user.uid), (snap) => { setBlockedUids(Object.keys(snap.val() || {})); setChatBlocked(Object.keys(snap.val() || {})); }, () => {});
  let _lookFirst = true;
  onValue(ref(db, "players/" + user.uid + "/look"), (snap) => {
    const fb = snap.val();
    const first = _lookFirst; _lookFirst = false;
    if (first) {
      // new account (no saved character yet) -> character creator after the world has loaded
      const alreadyMade = !!((fb && fb.created) || game.state.look.created);
      const needCreate = !alreadyMade;
      if (alreadyMade && !(fb && fb.created)) {
        // made on this device before but never reached the account: save it so it never asks again
        game.state.look.created = true;
        update(ref(db, "players/" + user.uid + "/look"), game.state.look).catch(() => {});
      }
      if (needCreate) {
        if (fb) game.state.look = { ...game.state.look, ...fb };
        const t = setInterval(() => { if (!rig) return; clearInterval(t); window._openCreator(); }, 400);
      } else {
        // Character already created (e.g. after a gender-change reload). But if
        // origin hasn't been picked yet, show the origin screen now — otherwise
        // a gender-change reload would skip it entirely.
        if (fb) game.state.look = { ...game.state.look, ...fb };
        if (!game.state.origin) {
          const t = setInterval(() => { if (!rig) return; clearInterval(t); _showOriginScreen(); }, 400);
        } else if (!game.state.homeArea) {
          const t = setInterval(() => { if (!rig) return; clearInterval(t); _showAreaScreen(); }, 400);
        }
      }
    }
    if (first) setMyLook(game.state.look);   // others see the look that was on this device at page start, not the account's saved one
    if (!fb) { if (first) update(ref(db, "players/" + user.uid + "/look"), game.state.look); return; }
    if (JSON.stringify(fb) === JSON.stringify(game.state.look)) return;
    game.state.look = { ...game.state.look, ...fb };
    game.save?.();
    // The 3D body (male / female) is built once at page start. If the account's saved gender differs (new device,
    // or another account was used here before) a recolour cannot change the shape, so reload once into the right body.
    { const g = game.state.look.gender || "male";
      if (g !== _loadedGender) {
        let done = null; try { done = sessionStorage.getItem("kaduna-gender-reload"); } catch (e) {}
        if (done !== g) { try { sessionStorage.setItem("kaduna-gender-reload", g); } catch (e) {} location.reload(); return; }
      } else { try { sessionStorage.removeItem("kaduna-gender-reload"); } catch (e) {} } }
    if (rig?.recolor) rig.recolor(game.state.look);
    setMyLook(game.state.look);
  });
  // ---- Sync origin / housing / rent state from Firebase so a refresh on a new
  // device (or after clearing localStorage) still remembers the player's chosen
  // origin. Without this, the origin selector could reappear even after the
  // player already picked one.
  onValue(ref(db, "players/" + user.uid), (snap) => {
    const p = snap.val() || {};
    let changed = false;
    if (p.origin && p.origin !== game.state.origin) { game.state.origin = p.origin; changed = true; }
    if (p.homeTier != null && p.homeTier !== game.state.homeTier) { game.state.homeTier = p.homeTier; changed = true; }
    if (p.homeArea && p.homeArea !== game.state.homeArea) { game.state.homeArea = p.homeArea; changed = true; }
    if (p.homePlot != null && p.homePlot !== game.state.homePlot) { game.state.homePlot = p.homePlot; changed = true; }
    if (p.lastRentPaid != null && p.lastRentPaid !== game.state.lastRentPaid) { game.state.lastRentPaid = p.lastRentPaid; changed = true; }
    if (p.missedRent != null && p.missedRent !== game.state.missedRent) { game.state.missedRent = p.missedRent; changed = true; }
    if (p.skillBonus != null && p.skillBonus !== game.state.skillBonus) { game.state.skillBonus = p.skillBonus; changed = true; }
    if (p.weeklyDebt != null && p.weeklyDebt !== game.state.weeklyDebt) { game.state.weeklyDebt = p.weeklyDebt; changed = true; }
    if (changed) { game.save?.(); updateHUD(); _syncHomeEntrance(); }
    // Fallback: if origin is set but no homeArea, show area screen (covers the case
    // where the look listener's first block already ran before origin was synced)
    if (game.state.origin && !game.state.homeArea && !document.getElementById("area-sheet")) {
      const t = setInterval(() => { if (!rig) return; clearInterval(t); _showAreaScreen(); }, 400);
    }
  });
});

// ---- Sync the home entrance coordinates to the player's actual plot ----
// Called on login + whenever homeArea/homePlot changes. Without this, the
// "Press here 🟢 to enter" prompt shows at the wrong location and the Home
// button teleports to the wrong place.
// ---- many houses: own / rent / upgrade ----
function _houseEntry(a, p) { return (game.state.myHouses || []).find(h => h.a === a && h.p === p); }
function _registerHouse(areaId, plotNo, own, tier) {
  game.state.myHouses = game.state.myHouses || [];
  let e = _houseEntry(areaId, plotNo);
  if (!e) { e = { a: areaId, p: plotNo }; game.state.myHouses.push(e); }
  e.own = !!own; if (tier) e.t = tier;
  game.state.homeOwned = !!own;
  game.save?.();
  const uid = getMyUid();
  if (uid) update(ref(db, "houses/" + areaId + "/" + plotNo), { tenure: own ? "own" : "rent" }).catch(() => {});
}
async function _refreshHouseTier(areaId, plotNo) {
  try { const rec = await loadHouse(areaId, plotNo); const e = _houseEntry(areaId, plotNo); if (rec && e) { if (rec.tier) e.t = rec.tier; if (rec.tenure) e.own = rec.tenure === "own"; game.save?.(); } return rec; } catch (e) { return null; }
}
window._makeHome = async (a, p) => {
  const area = getArea(a); if (!area) return;
  const rec = await _refreshHouseTier(a, p); const e = _houseEntry(a, p);
  game.state.homeArea = a; game.state.homePlot = p; game.state.homeTier = (rec && rec.tier) || (e && e.t) || 1; game.state.homeOwned = !!(e && e.own);
  if (!game.state.homeOwned) game.state.lastRentPaid = Date.now();
  game.save?.(); _syncHomeEntrance();
  const uid = getMyUid(); if (uid) update(ref(db, "players/" + uid), { homeArea: a, homePlot: p, homeTier: game.state.homeTier, lastRentPaid: game.state.lastRentPaid || 0 });
  toast("🏠 " + area.name + " #" + p + " is now your home"); showPhoneApp("realestate");
};
window._upgradeHouse = async (a, p) => {
  const uid = getMyUid(); if (!uid) { toast("Sign in first"); return; }
  const rec = await _refreshHouseTier(a, p); const e = _houseEntry(a, p);
  if (!rec || rec.ownerUid !== uid) { toast("This house is not yours"); return; }
  if (!(e && e.own)) { toast("Buy the house first — you can only upgrade a house you own"); return; }
  const cur = rec.tier || 1, cost = upgradeCost(cur), next = HOUSE_TIERS.find(t => t.tier === cur + 1);
  if (!next || cost == null) { toast("Already the biggest house"); return; }
  if (game.state.money < cost) { toast("Need ₦" + cost.toLocaleString() + " to upgrade"); return; }
  if (!confirm("Upgrade to " + next.name + " for ₦" + cost.toLocaleString() + "?\n(your old house is traded in at 60% of its price)")) return;
  game.state.money -= cost; e.t = cur + 1;
  if (game.state.homeArea === a && game.state.homePlot === p) game.state.homeTier = cur + 1;
  game.save?.(); updateHUD();
  try { await update(ref(db, "houses/" + a + "/" + p), { tier: cur + 1 }); await update(ref(db, "economy/" + uid), { balance: game.state.money }); if (game.state.homeArea === a && game.state.homePlot === p) await update(ref(db, "players/" + uid), { homeTier: cur + 1 }); } catch (err) { console.warn(err); }
  celebrate(next.emoji + " " + next.name, "Upgraded! Look at your house outside."); showPhoneApp("realestate");
};
window._buyOutHouse = async (a, p) => {
  const uid = getMyUid(); if (!uid) return;
  const rec = await _refreshHouseTier(a, p); const e = _houseEntry(a, p); if (!rec || !e) return;
  const t = HOUSE_TIERS.find(x => x.tier === (rec.tier || 1)) || HOUSE_TIERS[0];
  if (game.state.money < t.buyPrice) { toast("Need ₦" + t.buyPrice.toLocaleString() + " to buy this house"); return; }
  if (!confirm("Buy this " + t.name + " for ₦" + t.buyPrice.toLocaleString() + "? No more rent after that.")) return;
  game.state.money -= t.buyPrice; e.own = true; if (game.state.homeArea === a && game.state.homePlot === p) game.state.homeOwned = true;
  game.save?.(); updateHUD();
  try { await update(ref(db, "houses/" + a + "/" + p), { tenure: "own" }); await update(ref(db, "economy/" + uid), { balance: game.state.money }); } catch (err) { console.warn(err); }
  celebrate("🔑 " + t.name, "You own it now — no more rent!"); showPhoneApp("realestate");
};
function _tierFor(areaId, fallback) { const a = getArea(areaId); return fallback || (a ? (a.tier === "rich" ? 5 : a.tier === "middle" ? 3 : 1) : 1); }
// Every house this player owns (you can own many). Saved per account; first login also scans for old ones.
function _myHomesList() {
  const out = [], seen = new Set();
  const add = (a, p) => { const k = a + "/" + p; if (seen.has(k)) return; const area = getArea(a); if (!area) return; seen.add(k); const pos = getPlotPosition(area, p); out.push({ a, p, name: area.name, x: pos.x, z: pos.z }); };
  for (const h of (game.state.myHouses || [])) add(h.a, h.p);
  if (game.state.homeArea && game.state.homePlot != null) add(game.state.homeArea, game.state.homePlot);
  window._myHomes = out;
  return out;
}
let _homesScanFor = null;
async function _scanMyHouses() {
  const uid = getMyUid(); if (!uid || _homesScanFor === uid || game.state.housesScanned === uid) return;
  _homesScanFor = uid;
  try {
    const { ref, get } = await import("firebase/database");
    const found = [];
    for (const a of AREAS) { const v = (await get(ref(db, "houses/" + a.id))).val(); if (!v) continue; for (const [p, rec] of Object.entries(v)) if (rec && rec.ownerUid === uid) found.push({ a: a.id, p: parseInt(p, 10), t: rec.tier || 1, own: rec.tenure === "own" }); }
    game.state.myHouses = found.concat((game.state.myHouses || []).filter(h => !found.some(f => f.a === h.a && f.p === h.p)));
    game.state.housesScanned = uid; game.save?.();
    _syncHomeEntrance();
  } catch (e) { _homesScanFor = null; }
}
function _syncHomeEntrance() {
  if (!game.state.homeArea || game.state.homePlot == null) return;
  const area = getArea(game.state.homeArea);
  if (!area) return;
  game.state.myHouses = game.state.myHouses || [];
  if (!game.state.myHouses.some(h => h.a === game.state.homeArea && h.p === game.state.homePlot)) { game.state.myHouses.push({ a: game.state.homeArea, p: game.state.homePlot, own: false }); game.save?.(); }
  game.state.homeOwned = !!(_houseEntry(game.state.homeArea, game.state.homePlot) || {}).own;
  const pos = getPlotPosition(area, game.state.homePlot);
  updateHomeEntrance(pos.x, pos.z + 4, Math.PI);
  window.__homeDoorHouse = { areaId: game.state.homeArea, plotNo: game.state.homePlot };
  _updateHomeMinimapMarker(pos.x, pos.z);
  _myHomesList();
  _scanMyHouses();
}

// If you own several houses, the "My Home" door follows whichever one you walk up to (checked a few times a second).
let _homeChk = 0;
function _checkOwnedHouseProximity() {
  if ((_homeChk++ % 8) !== 0) return;
  const homes = window._myHomes; if (!homes || homes.length < 2) return;
  const px = player.pos.x, pz = player.pos.z;
  for (const h of homes) {
    const dx = h.x - px, dz = (h.z + 4) - pz;
    if (dx * dx + dz * dz < 64) {
      const cur = window.__homeDoorHouse;
      if (!cur || cur.areaId !== h.a || cur.plotNo !== h.p) { updateHomeEntrance(h.x, h.z + 4, Math.PI); window.__homeDoorHouse = { areaId: h.a, plotNo: h.p }; _updateHomeMinimapMarker(h.x, h.z); }
      return;
    }
  }
}

// ---- FEATURE (step 2c): per-plot knock/enter prompt ----
// Fires when the player walks within KNOCK_RANGE of a friend's plot door.
// Shows a prompt like "🏠 @username's Home — Press here to knock" (locked)
// or "Press here to enter" (unlocked).
let _plotPromptEl = null;
let _currentPlotInfo = null;  // { areaId, plotNo, ownerUid, ownerName, locked, dist }
let _plotPromptKey = "";
function _onPlotPromptUpdate(info) {
  _currentPlotInfo = info;
  if (!info) { _plotPromptKey = ""; if (_plotPromptEl) _plotPromptEl.style.display = "none"; return; }
  // Called every frame: only touch the DOM when something actually changed (was rewriting innerHTML 60x/second)
  const key = info.areaId + "/" + info.plotNo + "/" + (info.locked ? 1 : 0) + "/" + info.ownerName;
  if (key === _plotPromptKey && _plotPromptEl && _plotPromptEl.style.display === "block") return;
  _plotPromptKey = key;
  if (!_plotPromptEl) {
    _plotPromptEl = document.createElement("div");
    _plotPromptEl.id = "plot-knock-prompt";
    _plotPromptEl.style.cssText =
      "position:fixed;left:50%;bottom:calc(38% + env(safe-area-inset-bottom));" +
      "transform:translateX(-50%);background:rgba(15,77,58,.92);color:#fff;" +
      "padding:10px 18px;border-radius:14px;font:600 13px Poppins,sans-serif;" +
      "box-shadow:0 4px 14px rgba(0,0,0,.3);display:none;z-index:30;" +
      "border:1px solid rgba(255,255,255,.2);text-align:center;max-width:90vw;cursor:pointer;";
    document.body.appendChild(_plotPromptEl);
    _plotPromptEl.addEventListener("click", () => _onPlotPromptTap());
  }
  if (info.locked) {
    _plotPromptEl.innerHTML = '🏠 <b style="color:#f2b134;">' + info.ownerName + '</b>\'s Home<br><span style="color:#4ade80;font-weight:600;">Press here to knock</span>';
  } else {
    _plotPromptEl.innerHTML = '🚪 Enter <b style="color:#f2b134;">' + info.ownerName + '</b>\'s Home &nbsp;<span style="color:#4ade80;font-weight:600;">Press here 🟢</span>';
  }
  _plotPromptEl.style.display = "block";
}
// keep the two prompts from sitting on top of each other (own-home "Enter" + a neighbour's "knock")
setInterval(() => {
  const a = document.getElementById("plot-knock-prompt"), b = document.getElementById("place-prompt");
  if (!a) return;
  const both = a.style.display === "block" && b && b.style.display !== "none" && b.offsetHeight > 0;
  a.style.bottom = both ? "calc(40% + 78px + env(safe-area-inset-bottom))" : "calc(38% + env(safe-area-inset-bottom))";
}, 250);
function _onPlotPromptTap() {
  if (!_currentPlotInfo) return;
  const info = _currentPlotInfo;
  if (info.locked) {
    // Knock flow
    const myName = getMyName() || "Visitor";
    knockOnNearest(myName).then((ok) => {
      if (!ok) return;
      // Listen for the reply
      listenForKnockReplyNow((reply) => {
        if (reply.status === "accepted") {
          toast("✅ " + reply.ownerName + " accepted! Entering...");
          // Enter as visitor using the house info from the current plot
          if (_currentPlotInfo) {
            setTimeout(async () => {
              try {
                await enterPlaceAsVisitor({
                  ownerUid: _currentPlotInfo.ownerUid,
                  ownerName: _currentPlotInfo.ownerName,
                  areaId: _currentPlotInfo.areaId,
                  plotNo: _currentPlotInfo.plotNo,
                }, { pos: player.pos, heading: player.heading });
              } catch (e) { console.error(e); toast("Visit failed: " + e.message); }
            }, 800);
          }
        } else if (reply.status === "denied") {
          toast("🚫 " + reply.ownerName + " said not now.");
        } else if (reply.status === "timeout") {
          toast("⏳ " + reply.ownerName + " didn't answer. Try again later.");
        }
      });
    });
  } else {
    // Unlocked — enter directly
    const visitInfo = getUnlockedVisitInfo();
    if (!visitInfo) { toast("Could not enter — try again"); return; }
    enterPlaceAsVisitor(visitInfo, { pos: player.pos, heading: player.heading })
      .catch(e => { console.error(e); toast("Visit failed: " + e.message); });
  }
}

// ---- FEATURE (step 2c): owner-side knock prompt ----
// Fires when a visitor knocks on OUR house. Shows a toast + Accept/Deny buttons.
let _knockPromptEl = null;
let _knockPromptT = 0;
function _onIncomingKnocks(knocks) {
  // knocks = { knockId: { visitorUid, visitorName, ts, areaId, plotNo, status } }
  // We only show the prompt for PENDING knocks we haven't seen yet.
  for (const [knockId, knock] of Object.entries(knocks)) {
    if (knock.status !== "pending") continue;
    if (window._seenKnocks && window._seenKnocks.has(knockId)) continue;
    window._seenKnocks = window._seenKnocks || new Set();
    window._seenKnocks.add(knockId);
    _showOwnerKnockPrompt(knockId, knock);
  }
}
function _showOwnerKnockPrompt(knockId, knock) {
  if (!_knockPromptEl) {
    _knockPromptEl = document.createElement("div");
    _knockPromptEl.id = "owner-knock-prompt";
    _knockPromptEl.style.cssText =
      "position:fixed;left:50%;top:calc(20% + env(safe-area-inset-top));" +
      "transform:translateX(-50%);background:rgba(15,77,58,.95);color:#fff;" +
      "padding:14px 18px;border-radius:16px;font:600 13px Poppins,sans-serif;" +
      "box-shadow:0 4px 18px rgba(0,0,0,.5);display:flex;flex-direction:column;" +
      "align-items:center;gap:10px;z-index:40;border:2px solid #f2b134;max-width:90vw;";
    document.body.appendChild(_knockPromptEl);
  }
  _knockPromptEl.innerHTML =
    '<div style="text-align:center;">🚪 <b style="color:#f2b134;">' + (knock.visitorName || "Visitor") +
    '</b> is knocking on your door</div>' +
    '<div style="display:flex;gap:8px;">' +
    '<button id="kp-accept" style="background:#4ade80;color:#000;border:none;border-radius:8px;padding:8px 18px;cursor:pointer;font:700 12px Poppins,sans-serif;">✓ Accept</button>' +
    '<button id="kp-deny" style="background:#e11d48;color:#fff;border:none;border-radius:8px;padding:8px 18px;cursor:pointer;font:700 12px Poppins,sans-serif;">✕ Deny</button>' +
    '</div>';
  _knockPromptEl.style.display = "flex";
  const acceptBtn = document.getElementById("kp-accept");
  const denyBtn = document.getElementById("kp-deny");
  acceptBtn.onclick = () => {
    respondToKnock(getMyUid(), knockId, true).then(() => {
      toast("✅ You accepted " + (knock.visitorName || "visitor"));
    });
    _knockPromptEl.style.display = "none";
  };
  denyBtn.onclick = () => {
    respondToKnock(getMyUid(), knockId, false).then(() => {
      toast("🚫 You denied " + (knock.visitorName || "visitor"));
    });
    _knockPromptEl.style.display = "none";
  };
  // Auto-hide after 30 seconds if no response
  clearTimeout(_knockPromptT);
  _knockPromptT = setTimeout(() => {
    if (_knockPromptEl) _knockPromptEl.style.display = "none";
  }, 30000);
}
function _updateHomeMinimapMarker(x, z) {
  // The minimap draws markers from MAP_LOCATIONS. We add/update a "My Home" marker.
  // This is a lightweight approach — just store it on window for the minimap to pick up.
  window._myHomePos = { x, z };
}
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
let mmT=0, hitCool=0, hudT=0, _missionCheckT=0, _stepT=0;
// ---- Automatic speed governor: if the phone is REALLY slow, lower quality step by step ----
// FIX (Oct 21): the old governor triggered at FPS < 42, which is too
// aggressive — most phones briefly dip below 42 while warming up, and the
// governor would downgrade pixelRatio from 2.0 → 0.75 (blurry) within
// minutes. User reported: "high graphics dey go blurry oo". Now:
//   - Only downgrade at FPS < 25 (REALLY bad, not just a warm-up dip)
//   - Level 4 never goes below pixelRatio 1.0 (no more 0.75 blurry)
//   - Reset _gLevel when applyQuality is called (see _setGraphicsQuality)
let _gAcc = 0, _gN = 0, _gLevel = 0, _gWarm = 0;
let _serverTimeOffset = null;
function governor(raw) {
  if (raw > 0.25) return;                 // tab was hidden / big hitch: ignore
  _gWarm += raw; if (_gWarm < 4) return;  // let loading finish first
  _gAcc += raw; _gN++;
  if (_gAcc < 2.5) return;
  const fps = _gN / _gAcc; _gAcc = 0; _gN = 0;
  if (fps >= 25 || _gLevel >= 4) return;  // FIX: was 42, now 25 — only downgrade if REALLY bad
  _gLevel++;
  const pr = renderer.getPixelRatio();
  if (_gLevel === 1) renderer.setPixelRatio(Math.max(1, pr * 0.85));
  else if (_gLevel === 2) renderer.setPixelRatio(Math.max(1, pr * 0.7));
  else if (_gLevel === 3) { renderer.shadowMap.enabled = false; sun.castShadow = false; scene.traverse((o) => { if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach((x) => { x.needsUpdate = true; }); } }); }
  else if (_gLevel === 4) { renderer.setPixelRatio(1); scene.fog.near = 30; scene.fog.far = 90; }  // FIX: was 0.75 (blurry), now 1.0 (still sharp)
  console.log("[quality] fps", fps.toFixed(0), "-> level", _gLevel);
}

let _mapMe = null;
initLiveMap({ getMe: () => _mapMe, onClose: () => { if (_mapMe) { peekWorld(false); _mapMe = null; } }, scene, camera, player, AREAS, listPlaces, getHomePos: () => window._myHomePos, getHomes: () => window._myHomes || [], limits: { x: 560, z: 400 }, extraLabels: SCENERY_LABELS.concat(districtFunLabels()),
  travelPlace: (id) => { closeLiveMap(); window.travelToPlace(id); },
  travelArea: (id) => { closeLiveMap(); window.travelToArea(id); },
  tickWorld: (x, z, r) => { tickAreaWorld(x, z, r); tickPlotDoors(x, z); tickLife(x, z, true); } });

let _lastFrameT = 0;
// Safety net: if anything throws inside a frame the game used to freeze for good (buttons work, world never moves).
// Now the loop keeps going, the scene still draws, and the error is shown in a small red tag you can screenshot.
let _errN = 0;
function frame() {
  try { _frame(); }
  catch (e) {
    _errN++;
    try { console.error("[frame error]", e); } catch (_) {}
    try {
      let b = document.getElementById("err-tag");
      if (!b) { b = document.createElement("div"); b.id = "err-tag"; b.style.cssText = "position:fixed;left:6px;right:6px;top:calc(4px + env(safe-area-inset-top));z-index:9999;background:rgba(160,20,20,.9);color:#fff;font:600 10px monospace;padding:4px 6px;border-radius:6px;pointer-events:none;word-break:break-all"; document.body.appendChild(b); }
      b.textContent = "⚠ #" + _errN + " " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : String(e)).slice(0, 260);
    } catch (_) {}
    try { renderer.render(scene, camera); } catch (_) {}
    requestAnimationFrame(frame);
  }
}
function _frame() {
  // Cap at ~60 fps: 90/120 Hz phones in Chrome otherwise do double the work for nothing.
  const _pn = performance.now();
  if (_pn - _lastFrameT < 14) { requestAnimationFrame(frame); return; }
  _lastFrameT = _pn;
  perfFrameStart();
  // Nothing runs until the player has signed in / signed up.
  if (!isAuthed && !window.__bypassAuth) { clock.getDelta(); renderer.render(scene, camera); requestAnimationFrame(frame); return; }
  const _raw = clock.getDelta(); governor(_raw);
  const dt = Math.min(_raw, 0.05);
  if (isLiveMapOn()) { liveMapFrame(dt); perfBeforeRender(); renderer.render(scene, camera); perfAfterRender(renderer, getQuality()); requestAnimationFrame(frame); return; }
  // SYNC FIX (Oct 19): use Firebase server-time-adjusted clock so all browsers
  // see the same NPC car positions. Browser clocks can drift seconds→minutes;
  // Date.now() in browser A vs browser B differs → cars at different x.
  // _serverTimeOffset is fetched once at init (offset = serverTime - localTime),
  // then `now` below uses (localTime + offset) = serverTime → identical across
  // browsers. Falls back to plain Date.now() if the offset fetch failed.
  const now = (_serverTimeOffset !== null ? (Date.now() + _serverTimeOffset) : Date.now()) / 1000;
  const _riding = isRiding();
  // FEATURE: show/hide driving buttons based on riding state
  // PASSENGER (Oct 19): if I'm a passenger, hide driving controls — the
  // driver controls the bike. Show a "Get off ride" button instead.
  if (_myPassengerUid) {
    if (_vehControlsEl) _vehControlsEl.style.display = "none";
    if (_getoffBtnEl) _getoffBtnEl.style.display = "block";
    _tickPassenger(dt);  // follow the driver's position
  } else {
    if (_getoffBtnEl) _getoffBtnEl.style.display = "none";
    if (_vehControlsEl) _vehControlsEl.style.display = _riding ? "block" : "none";
  }
  if (_riding) {
    // FEATURE: VEHICLE CONTROL — dedicated driving buttons + joystick + keyboard
    // _vehBtnSteer / _vehBtnThrottle are set by the on-screen driving buttons.
    // Joystick left/right also steers; joystick up/down also throttles.
    // Keyboard WASD/arrows also work.
    const maxVehSpd = getRideSpeed() * 3.2;   // top speed (bigger = faster cars); ACCEL ramps up to it
    let steer = (window._vehBtnSteer || 0) + (Math.abs(ctl.joyX || 0) > 0.08 ? ctl.joyX : 0);
    const _jy = Math.abs(ctl.joyY || 0) > 0.35 ? ctl.joyY : 0;   // dead-zone so steering with the stick never taps gas/brake
    let throttle = (window._vehBtnThrottle || 0) + _jy;
    const k = ctl.keys || {};
    if (k["w"] || k["arrowup"]) throttle += 1;
    if (k["s"] || k["arrowdown"]) throttle -= 1;
    if (k["a"] || k["arrowleft"]) steer -= 1;
    if (k["d"] || k["arrowright"]) steer += 1;
    // ONE driving rule for car, model and camera (drive.js): forward = (sin h, cos h), right button turns right.
    driveStep(player, { steer, throttle }, dt, maxVehSpd);
    // camera swings round behind the vehicle while it moves (like a real driving game)
    if (player.speed > 0.8) {
      let dy = (player.heading + Math.PI) - ctl.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      ctl.yaw += dy * (1 - Math.exp(-dt * 1.8));
    }
  } else {
    // NORMAL WALKING (existing camera-relative control scheme)
    const it = ctl.intent();
    const _actOn = tickActivity(dt, it.mag);        // eating / swimming / sleeping... owns the character while it runs
    if (!_actOn) {
    const maxSpd = (ctl.jog ? 4.8 : 2.1) * (game.state.needs?.energy < 20 ? 0.5 : 1.0);
    const target = it.mag * maxSpd;
    player.speed += (target - player.speed) * (1 - Math.exp(-dt * 9));
    if (it.mag > 0) {
      const want = Math.atan2(it.x, it.z);
      let d = want - player.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
      player.heading += d * (1 - Math.exp(-dt * 12));
      player.pos.x += it.x * player.speed * dt; player.pos.z += it.z * player.speed * dt;
    }
    }
  }
  const active = getActivePlace();
  // SAFETY: auto-dismount vehicle when entering a place (can't ride inside a shop)
  if (active && isRiding()) { despawnRideVehicle(); toast("🚶 Dismounted (entered building)"); }
  if (!active && !isBusy()) collide(player.pos, world.colliders);
  // If we're inside a place, also collide with the place's local colliders
  if (active?.handle?.colliders && !isBusy()) {
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
  tickContext(camera);
  // Show entrance/exit prompt
  tickEntrancePrompt(player.pos.x, player.pos.z, _gameHour());

  // Hide traffic when inside a place (fixes "cars inside buildings" bug)
  traffic.setVisible?.(!active);
  if (traffic.setPlayerVehicle) traffic.setPlayerVehicle(player.pos.x, player.pos.z, isRiding());
  setLifePlayerVehicle(player.pos.x, player.pos.z, isRiding());
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
  if (rig) {
    rig.group.position.copy(player.pos); rig.group.position.y += player.yOff || 0;
    rig.group.rotation.y = player.heading;
    rig.animate(dt, player.speed);
    // FEATURE: hide the player's character model when riding a vehicle.
    // The vehicle mesh IS the visual representation — without this, the
    // player's feet + legs clip through the vehicle body.
    const _seat = isRiding() ? (window.__dbgSeat || getSeat(getRideId())) : null;
    rig.group.visible = !isRiding() || !!_seat;       // open vehicles (keke, okada, bicycle): the driver sits inside and is seen
    if (_seat && !active) {
      const sh = Math.sin(player.heading), ch = Math.cos(player.heading);
      rig.group.position.x = player.pos.x + sh * _seat.f + ch * _seat.s;
      rig.group.position.z = player.pos.z + ch * _seat.f - sh * _seat.s;
      rig.group.position.y = _seat.y - 0.55;
      if (!rig.animate.isEmoting || !rig.animate.isEmoting()) rig.animate.emote("sit", 30);
    }
    // ---- Footstep dust + sound (Oct 19) ----
    if (player.speed > 0.05 && !isRiding() && !active) {
      _stepT = (_stepT || 0) - dt;
      if (_stepT <= 0) {
        _stepT = 0.45;  // footstep interval (s)
        try { emitDust(player.pos, 3); } catch (e) {}
        try { sfx.step(); } catch (e) {}
      }
    }
  }
  // FEATURE: update the ride vehicle mesh to follow the player
  tickRideVehicle(player.pos, player.heading);
  updateCamera(camera, ctl, player.pos, active ? (active.handle.colliders || []) : world.colliders, dt);
  applyTime();
  // Inside a place: hide EVERYTHING outdoors (scene-root districts, traffic, sky, people...) so no silhouettes show.
  if (active) {
    if (!_outHid) {
      _outHid = [];
      const keep = active.handle && active.handle.group;
      for (const c of scene.children) {
        if (c.isLight || c === keep || c === world.world || (rig && c === rig.group) || !c.visible) continue;
        c.visible = false; _outHid.push(c);
      }
    }
  } else if (_outHid) { for (const c of _outHid) c.visible = true; _outHid = null; }
  if (active) { scene.background = INTERIOR_BG; scene.fog.color.copy(INTERIOR_BG); sun.intensity = 0; hemi.intensity = 1.0; }
  // FIX: shadow map is updated by tickShadows() (in graphics.js) — only when
  // the player moves >4m OR the sun noticeably shifts. This is what makes
  // Medium/High quality not lag. Inside buildings, skip the shadow update
  // entirely (sun is set to 0 above).
  if (!active) tickShadows(player.pos.x, player.pos.z, _gameHour(), renderer);
  // ---- Phase 2+9: Calculate modified drain rates (NEPA + moodlets + weather) ----
  const homeHandle = getActivePlace();
  const placedFurniture = homeHandle?.handle?.getPlaced?.() || [];
  const hasBackup = hasPowerBackup(placedFurniture);
  const activeMoodlets = getActiveMoodlets(game.state);
  const flavourMods = getCombinedModifiers();
  // Build drain modifiers per need
  const drainMods = {};
  for (const need of NEEDS) {
    let rate = need.drainPerMin;
    // NEPA: energy and fun drain faster during cuts (unless backup)
    if (isNepaCut() && !hasBackup) {
      if (need.key === "energy") rate *= 2.0;
      if (need.key === "fun") rate *= 1.5;
    }
    // Moodlets
    for (const m of activeMoodlets) {
      if (m.modifiers && m.modifiers[need.key]) rate *= m.modifiers[need.key];
    }
    // Weather + headlines
    if (need.key === "hygiene" && flavourMods.hygieneMul) rate *= flavourMods.hygieneMul;
    if (need.key === "energy" && flavourMods.energyMul) rate *= flavourMods.energyMul;
    if (need.key === "fun" && flavourMods.funMul) rate *= flavourMods.funMul;
    drainMods[need.key] = rate;
  }
  game.state.drainModifiers = drainMods;
  game.updateNeeds(dt);
  // ---- Phase 2: NEPA tick + moodlet expiry ----
  const nepaEvents = tickNepa(dt, hasBackup);
  for (const ev of nepaEvents) toast(ev.msg);
  tickMoodlets(game.state);
  // Apply walk speed consequence (low energy = slow walk)
  const speedMul = getWalkSpeedMultiplier(game.state);
  // Blackout check (zero hunger)
  const cons = getConsequences(game.state);
  if (cons.blackout && !window._blackoutCooldown) {
    window._blackoutCooldown = true;
    toast("😫 You don faint from hunger! Rushing you home...");
    const homeDef = getPlace("home");
    if (homeDef) { player.pos.set(homeDef.entranceX, 0, homeDef.entranceZ); player.heading = homeDef.entranceFacing; }
    game.state.needs.hunger = 30;
    game.state.money = Math.max(0, game.state.money - 500);
    game.save?.();
    setTimeout(() => { window._blackoutCooldown = false; }, 60000);
  }
  // Stinky check
  if (cons.stinky && !window._stinkyWarned) {
    window._stinkyWarned = true;
    toast("💩 You dey smell! Go shower.");
    addMoodlet(game.state, "stinky");
    setTimeout(() => { window._stinkyWarned = false; }, 120000);
  }
  // ---- Phase 9: Weather + headlines ----
  const newHeadline = tickHeadlines();
  if (newHeadline) toast("📰 " + newHeadline.text);
  // ---- Mission tracking ----
  if(player.speed>0.5){missionState.totalDistance+=player.speed*speedMul*dt;}
  missionState.money=game.state.money;
  _missionCheckT+=dt;if(_missionCheckT>2){
    _missionCheckT=0;
    checkStep(missionState);
    _updateMissionTracker();
    // Phase 6: check wishes
    try {
      const wishClaimed = checkWishes(missionState);
      if (wishClaimed && wishClaimed.claimed) {
        toast("⭐ Wish complete: " + wishClaimed.claimed.text + " (+" + wishClaimed.points + " pts)");
        celebrate("⭐ +" + wishClaimed.points, wishClaimed.claimed.text);
      }
    } catch (e) { /* wish check non-critical */ }
  }
  _tickRent(dt);
  hudT += dt; if (hudT > 0.5) { hudT = 0; updateHUD(); }
  // ---- Money Hunt tick: update instance positions + claim prompt ----
  tickMoneyHunt(Date.now());
  // ---- Graphics tick: cloud drift ----
  tickGraphics(dt);
  // ---- Particles tick: confetti, dust, rain (Oct 19) ----
  tickParticles(dt, camera);
  // ---- Road events tick: rain/weather, checkpoints, traffic jams (Oct 19) ----
  tickRoadEvents(dt);
  // ---- Plot doors tick: render doors at nearby occupied plots + detect knock range (step 2c) ----
  // Only tick when NOT inside a place (otherwise we waste cycles on doors the player can't see)
  if (!active) tickPlotDoors(player.pos.x, player.pos.z);
  // FEATURE: check if the player is near ANY house they own → update "My Home" entrance
  if (!active) _checkOwnedHouseProximity();
  // FEATURE: check if the player is near a fun place (football pitch, suya spot, etc.)
  if (!active) _checkFunPlaceProximity();
  else if (_funActivityPromptEl) _funActivityPromptEl.style.display = "none";
  // FEATURE 3b: area world tick — chunk-streamed area roads + houses + lamp posts
  tickLife(player.pos.x, player.pos.z, !active);
  if (!active) tickAreaWorld(player.pos.x, player.pos.z);
  else if (_currentPlotInfo) _onPlotPromptUpdate(null); // inside a place: hide the "Enter X's Home" box
  if (!active) savePos(dt);
  setMyPlace(active ? (active.id === "home" ? "home:" + (placeCtx.visitingHouse?.ownerUid || getMyUid() || "me") : active.id) : "");
  sendPosition(player.pos.x, player.pos.z, player.heading);
  setMyPosition(player.pos.x, player.pos.z);
  mmT += dt; if (mmT > 0.1) { mmT = 0; mmDraw(player.pos.x, player.pos.z, ctl.yaw, player.heading, traffic.positions); }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

Promise.all([loadPlayer(manager, scene, game.state.look), addCity(scene, world, manager)]).then(([r]) => {
  mmDraw = createMinimap($("mm"), world.mapShapes);
  // ---- MAP TAP → RIDE TO LOCATION (Oct 19) ----
  // Tap on the minimap → convert tap to world coords → open the Ride app
  // with that location pre-set as the destination. Lets players quickly
  // order a keke/bus/taxi to any spot they see on the map.
  const mmCanvas = $("mm");
  if (mmCanvas && !mmCanvas._tapRideWired) {
    mmCanvas._tapRideWired = true;
    mmCanvas.style.cursor = "crosshair";
    let tapStartT = 0;
    // Use a tap (not click) — distinguish from drag-to-rotate if a future
    // drag handler gets added.
    mmCanvas.addEventListener("pointerdown", (e) => { tapStartT = Date.now(); });
    mmCanvas.addEventListener("pointerup", (e) => {
      // Only treat as tap if quick (<300ms) and didn't move much
      if (Date.now() - tapStartT > 300) return;
      // Reverse the minimap's draw transform to get world coords.
      // From minimap.js: translate(size/2, size/2) → rotate(yaw+PI) →
      // scale(sc/S, sc/S) → translate(-X(px), -Z(pz)) → draw base.
      // Inverse: screen → world.
      const rect = mmCanvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const size = mmCanvas.width;
      const S = 1.25;
      const range = 52;
      const sc = size / (range * 2);
      // dx, dy relative to centre
      let dx = sx - size / 2;
      let dy = sy - size / 2;
      // Reverse: scale, then rotate, then translate back to world
      const yaw = ctl ? ctl.yaw : Math.PI;
      // un-scale
      dx = dx * (S / sc);
      dy = dy * (S / sc);
      // un-rotate (yaw + PI was applied, so reverse is -(yaw + PI))
      const ang = -(yaw + Math.PI);
      const rx = dx * Math.cos(ang) - dy * Math.sin(ang);
      const rz = dx * Math.sin(ang) + dy * Math.cos(ang);
      // un-translate (back to world X/Z)
      const WX = (v) => (v / S) - MAP_HALF_X;
      const WZ = (v) => (v / S) - MAP_HALF_Z;
      // The translation in draw was -X(px), -Z(pz) (so add px, pz back)
      // BUT px, pz are baked into the X()/Z() helpers, so we need the
      // raw form. Actually the minimap uses pre-baked coords with the
      // helper X(x) = (x + MAP_HALF_X) * S. After un-rotate, dx/rz are
      // in "baked minimap space" → convert back to world.
      const worldX = (rx / S) - MAP_HALF_X + player.pos.x;
      const worldZ = (rz / S) - MAP_HALF_Z + player.pos.z;
      // Clamp to map bounds
      const cx = Math.max(-MAP_HALF_X + 5, Math.min(MAP_HALF_X - 5, worldX));
      const cz = Math.max(-MAP_HALF_Z + 5, Math.min(MAP_HALF_Z - 5, worldZ));
      // Store as the "marked destination" for the Ride app
      window._markedDest = { x: cx, z: cz, label: "📍 Map mark" };
      toast("📍 Marked! Tap a ride below to go there.");
      // Open Ride app with the marked dest pre-selected
      showPhoneApp("ride");
    });
  }
  rig = r; rig.group.castShadow = true;
  if (rig.recolor) rig.recolor(game.state.look); // in case the account outfit arrived while loading
  setProgress(1);
  ctl.yaw = player.heading + Math.PI;
  updateHUD();
  
  frame();
  $("loading").classList.add("done");
  window.__dbg = { ride: (id) => { initVehicles(scene, null, () => {}); return spawnRideVehicle(id, player.pos, player.heading, toast); }, player, ctl, npcs, renderer, scene, game, startActivity, placeSpec, funSpec, getRig: () => rig };
  window.__ready = true;
}).catch((e) => showError("Could not load the game: " + e.message));
