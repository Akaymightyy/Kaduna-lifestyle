// src/capsules.js — FEATURE 1: LETTERS AND TIME CAPSULES.
//
// "Player buries a letter (max 300 chars) and optional small cash gift
// (max ₦50,000, taken from the sender at burying time) at a spot on the map.
// Unlock rule chosen by sender: after 1/7/30 days, OR only when a named
// player walks within 15m. Opening gives the gift ONCE (transaction-guarded);
// sender gets notified; max 5 active capsules; unclaimed ones expire after
// 90 days and the gift returns to the sender."
//
// No server → every "over time" thing (unlock countdown, 90-day expiry,
// sender notification) is COMPUTED FROM STORED TIMESTAMPS on the client,
// never from timers that need the game open. Firebase reads are listeners
// on small nodes only — nothing per-frame.
//
// DATA (two nodes, because RTDB read rules cascade — secrets must not sit
// under a publicly readable path):
//   capsules/$id          — PUBLIC meta (.read: auth != null):
//       owner, ownerName, x, z, kind("days"|"friend"), forUid, forName,
//       unlockAt, days, createdAt, refunded, notified, claim{by,at,paid}
//   capsuleSecrets/$id    — PRIVATE {text(≤300), gift(≤50000)}:
//       readable ONLY by owner / forUid / after unlock (server `now`) /
//       after the claim exists. Created with the capsule, deleted when the
//       capsule is refunded or opened (cleanup).
//   players/$uid/capsules/$id = true — owner-only index (my list).
//
// MONEY: bury takes the gift through the vehicles.js pipeline (serverSpend
// first, legacy read-modify-write fallback, adoptMoney after). The gift is
// credited to the opener through serverCredit with a ₦50k cap — the client
// NEVER writes another player's balance, and the one-time claim is guarded
// by a transaction on capsules/$id/claim (first writer wins), so two players
// tapping at once = exactly one winner.

import * as THREE from "three";
import { db } from "./firebase.js";
import { ref, get, set, update, onValue, push, runTransaction } from "firebase/database";
import { serverSpend, serverCredit, adoptMoney } from "./moneyapi.js";
import { showContext, hideContext, isContextShown } from "./contextmenu.js";
import { getPlayersInRoom } from "./multiplayer.js";
import { reportUser } from "./messages.js";

// ---------- constants ----------
const MAX_ACTIVE = 5;               // active (buried + not yet opened) per player
const MAX_TEXT = 300;
const MAX_GIFT = 50000;
const EXPIRE_MS = 90 * 86400000;    // unclaimed → refund after 90 days
const FRIEND_RADIUS = 15;           // metres — "named player walks within 15m"
const DAY_OPTS = [1, 7, 30];
const VIEW_DIST = 160;              // metres — render mounds only this close
const MAX_MESHES = 14;              // weak-phone cap
const CHIP_DIST = 4.5;              // metres — context chip shows here

const kN = (n) => (n >= 1000000 ? "₦" + (n / 1000000).toFixed(n % 1000000 ? 1 : 0) + "M" : n >= 1000 ? "₦" + Math.round(n / 1000) + "k" : "₦" + (n || 0));

// rule 8 (moderation): every free-text gets a length limit + basic filter.
const BAD_WORDS = ["fuck", "shit", "bitch", "bastard", "asshole", "dick", "pussy", "cunt", "motherfucker", "wanker", "porn", "nigger", "faggot", "rape"];
function cleanText(s) {
  let t = String(s || "").slice(0, MAX_TEXT).trim();
  const rx = new RegExp("(" + BAD_WORDS.join("|") + ")", "gi");
  t = t.replace(rx, (m) => m[0] + "*".repeat(Math.max(1, m.length - 1)));
  return t;
}

// ---------- state ----------
let _scene = null, _getState = null, _getName = null, _toast = () => {}, _updateHUD = () => {}, _celebrate = () => {};
let _uid = null;
let _capsules = {};                 // id -> meta (live listener, public meta node)
let _mine = {};                     // id -> true (owner index listener)
let _unsubCaps = null, _unsubMine = null;
let _busy = new Set();              // bury / open locks
let _px = 0, _pz = 0;               // my last tick position (bury spot + chip range)
let _nameCache = {};                // uid -> display name (opener names, cached)
let _appT = null, _lastChip = "";

const _lock = (k) => { if (_busy.has(k)) return false; _busy.add(k); return true; };
const _unlock = (k) => _busy.delete(k);
const _esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- money (vehicles.js / crews.js pipeline — server first, legacy RMW fallback) ----------
async function _spend(price, reason) {
  if (!_uid) return { ok: false, why: "sign-in" };
  const viaApi = await serverSpend(price, reason);
  if (viaApi) {
    if (!viaApi.ok) return { ok: false, why: "broken", balance: viaApi.balance };
    return { ok: true, newBal: viaApi.balance };
  }
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
// credit MY OWN balance only (gift claim / expiry refund) — never another player
async function _credit(amount, reason) {
  const viaApi = await serverCredit(amount, reason);
  if (viaApi && viaApi.ok) { _adopt(viaApi.balance); return true; }
  try {
    const balRef = ref(db, "economy/" + _uid + "/balance");
    let cur = (await get(balRef)).val();
    if (typeof cur !== "number") {
      // legacy mode + never-funded wallet: bootstrap from the local mirror (same as _spend)
      const s = _getState && _getState();
      cur = Math.max(0, Math.min(999999999999, Math.floor((s && s.money) || 0)));
      try { await set(balRef, cur); } catch (e) { return false; }
    }
    const fixed = Math.min(999999999999, cur + amount);
    await set(balRef, fixed);
    _adopt(fixed);
    return true;
  } catch (e) { console.warn("[capsules] credit failed:", e && e.message); return false; }
}

// ---------- init / login ----------
export function initCapsules({ scene, getState, getName, toast, updateHUD, celebrate }) {
  _scene = scene || null; _getState = getState || null; _getName = getName || null;
  _toast = toast || _toast; _updateHUD = updateHUD || _updateHUD; _celebrate = celebrate || _celebrate;
  // NOTE: the capsules listener attaches in capsulesSetUid() — attaching it
  // pre-auth gets a permanent permission-denied that never recovers after login.
}

export function capsulesSetUid(uid) {
  _uid = uid || null;
  if (_unsubCaps) { try { _unsubCaps(); } catch (e) {} _unsubCaps = null; }
  if (_unsubMine) { try { _unsubMine(); } catch (e) {} _unsubMine = null; }
  _capsules = {}; _mine = {};
  if (_uid) {
    // single public listener — meta only (tiny), never per-frame reads
    _unsubCaps = onValue(ref(db, "capsules"), (snap) => {
      _capsules = snap.val() || {};
      _scanIfOpen();          // claims arrive through THIS listener — notify the sender
      _refreshMineView();
    }, () => {});
    _unsubMine = onValue(ref(db, "players/" + _uid + "/capsules"), (snap) => {
      _mine = snap.val() || {};
      _scanIfOpen();          // notifications + 90-day expiry, computed from timestamps
      _refreshMineView();
    }, () => {});
  }
}

// ---------- sender notifications + 90-day expiry (all computed, no timers) ----------
function _scanIfOpen() {
  if (!_uid || !_mine) return;
  const now = Date.now();
  for (const id of Object.keys(_mine)) {
    const m = _capsules[id];
    if (!m || m.owner !== _uid) continue;
    // 1) "Your letter was opened" — claim exists and I have not seen it
    if (m.claim && m.claim.by && !m.notified) {
      try { set(ref(db, "capsules/" + id + "/notified"), true); } catch (e) {}
      _openerName(m.claim.by).then((nm) => {
        _toast("📬 Your letter don land! " + (nm || "Somebody") + " open am.");
        try { _celebrate("📬 Letter opened!", "Somebody don read your letter."); } catch (e) {}
      });
      continue;
    }
    // 2) 90-day expiry — unclaimed capsules return the gift (timestamp math)
    if (!m.claim && !m.refunded && m.createdAt && now - m.createdAt > EXPIRE_MS) {
      _expireCapsule(id, m);
    }
  }
}

async function _expireCapsule(id, m) {
  if (!_lock("expire" + id)) return;
  try {
    // gift amount lives in the secrets node — owner read is allowed by the rules
    let gift = 0;
    try {
      const sec = (await get(ref(db, "capsuleSecrets/" + id))).val();
      gift = Math.max(0, Math.min(MAX_GIFT, Math.floor(Number(sec && sec.gift) || 0)));
    } catch (e) {}
    if (gift > 0) {
      const ok = await _credit(gift, "capsule_refund");
      if (!ok) return;                        // retry next scan — nothing lost
      _toast("↩️ One time capsule expire — ₦" + gift.toLocaleString() + " don return to you.");
    }
    try { await set(ref(db, "capsules/" + id + "/refunded"), true); } catch (e) {}
    // cleanup order matters: secrets must go BEFORE meta (its delete rule checks
    // capsules/$id/owner — deleting meta first would lock the secrets in place)
    try { await set(ref(db, "capsuleSecrets/" + id), null); } catch (e) {}   // cleanup big text
    try { await set(ref(db, "capsules/" + id), null); } catch (e) {}          // cleanup meta
    try { await set(ref(db, "players/" + _uid + "/capsules/" + id), null); } catch (e) {}
    _refreshMineView();
  } finally { _unlock("expire" + id); }
}

async function _openerName(uid) {
  if (_nameCache[uid]) return _nameCache[uid];
  try {
    const snap = await get(ref(db, "userProfiles/" + uid + "/name"));
    const nm = snap.val() || null;
    if (nm) _nameCache[uid] = nm;
    return nm;
  } catch (e) { return null; }
}

// ---------- bury ----------
export async function buryCapsule({ text, gift, kind, days, friendUid, friendName }) {
  if (!_uid) return { ok: false, msg: "Sign in first." };
  if (!_lock("bury")) return { ok: false, msg: "Wait — one capsule dey process." };
  try {
    const t = cleanText(text);
    if (!t) return { ok: false, msg: "Write something inside the letter na." };
    const g = Math.max(0, Math.min(MAX_GIFT, Math.floor(Number(gift) || 0)));
    const k = kind === "friend" ? "friend" : "days";
    const d = DAY_OPTS.includes(days) ? days : 7;
    // friend capsules need a real target picked from players around you
    let fUid = "", fName = "";
    if (k === "friend") {
      fUid = String(friendUid || "");
      fName = String(friendName || "").slice(0, 24);
      if (!fUid || !fName) return { ok: false, msg: "Pick the person wey go open am." };
    }
    // max 5 ACTIVE capsules (buried + not yet opened/refunded)
    const active = _activeCount();
    if (active >= MAX_ACTIVE) return { ok: false, msg: "You already get " + MAX_ACTIVE + " active capsules. Wait make some open." };

    const id = push(ref(db, "capsules")).key;
    const now = Date.now();
    const unlockAt = k === "days" ? now + d * 86400000 : 0;
    const x = Math.round((_px || 0) * 10) / 10, z = Math.round((_pz || 0) * 10) / 10;

    // 1) take the gift FIRST (sender pays at bury time — server-checked)
    if (g > 0) {
      const spent = await _spend(g, "capsule_gift");
      if (!spent.ok) {
        if (typeof spent.balance === "number") _adopt(spent.balance);
        return { ok: false, msg: "Money no complete for that gift." };
      }
    }
    // 2) secrets first (letter is born private), then public meta, then my index.
    //    If a later step fails we roll the earlier one back — money never lost.
    try {
      await set(ref(db, "capsuleSecrets/" + id), { text: t, gift: g });
    } catch (e) {
      if (g > 0) await _credit(g, "capsule_refund");
      return { ok: false, msg: "Letter write fail — try again.", why: String(e && (e.code || e.message) || e).slice(0, 120), id };
    }
    try {
      await set(ref(db, "players/" + _uid + "/capsules/" + id), true);
    } catch (e) {
      try { await set(ref(db, "capsuleSecrets/" + id), null); } catch (e2) {}
      if (g > 0) await _credit(g, "capsule_refund");
      return { ok: false, msg: "Capsule index fail — money don return. Try again.", why: String(e && (e.code || e.message) || e).slice(0, 120) };
    }
    try {
      await update(ref(db, "capsules"), {
        [id + "/owner"]: _uid,
        [id + "/ownerName"]: String((_getName && _getName()) || "Player").slice(0, 24),
        [id + "/x"]: x,
        [id + "/z"]: z,
        [id + "/kind"]: k,
        [id + "/forUid"]: fUid,
        [id + "/forName"]: fName,
        [id + "/unlockAt"]: unlockAt,
        [id + "/days"]: k === "days" ? d : 0,
        [id + "/createdAt"]: now,
      });
    } catch (e) {
      try { await set(ref(db, "players/" + _uid + "/capsules/" + id), null); } catch (e2) {}
      try { await set(ref(db, "capsuleSecrets/" + id), null); } catch (e2) {}
      if (g > 0) await _credit(g, "capsule_refund");
      return { ok: false, msg: "Capsule write fail — money don return. Try again.", why: String(e && (e.code || e.message) || e).slice(0, 120) };
    }
    _toast("🕳️ Letter don bury!" + (g > 0 ? " ₦" + g.toLocaleString() + " gift inside." : "") + (k === "days" ? " E go open in " + d + " day" + (d > 1 ? "s" : "") + "." : " Only " + fName + " fit open am."));
    _refreshMineView();
    return { ok: true, msg: "Buried.", id };
  } finally { _unlock("bury"); }
}

function _activeCount() {
  let n = 0;
  for (const id of Object.keys(_mine || {})) {
    const m = _capsules[id];
    if (m && !m.refunded && !(m.claim && m.claim.paid)) n++;
  }
  return n;
}

// ---------- open (one-time claim via transaction) ----------
export function canOpen(meta) {
  if (!meta) return { ok: false, why: "gone" };
  if (meta.claim && meta.claim.paid) return { ok: false, why: "opened" };
  const now = Date.now();
  if (meta.kind === "friend") {
    if (meta.forUid && meta.forUid !== _uid) return { ok: false, why: "not-foryou" };
    const dx = (_px || 0) - (meta.x || 0), dz = (_pz || 0) - (meta.z || 0);
    if (dx * dx + dz * dz > FRIEND_RADIUS * FRIEND_RADIUS) return { ok: false, why: "distance" };
    return { ok: true };
  }
  if (!meta.unlockAt || now < meta.unlockAt) return { ok: false, why: "early", leftMs: (meta.unlockAt || now) - now };
  return { ok: true };
}

export async function openCapsule(id) {
  if (!_uid) return { ok: false, msg: "Sign in first." };
  if (!_lock("open")) return { ok: false, msg: "Wait — one capsule dey process." };
  try {
    const m = _capsules[id];
    if (!m) return { ok: false, msg: "This capsule no dey again." };
    const gate = canOpen(m);
    const mine = m.owner === _uid;
    if (!mine && !gate.ok) {
      if (gate.why === "opened") return { ok: false, msg: "Somebody don open this one before." };
      if (gate.why === "not-foryou") return { ok: false, msg: "E no be for you — na for " + (m.forName || "another person") + "." };
      if (gate.why === "distance") return { ok: false, msg: "Waka closer — you dey " + Math.round(Math.hypot(_px - m.x, _pz - m.z)) + "m away." };
      return { ok: false, msg: "🔒 No yet — come back in " + humanLeft(gate.leftMs) + "." };
    }
    // rules re-check the real gate server-side (owner/forUid/unlock time)
    let secret = null;
    try { secret = (await get(ref(db, "capsuleSecrets/" + id))).val(); } catch (e) { secret = null; }
    if (!secret) {
      if (!mine) return { ok: false, msg: "🔒 No yet — come back in " + humanLeft((m.unlockAt || Date.now()) - Date.now()) + "." };
      return { ok: false, msg: "Letter data no dey (probably refunded)." };
    }
    // my own letter = read-only peek, no claim, no credit
    if (mine) { _showLetter(id, m, secret, null); return { ok: true, msg: "read" }; }
    // ONE-TIME claim: first transaction wins; the loser re-runs and aborts.
    let won = false;
    try {
      const res = await runTransaction(ref(db, "capsules/" + id + "/claim"), (cur) => {
        if (cur) return;                    // taken — abort
        return { by: _uid, at: Date.now(), paid: false };
      });
      won = !!res.committed;
    } catch (e) { won = false; }
    if (!won) return { ok: false, msg: "Sharp sharp! Another player don grab am first." };
    // credit MY balance with the gift (server-capped, ₦50k)
    const gift = Math.max(0, Math.min(MAX_GIFT, Math.floor(Number(secret.gift) || 0)));
    if (gift > 0) {
      const okC = await _credit(gift, "capsule_claim");
      if (!okC) {
        try { await set(ref(db, "capsules/" + id + "/claim"), null); } catch (e) {}   // release for retry
        return { ok: false, msg: "Credit fail — claim released. Try again." };
      }
    }
    try { await update(ref(db, "capsules/" + id + "/claim"), { paid: true }); } catch (e) {}
    _showLetter(id, m, secret, gift);
    if (gift > 0) {
      try { _celebrate("📬 ₦" + gift.toLocaleString() + "!", "Letter gift don land."); } catch (e) {}
      _toast("📬 Letter opened — ₦" + gift.toLocaleString() + " gift na your own!");
    } else {
      try { _celebrate("📬 Letter!", "Wetin dey inside sweet."); } catch (e) {}
      _toast("📬 Letter opened.");
    }
    return { ok: true, msg: "opened" };
  } finally { _unlock("open"); }
}

function humanLeft(ms) {
  ms = Math.max(0, ms || 0);
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), mnt = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return d + " day" + (d > 1 ? "s" : "") + (h ? " " + h + "h" : "");
  if (h > 0) return h + "h " + mnt + "m";
  return mnt + " min";
}

// ---------- letter read view (small card, phone-first) ----------
function _showLetter(id, m, secret, gift) {
  const old = document.getElementById("capsule-letter");
  if (old) old.remove();
  const el = document.createElement("div");
  el.id = "capsule-letter";
  const mine = m && m.owner === _uid;
  const who = mine ? "Your own letter" : "From " + (m.ownerName || "a stranger");
  const whenTxt = m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "";
  const claimTxt = m.claim && m.claim.paid ? "📬 Already opened" : "";
  el.style.cssText = "position:fixed;z-index:60;left:50%;top:50%;transform:translate(-50%,-50%);width:min(92vw,340px);" +
    "background:#101114;border:1px solid #33363e;border-radius:16px;padding:16px;box-shadow:0 12px 40px rgba(0,0,0,.6);font:13px Poppins,system-ui,sans-serif;color:#f2f2f4;";
  el.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
      '<div style="font-weight:800;font-size:14px;">✉️ Time Capsule</div>' +
      '<button id="capsule-letter-x" style="background:none;border:none;color:#9b9ba4;font-size:16px;cursor:pointer;">✕</button>' +
    "</div>" +
    '<div style="font-size:11px;color:#9b9ba4;margin-bottom:8px;">' + _esc(who) + " · " + _esc(whenTxt) + (claimTxt ? " · " + claimTxt : "") + "</div>" +
    '<div style="background:#17181b;border-radius:10px;padding:12px;white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.5;max-height:180px;overflow:auto;">' + _esc(secret.text) + "</div>" +
    (mine
      ? '<div style="font-size:11px;color:#9b9ba4;margin-top:8px;">🎁 Gift: ' + kN(secret.gift || 0) + (m.claim && m.claim.paid ? " — don open ✓" : " — still waiting") + "</div>"
      : (gift != null && gift > 0 ? '<div style="font-size:12px;color:#4ade80;margin-top:8px;font-weight:700;">🎁 ₦' + gift.toLocaleString() + " gift don enter your pocket!</div>" : '<div style="font-size:11px;color:#9b9ba4;margin-top:8px;">No cash gift inside — but the word na word.</div>')) +
    '<div style="display:flex;gap:8px;margin-top:12px;">' +
      (mine ? "" : '<button id="capsule-letter-report" style="flex:1;background:transparent;border:1px solid #fb7185;color:#fb7185;border-radius:10px;padding:10px;cursor:pointer;font:600 11px Poppins,sans-serif;">⚑ Report</button>') +
      '<button id="capsule-letter-ok" style="flex:1.4;background:#4ade80;color:#000;border:none;border-radius:10px;padding:10px;cursor:pointer;font:800 12px Poppins,sans-serif;">Done</button>' +
    "</div>";
  document.body.appendChild(el);
  el.querySelector("#capsule-letter-x").onclick = () => el.remove();
  el.querySelector("#capsule-letter-ok").onclick = () => el.remove();
  const rep = el.querySelector("#capsule-letter-report");
  if (rep) rep.onclick = () => { try { reportUser(m.owner, "Time capsule letter gist"); } catch (e) {} el.remove(); };
}

// ---------- 3D mounds ----------
let _geo = null, _glowTex = null;
let _meshes = {};                    // id -> { grp, glow, state }
const MAT = {};

function _ensureShared() {
  if (_geo) return;
  _geo = new THREE.SphereGeometry(0.55, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  MAT.locked = new THREE.MeshLambertMaterial({ color: 0x6b5b3e, emissive: 0x1a150c });
  MAT.open = new THREE.MeshLambertMaterial({ color: 0x8a6d3b, emissive: 0x5a3d10 });
  MAT.opened = new THREE.MeshLambertMaterial({ color: 0x55524a, emissive: 0x111110 });
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, "rgba(255,215,120,0.9)"); gr.addColorStop(0.5, "rgba(242,177,52,0.35)"); gr.addColorStop(1, "rgba(242,177,52,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  _glowTex = new THREE.CanvasTexture(c);
}

function _makeMound(id, m, state) {
  _ensureShared();
  const grp = new THREE.Group();
  const dome = new THREE.Mesh(_geo, MAT[state] || MAT.locked);
  dome.position.y = 0.02;
  grp.add(dome);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: _glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: state === "open" ? 0.95 : state === "locked" ? 0.4 : 0 }));
  spr.scale.set(1.6, 1.6, 1); spr.position.y = 0.55;
  grp.add(spr);
  grp.position.set(m.x || 0, 0, m.z || 0);
  grp.renderOrder = 3;
  grp.userData.capsuleId = id;
  return { grp, glow: spr, state };
}

function _disposeMound(id) {
  const r = _meshes[id];
  if (!r) return;
  if (_scene && r.grp) _scene.remove(r.grp);
  if (r.glow && r.glow.material) r.glow.material.dispose();
  delete _meshes[id];
}

function _moundState(m) {
  if (m.claim && m.claim.paid) return "opened";
  if (canOpen(m).ok) return "open";
  return "locked";
}

// ---------- per-frame tick (visuals + chip only — NO firebase reads) ----------
export function tickCapsules(dt, px, pz) {
  _px = px; _pz = pz;
  if (!_scene) return;
  const t = performance.now() / 1000;
  // pick the nearest interesting capsule in view
  let best = null, bestD = CHIP_DIST * CHIP_DIST;
  const ids = Object.keys(_capsules);
  for (const id of ids) {
    const m = _capsules[id];
    if (!m || m.refunded) { if (_meshes[id]) _disposeMound(id); continue; }
    const dx = px - m.x, dz = pz - m.z;
    const d2 = dx * dx + dz * dz;
    // render meshes only within VIEW_DIST, capped for weak phones
    if (d2 <= VIEW_DIST * VIEW_DIST) {
      const st = _moundState(m);
      const r = _meshes[id];
      if (!r && Object.keys(_meshes).length >= MAX_MESHES) { /* too many — skip creating new */ }
      else if (!r) { _meshes[id] = _makeMound(id, m, st); }
      else if (r.state !== st) { _disposeMound(id); _meshes[id] = _makeMound(id, m, st); }
      const rr = _meshes[id];
      if (rr && rr.glow) rr.glow.material.opacity = (st === "open" ? 0.7 + 0.3 * Math.sin(t * 2.4) : st === "locked" ? 0.28 + 0.12 * Math.sin(t * 1.4) : 0);
    } else if (_meshes[id]) _disposeMound(id);
    // chip target: nearest one worth tapping
    if (d2 < bestD) {
      const st = _moundState(m);
      const mine = m.owner === _uid;
      const relevant = mine || st !== "opened" || (m.claim && m.claim.by === _uid);
      if (relevant) { best = { id, m, st, mine }; bestD = d2; }
    }
  }
  // context chip (small, auto-hides when you walk away — contextmenu handles the radius)
  if (best) {
    const key = "capsule:" + best.id;
    if (!isContextShown(key)) {
      const m = best.m;
      let title, actions;
      if (best.mine) {
        title = "📬 Your letter";
        actions = [{ icon: "👀", label: "Read", run: () => openCapsule(best.id) }];
      } else if (best.st === "open") {
        title = m.kind === "friend" ? "📬 Letter for you!" : "📬 Letter ready!";
        actions = [{ icon: "📬", label: "Open", run: () => openCapsule(best.id) }];
      } else if (best.st === "opened") {
        title = "📭 Opened already";
        actions = [{ icon: "👀", label: "Peek", run: () => openCapsule(best.id) }];
      } else {
        const gate = canOpen(m);
        title = "🔒 Mystery mound";
        actions = [{ icon: "⏳", label: "Check", run: () => openCapsule(best.id) }];
        if (gate.why === "early" && gate.leftMs) title = "🔒 Opens in " + humanLeft(gate.leftMs);
        if (gate.why === "not-foryou") title = "🔒 For " + (m.forName || "another");
      }
      showContext({ key, at: new THREE.Vector3(best.m.x || 0, 0.9, best.m.z || 0), title, actions, radius: CHIP_DIST + 2, getPlayer: () => ({ x: _px, z: _pz }) });
      _lastChip = key;
    }
  } else if (_lastChip && !best) {
    // walked away from every capsule — release OUR chip only (never stomp other systems' chips)
    if (isContextShown(_lastChip)) hideContext(_lastChip);
    _lastChip = "";
  }
}

// ---------- phone app (📬 Letters) ----------
export function renderCapsuleApp() {
  const active = _activeCount();
  const mineIds = Object.keys(_mine || {});
  let h = '<div style="font-size:15px;margin-bottom:6px;font-weight:700;color:#f2f2f4;">📬 Letters & Capsules</div>';
  h += '<div style="font-size:11px;color:#9b9ba4;margin-bottom:10px;">Bury letter for ground — make time (or person) unlock am. Active: <b style="color:#f2b134">' + active + "/" + MAX_ACTIVE + "</b></div>";

  // ---- bury form ----
  h += '<div style="background:#17181b;border:1px solid #33363e;border-radius:12px;padding:12px;margin-bottom:10px;">';
  h += '<div style="font-size:12px;font-weight:700;color:#f2b134;margin-bottom:6px;">🕳️ Bury a letter right where you dey stand</div>';
  h += '<textarea id="cap-text" maxlength="' + MAX_TEXT + '" placeholder="Write your letter (max ' + MAX_TEXT + ' chars)…" style="width:100%;box-sizing:border-box;height:74px;resize:none;padding:10px 12px;border:1px solid #33363e;border-radius:10px;background:#101114;color:#f2f2f4;font:13px Poppins,sans-serif;outline:none;"></textarea>';
  h += '<div id="cap-count" style="text-align:right;font-size:10px;color:#6b7280;margin:2px 0 8px;">0/' + MAX_TEXT + "</div>";
  h += '<div style="font-size:11px;color:#9b9ba4;margin-bottom:4px;">Cash gift (optional, max ' + kN(MAX_GIFT) + ")</div>";
  h += '<div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;">' +
        [0, 5000, 10000, 20000, 50000].map((v) => '<button onclick="window._capGift(' + v + ')" style="flex:1;min-width:52px;background:#101114;border:1px solid #33363e;color:#f2f2f4;border-radius:8px;padding:8px 4px;cursor:pointer;font:600 10px Poppins,sans-serif;">' + (v === 0 ? "None" : kN(v)) + "</button>").join("") + "</div>";
  h += '<input id="cap-gift" type="number" min="0" max="' + MAX_GIFT + '" value="0" inputmode="numeric" placeholder="0" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #33363e;border-radius:10px;background:#101114;color:#f2f2f4;font:13px Poppins,sans-serif;outline:none;margin-bottom:8px;">';
  h += '<div style="font-size:11px;color:#9b9ba4;margin-bottom:4px;">Who go fit open am?</div>';
  h += '<div style="display:flex;gap:6px;margin-bottom:6px;">' +
        '<button id="cap-kind-days" onclick="window._capKind(\'days\')" style="flex:1;background:#4ade80;color:#000;border:none;border-radius:8px;padding:9px 2px;cursor:pointer;font:800 10px Poppins,sans-serif;">After days</button>' +
        '<button id="cap-kind-friend" onclick="window._capKind(\'friend\')" style="flex:1;background:#101114;color:#f2f2f4;border:1px solid #33363e;border-radius:8px;padding:9px 2px;cursor:pointer;font:700 10px Poppins,sans-serif;">One person</button></div>';
  h += '<div id="cap-days-row" style="display:flex;gap:6px;margin-bottom:6px;">' +
        DAY_OPTS.map((d, i) => '<button class="cap-day" onclick="window._capDay(' + d + ')" data-d="' + d + '" style="flex:1;background:' + (d === 7 ? "#f2b134" : "#101114") + ";color:" + (d === 7 ? "#000" : "#f2f2f4") + ';border:1px solid #33363e;border-radius:8px;padding:9px 2px;cursor:pointer;font:700 10px Poppins,sans-serif;">' + d + " day" + (d > 1 ? "s" : "") + "</button>").join("") + "</div>";
  h += '<div id="cap-friend-row" style="display:none;">';
  const roomies = (getPlayersInRoom() || []).filter((p) => p.uid !== _uid).slice(0, 8);
  if (roomies.length === 0) {
    h += '<div style="font-size:10px;color:#9b9ba4;background:#101114;border-radius:8px;padding:8px;margin-bottom:6px;">No other player dey around you now — dem must dey your area before you fit pick.</div>';
  } else {
    h += '<div style="font-size:10px;color:#9b9ba4;margin-bottom:4px;">Pick player near you (dem must later waka within ' + FRIEND_RADIUS + 'm of the mound):</div>';
    h += '<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:6px;max-height:110px;overflow:auto;">' +
          roomies.map((p) => '<button class="cap-friend" onclick="window._capFriend(\'' + p.uid + "','" + _esc(p.name).replace(/'/g, "") + '\')" data-uid="' + p.uid + '" style="text-align:left;background:#101114;border:1px solid #33363e;color:#f2f2f4;border-radius:8px;padding:8px 10px;cursor:pointer;font:600 11px Poppins,sans-serif;">👤 ' + _esc(p.name) + "</button>").join("") + "</div>";
  }
  h += "</div>";
  h += '<button id="cap-bury" onclick="window._capBury()" style="width:100%;background:#4ade80;color:#000;border:none;border-radius:10px;padding:13px;cursor:pointer;font-size:13px;font-weight:800;">🕳️ Bury am here</button>';
  h += "</div>";

  // ---- my capsules ----
  h += '<div style="font-size:12px;font-weight:700;color:#f2f2f4;margin:4px 0 6px;">✉️ My buried letters (' + mineIds.length + ")</div>";
  if (mineIds.length === 0) {
    h += '<div style="font-size:11px;color:#6b7280;background:#17181b;border-radius:10px;padding:12px;">You never bury any letter. Find one sweet spot, drop word (and maybe small cash) — make future catch am. 🕳️</div>';
  } else {
    h += '<div style="display:flex;flex-direction:column;gap:6px;">';
    const now = Date.now();
    for (const id of mineIds) {
      const m = _capsules[id];
      if (!m) { h += '<div style="font-size:11px;color:#6b7280;background:#17181b;border-radius:10px;padding:10px;">…loading letter…</div>'; continue; }
      let badge, color;
      if (m.refunded) { badge = "↩️ Expired — money don return"; color = "#f59e0b"; }
      else if (m.claim && m.claim.paid) { badge = "📬 Opened ✓"; color = "#4ade80"; }
      else if (m.claim) { badge = "📬 dey open…"; color = "#4ade80"; }
      else if (m.kind === "friend") { badge = "⏳ Waiting for " + (m.forName || "your person"); color = "#60a5fa"; }
      else if (m.unlockAt && m.unlockAt > now) { badge = "⏳ Opens in " + humanLeft(m.unlockAt - now); color = "#f2b134"; }
      else { badge = "✅ Ready (anybody fit open)"; color = "#4ade80"; }
      h += '<div style="background:#17181b;border:1px solid #33363e;border-radius:10px;padding:10px;">';
      h += '<div style="display:flex;justify-content:space-between;gap:6px;align-items:center;">';
      h += '<div style="font-size:11px;font-weight:700;color:' + color + ';">' + badge + "</div>";
      h += '<div style="display:flex;gap:4px;">';
      h += '<button onclick="window._capRead(\'' + id + '\')" style="background:#101114;border:1px solid #33363e;color:#f2f2f4;border-radius:8px;padding:6px 10px;cursor:pointer;font:600 10px Poppins,sans-serif;">👀</button>';
      if (!m.refunded && !(m.claim && m.claim.paid)) h += '<button onclick="window._capCheck(\'' + id + '\')" style="background:#101114;border:1px solid #33363e;color:#f2b134;border-radius:8px;padding:6px 10px;cursor:pointer;font:600 10px Poppins,sans-serif;">📍</button>';
      if (m.refunded || (m.claim && m.claim.paid)) h += '<button onclick="window._capClear(\'' + id + '\')" style="background:#101114;border:1px solid #33363e;color:#9b9ba4;border-radius:8px;padding:6px 10px;cursor:pointer;font:600 10px Poppins,sans-serif;">🧹</button>';
      h += "</div></div>";
      h += '<div style="font-size:10px;color:#6b7280;margin-top:4px;">' + (m.days ? "After " + m.days + " day" + (m.days > 1 ? "s" : "") : m.kind === "friend" ? "For " + (m.forName || "one person") : "") + " · buried " + (m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "") + "</div>";
      h += "</div>";
    }
    h += "</div>";
  }
  h += '<button onclick="window.showApp(\'home\')" style="margin-top:14px;background:transparent;border:none;color:#4ade80;cursor:pointer;font-size:13px;font-weight:600;">← Back to Phone</button>';
  return h;
}

// textarea counter + form state (kept OUTSIDE the html so re-render no dey eat typing)
window._capGift = (v) => { const el = document.getElementById("cap-gift"); if (el) { el.value = v; } };
window._capKind = (k) => {
  const dd = document.getElementById("cap-days-row"), fr = document.getElementById("cap-friend-row"),
        bd = document.getElementById("cap-kind-days"), bf = document.getElementById("cap-kind-friend");
  if (!dd || !fr) return;
  const daysMode = k === "days";
  dd.style.display = daysMode ? "flex" : "none";
  fr.style.display = daysMode ? "none" : "block";
  bd.style.background = daysMode ? "#4ade80" : "#101114"; bd.style.color = daysMode ? "#000" : "#f2f2f4";
  bf.style.background = daysMode ? "#101114" : "#4ade80"; bf.style.color = daysMode ? "#f2f2f4" : "#000";
};
let _capDays = 7;
window._capDay = (d) => {
  _capDays = d;
  document.querySelectorAll(".cap-day").forEach((b) => {
    const on = +b.dataset.d === d;
    b.style.background = on ? "#f2b134" : "#101114"; b.style.color = on ? "#000" : "#f2f2f4";
  });
};
let _capFriend = null;
window._capFriend = (uid, name) => {
  _capFriend = { uid, name };
  document.querySelectorAll(".cap-friend").forEach((b) => {
    const on = b.dataset.uid === uid;
    b.style.background = on ? "#4ade80" : "#101114"; b.style.color = on ? "#000" : "#f2f2f4";
  });
};
window._capBury = async () => {
  const tEl = document.getElementById("cap-text"), gEl = document.getElementById("cap-gift");
  if (!tEl) return;
  const friendMode = document.getElementById("cap-friend-row") && document.getElementById("cap-friend-row").style.display === "block";
  const res = await buryCapsule({
    text: tEl.value,
    gift: gEl ? gEl.value : 0,
    kind: friendMode ? "friend" : "days",
    days: _capDays,
    friendUid: _capFriend && _capFriend.uid,
    friendName: _capFriend && _capFriend.name,
  });
  _toast(res.msg || (res.ok ? "Buried." : "No work."));
  if (res.ok) {
    _capFriend = null; _capDays = 7;
    _refreshMineView(true);
  }
};
window._capRead = async (id) => {
  const m = _capsules[id];
  if (!m) return;
  let secret = null;
  try { secret = (await get(ref(db, "capsuleSecrets/" + id))).val(); } catch (e) {}
  if (!secret) { _toast("Letter data no dey (probably refunded)."); return; }
  _showLetter(id, m, secret, null);
};
// clear a TERMINAL capsule (opened or refunded) from my list + the map
window._capClear = async (id) => {
  const m = _capsules[id];
  if (!m || m.owner !== _uid) return;
  const terminal = m.refunded || (m.claim && m.claim.paid);
  if (!terminal) { _toast("E never open — no fit clear am yet."); return; }
  try { await set(ref(db, "capsuleSecrets/" + id), null); } catch (e) {}
  try { await set(ref(db, "capsules/" + id), null); } catch (e) {}
  try { await set(ref(db, "players/" + _uid + "/capsules/" + id), null); } catch (e) {}
  _toast("🧹 Don clear.");
  _refreshMineView(true);
};
window._capCheck = async (id) => {
  const m = _capsules[id];
  if (!m) return;
  const gate = canOpen(m);
  if (gate.ok) _toast("✅ E ready — go the spot open am!");
  else if (gate.why === "early") _toast("⏳ E go open in " + humanLeft(gate.leftMs) + ".");
  else if (gate.why === "not-foryou") _toast("⏳ Waiting for " + (m.forName || "your person") + " to waka reach.");
  else _toast("📍 Go where you bury am.");
};

function _refreshMineView(force) {
  try {
    if (window._showingApp !== "capsule") return;
    const modal = document.getElementById("phone-modal");
    if (!modal || !modal.classList.contains("show")) return;
    const ae = document.activeElement;
    if (!force && ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) return;   // never eat typing
    const c = document.getElementById("phone-content");
    if (c) c.innerHTML = renderCapsuleApp();
  } catch (e) {}
}

export function startCapsuleAppRefresher() {
  if (_appT) clearInterval(_appT);
  _appT = setInterval(() => {
    if (window._showingApp !== "capsule") return;
    const ae = document.activeElement;
    if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) return;
    _refreshMineView();
    const tEl = document.getElementById("cap-text");
    const cnt = document.getElementById("cap-count");
    if (tEl && cnt) cnt.textContent = (tEl.value || "").length + "/" + MAX_TEXT;
  }, 2000);
}

// live updates while the app is open are handled by the listeners above calling
// _refreshMineView() + the 2s refresher (which keeps the char counter fresh).

// ---------- debug ----------
export function capsulesDbg() {
  return { uid: _uid, total: Object.keys(_capsules).length, mine: Object.keys(_mine).length,
           active: _activeCount(), meshes: Object.keys(_meshes).length, px: Math.round(_px), pz: Math.round(_pz) };
}
