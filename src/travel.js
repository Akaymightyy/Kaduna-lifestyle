// src/travel.js — keke/bus/taxi rides + zone loading screen
import { db } from "./firebase.js";
import { ref, set } from "firebase/database";

const ZONES = [
  { id: "ahmadu_bello", name: "Ahmadu Bello Way", desc: "The main road — where it all starts" },
  { id: "kawo", name: "Kawo", desc: "Bustling market district" },
  { id: "sabon_tasha", name: "Sabon Tasha", desc: "Residential area with shops" },
  { id: "barnawa", name: "Barnawa", desc: "Riverside leisure zone" },
];

const RIDES = [
  { id: "keke", name: "Keke Napep", price: 300, time: 3, icon: "🛺" },
  { id: "bus", name: "Bus", price: 200, time: 5, icon: "🚌" },
  { id: "taxi", name: "Taxi", price: 1500, time: 2, icon: "🚕" },
];

export function getZones() { return ZONES; }
export function getRides() { return RIDES; }

export function startRide(rideId, zoneId, money, onProgress, onComplete) {
  const ride = RIDES.find(r => r.id === rideId);
  const zone = ZONES.find(z => z.id === zoneId);
  if (!ride || !zone) return;
  if (money < ride.price) { onComplete({ ok: false, error: "Not enough money for " + ride.name }); return; }

  let elapsed = 0;
  const total = ride.time; // seconds
  const tips = [
    "Kaduna traffic no dey carry last...",
    "Small small, we dey go.",
    "Mind the keke drivers, dem sabi corner well.",
    "Kawo market get the best suya on weekends.",
    "Barnawa riverside sweet for evening stroll.",
  ];
  let tipIdx = 0;

  // Show loading overlay
  const overlay = document.getElementById("travel-overlay");
  if (overlay) {
    overlay.classList.add("show");
    const bar = document.getElementById("travel-bar");
    const pct = document.getElementById("travel-pct");
    const tipEl = document.getElementById("travel-tip");
    const titleEl = document.getElementById("travel-title");
    if (titleEl) titleEl.textContent = `${ride.icon} ${ride.name} → ${zone.name}`;
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
        onComplete({ ok: true, zone: zone, cost: ride.price });
      }
    }, 100);
  } else {
    // Fallback — instant travel
    setTimeout(() => onComplete({ ok: true, zone: zone, cost: ride.price }), 500);
  }
}

export function travelToZone(uid, zoneId) {
  if (!uid) return;
  set(ref(db, "players/" + uid + "/zone"), zoneId);
}
