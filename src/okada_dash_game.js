// src/okada_dash_game.js — Turn-based Okada Dash endless runner (pure functions).
//
// Simplified rules (turn-based, not real-time):
//   2 players take turns as RIDER.
//   Each turn, the RIDER picks:
//     - lane: "left" | "center" | "right" (which lane to ride in)
//     - action: "dodge" | "collect" | "boost" (what to do this turn)
//   The system generates obstacles + stars based on difficulty.
//   Resolution:
//     - dodge: avoid obstacles in current lane (safe, no stars collected)
//     - collect: collect stars in current lane (score +2 per star, but 30% crash chance if obstacle present)
//     - boost: speed up (score +5, but 40% crash chance if obstacle in next lane)
//   Crash = lose 3 points + switch player.
//   5 rounds per player. Highest total score wins.
//
// State shape (stored in Firebase matches/{matchId}):
//   { players: { uid1: {name, score}, uid2: {name, score} },
//     rider: uid,
//     phase: "ride_pick" | "resolved",
//     round: 0-4,
//     riderPick: { lane, action } | null,
//     lastResult: { type: "collect"|"dodge"|"boost"|"crash", points, lane, action, obstacle, stars },
//     winnerUid: null,
//     target: 5 }

export const OKADA_ROUNDS = 5;
export const LANES = ["left", "center", "right"];
export const ACTIONS = ["dodge", "collect", "boost"];

// Generate a random scenario for the round: which lane has an obstacle, which has stars
function _generateScenario() {
  const obstacleLane = LANES[Math.floor(Math.random() * 3)];
  const starLane = LANES[Math.floor(Math.random() * 3)];
  return { obstacleLane, starLane, hasStars: starLane !== obstacleLane || Math.random() < 0.5 };
}

export function applyRiderPick(state, uid, pick) {
  if (state.winnerUid) return { state, outcome: "noop" };
  if (state.rider !== uid) return { state, outcome: "not_your_turn" };
  if (state.phase !== "ride_pick") return { state, outcome: "wrong_phase" };
  const lane = LANES.includes(pick.lane) ? pick.lane : "center";
  const action = ACTIONS.includes(pick.action) ? pick.action : "dodge";
  const scenario = _generateScenario();
  let points = 0, result;
  if (action === "dodge") {
    // Safe — no points, no crash
    result = { type: "dodge", points: 0, lane, action, obstacle: scenario.obstacleLane, stars: 0 };
  } else if (action === "collect") {
    if (lane === scenario.obstacleLane && Math.random() < 0.3) {
      // CRASH — hit obstacle while trying to collect
      points = -3;
      result = { type: "crash", points, lane, action, obstacle: scenario.obstacleLane, stars: 0 };
    } else if (lane === scenario.starLane && scenario.hasStars) {
      // Collected stars!
      points = 2;
      result = { type: "collect", points, lane, action, obstacle: scenario.obstacleLane, stars: 1 };
    } else {
      // No stars in this lane
      result = { type: "collect", points: 0, lane, action, obstacle: scenario.obstacleLane, stars: 0 };
    }
  } else if (action === "boost") {
    if (lane === scenario.obstacleLane && Math.random() < 0.4) {
      // CRASH — hit obstacle while boosting
      points = -3;
      result = { type: "crash", points, lane, action, obstacle: scenario.obstacleLane, stars: 0 };
    } else {
      // Boost success — bonus points
      points = 5;
      result = { type: "boost", points, lane, action, obstacle: scenario.obstacleLane, stars: 0 };
    }
  }
  // Update score
  const newPlayers = { ...state.players };
  const pd = { ...newPlayers[uid] };
  pd.score = Math.max(0, (pd.score || 0) + points);
  newPlayers[uid] = pd;
  // Check end of game
  let winnerUid = null;
  const newRound = state.round + 1;
  if (newRound >= OKADA_ROUNDS) {
    const [a, b] = Object.keys(newPlayers);
    if (newPlayers[a].score > newPlayers[b].score) winnerUid = a;
    else if (newPlayers[b].score > newPlayers[a].score) winnerUid = b;
  }
  const otherUid = Object.keys(state.players).find(k => k !== uid);
  return {
    state: {
      ...state,
      players: newPlayers,
      rider: winnerUid ? uid : otherUid,
      phase: winnerUid ? "resolved" : "ride_pick",
      round: newRound,
      riderPick: { lane, action },
      lastResult: { ...result, rider: uid },
      winnerUid,
    },
    outcome: result.type,
    points,
    winnerUid,
  };
}

export function isRider(state, uid) {
  return state && state.phase === "ride_pick" && state.rider === uid && !state.winnerUid;
}
export function getPlayerScore(state, uid) { return state?.players?.[uid]?.score || 0; }
export function getWinnerName(state) {
  if (!state || !state.winnerUid) return null;
  return state.players[state.winnerUid]?.name || "Player";
}
export function formatResult(lastResult) {
  if (!lastResult) return null;
  const { type, points, lane, action } = lastResult;
  if (type === "crash") return "💥 CRASH! Hit an obstacle. -3 points.";
  if (type === "boost") return "🚀 BOOST! Speed bonus! +5 points.";
  if (type === "collect") return points > 0 ? "⭐ Collected a star! +2 points." : "💨 No stars in this lane. Try another lane.";
  return "🛺 Safe dodge. No points, no crash.";
}
