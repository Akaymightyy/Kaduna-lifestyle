// src/tennis_game.js — Turn-based tennis game logic (pure functions).
//
// SIMPLIFIED RULES (turn-based, not real-time physics):
//   2 players alternate as the HITTER and the RUNNER.
//   On each turn, the HITTER picks:
//     - direction: "left" | "center" | "right"
//     - power: "soft" | "medium" | "hard"
//   The RUNNER picks:
//     - guess: "left" | "center" | "right" (where they think the ball will go)
//   Resolution:
//     - If RUNNER's guess === HITTER's direction → RETURN (rally continues, swap roles)
//     - If guess !== direction → POINT for HITTER (the runner guessed wrong)
//   Special rule: if HITTER picks power=hard AND RUNNER guesses correct →
//     the runner gets a COUNTER-POINT (the hitter hit too hard and the runner
//     smashed it back). This rewards risk-taking.
//   First to 11 points wins (win by 2).
//
// State shape (stored in Firebase matches/{matchId}):
//   { players: { uid1: {name, score}, uid2: {name, score} },
//     hitter: uid,                 // whose turn to hit
//     runner: uid,                // whose turn to run (the other player)
//     phase: "hitter_pick" | "runner_pick" | "resolved",
//     hitterPick: { direction, power } | null,
//     runnerGuess: "left" | "center" | "right" | null,
//     lastResult: { type: "return"|"point"|"counter", hitter, runner, ... },
//     rallyCount: number,         // how many consecutive returns this rally
//     target: 11, win_by: 2,
//     winnerUid: null }
//
// Pure functions: applyHitterPick(state, uid, pick) → {state, outcome}
//                 applyRunnerGuess(state, uid, guess) → {state, outcome}

export const TENNIS_TARGET = 11;
export const TENNIS_WIN_BY = 2;

export const DIRECTIONS = ["left", "center", "right"];
export const POWERS = ["soft", "medium", "hard"];

// ---- Apply the hitter's pick (direction + power) ----
// Transitions state from "hitter_pick" → "runner_pick"
export function applyHitterPick(state, uid, pick) {
  if (state.winnerUid) return { state, outcome: "noop" };
  if (state.hitter !== uid) return { state, outcome: "not_your_turn" };
  if (state.phase !== "hitter_pick") return { state, outcome: "wrong_phase" };
  const direction = DIRECTIONS.includes(pick.direction) ? pick.direction : "center";
  const power = POWERS.includes(pick.power) ? pick.power : "medium";
  return {
    state: {
      ...state,
      phase: "runner_pick",
      hitterPick: { direction, power },
    },
    outcome: "hitter_picked",
  };
}

// ---- Apply the runner's guess (direction) ----
// Transitions state from "runner_pick" → "resolved" → next "hitter_pick"
export function applyRunnerGuess(state, uid, guess) {
  if (state.winnerUid) return { state, outcome: "noop" };
  if (state.runner !== uid) return { state, outcome: "not_your_turn" };
  if (state.phase !== "runner_pick") return { state, outcome: "wrong_phase" };
  if (!state.hitterPick) return { state, outcome: "no_hitter_pick" };
  const g = DIRECTIONS.includes(guess) ? guess : "center";
  const { direction: hitDir, power: hitPow } = state.hitterPick;
  let result;
  if (g === hitDir) {
    // Runner guessed correct
    if (hitPow === "hard") {
      // COUNTER — runner gets a point (hitter hit too hard, runner smashed back)
      result = { type: "counter", winner: state.runner };
    } else {
      // RETURN — rally continues, swap roles
      result = { type: "return" };
    }
  } else {
    // Runner guessed wrong → hitter gets a point
    result = { type: "point", winner: state.hitter };
  }
  // Apply the point if any
  const newPlayers = { ...state.players };
  let winnerUid = null;
  if (result.winner) {
    const p = newPlayers[result.winner];
    const newScore = (p.score || 0) + 1;
    newPlayers[result.winner] = { ...p, score: newScore };
    // Check win condition: first to 11 by 2
    const otherUid = Object.keys(newPlayers).find(k => k !== result.winner);
    const otherScore = newPlayers[otherUid].score || 0;
    if (newScore >= TENNIS_TARGET && newScore - otherScore >= TENNIS_WIN_BY) {
      winnerUid = result.winner;
    }
  }
  // Swap roles for next turn (rally continues OR new serve)
  const newHitter = result.type === "return" ? state.runner : state.hitter;
  const newRunner = result.type === "return" ? state.hitter : state.runner;
  return {
    state: {
      ...state,
      players: newPlayers,
      phase: winnerUid ? "resolved" : "hitter_pick",
      hitter: newHitter,
      runner: newRunner,
      hitterPick: null,
      runnerGuess: g,
      lastResult: { ...result, hitter: state.hitter, runner: state.runner, hitterPick: state.hitterPick, runnerGuess: g },
      rallyCount: result.type === "return" ? (state.rallyCount || 0) + 1 : 0,
      winnerUid,
    },
    outcome: result.type,
    result,
    winnerUid,
  };
}

// Is it the given player's turn to hit?
export function isHitter(state, uid) {
  return state && state.phase === "hitter_pick" && state.hitter === uid && !state.winnerUid;
}

// Is it the given player's turn to run?
export function isRunner(state, uid) {
  return state && state.phase === "runner_pick" && state.runner === uid && !state.winnerUid;
}

// Get a player's score
export function getPlayerScore(state, uid) {
  return state?.players?.[uid]?.score || 0;
}

// Get the winner's display name
export function getWinnerName(state) {
  if (!state || !state.winnerUid) return null;
  return state.players[state.winnerUid]?.name || "Player";
}

// Format the last result for display
export function formatResult(lastResult) {
  if (!lastResult) return null;
  const { type, hitter, runner, hitterPick, runnerGuess } = lastResult;
  if (type === "return") {
    return `Return! ${hitterPick.direction}/${hitterPick.power} → guessed ${runnerGuess}. Rally continues.`;
  }
  if (type === "point") {
    return `Point! ${hitter} hit ${hitterPick.direction}/${hitterPick.power}, ${runner} guessed ${runnerGuess}.`;
  }
  if (type === "counter") {
    return `Counter! ${runner} read the hard shot. Point to ${runner}.`;
  }
  return null;
}
