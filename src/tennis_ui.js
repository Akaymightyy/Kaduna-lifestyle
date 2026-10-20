// src/tennis_ui.js — Tennis match screen UI.
//
// Plugs into the existing challenge_ui.js match dispatcher. When a match
// has game === "tennis", this module renders the tennis match UI instead
// of the Capital Dice UI.
//
// Layout (CSS-only — no 3D tennis court for MVP, but a stylised top-down
// view of the court with both players on either side):
//
//   ┌──────────────────────────────────┐
//   │  🎾 TENNIS  · First to 11 wins    │
//   │  Pot: ₦50,000 · Rally: 3 shots   │
//   ├──────────────────────────────────┤
//   │   You (4)        vs        Opp (2)│
//   ├──────────────────────────────────┤
//   │                                  │
//   │   ┌─────────────────────────┐   │
//   │   │  ●  (opponent)            │   │
//   │   │                           │   │
//   │   │     ═══════════ net       │   │
//   │   │                           │   │
//   │   │              ● (you)      │   │
//   │   └─────────────────────────┘   │
//   │                                  │
//   ├──────────────────────────────────┤
//   │  Last: Point! You hit right/medium│
//   ├──────────────────────────────────┤
//   │  [Your turn to HIT]               │
//   │  Direction: ◀ Left  ● Center  ▶ Right │
//   │  Power: Soft  ● Medium  Hard      │
//   │  [🎾 Hit the ball]                │
//   └──────────────────────────────────┘

import { pushMatchUpdate, declareWinner, resignMatch, subscribeToMatch } from "./challenge_system.js";
import {
  applyHitterPick, applyRunnerGuess, isHitter, isRunner,
  getPlayerScore, getWinnerName, formatResult,
  DIRECTIONS, POWERS,
} from "./tennis_game.js";

let _ctx = null;
let _matchEl = null;
let _currentMatchId = null;
let _currentMatchState = null;
let _unsubMatch = null;
let _pickedDirection = "center";
let _pickedPower = "medium";

export function initTennisUI(ctx) {
  _ctx = ctx;
}

// Called by challenge_ui.js when a match with game === "tennis" is opened.
export function openTennisMatchScreen(matchId) {
  _currentMatchId = matchId;
  if (!_matchEl) {
    _matchEl = document.createElement("div");
    _matchEl.id = "tennis-match";
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
    _renderTennis(state);
  });
}

function _renderTennis(state) {
  if (!state || !_matchEl) return;
  const myUid = _ctx?.getMyUid?.() || "";
  const myName = state.players[myUid]?.name || "You";
  const otherUid = Object.keys(state.players).find(k => k !== myUid);
  const otherName = state.players[otherUid]?.name || "Opponent";
  const myScore = getPlayerScore(state, myUid);
  const otherScore = getPlayerScore(state, otherUid);
  const myHitter = isHitter(state, myUid);
  const myRunner = isRunner(state, myUid);
  const winner = state.winnerUid;
  const isWinner = winner === myUid;
  const rallyCount = state.rallyCount || 0;
  const resultStr = formatResult(state.lastResult);

  // Win/lose screen
  if (winner) {
    _matchEl.innerHTML = `
      <style>
        #tennis-match .tm-wrap { max-width:520px;margin:0 auto;padding:20px 16px calc(40px + env(safe-area-inset-bottom));text-align:center; }
        #tennis-match .tm-trophy { font-size:80px;line-height:1;margin:20px 0;animation:tm-bounce 1s ease infinite; }
        @keyframes tm-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        #tennis-match .tm-result { font-size:22px;font-weight:800;color:${isWinner ? '#4ade80' : '#e11d48'};margin:12px 0; }
        #tennis-match .tm-payout { font-size:14px;color:#f2b134;font-weight:600;margin:6px 0 20px; }
        #tennis-match .tm-close { width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(145deg,#f2b134,#d98e2b);color:#1a1a1a;font:700 14px Poppins,sans-serif;cursor:pointer; }
      </style>
      <div class="tm-wrap">
        <div class="tm-trophy">${isWinner ? '🏆' : '😔'}</div>
        <div class="tm-result">${isWinner ? 'YOU WIN!' : 'You lose'}</div>
        <div class="tm-payout">${isWinner ? 'Match point — you took the pot!' : 'Better luck next time'}</div>
        <div style="font-size:11px;color:#9ec9b0;margin-bottom:20px;">
          Final: ${myName} ${myScore} — ${otherScore} ${otherName}
        </div>
        <button class="tm-close" onclick="window._tmClose()">Close</button>
      </div>
    `;
    window._tmClose = _closeTennisMatchScreen;
    return;
  }

  // In-progress match
  const waitingFor = state.phase === "hitter_pick" ? `${state.players[state.hitter]?.name || 'Hitter'} to pick` : `${state.players[state.runner]?.name || 'Runner'} to guess`;
  _matchEl.innerHTML = `
    <style>
      #tennis-match .tm-wrap { max-width:520px;margin:0 auto;padding:20px 16px calc(20px + env(safe-area-inset-bottom)); }
      #tennis-match .tm-head { text-align:center;margin-bottom:14px; }
      #tennis-match .tm-title { font-size:18px;font-weight:800;color:#f2b134;text-transform:uppercase;letter-spacing:.4px; }
      #tennis-match .tm-stake { font-size:11px;color:#9ec9b0;margin-top:4px; }
      #tennis-match .tm-players { display:grid;grid-template-columns:1fr auto 1fr;gap:8px;margin:14px 0;align-items:center; }
      #tennis-match .tm-player { text-align:center;padding:10px;border-radius:10px;background:rgba(255,255,255,.05);border:2px solid transparent; }
      #tennis-match .tm-player.me { border-color:#4ade80; }
      #tennis-match .tm-player.active { background:rgba(242,177,52,.15);border-color:#f2b134; }
      #tennis-match .tm-player .name { font-size:12px;font-weight:700;color:#fff; }
      #tennis-match .tm-player .score { font-size:32px;font-weight:800;color:#f2b134;margin:4px 0;line-height:1; }
      #tennis-match .tm-player .label { font-size:10px;color:#9ec9b0;text-transform:uppercase; }
      #tennis-match .tm-vs { font-size:18px;font-weight:700;color:#9ec9b0; }
      #tennis-match .tm-court { background:linear-gradient(180deg,#2a5a3a 0%,#2a5a3a 50%,#2a5a3a 100%);border:2px solid #fff;border-radius:12px;height:180px;margin:14px 0;position:relative;overflow:hidden; }
      #tennis-match .tm-net { position:absolute;left:0;right:0;top:50%;height:4px;background:#fff;box-shadow:0 0 4px rgba(255,255,255,.6);transform:translateY(-50%); }
      #tennis-match .tm-ball { position:absolute;width:14px;height:14px;background:#fff070;border-radius:50%;box-shadow:0 0 8px rgba(255,240,112,.8);transition:all .6s ease;top:50%;left:50%;transform:translate(-50%,-50%); }
      #tennis-match .tm-dot { position:absolute;width:18px;height:18px;border-radius:50%;border:2px solid #fff; }
      #tennis-match .tm-dot.me { background:#4ade80;top:75%;left:50%;transform:translate(-50%,-50%); }
      #tennis-match .tm-dot.opp { background:#e11d48;top:25%;left:50%;transform:translate(-50%,-50%); }
      #tennis-match .tm-result { background:rgba(0,0,0,.3);border-left:3px solid #f2b134;border-radius:8px;padding:8px 12px;font-size:12px;color:#e8f0ea;margin:8px 0;min-height:32px; }
      #tennis-match .tm-section { font-size:11px;color:#9ec9b0;text-transform:uppercase;letter-spacing:.5px;margin:14px 0 6px;font-weight:700; }
      #tennis-match .tm-pickrow { display:flex;gap:6px;margin-bottom:8px; }
      #tennis-match .tm-pick { flex:1;padding:10px;border-radius:8px;background:#1a3b2a;border:1px solid #2c5240;cursor:pointer;text-align:center;color:#fff;font:600 12px Poppins,sans-serif; }
      #tennis-match .tm-pick.selected { border:2px solid #f2b134;background:#2a5240; }
      #tennis-match .tm-actions { display:flex;gap:10px;margin-top:14px;justify-content:center; }
      #tennis-match .tm-btn { padding:14px 24px;border-radius:14px;border:none;font:700 14px Poppins,sans-serif;cursor:pointer;min-width:120px; }
      #tennis-match .tm-btn-hit { background:linear-gradient(145deg,#4ade80,#16a34a);color:#fff; }
      #tennis-match .tm-btn-guess { background:linear-gradient(145deg,#f2b134,#d98e2b);color:#1a1a1a; }
      #tennis-match .tm-btn-resign { background:rgba(225,29,72,.85);color:#fff; }
      #tennis-match .tm-waiting { text-align:center;font-size:13px;color:#9ec9b0;font-style:italic;padding:20px;background:rgba(255,255,255,.05);border-radius:10px;margin:10px 0; }
    </style>
    <div class="tm-wrap">
      <div class="tm-head">
        <div class="tm-title">🎾 Tennis</div>
        <div class="tm-stake">First to ${state.target || 11} (win by 2) · Rally: ${rallyCount}</div>
      </div>
      <div class="tm-players">
        <div class="tm-player me ${myHitter || myRunner ? 'active' : ''}">
          <div class="name">${myName} (You)</div>
          <div class="score">${myScore}</div>
          <div class="label">${myHitter ? 'Hitting' : myRunner ? 'Running' : 'Score'}</div>
        </div>
        <div class="tm-vs">vs</div>
        <div class="tm-player ${!myHitter && !myRunner ? 'active' : ''}">
          <div class="name">${otherName}</div>
          <div class="score">${otherScore}</div>
          <div class="label">${myHitter ? 'Running' : myRunner ? 'Hitting' : 'Score'}</div>
        </div>
      </div>
      <div class="tm-court">
        <div class="tm-net"></div>
        <div class="tm-dot opp"></div>
        <div class="tm-dot me"></div>
        <div class="tm-ball"></div>
      </div>
      <div class="tm-result">${resultStr || (state.phase === 'hitter_pick' ? `${state.players[state.hitter]?.name} is picking their shot...` : `${state.players[state.runner]?.name} is guessing where to run...`)}</div>
      ${myHitter ? `
        <div class="tm-section">Your turn to HIT — pick direction + power</div>
        <div class="tm-section">Direction</div>
        <div class="tm-pickrow">
          ${DIRECTIONS.map(d => `<div class="tm-pick ${_pickedDirection === d ? 'selected' : ''}" data-dir="${d}" onclick="window._tmPickDir('${d}')">${d === 'left' ? '◀ Left' : d === 'right' ? 'Right ▶' : '● Center'}</div>`).join("")}
        </div>
        <div class="tm-section">Power</div>
        <div class="tm-pickrow">
          ${POWERS.map(p => `<div class="tm-pick ${_pickedPower === p ? 'selected' : ''}" data-pow="${p}" onclick="window._tmPickPow('${p}')">${p}</div>`).join("")}
        </div>
        <div class="tm-actions">
          <button class="tm-btn tm-btn-hit" onclick="window._tmHit()">🎾 Hit the ball</button>
          <button class="tm-btn tm-btn-resign" onclick="window._tmResign()">🏳️ Resign</button>
        </div>
      ` : ''}
      ${myRunner ? `
        <div class="tm-section">Your turn to RUN — guess where the ball will go</div>
        <div class="tm-pickrow">
          ${DIRECTIONS.map(d => `<div class="tm-pick ${_pickedDirection === d ? 'selected' : ''}" data-dir="${d}" onclick="window._tmPickDir('${d}')">${d === 'left' ? '◀ Left' : d === 'right' ? 'Right ▶' : '● Center'}</div>`).join("")}
        </div>
        <div class="tm-actions">
          <button class="tm-btn tm-btn-guess" onclick="window._tmGuess()">🏃 Run there</button>
          <button class="tm-btn tm-btn-resign" onclick="window._tmResign()">🏳️ Resign</button>
        </div>
      ` : ''}
      ${(!myHitter && !myRunner && !winner) ? `
        <div class="tm-waiting">⏳ Waiting for ${waitingFor}...</div>
      ` : ''}
    </div>
  `;
  window._tmPickDir = (d) => { _pickedDirection = d; _renderTennis(_currentMatchState); };
  window._tmPickPow = (p) => { _pickedPower = p; _renderTennis(_currentMatchState); };
  window._tmHit = _handleHit;
  window._tmGuess = _handleGuess;
  window._tmResign = _handleResign;
  window._tmClose = _closeTennisMatchScreen;
}

async function _handleHit() {
  if (!_currentMatchState || !_currentMatchId) return;
  const myUid = _ctx?.getMyUid?.() || "";
  if (!isHitter(_currentMatchState, myUid)) return;
  const { state: newState, outcome } = applyHitterPick(_currentMatchState, myUid, {
    direction: _pickedDirection, power: _pickedPower,
  });
  await pushMatchUpdate(_currentMatchId, {
    phase: newState.phase,
    hitterPick: newState.hitterPick,
  });
  _ctx?.toast?.("🎾 Shot sent! Waiting for opponent to guess...");
}

async function _handleGuess() {
  if (!_currentMatchState || !_currentMatchId) return;
  const myUid = _ctx?.getMyUid?.() || "";
  if (!isRunner(_currentMatchState, myUid)) return;
  const { state: newState, outcome, result, winnerUid } = applyRunnerGuess(_currentMatchState, myUid, _pickedDirection);
  await pushMatchUpdate(_currentMatchId, {
    phase: newState.phase,
    players: newState.players,
    hitter: newState.hitter,
    runner: newState.runner,
    hitterPick: newState.hitterPick,
    runnerGuess: newState.runnerGuess,
    lastResult: newState.lastResult,
    rallyCount: newState.rallyCount,
    winnerUid: newState.winnerUid,
  });
  if (winnerUid) {
    await declareWinner(_currentMatchId, winnerUid);
  }
  // Reset picked direction
  _pickedDirection = "center";
  _pickedPower = "medium";
}

async function _handleResign() {
  if (!_currentMatchId) return;
  if (!confirm("Resign? Your opponent wins the pot.")) return;
  await resignMatch(_currentMatchId);
}

function _closeTennisMatchScreen() {
  if (_unsubMatch) { _unsubMatch(); _unsubMatch = null; }
  if (_matchEl) _matchEl.style.display = "none";
  _currentMatchId = null;
  _currentMatchState = null;
}
