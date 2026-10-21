// src/sniper_ui.js — Sniper duel match screen UI.
//
// Plugs into the existing challenge_ui.js match dispatcher. When a match
// has game === "sniper", this module renders the sniper UI.
//
// Layout (CSS-only — stylised scene with cover + crosshair for the shooter):
//
//   ┌──────────────────────────────────┐
//   │  🎯 SNIPER DUEL · Round 3 · Kawo Maize Farm │
//   ├──────────────────────────────────┤
//   │   You (100HP)    vs    Opp (75HP) │
//   ├──────────────────────────────────┤
//   │   ┌─────────────────────────┐    │
//   │   │ 🌳🌳🌾🌾🌾🌾🌳🌳     │    │
//   │   │ 🌾🌾  [target dot]  🌾🌾 │    │  <- stylised map scene
//   │   │ 🌾🌾🌾🌾🌾🌾🌾🌾🌾🌾  │    │
//   │   │   [crosshair]              │    │
//   │   └─────────────────────────┘    │
//   ├──────────────────────────────────┤
//   │  Last: 💀 HEADSHOT! You aimed head/left │
//   ├──────────────────────────────────┤
//   │  [Your turn to SHOOT]             │
//   │  Aim position: ● Head  Chest  Legs│
//   │  Aim side: ◀ Left  ● Center  ▶ Right│
//   │  [🎯 Fire!]                       │
//   └──────────────────────────────────┘

import { pushMatchUpdate, declareWinner, resignMatch, subscribeToMatch } from "./challenge_system.js";
import {
  applyShooterPick, applyTargetPick, isShooter, isTarget,
  getPlayerHp, getWinnerName, formatResult, getMap,
  AIM_POSITIONS, AIM_SIDES, DODGE_SIDES, POSTURES, SNIPER_MAX_HP,
} from "./sniper_game.js";

let _ctx = null;
let _matchEl = null;
let _currentMatchId = null;
let _currentMatchState = null;
let _unsubMatch = null;
let _pickedAimPosition = "chest";
let _pickedAimSide = "center";
let _pickedDodgeSide = "center";
let _pickedPosture = "standing";

export function initSniperUI(ctx) {
  _ctx = ctx;
}

// Called by challenge_ui.js when a match with game === "sniper" is opened.
export function openSniperMatchScreen(matchId) {
  _currentMatchId = matchId;
  if (!_matchEl) {
    _matchEl = document.createElement("div");
    _matchEl.id = "sniper-match";
    _matchEl.style.cssText =
      "position:fixed;inset:0;z-index:50;display:none;flex-direction:column;" +
      "background:radial-gradient(circle at 50% 30%,#0a0a14,#000);color:#fff;" +
      "font-family:Poppins,system-ui,sans-serif;overflow-y:auto;";
    document.body.appendChild(_matchEl);
  }
  _matchEl.style.display = "flex";
  if (_unsubMatch) _unsubMatch();
  _unsubMatch = subscribeToMatch(matchId, (state) => {
    _currentMatchState = state;
    _renderSniper(state);
  });
}

function _renderSniper(state) {
  if (!state || !_matchEl) return;
  const myUid = _ctx?.getMyUid?.() || "";
  const myName = state.players[myUid]?.name || "You";
  const otherUid = Object.keys(state.players).find(k => k !== myUid);
  const otherName = state.players[otherUid]?.name || "Opponent";
  const myHp = getPlayerHp(state, myUid);
  const otherHp = getPlayerHp(state, otherUid);
  const myShooter = isShooter(state, myUid);
  const myTarget = isTarget(state, myUid);
  const winner = state.winnerUid;
  const isWinner = winner === myUid;
  const round = state.round || 0;
  const resultStr = formatResult(state.lastResult);
  const map = getMap(state.mapId || "maize");

  // Win/lose screen
  if (winner) {
    _matchEl.innerHTML = `
      <style>
        #sniper-match .sn-wrap { max-width:520px;margin:0 auto;padding:20px 16px calc(40px + env(safe-area-inset-bottom));text-align:center; }
        #sniper-match .sn-trophy { font-size:80px;line-height:1;margin:20px 0;animation:sn-bounce 1s ease infinite; }
        @keyframes sn-bounce { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-12px); } }
        #sniper-match .sn-result { font-size:22px;font-weight:800;color:${isWinner ? '#4ade80' : '#e11d48'};margin:12px 0; }
        #sniper-match .sn-payout { font-size:14px;color:#f2b134;font-weight:600;margin:6px 0 20px; }
        #sniper-match .sn-close { width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(145deg,#f2b134,#d98e2b);color:#1a1a1a;font:700 14px Poppins,sans-serif;cursor:pointer; }
      </style>
      <div class="sn-wrap">
        <div class="sn-trophy">${isWinner ? '🎯' : '💀'}</div>
        <div class="sn-result">${isWinner ? 'YOU WIN!' : 'You lose'}</div>
        <div class="sn-payout">${isWinner ? 'Sharpshooter — pot is yours!' : 'You got eliminated'}</div>
        <div style="font-size:11px;color:#9ec9b0;margin-bottom:20px;">
          Final HP: ${myName} ${myHp} — ${otherHp} ${otherName}
        </div>
        <button class="sn-close" onclick="window._snClose()">Close</button>
      </div>
    `;
    window._snClose = _closeSniperMatchScreen;
    return;
  }

  // In-progress match
  _matchEl.innerHTML = `
    <style>
      #sniper-match .sn-wrap { max-width:520px;margin:0 auto;padding:20px 16px calc(20px + env(safe-area-inset-bottom)); }
      #sniper-match .sn-head { text-align:center;margin-bottom:14px; }
      #sniper-match .sn-title { font-size:18px;font-weight:800;color:#e11d48;text-transform:uppercase;letter-spacing:.4px; }
      #sniper-match .sn-stake { font-size:11px;color:#9ec9b0;margin-top:4px; }
      #sniper-match .sn-players { display:grid;grid-template-columns:1fr auto 1fr;gap:8px;margin:14px 0;align-items:center; }
      #sniper-match .sn-player { text-align:center;padding:10px;border-radius:10px;background:rgba(255,255,255,.05);border:2px solid transparent; }
      #sniper-match .sn-player.me { border-color:#4ade80; }
      #sniper-match .sn-player.active { background:rgba(225,29,72,.15);border-color:#e11d48; }
      #sniper-match .sn-player .name { font-size:12px;font-weight:700;color:#fff; }
      #sniper-match .sn-hp-bar { width:100%;height:8px;background:#26272b;border-radius:4px;margin:6px 0 4px;overflow:hidden; }
      #sniper-match .sn-hp-fill { height:100%;background:#4ade80;border-radius:4px;transition:width .3s; }
      #sniper-match .sn-hp-fill.low { background:#e11d48; }
      #sniper-match .sn-hp-fill.mid { background:#f2b134; }
      #sniper-match .sn-hp-num { font-size:14px;font-weight:800;color:#f2b134;margin:2px 0; }
      #sniper-match .sn-player .label { font-size:10px;color:#9ec9b0;text-transform:uppercase; }
      #sniper-match .sn-vs { font-size:18px;font-weight:700;color:#9ec9b0; }
      #sniper-match .sn-scene { background:${map.color};border:2px solid #fff;border-radius:12px;height:200px;margin:14px 0;position:relative;overflow:hidden;background:linear-gradient(180deg,${map.color} 0%,${map.color} 60%,#1a1a1a 100%); }
      #sniper-match .sn-scene-grass { position:absolute;bottom:0;left:0;right:0;height:60%;background:repeating-linear-gradient(45deg,rgba(74,222,128,.15) 0,rgba(74,222,128,.15) 2px,transparent 2px,transparent 6px); }
      #sniper-match .sn-target-dot { position:absolute;width:14px;height:14px;border-radius:50%;background:#e11d48;box-shadow:0 0 8px rgba(225,29,72,.6);top:35%;left:50%;transform:translate(-50%,-50%); }
      #sniper-match .sn-crosshair { position:absolute;width:30px;height:30px;top:65%;left:50%;transform:translate(-50%,-50%); }
      #sniper-match .sn-crosshair::before, #sniper-match .sn-crosshair::after { content:'';position:absolute;background:#fff;box-shadow:0 0 4px rgba(255,255,255,.6); }
      #sniper-match .sn-crosshair::before { left:50%;top:0;width:2px;height:100%;transform:translateX(-50%); }
      #sniper-match .sn-crosshair::after { top:50%;left:0;height:2px;width:100%;transform:translateY(-50%); }
      #sniper-match .sn-map-name { position:absolute;top:8px;left:8px;font-size:10px;color:rgba(255,255,255,.6);font-family:monospace; }
      #sniper-match .sn-result { background:rgba(0,0,0,.5);border-left:3px solid #e11d48;border-radius:8px;padding:8px 12px;font-size:12px;color:#e8f0ea;margin:8px 0;min-height:32px; }
      #sniper-match .sn-section { font-size:11px;color:#9ec9b0;text-transform:uppercase;letter-spacing:.5px;margin:14px 0 6px;font-weight:700; }
      #sniper-match .sn-pickrow { display:flex;gap:6px;margin-bottom:8px; }
      #sniper-match .sn-pick { flex:1;padding:10px;border-radius:8px;background:#1a1a1a;border:1px solid #2c2c2c;cursor:pointer;text-align:center;color:#fff;font:600 12px Poppins,sans-serif; }
      #sniper-match .sn-pick.selected { border:2px solid #e11d48;background:#2a1a1a; }
      #sniper-match .sn-actions { display:flex;gap:10px;margin-top:14px;justify-content:center; }
      #sniper-match .sn-btn { padding:14px 24px;border-radius:14px;border:none;font:700 14px Poppins,sans-serif;cursor:pointer;min-width:120px; }
      #sniper-match .sn-btn-fire { background:linear-gradient(145deg,#e11d48,#a01030);color:#fff; }
      #sniper-match .sn-btn-dodge { background:linear-gradient(145deg,#f2b134,#d98e2b);color:#1a1a1a; }
      #sniper-match .sn-btn-resign { background:rgba(255,255,255,.1);color:#9ec9b0; }
      #sniper-match .sn-waiting { text-align:center;font-size:13px;color:#9ec9b0;font-style:italic;padding:20px;background:rgba(255,255,255,.05);border-radius:10px;margin:10px 0; }
    </style>
    <div class="sn-wrap">
      <div class="sn-head">
        <div class="sn-title">🎯 Sniper Duel</div>
        <div class="sn-stake">Round ${round + 1} · ${map.emoji} ${map.name}</div>
      </div>
      <div class="sn-players">
        <div class="sn-player me ${myShooter || myTarget ? 'active' : ''}">
          <div class="name">${myName} (You)</div>
          <div class="sn-hp-bar"><div class="sn-hp-fill ${myHp < 30 ? 'low' : myHp < 60 ? 'mid' : ''}" style="width:${(myHp / SNIPER_MAX_HP) * 100}%;"></div></div>
          <div class="sn-hp-num">${myHp}/${SNIPER_MAX_HP}</div>
          <div class="label">${myShooter ? 'Shooting' : myTarget ? 'Dodging' : 'HP'}</div>
        </div>
        <div class="sn-vs">vs</div>
        <div class="sn-player ${!myShooter && !myTarget ? 'active' : ''}">
          <div class="name">${otherName}</div>
          <div class="sn-hp-bar"><div class="sn-hp-fill ${otherHp < 30 ? 'low' : otherHp < 60 ? 'mid' : ''}" style="width:${(otherHp / SNIPER_MAX_HP) * 100}%;"></div></div>
          <div class="sn-hp-num">${otherHp}/${SNIPER_MAX_HP}</div>
          <div class="label">${myShooter ? 'Dodging' : myTarget ? 'Shooting' : 'HP'}</div>
        </div>
      </div>
      <div class="sn-scene">
        <div class="sn-map-name">${map.emoji} ${map.name}</div>
        <div class="sn-scene-grass"></div>
        <div class="sn-target-dot"></div>
        <div class="sn-crosshair"></div>
      </div>
      <div class="sn-result">${resultStr || (state.phase === 'shooter_pick' ? `${state.players[state.shooter]?.name} is aiming...` : `${state.players[state.target]?.name} is picking posture + dodge...`)}</div>
      ${myShooter ? `
        <div class="sn-section">Your turn to SHOOT — pick aim</div>
        <div class="sn-section">Aim position</div>
        <div class="sn-pickrow">
          ${AIM_POSITIONS.map(p => `<div class="sn-pick ${_pickedAimPosition === p ? 'selected' : ''}" onclick="window._snPickAimPos('${p}')">${p === 'head' ? '💀 Head' : p === 'chest' ? '🎯 Chest' : '🦵 Legs'}</div>`).join("")}
        </div>
        <div class="sn-section">Aim side</div>
        <div class="sn-pickrow">
          ${AIM_SIDES.map(s => `<div class="sn-pick ${_pickedAimSide === s ? 'selected' : ''}" onclick="window._snPickAimSide('${s}')">${s === 'left' ? '◀ Left' : s === 'right' ? 'Right ▶' : '● Center'}</div>`).join("")}
        </div>
        <div class="sn-actions">
          <button class="sn-btn sn-btn-fire" onclick="window._snFire()">🎯 Fire!</button>
          <button class="sn-btn sn-btn-resign" onclick="window._snResign()">🏳️ Resign</button>
        </div>
      ` : ''}
      ${myTarget ? `
        <div class="sn-section">Your turn to DODGE — pick dodge + posture</div>
        <div class="sn-section">Dodge side</div>
        <div class="sn-pickrow">
          ${DODGE_SIDES.map(s => `<div class="sn-pick ${_pickedDodgeSide === s ? 'selected' : ''}" onclick="window._snPickDodge('${s}')">${s === 'left' ? '◀ Left' : s === 'right' ? 'Right ▶' : '● Center'}</div>`).join("")}
        </div>
        <div class="sn-section">Posture</div>
        <div class="sn-pickrow">
          ${POSTURES.map(p => `<div class="sn-pick ${_pickedPosture === p ? 'selected' : ''}" onclick="window._snPickPosture('${p}')">${p === 'standing' ? '🧍 Standing' : p === 'crouch' ? '🧎 Crouch' : '🐍 Prone'}</div>`).join("")}
        </div>
        <div class="sn-actions">
          <button class="sn-btn sn-btn-dodge" onclick="window._snDodge()">🏃 Dodge!</button>
          <button class="sn-btn sn-btn-resign" onclick="window._snResign()">🏳️ Resign</button>
        </div>
      ` : ''}
      ${(!myShooter && !myTarget && !winner) ? `
        <div class="sn-waiting">⏳ Waiting for ${state.phase === 'shooter_pick' ? state.players[state.shooter]?.name + ' to aim' : state.players[state.target]?.name + ' to dodge'}...</div>
      ` : ''}
    </div>
  `;
  window._snPickAimPos = (p) => { _pickedAimPosition = p; _renderSniper(_currentMatchState); };
  window._snPickAimSide = (s) => { _pickedAimSide = s; _renderSniper(_currentMatchState); };
  window._snPickDodge = (s) => { _pickedDodgeSide = s; _renderSniper(_currentMatchState); };
  window._snPickPosture = (p) => { _pickedPosture = p; _renderSniper(_currentMatchState); };
  window._snFire = _handleFire;
  window._snDodge = _handleDodge;
  window._snResign = _handleResign;
  window._snClose = _closeSniperMatchScreen;
}

async function _handleFire() {
  if (!_currentMatchState || !_currentMatchId) return;
  const myUid = _ctx?.getMyUid?.() || "";
  if (!isShooter(_currentMatchState, myUid)) return;
  const { state: newState } = applyShooterPick(_currentMatchState, myUid, {
    aimPosition: _pickedAimPosition, aimSide: _pickedAimSide,
  });
  await pushMatchUpdate(_currentMatchId, {
    phase: newState.phase,
    shooterPick: newState.shooterPick,
  });
  _ctx?.toast?.("🎯 Shot sent! Waiting for target to dodge...");
}

async function _handleDodge() {
  if (!_currentMatchState || !_currentMatchId) return;
  const myUid = _ctx?.getMyUid?.() || "";
  if (!isTarget(_currentMatchState, myUid)) return;
  const { state: newState, outcome, damage, winnerUid } = applyTargetPick(_currentMatchState, myUid, {
    dodgeSide: _pickedDodgeSide, posture: _pickedPosture,
  });
  await pushMatchUpdate(_currentMatchId, {
    phase: newState.phase,
    players: newState.players,
    shooter: newState.shooter,
    target: newState.target,
    shooterPick: newState.shooterPick,
    targetPick: newState.targetPick,
    lastResult: newState.lastResult,
    round: newState.round,
    winnerUid: newState.winnerUid,
  });
  if (winnerUid) {
    await declareWinner(_currentMatchId, winnerUid);
  }
  _pickedDodgeSide = "center";
  _pickedPosture = "standing";
}

async function _handleResign() {
  if (!_currentMatchId) return;
  if (!confirm("Resign? Your opponent wins the pot.")) return;
  await resignMatch(_currentMatchId);
}

function _closeSniperMatchScreen() {
  if (_unsubMatch) { _unsubMatch(); _unsubMatch = null; }
  if (_matchEl) _matchEl.style.display = "none";
  _currentMatchId = null;
  _currentMatchState = null;
}
