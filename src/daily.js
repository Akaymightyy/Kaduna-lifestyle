// src/daily.js — daily login rewards + daily quests
import { db } from "./firebase.js";
import { ref, get, set, update, onValue } from "firebase/database";

const DAILY_REWARDS = [
  { day: 1, money: 500, label: "Day 1: ₦500" },
  { day: 2, money: 1000, label: "Day 2: ₦1,000" },
  { day: 3, money: 1500, label: "Day 3: ₦1,500" },
  { day: 4, money: 2000, label: "Day 4: ₦2,000" },
  { day: 5, money: 3000, label: "Day 5: ₦3,000" },
  { day: 6, money: 5000, label: "Day 6: ₦5,000" },
  { day: 7, money: 10000, label: "Day 7: ₦10,000 — Big Oga bonus!" },
];

const DAILY_QUESTS = [
  { id: "eat", desc: "Eat any food", reward: 300, check: (state) => state.lastAction === "eat" },
  { id: "work", desc: "Complete any job", reward: 500, check: (state) => state.lastAction === "work" },
  { id: "chat", desc: "Send a chat message", reward: 200, check: (state) => state.lastAction === "chat" },
  { id: "travel", desc: "Travel to another zone", reward: 400, check: (state) => state.lastAction === "travel" },
];

export async function checkDailyReward(uid) {
  if (!uid) return null;
  const today = new Date().toISOString().slice(0, 10);
  const rewardRef = ref(db, "daily/" + uid + "/lastClaim");
  const snap = await get(rewardRef);
  const lastClaim = snap.val();
  if (lastClaim === today) return null; // already claimed today

  // Calculate which day they're on
  const streakRef = ref(db, "daily/" + uid + "/streak");
  const streakSnap = await get(streakRef);
  let streak = streakSnap.val() || 0;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (lastClaim === yesterday) streak++;
  else streak = 1;
  streak = Math.min(streak, 7);

  const reward = DAILY_REWARDS[streak - 1];
  await set(rewardRef, today);
  await set(streakRef, streak);
  return reward;
}

export function getDailyRewards() { return DAILY_REWARDS; }
export function getDailyQuests() { return DAILY_QUESTS; }

export async function getDailyStatus(uid) {
  if (!uid) return { claimed: false, streak: 0, quests: [] };
  const today = new Date().toISOString().slice(0, 10);
  const snap = await get(ref(db, "daily/" + uid));
  const data = snap.val() || {};
  return {
    claimed: data.lastClaim === today,
    streak: data.streak || 0,
    quests: DAILY_QUESTS.map(q => ({ ...q, done: data.quests?.[q.id] === today })),
  };
}

export async function claimQuestReward(uid, questId) {
  if (!uid) return;
  const today = new Date().toISOString().slice(0, 10);
  const qRef = ref(db, "daily/" + uid + "/quests/" + questId);
  const snap = await get(qRef);
  if (snap.val() === today) return; // already claimed
  await set(qRef, today);
  const quest = DAILY_QUESTS.find(q => q.id === questId);
  return quest?.reward || 0;
}
