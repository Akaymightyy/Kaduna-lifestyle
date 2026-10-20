// src/dealership_ui.js — Kaduna Motors catalogue UI overlay
//
// Shows when the player taps a car on the showroom floor (or via the
// "View Catalog" button on the salesman). Full-screen overlay with:
//   - Car name + type + emoji
//   - Specs (engine, seats, top speed, range)
//   - Buy price (big) + optional lease price (smaller)
//   - Description
//   - Buy / Test Drive / Close buttons
//
// Kaduna-styled: green/gold/cream palette, Pidgin-flavoured button labels.
// Self-contained — no edits to existing files. Exports openDealershipUI(car)
// and closeDealershipUI(). The showroom place module calls these.

import { buyVehicle, spawnRideVehicle, despawnRideVehicle, isRiding } from "./vehicles.js";

let _overlayEl = null;
let _currentCar = null;
let _ctx = null;
let _testDriveTimer = null;

export function initDealershipUI(ctx) {
  _ctx = ctx;
  if (_overlayEl) return;
  _overlayEl = document.createElement("div");
  _overlayEl.id = "dealership-overlay";
  _overlayEl.style.cssText =
    "position:fixed;inset:0;z-index:45;display:none;flex-direction:column;" +
    "background:rgba(15,77,58,.97);color:#fff;font-family:Poppins,system-ui,sans-serif;" +
    "overflow-y:auto;-webkit-overflow-scrolling:touch;";
  document.body.appendChild(_overlayEl);
}

export function openDealershipUI(car) {
  if (!_overlayEl) initDealershipUI(_ctx);
  if (!car) return;
  _currentCar = car;
  const priceStr = "₦" + car.price.toLocaleString();
  const leaseStr = car.lease ? "₦" + car.lease.toLocaleString() + "/mo" : null;
  const spec = car.specs || {};
  const specsHtml = [
    spec.engine ? `<div class="ds-spec"><span>Engine</span><b>${spec.engine}</b></div>` : "",
    spec.seats ? `<div class="ds-spec"><span>Seats</span><b>${spec.seats}</b></div>` : "",
    spec.topSpeed ? `<div class="ds-spec"><span>Top Speed</span><b>${spec.topSpeed}</b></div>` : "",
    spec.range ? `<div class="ds-spec"><span>Range</span><b>${spec.range}</b></div>` : "",
  ].filter(Boolean).join("");

  _overlayEl.innerHTML = `
    <style>
      #dealership-overlay .ds-wrap { max-width:520px;margin:0 auto;padding:18px 16px calc(20px + env(safe-area-inset-bottom)); }
      #dealership-overlay .ds-close { position:sticky;top:0;display:flex;justify-content:flex-end;margin:-18px -16px 8px;padding:14px 16px 6px;background:linear-gradient(180deg,rgba(0,0,0,.25),transparent); }
      #dealership-overlay .ds-close button { background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:8px;padding:7px 12px;cursor:pointer;font:600 12px Poppins,sans-serif; }
      #dealership-overlay .ds-head { text-align:center;margin-bottom:14px; }
      #dealership-overlay .ds-emoji { font-size:54px;line-height:1;margin-bottom:6px; }
      #dealership-overlay .ds-name { font-size:22px;font-weight:800;color:#fff;letter-spacing:.2px; }
      #dealership-overlay .ds-type { font-size:12px;color:#f2b134;margin-top:4px;font-weight:600;letter-spacing:.4px;text-transform:uppercase; }
      #dealership-overlay .ds-img { height:130px;border-radius:14px;background:linear-gradient(145deg,#1a3b2a,#0f4d3a);display:flex;align-items:center;justify-content:center;font-size:60px;margin:14px 0 18px;border:2px solid #f2b134;box-shadow:0 6px 18px rgba(0,0,0,.3); }
      #dealership-overlay .ds-specs { display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px; }
      #dealership-overlay .ds-spec { background:rgba(255,255,255,.07);border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:2px; }
      #dealership-overlay .ds-spec span { font-size:10px;color:#9ec9b0;text-transform:uppercase;letter-spacing:.5px; }
      #dealership-overlay .ds-spec b { font-size:13px;color:#fff;font-weight:600; }
      #dealership-overlay .ds-desc { background:rgba(0,0,0,.25);border-left:3px solid #f2b134;border-radius:8px;padding:10px 12px;font-size:13px;line-height:1.5;color:#e8f0ea;margin-bottom:18px; }
      #dealership-overlay .ds-price { text-align:center;margin:8px 0 18px; }
      #dealership-overlay .ds-price .ds-buy { font-size:30px;font-weight:800;color:#f2b134;letter-spacing:.3px; }
      #dealership-overlay .ds-price .ds-lease { font-size:11px;color:#9ec9b0;margin-top:4px;font-weight:500; }
      #dealership-overlay .ds-actions { display:flex;flex-direction:column;gap:10px; }
      #dealership-overlay .ds-btn { width:100%;border:none;border-radius:12px;padding:14px 18px;font:700 14px Poppins,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:transform .12s,filter .12s; }
      #dealership-overlay .ds-btn:active { transform:scale(.97); }
      #dealership-overlay .ds-btn-buy { background:linear-gradient(145deg,#f2b134,#d98e2b);color:#1a1a1a; }
      #dealership-overlay .ds-btn-test { background:rgba(255,255,255,.15);color:#fff;border:1.5px solid #f2b134; }
      #dealership-overlay .ds-btn-close { background:rgba(0,0,0,.25);color:#9ec9b0; }
      #dealership-overlay .ds-toast { position:sticky;bottom:0;margin:-20px -16px 0;padding:14px 16px;background:rgba(15,77,58,.97);color:#f2b134;font:700 13px Poppins,sans-serif;text-align:center;border-top:1px solid #f2b134;display:none; }
      #dealership-overlay .ds-toast.show { display:block; }
    </style>
    <div class="ds-wrap">
      <div class="ds-close"><button onclick="window._dealershipClose()">✕ Close</button></div>
      <div class="ds-head">
        <div class="ds-emoji">${car.emoji || "🚗"}</div>
        <div class="ds-name">${car.name}</div>
        <div class="ds-type">${car.type || "Premium Car"}</div>
      </div>
      <div class="ds-img">${car.emoji || "🚗"}</div>
      <div class="ds-specs">${specsHtml}</div>
      <div class="ds-desc">${car.desc || "Premium ride."}</div>
      <div class="ds-price">
        <div class="ds-buy">${priceStr}</div>
        ${leaseStr ? `<div class="ds-lease">or lease from ${leaseStr}</div>` : ""}
      </div>
      <div class="ds-actions">
        <button class="ds-btn ds-btn-buy" onclick="window._dealershipBuy()">💰 Buy Now — Pay ${priceStr}</button>
        <button class="ds-btn ds-btn-test" onclick="window._dealershipTestDrive()">🛣️ Test Drive (Free, 60s)</button>
        <button class="ds-btn ds-btn-close" onclick="window._dealershipClose()">Maybe later</button>
      </div>
      <div id="ds-toast" class="ds-toast"></div>
    </div>
  `;
  _overlayEl.style.display = "flex";
  // wire buttons
  window._dealershipBuy = _handleBuy;
  window._dealershipTestDrive = _handleTestDrive;
  window._dealershipClose = closeDealershipUI;
}

export function closeDealershipUI() {
  if (!_overlayEl) return;
  _overlayEl.style.display = "none";
  _overlayEl.innerHTML = "";
  _currentCar = null;
}

function _showToast(msg) {
  const t = document.getElementById("ds-toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

async function _handleBuy() {
  if (!_currentCar || !_ctx?.game) return;
  const car = _currentCar;
  const g = _ctx.game;
  if (g.state.money < car.price) {
    _showToast("Not enough money — need " + car.price.toLocaleString());
    return;
  }
  // Use the existing buyVehicle flow — it deducts money, writes to Firebase,
  // and updates the player's owned vehicles map. Pass the catalog id.
  const ok = await buyVehicle(car.id, g.state, _ctx.toast);
  if (ok) {
    _ctx.toast("🎉 Paid ₦" + car.price.toLocaleString() + " — " + car.name + "!");
    _ctx.updateHUD?.();
    _showToast("🎉 Bought! Open Cars app to ride it.");
    // Auto-close after a short beat so the player sees the toast
    setTimeout(() => closeDealershipUI(), 1200);
  } else {
    _showToast("Buy failed — try again");
  }
}

async function _handleTestDrive() {
  if (!_currentCar || !_ctx?.game) return;
  const car = _currentCar;
  if (isRiding()) {
    _showToast("Already riding — dismount first");
    return;
  }
  // Get the player position from the camera (we don't have direct access to
  // player.pos here — pass via ctx when initDealershipUI is called)
  const pos = _ctx.playerPos ? _ctx.playerPos() : { x: 0, z: 0 };
  const heading = _ctx.playerHeading ? _ctx.playerHeading() : 0;
  const ok = await spawnRideVehicle(car.id, pos, heading, _ctx.toast);
  if (ok) {
    _showToast("🚗 60s test drive — drive around!");
    closeDealershipUI();
    // Auto-dismount after 60s
    if (_testDriveTimer) clearTimeout(_testDriveTimer);
    _testDriveTimer = setTimeout(() => {
      if (isRiding()) {
        despawnRideVehicle();
        _ctx?.toast("🚶 Test drive over — back to walking");
      }
    }, 60000);
  } else {
    _showToast("Couldn't spawn — try again");
  }
}
