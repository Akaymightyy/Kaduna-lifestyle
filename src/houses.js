// src/houses.js — House record helpers (per-account houses, visitor furniture, knock/invite).
//
// THE PROBLEM THIS MODULE SOLVES
// ------------------------------
// Before this module, furniture was stored at players/{uid}/homeFurniture.
// That worked fine for the OWNER, but a VISITOR could never see another
// player's furniture — Firebase rules block any read of players/{otherUid}.
//
// This module moves furniture into the shared house record at:
//   houses/{areaId}/{plotNo}/furniture
//
// The Firebase rules already allow any authed player to READ any house record
// (FIREBASE_RULES.json houses.$areaId.$plotNo.read = auth != null), and the
// write rule is !data.exists() || data.child('ownerUid').val() === auth.uid,
// so only the owner can update their own plot's record.
//
// Migration: the first time the owner opens their home after this update, we
// check whether the house record has a furniture array. If not, we look at
// the old players/{uid}/homeFurniture and copy it into the house record.
// After that the old path is left alone (no destructive cleanup — if anything
// goes wrong, the old data is still there).
//
// KNOCK / INVITE FLOW
// -------------------
// A visitor walks up to a locked plot and "knocks". The owner gets a toast
// with accept/deny buttons. If accepted, the visitor enters and sees the
// owner's furniture. If denied, they get a polite "not now" toast.
//
// Knock data shape:
//   knocks/{ownerUid}/{knockId} = { visitorUid, visitorName, ts, areaId, plotNo }
//   knockReplies/{knockId} = { accepted: bool, ts }
//
// Both are read/able by the two parties involved (rules below).
//
// All writes go through this module so the path is consistent.

import { db } from "./firebase.js";
import {
  ref, get, set, update, push, remove, onValue, onDisconnect, serverTimestamp,
} from "firebase/database";
import { getArea, getPlotPosition } from "./areas.js";

// ---- Resolve a player's house key (areaId, plotNo) from Firebase ----
// Returns { areaId, plotNo, area } or null if the player hasn't claimed a plot.
export async function resolvePlayerHouseKey(uid) {
  if (!uid) return null;
  try {
    const snap = await get(ref(db, "players/" + uid));
    const p = snap.val() || {};
    if (!p.homeArea || p.homePlot == null) return null;
    const area = getArea(p.homeArea);
    if (!area) return null;
    return { areaId: p.homeArea, plotNo: p.homePlot, area, uid };
  } catch (e) {
    console.warn("[houses] resolvePlayerHouseKey failed:", e.message);
    return null;
  }
}

// ---- Load the full house record (for owner metadata, colors, locked flag) ----
export async function loadHouse(areaId, plotNo) {
  if (!areaId || plotNo == null) return null;
  try {
    const snap = await get(ref(db, "houses/" + areaId + "/" + plotNo));
    return snap.val() || null;
  } catch (e) {
    console.warn("[houses] loadHouse failed:", e.message);
    return null;
  }
}

// ---- Load just the furniture array ----
// Returns a clean array (handles Firebase objects with non-sequential keys
// from items being removed). Always returns [] on failure (never null).
export async function loadHouseFurniture(areaId, plotNo) {
  if (!areaId || plotNo == null) return [];
  try {
    const snap = await get(ref(db, "houses/" + areaId + "/" + plotNo + "/furniture"));
    const val = snap.val();
    if (Array.isArray(val)) return val;
    if (val && typeof val === "object") return Object.values(val);
    return [];
  } catch (e) {
    console.warn("[houses] loadHouseFurniture failed:", e.message);
    return [];
  }
}

// ---- Save the furniture array (owner only — enforced by Firebase rules) ----
// items should be a clean array of { id, x, z, rot, color }.
export async function saveHouseFurniture(areaId, plotNo, items) {
  if (!areaId || plotNo == null) {
    console.warn("[houses] saveHouseFurniture: missing area/plot");
    return false;
  }
  // Clean the array: strip any stray fields, ensure default values
  const cleanArray = (Array.isArray(items) ? items : []).map(f => ({
    id: f.id,
    x: f.x || 0,
    z: f.z || 0,
    rot: f.rot || 0,
    color: f.color,
  }));
  try {
    await set(ref(db, "houses/" + areaId + "/" + plotNo + "/furniture"), cleanArray);
    console.log("[houses] saved " + cleanArray.length + " furniture items at " + areaId + "/" + plotNo);
    return true;
  } catch (e) {
    console.error("[houses] saveHouseFurniture FAILED:", e.message);
    return false;
  }
}

// ---- Return an item to the owner's storage (called when removing furniture) ----
export async function returnToStorage(areaId, plotNo, ownerUid, itemId, color) {
  if (!ownerUid) {
    console.warn("[houses] returnToStorage: missing ownerUid");
    return;
  }
  try {
    const snap = await get(ref(db, "players/" + ownerUid + "/storage"));
    const storage = snap.val() || [];
    const cleaned = Array.isArray(storage) ? storage : Object.values(storage);
    cleaned.push({ id: itemId, color: color });
    await set(ref(db, "players/" + ownerUid + "/storage"), cleaned);
    console.log("[houses] returned " + itemId + " to storage for " + ownerUid);
  } catch (e) {
    console.error("[houses] returnToStorage failed:", e.message);
  }
}

// ---- One-time migration: copy players/{uid}/homeFurniture → houses/{area}/{plot}/furniture ----
// Returns true if migration happened (or wasn't needed), false if it failed.
// Idempotent: if the house already has furniture, we skip the copy.
export async function migrateFurnitureIfNeeded(uid, areaId, plotNo) {
  if (!uid || !areaId || plotNo == null) return true;
  try {
    // 1. Check the new path first
    const newSnap = await get(ref(db, "houses/" + areaId + "/" + plotNo + "/furniture"));
    const newVal = newSnap.val();
    if (Array.isArray(newVal) && newVal.length > 0) {
      // Already migrated
      return true;
    }
    if (newVal && typeof newVal === "object" && Object.keys(newVal).length > 0) {
      // Has object-style furniture (non-sequential keys) — already migrated
      return true;
    }
    // 2. Check the old path
    const oldSnap = await get(ref(db, "players/" + uid + "/homeFurniture"));
    const oldVal = oldSnap.val();
    if (!oldVal) {
      // Nothing to migrate — fresh account
      return true;
    }
    const oldArr = Array.isArray(oldVal) ? oldVal : Object.values(oldVal);
    if (oldArr.length === 0) {
      // Old was empty — nothing to migrate
      return true;
    }
    // 3. Migrate! Write to the new path
    console.log("[houses] MIGRATING " + oldArr.length + " furniture items from players/" + uid + "/homeFurniture → houses/" + areaId + "/" + plotNo + "/furniture");
    const cleanArray = oldArr.map(f => ({
      id: f.id,
      x: f.x || 0,
      z: f.z || 0,
      rot: f.rot || 0,
      color: f.color,
    }));
    await set(ref(db, "houses/" + areaId + "/" + plotNo + "/furniture"), cleanArray);
    console.log("[houses] migration complete");
    // NOTE: we intentionally do NOT delete the old path here. If anything
    // goes wrong later, the player's data is still in the old location.
    // The old path is simply ignored from now on.
    return true;
  } catch (e) {
    console.error("[houses] migrateFurnitureIfNeeded failed:", e.message);
    return false;
  }
}

// ---- Knock / invite flow ----
// A visitor knocks at a house. The owner gets a real-time prompt.
// knocks/{ownerUid}/{knockId} = { visitorUid, visitorName, ts, areaId, plotNo, status: 'pending'|'accepted'|'denied' }

// Visitor initiates a knock. Returns the knockId (so the visitor can listen for a reply).
export async function knockOnDoor(ownerUid, visitorUid, visitorName, areaId, plotNo) {
  if (!ownerUid || !visitorUid || ownerUid === visitorUid) return null;
  const knockRef = push(ref(db, "knocks/" + ownerUid));
  const knockId = knockRef.key;
  await set(knockRef, {
    visitorUid: visitorUid,
    visitorName: visitorName || "Visitor",
    ts: Date.now(),
    areaId: areaId,
    plotNo: plotNo,
    status: "pending",
  });
  // Auto-clean after 60 seconds in case owner is offline
  setTimeout(function () { _autoCleanKnock(ownerUid, knockId); }, 60000);
  return knockId;
}

async function _autoCleanKnock(ownerUid, knockId) {
  try {
    const path = "knocks/" + ownerUid + "/" + knockId;
    const snap = await get(ref(db, path));
    if (snap.exists() && snap.val().status === "pending") {
      await remove(ref(db, path));
    }
  } catch (e) {
    // non-critical
  }
}

// Owner listens for incoming knocks
export function listenForKnocks(ownerUid, cb) {
  if (!ownerUid) return () => {};
  const unsub = onValue(ref(db, "knocks/" + ownerUid), (snap) => {
    const knocks = snap.val() || {};
    // Only fire for NEW pending knocks (status === 'pending')
    cb(knocks);
  });
  return unsub;
}

// Owner responds to a knock (accept or deny)
export async function respondToKnock(ownerUid, knockId, accepted) {
  if (!ownerUid || !knockId) return;
  try {
    await update(ref(db, "knocks/" + ownerUid + "/" + knockId), {
      status: accepted ? "accepted" : "denied",
      respondedAt: Date.now(),
    });
    // Clean up after a short delay so the visitor has time to read the reply
    setTimeout(async () => {
      try { await remove(ref(db, "knocks/" + ownerUid + "/" + knockId)); } catch (e) {}
    }, 5000);
  } catch (e) {
    console.warn("[houses] respondToKnock failed:", e.message);
  }
}

// Visitor listens for the owner's reply on their specific knock
export function listenForKnockReply(ownerUid, knockId, cb) {
  if (!ownerUid || !knockId) return () => {};
  const unsub = onValue(ref(db, "knocks/" + ownerUid + "/" + knockId), (snap) => {
    const v = snap.val();
    if (!v) { cb(null); return; }  // knock was deleted (auto-timeout)
    cb(v);
  });
  return unsub;
}

// ---- Set the house "locked" flag (owner only) ----
// When locked: visitors must knock. When unlocked: visitors enter directly.
export async function setHouseLocked(areaId, plotNo, locked) {
  if (!areaId || plotNo == null) return;
  try {
    await set(ref(db, "houses/" + areaId + "/" + plotNo + "/locked"), !!locked);
  } catch (e) {
    console.warn("[houses] setHouseLocked failed:", e.message);
  }
}

// ---- Set the house for-sale / for-rent / price fields (owner only) ----
export async function setHouseMarketFlags(areaId, plotNo, { forSale, forRent, price } = {}) {
  if (!areaId || plotNo == null) return;
  const patch = {};
  if (forSale !== undefined) patch.forSale = !!forSale;
  if (forRent !== undefined) patch.forRent = !!forRent;
  if (price !== undefined) patch.price = Number(price) || 0;
  try {
    await update(ref(db, "houses/" + areaId + "/" + plotNo), patch);
  } catch (e) {
    console.warn("[houses] setHouseMarketFlags failed:", e.message);
  }
}

// ---- Set the house tier (called when player upgrades / moves) ----
export async function setHouseTier(areaId, plotNo, tier) {
  if (!areaId || plotNo == null) return;
  try {
    await set(ref(db, "houses/" + areaId + "/" + plotNo + "/tier"), tier);
  } catch (e) {
    console.warn("[houses] setHouseTier failed:", e.message);
  }
}

// ---- Set the house colors (wall / roof / door) ----
export async function setHouseColors(areaId, plotNo, colors) {
  if (!areaId || plotNo == null) return;
  try {
    await set(ref(db, "houses/" + areaId + "/" + plotNo + "/colors"), colors);
  } catch (e) {
    console.warn("[houses] setHouseColors failed:", e.message);
  }
}

// ---- World helper: compute the entrance position (door + facing) for a plot ----
// Returns { x, z, facing } — where the player should stand to "enter" this house.
// Door is on the south side (+Z) of the plot, 4m in front of the plot centre.
export function getHouseEntrance(areaId, plotNo) {
  const area = getArea(areaId);
  if (!area) return null;
  const pos = getPlotPosition(area, plotNo);
  return {
    x: pos.x,
    z: pos.z + 4,
    facing: Math.PI,  // facing south (back to the door)
  };
}
