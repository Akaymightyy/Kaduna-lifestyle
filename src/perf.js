// src/perf.js — tiny optional speed meter. Off by default. Turn on with  ?perf=1  in the address
// (or type  localStorage.setItem("kaduna-perf","1")  once). Shows FPS, draw calls, triangles,
// quality and pixel ratio so a slow phone can be diagnosed from a screenshot.
let _el = null, _on = false, _frames = 0, _acc = 0, _t0 = 0, _jsMs = 0, _renderMs = 0, _worst = 0, _last = 0, _fpsEl = null;
try { _on = /[?&]perf=1/.test(location.search) || localStorage.getItem("kaduna-perf") === "1"; } catch (e) {}

export function perfFrameStart() { if (!_on) return; _t0 = performance.now(); }
export function perfBeforeRender() { if (!_on) return; _last = performance.now(); _jsMs += _last - _t0; }
export function perfAfterRender(renderer, quality) {
  if (!_on) return;
  const now = performance.now();
  _renderMs += now - _last;
  _frames++; _acc += now;
  const dt = now - (perfAfterRender._prev || now); perfAfterRender._prev = now;
  if (dt > _worst) _worst = dt;
  if (!perfAfterRender._start) perfAfterRender._start = now;
  if (now - perfAfterRender._start < 1000) return;
  const secs = (now - perfAfterRender._start) / 1000;
  if (!_el) {
    _el = document.createElement("div");
    _el.style.cssText = "position:fixed;left:6px;bottom:96px;z-index:99999;background:rgba(0,0,0,.72);color:#9f9;font:11px/1.35 monospace;padding:5px 7px;border-radius:6px;pointer-events:none;white-space:pre";
    document.body.appendChild(_el);
  }
  const i = renderer.info;
  const fps = _frames / secs;
  // TODO #4 (Oct 24): tiny top-right numeric FPS readout — the owner asked for
  // one number he can see at a glance on the ?perf=1 overlay.
  if (!_fpsEl) {
    _fpsEl = document.createElement("div");
    _fpsEl.style.cssText = "position:fixed;right:8px;top:calc(8px + env(safe-area-inset-top));z-index:99999;background:rgba(0,0,0,.6);color:#4ade80;font:bold 22px/1 monospace;padding:6px 10px;border-radius:8px;pointer-events:none";
    document.body.appendChild(_fpsEl);
  }
  _fpsEl.textContent = Math.round(fps) + " FPS";
  _fpsEl.style.color = fps >= 25 ? "#4ade80" : fps >= 15 ? "#f2b134" : "#fb7185";
  _el.textContent =
    "FPS " + fps.toFixed(0) + "  worst " + _worst.toFixed(0) + "ms\n" +
    "JS " + (_jsMs / _frames).toFixed(1) + "ms  render " + (_renderMs / _frames).toFixed(1) + "ms\n" +
    "calls " + i.render.calls + "  tris " + (i.render.triangles / 1000).toFixed(0) + "k\n" +
    "geo " + i.memory.geometries + "  tex " + i.memory.textures + "  prog " + (i.programs ? i.programs.length : 0) + "\n" +
    "quality " + quality + "  pr " + renderer.getPixelRatio().toFixed(2);
  _frames = 0; _jsMs = 0; _renderMs = 0; _worst = 0; perfAfterRender._start = now;
}
