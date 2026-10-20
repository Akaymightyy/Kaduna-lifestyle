// src/penalty_shootout_ui.js — Penalty shoot-out match screen UI.
//
// Plugs into the existing challenge_ui.js match dispatcher. When a match
// has game === "penalty_shootout", this module renders the penalty UI.
//
// Layout (CSS-only — a stylised goal view from the kicker's POV):
//
//   ┌──────────────────────────────────┐
//   │  ⚽ PENALTY SHOOT-OUT  · Round 3/10│
//   ├──────────────────────────────────┤
//   │   You (2)       vs       Opp (1) │
//   ├──────────────────────────────────┤
//   │   ┌────────────────────────┐    │
//   │   │ ╔══════════════════╗   │    │
//   │   │ ║                  ║   │    │  <- goal frame
//   │   │ ║   ● ● ●          ║   │    │  <- target corners (5 dots)
//   │   │ ║                  ║   │    │
//   │   │ ╚══════════════════╝   │    │
//   │   │         ⚽              │    │  <- ball
//   │   └────────────────────────┘    │
//   ├──────────────────────────────────┤
//   │  Last: GOAL! You kicked topright│
//   ├──────────────────────────────────┤
//   │  [Your turn to KICK]              │
//   │  Pick corner:                     │
//   │  [↖ TL] [↗ TR] [↙ BL] [↘ BR] [●C]│
//   │  [⚽ Kick]                        │
//   └──────────────────────────────────┘

import { pushMatchUpdate, declareWinner, resignMatch, subscribeToMatch } from "./challenge_system.js";
import {
  applyKickerPick, applyGoaliePick, isKicker, isGoalie,
  getPlayerScore, getWinnerName, formatResult, cornerLabel,
  CORNERS,
} from "./penalty_shootout.js";

let _ctx = null;
let _matchEl = null;
let _currentMatchId = null;
let _currentMatchState = null;
let _unsubMatch = null;
let _pickedCorner = "center";

export function initPenaltyUI(ctx) {
  _ctx = ctx;
}

// Called by challenge_ui.js when a match with game === "penalty_shootout" is opened.
export function openPenaltyMatchScreen(matchId) {
  _currentMatchId = matchId;
  if (!_matchEl) {
    _matchEl = document.createElement("div");
    _matchEl.id = "penalty-match";
    _matchEl.style.cssText =
      "position:fixed;inset:0;z-index:50;display:none;flex-direction:column;" +
      "background:radial-gradient(circle at 50% 30%,#1a3b2a,#0a1a14);color:#fff;" +
      "font-family:Poppins,system-ui,sans-serif;overflow-y:auto;";
    document.body.appendChild(_matchEl);
  }
  _matchEl.style.display = "flex";
  if (_unsubMatch) _unsubMatch();
  _unsubMatch = subscribeToMatch(matchId, (state) => {
    _currentMatchState = state;
    _renderPenalty(state);
  });
}

function _renderPenalty(state) {
  if (!state || !_matchEl) return;
  const myUid = _ctx?.getMyUid?.() || "";
  const myName = state.players[myUid]?.name || "You";
  const otherUid = Object.keys(state.players).find(k => k !== myUid);
  const otherName = state.players[otherUid]?.name || "Opponent";
  const myScore = getPlayerScore(state, myUid);
  const otherScore = getPlayerScore(state, otherUid);
  const myKicker = isKicker(state, myUid);
  const myGoalie = isGoalie(state, myUid);
  const winner = state.winnerUid;
  const isWinner = winner === myUid;
  const round = state.round || 0;
  const totalRounds = (state.target || 5) * 2;
  const suddenDeath = state.suddenDeath;
  const resultStr = formatResult(state.lastResult);

  // Win/lose screen
  if (winner) {
    _matchEl.innerHTML = `
      <style>
        #penalty-match .pm-wrap { max-width:520px;margin:0 auto;padding:20px 16px calc(40px + env(safe-area-inset-bottom));text-align:center; }
        #penalty-match .pm-trophy { font-size:80px;line-height:1;margin:20px 0;animation:pm-bounce 1s ease infinite; }
        @keyframes pm-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        #penalty-match .pm-result { font-size:22px;font-weight:800;color:${isWinner ? '#4ade80' : '#e11d48'};margin:12px 0; }
        #penalty-match .pm-payout { font-size:14px;color:#f2b134;font-weight:600;margin:6px 0 20px; }
        #penalty-match .pm-close { width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(145deg,#f2b134,#d98e2b);color:#1a1a1a;font:700 14px Poppins,sans-serif;cursor:pointer; }
      </style>
      <div class="pm-wrap">
        <div class="pm-trophy">${isWinner ? '🏆' : '😔'}</div>
        <div class="pm-result">${isWinner ? 'YOU WIN!' : 'You lose'}</div>
        <div class="pm-payout">${isWinner ? 'You scored more penalties — pot is yours!' : 'Better luck next time'}</div>
        <div style="font-size:11px;color:#9ec9b0;margin-bottom:20px;">
          Final: ${myName} ${myScore} — ${otherScore} ${otherName}
        </div>
        <button class="pm-close" onclick="window._pmClose()">Close</button>
      </div>
    `;
    window._pmClose = _closePenaltyMatchScreen;
    return;
  }

  // In-progress match
  const waitingFor = state.phase === "kicker_pick"
    ? `${state.players[state.kicker]?.name || 'Kicker'} to pick corner`
    : `${state.players[state.goalie]?.name || 'Goalie'} to pick dive`;
  _matchEl.innerHTML = `
    <style>
      #penalty-match .pm-wrap { max-width:520px;margin:0 auto;padding:20px 16px calc(20px + env(safe-area-inset-bottom)); }
      #penalty-match .pm-head { text-align:center;margin-bottom:14px; }
      #penalty-match .pm-title { font-size:18px;font-weight:800;color:#f2b134;text-transform:uppercase;letter-spacing:.4px; }
      #penalty-match .pm-stake { font-size:11px;color:#9ec9b0;margin-top:4px; }
      #penalty-match .pm-players { display:grid;grid-template-columns:1fr auto 1fr;gap:8px;margin:14px 0;align-items:center; }
      #penalty-match .pm-player { text-align:center;padding:10px;border-radius:10px;background:rgba(255,255,255,.05);border:2px solid transparent; }
      #penalty-match .pm-player.me { border-color:#4ade80; }
      #penalty-match .pm-player.active { background:rgba(242,177,52,.15);border-color:#f2b134; }
      #penalty-match .pm-player .name { font-size:12px;font-weight:700;color:#fff; }
      #penalty-match .pm-player .score { font-size:32px;font-weight:800;color:#f2b134;margin:4px 0;line-height:1; }
      #penalty-match .pm-player .label { font-size:10px;color:#9ec9b0;text-transform:uppercase; }
      #penalty-match .pm-vs { font-size:18px;font-weight:700;color:#9ec9b0; }
      #penalty-match .pm-goal { background:linear-gradient(180deg,#2a5a3a 0%,#1a3b2a 100%);border:2px solid #fff;border-radius:12px;height:200px;margin:14px 0;position:relative;overflow:hidden; }
      #penalty-match .pm-goal-frame { position:absolute;left:8%;right:8%;top:15%;bottom:25%;border:3px solid #fff;border-bottom:none;box-shadow:0 0 6px rgba(255,255,255,.5); }
      #penalty-match .pm-net { position:absolute;left:8%;right:8%;top:15%;bottom:25%;background:repeating-linear-gradient(45deg,rgba(255,255,255,.15) 0,rgba(255,255,255,.15) 1px,transparent 1px,transparent 6px); }
      #penalty-match .pm-ball { position:absolute;bottom:10%;left:50%;width:14px;height:14px;background:#fff;border-radius:50%;box-shadow:0 0 6px rgba(255,255,255,.6);transform:translateX(-50%);transition:all .6s ease; }
      #penalty-match .pm-corner-dot { position:absolute;width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,.4); }
      #penalty-match .pm-result { background:rgba(0,0,0,.3);border-left:3px solid #f2b134;border-radius:8px;padding:8px 12px;font-size:12px;color:#e8f0ea;margin:8px 0;min-height:32px; }
      #penalty-match .pm-section { font-size:11px;color:#9ec9b0;text-transform:uppercase;letter-spacing:.5px;margin:14px 0 6px;font-weight:700; }
      #penalty-match .pm-pickrow { display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-bottom:10px; }
      #penalty-match .pm-pick { padding:10px 4px;border-radius:8px;background:#1a3b2a;border:1px solid #2c5240;cursor:pointer;text-align:center;color:#fff;font:600 10px Poppins,sans-serif;line-height:1.2; }
      #penalty-match .pm-pick.selected { border:2px solid #f2b134;background:#2a5240; }
      #penalty-match .pm-actions { display:flex;gap:10px;margin-top:14px;justify-content:center; }
      #penalty-match .pm-btn { padding:14px 24px;border-radius:14px;border:none;font:700 14px Poppins,sans-serif;cursor:pointer;min-width:120px; }
      #penalty-match .pm-btn-kick { background:linear-gradient(145deg,#4ade80,#16a34a);color:#fff; }
      #penalty-match .pm-btn-dive { background:linear-gradient(145deg,#f2b134,#d98e2b);color:#1a1a1a; }
      #penalty-match .pm-btn-resign { background:rgba(225,29,72,.85);color:#fff; }
      #penalty-match .pm-waiting { text-align:center;font-size:13px;color:#9ec9b0;font-style:italic;padding:20px;background:rgba(255,255,255,.05);border-radius:10px;margin:10px 0; }
    </style>
    <div class="pm-wrap">
      <div class="pm-head">
        <div class="pm-title">⚽ Penalty Shoot-out</div>
        <div class="pm-stake">${suddenDeath ? '⚡ SUDDEN DEATH' : `Round ${round + 1}/${totalRounds}`} · First to score more wins</div>
      </div>
      <div class="pm-players">
        <div class="pm-player me ${myKicker || myGoalie ? 'active' : ''}">
          <div class="name">${myName} (You)</div>
          <div class="score">${myScore}</div>
          <div class="label">${myKicker ? 'Kicking' : myGoalie ? 'Goalie' : 'Goals'}</div>
        </div>
        <div class="pm-vs">vs</div>
        <div class="pm-player ${!myKicker && !myGoalie ? 'active' : ''}">
          <div class="name">${otherName}</div>
          <div class="score">${otherScore}</div>
          <div class="label">${myKicker ? 'Goalie' : myGoalie ? 'Kicking' : 'Goals'}</div>
        </div>
      </div>
      <div class="pm-goal">
        <div class="pm-net"></div>
        <div class="pm-goal-frame"></div>
        <!-- corner dots showing where the kicker can aim -->
        <div class="pm-corner-dot" style="top:15%;left:8%;"></div>
        <div class="pm-corner-dot" style="top:15%;right:8%;"></div>
        <div class="pm-corner-dot" style="top:50%;left:8%;"></div>
        <div class="pm-corner-dot" style="top:50%;right:8%;"></div>
        <div class="pm-corner-dot" style="top:35%;left:50%;transform:translateX(-50%);"></div>
        <div class="pm-ball"></div>
      </div>
      <div class="pm-result">${resultStr || (state.phase === 'kicker_pick' ? `${state.players[state.kicker]?.name} is picking their corner...` : `${state.players[state.goalie]?.name} is picking their dive...`)}</div>
      ${myKicker ? `
        <div class="pm-section">Your turn to KICK — pick corner</div>
        <div class="pm-pickrow">
          ${CORNERS.map(c => `<div class="pm-pick ${_pickedCorner === c ? 'selected' : ''}" onclick="window._pmPick('${c}')">${cornerLabel(c)}</div>`).join("")}
        </div>
        <div class="pm-actions">
          <button class="pm-btn pm-btn-kick" onclick="window._pmKick()">⚽ Kick</button>
          <button class="pm-btn pm-btn-resign" onclick="window._pmResign()">🏳️ Resign</button>
        </div>
      ` : ''}
      ${myGoalie ? `
        <div class="pm-section">Your turn to DIVE — pick corner</div>
        <div class="pm-pickrow">
          ${CORNERS.map(c => `<div class="pm-pick ${_pickedCorner === c ? 'selected' : ''}" onclick="window._pmPick('${c}')">${cornerLabel(c)}</div>`).join("")}
        </div>
        <div class="pm-actions">
          <button class="pm-btn pm-btn-dive" onclick="window._pmDive()">🧤 Dive</button>
          <button class="pm-btn pm-btn-resign" onclick="window._pmResign()">🏳️ Resign</button>
        </div>
      ` : ''}
      ${(!myKicker && !myGoalie && !winner) ? `
        <div class="pm-waiting">⏳ Waiting for ${waitingFor}...</div>
      ` : ''}
    </div>
  `;
  window._pmPick = (c) => { _pickedCorner = c; _renderPenalty(_currentMatchState); };
  window._pmKick = _handleKick;
  window._pmDive = _handleDive;
  window._pmResign = _handleResign;
  window._pmClose = _closePenaltyMatchScreen;
}

async function _handleKick() {
  if (!_currentMatchState || !_currentMatchId) return;
  const myUid = _ctx?.getMyUid?.() || "";
  if (!isKicker(_currentMatchState, myUid)) return;
  const { state: newState } = applyKickerPick(_currentMatchState, myUid, _pickedCorner);
  await pushMatchUpdate(_currentMatchId, {
    phase: newState.phase,
    kickerPick: newState.kickerPick,
  });
  _ctx?.toast?.("⚽ Shot sent! Waiting for goalie to dive...");
}

async function _handleDive() {
  if (!_currentMatchState || !_currentMatchId) return;
  const myUid = _ctx?.getMyUid?.() || "";
  if (!isGoalie(_currentMatchState, myUid)) return;
  const { state: newState, outcome, winnerUid } = applyGoaliePick(_currentMatchState, myUid, _pickedCorner);
  await pushMatchUpdate(_currentMatchId, {
    phase: newState.phase,
    players: newState.players,
    kicker: newState.kicker,
    goalie: newState.goalie,
    kickerPick: newState.kickerPick,
    goaliePick: newState.goaliePick,
    lastResult: newState.lastResult,
    round: newState.round,
    suddenDeath: newState.suddenDeath,
    winnerUid: newState.winnerUid,
  });
  if (winnerUid) {
    await declareWinner(_currentMatchId, winnerUid);
  }
  _pickedCorner = "center";
}

async function _handleResign() {
  if (!_currentMatchId) return;
  if (!confirm("Resign? Your opponent wins.")) return;
  await resignMatch(_currentMatchId);
}

function _closePenaltyMatchScreen() {
  if (_unsubMatch) { _unsubMatch(); _unsubMatch = null; }
  if (_matchEl) _matchEl.style.display = "none";
  _currentMatchId = null;
  _currentMatchState = null;
}
