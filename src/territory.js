// src/territory.js — CREW TERRITORY: 8 controllable Kaduna areas.
//
// One Crew fits control one area at a time. The owner show for:
//   - the phone Map app (colour tint per area),
//   - the mini-map (tint + crew tag letters),
//   - a real 3D flag pole wey dey stand for the area (banner dey carry crew colour + tag),
//   - the Crew app "Areas" tab (full list + who owns wetin).
//
// DATA (all public-read, so everybody fit see who dey control where):
//   territory/{areaId} = { crewId, crewName, tag, color, since, week, resolvedWeek }
//   territory/{areaId}/war/{weekKey}/{crewId}     = war points (this week's fight)
//   territory/{areaId}/cooldowns/{crewId}         = ts — losers dey rest before dem fit attack again
//   territory/{areaId}/claims/{dayKey}/{uid}      = { amount, ts } — daily bonus don collect
//   territory/{areaId}/rewards/{weekKey}/{uid}    = { amount, ts } — war win reward don collect
//
// This file no touch money at all — crews.js owns every naira move.

import * as THREE from "three";
import { db } from "./firebase.js";
import { ref, onValue } from "firebase/database";

// ---------- THE 8 CREW AREAS ----------
// x/z na area centre in world metres (same grid as src/areas.js districts).
// City Centre na the main-street strip (z -60..60), centre (0, 0).
export const CREW_AREAS = [
  { id: "barnawa",      name: "Barnawa",      x: -170, z: 255,  rich: true,  desc: "GRA riverside — the finest address." },
  { id: "kawo",         name: "Kawo",         x: -170, z: 145,  rich: false, desc: "Market district — everything dey here." },
  { id: "ungwan_rimi",  name: "Ungwan Rimi",  x: 0,    z: -145, rich: true,  desc: "GRA gardens — big oga compound." },
  { id: "sabon_tasha",  name: "Sabon Tasha",  x: 170,  z: 145,  rich: false, desc: "Family area — shops and schools." },
  { id: "kakuri",       name: "Kakuri",       x: 290,  z: 145,  rich: false, desc: "Industrial zone — workshops everywhere." },
  { id: "malali",       name: "Malali",       x: -170, z: -255, rich: true,  desc: "Upscale — diplomats dey stay here." },
  { id: "city_centre",  name: "City Centre",  x: 0,    z: 0,    rich: true,  desc: "The main street — heart of Kaduna." },
  { id: "rigasa",       name: "Rigasa",       x: -290, z: 145,  rich: false, desc: "Working class hustle — crowded but alive." },
];
export const AREA_IDS = CREW_AREAS.map(a => a.id);
export function crewArea(id) { return CREW_AREAS.find(a => a.id === id) || null; }

// Where the 3D flag pole stands — clear of every plot grid (see src/areas.js
// getPlotPosition: plots span a.x±40, and rows never reach a.z - 50).
export function flagPos(a) {
  if (a.id === "city_centre") return { x: 110, z: -72 };   // between side street (x=90) and cross street (z=-88)
  return { x: a.x + 40, z: a.z - 50 };
}

// ---------- AREA DETECTION ----------
// Districts: |dx| <= 85 and |dz| <= 85 around centre. City Centre: |z| <= 60 main strip.
export function areaAt(x, z) {
  if (Math.abs(z) <= 60) return "city_centre";
  for (const a of CREW_AREAS) {
    if (a.id === "city_centre") continue;
    if (Math.abs(x - a.x) <= 85 && Math.abs(z - a.z) <= 85) return a.id;
  }
  return null;
}

// ---------- WEEK KEYS (zero-padded so string sort works: 2026_W09 < 2026_W10) ----------
export function weekKey(ts) {
  const d = new Date(ts || Date.now());
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return d.getFullYear() + "_W" + String(week).padStart(2, "0");
}
export function prevWeekKey(ts) { return weekKey((ts || Date.now()) - 7 * 86400000); }
export function dayKey(ts) { const d = new Date(ts || Date.now()); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

// ---------- LIVE TERRITORY STATE (one listener for all 8 areas — cheap) ----------
// NOTE: boot happens before login, and Firebase DETACHES listeners that get a
// permission error. So initTerritory only stores the callback; crewSetUid()
// calls ensureTerritoryLive() after auth to (re)attach for real.
let _territory = {};          // areaId -> node value (crewId/tag/color/war/cooldowns/claims/rewards)
let _unsub = null;
let _onUpdate = null;

export function initTerritory(onUpdate) {
  _onUpdate = onUpdate || null;
  _attachTerritory();          // works right away for already-authed sessions
}
function _attachTerritory() {
  if (_unsub || !db) return;
  _unsub = onValue(ref(db, "territory"), (snap) => {
    _territory = snap.val() || {};
    try { redrawFlags(); } catch (e) {}
    try { _onUpdate && _onUpdate(); } catch (e) {}
  }, () => { _unsub = null; });   // denied/offline — allow a re-attach after login
}
export function ensureTerritoryLive() { _attachTerritory(); }
export function stopTerritory() { if (_unsub) { try { _unsub(); } catch (e) {} _unsub = null; _territory = {}; } }
export function territoryData() { return _territory; }
export function ownerOf(areaId) {
  const t = _territory[areaId];
  return (t && t.crewId) ? { crewId: t.crewId, name: t.crewName || "?", tag: t.tag || "", color: t.color || "#e11d48" } : null;
}
export function warScores(areaId) {
  const t = _territory[areaId];
  return (t && t.war) || {};
}
export function cooldownUntil(areaId, crewId) {
  const t = _territory[areaId];
  return (t && t.cooldowns && t.cooldowns[crewId]) || 0;
}
export function bonusClaimedToday(areaId, uid) {
  const t = _territory[areaId];
  return !!(t && t.claims && t.claims[dayKey()] && t.claims[dayKey()][uid]);
}
export function warRewardClaimed(areaId, uid, week) {
  const t = _territory[areaId];
  return !!(t && t.rewards && t.rewards[week] && t.rewards[week][uid]);
}

// ---------- DAILY BONUS + DISCOUNT MATH ----------
// Daily money for a member of the owning crew: ₦25,000 base, +15% per crew
// level, cap ₦150,000. War-win weekly reward: ₦50,000 base, same scaling.
export function dailyBonusFor(level) {
  return Math.min(150000, Math.round(25000 * (1 + 0.15 * Math.max(0, (level || 1) - 1))));
}
export function warRewardFor(level) {
  return Math.min(500000, Math.round(50000 * (1 + 0.15 * Math.max(0, (level || 1) - 1))));
}
// 10% off houses inside an area your crew controls (crewPriceFactor × price).
export function crewPriceFactor(areaId, myCrewId) {
  const o = ownerOf(areaId);
  return (o && myCrewId && o.crewId === myCrewId) ? 0.9 : 1;
}

// ---------- MAP OVERLAY DATA (minimap + phone Map app read this) ----------
// Returns [{x, z, w, d, color, tag}] for owned areas — callers draw the tint.
export function mapOverlay() {
  const out = [];
  for (const a of CREW_AREAS) {
    const o = ownerOf(a.id);
    if (!o) continue;
    if (a.id === "city_centre") out.push({ id: a.id, x: 0, z: 0, w: 400, d: 120, color: o.color, tag: o.tag, name: a.name });
    else out.push({ id: a.id, x: a.x, z: a.z, w: 88, d: 96, color: o.color, tag: o.tag, name: a.name });
  }
  return out;
}

// ---------- 3D FLAGS ----------
let _flags = {};              // areaId -> { grp, banner, canvas, ctx, tex, lastKey }
let _scene = null;

export function initTerritoryFlags(scene, colliders) {
  _scene = scene;
  if (!scene || _flags.built) return;
  _flags.built = true;
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 7, 6);
  const baseGeo = new THREE.BoxGeometry(1.1, 0.55, 1.1);
  const barGeo = new THREE.BoxGeometry(1.9, 0.09, 0.09);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x9aa2ad });
  const baseMat = new THREE.MeshLambertMaterial({ color: 0x8d8d86 });
  for (const a of CREW_AREAS) {
    const p = flagPos(a);
    const grp = new THREE.Group();
    grp.position.set(p.x, 0, p.z);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 3.5; grp.add(pole);
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.27; grp.add(base);
    const bar = new THREE.Mesh(barGeo, poleMat);
    bar.position.set(0.95, 6.7, 0); grp.add(bar);
    // banner: canvas texture (crew tag on crew colour) — redrawn on ownership change only
    const canvas = document.createElement("canvas");
    canvas.width = 128; canvas.height = 84;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.25),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
    );
    banner.position.set(0.98, 6.05, 0);
    grp.add(banner);
    // solid: pole + base go into the world colliders (same array building.js uses)
    if (colliders) {
      colliders.push({ minX: p.x - 0.6, maxX: p.x + 0.6, minZ: p.z - 0.6, maxZ: p.z + 0.6 });
    }
    _scene.add(grp);
    _flags[a.id] = { grp, banner, canvas, tex, lastKey: "" };
  }
  redrawFlags();
}

function _drawBanner(f, o) {
  const ctx = f.canvas.getContext("2d");
  const color = o ? o.color : "#3a3f47";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 128, 84);
  ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 122, 78);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (o && o.tag) {
    ctx.font = "800 34px Poppins, Arial, sans-serif";
    ctx.fillText(String(o.tag).slice(0, 5), 64, 34);
    ctx.font = "600 15px Poppins, Arial, sans-serif";
    ctx.fillText("CREW", 64, 62);
  } else {
    ctx.font = "800 26px Poppins, Arial, sans-serif";
    ctx.fillText("FREE", 64, 42);
  }
  f.tex.needsUpdate = true;
}

// Called whenever territory data changes + once at boot.
export function redrawFlags() {
  for (const a of CREW_AREAS) {
    const f = _flags[a.id];
    if (!f) continue;
    const o = ownerOf(a.id);
    const key = o ? o.crewId + "|" + o.color + "|" + o.tag : "free";
    if (key === f.lastKey) continue;
    f.lastKey = key;
    _drawBanner(f, o);
  }
}

// Light tick: banner wave only (rotation — no allocation, no shadow work).
let _wt = 0;
export function tickTerritoryFlags(dt) {
  if (!_scene) return;
  _wt += dt;
  const sway = Math.sin(_wt * 1.7) * 0.22 + Math.sin(_wt * 0.6) * 0.1;
  for (const id in _flags) {
    const f = _flags[id];
    if (f.banner) f.banner.rotation.y = sway;
  }
}

export function territoryDbg() {
  return { areas: CREW_AREAS.length, owned: Object.keys(_territory).length, flags: Object.keys(_flags).filter(k => k !== "built").length };
}
