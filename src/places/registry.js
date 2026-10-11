// src/places/registry.js
// The Place Registry — every place in Kaduna Lifestyle is declared here.
// Each place is its own module under src/places/<name>.js and is loaded
// lazily (dynamic import) so the base game stays small.
//
// Place shape:
//   id           string   unique slug
//   name         string   display name (e.g. "Central Market")
//   type         "interior" | "outdoor"
//   worldX, worldZ  number  position on the main world (for entrance trigger + minimap)
//   entranceX, entranceZ  number  where the player should stand to enter
//   entranceFacing number  yaw the player should face when they exit back out
//   minimapIcon  string   emoji used on the phone map + minimap
//   minimapColor hex
//   hours        { open: 0-24, close: 0-24 } | null   null = always open
//   ambientSound string | null   key into the sound registry (Phase 6)
//   npcList      Array<{ id, name, outfit, role }>
//   activities   Array<{ id, label, desc }>
//   module       string   dynamic-import path (e.g. "./central_market.js")
//   build        async (scene, ctx) => PlaceHandle  (injected by registry after first load)

const PLACE_DEFS = [
  {
    id: "central_market",
    name: "Kaduna Central Market",
    type: "interior",
    worldX: -30, worldZ: -25,
    entranceX: -28, entranceZ: -22,
    entranceFacing: Math.PI, // facing south, looking back at road
    minimapIcon: "🛒",
    minimapColor: 0xc0392b,
    hours: { open: 7, close: 20 },
    ambientSound: "market",
    npcList: [
      { id: "trader1", name: "Mama Nkechi", outfit: "ankara", role: "fabric seller" },
      { id: "trader2", name: "Alhaji Sani", outfit: "kaftan", role: "spice trader" },
      { id: "trader3", name: "Aunty Bisi", outfit: "ankara", role: "tailor" },
      { id: "trader4", name: "Mallam Yusuf", outfit: "kaftan", role: "vegetable seller" },
      { id: "trader5", name: "Iya Basira", outfit: "ankara", role: "food corner" },
    ],
    activities: [
      { id: "haggle", label: "Haggle for fabric", desc: "Try to get the best price from Mama Nkechi" },
      { id: "buy_spices", label: "Buy spices", desc: "Stock up on dried pepper and curry" },
      { id: "tailor", label: "Tailor an outfit", desc: "Get measured by Aunty Bisi" },
      { id: "eat", label: "Eat at food corner", desc: "Hot tuwo and miyan kuka from Iya Basira" },
    ],
    module: "./central_market.js",
  },
  {
    id: "suya_spot",
    name: "Mai Suya Spot",
    type: "outdoor",
    worldX: -55, worldZ: 22,
    entranceX: -53, entranceZ: 20,
    entranceFacing: 0,
    minimapIcon: "🍢",
    minimapColor: 0xd98e2b,
    hours: { open: 16, close: 24 }, // evening spot
    ambientSound: "street",
    npcList: [
      { id: "suya1", name: "Mallam Audu", outfit: "kaftan", role: "suya seller" },
      { id: "boy1", name: "Yaro", outfit: "casual", role: "errand boy" },
    ],
    activities: [
      { id: "order_suya", label: "Order suya", desc: "Beef or chicken suya with yaji pepper" },
      { id: "drink_zobo", label: "Buy zobo", desc: "Chilled zobo with cucumber" },
      { id: "chat", label: "Gist with the boys", desc: "Talk football and politics" },
    ],
    module: "./suya_spot.js",
  },
  {
    id: "central_mosque",
    name: "Central Mosque",
    type: "interior",
    worldX: 48, worldZ: 34,
    entranceX: 48, entranceZ: 23,
    entranceFacing: Math.PI,
    minimapIcon: "🕌",
    minimapColor: 0x1f7a5a,
    hours: null, // always open
    ambientSound: "mosque",
    npcList: [
      { id: "imam", name: "Imam Ibrahim", outfit: "kaftan", role: "Imam" },
      { id: "guard1", name: "Mallam Garba", outfit: "kaftan", role: "entrance guard" },
    ],
    activities: [
      { id: "pray", label: "Pray", desc: "Restore mood and hygiene" },
      { id: "listen_adhan", label: "Listen to adhan", desc: "Call to prayer at salat times" },
      { id: "read_quran", label: "Read Quran", desc: "Quiet reflection" },
    ],
    module: "./central_mosque.js",
  },
];

// ---- registry runtime state ----
const _loaded = new Map(); // id -> { def, moduleExports, instance }
const _listeners = new Set();

export function listPlaces() {
  return PLACE_DEFS.map((d) => ({ ...d }));
}

export function getPlace(id) {
  return PLACE_DEFS.find((p) => p.id === id) || null;
}

export function findPlaceAtPosition(x, z, radius = 6) {
  // Returns the place def whose entrance is within `radius` metres of (x, z)
  for (const def of PLACE_DEFS) {
    const dx = def.entranceX - x, dz = def.entranceZ - z;
    if (dx * dx + dz * dz < radius * radius) return def;
  }
  return null;
}

export function isPlaceOpen(def, gameHour) {
  if (!def.hours) return true;
  // handle overnight close (e.g. open=16, close=24 → open 16:00-24:00)
  if (def.hours.open <= def.hours.close) {
    return gameHour >= def.hours.open && gameHour < def.hours.close;
  }
  return gameHour >= def.hours.open || gameHour < def.hours.close;
}

// Lazy-load a place module and call its build(). Returns the PlaceHandle.
// Cached: calling buildPlace() twice with the same id returns the cached instance.
export async function buildPlace(id, scene, ctx) {
  if (_loaded.has(id)) return _loaded.get(id).instance;
  const def = getPlace(id);
  if (!def) throw new Error("Unknown place: " + id);
  const mod = await import(/* @vite-ignore */ def.module);
  if (!mod.build || typeof mod.build !== "function") {
    throw new Error("Place module " + def.module + " must export build(scene, ctx)");
  }
  const instance = await mod.build(scene, ctx);
  _loaded.set(id, { def, moduleExports: mod, instance });
  _notify("built", id);
  return instance;
}

// Free the memory of a built place. The module may be re-imported later.
export async function disposePlace(id) {
  const entry = _loaded.get(id);
  if (!entry) return;
  if (entry.instance?.dispose) {
    try { await entry.instance.dispose(); } catch (e) { console.warn("dispose error", e); }
  }
  _loaded.delete(id);
  _notify("disposed", id);
}

export function getLoadedPlace(id) {
  return _loaded.has(id) ? _loaded.get(id).instance : null;
}

export function subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
function _notify(type, id) {
  for (const fn of _listeners) {
    try { fn({ type, id }); } catch (_) {}
  }
}

// Helper for UI: which places are currently enterable?
export function enterablePlaces(gameHour, playerX, playerZ, radius = 6) {
  const out = [];
  for (const def of PLACE_DEFS) {
    const dx = def.entranceX - playerX, dz = def.entranceZ - playerZ;
    const inRange = dx * dx + dz * dz < radius * radius;
    if (!inRange) continue;
    const open = isPlaceOpen(def, gameHour);
    out.push({ ...def, open });
  }
  return out;
}
