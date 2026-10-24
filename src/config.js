// src/config.js — constants. Units are metres. Road runs along X.
export const ROAD_HALF = 8;
export const WORLD_HALF_X = 200;
// FEATURE 3b: expanded walkable bounds so players can reach all 14 area plot
// positions (cheap areas at Z=±80, rich areas at Z=±40). The ground plane in
// world.js is already 1400x700 — plenty of room. This is just the player clamp.
export const PLAYER_LIMIT_X = 780;   // was 560, which put the Kaduna Airport (x 620-720) behind an invisible wall
export const PLAYER_LIMIT_Z = 400;
export const CROSSINGS = [-80, 0, 80];
export const SIDE_STREETS = [-90, 90];
// ---- WIDE CITY: districts sit OUTSIDE the main-street band and are joined by avenues + cross streets ----
export const WIDE_AVENUES_X = [-230, -90, 90, 230];   // north-south avenues (the two at +-90 continue the old side streets)
export const WIDE_CROSS_Z = [-195, -88, 88, 195];     // east-west streets
export const MAP_HALF_X = 360, MAP_HALF_Z = 340;      // size of the whole city (minimap + ground)

// ---- Time scale: REAL-TIME clock (1 real hour = 1 game hour) ----
// FEATURE: was 5 real min = 1 game hour (too fast — messages + shops flashing
// open/close, time running away from the player). Now 1 real hour = 1 game hour
// so the in-game clock matches the player's real-life wall clock. Shops open
// at 8am and close at 10pm in REAL time, so a player who plays in the evening
// sees evening in-game too.
export const TIME_SCALE = 1;  // 1 real minute per game minute (real-time)
export const REAL_MS_PER_GAME_HOUR = TIME_SCALE * 60 * 60 * 1000;  // 1 real hour = 1 game hour (real-time clock)

// FEATURE: time-of-day mode.
//   null = natural day/night cycle (day default, evening at sunset, night after dark).
//         The SKY array in main.js already has nice sunset colours at 18:00-19:30.
//         The brighter night hemi/moonlight fix (graphics.js) ensures night isn't
//         pitch-black. Lamp posts glow softly at night.
//   17.5 = locked to 5:30pm evening always (override for testing only).
// Override per-session with `?t=22` URL param.
// Night look. true = the sky, street lights, window glow and car headlights follow the REAL clock (dark after ~6:30 PM).
// false = the old behaviour: the game always shows daytime. Shop opening hours are NOT affected by this switch.
export const SHOW_NIGHT = true;
export const FIXED_HOUR = null;  // FEATURE: natural day/night cycle (was 17.5 evening-lock)

export const LANES = [
  { z: 2.75, dir: 1, speed: 8.5 },
  { z: 6.25, dir: 1, speed: 12.5 },
  { z: -2.75, dir: -1, speed: 9.5 },
  { z: -6.25, dir: -1, speed: 13.5 },
];

export const TIPS = [
  "Kaduna na the Centre of Learning.",
  "Small small, your Kaduna life go big.",
  "Tip: drag the screen to look around.",
  "Tip: use the Jog button when you dey rush.",
  "Mind the road. Use the zebra crossing!",
  "Kaduna weather sweet, harmattan no dey joke.",
  "Eat well at the market stalls.",
  "Keke napep — the fastest way around town.",
];

// Needs system (Phase 4)
export const NEEDS = [
  { key: "hunger", label: "Hunger", icon: "🍛", drainPerMin: 1.2, min: 0, max: 100 },
  { key: "energy", label: "Energy", icon: "⚡", drainPerMin: 0.8, min: 0, max: 100 },
  { key: "fun", label: "Fun", icon: "🎉", drainPerMin: 0.6, min: 0, max: 100 },
  { key: "social", label: "Social", icon: "💬", drainPerMin: 0.4, min: 0, max: 100 },
  { key: "hygiene", label: "Hygiene", icon: "🚿", drainPerMin: 0.5, min: 0, max: 100 },
  { key: "bladder", label: "Bladder", icon: "🚻", drainPerMin: 0.7, min: 0, max: 100 },
];

// Phone apps (Phase 6)
export const PHONE_APPS = [
  { id: "jobs", label: "Hustle", icon: "💼", desc: "Find work and earn money" },
  { id: "bank", label: "Bank", icon: "🏦", desc: "Check your balance" },
  { id: "food", label: "Chop", icon: "🍛", desc: "Buy food to satisfy hunger" },
  { id: "ride", label: "Ride", icon: "🛺", desc: "Book a keke or taxi" },
  { id: "health", label: "Health", icon: "💊", desc: "Buy medicine and boosters" },
  { id: "messages", label: "Messages", icon: "✉️", desc: "Your notifications" },
  { id: "boutique", label: "Boutique", icon: "👕", desc: "Buy clothes" },
  { id: "news", label: "News", icon: "📰", desc: "What's happening in Kaduna" },
  { id: "contacts", label: "Contacts", icon: "📱", desc: "Your friends" },
  { id: "settings", label: "Settings", icon: "⚙️", desc: "Game settings" },
];

// Food items (Kaduna-flavoured, inspired by reference study)
export const FOOD_ITEMS = [
  { id: "jollof", name: "Jollof Rice", emoji: "🍛", price: 1500, hunger: 75, fun: 10, energy: 5 },
  { id: "suya", name: "Suya & Chapman", emoji: "🍢", price: 1200, hunger: 40, fun: 15, energy: 3 },
  { id: "amala", name: "Amala & Ewedu", emoji: "🥣", price: 1000, hunger: 70, fun: 4, energy: 8 },
  { id: "puffpuff", name: "Puff-puff", emoji: "🍩", price: 300, hunger: 18, energy: 12, fun: 6 },
  { id: "zobo", name: "Chilled Zobo", emoji: "🧃", price: 200, hunger: 6, fun: 8, energy: 5 },
  { id: "moimoi", name: "Moi Moi", emoji: "🫘", price: 500, hunger: 35, fun: 3, energy: 6 },
  { id: "friedyam", name: "Fried Yam & Sauce", emoji: "🍟", price: 400, hunger: 30, fun: 5, energy: 4 },
  { id: "kunu", name: "Kunu Drink", emoji: "🥤", price: 250, hunger: 5, fun: 6, energy: 15 },
];

// Job listings
export const JOBS = [
  { id: "keke", name: "Keke Driver", pay: 800, energyCost: 15, time: 120, req: null, desc: "Drive keke for passengers" },
  { id: "market", name: "Market Seller", pay: 500, energyCost: 10, time: 90, req: null, desc: "Sell goods at the market" },
  { id: "okada", name: "Okada Rider", pay: 1200, energyCost: 20, time: 150, req: "energy>30", desc: "Ride okada for fares" },
  { id: "teacher", name: "School Teacher", pay: 2000, energyCost: 25, time: 240, req: "energy>50", desc: "Teach at a local school" },
  { id: "trader", name: "Shop Trader", pay: 1500, energyCost: 18, time: 180, req: "energy>40", desc: "Run a shop business" },
];

// Ranks
export const RANKS = [
  { id: "newcomer", name: "Newcomer", minMoney: 0, color: "#8a8f96" },
  { id: "hustler", name: "Hustler", minMoney: 10000, color: "#f2b134" },
  { id: "oga", name: "Oga", minMoney: 50000, color: "#e11d48" },
  { id: "bigoga", name: "Big Oga", minMoney: 200000, color: "#6b21a8" },
];

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Travel zones (Phase 5)
export const ZONES = [
  { id: "ahmadu_bello", name: "Ahmadu Bello Way", desc: "The main road — where it all starts" },
  { id: "kawo", name: "Kawo", desc: "Bustling market district" },
  { id: "sabon_tasha", name: "Sabon Tasha", desc: "Residential area with shops" },
  { id: "barnawa", name: "Barnawa", desc: "Riverside leisure zone" },
];

// Ride options (Phase 5)
export const RIDES = [
  { id: "keke", name: "Keke Napep", price: 300, time: 3, icon: "🛺" },
  { id: "bus", name: "Bus", price: 200, time: 5, icon: "🚌" },
  { id: "taxi", name: "Taxi", price: 1500, time: 2, icon: "🚕" },
];

// Economy config (Phase 7)
export const ECONOMY = {
  startingMoney: 5000,
  maxTransactionLog: 50,
  richListSize: 10,
};

// Kaduna map locations (for Map feature)
// FEATURE: spread out across the expanded world (X ±250, Z ±100). Was cramped
// on one street near the main road. Now each district has its actual area
// position (matching areas.js), and landmarks are placed in their districts.
export const MAP_LOCATIONS = [
  // ---- Main road + road-adjacent landmarks ----
  { name: "Ahmadu Bello Way", type: "road", x: 0, z: 0, major: true, desc: "Main road — where it all starts" },
  { name: "Kawo Market", type: "market", x: -30, z: -25, major: true, desc: "Bustling market — best suya on weekends" },
  { name: "Central Mosque", type: "landmark", x: 48, z: 34, major: true, desc: "The heart of Kaduna" },
  { name: "Petrol Station", type: "service", x: -110, z: 28, major: false, desc: "Fill up your tank" },
  { name: "Keke Park", type: "transport", x: 60, z: -28, major: true, desc: "Keke napep stand" },
  { name: "Bus Stop (North)", type: "transport", x: -40, z: 13, major: false, desc: "Bus stop heading north" },
  { name: "Bus Stop (South)", type: "transport", x: 30, z: -13, major: false, desc: "Bus stop heading south" },
  { name: "Bus Stop (Far North)", type: "transport", x: 120, z: 13, major: false, desc: "Bus stop at city edge" },
  { name: "Bus Stop (Far South)", type: "transport", x: -130, z: -13, major: false, desc: "Bus stop at city edge" },
  // ---- Real Kaduna areas (positions match areas.js so the minimap matches reality) ----
  // Cheap / rent areas
  { name: "Rigasa", type: "district", x: -120, z: 80, major: false, desc: "Working-class area, near the railway" },
  { name: "Kakuri", type: "district", x: 120, z: 80, major: false, desc: "Industrial area" },
  { name: "Tudun Wada", type: "district", x: -120, z: -80, major: false, desc: "Dense residential" },
  { name: "Mando", type: "district", x: 120, z: -80, major: false, desc: "Outskirts with big compounds" },
  { name: "Kabala Costain", type: "district", x: -140, z: 0, major: false, desc: "Old neighbourhood near the railway" },
  // Middle areas
  { name: "Kawo", type: "district", x: -60, z: 60, major: true, desc: "Bustling market district" },
  { name: "Sabon Tasha", type: "district", x: 60, z: 60, major: true, desc: "Residential with shops + schools" },
  { name: "Gonin Gora", type: "district", x: -60, z: -60, major: false, desc: "Growing suburb" },
  { name: "Television", type: "district", x: 60, z: -60, major: false, desc: "Modern area near the TV station" },
  { name: "Ungwan Sarki", type: "district", x: -100, z: 40, major: false, desc: "Established neighbourhood" },
  // Rich areas (GRA-style)
  { name: "Barnawa", type: "district", x: 100, z: 40, major: true, desc: "GRA-style. Big houses, riverside" },
  { name: "Malali", type: "district", x: 100, z: -40, major: true, desc: "Upscale. Diplomats live here" },
  { name: "Ungwan Rimi", type: "district", x: -100, z: -40, major: true, desc: "GRA. Spacious compounds + gardens" },
  { name: "Badarawa", type: "district", x: 140, z: 0, major: false, desc: "Quiet upscale riverside area" },
  // ---- Spread-out landmarks (in their actual districts) ----
  { name: "Murtala Square", type: "landmark", x: 0, z: 38, major: true, desc: "Sports & events ground" },
  { name: "Kaduna Polytechnic", type: "landmark", x: 60, z: -28, major: true, desc: "Centre of Learning (in Sabon Tasha)" },
  { name: "KASU University", type: "landmark", x: 160, z: 24, major: true, desc: "Kaduna State University — quiz nights, sports & campus parties" },
  { name: "Ahmadu Bello Stadium", type: "landmark", x: -100, z: 40, major: false, desc: "Football stadium (in Ungwan Sarki)" },
  { name: "Railway Station", type: "transport", x: -140, z: 0, major: true, desc: "Kaduna train station (in Kabala Costain)" },
  { name: "Lugard Hall", type: "landmark", x: 100, z: 40, major: false, desc: "Historic government building (in Barnawa)" },
  { name: "Golf Club", type: "landmark", x: 100, z: -40, major: false, desc: "Kaduna Golf Club (in Malali)" },
  { name: "Hamdala Hotel", type: "landmark", x: 0, z: 0, major: true, desc: "Historic hotel on Ahmadu Bello Way" },
  { name: "High Court", type: "landmark", x: -60, z: 60, major: false, desc: "Kaduna State High Court (in Kawo)" },
];

// Daily quest definitions
export const DAILY_QUESTS = [
  { id: "eat", desc: "Eat any food", reward: 300 },
  { id: "work", desc: "Complete any job", reward: 500 },
  { id: "chat", desc: "Send a chat message", reward: 200 },
  { id: "travel", desc: "Travel to another zone", reward: 400 },
];

// Daily login rewards (7-day cycle)
export const DAILY_REWARDS = [
  { day: 1, money: 500 },
  { day: 2, money: 1000 },
  { day: 3, money: 1500 },
  { day: 4, money: 2000 },
  { day: 5, money: 3000 },
  { day: 6, money: 5000 },
  { day: 7, money: 10000 },
];

// Sickness thresholds
export const SICKNESS = {
  hygieneThreshold: 15,  // below this → sick
  energyThreshold: 10,   // below this → exhausted
  recoveryRate: 0.5,     // how fast sickness recovers when hygiene is good
};
