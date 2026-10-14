// src/art/geo.js — tiny geometry kit. Every shape gets the SAME attributes
// (position, normal, uv, color, aPat) so any of them can be merged into one mesh.
import * as THREE from "three";

function finish(g, color, pat) {
  const c = new THREE.Color(color), n = g.attributes.position.count;
  const col = new Float32Array(n * 3), p = new Float32Array(n).fill(pat);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aPat", new THREE.BufferAttribute(p, 1));
  if (!g.index) { /* make everything indexed so merges never mix indexed + non-indexed */
    const idx = []; for (let i = 0; i < n; i++) idx.push(i); g.setIndex(idx);
  }
  return g;
}
const place = (g, x, y, z, rx = 0, ry = 0, rz = 0) => {
  if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz);
  g.translate(x, y, z); return g;
};
/** centre-x, BOTTOM-y, centre-z box (y is the bottom edge so stacking is easy) */
export const bx = (w, h, d, x, y, z, color, pat = 0, rx = 0, ry = 0, rz = 0) => finish(place(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), x, y, z, rx, ry, rz), color, pat);
export const cy = (rt, rb, h, x, y, z, color, pat = 0, seg = 10, rx = 0, ry = 0, rz = 0) => finish(place(new THREE.CylinderGeometry(rt, rb, h, seg).translate(0, h / 2, 0), x, y, z, rx, ry, rz), color, pat);
export const sp = (r, x, y, z, color, pat = 0, detail = 1) => finish(new THREE.IcosahedronGeometry(r, detail).translate(x, y, z), color, pat);
export const cone = (r, h, x, y, z, color, pat = 0, seg = 8) => finish(new THREE.ConeGeometry(r, h, seg).translate(x, y + h / 2, z), color, pat);
export const darken = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();
export const lighten = (hex, k) => new THREE.Color(hex).lerp(new THREE.Color(0xffffff), k).getHex();
