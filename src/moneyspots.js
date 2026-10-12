// src/moneyspots.js — Money Hunt spot definitions.
// Data-driven: add a new entry to SPOTS below and the engine (src/moneyhunt.js)
// picks it up automatically — no engine code changes needed.
//
// Coordinates are in world metres. The walkable area is roughly:
//   X: -150 .. +150  (along the main road)
//   Z:  -55 .. +55   (across the road)
// Verify every spot is on walkable ground (no clipping through buildings).
// Hints are short riddles in Hausa/Pidgin/English — pick the language per spot
// so the hunt feels local.
//
// Rarity drives reward range + respawn time:
//   common:  ₦500 – ₦2,000     · respawn 20 min
//   rare:    ₦5,000 – ₦20,000  · respawn 3 h
//   jackpot: ₦50,000 – ₦200,000 · respawn 24 h
//
// `key` (optional): spot needs a code/key the player must guess from the hint.

export const RARITY = {
  common:  { label: "Common",  min: 500,   max: 2000,   respawnMs: 20 * 60 * 1000,   color: 0x4ade80, glyph: "💰" },
  rare:    { label: "Rare",    min: 5000,  max: 20000,  respawnMs: 3 * 60 * 60 * 1000, color: 0x60a5fa, glyph: "💼" },
  jackpot: { label: "Jackpot", min: 50000, max: 200000, respawnMs: 24 * 60 * 60 * 1000, color: 0xf2b134, glyph: "🏆" },
};

// Spot shape:
//   id, x, z, rarity, hint, lang, key (optional), area (district name for announcement)
// `area` is used by the "Money Rain" jackpot event to tell everyone which district.
export const SPOTS = [
  // ---- COMMON (small finds, fast respawn) ----
  { id: "c_market_ne",   x: -22, z: -18, rarity: "common", area: "Central Market", lang: "en",    hint: "Where tomato seller dey arrange basket for morning, check behind her stall." },
  { id: "c_market_sw",   x: -38, z: -10, rarity: "common", area: "Central Market", lang: "pcm",   hint: "Corner wey dem dey pack carton, near the gutter. Shine your eye well well." },
  { id: "suya_back",     x:  18, z:  12, rarity: "common", area: "Suya Spot",      lang: "hausa", hint: "Bayan wajen suya, inda ake jefa gawayi. Duba cikin bush." },
  { id: "mosque_garden", x: -55, z:  22, rarity: "common", area: "Central Mosque", lang: "en",    hint: "Garden bench beside the ablution tap. Sit small, look well." },
  { id: "kawo_corner",   x:  45, z: -28, rarity: "common", area: "Kawo Park",      lang: "pcm",   hint: "Where keke dey park for shade. Check under the bench." },
  { id: "river_edge",    x:  80, z:  35, rarity: "common", area: "River Park",     lang: "en",    hint: "Riverside rock near the third palm tree. Footprints dey show am." },
  { id: "mall_steps",    x:  60, z: -12, rarity: "common", area: "Mall/Cinema",    lang: "pcm",   hint: "Bottom of the mall staircase, where ice cream dey drop. Sweep eyes." },
  { id: "uni_walk",      x: -90, z:  18, rarity: "common", area: "University",     lang: "en",    hint: "Walkway between lecture halls. Students dey drop change here." },
  { id: "church_yard",   x: -70, z: -22, rarity: "common", area: "Church",         lang: "pcm",   hint: "Church yard flower pot. After service, something dey always drop." },
  { id: "hospital_bench",x:  30, z:  25, rarity: "common", area: "Hospital",       lang: "en",    hint: "Bench outside the pharmacy. People forget things here." },
  { id: "barber_alley",  x:  10, z: -30, rarity: "common", area: "Barber",         lang: "pcm",   hint: "Behind the barbershop, near the generator. Mind the smoke." },
  { id: "stadium_gate",  x:  95, z: -25, rarity: "common", area: "Stadium",        lang: "hausa", hint: "Kofar stadium, inda ake sayan tikit. Duba karkashin kujera." },

  // ---- RARE (bigger finds, slower respawn) ----
  { id: "r_flyover",     x:   0, z:  40, rarity: "rare", area: "Flyover",       lang: "en",    hint: "Under the flyover where rain no dey reach. Old briefcase dey wait." },
  { id: "r_rooftop",     x:  60, z: -10, rarity: "rare", area: "Mall Rooftop",  lang: "pcm",   hint: "Take stairs go rooftop of the mall. Yellow bag dey near the AC unit." },
  { id: "r_market_raft", x: -32, z: -22, rarity: "rare", area: "Central Market", lang: "hausa", hint: "Kan rafter na kasuwa, wanda ke saman shago na tsoho. Yi hankali." },
  { id: "r_river_dock",  x:  90, z:  40, rarity: "rare", area: "River Park",     lang: "en",    hint: "End of the wooden dock. Look under the third plank." },
  { id: "r_uni_lib",     x: -95, z:  20, rarity: "rare", area: "University",     lang: "pcm",   hint: "Library back staircase, between the second and third floor landing." },
  { id: "r_park_bush",   x:  50, z: -30, rarity: "rare", area: "Kawo Park",      lang: "en",    hint: "Bush path behind the park toilet. Wrapped parcel dey under leaves." },
  { id: "r_mosque_back", x: -58, z:  28, rarity: "rare", area: "Central Mosque", lang: "hausa", hint: "Bayan masallaci, kusa da bango. Wani abu ya ɓoye a cikin gurma." },

  // ---- JACKPOT (huge finds, daily respawn) ----
  { id: "j_stadium_vip",   x: 100, z: -30, rarity: "jackpot", area: "Stadium VIP",       lang: "en",    hint: "VIP lounge of the stadium. Black briefcase under the leather chair. Only the brave go at midnight." },
  { id: "j_mall_rooftop",  x:  62, z: -14, rarity: "jackpot", area: "Mall Rooftop",      lang: "pcm",   hint: "Rooftop of the mall, by the satellite dish. Gold box dey wait for the early bird." },
  { id: "j_river_end",     x: 110, z:  45, rarity: "jackpot", area: "River Park End",    lang: "hausa", hint: "Ƙarshen kogin, inda ruwa ke haduwa. Akwai takalmar azurfa a ƙasan itacen dabino." },
  { id: "j_uni_old_hall",  x:-100, z:  22, rarity: "jackpot", area: "Old Lecture Hall",  lang: "en",    hint: "Old lecture hall backstage, behind the broken piano. Something heavy dey inside." },
];

// Daily per-player claim cap (anti-farm).
export const MAX_CLAIMS_PER_DAY = 25;

// Money Rain event config (random jackpot spawn, 10-minute window).
export const MONEY_RAIN = {
  durationMs: 10 * 60 * 1000,
  // One random jackpot spot per event. The engine picks the spot and writes
  // an announcement to Firebase so every player's HUD shows the toast.
};

// Achievements — checked by moneyhunt.js after each successful claim.
export const HUNT_ACHIEVEMENTS = [
  { id: "explorer",      name: "Explorer",         desc: "Find 10 money spots",         check: (s) => s.totalClaims >= 10,     icon: "🧭" },
  { id: "treasure_hunt", name: "Treasure Hunter",  desc: "Find a jackpot",              check: (s) => s.jackpotClaims >= 1,    icon: "🏆" },
  { id: "early_bird",    name: "Early Bird",       desc: "Claim a spot before 7 AM",    check: (s) => s.earlyBirdClaims >= 1,  icon: "🐦" },
  { id: "sharp_eye",     name: "Sharp Eye",        desc: "Find 5 rare spots",           check: (s) => s.rareClaims >= 5,       icon: "👁️" },
  { id: "city_rat",      name: "City Rat",         desc: "Find spots in 6 different areas", check: (s) => Object.keys(s.areasClaimed || {}).length >= 6, icon: "🐀" },
];

// Helper: deterministic reward inside the rarity range, seeded by spotId + ts bucket.
// The bucket changes every respawn window so the same spot pays differently each cycle.
export function rollReward(rarity, spotId, bucketMs) {
  const r = RARITY[rarity];
  if (!r) return 0;
  // Build a 32-bit hash from spotId + bucket.
  let h = 2166136261;
  const s = spotId + ":" + bucketMs;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  // xorshift for a uniform 0..1
  let x = h >>> 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  const u = ((x >>> 0) / 4294967296);
  return Math.floor(r.min + u * (r.max - r.min));
}

// Helper: which respawn bucket does `now` fall into? Spots in the same bucket
// share the same reward so all players see the same amount for a given cycle.
export function respawnBucket(rarity, now = Date.now()) {
  const r = RARITY[rarity];
  if (!r) return 0;
  return Math.floor(now / r.respawnMs);
}

// Helper: is the spot currently claimable? (last claim + respawn has elapsed)
export function isClaimable(spot, lastClaimTs, now = Date.now()) {
  const r = RARITY[spot.rarity];
  if (!r) return false;
  if (!lastClaimTs) return true;
  return now - lastClaimTs >= r.respawnMs;
}
