// src/social.js — Phase 8: Friends, relationships, DMs, visit-my-home invite link.
//
// Friends: players/{uid}/friends/{friendUid} = { name, ts, level: 0-5 }
// DMs: dms/{chatId}/{msgId} = { from, to, text, ts } where chatId = sorted [uid1,uid2].join("_")
// Visit link: /v/{username} -> auto-travel to that player's home entrance
//
// Relationship level grows with positive interactions (chat, visit, gift).
// Higher relationship unlocks: visit home, send gift, "best friend" badge.

import { auth, db } from "./firebase.js";
import { ref, get, set, update, onValue, push, onDisconnect } from "firebase/database";

let _uid = null;
let _friends = {};
let _dms = {};  // { chatId: [msgs] }
let _onUpdate = null;

export function initSocial(uid, onUpdate) {
  _uid = uid;
  _onUpdate = onUpdate;
  if (!uid) return;
  onValue(ref(db, "players/" + uid + "/friends"), (snap) => {
    _friends = snap.val() || {};
    _onUpdate?.();
  });
}

export function getFriends() { return _friends; }

// Send a friend request by username. Looks up the username -> uid -> sends request.
export async function addFriendByUsername(username) {
  if (!_uid) return { ok: false, msg: "Sign in first" };
  if (!username || !username.trim()) return { ok: false, msg: "Enter a username" };
  try {
    const unameKey = username.toLowerCase().trim().replace(/\./g, "_");
    const snap = await get(ref(db, "usernames/" + unameKey));
    if (!snap.exists()) return { ok: false, msg: "💔 No player with username '" + username + "'" };
    const friendUid = snap.val();
    if (friendUid === _uid) return { ok: false, msg: "You can't add yourself!" };
    // Check if already friends
    if (_friends[friendUid]) return { ok: false, msg: "Already friends with " + _friends[friendUid].name };
    // Get friend's name
    const playerSnap = await get(ref(db, "players/" + friendUid));
    const playerData = playerSnap.val() || {};
    await set(ref(db, "players/" + _uid + "/friends/" + friendUid), { name: playerData.name || username, username: username, ts: Date.now(), level: 0 });
    return { ok: true, msg: "👥 Added " + (playerData.name || username) + " as friend!" };
  } catch (e) {
    return { ok: false, msg: "Could not find user. Check the username." };
  }
}

// Remove a friend
export async function removeFriend(friendUid) {
  if (!_uid) return { ok: false, msg: "Sign in first" };
  await set(ref(db, "players/" + _uid + "/friends/" + friendUid), null);
  return { ok: true, msg: "Removed friend" };
}

// Increase relationship level (called on positive interaction)
export async function boostRelationship(friendUid, amount = 1) {
  if (!_uid || !_friends[friendUid]) return;
  const f = _friends[friendUid];
  const newLevel = Math.min(5, (f.level || 0) + amount);
  await update(ref(db, "players/" + _uid + "/friends/" + friendUid), { level: newLevel });
}

// ---- DMs ----
function _chatId(a, b) { return [a, b].sort().join("_"); }

export function listenToDMs(friendUid, onMsgs) {
  if (!_uid) return () => {};
  const cid = _chatId(_uid, friendUid);
  const unsub = onValue(ref(db, "dms/" + cid), (snap) => {
    const msgs = snap.val() || {};
    const arr = Object.values(msgs).sort((a, b) => (a.ts || 0) - (b.ts || 0));
    _dms[cid] = arr;
    onMsgs?.(arr);
  });
  return unsub;
}

export async function sendDM(friendUid, text) {
  if (!_uid) return { ok: false, msg: "Sign in first" };
  if (!text || !text.trim()) return { ok: false, msg: "Empty message" };
  const cid = _chatId(_uid, friendUid);
  const msgRef = push(ref(db, "dms/" + cid));
  await set(msgRef, { from: _uid, to: friendUid, text: text.trim().slice(0, 500), ts: Date.now() });
  // Boost relationship slightly for chatting
  await boostRelationship(friendUid, 0.5);
  return { ok: true };
}

// ---- Visit-my-home invite link ----
// Generates a link like https://luna-lifestyle.vercel.app/?v=username
// When opened, the game auto-travels to that player's home entrance.
export function generateVisitLink(username) {
  const base = window.location.origin + window.location.pathname;
  return base + "?v=" + encodeURIComponent(username);
}

// Check URL for ?v=username on load and auto-travel.
export function checkVisitLink(travelFn) {
  const params = new URLSearchParams(window.location.search);
  const v = params.get("v");
  if (!v) return false;
  // Clean the URL so it doesn't re-trigger on refresh
  window.history.replaceState({}, document.title, window.location.pathname);
  if (travelFn) travelFn(v);
  return true;
}
