// src/config.js — constants. Units are metres. Road runs along X.
export const ROAD_HALF = 8;
export const WORLD_HALF_X = 200;
export const PLAYER_LIMIT_X = 150;
export const PLAYER_LIMIT_Z = 55;
export const CROSSINGS = [-80, 0, 80];
export const SIDE_STREETS = [-90, 90];

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
