// src/building.js — REAL HOUSE BUILDING (Phase 1).
//
// Building a house na real project now, no be "click buy":
//   1. LAND     — buy a plot in Barnawa / Ungwan Rimi / Sabon Tasha (better area = dearer land).
//   2. PLAN     — pick type (Bungalow / Duplex / Mansion) + rooms; the app shows the
//                 FULL cost + build time BEFORE you confirm anything.
//   3. CONTRACT — hire one contractor (5 NPCs, rating/speed/price; `quality` is stored
//                 for the Phase 2 bad-cement system but not used yet).
//   4. BUILD    — 4 stages (Foundation → Walls → Roof → Finishing), PAID ONE AT A TIME.
//                 A stage can block forever until you get money for the next one.
//                 Progress comes from timestamps (stageStartedAt + stageDuration), so
//                 the build keeps going while you are OFFLINE. No setInterval timers.
//   5. FINISH   — stage 4 done → the plot becomes a REAL owned house record in the
//                 existing houses system (enter / decorate / invite / upgrade all work).
//
// WHY THE DATA LIVES WHERE IT LIVES
//   - The site record lives at houses/{areaId}/{plotNo} with a `build` child. That node
//     is ALREADY public-readable in FIREBASE_RULES.json, so every player near the plot
//     sees the site and its stage — no extra publicPlots node, no duplicate data.
//   - The private project lives at players/{uid}/builds/{buildId} (owner-only), and the
//     plot list at players/{uid}/plots. plots.js renders the door sign for it because
//     the record has ownerUid; areas_world skips the NPC house while `build` exists.
//
// MONEY (same pipeline as vehicles.js — never take money on trust):
//   serverSpend() → legacy runTransaction on economy/{uid}/balance → adoptMoney().
//   If the spend fails, the stage does NOT start and NO money moves.

import * as THREE from "three";
import { db } from "./firebase.js";
import { ref, get, set, update, onValue } from "firebase/database";
import { serverSpend, serverCredit, adoptMoney } from "./moneyapi.js";
import { getArea, getPlotPosition } from "./areas.js";
import { getAreaHouses } from "./plots.js";
import { initBuildingVis, syncSites, tickBuildingVis } from "./building_vis.js";
import { showContext } from "./contextmenu.js";

// ---------- LAND (3 Kaduna areas, better area = higher price) ----------
// Slots are the LAST 6 plot numbers of each area grid: regular signups claim
// plots from 0 upwards, so a fresh account can almost never collide with them,
// and even if one does, the claim transaction simply aborts (ownerUid set).
export const BUILD_ESTATES = [
  { areaId: "sabon_tasha", name: "Sabon Tasha", tier: "middle", landPrice: 6000000,
    desc: "Family area — land wey dey grow value steady." },
  { areaId: "ungwan_rimi", name: "Ungwan Rimi", tier: "rich", landPrice: 14000000,
    desc: "GRA compound — big oga dem dey build here." },
  { areaId: "barnawa",     name: "Barnawa",     tier: "rich", landPrice: 18000000,
    desc: "The finest address — riverside, quiet streets." },
];
export const SLOTS_PER_ESTATE = 6;
export function buildSlotNos(area) {
  const out = [];
  for (let i = SLOTS_PER_ESTATE; i >= 1; i--) out.push(area.plots - i);
  return out;
}
export function estateFor(areaId) { return BUILD_ESTATES.find(e => e.areaId === areaId) || null; }

// ---------- HOUSE TYPES ----------
// cost = base × roomsF × areaF × contractor.priceMul (split across 4 stages)
// time = baseMin × roomsF × areaF ÷ contractor.speed (minutes, real time)
// tier = the tier the finished house joins in the EXISTING houses system, so
//        Enter / Invite / decorate / upgrade flow continue like any bought house.
export const BUILD_TYPES = [
  { id: "bungalow", name: "Bungalow", emoji: "🏡", baseCost: 6000000,  baseMin: 90,  tier: 3, rooms: [2, 3, 4],
    desc: "One floor — fine starter house." },
  { id: "duplex",   name: "Duplex",   emoji: "🏢", baseCost: 25000000, baseMin: 150, tier: 4, rooms: [3, 4, 5],
    desc: "Two storeys — proper oga status." },
  { id: "mansion",  name: "Mansion",  emoji: "🏰", baseCost: 90000000, baseMin: 170, tier: 5, rooms: [4, 5],
    desc: "Big man compound — balcony, columns, vibes." },
];
export function typeFor(id) { return BUILD_TYPES.find(t => t.id === id) || null; }
const ROOMS_F = { 2: 0.85, 3: 1.0, 4: 1.15, 5: 1.3 };
function areaF(estate) { return estate && estate.tier === "rich" ? 1.0 : 0.9; }
export const STAGE_NAMES = ["", "Foundation", "Walls", "Roof", "Finishing"];
export const STAGE_ICONS = ["", "🧱", "🧱", "🏠", "🎨"];
const STAGE_FRAC = [0, 0.22, 0.33, 0.25, 0.20];   // share of total cost AND total time

export function buildTotals(typeId, rooms, estate, contractor) {
  const t = typeFor(typeId);
  if (!t || !contractor) return null;
  const rf = ROOMS_F[rooms] || 1;
  const totalCost = Math.round(t.baseCost * rf * areaF(estate) * contractor.priceMul);
  const totalMin = Math.round(t.baseMin * rf * areaF(estate) / contractor.speed);
  const stages = [0, 1, 2, 3, 4].map(s => ({
    stage: s,
    cost: Math.round(totalCost * STAGE_FRAC[s]),
    min: Math.max(2, Math.round(totalMin * STAGE_FRAC[s])),
  }));
  return { totalCost, totalMin, stages };
}
export function stageCostOf(build) {
  const t = typeFor(build.type);
  const estate = estateFor(build.area);
  const c = CONTRACTORS.find(c => c.id === build.contractorId) || CONTRACTORS[1];
  const tot = buildTotals(build.type, build.rooms, estate, c);
  return tot ? tot.stages[Math.min(4, (build.stage || 0) + 1)].cost : 0;
}

// ---------- CONTRACTORS (Phase 2 hook: `quality` is stored, not used yet) ----------
export const CONTRACTORS = [
  { id: "manasseh", name: "Manasseh Block Works",     rating: 2.6, speed: 0.75, priceMul: 0.80, quality: 0.35,
    line: "Oga, my price na friendly price — small small we go reach there." },
  { id: "sani_sons", name: "Sani & Sons Builders",    rating: 3.1, speed: 0.90, priceMul: 0.90, quality: 0.50,
    line: "Wallahi, block no go waste for my hand." },
  { id: "danjuma",  name: "Engineer Danjuma",         rating: 3.8, speed: 1.05, priceMul: 1.00, quality: 0.70,
    line: "Oga, I go finish am quick — level no go sleep." },
  { id: "musa_con", name: "Alhaji Musa Construction", rating: 4.4, speed: 1.20, priceMul: 1.25, quality: 0.85,
    line: "Quality work, no shaking. Cement na original." },
  { id: "buildright", name: "BuildRight Nig. Ltd",    rating: 4.9, speed: 1.35, priceMul: 1.50, quality: 1.00,
    line: "Corporate standard — your house go stand for 100 years." },
];
export function contractorFor(id) { return CONTRACTORS.find(c => c.id === id) || null; }

// ---------- state ----------
let _uid = null;
let _scene = null;
let _getState = null, _getName = null, _toast = () => {}, _updateHUD = () => {}, _celebrate = () => {};
let _myBuilds = {};      // buildId -> build record (live from players/{uid}/builds)
let _myPlots = {};       // plotKey -> plot record (live from players/{uid}/plots)
let _unsubs = [];
let _finalizing = new Set();   // buildIds already being finalized (guard double-writes)
let _chipT = 0, _chkT = 0, _px = 0, _pz = 0;
let _lastCompletedTold = new Set();

// ---------- init ----------
export function initBuilding({ scene, colliders, getState, getName, toast, updateHUD, celebrate }) {
  _scene = scene;
  _getState = getState || null;
  _getName = getName || null;
  _toast = toast || _toast;
  _updateHUD = updateHUD || _updateHUD;
  _celebrate = celebrate || _celebrate;
  initBuildingVis(scene, colliders || []);

  // ---- window handlers for the phone app (the codebase wires UI through window.*) ----
  window._kbBuyLand = (areaId) => buyPlot(areaId);
  window._kbPlanFor = (plotKey) => { window._kbPlan = { plotKey, type: "bungalow", rooms: 3, contractor: "danjuma" }; window.showApp("builds"); };
  window._kbPickType = (id) => { if (window._kbPlan) { window._kbPlan.type = id; const t = typeFor(id); if (t && !t.rooms.includes(window._kbPlan.rooms)) window._kbPlan.rooms = t.rooms[0]; window.showApp("builds"); } };
  window._kbPickRooms = (n) => { if (window._kbPlan) { window._kbPlan.rooms = n; window.showApp("builds"); } };
  window._kbPickCon = (id) => { if (window._kbPlan) { window._kbPlan.contractor = id; window.showApp("builds"); } };
  window._kbCancelPlan = () => { window._kbPlan = null; window.showApp("builds"); };
  window._kbStart = () => startProject();
  window._kbPay = (buildId) => payNextStage(buildId);
  window._kbGoto = (areaId, plotNo) => { try { window._travelTo && window._travelTo(areaId, plotNo); } catch (e) {} };

  console.log("[building] ready — 3 estates,", BUILD_TYPES.length, "house types,", CONTRACTORS.length, "contractors");
}

// Per-login: one listener on my builds + one on my plots. Live forever, cheap.
export function buildingSetUid(uid) {
  if (_uid === uid) return;
  _uid = uid;
  for (const u of _unsubs) { try { u(); } catch (e) {} }
  _unsubs = [];
  _myBuilds = {}; _myPlots = {}; _finalizing.clear(); _lastCompletedTold.clear();
  if (!uid || !db) { syncSites([]); return; }
  _unsubs.push(onValue(ref(db, "players/" + uid + "/builds"), (snap) => {
    _myBuilds = snap.val() || {};
    // A stage that finished while we were offline → tell the owner once.
    for (const [id, b] of Object.entries(_myBuilds)) {
      if (!b || b.done || !b.stageStartedAt) continue;
      const end = b.stageStartedAt + b.stageDuration;
      if (Date.now() >= end && !_lastCompletedTold.has(id)) {
        _lastCompletedTold.add(id);
        if (b.stage >= 4) { /* finalizeHouse handles the celebration */ }
        else _toast(STAGE_ICONS[b.stage] + " " + STAGE_NAMES[b.stage] + " don complete! Pay the next stage make we continue.");
      }
    }
  }, () => {}));
  _unsubs.push(onValue(ref(db, "players/" + uid + "/plots"), (snap) => { _myPlots = snap.val() || {}; }, () => {}));
}

// ---------- MONEY (vehicles.js pipeline — server first, legacy confirmed-write fallback) ----------
async function _spend(price, reason) {
  if (!_uid) return { ok: false, why: "sign-in" };
  const viaApi = await serverSpend(price, reason);
  if (viaApi) {
    if (!viaApi.ok) return { ok: false, why: "broken", balance: viaApi.balance };
    return { ok: true, newBal: viaApi.balance };
  }
  // Legacy path (API not deployed): confirmed read → write → read on the server
  // balance. A plain update() resolves or throws cleanly — the SDK's
  // runTransaction promise has been observed to hang/reject while its write still
  // lands (listener + 5s pusher churn), which silently ate stage payments.
  // Read-modify-write matches what the rest of the legacy game already does
  // (_upgradeHouse, _buyOutHouse, the balance pusher) while still REFUSING to
  // start a stage unless the server balance could really pay for it.
  const balRef = ref(db, "economy/" + _uid + "/balance");
  let before = null;
  try { before = (await get(balRef)).val(); } catch (e) {}
  if (typeof before !== "number") return { ok: false, why: "broken" };
  if (before < price) return { ok: false, why: "broken", balance: before };   // cannot afford — nothing moved
  const next = before - price;
  try {
    await set(balRef, next);          // set(), not update() — update() only takes {path: value} objects
  } catch (e) {
    return { ok: false, why: "broken", balance: before };                     // write failed — nothing taken
  }
  return { ok: true, newBal: next };
}
function _adopt(newBal) {
  const s = _getState && _getState();
  if (s && typeof newBal === "number") adoptMoney(newBal, s, true);
  _updateHUD();
}
async function _refund(price) {
  const viaApi = await serverCredit(price, "refund_plot");
  if (viaApi && viaApi.ok) { _adopt(viaApi.balance); return; }
  try {
    const balRef = ref(db, "economy/" + _uid + "/balance");
    const cur = (await get(balRef)).val();
    if (typeof cur !== "number") return;
    const fixed = Math.min(999999999999, cur + price);
    await set(balRef, fixed);
    _adopt(fixed);
  } catch (e) { console.warn("[building] refund failed:", e && e.message); }
}

// ---------- 1. BUY LAND ----------
export async function buyPlot(areaId) {
  const estate = estateFor(areaId);
  const area = getArea(areaId);
  if (!estate || !area) { _toast("Unknown area"); return; }
  if (!_uid) { _toast("Sign in first"); return; }
  const s = _getState && _getState();
  const price = estate.landPrice;
  if (s && (s.money || 0) < price) { _toast("Not enough money — " + estate.name + " land na ₦" + price.toLocaleString()); return; }

  // 1) Money leaves FIRST (confirmed write), exactly like vehicles.js.
  const r = await _spend(price, "buy_plot");
  if (!r.ok) {
    if (typeof r.balance === "number") _adopt(r.balance);
    _toast(r.why === "sign-in" ? "Sign in first" : "Money no complete — land na ₦" + price.toLocaleString());
    return;
  }
  _adopt(r.newBal);

  // 2) Claim the first free slot. Read → check → set → confirm: the SDK's
  // runTransaction has been seen resolving while its write never persists
  // (heavy listener churn), so we VERIFY the claim landed on the server and
  // treat a failed write as "slot taken" — money already refunded below if
  // every slot fails.
  let claimed = null;
  for (const plotNo of buildSlotNos(area)) {
    const plotRef = ref(db, "houses/" + areaId + "/" + plotNo);
    let cur = null;
    try { cur = (await get(plotRef)).val(); } catch (e) { continue; }
    if (cur && cur.ownerUid) continue;                   // taken — next slot
    const rec = {
      ownerUid: _uid,
      ownerName: (_getName && _getName()) || "Player",
      createdAt: Date.now(),
      build: { type: "", rooms: 0, stage: 0, stageStartedAt: 0, stageDuration: 0, paidStages: 0, contractor: "" },
    };
    try {
      await set(plotRef, rec);
      const back = (await get(plotRef)).val();           // confirm it really landed
      if (back && back.ownerUid === _uid) { claimed = { areaId, plotNo }; break; }
    } catch (e) { console.warn("[building] claim failed:", e && e.message); continue; }
  }
  if (!claimed) {
    await _refund(price);                               // land finished — money goes back
    _toast("Land don finish for " + estate.name + " — your ₦" + price.toLocaleString() + " don return. Try another area.");
    return;
  }

  // 3) Private plot list (owner-only, powers "My Land" in the app).
  const plotKey = claimed.areaId + "_" + claimed.plotNo;
  try {
    await set(ref(db, "players/" + _uid + "/plots/" + plotKey), {
      area: claimed.areaId, areaName: estate.name, plotNo: claimed.plotNo, price, boughtAt: Date.now(),
    });
  } catch (e) { console.warn("[building] plot list write failed:", e && e.message); }

  _celebrate("📍 " + estate.name + " Plot #" + claimed.plotNo, "Land don ready! Plan your house when you want — no rush.");
  _toast("🏗️ You don buy land for " + estate.name + "! Open 🧱 Build app to plan your house.");
}

// ---------- 2+3. START PROJECT (plan + contractor + pay Foundation) ----------
async function startProject() {
  const plan = window._kbPlan;
  if (!plan || !_uid) { _toast("Plan no set"); return; }
  const [areaId, plotNoStr] = String(plan.plotKey).split("_");
  const plotNo = parseInt(plotNoStr, 10);
  const estate = estateFor(areaId), area = getArea(areaId);
  const type = typeFor(plan.type), con = contractorFor(plan.contractor);
  if (!estate || !area || !type || !con || !(plotNo >= 0)) { _toast("Plan no correct — try again"); return; }
  const mine = _myPlots[plan.plotKey];
  if (!mine) { _toast("Na only your land you fit build on"); return; }
  if (_myBuilds[plan.plotKey] && !_myBuilds[plan.plotKey].done) { _toast("Project already dey run for this plot"); return; }

  const tot = buildTotals(type.id, plan.rooms, estate, con);
  const first = tot.stages[1];
  // Show the FULL price before the first shovel touches ground.
  if (!confirm("Build " + type.name + " (" + plan.rooms + " rooms) for " + estate.name + "?\n\n" +
    "Total: ₦" + tot.totalCost.toLocaleString() + " · about " + fmtMin(tot.totalMin) + "\n" +
    "Contractor: " + con.name + "\n\n" +
    "You go pay stage by stage. Now: Foundation ₦" + first.cost.toLocaleString())) return;

  // Write the project + site record FIRST (no money yet), so the world sees the site.
  const buildId = plan.plotKey;
  const buildRec = {
    plotId: buildId, area: areaId, areaName: estate.name, plotNo,
    type: type.id, rooms: plan.rooms,
    contractorId: con.id, contractorName: con.name, quality: con.quality, speed: con.speed,
    stage: 0, stageStartedAt: 0, stageDuration: 0, paidStages: 0,
    createdAt: Date.now(), done: false,
  };
  try {
    await set(ref(db, "players/" + _uid + "/builds/" + buildId), buildRec);
    await update(ref(db, "houses/" + areaId + "/" + plotNo + "/build"), {
      type: type.id, rooms: plan.rooms, stage: 0, stageStartedAt: 0, stageDuration: 0, paidStages: 0, contractor: con.name,
    });
    _myBuilds[buildId] = buildRec;   // warm the local cache — the listener will confirm shortly
  } catch (e) {
    console.warn("[building] project write failed:", e && e.message);
    _toast("Network no gree — try again");
    return;
  }
  window._kbPlan = null;
  _toast("📋 Plan don set! Foundation na ₦" + first.cost.toLocaleString() + " — e go soon start.");
  // Pay stage 1 immediately (this is the confirm the player just tapped).
  await payNextStage(buildId);
}

// ---------- 4. PAY ONE STAGE ----------
export async function payNextStage(buildId) {
  // The local cache can lag the write by a beat (fresh project) — fall back to a
  // direct read so "confirm plan → pay foundation" never races its own snapshot.
  let b = _myBuilds[buildId];
  if (!b && _uid) {
    try { b = (await get(ref(db, "players/" + _uid + "/builds/" + buildId))).val(); } catch (e) { b = null; }
  }
  if (!b || !_uid) { _toast("Project no dey your hand"); return; }
  if (b.done) { _toast("House don complete already!"); return; }
  const next = Math.min(4, (b.stage || 0) + 1);
  if (b.stage >= 1 && b.stageStartedAt && Date.now() < b.stageStartedAt + b.stageDuration) {
    _toast("⏳ " + STAGE_NAMES[b.stage] + " still dey go — " + fmtLeft(b) + " left.");
    return;
  }
  if ((b.stage || 0) >= 4) { _toast("🔑 Last stage don finish — we dey hand over your keys!"); return; }
  const cost = stageCostOf(b);
  if (!cost) { _toast("Nothing to pay — project no set"); return; }
  const s = _getState && _getState();
  if (s && (s.money || 0) < cost) {
    _toast("Money no reach " + STAGE_NAMES[next] + " — need ₦" + cost.toLocaleString() + ". Go hustle small! 💪");
    return;
  }
  // Money first, confirmed — no confirmed write, no stage start.
  const r = await _spend(cost, "build_stage");
  if (!r.ok) {
    if (typeof r.balance === "number") _adopt(r.balance);
    _toast("Money no complete — " + STAGE_NAMES[next] + " na ₦" + cost.toLocaleString());
    return;
  }
  _adopt(r.newBal);
  const con = contractorFor(b.contractorId) || { speed: 1 };
  const estate = estateFor(b.area);
  const tot = buildTotals(b.type, b.rooms, estate, con || CONTRACTORS[1]);
  const durMs = (tot ? tot.stages[next].min : 20) * 60000;
  const now = Date.now();
  try {
    await update(ref(db, "players/" + _uid + "/builds/" + buildId), {
      stage: next, stageStartedAt: now, stageDuration: durMs, paidStages: next,
    });
    await update(ref(db, "houses/" + b.area + "/" + b.plotNo + "/build"), {
      stage: next, stageStartedAt: now, stageDuration: durMs, paidStages: next,
    });
  } catch (e) {
    console.warn("[building] stage write failed:", e && e.message);
    await _refund(cost);
    _toast("Network no gree — your ₦" + cost.toLocaleString() + " don return. Try again.");
    return;
  }
  _toast(STAGE_ICONS[next] + " " + STAGE_NAMES[next] + " start! Workers don reach site — " + fmtMs(durMs) + " to go.");
}

// ---------- 6. FINISH → becomes a real house in the EXISTING system ----------
async function finalizeHouse(buildId, b) {
  if (_finalizing.has(buildId)) return;
  _finalizing.add(buildId);
  try {
    // Double-check the record is still ours and not already finalized.
    const snap = await get(ref(db, "houses/" + b.area + "/" + b.plotNo));
    const rec = snap.val();
    if (!rec || rec.ownerUid !== _uid || !rec.build) { _finalizing.delete(buildId); return; }
    const t = typeFor(b.type) || BUILD_TYPES[0];
    const area = getArea(b.area);
    await update(ref(db, "houses/" + b.area + "/" + b.plotNo), {
      tier: t.tier,
      colors: { wall: area ? area.wallCol : 0xf0e8d8, roof: area ? area.roofCol : 0x9b4a35, door: 0x4a3a2a },
      tenure: "own",
      furniture: [],
      builtBy: b.contractorName || "",
      finishedAt: Date.now(),
      build: null,                       // removing `build` hands the plot to the normal house renderer
    });
    await update(ref(db, "players/" + _uid + "/builds/" + buildId), { done: true, stage: 4, finishedAt: Date.now() });
    _celebrate("🏠 House don ready!", "Your " + t.name + " (" + b.rooms + " rooms) for " + (b.areaName || b.area) + " don complete — enter, decorate, invite your people!");
    _toast("🔑 " + t.name + " don ready! E dey your Houses list now.");
    try { window.dispatchEvent(new CustomEvent("kl_house_built", { detail: { a: b.area, p: b.plotNo, tier: t.tier } })); } catch (e) {}
  } catch (e) {
    console.warn("[building] finalize failed:", e && e.message);
    _finalizing.delete(buildId);
  }
}

// ---------- helpers ----------
export function fmtMin(m) { return m >= 60 ? Math.floor(m / 60) + "h " + (m % 60) + "m" : m + " min"; }
export function fmtMs(ms) { return fmtMin(Math.max(1, Math.round(ms / 60000))); }
export function fmtLeft(b) {
  if (!b || !b.stageStartedAt) return "";
  const left = b.stageStartedAt + b.stageDuration - Date.now();
  return left <= 0 ? "done" : fmtMs(left);
}

// ---------- TICK ----------
export function tickBuilding(px, pz, dt) {
  _px = px; _pz = pz;
  if (!_scene) return;
  const now = Date.now();

  // 1) Owner-side completion checks (works even far from the plot — data comes
  //    from players/{uid}/builds which is always subscribed). The timestamp
  //    maths is what moves progress while offline; nothing here uses timers.
  _chkT -= dt;
  if (_chkT <= 0) {
    _chkT = 2.0;
    for (const [id, b] of Object.entries(_myBuilds)) {
      if (!b || b.done || !b.stageStartedAt) continue;
      if (now >= b.stageStartedAt + b.stageDuration && b.stage >= 4) finalizeHouse(id, b);
    }
  }

  // 2) Collect every visible site (mine + other players') from the shared,
  //    already-public houses node — one data source, no extra listeners.
  const sites = [];
  for (const estate of BUILD_ESTATES) {
    const area = getArea(estate.areaId);
    if (!area) continue;
    const dx = area.x - px, dz = area.z - pz;
    if (dx * dx + dz * dz > 350 * 350) continue;          // only near areas matter
    const houses = getAreaHouses(estate.areaId) || {};
    for (const [pn, rec] of Object.entries(houses)) {
      if (!rec || !rec.build) continue;
      const plotNo = parseInt(pn, 10);
      const pos = getPlotPosition(area, plotNo);
      const b = rec.build;
      const started = !!b.stageStartedAt;
      const end = (b.stageStartedAt || 0) + (b.stageDuration || 1);
      const active = started && now < end;
      const prog = !started ? 0 : Math.max(0, Math.min(1, (now - b.stageStartedAt) / Math.max(1, b.stageDuration)));
      sites.push({
        key: estate.areaId + "/" + plotNo,
        areaId: estate.areaId, areaName: estate.name, plotNo,
        x: pos.x, z: pos.z, rot: pos.rot || 0,
        ownerUid: rec.ownerUid, ownerName: rec.ownerName || "Oga",
        type: b.type || "", rooms: b.rooms || 0, stage: b.stage || 0,
        stageName: STAGE_NAMES[b.stage || 0] || "", contractor: b.contractor || "",
        stageStartedAt: b.stageStartedAt || 0, stageDuration: b.stageDuration || 0,
        active, prog, started, mine: rec.ownerUid === _uid,
      });
    }
  }
  syncSites(sites);
  tickBuildingVis(dt, px, pz);

  // 3) Context chip when you stand near a site (small, never blocking).
  _chipT -= dt;
  if (_chipT <= 0) {
    _chipT = 0.5;
    let best = null, bd = 6 * 6;
    for (const st of sites) {
      const d2 = (st.x - px) * (st.x - px) + (st.z - pz) * (st.z - pz);
      if (d2 < bd) { bd = d2; best = st; }
    }
    if (best) _showSiteChip(best);
  }
}

function _showSiteChip(st) {
  const at = new THREE.Vector3(st.x, 3.2, st.z);
  const getPlayer = () => ({ x: _px, z: _pz });
  if (st.mine && !st.type) {
    showContext({
      key: "kb_" + st.key, at, title: "📌 " + st.areaName + " · Plot #" + st.plotNo, radius: 8, getPlayer,
      actions: [{ icon: "📐", label: "Plan", run: () => window._kbPlanFor(st.areaId + "_" + st.plotNo) }],
    });
  } else if (st.mine) {
    const next = Math.min(4, st.stage + 1);
    const b = _myBuilds[st.areaId + "_" + st.plotNo];
    const cost = b ? stageCostOf(b) : 0;
    const actions = [];
    if (st.active) actions.push({ icon: "⏳", label: fmtLeft(b), run: () => window.showApp("builds") });
    else actions.push({ icon: "💰", label: "Pay ₦" + (cost / 1e6).toFixed(1) + "M", run: () => window._kbPay(st.areaId + "_" + st.plotNo) });
    actions.push({ icon: "📋", label: "Projects", run: () => window.showApp("builds") });
    showContext({
      key: "kb_" + st.key, at, title: "🏗️ " + STAGE_NAMES[st.stage] + (st.active ? " · " + fmtLeft(b) + " left" : " · dey wait money"), radius: 8, getPlayer,
      actions,
    });
  } else if (!st.type) {
    showContext({
      key: "kb_" + st.key, at, title: "📌 " + st.ownerName + " get land for " + st.areaName, radius: 8, getPlayer,
      actions: [{ icon: "👀", label: "Peep", run: () => _toast(st.ownerName + " don buy plot #" + st.plotNo + " for " + st.areaName + " — house go soon start.") }],
    });
  } else {
    showContext({
      key: "kb_" + st.key, at, title: "🏗️ " + st.ownerName + " dey build " + (st.stageName || "house") + " for " + st.areaName, radius: 8, getPlayer,
      actions: [{ icon: "👀", label: "Peep", run: () => _toast(st.ownerName + " dey build " + (typeFor(st.type)?.name || "house") + " (" + st.rooms + " rooms) — contractor: " + st.contractor) }],
    });
  }
}

// ---------- PHONE APP (🧱 Build) ----------
export function renderBuildsApp() {
  const s = _getState ? _getState() : { money: 0 };
  const back = '<button onclick="window.showApp(\'home\')" style="margin-top:14px;background:transparent;border:none;color:#4ade80;cursor:pointer;font-size:13px;font-weight:600;">← Back to Phone</button>';
  const plan = window._kbPlan;

  // ---- PLAN VIEW (after picking "Plan your house" on a plot) ----
  if (plan) {
    const estate = estateFor(String(plan.plotKey).split("_")[0]);
    const type = typeFor(plan.type) || BUILD_TYPES[0];
    const con = contractorFor(plan.contractor) || CONTRACTORS[2];
    const tot = buildTotals(type.id, plan.rooms, estate, con) || { totalCost: 0, totalMin: 0, stages: [] };
    const btn = 'background:#17181b;border:1.5px solid #2e7d4f;border-radius:10px;padding:9px 10px;cursor:pointer;text-align:left;width:100%;';
    let h = '<div style="font-size:15px;margin-bottom:4px;font-weight:700;color:#f2f2f4;">📐 Plan your house</div>';
    h += '<div style="font-size:11px;color:#9b9ba4;margin-bottom:10px;">📍 ' + (estate ? estate.name : "?") + ' · Plot #' + String(plan.plotKey).split("_")[1] + ' · Balance ₦' + (s.money || 0).toLocaleString() + '</div>';
    h += '<div style="font-size:12px;font-weight:600;color:#f2b134;margin:8px 0 5px;">1️⃣ House type</div>';
    for (const t of BUILD_TYPES) {
      h += '<button onclick="window._kbPickType(\'' + t.id + '\')" style="' + btn + (t.id === type.id ? 'border-color:#4ade80;background:#1a2a1a;' : '') + 'margin-bottom:5px;">' +
        '<div style="font-size:13px;font-weight:700;color:#f2f2f4;">' + t.emoji + ' ' + t.name + (t.id === type.id ? ' ✅' : '') + '</div>' +
        '<div style="font-size:10px;color:#9b9ba4;">' + t.desc + '</div></button>';
    }
    h += '<div style="font-size:12px;font-weight:600;color:#f2b134;margin:10px 0 5px;">2️⃣ Rooms</div><div style="display:flex;gap:6px;flex-wrap:wrap;">';
    for (const n of type.rooms) {
      h += '<button onclick="window._kbPickRooms(' + n + ')" style="flex:1;min-width:64px;' + btn + 'text-align:center;' + (n === plan.rooms ? 'border-color:#4ade80;background:#1a2a1a;' : '') + '"><b style="color:#f2f2f4;font-size:13px;">' + n + ' rooms</b></button>';
    }
    h += '</div>';
    h += '<div style="font-size:12px;font-weight:600;color:#f2b134;margin:12px 0 5px;">3️⃣ Hire contractor</div>';
    for (const c of CONTRACTORS) {
      h += '<button onclick="window._kbPickCon(\'' + c.id + '\')" style="' + btn + (c.id === con.id ? 'border-color:#4ade80;background:#1a2a1a;' : '') + 'margin-bottom:5px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;"><span style="font-size:12px;font-weight:700;color:#f2f2f4;">👷 ' + c.name + '</span><span style="font-size:11px;color:#f2b134;">⭐ ' + c.rating.toFixed(1) + '</span></div>' +
        '<div style="font-size:10px;color:#9b9ba4;margin-top:2px;">Speed ×' + c.speed.toFixed(2) + ' · Price ×' + c.priceMul.toFixed(2) + ' · "' + c.line + '"</div></button>';
    }
    h += '<div style="background:#1a2a1a;border:2px solid #4ade80;border-radius:12px;padding:12px;margin:12px 0;">';
    h += '<div style="font-size:12px;font-weight:700;color:#4ade80;">📋 Estimate — before you pay anything</div>';
    h += '<div style="font-size:11px;color:#f2f2f4;margin-top:6px;">Total build: <b>₦' + tot.totalCost.toLocaleString() + '</b></div>';
    h += '<div style="font-size:11px;color:#f2f2f4;">Total time: <b>about ' + fmtMin(tot.totalMin) + '</b> (workers dey work even when game close)</div>';
    for (const st of tot.stages.slice(1)) {
      h += '<div style="display:flex;justify-content:space-between;font-size:10px;color:#9b9ba4;margin-top:3px;"><span>' + STAGE_ICONS[st.stage] + ' ' + STAGE_NAMES[st.stage] + '</span><span>₦' + st.cost.toLocaleString() + ' · ' + fmtMin(st.min) + '</span></div>';
    }
    h += '<div style="font-size:10px;color:#f2b134;margin-top:6px;">You go pay one stage at a time — house fit wait half-built make you hustle.</div></div>';
    h += '<button onclick="window._kbStart()" style="width:100%;background:#4ade80;color:#000;border:none;border-radius:10px;padding:14px;cursor:pointer;font-size:14px;font-weight:800;">✅ Confirm plan — Pay Foundation ₦' + (tot.stages[1] ? tot.stages[1].cost.toLocaleString() : "") + '</button>';
    h += '<button onclick="window._kbCancelPlan()" style="width:100%;margin-top:6px;background:transparent;color:#e11d48;border:1px solid #e11d48;border-radius:10px;padding:10px;cursor:pointer;font-size:12px;font-weight:600;">Cancel</button>';
    return h + back;
  }

  // ---- MAIN VIEW: projects + my land + land for sale ----
  let h = '<div style="font-size:15px;margin-bottom:8px;font-weight:700;color:#f2f2f4;">🧱 Build House — small small</div>';
  h += '<div style="font-size:11px;color:#9b9ba4;margin-bottom:10px;">Balance: ₦' + (s.money || 0).toLocaleString() + '</div>';

  // My projects
  const projects = Object.entries(_myBuilds).filter(([, b]) => b && !b.done);
  h += '<div style="font-size:12px;font-weight:600;margin:4px 0 6px;color:#f2b134;">🏗️ My Projects (' + projects.length + ')</div>';
  if (!projects.length) h += '<div style="font-size:11px;color:#6b7280;padding:10px;text-align:center;background:#17181b;border-radius:8px;margin-bottom:10px;">No project yet — buy land below, then plan your house. 🏗️</div>';
  for (const [id, b] of projects) {
    const t = typeFor(b.type);
    const started = !!b.stageStartedAt;
    const end = (b.stageStartedAt || 0) + (b.stageDuration || 1);
    const active = started && Date.now() < end;
    const prog = !started ? 0 : Math.max(0, Math.min(1, (Date.now() - b.stageStartedAt) / Math.max(1, b.stageDuration)));
    const next = Math.min(4, (b.stage || 0) + 1);
    const cost = stageCostOf(b);
    h += '<div style="background:#17181b;border-radius:10px;padding:10px;margin-bottom:6px;">';
    h += '<div style="display:flex;justify-content:space-between;"><span style="font-size:12px;font-weight:700;color:#f2f2f4;">' + (t ? t.emoji : "🏗️") + ' ' + (t ? t.name : "?") + ' · ' + b.rooms + ' rooms</span><span style="font-size:10px;color:#9b9ba4;">📍 ' + (b.areaName || b.area) + ' #' + b.plotNo + '</span></div>';
    h += '<div style="font-size:10px;color:#9b9ba4;margin-top:2px;">👷 ' + (b.contractorName || "—") + ' · Stage ' + (b.stage || 0) + '/4 · ' + STAGE_NAMES[b.stage || 0] + '</div>';
    h += '<div style="display:flex;gap:3px;margin:6px 0 4px;">' + [1, 2, 3, 4].map(i => '<div style="flex:1;height:6px;border-radius:3px;background:' + (i < b.stage ? '#4ade80' : i === b.stage ? (active ? '#f2b134' : '#4ade80') : '#2a2b30') + ';"></div>').join("") + '</div>';
    if (active) {
      h += '<div style="height:8px;background:#2a2b30;border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + Math.round(prog * 100) + '%;background:#f2b134;"></div></div>';
      h += '<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:10px;"><span style="color:#f2b134;">⏳ ' + STAGE_NAMES[b.stage] + ' — ready in ' + fmtLeft(b) + '</span><span style="color:#9b9ba4;">' + Math.round(prog * 100) + '%</span></div>';
    } else {
      h += '<div style="height:8px;background:#2a2b30;border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + Math.round(prog * 100) + '%;background:#4ade80;"></div></div>';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px;"><span style="font-size:10px;color:#4ade80;">✅ ' + STAGE_NAMES[b.stage] + ' done' + (b.stage >= 4 ? " — house dey finish…" : "") + '</span></div>';
      if (b.stage < 4) h += '<button onclick="window._kbPay(\'' + id + '\')" style="width:100%;margin-top:6px;background:#f2b134;color:#000;border:none;border-radius:8px;padding:9px;cursor:pointer;font-size:12px;font-weight:700;">💰 Pay ' + STAGE_NAMES[next] + ' — ₦' + cost.toLocaleString() + '</button>';
    }
    h += '<button onclick="window._kbGoto(\'' + b.area + '\',' + b.plotNo + ')" style="width:100%;margin-top:5px;background:#1e3a5f;color:#9cc3e8;border:none;border-radius:8px;padding:7px;cursor:pointer;font-size:11px;font-weight:600;">📍 See site</button>';
    h += '</div>';
  }

  // My land (bought, no project yet)
  const freePlots = Object.entries(_myPlots).filter(([key]) => {
    const b = _myBuilds[key];
    return !b || b.done;   // done projects keep the house — no new project on same plot
  });
  h += '<div style="font-size:12px;font-weight:600;margin:12px 0 6px;color:#f2b134;">📍 My Land (' + freePlots.length + ')</div>';
  if (!freePlots.length) h += '<div style="font-size:11px;color:#6b7280;padding:8px;text-align:center;background:#17181b;border-radius:8px;margin-bottom:10px;">You no get land yet.</div>';
  for (const [key, p] of freePlots) {
    h += '<div style="display:flex;align-items:center;gap:8px;padding:9px;background:#17181b;border-radius:10px;margin-bottom:5px;">' +
      '<div style="flex:1;"><div style="font-size:12px;font-weight:600;color:#f2f2f4;">📍 ' + (p.areaName || p.area) + ' · Plot #' + p.plotNo + '</div>' +
      '<div style="font-size:10px;color:#9b9ba4;">7m × 7m plot · your name dey the signboard</div></div>' +
      '<button onclick="window._kbPlanFor(\'' + key + '\')" style="background:#4ade80;color:#000;border:none;border-radius:8px;padding:9px 12px;cursor:pointer;font-size:11px;font-weight:700;">📐 Plan house</button></div>';
  }

  // Land for sale
  h += '<div style="font-size:12px;font-weight:600;margin:12px 0 6px;color:#f2b134;">🌍 Land for Sale</div>';
  for (const e of BUILD_ESTATES) {
    const area = getArea(e.areaId);
    const owned = Object.values(_myPlots).filter(p => p.area === e.areaId).length;
    const canAfford = (s.money || 0) >= e.landPrice;
    h += '<div style="display:flex;align-items:center;gap:8px;padding:9px;background:#17181b;border-radius:10px;margin-bottom:5px;">' +
      '<div style="flex:1;"><div style="font-size:12px;font-weight:600;color:#f2f2f4;">' + (e.tier === "rich" ? "💎" : "🏘️") + ' ' + e.name + (owned ? ' <span style="color:#4ade80;font-size:10px;">· you get ' + owned + ' plot' + (owned > 1 ? 's' : '') + '</span>' : '') + '</div>' +
      '<div style="font-size:10px;color:#9b9ba4;">' + e.desc + '</div>' +
      '<div style="font-size:11px;color:#f2b134;font-weight:700;margin-top:2px;">₦' + e.landPrice.toLocaleString() + ' · plot ' + (area ? buildSlotNos(area).length : SLOTS_PER_ESTATE) + ' left</div></div>' +
      (canAfford
        ? '<button onclick="window._kbBuyLand(\'' + e.areaId + '\')" style="background:#f2b134;color:#000;border:none;border-radius:8px;padding:9px 12px;cursor:pointer;font-size:11px;font-weight:700;">Buy</button>'
        : '<span style="font-size:10px;color:#6b7280;">₦' + e.landPrice.toLocaleString() + '</span>') +
      '</div>';
  }
  h += '<div style="font-size:11px;color:#6b7280;margin-top:12px;text-align:center;">💡 Buy land → plan house → hire contractor → pay stage by stage. Workers no dey sleep, even when you offline. 😄</div>';
  return h + back;
}

// Auto-refresh the app while it is open (progress bars move without reopening).
let _appT = null;
export function startBuildsAppRefresher() {
  if (_appT) clearInterval(_appT);
  _appT = setInterval(() => {
    try {
      const modal = document.getElementById("phone-modal");
      if (!modal || !modal.classList.contains("show")) return;
      if (window._showingApp !== "builds") return;
      const c = document.getElementById("phone-content");
      if (!c || window._kbPlan) return;
      c.innerHTML = renderBuildsApp();
    } catch (e) {}
  }, 3000);
}

// ---------- debug ----------
export function buildingDbg() {
  return {
    uid: _uid,
    builds: Object.keys(_myBuilds).length,
    plots: Object.keys(_myPlots).length,
    finalizing: [..._finalizing],
  };
}
