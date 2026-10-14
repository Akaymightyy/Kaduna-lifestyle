// src/messages.js — Messages app: DMs, groups, search users, send money.
import { db } from "./firebase.js";
import { ref, get, set, update, push, onValue, query, limitToLast, runTransaction, onDisconnect, serverTimestamp } from "firebase/database";

let _uid = null, _name = "Player", _userChats = {}, _openChatId = null, _unsubOpenChat = null, _unsubUserChats = null, _onUpdate = null, _toast = null, _lastMsgTime = 0;

export function initMessages(uid, name, toast, onUpdate) {
  _uid = uid; _name = name || "Player"; _toast = toast; _onUpdate = onUpdate;
  _unsubUserChats = onValue(ref(db, "userChats/" + uid), (snap) => { _userChats = snap.val() || {}; _onUpdate?.(); });
  const pRef = ref(db, "presence/" + uid);
  update(pRef, { online: true, lastSeen: Date.now() });
  onDisconnect(pRef).update({ online: false, lastSeen: serverTimestamp() });
}

export async function searchUsers(q, limit = 10) {
  if (!q || q.length < 2) return [];
  const query = q.toLowerCase().replace(/^@/, "");
  try {
    // FEATURE: read the world-readable userProfiles node (instead of the admin/
    // owner-only players/{uid} node which was silently failing for non-admin
    // searchers). userProfiles/{uid} = { name, username, createdAt } is
    // readable by any authed user per FIREBASE_RULES.json.
    //
    // We match BOTH username AND display name so users can search by either.
    // Limit to 10 results. Sort: username-prefix matches first, then name
    // matches, then alphabetical.
    const snap = await get(ref(db, "userProfiles"));
    const all = snap.val() || {};
    const results = [];
    for (const [uid, profile] of Object.entries(all)) {
      if (!profile) continue;
      const uname = (profile.username || "").toLowerCase();
      const pname = (profile.name || "").toLowerCase();
      // Match if query is a substring of username OR name
      if (!uname.includes(query) && !pname.includes(query)) continue;
      results.push({
        uid,
        username: profile.username || uid,
        name: profile.name || profile.username || uid,
        _isUnamePrefix: uname.startsWith(query),  // for sorting
      });
      if (results.length >= limit * 3) break;  // gather enough for sort, then trim
    }
    // Sort: username-prefix matches first, then by name (alphabetical)
    results.sort((a, b) => {
      if (a._isUnamePrefix !== b._isUnamePrefix) return a._isUnamePrefix ? -1 : 1;
      return (a.name || "").localeCompare(b.name || "");
    });
    return results.slice(0, limit).map(r => ({ uid: r.uid, username: r.username, name: r.name }));
  } catch (e) {
    console.warn("[messages] searchUsers failed:", e.message);
    return [];
  }
}

export async function openDM(otherUid, otherName) {
  if (!_uid || !otherUid) return null;
  if (otherUid === _uid) { _toast?.("You can't message yourself!"); return null; }
  const chatId = [_uid, otherUid].sort().join("_");
  const metaRef = ref(db, "chats/" + chatId + "/meta");
  const metaSnap = await get(metaRef);
  if (!metaSnap.exists()) { await set(metaRef, { type: "dm", members: { [_uid]: true, [otherUid]: true }, createdAt: Date.now() }); }
  return { chatId, otherUid, otherName };
}

export async function sendMessage(chatId, text, type = "text", amount = 0, extra = null) {
  if (!_uid || !chatId) return;
  const now = Date.now();
  if (now - _lastMsgTime < 500) { _toast?.("Too fast — wait small."); return; }
  _lastMsgTime = now;
  text = (text || "").trim().slice(0, 500);
  if (!text && type === "text") return;
  const msgRef = push(ref(db, "chats/" + chatId + "/messages"));
  const msg = { from: _uid, text, ts: now, type };
  if (amount) msg.amount = amount;
  // FEATURE: optional `extra` payload for typed messages (e.g. house invites with
  // the owner's areaId/plotNo/ownerUid/ownerName). Stored under `extra` key.
  if (extra && typeof extra === "object") msg.extra = extra;
  await set(msgRef, msg);
  const metaSnap = await get(ref(db, "chats/" + chatId + "/meta"));
  const meta = metaSnap.val() || {};
  const members = meta.members || {};
  const updates = {};
  const preview = type === "money" ? "💸 Sent ₦" + (amount || 0).toLocaleString() :
                  type === "house_invite" ? "🏠 Sent a house invite" :
                  text.slice(0, 50);
  for (const memberUid of Object.keys(members)) {
    const isMe = memberUid === _uid;
    updates["userChats/" + memberUid + "/" + chatId + "/lastText"] = (isMe ? "You: " : "") + preview;
    updates["userChats/" + memberUid + "/" + chatId + "/lastTs"] = now;
    updates["userChats/" + memberUid + "/" + chatId + "/lastFrom"] = _uid;
    if (!isMe) { updates["userChats/" + memberUid + "/" + chatId + "/unread"] = (await getUnread(memberUid, chatId)) + 1; }
  }
  await update(ref(db), updates);
}

// FEATURE: send a house invite message in a chat. The recipient sees a
// "🚪 Visit now" button in the chat that calls enterPlaceAsVisitor with
// the embedded house key.
export async function sendHouseInvite(chatId, houseInfo) {
  if (!_uid || !chatId) return false;
  if (!houseInfo || !houseInfo.areaId || houseInfo.plotNo == null || !houseInfo.ownerUid) return false;
  await sendMessage(chatId, "🏠 Sent you a house invite", "house_invite", 0, {
    areaId: houseInfo.areaId,
    plotNo: houseInfo.plotNo,
    ownerUid: houseInfo.ownerUid,
    ownerName: houseInfo.ownerName || "Friend",
  });
  return true;
}

async function getUnread(uid, chatId) {
  try { const snap = await get(ref(db, "userChats/" + uid + "/" + chatId + "/unread")); return snap.val() || 0; } catch (e) { return 0; }
}

export function openChat(chatId, onMessages) {
  if (_openChatId === chatId) return;
  closeChat();
  _openChatId = chatId;
  const msgQuery = query(ref(db, "chats/" + chatId + "/messages"), limitToLast(50));
  _unsubOpenChat = onValue(msgQuery, (snap) => {
    const msgs = snap.val() || {};
    const arr = Object.values(msgs).sort((a, b) => (a.ts || 0) - (b.ts || 0));
    onMessages?.(arr);
  });
  if (_uid) { update(ref(db, "userChats/" + _uid + "/" + chatId), { unread: 0 }); }
}

export function closeChat() { if (_unsubOpenChat) { _unsubOpenChat(); _unsubOpenChat = null; } _openChatId = null; }
export function getChatList() { return Object.entries(_userChats).map(([chatId, info]) => ({ chatId, ...info })).sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0)); }

const MAX_TRANSFER = 10000000, MAX_TRANSFERS_PER_MIN = 10;
let _transferTimes = [];

export async function sendMoney(chatId, toUid, amount, note, gameState) {
  if (!_uid) return { ok: false, msg: "Sign in first" };
  if (toUid === _uid) return { ok: false, msg: "Can't send to yourself" };
  amount = Math.floor(Number(amount) || 0);
  if (amount <= 0) return { ok: false, msg: "Enter a valid amount" };
  if (amount > MAX_TRANSFER) return { ok: false, msg: "Max ₦" + MAX_TRANSFER.toLocaleString() + " per transfer" };
  const now = Date.now();
  _transferTimes = _transferTimes.filter(t => now - t < 60000);
  if (_transferTimes.length >= MAX_TRANSFERS_PER_MIN) return { ok: false, msg: "Too many transfers. Wait a minute." };
  if ((gameState.money || 0) < amount) return { ok: false, msg: "Insufficient balance" };
  const senderBalRef = ref(db, "economy/" + _uid + "/balance");
  let senderOk = false;
  try { await runTransaction(senderBalRef, (cur) => { const bal = cur || 0; if (bal < amount) return; senderOk = true; return bal - amount; }); } catch (e) { return { ok: false, msg: "Transfer failed" }; }
  if (!senderOk) return { ok: false, msg: "Insufficient balance" };
  try { await runTransaction(ref(db, "economy/" + toUid + "/balance"), (cur) => (cur || 0) + amount); } catch (e) {}
  const logRef = push(ref(db, "transfers"));
  await set(logRef, { from: _uid, to: toUid, amount, ts: now, note: note || "" });
  await sendMessage(chatId, note || "Money transfer", "money", amount);
  gameState.money -= amount; gameState.save?.();
  _transferTimes.push(now);
  return { ok: true, msg: "💸 Sent ₦" + amount.toLocaleString() };
}

export async function createGroup(name, icon, memberUids) {
  if (!_uid) return { ok: false, msg: "Sign in first" };
  if (!name || !name.trim()) return { ok: false, msg: "Enter a group name" };
  if (memberUids.length < 1) return { ok: false, msg: "Add at least one member" };
  const chatId = "grp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const members = { [_uid]: true };
  for (const uid of memberUids) members[uid] = true;
  await set(ref(db, "chats/" + chatId + "/meta"), { type: "group", name: name.trim(), icon: icon || "👥", owner: _uid, members, createdAt: Date.now() });
  const updates = {};
  for (const uid of Object.keys(members)) {
    updates["userChats/" + uid + "/" + chatId + "/lastText"] = "Group created";
    updates["userChats/" + uid + "/" + chatId + "/lastTs"] = Date.now();
    updates["userChats/" + uid + "/" + chatId + "/lastFrom"] = _uid;
    updates["userChats/" + uid + "/" + chatId + "/unread"] = uid === _uid ? 0 : 1;
  }
  await update(ref(db), updates);
  return { ok: true, chatId };
}

export async function leaveGroup(chatId) { if (!_uid) return; await set(ref(db, "chats/" + chatId + "/meta/members/" + _uid), null); await set(ref(db, "userChats/" + _uid + "/" + chatId), null); _toast?.("Left group"); }
export async function blockUser(otherUid) { if (!_uid) return; await set(ref(db, "blocks/" + _uid + "/" + otherUid), true); _toast?.("🚫 Blocked user"); }
export async function reportUser(otherUid, reason) { if (!_uid) return; const r = push(ref(db, "reports")); await set(r, { from: _uid, against: otherUid, reason: reason || "", ts: Date.now() }); _toast?.("📝 Report submitted."); }
export async function getChatMeta(chatId) { try { const snap = await get(ref(db, "chats/" + chatId + "/meta")); return snap.val() || null; } catch (e) { return null; } }

// ---- FIX: Add exported getPresence + listenToPresence (were imported in main.js but didn't exist) ----
export async function getPresence(uid) {
  try { const snap = await get(ref(db, "presence/" + uid)); return snap.val() || null; } catch (e) { return null; }
}
export function listenToPresence(uid, cb) {
  if (!uid) return () => {};
  const unsub = onValue(ref(db, "presence/" + uid), (snap) => { cb?.(snap.val() || null); });
  return unsub;
}

export function cleanupMessages() { closeChat(); if (_unsubUserChats) { _unsubUserChats(); _unsubUserChats = null; } if (_uid) { update(ref(db, "presence/" + _uid), { online: false, lastSeen: Date.now() }); } }
