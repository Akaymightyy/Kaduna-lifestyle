// src/world/protectedZones.js — the SAFETY CORE for the city density upgrade.
//
// Every existing thing in the world that new OSM buildings must never overlap is
// registered here as a simple axis-aligned rectangle (minX/maxX/minZ/maxZ):
//   - the main road + sidewalks, every avenue and cross street (cars drive on them)
//   - the existing procedural building rows along Ahmadu Bello Way
//   - hand-built landmarks: Central Mosque, market stalls, petrol station, keke park
//   - every place entrance + its exterior building (from the place registry)
//   - all 14 district plot grids (houses are built there dynamically at runtime)
//   - travel/ride landing points, scenery land points (airport, hills, lake)
//   - money-hunt spots, road-event anchors
//
// The OSM city layer (src/world/osmCity.js) tests every candidate building
// footprint against these zones and DROPS anything that intersects one. If a
// zone is missing here, worst case = a cosmetic overlap; nothing existing is
// ever moved or removed by this module.
//
// This file is data-only + query helpers. No three.js, no side effects.

import {
  ROAD_HALF, WIDE_AVENUES_X, WIDE_CROSS_Z, MAP_LOCATIONS,
} from "../config.js";
import { AREAS } from "../areas.js";
import { SPOTS as MONEY_SPOTS } from "../moneyspots.js";
import { SCENERY_LABELS, AIRPORT } from "../scenery.js";

const zones = []; // { x0, x1, z0, z1, tag }

function addZone(x0, z0, x1, z1, tag) {
  zones.push({
    x0: Math.min(x0, x1), x1: Math.max(x0, x1),
    z0: Math.min(z0, z1), z1: Math.max(z0, z1), tag,
  });
}

function addCircle(x, z, r, tag) {
  addZone(x - r, z - r, x + r, z + r, tag);
}

// ---- 1. Road corridors (main street + sidewalks, avenues, cross streets) ----
// Main road: asphalt ±8 + sidewalks to ±11 + kerb/billboard margin.
addZone(-1e5, -(ROAD_HALF + 12), 1e5, ROAD_HALF + 12, "main_road");
// North-south avenues (also cover the old side streets at ±90). Width 10 + kerb margin.
for (const ax of WIDE_AVENUES_X) addZone(ax - 11, -1e5, ax + 11, 1e5, "avenue_x" + ax);
// East-west cross streets.
for (const cz of WIDE_CROSS_Z) addZone(-1e5, cz - 11, 1e5, cz + 11, "cross_z" + cz);

// ---- 2. Existing procedural building rows along the main street ----
// world.js places rows only along |x| <= ~195 (loop runs -180..180, centred
// z=±(34+d/2), depth up to ~22). Keep the old generous z band but only where
// the rows actually are, so the outer fields can densify.
for (const side of [1, -1]) {
  addZone(-215, side > 0 ? 15 : -60, 215, side > 0 ? 60 : -15, "building_row_" + (side > 0 ? "n" : "s"));
}

// ---- 3. Hand-built landmarks in world.js ----
addZone(48 - 33, 34 - 29, 48 + 33, 34 + 29, "central_mosque");   // hall 34x22 + minarets ±20
addZone(-30 - 17, -25 - 15, -30 + 17, -25 + 15, "market_stalls"); // 8 stalls grid + sign
addZone(-110 - 12, 28 - 10, -110 + 12, 28 + 10, "petrol_station");
addZone(60 - 10, -28 - 8, 60 + 10, -28 + 8, "keke_park");

// ---- 4. Place entrances + exterior buildings (registry drives these) ----
// Exterior building sits behind the entrance: centre = entrance ± (D/2 + 2.2) on the away side.
// Protect a generous box around entrance + building so gates, signs and forecourts stay clear.
export const PLACE_ZONE_PADS = {
  central_market: [20, 16], suya_spot: [14, 12], central_mosque: [16, 16],
  kawo_park: [16, 12], university: [24, 16], mall_cinema: [24, 16],
  hospital: [22, 16], bank: [16, 14], stadium: [20, 14], river_park: [14, 12],
  church: [16, 16], barber: [12, 12], nightclub: [14, 14], dealership: [24, 16],
  arena: [18, 14], kasu: [26, 14], zoo: [26, 12], carnival: [28, 16],
};
export function addPlaceEntranceZones(listPlacesFn) {
  try {
    for (const def of listPlacesFn()) {
      if (def.entranceX == null || def.entranceZ == null) continue;
      const pad = PLACE_ZONE_PADS[def.id] || [18, 14];
      addZone(def.entranceX - pad[0], def.entranceZ - pad[1], def.entranceX + pad[0], def.entranceZ + pad[1], "place_" + def.id);
    }
  } catch (e) { console.warn("[protectedZones] place zones skipped:", e && e.message); }
}

// ---- 5. District plot grids (areas_world.js builds houses + roads + landmark there) ----
// Plots span ~±40 around the area centre + compound walls + ring road + landmark → ±64 is safe.
for (const a of AREAS) addZone(a.x - 64, a.z - 64, a.x + 64, a.z + 64, "district_" + a.id);

// ---- 6. Travel / ride / map landing points (player teleports here — must stay walkable) ----
for (const loc of MAP_LOCATIONS) addCircle(loc.x, loc.z, 9, "maploc_" + loc.name);

// ---- 7. Scenery keep-clear: airport (east), hills + lake landings ----
// scenery.js keeps |x-640|<220 open for the airport; we respect the approach from x≥560.
addZone(560, -330, 1e5, 330, "airport_zone");
for (const s of SCENERY_LABELS) {
  if (s.land) addCircle(s.land.x, s.land.z, 14, "scenery_" + s.id);
}
addCircle(AIRPORT.x, AIRPORT.z, 30, "airport_terminal");

// ---- 8. Money-hunt spots (fixed world coordinates) ----
for (const s of MONEY_SPOTS) addCircle(s.x, s.z, 7, "moneyspot_" + s.id);

// ---- 9. Road-event anchors ----
for (const [ex, ez] of [[0, 0], [0, 100], [100, 0], [-80, 60], [60, -50]]) {
  addCircle(ex, ez, 11, "road_event");
}

// ---- Query helpers ----

// True if the rectangle [x0..x1]×[z0..z1] overlaps ANY protected zone. Returns the tag or null.
export function hitsProtectedZone(x0, z0, x1, z1) {
  for (const z of zones) {
    if (x0 < z.x1 && x1 > z.x0 && z0 < z.z1 && z1 > z.z0) return z.tag;
  }
  return null;
}

// True if a circle (point + radius) touches any protected zone.
export function hitsProtectedCircle(x, z, r) {
  return hitsProtectedZone(x - r, z - r, x + r, z + r);
}

// How many zones are registered (for the boot log).
export function protectedZoneCount() { return zones.length; }

// Test-only: let tools / the console inspect the registry.
export function listProtectedZones() { return zones.map((z) => ({ ...z })); }
