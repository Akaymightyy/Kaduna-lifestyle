// src/crew_chat.js — CREW CHAT: group chat wey only crew members fit see.
//
// Same pattern as worldchat.js (Firebase push + limitToLast + onChildAdded)
// but the messages live at crewChat/{crewId}/{pushId} and the SECURITY RULES
// lock the read to crew members only (root check on crewMembers/{crewId}).
// The chat renders INSIDE the Crew phone app (Chat tab) — no extra overlay.

import { db } from "./firebase.js";
import { ref, push, query, limitToLast, onChildAdded, onValue } from "firebase/database";

const MAX_LOCAL = 60;

let _uid = null, _crewId = null, _name = "Player";
let _msgs = [];               // in-memory mirror (last MAX_LOCAL)
let _unsubMsgs = null, _unsubCount = null;
let _lastSend = 0;
let _unread = 0;
let _seen = new Set();
let _onNew = null;            // callback for the app (re-render list)

export function initCrewChat(uid, name, onNew) {
  _uid = uid; _name = name || "Player"; _onNew = onNew || null;
}

// Per-login / per-crew subscription. Cheap: last 50 messages only.
export function chatSetCrew(crewId) {
  if (_crewId === crewId) return;
  _crewId = crewId || null;
  if (_unsubMsgs) { try { _unsubMsgs(); } catch (e) {} _unsubMsgs = null; }
  if (_unsubCount) { try { _unsubCount(); } catch (e) {} _unsubCount = null; }
  _msgs = []; _seen = new Set(); _unread = 0;
  if (!crewId || !db) return;
  const q = query(ref(db, "crewChat/" + crewId), limitToLast(50));
  let first = true;
  setTimeout(() => { first = false; }, 2500);   // early arrivals = history, no unread ping
  _unsubMsgs = onChildAdded(q, (snap) => {
    if (_seen.has(snap.key)) return;
    _seen.add(snap.key);
    _msgs.push(snap.val());
    while (_msgs.length > MAX_LOCAL) _msgs.shift();
    if (!first && snap.val() && snap.val().uid !== _uid) _unread++;
    try { _onNew && _onNew(); } catch (e) {}
  }, () => {});
}

export const chatMsgs = () => _msgs;
export const chatUnread = () => _unread;
export const clearChatUnread = () => { _unread = 0; };

const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clock = (ts) => { const d = new Date(ts || Date.now()); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };

// HTML for the Chat tab (the app drops it in, then calls wireCrewChat()).
export function renderCrewChatHTML() {
  const rows = _msgs.map((m) => {
    const mine = m && m.uid === _uid;
    const who = mine ? "You" : '<b style="color:#9fe0b8;">' + esc(m.name) + "</b>";
    return '<div style="display:flex;flex-direction:column;align-items:' + (mine ? "flex-end" : "flex-start") + ';">' +
      '<div style="font-size:10px;color:#8b8e99;margin:0 4px 1px;">' + who + " · " + clock(m.ts) + "</div>" +
      '<div style="max-width:84%;padding:7px 11px;border-radius:13px;font-size:13px;line-height:1.35;word-break:break-word;' + (mine ? "background:#2e7d4f;color:#fff;border-bottom-right-radius:4px;" : "background:#2a2c33;color:#f2f2f4;border-bottom-left-radius:4px;") + '">' + esc(m.text) + "</div></div>";
  }).join("");
  return '<div id="cw-chat-list" style="flex:1;overflow-y:auto;padding:8px 10px;display:flex;flex-direction:column;gap:6px;min-height:180px;max-height:46vh;-webkit-overflow-scrolling:touch;">' +
    (rows || '<div style="text-align:center;color:#6b7280;font-size:12px;padding:24px 8px;">Crew chat empty — greet your people! 👋<br>Only crew members fit see here.</div>') +
    '</div>' +
    '<div style="display:flex;gap:6px;padding:8px 0 2px;">' +
    '<input id="cw-chat-input" maxlength="200" placeholder="Talk to your Crew..." autocomplete="off" style="flex:1;min-width:0;padding:10px 12px;border:1px solid #33363e;border-radius:10px;background:#17181b;color:#f2f2f4;font:13px Poppins,system-ui,sans-serif;outline:none;">' +
    '<button id="cw-chat-send" style="background:#2e7d4f;color:#fff;border:none;border-radius:10px;padding:0 16px;font-weight:600;font-size:13px;cursor:pointer;">Send</button></div>';
}

// After the app renders the chat tab into the DOM: bind input + scroll to bottom.
export function wireCrewChat() {
  const list = document.getElementById("cw-chat-list");
  const input = document.getElementById("cw-chat-input");
  const send = document.getElementById("cw-chat-send");
  if (list) list.scrollTop = list.scrollHeight;
  clearChatUnread();
  if (send && input) {
    send.onclick = () => { _send(input); };
    input.onkeydown = (e) => { if (e.key === "Enter") _send(input); };
  }
}

function _send(input) {
  const t = ((input && input.value) || "").trim().slice(0, 200);
  if (!t || !_uid || !_crewId) return;
  const now = Date.now();
  if (now - _lastSend < 1500) return;      // 1 message per 1.5s (same as world chat)
  _lastSend = now;
  if (input) input.value = "";
  push(ref(db, "crewChat/" + _crewId), { uid: _uid, name: String(_name || "Player").slice(0, 30), text: t, ts: now }).catch(() => {});
}

export function crewChatDbg() { return { crewId: _crewId, msgs: _msgs.length, unread: _unread }; }
