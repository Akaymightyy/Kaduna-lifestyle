# Kaduna Lifestyle — Own House Per Account, Step 2a (Oct 14)

This is **Step 2a** of Master Prompt Part 1, Bug 2: "Two players enter and
they are inside the SAME house." The work is incremental — each step ships
independently and the next step builds on top of it.

> NOTE: `vite.config.js` was NOT touched.
> NOTE: This zip is built ON TOP of the latest upstream commit `bdadc3e`
> (which includes the other assistant's new `src/art/` system). All 6 files
> in this zip either replace upstream files without losing their changes,
> or are new files that don't conflict.

---

## Build status

`npx vite build` -> built in 2.75s, 76 modules transformed, no errors.
`python3 -c "import json; json.load(open('FIREBASE_RULES.json'))"` -> JSON valid.

---

## WHAT STEP 2a DOES

Before this step, furniture was stored per-player at
`players/{uid}/homeFurniture`. The Firebase rules block any read of another
player's node, so a visitor could NEVER see another player's furniture even
if we wrote the visitor flow.

This step **moves furniture into the shared house record** at
`houses/{areaId}/{plotNo}/furniture`. The Firebase rules already allow any
authed player to READ any house record, and only the owner can WRITE to
their own plot. So:

  - Owner enters their home -> reads/writes `houses/{myArea}/{myPlot}/furniture`
  - Visitor enters (next step, 2b) -> reads `houses/{ownerArea}/{ownerPlot}/furniture`

### Migration
On first load after this update, `home.js` calls
`migrateFurnitureIfNeeded(uid, areaId, plotNo)` which:
1. Checks if `houses/{areaId}/{plotNo}/furniture` has items already. If yes,
   skip (already migrated).
2. Reads `players/{uid}/homeFurniture`. If empty, skip (fresh account).
3. Copies the array to `houses/{areaId}/{plotNo}/furniture`.
4. Leaves the old path intact (no destructive cleanup -- safe rollback).

### Fallback
If a player hasn't claimed a plot yet (no `homeArea` / `homePlot` in their
player record), `home.js` falls back to the old per-player path so existing
accounts aren't left with an empty room. Once they pick an area and claim a
plot, the next visit triggers the migration and they're on the new path.

---

## FILES IN THIS ZIP

```
src/houses.js                    (NEW -- 215 lines)
src/places/home.js               (MODIFIED -- furniture load/save paths)
src/areas.js                     (MODIFIED -- claimPlot() now writes furniture:[])
FIREBASE_RULES.json              (MODIFIED -- furniture sub-path owner-only write
                                             + new knocks/{ownerUid}/{knockId} node)
OWN-HOUSE-STEP-2a.md             (this file)
```

### File 1: `src/houses.js` (NEW)

New module with house record helpers. Exports:
- `resolvePlayerHouseKey(uid)` -> `{ areaId, plotNo, area }` | null
- `loadHouse(areaId, plotNo)` -> house record object | null
- `loadHouseFurniture(areaId, plotNo)` -> array (always, never null)
- `saveHouseFurniture(areaId, plotNo, items)` -> bool
- `returnToStorage(areaId, plotNo, ownerUid, itemId, color)` -> void
- `migrateFurnitureIfNeeded(uid, areaId, plotNo)` -> bool
- `knockOnDoor(ownerUid, visitorUid, visitorName, areaId, plotNo)` -> knockId
- `listenForKnocks(ownerUid, cb)` -> unsubscribe
- `respondToKnock(ownerUid, knockId, accepted)` -> void
- `listenForKnockReply(ownerUid, knockId, cb)` -> unsubscribe
- `setHouseLocked(areaId, plotNo, locked)` -> void
- `setHouseMarketFlags(areaId, plotNo, { forSale, forRent, price })` -> void
- `setHouseTier(areaId, plotNo, tier)` -> void
- `setHouseColors(areaId, plotNo, colors)` -> void
- `getHouseEntrance(areaId, plotNo)` -> `{ x, z, facing }`

Knock helpers are included in this file so step 2b (visitor flow) just
needs to wire up the UI -- no new module.

### File 2: `src/places/home.js` (MODIFIED)

Changes only in the `build()` function:
- Added import of `resolvePlayerHouseKey`, `loadHouseFurniture`,
  `saveHouseFurniture`, `migrateFurnitureIfNeeded` from `../houses.js`.
- After determining tier, resolve the player's house key (areaId, plotNo).
  If they have one, run the migration.
- Load furniture from `houses/{areaId}/{plotNo}/furniture` (instead of
  `players/{uid}/homeFurniture`).
- If the player has NO plot yet, fall back to the old per-player path so
  existing accounts aren't wiped.
- `_saveFurniture()` now writes to the house record path, with fallback
  to the old path if save fails (defensive).
- The rest of the file (room building, decorate mode, controls) is
  UNCHANGED -- the other assistant's `dressRoom()` integration is intact.

### File 3: `src/areas.js` (MODIFIED)

One-line change: `claimPlot()` now writes `furniture: []` to the house
record on first claim, so the empty array is initialised from the start.
This makes step 2b simpler -- visitor loads return an empty array
(not null) for a freshly-claimed plot.

### File 4: `FIREBASE_RULES.json` (MODIFIED)

Two additions:
1. **Per-field write rules under `houses.$areaId.$plotNo`**:
   `furniture`, `locked`, `forSale`, `forRent`, `price`, `tier`, `colors`
   each get their own rule: writable only when `data.parent.child('ownerUid').val() === auth.uid`.
   The parent write rule (claim-or-own) stays as-is.
   This means a visitor CAN'T tamper with a house's locked flag or furniture
   even if they tried.

2. **New `knocks.$ownerUid.$knockId` node**:
   - `.$ownerUid.read = auth.uid === $ownerUid` (owner sees all their knocks)
   - `.$knockId.read = auth != null` (visitor can read their own knock reply)
   - `.$knockId.write = !data.exists() || visitorUid === auth.uid || ownerUid === auth.uid`
     (visitor can create a knock + update their own knock; owner can
     respond to + delete any knock under their node)

All existing admin rules (the `6U87PzWq0dU8qwZeXJo7ySLxOFo1` UID override)
are preserved unchanged.

---

## WHAT THIS STEP DOES NOT DO YET

These are coming in step 2b:
- Visitor flow UI: walking to another player's plot, seeing "Knock" prompt,
  knocking, getting accepted/denied.
- Owner's knock-response prompt: real-time toast with accept/deny buttons
  when a visitor knocks.
- World rendering of per-plot doors with owner name signs (Feature 3 from
  the master prompt -- separate step).
- House lock toggle in the phone (Real Estate / Property app -- step 5
  in the master prompt).

The plumbing is all in place from step 2a -- step 2b is purely UI work
on top of the helpers in `src/houses.js`.

---

## TEST PLAN (after you push this zip)

1. Sign in with an existing account that has placed furniture before.
2. Walk into your home ("My Home").
3. Your existing furniture should still be there (auto-migrated from the
   old path to the new house record path on first load).
4. Place a new item, then leave the home and re-enter. The new item should
   persist (saved to the house record).
5. Refresh the page. Furniture should still load.
6. Open Firebase console and check `houses/{yourArea}/{yourPlot}/furniture`
   -- you should see the array there now.
7. The old `players/{uid}/homeFurniture` path is left intact (we don't
   delete it as a safety net).

If any of steps 3-6 fail, run the browser console and look for `[home]` and
`[houses]` log lines -- they will tell you which path was used and why.

---

## NEXT STEPS

- **Step 2b**: Visitor flow -- knock UI + owner response prompt + visitor
  enters another player's house and sees their furniture. The helpers in
  `src/houses.js` are ready; just need the UI glue in `places/manager.js`
  + a knock prompt component.
- **Step 2c**: Per-plot world doors with owner name signs.
- Then move on to Feature 3 (chunk-streaming areas + FOR RENT / FOR SALE
  boards), Feature 4 (area picker on signup), Feature 5 (Real Estate app).

Say "next" when you're ready for step 2b.
