// src/social/house_chat.js — house group chat ("Message" button).
//
// Everybody currently inside the same house/venue can see and type.
// Firebase: houseChat/{roomKey}/{msgId} = { uid, name, text, ts }
//   roomKey = "<areaId>_<plotNo>" for houses, or the venue id ("nightclub")
//   for party places — same room key the multiplayer "place" system uses
//   (with ":" swapped for "_" so it's a valid Firebase path).
//
// Same UI pattern as worldchat.js, but per-room and with live "in the house"
// notifications while the panel is closed.

import { db } from "../firebase.js";
import { ref, push, query, limitToLast, onChildAdded } from "firebase/database";

let _uid = null, _name = "Player";
let _room = null, _unsub = null, _open = false, _lastSend = 0;
let _panel = null, _list = null, _input = null, _titleEl = null;
const _seen = new Set();
const _pending = [];               // messages typed before Firebase listener confirmed the room

export function initHouseChat(uid, name) {
  _uid = uid; _name = name || "Player";
  _build();
}

export function setHouseChatRoom(roomKey) {
  const key = roomKey || null;
  if (key === _room) return;
  // leave old room
  if (_unsub) { try { _unsub(); } catch (e) {} _unsub = null; }
  _seen.clear();
  if (_list) _list.innerHTML = "";
  _room = key;
  if (!_room) { if (_panel) _panel.style.display = "none"; return; }
  const path = "houseChat/" + _room.replace(":", "_");
  const q = query(ref(db, path), limitToLast(50));
  let first = true;
  _unsub = onChildAdded(q, (snap) => {
    if (_seen.has(snap.key)) return;
    _seen.add(snap.key);
    _addMsg(snap.val(), !first);
    if (first) { /* replayed history — flush anything we queued optimistically */ }
  }, () => {});
  setTimeout(() => { first = false; }, 2000);
  if (_titleEl) _titleEl.textContent = (_room && /_\d+$/.test(_room)) ? "🏠 House Chat" : "🎉 Party Chat";
}

export function openHouseChat() {
  if (!_panel || !_room) return;
  _open = true;
  _panel.style.display = "flex";
  _list.scrollTop = _list.scrollHeight;
  setTimeout(() => _input && _input.focus(), 60);
}

export function closeHouseChat() {
  _open = false;
  if (_panel) _panel.style.display = "none";
}

export function toggleHouseChat() {
  if (_open) closeHouseChat(); else openHouseChat();
}

export function isHouseChatOpen() { return _open; }

// Used by house_party.doRingBell to drop a system-ish line into the room
export function pingHouseChat(text) {
  if (!_uid || !_room) return;
  push(ref(db, "houseChat/" + _room.replace(":", "_")), {
    uid: _uid, name: _name, text: String(text).slice(0, 200), ts: Date.now(),
  }).catch(() => {});
}

function _build() {
  if (_panel) return;
  _panel = document.createElement("div");
  _panel.id = "house-chat";
  _panel.style.cssText = "display:none;position:fixed;left:50%;bottom:calc(76px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:60;width:min(380px,94vw);height:min(58vh,430px);flex-direction:column;background:#17181b;color:#f2f2f4;border:1px solid #2c2e35;border-radius:16px;box-shadow:0 10px 34px rgba(0,0,0,.45);font-family:Poppins,system-ui,sans-serif;overflow:hidden;";
  _panel.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:#1f3a2c;">' +
    '<div style="flex:1;font-weight:700;font-size:14px;" id="hc-title">🏠 House Chat</div>' +
    '<button id="hc-close" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;">✕</button></div>' +
    '<div id="hc-list" style="flex:1;overflow-y:auto;padding:8px 10px;display:flex;flex-direction:column;gap:6px;"></div>' +
    '<div style="display:flex;gap:6px;padding:8px;background:#22242a;">' +
    '<input id="hc-input" maxlength="200" placeholder="Say something to the house..." autocomplete="off" style="flex:1;min-width:0;padding:10px 12px;border:1px solid #33363e;border-radius:10px;background:#17181b;color:#f2f2f4;font:13px Poppins,system-ui,sans-serif;outline:none;">' +
    '<button id="hc-send" style="background:#2e7d4f;color:#fff;border:none;border-radius:10px;padding:0 16px;font-weight:600;font-size:13px;cursor:pointer;">Send</button></div>';
  document.body.appendChild(_panel);
  _list = _panel.querySelector("#hc-list");
  _input = _panel.querySelector("#hc-input");
  _titleEl = _panel.querySelector("#hc-title");
  _panel.querySelector("#hc-close").onclick = closeHouseChat;
  _panel.querySelector("#hc-send").onclick = _send;
  _input.addEventListener("keydown", (e) => { if (e.key === "Enter") _send(); });
}

const _esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const _hue = (s) => { let h = 0; for (let i = 0; i < (s || "x").length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; };
const _clock = (ts) => { const d = new Date(ts || Date.now()); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };

function _addMsg(m, live) {
  if (!m || !m.text || !_list) return;
  const mine = m.uid === _uid;
  const row = document.createElement("div");
  row.style.cssText = "display:flex;flex-direction:column;align-items:" + (mine ? "flex-end" : "flex-start") + ";";
  const col = "hsl(" + _hue(m.uid || m.name) + ",70%,68%)";
  row.innerHTML = '<div style="font-size:10px;color:#8b8e99;margin:0 4px 1px;">' + (mine ? "You" : '<b style="color:' + col + ';">' + _esc(m.name) + "</b>") + " · " + _clock(m.ts) + "</div>" +
    '<div style="max-width:84%;padding:7px 11px;border-radius:13px;font-size:13px;line-height:1.35;word-break:break-word;' + (mine ? "background:#2e7d4f;color:#fff;border-bottom-right-radius:4px;" : "background:#2a2c33;color:#f2f2f4;border-bottom-left-radius:4px;") + '">' + _esc(m.text) + "</div>";
  const atBottom = _list.scrollHeight - _list.scrollTop - _list.clientHeight < 60;
  _list.appendChild(row);
  while (_list.children.length > 80) _list.removeChild(_list.firstChild);
  if (atBottom || mine) _list.scrollTop = _list.scrollHeight;
}

function _send() {
  const t = (_input.value || "").trim().slice(0, 200);
  if (!t || !_uid || !_room) return;
  const now = Date.now();
  if (now - _lastSend < 1200) return;                 // light flood control
  _lastSend = now; _input.value = "";
  push(ref(db, "houseChat/" + _room.replace(":", "_")), {
    uid: _uid, name: String(_name || "Player").slice(0, 30), text: t, ts: now,
  }).catch(() => {});
}
