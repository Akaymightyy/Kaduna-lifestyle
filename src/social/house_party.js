// src/social/house_party.js — the SOCIAL layer for player houses 🏠🎉
//
// Adds the Lagos-Life style "alive house" feel on top of the existing
// houses/home systems (no rewrites — everything here is additive):
//
//  1. PRESENCE + GUEST COUNT — while anybody is inside a house they write
//     houses/{areaId}/{plotNo}/presence/{uid} = { name, ts }. Everyone inside
//     sees the live banner:  "🎉 All-White Party · 👥 12/24 guests · They're home"
//     Guest cap comes from the house tier (HOUSE_TIERS + luxury tiers).
//  2. "THEY'RE HOME" — shown when the OWNER is inside their own house.
//  3. LEAVE BUTTON — big clearly visible 🚪 button (top-right) while inside.
//  4. ACCESS MODES — houses/{areaId}/{plotNo}/access = "public" | "friends" | "invite".
//     public  → anybody walks in
//     friends → friends walk in, others knock
//     invite  → everybody knocks (owner must accept)
//  5. PARTY PRESETS — owner throws a House Party / All-White Party / Wedding /
//     Birthday — banner + door labels show it while it's live (2h default).
//  6. INVITES — owner invites friends/nearby players; their client gets a live
//     invite card with a "Visit" button that travels them to the door.
//  7. HOUSE SOCIAL ACTIONS — Ring Bell / Together / Dance / Socialise / Sit,
//     wired into the place-actions bar by main.js.

import * as THREE from "three";
import { db } from "../firebase.js";
import { ref, get, set, update, remove, onValue, onDisconnect, push, serverTimestamp } from "firebase/database";
import { getArea } from "../areas.js";
import { HOUSE_TIERS } from "../origins.js";
import { getLuxuryTiers } from "../housing_upgrade.js";

let _api = null;              // { getUid, getName, toast, getPlayer, isFriend }
let _presenceRef = null;      // my current presence ref
let _presenceUnsub = null;    // guest-count listener
let _heartT = null;
let _curKey = null;           // "areaId/plotNo" or null
let _curHouse = null;         // { areaId, plotNo, ownerUid, ownerName, isOwner }
let _banner = null;
let _leaveBtn = null;
let _guestCount = 0;
let _ownerInside = false;
let _unsubInvites = null;
let _settingsPanel = null;

export const PARTY_PRESETS = [
  { id: "house_party", name: "House Party",      emoji: "🎉" },
  { id: "all_white",   name: "All White Party",  emoji: "🤍" },
  { id: "wedding",     name: "Wedding",          emoji: "💍" },
  { id: "birthday",    name: "Birthday Bash",    emoji: "🎂" },
  { id: "odogwu",      name: "Odogwu Birthday",  emoji: "🤑" },
];

export function initHouseParty(api) {
  _api = api;
  _ensureLeaveBtn();
  _listenInvites();
}

// ------------------------------------------------------------------
// Guest cap by house tier
// ------------------------------------------------------------------
export function guestCapForTier(tier) {
  const t = HOUSE_TIERS.find((x) => x.tier === tier) || getLuxuryTiers().find((x) => x.tier === tier);
  return (t && t.guestCap) || 6;
}

// ------------------------------------------------------------------
// Presence — called by main.js when a place becomes active / inactive
// ------------------------------------------------------------------
export async function enterHousePresence(houseInfo) {
  const uid = _api.getUid();
  if (!uid || !houseInfo || !houseInfo.areaId || houseInfo.plotNo == null) return;
  await leaveHousePresence();                     // safety: never double-count
  _curKey = houseInfo.areaId + "/" + houseInfo.plotNo;
  _curHouse = houseInfo;
  _presenceRef = ref(db, "houses/" + houseInfo.areaId + "/" + houseInfo.plotNo + "/presence/" + uid);
  try {
    await set(_presenceRef, { name: _api.getName() || "Player", ts: Date.now(), online: true });
    onDisconnect(_presenceRef).remove();
  } catch (e) { console.warn("[house-party] presence write failed:", e.message); }
  // Heartbeat keeps ts fresh (rules let each uid write only their own entry)
  clearInterval(_heartT);
  _heartT = setInterval(() => {
    if (!_presenceRef) return;
    update(_presenceRef, { ts: Date.now(), online: true }).catch(() => {});
  }, 45000);
  _watchGuests(houseInfo);
}

export async function leaveHousePresence() {
  clearInterval(_heartT); _heartT = null;
  if (_presenceUnsub) { try { _presenceUnsub(); } catch (e) {} _presenceUnsub = null; }
  if (_presenceRef) {
    try { await remove(_presenceRef); } catch (e) {}
    try { await onDisconnect(_presenceRef).cancel(); } catch (e) {}
    _presenceRef = null;
  }
  _curKey = null; _curHouse = null; _guestCount = 0; _ownerInside = false;
  // NOTE: we intentionally do NOT hide the banner here — enterHousePresence
  // calls this first as a safety reset, and the banner belongs to the place
  // layer (hideHouseBanner is called by main.js on real place changes).
}

function _watchGuests(houseInfo) {
  if (_presenceUnsub) { try { _presenceUnsub(); } catch (e) {} }
  const presRef = ref(db, "houses/" + houseInfo.areaId + "/" + houseInfo.plotNo + "/presence");
  _presenceUnsub = onValue(presRef, (snap) => {
    const val = snap.val() || {};
    const now = Date.now();
    let count = 0; _ownerInside = false;
    for (const [uid, p] of Object.entries(val)) {
      if (!p || (p.ts && now - p.ts > 150000)) continue;   // stale entry
      count++;
      if (houseInfo.ownerUid && uid === houseInfo.ownerUid) _ownerInside = true;
    }
    _guestCount = Math.max(1, count);                      // at least ME
    // Re-assert visibility (the banner may have been shown before the first
    // guest snapshot arrived) and render the fresh numbers.
    if (_banner && _banner._opts) _banner.style.display = "block";
    _renderBanner();
  }, () => { _guestCount = 1; if (_banner && _banner._opts) _banner.style.display = "block"; _renderBanner(); });
}

// ------------------------------------------------------------------
// Banner — guest count + They're home + party name (top of screen)
// ------------------------------------------------------------------
export function showHouseBanner(opts) {
  // opts: { title, cap, party, isOwner }
  if (!_banner) {
    _banner = document.createElement("div");
    _banner.id = "house-banner";
    _banner.style.cssText =
      "position:fixed;left:50%;top:calc(10px + env(safe-area-inset-top));transform:translateX(-50%);" +
      "z-index:26;background:rgba(11,11,12,.82);color:#fff;padding:7px 16px;border-radius:999px;" +
      "font:700 12px Poppins,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.4);" +
      "border:1px solid rgba(242,177,52,.5);display:none;white-space:nowrap;max-width:94vw;overflow:hidden;" +
      "text-overflow:ellipsis;text-align:center;backdrop-filter:blur(6px);";
    document.body.appendChild(_banner);
  }
  _banner._opts = opts;
  _renderBanner();
  _banner.style.display = "block";
}

export function hideHouseBanner() {
  if (_banner) _banner.style.display = "none";
}

function _renderBanner() {
  if (!_banner || _banner.style.display === "none" || !_banner._opts) return;
  const o = _banner._opts;
  const cap = o.cap || 24;
  const guests = "👥 " + _guestCount + "/" + cap + " guests";
  // Owner inside their own house → "You're home"; visitor in an occupied
  // house → "They're home"; empty house → no status chip.
  const home = o.isOwner
    ? ' · <span style="color:#4ade80;">You\'re home 🏡</span>'
    : (_ownerInside ? ' · <span style="color:#4ade80;">They\'re home 🏡</span>' : "");
  const party = o.party && o.party.name ? (' <span style="color:#f2b134;">· ' + (o.party.emoji || "🎉") + " " + o.party.name + "</span>") : "";
  _banner.innerHTML = o.title + " · " + guests + party + home;
}

// ------------------------------------------------------------------
// LEAVE button (visible inside ANY place)
// ------------------------------------------------------------------
function _ensureLeaveBtn() {
  if (_leaveBtn) return;
  _leaveBtn = document.createElement("button");
  _leaveBtn.id = "leave-place-btn";
  _leaveBtn.style.cssText =
    "position:fixed;right:14px;top:calc(64px + env(safe-area-inset-top));z-index:32;" +
    "background:rgba(225,29,72,.92);color:#fff;border:1px solid rgba(255,255,255,.3);" +
    "border-radius:999px;padding:9px 16px;font:700 12px Poppins,sans-serif;cursor:pointer;" +
    "box-shadow:0 4px 14px rgba(0,0,0,.4);display:none;align-items:center;gap:6px;";
  _leaveBtn.innerHTML = "🚪 Leave";
  _leaveBtn.addEventListener("click", () => {
    try { window.__kadunaExitPlace && window.__kadunaExitPlace(); }
    catch (e) { console.warn("[house-party] leave failed", e); }
  });
  document.body.appendChild(_leaveBtn);
}
export function showLeaveButton() { if (_leaveBtn) { _leaveBtn.style.display = "flex"; } }
export function hideLeaveButton() { if (_leaveBtn) _leaveBtn.style.display = "none"; }

// ------------------------------------------------------------------
// Access modes (owner settings)
// ------------------------------------------------------------------
export async function setHouseAccess(areaId, plotNo, mode) {
  try {
    await set(ref(db, "houses/" + areaId + "/" + plotNo + "/access"), mode);
    _api.toast("🏠 House is now " + ({ public: "Public — anybody can walk in", friends: "Friends Only", invite: "Invite Only — knocks required" }[mode] || mode));
  } catch (e) { _api.toast("⚠️ Could not change access: " + e.message); }
}

export async function startParty(areaId, plotNo, preset) {
  try {
    const party = { id: preset.id, name: preset.name, emoji: preset.emoji, until: Date.now() + 2 * 60 * 60 * 1000 };
    await set(ref(db, "houses/" + areaId + "/" + plotNo + "/party"), party);
    _refreshBannerParty(party);
    _api.toast(preset.emoji + " " + preset.name + " STARTED! Guests will see the banner 🎉");
    window._emote && window._emote("dance", 5);
  } catch (e) { _api.toast("⚠️ Could not start the party: " + e.message); }
}

export async function endParty(areaId, plotNo) {
  try {
    await remove(ref(db, "houses/" + areaId + "/" + plotNo + "/party"));
    _refreshBannerParty(null);
    _api.toast("🎉 Party wrapped up. O dabo!");
  } catch (e) {}
}

// Live-update the banner's party chip (called right after starting/ending a
// party so the host sees it immediately, without re-entering the house)
function _refreshBannerParty(party) {
  if (_banner && _banner._opts) { _banner._opts.party = party; _renderBanner(); }
}

export function partyActive(party) {
  return !!party && !!party.name && (!party.until || Date.now() < party.until);
}

// ------------------------------------------------------------------
// House Settings panel (owner only) — access mode + party presets
// ------------------------------------------------------------------
export function openHouseSettings(house) {
  // house: { areaId, plotNo, isOwner, access, party }
  if (!house || !house.isOwner) { _api.toast("🔒 Only the owner can change house settings"); return; }
  if (_settingsPanel) { _settingsPanel.remove(); _settingsPanel = null; return; }
  _settingsPanel = document.createElement("div");
  _settingsPanel.id = "house-settings";
  _settingsPanel.style.cssText =
    "position:fixed;left:50%;bottom:calc(76px + env(safe-area-inset-bottom));transform:translateX(-50%);" +
    "z-index:60;width:min(380px,94vw);background:#17181b;color:#f2f2f4;border:1px solid #2e7d4f;" +
    "border-radius:16px;box-shadow:0 10px 34px rgba(0,0,0,.5);font-family:Poppins,sans-serif;overflow:hidden;";
  const accessModes = [
    ["public", "🌍 Public", "Anybody can walk in"],
    ["friends", "👥 Friends Only", "Friends walk in, others knock"],
    ["invite", "✉️ Invite Only", "Everybody must knock"],
  ];
  _settingsPanel.innerHTML =
    '<div style="display:flex;align-items:center;padding:10px 12px;background:linear-gradient(135deg,#0f4d3a,#1a1a2e);">' +
    '<div style="flex:1;font-weight:800;font-size:14px;">🏠 House Settings</div>' +
    '<button id="hs-close" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;">✕</button></div>' +
    '<div style="padding:10px 12px 4px;font-size:11px;color:#9fe0b8;font-weight:600;">WHO CAN ENTER?</div>' +
    '<div id="hs-access" style="display:flex;flex-direction:column;gap:6px;padding:4px 12px 8px;">' +
    accessModes.map(([id, label, desc]) =>
      '<button data-mode="' + id + '" style="text-align:left;background:' + (house.access === id ? "#0f4d3a" : "#22242a") + ';color:#fff;border:1px solid ' + (house.access === id ? "#4ade80" : "#33363e") + ';border-radius:10px;padding:9px 12px;cursor:pointer;font-family:Poppins,sans-serif;">' +
      '<div style="font-weight:700;font-size:13px;">' + label + '</div><div style="font-size:10.5px;color:#8b8e99;">' + desc + '</div></button>').join("") +
    '</div>' +
    '<div style="padding:2px 12px 4px;font-size:11px;color:#9fe0b8;font-weight:600;">THROW A PARTY 🎉</div>' +
    '<div id="hs-party" style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 12px 8px;">' +
    PARTY_PRESETS.map((p) => '<button data-party="' + p.id + '" style="background:#22242a;color:#fff;border:1px solid #33363e;border-radius:999px;padding:8px 12px;cursor:pointer;font:600 12px Poppins,sans-serif;">' + p.emoji + " " + p.name + '</button>').join("") +
    (house.party && partyActive(house.party) ? '<button id="hs-endparty" style="background:#e11d48;color:#fff;border:1px solid #e11d48;border-radius:999px;padding:8px 12px;cursor:pointer;font:600 12px Poppins,sans-serif;">🛑 End party</button>' : "") +
    '</div>';
  document.body.appendChild(_settingsPanel);
  _settingsPanel.querySelector("#hs-close").onclick = () => { _settingsPanel.remove(); _settingsPanel = null; };
  for (const b of _settingsPanel.querySelectorAll("[data-mode]")) {
    b.onclick = () => {
      setHouseAccess(house.areaId, house.plotNo, b.dataset.mode);
      for (const c of _settingsPanel.querySelectorAll("[data-mode]")) { c.style.background = "#22242a"; c.style.borderColor = "#33363e"; }
      b.style.background = "#0f4d3a"; b.style.borderColor = "#4ade80";
    };
  }
  for (const b of _settingsPanel.querySelectorAll("[data-party]")) {
    b.onclick = () => {
      const preset = PARTY_PRESETS.find((p) => p.id === b.dataset.party);
      if (preset) { startParty(house.areaId, house.plotNo, preset); _settingsPanel.remove(); _settingsPanel = null; }
    };
  }
  const endBtn = _settingsPanel.querySelector("#hs-endparty");
  if (endBtn) endBtn.onclick = () => { endParty(house.areaId, house.plotNo); _settingsPanel.remove(); _settingsPanel = null; };
}

// ------------------------------------------------------------------
// INVITES — owner invites somebody; their client shows a live card
// ------------------------------------------------------------------
export async function sendHouseInvite(toUid, toName, house) {
  const uid = _api.getUid();
  if (!uid || !house) return;
  try {
    await push(ref(db, "invites/" + toUid), {
      fromUid: uid, fromName: _api.getName() || "Player",
      areaId: house.areaId, plotNo: house.plotNo,
      ownerName: _api.getName() || "Player",
      ts: Date.now(),
    });
    _api.toast("✉️ Invite sent to " + (toName || "them") + "!");
  } catch (e) { _api.toast("⚠️ Invite failed: " + e.message); }
}

function _listenInvites() {
  // Armed lazily by main.js once the uid is known (armInvites)
}
export function armInvites(uid, onVisit) {
  if (!uid || _unsubInvites) return;
  const q = ref(db, "invites/" + uid);
  let seen = null;
  _unsubInvites = onValue(q, (snap) => {
    const val = snap.val() || {};
    const ids = Object.keys(val);
    if (seen === null) { seen = new Set(ids); return; }   // history on first load
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const inv = val[id];
      if (!inv || Date.now() - (inv.ts || 0) > 120000) continue;
      _showInviteCard(inv, onVisit);
    }
  }, () => {});
}

function _showInviteCard(inv, onVisit) {
  const card = document.createElement("div");
  card.style.cssText =
    "position:fixed;left:50%;top:calc(72px + env(safe-area-inset-top));transform:translateX(-50%);" +
    "z-index:44;background:rgba(15,77,58,.96);color:#fff;padding:12px 16px;border-radius:14px;" +
    "border:2px solid #f2b134;box-shadow:0 8px 24px rgba(0,0,0,.5);font:600 12px Poppins,sans-serif;" +
    "display:flex;flex-direction:column;gap:8px;align-items:center;max-width:90vw;";
  card.innerHTML =
    '<div>✉️ <b style="color:#f2b134;">@' + (inv.fromName || "a friend") + '</b> invited you to their place!</div>' +
    '<div style="display:flex;gap:8px;">' +
    '<button id="iv-go" style="background:#4ade80;color:#000;border:none;border-radius:8px;padding:8px 16px;font:700 12px Poppins,sans-serif;cursor:pointer;">🏠 Visit</button>' +
    '<button id="iv-no" style="background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:8px;padding:8px 16px;font:700 12px Poppins,sans-serif;cursor:pointer;">Later</button></div>';
  document.body.appendChild(card);
  card.querySelector("#iv-no").onclick = () => card.remove();
  card.querySelector("#iv-go").onclick = () => { card.remove(); onVisit && onVisit(inv); };
  setTimeout(() => card.remove(), 30000);
}

// ------------------------------------------------------------------
// HOUSE SOCIAL ACTIONS (called from main.js placeAction router)
// ------------------------------------------------------------------
export function doTogether() {
  window._emote && window._emote("together", 6);
  // The crew dances with you: every NPC in this room starts dancing too
  window._npcCrowdEmote && window._npcCrowdEmote("together", 6, 14);
  _api.toast("🕺 TOGETHER! The whole room is dancing!");
}

export function doSocialise() {
  window._emote && window._emote("talk", 4);
  window._npcCrowdEmote && window._npcCrowdEmote("talk", 4, 8);
  if (_api.gameState) {
    _api.gameState.needs.social = Math.min(100, (_api.gameState.needs.social || 0) + 18);
    _api.gameState.needs.fun = Math.min(100, (_api.gameState.needs.fun || 0) + 8);
    _api.gameState.save && _api.gameState.save();
    _api.updateHUD && _api.updateHUD();
  }
  _api.toast("🗣️ You dey gist! Social +18, Fun +8");
}

export function doDance() {
  window._emote && window._emote("dance", 5);
  window._npcCrowdEmote && window._npcCrowdEmote("dance", 5, 10);
  if (_api.gameState) {
    _api.gameState.needs.fun = Math.min(100, (_api.gameState.needs.fun || 0) + 12);
    _api.gameState.save && _api.gameState.save();
    _api.updateHUD && _api.updateHUD();
  }
}

export function doSit() {
  window._emote && window._emote("sit", 30);
}

export function doRingBell() {
  // Friendly ping to everybody in the house — shows in the house chat + toast
  window._emote && window._emote("bell", 2);
  try { window.__sfx && window.__sfx.tap && window.__sfx.tap(); } catch (e) {}
  const h = _curHouse;
  if (h && window.__houseChatPing) {
    window.__houseChatPing("🔔 " + (_api.getName() || "Someone") + " rang the bell 🔔");
  }
  _api.toast("🔔 DING DONG! You rang the bell");
}

// ------------------------------------------------------------------
// Load a full house record (for banner access/party fields)
// ------------------------------------------------------------------
export async function loadHouseMeta(areaId, plotNo) {
  try {
    const snap = await get(ref(db, "houses/" + areaId + "/" + plotNo));
    return snap.val() || null;
  } catch (e) { return null; }
}
