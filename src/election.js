// src/election.js — Phase 7: Weekly Kaduna governor election.
//
// Players pay ₦10,000 to register as a candidate with a slogan + one of 5 policies.
// Voting happens at the polling unit (in-person). Each player can vote once per week.
// Winner's policy changes prices/pay for the week:
//   transport_subsidy → rides 50% off
//   wage_raise        → all career pay +20%
//   festival_season   → fun drains slower, +10 daily wishes points
//   food_subsidy      → food 30% cheaper
//   steady_light      → NEPA cuts 50% less frequent
//
// Uses Firebase transactions so votes cannot be duplicated.
// Election resets every Sunday at midnight (game time = every 168 real minutes).

import { db } from "./firebase.js";
import { ref, get, set, update, onValue, runTransaction } from "firebase/database";

export const POLICIES = [
  { id: "transport_subsidy", name: "Transport Subsidy",  icon: "🚌", desc: "Keke, bus, taxi 50% off for the week" },
  { id: "wage_raise",        name: "Wage Raise",         icon: "💰", desc: "All career pay +20% for the week" },
  { id: "festival_season",   name: "Festival Season",    icon: "🎉", desc: "Fun drains slower, +10 wish points daily" },
  { id: "food_subsidy",      name: "Food Subsidy",       icon: "🍲", desc: "All food 30% cheaper for the week" },
  { id: "steady_light",      name: "Steady Light",       icon: "💡", desc: "NEPA cuts 50% less frequent" },
];

const REGISTER_FEE = 10000;

let _uid = null;
let _election = { week: "", candidates: {}, votes: {}, winner: null };
let _onUpdate = null;

export function initElection(uid, onUpdate) {
  _uid = uid;
  _onUpdate = onUpdate;
  if (!uid) return;
  const week = getWeekKey();
  onValue(ref(db, "election/" + week), (snap) => {
    _election = snap.val() || { week, candidates: {}, votes: {}, winner: null };
    _onUpdate?.();
  });
}

export function getWeekKey() {
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return d.getFullYear() + "_W" + week;
}

export function getElection() { return _election; }

export function isCandidate(uid) { return !!_election.candidates?.[uid]; }
export function hasVoted(uid) { return !!_election.votes?.[uid]; }

// Register as a candidate. Costs ₦10,000 (in-game).
export async function registerCandidate(slogan, policyId, gameState) {
  if (!_uid) return { ok: false, msg: "Sign in first" };
  if (isCandidate(_uid)) return { ok: false, msg: "You don already register" };
  if (!slogan || !slogan.trim()) return { ok: false, msg: "Enter a slogan" };
  if (!POLICIES.find(p => p.id === policyId)) return { ok: false, msg: "Pick a valid policy" };
  if (gameState.money < REGISTER_FEE) return { ok: false, msg: "Need ₦" + REGISTER_FEE.toLocaleString() + " to register" };
  gameState.money -= REGISTER_FEE;
  gameState.save?.();
  const name = (typeof getMyName === "function" ? getMyName() : "Player");
  const candidate = { uid: _uid, name, slogan: slogan.trim().slice(0, 80), policy: policyId, ts: Date.now() };
  await set(ref(db, "election/" + getWeekKey() + "/candidates/" + _uid), candidate);
  // Deduct fee (safe object form)
  await update(ref(db, "economy/" + _uid), { balance: gameState.money });
  return { ok: true, msg: "🎉 You don register as candidate! ₦" + REGISTER_FEE.toLocaleString() + " paid. Go campaign!" };
}

// Vote for a candidate. Uses transaction so each player votes once.
export async function vote(candidateUid) {
  if (!_uid) return { ok: false, msg: "Sign in first" };
  if (hasVoted(_uid)) return { ok: false, msg: "You don vote already" };
  if (!isCandidate(candidateUid)) return { ok: false, msg: "Unknown candidate" };
  // Transaction: set votes/{uid} = candidateUid only if it doesn't exist
  const voteRef = ref(db, "election/" + getWeekKey() + "/votes/" + _uid);
  let success = false;
  try {
    await runTransaction(voteRef, (cur) => {
      if (cur) return; // already voted — abort
      success = true;
      return candidateUid;
    });
  } catch (e) { return { ok: false, msg: "Network error. Try again." }; }
  if (!success) return { ok: false, msg: "You don vote already!" };
  return { ok: true, msg: "🗳️ Your vote don count!" };
}

// Tally votes and declare a winner. Called by admin or by a scheduled check.
export async function tallyVotes() {
  const week = getWeekKey();
  const snap = await get(ref(db, "election/" + week));
  const data = snap.val() || { candidates: {}, votes: {} };
  const tally = {};
  for (const [voterUid, candidateUid] of Object.entries(data.votes || {})) {
    tally[candidateUid] = (tally[candidateUid] || 0) + 1;
  }
  let winnerUid = null, maxVotes = 0;
  for (const [candUid, count] of Object.entries(tally)) {
    if (count > maxVotes) { maxVotes = count; winnerUid = candUid; }
  }
  if (winnerUid) {
    const winner = data.candidates?.[winnerUid];
    await set(ref(db, "election/" + week + "/winner"), { uid: winnerUid, name: winner?.name, policy: winner?.policy, votes: maxVotes, ts: Date.now() });
    // Broadcast announcement
    const policy = POLICIES.find(p => p.id === winner?.policy);
    await update(ref(db, "announcements"), { ["election_" + week]: { text: "🗳️ " + winner?.name + " wins the election! Policy: " + (policy?.name || "?"), ts: Date.now(), alert: false } });
    return { ok: true, winner, policy };
  }
  return { ok: false, msg: "No votes yet" };
}

// Get the active policy for this week (winner's policy). Returns null if no election yet.
export function getActivePolicy() {
  if (!_election.winner) return null;
  const policyId = _election.winner.policy;
  return POLICIES.find(p => p.id === policyId) || null;
}

// Apply policy effects to a price/pay value.
export function applyPolicy(price, type) {
  const policy = getActivePolicy();
  if (!policy) return price;
  if (policy.id === "transport_subsidy" && type === "ride") return Math.round(price * 0.5);
  if (policy.id === "food_subsidy" && type === "food") return Math.round(price * 0.7);
  if (policy.id === "wage_raise" && type === "pay") return Math.round(price * 1.2);
  return price;
}
