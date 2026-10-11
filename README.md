# Kaduna Lifestyle — Place System (Phase 1 + first 3 places)

A 3D multiplayer life-sim of Kaduna, Nigeria. Built with Vite + Three.js + Firebase.

## Run
```
npm install
npm run dev      # local dev
npm run build    # outputs dist/  (Vercel: Framework = Vite, build = npm run build, output = dist)
```

## What works now
- **Main world**: Ahmadu Bello Way — 2 lanes each way, median, sidewalks, zebra crossings, lamp posts (real PointLights at night), bus stops, billboards, 2 side streets
- **Buildings**: merged mesh with window texture + vertex colours; Central Mosque exterior, market stalls, petrol station, keke park
- **Traffic**: 36 vehicles (sedan, hatch, SUV, bus, keke) on 4 lanes, deterministic from `Date.now()` so every player sees the same cars with zero network cost
- **Characters**: real GLB humanoid models with bone animation (player, NPCs, multiplayer avatars)
- **Mobile controls**: thumb joystick, Walk/Jog toggle, drag-orbit camera, pinch zoom, Fit, hide-UI
- **Day/night cycle**: 1 real minute = 1 game hour. `?t=21` forces an hour for testing. Street lamps switch on at night.
- **Multiplayer**: real-time presence via Firebase RTDB, colored name tags
- **HUD**: needs bars (6), money, rank, phone button, online count
- **Phone super-app**: 15 apps (Chop, Hustle, Bank, Ride, Chat, Map, Daily, Health, Rich List, Profile, Events, Gist, Boutique, Contacts, Settings)
- **Auth**: Guest, Google, Email/Password, Admin Quick Login
- **Admin dashboard**: 8 tabs (Overview, Players, Economy, Live, Chat, Announce, Events, Analytics), locked to admin UID

## NEW in Phase 1 — Place System
- **`src/places/registry.js`**: place registry. Each place has id, name, world position, entrance position, type (interior/outdoor), opening hours, ambient sound, NPC list, activities, minimap icon, and the module that builds it.
- **`src/places/manager.js`**: orchestrates enter/exit. Walk into an entrance trigger → press **E** → fade to black → place scene loads → fade in. Press **E** again to leave. World is hidden while inside.
- **Lazy loading**: each place is its own ES module under `src/places/<name>.js`, loaded with dynamic `import()`. Memory is freed on dispose.
- **Travel system**: phone → Ride app → pick destination (any registered place or legacy zone) → pick mode (walk free, keke ₦300, bus ₦200, okada ₦500, taxi ₦1500) → loading screen → arrive at entrance.
- **Minimap**: place entrances shown as colored circles.

## NEW in Phase 2 — First 3 Places
Each place has its own layout, props, palette, lighting, and activities. No templates reused.

### 1. Kaduna Central Market (`src/places/central_market.js`)
- **Layout**: 60×40m packed-earth floor, concrete walkway down the middle, 4 rows of stalls under tarpaulin roofs (alternating red, yellow, blue, green)
- **Hand-built props**: wooden tables, fabric rolls (6 colors), hanging fabric, spice bowls (pepper, curry, nutmeg, turmeric), sewing machine + mannequin, black food pots (tuwo, jollof, stew), woven baskets with tomatoes/peppers
- **Activities**: Haggle for fabric (mini-game: Mama Nkechi asks a price, you counter), buy spices, tailor an outfit, eat at food corner
- **Lighting**: warm market ambiance, 6 point lights under the tarps
- **Signage**: red "KADUNA CENTRAL MARKET" sign at the north wall, "FABRIC / SPICES / TAILOR / FOOD" signs above each stall

### 2. Mai Suya Spot (`src/places/suya_spot.js`)
- **Layout**: 40×30m open-air courtyard, packed earth with concrete pavers around the grill, low fence around the perimeter
- **Hand-built props**: brick charcoal grill with metal grate, glowing embers (18 emissive spheres), 6 suya skewers with meat chunks, **smoke particle system** (24 particles rising and fading), 4 wooden benches, 6 white plastic chairs, jerry-can table with knife and cutting board
- **Activities**: order beef/chicken/ram suya (restores hunger + fun), buy zobo, gist with the boys
- **Lighting**: warm orange glow from the grill, string lights (56 bulbs zig-zagging between 4 posts), 5 point lights
- **Signage**: dark red "MAI SUYA AUDU" sign with gold text
- **Hours**: opens 4 PM, closes midnight (game time)

### 3. Central Mosque Interior (`src/places/central_mosque.js`)
- **Layout**: 40×30m prayer hall, deep green carpet with 8 rows of prayer mats (12 mats per row, each with a mihrab marker), qibla wall with mihrab niche, minbar (pulpit) to the right
- **Hand-built props**: 8 columns with capitals, dome ceiling, stained-glass-style windows (4 colors), 5 chandeliers (gold rings with hanging chains), shoe rack at the entrance with 6 pairs of shoes, calligraphy panel (۞ in gold on green)
- **Activities**: pray (restores mood +25, hygiene +15, social +8), listen to adhan at salat times (Fajr 5:30, Zuhr 13:00, Asr 16:00, Maghrib 18:30, Isha 20:00), read Quran
- **Dress check**: Mallam Garba the guard advises players to dress modestly
- **Lighting**: warm calm ambiance, 5 chandelier point lights + mihrab glow
- **Signage**: green "CENTRAL MOSQUE — PRAYER HALL" sign with gold text

## File map
### Existing (unchanged architecture)
- `src/config.js` constants: lanes, crossings, tips, seeded RNG, needs, food, jobs, ranks, zones, rides, map locations, daily quests/rewards
- `src/world.js` ground, road, buildings, trees, lamps (real PointLights), bus stops, billboards, **NEW: place entrance markers**
- `src/traffic.js` vehicle builders + deterministic lane traffic
- `src/player.js` GLB loader, bone animation, collision
- `src/controls.js` joystick, orbit camera, camera collision
- `src/minimap.js` pre-baked top-down map, **NEW: place markers as colored circles**
- `src/characters.js` character factory (every NPC/player uses the same male.glb with different clothes)
- `src/npcs.js` AI pedestrians (real GLB models)
- `src/multiplayer.js` real-time presence + chat (real GLB avatars)
- `src/needs.js` needs system, money, rank, phone apps
- `src/auth.js` Firebase Auth (Guest/Google/Email + Admin Quick Login)
- `src/admin.js` admin dashboard (8 tabs, locked to admin UID)
- `src/daily.js` daily login rewards + quests
- `src/economy.js` money transactions + rich list
- `src/travel.js` **REWRITTEN**: now uses place registry for destinations; 5 ride modes (walk/keke/bus/okada/taxi)
- `src/main.js` renderer, lights, day/night, HUD, main loop, **NEW: place manager wiring, E-key binding, place action bar**

### New in this phase
- `src/places/registry.js` — place registry (lazy loading, open-hours check, enterable-places query)
- `src/places/manager.js` — enter/exit orchestrator with fade transitions and entrance prompts
- `src/places/_helpers.js` — shared low-level helpers (box, mergedMesh, signMesh, floor, interiorLights, smokeSystem, stripLight, disposeGroup)
- `src/places/central_market.js` — Central Market interior (4 rows of stalls, haggling mini-game)
- `src/places/suya_spot.js` — Mai Suya Spot (charcoal grill, smoke, string lights, order food)
- `src/places/central_mosque.js` — Central Mosque interior (prayer hall, dress check, salat times)

## How to test
1. `npm run dev` → open browser
2. Walk to the **Central Mosque** entrance (east side of the map, at x=48, z=23) — you'll see a glowing green pad with a sign. Walk onto the pad → press **E** → fade → you're inside the prayer hall.
3. Inside: walk around, see the mihrab, minbar, columns, chandeliers. Press the **Pray** button in the action bar (bottom center) → mood and hygiene go up.
4. Press **E** again → fade → you're back outside at the entrance.
5. Repeat for **Central Market** (red pad, x=-28, z=-22) and **Mai Suya Spot** (orange pad, x=-53, z=20).
6. Open the **phone → Ride app** → pick a destination from the dropdown → pick a ride mode → watch the loading screen → arrive at the entrance.
7. Open the **phone → Map app** → see all 3 places listed with open/closed badges → tap one → ride app opens with it preselected.
8. Test the haggling mini-game: enter Central Market → press **Haggle for fabric** in the action bar → enter an offer → see Mama Nkechi's response.
9. Test the suya order: enter Mai Suya Spot → press **Order suya** → pick beef/chicken/ram → hunger goes up.
10. Night test: visit between 7 PM and 6 AM game time → street lamps are on, market and mosque glow warmly.

## Configuration
- **Firebase**: no new env vars. The existing `src/firebase.js` config is used. Place state is not yet synced to Firebase (players see each other's world position only; "which place am I in" comes in Phase 5).
- **Vercel**: no changes. `npm run build` → `dist/`.
- **No secrets in code**: all Firebase config is in `src/firebase.js` (already public client config). Admin UID is hardcoded in `src/admin.js` — this is fine because admin actions are also gated by Firebase security rules (set `admins/{uid}=true` in RTDB).

## Bundle size
- **Before Phase 1**: ~1.05 MB gzipped (~260 KB)
- **After Phase 1 + 3 places**: ~1.15 MB gzipped (~285 KB) — places are lazy-loaded so they don't add to the initial bundle, but the registry + manager add ~15 KB.

## Still rough
1. **Place interiors have no NPCs yet** — the NPC list is in the registry but the place modules don't spawn them. Coming in Phase 2 batch 2.
2. **No ambient sound** — the `ambientSound` field is in the registry but no audio system is wired. Coming in Phase 6.
3. **Haggling mini-game is a `prompt()`** — works on desktop, awkward on mobile. Will be replaced with a proper UI in Phase 2 batch 2.
4. **Dress check at the mosque is a toast warning only** — doesn't actually block entry. Will be enforced in Phase 3 when the character creator exists.
5. **Place state is not synced to multiplayer** — other players see your world position but not which place you're inside. Coming in Phase 5.
6. **Place modules don't dispose of textures** — `disposeGroup()` is called but CanvasTextures from signs may leak. Will be fixed in Phase 6 polish.
7. **No entrance pad glow at night** — the pads are MeshBasicMaterial so they're visible, but no emissive animation. Coming in Phase 6.
8. **Travel still uses the old loading screen** — works fine, but the "tips" are generic. Will be context-aware (e.g. "Mind the keke drivers") in Phase 2 batch 2.

## Roadmap (what's next)
- **Phase 2 batch 2**: Kawo motor park, university campus, mall/cinema (3 more unique places)
- **Phase 3**: Life systems — money, needs, jobs, daily quests, homes, character creator, weather/seasons
- **Phase 4**: Accounts and saving (Firestore + security rules)
- **Phase 5**: Multiplayer and social (proximity chat, friends, crews, leaderboards)
- **Phase 6**: Sound and polish (ambient audio, settings, tutorial)
- **Phase 7**: Website and product (landing page, PWA, privacy policy)
- **Phase 8**: Admin and live-ops (already partially built; needs server-side enforcement)

## Credits
- Kenney city models (CC0) — `public/models/city/`
- Mixamo character rig — `public/models/male.glb`
- All place art is procedurally generated from Three.js primitives (no external assets)
