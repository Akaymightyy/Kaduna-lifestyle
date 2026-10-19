// src/weatherfx.js — rain mood: sky and fog go grey, sun dims, roads turn dark and wet, now and then lightning flashes.
// Rain drops themselves come from particles.js (startRain); this only changes the look while isRaining().
// Safe with any sky code: each frame we remember what WE wrote; if the value is still ours we restore the original first.
import * as THREE from "three";
import { isRaining } from "./particles.js";

let _w = 0, _flash = 0, _nextFlash = 10;
const _grey = new THREE.Color(0x7d858c), _wet = new THREE.Color(0x202328), _dry = new THREE.Color(0x3a3d43), _fl = new THREE.Color(0xe8eefc);
const _s = { sun: null, hemi: null, fog: null, bg: null };         // { base, mine }

function num(slot, obj, key, k, add = 0) {
  const st = _s[slot] || (_s[slot] = { base: 0, mine: NaN });
  if (obj[key] !== st.mine) st.base = obj[key];                      // someone else changed it -> new base
  st.mine = obj[key] = st.base * k + add;
}
function col(slot, c, target, a) {
  if (!c) return;
  const st = _s[slot] || (_s[slot] = { base: new THREE.Color(), mine: new THREE.Color(-1, -1, -1) });
  if (!st.base.isColor) { st.base = new THREE.Color(); st.mine = new THREE.Color(-1, -1, -1); }
  if (!c.equals(st.mine)) st.base.copy(c);
  c.copy(st.base).lerp(target, a); st.mine.copy(c);
}

export function tickWeatherFx(dt, { scene, sun, hemi, asphalt }) {
  const target = isRaining() ? 1 : 0;
  _w += (target - _w) * (1 - Math.exp(-dt * 0.6));
  if (_w < 0.01) _w = 0;
  if (_w === 0 && _flash <= 0 && !_s.active) return;
  _s.active = _w > 0 || _flash > 0;
  let fl = 0;
  if (_w > 0.7) { _nextFlash -= dt; if (_nextFlash <= 0) { _flash = 0.22; _nextFlash = 12 + Math.random() * 18; } }
  if (_flash > 0) { _flash -= dt; fl = Math.sin(_flash * 38) > 0 ? 1 : 0.25; }
  if (sun) num("sun", sun, "intensity", 1 - 0.55 * _w);
  if (hemi) num("hemi", hemi, "intensity", 1 - 0.15 * _w, 1.3 * fl);
  col("fog", scene.fog && scene.fog.color, fl ? _fl : _grey, fl ? 0.5 : _w * 0.6);
  if (scene.background && scene.background.isColor) col("bg", scene.background, _grey, _w * 0.6);
  if (asphalt) asphalt.color.copy(_dry).lerp(_wet, _w);
}
