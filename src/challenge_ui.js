// src/challenge_ui.js — UI overlay for the Challenge Anyone system.
//
// Three UI modes:
//   1. HUD button (always visible) — 🎲 dice icon, tap to open the creator
//   2. Creator panel — pick game + stake, then "Open Challenge" broadcasts
//   3. Match screen — full-screen overlay when in an active match
//
// Also: a toast notification appears for ALL online players when a new
// challenge is opened, with a "Tap to Accept" button.

import {
  openChallenge, acceptChallenge, cancelChallenge, resignMatch,
  pushMatchUpdate, subscribeToChallenges, subscribeToMatch, declareWinner,
} from "./challenge_system.js";
import {
  applyRoll, applyBank, applyResign, isMyTurn, getWinnerName, getPlayerScore,
  TARGET_SCORE,
} from "./capital_dice.js";
import { openTennisMatchScreen, initTennisUI } from "./tennis_ui.js";
import { openPenaltyMatchScreen, initPenaltyUI } from "./penalty_shootout_ui.js";
import { db } from "./firebase.js";
import { ref, get as fbGet } from "firebase/database";

let _ctx = null;
let _hudBtn = null;
let _creatorEl = null;
let _matchEl = null;
let _activeToast = null;
let _unsubChallenges = null;
let _unsubMatch = null;
let _currentMatchId = null;
let _currentMatchState = null;
let _seenChallengeIds = new Set();
let _rollAnimTimer = null;

export function initChallengeUI(ctx) {
  _ctx = ctx;
  _ensureHudBtn();
  // Subscribe to broadcasted challenges — show a toast when a new one opens
  _unsubChallenges = subscribeToChallenges((ch, id) => {
    // Skip if we've already shown this one OR it's our own
    if (_seenChallengeIds.has(id)) return;
    _seenChallengeIds.add(id);
    // Only show the toast if the challenge is still open
    if (ch.status === "open") {
      _showChallengeToast(ch, id);
    }
  });
}

// ---- HUD button (always visible) ----
function _ensureHudBtn() {
  if (_hudBtn) return;
  _hudBtn = document.createElement("button");
  _hudBtn.innerHTML = "🎲";
  _hudBtn.title = "Challenge Anyone";
  _hudBtn.style.cssText =
    "position:fixed;right:20px;bottom:calc(220px + env(safe-area-inset-bottom));" +
    "width:48px;height:48px;border-radius:50%;background:#f2b134;color:#1a1a1a;" +
    "border:2px solid #fff;font-size:22px;cursor:pointer;z-index:28;" +
    "box-shadow:0 4px 12px rgba(0,0,0,.4);";
  _hudBtn.onclick = () => _openCreator();
  document.body.appendChild(_hudBtn);
}

// ---- Creator panel ----
function _openCreator() {
  if (!_creatorEl) {
    _creatorEl = document.createElement("div");
    _creatorEl.id = "challenge-creator";
    _creatorEl.style.cssText =
      "position:fixed;inset:0;z-index:46;display:none;flex-direction:column;" +
      "background:rgba(15,77,58,.97);color:#fff;font-family:Poppins,system-ui,sans-serif;" +
      "overflow-y:auto;-webkit-overflow-scrolling:touch;";
    document.body.appendChild(_creatorEl);
  }
  const balance = _ctx?.game?.state?.money || 0;
  _creatorEl.innerHTML = `
    <style>
      #challenge-creator .cc-wrap { max-width:480px;margin:0 auto;padding:18px 16px calc(20px + env(safe-area-inset-bottom)); }
      #challenge-creator .cc-close { position:sticky;top:0;display:flex;justify-content:flex-end;margin:-18px -16px 8px;padding:14px 16px 6px;background:linear-gradient(180deg,rgba(0,0,0,.25),transparent); }
      #challenge-creator .cc-close button { background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:8px;padding:7px 12px;cursor:pointer;font:600 12px Poppins,sans-serif; }
      #challenge-creator .cc-head { text-align:center;margin-bottom:18px; }
      #challenge-creator .cc-emoji { font-size:48px;line-height:1;margin-bottom:6px; }
      #challenge-creator .cc-title { font-size:20px;font-weight:800;color:#fff; }
      #challenge-creator .cc-sub { font-size:12px;color:#f2b134;margin-top:4px;font-weight:600;text-transform:uppercase;letter-spacing:.4px; }
      #challenge-creator .cc-balance { text-align:center;font-size:11px;color:#9ec9b0;margin-bottom:14px; }
      #challenge-creator .cc-section { font-size:11px;color:#9ec9b0;text-transform:uppercase;letter-spacing:.5px;margin:14px 0 6px;font-weight:700; }
      #challenge-creator .cc-games { display:flex;gap:8px; }
      #challenge-creator .cc-game { flex:1;padding:12px;border-radius:10px;background:#1a3b2a;border:1px solid #2c5240;cursor:pointer;text-align:center; }
      #challenge-creator .cc-game.selected { border:2px solid #f2b134;background:#2a5240; }
      #challenge-creator .cc-game .emoji { font-size:24px; }
      #challenge-creator .cc-game .name { font-size:12px;font-weight:600;margin-top:4px; }
      #challenge-creator .cc-game .desc { font-size:10px;color:#9ec9b0;margin-top:2px; }
      #challenge-creator .cc-stakes { display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px; }
      #challenge-creator .cc-stake { padding:10px;border-radius:8px;background:#1a3b2a;border:1px solid #2c5240;cursor:pointer;text-align:center;color:#fff;font:600 13px Poppins,sans-serif; }
      #challenge-creator .cc-stake.selected { border:2px solid #f2b134;background:#2a5240; }
      #challenge-creator .cc-custom { display:flex;gap:6px;margin-top:6px;align-items:center; }
      #challenge-creator .cc-custom input { flex:1;padding:10px;border-radius:8px;background:#1a3b2a;border:1px solid #2c5240;color:#fff;font:13px Poppins,sans-serif;outline:none; }
      #challenge-creator .cc-custom button { padding:10px 14px;border-radius:8px;background:#2c5240;border:none;color:#fff;font:600 12px Poppins,sans-serif;cursor:pointer; }
      #challenge-creator .cc-open { width:100%;margin-top:18px;padding:14px;border-radius:12px;border:none;background:linear-gradient(145deg,#f2b134,#d98e2b);color:#1a1a1a;font:700 14px Poppins,sans-serif;cursor:pointer; }
      #challenge-creator .cc-toast { position:sticky;bottom:0;margin:-20px -16px 0;padding:14px 16px;background:rgba(15,77,58,.97);color:#f2b134;font:700 13px Poppins,sans-serif;text-align:center;border-top:1px solid #f2b134;display:none; }
      #challenge-creator .cc-toast.show { display:block; }
    </style>
    <div class="cc-wrap">
      <div class="cc-close"><button onclick="window._ccClose()">✕ Close</button></div>
      <div class="cc-head">
        <div class="cc-emoji">🎲</div>
        <div class="cc-title">Challenge Anyone</div>
        <div class="cc-sub">Stake real money · Winner takes pot</div>
      </div>
      <div class="cc-balance">Your balance: ₦${balance.toLocaleString()}</div>
      <div class="cc-section">Pick a game</div>
      <div class="cc-games">
        <div class="cc-game selected" data-game="capital_dice">
          <div class="emoji">🎲</div>
          <div class="name">Capital Dice</div>
          <div class="desc">First to 100 wins</div>
        </div>
        <div class="cc-game" data-game="tennis">
          <div class="emoji">🎾</div>
          <div class="name">Tennis</div>
          <div class="desc">First to 11 (win by 2)</div>
        </div>
        <div class="cc-game" data-game="penalty_shootout">
          <div class="emoji">⚽</div>
          <div class="name">Penalty Shoot-out</div>
          <div class="desc">5 kicks each, most goals wins</div>
        </div>
      </div>
      <div class="cc-section">Stake (winner takes 95% of pot)</div>
      <div class="cc-stakes">
        <div class="cc-stake" data-stake="5000">₦5,000</div>
        <div class="cc-stake" data-stake="10000">₦10,000</div>
        <div class="cc-stake selected" data-stake="25000">₦25,000</div>
        <div class="cc-stake" data-stake="50000">₦50,000</div>
        <div class="cc-stake" data-stake="100000">₦100,000</div>
        <div class="cc-stake" data-stake="custom">Custom</div>
      </div>
      <div class="cc-custom" id="cc-custom-row" style="display:none;">
        <input id="cc-custom-input" type="number" placeholder="Enter amount (min ₦1,000)" min="1000" />
        <button onclick="window._ccSetCustom()">Set</button>
      </div>
      <button class="cc-open" onclick="window._ccOpenChallenge()">🎲 Open Challenge — Broadcast to all online players</button>
      <div id="cc-toast" class="cc-toast"></div>
    </div>
  `;
  _creatorEl.style.display = "flex";
  // wire window functions
  window._ccClose = () => { _creatorEl.style.display = "none"; };
  window._ccOpenChallenge = _handleOpenChallenge;
  window._ccSetCustom = _handleSetCustom;
  // wire game + stake selection
  _creatorEl.querySelectorAll(".cc-game").forEach(el => {
    el.onclick = () => {
      _creatorEl.querySelectorAll(".cc-game").forEach(x => x.classList.remove("selected"));
      el.classList.add("selected");
    };
  });
  _creatorEl.querySelectorAll(".cc-stake").forEach(el => {
    el.onclick = () => {
      _creatorEl.querySelectorAll(".cc-stake").forEach(x => x.classList.remove("selected"));
      el.classList.add("selected");
      const stake = el.dataset.stake;
      const customRow = _creatorEl.querySelector("#cc-custom-row");
      if (customRow) customRow.style.display = stake === "custom" ? "flex" : "none";
    };
  });
}

function _getSelectedGame() {
  const el = _creatorEl?.querySelector(".cc-game.selected");
  return el?.dataset.game || "capital_dice";
}
function _getSelectedStake() {
  const el = _creatorEl?.querySelector(".cc-stake.selected");
  if (!el) return 25000;
  const s = el.dataset.stake;
  if (s === "custom") {
    const input = _creatorEl.querySelector("#cc-custom-input");
    return Math.max(1000, parseInt(input?.value || "1000", 10));
  }
  return parseInt(s, 10);
}
function _showCreatorToast(msg) {
  const t = _creatorEl?.querySelector("#cc-toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

async function _handleOpenChallenge() {
  const game = _getSelectedGame();
  const stake = _getSelectedStake();
  const balance = _ctx?.game?.state?.money || 0;
  if (balance < stake) {
    _showCreatorToast("Not enough money — need ₦" + stake.toLocaleString());
    return;
  }
  const challengeId = await openChallenge({
    game, stake,
    hostName: _ctx?.getMyName?.() || "Player",
  });
  if (challengeId) {
    _showCreatorToast("🎲 Challenge open! Waiting for opponent...");
    // Close creator after a beat
    setTimeout(() => { if (_creatorEl) _creatorEl.style.display = "none"; }, 1500);
  }
}

function _handleSetCustom() {
  // Just trigger the selected state — actual value read in _getSelectedStake
  _showCreatorToast("Custom stake set");
}

// ---- Toast when a new challenge opens (visible to all online players) ----
function _showChallengeToast(ch, challengeId) {
  // Remove any existing toast
  if (_activeToast) { _activeToast.remove(); _activeToast = null; }
  _activeToast = document.createElement("div");
  _activeToast.style.cssText =
    "position:fixed;left:50%;bottom:calc(120px + env(safe-area-inset-bottom));" +
    "transform:translateX(-50%);background:rgba(15,77,58,.97);color:#fff;" +
    "padding:12px 16px;border-radius:14px;font:600 13px Poppins,sans-serif;" +
    "box-shadow:0 6px 20px rgba(0,0,0,.4);z-index:35;display:flex;flex-direction:column;" +
    "align-items:center;gap:8px;border:1px solid #f2b134;max-width:90vw;text-align:center;";
  _activeToast.innerHTML = `
    <div style="font-size:13px;font-weight:700;color:#f2b134;">
      🎲 ${ch.hostName} is challenging anyone!
    </div>
    <div style="font-size:11px;color:#9ec9b0;">
      Capital Dice · Stake ₦${ch.stake.toLocaleString()} · Pot ₦${(ch.stake * 2).toLocaleString()}
    </div>
    <button onclick="window._ccAccept('${challengeId}')" style="background:#4ade80;color:#000;border:none;border-radius:8px;padding:8px 18px;font:700 12px Poppins,sans-serif;cursor:pointer;">
      Accept Challenge
    </button>
  `;
  document.body.appendChild(_activeToast);
  // Auto-remove after 30 seconds if no one accepts
  setTimeout(() => { if (_activeToast) { _activeToast.remove(); _activeToast = null; } }, 30000);
  // Wire accept
  window._ccAccept = async (id) => {
    const matchId = await acceptChallenge(id);
    if (_activeToast) { _activeToast.remove(); _activeToast = null; }
    if (matchId) {
      _openMatchScreen(matchId);
    }
  };
}

// ---- Match screen (full-screen overlay when in a match) ----
async function _openMatchScreen(matchId) {
  _currentMatchId = matchId;
  if (!_matchEl) {
    _matchEl = document.createElement("div");
    _matchEl.id = "challenge-match";
    _matchEl.style.cssText =
      "position:fixed;inset:0;z-index:50;display:none;flex-direction:column;" +
      "background:radial-gradient(circle at 50% 30%,#1a3b2a,#0a1a14);color:#fff;" +
      "font-family:Poppins,system-ui,sans-serif;overflow-y:auto;";
    document.body.appendChild(_matchEl);
  }
  // First peek at the match state to know which game's UI to render.
  // Default to Capital Dice (the original game).
  try {
    const snap = await fbGet(ref(db, "matches/" + matchId));
    const m = snap.val();
    if (m && m.game === "tennis") {
      // Hide the capital_dice match element + delegate to tennis_ui
      _matchEl.style.display = "none";
      openTennisMatchScreen(matchId);
      return;
    }
    if (m && m.game === "penalty_shootout") {
      _matchEl.style.display = "none";
      openPenaltyMatchScreen(matchId);
      return;
    }
  } catch (e) {
    // Peek failed — fall through to capital_dice default
    console.warn("[challenge_ui] peek match failed:", e.message);
  }
  _matchEl.style.display = "flex";
  // Subscribe to match state updates (Capital Dice default)
  if (_unsubMatch) _unsubMatch();
  _unsubMatch = subscribeToMatch(matchId, (state) => {
    _currentMatchState = state;
    _renderMatch(state);
  });
}

function _renderMatch(state) {
  if (!state || !_matchEl) return;
  const myUid = _ctx?.getMyUid?.() || "";
  const myName = state.players[myUid]?.name || "You";
  const otherUid = Object.keys(state.players).find(k => k !== myUid);
  const otherName = state.players[otherUid]?.name || "Opponent";
  const myScore = getPlayerScore(state, myUid);
  const otherScore = getPlayerScore(state, otherUid);
  const myTurn = isMyTurn(state, myUid);
  const turnScore = state.turnScore || 0;
  const lastRoll = state.lastRoll || 0;
  const winner = state.winnerUid;
  const isWinner = winner === myUid;
  const winnerName = winner ? getWinnerName(state) : null;

  // Show different content if match is over
  if (winner) {
    _matchEl.innerHTML = `
      <style>
        #challenge-match .cm-wrap { max-width:520px;margin:0 auto;padding:20px 16px calc(40px + env(safe-area-inset-bottom));text-align:center; }
        #challenge-match .cm-trophy { font-size:80px;line-height:1;margin:20px 0;animation:cm-bounce 1s ease infinite; }
        @keyframes cm-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        #challenge-match .cm-result { font-size:22px;font-weight:800;color:${isWinner ? '#4ade80' : '#e11d48'};margin:12px 0; }
        #challenge-match .cm-payout { font-size:14px;color:#f2b134;font-weight:600;margin:6px 0 20px; }
        #challenge-match .cm-close { width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(145deg,#f2b134,#d98e2b);color:#1a1a1a;font:700 14px Poppins,sans-serif;cursor:pointer; }
      </style>
      <div class="cm-wrap">
        <div class="cm-trophy">${isWinner ? '🏆' : '😔'}</div>
        <div class="cm-result">${isWinner ? 'YOU WIN!' : 'You lose'}</div>
        <div class="cm-payout">${isWinner ? 'You won the pot' : 'Better luck next time'}</div>
        <div style="font-size:11px;color:#9ec9b0;margin-bottom:20px;">
          Final score: ${myName} ${myScore} — ${otherScore} ${otherName}
        </div>
        <button class="cm-close" onclick="window._cmClose()">Close</button>
      </div>
    `;
    window._cmClose = () => _closeMatchScreen();
    return;
  }

  // Match in progress
  _matchEl.innerHTML = `
    <style>
      #challenge-match .cm-wrap { max-width:520px;margin:0 auto;padding:20px 16px calc(20px + env(safe-area-inset-bottom)); }
      #challenge-match .cm-head { text-align:center;margin-bottom:20px; }
      #challenge-match .cm-title { font-size:18px;font-weight:800;color:#f2b134;text-transform:uppercase;letter-spacing:.4px; }
      #challenge-match .cm-stake { font-size:11px;color:#9ec9b0;margin-top:4px; }
      #challenge-match .cm-players { display:grid;grid-template-columns:1fr auto 1fr;gap:8px;margin:20px 0;align-items:center; }
      #challenge-match .cm-player { text-align:center;padding:12px;border-radius:12px;background:rgba(255,255,255,.05);border:2px solid transparent; }
      #challenge-match .cm-player.me { border-color:#4ade80; }
      #challenge-match .cm-player.active { background:rgba(242,177,52,.15);border-color:#f2b134; }
      #challenge-match .cm-player .name { font-size:13px;font-weight:700;color:#fff; }
      #challenge-match .cm-player .score { font-size:36px;font-weight:800;color:#f2b134;margin:6px 0;line-height:1; }
      #challenge-match .cm-player .label { font-size:10px;color:#9ec9b0;text-transform:uppercase; }
      #challenge-match .cm-vs { font-size:18px;font-weight:700;color:#9ec9b0; }
      #challenge-match .cm-target { text-align:center;font-size:11px;color:#9ec9b0;margin:-10px 0 18px; }
      #challenge-match .cm-die { text-align:center;margin:14px 0; }
      #challenge-match .cm-die-face { display:inline-block;width:96px;height:96px;border-radius:14px;background:#fff;color:#1a1a1a;font-size:48px;font-weight:800;line-height:96px;box-shadow:0 6px 18px rgba(0,0,0,.4);transition:transform .2s;${lastRoll ? '' : 'opacity:.3;'} }
      #challenge-match .cm-die-face.rolling { animation:cm-roll .4s ease; }
      @keyframes cm-roll { 0% { transform: rotate(0) scale(1); } 50% { transform: rotate(180deg) scale(1.1); } 100% { transform: rotate(360deg) scale(1); } }
      #challenge-match .cm-turn-score { text-align:center;font-size:13px;color:#9ec9b0;margin:8px 0; }
      #challenge-match .cm-turn-score b { color:#4ade80; }
      #challenge-match .cm-actions { display:flex;gap:10px;margin-top:18px;justify-content:center; }
      #challenge-match .cm-btn { padding:14px 24px;border-radius:14px;border:none;font:700 14px Poppins,sans-serif;cursor:pointer;min-width:120px; }
      #challenge-match .cm-btn:disabled { opacity:.4;cursor:not-allowed; }
      #challenge-match .cm-btn-roll { background:linear-gradient(145deg,#4ade80,#16a34a);color:#fff; }
      #challenge-match .cm-btn-bank { background:linear-gradient(145deg,#f2b134,#d98e2b);color:#1a1a1a; }
      #challenge-match .cm-btn-resign { background:rgba(225,29,72,.85);color:#fff; }
      #challenge-match .cm-waiting { text-align:center;font-size:13px;color:#9ec9b0;font-style:italic;padding:20px; }
    </style>
    <div class="cm-wrap">
      <div class="cm-head">
        <div class="cm-title">🎲 Capital Dice</div>
        <div class="cm-stake">First to ${state.target || 100} wins · Pot ₦${(state.challengeStake || 0).toLocaleString()}</div>
      </div>
      <div class="cm-players">
        <div class="cm-player me ${myTurn ? 'active' : ''}">
          <div class="name">${myName} (You)</div>
          <div class="score">${myScore}</div>
          <div class="label">Score</div>
        </div>
        <div class="cm-vs">vs</div>
        <div class="cm-player ${!myTurn ? 'active' : ''}">
          <div class="name">${otherName}</div>
          <div class="score">${otherScore}</div>
          <div class="label">Score</div>
        </div>
      </div>
      <div class="cm-target">First to ${state.target || 100} wins</div>
      <div class="cm-die">
        <div id="cm-die-face" class="cm-die-face">${lastRoll || '?'}</div>
      </div>
      <div class="cm-turn-score">Turn score: <b>${turnScore}</b></div>
      ${myTurn ? `
        <div class="cm-actions">
          <button class="cm-btn cm-btn-roll" onclick="window._cmRoll()">🎲 Roll</button>
          <button class="cm-btn cm-btn-bank" ${turnScore === 0 ? 'disabled' : ''} onclick="window._cmBank()">🏦 Bank</button>
          <button class="cm-btn cm-btn-resign" onclick="window._cmResign()">🏳️ Resign</button>
        </div>
      ` : `
        <div class="cm-waiting">⏳ Waiting for ${otherName} to play...</div>
      `}
    </div>
  `;
  window._cmRoll = _handleRoll;
  window._cmBank = _handleBank;
  window._cmResign = _handleResign;
}

async function _handleRoll() {
  if (!_currentMatchState || !_currentMatchId) return;
  const myUid = _ctx?.getMyUid?.() || "";
  if (!isMyTurn(_currentMatchState, myUid)) return;
  // Disable button immediately to prevent double-roll
  const dieFace = document.getElementById("cm-die-face");
  if (dieFace) {
    dieFace.classList.add("rolling");
    // Quick visual roll animation: show random faces during the spin
    if (_rollAnimTimer) clearInterval(_rollAnimTimer);
    _rollAnimTimer = setInterval(() => {
      dieFace.textContent = Math.floor(Math.random() * 6) + 1;
    }, 60);
  }
  // Apply the roll locally to compute new state
  const { state: newState, outcome } = applyRoll(_currentMatchState);
  // Push to Firebase
  await pushMatchUpdate(_currentMatchId, {
    turnScore: newState.turnScore,
    lastRoll: newState.lastRoll,
    currentPlayer: newState.currentPlayer,
    players: newState.players,
    winnerUid: newState.winnerUid,
  });
  // Stop animation after a beat
  setTimeout(() => {
    if (_rollAnimTimer) { clearInterval(_rollAnimTimer); _rollAnimTimer = null; }
    if (dieFace) dieFace.classList.remove("rolling");
  }, 400);
  // If the roll was a bust (rolled 1), tell the user
  if (outcome === "bust") {
    _ctx?.toast?.("🎲 Rolled a 1! Turn ends.");
  }
  // Check winner (shouldn't happen on roll, only on bank)
  if (newState.winnerUid) {
    await declareWinner(_currentMatchId, newState.winnerUid);
  }
}

async function _handleBank() {
  if (!_currentMatchState || !_currentMatchId) return;
  const myUid = _ctx?.getMyUid?.() || "";
  if (!isMyTurn(_currentMatchState, myUid)) return;
  if (_currentMatchState.turnScore === 0) return;
  const { state: newState, outcome, bankedScore, newTotal } = applyBank(_currentMatchState);
  await pushMatchUpdate(_currentMatchId, {
    turnScore: newState.turnScore,
    currentPlayer: newState.currentPlayer,
    players: newState.players,
    winnerUid: newState.winnerUid,
  });
  if (outcome === "win") {
    _ctx?.toast?.("🏆 You banked " + bankedScore + " → " + newTotal + "! You win!");
    await declareWinner(_currentMatchId, newState.winnerUid);
  } else {
    _ctx?.toast?.("🏦 Banked " + bankedScore + " points. Total: " + newTotal);
  }
}

async function _handleResign() {
  if (!_currentMatchId) return;
  if (!confirm("Are you sure you want to resign? Your opponent wins the pot.")) return;
  await resignMatch(_currentMatchId);
}

function _closeMatchScreen() {
  if (_unsubMatch) { _unsubMatch(); _unsubMatch = null; }
  if (_matchEl) _matchEl.style.display = "none";
  _currentMatchId = null;
  _currentMatchState = null;
}

// Called from main.js when a match should auto-open (e.g. when MY challenge
// gets accepted, OR when I accept someone else's challenge).
export function openMatchForChallenge(challenge) {
  if (challenge.matchId) {
    _openMatchScreen(challenge.matchId);
  }
}
