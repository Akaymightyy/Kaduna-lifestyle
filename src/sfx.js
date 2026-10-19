// Kaduna Lifestyle — Sound Effects (Web Audio API, no asset files needed)
// Generates UI clicks, money sounds, success/error chimes, footsteps,
// engine hums etc. procedurally. Lazy-inits on first user gesture so
// browsers don't block autoplay. Volume + mute persist in localStorage.
//
// Wire-up (in main.js):
//   import { initSfx, sfx, setMuted, isMuted } from "./sfx.js";
//   initSfx();                              // once, after first click
//   sfx.click();                            // UI buttons
//   sfx.money();                            // money gain
//   sfx.error();                            // toast errors
//   sfx.success();                         // level up, mission done
//   sfx.door();                             // enter/exit house
//   sfx.engine(true);                      // start car engine
//   sfx.engine(false);                     // stop
//   sfx.horn();                             // car horn
//   sfx.rain(true);                        // start rain ambient
//   sfx.rain(false);                       // stop

let _ctx = null;
let _master = null;
let _muted = false;
let _engineOsc = null;
let _engineGain = null;
let _rainNoise = null;
let _rainGain = null;

const STORE_KEY = "kaduna-sfx";

export function initSfx() {
  if (_ctx) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    _ctx = new Ctx();
    _master = _ctx.createGain();
    _master.gain.value = 0.5;
    _master.connect(_ctx.destination);
    // restore prefs
    try {
      const p = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      if (typeof p.muted === "boolean") _muted = p.muted;
      if (typeof p.vol === "number") _master.gain.value = p.vol;
    } catch (e) {}
  } catch (e) { console.warn("sfx init failed:", e.message); }
}

export function isMuted() { return _muted; }
export function setMuted(m) {
  _muted = !!m;
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ muted: _muted, vol: _master ? _master.gain.value : 0.5 })); } catch (e) {}
  if (_master) _master.gain.value = _muted ? 0 : (_master.gain.value || 0.5);
}

export function setVolume(v) {
  if (_master) _master.gain.value = _muted ? 0 : Math.min(1, Math.max(0, v));
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ muted: _muted, vol: v })); } catch (e) {}
}

// ---- internal: play a simple oscillator tone ----
function _tone(freq, dur, type = "sine", vol = 0.3, attack = 0.005, release = 0.08) {
  if (!_ctx || _muted) return;
  try {
    const o = _ctx.createOscillator();
    const g = _ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = 0;
    g.gain.setValueAtTime(0, _ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol, _ctx.currentTime + attack);
    g.gain.linearRampToValueAtTime(0, _ctx.currentTime + dur);
    o.connect(g); g.connect(_master);
    o.start();
    o.stop(_ctx.currentTime + dur + 0.02);
  } catch (e) {}
}

// ---- internal: noise burst (for steps, rain) ----
function _noise(dur, vol = 0.1, hp = 200, lp = 8000) {
  if (!_ctx || _muted) return;
  try {
    const buf = _ctx.createBuffer(1, Math.floor(_ctx.sampleRate * dur), _ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
    const src = _ctx.createBufferSource();
    src.buffer = buf;
    const g = _ctx.createGain();
    g.gain.value = vol;
    const hpF = _ctx.createBiquadFilter();
    hpF.type = "highpass"; hpF.frequency.value = hp;
    const lpF = _ctx.createBiquadFilter();
    lpF.type = "lowpass"; lpF.frequency.value = lp;
    src.connect(hpF); hpF.connect(lpF); lpF.connect(g); g.connect(_master);
    src.start();
    src.stop(_ctx.currentTime + dur);
  } catch (e) {}
}

// ---- public API ----
export const sfx = {
  // resume context on user gesture (browsers require this)
  resume() { if (_ctx && _ctx.state === "suspended") _ctx.resume(); },

  click() { _tone(880, 0.04, "square", 0.08); },
  tap()   { _tone(660, 0.05, "triangle", 0.1); },
  back()  { _tone(440, 0.05, "triangle", 0.08); _tone(330, 0.06, "triangle", 0.06); },

  money() {
    _tone(880, 0.08, "triangle", 0.18);
    setTimeout(() => _tone(1100, 0.1, "triangle", 0.18), 70);
    setTimeout(() => _tone(1320, 0.14, "triangle", 0.18), 150);
  },

  success() {
    _tone(660, 0.08, "sine", 0.15);
    setTimeout(() => _tone(880, 0.1, "sine", 0.18), 90);
    setTimeout(() => _tone(1320, 0.2, "sine", 0.2), 200);
  },

  error() {
    _tone(220, 0.12, "sawtooth", 0.18);
    setTimeout(() => _tone(180, 0.18, "sawtooth", 0.15), 110);
  },

  levelup() {
    _tone(523, 0.1, "square", 0.15);
    setTimeout(() => _tone(659, 0.1, "square", 0.15), 100);
    setTimeout(() => _tone(784, 0.1, "square", 0.15), 200);
    setTimeout(() => _tone(1047, 0.22, "square", 0.18), 300);
  },

  door() {
    _noise(0.08, 0.06, 400, 3000);
    _tone(150, 0.1, "sine", 0.12);
  },

  horn() {
    _tone(440, 0.4, "sawtooth", 0.18);
    _tone(550, 0.4, "sawtooth", 0.12);
  },

  step() {
    _noise(0.05, 0.04, 600, 2000);
  },

  pickup() {
    _tone(880, 0.05, "triangle", 0.15);
    setTimeout(() => _tone(1320, 0.1, "triangle", 0.18), 50);
  },

  // ---- car engine (looping) ----
  engine(on, rpm = 0.5) {
    if (!_ctx || _muted) return;
    if (on && !_engineOsc) {
      try {
        _engineOsc = _ctx.createOscillator();
        _engineGain = _ctx.createGain();
        _engineOsc.type = "sawtooth";
        _engineOsc.frequency.value = 60 + rpm * 80;
        _engineGain.gain.value = 0.0;
        _engineGain.gain.linearRampToValueAtTime(0.05, _ctx.currentTime + 0.2);
        _engineOsc.connect(_engineGain); _engineGain.connect(_master);
        _engineOsc.start();
      } catch (e) {}
    } else if (on && _engineOsc) {
      // adjust rpm
      try { _engineOsc.frequency.value = 60 + rpm * 80; } catch (e) {}
    } else if (!on && _engineOsc) {
      try {
        _engineGain.gain.linearRampToValueAtTime(0, _ctx.currentTime + 0.3);
        _engineOsc.stop(_ctx.currentTime + 0.4);
      } catch (e) {}
      _engineOsc = null; _engineGain = null;
    }
  },

  // ---- rain ambient (looping noise) ----
  rain(on) {
    if (!_ctx || _muted) return;
    if (on && !_rainNoise) {
      try {
        const buf = _ctx.createBuffer(1, _ctx.sampleRate * 2, _ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
        _rainNoise = _ctx.createBufferSource();
        _rainNoise.buffer = buf;
        _rainNoise.loop = true;
        _rainGain = _ctx.createGain();
        _rainGain.gain.value = 0.0;
        _rainGain.gain.linearRampToValueAtTime(0.12, _ctx.currentTime + 0.5);
        const lp = _ctx.createBiquadFilter();
        lp.type = "lowpass"; lp.frequency.value = 4000;
        _rainNoise.connect(lp); lp.connect(_rainGain); _rainGain.connect(_master);
        _rainNoise.start();
      } catch (e) {}
    } else if (!on && _rainNoise) {
      try {
        _rainGain.gain.linearRampToValueAtTime(0, _ctx.currentTime + 0.4);
        _rainNoise.stop(_ctx.currentTime + 0.5);
      } catch (e) {}
      _rainNoise = null; _rainGain = null;
    }
  },
};
