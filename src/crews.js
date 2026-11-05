// src/crews.js — CREW CORE (create / join / roles / bank / XP / Street Cred).
//
// "Players should feel proud of their Crew" — this module owns the crew data:
//
//   crews/{crewId}          = { name, tag, color, desc, leader, leaderName, level, xp,
//                               bank, power, membersCount, totalContributed, warTarget, createdAt }
//   crewMembers/{crewId}/{uid} = { name, role, joinedAt, contributed, cred, weeklyPts }
//   crewNames/{nameLower}   = crewId   (unique name claims)
//   crewTags/{TAG}          = crewId   (unique tag claims)
//   players/{uid}/crew      = { crewId, name, tag, role, color }  (fast lookup)
//   players/{uid}/crewTag   = "[KDW]"  (multiplayer.js paints it on your name tag)
//   players/{uid}/cred      = Street Cred — respect wey no dey lost when you switch crew
//
// MONEY — same pipeline as vehicles.js / building.js, never take money on trust:
//   serverSpend() → legacy read-modify-write on economy/{uid}/balance → adoptMoney().
//   If the bank write fails AFTER a successful spend, the money dey refund — no loss.
//   Daily bonus pays through serverCredit() with the same legacy fallback.

import { db } from "./firebase.js";
import { ref, get, set, update, onValue, runTransaction } from "firebase/database";
import { serverSpend, serverCredit, adoptMoney } from "./moneyapi.js";
import {
  CREW_AREAS, areaAt, ownerOf, territoryData, bonusClaimedToday,
  dailyBonusFor, dayKey, weekKey,
} from "./territory.js";

// ---------- TUNING ----------
export const CREW_CREATE_FEE = 250000;
export const MAX_MEMBERS = 40;
export const MAX_LEVEL = 50;
export const DEPOSIT_MIN = 1000, DEPOSIT_MAX = 5000000;
export const CREW_COLORS = ["#e11d48", "#f2b134", "#2e7d4f", "#2563eb", "#7c3aed", "#0891b2", "#ea580c", "#be185d"];
export const ROLES = ["leader", "coleader", "elder", "member"];
export const ROLE_LABEL = { leader: "Leader 👑", coleader: "Co-Leader 🛡️", elder: "Elder ⭐", member: "Member" };
export const xpForNext = (level) => 2500 * Math.max(1, level);
export const slotsFor = (level) => Math.min(MAX_MEMBERS, 10 + 2 * Math.max(1, level));
export const bankCapFor = (level) => 5000000 * Math.max(1, level);

// ---------- state ----------
let _uid = null;
let _getState = null, _getName = null, _toast = () => {}, _updateHUD = () => {}, _celebrate = () => {};
let _myCrew = null;          // players/{uid}/crew value
let _crewSum = null;         // crews/{myCrewId} summary
let _members = {};           // crewMembers/{myCrewId} roster
let _allCrews = {};          // crews — for the browse/rank list
let _unsubs = [];
let _busy = new Set();       // double-tap guards ("create","join","deposit"...)

export function initCrews({ getState, getName, toast, updateHUD, celebrate }) {
  _getState = getState || null; _getName = getName || null;
  _toast = toast || _toast; _updateHUD = updateHUD || _updateHUD; _celebrate = celebrate || _celebrate;
  // window handlers for the phone app (codebase wires UI through window.*)
  window._cwCreate = (name, tag, color, desc) => createCrew(name, tag, color, desc);
  window._cwJoin = (crewId) => joinCrew(crewId);
  window._cwLeave = () => leaveCrew();
  window._cwKick = (uid, name) => kickMember(uid, name);
  window._cwRole = (uid, role) => changeRole(uid, role);
  window._cwTransfer = (uid, name) => transferLeadership(uid, name);
  window._cwDisband = () => disbandCrew();
  window._cwDeposit = (amount, area) => depositToBank(amount, area);
  window._cwWithdraw = (amount) => withdrawFromBank(amount);
  window._cwClaimBonus = (areaId) => claimAreaBonus(areaId);
  window._cwMyName = () => (_getName && _getName()) || "Player";
}

// Per-login listeners — 4 live subscriptions, all small.
export function crewsSetUid(uid) {
  if (_uid === uid) return;
  _uid = uid;
  for (const u of _unsubs) { try { u(); } catch (e) {} }
  _unsubs = [];
  _myCrew = null; _crewSum = null; _members = {}; _allCrews = {};
  if (!uid || !db) return;
  // 1) my membership (fast lookup + drives the rest)
  _unsubs.push(onValue(ref(db, "players/" + uid + "/crew"), (snap) => {
    const v = snap.val();
    const changed = (v && v.crewId) !== (_myCrew && _myCrew.crewId);
    _myCrew = v || null;
    if (changed) {
      _resubscribeCrew();
      try { window.dispatchEvent(new CustomEvent("kl_crew_changed", { detail: { crewId: (v && v.crewId) || null } })); } catch (e) {}
    }
    _updateHUD();
  }, () => {}));
  // 2) crew list (browse + rank)
  _unsubs.push(onValue(ref(db, "crews"), (snap) => { _allCrews = snap.val() || {}; }, () => {}));
  // 3) my Street Cred
  _unsubs.push(onValue(ref(db, "players/" + uid + "/cred"), () => { _updateHUD(); }, () => {}));
}
function _resubscribeCrew() {
  // drop old crew subscriptions
  for (const u of _unsubs.filter(u => u.__crew)) { try { u(); } catch (e) {} }
  _unsubs = _unsubs.filter(u => !u.__crew);
  _crewSum = null; _members = {};
  const cid = _myCrew && _myCrew.crewId;
  if (!cid) return;
  const u1 = onValue(ref(db, "crews/" + cid), (snap) => { _crewSum = snap.val(); }, () => {});
  const u2 = onValue(ref(db, "crewMembers/" + cid), (snap) => { _members = snap.val() || {}; }, () => {});
  u1.__crew = true; u2.__crew = true;
  _unsubs.push(u1, u2);
}

// ---------- getters for the app ----------
export function myCrew() { return _myCrew; }
export function myCrewId() { return (_myCrew && _myCrew.crewId) || null; }
export function myRole() { return (_myCrew && _myCrew.role) || null; }
export function crewSummary() { return _crewSum; }
export function crewMembers() { return _members; }
export function allCrews() { return _allCrews; }
export function myCred() {
  if (!_uid) return 0;
  // cheap local mirror: the member record and player cred both carry it
  const m = _members[_uid];
  return (m && m.cred) || 0;
}
export const isLeader = () => _myCrew && _myCrew.role === "leader";
export const isCoLeader = () => _myCrew && (_myCrew.role === "leader" || _myCrew.role === "coleader");

function _myName() { return ((_getName && _getName()) || "Player").slice(0, 24); }
function _lock(key) { if (_busy.has(key)) return false; _busy.add(key); return true; }
function _unlock(key) { _busy.delete(key); }
const _clean = (s, max) => String(s || "").replace(/[.$#\[\]\/]/g, "").trim().slice(0, max);

// ---------- MONEY (vehicles.js / building.js pipeline) ----------
async function _spend(price, reason) {
  if (!_uid) return { ok: false, why: "sign-in" };
  const viaApi = await serverSpend(price, reason);
  if (viaApi) {
    if (!viaApi.ok) return { ok: false, why: "broken", balance: viaApi.balance };
    return { ok: true, newBal: viaApi.balance };
  }
  // Legacy path (API not deployed): confirmed read-modify-write on the server balance.
  const balRef = ref(db, "economy/" + _uid + "/balance");
  let before = null;
  try { before = (await get(balRef)).val(); } catch (e) {}
  if (typeof before !== "number") {
    const s = _getState && _getState();
    const local = Math.max(0, Math.min(999999999999, Math.floor((s && s.money) || 0)));
    try { await set(balRef, local); } catch (e) { return { ok: false, why: "broken" }; }
    before = local;
  }
  if (before < price) return { ok: false, why: "broken", balance: before };
  const next = before - price;
  try { await set(balRef, next); } catch (e) { return { ok: false, why: "broken", balance: before }; }
  return { ok: true, newBal: next };
}
function _adopt(newBal) {
  const s = _getState && _getState();
  if (s && typeof newBal === "number") adoptMoney(newBal, s, true);
  _updateHUD();
}
// credit MY OWN balance (daily bonus / bank withdraw / refund) — never another player
async function _credit(amount, reason) {
  const viaApi = await serverCredit(amount, reason);
  if (viaApi && viaApi.ok) { _adopt(viaApi.balance); return true; }
  try {
    const balRef = ref(db, "economy/" + _uid + "/balance");
    const cur = (await get(balRef)).val();
    if (typeof cur !== "number") return false;
    const fixed = Math.min(999999999999, cur + amount);
    await set(balRef, fixed);
    _adopt(fixed);
    return true;
  } catch (e) { console.warn("[crews] credit failed:", e && e.message); return false; }
}
async function _addCred(n) {
  if (!_uid || n <= 0) return;
  try {
    await runTransaction(ref(db, "players/" + _uid + "/cred"), (cur) => Math.min(10000000, (cur || 0) + n));
    await runTransaction(ref(db, "crewMembers/" + _myCrew.crewId + "/" + _uid + "/cred"), (cur) => Math.min(10000000, (cur || 0) + n));
  } catch (e) {}
}

// ---------- 1. CREATE A CREW ----------
export async function createCrew(nameRaw, tagRaw, color, descRaw) {
  if (!_uid) return { ok: false, msg: "Sign in first, oga." };
  if (!_lock("create")) return { ok: false, msg: "Wait — e dey process already." };
  try {
    const name = _clean(nameRaw, 24), tag = _clean(tagRaw, 5).toUpperCase(), desc = _clean(descRaw, 140);
    if (name.length < 3) return { ok: false, msg: "Crew name must be at least 3 characters." };
    if (!/^[A-Z0-9]{2,5}$/.test(tag)) return { ok: false, msg: "Tag: 2–5 letters/numbers only (e.g. KDW)." };
    if (!CREW_COLORS.includes(color)) color = CREW_COLORS[0];
    const fee = CREW_CREATE_FEE;
    // 1) take the fee first (refund below if any step fails)
    const spent = await _spend(fee, "crew_create");
    if (!spent.ok) {
      if (typeof spent.balance === "number") _adopt(spent.balance);
      return { ok: false, msg: "You need ₦" + fee.toLocaleString() + " to register a Crew." };
    }
    const crewId = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    // 2) claim the unique name
    let nameClaimed = false;
    try {
      await runTransaction(ref(db, "crewNames/" + name.toLowerCase()), (cur) => {
        if (cur) return;                       // name don already dey taken
        nameClaimed = true;
        return crewId;
      });
    } catch (e) {}
    if (!nameClaimed) { await _credit(fee, "refund_crew"); return { ok: false, msg: "That Crew name don dey taken — pick another." }; }
    // 3) claim the unique tag
    let tagClaimed = false;
    try {
      await runTransaction(ref(db, "crewTags/" + tag), (cur) => {
        if (cur) return;
        tagClaimed = true;
        return crewId;
      });
    } catch (e) {}
    if (!tagClaimed) {
      try { await set(ref(db, "crewNames/" + name.toLowerCase()), null); } catch (e) {}
      await _credit(fee, "refund_crew");
      return { ok: false, msg: "Tag [" + tag + "] don dey taken — pick another tag." };
    }
    // 4) write the crew + leader membership + my crew node
    const now = Date.now();
    const summary = {
      name, tag, color, desc, leader: _uid, leaderName: _myName(),
      level: 1, xp: 0, bank: 0, power: 0, membersCount: 1, totalContributed: 0,
      warTarget: "", createdAt: now,
    };
    try {
      await set(ref(db, "crews/" + crewId), summary);
      await set(ref(db, "crewMembers/" + crewId + "/" + _uid), { name: _myName(), role: "leader", joinedAt: now, contributed: 0, cred: 0, weeklyPts: 0 });
      await update(ref(db, "players/" + _uid), { crew: { crewId, name, tag, role: "leader", color }, crewTag: "[" + tag + "]" });
    } catch (e) {
      // roll back the claims so the name/tag no go waste
      try { await set(ref(db, "crewNames/" + name.toLowerCase()), null); await set(ref(db, "crewTags/" + tag), null); await set(ref(db, "crews/" + crewId), null); await set(ref(db, "crewMembers/" + crewId), null); } catch (e2) {}
      await _credit(fee, "refund_crew");
      return { ok: false, msg: "Network no gree — try again." };
    }
    _celebrate("🛡️ " + tag, "Crew don register! Now gather your people.");
    return { ok: true, msg: "🎉 [" + tag + "] " + name + " don born! You be the Leader.", crewId };
  } finally { _unlock("create"); }
}

// ---------- 2. JOIN / LEAVE ----------
export async function joinCrew(crewId) {
  if (!_uid) return { ok: false, msg: "Sign in first." };
  if (_myCrew) return { ok: false, msg: "You don already dey inside [" + _myCrew.tag + "] — leave am first." };
  if (!_lock("join:" + crewId)) return { ok: false, msg: "Wait — e dey process." };
  try {
    const sumSnap = await get(ref(db, "crews/" + crewId));
    const sum = sumSnap.val();
    if (!sum) return { ok: false, msg: "That Crew no exist again." };
    // gate on the slot count (transaction — two people no go overfill the last seat)
    let seat = false;
    try {
      await runTransaction(ref(db, "crews/" + crewId + "/membersCount"), (cur) => {
        const c = cur || 0;
        if (c >= slotsFor(sum.level || 1)) return;    // full — abort
        seat = true;
        return c + 1;
      });
    } catch (e) {}
    if (!seat) return { ok: false, msg: "[" + sum.tag + "] don full (" + slotsFor(sum.level || 1) + "/" + MAX_MEMBERS + " slots). Level up go open more seats." };
    try {
      await set(ref(db, "crewMembers/" + crewId + "/" + _uid), { name: _myName(), role: "member", joinedAt: Date.now(), contributed: 0, cred: 0, weeklyPts: 0 });
      await update(ref(db, "players/" + _uid), { crew: { crewId, name: sum.name, tag: sum.tag, role: "member", color: sum.color }, crewTag: "[" + sum.tag + "]" });
    } catch (e) {
      try { await runTransaction(ref(db, "crews/" + crewId + "/membersCount"), (cur) => Math.max(0, (cur || 1) - 1)); } catch (e2) {}
      return { ok: false, msg: "Network no gree — try again." };
    }
    _toast("🛡️ Welcome to [" + sum.tag + "] " + sum.name + "!");
    return { ok: true, msg: "🎉 You don join [" + sum.tag + "] " + sum.name + "!" };
  } finally { _unlock("join:" + crewId); }
}

export async function leaveCrew() {
  if (!_uid || !_myCrew) return { ok: false, msg: "You no dey inside any Crew." };
  const cid = _myCrew.crewId;
  if (_myCrew.role === "leader") {
    const count = (_crewSum && _crewSum.membersCount) || 1;
    if (count > 1) return { ok: false, msg: "Leaders must transfer power first (or disband when na only you remain)." };
  }
  if (!_lock("leave")) return { ok: false, msg: "Wait — e dey process." };
  try {
    try {
      await set(ref(db, "crewMembers/" + cid + "/" + _uid), null);
      await runTransaction(ref(db, "crews/" + cid + "/membersCount"), (cur) => Math.max(0, (cur || 1) - 1));
      await update(ref(db, "players/" + _uid), { crew: null, crewTag: null });
    } catch (e) { return { ok: false, msg: "Network no gree — try again." }; }
    _toast("You don leave the Crew. Your Street Cred dey stay with you.");
    return { ok: true, msg: "You don waka comot." };
  } finally { _unlock("leave"); }
}

// ---------- 3. MEMBER MANAGEMENT ----------
export async function kickMember(uid, name) {
  if (!isCoLeader() || !_myCrew) return { ok: false, msg: "Only Leader / Co-Leader fit kick." };
  if (uid === _uid) return { ok: false, msg: "Use Leave if you wan comot." };
  const target = _members[uid];
  if (!target) return { ok: false, msg: "Member no dey again." };
  const myR = ROLES.indexOf(_myCrew.role), tR = ROLES.indexOf(target.role);
  if (tR <= myR) return { ok: false, msg: "You no fit kick person wey rank pass you or equal you." };
  if (!_lock("kick:" + uid)) return { ok: false, msg: "Wait — e dey process." };
  try {
    try {
      await set(ref(db, "crewMembers/" + _myCrew.crewId + "/" + uid), null);
      await runTransaction(ref(db, "crews/" + _myCrew.crewId + "/membersCount"), (cur) => Math.max(0, (cur || 1) - 1));
      // clear their crew node (best-effort — their own client go also clear on next visit)
      try { await update(ref(db, "players/" + uid), { crew: null, crewTag: null }); } catch (e) {}
    } catch (e) { return { ok: false, msg: "Network no gree — try again." }; }
    _toast("👢 " + (name || target.name) + " don comot from the Crew.");
    return { ok: true, msg: "Done." };
  } finally { _unlock("kick:" + uid); }
}

export async function changeRole(uid, role) {
  if (!isCoLeader() || !_myCrew) return { ok: false, msg: "Only Leader / Co-Leader fit change roles." };
  if (!ROLES.includes(role) || role === "leader") return { ok: false, msg: "Use Transfer for Leader handover." };
  const target = _members[uid];
  if (!target) return { ok: false, msg: "Member no dey again." };
  const myR = ROLES.indexOf(_myCrew.role), tR = ROLES.indexOf(target.role);
  if (uid !== _uid && tR >= myR) return { ok: false, msg: "You no fit touch person wey rank pass you." };
  if (role === "coleader" && Object.values(_members).filter(m => m.role === "coleader").length >= 2 && target.role !== "coleader") return { ok: false, msg: "Co-Leaders no go pass 2." };
  if (role === "elder" && Object.values(_members).filter(m => m.role === "elder").length >= 5 && target.role !== "elder") return { ok: false, msg: "Elders no go pass 5." };
  if (myR < ROLES.indexOf(role)) return { ok: false, msg: "You no fit give rank wey pass your own." };
  if (!_lock("role:" + uid)) return { ok: false, msg: "Wait — e dey process." };
  try {
    try { await update(ref(db, "crewMembers/" + _myCrew.crewId + "/" + uid), { role }); } catch (e) { return { ok: false, msg: "Network no gree — try again." }; }
    if (uid === _uid) { const c = { ..._myCrew, role }; try { await update(ref(db, "players/" + _uid), { crew: c }); } catch (e) {} }
    _toast("🏷️ " + (target.name || "Member") + " na now " + (ROLE_LABEL[role] || role));
    return { ok: true, msg: "Done." };
  } finally { _unlock("role:" + uid); }
}

export async function transferLeadership(uid, name) {
  if (!isLeader() || !_myCrew) return { ok: false, msg: "Only the Leader fit transfer power." };
  if (uid === _uid) return { ok: false, msg: "You be Leader already." };
  if (!_members[uid]) return { ok: false, msg: "Member no dey again." };
  if (!_lock("transfer")) return { ok: false, msg: "Wait — e dey process." };
  try {
    try {
      await update(ref(db, "crewMembers/" + _myCrew.crewId + "/" + uid), { role: "leader" });
      await update(ref(db, "crewMembers/" + _myCrew.crewId + "/" + _uid), { role: "coleader" });
      await update(ref(db, "crews/" + _myCrew.crewId), { leader: uid, leaderName: name || _members[uid].name });
      await update(ref(db, "players/" + _uid), { crew: { ..._myCrew, role: "coleader" } });
    } catch (e) { return { ok: false, msg: "Network no gree — try again." }; }
    _celebrate("👑 New Leader!", (name || "Oga") + " don take over [" + _myCrew.tag + "]");
    return { ok: true, msg: "Power don transfer." };
  } finally { _unlock("transfer"); }
}

export async function disbandCrew() {
  if (!isLeader() || !_myCrew) return { ok: false, msg: "Only the Leader fit disband." };
  const cid = _myCrew.crewId;
  const count = (_crewSum && _crewSum.membersCount) || 1;
  if (count > 1) return { ok: false, msg: "Kick everybody first — Crew get " + count + " members." };
  if (!_lock("disband")) return { ok: false, msg: "Wait — e dey process." };
  try {
    try {
      await set(ref(db, "crewMembers/" + cid), null);
      await set(ref(db, "crews/" + cid), null);
      if (_crewSum) {
        try { await set(ref(db, "crewNames/" + String(_crewSum.name).toLowerCase()), null); } catch (e) {}
        try { await set(ref(db, "crewTags/" + _crewSum.tag), null); } catch (e) {}
      }
      await update(ref(db, "players/" + _uid), { crew: null, crewTag: null });
    } catch (e) { return { ok: false, msg: "Network no gree — try again." }; }
    _toast("💥 Crew don scatter. You fit start a new one anytime.");
    return { ok: true, msg: "Crew don disband." };
  } finally { _unlock("disband"); }
}

// ---------- 4. CREW BANK ----------
// Deposit: my money → shared bank (+ war points + crew XP + Street Cred).
// area = which territory the contribution dey push (default: crew warTarget).
export async function depositToBank(amountRaw, areaId) {
  if (!_uid || !_myCrew) return { ok: false, msg: "Join a Crew first." };
  const cid = _myCrew.crewId;
  const amount = Math.floor(Number(amountRaw) || 0);
  if (amount < DEPOSIT_MIN) return { ok: false, msg: "Minimum deposit na ₦" + DEPOSIT_MIN.toLocaleString() + "." };
  if (amount > DEPOSIT_MAX) return { ok: false, msg: "Max deposit na ₦" + DEPOSIT_MAX.toLocaleString() + " — do am small small." };
  const cap = bankCapFor((_crewSum && _crewSum.level) || 1);
  if (amount > cap * 0.9 && (_crewSum && _crewSum.bank || 0) + amount > cap) return { ok: false, msg: "Crew Bank don near cap (₦" + cap.toLocaleString() + "). Level up go raise am." };
  if (!_lock("deposit")) return { ok: false, msg: "Wait — the last deposit dey process." };
  try {
    // 1) take MY money (server-checked)
    const spent = await _spend(amount, "crew_deposit");
    if (!spent.ok) {
      if (typeof spent.balance === "number") _adopt(spent.balance);
      return { ok: false, msg: "Money no enough for that deposit." };
    }
    // 2) grow the shared bank (transaction — no double counting, cap-checked)
    let banked = false;
    try {
      await runTransaction(ref(db, "crews/" + cid + "/bank"), (cur) => {
        const c = cur || 0;
        if (c + amount > 999999999999) return;
        banked = true;
        return c + amount;
      });
    } catch (e) {}
    if (!banked) {
      await _credit(amount, "refund_crew");            // bank write fail → money dey come back
      return { ok: false, msg: "Bank write fail — your money don return. Try again." };
    }
    // 3) crew XP + totals (level up fit trigger here)
    const dxp = Math.floor(amount / 500);
    let leveled = 0;
    try {
      await runTransaction(ref(db, "crews/" + cid), (sum) => {
        if (!sum) return sum;
        const next = { ...sum };
        next.totalContributed = (sum.totalContributed || 0) + amount;
        next.xp = (sum.xp || 0) + dxp;
        let lvl = sum.level || 1;
        while (lvl < MAX_LEVEL && next.xp >= xpForNext(lvl)) { next.xp -= xpForNext(lvl); lvl++; }
        if (lvl !== sum.level) { next.level = lvl; leveled = lvl; }
        next.power = Math.floor((next.bank || 0) / 1000) + 1000 * (next.membersCount || 1) + 500 * (next.level || 1) + Math.floor((next.totalContributed || 0) / 1000);
        return next;
      });
    } catch (e) {}
    // 4) my contribution record
    try {
      await runTransaction(ref(db, "crewMembers/" + cid + "/" + _uid + "/contributed"), (cur) => Math.min(100000000000, (cur || 0) + amount));
    } catch (e) {}
    await _addCred(Math.max(1, Math.floor(amount / 10000)));
    // 5) war points + challenge progress (crew_war.js listens — decoupled via event)
    try { window.dispatchEvent(new CustomEvent("kl_crew_deposit", { detail: { amount, area: areaId || (_crewSum && _crewSum.warTarget) || "", cid } })); } catch (e) {}
    if (leveled) { _celebrate("🏆 Crew Level " + leveled + "!", "[" + (_myCrew.tag || "") + "] " + (_crewSum ? _crewSum.name : "") + " don level up — more slots + bigger bank + stronger bonus!"); }
    else _toast("🤝 ₦" + amount.toLocaleString() + " don enter Crew Bank. Respect!");
    return { ok: true, msg: "₦" + amount.toLocaleString() + " banked! +" + Math.floor(amount / 1000) + " war pts" };
  } finally { _unlock("deposit"); }
}

// Withdraw — Leader / Co-Leader only, and na to DEM OWN pocket (no player-to-player push).
export async function withdrawFromBank(amountRaw) {
  if (!isCoLeader() || !_myCrew) return { ok: false, msg: "Only Leader / Co-Leader fit withdraw." };
  const cid = _myCrew.crewId;
  const amount = Math.floor(Number(amountRaw) || 0);
  if (amount <= 0) return { ok: false, msg: "Enter a valid amount." };
  if (!_lock("withdraw")) return { ok: false, msg: "Wait — e dey process." };
  try {
    let took = false;
    try {
      await runTransaction(ref(db, "crews/" + cid + "/bank"), (cur) => {
        const c = cur || 0;
        if (c < amount) return;                      // not enough — abort
        took = true;
        return c - amount;
      });
    } catch (e) {}
    if (!took) return { ok: false, msg: "Crew Bank no get that kind money." };
    const paid = await _credit(amount, "crew_withdraw");
    if (!paid) {
      await runTransaction(ref(db, "crews/" + cid + "/bank"), (cur) => (cur || 0) + amount);   // put am back
      return { ok: false, msg: "Credit fail — money don go back to bank. Try again." };
    }
    try { await runTransaction(ref(db, "crews/" + cid + "/power"), (cur) => Math.max(0, (cur || 0) - Math.floor(amount / 1000))); } catch (e) {}
    _toast("💸 ₦" + amount.toLocaleString() + " comot from Crew Bank enter your pocket.");
    return { ok: true, msg: "Withdrawn." };
  } finally { _unlock("withdraw"); }
}

// ---------- 5. DAILY AREA BONUS ----------
// Member of the owning crew collects once per day per area wey the crew control.
export async function claimAreaBonus(areaId) {
  if (!_uid || !_myCrew) return { ok: false, msg: "Join a Crew first." };
  const o = ownerOf(areaId);
  if (!o || o.crewId !== _myCrew.crewId) return { ok: false, msg: "Your Crew no control that area." };
  if (bonusClaimedToday(areaId, _uid)) return { ok: false, msg: "You don collect today own already — come back tomorrow." };
  const level = (_crewSum && _crewSum.level) || 1;
  const amount = dailyBonusFor(level);
  if (!_lock("bonus:" + areaId)) return { ok: false, msg: "Wait — e dey process." };
  try {
    let claimed = false;
    try {
      await runTransaction(ref(db, "territory/" + areaId + "/claims/" + dayKey() + "/" + _uid), (cur) => {
        if (cur) return;                              // somebody beat you to it (same uid? no — already claimed)
        claimed = true;
        return { amount, ts: Date.now() };
      });
    } catch (e) {}
    if (!claimed) return { ok: false, msg: "Claim no land — check network." };
    const paid = await _credit(amount, "crew_bonus");
    await _addCred(5);
    if (!paid) _toast("⚠️ Bonus recorded but credit fail — screenshot am and report.");
    _celebrate("🚩 Area Bonus!", "₦" + amount.toLocaleString() + " from " + (o.name || areaId) + " — your crew dey control am.");
    return { ok: true, msg: "🚩 +" + amount.toLocaleString() + " area bonus!" };
  } finally { _unlock("bonus:" + areaId); }
}

// ---------- debug ----------
export function crewsDbg() {
  return {
    uid: _uid, crew: _myCrew ? { id: _myCrew.crewId, tag: _myCrew.tag, role: _myCrew.role } : null,
    level: _crewSum ? _crewSum.level : null, bank: _crewSum ? _crewSum.bank : null,
    members: Object.keys(_members).length, knownCrews: Object.keys(_allCrews).length, busy: [..._busy],
  };
}
