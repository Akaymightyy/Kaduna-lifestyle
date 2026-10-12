# Cloud Functions — Money Hunt payout (optional, deploy later)

## Why this folder exists

The Money Hunt system is designed to work **without** Cloud Functions: every claim
goes through a Firebase `runTransaction` on `hunt/{spotId}`, which guarantees only
the first caller wins. The reward is also computed deterministically from the
spot ID + respawn bucket, so every player who *would* have claimed the same spot
in the same cycle sees the same amount.

However, a determined cheater could still:

1. Modify their client to skip the distance check (claim a spot from anywhere).
2. Modify their client to roll their own reward instead of using `rollReward`.

For full anti-cheat, deploy the Cloud Function in this folder. It validates the
claim server-side before the payout is committed.

## Files

- `claimJackpot.js` — HTTPS callable function that validates + pays out a claim.
  Deploy this and switch the client to call it instead of writing directly.

## Deployment

```bash
# 1. Install Firebase CLI (one-time)
npm install -g firebase-tools

# 2. Login + init functions (one-time, run inside the repo)
firebase login
firebase init functions
#   - Language: JavaScript
#   - Lint: no
#   - Dependencies: yes

# 3. Copy claimJackpot.js into the functions/ folder that Firebase CLI created
cp cloud-functions/claimJackpot.js functions/index.js

# 4. Install the txn dependency
cd functions && npm install firebase-admin firebase-functions && cd ..

# 5. Deploy
firebase deploy --only functions
```

## Switching the client to use the function

After deployment, open `src/moneyhunt.js` and replace the body of `claimSpot`
(after the range pre-check) with a call to the HTTPS callable:

```js
import { getFunctions, httpsCallable } from "firebase/functions";
// ...
const claim = httpsCallable(getFunctions(), "claimJackpot");
const result = await claim({ spotId: spot.id, x: _player.x, z: _player.z });
if (result.data.ok) { /* show toast, update stats */ }
else { /* show error toast */ }
```

The Firebase rules in `FIREBASE_RULES.json` continue to protect the `hunt/` node
so even a modified client can't claim without going through the function.

## Notes

- The function is ~80 lines of JavaScript. It validates the player's distance to
  the spot, checks the respawn window, runs a transaction on `hunt/{spotId}`,
  and only pays out if the transaction succeeds.
- For the "Money Rain" event, the function also broadcasts an announcement to
  `announcements/` so every player sees the toast.
- All rewards are still capped by the rarity range defined in `src/moneyspots.js`,
  which the function re-validates server-side.
