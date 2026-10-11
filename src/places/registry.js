// src/places/registry.js
// The Place Registry — every place in Kaduna Lifestyle is declared here.
//
// IMPORTANT: place modules are imported STATICALLY (not dynamic import) so
// they get bundled correctly by Vite. Dynamic import with @vite-ignore
// breaks in production because the relative path doesn't exist at runtime.
//
// Place shape:
//   id, name, type, worldX/Z, entranceX/Z, entranceFacing,
//   minimapIcon, minimapColor, hours, ambientSound, npcList, activities

// ---- STATIC IMPORTS (fixes "could not load" in production) ----
import * as central_market_mod from "./central_market.js";
import * as suya_spot_mod from "./suya_spot.js";
import * as central_mosque_mod from "./central_mosque.js";
import * as kawo_park_mod from "./kawo_park.js";
import * as university_mod from "./university.js";
import * as mall_cinema_mod from "./mall_cinema.js";
import * as hospital_mod from "./hospital.js";
import * as bank_mod from "./bank.js";
import * as stadium_mod from "./stadium.js";
import * as river_park_mod from "./river_park.js";
import * as church_mod from "./church.js";
import * as barber_mod from "./barber.js";
import * as nightclub_mod from "./nightclub.js";

const MODULES = {
  central_market: central_market_mod,
  suya_spot: suya_spot_mod,
  central_mosque: central_mosque_mod,
  kawo_park: kawo_park_mod,
  university: university_mod,
  mall_cinema: mall_cinema_mod,
  hospital: hospital_mod,
  bank: bank_mod,
  stadium: stadium_mod,
  river_park: river_park_mod,
  church: church_mod,
  barber: barber_mod,
  nightclub: nightclub_mod,
};

const PLACE_DEFS = [
  {
    id: "central_market",
    name: "Kaduna Central Market",
    type: "interior",
    worldX: -30, worldZ: -30,
    entranceX: -30, entranceZ: -27,
    entranceFacing: Math.PI,
    minimapIcon: "🛒",
    minimapColor: 0xc0392b,
    hours: { open: 7, close: 20 },
    ambientSound: "market",
    npcList: [
      { id: "trader1", name: "Mama Nkechi", outfit: "ankara", role: "fabric seller" },
      { id: "trader2", name: "Alhaji Sani", outfit: "kaftan", role: "spice trader" },
      { id: "trader3", name: "Aunty Bisi", outfit: "ankara", role: "tailor" },
    ],
    activities: [
      { id: "haggle", label: "Haggle for fabric", desc: "Try to get the best price from Mama Nkechi" },
      { id: "buy_spices", label: "Buy spices", desc: "Stock up on dried pepper and curry" },
      { id: "tailor", label: "Tailor an outfit", desc: "Get measured by Aunty Bisi" },
      { id: "eat", label: "Eat at food corner", desc: "Hot tuwo and miyan kuka" },
    ],
  },
  {
    id: "suya_spot",
    name: "Mai Suya Spot",
    type: "outdoor",
    worldX: -60, worldZ: 20,
    entranceX: -60, entranceZ: 18,
    entranceFacing: 0,
    minimapIcon: "🍢",
    minimapColor: 0xd98e2b,
    hours: { open: 16, close: 24 },
    ambientSound: "street",
    npcList: [
      { id: "suya1", name: "Mallam Audu", outfit: "kaftan", role: "suya seller" },
      { id: "boy1", name: "Yaro", outfit: "casual", role: "errand boy" },
    ],
    activities: [
      { id: "order_suya", label: "Order suya", desc: "Beef or chicken suya with yaji pepper" },
      { id: "drink_zobo", label: "Buy zobo", desc: "Chilled zobo with cucumber" },
      { id: "chat", label: "Gist with the boys", desc: "Talk football and politics" },
    ],
  },
  {
    id: "central_mosque",
    name: "Central Mosque",
    type: "interior",
    worldX: 0, worldZ: -15,
    entranceX: 0, entranceZ: -18,
    entranceFacing: Math.PI,
    minimapIcon: "🕌",
    minimapColor: 0x1f7a5a,
    hours: null,
    ambientSound: "mosque",
    npcList: [
      { id: "imam", name: "Imam Ibrahim", outfit: "kaftan", role: "Imam" },
      { id: "guard1", name: "Mallam Garba", outfit: "kaftan", role: "entrance guard" },
    ],
    activities: [
      { id: "pray", label: "Pray", desc: "Restore mood and hygiene" },
      { id: "listen_adhan", label: "Listen to adhan", desc: "Call to prayer at salat times" },
      { id: "read_quran", label: "Read Quran", desc: "Quiet reflection" },
    ],
  },
  {
    id: "kawo_park",
    name: "Kawo Motor Park",
    type: "outdoor",
    worldX: -40, worldZ: -100,
    entranceX: -40, entranceZ: -97,
    entranceFacing: Math.PI / 2,
    minimapIcon: "🚌",
    minimapColor: 0xf2b134,
    hours: { open: 5, close: 22 },
    ambientSound: "motorpark",
    npcList: [
      { id: "conductor1", name: "Musa", outfit: "casual", role: "bus conductor" },
      { id: "driver1", name: "Alhaji Tanko", outfit: "kaftan", role: "bus driver" },
    ],
    activities: [
      { id: "board_bus", label: "Board bus to Zaria", desc: "Travel north — ₦800" },
      { id: "hire_keke", label: "Hire keke", desc: "Quick ride into town — ₦200" },
      { id: "hire_okada", label: "Hire okada", desc: "Fastest through traffic — ₦400" },
      { id: "eat_park", label: "Eat at park vendor", desc: "Hot kunu and kosai — ₦300" },
    ],
  },
  {
    id: "university",
    name: "Kaduna Polytechnic",
    type: "outdoor",
    worldX: 100, worldZ: -60,
    entranceX: 100, entranceZ: -57,
    entranceFacing: -Math.PI / 2,
    minimapIcon: "🎓",
    minimapColor: 0x1d5fa8,
    hours: { open: 8, close: 19 },
    ambientSound: "campus",
    npcList: [
      { id: "lecturer1", name: "Dr. Aminu", outfit: "kaftan", role: "lecturer" },
      { id: "student1", name: "Fatima", outfit: "casual", role: "student" },
    ],
    activities: [
      { id: "attend_lecture", label: "Attend lecture", desc: "Earn ₦500 stipend" },
      { id: "eat_cafeteria", label: "Eat at cafeteria", desc: "Cheap student meal — ₦400" },
      { id: "play_football", label: "Play football", desc: "Fun + social on the field" },
      { id: "rest_hostel", label: "Rest at hostel", desc: "Restore energy" },
    ],
  },
  {
    id: "mall_cinema",
    name: "Kaduna Mall & Cinema",
    type: "interior",
    worldX: 180, worldZ: 40,
    entranceX: 180, entranceZ: 37,
    entranceFacing: Math.PI,
    minimapIcon: "🏬",
    minimapColor: 0x7a3b8f,
    hours: { open: 9, close: 23 },
    ambientSound: "mall",
    npcList: [
      { id: "cashier1", name: "Glory", outfit: "casual", role: "boutique cashier" },
      { id: "usher1", name: "Emeka", outfit: "casual", role: "cinema usher" },
    ],
    activities: [
      { id: "shop_clothes", label: "Shop for clothes", desc: "Designer outfits from ₦3000" },
      { id: "watch_movie", label: "Watch a movie", desc: "Nollywood premiere — ₦1500" },
      { id: "eat_foodcourt", label: "Eat at food court", desc: "Continental dishes from ₦1000" },
      { id: "browse", label: "Browse shops", desc: "Window shopping — fun +5" },
    ],
  },
  {
    id: "hospital",
    name: "Barau Dikko Hospital",
    type: "interior",
    worldX: -180, worldZ: 60,
    entranceX: -180, entranceZ: 57,
    entranceFacing: Math.PI / 2,
    minimapIcon: "🏥",
    minimapColor: 0xe11d48,
    hours: null,
    ambientSound: "hospital",
    npcList: [
      { id: "doctor1", name: "Dr. Okafor", outfit: "casual", role: "doctor" },
      { id: "nurse1", name: "Nurse Aisha", outfit: "casual", role: "nurse" },
    ],
    activities: [
      { id: "treat", label: "Get treatment", desc: "Full health restore — ₦2000" },
      { id: "checkup", label: "Health checkup", desc: "Diagnose sickness — ₦500" },
      { id: "buy_drugs", label: "Buy drugs", desc: "Pharmacy — from ₦200" },
      { id: "rest", label: "Rest in ward", desc: "Energy +30 — ₦1000" },
    ],
  },
  {
    id: "bank",
    name: "First Bank Kaduna",
    type: "interior",
    worldX: 50, worldZ: 40,
    entranceX: 50, entranceZ: 37,
    entranceFacing: Math.PI,
    minimapIcon: "🏦",
    minimapColor: 0x1a5a3a,
    hours: { open: 8, close: 16 },
    ambientSound: "bank",
    npcList: [
      { id: "teller1", name: "Mr. Bello", outfit: "casual", role: "teller" },
      { id: "manager1", name: "Mrs. Okon", outfit: "casual", role: "branch manager" },
    ],
    activities: [
      { id: "deposit", label: "Deposit money", desc: "Safely store your cash" },
      { id: "withdraw", label: "Withdraw money", desc: "Take out your savings" },
      { id: "loan", label: "Apply for loan", desc: "Borrow up to ₦50,000" },
      { id: "transfer", label: "Transfer money", desc: "Send to another player" },
    ],
  },
  {
    id: "stadium",
    name: "Ahmadu Bello Stadium",
    type: "outdoor",
    worldX: -100, worldZ: 60,
    entranceX: -100, entranceZ: 57,
    entranceFacing: Math.PI,
    minimapIcon: "⚽",
    minimapColor: 0x2e7d4f,
    hours: { open: 15, close: 22 },
    ambientSound: "stadium",
    npcList: [
      { id: "coach1", name: "Coach Daniel", outfit: "casual", role: "coach" },
      { id: "player1", name: "Ahmed", outfit: "casual", role: "footballer" },
    ],
    activities: [
      { id: "watch_match", label: "Watch a match", desc: "Fun +30 — ₦500" },
      { id: "play_match", label: "Join a match", desc: "Earn ₦1000 if you win" },
      { id: "buy_ticket", label: "Buy season ticket", desc: "₦5000 — discounts" },
      { id: "buy_snacks", label: "Buy snacks", desc: "Hunger +20 — ₦300" },
    ],
  },
  {
    id: "river_park",
    name: "Kaduna River Park",
    type: "outdoor",
    worldX: -200, worldZ: 0,
    entranceX: -197, entranceZ: 0,
    entranceFacing: -Math.PI / 2,
    minimapIcon: "🌊",
    minimapColor: 0x0ea5e9,
    hours: null,
    ambientSound: "river",
    npcList: [
      { id: "fisher1", name: "Pa Audu", outfit: "kaftan", role: "fisherman" },
      { id: "guard2", name: "Sergeant Idris", outfit: "casual", role: "park ranger" },
    ],
    activities: [
      { id: "fish", label: "Go fishing", desc: "Catch fish — sell for ₦200-800" },
      { id: "picnic", label: "Have a picnic", desc: "Mood +25, fun +15" },
      { id: "boat_ride", label: "Boat ride", desc: "Romantic — ₦1000, mood +30" },
      { id: "relax", label: "Relax by the water", desc: "Energy +20, mood +10" },
    ],
  },
  {
    id: "church",
    name: "St. Bartholomew's Church",
    type: "interior",
    worldX: -70, worldZ: 40,
    entranceX: -70, entranceZ: 37,
    entranceFacing: Math.PI,
    minimapIcon: "⛪",
    minimapColor: 0xc8b890,
    hours: { open: 6, close: 21 },
    ambientSound: "church",
    npcList: [
      { id: "pastor1", name: "Pastor John", outfit: "casual", role: "pastor" },
      { id: "usher2", name: "Sister Mary", outfit: "casual", role: "usher" },
    ],
    activities: [
      { id: "pray_church", label: "Pray", desc: "Mood +25, social +10" },
      { id: "attend_service", label: "Attend service", desc: "Sundays — mood +30" },
      { id: "choir", label: "Join choir practice", desc: "Fun +15, social +15" },
      { id: "donate", label: "Donate", desc: "Give ₦500 — mood +20" },
    ],
  },
  {
    id: "barber",
    name: "Musa's Barber Shop",
    type: "interior",
    worldX: 30, worldZ: -40,
    entranceX: 30, entranceZ: -37,
    entranceFacing: -Math.PI / 2,
    minimapIcon: "💈",
    minimapColor: 0x1a1a2e,
    hours: { open: 8, close: 20 },
    ambientSound: "barber",
    npcList: [
      { id: "barber1", name: "Musa", outfit: "casual", role: "barber" },
      { id: "customer1", name: "Sani", outfit: "kaftan", role: "customer" },
    ],
    activities: [
      { id: "haircut", label: "Get a haircut", desc: "Hygiene +20, fun +10 — ₦500" },
      { id: "beard_trim", label: "Trim beard", desc: "Hygiene +10 — ₦300" },
      { id: "shave", label: "Clean shave", desc: "Hygiene +25 — ₦400" },
      { id: "gossip", label: "Gist with Musa", desc: "Social +15, hear news" },
    ],
  },
  {
    id: "nightclub",
    name: "Kajuru Nightclub",
    type: "interior",
    worldX: 0, worldZ: -40,
    entranceX: 0, entranceZ: -37,
    entranceFacing: -Math.PI / 2,
    minimapIcon: "🪩",
    minimapColor: 0x6b21a8,
    hours: { open: 20, close: 4 },
    ambientSound: "club",
    npcList: [
      { id: "dj1", name: "DJ Zee", outfit: "casual", role: "DJ" },
      { id: "bouncer1", name: "Big Mike", outfit: "casual", role: "bouncer" },
    ],
    activities: [
      { id: "dance", label: "Dance", desc: "Fun +30, energy -10 — ₦1000" },
      { id: "buy_drink", label: "Buy a drink", desc: "Social +10 — ₦500" },
      { id: "socialize", label: "Socialize", desc: "Meet people — social +20" },
      { id: "vip", label: "Book VIP table", desc: "₦5000 — fun +40, social +30" },
    ],
  },
];

// ---- registry runtime state ----
const _loaded = new Map();
const _listeners = new Set();

export function listPlaces() {
  return PLACE_DEFS.map((d) => ({ ...d }));
}

export function getPlace(id) {
  return PLACE_DEFS.find((p) => p.id === id) || null;
}

export function findPlaceAtPosition(x, z, radius = 6) {
  for (const def of PLACE_DEFS) {
    const dx = def.entranceX - x, dz = def.entranceZ - z;
    if (dx * dx + dz * dz < radius * radius) return def;
  }
  return null;
}

export function isPlaceOpen(def, gameHour) {
  if (!def.hours) return true;
  if (def.hours.open <= def.hours.close) {
    return gameHour >= def.hours.open && gameHour < def.hours.close;
  }
  return gameHour >= def.hours.open || gameHour < def.hours.close;
}

// Build a place: look up its module statically, call build(). Cached.
export async function buildPlace(id, scene, ctx) {
  if (_loaded.has(id)) return _loaded.get(id).instance;
  const def = getPlace(id);
  if (!def) throw new Error("Unknown place: " + id);
  const mod = MODULES[id];
  if (!mod || !mod.build || typeof mod.build !== "function") {
    throw new Error("Place module for " + id + " not found or has no build()");
  }
  const instance = await mod.build(scene, ctx);
  _loaded.set(id, { def, moduleExports: mod, instance });
  _notify("built", id);
  return instance;
}

export async function disposePlace(id) {
  const entry = _loaded.get(id);
  if (!entry) return;
  if (entry.instance?.dispose) {
    try { await entry.instance.dispose(); } catch (e) { console.warn("dispose error", e); }
  }
  _loaded.delete(id);
  _notify("disposed", id);
}

export function getLoadedPlace(id) {
  return _loaded.has(id) ? _loaded.get(id).instance : null;
}

export function subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
function _notify(type, id) {
  for (const fn of _listeners) {
    try { fn({ type, id }); } catch (_) {}
  }
}

export function enterablePlaces(gameHour, playerX, playerZ, radius = 6) {
  const out = [];
  for (const def of PLACE_DEFS) {
    const dx = def.entranceX - playerX, dz = def.entranceZ - playerZ;
    const inRange = dx * dx + dz * dz < radius * radius;
    if (!inRange) continue;
    const open = isPlaceOpen(def, gameHour);
    out.push({ ...def, open });
  }
  return out;
}
