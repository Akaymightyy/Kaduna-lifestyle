// src/spy_missions.js — Capital Heat-style spy/agent missions.
//
// 6 story-driven missions with cutscenes, briefings, code-breaking
// minigame, star ratings, big money rewards (₦500k → ₦10M).
//
// Each mission:
//   id, code (display code), name, contact (NPC name),
//   storyIntro (cutscene dialogue text — long-form),
//   briefing (objective text),
//   difficulty (3-8 = number of code segments to crack),
//   reward (₦ naira), xp, unlockTag (e.g. "AGENT" name tag)
//
// Progress saved to Firebase:
//   players/{uid}/spyMissions/{missionId} = {
//     completed: true/false,
//     stars: 0-3,
//     bestTime: ms,
//     attempts: number,
//     completedAt: timestamp,
//   }
//
// Wire-up (in main.js):
//   import { initSpyMissions, getSpyMissions, getSpyMissionProgress,
//            startSpyMission, completeSpyMission, getMyUnlockTag } from "./spy_missions.js";
//   initSpyMissions({ db, getUserId, getGameState, toast, onUpdate });

import { ref, get, set, update, onValue } from "firebase/database";

let _db = null;
let _getUserId = () => null;
let _getGameState = () => null;
let _toast = () => {};
let _onUpdate = null;
let _unsub = null;
let _progress = {};  // { missionId: { completed, stars, bestTime, attempts, completedAt } }

export const SPY_MISSIONS = [
  {
    id: "sm1_recruitment",
    code: "OP-001",
    name: "Agent Recruitment",
    contact: "Atlas",
    difficulty: 3,
    reward: 500000,
    xp: 100,
    unlockTag: null,
    storyIntro: "AGENT, I'm Atlas. The Kaduna Intelligence Agency (KIA) has been watching you. Word on the street is you've got quick fingers + a calm head.\n\nWe need fresh talent. But first, you need to prove you can handle pressure.\n\nDecode the entry code to enter the Programme. Get one wrong — you're out. Get them all right — you're in.",
    briefing: "Decode the 3-segment entry code. Watch the colour pattern flash, then tap it back in the same order.",
  },
  {
    id: "sm2_kawo_brief",
    code: "OP-002",
    name: "The Kawo Brief",
    contact: "Atlas",
    difficulty: 4,
    reward: 1500000,
    xp: 200,
    unlockTag: null,
    storyIntro: "Good work, agent.\n\nWe intercepted a coded message at Kawo Motor Park. A courier is leaving in 30 minutes with the location of a hidden arms cache.\n\nCrack the 4-segment code before the courier boards his bus.",
    briefing: "Decode the 4-segment courier message. Pattern flashes — tap it back exactly.",
  },
  {
    id: "sm3_sabon_stakeout",
    code: "OP-003",
    name: "Sabon Tasha Stakeout",
    contact: "Atlas",
    difficulty: 5,
    reward: 3000000,
    xp: 300,
    unlockTag: "ASSET",
    storyIntro: "Agent, you're moving up.\n\nA high-value target is meeting a contact at a Sabon Tasha teashop. We need their phone unlocked to identify the network.\n\nThe pin is 5 segments. One wrong tap → phone wipes. Stay sharp.",
    briefing: "Crack the 5-segment phone pin. Watch carefully — the pattern won't repeat.",
  },
  {
    id: "sm4_barnawa_heist",
    code: "OP-004",
    name: "The Barnawa Bank Heist",
    contact: "Atlas",
    difficulty: 6,
    reward: 5000000,
    xp: 500,
    unlockTag: "OPERATIVE",
    storyIntro: "Insiders tipped us off — a heist is planned on Barnawa Bank tomorrow.\n\nWe need to disarm the silent alarm BEFORE they hit it. The disarm code is 6 segments.\n\nGet it wrong → alarm trips, we lose them. Get it right → we trap them in the act.",
    briefing: "Disarm the 6-segment alarm. Watch the technician's sequence — tap it back exactly.",
  },
  {
    id: "sm5_malali_extraction",
    code: "OP-005",
    name: "The Malali Extraction",
    contact: "Atlas",
    difficulty: 7,
    reward: 7000000,
    xp: 750,
    unlockTag: "AGENT",
    storyIntro: "Our agent in Malali — call him Shadow — is compromised.\n\nHis safe house has a 7-segment code. If you can't crack it in time, he gets made. If you do, he walks out clean.\n\nThis one's personal, agent. Shadow has a family.",
    briefing: "Crack the 7-segment safe house code. The pattern is longer — stay focused.",
  },
  {
    id: "sm6_conspiracy",
    code: "OP-006",
    name: "The Ahmadu Bello Conspiracy",
    contact: "Atlas",
    difficulty: 8,
    reward: 10000000,
    xp: 1000,
    unlockTag: "GHOST",
    storyIntro: "The biggest job yet, agent.\n\nA conspiracy runs along Ahmadu Bello Way. The master code is 8 segments — the longest we've ever asked you to crack.\n\nDecode it, and we shut them down. Fail, and Kaduna burns.\n\nThis is why we recruited you. Show us what you've got.",
    briefing: "Decode the 8-segment master code. The future of Kaduna is in your hands.",
  },
];

export function initSpyMissions({ db, getUserId, getGameState, toast, onUpdate }) {
  _db = db;
  _getUserId = getUserId;
  _getGameState = getGameState;
  _toast = toast;
  _onUpdate = onUpdate;
  // Subscribe to my spy mission progress
  const uid = _getUserId();
  if (uid && _db) {
    if (_unsub) _unsub();
    _unsub = onValue(ref(_db, "players/" + uid + "/spyMissions"), (snap) => {
      _progress = snap.val() || {};
      _onUpdate?.();
    });
  }
}

export function getSpyMissions() {
  return SPY_MISSIONS;
}

export function getSpyMission(id) {
  return SPY_MISSIONS.find(m => m.id === id);
}

export function getSpyMissionProgress(missionId) {
  return _progress[missionId] || null;
}

export function isMissionUnlocked(missionId) {
  const idx = SPY_MISSIONS.findIndex(m => m.id === missionId);
  if (idx <= 0) return true;  // first mission always unlocked
  const prev = SPY_MISSIONS[idx - 1];
  const prevProg = _progress[prev.id];
  return !!(prevProg && prevProg.completed);
}

export function getCompletedCount() {
  return SPY_MISSIONS.filter(m => _progress[m.id]?.completed).length;
}

export function getTotalReward() {
  return SPY_MISSIONS.reduce((sum, m) => sum + m.reward, 0);
}

export function getEarnedReward() {
  return SPY_MISSIONS.reduce((sum, m) => {
    const p = _progress[m.id];
    return sum + (p?.completed ? m.reward : 0);
  }, 0);
}

// Get the highest unlock tag earned (used to show in the player's name)
export function getMyUnlockTag() {
  let highest = null;
  for (const m of SPY_MISSIONS) {
    const p = _progress[m.id];
    if (p?.completed && m.unlockTag) {
      highest = m.unlockTag;
    }
  }
  return highest;
}

// ---- Mark a mission as completed + pay out the reward ----
// Called by spy_mission_ui.js when the minigame finishes successfully.
export async function completeSpyMission(missionId, stars, timeMs) {
  if (!_db) { _toast("Spy system not ready"); return false; }
  const uid = _getUserId();
  if (!uid) { _toast("Sign in first"); return false; }
  const m = getSpyMission(missionId);
  if (!m) { _toast("Unknown mission"); return false; }
  const existing = _progress[missionId] || {};
  // Update best stars + best time
  const newStars = Math.max(existing.stars || 0, stars);
  const newBestTime = existing.bestTime ? Math.min(existing.bestTime, timeMs) : timeMs;
  const attempts = (existing.attempts || 0) + 1;
  const firstCompletion = !existing.completed;
  // Save to Firebase
  try {
    await set(ref(_db, "players/" + uid + "/spyMissions/" + missionId), {
      completed: true,
      stars: newStars,
      bestTime: newBestTime,
      attempts,
      completedAt: Date.now(),
    });
  } catch (e) {
    _toast("Could not save mission progress: " + e.message);
    return false;
  }
  // Pay out the reward — only on first completion (so replaying doesn't farm ₦)
  if (firstCompletion) {
    const gs = _getGameState();
    if (gs) {
      gs.state.money += m.reward;
      gs.state.xp = (gs.state.xp || 0) + m.xp;
      _toast("🏆 Mission complete! +₦" + m.reward.toLocaleString() + " + " + m.xp + " XP" + (m.unlockTag ? " + 🏅 " + m.unlockTag + " tag" : ""));
      // Try to save the balance to Firebase (best-effort)
      try {
        await update(ref(_db, "economy/" + uid), { balance: gs.state.money });
      } catch (e) { /* ignore */ }
    }
  } else {
    _toast("🏆 New best: " + stars + " stars! (Reward already claimed)");
  }
  _onUpdate?.();
  return true;
}

// Called when the player abandons a mission mid-attempt (no penalty — just don't update progress)
export async function abandonSpyMission(missionId) {
  if (!_db) return;
  const uid = _getUserId();
  if (!uid) return;
  const existing = _progress[missionId] || {};
  // Just bump the attempts counter (no completion)
  try {
    await update(ref(_db, "players/" + uid + "/spyMissions/" + missionId), {
      attempts: (existing.attempts || 0) + 1,
    });
  } catch (e) { /* ignore */ }
}
