// src/capital_dice.js — Capital Dice game logic (pure functions, no Firebase).
//
// RULES:
//   2 players take turns.
//   On your turn you can ROLL or BANK:
//     ROLL: dice = random(1..6)
//       - if dice === 1: turn ends, turnScore resets to 0, other player's turn
//       - else: turnScore += dice, you can roll again or bank
//     BANK: totalScore += turnScore, turnScore = 0, other player's turn
//   First to reach target (default 100) wins.
//
// State shape (stored in Firebase matches/{matchId}):
//   { players: { uid1: {name, score}, uid2: {name, score} },
//     currentPlayer: uid, turnScore: number, lastRoll: number,
//     target: 100, winnerUid: null }
//
// All functions are PURE — they return new state objects. The caller
// (challenge_ui.js) is responsible for pushing the new state to Firebase
// via pushMatchUpdate().

export const TARGET_SCORE = 100;

// Roll a die. Returns 1..6.
export function rollDie() {
  return Math.floor(Math.random() * 6) + 1;
}

// Apply a ROLL action to the state. Returns { state, outcome } where
// outcome is "roll" | "bust" (rolled a 1) | "win" (banked + hit target)
// or "switch" (turn ends without bust — e.g. banked but didn't win).
export function applyRoll(state) {
  if (state.winnerUid) return { state, outcome: "noop" };
  const die = rollDie();
  if (die === 1) {
    // BUST — turn ends, turnScore resets, switch player
    const otherUid = Object.keys(state.players).find(k => k !== state.currentPlayer);
    return {
      state: {
        ...state,
        turnScore: 0,
        lastRoll: 1,
        currentPlayer: otherUid,
      },
      outcome: "bust",
      die,
    };
  }
  // Add to turnScore, same player's turn
  return {
    state: {
      ...state,
      turnScore: state.turnScore + die,
      lastRoll: die,
    },
    outcome: "roll",
    die,
  };
}

// Apply a BANK action. Returns new state with turnScore added to total
// score, turn ends, switch player. If the new total >= target, that
// player wins.
export function applyBank(state) {
  if (state.winnerUid) return { state, outcome: "noop" };
  const uid = state.currentPlayer;
  const player = state.players[uid];
  const newScore = (player.score || 0) + state.turnScore;
  const newPlayers = {
    ...state.players,
    [uid]: { ...player, score: newScore },
  };
  // Check win condition
  if (newScore >= (state.target || TARGET_SCORE)) {
    return {
      state: {
        ...state,
        players: newPlayers,
        turnScore: 0,
        lastRoll: state.lastRoll,
        winnerUid: uid,
      },
      outcome: "win",
      winnerUid: uid,
      finalScore: newScore,
    };
  }
  // Switch player
  const otherUid = Object.keys(state.players).find(k => k !== uid);
  return {
    state: {
      ...state,
      players: newPlayers,
      turnScore: 0,
      lastRoll: state.lastRoll,
      currentPlayer: otherUid,
    },
    outcome: "switch",
    bankedScore: state.turnScore,
    newTotal: newScore,
  };
}

// Apply a RESIGN action. The other player wins.
export function applyResign(state, resignerUid) {
  if (state.winnerUid) return { state, outcome: "noop" };
  const otherUid = Object.keys(state.players).find(k => k !== resignerUid);
  if (!otherUid) return { state, outcome: "noop" };
  return {
    state: {
      ...state,
      winnerUid: otherUid,
    },
    outcome: "resign",
    winnerUid: otherUid,
  };
}

// Is it the given player's turn?
export function isMyTurn(state, uid) {
  return state && state.currentPlayer === uid && !state.winnerUid;
}

// Get the winner's display name
export function getWinnerName(state) {
  if (!state || !state.winnerUid) return null;
  return state.players[state.winnerUid]?.name || "Player";
}

// Get a player's current total score
export function getPlayerScore(state, uid) {
  return state?.players?.[uid]?.score || 0;
}
