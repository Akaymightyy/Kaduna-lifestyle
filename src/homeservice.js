// src/homeservice.js — HOME GARAGE SERVICE (Nov 4, Claude fix-list #3:
// "let you repaint or fix a car at home. This links the garage and the mechanic.")
//
// Stand near ANY house you own and a floating chip appears: "🏠 Home service 🔧".
// It opens a mechanic-style overlay listing every vehicle you own with:
//   • its condition bar (same labels as Sani's workshop)
//   • FIX — the same repairVehicle pipeline (price scales with the damage)
//   • PAINT — 14 swatches, ₦25,000 full respray, saved to
//     players/{uid}/vehicleColors/{vid} and applied live (your ride recolors
//     on the spot; driveway + garage displays rebuild via the kl_vehcolor event)
//
// Money note: repaint charges through game.state (the money guard queues the
// delta to /api/money like every other spend). Repairs keep the mechanic's
// server-transaction pipeline.

import { getVehicle, getOwned, ownsVehicle, vehHealth, repairCost, repairVehicle, getVehColor, setVehColor, isRiding, getRideId, spawnRideVehicle, despawnRideVehicle } from "./vehicles.js";

const PAINT_FEE = 25_000;
const CHIP_DIST = 5.5;            // metres from home entrance to show the chip
const PAINTS = ["#f2f2ee", "#c0392b", "#1d5fa8", "#1f7a5a", "#e8c547", "#d98e2b", "#6b4a8a", "#2e2e2e", "#e11d48", "#3c8dbc", "#0f4c3a", "#8a9bb5", "#15171a", "#f4efe4"];

let _game = null, _gameFn = null, _toast = null, _updateHUD = null, _getHomes = null, _playerPos = null;
function _G() { if (!_game) _game = _gameFn ? _gameFn() : null; return _game; }
let _chip = null, _overlay = null, _paintVid = null;
let _tickT = 0, _near = null;

export function initHomeService({ getGame, game, toast, updateHUD, getHomes, playerPos }) {
  // getGame is a lazy getter — game is created later in main.js (TDZ-safe)
  _gameFn = getGame || (() => game);
  _toast = toast || (() => {}); _updateHUD = updateHUD || (() => {});
  _getHomes = getHomes; _playerPos = playerPos;
  if (!_chip) {
    _chip = document.createElement("div");
    _chip.style.cssText = "position:fixed;left:50%;bottom:27%;transform:translateX(-50%);background:rgba(15,77,58,.95);color:#fff;padding:10px 18px;border-radius:12px;font:600 13px Poppins,sans-serif;display:none;z-index:30;cursor:pointer;pointer-events:auto;box-shadow:0 4px 14px rgba(0,0,0,.4);";
    _chip.textContent = "🏠 Home service 🔧🎨";
    _chip.addEventListener("click", () => { if (_near) openHomeService(); });
    document.body.appendChild(_chip);
  }
}

// per-frame proximity check (cheap: homes list is tiny)
export function tickHomeService(px, pz, dt) {
  if (!_chip || !_getHomes) return;
  _tickT -= dt;
  if (_tickT > 0) return;
  _tickT = 0.35;
  let near = null, best = CHIP_DIST * CHIP_DIST;
  for (const h of _getHomes() || []) {
    const d2 = (h.x - px) * (h.x - px) + (h.z - pz) * (h.z - pz);
    if (d2 < best) { best = d2; near = h; }
  }
  _near = near;
  _chip.style.display = near ? "block" : "none";
}

export function closeHomeService() {
  if (_overlay) _overlay.style.display = "none";
  _paintVid = null;
}

export function openHomeService() {
  _ensureOverlay();
  _paintVid = null;
  _render();
  _overlay.style.display = "flex";
}

function _ensureOverlay() {
  if (_overlay) return;
  _overlay = document.createElement("div");
  _overlay.id = "homeservice-overlay";
  _overlay.style.cssText =
    "position:fixed;inset:0;z-index:46;display:none;flex-direction:column;" +
    "background:rgba(20,24,28,.97);color:#fff;font-family:Poppins,system-ui,sans-serif;" +
    "overflow-y:auto;-webkit-overflow-scrolling:touch;";
  document.body.appendChild(_overlay);
}

function _healthColor(label) {
  if (label === "Perfect") return "#4ade80";
  if (label === "Scratched") return "#a3e635";
  if (label === "Dented") return "#f2b134";
  if (label === "Smoking") return "#fb923c";
  return "#e11d48";
}

function _render() {
  if (!_overlay) return;
  const owned = Object.keys(getOwned() || {}).filter((id) => ownsVehicle(id));
  let rows = "";
  if (!owned.length) {
    rows = '<div style="text-align:center;padding:30px 10px;color:#9ca3af;font-size:13px;">You no get any car yet.<br>Buy one first, then come do am for house 😄</div>';
  } else {
    rows = owned.map((id) => {
      const v = getVehicle(id) || {};
      const { hp, label } = vehHealth(id);
      const cost = repairCost(id);
      const col = getVehColor(id);
      const paintRow = _paintVid === id
        ? '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;">' +
          PAINTS.map((c) => '<div onclick="window._hsPaint(\'' + id + '\',\'' + c + '\')" style="width:26px;height:26px;border-radius:50%;background:' + c + ';cursor:pointer;border:' + (col === c ? '3px solid #fff' : '2px solid #555') + ';"></div>').join("") +
          '<div style="font-size:10px;color:#9ca3af;margin-left:4px;">₦' + PAINT_FEE.toLocaleString() + ' respray</div></div>'
        : "";
      return (
        '<div style="background:#1a1f24;border-radius:12px;padding:12px;margin-bottom:8px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<div style="font-weight:700;font-size:14px;">' + (v.emoji || "🚗") + " " + (v.name || id) + '</div>' +
            '<div style="font-size:11px;color:' + _healthColor(label) + ';font-weight:600;">' + label + " · " + hp + '%</div>' +
          '</div>' +
          '<div style="height:6px;background:#2a2f35;border-radius:3px;margin:8px 0;overflow:hidden;"><div style="height:100%;width:' + hp + '%;background:' + _healthColor(label) + ';"></div></div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
            (cost > 0
              ? '<button onclick="window._hsFix(\'' + id + '\')" style="flex:1;background:#0f4c3a;color:#fff;border:none;border-radius:8px;padding:10px;font:600 12px Poppins;cursor:pointer;">🔧 Fix — ₦' + cost.toLocaleString() + '</button>'
              : '<div style="flex:1;text-align:center;background:#14251f;color:#4ade80;border-radius:8px;padding:10px;font:600 12px Poppins;">👌 Engine dey perfect</div>') +
            '<button onclick="window._hsPaintOpen(\'' + id + '\')" style="flex:1;background:#1d3a5f;color:#fff;border:none;border-radius:8px;padding:10px;font:600 12px Poppins;cursor:pointer;">🎨 Paint' + (col ? ' <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + col + ';vertical-align:middle;"></span>' : '') + '</button>' +
          '</div>' + paintRow +
        '</div>');
    }).join("");
  }
  _overlay.innerHTML =
    '<div style="padding:14px 14px 8px;display:flex;justify-content:space-between;align-items:center;">' +
      '<div style="font-weight:800;font-size:16px;">🏠 Home service — Sani mobile workshop</div>' +
      '<button onclick="window._hsClose()" style="background:#2a2f35;color:#fff;border:none;border-radius:8px;padding:8px 12px;cursor:pointer;font:600 12px Poppins;">✕</button>' +
    '</div>' +
    '<div style="padding:0 14px 20px;">' + rows +
      '<div style="font-size:10px;color:#6b7280;text-align:center;margin-top:8px;">Repairs use the same price as Sani Motors. Respray na ₦' + PAINT_FEE.toLocaleString() + ' — colour go show everywhere (street, garage, ride).</div>' +
    '</div>';
}

// ---- actions (exposed for the inline onclick handlers) ----
window._hsClose = () => closeHomeService();
window._hsPaintOpen = (id) => { _paintVid = _paintVid === id ? null : id; _render(); };
window._hsFix = async (id) => {
  const ok = await repairVehicle(id, _game.state, _toast);
  if (ok) { _updateHUD?.(); _render(); }
};
window._hsPaint = (id, hex) => {
  if (!_game || !ownsVehicle(id)) return;
  if ((_game.state.money || 0) < PAINT_FEE) { _toast?.("Need ₦" + PAINT_FEE.toLocaleString() + " for respray"); return; }
  _game.state.money -= PAINT_FEE;              // money guard queues the spend
  setVehColor(id, hex);
  _toast?.("🎨 Respray done! ₦" + PAINT_FEE.toLocaleString() + " — e go shine everywhere.");
  _updateHUD?.();
  _paintVid = null;
  _render();
};

export function homeServiceDbg() {
  return { near: !!_near, open: !!(_overlay && _overlay.style.display !== "none"), paintVid: _paintVid };
}
