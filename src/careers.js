// src/careers.js — Phase 3: Career ladders + skills + shift tones
//
// 15 career ladders x 5 levels each. Promotion depends on skill levels.
// 7 skills: hustle, charisma, fitness, cooking, coding, music, comedy.
// 5 shift tones: steady, push_hard, gist, flatter, easy — each trades
// energy/fun/social/pay/risk differently.
//
// Skills are saved to players/{uid}/skills = { hustle: 0-100, charisma: 0-100, ... }
// Career progress saved to players/{uid}/career = { id, level, xp, totalShifts }

import { db } from "./firebase.js";
import { ref, get, update, onValue } from "firebase/database";

// ---- Skills ----
export const SKILLS = [
  { id: "hustle",    label: "Hustle",    icon: "💪", desc: "How hard you grind. Boosts pay from any job." },
  { id: "charisma",  label: "Charisma",  icon: "💬", desc: "Smooth talk. Unlocks sales, politics, entertainment." },
  { id: "fitness",   label: "Fitness",   icon: "🏃", desc: "Body strength. Unlocks keke, okada, security, sports." },
  { id: "cooking",   label: "Cooking",   icon: "🍳", desc: "Kitchen skills. Unlocks buka, restaurant, catering." },
  { id: "coding",    label: "Coding",    icon: "💻", desc: "Tech skills. Unlocks remote work, tech jobs." },
  { id: "music",     label: "Music",     icon: "🎵", desc: "Sound skills. Unlocks DJ, studio, performance." },
  { id: "comedy",    label: "Comedy",    icon: "😂", desc: "Making people laugh. Unlocks MC, content creation." },
];

// ---- Career ladders (15 careers x 5 levels) ----
// req = skill requirements to unlock this career (any one must be met)
// levelReq = skill level needed for that promotion
export const CAREERS = [
  { id: "keke_driver",  name: "Keke Driver",    icon: "🛺", skill: "fitness",  levels: [
    { title: "Learner",        pay: 500,  levelReq: 0,  energyCost: 15 },
    { title: "Registered",     pay: 800,  levelReq: 15, energyCost: 14 },
    { title: "Pro Driver",     pay: 1200, levelReq: 30, energyCost: 12 },
    { title: "Boss Driver",    pay: 1800, levelReq: 50, energyCost: 10 },
    { title: "Keke King",      pay: 2500, levelReq: 70, energyCost: 8 },
  ]},
  { id: "market_trader", name: "Market Trader", icon: "🏪", skill: "hustle",  levels: [
    { title: "Apprentice",     pay: 400,  levelReq: 0,  energyCost: 12 },
    { title: "Stall Owner",    pay: 700,  levelReq: 15, energyCost: 11 },
    { title: "Shop Owner",     pay: 1100, levelReq: 30, energyCost: 10 },
    { title: "Market Chief",   pay: 1700, levelReq: 50, energyCost: 9 },
    { title: "Market King",    pay: 2500, levelReq: 70, energyCost: 8 },
  ]},
  { id: "tailor",        name: "Tailor",         icon: "🧵", skill: "hustle",  levels: [
    { title: "Learner",        pay: 300,  levelReq: 0,  energyCost: 10 },
    { title: "Junior Tailor",  pay: 600,  levelReq: 15, energyCost: 10 },
    { title: "Senior Tailor",  pay: 1000, levelReq: 30, energyCost: 9 },
    { title: "Master Tailor",  pay: 1600, levelReq: 50, energyCost: 8 },
    { title: "Fashion Don",    pay: 2400, levelReq: 70, energyCost: 7 },
  ]},
  { id: "teacher",       name: "Teacher",        icon: "📚", skill: "charisma", levels: [
    { title: "Pupil Teacher",  pay: 800,  levelReq: 0,  energyCost: 20 },
    { title: "NCE Teacher",    pay: 1300, levelReq: 20, energyCost: 18 },
    { title: "Graduate Teacher", pay: 1900, levelReq: 40, energyCost: 16 },
    { title: "Senior Teacher", pay: 2700, levelReq: 60, energyCost: 14 },
    { title: "Principal",      pay: 3800, levelReq: 80, energyCost: 12 },
  ]},
  { id: "nurse",         name: "Nurse",          icon: "💉", skill: "fitness",  levels: [
    { title: "Trainee",        pay: 900,  levelReq: 0,  energyCost: 22 },
    { title: "Staff Nurse",    pay: 1500, levelReq: 25, energyCost: 20 },
    { title: "Senior Nurse",   pay: 2200, levelReq: 45, energyCost: 18 },
    { title: "Matron",         pay: 3200, levelReq: 65, energyCost: 16 },
    { title: "Chief Matron",   pay: 4500, levelReq: 85, energyCost: 14 },
  ]},
  { id: "doctor",        name: "Doctor",         icon: "👨‍⚕️", skill: "fitness",  levels: [
    { title: "House Officer",  pay: 2000, levelReq: 40, energyCost: 25 },
    { title: "Medical Officer", pay: 3000, levelReq: 55, energyCost: 22 },
    { title: "Registrar",      pay: 4200, levelReq: 70, energyCost: 20 },
    { title: "Consultant",     pay: 6000, levelReq: 85, energyCost: 18 },
    { title: "Chief Consultant", pay: 8500, levelReq: 95, energyCost: 16 },
  ]},
  { id: "civil_servant", name: "Civil Servant",  icon: "🏛️", skill: "charisma", levels: [
    { title: "GL 06",          pay: 1200, levelReq: 0,  energyCost: 15 },
    { title: "GL 10",          pay: 1800, levelReq: 20, energyCost: 14 },
    { title: "GL 14",          pay: 2600, levelReq: 40, energyCost: 13 },
    { title: "GL 17",          pay: 3800, levelReq: 60, energyCost: 12 },
    { title: "Permanent Sec",  pay: 5500, levelReq: 80, energyCost: 10 },
  ]},
  { id: "dj",            name: "DJ",             icon: "🎧", skill: "music",    levels: [
    { title: "Bedroom DJ",     pay: 600,  levelReq: 0,  energyCost: 12 },
    { title: "Party DJ",       pay: 1000, levelReq: 15, energyCost: 11 },
    { title: "Club DJ",        pay: 1700, levelReq: 30, energyCost: 10 },
    { title: "Star DJ",        pay: 2800, levelReq: 50, energyCost: 9 },
    { title: "Legend DJ",      pay: 4200, levelReq: 70, energyCost: 8 },
  ]},
  { id: "barber",        name: "Barber",         icon: "💈", skill: "hustle",   levels: [
    { title: "Apprentice",     pay: 400,  levelReq: 0,  energyCost: 10 },
    { title: "Junior Barber",  pay: 700,  levelReq: 15, energyCost: 9 },
    { title: "Senior Barber",  pay: 1100, levelReq: 30, energyCost: 8 },
    { title: "Master Barber",  pay: 1700, levelReq: 50, energyCost: 7 },
    { title: "Celebrity Barber", pay: 2600, levelReq: 70, energyCost: 6 },
  ]},
  { id: "mechanic",      name: "Mechanic",       icon: "🔧", skill: "fitness",  levels: [
    { title: "Apprentice",     pay: 500,  levelReq: 0,  energyCost: 18 },
    { title: "Junior Mech",    pay: 900,  levelReq: 15, energyCost: 16 },
    { title: "Senior Mech",    pay: 1400, levelReq: 30, energyCost: 14 },
    { title: "Master Mech",    pay: 2100, levelReq: 50, energyCost: 12 },
    { title: "Boss Mech",      pay: 3200, levelReq: 70, energyCost: 10 },
  ]},
  { id: "lawyer",        name: "Lawyer",         icon: "⚖️", skill: "charisma", levels: [
    { title: "Pupil",          pay: 1500, levelReq: 30, energyCost: 20 },
    { title: "Junior",         pay: 2500, levelReq: 45, energyCost: 18 },
    { title: "Senior",         pay: 3800, levelReq: 60, energyCost: 16 },
    { title: "Partner",        pay: 5500, levelReq: 75, energyCost: 14 },
    { title: "SAN",            pay: 8000, levelReq: 90, energyCost: 12 },
  ]},
  { id: "coder",         name: "Software Dev",   icon: "💻", skill: "coding",   levels: [
    { title: "Junior Dev",     pay: 2000, levelReq: 20, energyCost: 15 },
    { title: "Mid Dev",        pay: 3500, levelReq: 35, energyCost: 14 },
    { title: "Senior Dev",     pay: 5500, levelReq: 55, energyCost: 13 },
    { title: "Lead Dev",       pay: 8500, levelReq: 75, energyCost: 12 },
    { title: "CTC",            pay: 12000, levelReq: 90, energyCost: 10 },
  ]},
  { id: "cook",          name: "Buka Cook",      icon: "🍲", skill: "cooking",  levels: [
    { title: "Kitchen Help",   pay: 500,  levelReq: 0,  energyCost: 16 },
    { title: "Assistant Cook", pay: 900,  levelReq: 15, energyCost: 15 },
    { title: "Head Cook",      pay: 1500, levelReq: 30, energyCost: 14 },
    { title: "Buka Owner",     pay: 2400, levelReq: 50, energyCost: 12 },
    { title: "Restaurant Boss", pay: 3600, levelReq: 70, energyCost: 10 },
  ]},
  { id: "mc",            name: "MC / Comedian",  icon: "🎤", skill: "comedy",   levels: [
    { title: "Open Mic",       pay: 700,  levelReq: 10, energyCost: 14 },
    { title: "Event MC",       pay: 1300, levelReq: 25, energyCost: 13 },
    { title: "Star MC",        pay: 2200, levelReq: 45, energyCost: 12 },
    { title: "A-List MC",      pay: 3500, levelReq: 65, energyCost: 10 },
    { title: "Comedy King",    pay: 5500, levelReq: 85, energyCost: 8 },
  ]},
  { id: "sales_rep",     name: "Sales Rep",      icon: "🤝", skill: "charisma", levels: [
    { title: "Field Rep",      pay: 800,  levelReq: 10, energyCost: 14 },
    { title: "Senior Rep",     pay: 1400, levelReq: 25, energyCost: 13 },
    { title: "Team Lead",      pay: 2200, levelReq: 45, energyCost: 12 },
    { title: "Sales Manager",  pay: 3400, levelReq: 65, energyCost: 10 },
    { title: "Sales Director", pay: 5000, levelReq: 85, energyCost: 8 },
  ]},
];

// ---- Shift tones ----
// Each tone modifies pay, energy cost, fun, social, and risk of failure.
export const SHIFT_TONES = [
  { id: "steady",     label: "Steady",         icon: "😐", payMul: 1.0,  energyMul: 1.0,  fun: 0,   social: 0,   risk: 0.02 },
  { id: "push_hard",  label: "Push Hard",      icon: "🔥", payMul: 1.4,  energyMul: 1.5,  fun: -10, social: -5,  risk: 0.08 },
  { id: "gist",       label: "Gist with Pals", icon: "💬", payMul: 0.8,  energyMul: 0.8,  fun: 10,  social: 15,  risk: 0.05 },
  { id: "flatter",    label: "Flatter Oga",    icon: "😏", payMul: 1.2,  energyMul: 0.9,  fun: -5,  social: 5,   risk: 0.10 },
  { id: "easy",       label: "Take It Easy",   icon: "😌", payMul: 0.7,  energyMul: 0.6,  fun: 8,   social: 5,   risk: 0.01 },
];

// ---- State (per player) ----
let _uid = null;
let _skills = {};
let _career = { id: null, level: 0, xp: 0, totalShifts: 0 };
let _onUpdate = null;

export function initCareers(uid, onUpdate) {
  _uid = uid;
  _onUpdate = onUpdate;
  if (!uid) return;
  onValue(ref(db, "players/" + uid + "/skills"), (snap) => {
    _skills = snap.val() || {};
    // Initialize missing skills to 0
    for (const s of SKILLS) if (_skills[s.id] == null) _skills[s.id] = 0;
    _onUpdate?.();
  });
  onValue(ref(db, "players/" + uid + "/career"), (snap) => {
    _career = snap.val() || { id: null, level: 0, xp: 0, totalShifts: 0 };
    _onUpdate?.();
  });
}

export function getSkills() { return _skills; }
export function getCareer() { return _career; }

export function getCareerDef(id) { return CAREERS.find(c => c.id === id); }

export function canJoinCareer(careerId) {
  const c = getCareerDef(careerId);
  if (!c) return { ok: false, reason: "Unknown career" };
  const firstLevel = c.levels[0];
  const skillVal = _skills[c.skill] || 0;
  if (skillVal < firstLevel.levelReq) {
    return { ok: false, reason: "Need " + c.skill + " level " + firstLevel.levelReq + " (you have " + skillVal + ")" };
  }
  return { ok: true };
}

export function canPromote() {
  if (!_career.id) return { ok: false, reason: "No career yet" };
  const c = getCareerDef(_career.id);
  if (!c) return { ok: false, reason: "Unknown career" };
  if (_career.level >= c.levels.length - 1) return { ok: false, reason: "Max level reached" };
  const nextLevel = c.levels[_career.level + 1];
  const skillVal = _skills[c.skill] || 0;
  if (skillVal < nextLevel.levelReq) {
    return { ok: false, reason: "Need " + c.skill + " level " + nextLevel.levelReq + " (you have " + skillVal + ")" };
  }
  if (_career.xp < 100) return { ok: false, reason: "Need 100 XP (you have " + _career.xp + ")" };
  return { ok: true, nextLevel };
}

export async function joinCareer(careerId) {
  const check = canJoinCareer(careerId);
  if (!check.ok) return check;
  _career = { id: careerId, level: 0, xp: 0, totalShifts: 0 };
  await update(ref(db, "players/" + _uid + "/career"), _career);
  return { ok: true, msg: "🎉 You joined " + getCareerDef(careerId).name + " as " + getCareerDef(careerId).levels[0].title };
}

export async function promote() {
  const check = canPromote();
  if (!check.ok) return check;
  _career.level++;
  _career.xp = 0;
  await update(ref(db, "players/" + _uid + "/career"), _career);
  const c = getCareerDef(_career.id);
  return { ok: true, msg: "🎉 Promoted to " + c.levels[_career.level].title + "!" };
}

// Do a shift. Returns { ok, pay, energyCost, fun, social, msg, failed }
export async function doShift(toneId, gameState) {
  if (!_career.id) return { ok: false, msg: "Join a career first!" };
  const c = getCareerDef(_career.id);
  if (!c) return { ok: false, msg: "Unknown career" };
  const level = c.levels[_career.level];
  const tone = SHIFT_TONES.find(t => t.id === toneId) || SHIFT_TONES[0];
  // Check energy
  const energyCost = Math.round(level.energyCost * tone.energyMul);
  if ((gameState.needs?.energy || 0) < energyCost) {
    return { ok: false, msg: "Too tired. Rest first. Need " + energyCost + " energy." };
  }
  // Risk check
  const failed = Math.random() < tone.risk;
  const pay = Math.round(level.pay * tone.payMul * (failed ? 0.3 : 1.0));
  // Apply
  gameState.needs.energy = Math.max(0, (gameState.needs.energy || 0) - energyCost);
  gameState.needs.fun = Math.max(0, Math.min(100, (gameState.needs.fun || 0) + tone.fun));
  gameState.needs.social = Math.max(0, Math.min(100, (gameState.needs.social || 0) + tone.social));
  gameState.money += pay;
  // XP + skill growth
  _career.xp = Math.min(100, _career.xp + 15);
  _career.totalShifts = (_career.totalShifts || 0) + 1;
  const skillGrowth = 2 * (1 + (gameState.skillBonus || 0));
  _skills[c.skill] = Math.min(100, (_skills[c.skill] || 0) + skillGrowth);
  // Save
  gameState.save?.();
  await update(ref(db, "players/" + _uid + "/career"), _career);
  await update(ref(db, "players/" + _uid + "/skills"), _skills);
  // Balance to Firebase (safe object form)
  const { runTransaction } = await import("firebase/database");
  await runTransaction(ref(db, "economy/" + _uid + "/balance"), (cur) => (cur || 0) + pay);
  return {
    ok: true,
    pay,
    energyCost,
    msg: (failed ? "😅 Shift went bad. " : "✅ ") + "Earned ₦" + pay.toLocaleString() + " as " + level.title + ".",
    failed,
  };
}

// Train a skill (costs money + energy, gives skill points)
export async function trainSkill(skillId, gameState) {
  const cost = 1000;
  if (gameState.money < cost) return { ok: false, msg: "Need ₦" + cost.toLocaleString() + " to train" };
  if ((gameState.needs?.energy || 0) < 20) return { ok: false, msg: "Too tired to train" };
  gameState.money -= cost;
  gameState.needs.energy = Math.max(0, (gameState.needs.energy || 0) - 20);
  const growth = 5 * (1 + (gameState.skillBonus || 0));
  _skills[skillId] = Math.min(100, (_skills[skillId] || 0) + growth);
  gameState.save?.();
  await update(ref(db, "players/" + _uid + "/skills"), _skills);
  const { runTransaction } = await import("firebase/database");
  await runTransaction(ref(db, "economy/" + _uid + "/balance"), (cur) => (cur || 0) - cost);
  return { ok: true, msg: "📚 Trained " + skillId + " +" + growth.toFixed(1) + " (cost ₦" + cost + ")" };
}
