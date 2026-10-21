// src/bowling_game.js — Turn-based bowling game logic (pure functions).
//
// Simplified rules (turn-based, not real-time physics):
//   2 players take turns as BOWLER.
//   Each turn, the BOWLER picks:
//     - angle: "left" | "center" | "right" (where to aim the ball)
//     - power: "soft" | "medium" | "strike" (how hard to throw)
//   The system rolls the ball down the lane and computes pin knockdowns
//   based on the combination:
//     - center/strike → highest pin count (8-10 pins, chance of STRIKE)
//     - center/medium → good count (5-8 pins)
//     - center/soft → low count (2-5 pins)
//     - left/right → misses some pins (1-6 pins, gutter risk)
//     - left+soft or right+soft → GUTTER (0 pins)
//
//   10 frames per player (standard bowling). Each frame: 2 rolls max
//   (if you don't strike on the first roll, you get a second roll at
//   the remaining pins). STRIKE = all 10 on first roll. SPARE = all 10
//   across 2 rolls. Standard bowling scoring (strike = 10 + next 2 rolls,
//   spare = 10 + next 1 roll).
//
//   Highest total after 10 frames wins.
//
// State shape (stored in Firebase matches/{matchId}):
//   { players: { uid1: {name, score, frames: [[r1, r2], ...]}, uid2: {...} },
//     bowler: uid,
//     phase: "bowl_pick" | "resolving" | "frame_done",
//     frame: 0-9,
//     roll: 0 or 1 (first or second roll of the frame),
//     pinsStanding: 0-10 (remaining pins for the current roll),
//     bowlerPick: { angle, power } | null,
//     lastResult: { pins, strike, spare, gutter, angle, power },
//     winnerUid: null,
//     target: 10 }

export const BOWLING_FRAMES = 10;

export const ANGLES = ["left", "center", "right"];
export const POWERS = ["soft", "medium", "strike"];

// Compute pins knocked down based on angle + power + remaining pins
function _computePins(angle, power, standing) {
  if (standing <= 0) return 0;
  // Gutter chance: left+soft or right+soft = high gutter chance
  if ((angle === "left" || angle === "right") && power === "soft") {
    if (Math.random() < 0.6) return 0;  // gutter ball!
  }
  // Power affects max potential
  let maxPct = power === "strike" ? 1.0 : power === "medium" ? 0.8 : 0.5;
  // Angle reduces accuracy for off-center
  if (angle !== "center") maxPct *= 0.75;
  // Random factor (skill + luck)
  const rng = 0.3 + Math.random() * 0.7;  // 0.3 to 1.0
  const pins = Math.min(standing, Math.round(standing * maxPct * rng));
  // STRIKE chance: center+strike with 10 standing
  if (angle === "center" && power === "strike" && standing === 10 && Math.random() < 0.4) {
    return 10;  // STRIKE!
  }
  return pins;
}

export function applyBowlerPick(state, uid, pick) {
  if (state.winnerUid) return { state, outcome: "noop" };
  if (state.bowler !== uid) return { state, outcome: "not_your_turn" };
  if (state.phase !== "bowl_pick") return { state, outcome: "wrong_phase" };
  const angle = ANGLES.includes(pick.angle) ? pick.angle : "center";
  const power = POWERS.includes(pick.power) ? pick.power : "medium";
  const standing = state.pinsStanding || 10;
  const pins = _computePins(angle, power, standing);
  const isStrike = state.roll === 0 && pins === standing && standing === 10;
  const isSpare = state.roll === 1 && (state.framePins || 0) + pins === 10;
  const isGutter = pins === 0;
  // Update player's frame
  const newPlayers = { ...state.players };
  const playerData = { ...newPlayers[uid] };
  const frames = [...(playerData.frames || [])];
  const curFrame = state.roll === 0 ? [] : (frames[state.frame] || []);
  curFrame.push(pins);
  frames[state.frame] = curFrame;
  playerData.frames = frames;
  // Recalculate total score (simplified — just sum all pins + bonuses)
  playerData.score = _calcScore(frames);
  newPlayers[uid] = playerData;
  // Decide what happens next
  let newPhase, newRoll, newFrame, newPins, newBowler, winnerUid = null;
  if (isStrike || state.roll === 1 || pins === standing) {
    // Frame complete — switch bowler or advance frame
    if (state.frame >= BOWLING_FRAMES - 1 && state.bowler === _otherPlayer(state, uid)) {
      // Game over
      newPhase = "resolved";
      const [a, b] = Object.keys(newPlayers);
      winnerUid = newPlayers[a].score >= newPlayers[b].score ? a : b;
    } else {
      // Next frame or next player
      newFrame = state.bowler === _otherPlayer(state, uid) ? state.frame + 1 : state.frame;
      newBowler = _otherPlayer(state, uid);
      newRoll = 0;
      newPins = 10;
      newPhase = "bowl_pick";
    }
  } else {
    // Same player, second roll
    newFrame = state.frame;
    newBowler = uid;
    newRoll = 1;
    newPins = standing - pins;
    newPhase = "bowl_pick";
  }
  return {
    state: {
      ...state,
      players: newPlayers,
      bowler: newBowler || uid,
      phase: newPhase,
      frame: newFrame ?? state.frame,
      roll: newRoll ?? 0,
      pinsStanding: newPins ?? 10,
      framePins: (state.roll === 0 ? 0 : (state.framePins || 0)) + pins,
      bowlerPick: { angle, power },
      lastResult: { pins, strike: isStrike, spare: isSpare, gutter: isGutter, angle, power },
      winnerUid,
    },
    outcome: isStrike ? "strike" : isSpare ? "spare" : isGutter ? "gutter" : "hit",
    pins,
    winnerUid,
  };
}

function _otherPlayer(state, uid) {
  return Object.keys(state.players).find(k => k !== uid);
}

// Simplified bowling score calculation
function _calcScore(frames) {
  let total = 0;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i] || [];
    const r1 = f[0] || 0, r2 = f[1] || 0;
    if (r1 === 10) {
      // Strike: 10 + next 2 rolls
      const next = frames[i + 1] || [];
      const next2 = frames[i + 2] || [];
      total += 10 + (next[0] || 0) + (next[1] || next2[0] || 0);
    } else if (r1 + r2 === 10) {
      // Spare: 10 + next 1 roll
      const next = frames[i + 1] || [];
      total += 10 + (next[0] || 0);
    } else {
      total += r1 + r2;
    }
  }
  return total;
}

export function isBowler(state, uid) {
  return state && state.phase === "bowl_pick" && state.bowler === uid && !state.winnerUid;
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
  const { pins, strike, spare, gutter, angle, power } = lastResult;
  if (strike) return "🎯 STRIKE! All 10 pins down on the first roll!";
  if (spare) return "✅ SPARE! Cleared all remaining pins in 2 rolls.";
  if (gutter) return "💨 GUTTER BALL! 0 pins. Try a different angle.";
  return `🎳 Hit ${pins} pin${pins === 1 ? "" : "s"} (${angle}/${power}).`;
}
