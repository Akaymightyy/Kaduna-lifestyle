// src/art/dress.js — "dress" a plain box room so it looks lived-in: skirting, crown trim, window frames with
// burglar bars + ankara curtains, door frame, pictures, calendar, radio shelf, hanging bulb, a few Nigerian props.
// ONE merged mesh + one glow sprite per room. Coordinates: room centred on (0,0), floor y=0, walls at +-W/2, +-D/2.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { bx, cy, darken, lighten } from "./geo.js";
import { PAT, styledMaterial } from "./style.js";

let _glowTex = null;
function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,235,170,0.9)"); r.addColorStop(0.35, "rgba(255,214,120,0.35)"); r.addColorStop(1, "rgba(255,200,100,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  _glowTex = new THREE.CanvasTexture(c); _glowTex.colorSpace = THREE.SRGBColorSpace; return _glowTex;
}

export function dressRoom(group, { W, D, tier = 1, wallCol = 0xf1e6cf, seed = 1 } = {}) {
  const HW = W / 2, HD = D / 2, WALL_T = 0.15, H = 4, g = [];
  const trim = darken(wallCol, 0.62), cap = lighten(wallCol, 0.35);
  const doorW = Math.min(2.4, W * 0.2);
  // skirting boards + crown trim along the inside of back/left/right walls and both sides of the front wall
  g.push(bx(W - 0.3, 0.2, 0.07, 0, 0, -HD + WALL_T + 0.035, trim, PAT.WOOD));
  g.push(bx(0.07, 0.2, D - 0.3, -HW + WALL_T + 0.035, 0, 0, trim, PAT.WOOD));
  g.push(bx(0.07, 0.2, D - 0.3, HW - WALL_T - 0.035, 0, 0, trim, PAT.WOOD));
  for (const s of [-1, 1]) g.push(bx((W - doorW) / 2 - 0.15, 0.2, 0.07, s * (doorW / 2 + (W - doorW) / 4), 0, HD - WALL_T - 0.035, trim, PAT.WOOD));
  g.push(bx(W - 0.3, 0.1, 0.1, 0, H - 0.12, -HD + WALL_T + 0.05, cap), bx(0.1, 0.1, D - 0.3, -HW + WALL_T + 0.05, H - 0.12, 0, cap), bx(0.1, 0.1, D - 0.3, HW - WALL_T - 0.05, H - 0.12, 0, cap));
  // door frame (front wall gap) + doormat
  const fz = HD;
  g.push(bx(0.12, 2.5, 0.4, -doorW / 2 - 0.06, 0, fz, 0x5a3b22, PAT.WOOD), bx(0.12, 2.5, 0.4, doorW / 2 + 0.06, 0, fz, 0x5a3b22, PAT.WOOD), bx(doorW + 0.24, 0.14, 0.4, 0, 2.5, fz, 0x5a3b22, PAT.WOOD));
  g.push(bx(Math.min(1.6, doorW), 0.025, 0.7, 0, 0, HD - 0.7, 0xc0392b, PAT.RUG));
  // windows: frame, glass, burglar bars, curtains (tier 2+: two on the back wall, tier 1: one vent)
  const win = (x, w, h, y) => {
    const z = -HD + WALL_T + 0.02;
    g.push(bx(w + 0.2, 0.1, 0.1, x, y - 0.05, z, 0xf4f1ea), bx(w + 0.2, 0.1, 0.1, x, y + h, z, 0xf4f1ea), bx(0.1, h + 0.1, 0.1, x - w / 2 - 0.05, y - 0.05, z, 0xf4f1ea), bx(0.1, h + 0.1, 0.1, x + w / 2 + 0.05, y - 0.05, z, 0xf4f1ea));
    g.push(bx(w, h, 0.03, x, y, z - 0.01, 0xa9cfe6, PAT.GLASS));
    const bars = Math.max(4, Math.round(w / 0.28));
    for (let i = 0; i <= bars; i++) g.push(bx(0.035, h, 0.04, x - w / 2 + (w * i) / bars, y, z + 0.04, 0x26282c));
    g.push(bx(w, 0.035, 0.04, x, y + h * 0.5, z + 0.04, 0x26282c));
    if (w > 1.2) for (const s of [-1, 1]) g.push(bx(w * 0.32, h + 0.5, 0.1, x + s * (w / 2 - w * 0.05), y - 0.2, z + 0.12, 0xd9742a, PAT.CURTAIN));
    g.push(bx(w + 0.7, 0.04, 0.06, x, y + h + 0.3, z + 0.12, 0x6b4a2a));
  };
  if (tier >= 2) { const w = Math.max(1.8, W * 0.14); win(-W * 0.25, w, 1.4, 1.5); win(W * 0.25, w, 1.4, 1.5); }
  else win(0, 1.0, 0.45, 3.0);
  // side-wall window (tier 3+)
  // wall decor on the back wall between windows + on the left wall
  const bz = -HD + WALL_T + 0.04;
  const frame = (x, y, w, h, col, z, rotY = 0) => {
    if (rotY) { // left-wall pieces
      g.push(bx(0.06, h, w, -HW + WALL_T + 0.03, y, z, 0x5a3b22), bx(0.07, h - 0.1, w - 0.1, -HW + WALL_T + 0.04, y + 0.05, z, col, PAT.ANKARA));
    } else {
      g.push(bx(w, h, 0.06, x, y, bz, 0x5a3b22), bx(w - 0.1, h - 0.1, 0.07, x, y + 0.05, bz + 0.01, col, PAT.ANKARA));
    }
  };
  frame(0, 1.7, 0.9, 0.7, 0xe8b030, 0);
  if (W > 8) frame(W * 0.42, 1.6, 0.7, 0.9, 0x2a7ab5, 0);
  frame(0, 1.8, 0.8, 0.6, 0xd94c2e, -D * 0.12, 1);
  // calendar
  g.push(bx(0.55, 0.75, 0.04, -W * 0.42, 1.5, bz, 0xffffff), bx(0.55, 0.2, 0.05, -W * 0.42, 2.05, bz, 0x1f7a5a));
  // radio on a wall shelf (left wall)
  const sx = -HW + WALL_T + 0.18;
  g.push(bx(0.34, 0.05, 1.0, sx, 1.6, D * 0.2, 0x5a3b22, PAT.WOOD), bx(0.22, 0.2, 0.4, sx, 1.65, D * 0.2, 0x1c1c20), bx(0.03, 0.4, 0.03, sx, 1.65, D * 0.2 + 0.18, 0x9aa0a6, 0, 0, 0, 0.2), bx(0.14, 0.08, 0.14, sx, 1.65, D * 0.2 - 0.3, 0xe0b020));
  // hanging bulb
  g.push(bx(0.02, 0.8, 0.02, 0, H - 0.8, 0, 0x1c1c20), cy(0.08, 0.08, 0.14, 0, H - 0.95, 0, 0xfff0b0, PAT.GLOW, 8));
  // Nigerian touches: drink crate + bucket + stool in a corner
  g.push(bx(0.5, 0.3, 0.4, HW - 0.7, 0, -HD + 0.6, 0xc0392b, PAT.NONE));
  for (let i = 0; i < 6; i++) g.push(cy(0.04, 0.04, 0.2, HW - 0.88 + (i % 3) * 0.18, 0.3, -HD + 0.5 + Math.floor(i / 3) * 0.16, 0x3a2a1a, 0, 6));
  g.push(cy(0.2, 0.15, 0.32, HW - 1.45, 0, -HD + 0.55, 0x1d5fa8, PAT.NONE, 10));
  // hanging mosquito-net / ceiling beam
  g.push(bx(W - 0.3, 0.12, 0.18, 0, H - 0.12, 0, darken(wallCol, 0.55), PAT.WOOD));

  const merged = mergeGeometries(g, false); g.forEach((x) => x.dispose());
  const mesh = new THREE.Mesh(merged, styledMaterial("interior")); mesh.name = "room_dress";
  group.add(mesh);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.set(0, H - 1.05, 0); glow.scale.set(3.2, 3.2, 1); group.add(glow);
  return mesh;
}
