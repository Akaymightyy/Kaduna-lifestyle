#!/usr/bin/env node
// tools/osm-to-kaduna.mjs
// Fetches OpenStreetMap data for Kaduna city centre from the Overpass API,
// converts it to local metres, simplifies, and outputs public/data/kaduna.json.
//
// Usage: node tools/osm-to-kaduna.mjs
//
// You need internet access to run this. The game itself never calls Overpass.
// Data © OpenStreetMap contributors (ODbL) — add that credit to CREDITS.md.

import { writeFileSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUTPUT = resolve(ROOT, "public/data/kaduna.json");

// Bounding box for Kaduna city centre (lat/lon)
const BBOX = { south: 10.48, west: 7.40, north: 10.56, east: 7.48 };
const CENTER_LAT = (BBOX.south + BBOX.north) / 2;
const CENTER_LON = (BBOX.west + BBOX.east) / 2;

// Equirectangular projection: lon/lat → local metres
// 1 degree latitude ≈ 111000 m, 1 degree longitude ≈ 111000 * cos(lat) m
const LAT_M = 111000;
const LON_M = 111000 * Math.cos(CENTER_LAT * Math.PI / 180);

function lonLatToXY(lon, lat) {
  const x = (lon - CENTER_LON) * LON_M;  // +x = east
  const z = -(lat - CENTER_LAT) * LAT_M; // +z = south (north = negative z)
  return [x, z];
}

// Douglas-Peucker polyline simplification (2m tolerance)
function simplify(points, tolerance = 2) {
  if (points.length < 3) return points;
  const sqTol = tolerance * tolerance;
  const getSqDist = (p, a, b) => {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = dx === 0 && dz === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz);
    const tt = Math.max(0, Math.min(1, t));
    const px = a[0] + tt * dx, pz = a[1] + tt * dz;
    return (p[0] - px) ** 2 + (p[1] - pz) ** 2;
  };
  function dp(pts, first, last, out) {
    let maxDist = 0, index = 0;
    for (let i = first + 1; i < last; i++) {
      const d = getSqDist(pts[i], pts[first], pts[last]);
      if (d > maxDist) { index = i; maxDist = d; }
    }
    if (maxDist > sqTol) {
      if (index - first > 1) dp(pts, first, index, out);
      out.push(pts[index]);
      if (last - index > 1) dp(pts, index, last, out);
    }
  }
  const out = [points[0]];
  dp(points, 0, points.length - 1, out);
  out.push(points[points.length - 1]);
  return out;
}

async function fetchOverpass() {
  const query = `[out:json][timeout:60];(
    way["highway"~"^(primary|secondary|tertiary|residential)$"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
    way["building"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
    way["natural"="water"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
    way["waterway"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
    node["amenity"~"place_of_worship|hospital|school|university|bank"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
    way["leisure"~"park|pitch|stadium"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  );out geom 3000;`;
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  for (const url of endpoints) {
    try {
      console.log(`Fetching from ${url}...`);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
      });
      if (!res.ok) { console.warn(`  HTTP ${res.status}`); continue; }
      const data = await res.json();
      console.log(`  Got ${data.elements?.length || 0} elements`);
      return data;
    } catch (e) {
      console.warn(`  Failed: ${e.message}`);
    }
  }
  throw new Error("All Overpass endpoints failed. Run this script when you have internet access.");
}

function processOSM(data) {
  const roads = [], buildings = [], water = [], landmarks = [];
  const seenBuildings = new Set();

  for (const el of data.elements || []) {
    if (el.type === "way" && el.geometry) {
      const pts = el.geometry.map(g => lonLatToXY(g.lon, g.lat));
      const tags = el.tags || {};
      if (tags.highway) {
        const simplified = simplify(pts, 2);
        const width = tags.highway === "primary" ? 16 : tags.highway === "secondary" ? 12 : tags.highway === "tertiary" ? 8 : 6;
        roads.push({ type: tags.highway, name: tags.name || "", width, points: simplified });
      }
      if (tags.building && el.geometry.length >= 3) {
        // Bounding box of the polygon
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (const [x, z] of pts) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        }
        const w = maxX - minX, d = maxZ - minZ;
        const area = w * d;
        if (area < 40 || area > 2000) continue; // filter tiny/huge
        const key = `${Math.round(minX)},${Math.round(minZ)}`;
        if (seenBuildings.has(key)) continue;
        seenBuildings.add(key);
        buildings.push({
          x: (minX + maxX) / 2, z: (minZ + maxZ) / 2,
          w: Math.max(6, w), d: Math.max(6, d), rot: 0,
          levels: Math.max(1, Math.min(5, Math.round(area / 100))),
          kind: "abcdefghijklmnopqrstu"[buildings.length % 21],
        });
      }
      if (tags.natural === "water" || tags.waterway) {
        water.push(pts);
      }
    }
    if (el.type === "node" && el.tags) {
      const [x, z] = lonLatToXY(el.lon, el.lat);
      const name = el.tags.name || "";
      if (name) {
        landmarks.push({ id: el.tags.amenity || el.tags.name || "landmark", name, x, z });
      }
    }
  }

  // Cap buildings at 600, nearest to origin
  buildings.sort((a, b) => (a.x * a.x + a.z * a.z) - (b.x * b.x + b.z * b.z));
  const cappedBuildings = buildings.slice(0, 600);

  return {
    _attribution: "© OpenStreetMap contributors (ODbL)",
    origin: { lat: CENTER_LAT, lon: CENTER_LON, name: "Kaduna city centre" },
    roads, buildings: cappedBuildings, water, landmarks,
  };
}

async function main() {
  console.log("Fetching OSM data for Kaduna city centre...");
  const osmData = await fetchOverpass();
  console.log("Processing...");
  const kaduna = processOSM(osmData);
  writeFileSync(OUTPUT, JSON.stringify(kaduna));
  console.log(`Written ${kaduna.roads.length} roads, ${kaduna.buildings.length} buildings, ${kaduna.water.length} water features, ${kaduna.landmarks.length} landmarks to ${OUTPUT}`);
  console.log("© OpenStreetMap contributors — add this to CREDITS.md");
}

main().catch(e => { console.error(e); process.exit(1); });
