// Visible buildings / gates for every enterable place, placed at the REAL entrance from registry.js.
// (Before, only a floating sign + post existed, and at the wrong coordinates.)
import * as THREE from "three";
import { listPlaces } from "./registry.js";
import { labelTexture } from "../world.js";

const SKIP = new Set(["home"]);               // houses are plots, not a shop building
const STYLE = {                                // [width, height, depth, wall colour]
  central_market: [18, 9, 10, 0xd9b38a], suya_spot: [10, 4.5, 7, 0xb5651d], central_mosque: [16, 12, 12, 0xf1ece0],
  kawo_park: [14, 6, 8, 0xf2b134], university: [20, 12, 10, 0x9fb7d1], mall_cinema: [22, 13, 12, 0xc9a9d8],
  hospital: [20, 12, 10, 0xeef3f6], bank: [14, 10, 10, 0xb9d9c4], stadium: [18, 8, 8, 0x8fc79f],
  river_park: [12, 5, 6, 0x9fd8f0], church: [14, 12, 12, 0xf3e6c8], barber: [8, 5, 7, 0x4a4a62],
  nightclub: [12, 7, 10, 0x4a2a6a], dealership: [20, 7, 12, 0xe8e8ec], arena: [16, 8, 10, 0xd8c067],
};
const OUTDOOR = new Set(["kawo_park", "university", "stadium", "river_park", "suya_spot"]);

export function buildPlaceExteriors(world, colliders) {
  const lam = (c, extra) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, extra || {}));
  let n = 0;
  for (const def of listPlaces()) {
    if (SKIP.has(def.id) || def.entranceX == null) continue;
    try {
      const st = STYLE[def.id] || [14, 8, 9, 0xcfc5b0];
      const [W, H, D, col] = st;
      const h = def.entranceZ >= 0 ? 0 : Math.PI;   // building sits BEHIND the entrance, away from the main street (z=0)
      const fx = Math.sin(h), fz = Math.cos(h);
      const g = new THREE.Group();
      g.position.set(def.entranceX + fx * (D / 2 + 2.2), 0, def.entranceZ + fz * (D / 2 + 2.2));
      g.rotation.y = h;                         // local +z = away from the entrance, local -z = the front face
      const box = (w, hh, d, c, x, y, z, extra) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), lam(c, extra)); m.position.set(x, y, z); g.add(m); return m; };
      if (OUTDOOR.has(def.id)) {
        // gate arch + low wall with a big name board
        box(W, 0.9, 0.6, col, 0, 0.45, -D / 2);
        box(0.9, H, 0.9, col, -W / 2, H / 2, -D / 2); box(0.9, H, 0.9, col, W / 2, H / 2, -D / 2);
        box(W + 0.9, 1.0, 1.0, col, 0, H + 0.2, -D / 2);
        box(W * 0.5, H - 1.2, 0.5, 0x2a2f36, 0, (H - 1.2) / 2 + 0.3, -D / 2 + 1.6, { transparent: true, opacity: 0.0 }); // invisible walk-through
        g.userData.noCollide = true;
      } else {
        box(W, H, D, col, 0, H / 2, 0);                                   // body
        box(W + 0.6, 0.5, D + 0.6, 0xb5a68b, 0, H + 0.25, 0);             // parapet
        box(W + 0.7, 0.3, D + 0.7, 0x8c9399, 0, H + 0.65, 0);             // roof sheet
        box(W + 1.0, 0.7, D + 1.0, 0x8a8478, 0, 0.35, 0);                 // plinth
        box(W * 0.9, 0.25, 2.2, 0xc0392b, 0, 3.4, -D / 2 - 1.0);          // awning
        box(2.6, 3.2, 0.3, 0x3b2a1e, 0, 1.6, -D / 2 - 0.05);              // door frame
        box(2.2, 2.9, 0.35, 0x7ec8ff, 0, 1.55, -D / 2 - 0.1, { emissive: 0x1a3a55 }); // glass door
        const rows = Math.max(1, Math.floor((H - 4.2) / 3.2)), cols = Math.max(2, Math.floor(W / 4));
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const x = (c - (cols - 1) / 2) * (W / cols);
          if (r === 0 && Math.abs(x) < 2.2 && false) continue;
          box(1.6, 1.5, 0.2, 0x7ec8ff, x, 4.6 + r * 3.2, -D / 2 - 0.05, { emissive: 0x0f2a40 });
        }
        colliders && colliders.push({ minX: g.position.x - (Math.abs(fz) > 0.5 ? W : D) / 2, maxX: g.position.x + (Math.abs(fz) > 0.5 ? W : D) / 2,
                                      minZ: g.position.z - (Math.abs(fz) > 0.5 ? D : W) / 2, maxZ: g.position.z + (Math.abs(fz) > 0.5 ? D : W) / 2 });
      }
      // big name board above the door (faces -z, i.e. the player)
      const bg = "#" + (def.minimapColor != null ? def.minimapColor : 0x0f4d3a).toString(16).padStart(6, "0");
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(W - 1, 9), 1.6), new THREE.MeshBasicMaterial({ map: labelTexture((def.name || def.id).toUpperCase(), 512, 96, bg, "#ffffff", 40) }));
      sign.rotation.y = Math.PI; sign.position.set(0, OUTDOOR.has(def.id) ? H + 1.6 : 4.9 + (H > 8 ? 0 : -0.8), -D / 2 - 0.25 - (OUTDOOR.has(def.id) ? 0.4 : 0));
      g.add(sign);
      world.add(g); n++;
    } catch (e) { console.warn("exterior failed", def.id, e); }
  }
  return n;
}
