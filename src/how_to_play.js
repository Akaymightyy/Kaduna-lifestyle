// src/how_to_play.js — "How to Play" guide overlay for new players.
//
// Shows on first login (if localStorage flag not set) + accessible from
// Settings → "📖 How to Play" button. Covers: walking, driving, phone,
// buying cars, buying houses, challenging friends, spy missions.
//
// Wire-up (in main.js):
//   import { initHowToPlay, showHowToPlay } from "./how_to_play.js";
//   initHowToPlay();
//   window.showHowToPlay = showHowToPlay;

let _overlayEl = null;
const SEEN_KEY = "kaduna-howto-seen";

export function initHowToPlay() {
  // Check if this is the first time — show automatically
  let seen = false;
  try { seen = localStorage.getItem(SEEN_KEY) === "1"; } catch (e) {}
  if (!seen) {
    // Show after a short delay (let the game load first)
    setTimeout(() => { showHowToPlay(); }, 3000);
  }
}

export function showHowToPlay() {
  if (!_overlayEl) {
    _overlayEl = document.createElement("div");
    _overlayEl.id = "howto-overlay";
    _overlayEl.style.cssText =
      "position:fixed;inset:0;z-index:60;display:none;flex-direction:column;" +
      "background:rgba(15,77,58,.97);color:#fff;font-family:Poppins,system-ui,sans-serif;" +
      "overflow-y:auto;-webkit-overflow-scrolling:touch;";
    document.body.appendChild(_overlayEl);
  }

  const sections = [
    {
      icon: "🚶", title: "Walking Around",
      tips: [
        "Use the <b>joystick</b> (bottom-left) to walk around Kaduna.",
        "Tap <b>Jog</b> button to run faster (drains energy).",
        "Walk up to a building entrance (glowing pad) and press <b>E</b> (or tap the prompt) to enter.",
        "Use the <b>Map</b> button (bottom nav) to see the 3D city map. Tap any place name to see details + Enter.",
      ],
    },
    {
      icon: "📱", title: "Phone & Apps",
      tips: [
        "Tap the <b>Phone</b> button (bottom-right) to open your phone.",
        "<b>🏦 Bank</b> — check your balance, get a loan.",
        "<b>🍛 Chop</b> — buy food to restore hunger.",
        "<b>💼 Hustle</b> — take jobs to earn money.",
        "<b>🛺 Ride</b> — book a keke/bus/okada to travel anywhere.",
        "<b>🚗 Cars</b> — buy + ride vehicles.",
        "<b>🏡 Houses</b> — buy/rent/upgrade houses.",
        "<b>🎯 Missions</b> — story chapters with rewards.",
        "<b>🕵️ Spy Ops</b> — 6 spy missions with big payouts (₦500k–₦10M).",
        "<b>⚡ NEPA</b> — buy electricity units for your prepaid meter.",
        "<b>🏢 Company</b> — start a business, collect daily income.",
      ],
    },
    {
      icon: "🚗", title: "Driving Vehicles",
      tips: [
        "Open <b>🚗 Cars</b> app → tap <b>Ride</b> on any owned vehicle.",
        "<b>Joystick left/right</b> = steer the vehicle.",
        "<b>▲ ACCEL button</b> (green, bottom-right) = hold to accelerate.",
        "<b>■ BRAKE button</b> (red, left of ACCEL) = press to stop. Brake STOPS — it does NOT reverse.",
        "Tap <b>🚶 Dismount</b> in the Cars app to get out.",
        "Buy luxury cars at <b>Kaduna Motors</b> (🚗 on the map, east side).",
      ],
    },
    {
      icon: "🎲", title: "Challenge Anyone (Wager)",
      tips: [
        "Tap the <b>🎲 button</b> (bottom-right, above joystick) to open a challenge.",
        "Pick a game: Capital Dice, Tennis, Penalty Shoot-out, Sniper Duel, Bowling, or Pool.",
        "Set a stake (₦5,000 – ₦100,000). Your money goes into escrow.",
        "All online players see a toast: '[You] is challenging anyone!'",
        "First player to tap <b>Accept</b> starts the match.",
        "Winner takes 95% of the pot. Loser gets nothing.",
      ],
    },
    {
      icon: "📸", title: "Photo Mode",
      tips: [
        "Press <b>P</b> on keyboard, or tap <b>📸 Photo Mode</b> in your home.",
        "All HUD disappears. Walk + look around to frame your shot.",
        "Tap <b>📸</b> (or press P) to capture a screenshot — saved to your device.",
        "Tap <b>✕</b> (or press Esc) to exit Photo Mode.",
      ],
    },
    {
      icon: "💡", title: "Tips & Tricks",
      tips: [
        "Your character has <b>needs</b> (hunger, energy, fun, hygiene, etc.) — keep them above 20% to stay healthy.",
        "Buy <b>food</b> at Central Market to restore hunger.",
        "<b>Sleep</b> at home to restore energy.",
        "<b>Shower</b> at home to restore hygiene.",
        "Earn money by: <b>working jobs</b>, <b>doing missions</b>, <b>finding money hunt spots</b>, <b>winning challenges</b>, <b>running a company</b>.",
        "Buy a <b>house</b> to store furniture, invite friends, and flex your wealth.",
        "Walk into <b>Kaduna Arena</b> (🎮 on map) for bowling, pool, arcade games.",
      ],
    },
  ];

  let html = `
    <style>
      #howto-overlay .ht-wrap { max-width:520px;margin:0 auto;padding:20px 16px calc(40px + env(safe-area-inset-bottom)); }
      #howto-overlay .ht-close { position:sticky;top:0;display:flex;justify-content:flex-end;margin:-20px -16px 8px;padding:14px 16px 6px;background:linear-gradient(180deg,rgba(0,0,0,.25),transparent); }
      #howto-overlay .ht-close button { background:#f2b134;color:#1a1a1a;border:none;border-radius:10px;padding:8px 16px;cursor:pointer;font:700 13px Poppins,sans-serif; }
      #howto-overlay .ht-head { text-align:center;margin-bottom:20px; }
      #howto-overlay .ht-emoji { font-size:48px;margin-bottom:6px; }
      #howto-overlay .ht-title { font-size:22px;font-weight:800;color:#f2b134; }
      #howto-overlay .ht-sub { font-size:12px;color:#9ec9b0;margin-top:4px; }
      #howto-overlay .ht-section { margin-bottom:20px; }
      #howto-overlay .ht-section-title { display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;color:#4ade80;margin-bottom:8px; }
      #howto-overlay .ht-section-icon { font-size:20px; }
      #howto-overlay .ht-tip { background:rgba(255,255,255,.07);border-left:3px solid #f2b134;border-radius:8px;padding:8px 12px;font-size:12px;line-height:1.6;color:#e8f0ea;margin-bottom:6px; }
      #howto-overlay .ht-tip b { color:#f2b134; }
    </style>
    <div class="ht-wrap">
      <div class="ht-close"><button onclick="window._htClose()">✕ Got it!</button></div>
      <div class="ht-head">
        <div class="ht-emoji">🎮</div>
        <div class="ht-title">How to Play</div>
        <div class="ht-sub">Kaduna Lifestyle — Quick Guide</div>
      </div>
  `;
  for (const s of sections) {
    html += `<div class="ht-section"><div class="ht-section-title"><span class="ht-section-icon">${s.icon}</span> ${s.title}</div>`;
    for (const tip of s.tips) {
      html += `<div class="ht-tip">${tip}</div>`;
    }
    html += `</div>`;
  }
  html += `
      <div style="text-align:center;margin-top:20px;font-size:11px;color:#9ec9b0;">
        You can re-read this guide anytime: Settings → 📖 How to Play
      </div>
      <button onclick="window._htClose()" style="width:100%;margin-top:16px;padding:14px;border-radius:12px;border:none;background:linear-gradient(145deg,#f2b134,#d98e2b);color:#1a1a1a;font:700 14px Poppins,sans-serif;cursor:pointer;">✓ Got it! Let me play!</button>
    </div>
  `;
  _overlayEl.innerHTML = html;
  _overlayEl.style.display = "flex";
  window._htClose = () => {
    _overlayEl.style.display = "none";
    try { localStorage.setItem(SEEN_KEY, "1"); } catch (e) {}
  };
}
