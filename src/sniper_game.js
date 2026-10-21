// src/sniper_game.js — Turn-based sniper duel game logic (pure functions).
//
// SIMPLIFIED RULES (turn-based, not real-time FPS):
//   2 players take turns as SHOOTER and TARGET.
//   On each turn, the SHOOTER picks:
//     - aimPosition: "head" | "chest" | "legs"  (where they aim)
//     - aimSide: "left" | "center" | "right"  (lateral position)
//   The TARGET picks:
//     - dodgeSide: "left" | "center" | "right"  (which way to dodge)
//     - posture: "standing" | "crouch" | "prone"  (smaller profile = harder to hit)
//
//   Resolution:
//     - If shooter's aimSide === target's dodgeSide AND target's posture matches aimPosition:
//         HIT (full damage)
//     - If shooter's aimSide === target's dodgeSide:
//         HIT (reduced damage based on posture mismatch)
//     - If shooter's aimSide !== target's dodgeSide:
//         MISS (target dodged)
//
//   Damage:
//     - head hit: 50 HP
//     - chest hit: 30 HP (headshot bonus)
//     - legs hit: 20 HP
//   Posture bonus: crouch reduces damage by 25%, prone by 50%
//
//   Hide bonus: if target posture is "prone" AND on a grass map → 30% miss chance
//
//   Starting HP: 100. First to reduce opponent to 0 HP wins.
//
// State shape (stored in Firebase matches/{matchId}):
//   { players: { uid1: {name, hp}, uid2: {name, hp} },
//     shooter: uid, target: uid,
//     phase: "shooter_pick" | "target_pick" | "resolved",
//     shooterPick: { aimPosition, aimSide } | null,
//     targetPick: { dodgeSide, posture } | null,
//     lastResult: { type: "hit"|"miss", damage, aimPosition, aimSide, dodgeSide, posture, headshot } ,
//     round: number,
//     mapId: "maize" | "rooftops" | "river",
//     winnerUid: null,
//     maxHp: 100 }

export const SNIPER_MAX_HP = 100;

export const AIM_POSITIONS = ["head", "chest", "legs"];
export const AIM_SIDES = ["left", "center", "right"];
export const DODGE_SIDES = ["left", "center", "right"];
export const POSTURES = ["standing", "crouch", "prone"];

export const MAPS = [
  { id: "maize", name: "Kawo Maize Farm", emoji: "🌾", color: "#2a5a2a", desc: "Tall grass — prone targets hard to see" },
  { id: "rooftops", name: "Barnawa Rooftops", emoji: "🏙️", color: "#3a3a3a", desc: "Urban cover — concrete + AC units" },
  { id: "river", name: "River Kaduna Banks", emoji: "🌊", color: "#1a3a5a", desc: "Open banks — long sight lines" },
];

export function getMap(id) {
  return MAPS.find(m => m.id === id) || MAPS[0];
}

// ---- Apply shooter's pick (aim position + aim side) ----
// Transitions state from "shooter_pick" → "target_pick"
export function applyShooterPick(state, uid, pick) {
  if (state.winnerUid) return { state, outcome: "noop" };
  if (state.shooter !== uid) return { state, outcome: "not_your_turn" };
  if (state.phase !== "shooter_pick") return { state, outcome: "wrong_phase" };
  const aimPosition = AIM_POSITIONS.includes(pick.aimPosition) ? pick.aimPosition : "chest";
  const aimSide = AIM_SIDES.includes(pick.aimSide) ? pick.aimSide : "center";
  return {
    state: { ...state, phase: "target_pick", shooterPick: { aimPosition, aimSide } },
    outcome: "shooter_picked",
  };
}

// ---- Apply target's pick (dodge side + posture) + resolve round ----
// Transitions state from "target_pick" → "resolved" → next "shooter_pick"
export function applyTargetPick(state, uid, pick) {
  if (state.winnerUid) return { state, outcome: "noop" };
  if (state.target !== uid) return { state, outcome: "not_your_turn" };
  if (state.phase !== "target_pick") return { state, outcome: "wrong_phase" };
  if (!state.shooterPick) return { state, outcome: "no_shooter_pick" };
  const dodgeSide = DODGE_SIDES.includes(pick.dodgeSide) ? pick.dodgeSide : "center";
  const posture = POSTURES.includes(pick.posture) ? pick.posture : "standing";
  const { aimPosition, aimSide } = state.shooterPick;
  // Compute hit/miss
  let isHit = aimSide === dodgeSide;
  let damage = 0;
  let headshot = false;
  // Maize map: prone posture has a 30% miss chance even if aim is correct
  if (isHit && state.mapId === "maize" && posture === "prone" && Math.random() < 0.3) {
    isHit = false;
  }
  if (isHit) {
    // Base damage by aim position
    const baseDamage = aimPosition === "head" ? 50 : aimPosition === "chest" ? 30 : 20;
    headshot = aimPosition === "head";
    // Posture damage reduction (smaller profile = less damage taken)
    const reduction = posture === "crouch" ? 0.25 : posture === "prone" ? 0.5 : 0;
    damage = Math.round(baseDamage * (1 - reduction));
  }
  // Apply damage to target's HP
  const newPlayers = { ...state.players };
  let winnerUid = null;
  if (isHit) {
    const t = newPlayers[state.target];
    const newHp = Math.max(0, (t.hp || 0) - damage);
    newPlayers[state.target] = { ...t, hp: newHp };
    if (newHp <= 0) {
      winnerUid = state.shooter;
    }
  }
  // Swap roles for next round
  const newShooter = state.target;
  const newTarget = state.shooter;
  return {
    state: {
      ...state,
      players: newPlayers,
      phase: winnerUid ? "resolved" : "shooter_pick",
      shooter: newShooter,
      target: newTarget,
      shooterPick: null,
      targetPick: { dodgeSide, posture },
      lastResult: {
        type: isHit ? "hit" : "miss",
        damage,
        aimPosition,
        aimSide,
        dodgeSide,
        posture,
        headshot,
        shooter: state.shooter,
        target: state.target,
      },
      round: state.round + 1,
      winnerUid,
    },
    outcome: isHit ? (headshot ? "headshot" : "hit") : "miss",
    damage,
    winnerUid,
  };
}

export function isShooter(state, uid) {
  return state && state.phase === "shooter_pick" && state.shooter === uid && !state.winnerUid;
}

export function isTarget(state, uid) {
  return state && state.phase === "target_pick" && state.target === uid && !state.winnerUid;
}

export function getPlayerHp(state, uid) {
  return state?.players?.[uid]?.hp || 0;
}

export function getWinnerName(state) {
  if (!state || !state.winnerUid) return null;
  return state.players[state.winnerUid]?.name || "Player";
}

export function formatResult(lastResult) {
  if (!lastResult) return null;
  const { type, damage, aimPosition, aimSide, dodgeSide, posture, headshot, shooter, target } = lastResult;
  if (type === "hit") {
    return `${headshot ? '💀 HEADSHOT! ' : '🎯 HIT! '}${shooter} aimed ${aimPosition}/${aimSide}. ${target} dodged ${dodgeSide} in ${posture}. -${damage} HP.`;
  }
  return `💨 MISS. ${shooter} aimed ${aimPosition}/${aimSide}. ${target} dodged ${dodgeSide}.`;
}
