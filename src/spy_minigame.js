// src/spy_minigame.js — Code Breaker minigame (Simon Says-style).
//
// The system shows a pattern of coloured segments lighting up one by one.
// The player must tap them back in the same order. If they get a segment
// wrong, the round fails.
//
// Difficulty scales with mission difficulty (3-8 segments).
// Stars based on mistakes:
//   3 stars = completed with no mistakes
//   2 stars = completed with 1-2 mistakes (retries allowed)
//   1 star = completed with 3+ mistakes
//   0 stars (failure) = too many mistakes (>= 5) OR player taps out
//
// This module is UI-agnostic — it exposes:
//   startCodeBreaker({ difficulty, onWin, onLose, onShow, onInput, onResult })
//     onShow(idx)         — called when segment idx lights up (during display phase)
//     onInput(idx)        — called when player taps segment idx (during input phase)
//     onResult({ ok })    — called after each input to say if it was correct
//     onWin({ stars, time, mistakes })
//     onLose({ time, mistakes })
//
// The caller (spy_mission_ui.js) renders the UI + wires touch/click events
// to call playerTapped(idx).

const COLORS = [
  { hex: "#e11d48", name: "red" },
  { hex: "#f2b134", name: "gold" },
  { hex: "#4ade80", name: "green" },
  { hex: "#1d5fa8", name: "blue" },
  { hex: "#9333ea", name: "purple" },
  { hex: "#f97316", name: "orange" },
  { hex: "#06b6d4", name: "cyan" },
  { hex: "#ec4899", name: "pink" },
];

const MAX_MISTAKES = 5;       // lose after this many mistakes
const DISPLAY_INTERVAL_MS = 600; // 600ms per segment during display phase
const DISPLAY_GAP_MS = 200;   // gap between segments during display phase

let _state = null;

export function startCodeBreaker({ difficulty, onShow, onInput, onResult, onWin, onLose }) {
  // Generate the code (sequence of colour indices)
  const length = Math.max(3, Math.min(8, difficulty));
  const code = [];
  for (let i = 0; i < length; i++) {
    code.push(Math.floor(Math.random() * Math.min(COLORS.length, length + 2)));
  }
  _state = {
    code,
    length,
    inputIdx: 0,
    phase: "display",   // "display" | "input" | "won" | "lost"
    mistakes: 0,
    startTime: Date.now(),
    onShow, onInput, onResult, onWin, onLose,
    timeouts: [],
  };
  // Start the display phase after a short delay
  const t = setTimeout(() => _playDisplay(), 800);
  _state.timeouts.push(t);
  return _getState();
}

function _playDisplay() {
  if (!_state || _state.phase !== "display") return;
  let i = 0;
  const step = () => {
    if (!_state || _state.phase !== "display") return;
    if (i >= _state.length) {
      // Display done → switch to input phase
      _state.phase = "input";
      _state.inputIdx = 0;
      return;
    }
    const idx = _state.code[i];
    _state.onShow?.(idx);
    i++;
    const t = setTimeout(step, DISPLAY_INTERVAL_MS);
    _state.timeouts.push(t);
  };
  step();
}

// Called by the UI when the player taps a colour segment
export function playerTapped(idx) {
  if (!_state || _state.phase !== "input") return;
  _state.onInput?.(idx);
  const expected = _state.code[_state.inputIdx];
  if (idx === expected) {
    _state.onResult?.({ ok: true, idx, expectedIdx: _state.inputIdx });
    _state.inputIdx++;
    if (_state.inputIdx >= _state.length) {
      // Won!
      _state.phase = "won";
      const elapsed = Date.now() - _state.startTime;
      const stars = _state.mistakes === 0 ? 3 : _state.mistakes <= 2 ? 2 : 1;
      _state.onWin?.({ stars, time: elapsed, mistakes: _state.mistakes });
      _cleanup();
    }
  } else {
    _state.mistakes++;
    _state.onResult?.({ ok: false, idx, expectedIdx: _state.inputIdx });
    if (_state.mistakes >= MAX_MISTAKES) {
      // Lost
      _state.phase = "lost";
      const elapsed = Date.now() - _state.startTime;
      _state.onLose?.({ time: elapsed, mistakes: _state.mistakes });
      _cleanup();
    } else {
      // Restart the display phase (show the same code again, let player try)
      _state.phase = "display";
      _state.inputIdx = 0;
      const t = setTimeout(() => _playDisplay(), 800);
      _state.timeouts.push(t);
    }
  }
}

export function cancelCodeBreaker() {
  _cleanup();
}

function _cleanup() {
  if (!_state) return;
  _state.timeouts.forEach(t => clearTimeout(t));
  _state.timeouts = [];
  _state.phase = "stopped";
}

function _getState() {
  if (!_state) return null;
  return {
    code: _state.code,
    length: _state.length,
    inputIdx: _state.inputIdx,
    phase: _state.phase,
    mistakes: _state.mistakes,
    startTime: _state.startTime,
  };
}

export function getColor(idx) {
  return COLORS[idx] || COLORS[0];
}

export function getColors() {
  return COLORS;
}

// Number of unique colours used for a given difficulty
export function getNumColors(difficulty) {
  return Math.min(COLORS.length, Math.max(3, difficulty + 2));
}
