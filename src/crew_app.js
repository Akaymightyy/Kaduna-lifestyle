// src/crew_app.js — 🛡️ CREW phone app + the one entry point main.js calls.
//
// Tabs: 👥 Crew (roster + bank + management) · 💬 Chat · 🗺️ Areas (territory)
//       ⚔️ War (standings + contribute + daily challenges) · 🏆 Rank (crews + cred)
//
// Everything money-shaped goes through crews.js (serverSpend pipeline) — this
// file is UI only. Auto-refresh follows the builds app pattern (3 s interval,
// skipped while an input is focused or the chat tab dey open).

import {
  CREW_AREAS, areaAt, ownerOf, territoryData, crewArea, weekKey,
  dailyBonusFor, warRewardFor, bonusClaimedToday, warRewardClaimed, mapOverlay,
} from "./territory.js";
import {
  initCrews, crewsSetUid, myCrew, myCrewId, myRole, crewSummary, crewMembers, allCrews, myCred,
  isLeader, isCoLeader, createCrew, joinCrew, leaveCrew, kickMember, changeRole,
  transferLeadership, disbandCrew, depositToBank, withdrawFromBank, claimAreaBonus,
  CREW_CREATE_FEE, CREW_COLORS, MAX_MEMBERS, ROLE_LABEL, xpForNext, slotsFor, bankCapFor, ROLES,
} from "./crews.js";
import { CHALLENGES, challengeProgress, challengeClaimed, claimChallenge, setWarTarget, standingsFor, claimWarReward } from "./crew_war.js";
import { initCrewChat, chatSetCrew, chatMsgs, chatUnread, renderCrewChatHTML, wireCrewChat, clearChatUnread } from "./crew_chat.js";
import { initTerritory, initTerritoryFlags, tickTerritoryFlags, redrawFlags, ensureTerritoryLive } from "./territory.js";
import { initCrewWar, warSetUid, tickCrewWar } from "./crew_war.js";

const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtN = (n) => "₦" + Math.floor(n || 0).toLocaleString();
const kN = (n) => (n >= 1000000 ? "₦" + (n / 1000000).toFixed(n % 1000000 ? 1 : 0) + "M" : n >= 1000 ? "₦" + Math.round(n / 1000) + "k" : "₦" + (n || 0));

let _getState = null;
let _toast = () => {};
let _pill = null;            // "🚩 Barnawa · [KDW]" mini HUD pill
let _lastArea = null;
let _inited = false;

// ---------- ENTRY POINT (main.js calls this once at boot) ----------
export function initCrewSystems({ scene, colliders, getState, getName, toast, updateHUD, celebrate }) {
  if (_inited) return;
  _inited = true;
  _getState = getState || null;
  _toast = toast || _toast;
  const refresh = () => { try { updateHUD && updateHUD(); } catch (e) {} _maybeRerender(); };
  initTerritory(() => { redrawFlags(); refresh(); });
  initTerritoryFlags(scene, colliders || []);
  initCrews({ getState, getName, toast, updateHUD: refresh, celebrate });
  initCrewWar({ getState, toast, updateHUD: refresh, celebrate });
  initCrewChat(null, getName ? getName() : "Player", () => { _maybeRerender(true); });
  window.addEventListener("kl_crew_changed", (ev) => {
    try { chatSetCrew((ev.detail && ev.detail.crewId) || null); } catch (e) {}
    window._cwTab = "crew";
    _maybeRerender();
  });
  _buildAreaPill();
  console.log("[crew] systems ready — 8 areas dey open for war 🚩");
}

// Per-login data hooks (main.js calls inside the auth handler).
export function crewSetUid(uid) {
  ensureTerritoryLive();      // territory listener must attach AFTER auth (rules!)
  crewsSetUid(uid);
  warSetUid(uid);
  if (!uid) chatSetCrew(null);
}

// Per-frame (main.js render loop, skipped while inside a place).
export function tickCrewSystems(dt, px, pz) {
  tickTerritoryFlags(dt);
  tickCrewWar(dt, px, pz);
  _tickAreaPill(px, pz);
}

// ---------- mini HUD pill: which crew dey control where I dey stand ----------
function _buildAreaPill() {
  if (_pill) return;
  _pill = document.createElement("div");
  _pill.id = "crew-area-pill";
  _pill.style.cssText = "display:none;position:fixed;left:12px;top:calc(env(safe-area-inset-top) + 88px);z-index:22;background:rgba(15,40,30,.78);color:#fff;padding:5px 10px;border-radius:10px;font:600 11px Poppins,system-ui,sans-serif;pointer-events:none;backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,.14);max-width:60vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
  document.body.appendChild(_pill);
}
function _tickAreaPill(px, pz) {
  if (!_pill) return;
  const a = areaAt(px, pz);
  if (!a) { if (_lastArea) { _lastArea = null; _pill.style.display = "none"; } return; }
  if (a === _lastArea) return;
  _lastArea = a;
  const info = crewArea(a);
  const o = ownerOf(a);
  _pill.innerHTML = o
    ? "🚩 <b>" + esc(info.name) + "</b> · <span style='color:" + esc(o.color) + ";'>[" + esc(o.tag) + "]</span> " + esc(o.name)
    : "🚩 <b>" + esc(info.name) + "</b> · free for war";
  _pill.style.display = "block";
}

// ---------- helpers ----------
function _me() { const s = _getState ? _getState() : {}; return { money: (s && s.money) || 0 }; }
function _rerenderNow() {
  try {
    const modal = document.getElementById("phone-modal");
    if (!modal || !modal.classList.contains("show")) return;
    if (window._showingApp !== "crew") return;
    const c = document.getElementById("phone-content");
    if (c) c.innerHTML = renderCrewApp();
    if (window._cwTab === "chat") wireCrewChat();
  } catch (e) {}
}
function _maybeRerender(force) {
  const t = window._cwTab || "crew";
  if (!force && (t === "chat")) return;
  try {
    const ae = document.activeElement;
    if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) return;   // never eat typing
  } catch (e) {}
  _rerenderNow();
}
let _appT = null;
export function startCrewAppRefresher() {
  if (_appT) clearInterval(_appT);
  _appT = setInterval(() => _maybeRerender(), 3000);
}

// ---------- the app ----------
export function renderCrewApp() {
  const back = '<button onclick="window.showApp(\'home\')" style="margin-top:14px;background:transparent;border:none;color:#4ade80;cursor:pointer;font-size:13px;font-weight:600;">← Back to Phone</button>';
  if (!myCrew()) return _renderNoCrew() + back;
  const t = window.__cwCurTab || "crew";
  let h = _renderCrewHeader();
  h += '<div style="display:flex;gap:4px;margin:10px 0 8px;">' + [
    ["crew", "👥 Crew"], ["chat", "💬 Chat" + (chatUnread() > 0 ? ' <span style="background:#e11d48;color:#fff;border-radius:8px;padding:0 5px;font-size:9px;font-weight:700;">' + Math.min(9, chatUnread()) + "</span>" : "")],
    ["areas", "🗺️ Areas"], ["war", "⚔️ War"], ["rank", "🏆 Rank"],
  ].map(([id, label]) => '<button onclick="window._cwTab(\'' + id + '\')" style="flex:1;background:' + (t === id ? "#4ade80" : "#17181b") + ';color:' + (t === id ? "#000" : "#f2f2f4") + ';border:none;border-radius:8px;padding:8px 2px;cursor:pointer;font-size:10px;font-weight:700;">' + label + "</button>").join("") + "</div>";
  if (t === "chat") {
    h += renderCrewChatHTML();
    setTimeout(() => { try { if (window._showingApp === "crew" && (window.__cwCurTab || "crew") === "chat") wireCrewChat(); } catch (e) {} }, 60);
  }
  else if (t === "areas") h += _renderAreas();
  else if (t === "war") h += _renderWar();
  else if (t === "rank") h += _renderRank();
  else h += _renderCrewTab();
  return h + back;
}
window._cwTab = (t) => {
  window.__cwCurTab = t;
  if (t === "chat") clearChatUnread();
  _rerenderNow();
};
window.__cwCurTab = "crew";

// ---------- NO-CREW VIEW ----------
function _renderNoCrew() {
  const me = _me();
  const crews = Object.entries(allCrews())
    .map(([id, c]) => ({ id, ...c }))
    .sort((a, b) => (b.power || 0) - (a.power || 0))
    .slice(0, 30);
  const color = window.__cwColor || CREW_COLORS[0];
  const nName = document.getElementById("cw-name");
  const nTag = document.getElementById("cw-tag");
  const nDesc = document.getElementById("cw-desc");
  const keepName = nName ? esc(nName.value) : "";
  const keepTag = nTag ? esc(nTag.value) : "";
  const keepDesc = nDesc ? esc(nDesc.value) : "";
  let h = '<div style="font-size:15px;margin-bottom:4px;font-weight:700;color:#f2f2f4;">🛡️ Crews — rule Kaduna together</div>';
  h += '<div style="font-size:11px;color:#9b9ba4;margin-bottom:10px;">Balance: ' + fmtN(me.money) + ' · Your Street Cred: <b style="color:#f2b134;">' + (myCred() || 0).toLocaleString() + "</b></div>";
  h += '<div style="background:#17181b;border-radius:12px;padding:12px;margin-bottom:12px;">';
  h += '<div style="font-size:12px;font-weight:700;color:#f2b134;margin-bottom:8px;">🚀 Start your own Crew <span style="color:#9b9ba4;font-weight:500;">(register fee ' + kN(CREW_CREATE_FEE) + ")</span></div>";
  h += '<input id="cw-name" maxlength="24" placeholder="Crew name (e.g. Kaduna Warriors)" value="' + keepName + '" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #33363e;border-radius:10px;background:#101114;color:#f2f2f4;font:13px Poppins,sans-serif;outline:none;margin-bottom:6px;">';
  h += '<div style="display:flex;gap:6px;margin-bottom:6px;">';
  h += '<input id="cw-tag" maxlength="5" placeholder="Tag e.g. KDW" value="' + keepTag + '" style="width:110px;padding:10px 12px;border:1px solid #33363e;border-radius:10px;background:#101114;color:#f2f2f4;font:13px Poppins,sans-serif;outline:none;text-transform:uppercase;">';
  h += '<input id="cw-desc" maxlength="140" placeholder="Short description (optional)" value="' + keepDesc + '" style="flex:1;padding:10px 12px;border:1px solid #33363e;border-radius:10px;background:#101114;color:#f2f2f4;font:13px Poppins,sans-serif;outline:none;"></div>';
  h += '<div style="display:flex;gap:6px;margin:8px 0;flex-wrap:wrap;">' + CREW_COLORS.map((c) => '<button onclick="window._cwPickColor(\'' + c + '\')" style="width:30px;height:30px;border-radius:50%;border:' + (c === color ? "3px solid #fff" : "2px solid #33363e") + ';background:' + c + ';cursor:pointer;"></button>').join("") + "</div>";
  h += '<button onclick="window._cwDoCreate()" style="width:100%;background:#4ade80;color:#000;border:none;border-radius:10px;padding:13px;cursor:pointer;font-size:13px;font-weight:800;">🛡️ Register Crew — ' + kN(CREW_CREATE_FEE) + "</button></div>";
  h += '<div style="font-size:12px;font-weight:700;color:#f2b134;margin:12px 0 6px;">🌍 Crews dey recruit (' + crews.length + ")</div>";
  if (!crews.length) h += '<div style="font-size:11px;color:#6b7280;padding:10px;text-align:center;background:#17181b;border-radius:8px;">No Crew yet — be the first to register! 💪</div>';
  for (const c of crews) {
    const full = (c.membersCount || 0) >= slotsFor(c.level || 1);
    h += '<div style="display:flex;align-items:center;gap:8px;padding:9px;background:#17181b;border-radius:10px;margin-bottom:5px;">' +
      '<div style="width:34px;height:34px;border-radius:9px;background:' + esc(c.color || "#e11d48") + ';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;">' + esc(c.tag || "?") + "</div>" +
      '<div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:700;color:#f2f2f4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(c.name) + ' <span style="color:#9b9ba4;font-weight:500;">· Lv ' + (c.level || 1) + "</span></div>" +
      '<div style="font-size:10px;color:#9b9ba4;">👤 ' + (c.membersCount || 1) + "/" + slotsFor(c.level || 1) + " · 💪 " + (c.power || 0).toLocaleString() + " power · 👑 " + esc(c.leaderName || "?") + "</div>" +
      (c.desc ? '<div style="font-size:10px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(c.desc) + "</div>" : "") + "</div>" +
      (full ? '<span style="font-size:10px;color:#e11d48;font-weight:700;">FULL</span>' : '<button onclick="window._cwJoin(\'' + c.id + '\')" style="background:#4ade80;color:#000;border:none;border-radius:8px;padding:8px 12px;cursor:pointer;font-size:11px;font-weight:700;">Join</button>') + "</div>";
  }
  return h;
}
window._cwPickColor = (c) => { window.__cwColor = c; _rerenderNow(); };
window._cwDoCreate = async () => {
  const name = (document.getElementById("cw-name") || {}).value || "";
  const tag = (document.getElementById("cw-tag") || {}).value || "";
  const desc = (document.getElementById("cw-desc") || {}).value || "";
  const r = await createCrew(name, tag, window.__cwColor || CREW_COLORS[0], desc);
  _toast(r.msg || (r.ok ? "Crew don born!" : "No work — try again."));
  if (r.ok) { window.__cwColor = null; window.__cwCurTab = "crew"; window.showApp("crew"); }
};
window._cwJoin = async (crewId) => {
  const r = await joinCrew(crewId);
  _toast(r.msg || (r.ok ? "Welcome!" : "No work."));
  if (r.ok) window.showApp("crew");
};

// ---------- HEADER (my crew) ----------
function _renderCrewHeader() {
  const c = myCrew(), s = crewSummary() || {};
  const lvl = s.level || 1, xp = s.xp || 0, need = xpForNext(lvl);
  const prog = Math.max(0, Math.min(1, xp / need));
  const target = s.warTarget ? crewArea(s.warTarget) : null;
  const tOwner = s.warTarget ? ownerOf(s.warTarget) : null;
  let h = '<div style="background:linear-gradient(135deg,' + esc(c.color || "#e11d48") + ',#17181b);border-radius:14px;padding:12px;">';
  h += '<div style="display:flex;align-items:center;gap:10px;">';
  h += '<div style="width:44px;height:44px;border-radius:12px;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;border:1px solid rgba(255,255,255,.25);">' + esc(c.tag) + "</div>";
  h += '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(s.name || c.name) + "</div>";
  h += '<div style="font-size:10px;color:rgba(255,255,255,.85);">Lv ' + lvl + " · 👤 " + (s.membersCount || 1) + "/" + slotsFor(lvl) + " · 💪 " + (s.power || 0).toLocaleString() + " power · you na " + (ROLE_LABEL[c.role] || c.role) + "</div></div></div>";
  h += '<div style="margin-top:9px;"><div style="height:7px;background:rgba(0,0,0,.35);border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + Math.round(prog * 100) + '%;background:#f2b134;"></div></div>';
  h += '<div style="display:flex;justify-content:space-between;font-size:9px;color:rgba(255,255,255,.8);margin-top:3px;"><span>XP ' + xp.toLocaleString() + "/" + need.toLocaleString() + "</span><span>Bank " + kN(s.bank || 0) + "/" + kN(bankCapFor(lvl)) + "</span></div></div>";
  if (target) {
    h += '<div style="margin-top:8px;background:rgba(0,0,0,.3);border-radius:9px;padding:7px 9px;font-size:10px;color:#fff;">⚔️ War target: <b>' + esc(target.name) + "</b> · " + (tOwner && tOwner.crewId === c.crewId ? "🛡️ we dey defend am" : tOwner ? "enemy: [" + esc(tOwner.tag) + "]" : "free — make we claim am!") + "</div>";
  } else {
    h += '<div style="margin-top:8px;background:rgba(0,0,0,.3);border-radius:9px;padding:7px 9px;font-size:10px;color:rgba(255,255,255,.75);">⚔️ No war target — Leader/Co-Leader fit set one for the Areas tab.</div>';
  }
  h += "</div>";
  return h;
}

// ---------- TAB: CREW (roster + bank + management) ----------
function _memberActions(m, uid) {
  const c = myCrew();
  if (!isCoLeader()) return "";
  const myI = ROLES.indexOf(c.role), tI = ROLES.indexOf(m.role);
  const canTouch = uid !== myCrewId() && tI > myI;   // only lower ranks
  if (!canTouch) return "";
  let btns = "";
  if (c.role === "leader") {
    if (m.role !== "coleader") btns += '<button onclick="window._cwRole(\'' + uid + '\',\'coleader\')" title="Make Co-Leader" style="background:#1e3a5f;color:#9cc3e8;border:none;border-radius:6px;padding:5px 7px;font-size:10px;cursor:pointer;">🛡️</button>';
    else btns += '<button onclick="window._cwRole(\'' + uid + '\',\'elder\')" style="background:#1e3a5f;color:#9cc3e8;border:none;border-radius:6px;padding:5px 7px;font-size:10px;cursor:pointer;">⬇️</button>';
    if (m.role === "member" || m.role === "elder") btns += '<button onclick="window._cwRole(\'' + uid + '\',\'elder\')" style="background:#1e3a5f;color:#9cc3e8;border:none;border-radius:6px;padding:5px 7px;font-size:10px;cursor:pointer;">⭐</button>';
    btns += '<button onclick="window._cwTransfer(\'' + uid + '\',\'' + esc(m.name).replace(/'/g, "") + '\')" title="Transfer leadership" style="background:#7c3aed;color:#fff;border:none;border-radius:6px;padding:5px 7px;font-size:10px;cursor:pointer;">👑</button>';
  } else if (c.role === "coleader" && m.role === "member") {
    btns += '<button onclick="window._cwRole(\'' + uid + '\',\'elder\')" style="background:#1e3a5f;color:#9cc3e8;border:none;border-radius:6px;padding:5px 7px;font-size:10px;cursor:pointer;">⭐</button>';
  }
  btns += '<button onclick="window._cwKick(\'' + uid + '\',\'' + esc(m.name).replace(/'/g, "") + '\')" style="background:#7f1d1d;color:#fca5a5;border:none;border-radius:6px;padding:5px 7px;font-size:10px;cursor:pointer;">👢</button>';
  return btns;
}
function _renderCrewTab() {
  const c = myCrew(), s = crewSummary() || {}, me = _me();
  const roster = Object.entries(crewMembers()).sort((a, b) => ROLES.indexOf(a[1].role) - ROLES.indexOf(b[1].role) || (b[1].contributed || 0) - (a[1].contributed || 0));
  let h = "";
  // bank box
  h += '<div style="background:#17181b;border-radius:12px;padding:11px;margin-bottom:8px;">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;"><div style="font-size:12px;font-weight:700;color:#f2b134;">🏦 Crew Bank</div><div style="font-size:13px;font-weight:800;color:#4ade80;">' + fmtN(s.bank || 0) + "</div></div>";
  h += '<div style="font-size:10px;color:#9b9ba4;margin-top:3px;">Everybody fit contribute — Leader/Co-Leader fit withdraw. Cap: ' + kN(bankCapFor(s.level || 1)) + "</div>";
  h += '<div style="display:flex;gap:5px;margin-top:8px;flex-wrap:wrap;">';
  for (const amt of [10000, 50000, 100000, 500000]) {
    h += '<button onclick="window._cwDep(\'' + amt + '\')" ' + (me.money < amt ? "disabled" : "") + ' style="flex:1;min-width:70px;background:' + (me.money >= amt ? "#2e7d4f" : "#22242a") + ';color:' + (me.money >= amt ? "#fff" : "#6b7280") + ';border:none;border-radius:8px;padding:8px 4px;cursor:pointer;font-size:11px;font-weight:700;">+' + kN(amt) + "</button>";
  }
  h += "</div>";
  if (isCoLeader()) {
    h += '<div style="display:flex;gap:5px;margin-top:5px;flex-wrap:wrap;">';
    for (const amt of [50000, 100000, 500000]) {
      h += '<button onclick="window._cwWd(\'' + amt + '\')" ' + ((s.bank || 0) < amt ? "disabled" : "") + ' style="flex:1;background:#1e3a5f;color:' + ((s.bank || 0) >= amt ? "#9cc3e8" : "#6b7280") + ';border:none;border-radius:8px;padding:7px 4px;cursor:pointer;font-size:10px;font-weight:700;">−' + kN(amt) + "</button>";
    }
    h += "</div>";
  }
  h += "</div>";
  // roster
  h += '<div style="font-size:12px;font-weight:700;color:#f2b134;margin:10px 0 6px;">👥 Members (' + roster.length + "/" + slotsFor(s.level || 1) + ")</div>";
  for (const [uid, m] of roster) {
    const mine = uid === myCrewId();
    const online = m.role === "leader" ? "👑 " : m.role === "coleader" ? "🛡️ " : m.role === "elder" ? "⭐ " : "";
    h += '<div style="display:flex;align-items:center;gap:8px;padding:8px 9px;background:' + (mine ? "#1a2a1a" : "#17181b") + ';border:1px solid ' + (mine ? "#2e7d4f" : "transparent") + ';border-radius:10px;margin-bottom:5px;">' +
      '<div style="width:30px;height:30px;border-radius:50%;background:' + esc(c.color || "#e11d48") + ';display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;">' + esc((m.name || "?").charAt(0).toUpperCase()) + "</div>" +
      '<div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:700;color:#f2f2f4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + online + esc(m.name || "?") + (mine ? ' <span style="color:#4ade80;font-size:9px;">(you)</span>' : "") + "</div>" +
      '<div style="font-size:9px;color:#9b9ba4;">' + (ROLE_LABEL[m.role] || m.role) + " · 🤝 " + kN(m.contributed || 0) + " · ⚔️ " + (m.weeklyPts || 0) + " pts · 🔥 cred " + (m.cred || 0).toLocaleString() + "</div></div>" +
      '<div style="display:flex;gap:3px;">' + _memberActions(m, uid) + "</div></div>";
  }
  // leave / disband
  h += '<div style="display:flex;gap:6px;margin-top:10px;">';
  if (!(c.role === "leader" && (s.membersCount || 1) > 1)) h += '<button onclick="window._cwLeaveAsk()" style="flex:1;background:transparent;color:#fca5a5;border:1px solid #7f1d1d;border-radius:10px;padding:10px;cursor:pointer;font-size:11px;font-weight:700;">🚪 ' + (c.role === "leader" ? "Disband Crew" : "Leave Crew") + "</button>";
  else h += '<div style="flex:1;font-size:10px;color:#6b7280;text-align:center;padding:10px;background:#17181b;border-radius:10px;">Transfer 👑 or kick everybody before you fit comot.</div>';
  h += "</div>";
  return h;
}
window._cwDep = async (amt) => {
  const s = crewSummary() || {};
  const area = s.warTarget || "";
  const r = await depositToBank(Number(amt), area);
  _toast(r.msg || (r.ok ? "Banked!" : "No work."));
  if (r.ok) window.showApp("crew");
};
window._cwWd = async (amt) => {
  const r = await withdrawFromBank(Number(amt));
  _toast(r.msg || (r.ok ? "Withdrawn." : "No work."));
  if (r.ok) window.showApp("crew");
};
window._cwLeaveAsk = () => {
  const c = myCrew();
  if (!c) return;
  if (c.role === "leader") {
    if (!confirm("Disband [" + c.tag + "] forever? Territory wey we hold go free for the next war.")) return;
    disbandCrew().then((r) => { _toast(r.msg || "Done."); if (r.ok) window.showApp("crew"); });
  } else {
    if (!confirm("Leave [" + c.tag + "] " + (crewSummary() || {}).name + "? Your Street Cred go stay with you.")) return;
    leaveCrew().then((r) => { _toast(r.msg || "Done."); if (r.ok) window.showApp("crew"); });
  }
};
window._cwKick = async (uid, name) => { if (!confirm("Kick " + name + " from the Crew?")) return; const r = await kickMember(uid, name); _toast(r.msg || "Done."); if (r.ok) window.showApp("crew"); };
window._cwRole = async (uid, role) => { const r = await changeRole(uid, role); _toast(r.msg || "Done."); if (r.ok) window.showApp("crew"); };
window._cwTransfer = async (uid, name) => { if (!confirm("Transfer LEADERSHIP to " + name + "? You go become Co-Leader. No undo-undo!")) return; const r = await transferLeadership(uid, name); _toast(r.msg || "Done."); if (r.ok) window.showApp("crew"); };

// ---------- TAB: AREAS ----------
function _renderAreas() {
  const c = myCrew(), s = crewSummary() || {};
  let h = '<div style="font-size:11px;color:#9b9ba4;margin-bottom:8px;">One Crew fit hold one area at a time. Owner crew members dey collect daily bonus + 10% house discount inside. 🚩</div>';
  for (const a of CREW_AREAS) {
    const o = ownerOf(a.id);
    const ours = o && o.crewId === c.crewId;
    const claimed = ours && bonusClaimedToday(a.id, myCrewId());
    const cd = ours ? 0 : ((territoryData()[a.id] || {}).cooldowns || {})[c.crewId] || 0;
    const cdLeft = cd > Date.now() ? Math.ceil((cd - Date.now()) / 86400000) : 0;
    const isTarget = s.warTarget === a.id;
    h += '<div style="background:#17181b;border:' + (ours ? "2px solid " + esc(c.color || "#4ade80") : isTarget ? "2px solid #f2b134" : "1px solid transparent") + ';border-radius:12px;padding:10px;margin-bottom:6px;">';
    h += '<div style="display:flex;align-items:center;gap:8px;">';
    h += '<div style="width:10px;height:34px;border-radius:5px;background:' + (o ? esc(o.color) : "#3a3f47") + ';"></div>';
    h += '<div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:700;color:#f2f2f4;">' + (a.rich ? "💎 " : "🏘️ ") + esc(a.name) + (isTarget ? ' <span style="color:#f2b134;font-size:9px;">⚔️ TARGET</span>' : "") + "</div>";
    h += '<div style="font-size:10px;color:#9b9ba4;">' + esc(a.desc) + "</div></div>";
    if (o) h += '<div style="text-align:right;"><div style="font-size:10px;font-weight:800;color:' + esc(o.color) + '">[' + esc(o.tag) + ']</div><div style="font-size:9px;color:#6b7280;">' + esc(o.name) + "</div></div>";
    else h += '<div style="font-size:10px;color:#4ade80;font-weight:700;">FREE</div>';
    h += "</div>";   // close the flex row — the card stays open for the action row below
    // action row
    h += '<div style="display:flex;gap:5px;margin-top:7px;flex-wrap:wrap;">';
    if (ours) {
      h += claimed
        ? '<span style="flex:1;font-size:10px;color:#4ade80;background:#1a2a1a;border-radius:8px;padding:8px;text-align:center;font-weight:700;">✅ Bonus collected — come back tomorrow</span>'
        : '<button onclick="window._cwClaimBonus(\'' + a.id + '\')" style="flex:1;background:#f2b134;color:#000;border:none;border-radius:8px;padding:8px;cursor:pointer;font-size:11px;font-weight:800;">🚩 Collect ' + kN(dailyBonusFor(s.level || 1)) + " daily</button>";
      h += '<span style="font-size:9px;color:#6b7280;padding:8px 2px;">🏠 10% off houses here</span>';
    } else if (isLeader() || isCoLeader()) {
      if (cdLeft > 0) h += '<span style="flex:1;font-size:10px;color:#fca5a5;background:#1a1a1a;border-radius:8px;padding:8px;text-align:center;font-weight:700;">⏳ Cooldown ' + cdLeft + "d — we lose here last week</span>";
      else h += '<button onclick="window._cwTarget(\'' + a.id + '\')" style="flex:1;background:' + (isTarget ? "#22242a;color:#6b7280;" : "#1e3a5f;color:#9cc3e8;") + 'border:none;border-radius:8px;padding:8px;cursor:pointer;font-size:11px;font-weight:700;">⚔️ ' + (o ? "Attack [" + esc(o.tag) + "]" : "Claim this area") + "</button>";
    } else if (o) {
      h += '<span style="flex:1;font-size:10px;color:#6b7280;text-align:center;padding:8px;">[' + esc(o.tag) + "] dey control — join the hustle 💪</span>";
    } else {
      h += '<span style="flex:1;font-size:10px;color:#6b7280;text-align:center;padding:8px;">Free — your Leader fit set am as war target</span>';
    }
    h += "</div></div>";
  }
  return h;
}
window._cwTarget = async (areaId) => { const r = await setWarTarget(areaId); _toast(r.msg || "Done."); if (r.ok) window.showApp("crew"); };
window._cwClaimBonus = async (areaId) => { const r = await claimAreaBonus(areaId); _toast(r.msg || "Collected!"); window.showApp("crew"); };

// ---------- TAB: WAR ----------
function _renderWar() {
  const c = myCrew(), s = crewSummary() || {};
  const target = s.warTarget;
  const wk = weekKey();
  let h = "";
  // war reward banner (we own the target)
  if (target) {
    const o = ownerOf(target);
    if (o && o.crewId === c.crewId) {
      const got = warRewardClaimed(target, myCrewId(), (territoryData()[target] || {}).week || wk);
      h += '<div style="background:linear-gradient(135deg,' + esc(c.color || "#2e7d4f") + ',#17181b);border-radius:12px;padding:11px;margin-bottom:8px;display:flex;align-items:center;gap:8px;">' +
        '<div style="flex:1;"><div style="font-size:12px;font-weight:800;color:#fff;">🏆 WE DEY CONTROL ' + esc((crewArea(target) || {}).name || "") + "!</div>" +
        '<div style="font-size:10px;color:rgba(255,255,255,.85);">War reward: ' + kN(warRewardFor(s.level || 1)) + " + 100 cred per member</div></div>" +
        (got ? '<span style="font-size:10px;color:#4ade80;font-weight:700;">✅ Collected</span>'
             : '<button onclick="window._cwWarReward(\'' + target + '\')" style="background:#f2b134;color:#000;border:none;border-radius:8px;padding:9px 12px;cursor:pointer;font-size:11px;font-weight:800;">Collect</button>') + "</div>";
    }
  }
  // standings
  h += '<div style="background:#17181b;border-radius:12px;padding:11px;margin-bottom:8px;">';
  h += '<div style="font-size:12px;font-weight:700;color:#f2b134;">⚔️ This week (" + wk + ")</div>';
  if (!target) h += '<div style="font-size:11px;color:#6b7280;margin-top:6px;">No war target yet. Leader/Co-Leader: pick one for the Areas tab — then every deposit + hustle go push points there.</div>';
  else {
    const a = crewArea(target);
    const o = ownerOf(target);
    const st = standingsFor(target);
    const crewLabel = (cid) => {
      if (cid === c.crewId) return "[" + c.tag + "] US";
      const info = allCrews()[cid];
      return info ? "[" + (info.tag || "?") + "] " + (info.name || "") : cid.slice(0, 10);
    };
    const myRow = st.find(r => r.crewId === c.crewId);
    h += '<div style="font-size:11px;color:#9b9ba4;margin-top:3px;">' + esc(a.name) + " · owner: " + (o ? "<b style='color:" + esc(o.color) + "'>[" + esc(o.tag) + "]</b> " + esc(o.name) : "FREE") + "</div>";
    if (!st.length) h += '<div style="font-size:11px;color:#6b7280;margin-top:8px;">Nobody score yet — first deposit open the war! 🤝</div>';
    for (const r of st.slice(0, 8)) {
      h += '<div style="display:flex;align-items:center;gap:8px;margin-top:7px;">' +
        '<div style="flex:1;font-size:11px;color:' + (r.crewId === c.crewId ? "#4ade80;font-weight:800;" : "#f2f2f4;") + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">🛡️ ' + esc(crewLabel(r.crewId)) + "</div>" +
        '<div style="width:45%;height:8px;background:#2a2b30;border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + Math.min(100, Math.round(r.pts / Math.max(1, st[0].pts) * 100)) + '%;background:' + (r.crewId === c.crewId ? "#4ade80" : "#f2b134") + ';"></div></div>' +
        '<div style="font-size:11px;font-weight:800;color:#f2f2f4;width:52px;text-align:right;">' + r.pts.toLocaleString() + "</div></div>";
    }
    if (myRow) h += '<div style="font-size:10px;color:#9b9ba4;margin-top:6px;">Our points: <b style="color:#4ade80;">' + myRow.pts.toLocaleString() + "</b>" + (o && o.crewId === c.crewId ? " — defend make nobody pass us!" : st[0] && st[0].crewId !== c.crewId ? " — we need " + (st[0].pts - myRow.pts + 1).toLocaleString() + " more to lead!" : "") + "</div>";
  }
  h += "</div>";
  // contribute
  const me = _me();
  h += '<div style="background:#17181b;border-radius:12px;padding:11px;margin-bottom:8px;">';
  h += '<div style="font-size:12px;font-weight:700;color:#f2b134;">🤝 Contribute to the war</div>';
  h += '<div style="font-size:10px;color:#9b9ba4;margin:3px 0 8px;">₦1,000 = 1 war point + Crew XP. Money enter Crew Bank — Leader/Co-Leader fit withdraw am.</div>';
  h += '<div style="display:flex;gap:5px;flex-wrap:wrap;">';
  for (const amt of [10000, 50000, 100000, 500000]) {
    h += '<button onclick="window._cwDep(\'' + amt + '\')" ' + (me.money < amt ? "disabled" : "") + ' style="flex:1;min-width:70px;background:' + (me.money >= amt ? "#2e7d4f" : "#22242a") + ';color:' + (me.money >= amt ? "#fff" : "#6b7280") + ';border:none;border-radius:8px;padding:9px 4px;cursor:pointer;font-size:11px;font-weight:700;">' + kN(amt) + "</button>";
  }
  h += "</div></div>";
  // challenges
  h += '<div style="background:#17181b;border-radius:12px;padding:11px;margin-bottom:8px;">';
  h += '<div style="font-size:12px;font-weight:700;color:#f2b134;">🎯 Daily Crew Challenges</div>';
  for (const ch of CHALLENGES) {
    const p = challengeProgress(ch);
    const done = p.done, got = challengeClaimed(ch);
    const pct = Math.min(100, Math.round((p.cur / ch.target) * 100));
    h += '<div style="margin-top:9px;">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;"><div style="font-size:11px;font-weight:700;color:#f2f2f4;">' + ch.icon + " " + esc(ch.name) + '</div><div style="font-size:9px;color:#9b9ba4;">+' + ch.pts + " pts · +" + ch.cred + " cred</div></div>";
    h += '<div style="font-size:10px;color:#9b9ba4;">' + esc(ch.desc) + "</div>";
    h += '<div style="display:flex;align-items:center;gap:7px;margin-top:4px;">';
    h += '<div style="flex:1;height:7px;background:#2a2b30;border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:' + (done ? "#4ade80" : "#f2b134") + ';"></div></div>';
    h += got ? '<span style="font-size:10px;color:#4ade80;font-weight:700;">✅</span>'
      : '<button onclick="window._cwClaimChal(\'' + ch.id + '\')" ' + (done ? "" : "disabled") + ' style="background:' + (done ? "#4ade80;color:#000;" : "#22242a;color:#6b7280;") + 'border:none;border-radius:7px;padding:5px 10px;cursor:pointer;font-size:10px;font-weight:800;">' + (done ? "Claim" : (ch.isMoney ? kN(Math.max(0, ch.target - p.cur)) + " left" : Math.max(0, ch.target - p.cur) + " left")) + "</button>";
    h += "</div></div>";
  }
  h += '<div style="font-size:10px;color:#6b7280;margin-top:8px;">💡 Stay inside our war area: +1 pt every minute (cap 300/day). Win the street race: +25 pts. Week go settle every ' + "Sunday — highest crew na the owner.</div>";
  h += "</div>";
  return h;
}
window._cwClaimChal = async (id) => { const r = await claimChallenge(id); _toast(r.msg || "Done."); window.showApp("crew"); };
window._cwWarReward = async (areaId) => { const r = await claimWarReward(areaId); _toast(r.msg || "Collected!"); window.showApp("crew"); };

// ---------- TAB: RANK ----------
function _renderRank() {
  const c = myCrew(), s = crewSummary() || {};
  const crews = Object.entries(allCrews()).map(([id, v]) => ({ id, ...v })).sort((a, b) => (b.power || 0) - (a.power || 0)).slice(0, 20);
  const contributors = Object.entries(crewMembers()).sort((a, b) => (b[1].weeklyPts || 0) - (a[1].weeklyPts || 0)).slice(0, 10);
  let h = '<div style="font-size:12px;font-weight:700;color:#f2b134;margin-bottom:6px;">🏆 Top Crews by Power</div>';
  crews.forEach((cr, i) => {
    const mine = cr.id === c.crewId;
    h += '<div style="display:flex;align-items:center;gap:8px;padding:8px 9px;background:' + (mine ? "#1a2a1a;border:1px solid #2e7d4f;" : "#17181b") + ';border-radius:10px;margin-bottom:4px;">' +
      '<div style="width:22px;font-size:12px;font-weight:800;color:' + (i === 0 ? "#f2b134" : "#9b9ba4") + ';">' + (i + 1) + "</div>" +
      '<div style="width:30px;height:30px;border-radius:8px;background:' + esc(cr.color || "#e11d48") + ';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#fff;">' + esc(cr.tag || "?") + "</div>" +
      '<div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:700;color:#f2f2f4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(cr.name) + (mine ? ' <span style="color:#4ade80;font-size:9px;">(you)</span>' : "") + "</div>" +
      '<div style="font-size:9px;color:#9b9ba4;">Lv ' + (cr.level || 1) + " · 👤 " + (cr.membersCount || 1) + " · 🏦 " + kN(cr.bank || 0) + "</div></div>" +
      '<div style="font-size:11px;font-weight:800;color:#f2b134;">' + (cr.power || 0).toLocaleString() + "</div></div>";
  });
  if (!crews.length) h += '<div style="font-size:11px;color:#6b7280;padding:10px;text-align:center;background:#17181b;border-radius:8px;">No crews yet — go make history! 🚀</div>';
  h += '<div style="font-size:12px;font-weight:700;color:#f2b134;margin:12px 0 6px;">🔥 Our top hustlers this week</div>';
  if (!contributors.length) h += '<div style="font-size:11px;color:#6b7280;padding:10px;text-align:center;background:#17181b;border-radius:8px;">Nobody score this week — lead the way! ⚔️</div>';
  for (const [uid, m] of contributors) {
    const mine = uid === myCrewId();
    h += '<div style="display:flex;align-items:center;gap:8px;padding:7px 9px;background:' + (mine ? "#1a2a1a" : "#17181b") + ';border-radius:10px;margin-bottom:4px;">' +
      '<div style="flex:1;font-size:11px;font-weight:' + (mine ? "800" : "600") + ';color:#f2f2f4;">' + esc(m.name || "?") + (mine ? ' <span style="color:#4ade80;font-size:9px;">(you)</span>' : "") + "</div>" +
      '<div style="font-size:10px;color:#f2b134;font-weight:700;">⚔️ ' + (m.weeklyPts || 0) + ' pts</div>' +
      '<div style="font-size:10px;color:#9b9ba4;">🔥 ' + (m.cred || 0).toLocaleString() + "</div></div>";
  }
  h += '<div style="margin-top:10px;background:#17181b;border-radius:10px;padding:10px;text-align:center;"><div style="font-size:10px;color:#9b9ba4;">Your Street Cred (e no lost even if you switch crew)</div><div style="font-size:18px;font-weight:800;color:#f2b134;">🔥 ' + (myCred() || 0).toLocaleString() + "</div></div>";
  return h;
}

export function crewSystemsDbg() {
  return { inited: _inited, tab: window.__cwCurTab, pill: !!(_pill && _pill.style.display !== "none") };
}
