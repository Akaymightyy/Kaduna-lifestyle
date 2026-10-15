# Kaduna Lifestyle — Car Dealership + Ride System (Oct 15 morning)

Buy cars, keke, okada, bicycles, SUVs, sports cars, luxury sedans.
Ride them to boost your speed. Dismount when you arrive.

> NOTE: `vite.config.js` was NOT touched (Claude's version stays).

## Build status
`npx vite build` -> built in 2.78s, 86 modules, no errors.

## WHAT'S INCLUDED

### `src/vehicles.js` (NEW, ~200 lines)

Full dealership + garage + ride system:

**Catalog (9 vehicles):**
| Vehicle | Price | Speed | Emoji |
|---------|-------|-------|-------|
| Bicycle | ₦8,000 | +3.0 | 🚲 |
| Okada (Motorcycle) | ₦15,000 | +5.5 | 🏍️ |
| Keke Napep | ₦25,000 | +4.0 | 🛺 |
| Hatchback | ₦55,000 | +5.0 | 🚙 |
| Sedan | ₦80,000 | +5.5 | 🚗 |
| Danfo Bus | ₦120,000 | +3.5 | 🚌 |
| SUV | ₦150,000 | +4.8 | 🚐 |
| Sports Car | ₦500,000 | +7.0 | 🏎️ |
| Luxury Sedan | ₦1,000,000 | +6.5 | 🚘 |

**Each vehicle has:**
- `id`, `name`, `emoji`, `price`, `speed` (boost in m/s), `desc`
- A simplified 3D mesh builder (body + wheels + windows, merged into
  one BufferGeometry with vertex colors)

**Functions:**
- `initVehicles(scene, uid, onUpdate)` — subscribes to `players/{uid}/vehicles`
  in Firebase (owned vehicles sync across devices)
- `buyVehicle(id, gameState, toast)` — deducts money, writes to Firebase
- `spawnRideVehicle(id, playerPos, heading)` — spawns the mesh at the
  player's position, sets `_riding = { vehicleId, speed, mesh }`
- `despawnRideVehicle()` — removes the mesh, clears `_riding`
- `tickRideVehicle(playerPos, heading)` — per-frame: mesh follows player
- `isRiding()`, `getRideSpeed()`, `getRideId()` — query state
- `getOwned()`, `ownsVehicle(id)` — query owned vehicles

### `src/main.js` (MODIFIED)

- **Import:** all vehicles.js exports
- **Phone grid:** new `{id:"cars", icon:"🚗", label:"Cars"}` app
- **App renderer:** full dealership + garage UI:
  - **Riding bar** (if riding): shows vehicle emoji + name + speed boost
    + 🛑 Dismount button
  - **Your Garage**: lists owned vehicles, each with a Ride button
  - **Dealership**: lists all 9 vehicles with prices + Buy buttons
- **Handlers:**
  - `window._buyVehicle(id)` → `buyVehicle()` → deducts money → Firebase
  - `window._rideVehicle(id)` → `spawnRideVehicle()` → close phone → toast
  - `window._dismountVehicle()` → `despawnRideVehicle()` → toast → reopen app
- **Speed boost in main loop:** `const vehicleBoost = isRiding() ? getRideSpeed() : 0;` added to `maxSpd`
- **`tickRideVehicle`** called per-frame after the rig update (vehicle mesh follows player position + heading)
- **`initVehicles(scene, user.uid, () => {})`** called in auth login handler

### `FIREBASE_RULES.json` (MODIFIED)
Added `vehicles` sub-path under `players.$uid`:
```json
"vehicles": {
  ".read": "auth.uid === $uid",
  ".write": "auth.uid === $uid"
}
```
Owner-only read/write. Other players can't see what vehicles you own
(they just see your ride mesh in the world).

## FILES IN THIS ZIP

```
src/vehicles.js            (NEW — catalog + buy/spawn/dismount/tick)
src/main.js                (MODIFIED — cars app + handlers + speed boost + tick + init)
FIREBASE_RULES.json        (MODIFIED — vehicles sub-path)
CAR-DEALERSHIP.md          (this file)
```

## TEST PLAN

1. Sign in. Open phone → Cars app (🚗 icon).
2. See the dealership list: 9 vehicles with prices.
3. Buy an Okada (₦15,000). Balance deducts. Garage shows it as "Owned ✅".
4. Tap "Ride" on the Okada. Phone closes. Toast: "🚗 Riding Okada!
   Speed boosted."
5. Walk around — you should be FASTER (speed boost +5.5 m/s).
6. A vehicle mesh should be visible at your position, following you.
7. Open phone → Cars → tap 🛑 Dismount. Speed returns to normal.
8. Buy a Sports Car (₦500,000) if you can afford it. Ride it → even faster.
9. Close tab. Sign in on another device. Your owned vehicles should be
   there (persisted in Firebase).

## NEXT STEPS

- More phone apps (Wallet, Quests, Tunes, Settings, Profile)
- FOR RENT / FOR SALE boards on empty plots
- Multiplayer: other players see your ride mesh

Say "next" when ready.
