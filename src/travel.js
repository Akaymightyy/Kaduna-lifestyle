// src/travel.js — travel system that uses the place registry.
// Modes: walk (free, slow), keke (₦300, fast), bus (₦200, slow), okada (₦500, fastest), taxi (₦1500, fast).
// Travel target: any registered place's entrance, or one of the legacy zones.

import { db } from "./firebase.js";
import { ref, set } from "firebase/database";
import { listPlaces, getPlace, isPlaceOpen } from "./places/registry.js";

// Legacy zones (kept for the existing world fast-travel UI)
const ZONES = [
  { id: "ahmadu_bello", name: "Ahmadu Bello Way", desc: "The main road — where it all starts" },
  { id: "kawo", name: "Kawo", desc: "Bustling market district" },
  { id: "sabon_tasha", name: "Sabon Tasha", desc: "Residential area with shops" },
  { id: "barnawa", name: "Barnawa", desc: "Riverside leisure zone" },
];

const RIDES = [
  { id: "walk", name: "Walk", price: 0, time: 8, icon: "🚶" },
  { id: "keke", name: "Keke Napep", price: 300, time: 3, icon: "🛺" },
  { id: "bus", name: "Bus", price: 200, time: 5, icon: "🚌" },
  { id: "okada", name: "Okada", price: 500, time: 2, icon: "🏍️" },
  { id: "taxi", name: "Taxi", price: 1500, time: 2, icon: "🚕" },
];

export function getZones() { return ZONES; }
export function getRides() { return RIDES; }

// All travel destinations = legacy zones + all registered places
export function getDestinations(gameHour) {
  const places = listPlaces().map((p) => ({
    id: p.id,
    name: p.name,
    desc: p.minimapIcon + " " + (p.type === "interior" ? "Interior" : "Outdoor") + " · " + p.activities.length + " activities",
    isPlace: true,
    open: isPlaceOpen(p, gameHour),
    entrance: { x: p.entranceX, z: p.entranceZ },
    icon: p.minimapIcon,
  }));
  const zones = ZONES.map((z) => ({
    id: z.id,
    name: z.name,
    desc: z.desc,
    isPlace: false,
    open: true,
    icon: "📍",
  }));
  return [...places, ...zones];
}

// Start a ride/travel to a destination.
//   rideId        one of RIDES ids
//   destId        place id (if isPlace) or zone id
//   money         player's current balance (for fare check)
//   onProgress(p) called with 0..1
//   onComplete(result)  { ok, dest, cost }
export function startRide(rideId, destId, money, onProgress, onComplete) {
  const ride = RIDES.find((r) => r.id === rideId);
  if (!ride) { onComplete({ ok: false, error: "Unknown ride: " + rideId }); return; }

  // Resolve destination
  const place = getPlace(destId);
  const zone = !place ? ZONES.find((z) => z.id === destId) : null;
  if (!place && !zone) { onComplete({ ok: false, error: "Unknown destination: " + destId }); return; }
  const dest = place
    ? { id: place.id, name: place.name, isPlace: true, entrance: { x: place.entranceX, z: place.entranceZ } }
    : { id: zone.id, name: zone.name, isPlace: false };

  if (money < ride.price) {
    onComplete({ ok: false, error: "Not enough money for " + ride.name });
    return;
  }

  let elapsed = 0;
  const total = ride.time;
  const tips = [
    "Kaduna traffic no dey carry last...",
    "Small small, we dey go.",
    "Mind the keke drivers, dem sabi corner well.",
    "Kawo market get the best suya on weekends.",
    "Barnawa riverside sweet for evening stroll.",
    "Make sure you hold your change o.",
    "Harmattan dust dey show face today.",
  ];
  let tipIdx = 0;

  const overlay = document.getElementById("travel-overlay");
  if (overlay) {
    overlay.classList.add("show");
    const bar = document.getElementById("travel-bar");
    const pct = document.getElementById("travel-pct");
    const tipEl = document.getElementById("travel-tip");
    const titleEl = document.getElementById("travel-title");
    const iconEl = document.getElementById("travel-icon");
    if (titleEl) titleEl.textContent = ride.icon + " " + ride.name + " → " + dest.name;
    if (iconEl) iconEl.textContent = ride.icon;
    if (tipEl) tipEl.textContent = tips[0];

    const interval = setInterval(() => {
      elapsed += 0.1;
      const progress = Math.min(1, elapsed / total);
      if (bar) bar.style.width = (progress * 100) + "%";
      if (pct) pct.textContent = Math.round(progress * 100) + "%";
      if (tipEl && Math.floor(elapsed) > tipIdx && tipIdx < tips.length - 1) {
        tipIdx++;
        tipEl.textContent = tips[tipIdx];
      }
      onProgress?.(progress);

      if (elapsed >= total) {
        clearInterval(interval);
        overlay.classList.remove("show");
        onComplete({ ok: true, dest: dest, cost: ride.price, ride });
      }
    }, 100);
  } else {
    setTimeout(() => onComplete({ ok: true, dest: dest, cost: ride.price, ride }), 500);
  }
}

// Legacy function kept for callers that use zone ids directly
export function travelToZone(uid, zoneId) {
  if (!uid) return;
  set(ref(db, "players/" + uid + "/zone"), zoneId);
}

// New: record that the player traveled to a place
export function travelToPlace(uid, placeId) {
  if (!uid) return;
  set(ref(db, "players/" + uid + "/place"), placeId);
  set(ref(db, "players/" + uid + "/zone"), null); // clear zone when in a place
}
