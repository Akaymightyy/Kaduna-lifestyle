// src/vehicle_controls.js — KSR-style vehicle buttons (copied from Kay Super Racing's
// src/touch.js pointer-capture pattern, adapted to Kaduna Lifestyle).
//
// THE KSR WAY (why the old buttons broke):
//   * The analog stick STEERS ONLY. Pushing it forward must NOT drive the car.
//   * DRIVE (gas) and BRAKE are hold-to-press buttons. Every pointer is tracked by
//     pointerId in a Map, the button captures its pointer, and the pressed state is
//     recomputed absolutely from who is still holding it — so a button can never get
//     stuck "on" (the old code used +1/-1 counters that drifted when a pointerup was
//     missed, which is why ACCEL stayed on and even BRAKE could not cancel it).
//   * Everything releases on window blur / tab hide (KSR's reset()).
//
// Exports:
//   vehInput             — { steer, gas, brake } read every frame while riding
//   ensureVehicleControls() — builds the button overlay once, returns the container
//   resetVehInput()      — force-release everything (call on dismount)
//   setVehicleControlsVisible(v) — show/hide the overlay

export const vehInput = { steer: 0, gas: 0, brake: 0 };

let _root = null;
const held = new Map(); // pointerId -> "gas" | "brake"

function recompute(action) {
  let on = 0;
  for (const a of held.values()) if (a === action) on++;
  vehInput[action] = on > 0 ? 1 : 0;
}

function makeBtn(label, sub, action, css) {
  const b = document.createElement("button");
  b.innerHTML =
    '<div style="line-height:1;font-size:' + (sub ? "28" : "24") + 'px;">' + label + "</div>" +
    (sub ? '<div style="font:800 8px Poppins,sans-serif;margin-top:2px">' + sub + "</div>" : "");
  b.style.cssText = css +
    "display:flex;flex-direction:column;align-items:center;justify-content:center;" +
    "font-size:24px;font-weight:700;cursor:pointer;pointer-events:auto;touch-action:none;" +
    "border-radius:50%;border:3px solid #fff;" +
    "box-shadow:0 4px 12px rgba(0,0,0,.4);user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;color:#fff;";
  // KSR pointer-capture wiring: the button owns its finger until release.
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    held.set(e.pointerId, action);
    recompute(action);
    try { b.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    b.classList.add("on");
    b.style.transform = "scale(0.92)";
  });
  const up = (e) => {
    if (held.get(e.pointerId) !== action) return;
    held.delete(e.pointerId);
    recompute(action);
    b.classList.remove("on");
    b.style.transform = "scale(1)";
  };
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((t) => b.addEventListener(t, up));
  return b;
}

export function ensureVehicleControls() {
  if (_root) return _root;
  _root = document.createElement("div");
  _root.id = "vehicle-controls";
  _root.style.cssText = "position:fixed;inset:0;z-index:28;pointer-events:none;display:none;";

  // GAS (big green button, bottom-right) — HOLD to drive. Release to coast.
  const gasBtn = makeBtn("▲", "GAS", "gas",
    "position:absolute;right:20px;bottom:calc(130px + env(safe-area-inset-bottom));" +
    "width:80px;height:80px;background:#4ade80;color:#000;");
  // BRAKE (red button, left of gas) — hold to stop; steering while braking at speed = drift (KSR).
  const brakeBtn = makeBtn("■", "BRAKE", "brake",
    "position:absolute;right:110px;bottom:calc(130px + env(safe-area-inset-bottom));" +
    "width:64px;height:64px;background:#e11d48;");

  _root.appendChild(gasBtn);
  _root.appendChild(brakeBtn);
  document.body.appendChild(_root);

  // KSR reset: if the tab loses focus or is hidden mid-press, release everything
  // (a finger held across a background/foreground must not stay "on").
  const reset = () => {
    held.clear();
    vehInput.gas = 0; vehInput.brake = 0;
    _root.querySelectorAll(".on").forEach((n) => { n.classList.remove("on"); n.style.transform = "scale(1)"; });
  };
  addEventListener("blur", reset);
  document.addEventListener("visibilitychange", () => { if (document.hidden) reset(); });
  return _root;
}

export function setVehicleControlsVisible(v) {
  if (_root) _root.style.display = v ? "block" : "none";
}

export function resetVehInput() {
  held.clear();
  vehInput.gas = 0; vehInput.brake = 0; vehInput.steer = 0;
  if (_root) _root.querySelectorAll(".on").forEach((n) => { n.classList.remove("on"); n.style.transform = "scale(1)"; });
}
