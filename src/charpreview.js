// src/charpreview.js — a small turntable of YOUR real character, shown inside the phone apps
// (Wardrobe, Boutique, My Outfits). One shared WebGL canvas that is moved into whichever app is open.
import * as THREE from "three";
import { createCharacter, recolorCharacter, loadCharacterBase } from "./characters.js";

let _r = null, _scene = null, _cam = null, _ch = null, _gender = null, _raf = 0, _slot = null, _building = 0;
let _spin = 0, _drag = null, _last = 0, _pendingLook = null;

function _init() {
  if (_r) return;
  _r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  _r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  _r.outputColorSpace = THREE.SRGBColorSpace;
  _scene = new THREE.Scene();
  _scene.add(new THREE.HemisphereLight(0xffffff, 0x556070, 1.5));
  const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(2, 4, 4); _scene.add(d);
  const rim = new THREE.DirectionalLight(0x9fc2ff, 0.9); rim.position.set(-3, 2, -3); _scene.add(rim);
  _cam = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  _cam.position.set(0, 1.0, 4.3); _cam.lookAt(0, 0.9, 0);
  const el = _r.domElement; el.style.cssText = "width:100%;height:100%;display:block;touch-action:none;cursor:grab;";
  el.addEventListener("pointerdown", (e) => { _drag = e.clientX; el.setPointerCapture?.(e.pointerId); });
  el.addEventListener("pointermove", (e) => { if (_drag == null) return; _spin += (e.clientX - _drag) * 0.012; _drag = e.clientX; });
  const up = () => { _drag = null; };
  el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
}

async function _build(look) {
  const token = ++_building;
  const g = look.gender === "female" ? "female" : "male";
  let ch;
  try { await loadCharacterBase(THREE.DefaultLoadingManager, g); ch = await createCharacter({ seed: 1, height: 1.8, look }); } catch (e) { console.warn("preview build failed", e); return; }
  if (token !== _building) return;                       // a newer request replaced this one
  if (_ch) { _scene.remove(_ch.group); _ch.group.traverse((o) => { if (o.isMesh && o.userData._own) o.geometry.dispose(); }); }
  _ch = ch; _gender = g; _scene.add(ch.group);
  if (_pendingLook) { const p = _pendingLook; _pendingLook = null; setPreviewLook(p); }
}

function _loop(now) {
  if (!_slot || !_slot.isConnected || !_r.domElement.isConnected) { _raf = 0; return; }
  _raf = requestAnimationFrame(_loop);
  const dt = Math.min(0.05, (now - (_last || now)) / 1000); _last = now;
  const w = _slot.clientWidth, h = _slot.clientHeight;
  if (w && h && (_r.domElement.width !== Math.round(w * _r.getPixelRatio()) || _r.domElement.height !== Math.round(h * _r.getPixelRatio()))) {
    _r.setSize(w, h, false); _cam.aspect = w / h; _cam.updateProjectionMatrix();
  }
  if (_ch) {
    if (_drag == null) _spin += dt * 0.7;
    _ch.group.rotation.y = _spin;
    try { _ch.animate(dt, 0); } catch (e) {}
  }
  _r.render(_scene, _cam);
}

/** Put the preview canvas into `slot` (a div with a fixed height) and show `look`. */
export function mountPreview(slot, look) {
  if (!slot) return;
  _init();
  _slot = slot; slot.appendChild(_r.domElement);
  setPreviewLook(look);
  if (!_raf) { _last = 0; _raf = requestAnimationFrame(_loop); }
}

/** Show a different look (a boutique item being tried, the other gender...). Does not touch the real player. */
export function setPreviewLook(look) {
  if (!look) return;
  _init();
  const g = look.gender === "female" ? "female" : "male";
  if (!_ch || _gender !== g) { _pendingLook = null; if (_ch && _gender !== g) _pendingLook = null; _build(look); return; }
  recolorCharacter(_ch, { ...look, worn: { ...(look.worn || {}) } });
}
