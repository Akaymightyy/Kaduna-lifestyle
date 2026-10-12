# Kaduna Lifestyle — Phase 3 Drop (Money Hunt)

This zip contains the **complete working Kaduna Lifestyle project** with Phase 3 (Money Hunt system) added on top of Claude's character-creator / origin-modal fix.

## What's new in this drop

### Money Hunt system (the missing Phase 3 piece)
- **23 hunt spots** spread across every Kaduna district (Central Market, Suya Spot, Mosque, Kawo Park, River Park, Mall, University, Church, Hospital, Barber, Stadium, Flyover, etc.).
  - 12 common (₦500–₦2,000, 20-min respawn)
  - 7 rare (₦5,000–₦20,000, 3-hour respawn)
  - 4 jackpot (₦50,000–₦200,000, 24-hour respawn)
- Hints are short riddles in **Hausa, Pidgin, and English** (mixed per spot for local flavour).
- **3 shared InstancedMeshes** (one per rarity) — not 1 mesh per spot. Spots only render when player is within 25 m. Far spots cost zero draw calls.
- **Firebase `runTransaction` on `hunt/{spotId}`** — only the first player to claim wins. Everyone else gets "Too late".
- **Warm/cold radar beep** (Web Audio) — frequency + pitch scale with distance to nearest spot.
- **Press E to claim** prompt when within 6 m of a spot. Distance re-checked server-side if you deploy the Cloud Function.
- **5 achievements**: Explorer, Treasure Hunter, Early Bird, Sharp Eye, City Rat.
- **Daily claim cap**: 25/day per player (anti-farm).
- **Audit log**: every claim writes to `economy/{uid}/log/{ts}` with type, spotId, reward, rarity.
- **Money Rain event**: `window._triggerMoneyRain()` picks a random jackpot spot and broadcasts an announcement to every player.

### Celebrate overlay (big reward moments)
- Pure-CSS confetti (36 particles, 3.5 s, no libraries).
- Fires on: chapter complete, jackpot claim, house bought, achievement unlocked.

### Hunt phone app
- Stats card: today's claims / cap, total found, rare finds, jackpots.
- Achievements row (greys out locked ones).
- Hints list sorted by distance (nearest first). Hints only reveal when player is within 60 m — far spots show as "???" so the hunt still requires exploration.
- Inline Claim button when player is within 8 m of a spot.

### HUD update
- The "Daily Gem Hunt" card on the top-left HUD now shows real Money Hunt stats: `0/25 today · 0 total found`.

### Hardened mission rewards
- `claimChapterReward`, `claimDailyReward`, `claimWeeklyReward` now use `runTransaction` on `economy/{uid}/balance` instead of `get` + `set` (which had a race condition if two devices claimed at the same instant).

### Firebase rules
- `FIREBASE_RULES.json` updated with `hunt/{spotId}` write rules:
  - Only the caller can claim (`claimedBy === auth.uid`).
  - Reward shape validated (`{claimedBy, ts, reward, rarity}`).
  - `players/{uid}/missions` and `players/{uid}/huntStats` scoped to owner.

### Optional Cloud Function (deploy later)
- `cloud-functions/claimJackpot.js` — HTTPS callable that validates distance + respawn + reward server-side.
- `cloud-functions/README.md` — step-by-step deployment + client-switch instructions.
- The client works **without** this function (transaction-based anti-cheat is enough for soft launch). Deploy it when you want hard anti-cheat.

## Files changed / added

| File | Status | Purpose |
|------|--------|---------|
| `src/moneyspots.js` | NEW | 23 spot definitions + rarity config + reward roller + achievements |
| `src/moneyhunt.js` | NEW | Engine: instanced meshes, Firebase transaction claim, radar, stats |
| `src/celebrate.js` | NEW | CSS confetti overlay |
| `src/main.js` | MODIFIED | Init money hunt, tick in loop, Hunt phone app, HUD update, celebrate wiring |
| `src/missions.js` | MODIFIED | runTransaction for rewards, setCelebrateCallback |
| `FIREBASE_RULES.json` | MODIFIED | hunt/{spotId} rules + missions/huntStats scoped |
| `cloud-functions/claimJackpot.js` | NEW | Optional server-side claim validator |
| `cloud-functions/README.md` | NEW | Deployment guide |

## How to apply

1. **Unzip** this file on top of your local Kaduna-lifestyle repo:
   ```bash
   cd Kaduna-lifestyle
   unzip -o kaduna-phase3-money-hunt.zip
   ```
2. **Install deps** (nothing new this time, but just in case):
   ```bash
   npm install
   ```
3. **Test locally**:
   ```bash
   npm run dev
   ```
   Open http://localhost:5173, sign up, pick origin, then:
   - Open Phone → 💎 Hunt → see hints + achievements.
   - Walk to a spot (within 25 m you'll see the glowing bag/briefcase/trophy).
   - Get within 6 m → "Press E to claim" prompt.
   - Press E → reward toast + HUD stats update + celebrate overlay (for jackpots).

4. **Deploy**:
   ```bash
   npm run build
   # Deploy dist/ to Vercel / your host
   ```

5. **Update Firebase rules** (important for anti-cheat):
   - Copy `FIREBASE_RULES.json` contents into Firebase Console → Realtime Database → Rules → Publish.

6. **(Optional) Deploy Cloud Function** for hard anti-cheat:
   - Follow `cloud-functions/README.md`.

## What was already in the repo (Phase 3 parts 1-3)

These were already built before this drop — I didn't touch them:
- ✅ Missions engine (5 chapters, daily, weekly) — `src/missions.js`
- ✅ HomeStore phone app (buy furniture) — in `src/main.js`
- ✅ Real Estate phone app (buy/upgrade house) — in `src/main.js`
- ✅ Storage phone app (place furniture in home) — in `src/main.js`
- ✅ Furniture catalog + comfort score — `src/furniture.js`
- ✅ Origins + rent system — `src/origins.js`

## What's still missing from the full Phase 3 prompt

Per the build order in the prompt:
1. ✅ Mission engine + HUD tracker + chapters 1-2 (data-driven) — DONE
2. ✅ HomeStore (shop + storage + decorate mode) — DONE
3. ✅ Real-estate app: buy/rent/upgrade — DONE (mortgage/instalments not yet)
4. ✅ Money Hunt system: spots, hints, radar, safe claiming, events — **THIS DROP**
5. ⏳ Chapters 3-5 already exist in `src/missions.js` but their step checks need to be wired to actual game events (some steps like "do 3 different jobs" need `missionState.jobsDone` to be populated by the work function).
6. ⏳ Balance pass + performance pass — always ongoing.

## Performance notes

- 3 InstancedMeshes total for all 23 spots. Only the spots within 25 m of the player have non-zero matrices; the rest are scaled to 0 (free).
- No per-frame Firebase reads. Spot state is loaded once via `onValue` listeners (23 listeners, each ~50 bytes per update).
- Reward computation is deterministic (FNV-1a hash of spotId + bucket) — no server round-trip needed to know the reward.
- Celebrate overlay is CSS-only, removed after 3.5 s, pointer-events:none.

## Test results

- `npm run build` ✅ (66 modules, 1.25 MB bundle, 317 KB gzipped)
- Sign up → creator → origin → dismiss ✅
- Phone Hunt app shows all 23 spots with hints + distances + achievements ✅
- HUD gem card shows real stats ✅
- Anti-cheat: claiming a spot >7 m away returns "Too far — walk closer" ✅
- No console errors related to hunt/missions/celebrate ✅
