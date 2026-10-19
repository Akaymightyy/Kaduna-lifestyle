// src/livemap.js — LIVE 3D MAP: fly the camera high above the real city (same world, same buildings),
// drag to pan, pinch / +- to zoom, name tags on every place and district, tap a tag to travel.
// Nothing here changes game data. Closing the map puts the normal camera, fog and controls back.
import * as THREE from "three";

let S = null;                       // services from main.js
let on = false;
let root = null, labelBox = null, names = true;
const st = { x: 0, z: 0, dist: 260, tx: 0, tz: 0, tdist: 260 };
const PITCH = 58 * Math.PI / 180;   // camera looks down at 58 degrees
const MIN_D = 50, MAX_D = 760;
let saved = null;
let labels = [];                    // { el, x, y, z, kind, id }
const _v = new THREE.Vector3();

export function initLiveMap(services) { S = services; }
export const isLiveMapOn = () => on;

function css() {
  if (document.getElementById("livemap-css")) return;
  const s = document.createElement("style"); s.id = "livemap-css";
  s.textContent = `
  body.live-map #ui{display:none!important}
  #livemap{position:fixed;inset:0;z-index:70;touch-action:none;user-select:none;-webkit-user-select:none}
  #livemap .lm-top{position:absolute;left:8px;right:8px;top:calc(8px + env(safe-area-inset-top));display:flex;gap:6px;align-items:center;pointer-events:none}
  #livemap .lm-btn{pointer-events:auto;background:#fff;border:0;border-radius:14px;padding:9px 13px;font:600 13px Poppins,sans-serif;color:#0f4d3a;box-shadow:0 2px 8px rgba(0,0,0,.25)}
  #livemap .lm-btn.on{background:#0f4d3a;color:#fff}
  #livemap .lm-zoom{position:absolute;right:10px;bottom:calc(90px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:6px}
  #livemap .lm-tag{position:absolute;left:0;top:0;white-space:nowrap;background:rgba(255,255,255,.93);color:#16352a;border-radius:12px;padding:3px 8px;font:600 11px Poppins,sans-serif;box-shadow:0 1px 5px rgba(0,0,0,.3);pointer-events:auto;will-change:transform;transform:translate(-9999px,-9999px)}
  #livemap .lm-tag.area{background:rgba(15,77,58,.92);color:#fff}
  #livemap .lm-tag.me{background:#ff6a3d;color:#fff}
  #livemap .lm-hint{position:absolute;left:0;right:0;bottom:calc(24px + env(safe-area-inset-bottom));text-align:center;color:#fff;font:600 12px Poppins,sans-serif;text-shadow:0 1px 4px #000;pointer-events:none}`;
  document.head.appendChild(s);
}

function build() {
  css();
  root = document.createElement("div"); root.id = "livemap";
  root.innerHTML = '<div class="lm-top"><button class="lm-btn" id="lm-back">← Back</button><button class="lm-btn on" id="lm-names">🏷️ Names</button><button class="lm-btn" id="lm-me">📍 Me</button></div>' +
    '<div class="lm-zoom"><button class="lm-btn" id="lm-in">＋</button><button class="lm-btn" id="lm-out">－</button></div>' +
    '<div class="lm-hint">Drag to move · pinch or ＋ － to zoom · tap a name to see ride prices</div><div id="lm-labels"></div>';
  document.body.appendChild(root);
  labelBox = root.querySelector("#lm-labels");
  root.querySelector("#lm-back").onclick = closeLiveMap;
  root.querySelector("#lm-names").onclick = (e) => { names = !names; e.currentTarget.classList.toggle("on", names); labelBox.style.display = names ? "" : "none"; };
  root.querySelector("#lm-me").onclick = () => { const p = me(); st.tx = p.x; st.tz = p.z; };
  root.querySelector("#lm-in").onclick = () => { st.tdist = Math.max(MIN_D, st.tdist * 0.68); };
  root.querySelector("#lm-out").onclick = () => { st.tdist = Math.min(MAX_D, st.tdist * 1.45); };

  // ---- drag to pan, pinch to zoom ----
  const ptr = new Map(); let pinch0 = 0, dist0 = 0, moved = 0;
  root.addEventListener("pointerdown", (e) => { if (e.target.closest(".lm-btn")) return; ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = st.tdist; } });
  root.addEventListener("pointermove", (e) => {
    const p = ptr.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    if (ptr.size === 2) { const [a, b] = [...ptr.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0 > 0) st.tdist = Math.max(MIN_D, Math.min(MAX_D, dist0 * pinch0 / d)); return; }
    const mpp = (2 * st.dist * Math.tan(THREE.MathUtils.degToRad(S.camera.fov / 2))) / innerHeight;   // metres per pixel
    st.tx -= dx * mpp; st.tz -= dy * mpp / Math.sin(PITCH);
    const L = S.limits; st.tx = Math.max(-L.x - 200, Math.min(L.x + 200, st.tx)); st.tz = Math.max(-L.z - 200, Math.min(L.z + 200, st.tz));
  });
  const up = (e) => { ptr.delete(e.pointerId); if (ptr.size < 2) pinch0 = 0; };
  root.addEventListener("pointerup", up); root.addEventListener("pointercancel", up);
  root.addEventListener("wheel", (e) => { st.tdist = Math.max(MIN_D, Math.min(MAX_D, st.tdist * (e.deltaY > 0 ? 1.15 : 0.87))); }, { passive: true });
  root._moved = () => moved;
}

// where "You" are on the map: outside the house door when you are inside a building
function me() { return (S.getMe && S.getMe()) || S.player.pos; }

function makeLabels() {
  labelBox.innerHTML = ""; labels = [];
  const add = (txt, x, z, kind, id, y = 6) => {
    const el = document.createElement("div"); el.className = "lm-tag " + kind; el.textContent = txt; labelBox.appendChild(el);
    el.addEventListener("click", () => {
      if (root._moved() > 8) return;                                    // it was a drag, not a tap
      if (kind === "place") S.travelPlace(id);
      else if (kind === "area" && id && /^(spot|fun):/.test(id)) S.rideTo(id);   // landmarks + fun spots
      else if (kind === "area" && id) S.travelArea(id);
      else if (kind === "home" && id) S.rideTo(id);                    // your own houses
    });
    labels.push({ el, x, y, z, kind });
  };
  for (const a of S.AREAS) add("🏘️ " + a.name, a.x, a.z, "area", a.id, 8);
  for (const p of S.listPlaces()) add((p.minimapIcon || "📍") + " " + p.name, p.entranceX, p.entranceZ, "place", p.id, 8);
  const hs = (S.getHomes && S.getHomes()) || [];
  if (hs.length) for (const h of hs) add("🏠 " + (hs.length > 1 ? h.name + " #" + h.p : "My Home"), h.x, h.z, "home", (h.a != null && h.p != null) ? "house:" + h.a + ":" + h.p : null, 6);
  else { const h = S.getHomePos && S.getHomePos(); if (h) add("🏠 My Home", h.x, h.z, "home", null, 6); }
  for (const e of (S.extraLabels || [])) add(e.name, e.x, e.z, "area", null, 10);
  add("📍 You", 0, 0, "me", null, 4); labels[labels.length - 1].follow = true;
}

export function openLiveMap() {
  if (!S || on) return;
  if (!root) build();
  on = true;
  { const p = me(); st.x = st.tx = p.x; st.z = st.tz = p.z; } st.dist = st.tdist = 200;
  saved = { near: S.camera.near, far: S.camera.far, fogNear: S.scene.fog ? S.scene.fog.near : 0, fogFar: S.scene.fog ? S.scene.fog.far : 0 };
  S.camera.far = 4000; S.camera.near = 2; S.camera.updateProjectionMatrix();
  if (S.scene.fog) { S.scene.fog.near = 500; S.scene.fog.far = 2600; }
  document.body.classList.add("live-map");
  root.style.display = ""; makeLabels();
}

export function closeLiveMap() {
  if (!on) return;
  on = false;
  S.camera.far = saved.far; S.camera.near = saved.near; S.camera.updateProjectionMatrix();
  if (S.scene.fog) { S.scene.fog.near = saved.fogNear; S.scene.fog.far = saved.fogFar; }
  document.body.classList.remove("live-map");
  root.style.display = "none";
  if (S.onClose) S.onClose();
  document.querySelectorAll("#bottom-nav .nav-btn").forEach(b => b.classList.toggle("active", b.dataset.nav === "home"));
}

/** Called every frame while the map is open (instead of the normal gameplay update). */
export function liveMapFrame(dt) {
  const k = 1 - Math.exp(-dt * 9);
  if (S.scene.fog) { S.scene.fog.near = 1200; S.scene.fog.far = 4200; }   // governor / quality code may reset fog every frame
  st.x += (st.tx - st.x) * k; st.z += (st.tz - st.z) * k; st.dist += (st.tdist - st.dist) * k;
  const c = S.camera;
  c.position.set(st.x, st.dist * Math.sin(PITCH), st.z + st.dist * Math.cos(PITCH));
  c.lookAt(st.x, 0, st.z);
  c.updateMatrixWorld();
  S.tickWorld(st.x, st.z, Math.min(560, st.dist * 1.7 + 120));      // keep districts / houses streamed in around the view
  if (!names) return;
  const w = innerWidth, h = innerHeight;
  for (const L of labels) {
    const mp = L.follow ? me() : null, x = mp ? mp.x : L.x, z = mp ? mp.z : L.z;
    _v.set(x, L.y, z).project(c);
    const ok = _v.z < 1 && Math.abs(_v.x) < 1.15 && Math.abs(_v.y) < 1.1;
    if (!ok) { L.el.style.transform = "translate(-9999px,-9999px)"; continue; }
    // when zoomed far out show districts only, so the screen stays clean
    if (L.kind === "place" && st.dist > 420) { L.el.style.transform = "translate(-9999px,-9999px)"; continue; }
    L.el.style.transform = "translate(" + ((_v.x * 0.5 + 0.5) * w).toFixed(0) + "px," + ((-_v.y * 0.5 + 0.5) * h).toFixed(0) + "px) translate(-50%,-100%)";
  }
}
