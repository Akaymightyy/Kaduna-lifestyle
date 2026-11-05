// src/crew_war.js — AREA WARS: the weekly fight for Kaduna.
//
// Every week each area dey open for war. Crews earn WAR POINTS through:
//   • contributing money to the Crew Bank (₦1,000 = 1 pt)
//   • daily Crew Challenges (deposit / zone time / street race)
//   • being active inside the war area (1 pt per minute, cap 300/day)
//   • winning the main street race (+25 pts)
//   • defending: the owner crew scores into their own area too
// When the week rolls over, the crew with the highest points takes/molds the area.
// Losers collect a 7-day cooldown before dem fit attack that area again.
//
// No setInterval game logic — the tick runs from the main render loop and only
// fires network writes once a minute (activity) or when the week changes.
//
// DATA (see territory.js):
//   territory/{areaId}/war/{weekKey}/{crewId} = points (own-crew increments only)
//   territory/{areaId}/cooldowns/{crewId}     = ts
//   territory/{areaId}/rewards/{week}/{uid}   = { amount, ts }
//   players/{uid}/crewDaily/{dayKey}          = { ts, deposit, zoneMin, race, claimed }

import { db } from "./firebase.js";
import { ref, get, onValue, runTransaction } from "firebase/database";
import { serverCredit, adoptMoney } from "./moneyapi.js";
import { CREW_AREAS, crewArea, areaAt, weekKey, prevWeekKey, dayKey, warScores, ownerOf, territoryData, warRewardFor, warRewardClaimed } from "./territory.js";
import { myCrew, myCrewId, crewSummary } from "./crews.js";

// ---------- DAILY CREW CHALLENGES ----------
export const CHALLENGES = [
  { id: "deposit", icon: "🤝", name: "Community Contribution", desc: "Deposit ₦20,000 into the Crew Bank today", target: 20000, pts: 60, cred: 15, xp: 30, isMoney: true },
  { id: "zone",    icon: "🚩", name: "Hold Your Zone",         desc: "Spend 5 minutes inside your war area today", target: 5,    pts: 40, cred: 10, xp: 20 },
  { id: "race",    icon: "🏁", name: "Street Racer",           desc: "Finish 1 street race today",                 target: 1,    pts: 50, cred: 10, xp: 15 },
];
const ACTIVITY_PTS_PER_MIN = 1, ACTIVITY_DAILY_CAP = 300;

// ---------- state ----------
let _uid = null;
let _getState = null, _toast = () => {}, _updateHUD = () => {}, _celebrate = () => {};
let _daily = {};             // crewDaily mirror (all days; we filter by key)
let _unsubs = [];
let _zoneSecs = 0;           // seconds accumulated inside the war area this session
let _lastZoneWrite = 0;
let _lastWeekChecked = "";
let _lastResolveAttempt = 0;
let _lastAreaTickToast = {}; // areaId -> week (one "war dey hot" toast per area per week)
let _resolving = false;

export function initCrewWar({ getState, toast, updateHUD, celebrate }) {
  _getState = getState || null;
  _toast = toast || _toast; _updateHUD = updateHUD || _updateHUD; _celebrate = celebrate || _celebrate;
  // money deposits land here from crews.js (decoupled — no circular import)
  window.addEventListener("kl_crew_deposit", (ev) => {
    try {
      const d = ev.detail || {};
      if (!d.cid || !myCrewId() || d.cid !== myCrewId()) return;
      const pts = Math.max(0, Math.floor((d.amount || 0) / 1000));
      const area = d.area && crewArea(d.area) ? d.area : (crewSummary() && crewSummary().warTarget) || "";
      _bumpDaily({ deposit: (prev) => (prev || 0) + (d.amount || 0) });
      if (area && pts > 0) _addWarPoints(area, pts);
      _updateHUD();
    } catch (e) {}
  });
  // race.js calls window.KLCrewRaceWin(secs) on every finished race
  window.KLCrewRaceWin = () => {
    try {
      if (!myCrewId()) return;
      _bumpDaily({ race: (prev) => (prev || 0) + 1 });
      const area = (crewSummary() && crewSummary().warTarget) || "";
      if (area) _addWarPoints(area, 25);
      _toast("🏁 +25 war points for the Crew!");
    } catch (e) {}
  };
  window._cwSetTarget = (areaId) => setWarTarget(areaId);
  window._cwClaimChallenge = (chId) => claimChallenge(chId);
  window._cwClaimWarReward = (areaId) => claimWarReward(areaId);
}

export function warSetUid(uid) {
  if (_uid === uid) return;
  _uid = uid;
  for (const u of _unsubs) { try { u(); } catch (e) {} }
  _unsubs = [];
  _daily = {}; _zoneSecs = 0; _lastWeekChecked = "";
  if (!uid || !db) return;
  // live mirror of my daily challenge counters (small node — one day key per day)
  const u1 = onValue(ref(db, "players/" + uid + "/crewDaily"), (snap) => {
    _daily = snap.val() || {};
    _updateHUD();
  }, () => {});
  u1.__war = true;
  _unsubs.push(u1);
}

export function setWarTarget(areaId) {
  const c = myCrew();
  if (!c) return { ok: false, msg: "Join a Crew first." };
  if (!(c.role === "leader" || c.role === "coleader")) return { ok: false, msg: "Only Leader / Co-Leader fit set the war target." };
  if (!crewArea(areaId)) return { ok: false, msg: "Unknown area." };
  const o = ownerOf(areaId);
  if (o && o.crewId === c.crewId) return { ok: false, msg: "We already control " + (crewArea(areaId).name) + " — defend am! Deposits still count." };
  const cd = (territoryData()[areaId] && territoryData()[areaId].cooldowns && territoryData()[areaId].cooldowns[c.crewId]) || 0;
  if (cd > Date.now()) return { ok: false, msg: "Cooldown: we lose last week — " + _cooldownLeft(areaId, c.crewId) + " before we fit attack again." };
  const target = o ? "attack [" + o.tag + "] for " + crewArea(areaId).name : "claim " + crewArea(areaId).name;
  return runTransaction(ref(db, "crews/" + c.crewId + "/warTarget"), () => areaId).then(() => {
    _toast("⚔️ War target set — make we " + target + "!");
    _updateHUD();
    return { ok: true, msg: "War target don set." };
  }).catch(() => ({ ok: false, msg: "Network no gree — try again." }));
}

// ---------- war points ----------
async function _addWarPoints(areaId, pts) {
  const c = myCrew();
  if (!c || !crewArea(areaId) || pts <= 0) return;
  const wk = weekKey();
  try {
    await runTransaction(ref(db, "territory/" + areaId + "/war/" + wk + "/" + c.crewId), (cur) => {
      const next = Math.min(100000000, (cur || 0) + Math.min(5000, pts));
      return next;
    });
    await runTransaction(ref(db, "crewMembers/" + c.crewId + "/" + _uid + "/weeklyPts"), (cur) => Math.min(1000000, (cur || 0) + pts));
  } catch (e) {}
}

// ---------- daily challenge counters ----------
async function _bumpDaily(fn) {
  if (!_uid) return;
  const k = dayKey();
  try {
    await runTransaction(ref(db, "players/" + _uid + "/crewDaily/" + k), (cur) => {
      const next = { ...(cur || {}) };
      fn(next);
      next.ts = Date.now();
      return next;
    });
  } catch (e) {}
}
export function todayDaily() { return _daily[dayKey()] || null; }
export function challengeProgress(ch) {
  const d = todayDaily() || {};
  if (ch.id === "deposit") return { cur: d.deposit || 0, done: (d.deposit || 0) >= ch.target };
  if (ch.id === "zone") return { cur: d.zoneMin || 0, done: (d.zoneMin || 0) >= ch.target };
  if (ch.id === "race") return { cur: d.race || 0, done: (d.race || 0) >= ch.target };
  return { cur: 0, done: false };
}
export function challengeClaimed(ch) {
  const d = todayDaily() || {};
  return !!(d.claimed && d.claimed[ch.id]);
}
export async function claimChallenge(chId) {
  const ch = CHALLENGES.find(c => c.id === chId);
  if (!ch) return { ok: false, msg: "Unknown challenge." };
  const c = myCrew();
  if (!c || !_uid) return { ok: false, msg: "Join a Crew first." };
  const p = challengeProgress(ch);
  if (!p.done) return { ok: false, msg: "You never finish am — " + (ch.isMoney ? "₦" + Math.max(0, ch.target - p.cur).toLocaleString() : Math.max(0, ch.target - p.cur) + " left") + " to go." };
  if (challengeClaimed(ch)) return { ok: false, msg: "You don collect this one already today." };
  let claimed = false;
  try {
    await runTransaction(ref(db, "players/" + _uid + "/crewDaily/" + dayKey() + "/claimed/" + ch.id), (cur) => {
      if (cur) return;
      claimed = true;
      return Date.now();
    });
  } catch (e) {}
  if (!claimed) return { ok: false, msg: "Claim no land — try again." };
  const area = (crewSummary() && crewSummary().warTarget) || "";
  if (area) _addWarPoints(area, ch.pts);
  try { await runTransaction(ref(db, "crewMembers/" + c.crewId + "/" + _uid + "/cred"), (cur) => Math.min(10000000, (cur || 0) + ch.cred)); } catch (e) {}
  try { await runTransaction(ref(db, "players/" + _uid + "/cred"), (cur) => Math.min(10000000, (cur || 0) + ch.cred)); } catch (e) {}
  try { await runTransaction(ref(db, "crews/" + c.crewId + "/xp"), (cur) => Math.min(100000000, (cur || 0) + ch.xp)); } catch (e) {}
  _toast("✅ " + ch.name + " done! +" + ch.pts + " war pts, +" + ch.cred + " cred.");
  _updateHUD();
  return { ok: true, msg: "Challenge claimed!" };
}

// ---------- weekly reward (winner crew members claim their own) ----------
export async function claimWarReward(areaId) {
  const c = myCrew();
  if (!c || !_uid) return { ok: false, msg: "Join a Crew first." };
  const o = ownerOf(areaId);
  if (!o || o.crewId !== c.crewId) return { ok: false, msg: "Your Crew no control that area." };
  const wk = (territoryData()[areaId] && territoryData()[areaId].week) || weekKey();
  if (wk !== weekKey()) return { ok: false, msg: "This reward na for the week wey we win am." };
  if (warRewardClaimed(areaId, _uid, wk)) return { ok: false, msg: "You don collect the war reward already." };
  const level = (crewSummary() && crewSummary().level) || 1;
  const amount = warRewardFor(level);
  let claimed = false;
  try {
    await runTransaction(ref(db, "territory/" + areaId + "/rewards/" + wk + "/" + _uid), (cur) => {
      if (cur) return;
      claimed = true;
      return { amount, ts: Date.now() };
    });
  } catch (e) {}
  if (!claimed) return { ok: false, msg: "Claim no land — check network." };
  // credit my own balance (never push to another player)
  let paid = false;
  const viaApi = await serverCredit(amount, "war_reward");
  if (viaApi && viaApi.ok) { paid = true; if (_getState && typeof viaApi.balance === "number") adoptMoney(viaApi.balance, _getState(), true); }
  else {
    try {
      const balRef = ref(db, "economy/" + _uid + "/balance");
      const cur = (await get(balRef)).val();
      if (typeof cur === "number") {
        const fixed = Math.min(999999999999, cur + amount);
        await runTransaction(balRef, () => fixed);
        if (_getState) adoptMoney(fixed, _getState(), true);
        paid = true;
      }
    } catch (e) {}
  }
  try { await runTransaction(ref(db, "players/" + _uid + "/cred"), (cur) => Math.min(10000000, (cur || 0) + 100)); } catch (e) {}
  try { await runTransaction(ref(db, "crewMembers/" + c.crewId + "/" + _uid + "/cred"), (cur) => Math.min(10000000, (cur || 0) + 100)); } catch (e) {}
  _updateHUD();
  if (!paid) _toast("⚠️ Reward recorded but credit fail — report am with screenshot.");
  _celebrate("🏆 War Reward!", "₦" + amount.toLocaleString() + " + 100 cred — [" + c.tag + "] dey control " + (crewArea(areaId) || {}).name + "!");
  return { ok: true, msg: "🏆 War reward collected!" };
}

// ---------- WEEKLY RESOLUTION ----------
// Any client wey notice the week change go settle all 8 areas once. The
// transaction guard (resolvedWeek) make am safe — only the first finisher wins.
async function _resolveArea(areaId) {
  const wk = weekKey();
  const prev = prevWeekKey();
  try {
    const snap = await get(ref(db, "territory/" + areaId));
    const node = snap.val() || {};
    if (node.resolvedWeek === wk) return;                       // another client don settle am
    const scores = (node.war && node.war[prev]) || {};
    const entries = Object.entries(scores).filter(([, v]) => (v || 0) > 0).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
    const oldOwner = node.crewId || null;
    let winnerId = oldOwner;                                     // tie / quiet week → owner keeps
    let topPts = 0;
    if (entries.length) {
      topPts = entries[0][1];
      if (!oldOwner || entries[0][1] > (scores[oldOwner] || 0)) winnerId = entries[0][0];
      else {
        // tie between owner and challenger → owner keeps
        const tied = entries.filter(([, v]) => v === topPts).map(([k]) => k);
        if (!tied.includes(oldOwner) ) winnerId = entries[0][0];
      }
    }
    let crewInfo = null;
    if (winnerId) {
      const cs = await get(ref(db, "crews/" + winnerId));
      const s = cs.val();
      if (s) crewInfo = { crewId: winnerId, crewName: s.name, tag: s.tag, color: s.color };
      else winnerId = oldOwner;                                   // crew don disband — owner keeps
    }
    const took = !!(winnerId && winnerId !== oldOwner);
    await runTransaction(ref(db, "territory/" + areaId), (cur) => {
      const n = cur || {};
      if (n.resolvedWeek === wk) return;                          // lost the race — somebody settle am already
      return {
        ...n,
        crewId: winnerId || null,
        crewName: crewInfo ? crewInfo.crewName : n.crewName,
        tag: crewInfo ? crewInfo.tag : n.tag,
        color: crewInfo ? crewInfo.color : n.color,
        since: took ? Date.now() : (n.since || Date.now()),
        week: wk,
        resolvedWeek: wk,
      };
    });
    // losers with points collect a 7-day cooldown (except the new owner)
    if (took) {
      for (const [cid] of entries) {
        if (cid === winnerId) continue;
        try { await runTransaction(ref(db, "territory/" + areaId + "/cooldowns/" + cid), () => Date.now() + 7 * 86400000); } catch (e) {}
      }
    }
    // tell MY crew if e concern us
    const c = myCrew();
    if (c) {
      const a = crewArea(areaId) || { name: areaId };
      if (took && winnerId === c.crewId) _celebrate("🚩 AREA DON FALL!", "[" + c.tag + "] don take " + a.name + "! Members fit collect war reward now.");
      else if (took && oldOwner === c.crewId) _toast("💔 We lose " + a.name + " — [" + ((crewInfo && crewInfo.tag) || "?") + "] don take am. Regroup, next week na our own!");
      else if (!took && oldOwner === c.crewId) _toast("🛡️ We don defend " + a.name + " — e still be our own!");
    }
  } catch (e) { console.warn("[crew_war] resolve", areaId, e && e.message); }
}

// ---------- TICK (called from the main render loop) ----------
export function tickCrewWar(dt, px, pz) {
  if (!_uid || !db) return;
  // 1) weekly resolution — check only when the week string changes (or on boot)
  const wk = weekKey();
  if (wk !== _lastWeekChecked) {
    _lastWeekChecked = wk;
    _resolveAll();
  }
  // 2) activity inside the crew war area → 1 pt/min (cap 300/day)
  const c = myCrew();
  const target = c && crewSummary() ? crewSummary().warTarget : "";
  if (c && target && crewArea(target)) {
    if (areaAt(px, pz) === target) {
      _zoneSecs += dt;
      if (_zoneSecs >= 60 && Date.now() - _lastZoneWrite >= 55000) {
        _zoneSecs = 0; _lastZoneWrite = Date.now();
        const d = todayDaily() || {};
        if ((d.zonePts || 0) < ACTIVITY_DAILY_CAP) {
          _bumpDaily((n) => { n.zoneMin = (n.zoneMin || 0) + 1; n.zonePts = (n.zonePts || 0) + ACTIVITY_PTS_PER_MIN; });
          _addWarPoints(target, ACTIVITY_PTS_PER_MIN);
        }
      }
      // one-time "war dey hot" nudge per week per area
      const sig = target + "|" + wk;
      if (!_lastAreaTickToast[sig]) {
        _lastAreaTickToast[sig] = true;
        const scores = warScores(target);
        const mine = c ? (scores[wk] || {})[c.crewId] || 0 : 0;
        const o = ownerOf(target);
        if (o && o.crewId === (c && c.crewId)) _toast("🛡️ You dey defend " + crewArea(target).name + " — stay inside make the points dey flow!");
        else _toast("⚔️ Enemy zone! Every minute wey you stay inside " + crewArea(target).name + " na war point for [" + (c ? c.tag : "") + "] (" + mine + " pts so far).");
      }
    }
  }
}

async function _resolveAll() {
  if (_resolving) return;
  _resolving = true;
  try {
    for (const a of CREW_AREAS) {
      await _resolveArea(a.id);
    }
  } finally { _resolving = false; }
}

function _cooldownLeft(areaId, crewId) {
  const cd = (territoryData()[areaId] && territoryData()[areaId].cooldowns && territoryData()[areaId].cooldowns[crewId]) || 0;
  const left = cd - Date.now();
  if (left <= 0) return "";
  const days = Math.ceil(left / 86400000);
  return days + " day" + (days > 1 ? "s" : "");
}

// war standings for the app: [{crewId, pts, name, tag, color}] sorted
export function standingsFor(areaId) {
  const wk = weekKey();
  const scores = warScores(areaId)[wk] || {};
  return Object.entries(scores)
    .map(([cid, pts]) => ({ crewId: cid, pts: pts || 0 }))
    .sort((a, b) => b.pts - a.pts);
}

export function crewWarDbg() {
  return { uid: _uid, daily: todayDaily(), zoneSecs: Math.round(_zoneSecs), week: weekKey(), resolving: _resolving };
}
