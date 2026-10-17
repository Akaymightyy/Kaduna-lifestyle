// src/places/home_layout.js — room layouts for the player's home, by tier (house size follows the budget).
//   1 Room (one room) · 2 1-Bed flat · 3 3-Bed bungalow · 4 Duplex · 5 Mansion · 6 Private Estate
// Coordinates are centred on the house (x: -W/2..W/2, z: -D/2..D/2), the front door is on +Z in the middle.
// Returns rooms (floors) + partition walls (with door gaps) + colliders + light spots.
const FLOOR = { living: 0xe4e1da, bed: 0xb9925f, bath: 0x9fc4d8, kitchen: 0xd9b88a, dining: 0xcfc6b4, study: 0xa88a62, master: 0xc2a074, lobby: 0xdedbd2 };
const GAP = 1.9, T = 0.18;

// backFr: widths of the rooms along the back (left -> right); frontSplit: where the front is divided (kitchen / dining on the right)
const PLAN = {
  2: { back: 4,   rooms: [["bed", 0.6], ["bath", 0.4]],                                   front: [["living", 1]] },
  3: { back: 5,   rooms: [["bed", 0.28], ["bed", 0.28], ["bed", 0.26], ["bath", 0.18]],   front: [["living", 0.62], ["kitchen", 0.38]] },
  4: { back: 6,   rooms: [["bed", 0.26], ["bed", 0.26], ["master", 0.3], ["bath", 0.18]], front: [["living", 0.6], ["kitchen", 0.4]] },
  5: { back: 6.5, rooms: [["bed", 0.18], ["bath", 0.1], ["master", 0.3], ["bath", 0.1], ["bed", 0.18], ["study", 0.14]], front: [["living", 0.5], ["dining", 0.2], ["kitchen", 0.3]] },
  6: { back: 8,   rooms: [["bed", 0.15], ["bath", 0.09], ["bed", 0.15], ["master", 0.25], ["bath", 0.09], ["study", 0.13], ["bed", 0.14]], front: [["living", 0.46], ["dining", 0.22], ["kitchen", 0.32]] },
};

export function homeLayout(tier, W, D) {
  const HW = W / 2, HD = D / 2, out = { floors: [], walls: [], colliders: [], lights: [], rooms: [] };
  const plan = PLAN[tier];
  if (!plan) { out.floors.push({ x: 0, z: 0, w: W, d: D, color: null, kind: "single" }); out.lights.push({ x: 0, z: 0 }); return out; }

  const zb = -HD + plan.back;                      // z of the wall between the back rooms and the front hall
  const wall = (x0, z0, x1, z1) => { out.walls.push({ x0, z0, x1, z1 }); out.colliders.push({ minX: Math.min(x0, x1) - T / 2, maxX: Math.max(x0, x1) + T / 2, minZ: Math.min(z0, z1) - T / 2, maxZ: Math.max(z0, z1) + T / 2 }); };
  const hwall = (z, x0, x1, gapsAt) => {           // horizontal wall with door gaps at the given x centres
    let cur = x0; for (const g of gapsAt.slice().sort((a, b) => a - b)) { if (g - GAP / 2 > cur) wall(cur, z, g - GAP / 2, z); cur = g + GAP / 2; }
    if (x1 > cur) wall(cur, z, x1, z);
  };
  const vwall = (x, z0, z1, gapsAt) => { let cur = z0; for (const g of gapsAt.slice().sort((a, b) => a - b)) { if (g - GAP / 2 > cur) wall(x, cur, x, g - GAP / 2); cur = g + GAP / 2; } if (z1 > cur) wall(x, cur, x, z1); };

  // ---- back rooms ----
  const total = plan.rooms.reduce((s, r) => s + r[1], 0); let x = -HW; const doors = [];
  plan.rooms.forEach(([kind, fr], i) => {
    const w = (fr / total) * W, cx = x + w / 2;
    out.floors.push({ x: cx, z: (-HD + zb) / 2, w, d: plan.back, color: FLOOR[kind], kind });
    out.rooms.push({ kind, x: cx, z: (-HD + zb) / 2, w, d: plan.back });
    doors.push(cx);
    if (i < plan.rooms.length - 1) vwall(x + w, -HD, zb, []);
    x += w;
  });
  hwall(zb, -HW, HW, doors);

  // ---- front rooms (the hall / living side) ----
  const ft = plan.front.reduce((s, r) => s + r[1], 0), fd = HD - zb; x = -HW;
  // the front door is in the middle of the front wall, so the first split sits right of the door
  plan.front.forEach(([kind, fr], i) => {
    let w = (fr / ft) * W; if (i === 0 && plan.front.length > 1) w = Math.max(w, HW + 2.4);
    if (i === plan.front.length - 1) w = HW - x;
    const cx = x + w / 2;
    out.floors.push({ x: cx, z: (zb + HD) / 2, w, d: fd, color: FLOOR[kind], kind });
    out.rooms.push({ kind, x: cx, z: (zb + HD) / 2, w, d: fd });
    if (i < plan.front.length - 1) vwall(x + w, zb, HD, [zb + fd * 0.45]);
    x += w;
  });
  if (tier >= 4) out.patio = { x: 0, z: HD + 1.6, w: W * 0.8, d: 3 };

  // lights: one per room (biggest 5 so the phone GPU does not suffer)
  out.lights = out.rooms.slice().sort((a, b) => b.w * b.d - a.w * a.d).slice(0, 5).map(r => ({ x: r.x, z: r.z }));
  return out;
}
