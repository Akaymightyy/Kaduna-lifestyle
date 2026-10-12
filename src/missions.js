// src/missions.js — data-driven mission system
// Chapters, daily missions, weekly missions. All data-driven so you can add more
// without touching engine code.
// Saves to Firebase: players/{uid}/missions/{missionId} = { step, done, ts }

import { db } from "./firebase.js";
import { ref, get, set, update, onValue } from "firebase/database";

// ---- CHAPTER DEFINITIONS ----
export const CHAPTERS = [
  {
    id: "ch1",
    title: "Fresh in Kaduna",
    desc: "Learn the basics of Kaduna life",
    reward: 5000,
    badge: "Newcomer",
    steps: [
      { id: "move", type: "goto", text: "Move around — use the joystick to walk", target: null, check: (state) => state.totalDistance > 10 },
      { id: "eat", type: "buy", text: "Go to Central Market and buy food", target: "central_market", check: (state) => state.lastAction === "eat" },
      { id: "bank", type: "interact", text: "Open your phone and check your bank balance", target: null, check: (state) => state.appsOpened?.includes("bank") },
      { id: "work", type: "earn", text: "Take a job and earn ₦2,000", target: null, check: (state) => state.totalEarned >= 2000 },
      { id: "home", type: "goto", text: "Walk home and rest", target: null, check: (state) => state.lastAction === "rest" },
    ],
  },
  {
    id: "ch2",
    title: "Make Your House a Home",
    desc: "Furnish your house and make it comfortable",
    reward: 10000,
    badge: "Home Owner",
    steps: [
      { id: "furniture", type: "buy", text: "Go to the Mall and buy furniture (bed, fan, TV)", target: "mall_cinema", check: (state) => state.ownedFurniture?.length >= 3 },
      { id: "decorate", type: "interact", text: "Go home and place your furniture", target: null, check: (state) => state.placedFurniture?.length >= 1 },
      { id: "generator", type: "buy", text: "Buy a generator for NEPA outages", target: null, check: (state) => state.ownedFurniture?.some(f => f.id === "generator") },
      { id: "invite", type: "interact", text: "Invite a friend to visit your home", target: null, check: (state) => state.visitorsCount > 0 },
    ],
  },
  {
    id: "ch3",
    title: "Hustle Season",
    desc: "Grind hard and build your wardrobe",
    reward: 20000,
    badge: "Hustler",
    steps: [
      { id: "jobs3", type: "interact", text: "Do 3 different jobs", target: null, check: (state) => state.jobsDone?.length >= 3 },
      { id: "save50k", type: "earn", text: "Reach ₦50,000 total earnings", target: null, check: (state) => state.totalEarned >= 50000 },
      { id: "outfit", type: "buy", text: "Fix an outfit at the Boutique", target: "central_market", check: (state) => state.lastAction === "buyClothing" },
    ],
  },
  {
    id: "ch4",
    title: "Big Move",
    desc: "Save up and upgrade to a bigger house",
    reward: 50000,
    badge: "Big Oga",
    steps: [
      { id: "save", type: "earn", text: "Save enough for a bigger house (₦100,000)", target: null, check: (state) => state.money >= 100000 },
      { id: "browse", type: "interact", text: "View available houses in the Real Estate app", target: null, check: (state) => state.appsOpened?.includes("realestate") },
      { id: "buy", type: "buy", text: "Buy a new house or plot", target: null, check: (state) => state.lastAction === "buyHouse" },
      { id: "move", type: "interact", text: "Move into your new house", target: null, check: (state) => state.lastAction === "moveHouse" },
    ],
  },
  {
    id: "ch5",
    title: "City Legend",
    desc: "Become a legend of Kaduna",
    reward: 100000,
    badge: "City Legend",
    steps: [
      { id: "business", type: "buy", text: "Own a business (suya stand or shop)", target: null, check: (state) => state.ownedBusiness },
      { id: "leaderboard", type: "earn", text: "Reach top 10 on the leaderboard", target: null, check: (state) => state.leaderboardRank <= 10 },
    ],
  },
];

// ---- DAILY MISSIONS (3 random per day) ----
export const DAILY_MISSION_POOL = [
  { id: "d_eat", text: "Eat 3 meals today", check: (s) => (s.mealsToday || 0) >= 3, reward: 500 },
  { id: "d_work", text: "Complete 2 jobs today", check: (s) => (s.jobsToday || 0) >= 2, reward: 800 },
  { id: "d_chat", text: "Send 5 chat messages", check: (s) => (s.chatsToday || 0) >= 5, reward: 300 },
  { id: "d_travel", text: "Travel to 2 different places", check: (s) => (s.placesVisitedToday || 0) >= 2, reward: 600 },
  { id: "d_hunt", text: "Find 3 money spots", check: (s) => (s.huntsToday || 0) >= 3, reward: 1000 },
  { id: "d_visit", text: "Visit a friend's house", check: (s) => s.visitedFriend, reward: 500 },
  { id: "d_shop", text: "Buy something from the boutique", check: (s) => s.boughtClothing, reward: 400 },
  { id: "d_pray", text: "Pray at the mosque or church", check: (s) => s.prayed, reward: 300 },
];

// ---- WEEKLY MISSIONS ----
export const WEEKLY_MISSION_POOL = [
  { id: "w_earn", text: "Earn ₦20,000 this week", check: (s) => (s.earnedThisWeek || 0) >= 20000, reward: 5000 },
  { id: "w_jobs", text: "Complete 10 jobs this week", check: (s) => (s.jobsThisWeek || 0) >= 10, reward: 8000 },
  { id: "w_hunt", text: "Find 15 money spots this week", check: (s) => (s.huntsThisWeek || 0) >= 15, reward: 10000 },
  { id: "w_explore", text: "Visit all 13 places in Kaduna", check: (s) => (s.placesVisitedAll || 0) >= 13, reward: 7000 },
];

// ---- MISSION ENGINE ----
let _uid = null;
let _missions = {}; // { missionId: { step, done, ts } }
let _onUpdate = null;

export function initMissions(uid, onUpdate) {
  _uid = uid;
  _onUpdate = onUpdate;
  // Load from Firebase
  onValue(ref(db, "players/" + uid + "/missions"), (snap) => {
    _missions = snap.val() || {};
    _onUpdate?.(getActiveMission());
  });
}

export function getActiveMission() {
  // Find the first chapter that's not done
  for (const ch of CHAPTERS) {
    const progress = _missions[ch.id];
    if (progress?.done) continue;
    const stepIdx = progress?.step || 0;
    const step = ch.steps[stepIdx];
    if (!step) {
      // All steps done but chapter not marked done → claim reward
      return { chapter: ch, stepIdx: stepIdx, step: null, isComplete: true };
    }
    return { chapter: ch, stepIdx: stepIdx, step: step, isComplete: false };
  }
  return null; // all chapters done
}

export function getAllChapters() {
  return CHAPTERS.map(ch => ({
    ...ch,
    progress: _missions[ch.id] || { step: 0, done: false },
    currentStep: ch.steps[_missions[ch.id]?.step || 0],
  }));
}

export function getDailyMissions() {
  // Pick 3 deterministic daily missions based on date + uid
  const today = new Date().toISOString().slice(0, 10);
  const seed = parseInt(today.replace(/-/g, "") + (_uid || "0").slice(-4), 16) || 42;
  const rng = (n) => { let s = seed + n * 7919; return ((s * 9301 + 49297) % 233280) / 233280; };
  const picked = [];
  const pool = [...DAILY_MISSION_POOL];
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const idx = Math.floor(rng(i) * pool.length);
    picked.push({ ...pool[idx], done: _missions["daily_" + today + "_" + pool[idx].id]?.done || false });
    pool.splice(idx, 1);
  }
  return picked;
}

export function getWeeklyMissions() {
  const week = getWeekKey();
  return WEEKLY_MISSION_POOL.map(m => ({
    ...m,
    done: _missions["weekly_" + week + "_" + m.id]?.done || false,
  }));
}

// Check if a step is complete (called from main.js game loop or on actions)
export function checkStep(gameState) {
  const active = getActiveMission();
  if (!active || active.isComplete) {
    // Chapter complete — claim reward
    if (active?.isComplete && !active.chapter._claimed) {
      claimChapterReward(active.chapter);
      active.chapter._claimed = true;
    }
    return;
  }
  const step = active.step;
  if (!step) return;
  try {
    if (step.check(gameState)) {
      // Step complete — advance
      const ch = active.chapter;
      const newStep = active.stepIdx + 1;
      const isDone = newStep >= ch.steps.length;
      _missions[ch.id] = { step: newStep, done: isDone, ts: Date.now() };
      // Save to Firebase
      set(ref(db, "players/" + _uid + "/missions/" + ch.id), _missions[ch.id]);
      _onUpdate?.(getActiveMission());
      // Toast
      if (isDone) {
        toast(`✅ Chapter "${ch.title}" complete! Reward: ₦${ch.reward.toLocaleString()}`);
      } else {
        toast(`✅ Step complete! Next: ${ch.steps[newStep]?.text || "Done!"}`);
      }
    }
  } catch (e) { /* check function may not have all state */ }
}

async function claimChapterReward(ch) {
  // Add reward money to Firebase
  const balRef = ref(db, "economy/" + _uid + "/balance");
  const snap = await get(balRef);
  const cur = snap.val() || 0;
  await set(balRef, cur + ch.reward);
  toast(`🎉 ${ch.title} reward: ₦${ch.reward.toLocaleString()} + "${ch.badge}" badge!`);
}

// Mark a daily/weekly mission as done
export async function claimDailyReward(missionId) {
  const today = new Date().toISOString().slice(0, 10);
  const key = "daily_" + today + "_" + missionId;
  if (_missions[key]?.done) return;
  const mission = DAILY_MISSION_POOL.find(m => m.id === missionId);
  if (!mission) return;
  _missions[key] = { done: true, ts: Date.now() };
  await set(ref(db, "players/" + _uid + "/missions/" + key), _missions[key]);
  // Add reward
  const balRef = ref(db, "economy/" + _uid + "/balance");
  const snap = await get(balRef);
  const cur = snap.val() || 0;
  await set(balRef, cur + mission.reward);
  toast(`💰 Daily mission reward: ₦${mission.reward.toLocaleString()}`);
}

export async function claimWeeklyReward(missionId) {
  const week = getWeekKey();
  const key = "weekly_" + week + "_" + missionId;
  if (_missions[key]?.done) return;
  const mission = WEEKLY_MISSION_POOL.find(m => m.id === missionId);
  if (!mission) return;
  _missions[key] = { done: true, ts: Date.now() };
  await set(ref(db, "players/" + _uid + "/missions/" + key), _missions[key]);
  const balRef = ref(db, "economy/" + _uid + "/balance");
  const snap = await get(balRef);
  const cur = snap.val() || 0;
  await set(balRef, cur + mission.reward);
  toast(`💰 Weekly mission reward: ₦${mission.reward.toLocaleString()}`);
}

function getWeekKey() {
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return d.getFullYear() + "_W" + week;
}

function toast(msg) {
  const t = document.getElementById("toast");
  if (t) { t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 3000); }
}

// Track game state for mission checks
export function createMissionState() {
  return {
    totalDistance: 0,
    totalEarned: 0,
    lastAction: null,
    appsOpened: [],
    mealsToday: 0,
    jobsToday: 0,
    chatsToday: 0,
    placesVisitedToday: 0,
    huntsToday: 0,
    visitedFriend: false,
    boughtClothing: false,
    prayed: false,
    ownedFurniture: [],
    placedFurniture: [],
    visitorsCount: 0,
    jobsDone: [],
    ownedBusiness: false,
    leaderboardRank: 999,
    earnedThisWeek: 0,
    jobsThisWeek: 0,
    huntsThisWeek: 0,
    placesVisitedAll: 0,
    money: 0,
  };
}
