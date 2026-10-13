# Kaduna Lifestyle — ALL PHASES COMPLETE (ONE DROP)

This zip contains **every phase** + all previous fixes. 22 files, 102 KB.

## Phases implemented

### Phase 1: Origins + Rent ✅ (already existed)
- Dan Attajiri (Nepo) vs Dan Talaka (Lapo) — different starting money, homes, skill bonuses
- 6 housing tiers from Face-Me-I-Face-You Room to Private Estate
- Weekly rent system with landlord knock + eviction after 3 missed payments

### Phase 2: Needs That Bite ✅ (NEW — src/events.js)
- **NEPA power cuts**: randomly every 30-90 min, last 3-8 min. Lights go out, energy/fun drain 2x faster. Generator/solar/inverter item reduces the effect.
- **Moodlets**: 8 temporary buffs/debuffs (Well Rested, Well Fed, Fresh, Happy, Sick, Stinky, Inspired, Heartbroken) that modify need drain rates.
- **Consequences**: low energy (<20) → walk 50% slower; zero hunger → blackout (teleport home, ₦500 hospital bill); low hygiene (<15) → stinky moodlet + warning toast.
- **Modified drain system**: needs.js now reads `state.drainModifiers` which combines NEPA + moodlets + weather effects.

### Phase 3: Careers With Skills ✅ (NEW — src/careers.js)
- **15 career ladders × 5 levels** = 75 jobs total: Keke Driver, Market Trader, Tailor, Teacher, Nurse, Doctor, Civil Servant, DJ, Barber, Mechanic, Lawyer, Software Dev, Buka Cook, MC/Comedian, Sales Rep.
- **7 skills**: hustle, charisma, fitness, cooking, coding, music, comedy. Train for ₦1,000 + 20 energy.
- **5 shift tones**: Steady, Push Hard, Gist with Pals, Flatter Oga, Take It Easy — each trades pay/energy/fun/social/risk differently.
- **Promotion system**: requires skill level + 100 XP. XP gained per shift.
- **Skill bonus**: Dan Talaka learns 25% faster (from origin).

### Phase 4: Places With Hours ✅ (already existed)
- 14 places: Central Market, Suya Spot, Central Mosque, Kawo Park, University, Mall/Cinema, Hospital, Bank, Stadium, River Park, Church, Barber, Nightclub, Home.
- Each has opening/closing hours. Closed = cannot enter.

### Phase 5: Household Economy ✅ (already existed)
- Food shop (8 items), furniture store (20+ items), transport (keke/bus/taxi), boutique (clothes).

### Phase 6: Wishes + Moodlets ✅ (NEW — src/wishes.js)
- **24 daily wishes** (3 picked deterministically per day per player): eat local, cook, work, workout, make friend, level skill, visit places, chat, pray, buy clothes, etc.
- **Wish points** (not naira) unlock **5 perks**: Fast Learner (+10% skill growth), Bargain Hunter (5% off shops), Energy Boost (+20% recovery), Lucky Hunter (+10% hunt rewards), Social Butterfly (+20% social gain).
- Wishes auto-check every 2 seconds and auto-claim when complete.

### Phase 7: Weekly Kaduna Election ✅ (NEW — src/election.js)
- **Register as governor candidate**: ₦10,000 fee + slogan + one of 5 policies.
- **5 policies**: Transport Subsidy (rides 50% off), Wage Raise (+20% pay), Festival Season (fun drains slower), Food Subsidy (30% cheaper), Steady Light (NEPA cuts 50% less).
- **Voting**: Firebase transaction — each player votes once per week.
- **Winner's policy** changes prices/pay for the whole week.
- Election resets weekly.

### Phase 8: People and Social ✅ (NEW — src/social.js)
- **Friends**: add by username, relationship levels 0-5 (Stranger → Best Friend).
- **DMs**: direct messages via Firebase (dms/{chatId}).
- **Visit-my-home invite link**: `?v=username` URL param auto-travels to that player's home.
- **Relationship boosting**: chatting/visiting increases relationship level.

### Phase 9: Daily Flavour ✅ (NEW — src/flavour.js)
- **5 weather types** (deterministic daily): Sunny, Rainy, Harmattan, Hot, Cool — each affects gameplay (rides cost more in rain, hygiene drops faster in harmattan, energy drains faster in hot, etc.).
- **10 funny headlines** that appear every 2-4 hours and affect gameplay: Fuel Scarcity, Market Flood, Owambe Season, NEPA Wahala, Free Suya, Traffic Jam, Harmattan Dust, Football Win, Tax Season, Giveaway.
- Headlines expire after 1-6 hours.

### Previous fixes still included ✅
- **Auth errors**: red banner with specific messages (wrong password, email exists, username taken, etc.)
- **Username availability check** via `usernames/` Firebase index
- **Nepo ≠ Lapo house**: 6 different tier-dependent home interiors
- **Private home**: rebuilds every time you enter (no cached furniture)
- **Furniture placement**: tap-to-place + move/rotate/remove controls
- **Action buttons hidden**: 📋 toggle button instead of bar covering screen
- **Female beards fixed**: widened splitBeard() detection zone
- **Character creator popping on refresh**: fixed (multiplayer.js uses update() not set())
- **Origin modal stuck**: fixed (try/finally + correct update() call)
- **Phase 3 Money Hunt**: 23 spots, instanced meshes, Firebase transactions, radar beep, 5 achievements, celebrate overlay

## Files in this zip (22 files)

| File | Phase | What it does |
|------|-------|-------------|
| `src/events.js` | 2 | NEPA cuts + moodlets + consequences |
| `src/careers.js` | 3 | 15 careers × 5 levels + 7 skills + 5 shift tones |
| `src/wishes.js` | 6 | 24 daily wishes + 5 perks |
| `src/election.js` | 7 | Weekly governor election + 5 policies |
| `src/social.js` | 8 | Friends + DMs + visit links |
| `src/flavour.js` | 9 | Weather + headlines |
| `src/moneyspots.js` | 3 (Money Hunt) | 23 hunt spot definitions |
| `src/moneyhunt.js` | 3 (Money Hunt) | Engine: instanced meshes + Firebase transactions |
| `src/celebrate.js` | All | CSS confetti overlay |
| `src/auth.js` | Auth | Error display + username check |
| `src/multiplayer.js` | Fix | update() not set() — stops wiping player data |
| `src/needs.js` | 2 | Modified drain rates (NEPA + moodlets + weather) |
| `src/origins.js` | 1 | payRent fix |
| `src/main.js` | All | All wiring + 7 new phone apps |
| `src/characters.js` | Fix | Widened splitBeard() for female characters |
| `src/missions.js` | 3 (Missions) | runTransaction for rewards |
| `src/places/home.js` | Fix | Tier-dependent interiors + tap-to-place furniture |
| `src/places/manager.js` | Fix | Dispose home before rebuild |
| `FIREBASE_RULES.json` | All | hunt + usernames + missions rules |
| `index.html` | Auth | auth-error banner element |
| `cloud-functions/claimJackpot.js` | 3 | Optional server-side validator |
| `cloud-functions/README.md` | 3 | Deployment guide |

## New phone apps (7 new)

- 💼 **Careers** — join/promote/do shifts
- 📈 **Skills** — train 7 skills
- ⭐ **Wishes** — daily wishes + perks shop
- 🗳️ **Election** — register/vote/view candidates
- 👥 **Friends** — add friends + DMs + visit link
- 🌤️ **Weather** — today's weather + active headlines
- 💎 **Hunt** — money hunt (from previous drop)

## How to apply

```bash
cd Kaduna-lifestyle
unzip -o kaduna-all-phases-complete.zip
npm install
npm run dev   # test locally at http://localhost:5173
npm run build # deploy to Vercel
```

## IMPORTANT: Update Firebase Rules

Paste `FIREBASE_RULES.json` into Firebase Console → Realtime Database → Rules → Publish. This adds:
- `usernames/` node for username availability checking
- `hunt/` transaction-safe claim rules
- `players/{uid}/missions` and `huntStats` scoped to owner

## Test checklist

- [ ] Sign up with taken username → "💔 Username already taken"
- [ ] Login with wrong password → "❌ Wrong email or password"
- [ ] Pick Dan Talaka → enter house → small 6×5m room
- [ ] Pick Dan Attajiri → enter house → bigger 12×10m flat
- [ ] Open Phone → 💼 Careers → join a career → do a shift → earn money
- [ ] Open Phone → 📈 Skills → train a skill
- [ ] Open Phone → ⭐ Wishes → see 3 daily wishes + perks shop
- [ ] Open Phone → 🗳️ Election → register as candidate (₦10,000)
- [ ] Open Phone → 👥 Friends → add a friend by username
- [ ] Open Phone → 🌤️ Weather → see today's weather + headlines
- [ ] Enter any building → 📋 button (not bar covering screen)
- [ ] Create female character → no beard
- [ ] Place furniture → tap it → get Rotate/Move/Remove buttons
