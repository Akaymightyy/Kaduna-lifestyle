// src/challenge_system.js — Challenge Anyone / Wager system (MyAbujaLife-style).
//
// Lets a player OPEN a wager challenge that any online player can ACCEPT.
// Both stakes go into escrow. Winner takes the pot minus a 5% fee.
//
// Firebase data model:
//   challenges/{challengeId} = {
//     hostUid, hostName, game, stake,
//     status: "open" | "accepted" | "cancelled" | "completed",
//     opponentUid, opponentName,
//     matchId,                // set when accepted → match starts
//     winnerUid,              // set when completed
//     createdAt, acceptedAt, completedAt,
//   }
//   matches/{matchId} = {
//     challengeId, game,
//     players: { uid1: { name, score }, uid2: { name, score } },
//     currentPlayer: uid,        // whose turn
//     turnScore: number,         // current turn's accumulated points
//     lastRoll: number,
//     target: 100,
//     winnerUid: null,
//     createdAt, updatedAt,
//   }
//
// Wire-up (in main.js):
//   import { initChallengeSystem, getOpenChallenges, openChallenge,
//            acceptChallenge, cancelChallenge, subscribeToChallenges,
//            subscribeToMatch, pushMatchUpdate, resignMatch } from "./challenge_system.js";
//   initChallengeSystem({ db, auth, getUserId, getUserName, getGameState, toast });

import { ref, push, set, update, get, onValue, remove, serverTimestamp, onChildAdded, onChildRemoved, runTransaction } from "firebase/database";

let _db = null, _auth = null;
let _getUserId = () => null;
let _getUserName = () => "Player";
let _getGameState = () => null;
let _toast = () => {};

export function initChallengeSystem({ db, auth, getUserId, getUserName, getGameState, toast }) {
  _db = db;
  _auth = auth;
  _getUserId = getUserId;
  _getUserName = getUserName;
  _getGameState = getGameState;
  _toast = toast;
}

export const HOST_FEE_PCT = 0.05;   // 5% house cut

// ---- Open a challenge ----
// Player A picks a game + stake. Their stake is deducted immediately
// (escrow). If they cancel before anyone accepts, they get refunded.
// Returns the challengeId on success, null on failure.
export async function openChallenge({ game, stake, hostName }) {
  if (!_db) { _toast("Challenge system not ready"); return null; }
  const uid = _getUserId();
  if (!uid) { _toast("Sign in first"); return null; }
  const gs = _getGameState();
  if (!gs) { _toast("Game state not ready"); return null; }
  if (!stake || stake < 1000) { _toast("Stake must be at least ₦1,000"); return null; }
  if (gs.state.money < stake) { _toast("Not enough money — need ₦" + stake.toLocaleString()); return null; }
  // Escrow: deduct the stake from the host now
  gs.state.money -= stake;
  try {
    await update(ref(_db, "economy/" + uid), { balance: gs.state.money });
  } catch (e) {
    gs.state.money += stake;  // rollback
    _toast("Escrow failed: " + e.message);
    return null;
  }
  // Push the challenge
  const challengeRef = push(ref(_db, "challenges"));
  const challengeId = challengeRef.key;
  const challenge = {
    hostUid: uid,
    hostName: String(hostName || _getUserName() || "Player").slice(0, 30),
    game,
    stake,
    status: "open",
    opponentUid: null,
    opponentName: null,
    matchId: null,
    winnerUid: null,
    createdAt: Date.now(),
    acceptedAt: null,
    completedAt: null,
  };
  try {
    await set(challengeRef, challenge);
    _toast("🎲 Challenge open — waiting for an opponent...");
    return challengeId;
  } catch (e) {
    // Rollback escrow if push failed
    gs.state.money += stake;
    await update(ref(_db, "economy/" + uid), { balance: gs.state.money });
    _toast("Could not open challenge: " + e.message);
    return null;
  }
}

// ---- Accept a challenge ----
// Player B accepts. Their stake is deducted (escrow). The match starts
// immediately for both players. Returns matchId on success.
//
// BUGFIX (Oct 24 — multiplayer challenge never connects):
// The old flow wrote status:"accepted" FIRST and only attached matchId in a
// SECOND write. The security rules only allow open→accepted, so the second
// write (matchId) was REJECTED — the match existed but the host never got
// its id and both players sat on "Waiting for opponent..." forever.
// Now: the match is created FIRST, then ONE transaction claims the challenge
// open→accepted WITH matchId in a single write (also wins the race if two
// players tap Accept at the same time). If the claim fails, the match is
// deleted and the accepter's stake is refunded — no more stuck state.
export async function acceptChallenge(challengeId) {
  if (!_db) { _toast("Challenge system not ready"); return null; }
  const uid = _getUserId();
  if (!uid) { _toast("Sign in first"); return null; }
  // Read the challenge first
  const snap = await get(ref(_db, "challenges/" + challengeId));
  const ch = snap.val();
  if (!ch) { _toast("Challenge not found"); return null; }
  if (ch.status !== "open") { _toast("Challenge no longer open"); return null; }
  if (ch.hostUid === uid) { _toast("Can't accept your own challenge"); return null; }
  const gs = _getGameState();
  if (gs.state.money < ch.stake) { _toast("Not enough money — need ₦" + ch.stake.toLocaleString()); return null; }
  // Escrow: deduct stake from accepter
  gs.state.money -= ch.stake;
  try {
    await update(ref(_db, "economy/" + uid), { balance: gs.state.money });
  } catch (e) {
    gs.state.money += ch.stake;
    _toast("Escrow failed: " + e.message);
    return null;
  }
  // Create the match FIRST — game-specific initial state
  const matchRef = push(ref(_db, "matches"));
  const matchId = matchRef.key;
  // Default state (for capital_dice + tennis + penalty_shootout):
  const match = {
    challengeId,
    game: ch.game,
    players: {
      [ch.hostUid]: { name: ch.hostName, score: 0 },
      [uid]: { name: _getUserName() || "Player", score: 0 },
    },
    currentPlayer: ch.hostUid,   // host starts
    turnScore: 0,
    lastRoll: 0,
    target: 100,
    winnerUid: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  // Game-specific overrides:
  if (ch.game === "tennis") {
    // Tennis uses hitter/runner roles + rallyCount instead of turnScore
    match.hitter = ch.hostUid;
    match.runner = uid;
    match.phase = "hitter_pick";
    match.hitterPick = null;
    match.runnerGuess = null;
    match.rallyCount = 0;
    match.target = 11;
    match.win_by = 2;
  } else if (ch.game === "penalty_shootout") {
    // Penalty uses kicker/goalie roles + round counter
    match.kicker = ch.hostUid;
    match.goalie = uid;
    match.phase = "kicker_pick";
    match.kickerPick = null;
    match.goaliePick = null;
    match.round = 0;
    match.suddenDeath = false;
    match.target = 5;
    // Score = goals scored (only kicker can score on their turn)
  } else if (ch.game === "sniper") {
    // Sniper uses shooter/target roles + HP + mapId
    match.shooter = ch.hostUid;
    match.target = uid;
    match.phase = "shooter_pick";
    match.shooterPick = null;
    match.targetPick = null;
    match.round = 0;
    // Override player state to use HP instead of score
    match.players[ch.hostUid].hp = 100;
    match.players[uid].hp = 100;
    // Pick a random map (3 options)
    const mapIds = ["maize", "rooftops", "river"];
    match.mapId = mapIds[Math.floor(Math.random() * mapIds.length)];
    match.maxHp = 100;
  } else if (ch.game === "bowling") {
    // Bowling: 10 frames, turn-based, score-based
    match.bowler = ch.hostUid;
    match.phase = "bowl_pick";
    match.frame = 0;
    match.roll = 0;
    match.pinsStanding = 10;
    match.framePins = 0;
    match.bowlerPick = null;
    match.lastResult = null;
    match.target = 10;
    match.players[ch.hostUid].frames = [];
    match.players[uid].frames = [];
  } else if (ch.game === "pool") {
    // Pool: 7 rounds, turn-based, most balls potted wins
    match.shooter = ch.hostUid;
    match.phase = "shoot_pick";
    match.round = 0;
    match.shooterPick = null;
    match.lastResult = null;
    match.target = 7;
    match.players[ch.hostUid].potted = 0;
    match.players[uid].potted = 0;
  } else if (ch.game === "okada_dash") {
    // Okada Dash: 5 rounds, pick lane + action, highest score wins
    match.rider = ch.hostUid;
    match.phase = "ride_pick";
    match.round = 0;
    match.riderPick = null;
    match.lastResult = null;
    match.target = 5;
  }
  try {
    await set(matchRef, match);
  } catch (e) {
    // Match write failed — refund, challenge stays "open" (nothing stuck)
    gs.state.money += ch.stake;
    update(ref(_db, "economy/" + uid), { balance: gs.state.money }).catch(() => {});
    _toast("Could not create match: " + e.message);
    return null;
  }
  // Claim the challenge in ONE atomic write: open → accepted + matchId.
  // (The old two-write flow lost matchId — the rules rejected the second
  // write, so the host never joined and both sides waited forever.)
  try {
    const result = await runTransaction(ref(_db, "challenges/" + challengeId), (cur) => {
      if (!cur || cur.status !== "open") return;   // abort: someone else took it / host cancelled
      return {
        ...cur,
        status: "accepted",
        opponentUid: uid,
        opponentName: String(_getUserName() || "Player").slice(0, 30),
        acceptedAt: Date.now(),
        matchId,
      };
    });
    if (!result.committed) {
      // Lost the race (or the host cancelled) — clean up + refund
      remove(ref(_db, "matches/" + matchId)).catch(() => {});
      gs.state.money += ch.stake;
      update(ref(_db, "economy/" + uid), { balance: gs.state.money }).catch(() => {});
      _toast("Challenge no longer open");
      return null;
    }
    _toast("🎲 Match starting! Good luck.");
    return matchId;
  } catch (e) {
    // Rules / permission failure — remove the orphan match + refund
    remove(ref(_db, "matches/" + matchId)).catch(() => {});
    gs.state.money += ch.stake;
    update(ref(_db, "economy/" + uid), { balance: gs.state.money }).catch(() => {});
    _toast("Could not accept: " + e.message);
    return null;
  }
}

// ---- Cancel an open challenge (host only) ----
// Refunds the host's stake. Works while status === "open" (no opponent yet),
// and ALSO on a legacy stuck challenge stuck at "accepted" with no matchId
// (those could never start — the Oct 24 bugfix above stops new ones forming).
// If a match exists, use resignMatch instead.
export async function cancelChallenge(challengeId) {
  if (!_db) return false;
  const uid = _getUserId();
  const snap = await get(ref(_db, "challenges/" + challengeId));
  const ch = snap.val();
  if (!ch) { _toast("Challenge not found"); return false; }
  if (ch.hostUid !== uid) { _toast("Only the host can cancel"); return false; }
  if (ch.status !== "open" && !(ch.status === "accepted" && !ch.matchId)) { _toast("Challenge already accepted — play or resign instead"); return false; }
  // Refund the host
  const gs = _getGameState();
  gs.state.money += ch.stake;
  try {
    await update(ref(_db, "economy/" + uid), { balance: gs.state.money });
    await update(ref(_db, "challenges/" + challengeId), { status: "cancelled", completedAt: Date.now() });
    _toast("Challenge cancelled — ₦" + ch.stake.toLocaleString() + " refunded");
    return true;
  } catch (e) {
    gs.state.money -= ch.stake;  // rollback refund
    _toast("Cancel failed: " + e.message);
    return false;
  }
}

// ---- Resign from an active match (the opponent wins) ----
export async function resignMatch(matchId) {
  if (!_db) return false;
  const uid = _getUserId();
  const snap = await get(ref(_db, "matches/" + matchId));
  const m = snap.val();
  if (!m) { _toast("Match not found"); return false; }
  if (m.winnerUid) { _toast("Match already over"); return false; }
  if (!m.players[uid]) { _toast("You're not in this match"); return false; }
  // Find the other player → they win
  const otherUid = Object.keys(m.players).find(k => k !== uid);
  if (!otherUid) { _toast("Can't determine winner"); return false; }
  return _resolveMatch(matchId, otherUid);
}

// ---- Resolve a match (internal) ----
// Pays out the pot (minus 5% fee) to the winner. Both players' stakes
// were already in escrow. The loser gets nothing.
async function _resolveMatch(matchId, winnerUid) {
  const matchSnap = await get(ref(_db, "matches/" + matchId));
  const m = matchSnap.val();
  if (!m || m.winnerUid) return false;  // already resolved
  // Get the challenge to find the stake
  const chSnap = await get(ref(_db, "challenges/" + m.challengeId));
  const ch = chSnap.val();
  if (!ch) return false;
  const pot = ch.stake * 2;
  const fee = Math.round(pot * HOST_FEE_PCT);
  const payout = pot - fee;
  // Credit the winner
  const gs = _getGameState();
  if (winnerUid === _getUserId()) {
    gs.state.money += payout;
    try {
      await update(ref(_db, "economy/" + winnerUid), { balance: gs.state.money });
    } catch (e) { /* still mark match complete */ }
    _toast("🏆 You won ₦" + payout.toLocaleString() + "!");
  }
  // Mark match + challenge as completed
  try {
    await update(ref(_db, "matches/" + matchId), {
      winnerUid,
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });
    await update(ref(_db, "challenges/" + m.challengeId), {
      status: "completed",
      winnerUid,
      completedAt: Date.now(),
    });
  } catch (e) { /* ignore */ }
  return true;
}

// Public wrapper for game logic to call when a winner is determined
// (e.g. when a player's score reaches 100 in Capital Dice).
export async function declareWinner(matchId, winnerUid) {
  return _resolveMatch(matchId, winnerUid);
}

// ---- Push a match update (e.g. roll dice, bank score, switch turn) ----
// The caller (capital_dice.js logic) computes the new state, then this
// pushes it atomically.
export async function pushMatchUpdate(matchId, patch) {
  if (!_db) return false;
  try {
    await update(ref(_db, "matches/" + matchId), { ...patch, updatedAt: Date.now() });
    return true;
  } catch (e) {
    _toast("Update failed: " + e.message);
    return false;
  }
}

// ---- Subscribe to ALL open challenges ----
// Used by main.js to show a toast when a new challenge appears.
// Returns an unsubscribe function.
export function subscribeToChallenges(callback) {
  if (!_db) return () => {};
  // Listen for new challenges (onChildAdded fires for each existing + new ones)
  const unsub = onChildAdded(ref(_db, "challenges"), (snap) => {
    const ch = snap.val();
    if (!ch) return;
    if (ch.status === "open" && ch.hostUid !== _getUserId()) {
      callback(ch, snap.key);
    }
  });
  return unsub;
}

// ---- Subscribe to a specific match (live updates) ----
// Used by challenge_ui.js to update the match screen as the opponent plays.
export function subscribeToMatch(matchId, callback) {
  if (!_db) return () => {};
  const unsub = onValue(ref(_db, "matches/" + matchId), (snap) => {
    callback(snap.val());
  });
  return unsub;
}

// ---- Subscribe to challenges that I hosted (for accept/cancel notifications) ----
// Used to know when MY challenge gets accepted → switch to match screen.
export function subscribeToMyChallenges(callback) {
  if (!_db) return () => {};
  // Listen to all challenges, filter to mine client-side
  const unsub = onValue(ref(_db, "challenges"), (snap) => {
    const all = snap.val() || {};
    const mine = Object.entries(all)
      .filter(([id, ch]) => ch.hostUid === _getUserId() || ch.opponentUid === _getUserId())
      .map(([id, ch]) => ({ id, ...ch }));
    callback(mine);
  });
  return unsub;
}

// ---- Get active matches for the current player ----
export async function getMyActiveMatches() {
  if (!_db) return [];
  const snap = await get(ref(_db, "matches"));
  const all = snap.val() || {};
  return Object.entries(all)
    .filter(([id, m]) => m.players[_getUserId()] && !m.winnerUid)
    .map(([id, m]) => ({ id, ...m }));
}
