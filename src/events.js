// src/events.js — Phase 2: NEPA power cuts + moodlets + consequences
//
// NEPA cuts happen randomly every 30-90 minutes (real time) and last 3-8 minutes.
// During a cut: lights go out, energy/fun drain faster, generator/solar item reduces the effect.
//
// Moodlets are temporary buffs/debuffs that modify need drain rates and give toast notifications.
// They're stored in game.state.moodlets = [{ id, expires, modifier }]
//
// Consequences:
//   - Low energy (< 20) → walking speed cut by 50%
//   - Zero hunger → blackout (teleport home, lose some money)
//   - Low hygiene → other players see a "smelly" emoji, social drain faster

import { NEEDS } from "./config.js";

// ---- NEPA power cut state ----
let _nepaCut = false;
let _nepaCutEnds = 0;
let _nextNepaCheck = 0;
const NEPA_MIN_INTERVAL = 30 * 60 * 1000;  // 30 min real = minimum gap between cuts
const NEPA_MAX_INTERVAL = 90 * 60 * 1000;  // 90 min real = maximum gap
const NEPA_MIN_DURATION = 3 * 60 * 1000;   // 3 min real
const NEPA_MAX_DURATION = 8 * 60 * 1000;   // 8 min real

export function isNepaCut() { return _nepaCut; }
export function getNepaStatus() {
  if (!_nepaCut) return { active: false, nextCheckMs: Math.max(0, _nextNepaCheck - Date.now()) };
  return { active: true, endsMs: Math.max(0, _nepaCutEnds - Date.now()) };
}

// Check if the player has a generator or solar panel placed in their home.
// This is called from main.js with the current placedFurniture list.
export function hasPowerBackup(placedFurniture) {
  if (!placedFurniture) return false;
  return placedFurniture.some(f => f.id === "generator" || f.id === "solar_panel" || f.id === "inverter");
}

// Tick the NEPA system. Called every frame from main.js.
// Returns events (toasts) that should be shown.
export function tickNepa(dt, hasBackup) {
  const now = Date.now();
  let events = [];
  if (_nepaCut) {
    if (now >= _nepaCutEnds) {
      _nepaCut = false;
      _nextNepaCheck = now + NEPA_MIN_INTERVAL + Math.random() * (NEPA_MAX_INTERVAL - NEPA_MIN_INTERVAL);
      events.push({ type: "nepa_restored", msg: "💡 NEPA don bring light! Power restored." });
    }
  } else {
    if (now >= _nextNepaCheck) {
      _nepaCut = true;
      _nepaCutEnds = now + NEPA_MIN_DURATION + Math.random() * (NEPA_MAX_DURATION - NEPA_MIN_DURATION);
      if (hasBackup) {
        events.push({ type: "nepa_cut_backup", msg: "⚡ NEPA took light, but your generator dey run. No wahala!" });
      } else {
        events.push({ type: "nepa_cut", msg: "🔌 NEPA don take light! Energy and fun dey drain faster. Buy a generator!" });
      }
    }
  }
  return events;
}

// Get the modified drain rate for a need, factoring in NEPA + moodlets.
// baseRate is the normal drainPerMin from config.js.
export function getModifiedDrain(needKey, baseRate, hasBackup, moodlets) {
  let rate = baseRate;
  // NEPA cut: energy and fun drain 2x faster (unless backup)
  if (_nepaCut && !hasBackup) {
    if (needKey === "energy") rate *= 2.0;
    if (needKey === "fun") rate *= 1.5;
  }
  // Moodlets
  if (moodlets) {
    for (const m of moodlets) {
      if (m.modifiers && m.modifiers[needKey]) rate *= m.modifiers[needKey];
    }
  }
  return rate;
}

// ---- Moodlets ----
// A moodlet is { id, label, icon, expires, modifiers: { needKey: multiplier } }
// Positive modifiers < 1 (slower drain), negative > 1 (faster drain).
export const MOODLET_DEFS = {
  well_rested:  { label: "Well Rested",   icon: "😊", duration: 30 * 60 * 1000, modifiers: { energy: 0.5 } },
  well_fed:     { label: "Well Fed",      icon: "🍛", duration: 20 * 60 * 1000, modifiers: { hunger: 0.5 } },
  fresh_shower: { label: "Fresh",         icon: "🚿", duration: 30 * 60 * 1000, modifiers: { hygiene: 0.4, social: 0.8 } },
  happy_mood:   { label: "Happy",         icon: "😄", duration: 25 * 60 * 1000, modifiers: { fun: 0.6, energy: 0.8 } },
  sick:         { label: "Sick",          icon: "🤒", duration: 10 * 60 * 1000, modifiers: { energy: 1.5, fun: 1.5 } },
  stinky:       { label: "Stinky",        icon: "💩", duration: 15 * 60 * 1000, modifiers: { social: 2.0 } },
  inspired:     { label: "Inspired",      icon: "💡", duration: 45 * 60 * 1000, modifiers: { fun: 0.7, energy: 0.9 } },
  heartbroken:  { label: "Heartbroken",   icon: "💔", duration: 60 * 60 * 1000, modifiers: { fun: 1.8, social: 1.5 } },
};

export function addMoodlet(state, moodletId) {
  const def = MOODLET_DEFS[moodletId];
  if (!def) return;
  if (!state.moodlets) state.moodlets = [];
  // Remove any existing instance of this moodlet
  state.moodlets = state.moodlets.filter(m => m.id !== moodletId);
  state.moodlets.push({
    id: moodletId,
    label: def.label,
    icon: def.icon,
    expires: Date.now() + def.duration,
    modifiers: def.modifiers,
  });
  state.save?.();
}

export function tickMoodlets(state) {
  if (!state.moodlets || !state.moodlets.length) return;
  const now = Date.now();
  const before = state.moodlets.length;
  state.moodlets = state.moodlets.filter(m => m.expires > now);
  if (state.moodlets.length !== before) state.save?.();
}

export function getActiveMoodlets(state) {
  if (!state.moodlets) return [];
  const now = Date.now();
  return state.moodlets.filter(m => m.expires > now);
}

// ---- Consequences ----
// Returns { slowWalk: bool, blackout: bool, stinky: bool }
export function getConsequences(state) {
  const energy = state.needs?.energy || 0;
  const hunger = state.needs?.hunger || 0;
  const hygiene = state.needs?.hygiene || 0;
  return {
    slowWalk: energy < 20,
    blackout: hunger < 1,
    stinky: hygiene < 15,
  };
}

// Walk speed multiplier based on energy level.
export function getWalkSpeedMultiplier(state) {
  const energy = state.needs?.energy || 0;
  if (energy < 10) return 0.3;  // very slow
  if (energy < 20) return 0.5;  // slow
  if (energy < 40) return 0.8;  // slightly slow
  return 1.0;                   // normal
}

// Initialize NEPA schedule (called on first load)
export function initEvents() {
  _nextNepaCheck = Date.now() + NEPA_MIN_INTERVAL + Math.random() * (NEPA_MAX_INTERVAL - NEPA_MIN_INTERVAL);
}
