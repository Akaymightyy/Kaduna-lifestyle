# Kaduna Lifestyle 🇳🇬

A 3D multiplayer life-sim of Kaduna, Nigeria — built with **Vite + Three.js + Firebase**.
Live: **kaduna-lifestyle.vercel.app** · The owner ships by uploading files; Vercel builds from `src/` automatically.

---

## How to run

```
npm install
npm run dev      # local dev (localhost)
npm run build    # outputs dist/  (Vercel: Framework = Vite, build = npm run build, output = dist)
```

Deploy = upload changed files into the repo (keep the folder structure: `src/…`, `api/…`) → Vercel auto-builds. You never need `dist/` or any `.glb` in an upload.

## How to ship an update (owner)

1. Copy the updated `src/` folder into the repo (replace the old one).
2. If the update touches server money: keep `api/` in the repo **root** (Vercel builds it as serverless functions).
3. Keep `FIREBASE_RULES.json` at repo root (see setup below).
4. Push → wait for the Vercel build → test on phone.

---

## What's in the game (short list)

- **Main world**: Ahmadu Bello Way with real traffic, day/night, street lamps, billboards
- **Places** (walk in, press **E**): Central Market, Mai Suya Spot, Central Mosque, Mechanic (Sani), Barber (Musa), Boutique, Bank, Carnival, Arena games and more — each with own interior, NPCs, activities
- **Money**: jobs, gigs, missions, money hunt, daily rewards, car sales, races — every naira now server-guarded (see below)
- **Build a house for real**: buy land → plan → hire contractor → 4 paid stages → a real owned house (see below)
- **Crews & Area Wars**: create/join a Crew (max 40), Crew Bank, roles, crew chat, weekly fight for 8 Kaduna areas, daily area bonuses, war rewards, Street Cred, crew levels (see below)
- **Cars**: dealership (KSR showroom incl. Tesla & Ghost flying cars), garage, damage + mechanic repair, paint/respray, **driveway** (your cars park outside your house)
- **Home**: buy/rent houses, furniture, upgrade tiers, rent due, house parties, knock/visit
- **Social**: friends list, DMs + groups (Messages app), world chat, private DM chat, send money in chat, money spray, challenges (dice/tennis/penalty/sniper/okada dash), weekly election
- **Style**: salon (hair + beard), wardrobe/outfits, poses, name tags — all visible to other players
- **Guide**: "How to Play" pops on first login (walk, drive, phone, buy car, buy house); re-read in Settings → 📖 How to Play

## What's new (Nov 4 — "Do all" update)

1. **🛡 Money protection** — devtools mint blocked (₦10M ceiling), every gain capped by type, server balance is the truth, tampered localStorage self-heals. `api/money.js` (Vercel serverless) is the only balance writer. Jobs/missions/daily/races/challenges/sprays/transfers all route through it.
2. **🚗 Driveway + Home service** — cars park outside your house; walk up → take out. Near your house → repaint (₦25k, 14 colours) + repair at home.
3. **👕 Street crowd refreshed** — background people now wear the new wardrobe palette.
4. **🔧 Mechanic gig** — daily uniform job at Sani's (₦2,200 + workshop overall); the FIRST shift of each gig each day pays ×2.
5. **🏁 Street race** — 🏁 beacon on the main street, 7 checkpoints, countdown + timer, PB saved, leaderboard on Firebase, ₦20,000 first daily win (₦2,000 after).

## Crews & Area Wars (Nov 2025) — the long game 🛡️

**One Crew. One banner. Eight areas to fight over.** This na the daily-return progression loop:

1. **🛡️ Crews** — register your Crew for ₦250k (unique name + tag like [KDW] + colour). Join another Crew free. Max 40 members (slots grow with Crew level). Roles: Leader 👑 / Co-Leader 🛡️ (max 2) / Elder ⭐ (max 5) / Member — promote, demote, kick, transfer leadership, disband. Every member get **Street Cred 🔥** wey no lost even if you switch crew.
2. **🏦 Crew Bank** — everybody fit contribute, Leader/Co-Leader fit withdraw. Contributions = war points + Crew XP. Bank cap grows with level.
3. **🚩 Area Control** — 8 areas: Barnawa, Kawo, Ungwan Rimi, Sabon Tasha, Kakuri, Malali, City Centre, Rigasa. Owner crew members collect a **daily bonus** (₦25k + 15%/level) per area + **10% off houses** inside. Ownership dey show everywhere: colour tint + [TAG] on the phone Map + minimap, a real 3D flag pole inside the area, and a small HUD pill when you enter.
4. **⚔️ Weekly Area War** — Leader sets the war target. Crew earns war points: ₦1,000 deposit = 1 pt, stay inside the war area = 1 pt/min (cap 300/day), finish a street race = +25 pts, plus 3 **daily Crew Challenges**. Sunday the week settles: highest crew takes the area; losers collect a 7-day cooldown on that area; defenders keep ties. Winner members claim a war reward (₦50k + 15%/level, +100 cred).
5. **📈 Crew Levels** — XP from deposits + challenges. Levels unlock member slots (12 → 40), bigger bank cap, stronger daily bonuses.
6. **💬 Crew Chat** — members-only group chat inside the Crew app.

Firebase nodes: `crews`, `crewMembers`, `crewNames`, `crewTags`, `crewChat`, `territory`, `players/{uid}/crew|crewTag|cred|crewDaily`. All in `FIREBASE_RULES.json` — publish the rules before going live.

## What's new (Nov 5 — 🏗️ Build a House update)

**Real house building — no be "click buy" again:**

1. **🧱 Build app** (phone) — buy land in **Sabon Tasha (₦6M) / Ungwan Rimi (₦14M) / Barnawa (₦18M)**, 6 plots per area. Your plot shows orange pegs + a signboard with your name for everybody.
2. **Plan before you pay** — pick Bungalow / Duplex / Mansion + rooms + one of 5 contractors (Manasseh Block Works → BuildRight Nig. Ltd). The app shows the FULL cost and time before you confirm anything. Cheap contractor = slow, dear = fast + high rating.
3. **4 stages, pay one at a time** — Foundation → Walls → Roof → Finishing. No money for the next stage? The house just waits half-built — e no go spoil.
4. **Workers no dey sleep** — progress lives on the server as timestamps (`stageStartedAt` + `stageDuration`), so the build keeps going while the game is closed. Come back and pay the next stage.
5. **Real site visuals** — slab grows, walls rise storey by storey, trusses + zinc roof, paint + windows at Finishing. 2–4 workers dey on site while a stage dey run; block/cement piles shrink as the work goes. Every player wey pass sees the stage (public `build` record).
6. **Finishing done = real house** — the plot enters the normal Houses system: enter, decorate, invite, upgrade, driveway — everything just works. Celebration + confetti on hand-over.

Money follows the same guard as everything else: `serverSpend()` first (if the Vercel API dey live), otherwise a confirmed read-modify-write on `economy/{uid}/balance`. If the spend no go through, NO stage starts and NO money moves.

> Note: `api/money.js` was removed from the repo by the owner — the game runs the legacy (client-confirmed) money mode until e comes back. Everything still works; the shield in Bank will show LOCAL instead of ACTIVE.

---

## 🔑 ONE-TIME SETUP — Money Protection (do this once, ~10 min on phone)

The code side is complete. The server money only switches ON after these steps (until then the game runs exactly as before, local mode):

### Step 1 — Firebase Database Secret (2 min)
1. **console.firebase.google.com** → your project → ⚙️ **Project settings** → **Service accounts** tab.
2. Scroll to **Database secrets** → **Show** → copy the secret string.
3. Keep am private — no post am anywhere.

### Step 2 — Vercel Environment Variables (3 min)
1. **vercel.com** → your **kaduna-lifestyle** project → **Settings** → **Environment Variables**.
2. Add (all environments):
   - `FIREBASE_PROJECT_ID` → your Firebase project id (e.g. `kaduna-lifestyle`)
   - `FIREBASE_DB_SECRET` → the secret from Step 1
   - `FIREBASE_DB_URL` → **only if** your DB is not in the US region (e.g. `https://kaduna-lifestyle-europe.firebaseio.com`)
3. **Deployments** → latest deploy → ⋯ → **Redeploy**.

### Step 3 — Publish the Rules (2 min)
1. Firebase Console → **Realtime Database** → **Rules** tab.
2. Open `FIREBASE_RULES.json` from this repo, copy EVERYTHING inside, paste am into the Console editor → **Publish**.

What these rules do: `economy/$uid/balance` becomes **write:false** for everybody — only the serverless function (admin secret) writes balances. Players' own money history (`log`), race scores, blocks, reports, election votes, transfers are properly locked/validated. Chat/DM/houses/matches keep working.

### Step 4 — Check say e work (2 min)
1. Open the game → sign in → open **Bank app** → the shield should say **ACTIVE** (server balance).
2. Open browser devtools → Console → type `game.state.money = 999999999` → press Enter → the balance must NOT change.
3. ✅ If Bank shows ACTIVE and the mint fails — money don lock. 🎉

---

## 📱 Real-phone test checklist (owner)

**One phone (Pixel):**
- [ ] Garage: enter, take car out, drive — smooth?
- [ ] Driveway: your car dey show outside your house? Walk near → "Take out" prompt?
- [ ] Home service: near your house → repaint + repair dey work?
- [ ] Flying car (Tesla/Ghost): fly smooth, no shaking?
- [ ] Salon: hair + beard change correct?
- [ ] Wardrobe / outfits / poses correct?
- [ ] Name tags showing?
- [ ] Street race: near 🏁 beacon → countdown → gates → prize pays?
- [ ] Mechanic gig: talk to Sani → shift runs → uniform wears → pay ×2 first time?
- [ ] How to Play guide pops on first login?

**Two phones side by side (same Wi-Fi):**
- [ ] Phone B sees Phone A outfit change?
- [ ] B sees A hair/beard change?
- [ ] B sees A pose?
- [ ] B sees A car damage?
- [ ] B sees A flying?
- [ ] B sees A uniform after gig?
- [ ] DM from A reaches B? Send-money A→B lands in B's Bank?

**Lag test:**
- [ ] Drive fast through the market with both phones — stutter? Note what you were doing when e happen.

Anything fail → tell Claude the exact step wey fail.

---

## File map (the important ones)

```
api/money.js              Vercel serverless — the ONLY balance writer (verify token → caps → admin write)
FIREBASE_RULES.json       Paste into Firebase Console → Rules → Publish (locks the database)
src/moneyapi.js           Client money guard + server sync + transferMoney/serverSpend/serverCredit helpers
src/main.js               Boot, HUD, wiring of every system
src/vehicles.js           Buy/sell/repair/paint (server-money flows)
src/garage.js             Garage (indoor showroom)
src/driveway.js           Cars displayed outside your house
src/homeservice.js        Repaint + repair at home
src/race.js               Street race (gates, countdown, leaderboard)
src/gigs.js               Hustle gigs + daily double + uniforms
src/missions.js           Chapters, daily/weekly missions (server-capped rewards)
src/moneyhunt.js          Money hunt spots (server-capped claims)
src/challenge_system.js   1v1 wager games (escrow + server-capped payout)
src/election.js           Weekly election
src/social/spray.js       Money spray (server-checked debit + validated records)
src/messages.js           DMs, groups, send money (server transfer)
src/social.js             Friends, relationship levels, visit links
src/how_to_play.js        First-login guide overlay
src/building.js           🏗️ Build a House: land, plan, contractors, 4 paid stages, hand-over
src/building_vis.js       Construction-site visuals (stages, workers, signs, colliders)
src/crews.js              🛡️ CREWS: create/join, roles, Crew Bank, XP/levels, Street Cred
src/crew_chat.js          Crew-only group chat (Firebase, members-locked by rules)
src/crew_war.js           ⚔️ AREA WARS: war points, daily challenges, weekly takeover, cooldowns
src/territory.js          🚩 Territory: 8 areas, ownership, 3D flags, map tint, area detection
src/crew_app.js           📱 Crew phone app (Crew/Chat/Areas/War/Rank tabs) + wiring entry
src/places/…              Every interior place (registry.js + manager.js + one file per place)
src/multiplayer.js        Live positions + remote avatars
src/life.js               Street crowd (walkers, neighbours)
```

## Credits

- Buildings, trees, fences, planters: **City Kit Suburban 2.0** by Kenney (kenney.nl), CC0 1.0 — see `public/models/city/KENNEY-LICENSE.txt`.
- Character `public/models/male.glb`: owner's own model. Everything else generated in code.
