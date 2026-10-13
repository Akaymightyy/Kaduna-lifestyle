// src/flavour.js — Phase 9: Daily weather + funny street headlines that affect gameplay.
//
// Weather changes daily (deterministic by date). Each weather has gameplay effects:
//   sunny    → normal
//   rainy    → rides cost 30% more (traffic), hygiene drains slower
//   harmattan → hygiene drains 2x faster (dust)
//   hot      → energy drains 1.3x faster, fun drains 1.2x
//   cool     → energy drains slower (0.8x)
//
// Headlines are funny Nigerian-style news that sometimes affect gameplay.
// A new headline appears every 2-4 hours (real time).

// ---- Weather ----
export const WEATHERS = [
  { id: "sunny",     label: "Sunny",      icon: "☀️", desc: "Clear skies, normal weather",     mods: {} },
  { id: "rainy",     label: "Rainy",      icon: "🌧️", desc: "Rain dey fall. Rides cost more.", mods: { rideMul: 1.3, hygieneMul: 0.7 } },
  { id: "harmattan", label: "Harmattan",  icon: "🌫️", desc: "Dust dey everywhere. Hygiene drops faster.", mods: { hygieneMul: 2.0 } },
  { id: "hot",       label: "Hot",        icon: "🥵", desc: "Sun dey hot. Energy drains faster.", mods: { energyMul: 1.3, funMul: 1.2 } },
  { id: "cool",      label: "Cool",       icon: "🌤️", desc: "Cool breeze. Energy lasts longer.", mods: { energyMul: 0.8 } },
];

// ---- Headlines ----
// Some headlines have effects (effect field). They trigger when shown.
export const HEADLINES = [
  { id: "fuel_scarcity",  text: "⛽ Fuel scarcity hits Kaduna! Keke drivers dey charge double.", effect: { rideMul: 2.0 }, duration: 2 * 60 * 60 * 1000 },
  { id: "market_flood",   text: "🌊 River Kaduna overflow! Market prices don go up.", effect: { foodMul: 1.3 }, duration: 2 * 60 * 60 * 1000 },
  { id: "owambe_season",  text: "🎉 Owambe season! Everybody dey happy, fun drains slower.", effect: { funMul: 0.6 }, duration: 3 * 60 * 60 * 1000 },
  { id: "nepa_wahala",    text: "🔌 NEPA don do am again! Light go dey off and on today.", effect: { nepaMul: 1.5 }, duration: 4 * 60 * 60 * 1000 },
  { id: "free_suya",      text: "🍢 Suya seller dey do promo! Free suya for early birds.", effect: { foodDiscount: 200 }, duration: 1 * 60 * 60 * 1000 },
  { id: "traffic_jam",    text: "🚗 Traffic jam for Ahmadu Bello Way! Rides dey slow.", effect: { rideTimeMul: 1.5 }, duration: 2 * 60 * 60 * 1000 },
  { id: "harmattan_dust", text: "🌫️ Harmattan don show! Dust dey everywhere, cover your nose.", effect: { hygieneMul: 2.0 }, duration: 6 * 60 * 60 * 1000 },
  { id: "football_win",   text: "⚽ Kaduna United don win! Mood don high for town.", effect: { funMul: 0.5 }, duration: 4 * 60 * 60 * 1000 },
  { id: "tax_season",     text: "💸 Tax season don come. 5% off all earnings today.", effect: { payMul: 0.95 }, duration: 24 * 60 * 60 * 1000 },
  { id: "giveaway",       text: "🎁 Unknown billionaire dey dash money for Twitter. Check money hunt!", effect: { huntBonus: 1.5 }, duration: 2 * 60 * 60 * 1000 },
];

let _currentWeather = WEATHERS[0];
let _activeHeadlines = [];  // [{ id, text, effect, expires }]
let _onUpdate = null;

// Get today's weather (deterministic by date)
export function getTodayWeather() {
  const today = new Date().toISOString().slice(0, 10);
  let h = 2166136261;
  for (let i = 0; i < today.length; i++) { h ^= today.charCodeAt(i); h = Math.imul(h, 16777619); }
  const idx = ((h ^ (h >>> 16)) >>> 0) % WEATHERS.length;
  _currentWeather = WEATHERS[idx];
  return _currentWeather;
}

export function getCurrentWeather() { return _currentWeather; }

// ---- Headlines ----
let _nextHeadlineCheck = 0;
const HEADLINE_MIN_INTERVAL = 2 * 60 * 60 * 1000;  // 2 hours
const HEADLINE_MAX_INTERVAL = 4 * 60 * 60 * 1000;  // 4 hours

export function tickHeadlines() {
  const now = Date.now();
  // Expire old headlines
  _activeHeadlines = _activeHeadlines.filter(h => h.expires > now);
  // Check if it's time for a new headline
  if (now >= _nextHeadlineCheck) {
    const pick = HEADLINES[Math.floor(Math.random() * HEADLINES.length)];
    // Don't re-add if already active
    if (!_activeHeadlines.find(h => h.id === pick.id)) {
      _activeHeadlines.push({ ...pick, expires: now + pick.duration });
      _nextHeadlineCheck = now + HEADLINE_MIN_INTERVAL + Math.random() * (HEADLINE_MAX_INTERVAL - HEADLINE_MIN_INTERVAL);
      _onUpdate?.();
      return pick;  // return the new headline so main.js can toast it
    }
  }
  return null;
}

export function getActiveHeadlines() { return _activeHeadlines; }

// Get combined effect modifiers (weather + all active headlines)
export function getCombinedModifiers() {
  const mods = { ...(_currentWeather.mods || {}) };
  for (const h of _activeHeadlines) {
    if (h.effect) {
      for (const [k, v] of Object.entries(h.effect)) {
        // For multipliers, multiply them together; for fixed values, take the latest
        if (k.endsWith("Mul")) {
          mods[k] = (mods[k] || 1) * v;
        } else {
          mods[k] = v;
        }
      }
    }
  }
  return mods;
}

export function initFlavour(onUpdate) {
  _onUpdate = onUpdate;
  getTodayWeather();
  _nextHeadlineCheck = Date.now() + 5 * 60 * 1000;  // first headline after 5 min
}
