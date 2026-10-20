// src/housing_upgrade.js — extends HOUSE_TIERS with luxury tiers (MyAbujaLife-style).
//
// The existing catalog (src/origins.js) tops out at Tier 6 "Private Estate"
// for ₦5M. The user wants MyAbujaLife-quality luxury flex — ₦150M+
// 5-bedroom villas with pools, and ₦500M+ mega-mansions for the truly
// wealthy. This module appends those tiers to the existing array at
// runtime, so upgradeCost() and the realestate UI pick them up
// automatically.
//
// Wire-up (in main.js):
//   import { extendHouseTiers } from "./housing_upgrade.js";
//   extendHouseTiers(HOUSE_TIERS);
//
// Idempotent (uses a Set) — safe to call multiple times.

let _extended = new Set();

export const LUXURY_TIERS = [
  {
    tier: 7,
    id: "villa",
    name: "5-Bedroom Villa with Pool",
    rent: 250000,
    buyPrice: 150000000,         // ₦150M
    guestCap: 100,
    emoji: "🏛️",
    desc: "5 en-suite bedrooms, infinity pool, double garage, marble floors, smart home. The GRA standard.",
  },
  {
    tier: 8,
    id: "mega_mansion",
    name: "Mega-Mansion",
    rent: 800000,
    buyPrice: 500000000,         // ₦500M
    guestCap: 200,
    emoji: "🏰",
    desc: "12 bedrooms, 4 pools, private cinema, helipad, staff quarters. For senators and oil moguls only.",
  },
  {
    tier: 9,
    id: "presidential",
    name: "Presidential Estate",
    rent: 2000000,
    buyPrice: 1500000000,        // ₦1.5B
    guestCap: 500,
    emoji: "👑",
    desc: "The biggest flex in Kaduna. Private zoo, golf course, runway for private jet. The pinnacle.",
  },
];

export function extendHouseTiers(existingTiers) {
  if (!existingTiers || !Array.isArray(existingTiers)) return;
  for (const tier of LUXURY_TIERS) {
    if (_extended.has(tier.tier)) continue;
    // Don't add if it would conflict with an existing tier
    if (existingTiers.some(t => t.tier === tier.tier)) continue;
    existingTiers.push(tier);
    _extended.add(tier.tier);
  }
}

// Get all luxury tiers (for the realestate UI to show "Luxury Tier" section)
export function getLuxuryTiers() {
  return [...LUXURY_TIERS];
}

// Check if a tier is a luxury tier (tier >= 7)
export function isLuxuryTier(tierNum) {
  return tierNum >= 7;
}

// Get a description string for display
export function getLuxuryDescription(tierNum) {
  const t = LUXURY_TIERS.find(t => t.tier === tierNum);
  return t ? t.desc : null;
}
