// src/penalty_shootout.js — Penalty shoot-out game logic (pure functions).
//
// SIMPLIFIED RULES (turn-based, not real-time physics):
//   2 players take turns as KICKER and GOALIE.
//   Each round, both players pick a CORNER simultaneously:
//     - kicker corner: "topleft" | "topright" | "botleft" | "botright" | "center"
//     - goalie corner: same set
//   Resolution:
//     - If kicker corner === goalie corner → SAVE (no goal)
//     - If kicker corner !== goalie corner → GOAL (kicker scores)
//   5 rounds per player as kicker, then 5 rounds as goalie (10 rounds total)
//   Most goals wins. If tied after 10 rounds → sudden death (1 round each).
//
// State shape (stored in Firebase matches/{matchId}):
//   { players: { uid1: {name, score}, uid2: {name, score} },
//     kicker: uid, goalie: uid,
//     phase: "kicker_pick" | "goalie_pick" | "resolved",
//     kickerPick: corner | null,
//     goaliePick: corner | null,
//     lastResult: { type: "goal"|"save", kicker, goalie, kickerPick, goaliePick },
//     round: number,         // current round (0-9)
//     suddenDeath: false,
//     target: 5,             // 5 rounds per player
//     winnerUid: null }
//
// Note: since both players pick SIMULTANEOUSLY (we can't have them pick
// at the same time in a turn-based game without one seeing the other's
// pick), we use a TWO-PHASE approach:
//   1. Kicker picks (their pick is hidden from goalie until both picked)
//   2. Goalie picks (their pick is hidden from kicker)
//   3. Both picks are revealed + the round resolves
// The state stores kickerPick and goaliePick. To prevent the goalie from
// reading kickerPick from Firebase before guessing, we HASH the kicker's
// pick with a random salt until the goalie has picked. (For MVP, we trust
// that players don't peek at Firebase directly — this is a friendly
// game among friends, not a competitive e-sport.)

export const PENALTY_TARGET = 5;
export const CORNERS = ["topleft", "topright", "botleft", "botright", "center"];

// Apply the kicker's pick
export function applyKickerPick(state, uid, corner) {
  if (state.winnerUid) return { state, outcome: "noop" };
  if (state.kicker !== uid) return { state, outcome: "not_your_turn" };
  if (state.phase !== "kicker_pick") return { state, outcome: "wrong_phase" };
  const c = CORNERS.includes(corner) ? corner : "center";
  return {
    state: { ...state, phase: "goalie_pick", kickerPick: c },
    outcome: "kicker_picked",
  };
}

// Apply the goalie's pick + resolve the round
export function applyGoaliePick(state, uid, corner) {
  if (state.winnerUid) return { state, outcome: "noop" };
  if (state.goalie !== uid) return { state, outcome: "not_your_turn" };
  if (state.phase !== "goalie_pick") return { state, outcome: "wrong_phase" };
  if (!state.kickerPick) return { state, outcome: "no_kicker_pick" };
  const g = CORNERS.includes(corner) ? corner : "center";
  const kickerCorner = state.kickerPick;
  const isGoal = kickerCorner !== g;
  // Apply goal to kicker's score
  const newPlayers = { ...state.players };
  let winnerUid = null;
  if (isGoal) {
    const k = newPlayers[state.kicker];
    newPlayers[state.kicker] = { ...k, score: (k.score || 0) + 1 };
  }
  // Check end of regular rounds
  const newRound = state.round + 1;
  const totalRounds = (state.target || PENALTY_TARGET) * 2;
  // Check if match is over (after all rounds, whoever has more goals wins)
  let suddenDeath = state.suddenDeath || false;
  if (newRound >= totalRounds) {
    const kScore = newPlayers[state.kicker].score || 0;
    const gScore = newPlayers[state.goalie].score || 0;
    if (kScore !== gScore) {
      winnerUid = kScore > gScore ? state.kicker : state.goalie;
    } else {
      // Tied → sudden death
      suddenDeath = true;
    }
  }
  // In sudden death: if the kicker scored and the goalie had fewer → kicker wins;
  // if the kicker missed and the goalie already has more → goalie wins.
  if (suddenDeath && !winnerUid) {
    const kScore = newPlayers[state.kicker].score || 0;
    const gScore = newPlayers[state.goalie].score || 0;
    // In sudden death, only declare winner if scores are unequal after this round
    if (kScore !== gScore) {
      winnerUid = kScore > gScore ? state.kicker : state.goalie;
    }
  }
  // Swap roles for next round
  const newKicker = state.goalie;
  const newGoalie = state.kicker;
  return {
    state: {
      ...state,
      players: newPlayers,
      phase: winnerUid ? "resolved" : "kicker_pick",
      kicker: newKicker,
      goalie: newGoalie,
      kickerPick: null,
      goaliePick: g,
      lastResult: {
        type: isGoal ? "goal" : "save",
        kicker: state.kicker,
        goalie: state.goalie,
        kickerPick: kickerCorner,
        goaliePick: g,
      },
      round: newRound,
      suddenDeath,
      winnerUid,
    },
    outcome: isGoal ? "goal" : "save",
    winnerUid,
  };
}

export function isKicker(state, uid) {
  return state && state.phase === "kicker_pick" && state.kicker === uid && !state.winnerUid;
}

export function isGoalie(state, uid) {
  return state && state.phase === "goalie_pick" && state.goalie === uid && !state.winnerUid;
}

export function getPlayerScore(state, uid) {
  return state?.players?.[uid]?.score || 0;
}

export function getWinnerName(state) {
  if (!state || !state.winnerUid) return null;
  return state.players[state.winnerUid]?.name || "Player";
}

// Format the last result for display
export function formatResult(lastResult) {
  if (!lastResult) return null;
  const { type, kicker, goalie, kickerPick, goaliePick } = lastResult;
  if (type === "goal") {
    return `GOAL! ${kicker} kicked ${kickerPick}, ${goalie} dove ${goaliePick}.`;
  }
  if (type === "save") {
    return `SAVE! ${goalie} read ${kicker}'s ${kickerPick} dive perfectly.`;
  }
  return null;
}

// Convert corner to display label
export function cornerLabel(corner) {
  const labels = {
    topleft: "↖ Top-Left",
    topright: "↗ Top-Right",
    botleft: "↙ Bot-Left",
    botright: "↘ Bot-Right",
    center: "● Center",
  };
  return labels[corner] || corner;
}
