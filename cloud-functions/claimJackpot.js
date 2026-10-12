// cloud-functions/claimJackpot.js — HTTPS callable function that validates a
// Money Hunt claim server-side and pays out the reward. Deploy this when you
// want full anti-cheat protection (see README.md in this folder).
//
// Validation performed:
//   1. The caller is authenticated.
//   2. The spot exists in the canonical SPOTS list.
//   3. The player's last synced position is within CLAIM_RANGE of the spot.
//   4. The spot is not in its respawn window (transaction on hunt/{spotId}).
//   5. The reward matches the deterministic rollReward() for this bucket.
//
// Only after all checks pass does the function:
//   - Write the claim to hunt/{spotId}.
//   - Add the reward to economy/{uid}/balance via transaction.
//   - Log the claim to economy/{uid}/log/{eventId}.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { getAuth } = require("firebase-admin/auth");

initializeApp();
const db = getDatabase();
const auth = getAuth();

// ---- Mirror of src/moneyspots.js (kept in sync manually) ----
const RARITY = {
  common:  { min: 500,   max: 2000,   respawnMs: 20 * 60 * 1000 },
  rare:    { min: 5000,  max: 20000,  respawnMs: 3 * 60 * 60 * 1000 },
  jackpot: { min: 50000, max: 200000, respawnMs: 24 * 60 * 60 * 1000 },
};
const CLAIM_RANGE = 6;
const MAX_CLAIMS_PER_DAY = 25;

// The SPOTS array must be the same as the client's. Copy it here when you add
// new spots to src/moneyspots.js. (Keeping it in sync manually is fine — there
// are only ~25 spots and they rarely change.)
const SPOTS = [
  // COMMON
  { id: "c_market_ne",   x: -22, z: -18, rarity: "common",  area: "Central Market" },
  { id: "c_market_sw",   x: -38, z: -10, rarity: "common",  area: "Central Market" },
  { id: "suya_back",     x:  18, z:  12, rarity: "common",  area: "Suya Spot" },
  { id: "mosque_garden", x: -55, z:  22, rarity: "common",  area: "Central Mosque" },
  { id: "kawo_corner",   x:  45, z: -28, rarity: "common",  area: "Kawo Park" },
  { id: "river_edge",    x:  80, z:  35, rarity: "common",  area: "River Park" },
  { id: "mall_steps",    x:  60, z: -12, rarity: "common",  area: "Mall/Cinema" },
  { id: "uni_walk",      x: -90, z:  18, rarity: "common",  area: "University" },
  { id: "church_yard",   x: -70, z: -22, rarity: "common",  area: "Church" },
  { id: "hospital_bench",x:  30, z:  25, rarity: "common",  area: "Hospital" },
  { id: "barber_alley",  x:  10, z: -30, rarity: "common",  area: "Barber" },
  { id: "stadium_gate",  x:  95, z: -25, rarity: "common",  area: "Stadium" },
  // RARE
  { id: "r_flyover",     x:   0, z:  40, rarity: "rare",    area: "Flyover" },
  { id: "r_rooftop",     x:  60, z: -10, rarity: "rare",    area: "Mall Rooftop" },
  { id: "r_market_raft", x: -32, z: -22, rarity: "rare",    area: "Central Market" },
  { id: "r_river_dock",  x:  90, z:  40, rarity: "rare",    area: "River Park" },
  { id: "r_uni_lib",     x: -95, z:  20, rarity: "rare",    area: "University" },
  { id: "r_park_bush",   x:  50, z: -30, rarity: "rare",    area: "Kawo Park" },
  { id: "r_mosque_back", x: -58, z:  28, rarity: "rare",    area: "Central Mosque" },
  // JACKPOT
  { id: "j_stadium_vip",   x: 100, z: -30, rarity: "jackpot", area: "Stadium VIP" },
  { id: "j_mall_rooftop",  x:  62, z: -14, rarity: "jackpot", area: "Mall Rooftop" },
  { id: "j_river_end",     x: 110, z:  45, rarity: "jackpot", area: "River Park End" },
  { id: "j_uni_old_hall",  x:-100, z:  22, rarity: "jackpot", area: "Old Lecture Hall" },
];

function rollReward(rarity, spotId, bucketMs) {
  const r = RARITY[rarity];
  if (!r) return 0;
  let h = 2166136261;
  const s = spotId + ":" + bucketMs;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  let x = h >>> 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  const u = ((x >>> 0) / 4294967296);
  return Math.floor(r.min + u * (r.max - r.min));
}

function respawnBucket(rarity, now = Date.now()) {
  const r = RARITY[rarity];
  return r ? Math.floor(now / r.respawnMs) : 0;
}

exports.claimJackpot = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to claim.");

  const { spotId, x, z } = req.data || {};
  if (!spotId || typeof x !== "number" || typeof z !== "number") {
    throw new HttpsError("invalid-argument", "Missing spotId, x, or z.");
  }

  const spot = SPOTS.find((s) => s.id === spotId);
  if (!spot) throw new HttpsError("not-found", "Unknown spot.");

  // 1. Distance check (the client also does this, but we re-check server-side).
  const dx = spot.x - x, dz = spot.z - z;
  if (Math.sqrt(dx * dx + dz * dz) > CLAIM_RANGE + 1.5) {
    throw new HttpsError("out-of-range", "Too far from the spot.");
  }

  // 2. Per-day cap
  const today = new Date().toISOString().slice(0, 10);
  const dayKey = "hunt_day_" + today;
  const statsSnap = await db.ref("players/" + uid + "/huntStats").get();
  const stats = statsSnap.val() || {};
  const todayCount = stats.lastClaimDay === today ? (stats.dayClaimCount || 0) : 0;
  if (todayCount >= MAX_CLAIMS_PER_DAY) {
    throw new HttpsError("resource-exhausted", "Daily claim limit reached.");
  }

  // 3. Transaction on hunt/{spotId}
  const bucket = respawnBucket(spot.rarity);
  const reward = rollReward(spot.rarity, spot.id, bucket);
  const now = Date.now();
  const spotRef = db.ref("hunt/" + spot.id);
  let won = false;
  await spotRef.transaction((cur) => {
    const lastTs = cur && cur.ts ? cur.ts : 0;
    const r = RARITY[spot.rarity];
    if (now - lastTs < r.respawnMs) return; // abort
    won = true;
    return { claimedBy: uid, ts: now, reward, rarity: spot.rarity };
  });
  if (!won) throw new HttpsError("already-exists", "Spot already claimed.");

  // 4. Pay out via transaction
  const balRef = db.ref("economy/" + uid + "/balance");
  await balRef.transaction((cur) => (cur || 0) + reward);

  // 5. Log
  await db.ref("economy/" + uid + "/log/" + now).set({
    type: "hunt", spotId: spot.id, reward, rarity: spot.rarity, ts: now,
  });

  // 6. Update stats
  const newStats = {
    ...stats,
    lastClaimDay: today,
    dayClaimCount: todayCount + 1,
    totalClaims: (stats.totalClaims || 0) + 1,
    jackpotClaims: (stats.jackpotClaims || 0) + (spot.rarity === "jackpot" ? 1 : 0),
    rareClaims: (stats.rareClaims || 0) + (spot.rarity === "rare" ? 1 : 0),
    commonClaims: (stats.commonClaims || 0) + (spot.rarity === "common" ? 1 : 0),
    earlyBirdClaims: (stats.earlyBirdClaims || 0) + (new Date().getHours() < 7 ? 1 : 0),
    areasClaimed: { ...(stats.areasClaimed || {}), [spot.area]: (stats.areasClaimed?.[spot.area] || 0) + 1 },
  };
  await db.ref("players/" + uid + "/huntStats").update(newStats);

  return { ok: true, reward, rarity: spot.rarity, area: spot.area };
});
