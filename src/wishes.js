// src/wishes.js — Phase 6: 20+ daily wishes that pay POINTS (not naira).
// Points unlock perks (faster skill growth, discount at shops, etc.).
//
// Wishes are deterministic per day per player (same 3 wishes all day).
// Checking happens via main.js game loop — each wish has a check(state) function.
//
// Saved to players/{uid}/wishes/{date} = { picked: [...], claimed: [...], points: N }

import { db } from "./firebase.js";
import { ref, get, set, update, onValue } from "firebase/database";

// ---- Wish pool (24 wishes) ----
export const WISH_POOL = [
  { id: "eat_local",    text: "Eat a local dish (jollof, suya, amala)",   check: (s) => s.mealsToday >= 1, points: 10 },
  { id: "cook_meal",    text: "Cook a meal at home",                       check: (s) => s.cookedToday, points: 15 },
  { id: "work_shift",   text: "Complete a work shift",                     check: (s) => s.jobsToday >= 1, points: 15 },
  { id: "workout",      text: "Do a workout (gym or jog)",                 check: (s) => s.workedOut, points: 20 },
  { id: "make_friend",  text: "Make a new friend",                         check: (s) => s.newFriend, points: 25 },
  { id: "level_skill",  text: "Level up any skill",                        check: (s) => s.skillLeveledUp, points: 30 },
  { id: "visit_place",  text: "Visit 3 different places",                  check: (s) => (s.placesVisitedToday || 0) >= 3, points: 20 },
  { id: "chat_5",       text: "Send 5 chat messages",                      check: (s) => (s.chatsToday || 0) >= 5, points: 15 },
  { id: "pray",         text: "Pray at the mosque or church",              check: (s) => s.prayed, points: 10 },
  { id: "buy_clothes",  text: "Buy something from the boutique",           check: (s) => s.boughtClothing, points: 15 },
  { id: "furniture",    text: "Buy furniture for your home",               check: (s) => s.boughtFurniture, points: 20 },
  { id: "hunt_3",       text: "Find 3 money hunt spots",                   check: (s) => (s.huntsToday || 0) >= 3, points: 25 },
  { id: "eat_3meals",   text: "Eat 3 meals today",                         check: (s) => (s.mealsToday || 0) >= 3, points: 20 },
  { id: "high_energy",  text: "Keep energy above 80 all day",              check: (s) => s.maxEnergyReached, points: 25 },
  { id: "no_sick",      text: "Don't get sick all day",                    check: (s) => !s.gotSick, points: 15 },
  { id: "travel_2",     text: "Travel to 2 different zones",               check: (s) => (s.zonesVisitedToday || 0) >= 2, points: 15 },
  { id: "ride_keke",    text: "Take a keke ride",                          check: (s) => s.tookKeke, points: 10 },
  { id: "check_bank",   text: "Check your bank balance",                   check: (s) => s.checkedBank, points: 5 },
  { id: "change_cloth", text: "Change your outfit",                        check: (s) => s.changedOutfit, points: 10 },
  { id: "sleep_well",   text: "Sleep in your bed",                         check: (s) => s.slept, points: 15 },
  { id: "shower",       text: "Take a shower",                             check: (s) => s.showered, points: 10 },
  { id: "watch_tv",     text: "Watch TV at home",                          check: (s) => s.watchedTV, points: 10 },
  { id: "social_50",    text: "Keep social above 50",                      check: (s) => s.socialHigh, points: 15 },
  { id: "earn_5k",      text: "Earn ₦5,000 today",                         check: (s) => (s.earnedToday || 0) >= 5000, points: 30 },
];

// ---- Perks (unlocked by points) ----
export const PERKS = [
  { id: "fast_learner",  name: "Fast Learner",      cost: 50,  desc: "+10% skill growth",         icon: "📚" },
  { id: "shop_discount", name: "Bargain Hunter",    cost: 80,  desc: "5% off all shops",          icon: "🛍️" },
  { id: "energy_boost",  name: "Energy Boost",      cost: 100, desc: "+20% energy recovery",      icon: "⚡" },
  { id: "lucky_hunter",  name: "Lucky Hunter",      cost: 120, desc: "+10% hunt rewards",         icon: "🍀" },
  { id: "social_butterfly", name: "Social Butterfly", cost: 150, desc: "+20% social gain",        icon: "🦋" },
];

let _uid = null;
let _wishes = { picked: [], claimed: [], points: 0, perks: [] };
let _onUpdate = null;

export function initWishes(uid, onUpdate) {
  _uid = uid;
  _onUpdate = onUpdate;
  if (!uid) return;
  // Load today's wishes
  const today = new Date().toISOString().slice(0, 10);
  onValue(ref(db, "players/" + uid + "/wishes/" + today), (snap) => {
    const val = snap.val();
    if (val) {
      _wishes = { ...{ picked: [], claimed: [], points: 0, perks: [] }, ...val };
    } else {
      // Pick 3 deterministic wishes for today
      _wishes = { picked: _pickWishes(uid, today), claimed: [], points: 0, perks: [] };
      set(ref(db, "players/" + uid + "/wishes/" + today), _wishes);
    }
    _onUpdate?.();
  });
  // Load total points + perks (persistent across days)
  onValue(ref(db, "players/" + uid + "/wishPoints"), (snap) => {
    _wishes.totalPoints = snap.val() || 0;
    _onUpdate?.();
  });
  onValue(ref(db, "players/" + uid + "/perks"), (snap) => {
    _wishes.perks = snap.val() || [];
    _onUpdate?.();
  });
}

function _pickWishes(uid, dateStr) {
  // Deterministic pick: hash uid + date -> 3 indices
  let h = 2166136261;
  const s = uid + ":" + dateStr;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rng = (n) => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const pool = [...WISH_POOL];
  const picked = [];
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const idx = Math.floor(rng(i) * pool.length);
    picked.push(pool[idx].id);
    pool.splice(idx, 1);
  }
  return picked;
}

export function getTodaysWishes() {
  return _wishes.picked.map(id => {
    const w = WISH_POOL.find(x => x.id === id);
    return { ...w, claimed: _wishes.claimed.includes(id) };
  });
}

export function getWishPoints() { return _wishes.totalPoints || 0; }
export function getPerks() { return _wishes.perks || []; }

export function hasPerk(perkId) { return (_wishes.perks || []).includes(perkId); }

// Check a wish against the mission state. If complete + not yet claimed, claim it.
export async function checkWishes(missionState) {
  const today = new Date().toISOString().slice(0, 10);
  for (const id of _wishes.picked) {
    if (_wishes.claimed.includes(id)) continue;
    const w = WISH_POOL.find(x => x.id === id);
    if (!w) continue;
    try {
      if (w.check(missionState)) {
        _wishes.claimed.push(id);
        _wishes.totalPoints = (_wishes.totalPoints || 0) + w.points;
        await update(ref(db, "players/" + _uid + "/wishes/" + today), { claimed: _wishes.claimed });
        await set(ref(db, "players/" + _uid + "/wishPoints"), _wishes.totalPoints);
        return { claimed: w, points: w.points };
      }
    } catch (e) {}
  }
  return null;
}

export async function buyPerk(perkId) {
  const perk = PERKS.find(p => p.id === perkId);
  if (!perk) return { ok: false, msg: "Unknown perk" };
  if ((_wishes.perks || []).includes(perkId)) return { ok: false, msg: "Already owned" };
  if ((_wishes.totalPoints || 0) < perk.cost) return { ok: false, msg: "Need " + perk.cost + " points (you have " + (_wishes.totalPoints || 0) + ")" };
  _wishes.totalPoints -= perk.cost;
  _wishes.perks = [...(_wishes.perks || []), perkId];
  await set(ref(db, "players/" + _uid + "/wishPoints"), _wishes.totalPoints);
  await set(ref(db, "players/" + _uid + "/perks"), _wishes.perks);
  return { ok: true, msg: "🎉 Unlocked perk: " + perk.name + "!" };
}
