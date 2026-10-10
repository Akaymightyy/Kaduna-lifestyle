import * as THREE from "three";

// Orbit camera + thumb joystick. Drag the screen to look, pinch to zoom.
export function createControls(canvas, camera, ui) {
  const st = { yaw: Math.PI, pitch: 0.38, dist: 6.5, minDist: 2.2, maxDist: 16, joyX: 0, joyY: 0, jog: false, keys: {} };
  const ptrs = new Map();
  let pinch0 = 0, dist0 = 0;

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = st.dist; }
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 1) {
      st.yaw -= dx * 0.0055;
      st.pitch = Math.max(0.06, Math.min(1.25, st.pitch + dy * 0.004));
    } else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch0 > 0) st.dist = Math.max(st.minDist, Math.min(st.maxDist, dist0 * (pinch0 / d)));
    }
  });
  const up = (e) => { ptrs.delete(e.pointerId); pinch0 = 0; };
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", (e) => { st.dist = Math.max(st.minDist, Math.min(st.maxDist, st.dist + e.deltaY * 0.01)); }, { passive: true });

  // thumb stick
  const joy = ui.joy, knob = ui.knob;
  let jid = null;
  const setJoy = (e) => {
    const r = joy.getBoundingClientRect(), R = r.width / 2;
    let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
    const m = Math.hypot(dx, dy), lim = R - 8;
    if (m > lim) { dx *= lim / m; dy *= lim / m; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    st.joyX = dx / lim; st.joyY = -dy / lim;
  };
  joy.addEventListener("pointerdown", (e) => { jid = e.pointerId; joy.setPointerCapture(jid); setJoy(e); e.stopPropagation(); });
  joy.addEventListener("pointermove", (e) => { if (e.pointerId === jid) setJoy(e); });
  const jend = (e) => { if (e.pointerId !== jid) return; jid = null; knob.style.transform = ""; st.joyX = st.joyY = 0; };
  joy.addEventListener("pointerup", jend); joy.addEventListener("pointercancel", jend);

  addEventListener("keydown", (e) => { st.keys[e.key.toLowerCase()] = true; });
  addEventListener("keyup", (e) => { st.keys[e.key.toLowerCase()] = false; });

  // movement intent (camera-relative), magnitude 0..1
  st.intent = () => {
    let x = st.joyX, y = st.joyY;
    const k = st.keys;
    if (k["w"] || k["arrowup"]) y += 1; if (k["s"] || k["arrowdown"]) y -= 1;
    if (k["d"] || k["arrowright"]) x += 1; if (k["a"] || k["arrowleft"]) x -= 1;
    const m = Math.hypot(x, y);
    if (m < 0.12) return { x: 0, z: 0, mag: 0 };
    const mag = Math.min(1, m); x /= m; y /= m;
    const fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw);   // camera forward on the ground
    const rx = -fz, rz = fx;                                 // camera right
    return { x: fx * y + rx * x, z: fz * y + rz * x, mag };
  };
  st.zoom = (d) => { st.dist = Math.max(st.minDist, Math.min(st.maxDist, st.dist + d)); };
  return st;
}

const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _dir = new THREE.Vector3();
// place the camera around the target, pulling it in if a building is in the way
export function updateCamera(camera, st, target, colliders, dt) {
  _t.set(target.x, target.y + 1.45, target.z);
  _dir.set(Math.sin(st.yaw) * Math.cos(st.pitch), Math.sin(st.pitch), Math.cos(st.yaw) * Math.cos(st.pitch));
  let d = st.dist;
  for (const b of colliders) {
    // slab test on the XZ footprint (buildings are taller than the camera)
    let t0 = 0, t1 = d + 1;
    const ax = [[_t.x, _dir.x, b.minX, b.maxX], [_t.z, _dir.z, b.minZ, b.maxZ]];
    let hit = true;
    for (const [o, dd, mn, mx] of ax) {
      if (Math.abs(dd) < 1e-6) { if (o < mn || o > mx) { hit = false; break; } continue; }
      let a = (mn - o) / dd, c = (mx - o) / dd; if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, c);
      if (t0 > t1) { hit = false; break; }
    }
    if (hit && t0 < d) d = Math.max(1.2, t0 - 0.35);
  }
  const k = 1 - Math.exp(-dt * 14);
  st._d = st._d === undefined ? d : st._d + (d - st._d) * (d < st._d ? 1 : k); // snap in, ease out
  _v.copy(_t).addScaledVector(_dir, st._d);
  _v.y = Math.max(0.5, _v.y);
  camera.position.lerp(_v, 1 - Math.exp(-dt * 20));
  camera.lookAt(_t);
}
