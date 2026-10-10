# Kaduna Lifestyle — 3D foundation (v0.1)

A clean Vite + Three.js base for a Kaduna multiplayer life-sim. One zone: **Ahmadu Bello Way**.

## Run
```
npm install
npm run dev      # local
npm run build    # outputs dist/  (Vercel: Framework = Vite, build = npm run build, output = dist)
```

## What works now
- Main road: 2 lanes each way, median with palms, kerbs, sidewalks, zebra crossings (x = -80, 0, 80), lamp posts, bus stops, billboards, 2 side streets
- Buildings (one merged mesh with window texture + vertex colours) and a Central Mosque landmark
- **Traffic**: 36 vehicles (sedan, hatch, SUV, bus, yellow keke) on 4 lanes, InstancedMesh, *deterministic* from `Date.now()` so every player sees the same cars with zero network cost
- Thumb joystick (camera-relative), Walk/Jog toggle, drag to orbit, pinch / +/- zoom, Fit (re-centre), eye (hide UI)
- Camera never goes inside buildings (ray vs box check)
- Mixamo character (`public/models/male.glb`) with hand-posed walk animation (outermost-bone trick, see `src/player.js`)
- Mini-map (rotates with camera, shows buildings, trees, cars), clock chip, day/night cycle (1 real minute = 1 game hour). `?t=21` forces an hour for testing.
- Loading screen with real percent + Kaduna tips

## File map
- `src/config.js` constants: lanes, crossings, tips, seeded RNG
- `src/world.js` ground, road, buildings, trees, lamps, signs, mosque
- `src/traffic.js` vehicle builders + deterministic lane traffic
- `src/player.js` GLB loader, bone animation, collision
- `src/controls.js` joystick, orbit camera, camera collision
- `src/minimap.js` pre-baked top-down map
- `src/main.js` renderer, lights, day/night, HUD wiring, main loop

## Not built yet (on purpose)
Multiplayer/presence, chat, accounts, money/needs/jobs, interiors, weather, sound, real 3D art. See the roadmap prompt.
