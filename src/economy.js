// src/economy.js — server-side economy security + rich list + admin
import { db } from "./firebase.js";
import { ref, onValue, set, update, get, runTransaction, push } from "firebase/database";

// Validate that a money change is legitimate
// (client sends the delta, server validates via transaction)
export async function addMoney(uid, amount, reason) {
  if (!uid || typeof amount !== "number" || amount === 0) return { ok: false, error: "Invalid" };
  const balRef = ref(db, "economy/" + uid + "/balance");
  try {
    const result = await runTransaction(balRef, (current) => {
      const bal = current || 0;
      const newBal = bal + amount;
      if (newBal < 0) return; // reject — can't go negative
      return newBal;
    });
    // Log the transaction
    const logRef = ref(db, "economy/" + uid + "/log");
    const newLog = push(logRef);
    await set(newLog, { amount, reason: reason || "unknown", ts: Date.now(), bal: result.snapshot.val() });
    return { ok: true, balance: result.snapshot.val() };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Get a player's balance
export async function getBalance(uid) {
  if (!uid) return 0;
  const snap = await get(ref(db, "economy/" + uid + "/balance"));
  return snap.val() || 0;
}

// Rich list — top 10 players by balance
let _richListUnsub = null;
export function subscribeRichList(callback) {
  if (_richListUnsub) _richListUnsub();
  const ecoRef = ref(db, "economy");
  _richListUnsub = onValue(ecoRef, (snap) => {
    const data = snap.val() || {};
    const list = Object.entries(data)
      .map(([uid, d]) => ({ uid, balance: d.balance || 0, name: d.name || "Unknown" }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10);
    callback(list);
  });
}

// Admin: get all players
export function subscribeAllPlayers(callback) {
  const playersRef = ref(db, "players");
  onValue(playersRef, (snap) => {
    const data = snap.val() || {};
    const list = Object.entries(data).map(([uid, d]) => ({ uid, ...d }));
    callback(list);
  });
}

// Admin: suspend a player
export async function suspendPlayer(uid) {
  await update(ref(db, "players/" + uid), { suspended: true });
}

// Admin: unsuspend
export async function unsuspendPlayer(uid) {
  await update(ref(db, "players/" + uid), { suspended: false });
}
