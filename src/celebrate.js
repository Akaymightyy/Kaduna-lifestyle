// src/celebrate.js — pure-CSS confetti celebration overlay for big reward moments.
// No libraries, no canvas, no images — just a few <div> particles that fall.
// Mobile-safe: capped at 40 particles, removed after 3.5s, pointer-events:none.

let _overlay = null;
let _timer = null;

export function celebrate(title, subtitle) {
  // One-shot per call. If a celebration is already running, restart it.
  if (_overlay) { _overlay.remove(); clearTimeout(_timer); _overlay = null; }

  _overlay = document.createElement("div");
  _overlay.id = "celebrate-overlay";
  _overlay.style.cssText = "position:fixed;inset:0;z-index:200;pointer-events:none;display:flex;align-items:center;justify-content:center;";

  // Confetti particles — 36 of them, each with a random colour / horizontal
  // offset / fall delay so they look organic.
  const colours = ["#f2b134", "#0f4d3a", "#e11d48", "#1d5fa8", "#4ade80", "#a23b72", "#f6f1e7"];
  const particles = [];
  for (let i = 0; i < 36; i++) {
    const c = colours[i % colours.length];
    const left = Math.random() * 100;
    const delay = (Math.random() * 0.6).toFixed(2);
    const dur = (1.6 + Math.random() * 1.4).toFixed(2);
    const rot = (Math.random() * 720 - 360).toFixed(0);
    const w = 6 + Math.floor(Math.random() * 6);
    const h = 8 + Math.floor(Math.random() * 8);
    particles.push(
      `<div style="position:absolute;left:${left}%;top:-20px;width:${w}px;height:${h}px;background:${c};border-radius:2px;opacity:0.95;transform:rotate(${rot}deg);animation:_confettiFall ${dur}s linear ${delay}s forwards;"></div>`
    );
  }

  _overlay.innerHTML = `
    <style>
      @keyframes _confettiFall {
        0%   { transform: translateY(-30px) rotate(0deg);     opacity: 1; }
        100% { transform: translateY(105vh) rotate(720deg);   opacity: 0.2; }
      }
      @keyframes _celebratePop {
        0%   { transform: scale(0.6); opacity: 0; }
        35%  { transform: scale(1.08); opacity: 1; }
        60%  { transform: scale(0.96); }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes _celebrateOut {
        0%   { opacity: 1; }
        100% { opacity: 0; }
      }
    </style>
    ${particles.join("")}
    <div style="position:relative;background:rgba(11,11,12,0.92);border:3px solid #f2b134;border-radius:18px;padding:24px 28px;text-align:center;max-width:88vw;box-shadow:0 10px 40px rgba(0,0,0,0.6);animation:_celebratePop 0.45s cubic-bezier(.18,.89,.32,1.28) forwards,_celebrateOut 0.5s ease 3s forwards;">
      <div style="font-size:34px;font-weight:800;color:#f2b134;font-family:Poppins,sans-serif;line-height:1.1;">${title || "🎉"}</div>
      ${subtitle ? `<div style="font-size:15px;color:#f2f2f4;margin-top:8px;font-weight:600;">${subtitle}</div>` : ""}
    </div>
  `;

  document.body.appendChild(_overlay);
  _timer = setTimeout(() => {
    if (_overlay) { _overlay.remove(); _overlay = null; }
  }, 3800);
}
