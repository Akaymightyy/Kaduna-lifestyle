// src/okada_dash_ui.js — Okada Dash match screen UI.
// Plugs into challenge_ui.js when match.game === "okada_dash".

import { pushMatchUpdate, declareWinner, resignMatch, subscribeToMatch } from "./challenge_system.js";
import { applyRiderPick, isRider, getPlayerScore, getWinnerName, formatResult, LANES, ACTIONS, OKADA_ROUNDS } from "./okada_dash_game.js";

let _ctx = null, _matchEl = null, _currentMatchId = null, _currentMatchState = null, _unsubMatch = null;
let _pickedLane = "center", _pickedAction = "dodge";

export function initOkadaDashUI(ctx) { _ctx = ctx; }

export function openOkadaDashMatchScreen(matchId) {
  _currentMatchId = matchId;
  if (!_matchEl) {
    _matchEl = document.createElement("div");
    _matchEl.id = "okadadash-match";
    _matchEl.style.cssText = "position:fixed;inset:0;z-index:50;display:none;flex-direction:column;background:radial-gradient(circle at 50% 30%,#1a2a1a,#000);color:#fff;font-family:Poppins,system-ui,sans-serif;overflow-y:auto;";
    document.body.appendChild(_matchEl);
  }
  _matchEl.style.display = "flex";
  if (_unsubMatch) _unsubMatch();
  _unsubMatch = subscribeToMatch(matchId, (s) => { _currentMatchState = s; _render(s); });
}

function _render(state) {
  if (!state || !_matchEl) return;
  const myUid = _ctx?.getMyUid?.() || "";
  const myName = state.players[myUid]?.name || "You";
  const otherUid = Object.keys(state.players).find(k => k !== myUid);
  const otherName = state.players[otherUid]?.name || "Opponent";
  const myScore = getPlayerScore(state, myUid);
  const otherScore = getPlayerScore(state, otherUid);
  const myTurn = isRider(state, myUid);
  const winner = state.winnerUid;
  const isWinner = winner === myUid;
  const round = (state.round || 0) + 1;
  const resultStr = formatResult(state.lastResult);

  if (winner) {
    _matchEl.innerHTML = `<style>#okadadash-match .od-wrap{max-width:520px;margin:0 auto;padding:24px 16px;text-align:center}#okadadash-match .od-trophy{font-size:80px;margin:20px 0;animation:od-b 1s infinite}@keyframes od-b{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}#okadadash-match .od-result{font-size:22px;font-weight:800;color:${isWinner?'#4ade80':'#e11d48'};margin:12px 0}#okadadash-match .od-close{width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(145deg,#f2b134,#d98e2b);color:#1a1a1a;font:700 14px Poppins,sans-serif;cursor:pointer}</style><div class="od-wrap"><div class="od-trophy">${isWinner?'🏆':'😔'}</div><div class="od-result">${isWinner?'YOU WIN!':'You lose'}</div><div style="font-size:12px;color:#9ec9b0;margin-bottom:20px">Final: ${myName} ${myScore} — ${otherScore} ${otherName}</div><button class="od-close" onclick="window._odClose()">Close</button></div>`;
    window._odClose = _close;
    return;
  }

  // Visual: 3-lane road with okada + obstacles + stars
  let roadVisual = '';
  for (const lane of LANES) {
    const hasObstacle = state.lastResult?.obstacle === lane;
    const hasStars = state.lastResult?.stars > 0 && state.lastResult?.lane === lane;
    roadVisual += `<div style="flex:1;border-right:1px solid #333;display:flex;align-items:center;justify-content:center;font-size:24px;">${hasObstacle?'🚧':hasStars?'⭐':'&nbsp;'}</div>`;
  }

  _matchEl.innerHTML = `
    <style>
      #okadadash-match .od-wrap{max-width:520px;margin:0 auto;padding:20px 16px calc(20px + env(safe-area-inset-bottom))}
      #okadadash-match .od-head{text-align:center;margin-bottom:14px}
      #okadadash-match .od-title{font-size:18px;font-weight:800;color:#f2b134;text-transform:uppercase}
      #okadadash-match .od-info{font-size:11px;color:#9ec9b0;margin-top:4px}
      #okadadash-match .od-players{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;margin:14px 0;align-items:center}
      #okadadash-match .od-player{text-align:center;padding:10px;border-radius:10px;background:rgba(255,255,255,.05);border:2px solid transparent}
      #okadadash-match .od-player.me{border-color:#4ade80}
      #okadadash-match .od-player.active{background:rgba(242,177,52,.15);border-color:#f2b134}
      #okadadash-match .od-player .name{font-size:12px;font-weight:700}
      #okadadash-match .od-player .score{font-size:32px;font-weight:800;color:#f2b134;margin:4px 0}
      #okadadash-match .od-vs{font-size:18px;color:#9ec9b0}
      #okadadash-match .od-road{background:#2a2a2a;border:2px solid #555;border-radius:8px;height:80px;margin:14px 0;display:flex;overflow:hidden}
      #okadadash-match .od-okada{text-align:center;font-size:28px;margin:8px 0}
      #okadadash-match .od-result{background:rgba(0,0,0,.4);border-left:3px solid #f2b134;border-radius:8px;padding:8px 12px;font-size:12px;color:#e8f0ea;margin:8px 0;min-height:32px}
      #okadadash-match .od-section{font-size:11px;color:#9ec9b0;text-transform:uppercase;margin:14px 0 6px;font-weight:700}
      #okadadash-match .od-pickrow{display:flex;gap:6px;margin-bottom:8px}
      #okadadash-match .od-pick{flex:1;padding:10px;border-radius:8px;background:#1a2a1a;border:1px solid #2c4a2c;cursor:pointer;text-align:center;color:#fff;font:600 12px Poppins,sans-serif}
      #okadadash-match .od-pick.selected{border:2px solid #f2b134;background:#2a4a2a}
      #okadadash-match .od-actions{display:flex;gap:10px;margin-top:14px}
      #okadadash-match .od-btn{flex:1;padding:14px;border-radius:14px;border:none;font:700 14px Poppins,sans-serif;cursor:pointer}
      #okadadash-match .od-btn-ride{background:linear-gradient(145deg,#4ade80,#16a34a);color:#fff}
      #okadadash-match .od-btn-resign{background:rgba(225,29,72,.6);color:#fff}
      #okadadash-match .od-waiting{text-align:center;font-size:13px;color:#9ec9b0;font-style:italic;padding:20px;background:rgba(255,255,255,.05);border-radius:10px}
    </style>
    <div class="od-wrap">
      <div class="od-head"><div class="od-title">🏍️ Okada Dash</div><div class="od-info">Round ${round}/${OKADA_ROUNDS} · Highest score wins</div></div>
      <div class="od-players">
        <div class="od-player me ${myTurn?'active':''}"><div class="name">${myName}</div><div class="score">${myScore}</div></div>
        <div class="od-vs">vs</div>
        <div class="od-player ${!myTurn?'active':''}"><div class="name">${otherName}</div><div class="score">${otherScore}</div></div>
      </div>
      <div class="od-road">${roadVisual}</div>
      <div class="od-okada">🏍️</div>
      <div class="od-result">${resultStr || (myTurn ? 'Pick your lane + action, then ride!' : `⏳ Waiting for ${state.players[state.rider]?.name}...`)}</div>
      ${myTurn ? `
        <div class="od-section">Lane</div>
        <div class="od-pickrow">${LANES.map(l=>`<div class="od-pick ${_pickedLane===l?'selected':''}" onclick="window._odPickL('${l}')">${l==='left'?'◀ Left':l==='right'?'Right ▶':'● Center'}</div>`).join('')}</div>
        <div class="od-section">Action</div>
        <div class="od-pickrow">${ACTIONS.map(a=>`<div class="od-pick ${_pickedAction===a?'selected':''}" onclick="window._odPickA('${a}')">${a==='dodge'?'🛡️ Dodge':a==='collect'?'⭐ Collect':'🚀 Boost'}</div>`).join('')}</div>
        <div class="od-actions">
          <button class="od-btn od-btn-ride" onclick="window._odRide()">🏍️ Ride!</button>
          <button class="od-btn od-btn-resign" onclick="window._odResign()">🏳️ Resign</button>
        </div>` : ''}
      ${!myTurn && !winner ? '<div class="od-waiting">⏳ Waiting for opponent to ride...</div>' : ''}
    </div>`;
  window._odPickL = (l) => { _pickedLane = l; _render(_currentMatchState); };
  window._odPickA = (a) => { _pickedAction = a; _render(_currentMatchState); };
  window._odRide = _ride;
  window._odResign = _resign;
  window._odClose = _close;
}

async function _ride() {
  if (!_currentMatchState || !_currentMatchId) return;
  const uid = _ctx?.getMyUid?.() || "";
  if (!isRider(_currentMatchState, uid)) return;
  const { state: newState, winnerUid } = applyRiderPick(_currentMatchState, uid, { lane: _pickedLane, action: _pickedAction });
  await pushMatchUpdate(_currentMatchId, {
    players: newState.players, rider: newState.rider, phase: newState.phase,
    round: newState.round, riderPick: newState.riderPick, lastResult: newState.lastResult, winnerUid: newState.winnerUid,
  });
  if (winnerUid) await declareWinner(_currentMatchId, winnerUid);
}
async function _resign() { if (!_currentMatchId) return; if (confirm("Resign?")) await resignMatch(_currentMatchId); }
function _close() { if (_unsubMatch) { _unsubMatch(); _unsubMatch = null; } if (_matchEl) _matchEl.style.display = "none"; _currentMatchId = null; _currentMatchState = null; }
