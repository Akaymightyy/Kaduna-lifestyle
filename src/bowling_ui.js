// src/bowling_ui.js — Bowling match screen UI.
// Plugs into challenge_ui.js when match.game === "bowling".

import { pushMatchUpdate, declareWinner, resignMatch, subscribeToMatch } from "./challenge_system.js";
import {
  applyBowlerPick, isBowler, getPlayerScore, getWinnerName, formatResult,
  ANGLES, POWERS, BOWLING_FRAMES,
} from "./bowling_game.js";

let _ctx = null, _matchEl = null, _currentMatchId = null, _currentMatchState = null, _unsubMatch = null;
let _pickedAngle = "center", _pickedPower = "medium";

export function initBowlingUI(ctx) { _ctx = ctx; }

export function openBowlingMatchScreen(matchId) {
  _currentMatchId = matchId;
  if (!_matchEl) {
    _matchEl = document.createElement("div");
    _matchEl.id = "bowling-match";
    _matchEl.style.cssText = "position:fixed;inset:0;z-index:50;display:none;flex-direction:column;background:radial-gradient(circle at 50% 30%,#1a2a1a,#0a1a0a);color:#fff;font-family:Poppins,system-ui,sans-serif;overflow-y:auto;";
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
  const myTurn = isBowler(state, myUid);
  const winner = state.winnerUid;
  const isWinner = winner === myUid;
  const frame = (state.frame || 0) + 1;
  const roll = (state.roll || 0) + 1;
  const pinsStanding = state.pinsStanding || 10;
  const resultStr = formatResult(state.lastResult);

  if (winner) {
    _matchEl.innerHTML = `<style>#bowling-match .bw-wrap{max-width:520px;margin:0 auto;padding:24px 16px;text-align:center}#bowling-match .bw-trophy{font-size:80px;margin:20px 0;animation:bw-b 1s infinite}@keyframes bw-b{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}#bowling-match .bw-result{font-size:22px;font-weight:800;color:${isWinner?'#4ade80':'#e11d48'};margin:12px 0}#bowling-match .bw-close{width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(145deg,#f2b134,#d98e2b);color:#1a1a1a;font:700 14px Poppins,sans-serif;cursor:pointer}</style><div class="bw-wrap"><div class="bw-trophy">${isWinner?'🏆':'😔'}</div><div class="bw-result">${isWinner?'YOU WIN!':'You lose'}</div><div style="font-size:12px;color:#9ec9b0;margin-bottom:20px">Final: ${myName} ${myScore} — ${otherScore} ${otherName}</div><button class="bw-close" onclick="window._bwClose()">Close</button></div>`;
    window._bwClose = _close;
    return;
  }

  // Pin grid (visual — 4 rows of 1-4 pins)
  let pinGrid = "";
  for (let row = 0; row < 4; row++) {
    pinGrid += '<div style="display:flex;justify-content:center;gap:6px;">';
    for (let p = 0; p <= row; p++) {
      const standing = (row * (row + 1) / 2 + p) < pinsStanding;
      pinGrid += `<div style="width:14px;height:14px;border-radius:50%;background:${standing ? '#fff' : '#333'};box-shadow:${standing ? '0 0 4px rgba(255,255,255,.5)' : 'none'};"></div>`;
    }
    pinGrid += '</div>';
  }

  _matchEl.innerHTML = `
    <style>
      #bowling-match .bw-wrap{max-width:520px;margin:0 auto;padding:20px 16px calc(20px + env(safe-area-inset-bottom))}
      #bowling-match .bw-head{text-align:center;margin-bottom:14px}
      #bowling-match .bw-title{font-size:18px;font-weight:800;color:#f2b134;text-transform:uppercase}
      #bowling-match .bw-info{font-size:11px;color:#9ec9b0;margin-top:4px}
      #bowling-match .bw-players{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;margin:14px 0;align-items:center}
      #bowling-match .bw-player{text-align:center;padding:10px;border-radius:10px;background:rgba(255,255,255,.05);border:2px solid transparent}
      #bowling-match .bw-player.me{border-color:#4ade80}
      #bowling-match .bw-player.active{background:rgba(242,177,52,.15);border-color:#f2b134}
      #bowling-match .bw-player .name{font-size:12px;font-weight:700}
      #bowling-match .bw-player .score{font-size:32px;font-weight:800;color:#f2b134;margin:4px 0}
      #bowling-match .bw-vs{font-size:18px;color:#9ec9b0}
      #bowling-match .bw-lane{background:linear-gradient(180deg,#d4a96a 0%,#c4995a 100%);border:2px solid #8a6a45;border-radius:12px;padding:14px;margin:14px 0;text-align:center}
      #bowling-match .bw-pins{display:flex;flex-direction:column;gap:4px;margin-bottom:10px}
      #bowling-match .bw-result{background:rgba(0,0,0,.4);border-left:3px solid #f2b134;border-radius:8px;padding:8px 12px;font-size:12px;color:#e8f0ea;margin:8px 0;min-height:32px}
      #bowling-match .bw-section{font-size:11px;color:#9ec9b0;text-transform:uppercase;margin:14px 0 6px;font-weight:700}
      #bowling-match .bw-pickrow{display:flex;gap:6px;margin-bottom:8px}
      #bowling-match .bw-pick{flex:1;padding:10px;border-radius:8px;background:#1a2a1a;border:1px solid #2c4a2c;cursor:pointer;text-align:center;color:#fff;font:600 12px Poppins,sans-serif}
      #bowling-match .bw-pick.selected{border:2px solid #f2b134;background:#2a4a2a}
      #bowling-match .bw-actions{display:flex;gap:10px;margin-top:14px}
      #bowling-match .bw-btn{flex:1;padding:14px;border-radius:14px;border:none;font:700 14px Poppins,sans-serif;cursor:pointer}
      #bowling-match .bw-btn-bowl{background:linear-gradient(145deg,#4ade80,#16a34a);color:#fff}
      #bowling-match .bw-btn-resign{background:rgba(225,29,72,.6);color:#fff}
      #bowling-match .bw-waiting{text-align:center;font-size:13px;color:#9ec9b0;font-style:italic;padding:20px;background:rgba(255,255,255,.05);border-radius:10px}
    </style>
    <div class="bw-wrap">
      <div class="bw-head"><div class="bw-title">🎳 Bowling</div><div class="bw-info">Frame ${frame}/${BOWLING_FRAMES} · Roll ${roll} · ${pinsStanding} pins standing</div></div>
      <div class="bw-players">
        <div class="bw-player me ${myTurn?'active':''}"><div class="name">${myName}</div><div class="score">${myScore}</div></div>
        <div class="bw-vs">vs</div>
        <div class="bw-player ${!myTurn?'active':''}"><div class="name">${otherName}</div><div class="score">${otherScore}</div></div>
      </div>
      <div class="bw-lane">
        <div style="font-size:10px;color:#5a3a1a;margin-bottom:6px;">LANE</div>
        <div class="bw-pins">${pinGrid}</div>
        <div style="font-size:24px;">⚪</div>
      </div>
      <div class="bw-result">${resultStr || (myTurn ? 'Pick your angle + power, then bowl!' : `⏳ Waiting for ${state.players[state.bowler]?.name}...`)}</div>
      ${myTurn ? `
        <div class="bw-section">Angle</div>
        <div class="bw-pickrow">${ANGLES.map(a=>`<div class="bw-pick ${_pickedAngle===a?'selected':''}" onclick="window._bwPickA('${a}')">${a==='left'?'◀ Left':a==='right'?'Right ▶':'● Center'}</div>`).join('')}</div>
        <div class="bw-section">Power</div>
        <div class="bw-pickrow">${POWERS.map(p=>`<div class="bw-pick ${_pickedPower===p?'selected':''}" onclick="window._bwPickP('${p}')">${p==='soft'?'Soft':p==='medium'?'Medium':'💥 Strike!'}</div>`).join('')}</div>
        <div class="bw-actions">
          <button class="bw-btn bw-btn-bowl" onclick="window._bwBowl()">🎳 Bowl!</button>
          <button class="bw-btn bw-btn-resign" onclick="window._bwResign()">🏳️ Resign</button>
        </div>` : ''}
      ${!myTurn && !winner ? '<div class="bw-waiting">⏳ Waiting for opponent to bowl...</div>' : ''}
    </div>`;
  window._bwPickA = (a) => { _pickedAngle = a; _render(_currentMatchState); };
  window._bwPickP = (p) => { _pickedPower = p; _render(_currentMatchState); };
  window._bwBowl = _bowl;
  window._bwResign = _resign;
  window._bwClose = _close;
}

async function _bowl() {
  if (!_currentMatchState || !_currentMatchId) return;
  const uid = _ctx?.getMyUid?.() || "";
  if (!isBowler(_currentMatchState, uid)) return;
  const { state: newState, winnerUid } = applyBowlerPick(_currentMatchState, uid, { angle: _pickedAngle, power: _pickedPower });
  await pushMatchUpdate(_currentMatchId, {
    players: newState.players, bowler: newState.bowler, phase: newState.phase,
    frame: newState.frame, roll: newState.roll, pinsStanding: newState.pinsStanding,
    framePins: newState.framePins, bowlerPick: newState.bowlerPick, lastResult: newState.lastResult,
    winnerUid: newState.winnerUid,
  });
  if (winnerUid) await declareWinner(_currentMatchId, winnerUid);
}
async function _resign() { if (!_currentMatchId) return; if (confirm("Resign?")) await resignMatch(_currentMatchId); }
function _close() { if (_unsubMatch) { _unsubMatch(); _unsubMatch = null; } if (_matchEl) _matchEl.style.display = "none"; _currentMatchId = null; _currentMatchState = null; }
