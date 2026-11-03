// src/garments.js — NIGERIAN + WESTERN outfits for the character rig (Nov 3).
// Each garment is a few simple low-poly meshes (lathes / cylinders / boxes, flat-shaded so they read as faceted fabric)
// glued to the skeleton by characters.js. Patterned cloth (aso-oke / ankara / tweed / denim ...) is drawn once on a small
// canvas per (pattern, colour) and cached, so a whole crowd costs next to nothing.
import * as THREE from "three";

// ---- which top styles are LONG (the top colour should run past the hips) and how far the top colour reaches down the body ----
// value = height fraction (0 = feet, 1 = head) above which the TOP colour is painted on the body; below it the BOTTOM colour.
export const STYLE_REACH = {
  kaftan: -1,        // whole body (legacy)
  agbada: 0.34, buba: 0.38, trench: 0.36, gown_v: -1,
  suit: 0.5, blazer: 0.5, tux: 0.5, tweed: 0.5, denim: 0.5, hoodie: 0.5, sweater: 0.5, shirt: 0.5, turtle: 0.5, bubaw: 0.5,
};
export const reachOf = (style) => (style in STYLE_REACH ? STYLE_REACH[style] : null);

// ---------- pattern textures ----------
const _tex = new Map();
const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return "#" + c.getHexString(); };
const mix = (hex, hex2, t) => { const c = new THREE.Color(hex).lerp(new THREE.Color(hex2), t); return "#" + c.getHexString(); };
function drawPattern(g, key, base, accent, S) {
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  g.lineWidth = 3;
  if (key === "geo") {                       // aso-oke / agbada: gold diamonds + facets
    const n = 5, w = S / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const cx = x * w + w / 2, cy = y * w + w / 2;
      g.fillStyle = (x + y) % 2 ? shade(base, 0.8) : shade(base, 1.18);
      g.beginPath(); g.moveTo(cx, cy - w / 2); g.lineTo(cx + w / 2, cy); g.lineTo(cx, cy + w / 2); g.lineTo(cx - w / 2, cy); g.closePath(); g.fill();
      g.strokeStyle = accent; g.stroke();
      g.beginPath(); g.moveTo(cx, cy - w / 4); g.lineTo(cx + w / 4, cy); g.lineTo(cx, cy + w / 4); g.lineTo(cx - w / 4, cy); g.closePath(); g.stroke();
    }
  } else if (key === "tri") {                // green/yellow triangles
    const n = 4, w = S / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      g.fillStyle = (x + y) % 2 ? accent : shade(base, 0.85);
      g.beginPath(); g.moveTo(x * w, y * w); g.lineTo(x * w + w, y * w); g.lineTo(x * w, y * w + w); g.closePath(); g.fill();
      g.fillStyle = (x + y) % 2 ? shade(base, 1.15) : mix(accent, base, 0.4);
      g.beginPath(); g.moveTo(x * w + w, y * w); g.lineTo(x * w + w, y * w + w); g.lineTo(x * w, y * w + w); g.closePath(); g.fill();
    }
  } else if (key === "spiral") {             // orange swirls on black
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      const cx = x * S / 3 + S / 6, cy = y * S / 3 + S / 6 + (x % 2 ? S / 12 : 0);
      for (let r = S / 7; r > 2; r -= 5) { g.strokeStyle = r % 10 < 5 ? accent : shade(accent, 0.6); g.beginPath(); g.arc(cx, cy, r, 0, 6.3); g.stroke(); }
    }
  } else if (key === "plaid") {              // white + red woven stripes
    for (let i = 0; i < S; i += S / 4) { g.fillStyle = accent; g.globalAlpha = 0.85; g.fillRect(i, 0, S / 16, S); g.fillRect(0, i, S, S / 16); g.globalAlpha = 0.35; g.fillRect(i + S / 8, 0, S / 24, S); g.fillRect(0, i + S / 8, S, S / 24); }
    g.globalAlpha = 1;
  } else if (key === "wax") {                // ankara wax-print rings
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      const cx = x * S / 3 + S / 6 + (y % 2 ? S / 6 : 0), cy = y * S / 3 + S / 6;
      g.fillStyle = accent; g.beginPath(); g.arc(cx, cy, S / 8, 0, 6.3); g.fill();
      g.fillStyle = base; g.beginPath(); g.arc(cx, cy, S / 12, 0, 6.3); g.fill();
      g.fillStyle = shade(accent, 0.7); g.beginPath(); g.arc(cx, cy, S / 24, 0, 6.3); g.fill();
    }
  } else if (key === "tweed") {              // checked wool
    for (let i = 0; i < S; i += 16) { g.fillStyle = shade(base, 0.8); g.globalAlpha = 0.6; g.fillRect(i, 0, 8, S); g.fillRect(0, i, S, 8); }
    g.globalAlpha = 0.35; g.fillStyle = accent; for (let i = 0; i < S; i += 32) { g.fillRect(i + 6, 0, 2, S); g.fillRect(0, i + 6, S, 2); } g.globalAlpha = 1;
  } else if (key === "leopard") {
    for (let i = 0; i < 26; i++) { const x = (i * 53) % S, y = (i * 97) % S; g.fillStyle = shade(base, 0.55); g.beginPath(); g.ellipse(x, y, 9, 6, i, 0, 6.3); g.fill(); g.strokeStyle = shade(base, 0.3); g.lineWidth = 2; g.stroke(); }
  } else if (key === "denim") {
    for (let i = 0; i < 700; i++) { g.fillStyle = Math.random() < 0.5 ? shade(base, 0.9) : shade(base, 1.1); g.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
  } else if (key === "stripe") {
    for (let i = 0; i < S; i += 16) { g.fillStyle = accent; g.fillRect(i, 0, 5, S); }
  } else if (key === "ribs") {
    for (let i = 0; i < S; i += 8) { g.fillStyle = shade(base, i % 16 ? 0.88 : 1.08); g.fillRect(i, 0, 4, S); }
  }
}
function patternTexture(key, base, accent, rep = 3) {
  const id = key + base + accent + rep; if (_tex.has(id)) return _tex.get(id);
  const S = 128, c = document.createElement("canvas"); c.width = c.height = S;
  drawPattern(c.getContext("2d"), key, base, accent, S);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2; t.repeat.set(rep, rep);
  _tex.set(id, t); return t;
}
function cloth(color, pattern, accent = "#d4af37", rep = 3, rough = 0.85) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: rough, side: THREE.DoubleSide, flatShading: true });
  if (pattern) m.map = patternTexture(pattern, "#" + new THREE.Color(color).getHexString(), accent, rep);
  else m.color = new THREE.Color(color);
  return m;
}
const plain = (color, rough = 0.8) => new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: rough, side: THREE.DoubleSide, flatShading: true });
const metal = (color = "#d4af37") => new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.3, metalness: 0.8 });

// ---------- shape helpers ----------
const V = (arr) => arr.map(([x, y]) => new THREE.Vector2(x, y));
const lathe = (pts, seg, mat) => new THREE.Mesh(new THREE.LatheGeometry(V(pts), seg), mat);
// a flat V-shaped panel (shirt front under a jacket): wide at the neck, narrowing to a point
const vpanel = (w, h, mat, tip = 0.012) => { const sh = new THREE.Shape(); sh.moveTo(-w / 2, h / 2); sh.lineTo(w / 2, h / 2); sh.lineTo(tip, -h / 2); sh.lineTo(-tip, -h / 2); sh.closePath(); return new THREE.Mesh(new THREE.ShapeGeometry(sh), mat); };
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

// ---------- the garment library ----------
// ctx = { look, attach(bone, mesh, offY, rotX), put(bone, mesh, offY, zScale), sleeve(from, to, r0, r1, mat), female }
const G = {};

// ===== NIGERIAN — MEN =====
G.agbada = (c) => {                       // flowing 3-piece: wide robe + embroidered inner top + matching trousers (painted) + fila
  const L = c.look, out = cloth(L.top, L.pattern || "geo", L.accent, 3), inner = cloth(shade(L.top, 0.85), L.pattern || "geo", L.accent, 2);
  const robe = lathe([[0.09, 0.58], [0.2, 0.52], [0.24, 0.36], [0.25, 0.1], [0.28, -0.2], [0.32, -0.5], [0.34, -0.66]], 14, out);
  c.put("Spine", robe, 0, 0.8);
  const hem = lathe([[0.335, -0.64], [0.34, -0.66], [0.34, -0.7], [0.335, -0.7]], 14, plain(L.accent || "#d4af37", 0.5)); c.put("Spine", hem, 0, 0.8);
  // embroidered chest panel + neckline
  const panel = box(0.2, 0.42, 0.02, cloth(shade(L.top, 0.9), "geo", L.accent, 1)); panel.position.set(0, 0, 0); c.put("Spine", panel, 0.3, 1, 0); panel.position.z = 0.17;
  const trim = box(0.025, 0.46, 0.025, metal(L.accent)); c.put("Spine", trim, 0.28, 1, 0); trim.position.z = 0.185;
  // wide flowing sleeves (agbada trademark) + drape over the forearms
  const outS = cloth(L.top, L.pattern || "geo", L.accent, 1);
  for (const s of ["Left", "Right"]) { c.sleeve(s + "Arm", s + "ForeArm", 0.085, 0.12, outS); c.sleeve(s + "ForeArm", s + "Hand", 0.12, 0.15, outS); }
  c.hat("fila", L.top, L.accent);
};
G.buba = (c) => {                         // buba & sokoto: embroidered tunic to mid-thigh
  const L = c.look, m = cloth(L.top, L.pattern || "geo", L.accent, 3), mS = cloth(L.top, L.pattern || "geo", L.accent, 1);
  c.put("Spine", lathe([[0.09, 0.58], [0.17, 0.52], [0.19, 0.36], [0.2, 0.1], [0.215, -0.12], [0.225, -0.24]], 14, m), 0, 0.76);
  const panel = box(0.17, 0.36, 0.02, plain(L.accent || "#d4af37", 0.5)); c.put("Spine", panel, 0.34, 1, 0); panel.position.z = 0.15;
  const panel2 = box(0.12, 0.3, 0.021, cloth(shade(L.top, 0.9), "geo", L.accent, 1)); c.put("Spine", panel2, 0.34, 1, 0); panel2.position.z = 0.152;
  for (const s of ["Left", "Right"]) { c.sleeve(s + "Arm", s + "ForeArm", 0.066, 0.075, mS); c.sleeve(s + "ForeArm", s + "Hand", 0.075, 0.08, mS); }
  c.hat("fila", L.top, L.accent);
};
// ===== NIGERIAN — WOMEN =====
G.iro = (c) => {                          // iro (wrapper) + buba (blouse, puffed sleeves) + gele (head tie) + gold jewellery
  const L = c.look, bS = cloth(L.top, L.pattern || "geo", L.accent, 1), blouse = cloth(L.top, L.pattern || "geo", L.accent, 3), wrap = cloth(L.bottom || L.top, L.pattern2 || L.pattern || "geo", L.accent, 3);
  c.put("Spine", lathe([[0.085, 0.575], [0.17, 0.52], [0.2, 0.38], [0.165, 0.14], [0.17, 0.0]], 14, blouse), 0, 0.78);
  const neck = lathe([[0.09, 0.575], [0.115, 0.55], [0.1, 0.52]], 12, metal(L.accent)); c.put("Spine", neck, 0, 0.8);
  for (const s of ["Left", "Right"]) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), blouse); c.attachBone(s + "Arm", puff, 0.0, 0);
    c.sleeve(s + "Arm", s + "ForeArm", 0.088, 0.075, bS);
    c.sleeve(s + "ForeArm", s + "Hand", 0.075, 0.062, bS);
  }
  // wrapper: tied at the hip, long to the ankle, with an overlapping wrap panel + knot
  c.attach("Hips", lathe([[0.15, 0.08], [0.2, -0.02], [0.23, -0.2], [0.24, -0.45], [0.24, -0.7], [0.235, -0.8]], 16, wrap), 0, 0);
  const sash = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.03, 6, 18).rotateX(Math.PI / 2), cloth(L.bottom || L.top, L.pattern2 || "plaid", L.accent, 1)); c.attach("Hips", sash, 0.06, 0); sash.scale.z = 0.85;
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), wrap); c.attach("Hips", knot, 0.06, 0); knot.position.set(0.12, 0.0, 0.15);
  c.hat("gele", L.top, L.accent);
  c.jewel(L.accent);
};
// ===== WESTERN — jackets =====
function jacket(c, o) {
  const L = c.look, f = c.female ? 0.9 : 1, m = o.pattern ? cloth(o.color, o.pattern, o.accent || "#8a6a3a", 3) : plain(o.color, 0.85);
  c.put("Spine", lathe([[0.085 * f, 0.575], [0.17 * f, 0.52], [0.195 * f, 0.38], [0.175 * f, 0.12], [0.19 * f, -0.08], [0.2 * f, o.hem || -0.2]], 14, m), 0, 0.74);
  // shirt panel (V at the front)
  const shirt = vpanel(0.2 * f, 0.5, plain(o.under || "#f2f2ee", 0.7), 0.02); c.put("Spine", shirt, 0.32, 1, 0); shirt.position.z = 0.152 * f + 0.012;
  // lapels
  for (const sx of [-1, 1]) { const l = box(0.06, 0.34, 0.02, plain(shade(o.color, 1.2), 0.8)); c.put("Spine", l, 0.3, 1, 0); l.position.set(sx * 0.07 * f, 0.3 - 0.3, 0.155 * f + 0.025); l.position.y = 0.0; l.rotation.z = sx * -0.28; }
  if (o.tie) { const t = vpanel(0.05, 0.34, plain(o.tie, 0.6), 0.018); c.put("Spine", t, 0.3, 1, 0); t.position.z = 0.152 * f + 0.02; }
  if (o.bow) { for (const sx of [-1, 1]) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 6), plain("#111111", 0.5)); b.rotation.z = sx * Math.PI / 2; c.put("Spine", b, 0.5, 1, 0); b.position.set(sx * 0.04, 0, 0.17 * f + 0.03); } }
  for (const s of ["Left", "Right"]) { c.sleeve(s + "Arm", s + "ForeArm", 0.066, 0.066, m); c.sleeve(s + "ForeArm", s + "Hand", 0.066, 0.06, m); }
  if (o.buttons) for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 5), metal(o.buttons)); c.put("Spine", b, 0.2 - i * 0.14, 1, 0); b.position.z = 0.19 * f + 0.01; }
}
G.suit = (c) => jacket(c, { color: c.look.top, under: c.look.under || "#f2f2ee", tie: c.look.tie || "#1a2a5a", buttons: "#c9b38a" });
G.tux = (c) => jacket(c, { color: c.look.top, under: "#ffffff", bow: true, buttons: "#222222" });
G.blazer = (c) => jacket(c, { color: c.look.top, under: c.look.under || "#f2f2ee", hem: -0.14, buttons: "#d4af37" });
G.tweed = (c) => jacket(c, { color: c.look.top, under: c.look.under || "#8fb4d9", pattern: "tweed", accent: "#c9b38a", buttons: "#5a3a1a" });
G.denim = (c) => {
  const L = c.look, f = c.female ? 0.9 : 1, m = cloth(L.top, "denim", "#fff", 3);
  c.put("Spine", lathe([[0.09 * f, 0.575], [0.18 * f, 0.52], [0.2 * f, 0.38], [0.19 * f, 0.1], [0.2 * f, -0.04]], 14, m), 0, 0.74);
  const under = vpanel(0.2 * f, 0.4, plain(L.under || "#f2f2ee", 0.8), 0.04); c.put("Spine", under, 0.36, 1, 0); under.position.z = 0.16 * f + 0.012;
  for (const sx of [-1, 1]) { const p = box(0.07, 0.07, 0.02, plain(shade(L.top, 0.85), 0.8)); c.put("Spine", p, 0.3, 1, 0); p.position.set(sx * 0.1 * f, 0, 0.17 * f + 0.02); }
  for (const s of ["Left", "Right"]) { c.sleeve(s + "Arm", s + "ForeArm", 0.066, 0.066, m); c.sleeve(s + "ForeArm", s + "Hand", 0.066, 0.06, m); }
};
G.trench = (c) => {
  const L = c.look, m = plain(L.top, 0.8);
  c.put("Spine", lathe([[0.09, 0.575], [0.19, 0.52], [0.215, 0.36], [0.2, 0.1], [0.24, -0.15], [0.285, -0.36], [0.3, -0.46]], 14, m), 0, 0.76);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.014, 6, 16).rotateX(Math.PI / 2), plain(shade(L.top, 0.7), 0.7)); c.put("Spine", belt, 0.1, 0.76, 0);
  for (const sx of [-1, 1]) { const col = box(0.1, 0.18, 0.02, m); c.put("Spine", col, 0.5, 1, 0); col.position.set(sx * 0.08, 0, 0.14); col.rotation.z = sx * -0.5; }
  const under = vpanel(0.2, 0.4, plain(L.under || "#1f2a5a", 0.8), 0.03); c.put("Spine", under, 0.36, 1, 0); under.position.z = 0.17;
  for (const s of ["Left", "Right"]) { c.sleeve(s + "Arm", s + "ForeArm", 0.07, 0.07, m); c.sleeve(s + "ForeArm", s + "Hand", 0.07, 0.064, m); }
};
G.hoodie = (c) => {
  const L = c.look, m = plain(L.top, 0.95);
  c.put("Spine", lathe([[0.1, 0.57], [0.19, 0.52], [0.215, 0.36], [0.21, 0.1], [0.215, -0.08], [0.21, -0.14]], 14, m), 0, 0.78);
  const rib = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.016, 6, 16).rotateX(Math.PI / 2), plain(shade(L.top, 0.85), 0.9)); c.put("Spine", rib, -0.14, 0.78, 0);
  const pocket = box(0.26, 0.13, 0.025, plain(shade(L.top, 0.9), 0.9)); c.put("Spine", pocket, -0.0, 1, 0); pocket.position.z = 0.19;
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), m); hood.rotation.x = Math.PI + 0.35; c.put("Spine", hood, 0.55, 1, 0); hood.position.set(0, 0.0, -0.09);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 6, 14).rotateX(Math.PI / 2 - 0.5), m); c.put("Spine", ring, 0.55, 1, 0); ring.position.z = 0.02;
  for (const sx of [-1, 1]) { const dr = box(0.012, 0.16, 0.012, plain("#f2f2ee", 0.8)); c.put("Spine", dr, 0.4, 1, 0); dr.position.set(sx * 0.035, 0, 0.185); }
  for (const s of ["Left", "Right"]) { c.sleeve(s + "Arm", s + "ForeArm", 0.075, 0.075, m); c.sleeve(s + "ForeArm", s + "Hand", 0.075, 0.062, m); }
};
G.sweater = (c) => {
  const L = c.look, m = cloth(L.top, "ribs", L.top, 5, 0.95);
  c.put("Spine", lathe([[0.1, 0.575], [0.185, 0.52], [0.205, 0.36], [0.2, 0.1], [0.205, -0.05], [0.2, -0.1]], 14, m), 0, 0.78);
  const rib = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.017, 6, 16).rotateX(Math.PI / 2), plain(shade(L.top, 0.8), 0.95)); c.put("Spine", rib, -0.1, 0.78, 0);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.09, 12, 1, true), m); c.attach("Head", neck, -0.07, 0);
  for (const s of ["Left", "Right"]) { c.sleeve(s + "Arm", s + "ForeArm", 0.072, 0.072, m); c.sleeve(s + "ForeArm", s + "Hand", 0.072, 0.062, m); }
};
G.turtle = G.sweater;
G.shirt = (c) => {                                   // long-sleeve collared shirt / blouse
  const L = c.look, m = plain(L.top, 0.8);
  c.put("Spine", lathe([[0.085, 0.575], [0.17, 0.52], [0.19, 0.36], [0.17, 0.1], [0.18, -0.06]], 14, m), 0, 0.74);
  for (const sx of [-1, 1]) { const col = box(0.07, 0.06, 0.02, plain(shade(L.top, 1.1), 0.8)); c.put("Spine", col, 0.56, 1, 0); col.position.set(sx * 0.045, 0, 0.12); col.rotation.z = sx * -0.5; }
  for (const s of ["Left", "Right"]) { c.sleeve(s + "Arm", s + "ForeArm", 0.063, 0.063, m); c.sleeve(s + "ForeArm", s + "Hand", 0.063, 0.056, m); }
};
G.gown_v = (c) => {                                  // long evening gown, V neckline, sleeveless, flowing skirt
  const L = c.look, m = plain(L.top, 0.6);
  c.put("Spine", lathe([[0.07, 0.56], [0.14, 0.5], [0.15, 0.38], [0.135, 0.14], [0.15, 0.02]], 14, m), 0, 0.72);
  c.attach("Hips", lathe([[0.15, 0.08], [0.2, -0.08], [0.26, -0.3], [0.34, -0.55], [0.42, -0.8], [0.45, -0.88]], 18, m), 0, 0);
  const v = vpanel(0.11, 0.14, plain(L.skin || "#8a5a3c", 0.7), 0.005); c.put("Spine", v, 0.43, 1, 0); v.position.z = 0.14;
  const clutch = box(0.12, 0.08, 0.025, plain("#111111", 0.5)); c.attachBone("LeftHand", clutch, 0, 0); clutch.position.set(0, -0.04, 0.03);
};
// ===== skirts / bottoms with a design =====
G.skirt_t = (c, hemY = -0.34) => {                   // patterned mini skirt (legs painted dark = tights)
  const L = c.look;
  c.attach("Hips", lathe([[0.15, 0.06], [0.2, -0.02], [0.25, -0.18], [0.28, hemY]], 16, cloth(L.skirtColor || L.bottom, L.pattern2 || "leopard", L.accent, 2)), 0, 0);
};
G.pencil = (c) => {                                  // knee-length pencil skirt
  const L = c.look;
  c.attach("Hips", lathe([[0.15, 0.06], [0.19, -0.05], [0.185, -0.25], [0.165, -0.45]], 16, plain(L.bottom, 0.8)), 0, 0);
};

// ---------- hats ----------
const HATS = {
  fila(c, color, accent) {                           // Yoruba fila: soft cap folded over to one side
    const m = cloth(color, "geo", accent, 1);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.098, 0.1, 14), m); c.attachBone("Head", cap, 0.2, 0);
    const flop = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), m); flop.scale.set(1.05, 0.7, 1.05);
    c.attachBone("Head", flop, 0.25, 0); flop.parent.rotation.z = 0.5; flop.position.x = -0.02;
    c.attachBone("Head", new THREE.Mesh(new THREE.TorusGeometry(0.099, 0.008, 5, 16).rotateX(Math.PI / 2), plain(accent, 0.5)), 0.155, 0);
  },
  gele(c, color, accent) {                           // gele: big sculpted head tie with a fan wing
    const m = cloth(color, "geo", accent, 2, 0.7);
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 9), m); base.scale.set(1.05, 0.8, 1.05); c.attachBone("Head", base, 0.2, 0);
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.15 - i * 0.012, 0.03, 6, 14).rotateX(Math.PI / 2), m); c.attachBone("Head", r, 0.17 + i * 0.045, 0); }
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.13, 10, 1, true), m); wing.rotation.z = -Math.PI / 2 + 0.35; c.attachBone("Head", wing, 0.3, 0); wing.position.x += 0.1;
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), m); c.attachBone("Head", knot, 0.27, 0); knot.position.x -= 0.1;
  },
  beanie(c, color) {
    const m = plain(color, 0.95);
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 9, 0, Math.PI * 2, 0, Math.PI * 0.62), m); c.attachBone("Head", d, 0.2, 0);
    const f = new THREE.Mesh(new THREE.TorusGeometry(0.113, 0.02, 6, 16).rotateX(Math.PI / 2), plain(shade(color, 0.8), 0.95)); c.attachBone("Head", f, 0.215, 0);
  },
  cap(c, color) {
    const m = plain(color, 0.8);
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 9, 0, Math.PI * 2, 0, Math.PI / 2), m); c.attachBone("Head", d, 0.2, 0);
    const bill = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 14, 1, false, 0, Math.PI), m); c.attachBone("Head", bill, 0.205, 0); bill.position.z += 0.1;
  },
  kufi(c) { const g = new THREE.CylinderGeometry(0.088, 0.1, 0.085, 20); c.attachBone("Head", new THREE.Mesh(g, plain("#f6f2e8", 0.9)), 0.215, 0); },
};

// ---------- jewellery (gold necklace + earrings) ----------
function jewel(c, color) {
  const g = metal(color || "#d4af37");
  c.attachBone("Spine", new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 18).rotateX(Math.PI / 2), g), 0.5, 0);
  c.attachBone("Spine", new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.01, 6, 18).rotateX(Math.PI / 2), g), 0.45, 0);
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 5), g); c.attachBone("Head", e, 0.02, 0); e.position.set(sx * 0.105, 0, 0.0); }
  for (const s of ["Left", "Right"]) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 14), g); c.attachBone(s + "ForeArm", b, 0.0, Math.PI / 2); }
}

// ---------- entry points ----------
// returns true when it built the garment for `look.topStyle`; characters.js builds the legacy styles itself.
export function buildGarment(look, ctx) {
  const c = { ...ctx, look, hat: (k, col, acc) => (HATS[k] ? HATS[k](ctx, col, acc) : 0), jewel: (col) => jewel(ctx, col) };
  const fn = G[look.topStyle];
  if (fn) fn(c);
  const bs = G[look.bottomStyle];
  if (bs && (look.bottomStyle === "skirt_t" || look.bottomStyle === "pencil")) bs(c);
  // optional hat from the outfit data (when the garment itself did not put one on) — e.g. beanie / cap / kufi
  if (look.hat && HATS[look.hat] && !(look.topStyle === "agbada" || look.topStyle === "buba" || look.topStyle === "iro")) HATS[look.hat](ctx, look.hatColor || look.top, look.accent || "#d4af37");
  if (look.jewel && look.topStyle !== "iro") jewel(ctx, look.accent);
  return !!fn;
}
export const isCustomStyle = (s) => !!G[s];
