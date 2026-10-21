// src/emote_broadcast.js — Emote/activity broadcast system.
//
// Lets a player send an emote (wave, dance, clap, sit, etc.) that ALL
// other nearby players see on their remote avatar. Writes to Firebase:
//   live/{uid} = { ..., emote, emoteDur, emoteTs }
//
// Remote avatars play the emote animation when they see the update.
// Hooks into the existing multiplayer.js live node subscription.
//
// Wire-up (in main.js):
//   import { initEmoteBroadcast, sendEmote, getRemoteEmote } from "./emote_broadcast.js";
//   initEmoteBroadcast({ db, getUserId });
//   window._emote = (type) => sendEmote(type);
//
// In multiplayer.js updateAvatars(), check getRemoteEmote(uid) and
// play the emote animation on the remote avatar's character model.

import { ref, update } from "firebase/database";

let _db = null;
let _getUserId = () => null;

export function initEmoteBroadcast({ db, getUserId }) {
  _db = db;
  _getUserId = getUserId;
}

// Available emotes + their durations (seconds)
export const EMOTES = {
  wave:    { emoji: "👋", name: "Wave",    dur: 3 },
  dance:   { emoji: "🕺", name: "Dance",   dur: 5 },
  clap:    { emoji: "👏", name: "Clap",    dur: 3 },
  sit:     { emoji: "🪑", name: "Sit",     dur: 0 },  // 0 = persistent until movement
  laugh:   { emoji: "😂", name: "Laugh",   dur: 3 },
  bow:     { emoji: "🙇", name: "Bow",     dur: 2 },
  salute:  { emoji: "🫡", name: "Salute",  dur: 2 },
  shrug:   { emoji: "🤷", name: "Shrug",   dur: 2 },
  thumbsup:{ emoji: "👍", name: "Thumbs Up", dur: 2 },
  peace:   { emoji: "✌️", name: "Peace",   dur: 2 },
};

// Send an emote — writes to live/{uid} so all subscribed clients see it
export async function sendEmote(type) {
  if (!_db || !_getUserId()) return;
  const uid = _getUserId();
  const emote = EMOTES[type];
  if (!emote) return;
  try {
    await update(ref(_db, "live/" + uid), {
      emote: type,
      emoteDur: emote.dur,
      emoteTs: Date.now(),
    });
  } catch (e) {
    console.warn("[emote] sendEmote failed:", e.message);
  }
}

// Clear emote (called when the player moves or the duration expires)
export async function clearEmote() {
  if (!_db || !_getUserId()) return;
  const uid = _getUserId();
  try {
    await update(ref(_db, "live/" + uid), {
      emote: null,
      emoteDur: null,
      emoteTs: null,
    });
  } catch (e) { /* ignore */ }
}

// Check if a remote player has an active emote (for rendering)
// Returns { type, emoji, dur, ts } or null if no active emote
export function getRemoteEmote(playerData) {
  if (!playerData || !playerData.emote) return null;
  const emote = EMOTES[playerData.emote];
  if (!emote) return null;
  // Check if the emote has expired (for timed emotes with dur > 0)
  if (emote.dur > 0 && playerData.emoteTs) {
    const elapsed = (Date.now() - playerData.emoteTs) / 1000;
    if (elapsed > emote.dur) return null;
  }
  return {
    type: playerData.emote,
    emoji: emote.emoji,
    dur: emote.dur,
    ts: playerData.emoteTs,
  };
}
