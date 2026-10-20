// src/dealership_catalog.js — Kaduna Motors luxury car catalog
//
// Premium cars adapted to Kaduna setting. Prices in naira (₦) reflect real
// Nigerian luxury car prices (Lexus RX ~₦35M, G-Wagon ~₦120M, etc).
//
// Each entry uses an EXISTING simplified vehicle body type as a visual
// fallback (since we don't have GLB models for these specific brands).
// The body type + colour is chosen to evoke the real car's silhouette.
//
// `bodyType` references the builders in vehicles.js `_buildSimplifiedTypes`
// (sedan, hatch, suv, sports, luxury, bus). `bodyColor` is a hex int.
//
// Wire-up: imported by src/places/dealership.js to know which cars to put
// on display pedestals in the showroom. Buying flow calls the existing
// `buyVehicle()` from vehicles.js with the catalog `id` — but since these
// cars aren't in VEHICLE_CATALOG, we extend it at runtime via the
// `extendCatalog()` helper below.

export const DEALERSHIP_CATALOG = [
  {
    id: "lexus_rx",
    name: "Lexus RX 350",
    type: "Luxury Family SUV",
    emoji: "🚙",
    price: 35000000,         // ₦35M
    lease: 1500000,           // ₦1.5M/month
    specs: { engine: "3.5L V6 Hybrid", seats: 5, topSpeed: "200 km/h", range: "880 km" },
    desc: "The official car of Nigerian big boys. Smooth ride, hybrid fuel economy, plenty space for the family.",
    bodyType: "suv",
    bodyColor: 0x1a1a1a,      // black
    accentColor: 0xc0c0c0,
    speed: 5.5,               // ride speed if bought
    glbPath: null,            // no GLB → uses simplified body
  },
  {
    id: "toyota_corolla",
    name: "Toyota Corolla",
    type: "City Sedan",
    emoji: "🚗",
    price: 12000000,          // ₦12M
    lease: 550000,
    specs: { engine: "1.8L I4", seats: 5, topSpeed: "180 km/h", range: "650 km" },
    desc: "Reliable daily driver. The car every Nigerian uncle recommends. Cheap parts, lasts forever.",
    bodyType: "sedan",
    bodyColor: 0xf0f0e8,      // white
    accentColor: 0x1d5fa8,
    speed: 5.0,
  },
  {
    id: "tesla_model_x",
    name: "Tesla Model X",
    type: "Electric Luxury SUV",
    emoji: "⚡",
    price: 75000000,          // ₦75M
    lease: 3500000,
    specs: { engine: "Dual Motor Electric", seats: 7, topSpeed: "250 km/h", range: "560 km" },
    desc: "Falcon-wing doors. Silent ride. Big flex for Abuja-tech boys. NEPA cannot worry you.",
    bodyType: "suv",
    bodyColor: 0x2a3a5a,      // dark blue
    accentColor: 0x4af0ff,
    speed: 7.5,
  },
  {
    id: "gwagon",
    name: "Mercedes G-Wagon",
    type: "Luxury Off-Road",
    emoji: "🚙",
    price: 120000000,         // ₦120M
    lease: 5000000,
    specs: { engine: "4.0L V8 Biturbo", seats: 5, topSpeed: "220 km/h", range: "700 km" },
    desc: "The biggest flex in Kaduna. Box shape, loud exhaust, every head turns. Owned by senators and Alhajis.",
    bodyType: "suv",
    bodyColor: 0x0a0a0a,      // matte black
    accentColor: 0xc0c0c0,
    speed: 6.0,
  },
  {
    id: "range_rover",
    name: "Range Rover Autobiography",
    type: "VIP Luxury SUV",
    emoji: "🚙",
    price: 95000000,          // ₦95M
    lease: 4200000,
    specs: { engine: "4.4L V8", seats: 5, topSpeed: "240 km/h", range: "720 km" },
    desc: "The car politicians use for campaigns. Quiet cabin, air suspension, plenty ground clearance for village visits.",
    bodyType: "suv",
    bodyColor: 0x2e7d4f,      // green
    accentColor: 0xc0c0c0,
    speed: 6.0,
  },
  {
    id: "porsche_911",
    name: "Porsche 911 Carrera",
    type: "Sports Car",
    emoji: "🏎️",
    price: 110000000,         // ₦110M
    lease: 4800000,
    specs: { engine: "3.0L Twin-Turbo Flat-6", seats: 4, topSpeed: "293 km/h", range: "550 km" },
    desc: "Track-bred sports car. Loud, fast, attention-seeking. Not for the shy. Brake pads are ₦800k.",
    bodyType: "sports",
    bodyColor: 0xe11d48,      // red
    accentColor: 0x1a1a1a,
    speed: 8.0,
  },
];

// Merge the dealership catalog into VEHICLE_CATALOG at runtime so the
// existing buyVehicle()/getVehicle()/getOwned() functions find these cars.
// Called once from main.js on startup. Safe to call multiple times — uses
// a Set to track which IDs we've already added.
let _extended = new Set();
export function extendCatalog(existingCatalog, existingGetVehicle) {
  if (!existingCatalog || !Array.isArray(existingCatalog)) return;
  for (const car of DEALERSHIP_CATALOG) {
    if (_extended.has(car.id)) continue;
    // Don't add if it would conflict with an existing vehicle id
    if (existingGetVehicle && existingGetVehicle(car.id)) continue;
    existingCatalog.push({
      id: car.id,
      name: car.name,
      emoji: car.emoji,
      price: car.price,
      speed: car.speed,
      desc: car.desc,
      // No glbPath/fit/seat → buyVehicle + spawnRideVehicle fall back to
      // the simplified box-geometry builders in _buildSimplifiedTypes.
    });
    _extended.add(car.id);
  }
}

// Get a dealership car by ID (for the showroom + UI)
export function getDealershipCar(id) {
  return DEALERSHIP_CATALOG.find(c => c.id === id);
}

// All cars on display in the showroom (in the order they'll appear on the floor)
export function getShowroomCars() {
  // Pick 4 diverse cars for the showroom floor: one SUV, one city, one electric, one sports
  return [
    getDealershipCar("toyota_corolla"),
    getDealershipCar("lexus_rx"),
    getDealershipCar("tesla_model_x"),
    getDealershipCar("gwagon"),
  ];
}
