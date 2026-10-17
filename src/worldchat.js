// src/worldchat.js — one live chat room for EVERY player (the "Talk" button).
// Firebase: chat/{pushId} = { uid, name, text, ts }   (only the last 60 are ever downloaded)
import { db } from "./firebase.js";
import { ref, push, query, limitToLast, onChildAdded } from "firebase/database";

let _uid = null, _name = "Player", _open = false, _unread = 0, _lastSend = 0, _started = false;
let _blocked = new Set();
const _seen = new Set();
let _panel, _list, _input, _badge;

export function setChatBlocked(uids) { _blocked = new Set(uids || []); }
const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hue = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; };
const clock = (ts) => { const d = new Date(ts); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };

function _build() {
  _panel = document.createElement("div");
  _panel.id = "world-chat";
  _panel.style.cssText = "display:none;position:fixed;left:50%;bottom:calc(76px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:60;width:min(380px,94vw);height:min(62vh,460px);flex-direction:column;background:#17181b;color:#f2f2f4;border:1px solid #2c2e35;border-radius:16px;box-shadow:0 10px 34px rgba(0,0,0,.45);font-family:Poppins,system-ui,sans-serif;overflow:hidden;";
  _panel.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:#1f3a2c;">' +
    '<div style="flex:1;font-weight:700;font-size:14px;">🌍 World Chat <span id="wc-online" style="font-weight:500;font-size:11px;color:#9fe0b8;"></span></div>' +
    '<button id="wc-close" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;">✕</button></div>' +
    '<div id="wc-list" style="flex:1;overflow-y:auto;padding:8px 10px;display:flex;flex-direction:column;gap:6px;"></div>' +
    '<div style="display:flex;gap:6px;padding:8px;background:#22242a;">' +
    '<input id="wc-input" maxlength="200" placeholder="Talk to everybody..." autocomplete="off" style="flex:1;min-width:0;padding:10px 12px;border:1px solid #33363e;border-radius:10px;background:#17181b;color:#f2f2f4;font:13px Poppins,system-ui,sans-serif;outline:none;">' +
    '<button id="wc-send" style="background:#2e7d4f;color:#fff;border:none;border-radius:10px;padding:0 16px;font-weight:600;font-size:13px;cursor:pointer;">Send</button></div>';
  document.body.appendChild(_panel);
  _list = _panel.querySelector("#wc-list"); _input = _panel.querySelector("#wc-input");
  _panel.querySelector("#wc-close").onclick = closeWorldChat;
  _panel.querySelector("#wc-send").onclick = _send;
  _input.addEventListener("keydown", (e) => { if (e.key === "Enter") _send(); });
  _badge = document.createElement("span");
  _badge.style.cssText = "display:none;position:absolute;top:2px;right:6px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#e11d48;color:#fff;font-size:10px;font-weight:700;line-height:16px;text-align:center;";
  const nb = document.querySelector('#bottom-nav .nav-btn[data-nav="chat"]');
  if (nb) { nb.style.position = "relative"; nb.appendChild(_badge); }
}

export function _addMsg(m, live) {
  if (!m || !m.text) return;
  const mine = m.uid === _uid;
  if (!mine && _blocked.has(m.uid)) return;
  const row = document.createElement("div");
  row.style.cssText = "display:flex;flex-direction:column;align-items:" + (mine ? "flex-end" : "flex-start") + ";";
  const col = "hsl(" + hue(m.uid || m.name || "x") + ",70%,68%)";
  row.innerHTML = '<div style="font-size:10px;color:#8b8e99;margin:0 4px 1px;">' + (mine ? "You" : '<b style="color:' + col + ';">' + esc(m.name) + "</b>") + " · " + clock(m.ts || Date.now()) + "</div>" +
    '<div style="max-width:84%;padding:7px 11px;border-radius:13px;font-size:13px;line-height:1.35;word-break:break-word;' + (mine ? "background:#2e7d4f;color:#fff;border-bottom-right-radius:4px;" : "background:#2a2c33;color:#f2f2f4;border-bottom-left-radius:4px;") + '">' + esc(m.text) + "</div>";
  const atBottom = _list.scrollHeight - _list.scrollTop - _list.clientHeight < 60;
  _list.appendChild(row);
  while (_list.children.length > 80) _list.removeChild(_list.firstChild);
  if (atBottom || mine || !_open) _list.scrollTop = _list.scrollHeight;
  if (live && !mine && !_open) { _unread++; _badge.textContent = _unread > 9 ? "9+" : _unread; _badge.style.display = "block"; }
}

function _send() {
  const t = (_input.value || "").trim().slice(0, 200);
  if (!t || !_uid) return;
  const now = Date.now();
  if (now - _lastSend < 1500) return;                 // 1 message per 1.5 s
  _lastSend = now; _input.value = "";
  push(ref(db, "chat"), { uid: _uid, name: String(_name || "Player").slice(0, 30), text: t, ts: now }).catch(() => {});
}

export function openWorldChat() {
  if (!_panel) return;
  _open = true; _unread = 0; _badge.style.display = "none";
  _panel.style.display = "flex"; _list.scrollTop = _list.scrollHeight;
  setTimeout(() => _input.focus(), 50);
}
export function closeWorldChat() { _open = false; if (_panel) _panel.style.display = "none"; }
export function toggleWorldChat() { _open ? closeWorldChat() : openWorldChat(); }
export function setChatOnline(n) { const e = document.getElementById("wc-online"); if (e) e.textContent = n ? "· " + n + " online" : ""; }

export function initWorldChat(uid, name) {
  _uid = uid; _name = name || "Player";
  if (_started) return; _started = true;
  _build();
  const q = query(ref(db, "chat"), limitToLast(60));
  let first = true;
  setTimeout(() => { first = false; }, 2500);          // messages that arrive in the first moments are history, not "new"
  onChildAdded(q, (snap) => {
    if (_seen.has(snap.key)) return; _seen.add(snap.key);
    _addMsg(snap.val(), !first);
  }, () => {});
}
