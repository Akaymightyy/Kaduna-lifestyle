// src/needs.js — needs system, money, rank, phone apps
// CRITICAL: State is keyed by UID in localStorage AND synced to Firebase.
// On login, Firebase is the source of truth. localStorage is just a cache
// so the game doesn't start at zero while waiting for Firebase to load.
import { NEEDS, FOOD_ITEMS, JOBS, RANKS } from "./config.js";

// BUGFIX: setGameUid() was never called, so EVERY account on a browser shared one save ("kaduna-state-guest"):
// same outfit, gender, money, "character created" flag. Now the save is keyed by the signed-in account. The uid is
// read synchronously from Firebase's own stored session, because the game state is built before auth finishes.
function _readStoredUid() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith("firebase:authUser:")) continue;
      const u = JSON.parse(localStorage.getItem(k));
      if (u && u.uid && !u.isAnonymous) return u.uid;
    }
  } catch (e) {}
  return null;
}
let _uid = _readStoredUid();
try { localStorage.removeItem("kaduna-state-guest"); } catch (e) {}   // old shared save: it belongs to nobody in particular

export function setGameUid(uid) { _uid = uid; }
export function getGameUid() { return _uid; }

// No signed-in account -> nothing is loaded or saved (there is no "guest" save any more).
function _storageKey() { return _uid ? "kaduna-state-" + _uid : null; }

export function createGameState() {
  const state = {
    money: 5000,
    needs: { hunger: 80, energy: 80, fun: 70, social: 60, hygiene: 75, bladder: 85 },
    rank: "newcomer",
    jobCooldown: 0,
    lastUpdate: Date.now(),
    look: { top: "#1f7a5a", bottom: "#2b3a55", skin: "#8a5a3c", hair: "#111111", shoes: "#222222", topStyle: "casual", bottomStyle: "trousers", gender: "male", build: "normal" },
  };
  // Load from UID-keyed localStorage (NOT shared between accounts)
  _loadFromStorage(state);

  function _loadFromStorage(target) {
    try {
      const key = _storageKey(); if (!key) return;
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved) {
        Object.assign(target, saved);
        target.lastUpdate = Date.now();
      }
    } catch (e) {}
  }

  function save() {
    try {
      const key = _storageKey(); if (!key) return;
      localStorage.setItem(key, JSON.stringify({
        money: state.money,
        needs: state.needs,
        rank: state.rank,
        jobCooldown: state.jobCooldown,
        posX: state.posX,
        posZ: state.posZ,
        heading: state.heading,
        look: state.look,
        // Persist origin-related fields too so a page refresh keeps the player's
        // chosen origin, housing tier, rent state, and skill bonuses. Without these,
        // every refresh would forget the origin and re-prompt the origin selector.
        origin: state.origin,
        homeTier: state.homeTier,
        lastRentPaid: state.lastRentPaid,
        missedRent: state.missedRent,
        skillBonus: state.skillBonus,
        weeklyDebt: state.weeklyDebt,
        homeArea: state.homeArea,
        homePlot: state.homePlot,
        // FIX: Also persist look.created so character creator logic works correctly
        // (but Firebase is still the source of truth — checked in main.js)
      }));
    } catch (e) {}
  }

  // Called when Firebase sends us the real balance/look — overrides localStorage
  function syncFromFirebase(fbData) {
    if (fbData.balance != null) { state.money = fbData.balance; }
    if (fbData.look) { state.look = fbData.look; }
    if (fbData.needs) { state.needs = fbData.needs; }
    save();
  }

  function updateNeeds(dt) {
    const mins = dt / 60;
    for (const need of NEEDS) {
      const current = state.needs[need.key] ?? 100;
      // Base drain — modified by NEPA/moodlets/weather via state.drainModifiers
      // (set by main.js from events.js + flavour.js). If not set, use base rate.
      let rate = need.drainPerMin;
      if (state.drainModifiers && state.drainModifiers[need.key]) {
        rate = state.drainModifiers[need.key];
      }
      state.needs[need.key] = Math.max(0, Math.min(100, current - rate * mins));
    }
    for (let i = RANKS.length - 1; i >= 0; i--) {
      if (state.money >= RANKS[i].minMoney) { state.rank = RANKS[i].id; break; }
    }
    if (state.jobCooldown > 0) state.jobCooldown = Math.max(0, state.jobCooldown - dt);
    save();
  }

  function eat(foodId) {
    const food = FOOD_ITEMS.find(f => f.id === foodId);
    if (!food) return { ok: false, error: "Unknown food" };
    if (state.money < food.price) return { ok: false, error: "Not enough money" };
    state.money -= food.price;
    state.needs.hunger = Math.min(100, state.needs.hunger + food.hunger);
    state.needs.fun = Math.min(100, (state.needs.fun ?? 0) + (food.fun ?? 0));
    state.needs.energy = Math.min(100, (state.needs.energy ?? 0) + (food.energy ?? 0));
    save();
    return { ok: true, msg: `You chop ${food.name}! Hunger +${food.hunger}` };
  }

  function work(jobId) {
    const job = JOBS.find(j => j.id === jobId);
    if (!job) return { ok: false, error: "Unknown job" };
    if (state.jobCooldown > 0) return { ok: false, error: `Rest small. Cooldown: ${Math.ceil(state.jobCooldown)}s` };
    if (state.needs.energy < 20) return { ok: false, error: "Too tired. Eat first or rest." };
    state.money += job.pay;
    state.needs.energy = Math.max(0, state.needs.energy - job.energyCost);
    state.needs.fun = Math.max(0, (state.needs.fun ?? 0) - 5);
    state.jobCooldown = 30;
    save();
    return { ok: true, msg: `You worked as ${job.name} and earned ₦${job.pay}!` };
  }

  function getRank() {
    return RANKS.find(r => r.id === state.rank) || RANKS[0];
  }

  return { state, updateNeeds, eat, work, getRank, save, syncFromFirebase };
}

// Clear ALL kaduna state from localStorage (called on logout)
export function clearAllGameState() {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith("kaduna-state"));
    keys.forEach(k => localStorage.removeItem(k));
  } catch (e) {}
}
