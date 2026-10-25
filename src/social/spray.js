// src/social/spray.js — Lagos-Life style MONEY SPRAYING 💸
//
// Inside any house (or party venue) a player can open "Spray Money", pick who
// to spray from the people currently in the same room, pick a stack size and
// make it rain. Money is REAL: it leaves the sprayer's wallet instantly and is
// credited to the receiver's Firebase balance + both money histories.
//
// Stack sizes (exactly like Lagos Life):
//   ₦1,000    few notes
//   ₦5,000    small stack
//   ₦50,000   bundle
//   ₦500,000  big bundle
//   ₦5,000,000  ODOGWU RAIN — whole party freezes for a second, golden flash
//
// How the money moves (client-authoritative, matches this game's patterns):
//   - Sprayer: game.state.money -= amount + economy/{me}/balance update + log
//     (same pattern main.js uses for every purchase).
//   - Receiver: a `sprays/{id}` record is written; the receiver's client hears
//     it, credits their own balance via transaction (addMoney from economy.js)
//     and logs it — so it shows in both players' money history.
//
// Floating "₦X sprayed on @username" notifications + flying naira notes are
// shown to everybody in the same room (room = multiplayer "place" key: "" city,
// "home:<ownerUid>", or a venue id like "nightclub").

import * as THREE from "three";
import { db } from "../firebase.js";
import { ref, push, update, query, limitToLast, onChildAdded } from "firebase/database";
import { addMoney } from "../economy.js";

// Money-history entry for MY OWN wallet (the wallet itself was already
// debited by spendLocal in main.js — this only appends the log line so the
// spray shows up in the player's money history like every other expense).
async function _logMyMoney(uid, amount, reason) {
  if (!uid) return;
  try {
    await push(ref(db, "economy/" + uid + "/log"), { amount, reason: reason || "unknown", ts: Date.now() });
  } catch (e) { console.warn("[spray] log failed:", e.message); }
}

// ---- config ----
export const SPRAY_STACKS = [
  { id: "s1k",   label: "₦1,000",      amount: 1000,    notes: 3,  desc: "Few notes" },
  { id: "s5k",   label: "₦5,000",      amount: 5000,    notes: 6,  desc: "Small stack" },
  { id: "s50k",  label: "₦50,000",     amount: 50000,   notes: 12, desc: "Bundle" },
  { id: "s500k", label: "₦500,000",    amount: 500000,  notes: 26, desc: "Big bundle" },
  { id: "s5m",   label: "₦5,000,000",  amount: 5000000, notes: 80, desc: "🤑 ODOGWU RAIN", odogwu: true },
];

let _api = null;            // { getUid, getName, getRoom, getBalance, spendLocal, toast, updateHUD, getPeopleInRoom, scene, getPlayerPos, getRemotePlayerPos }
let _panel = null, _listEl = null, _pickedUid = null, _pickedStack = null, _open = false;
let _seenSprays = null;     // Set of spray ids already handled
let _noteTex = null;
const _noteGroups = [];     // active note groups in the scene

// ---- CSS for floating notifications ----
function _ensureCss() {
  if (document.getElementById("spray-css")) return;
  const st = document.createElement("style");
  st.id = "spray-css";
  st.textContent = `
@keyframes sprayFloat { 0% { transform:translate(-50%,0); opacity:0; }
  12% { transform:translate(-50%,-12px); opacity:1; }
  80% { opacity:1; } 100% { transform:translate(-50%,-64px); opacity:0; } }
@keyframes odogwuFlash { 0% { opacity:0; } 15% { opacity:.92; } 100% { opacity:0; } }
@keyframes odogwuPop { 0% { transform:translate(-50%,-50%) scale(.4); opacity:0; }
  18% { transform:translate(-50%,-50%) scale(1.15); opacity:1; }
  30% { transform:translate(-50%,-50%) scale(1); }
  82% { opacity:1; } 100% { transform:translate(-50%,-56%) scale(1.04); opacity:0; } }`;
  document.head.appendChild(st);
}

// ---- naira note texture (shared) ----
function _getNoteTexture() {
  if (_noteTex) return _noteTex;
  const c = document.createElement("canvas");
  c.width = 64; c.height = 32;
  const x = c.getContext("2d");
  x.fillStyle = "#2e7d4f"; x.fillRect(0, 0, 64, 32);
  x.fillStyle = "#256a42"; x.fillRect(0, 0, 64, 5); x.fillRect(0, 27, 64, 5);
  x.fillStyle = "#e8f5e9";
  x.font = "bold 15px Arial"; x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText("₦", 32, 16);
  _noteTex = new THREE.CanvasTexture(c);
  return _noteTex;
}

// ---- 3D flying notes ----
export function sprayNotes(scene, x, y, z, count) {
  if (!scene) return;
  _ensureCss();
  const tex = _getNoteTexture();
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(0.34, 0.17);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true });
  const n = Math.max(1, Math.min(count || 6, 90));
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set((Math.random() - 0.5) * 2.4, 2.4 + Math.random() * 2.2, (Math.random() - 0.5) * 2.4);
    m.rotation.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
    m.userData = {
      vy: -(1.1 + Math.random() * 1.3),
      vr: (Math.random() - 0.5) * 7,
      drift: (Math.random() - 0.5) * 0.7,
      sway: Math.random() * 6.28,
      life: 2.2 + Math.random() * 0.7,
    };
    group.add(m);
  }
  group.position.set(x, y || 0, z);
  scene.add(group);
  _noteGroups.push({ group, t: 0 });
  // hard cap so phones stay smooth
  while (_noteGroups.length > 4) {
    const old = _noteGroups.shift();
    scene.remove(old.group);
  }
}

export function tickSprayNotes(dt) {
  for (let i = _noteGroups.length - 1; i >= 0; i--) {
    const e = _noteGroups[i];
    e.t += dt;
    let alive = false;
    for (const m of e.group.children) {
      const u = m.userData;
      u.life -= dt;
      if (u.life <= 0) { m.visible = false; continue; }
      alive = true;
      m.position.y += u.vy * dt;
      m.position.x += Math.sin(u.sway + e.t * 5) * u.drift * dt;
      m.rotation.x += u.vr * dt;
      m.rotation.z += u.vr * 0.6 * dt;
      if (m.position.y < 0.05) { m.position.y = 0.05; u.vy = 0; u.vr *= 0.9; }
      if (u.life < 0.5 && m.material && m.material.transparent) m.material.opacity = Math.max(0, u.life * 2);
    }
    if (!alive || e.t > 3.4) {
      e.group.parent && e.group.parent.remove(e.group);
      _noteGroups.splice(i, 1);
    }
  }
}

// ---- floating notification ----
export function sprayFloat(text, big) {
  _ensureCss();
  const d = document.createElement("div");
  d.style.cssText =
    "position:fixed;left:50%;top:38%;z-index:70;pointer-events:none;" +
    "background:" + (big ? "linear-gradient(135deg,#b8860b,#f2b134)" : "rgba(15,77,58,.92)") + ";color:#fff;" +
    "padding:" + (big ? "12px 22px" : "7px 14px") + ";border-radius:" + (big ? "16px" : "12px") + ";" +
    "font:" + (big ? "800 17px" : "700 13px") + " Poppins,sans-serif;white-space:nowrap;" +
    "box-shadow:0 6px 22px rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.25);" +
    "animation:sprayFloat 2.4s ease forwards;text-align:center;max-width:92vw;";
  d.textContent = text;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2500);
}

// ---- Odogwu: golden flash + big text + party freeze ----
export function odogwuEffect() {
  _ensureCss();
  const f = document.createElement("div");
  f.style.cssText =
    "position:fixed;inset:0;z-index:69;pointer-events:none;" +
    "background:radial-gradient(circle at 50% 45%, rgba(255,215,0,.9), rgba(255,180,0,.35) 45%, transparent 75%);" +
    "animation:odogwuFlash 1.6s ease forwards;";
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1700);
  const t = document.createElement("div");
  t.style.cssText =
    "position:fixed;left:50%;top:46%;z-index:70;pointer-events:none;color:#fff;" +
    "text-shadow:0 3px 0 #b8860b,0 0 26px rgba(255,215,0,.95);font:900 34px Poppins,sans-serif;" +
    "white-space:nowrap;animation:odogwuPop 1.7s ease forwards;";
  t.textContent = "🤑 ODOGWU RAIN! 🤑";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
  // Pause the party briefly: main.js checks this before applying movement.
  window._kadunaPartyFreezeUntil = Date.now() + 1600;
}

// ---- init ----
export function initSpray(api) { _api = api; _ensureCss(); _listenSprays(); }

export function getSprayRoom() { return (_api && _api.getRoom && _api.getRoom()) || ""; }

// ---- listener: everybody in the room sees sprays; receiver credits self ----
function _listenSprays() {
  if (_seenSprays) return;
  _seenSprays = new Set();
  const q = query(ref(db, "sprays"), limitToLast(30));
  onChildAdded(q, (snap) => {
    const id = snap.key, s = snap.val();
    if (!s || _seenSprays.has(id)) return;
    _seenSprays.add(id);
    if (_seenSprays.size > 200) _seenSprays = new Set(Array.from(_seenSprays).slice(-100));
    if (Date.now() - (s.ts || 0) > 45000) return;         // stale replay — ignore
    // 🛡 SANITY CHECK (Oct 25 security fix): only accept sane, rule-shaped
    // amounts before crediting anybody. FIREBASE_RULES.json already rejects
    // bad sprays at the database, but old rows written before the rules
    // (or a tampered client) could still carry minted/negative amounts —
    // those are ignored here so nobody's wallet is touched by them.
    const amt = s.amount | 0;
    if (!Number.isInteger(amt) || amt <= 0 || amt > 5000000) return;
    if (!s.fromUid || (s.toUid && s.toUid === s.fromUid)) return;  // self-spray mint attempt
    const myUid = _api && _api.getUid && _api.getUid();
    if (s.fromUid === myUid) {
      // My own spray — effects already played locally. Freeze me too if odogwu.
      if (s.odogwu) odogwuEffect();
      return;
    }
    const myRoom = getSprayRoom();
    const forMe = s.toUid === myUid;
    const sameRoom = s.room && s.room === myRoom;
    if (!forMe && !sameRoom) return;
    if (forMe) {
      // 💸 Credit my balance + money history (transaction via economy.js)
      addMoney(myUid, amt, "💸 " + (s.fromName || "Someone") + " sprayed ₦" + amt.toLocaleString() + " on me");
      _api.toast("💸 " + (s.fromName || "Someone") + " sprayed ₦" + amt.toLocaleString() + " on you!");
    }
    // Visuals for everyone in the room
    if (sameRoom || forMe) {
      const p = (_api.getPlayerPos && _api.getPlayerPos()) || { x: 0, z: 0 };
      sprayNotes(_api.scene, p.x, 0, p.z, Math.min(s.notes || 8, 60));
      sprayFloat("💸 ₦" + amt.toLocaleString() + " sprayed on " + (s.toName ? "@" + s.toName : "the party") + " by @" + (s.fromName || "someone"), !!s.odogwu);
      try { window.__sfx && window.__sfx.money && window.__sfx.money(); } catch (e) {}
    }
    if (s.odogwu) odogwuEffect();
  }, () => {});
}

// ---- UI ----
export function openSprayUI() {
  if (!_api || !_api.getUid()) { _api && _api.toast && _api.toast("Sign in to spray money 💸"); return; }
  if (_open) { closeSprayUI(); return; }
  _open = true;
  if (!_panel) _buildPanel();
  _refreshReceivers();
  _panel.style.display = "flex";
}

export function closeSprayUI() {
  _open = false;
  if (_panel) _panel.style.display = "none";
}

function _buildPanel() {
  _panel = document.createElement("div");
  _panel.id = "spray-ui";
  _panel.style.cssText =
    "display:none;position:fixed;left:50%;bottom:calc(76px + env(safe-area-inset-bottom));transform:translateX(-50%);" +
    "z-index:60;width:min(400px,94vw);max-height:min(66vh,470px);overflow-y:auto;flex-direction:column;" +
    "background:#17181b;color:#f2f2f4;border:1px solid #f2b134;border-radius:16px;" +
    "box-shadow:0 10px 34px rgba(0,0,0,.5);font-family:Poppins,system-ui,sans-serif;";
  _panel.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:linear-gradient(135deg,#0f4d3a,#1a1a2e);border-radius:15px 15px 0 0;">' +
    '<div style="flex:1;font-weight:800;font-size:14px;">💸 Spray Money</div>' +
    '<button id="sp-close" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;">✕</button></div>' +
    '<div style="padding:10px 12px 4px;font-size:11px;color:#9fe0b8;font-weight:600;">WHO DEY RECEIVE?</div>' +
    '<div id="sp-people" style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 12px 8px;"></div>' +
    '<div style="padding:2px 12px 4px;font-size:11px;color:#9fe0b8;font-weight:600;">PICK YOUR STACK</div>' +
    '<div id="sp-stacks" style="display:flex;flex-direction:column;gap:6px;padding:4px 12px 8px;"></div>' +
    '<div style="padding:0 12px 12px;"><button id="sp-go" style="width:100%;background:linear-gradient(135deg,#2e7d4f,#4ade80);color:#04150c;border:none;border-radius:12px;padding:13px;font:800 15px Poppins,sans-serif;cursor:pointer;">💸 SPRAY!</button></div>';
  document.body.appendChild(_panel);
  _panel.querySelector("#sp-close").onclick = closeSprayUI;
  _listEl = _panel.querySelector("#sp-people");
  const stackWrap = _panel.querySelector("#sp-stacks");
  for (const s of SPRAY_STACKS) {
    const b = document.createElement("button");
    b.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;gap:8px;background:#22242a;color:#fff;" +
      "border:1px solid #33363e;border-radius:10px;padding:9px 12px;cursor:pointer;font-family:Poppins,sans-serif;text-align:left;";
    b.innerHTML = '<span style="font-weight:800;font-size:14px;">' + s.label + '</span>' +
      '<span style="font-size:10.5px;color:' + (s.odogwu ? "#f2b134" : "#8b8e99") + ';font-weight:600;">' + s.desc + '</span>';
    b.onclick = () => {
      _pickedStack = s;
      for (const c of stackWrap.children) c.style.borderColor = "#33363e";
      b.style.borderColor = "#f2b134";
    };
    stackWrap.appendChild(b);
  }
  _panel.querySelector("#sp-go").onclick = _doSpray;
}

function _refreshReceivers() {
  if (!_listEl) return;
  const people = (_api && _api.getPeopleInRoom && _api.getPeopleInRoom()) || [];
  _listEl.innerHTML = "";
  _pickedUid = null;
  // "The whole party" option always available (crowd spray — fun + no receiver needed)
  const crowd = document.createElement("button");
  crowd.style.cssText = _chipCss();
  crowd.innerHTML = "🎉 The whole party";
  crowd.onclick = () => { _pickedUid = "__crowd"; _markChip(crowd); };
  _listEl.appendChild(crowd);
  if (!people.length) {
    const hint = document.createElement("div");
    hint.style.cssText = "font-size:10.5px;color:#8b8e99;padding:2px 0;width:100%;";
    hint.textContent = "No other players in this room — spray on the crowd + the crew will hype you!";
    _listEl.appendChild(hint);
  }
  for (const p of people) {
    const b = document.createElement("button");
    b.style.cssText = _chipCss();
    b.innerHTML = "👤 " + (p.name || "Player").slice(0, 14);
    b.onclick = () => { _pickedUid = p.uid; _markChip(b); };
    _listEl.appendChild(b);
  }
}
function _chipCss() {
  return "background:#22242a;color:#fff;border:1px solid #33363e;border-radius:999px;padding:7px 12px;cursor:pointer;font:600 12px Poppins,sans-serif;";
}
function _markChip(btn) {
  for (const c of _listEl.children) if (c.style) c.style.borderColor = "#33363e";
  btn.style.borderColor = "#f2b134";
}

// ---- the actual spray ----
async function _doSpray() {
  if (!_pickedStack) { _api.toast("Pick a stack first 💸"); return; }
  const s = _pickedStack;
  const myUid = _api.getUid();
  if (!myUid) { _api.toast("Sign in to spray money 💸"); return; }
  const bal = _api.getBalance();
  if (bal < s.amount) {
    _api.toast("💔 You need ₦" + s.amount.toLocaleString() + " to spray that stack!");
    return;
  }
  const myName = _api.getName() || "Player";
  const toCrowd = _pickedUid === "__crowd";
  let toUid = null, toName = null;
  if (!toCrowd) {
    const p = (_api.getPeopleInRoom() || []).find((x) => x.uid === _pickedUid);
    if (!p) { _api.toast("They left the room — pick someone else"); _refreshReceivers(); return; }
    toUid = p.uid; toName = p.name;
    if (toUid === myUid) { _api.toast("You no fit spray yourself 😅"); return; }
  }
  closeSprayUI();
  // 🛡 SECURE SPRAY (Oct 25 security fix) — ONE atomic multi-path update:
  //   1. sprays/{id} = the spray record
  //   2. economy/{myUid}/balance = balance MINUS the spray amount
  // Firebase applies multi-path updates all-or-nothing, and the new
  // FIREBASE_RULES.json VALIDATES the spray server-side: amount is an
  // integer ₦1..₦5,000,000, receiver ≠ sprayer, and the sender's Firebase
  // balance must cover the amount. If any check fails the WHOLE update is
  // rejected — no spray record, no debit, no minted money. The old flow
  // trusted the phone (local spend + unvalidated write), so a cheater fit
  // spray millions dem no get — that door is closed now.
  const newBal = bal - s.amount;
  const sprayId = push(ref(db, "sprays")).key;
  if (!sprayId) { _api.toast("💔 Network wahala — try again"); return; }
  try {
    // NOTE: modular SDK update() takes a REFERENCE, not the database —
    // a root ref with a multi-path map = one atomic all-or-nothing write.
    await update(ref(db, "/"), {
      ["sprays/" + sprayId]: {
        fromUid: myUid, fromName: myName,
        toUid: toUid || "", toName: toName || "",
        amount: s.amount, notes: s.notes,
        room: getSprayRoom(), odogwu: !!s.odogwu, ts: Date.now(),
      },
      ["economy/" + myUid + "/balance"]: newBal,
    });
  } catch (e) {
    console.warn("[spray] rejected by server rules:", e && (e.stack || e.code || e.message));
    _api.toast("💔 Firebase no accept the spray — make sure your balance don sync (visit anywhere to sync) then try again.");
    return;                                        // NO local changes — nothing spent
  }
  // Server accepted: apply the same debit locally (Firebase is the truth).
  const gs = _api.gameState;
  if (gs) { gs.money = newBal; if (gs.save) gs.save(); }
  // Money history for me (log ONLY — the debit already happened above).
  _logMyMoney(myUid, -s.amount, "💸 Sprayed ₦" + s.amount.toLocaleString() + (toName ? " on @" + toName : " on the party"));
  // Local effects immediately (don't wait for the echo)
  const pp = toUid ? (_api.getRemotePlayerPos(toUid) || _api.getPlayerPos()) : _api.getPlayerPos();
  sprayNotes(_api.scene, pp.x, 0, pp.z, s.notes);
  sprayFloat("💸 ₦" + s.amount.toLocaleString() + " sprayed on " + (toName ? "@" + toName : "the party") + "!", !!s.odogwu);
  try { window.__sfx && window.__sfx.money && window.__sfx.money(); } catch (e) {}
  if (s.odogwu) odogwuEffect();
  // Hype: I dance after a big spray
  if (s.amount >= 50000) window._emote && window._emote("dance", 4);
  _api.updateHUD && _api.updateHUD();
}
