// src/photo_mode.js — Photo Mode for flexing your house, your ride, your fits.
//
// When activated (via a 📸 button or keyboard shortcut 'P'), this:
//   1. Hides ALL HUD elements (top bar, joystick, buttons, phone, prompts)
//   2. Shows a small floating toolbar: "📸 Capture" / "🎥 Hide UI" / "✕ Exit"
//   3. Player can still walk + look around (so they can frame the shot)
//   4. On Capture: downloads a PNG screenshot of the canvas to the device
//   5. On Exit: restores all HUD
//
// Wire-up (in main.js):
//   import { initPhotoMode, enterPhotoMode, exitPhotoMode, isPhotoMode } from "./photo_mode.js";
//   initPhotoMode({ canvas: document.getElementById("game") });
//   // Then expose to window so buttons can trigger it:
//   window.enterPhotoMode = enterPhotoMode;

const HIDE_SELECTORS = [
  "#top-bar", "#hud", "#joystick", "#joy-knob",
  "#action-bar", "#place-actions", "#place-actions-toggle",
  "#emote-fab", "#veh-controls", "#vehicle-controls",
  "#phone-modal", "#toast", "#online-count", "#online-count-hud",
  "#place-prompt", "#chat-input", "#chat-log", "#world-chat",
  "#minimap", "#quest-tracker", "#needs-bar",
  "[data-ui='hud']", "[data-ui='overlay']",
];

let _active = false;
let _canvas = null;
let _toolbarEl = null;
let _hiddenEls = []; // { el, prevDisplay, prevVisibility }
let _keyHandler = null;

export function initPhotoMode({ canvas } = {}) {
  _canvas = canvas || document.getElementById("game");
}

export function isPhotoMode() { return _active; }

export function enterPhotoMode() {
  if (_active) return;
  _active = true;

  // Hide all HUD elements (remember their previous state so we can restore)
  _hiddenEls = [];
  for (const sel of HIDE_SELECTORS) {
    const els = document.querySelectorAll(sel);
    els.forEach(el => {
      const prevDisplay = el.style.display;
      const prevVis = el.style.visibility;
      _hiddenEls.push({ el, prevDisplay, prevVisibility: prevVis });
      el.style.visibility = "hidden"; // use visibility:hidden so layout doesn't shift
    });
  }

  // Show floating toolbar
  if (!_toolbarEl) {
    _toolbarEl = document.createElement("div");
    _toolbarEl.id = "photo-mode-toolbar";
    _toolbarEl.style.cssText =
      "position:fixed;bottom:calc(20px + env(safe-area-inset-bottom));left:50%;" +
      "transform:translateX(-50%);display:flex;gap:10px;z-index:90;" +
      "background:rgba(0,0,0,.7);backdrop-filter:blur(8px);" +
      "padding:10px 14px;border-radius:24px;box-shadow:0 4px 18px rgba(0,0,0,.4);";
    _toolbarEl.innerHTML = `
      <button id="pm-capture" style="background:#f2b134;color:#000;border:none;border-radius:50%;width:54px;height:54px;font-size:22px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.4);">📸</button>
      <button id="pm-hide-ui" style="background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:50%;width:44px;height:44px;font-size:18px;cursor:pointer;">🎥</button>
      <button id="pm-exit" style="background:#e11d48;color:#fff;border:none;border-radius:50%;width:44px;height:44px;font-size:18px;cursor:pointer;">✕</button>
    `;
    document.body.appendChild(_toolbarEl);
  }
  _toolbarEl.style.display = "flex";

  // Wire up toolbar buttons (idempotent — re-wire is fine)
  const captureBtn = document.getElementById("pm-capture");
  const hideUiBtn = document.getElementById("pm-hide-ui");
  const exitBtn = document.getElementById("pm-exit");
  if (captureBtn) captureBtn.onclick = _capture;
  if (hideUiBtn) hideUiBtn.onclick = _toggleToolbar;
  if (exitBtn) exitBtn.onclick = exitPhotoMode;

  // Keyboard shortcut: P to capture, Esc to exit
  if (!_keyHandler) {
    _keyHandler = (e) => {
      if (!_active) return;
      if (e.key === "p" || e.key === "P") { e.preventDefault(); _capture(); }
      else if (e.key === "Escape") { e.preventDefault(); exitPhotoMode(); }
    };
    window.addEventListener("keydown", _keyHandler);
  }

  // Toast hint
  _showFlash("📸 Photo Mode — walk + look to frame, tap 📸 or press P to capture, Esc to exit");
}

export function exitPhotoMode() {
  if (!_active) return;
  _active = false;

  // Restore all hidden elements
  for (const { el, prevDisplay, prevVisibility } of _hiddenEls) {
    el.style.visibility = prevVisibility;
    // (we used visibility, not display, so we only restore visibility)
  }
  _hiddenEls = [];

  // Hide toolbar
  if (_toolbarEl) _toolbarEl.style.display = "none";

  // Remove keyboard handler
  if (_keyHandler) {
    window.removeEventListener("keydown", _keyHandler);
    _keyHandler = null;
  }
}

function _toggleToolbar() {
  if (!_toolbarEl) return;
  // Toggle the toolbar's own visibility (for "no UI" shots)
  const cur = _toolbarEl.style.display;
  _toolbarEl.style.display = cur === "none" ? "flex" : "none";
  _showFlash(cur === "none" ? "Toolbar back" : "All UI hidden — tap anywhere to restore");
  // Make the screen clickable to restore
  if (cur !== "none") {
    const restore = () => {
      _toolbarEl.style.display = "flex";
      document.removeEventListener("pointerdown", restore);
    };
    document.addEventListener("pointerdown", restore);
  }
}

async function _capture() {
  if (!_canvas) return;
  try {
    // Three.js renders to the canvas, so we can call toDataURL directly.
    // Force a render call before capture to ensure the latest frame is on
    // the canvas (renderer might be on a different frame timing).
    // We don't have a reference to the renderer here — just hope the last
    // frame is recent enough (the game runs at ~60fps so it is).
    // For preserveDrawingBuffer=true, toDataURL works. If the user's
    // renderer was created without that flag, we may get a black image.
    const dataUrl = _canvas.toDataURL("image/png");

    // Download to device
    const a = document.createElement("a");
    a.href = dataUrl;
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.download = `kaduna-lifestyle-${ts}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Flash effect (white flash to simulate camera shutter)
    _showFlash("📸 Captured! Check your downloads.", "#4ade80");

    // Try to copy to clipboard too (modern browsers)
    try {
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      _showFlash("📸 Captured + copied to clipboard!", "#4ade80");
    } catch (e) {
      // Clipboard write failed (probably not allowed without user gesture
      // or browser doesn't support ClipboardItem). Download is still saved.
    }
  } catch (e) {
    console.warn("[photo_mode] capture failed:", e.message);
    _showFlash("Capture failed — try the screenshot key on your device instead", "#e11d48");
  }
}

function _showFlash(text, bg = "rgba(15,77,58,.92)") {
  let flash = document.getElementById("pm-flash");
  if (!flash) {
    flash = document.createElement("div");
    flash.id = "pm-flash";
    flash.style.cssText =
      "position:fixed;bottom:calc(90px + env(safe-area-inset-bottom));left:50%;" +
      "transform:translateX(-50%);padding:10px 18px;border-radius:14px;" +
      "color:#fff;font:600 13px Poppins,sans-serif;z-index:91;" +
      "box-shadow:0 4px 14px rgba(0,0,0,.4);opacity:0;transition:opacity .25s;" +
      "border:1px solid #f2b134;text-align:center;max-width:90vw;pointer-events:none;";
    document.body.appendChild(flash);
  }
  flash.textContent = text;
  flash.style.background = bg;
  flash.style.opacity = "1";
  clearTimeout(flash._t);
  flash._t = setTimeout(() => { flash.style.opacity = "0"; }, 2500);
}
