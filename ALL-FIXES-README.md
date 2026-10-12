# Kaduna Lifestyle — All Fixes Combined (ONE DROP)

This zip contains **everything**: the character-creator/origin-modal fix, Phase 3 (Money Hunt), and all the new fixes you asked for. 16 files total, 81 KB.

## What's fixed in this drop

### 1. Sign up / Login error feedback ✅
- Added a red error banner inside the auth modal that shows **specific** messages:
  - "❌ Wrong email or password. New here? Tap Sign Up."
  - "💔 This email already has an account. Tap Log In instead."
  - "💔 Username 'xyz' is already taken. Try another one."
  - "Enter a valid email address."
  - "Password must be at least 6 characters."
  - "⏳ Too many attempts. Wait a minute and try again."
  - "📡 No network. Check your data and try again."
- The error stays visible until the user retypes (clears on input).
- **Username availability check**: before creating an account, checks a `usernames/{name}` index in Firebase. If the username is taken, shows "💔 Username already taken" and blocks signup.

### 2. Nepo house different from Lapo house ✅
- Home interior is now **tier-dependent** — completely different rooms:
  - **Tier 1 (Dan Talaka / Lapo)**: 6×5m room, dim lighting, single small vent window, brown walls
  - **Tier 2 (Dan Attajiri / Nepo)**: 12×10m flat, bright lighting, two large windows, cream walls
  - **Tier 3+**: progressively bigger and nicer (16×12, 18×14, 22×16, 28×20)
- Each tier has different wall colors, floor colors, lighting, and room dimensions.

### 3. Private home — only MY room ✅
- The home is **rebuilt every time you enter** (not cached). This means:
  - Player A's furniture loads when A enters.
  - Player B's furniture loads when B enters (different browser/account).
  - No more seeing someone else's furniture.
- The rebuild is triggered by disposing the old home instance before building a new one (`places/manager.js`).

### 4. Furniture placement + movement ✅
- **Placed furniture now appears in the room** — the `_rebuildFurniture()` function creates 3D meshes for every placed item.
- **Tap-to-place**: when you place an item from storage, a ghost preview appears. Tap anywhere in the room to position it, then tap "✓ Confirm Place".
- **Move placed furniture**: tap any placed item → a control bar appears with Rotate / Move / Remove / Done buttons.
  - **Rotate**: rotates 90°
  - **Move**: picks up the item so you can place it again
  - **Remove**: returns the item to storage
- Furniture is saved to `players/{uid}/homeFurniture` in Firebase and persists across sessions.

### 5. Place action buttons hidden ✅
- Action buttons no longer cover the screen when you enter a building.
- Instead, a small **📋 button** (bottom-right) appears. Tap it to expand the action bar.
- After tapping an action, the bar auto-collapses.
- The bar is hidden by default — only the toggle button is visible.

### 6. Female character beards fixed ✅
- Widened the beard detection zone in `splitBeard()`:
  - Y range: 0.76 to 0.96 (was 0.80 to 0.93) — catches mustache + chin beard
  - Z threshold: z0 - 0.10×H (was 0.045×H) — catches more jaw area
  - X limit: |x| < 0.12×H — only the centre of the face (side hair stays)
- Female characters no longer have facial hair.

### 7. Previous fixes still included ✅
- **Character creator popping on refresh**: fixed (multiplayer.js uses `update()` not `set()`)
- **Origin modal stuck**: fixed (`_pickOrigin` uses `try/finally` + correct `update()` call)
- **Phase 3 Money Hunt**: 23 spots, instanced meshes, Firebase transactions, radar beep, 5 achievements, Hunt phone app, celebrate overlay
- **Hardened mission rewards**: `runTransaction` instead of get/set

## Files in this zip (16 files)

| File | What changed |
|------|-------------|
| `src/auth.js` | Error display + username availability check + field validation |
| `src/multiplayer.js` | `update()` not `set()` — stops wiping player data on login |
| `src/needs.js` | `save()` persists origin/homeTier/lastRentPaid/etc to localStorage |
| `src/origins.js` | `payRent` fixed: `update(ref, {balance: number})` not `update(ref, number)` |
| `src/main.js` | All wiring: Money Hunt, celebrate, collapsible actions, origin screen after reload, camera+canvas in placeCtx |
| `src/characters.js` | Widened `splitBeard()` detection zone for female characters |
| `src/missions.js` | `runTransaction` for rewards + `setCelebrateCallback` |
| `src/moneyspots.js` | NEW — 23 hunt spot definitions |
| `src/moneyhunt.js` | NEW — engine with instanced meshes + Firebase transactions |
| `src/celebrate.js` | NEW — CSS confetti overlay |
| `src/places/home.js` | Tier-dependent interiors + per-player rebuild + tap-to-place + move/rotate/remove |
| `src/places/manager.js` | Dispose home before rebuild + import `disposePlace` |
| `FIREBASE_RULES.json` | Added `usernames/{name}` node + `hunt/{spotId}` rules |
| `index.html` | Added `auth-error` banner element inside auth modal |
| `cloud-functions/claimJackpot.js` | Optional server-side claim validator |
| `cloud-functions/README.md` | Deployment guide |

## How to apply

```bash
cd Kaduna-lifestyle
unzip -o kaduna-all-fixes-combined.zip
npm install
npm run dev   # test locally
npm run build # deploy to Vercel
```

## IMPORTANT: Update Firebase Rules

After deploying, you MUST update your Firebase Realtime Database rules:

1. Go to Firebase Console → your project → Realtime Database → Rules
2. Copy the contents of `FIREBASE_RULES.json` from this zip
3. Paste it into the rules editor
4. Click **Publish**

Without this, the username availability check won't work (it needs to read the `usernames/` node).

## Test checklist

After applying:
- [ ] Sign up with an existing email → should show "💔 This email already has an account"
- [ ] Sign up with a taken username → should show "💔 Username already taken"
- [ ] Log in with wrong password → should show "❌ Wrong email or password"
- [ ] Pick Dan Talaka → enter house → should see small 6×5m room
- [ ] Pick Dan Attajiri → enter house → should see bigger 12×10m flat
- [ ] Buy furniture from HomeStore → place in room → should appear
- [ ] Tap placed furniture → should get Rotate/Move/Remove buttons
- [ ] Enter any building → should see 📋 button (not a bar covering screen)
- [ ] Create female character → should NOT have a beard
