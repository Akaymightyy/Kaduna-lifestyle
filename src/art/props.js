// src/art/props.js — stylised 3D furniture for every item in FURNITURE_CATALOG (src/furniture.js).
// Each builder returns an array of geometries (see geo.js); buildProp() merges them into ONE mesh.
// Footprint = item.w x item.d cells (1 cell = 1 m). Keep every piece inside its footprint.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { bx, cy, sp, cone, darken, lighten } from "./geo.js";
import { PAT, styledMaterial } from "./style.js";

const WOOD = 0x8a5a3c, DARK = 0x1c1c20, WHITE = 0xf2f2ee, METAL = 0x9aa0a6;
const hexOf = (c) => new THREE.Color(c).getHex();

const B = {
  bed(c, w, d, wide) {
    const W = w * 0.96, D = d * 0.96, g = [];
    g.push(bx(W, 0.28, D, 0, 0, 0, WOOD, PAT.WOOD));                         // frame
    g.push(bx(W - 0.1, 0.22, D - 0.12, 0, 0.28, 0.04, 0xf0e2a0, PAT.NONE));  // sheet
    g.push(bx(W - 0.08, 0.1, D * 0.68, 0, 0.5, D * 0.14, hexOf(c), PAT.ANKARA)); // ankara spread
    g.push(bx(W, 0.85, 0.12, 0, 0, -D / 2 + 0.06, darken(WOOD, 0.7), PAT.WOOD));  // headboard
    const n = wide ? 2 : 1;
    for (let i = 0; i < n; i++) g.push(bx(W / n - 0.2, 0.13, 0.5, (i - (n - 1) / 2) * (W / n), 0.5, -D / 2 + 0.45, 0xffffff));
    g.push(bx(0.5, 0.1, 0.5, W * 0.22, 0.6, -D * 0.05, 0xd94c2e, PAT.ANKARA));        // throw cushion
    return g;
  },
  mattress(c, w, d) { return [bx(w * 0.96, 0.32, d * 0.96, 0, 0, 0, hexOf(c)), bx(w * 0.96, 0.03, d * 0.96, 0, 0.32, 0, lighten(hexOf(c), 0.4))]; },
  wardrobe(c, w, d) {
    const W = w * 0.96, D = d * 0.9, g = [];
    g.push(bx(W, 2.0, D, 0, 0, 0, hexOf(c), PAT.WOOD));
    g.push(bx(W + 0.08, 0.08, D + 0.06, 0, 2.0, 0, darken(hexOf(c), 0.7)));
    g.push(bx(0.025, 1.8, 0.03, 0, 0.1, D / 2 + 0.01, DARK));
    g.push(bx(0.05, 0.3, 0.05, -0.1, 0.9, D / 2 + 0.03, 0xe0b020), bx(0.05, 0.3, 0.05, 0.1, 0.9, D / 2 + 0.03, 0xe0b020));
    g.push(bx(W, 0.1, D, 0, 0, 0, darken(hexOf(c), 0.6)));
    return g;
  },
  sofa(c, w, d) {
    const W = w * 0.96, D = d * 0.92, col = hexOf(c), g = [];
    g.push(bx(W, 0.34, D, 0, 0.08, 0, col), bx(W, 0.1, D, 0, 0, 0, DARK));
    g.push(bx(W, 0.55, 0.22, 0, 0.34, -D / 2 + 0.11, darken(col, 0.9)));
    for (const s of [-1, 1]) g.push(bx(0.2, 0.28, D, s * (W / 2 - 0.1), 0.34, 0, darken(col, 0.85)));
    const n = Math.max(1, Math.round(w));
    for (let i = 0; i < n; i++) g.push(bx((W - 0.45) / n - 0.04, 0.12, D - 0.3, -((W - 0.45) / 2) + ((W - 0.45) / n) * (i + 0.5), 0.42, 0.05, lighten(col, 0.12)));
    g.push(bx(0.42, 0.4, 0.14, W / 2 - 0.45, 0.46, -D / 2 + 0.34, 0xe0a020, PAT.ANKARA, -0.3));
    return g;
  },
  tvstand(c, w, d, withTv = true) {
    const W = w * 0.95, D = d * 0.7, g = [];
    g.push(bx(W, 0.5, D, 0, 0, 0, hexOf(c), PAT.WOOD), bx(W - 0.12, 0.05, D - 0.1, 0, 0.5, 0, darken(hexOf(c), 0.7)));
    g.push(bx(0.4, 0.06, 0.3, 0, 0.55, 0, DARK));
    g.push(...B.tv(null, W * 0.85, D, 0.58));
    return withTv ? g : g.slice(0, 3);
  },
  tv(c, w, d, y = 0.0) {
    const W = Math.min(w * 0.95, 1.5), H = W * 0.56, g = [];
    g.push(bx(W, H, 0.07, 0, y + 0.12, 0, DARK));
    g.push(bx(W - 0.08, H - 0.08, 0.02, 0, y + 0.16, 0.04, 0x1d6b3a, PAT.SCREEN));
    g.push(bx(0.5, 0.12, 0.3, 0, y, 0, DARK));
    return g;
  },
  rug(c, w, d) { const col = hexOf(c); return [bx(w * 0.98, 0.04, d * 0.98, 0, 0, 0, darken(col, 0.8), PAT.RUG), bx(w * 0.8, 0.045, d * 0.78, 0, 0, 0, col, PAT.RUG)]; },
  table(c, w, d, h = 0.45) {
    const W = w * 0.9, D = d * 0.9, col = hexOf(c), g = [];
    g.push(bx(W, 0.07, D, 0, h, 0, col, PAT.WOOD));
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.push(bx(0.08, h, 0.08, x * (W / 2 - 0.08), 0, z * (D / 2 - 0.08), darken(col, 0.7)));
    return g;
  },
  dining(c, w, d) {
    const g = B.table(c, w * 0.65, d * 0.7, 0.75), plastic = 0xd33a2a;
    for (const [x, z] of [[-0.55, d * 0.42], [0.55, d * 0.42], [-0.55, -d * 0.42], [0.55, -d * 0.42]]) {
      g.push(bx(0.42, 0.06, 0.42, x, 0.45, z, plastic), bx(0.42, 0.4, 0.06, x, 0.5, z + (z > 0 ? 0.18 : -0.18), plastic));
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.push(bx(0.05, 0.45, 0.05, x + lx * 0.17, 0, z + lz * 0.17, METAL));
    }
    return g;
  },
  cooker(c, w, d) {
    const W = w * 0.9, D = d * 0.9, g = [];
    g.push(bx(W, 0.85, D, 0, 0, 0, hexOf(c)), bx(W, 0.04, D, 0, 0.85, 0, DARK));
    for (const [x, z] of [[-0.2, -0.3], [0.2, -0.3], [-0.2, 0.3], [0.2, 0.3]].map(([a, b]) => [a * W, b * D])) g.push(cy(0.09, 0.09, 0.03, x, 0.89, z, 0x303030));
    g.push(bx(W * 0.75, 0.4, 0.03, 0, 0.18, D / 2 + 0.01, DARK, PAT.GLASS));
    for (let i = 0; i < 4; i++) g.push(cy(0.03, 0.03, 0.04, (i - 1.5) * 0.17 * W, 0.68, D / 2 + 0.02, 0xe0e0e0, 0, 8, Math.PI / 2));
    return g;
  },
  fridge(c, w, d) {
    const col = hexOf(c), g = [];
    g.push(bx(0.84, 1.75, 0.78, 0, 0, 0, col), bx(0.86, 0.02, 0.8, 0, 0.62, 0, darken(col, 0.6)));
    g.push(bx(0.04, 0.4, 0.04, 0.3, 1.05, 0.4, METAL), bx(0.04, 0.5, 0.04, 0.3, 0.1, 0.4, METAL));
    return g;
  },
  microwave(c) { return [bx(0.8, 0.45, 0.6, 0, 0, 0, DARK), bx(0.5, 0.3, 0.02, -0.1, 0.08, 0.31, 0x2a3a46, PAT.GLASS), bx(0.14, 0.34, 0.02, 0.28, 0.06, 0.31, 0x555a60)]; },
  dispenser(c) { const col = hexOf(c); return [bx(0.4, 1.0, 0.4, 0, 0, 0, col), bx(0.34, 0.06, 0.2, 0, 0.7, 0.2, DARK), cy(0.17, 0.17, 0.48, 0, 1.0, 0, 0x5aa9e6, PAT.GLASS, 12)]; },
  generator(c, w, d) {
    const col = hexOf(c), W = w * 0.9, g = [];
    g.push(bx(W, 0.1, 0.7, 0, 0.12, 0, DARK));
    g.push(bx(W, 0.55, 0.62, 0, 0.2, 0, DARK), bx(W * 0.55, 0.3, 0.66, -W * 0.18, 0.28, 0, col), bx(W * 0.4, 0.28, 0.5, W * 0.25, 0.75, 0, col));
    for (const s of [-1, 1]) g.push(bx(0.05, 0.7, 0.05, s * W * 0.46, 0.2, 0.3, METAL), cy(0.12, 0.12, 0.08, s * W * 0.4, 0, 0.36, DARK, 0, 10, Math.PI / 2));
    g.push(bx(W * 0.9, 0.04, 0.04, 0, 0.9, 0.3, METAL));
    return g;
  },
  fan(c) {
    const col = hexOf(c), g = [];
    g.push(cy(0.28, 0.32, 0.07, 0, 0, 0, 0x30343a, 0, 14), cy(0.035, 0.035, 1.0, 0, 0.07, 0, col));
    g.push(cy(0.11, 0.11, 0.2, 0, 1.0, -0.05, 0x30343a, 0, 10, Math.PI / 2));
    g.push(cy(0.3, 0.3, 0.03, 0, 1.1, 0.12, METAL, PAT.GLASS, 18, Math.PI / 2));
    for (let i = 0; i < 3; i++) g.push(bx(0.5, 0.02, 0.12, 0, 1.1, 0.1, 0x6aa8d8, 0, 0, 0, (i * Math.PI) / 3 + 0.4));
    return g;
  },
  ac(c) { const col = hexOf(c), g = [bx(0.9, 0.34, 0.26, 0, 1.3, 0, col), bx(0.8, 0.04, 0.02, 0, 1.36, 0.14, DARK), bx(0.8, 0.04, 0.02, 0, 1.28, 0.14, DARK), bx(0.8, 0.04, 0.02, 0, 1.2, 0.14, DARK), bx(0.08, 1.3, 0.08, -0.35, 0, 0, METAL), bx(0.08, 1.3, 0.08, 0.35, 0, 0, METAL)]; return g; },
  solar(c, w) { const W = w * 0.9; return [bx(W, 0.05, 0.9, 0, 0.7, 0, 0x1d2b5e, PAT.GLASS, -0.7), bx(0.05, 0.75, 0.05, -W * 0.4, 0, 0.1, METAL), bx(0.05, 0.75, 0.05, W * 0.4, 0, 0.1, METAL), bx(W, 0.04, 0.04, 0, 0.7, 0.3, 0xdadada, 0, -0.7)]; },
  plant(c, large) {
    const col = hexOf(c), s = large ? 1.35 : 1, g = [cy(0.26, 0.2, 0.4, 0, 0, 0, 0xb4532a, PAT.CONCRETE, 10), cy(0.24, 0.24, 0.03, 0, 0.4, 0, 0x4a3322)];
    const leaves = [[0, 0.95, 0, 0.34], [0.2, 0.75, 0.08, 0.26], [-0.18, 0.8, -0.1, 0.28], [0.05, 1.2, 0.05, 0.22], [-0.1, 0.62, 0.18, 0.22]];
    for (const [x, y, z, r] of leaves) g.push(sp(r * s, x * s, y * s, z * s, (hexOf(c) & 0xfefefe) >> 0, PAT.GRASS, 1));
    g.push(cy(0.025, 0.03, 0.55 * s, 0, 0.4, 0, 0x5a3b22));
    return g;
  },
  painting(c, w, d) {
    const col = hexOf(c), g = [bx(0.9, 0.06, 0.08, 0, 0.0, 0, DARK)];
    g.push(bx(0.05, 1.2, 0.05, -0.34, 0, 0, darken(col, 0.8)), bx(0.05, 1.2, 0.05, 0.34, 0, 0, darken(col, 0.8)));
    g.push(bx(0.8, 0.65, 0.05, 0, 0.55, 0.05, col), bx(0.68, 0.53, 0.04, 0, 0.6, 0.09, 0xf0b040, PAT.ANKARA));
    return g;
  },
  frame(c) { const col = hexOf(c); return [bx(0.5, 0.45, 0.5, 0, 0, 0, darken(col, 0.8), PAT.WOOD), bx(0.3, 0.38, 0.04, 0, 0.45, 0, col), bx(0.24, 0.3, 0.05, 0, 0.49, 0.01, 0x9fc2d9, PAT.GLASS)]; },
  prayer(c) { const col = hexOf(c); return [bx(0.8, 0.03, 1.8, 0, 0, 0, col, PAT.RUG), bx(0.6, 0.035, 1.55, 0, 0, 0, lighten(col, 0.1), PAT.RUG)]; },
  trophy() { return [bx(0.4, 0.14, 0.4, 0, 0, 0, DARK), cy(0.04, 0.04, 0.22, 0, 0.14, 0, 0xe0b020), cy(0.2, 0.08, 0.3, 0, 0.36, 0, 0xf2b134, 0, 12), cy(0.17, 0.17, 0.02, 0, 0.66, 0, 0xffd96a, 0, 12)]; },
  gate(c) { const col = hexOf(c), g = [bx(0.2, 2.4, 0.2, -0.45, 0, 0, 0x6b6f75, PAT.BLOCK), bx(0.2, 2.4, 0.2, 0.45, 0, 0, 0x6b6f75, PAT.BLOCK)]; for (let i = 0; i < 6; i++) g.push(bx(0.05, 2.0, 0.05, -0.32 + i * 0.128, 0.1, 0, col)); g.push(bx(0.8, 0.07, 0.07, 0, 0.4, 0, col), bx(0.8, 0.07, 0.07, 0, 1.6, 0, col)); return g; },
  palm() {
    const g = [cy(0.1, 0.17, 3.4, 0, 0, 0, 0x8b5a2b, PAT.CONCRETE, 8)];
    for (let i = 0; i < 7; i++) g.push(bx(0.34, 0.04, 1.6, 0, 3.35, 0, 0x2f8a3a, PAT.GRASS, 0.45, (i * Math.PI * 2) / 7, 0).translate(Math.sin((i * Math.PI * 2) / 7) * 0.7, 0, Math.cos((i * Math.PI * 2) / 7) * 0.7));
    g.push(sp(0.12, 0.12, 3.25, 0.05, 0x7a5a1a, 0), sp(0.12, -0.1, 3.2, -0.08, 0x7a5a1a, 0));
    return g;
  },
  seclight() { return [cy(0.035, 0.045, 2.6, 0, 0, 0, 0x4a4f55), bx(0.4, 0.12, 0.22, 0, 2.55, 0.1, 0x30343a), bx(0.34, 0.04, 0.18, 0, 2.5, 0.1, 0xfff0b0, PAT.GLOW), bx(0.3, 0.1, 0.3, 0, 0, 0, 0x6b6f75, PAT.CONCRETE)]; },
  carport(c, w, d) {
    const col = hexOf(c), W = w * 0.96, D = d * 0.96, g = [bx(W, 0.1, D, 0, 2.3, 0, col, PAT.ZINC, 0, 0, 0.06)];
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.push(bx(0.1, 2.3, 0.1, x * (W / 2 - 0.1), 0, z * (D / 2 - 0.1), 0x4a4f55));
    return g;
  },
  shower(c) {
    const g = [bx(0.9, 0.08, 0.9, 0, 0, 0, 0xdedede, PAT.TILES)];
    g.push(bx(0.9, 1.9, 0.03, 0, 0.08, 0.43, 0x9fc9d9, PAT.GLASS), bx(0.03, 1.9, 0.9, -0.43, 0.08, 0, 0x9fc9d9, PAT.GLASS));
    g.push(cy(0.025, 0.025, 1.6, 0.38, 0.4, -0.38, METAL), bx(0.3, 0.04, 0.04, 0.26, 1.98, -0.38, METAL), cy(0.1, 0.1, 0.04, 0.12, 1.92, -0.38, METAL));
    return g;
  },
  toilet(c) { const col = hexOf(c); return [bx(0.4, 0.18, 0.5, 0, 0, 0.06, col), bx(0.36, 0.1, 0.4, 0, 0.18, 0.06, 0xdedede), bx(0.42, 0.45, 0.17, 0, 0.0, -0.3, col), bx(0.28, 0.04, 0.34, 0, 0.28, 0.08, 0xcfcfcf)]; },
};

// footprint helper: builders are authored around the centre of their w x d footprint.
const MAP = {
  bed_single: (c, w, d) => B.bed(c, w, d, false), bed_double: (c, w, d) => B.bed(c, w, d, true), mattress: B.mattress, wardrobe: B.wardrobe,
  sofa_3seater: B.sofa, sofa_2seater: B.sofa, tv_stand: (c, w, d) => B.tvstand(c, w, d, true), tv_32: (c, w, d) => B.tv(c, w, d, 0.0),
  rug_large: B.rug, center_table: (c, w, d) => B.table(c, w, d, 0.45), gas_cooker: B.cooker, fridge: B.fridge, microwave: B.microwave,
  dining_table: B.dining, water_dispenser: B.dispenser, generator: B.generator, standing_fan: B.fan, ac_unit: B.ac, solar_panel: B.solar,
  plant_small: (c) => B.plant(c, false), plant_large: (c) => B.plant(c, true), painting: B.painting, photo_frame: B.frame, prayer_mat: B.prayer,
  trophy: B.trophy, gate: B.gate, palm_tree: B.palm, security_light: B.seclight, car_park: B.carport, shower: B.shower, toilet: B.toilet,
};

/** Build one furniture piece (a THREE.Group with a single merged mesh). Falls back to a plain box for unknown ids. */
export function buildProp(item, color) {
  const c = color || item.colors[0];
  const w = item.w, d = item.d;
  let geos;
  try { geos = (MAP[item.id] || ((cc, ww, dd) => [bx(ww * 0.8, 0.6, dd * 0.8, 0, 0, 0, hexOf(cc))]))(c, w, d); } catch (e) { console.warn("[art] prop failed", item.id, e); geos = [bx(w * 0.8, 0.6, d * 0.8, 0, 0, 0, hexOf(c))]; }
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  const mesh = new THREE.Mesh(merged, styledMaterial("interior"));
  mesh.castShadow = false; mesh.receiveShadow = false;
  const group = new THREE.Group(); group.add(mesh);
  return group;
}
