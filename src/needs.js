// src/needs.js — needs system, money, rank, phone apps
// CRITICAL: State is keyed by UID in localStorage AND synced to Firebase.
// On login, Firebase is the source of truth. localStorage is just a cache
// so the game doesn't start at zero while waiting for Firebase to load.
import { NEEDS, FOOD_ITEMS, JOBS, RANKS } from "./config.js";

let _uid = null;

export function setGameUid(uid) { _uid = uid; }
export function getGameUid() { return _uid; }

function _storageKey() { return _uid ? "kaduna-state-" + _uid : "kaduna-state-guest"; }

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
      const saved = JSON.parse(localStorage.getItem(_storageKey()));
      if (saved) {
        Object.assign(target, saved);
        target.lastUpdate = Date.now();
      }
    } catch (e) {}
  }

  function save() {
    try { localStorage.setItem(_storageKey(), JSON.stringify({ money: state.money, needs: state.needs, rank: state.rank, jobCooldown: state.jobCooldown, posX: state.posX, posZ: state.posZ, heading: state.heading, look: state.look })); } catch (e) {}
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
      state.needs[need.key] = Math.max(0, Math.min(100, current - need.drainPerMin * mins));
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
