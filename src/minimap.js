import { WORLD_HALF_X, ROAD_HALF, SIDE_STREETS } from "./config.js";

// Pre-baked top-down map (2 px per metre), redrawn rotated around the player ~10x/second.
export function createMinimap(canvas, shapes) {
  const S = 2, W = (WORLD_HALF_X + 40) * 2 * S, H = 150 * S;
  const base = document.createElement("canvas"); base.width = W; base.height = H;
  const g = base.getContext("2d");
  const X = (x) => (x + WORLD_HALF_X + 40) * S, Z = (z) => (z + 75) * S;
  g.fillStyle = "#b9cf8a"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#cdbb98"; g.fillRect(0, Z(-ROAD_HALF - 6), W, 12 * S + 16 * S);
  g.fillStyle = "#555a62"; g.fillRect(0, Z(-ROAD_HALF), W, ROAD_HALF * 2 * S);
  for (const sx of SIDE_STREETS) g.fillRect(X(sx - 6), 0, 12 * S, H);
  g.fillStyle = "#6fae52"; g.fillRect(0, Z(-1), W, 2 * S);
  g.strokeStyle = "#fff"; g.lineWidth = 1; g.setLineDash([6, 8]);
  for (const z of [4.5, -4.5]) { g.beginPath(); g.moveTo(0, Z(z)); g.lineTo(W, Z(z)); g.stroke(); }
  g.setLineDash([]);
  for (const b of shapes.buildings) { g.fillStyle = b.landmark ? "#2c8a63" : "#8f7a5e"; g.fillRect(X(b.x - b.w / 2), Z(b.z - b.d / 2), b.w * S, b.d * S); }
  g.fillStyle = "#3f8f3a"; for (const t of shapes.trees) { g.beginPath(); g.arc(X(t.x), Z(t.z), 2.2 * S, 0, 7); g.fill(); }
  const ctx = canvas.getContext("2d");
  const size = canvas.width, range = 52; // metres visible from centre to edge
  return function draw(px, pz, yaw, heading, cars) {
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(yaw + Math.PI);                       // camera forward = up on the map
    const sc = size / (range * 2) ;
    ctx.scale(sc / S, sc / S);
    ctx.translate(-X(px), -Z(pz));
    ctx.drawImage(base, 0, 0);
    ctx.fillStyle = "#f2b134";
    for (const c of cars) { if (Math.abs(c.x - px) < range * 1.5 && Math.abs(c.z - pz) < range * 1.5) ctx.fillRect(X(c.x) - 2.5 * S / 2, Z(c.z) - 1, 5 * S / 2 * 1.6, 2 * S / 1.4); }
    ctx.translate(X(px), Z(pz)); ctx.rotate(Math.PI - heading); ctx.scale(S / sc, S / sc);
    ctx.fillStyle = "#ff6a3d"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, 9); ctx.lineTo(0, 4); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  };
}
