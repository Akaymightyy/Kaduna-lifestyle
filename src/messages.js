// src/messages.js — Messages app: DMs, groups, search users, send money.
//
// Data shape (Firebase Realtime Database):
//   chats/{chatId}/meta      = { type:"dm"|"group", members:{uid:true}, name?, icon?, owner?, createdAt }
//   chats/{chatId}/messages/{msgId} = { from, text, ts, type:"text"|"money"|"system", amount? }
//   userChats/{uid}/{chatId} = { lastText, lastTs, lastFrom, unread, pinned?, muted? }
//   presence/{uid}           = { online, lastSeen }
//   blocks/{uid}/{otherUid}  = true
//
// DM chatId = sorted [uidA,uidB].join("_") (compatible with social.js dms/)
// All messages rendered with textContent (never innerHTML) to block injection.

import { db } from "./firebase.js";
import { ref, get, set, update, push, onValue, onChildAdded, query, limitToLast, runTransaction, onDisconnect, serverTimestamp } from "firebase/database";

let _uid = null;
let _name = "Player";
let _chats = {};       // { chatId: { meta, messages: [], unread } }
let _userChats = {};   // from Firebase userChats/{uid}
let _presence = {};    // { uid: { online, lastSeen } }
let _openChatId = null;
let _unsubOpenChat = null;
let _unsubUserChats = null;
let _onUpdate = null;
let _toast = null;
let _lastMsgTime = 0;

// ---- Init ----
export function initMessages(uid, name, toast, onUpdate) {
  _uid = uid;
  _name = name || "Player";
  _toast = toast;
  _onUpdate = onUpdate;
  // Listen to my userChats (chat list)
  _unsubUserChats = onValue(ref(db, "userChats/" + uid), (snap) => {
    _userChats = snap.val() || {};
    _onUpdate?.();
  });
  // Set presence online
  const presenceRef = ref(db, "presence/" + uid);
  update(presenceRef, { online: true, lastSeen: Date.now() });
  onDisconnect(presenceRef).update({ online: false, lastSeen: serverTimestamp() });
}

// ---- Search users by @username ----
export async function searchUsers(query, limit = 10) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase().replace(/^@/, "");
  try {
    const snap = await get(ref(db, "usernames"));
    const all = snap.val() || {};
    const results = [];
    for (const [uname, uid] of Object.entries(all)) {
      if (uname.includes(q)) {
        // Get the player's name
        try {
          const pSnap = await get(ref(db, "players/" + uid));
          const p = pSnap.val() || {};
          results.push({ uid, username: uname, name: p.name || uname });
          if (results.length >= limit) break;
        } catch (e) {}
      }
    }
    return results;
  } catch (e) {
    return [];
  }
}

// ---- Start or open a DM ----
export async function openDM(otherUid, otherName) {
  if (!_uid || !otherUid) return null;
  if (otherUid === _uid) { _toast?.("You can't message yourself!"); return null; }
  // Check if blocked
  const blockSnap = await get(ref(db, "blocks/" + otherUid + "/" + _uid));
  if (blockSnap.exists()) { _toast?.("💔 This user has blocked you."); return null; }
  const chatId = [_uid, otherUid].sort().join("_");
  // Create chat meta if it doesn't exist
  const metaRef = ref(db, "chats/" + chatId + "/meta");
  const metaSnap = await get(metaRef);
  if (!metaSnap.exists()) {
    await set(metaRef, {
      type: "dm",
      members: { [_uid]: true, [otherUid]: true },
      createdAt: Date.now(),
    });
  }
  return { chatId, otherUid, otherName };
}

// ---- Send a message ----
export async function sendMessage(chatId, text, type = "text", amount = 0) {
  if (!_uid || !chatId) return;
  // Rate limit: max 1 msg per 500ms
  const now = Date.now();
  if (now - _lastMsgTime < 500) { _toast?.("Too fast — wait small."); return; }
  _lastMsgTime = now;
  // Trim + validate
  text = (text || "").trim().slice(0, 500);
  if (!text && type === "text") return;
  // Write message
  const msgRef = push(ref(db, "chats/" + chatId + "/messages"));
  const msg = { from: _uid, text, ts: now, type };
  if (amount) msg.amount = amount;
  await set(msgRef, msg);
  // Update userChats for both members (multi-path update)
  const metaSnap = await get(ref(db, "chats/" + chatId + "/meta"));
  const meta = metaSnap.val() || {};
  const members = meta.members || {};
  const updates = {};
  const preview = type === "money" ? "💸 Sent ₦" + (amount || 0).toLocaleString() : text.slice(0, 50);
  for (const memberUid of Object.keys(members)) {
    const isMe = memberUid === _uid;
    updates["userChats/" + memberUid + "/" + chatId + "/lastText"] = (isMe ? "You: " : "") + preview;
    updates["userChats/" + memberUid + "/" + chatId + "/lastTs"] = now;
    updates["userChats/" + memberUid + "/" + chatId + "/lastFrom"] = _uid;
    if (!isMe) {
      // Increment unread for the other person (unless chat is open for them — we can't check, so always increment)
      updates["userChats/" + memberUid + "/" + chatId + "/unread"] = (await getUnread(memberUid, chatId)) + 1;
    }
  }
  await update(ref(db), updates);
}

async function getUnread(uid, chatId) {
  try {
    const snap = await get(ref(db, "userChats/" + uid + "/" + chatId + "/unread"));
    return snap.val() || 0;
  } catch (e) { return 0; }
}

// ---- Open a chat (load messages + mark read) ----
export function openChat(chatId, onMessages) {
  if (_openChatId === chatId) return;
  closeChat();
  _openChatId = chatId;
  // Listen to last 50 messages
  const msgQuery = query(ref(db, "chats/" + chatId + "/messages"), limitToLast(50));
  _unsubOpenChat = onValue(msgQuery, (snap) => {
    const msgs = snap.val() || {};
    const arr = Object.values(msgs).sort((a, b) => (a.ts || 0) - (b.ts || 0));
    onMessages?.(arr);
  });
  // Mark read
  if (_uid) {
    update(ref(db, "userChats/" + _uid + "/" + chatId), { unread: 0 });
  }
}

export function closeChat() {
  if (_unsubOpenChat) { _unsubOpenChat(); _unsubOpenChat = null; }
  _openChatId = null;
}

// ---- Get chat list (sorted by lastTs) ----
export function getChatList() {
  const list = [];
  for (const [chatId, info] of Object.entries(_userChats)) {
    list.push({ chatId, ...info });
  }
  list.sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
  return list;
}

// ---- Get presence ----
export function getPresence(uid) {
  return _presence[uid] || { online: false, lastSeen: 0 };
}

export function listenToPresence(uid) {
  return onValue(ref(db, "presence/" + uid), (snap) => {
    _presence[uid] = snap.val() || { online: false, lastSeen: 0 };
    _onUpdate?.();
  });
}

// ---- Send money (Firebase transaction on both balances) ----
const MAX_TRANSFER = 10000000; // ₦10M cap
const MAX_TRANSFERS_PER_MIN = 10;
let _transferTimes = [];

export async function sendMoney(chatId, toUid, amount, note, gameState) {
  if (!_uid) return { ok: false, msg: "Sign in first" };
  if (toUid === _uid) return { ok: false, msg: "Can't send to yourself" };
  amount = Math.floor(Number(amount) || 0);
  if (amount <= 0) return { ok: false, msg: "Enter a valid amount" };
  if (amount > MAX_TRANSFER) return { ok: false, msg: "Max ₦" + MAX_TRANSFER.toLocaleString() + " per transfer" };
  // Rate limit
  const now = Date.now();
  _transferTimes = _transferTimes.filter(t => now - t < 60000);
  if (_transferTimes.length >= MAX_TRANSFERS_PER_MIN) return { ok: false, msg: "Too many transfers. Wait a minute." };
  // Check balance
  if ((gameState.money || 0) < amount) return { ok: false, msg: "Insufficient balance" };
  // Transaction: subtract from sender
  const senderBalRef = ref(db, "economy/" + _uid + "/balance");
  let senderOk = false;
  try {
    await runTransaction(senderBalRef, (cur) => {
      const bal = cur || 0;
      if (bal < amount) return; // abort — insufficient
      senderOk = true;
      return bal - amount;
    });
  } catch (e) { return { ok: false, msg: "Transfer failed: " + e.message }; }
  if (!senderOk) return { ok: false, msg: "Insufficient balance" };
  // Add to receiver
  const receiverBalRef = ref(db, "economy/" + toUid + "/balance");
  try { await runTransaction(receiverBalRef, (cur) => (cur || 0) + amount); } catch (e) {}
  // Log the transfer
  const logRef = push(ref(db, "transfers"));
  await set(logRef, { from: _uid, to: toUid, amount, ts: now, note: note || "" });
  // Send money message in chat
  await sendMessage(chatId, note || "Money transfer", "money", amount);
  // Update sender's local state
  gameState.money -= amount;
  gameState.save?.();
  _transferTimes.push(now);
  return { ok: true, msg: "💸 Sent ₦" + amount.toLocaleString() };
}

// ---- Groups ----
export async function createGroup(name, icon, memberUids) {
  if (!_uid) return { ok: false, msg: "Sign in first" };
  if (!name || !name.trim()) return { ok: false, msg: "Enter a group name" };
  if (memberUids.length < 1) return { ok: false, msg: "Add at least one member" };
  const chatId = "grp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const members = { [_uid]: true };
  for (const uid of memberUids) members[uid] = true;
  await set(ref(db, "chats/" + chatId + "/meta"), {
    type: "group", name: name.trim(), icon: icon || "👥", owner: _uid,
    members, createdAt: Date.now(),
  });
  // Add to everyone's userChats
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

export async function leaveGroup(chatId) {
  if (!_uid) return;
  // Remove me from members
  await set(ref(db, "chats/" + chatId + "/meta/members/" + _uid), null);
  await set(ref(db, "userChats/" + _uid + "/" + chatId), null);
  _toast?.("Left group");
}

// ---- Block / Report ----
export async function blockUser(otherUid) {
  if (!_uid) return;
  await set(ref(db, "blocks/" + _uid + "/" + otherUid), true);
  _toast?.("🚫 Blocked user");
}

export async function unblockUser(otherUid) {
  if (!_uid) return;
  await set(ref(db, "blocks/" + _uid + "/" + otherUid), null);
  _toast?.("Unblocked");
}

export async function reportUser(otherUid, reason) {
  if (!_uid) return;
  const r = push(ref(db, "reports"));
  await set(r, { from: _uid, against: otherUid, reason: reason || "", ts: Date.now() });
  _toast?.("📝 Report submitted. Admin will review.");
}

// ---- Get chat meta ----
export async function getChatMeta(chatId) {
  try {
    const snap = await get(ref(db, "chats/" + chatId + "/meta"));
    return snap.val() || null;
  } catch (e) { return null; }
}

// ---- Cleanup on logout ----
export function cleanupMessages() {
  closeChat();
  if (_unsubUserChats) { _unsubUserChats(); _unsubUserChats = null; }
  if (_uid) {
    update(ref(db, "presence/" + _uid), { online: false, lastSeen: Date.now() });
  }
}
