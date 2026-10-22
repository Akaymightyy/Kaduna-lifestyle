// src/contextmenu.js — ONE small, see-through action chip used everywhere in the game.
// It floats just above the thing you are near / tapped (projected from the 3D position), is tiny so it never
// covers the scene, fades away by itself, and closes when you tap elsewhere or walk away.
//
//   showContext({ key, at: THREE.Vector3, title, actions:[{ icon, label, run, danger }], radius, getPlayer, ttl })
//   hideContext(key?)      isContextShown(key?)      tickContext(camera)  <- call once per frame
import * as THREE from "three";

let _el = null, _cur = null, _hideT = 0;
const _v = new THREE.Vector3();

function _mk() {
  if (_el) return _el;
  _el = document.createElement("div");
  _el.id = "ctx-chip";
  _el.style.cssText = "position:fixed;left:0;top:0;z-index:34;display:none;pointer-events:none;transform:translate(-50%,-100%);" +
    "transition:opacity .18s ease;opacity:0;font:600 10px Poppins,system-ui,sans-serif;color:#fff;text-align:center;";
  document.body.appendChild(_el);
  // tapping anywhere that is not the chip closes it (canvas taps still reach the game)
  document.addEventListener("pointerdown", (e) => { if (_cur && !_el.contains(e.target)) hideContext(); }, true);
  return _el;
}

export function isContextShown(key) { return !!_cur && (key == null || _cur.key === key); }
export function currentContextKey() { return _cur ? _cur.key : null; }

export function hideContext(key) {
  if (!_cur || (key != null && _cur.key !== key)) return;
  const dismissed = _cur; _cur = null; try { dismissed.onHide && dismissed.onHide(); } catch (e) {}
  if (_el) { _el.style.opacity = "0"; clearTimeout(_hideT); _hideT = setTimeout(() => { if (!_cur && _el) _el.style.display = "none"; }, 200); }
  return dismissed;
}

export function showContext(opts) {
  const el = _mk();
  _cur = { key: opts.key, at: opts.at.clone ? opts.at.clone() : new THREE.Vector3(opts.at.x, opts.at.y, opts.at.z), radius: opts.radius || 0, getPlayer: opts.getPlayer, born: performance.now(), ttl: opts.ttl || 0, onHide: opts.onHide };
  const btn = (a, i) => '<button data-i="' + i + '" style="pointer-events:auto;width:40px;height:40px;border-radius:50%;border:1.5px solid ' + (a.danger ? "#fb7185" : "rgba(255,255,255,.55)") + ';background:' + (a.danger ? "rgba(159,18,57,.78)" : "rgba(15,40,30,.72)") + ';color:#fff;font-size:17px;line-height:1;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);">' + a.icon + '<span style="font:600 8px Poppins,system-ui,sans-serif;margin-top:1px;">' + a.label + '</span></button>';
  el.innerHTML = (opts.title ? '<div style="display:inline-block;margin-bottom:4px;padding:2px 8px;border-radius:9px;background:rgba(15,40,30,.7);font-size:10px;">' + opts.title + '</div>' : '') +
    '<div style="display:flex;gap:6px;justify-content:center;">' + opts.actions.map(btn).join("") + '</div>';
  el.querySelectorAll("button").forEach((b) => {
    b.onclick = (e) => { e.stopPropagation(); const a = opts.actions[+b.dataset.i]; if (!a) return; if (a.keepOpen !== true) hideContext(opts.key); try { a.run(); } catch (err) { console.warn(err); } };
  });
  el.style.display = "block"; requestAnimationFrame(() => { if (_cur) el.style.opacity = "1"; });
}

/** every frame: keep the chip glued above its object, hide if you walk away / it times out / it goes off-screen */
export function tickContext(camera) {
  if (!_cur || !_el) return;
  const c = _cur;
  if (c.ttl && performance.now() - c.born > c.ttl) { hideContext(); return; }
  if (c.radius && c.getPlayer) {
    const p = c.getPlayer(); if (p) { const dx = p.x - c.at.x, dz = p.z - c.at.z; if (dx * dx + dz * dz > c.radius * c.radius) { hideContext(); return; } }
  }
  _v.copy(c.at).project(camera);
  if (_v.z > 1) { _el.style.opacity = "0"; return; }
  let x = (_v.x * 0.5 + 0.5) * innerWidth, y = (-_v.y * 0.5 + 0.5) * innerHeight;
  // keep clear of the top HUD, right-hand buttons and the bottom bar
  const hw = (_el.offsetWidth || 220) / 2 + 8; x = Math.max(hw, Math.min(innerWidth - hw, x)); y = Math.max(190, Math.min(innerHeight - 190, y));
  _el.style.left = x + "px"; _el.style.top = y + "px"; _el.style.opacity = "1";
}
