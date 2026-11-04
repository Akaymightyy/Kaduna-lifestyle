// src/moneyapi.js — MONEY PROTECTION (Nov 4, Claude fix-list #1).
//
// "Make money change only through a server function, with limits on how much
// a player can gain. Right now a player can give himself money." — before this
// module, main.js pushed the LOCAL balance to Firebase every 5s, so anybody
// who typed `game.state.money = 999999999` in devtools minted money for the
// whole server to see.
//
// How it works now (three layers):
//   1. GUARD — a property lock on game.state.money. Any single increase above
//      the legit ceiling (₦10M — challenge pots and car sales stay below it)
//      is rejected on the spot. Every accepted change is queued as a delta.
//   2. SERVER — the queued deltas go to /api/money (a Vercel serverless
//      function, see api/money.js). The function verifies the player's Firebase
//      ID token, applies per-reason + daily caps, and writes the balance with
//      admin power. The client can no longer write the balance AT ALL once the
//      secure rules are published (FIREBASE_RULES_SECURE.json).
//   3. TRUTH — the server balance is authoritative. After every flush (and a
//      periodic pull) the local mirror adopts the server value, so drift from
//      a stale device or a tampered localStorage is corrected within seconds.
//
// GRACEFUL MODES: probe /api/money on boot. If the API is not deployed (owner
// has not added the env vars yet) the game keeps working exactly as today —
// local money, legacy Firebase mirror — and the Bank app shows a setup hint.
// Once the API answers {ok:true} the protected mode switches on silently.

import { db, auth } from "./firebase.js";
import { ref, get, onValue } from "firebase/database";

const API = "/api/money";
const MAX_STEP = 10_000_000;          // biggest legit single change (pots/sales stay under)
const FLUSH_DELAY = 1200;             // ms — coalesce bursts of deltas into one request
const PULL_EVERY = 90_000;            // ms — periodic "server is truth" pull

let _game = null, _toast = null, _updateHUD = null;
let _serverMode = null;               // null = unknown, true/false
let _queue = [];                      // {id, d(+/-), reason, ts}
let _flushT = null, _pullT = null, _pullUnsub = null;
let _trusted = false;                 // internal writes (server adoption) skip the guard
let _blockedCount = 0;

// ---------- helpers ----------
const _nonce = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
function _idToken() {
  const u = auth?.currentUser;
  if (!u) return Promise.resolve(null);
  return u.getIdToken().catch(() => null);
}

// ---------- guard (layer 1) ----------
export function installMoneyGuard(game, opts = {}) {
  if (!game || game.state.__moneyGuarded) return false;
  const s = game.state;
  let _m = Math.max(0, Math.floor(s.money || 0));
  Object.defineProperty(s, "money", {
    configurable: false,
    enumerable: true,
    get() { return _m; },
    set(v) {
      v = Math.floor(Number(v) || 0);
      const d = v - _m;
      if (!_trusted) {
        if (d > MAX_STEP) {
          // MINT BLOCK: nobody legitimately gains >₦10M in one move.
          _blockedCount++;
          console.warn("[moneyapi] blocked ₦" + d.toLocaleString() + " jump (cheat?)");
          opts.onBlocked?.(d);
          return;                                   // keep the old balance
        }
        if (d > 0) _queue.push({ id: _nonce(), d, reason: "game", ts: Date.now() });
        else if (d < 0) _queue.push({ id: _nonce(), d, reason: "spend", ts: Date.now() });
        _scheduleFlush();
      }
      _trusted = false;
      _m = Math.max(0, Math.min(999999999, v));
    },
  });
  s.__moneyGuarded = true;
  return true;
}

// Tagged earn/spend helpers for NEW features (races, gigs...). They bypass the
// "game" cap by sending their own reason — the SERVER caps each reason.
export function earnMoney(amount, reason) {
  amount = Math.floor(Number(amount) || 0);
  if (amount <= 0 || !_game) return;
  _trusted = true;
  _game.state.money += amount;
  _queue.push({ id: _nonce(), d: amount, reason: reason || "game", ts: Date.now() });
  _scheduleFlush();
}

// ---------- probe + boot (layer 2/3) ----------
export function serverMode() { return _serverMode === true; }
export async function probeMoneyApi() {
  if (_serverMode !== null) return _serverMode;
  try {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(API, { method: "GET", signal: ctl.signal });
    const j = await r.json().catch(() => null);
    _serverMode = !!(j && j.ok);
  } catch (e) { _serverMode = false; }
  return _serverMode;
}

export function initMoneyApi({ game, toast, updateHUD }) {
  _game = game; _toast = toast || (() => {}); _updateHUD = updateHUD || (() => {});
  probeMoneyApi().then((ok) => {
    if (ok) console.log("[moneyapi] protected mode ON — balance dey server hand");
    else console.log("[moneyapi] API no dey — local mode (owner never finish setup)");
  });
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") _flush();
  });
}

// On login: adopt the server balance (or bootstrap it once from the device).
export async function moneyBoot() {
  if (_pullT) { clearInterval(_pullT); _pullT = null; }
  if (_pullUnsub) { try { _pullUnsub(); } catch (e) {} _pullUnsub = null; }
  const ok = await probeMoneyApi();
  if (!ok || !auth?.currentUser) return "local";
  // legacy listener stays for admins who credit by hand in the Console
  const u = auth.currentUser.uid;
  _pullUnsub = onValue(ref(db, "economy/" + u + "/balance"), (snap) => {
    const v = snap.val();
    if (typeof v === "number" && _queue.length === 0) _adopt(v, true);
  });
  _pullT = setInterval(() => { if (_queue.length === 0) _pull(); }, PULL_EVERY);
  return _flush(true);
}

// ---------- flush + adopt ----------
function _scheduleFlush() {
  if (_flushT) return;
  _flushT = setTimeout(async () => { _flushT = null; await _flush(); }, FLUSH_DELAY);
}

function _adopt(bal, quiet) {
  if (!_game || !Number.isFinite(bal)) return;
  adoptMoney(bal, _game.state, quiet);
  _updateHUD?.();
}

// Trusted adoption: set the balance WITHOUT queueing a delta (server truth /
// rollback after a failed op). stateObj defaults to the registered game state.
export function adoptMoney(bal, stateObj, quiet) {
  const s = stateObj || (_game && _game.state);
  if (!s || !Number.isFinite(bal)) return;
  const cur = s.money;
  if (bal === cur) return;
  _trusted = true;
  s.money = bal;
  try { _game?.save?.(); } catch (e) {}
  if (!quiet && Math.abs(bal - cur) > 999 && _toast) _toast("💰 Balance corrected to ₦" + bal.toLocaleString());
}

async function _pull() {
  if (_serverMode !== true || !auth?.currentUser) return;
  const token = await _idToken(); if (!token) return;
  try {
    const r = await fetch(API, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken: token, action: "sync" }) });
    const j = await r.json().catch(() => null);
    if (j && j.ok && typeof j.balance === "number") _adopt(j.balance);
  } catch (e) { /* offline — retry next tick */ }
}

async function _flush(isBoot) {
  if (!auth?.currentUser || !_game) { if (isBoot) return "local"; return; }
  const ok = await probeMoneyApi();
  if (!ok) { if (_queue.length > 200) _queue.length = 0; return "local"; }
  if (_queue.length === 0) { if (isBoot) await _pull(); return "server"; }
  const token = await _idToken();
  if (!token) return "local";
  const ops = _queue.splice(0, _queue.length);
  try {
    const r = await fetch(API, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken: token, action: "batch", ops, local: _game.state.money }) });
    const j = await r.json().catch(() => null);
    if (j && j.ok && typeof j.balance === "number") {
      if (j.rejected && j.rejected.length) {
        const bad = j.rejected[0];
        _toast?.("🛡 ₦" + Math.abs(bad.d).toLocaleString() + " " + (bad.reason === "spend" ? "spend" : "gain") + " no pass — server block am (" + (bad.why || "cap") + ")");
      }
      _adopt(j.balance);
      return "server";
    }
    if (j && j.error === "auth") { _toast?.("🔐 Money session expire — reload the game."); return "auth"; }
    // network/parse hiccup: give the ops one more life
    _queue.unshift(...ops); if (_queue.length > 400) _queue.length = 400;
  } catch (e) {
    _queue.unshift(...ops); if (_queue.length > 400) _queue.length = 400;
  }
  return "error";
}

// ---------- explicit await-able ops (vehicles buy/sell/repair) ----------
// These MUST know the result before continuing, so they hit the API directly
// instead of the queue. Falls back to null when the API is not deployed (the
// caller then uses its legacy runTransaction path).
export async function serverSpend(amount, reason) {
  return _direct(-Math.abs(amount), reason || "spend");
}
export async function serverCredit(amount, reason) {
  return _direct(Math.abs(amount), reason || "game");
}
async function _direct(delta, reason) {
  if (!auth?.currentUser) return null;
  const ok = await probeMoneyApi();
  if (!ok) return null;
  const token = await _idToken();
  if (!token) return null;
  try {
    const r = await fetch(API, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken: token, action: "batch", ops: [{ id: _nonce(), d: delta, reason, ts: Date.now() }], local: _game?.state?.money }) });
    const j = await r.json().catch(() => null);
    if (j && j.ok) {
      const rejected = j.rejected && j.rejected[0];
      if (rejected) return { ok: false, why: rejected.why, balance: j.balance };
      return { ok: true, balance: j.balance };
    }
    return null;
  } catch (e) { return null; }
}

// ---------- test hooks ----------
export function moneyDbg() {
  return { serverMode: _serverMode, queued: _queue.length, blocked: _blockedCount,
           balance: _game ? _game.state.money : null, guarded: !!(_game && _game.state.__moneyGuarded) };
}
export function __flushNow() { return _flush(); }
