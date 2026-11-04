# 💰 MONEY-SETUP — Protect the Money (Oga, follow am step by step)

Wetin dis one do: **nobody fit give imself money again.** Balance go live for
server (Vercel function), every gain get limit, and tampered localStorage go
self-heal back to the true balance.

The code side don COMPLETE. Na only 3 quick settings remain for your phone.

---

## Step 1 — Get your Firebase Database Secret (2 min)

1. Open **console.firebase.google.com** → your project (**Kaduna Lifestyle**).
2. ⚙️ **Project settings** → **Service accounts** tab.
3. Scroll down to **Database secrets** → click **Show**.
4. Copy the secret string (e.g. `eyJhbGciOi...` or an old 40-char key).

> Na SECRET — no send am for group chat, no put am inside any file for repo.

## Step 2 — Add 2 Environment Variables for Vercel (3 min)

1. Open **vercel.com** → your **kaduna-lifestyle** project.
2. **Settings** → **Environment Variables**.
3. Add these two (Environment = Production, Preview, Development — all):
   - Name: `FIREBASE_PROJECT_ID` → Value: your Firebase project id
     (e.g. `kaduna-lifestyle` — you go see am for Firebase settings)
   - Name: `FIREBASE_DB_SECRET` → Value: the secret from Step 1
4. (Only if your database no dey US region) add `FIREBASE_DB_URL`
   e.g. `https://kaduna-lifestyle-europe.firebaseio.com`
5. **Deployments** tab → the latest deploy → ⋯ menu → **Redeploy** (am go
   pick the new variables).

## Step 3 — Check say e dey live (30 sec)

Open **`https://kaduna-lifestyle.vercel.app/api/money`** for browser.
You go see: `{"ok":true,"mode":"server","project":"..."}` ✅
If you see `"ok":false` → the env vars never land; redo Step 2 + redeploy.

## Step 4 — Publish the secure Firebase rules (2 min)

1. Firebase Console → **Realtime Database** → **Rules** tab.
2. Open **FIREBASE_RULES_SECURE.json** from this zip, copy EVERYTHING inside.
3. Paste am for the editor → **Publish**.
4. (This na also the old TODO #12 — this new file get the same fixes PLUS
   economy locked to admin-only.)

## Step 5 — Test am like a thief 😄

1. Open the game, sign in. Check the phone → 🏦 Bank — you go see
   **"🛡 Money protection: ACTIVE"**.
2. Try to mint: open browser console → `game.state.money = 999999999`
   → the guard go REJECT am (you go see "🛡 Money jump blocked").
3. Reload → balance come back to the true server value.

---

## How the protection work (for your peace of mind)

| Layer | Wetin e stop |
|---|---|
| Device guard | Any single "gain" above ₦10M rejected instantly on the phone |
| /api/money (Vercel) | Every gain checked against per-reason caps + ₦100M/day cap; every op logged; replay blocked by nonce |
| Secure rules | The player account **cannot write** the balance AT ALL — only the server function |
| Self-heal | Server balance na the truth — tampered device pull back correct value |

Job pay, gigs, races, challenges, sales — everything still pays like before;
na now dem all pass through the server with limits. Players no go feel
anything except say the economy no fit spoil again.

## If anything no work

- `{"ok":false,"error":"not-configured"}` → env vars missing (Step 2).
- Bank still shows "setup pending" → the function never deployed; check Vercel
  **Functions** tab for `api/money`.
- Money no dey persist again → make sure Step 4 done (rules), and check the
  Vercel function logs for `db-get-401` (wrong secret — redo Step 1-2).
