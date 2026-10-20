// src/spy_mission_ui.js — Spy Missions phone app + cutscene + briefing + minigame + results.
//
// Plugs into the existing phone app system in main.js. Add "spymissions"
// to the apps list, and main.js will call showPhoneApp("spymissions")
// when the player taps the icon.
//
// Flow:
//   1. Player opens 🕵️ Spy Missions phone app → sees list of 6 missions
//      (locked if previous not completed)
//   2. Taps a mission → cutscene overlay opens with scrolling NPC dialogue
//   3. Tap "Accept Mission" → briefing screen shows objective + reward
//   4. Tap "Start Mission" → Code Breaker minigame launches
//   5. Minigame: pattern flashes, player taps back in order
//   6. On win → results screen with stars + reward + unlock tag
//   7. On lose → "Mission Failed" + retry button
//
// State machine for the overlays:
//   _mode: "list" | "cutscene" | "briefing" | "minigame" | "results"

import {
  getSpyMissions, getSpyMission, getSpyMissionProgress, isMissionUnlocked,
  getCompletedCount, getTotalReward, getEarnedReward, completeSpyMission, abandonSpyMission,
} from "./spy_missions.js";
import {
  startCodeBreaker, playerTapped, cancelCodeBreaker, getColors, getColor, getNumColors,
} from "./spy_minigame.js";

let _ctx = null;
let _overlayEl = null;
let _mode = "list";
let _currentMission = null;
let _lastResult = null;

export function initSpyMissionsUI(ctx) {
  _ctx = ctx;
}

// ---- Phone app render (called from main.js when showPhoneApp("spymissions")) ----
export function renderSpyMissionsApp(c) {
  const missions = getSpyMissions();
  const completed = getCompletedCount();
  const total = getTotalReward();
  const earned = getEarnedReward();
  let h = '<div style="font-size:14px;margin-bottom:8px;font-weight:700;color:#f2b134;">🕵️ Spy Missions</div>';
  h += '<div style="background:linear-gradient(135deg,#0a0a0a,#1a1a2a);color:#f2b134;border-radius:12px;padding:12px;margin-bottom:14px;text-align:center;border:1px solid #f2b134;">';
  h += '<div style="font-size:11px;color:#9ec9b0;margin-bottom:4px;">KADUNA INTELLIGENCE AGENCY</div>';
  h += '<div style="font-size:24px;font-weight:800;color:#f2b134;">' + completed + '/' + missions.length + '</div>';
  h += '<div style="font-size:11px;color:#9ec9b0;margin-top:2px;">Missions completed · ₦' + earned.toLocaleString() + ' / ₦' + total.toLocaleString() + ' earned</div>';
  h += '</div>';
  h += '<div style="font-size:11px;color:#9ec9b0;margin-bottom:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Mission Roster</div>';
  for (const m of missions) {
    const unlocked = isMissionUnlocked(m.id);
    const prog = getSpyMissionProgress(m.id);
    const stars = prog?.stars || 0;
    const starsHtml = '⭐'.repeat(stars) + '<span style="color:#444;">' + '⭐'.repeat(3 - stars) + '</span>';
    h += '<div onclick="' + (unlocked ? 'window._spyOpenMission(\'' + m.id + '\')' : '') + '" style="background:' + (unlocked ? '#17181b' : '#0a0a0a') + ';border-radius:10px;padding:10px;margin-bottom:8px;cursor:' + (unlocked ? 'pointer' : 'not-allowed') + ';opacity:' + (unlocked ? '1' : '.5') + ';border-left:3px solid ' + (prog?.completed ? '#4ade80' : unlocked ? '#f2b134' : '#444') + ';">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;">';
    h += '<div><span style="font-size:11px;color:#9ec9b0;font-family:monospace;">' + m.code + '</span><br><span style="font-size:13px;font-weight:700;color:#f2f2f4;">' + (unlocked ? m.name : '🔒 Locked') + '</span></div>';
    h += '<div style="font-size:13px;">' + starsHtml + '</div>';
    h += '</div>';
    if (unlocked) {
      h += '<div style="font-size:10px;color:#9ec9b0;margin-top:4px;">Difficulty: ' + m.difficulty + ' · Reward: ₦' + m.reward.toLocaleString() + ' + ' + m.xp + ' XP' + (m.unlockTag ? ' · Unlocks "' + m.unlockTag + '" tag' : '') + '</div>';
    } else {
      h += '<div style="font-size:10px;color:#6b7280;margin-top:4px;">Complete previous mission to unlock</div>';
    }
    h += '</div>';
  }
  h += '<div style="font-size:10px;color:#6b7280;margin-top:14px;text-align:center;">Missions completed: ' + completed + '/' + missions.length + '</div>';
  return h;
}

// ---- Open a mission (cutscene → briefing → minigame → results) ----
export function openMission(missionId) {
  const m = getSpyMission(missionId);
  if (!m) return;
  if (!isMissionUnlocked(missionId)) {
    _ctx?.toast?.("Mission locked — complete the previous one first");
    return;
  }
  _currentMission = m;
  _mode = "cutscene";
  _ensureOverlay();
  _renderCutscene();
}

// ---- Overlay management ----
function _ensureOverlay() {
  if (_overlayEl) return;
  _overlayEl = document.createElement("div");
  _overlayEl.id = "spy-mission-overlay";
  _overlayEl.style.cssText =
    "position:fixed;inset:0;z-index:50;display:none;flex-direction:column;" +
    "background:radial-gradient(circle at 50% 30%,#0a0a14,#000);color:#fff;" +
    "font-family:Poppins,system-ui,sans-serif;overflow-y:auto;";
  document.body.appendChild(_overlayEl);
  _overlayEl.style.display = "flex";
}

function _closeOverlay() {
  if (_overlayEl) {
    _overlayEl.style.display = "none";
    _overlayEl.innerHTML = "";
  }
  _mode = "list";
  _currentMission = null;
  _lastResult = null;
  cancelCodeBreaker();
}

// ---- Cutscene: NPC dialogue text scrolls ----
function _renderCutscene() {
  if (!_overlayEl || !_currentMission) return;
  const m = _currentMission;
  // Split the story intro into lines for the scrolling effect
  const lines = m.storyIntro.split("\n").filter(l => l.trim());
  _overlayEl.innerHTML = `
    <style>
      #spy-mission-overlay .sm-wrap { max-width:520px;margin:0 auto;padding:24px 16px calc(40px + env(safe-area-inset-bottom)); }
      #spy-mission-overlay .sm-agency { text-align:center;font-size:11px;color:#9ec9b0;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px; }
      #spy-mission-overlay .sm-code { text-align:center;font-size:13px;color:#f2b134;font-family:monospace;font-weight:700;margin-bottom:24px; }
      #spy-mission-overlay .sm-npc { display:flex;align-items:flex-start;gap:10px;margin-bottom:18px; }
      #spy-mission-overlay .sm-avatar { width:48px;height:48px;border-radius:50%;background:#1a1a2a;border:2px solid #f2b134;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0; }
      #spy-mission-overlay .sm-dialogue { flex:1;background:rgba(242,177,52,.08);border-left:3px solid #f2b134;border-radius:8px;padding:10px 12px;font-size:13px;line-height:1.5;color:#e8f0ea; }
      #spy-mission-overlay .sm-line { margin-bottom:8px;opacity:0;animation:sm-fade .8s ease forwards; }
      @keyframes sm-fade { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      #spy-mission-overlay .sm-actions { display:flex;gap:10px;margin-top:24px; }
      #spy-mission-overlay .sm-btn { flex:1;padding:14px;border-radius:12px;border:none;font:700 14px Poppins,sans-serif;cursor:pointer; }
      #spy-mission-overlay .sm-btn-accept { background:linear-gradient(145deg,#f2b134,#d98e2b);color:#1a1a1a; }
      #spy-mission-overlay .sm-btn-decline { background:rgba(225,29,72,.85);color:#fff; }
    </style>
    <div class="sm-wrap">
      <div class="sm-agency">KADUNA INTELLIGENCE AGENCY</div>
      <div class="sm-code">${m.code} · ${m.name}</div>
      <div class="sm-npc">
        <div class="sm-avatar">🕵️</div>
        <div class="sm-dialogue" id="sm-dialogue">
          ${lines.map((l, i) => `<div class="sm-line" style="animation-delay:${i * 0.6}s;">${l}</div>`).join("")}
        </div>
      </div>
      <div class="sm-actions">
        <button class="sm-btn sm-btn-decline" onclick="window._smDecline()">✕ Decline</button>
        <button class="sm-btn sm-btn-accept" onclick="window._smAccept()">✓ Accept Mission</button>
      </div>
    </div>
  `;
  window._smDecline = () => { _closeOverlay(); _ctx?.toast?.("Mission declined"); };
  window._smAccept = () => { _mode = "briefing"; _renderBriefing(); };
}

// ---- Briefing: objective + reward + start button ----
function _renderBriefing() {
  if (!_overlayEl || !_currentMission) return;
  const m = _currentMission;
  _overlayEl.innerHTML = `
    <style>
      #spy-mission-overlay .sm-wrap { max-width:520px;margin:0 auto;padding:24px 16px calc(40px + env(safe-area-inset-bottom)); }
      #spy-mission-overlay .sm-head { text-align:center;margin-bottom:18px; }
      #spy-mission-overlay .sm-title { font-size:18px;font-weight:800;color:#f2b134;text-transform:uppercase;letter-spacing:.4px; }
      #spy-mission-overlay .sm-code { font-size:11px;color:#9ec9b0;font-family:monospace;margin-top:4px; }
      #spy-mission-overlay .sm-objective { background:rgba(242,177,52,.08);border-left:3px solid #f2b134;border-radius:10px;padding:14px;font-size:13px;line-height:1.5;color:#e8f0ea;margin:14px 0; }
      #spy-mission-overlay .sm-rewards { display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0; }
      #spy-mission-overlay .sm-reward { background:rgba(255,255,255,.05);border-radius:8px;padding:10px;text-align:center; }
      #spy-mission-overlay .sm-reward .label { font-size:10px;color:#9ec9b0;text-transform:uppercase;letter-spacing:.5px; }
      #spy-mission-overlay .sm-reward .value { font-size:16px;font-weight:800;color:#f2b134;margin-top:4px; }
      #spy-mission-overlay .sm-difficulty { text-align:center;font-size:12px;color:#9ec9b0;margin:14px 0; }
      #spy-mission-overlay .sm-actions { display:flex;gap:10px;margin-top:18px; }
      #spy-mission-overlay .sm-btn { flex:1;padding:14px;border-radius:12px;border:none;font:700 14px Poppins,sans-serif;cursor:pointer; }
      #spy-mission-overlay .sm-btn-start { background:linear-gradient(145deg,#4ade80,#16a34a);color:#fff; }
      #spy-mission-overlay .sm-btn-cancel { background:rgba(255,255,255,.1);color:#9ec9b0; }
    </style>
    <div class="sm-wrap">
      <div class="sm-head">
        <div class="sm-title">${m.name}</div>
        <div class="sm-code">${m.code} · Difficulty ${m.difficulty}/${m.name}</div>
      </div>
      <div class="sm-objective">${m.briefing}</div>
      <div class="sm-rewards">
        <div class="sm-reward">
          <div class="label">Cash Reward</div>
          <div class="value">₦${m.reward.toLocaleString()}</div>
        </div>
        <div class="sm-reward">
          <div class="label">XP</div>
          <div class="value">${m.xp}</div>
        </div>
      </div>
      ${m.unlockTag ? `<div style="text-align:center;font-size:11px;color:#9ec9b0;margin:8px 0;">Badge unlock: <b style="color:#f2b134;">${m.unlockTag}</b> name tag</div>` : ''}
      <div class="sm-difficulty">Code length: ${m.difficulty} segments · Max ${5} mistakes before failure</div>
      <div class="sm-actions">
        <button class="sm-btn sm-btn-cancel" onclick="window._smCancelBrief()">✕ Cancel</button>
        <button class="sm-btn sm-btn-start" onclick="window._smStart()">🚀 Start Mission</button>
      </div>
    </div>
  `;
  window._smCancelBrief = () => { _mode = "cutscene"; _renderCutscene(); };
  window._smStart = () => { _mode = "minigame"; _renderMinigame(); };
}

// ---- Minigame: Code Breaker ----
function _renderMinigame() {
  if (!_overlayEl || !_currentMission) return;
  const m = _currentMission;
  const numColors = getNumColors(m.difficulty);
  const colors = getColors().slice(0, numColors);
  _overlayEl.innerHTML = `
    <style>
      #spy-mission-overlay .sm-wrap { max-width:520px;margin:0 auto;padding:24px 16px calc(40px + env(safe-area-inset-bottom)); }
      #spy-mission-overlay .sm-head { text-align:center;margin-bottom:18px; }
      #spy-mission-overlay .sm-title { font-size:18px;font-weight:800;color:#f2b134;text-transform:uppercase;letter-spacing:.4px; }
      #spy-mission-overlay .sm-status { font-size:11px;color:#9ec9b0;margin-top:4px;font-family:monospace; }
      #spy-mission-overlay .sm-grid { display:grid;grid-template-columns:repeat(${Math.min(4, numColors)},1fr);gap:10px;margin:24px 0; }
      #spy-mission-overlay .sm-seg { aspect-ratio:1;border-radius:14px;cursor:pointer;transition:transform .15s,filter .15s;border:2px solid rgba(255,255,255,.2);opacity:.7; }
      #spy-mission-overlay .sm-seg.active { opacity:1;filter:brightness(1.6) saturate(1.4);transform:scale(.97);box-shadow:0 0 18px currentColor; }
      #spy-mission-overlay .sm-seg.dim { opacity:.4;filter:saturate(.5); }
      #spy-mission-overlay .sm-seg:active { transform:scale(.92); }
      #spy-mission-overlay .sm-progress { text-align:center;font-size:13px;color:#9ec9b0;margin:14px 0;font-weight:600; }
      #spy-mission-overlay .sm-progress b { color:#f2b134; }
      #spy-mission-overlay .sm-actions { display:flex;gap:10px;margin-top:18px; }
      #spy-mission-overlay .sm-btn { flex:1;padding:12px;border-radius:10px;border:none;font:600 12px Poppins,sans-serif;cursor:pointer; }
      #spy-mission-overlay .sm-btn-abort { background:rgba(225,29,72,.6);color:#fff; }
    </style>
    <div class="sm-wrap">
      <div class="sm-head">
        <div class="sm-title">CODE BREAKER</div>
        <div class="sm-status" id="sm-status">▶ WATCH THE PATTERN...</div>
      </div>
      <div class="sm-progress" id="sm-progress">Segments cracked: <b>0</b>/${m.difficulty}</div>
      <div class="sm-grid" id="sm-grid">
        ${colors.map((c, i) => `<div class="sm-seg" data-idx="${i}" style="background:${c.hex};color:${c.hex};" onclick="window._smTap(${i})"></div>`).join("")}
      </div>
      <div class="sm-actions">
        <button class="sm-btn sm-btn-abort" onclick="window._smAbort()">✕ Abort Mission</button>
      </div>
    </div>
  `;
  window._smTap = (idx) => playerTapped(idx);
  window._smAbort = () => { abandonSpyMission(m.id); _closeOverlay(); _ctx?.toast?.("Mission aborted"); };
  // Start the minigame
  startCodeBreaker({
    difficulty: m.difficulty,
    onShow: (idx) => {
      // Light up segment idx during display phase
      const seg = _overlayEl?.querySelector(`.sm-seg[data-idx="${idx}"]`);
      if (seg) {
        seg.classList.add("active");
        setTimeout(() => seg.classList.remove("active"), 400);
      }
      const status = _overlayEl?.querySelector("#sm-status");
      if (status) status.textContent = "▶ WATCHING PATTERN...";
    },
    onInput: (idx) => {
      // Player tapped segment idx
      const seg = _overlayEl?.querySelector(`.sm-seg[data-idx="${idx}"]`);
      if (seg) {
        seg.classList.add("active");
        setTimeout(() => seg.classList.remove("active"), 250);
      }
    },
    onResult: ({ ok, expectedIdx }) => {
      const status = _overlayEl?.querySelector("#sm-status");
      const prog = _overlayEl?.querySelector("#sm-progress b");
      if (ok) {
        if (status) status.textContent = "✓ CORRECT — keep going";
        if (prog) prog.textContent = String(expectedIdx + 1);
      } else {
        if (status) status.textContent = "✕ WRONG — pattern will repeat";
      }
    },
    onWin: ({ stars, time, mistakes }) => {
      _lastResult = { stars, time, mistakes, won: true };
      // Save + pay out
      completeSpyMission(m.id, stars, time).then(() => {
        _mode = "results";
        _renderResults();
      });
    },
    onLose: ({ time, mistakes }) => {
      _lastResult = { stars: 0, time, mistakes, won: false };
      _mode = "results";
      _renderResults();
    },
  });
  // Set status to "input" when minigame transitions (we just poll the state via a timeout)
  // Simpler: we use the onShow callback's last call timing — after the display finishes,
  // the phase becomes "input". We can detect this by checking after DISPLAY_INTERVAL_MS * length.
  setTimeout(() => {
    const status = _overlayEl?.querySelector("#sm-status");
    if (status && _mode === "minigame") status.textContent = "▶ TAP THE PATTERN BACK";
  }, 800 + m.difficulty * 600);
}

// ---- Results screen ----
function _renderResults() {
  if (!_overlayEl || !_currentMission || !_lastResult) return;
  const m = _currentMission;
  const r = _lastResult;
  if (r.won) {
    const stars = '⭐'.repeat(r.stars) + '<span style="color:#444;">' + '⭐'.repeat(3 - r.stars) + '</span>';
    _overlayEl.innerHTML = `
      <style>
        #spy-mission-overlay .sm-wrap { max-width:520px;margin:0 auto;padding:24px 16px calc(40px + env(safe-area-inset-bottom));text-align:center; }
        #spy-mission-overlay .sm-trophy { font-size:80px;line-height:1;margin:20px 0;animation:sm-bounce 1s ease infinite; }
        @keyframes sm-bounce { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-12px); } }
        #spy-mission-overlay .sm-result { font-size:22px;font-weight:800;color:#4ade80;margin:12px 0; }
        #spy-mission-overlay .sm-stars { font-size:32px;margin:12px 0; }
        #spy-mission-overlay .sm-rewards-grid { display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0; }
        #spy-mission-overlay .sm-reward-card { background:rgba(74,222,128,.08);border:1px solid #4ade80;border-radius:8px;padding:10px; }
        #spy-mission-overlay .sm-reward-card .label { font-size:10px;color:#9ec9b0;text-transform:uppercase; }
        #spy-mission-overlay .sm-reward-card .value { font-size:18px;font-weight:800;color:#4ade80;margin-top:4px; }
        #spy-mission-overlay .sm-stats { font-size:11px;color:#9ec9b0;margin:8px 0; }
        #spy-mission-overlay .sm-actions { display:flex;gap:10px;margin-top:24px; }
        #spy-mission-overlay .sm-btn { flex:1;padding:14px;border-radius:12px;border:none;font:700 14px Poppins,sans-serif;cursor:pointer; }
        #spy-mission-overlay .sm-btn-close { background:linear-gradient(145deg,#f2b134,#d98e2b);color:#1a1a1a; }
        #spy-mission-overlay .sm-btn-retry { background:rgba(255,255,255,.1);color:#9ec9b0; }
        ${m.unlockTag ? `#spy-mission-overlay .sm-unlock { background:rgba(242,177,52,.15);border:1px solid #f2b134;border-radius:10px;padding:12px;margin:14px 0;font-size:12px;color:#f2b134;font-weight:700; }` : ''}
      </style>
      <div class="sm-wrap">
        <div class="sm-trophy">🏆</div>
        <div class="sm-result">MISSION COMPLETE</div>
        <div class="sm-stars">${stars}</div>
        <div class="sm-rewards-grid">
          <div class="sm-reward-card">
            <div class="label">Cash Reward</div>
            <div class="value">₦${m.reward.toLocaleString()}</div>
          </div>
          <div class="sm-reward-card">
            <div class="label">XP</div>
            <div class="value">+${m.xp}</div>
          </div>
        </div>
        ${m.unlockTag ? `<div class="sm-unlock">🏅 NAME TAG UNLOCKED: ${m.unlockTag}</div>` : ''}
        <div class="sm-stats">Time: ${(r.time / 1000).toFixed(1)}s · Mistakes: ${r.mistakes}</div>
        <div class="sm-actions">
          <button class="sm-btn sm-btn-retry" onclick="window._smRetry()">↻ Replay</button>
          <button class="sm-btn sm-btn-close" onclick="window._smClose()">✓ Done</button>
        </div>
      </div>
    `;
  } else {
    _overlayEl.innerHTML = `
      <style>
        #spy-mission-overlay .sm-wrap { max-width:520px;margin:0 auto;padding:24px 16px calc(40px + env(safe-area-inset-bottom));text-align:center; }
        #spy-mission-overlay .sm-fail { font-size:80px;line-height:1;margin:20px 0; }
        #spy-mission-overlay .sm-result { font-size:22px;font-weight:800;color:#e11d48;margin:12px 0; }
        #spy-mission-overlay .sm-stats { font-size:11px;color:#9ec9b0;margin:8px 0 24px; }
        #spy-mission-overlay .sm-actions { display:flex;gap:10px;margin-top:24px; }
        #spy-mission-overlay .sm-btn { flex:1;padding:14px;border-radius:12px;border:none;font:700 14px Poppins,sans-serif;cursor:pointer; }
        #spy-mission-overlay .sm-btn-retry { background:linear-gradient(145deg,#f2b134,#d98e2b);color:#1a1a1a; }
        #spy-mission-overlay .sm-btn-close { background:rgba(255,255,255,.1);color:#9ec9b0; }
      </style>
      <div class="sm-wrap">
        <div class="sm-fail">💀</div>
        <div class="sm-result">MISSION FAILED</div>
        <div class="sm-stats">${r.mistakes} mistakes · ${(r.time / 1000).toFixed(1)}s elapsed</div>
        <div style="font-size:12px;color:#9ec9b0;margin-bottom:18px;">The code self-wiped. Try again — agent.</div>
        <div class="sm-actions">
          <button class="sm-btn sm-btn-close" onclick="window._smClose()">✕ Give up</button>
          <button class="sm-btn sm-btn-retry" onclick="window._smRetry()">↻ Retry</button>
        </div>
      </div>
    `;
  }
  window._smClose = () => _closeOverlay();
  window._smRetry = () => { _mode = "minigame"; _renderMinigame(); };
}
