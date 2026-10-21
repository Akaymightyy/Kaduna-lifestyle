// src/pool_game.js — Turn-based pool/snooker game logic (pure functions).
//
// Simplified rules (turn-based, not real-time physics):
//   2 players take turns as SHOOTER.
//   Each turn, the SHOOTER picks:
//     - angle: "left" | "center" | "right" (where to aim the cue)
//     - power: "soft" | "medium" | "hard" (how hard to hit)
//   The system computes which balls get potted based on the combination.
//   Resolution:
//     - If angle+power matches a potting line → POT a ball (score +1)
//     - If miss → no pot, switch player
//     - If scratch (pot the cue ball) → -1 point + switch player
//
//   8 balls per player (solids vs stripes). First to pot all 7 of their
//   balls + the 8-ball wins. Simplified: 7 balls each, no 8-ball (just
//   highest score after 7 rounds of 3 shots each wins).
//
//   For MVP: 7 rounds, each player gets 1 shot per round. Most balls
//   potted after 7 rounds wins.
//
// State shape (stored in Firebase matches/{matchId}):
//   { players: { uid1: {name, score, potted: 0}, uid2: {...} },
//     shooter: uid,
//     phase: "shoot_pick" | "resolved",
//     round: 0-6,
//     shooterPick: { angle, power } | null,
//     lastResult: { type: "pot"|"miss"|"scratch", balls, angle, power },
//     winnerUid: null,
//     target: 7 }

export const POOL_ROUNDS = 7;

export const ANGLES = ["left", "center", "right"];
export const POWERS = ["soft", "medium", "hard"];

// Potting table: which angle+power combinations are most likely to pot
// a ball. Higher = more likely. 0 = guaranteed miss.
const POTTING_TABLE = {
  // angle: { power: potChance (0..1) }
  left:   { soft: 0.15, medium: 0.40, hard: 0.55 },
  center: { soft: 0.25, medium: 0.60, hard: 0.70 },
  right:  { soft: 0.15, medium: 0.40, hard: 0.55 },
};

// Scratch chance: harder power = higher scratch (potting cue ball) chance
const SCRATCH_CHANCE = { soft: 0.02, medium: 0.08, hard: 0.18 };

export function applyShooterPick(state, uid, pick) {
  if (state.winnerUid) return { state, outcome: "noop" };
  if (state.shooter !== uid) return { state, outcome: "not_your_turn" };
  if (state.phase !== "shoot_pick") return { state, outcome: "wrong_phase" };
  const angle = ANGLES.includes(pick.angle) ? pick.angle : "center";
  const power = POWERS.includes(pick.power) ? pick.power : "medium";
  const potChance = (POTTING_TABLE[angle] || {})[power] || 0.3;
  const scratchChance = SCRATCH_CHANCE[power] || 0.08;
  // Roll the dice
  const roll = Math.random();
  let result;
  if (roll < scratchChance) {
    // SCRATCH — potted the cue ball! -1 point
    result = { type: "scratch", balls: 0, angle, power };
  } else if (roll < scratchChance + potChance) {
    // POT — potted a ball! +1 point
    result = { type: "pot", balls: 1, angle, power };
  } else {
    // MISS — no pot
    result = { type: "miss", balls: 0, angle, power };
  }
  // Update player score
  const newPlayers = { ...state.players };
  const playerData = { ...newPlayers[uid] };
  if (result.type === "pot") {
    playerData.score = (playerData.score || 0) + 1;
    playerData.potted = (playerData.potted || 0) + 1;
  } else if (result.type === "scratch") {
    playerData.score = Math.max(0, (playerData.score || 0) - 1);
  }
  newPlayers[uid] = playerData;
  // Check end of game
  let winnerUid = null;
  const newRound = state.round + 1;
  if (newRound >= POOL_ROUNDS) {
    // Game over — highest score wins
    const [a, b] = Object.keys(newPlayers);
    if (newPlayers[a].score > newPlayers[b].score) winnerUid = a;
    else if (newPlayers[b].score > newPlayers[a].score) winnerUid = b;
    // If tie → the player who potted more balls wins (already handled by score)
  }
  // Switch shooter
  const otherUid = Object.keys(state.players).find(k => k !== uid);
  return {
    state: {
      ...state,
      players: newPlayers,
      shooter: winnerUid ? uid : otherUid,
      phase: winnerUid ? "resolved" : "shoot_pick",
      round: newRound,
      shooterPick: { angle, power },
      lastResult: { ...result, shooter: uid },
      winnerUid,
    },
    outcome: result.type,
    winnerUid,
  };
}

export function isShooter(state, uid) {
  return state && state.phase === "shoot_pick" && state.shooter === uid && !state.winnerUid;
}

export function getPlayerScore(state, uid) {
  return state?.players?.[uid]?.score || 0;
}

export function getWinnerName(state) {
  if (!state || !state.winnerUid) return null;
  return state.players[state.winnerUid]?.name || "Player";
}

export function formatResult(lastResult) {
  if (!lastResult) return null;
  const { type, angle, power } = lastResult;
  if (type === "pot") return "🎱 POT! Ball in the pocket. +1 point!";
  if (type === "scratch") return "😱 SCRATCH! You potted the cue ball. -1 point.";
  return "💨 MISS. No ball potted. Try a different angle.";
}
