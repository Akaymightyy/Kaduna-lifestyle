// src/origins.js — Origin selection + rent system + housing tiers
// Phase 1: "Dan Attajiri" (rich kid) vs "Dan Talaka" (hustler) + 6 home tiers + weekly rent

import { db } from "./firebase.js";
import { ref, get, set, update, onValue } from "firebase/database";

// ---- ORIGINS ----
export const ORIGINS = [
  {
    id: "attajiri",
    name: "Dan Attajiri",
    desc: "Born with silver spoon. Cash, furnished flat, easier start.",
    money: 500000,
    homeTier: 2, // 1-Bedroom Flat
    starterFurniture: ["bed_single", "fridge", "tv_32", "standing_fan", "sofa_2seater"],
    skillBonus: 0,
    weeklyDebt: 0,
    icon: "💰",
    color: "#f2b134",
  },
  {
    id: "talaka",
    name: "Dan Talaka",
    desc: "Hustler from the ground up. Little cash, owes adashe, learns skills 25% faster.",
    money: 5000,
    homeTier: 1, // Face-me-I-face-you Room
    starterFurniture: ["bed_single"],
    skillBonus: 0.25, // 25% faster skill growth
    weeklyDebt: 1000, // owes adashe contribution each week
    icon: "🔥",
    color: "#e11d48",
  },
];

// ---- HOUSING TIERS ----
export const HOUSE_TIERS = [
  { tier: 1, id: "room", name: "Face-Me-I-Face-You Room", rent: 500, buyPrice: 0, guestCap: 2, emoji: "🚪", desc: "Shared compound, one room, no privacy" },
  { tier: 2, id: "flat", name: "1-Bedroom Flat", rent: 2000, buyPrice: 50000, guestCap: 4, emoji: "🏠", desc: "Small flat with kitchen + bathroom" },
  { tier: 3, id: "bungalow", name: "3-Bedroom Bungalow", rent: 5000, buyPrice: 200000, guestCap: 8, emoji: "🏡", desc: "Bungalow with compound + parking" },
  { tier: 4, id: "duplex", name: "Duplex", rent: 12000, buyPrice: 500000, guestCap: 12, emoji: "🏢", desc: "2-storey duplex with car park + garden" },
  { tier: 5, id: "mansion", name: "Mansion", rent: 30000, buyPrice: 2000000, guestCap: 20, emoji: "🏰", desc: "Luxury mansion with everything" },
  { tier: 6, id: "estate", name: "Private Estate", rent: 75000, buyPrice: 10000000, guestCap: 50, emoji: "🏟️", desc: "Your own private estate — ultimate flex" },
];

// ---- RENT SYSTEM ----
// Rent is due every Saturday (game time = every 7 real minutes * 24 = every 168 minutes = every 2.8 hours)
// For testing: rent is due every 10 real minutes
const RENT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes real time = 1 week game time

export function getRentInfo(state) {
  const lastPaid = state.lastRentPaid || 0;
  const now = Date.now();
  const elapsed = now - lastPaid;
  const due = elapsed >= RENT_INTERVAL_MS;
  const nextDueMs = Math.max(0, RENT_INTERVAL_MS - elapsed);
  const tier = HOUSE_TIERS.find(t => t.tier === (state.homeTier || 1)) || HOUSE_TIERS[0];
  return {
    due,
    amount: tier.rent,
    nextDueMs,
    nextDueMins: Math.ceil(nextDueMs / 60000),
    tier: tier,
    lastPaid,
  };
}

export async function payRent(uid, state) {
  const info = getRentInfo(state);
  if (!info.due) return { ok: false, error: "Rent not due yet" };
  if (state.money < info.amount) {
    // Can't pay — mood penalty, possible eviction
    state.needs.fun = Math.max(0, (state.needs.fun || 0) - 20);
    state.needs.social = Math.max(0, (state.needs.social || 0) - 10);
    state.save?.();
    // Check if this is the 3rd missed payment → eviction
    state.missedRent = (state.missedRent || 0) + 1;
    if (state.missedRent >= 3) {
      // Evict to room tier
      state.homeTier = 1;
      state.missedRent = 0;
      state.lastRentPaid = Date.now();
      state.save?.();
      return { ok: false, error: "🔇 Evicted! You've been moved to a Face-Me-I-Face-You room. Pay your rent on time!" };
    }
    state.save?.();
    return { ok: false, error: "❌ Can't pay rent! Mood dropped. Missed payments: " + state.missedRent + "/3 before eviction." };
  }
  // Pay rent
  state.money -= info.amount;
  state.lastRentPaid = Date.now();
  state.missedRent = 0;
  state.save?.();
  // Save to Firebase
  if (uid) {
    update(ref(db, "economy/" + uid + "/balance"), state.money);
    update(ref(db, "players/" + uid), { lastRentPaid: state.lastRentPaid, missedRent: 0 });
  }
  return { ok: true, msg: "✅ Rent paid: ₦" + info.amount.toLocaleString() + " for " + info.tier.name };
}

export async function checkRentDue(state, toast) {
  const info = getRentInfo(state);
  if (info.due) {
    // Landlord knock
    toast?.("🔔 Landlord knock! Rent due: ₦" + info.amount.toLocaleString() + " for " + info.tier.name + ". Pay now or lose mood!");
    return true;
  }
  return false;
}

// ---- ORIGIN SELECTION ----
export function applyOrigin(state, originId) {
  const origin = ORIGINS.find(o => o.id === originId);
  if (!origin) return { ok: false, error: "Unknown origin" };
  state.money = origin.money;
  state.homeTier = origin.homeTier;
  state.origin = origin.id;
  state.lastRentPaid = Date.now();
  state.missedRent = 0;
  state.skillBonus = origin.skillBonus;
  state.weeklyDebt = origin.weeklyDebt;
  state.save?.();
  return { ok: true, origin };
}

export function getOriginUI(state) {
  if (state.origin) return null; // already chosen
  return ORIGINS;
}
