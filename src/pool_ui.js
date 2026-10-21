// src/pool_ui.js — Pool/snooker match screen UI.
// Plugs into challenge_ui.js when match.game === "pool".

import { pushMatchUpdate, declareWinner, resignMatch, subscribeToMatch } from "./challenge_system.js";
import {
  applyShooterPick, isShooter, getPlayerScore, getWinnerName, formatResult,
  ANGLES, POWERS, POOL_ROUNDS,
} from "./pool_game.js";

let _ctx = null, _matchEl = null, _currentMatchId = null, _currentMatchState = null, _unsubMatch = null;
let _pickedAngle = "center", _pickedPower = "medium";

export function initPoolUI(ctx) { _ctx = ctx; }

export function openPoolMatchScreen(matchId) {
  _currentMatchId = matchId;
  if (!_matchEl) {
    _matchEl = document.createElement("div");
    _matchEl.id = "pool-match";
    _matchEl.style.cssText = "position:fixed;inset:0;z-index:50;display:none;flex-direction:column;background:radial-gradient(circle at 50% 30%,#0a2a1a,#000);color:#fff;font-family:Poppins,system-ui,sans-serif;overflow-y:auto;";
    document.body.appendChild(_matchEl);
  }
  _matchEl.style.display = "flex";
  if (_unsubMatch) _unsubMatch();
  _unsubMatch = subscribeToMatch(matchId, (state) => { _currentMatchState = state; _render(state); });
}

function _render(state) {
  if (!state || !_matchEl) return;
  const myUid = _ctx?.getMyUid?.() || "";
  const myName = state.players[myUid]?.name || "You";
  const otherUid = Object.keys(state.players).find(k => k !== myUid);
  const otherName = state.players[otherUid]?.name || "Opponent";
  const myScore = getPlayerScore(state, myUid);
  const otherScore = getPlayerScore(state, otherUid);
  const myTurn = isShooter(state, myUid);
  const winner = state.winnerUid;
  const isWinner = winner === myUid;
  const round = (state.round || 0) + 1;
  const resultStr = formatResult(state.lastResult);

  if (winner) {
    _matchEl.innerHTML = `<style>#pool-match .pl-wrap{max-width:520px;margin:0 auto;padding:24px 16px;text-align:center}#pool-match .pl-trophy{font-size:80px;margin:20px 0;animation:pl-b 1s infinite}@keyframes pl-b{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}#pool-match .pl-result{font-size:22px;font-weight:800;color:${isWinner?'#4ade80':'#e11d48'};margin:12px 0}#pool-match .pl-close{width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(145deg,#f2b134,#d98e2b);color:#1a1a1a;font:700 14px Poppins,sans-serif;cursor:pointer}</style><div class="pl-wrap"><div class="pl-trophy">${isWinner?'🏆':'😔'}</div><div class="pl-result">${isWinner?'YOU WIN!':'You lose'}</div><div style="font-size:12px;color:#9ec9b0;margin-bottom:20px">Final: ${myName} ${myScore} — ${otherScore} ${otherName}</div><button class="pl-close" onclick="window._plClose()">Close</button></div>`;
    window._plClose = _close;
    return;
  }

  // Ball grid (visual — show 7 balls, coloured as potted)
  const ballColors = ["#ffffff","#e11d48","#1d5fa8","#f2b134","#2e7d4f","#9333ea","#f97316","#06b6d4"];
  let ballGrid = "";
  for (let i = 0; i < 7; i++) {
    const potted = i < (state.players[myUid]?.potted || 0);
    ballGrid += `<div style="width:22px;height:22px;border-radius:50%;background:${potted ? '#333' : ballColors[i]};box-shadow:${potted ? 'none' : '0 0 6px '+ballColors[i]+'80'};opacity:${potted ? 0.3 : 1};"></div>`;
  }

  _matchEl.innerHTML = `
    <style>
      #pool-match .pl-wrap{max-width:520px;margin:0 auto;padding:20px 16px calc(20px + env(safe-area-inset-bottom))}
      #pool-match .pl-head{text-align:center;margin-bottom:14px}
      #pool-match .pl-title{font-size:18px;font-weight:800;color:#4ade80;text-transform:uppercase}
      #pool-match .pl-info{font-size:11px;color:#9ec9b0;margin-top:4px}
      #pool-match .pl-players{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;margin:14px 0;align-items:center}
      #pool-match .pl-player{text-align:center;padding:10px;border-radius:10px;background:rgba(255,255,255,.05);border:2px solid transparent}
      #pool-match .pl-player.me{border-color:#4ade80}
      #pool-match .pl-player.active{background:rgba(74,222,128,.15);border-color:#4ade80}
      #pool-match .pl-player .name{font-size:12px;font-weight:700}
      #pool-match .pl-player .score{font-size:32px;font-weight:800;color:#4ade80;margin:4px 0}
      #pool-match .pl-vs{font-size:18px;color:#9ec9b0}
      #pool-match .pl-table{background:linear-gradient(180deg,#0a4a2a 0%,#083a20 100%);border:3px solid #5a3a1a;border-radius:12px;padding:14px;margin:14px 0;text-align:center}
      #pool-match .pl-balls{display:flex;justify-content:center;gap:6px;margin-bottom:10px}
      #pool-match .pl-cue{font-size:24px}
      #pool-match .pl-result{background:rgba(0,0,0,.4);border-left:3px solid #4ade80;border-radius:8px;padding:8px 12px;font-size:12px;color:#e8f0ea;margin:8px 0;min-height:32px}
      #pool-match .pl-section{font-size:11px;color:#9ec9b0;text-transform:uppercase;margin:14px 0 6px;font-weight:700}
      #pool-match .pl-pickrow{display:flex;gap:6px;margin-bottom:8px}
      #pool-match .pl-pick{flex:1;padding:10px;border-radius:8px;background:#1a2a1a;border:1px solid #2c4a2c;cursor:pointer;text-align:center;color:#fff;font:600 12px Poppins,sans-serif}
      #pool-match .pl-pick.selected{border:2px solid #4ade80;background:#2a4a2a}
      #pool-match .pl-actions{display:flex;gap:10px;margin-top:14px}
      #pool-match .pl-btn{flex:1;padding:14px;border-radius:14px;border:none;font:700 14px Poppins,sans-serif;cursor:pointer}
      #pool-match .pl-btn-shoot{background:linear-gradient(145deg,#4ade80,#16a34a);color:#fff}
      #pool-match .pl-btn-resign{background:rgba(225,29,72,.6);color:#fff}
      #pool-match .pl-waiting{text-align:center;font-size:13px;color:#9ec9b0;font-style:italic;padding:20px;background:rgba(255,255,255,.05);border-radius:10px}
    </style>
    <div class="pl-wrap">
      <div class="pl-head"><div class="pl-title">🎱 Pool</div><div class="pl-info">Round ${round}/${POOL_ROUNDS} · Most balls potted wins</div></div>
      <div class="pl-players">
        <div class="pl-player me ${myTurn?'active':''}"><div class="name">${myName}</div><div class="score">${myScore}</div></div>
        <div class="pl-vs">vs</div>
        <div class="pl-player ${!myTurn?'active':''}"><div class="name">${otherName}</div><div class="score">${otherScore}</div></div>
      </div>
      <div class="pl-table">
        <div style="font-size:10px;color:#5a8a5a;margin-bottom:6px;">POOL TABLE</div>
        <div class="pl-balls">${ballGrid}</div>
        <div class="pl-cue">🎱 🎱 🎱 🎱 🎱 🎱 🎱</div>
        <div style="font-size:20px;margin-top:4px;">🟥</div>
      </div>
      <div class="pl-result">${resultStr || (myTurn ? 'Pick your angle + power, then shoot!' : `⏳ Waiting for ${state.players[state.shooter]?.name}...`)}</div>
      ${myTurn ? `
        <div class="pl-section">Angle</div>
        <div class="pl-pickrow">${ANGLES.map(a=>`<div class="pl-pick ${_pickedAngle===a?'selected':''}" onclick="window._plPickA('${a}')">${a==='left'?'◀ Left':a==='right'?'Right ▶':'● Center'}</div>`).join('')}</div>
        <div class="pl-section">Power</div>
        <div class="pl-pickrow">${POWERS.map(p=>`<div class="pl-pick ${_pickedPower===p?'selected':''}" onclick="window._plPickP('${p}')">${p==='soft'?'Soft':p==='medium'?'Medium':'💥 Hard'}</div>`).join('')}</div>
        <div class="pl-actions">
          <button class="pl-btn pl-btn-shoot" onclick="window._plShoot()">🎱 Shoot!</button>
          <button class="pl-btn pl-btn-resign" onclick="window._plResign()">🏳️ Resign</button>
        </div>` : ''}
      ${!myTurn && !winner ? '<div class="pl-waiting">⏳ Waiting for opponent to shoot...</div>' : ''}
    </div>`;
  window._plPickA = (a) => { _pickedAngle = a; _render(_currentMatchState); };
  window._plPickP = (p) => { _pickedPower = p; _render(_currentMatchState); };
  window._plShoot = _shoot;
  window._plResign = _resign;
  window._plClose = _close;
}

async function _shoot() {
  if (!_currentMatchState || !_currentMatchId) return;
  const uid = _ctx?.getMyUid?.() || "";
  if (!isShooter(_currentMatchState, uid)) return;
  const { state: newState, winnerUid } = applyShooterPick(_currentMatchState, uid, { angle: _pickedAngle, power: _pickedPower });
  await pushMatchUpdate(_currentMatchId, {
    players: newState.players, shooter: newState.shooter, phase: newState.phase,
    round: newState.round, shooterPick: newState.shooterPick, lastResult: newState.lastResult,
    winnerUid: newState.winnerUid,
  });
  if (winnerUid) await declareWinner(_currentMatchId, winnerUid);
}
async function _resign() { if (!_currentMatchId) return; if (confirm("Resign?")) await resignMatch(_currentMatchId); }
function _close() { if (_unsubMatch) { _unsubMatch(); _unsubMatch = null; } if (_matchEl) _matchEl.style.display = "none"; _currentMatchId = null; _currentMatchState = null; }
