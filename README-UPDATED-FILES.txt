KADUNA LIFESTYLE — SMOOTH MULTIPLAYER + MISSION CARD FIX (Nov 1)
================================================================

WHAT CHANGED
------------
1) REMOTE PLAYERS MOVE SMOOTHLY NOW
   Other players used to jump in visible steps (the glitchy movement in
   your video). Cause: the game snapped them straight to every Firebase
   position update (~5 updates per second = choppy). Now:
   - Firebase updates only set a TARGET position
   - a new per-frame ticker GLIDES each remote player toward it
     (position + facing), and the walk animation follows the real speed
   Files: src/multiplayer.js, src/main.js

2) "GETTING STARTED — Visit the market" CARD FIXED
   That card was a static HTML placeholder shown until the missions data
   loaded from Firebase (seconds after login — forever on slow networks).
   Now the card is HIDDEN until real mission data arrives, then shows your
   actual chapter. Firebase read errors are logged instead of swallowed.
   Files: index.html, src/main.js, src/missions.js

3) PRESENCE RULES ADDED
   The online-status node (presence) had NO security rules, so every
   update failed with permission_denied. Rules added.
   File: FIREBASE_RULES.json  ← PUBLISH THIS IN FIREBASE CONSOLE
   (Firebase Console → Realtime Database → Rules → paste → Publish.
    Nothing changes for existing features; it just makes presence work.)

ABOUT CHAIRS / FURNITURE
------------------------
House furniture (sofas, beds, chairs) has NO collision boxes by design
today — that's why players walk through them. Remote avatars follow the
sender's position (trust-the-sender networking), so they inherit that.
Say the word if you want furniture colliders added as a follow-up.

HOW TO APPLY
------------
1. Pull the repo first (Claude's rule).
2. Copy files over the repo keeping paths.
3. Publish the new FIREBASE_RULES.json in the Firebase console.
4. npm run build
