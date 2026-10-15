import { WORLD_HALF_X, ROAD_HALF, SIDE_STREETS, WIDE_AVENUES_X, WIDE_CROSS_Z, MAP_HALF_X, MAP_HALF_Z } from "./config.js";
import { AREAS } from "./areas.js";

// Pre-baked top-down map (2 px per metre), redrawn rotated around the player ~10x/second.
export function createMinimap(canvas, shapes) {
  const S = 2, W = MAP_HALF_X * 2 * S, H = MAP_HALF_Z * 2 * S;
  const base = document.createElement("canvas"); base.width = W; base.height = H;
  const g = base.getContext("2d");
  const X = (x) => (x + MAP_HALF_X) * S, Z = (z) => (z + MAP_HALF_Z) * S;
  g.fillStyle = "#b9cf8a"; g.fillRect(0, 0, W, H);

  // Draw real roads from kaduna.json if available
  if (shapes.roads && shapes.roads.length) {
    for (const road of shapes.roads) {
      const width = (road.width || 8) * S;
      const color = road.type === "primary" ? "#555a62" : road.type === "secondary" ? "#5a5f66" : road.type === "tertiary" ? "#6a6a6a" : "#7a7a7a";
      g.strokeStyle = color; g.lineWidth = width; g.lineCap = "round"; g.lineJoin = "round";
      g.beginPath();
      for (let i = 0; i < road.points.length; i++) {
        const [x, z] = road.points[i];
        if (i === 0) g.moveTo(X(x), Z(z)); else g.lineTo(X(x), Z(z));
      }
      g.stroke();
    }
    // Dashed center line on primary roads
    g.strokeStyle = "#fff"; g.lineWidth = 1; g.setLineDash([4, 4]);
    for (const road of shapes.roads) {
      if (road.type !== "primary") continue;
      g.beginPath();
      for (let i = 0; i < road.points.length; i++) {
        const [x, z] = road.points[i];
        if (i === 0) g.moveTo(X(x), Z(z)); else g.lineTo(X(x), Z(z));
      }
      g.stroke();
    }
    g.setLineDash([]);
  } else {
    // Fallback: procedural road
    g.fillStyle = "#cdbb98"; g.fillRect(0, Z(-ROAD_HALF - 6), W, 12 * S + 16 * S);
    g.fillStyle = "#555a62"; g.fillRect(0, Z(-ROAD_HALF), W, ROAD_HALF * 2 * S);
    for (const sx of SIDE_STREETS) g.fillRect(X(sx - 6), 0, 12 * S, H);
    g.fillStyle = "#6fae52"; g.fillRect(0, Z(-1), W, 2 * S);
    g.strokeStyle = "#fff"; g.lineWidth = 1; g.setLineDash([6, 8]);
    for (const z of [4.5, -4.5]) { g.beginPath(); g.moveTo(0, Z(z)); g.lineTo(W, Z(z)); g.stroke(); }
    g.setLineDash([]);
  }

  // wide-city avenues + cross streets + district blocks (drawn once into the pre-baked map)
  g.fillStyle = "#555a62";
  for (const ax of WIDE_AVENUES_X) g.fillRect(X(ax - 5), 0, 10 * S, H);
  for (const cz of WIDE_CROSS_Z) g.fillRect(0, Z(cz - 5), W, 10 * S);
  for (const a of AREAS) {
    g.fillStyle = a.tier === "rich" ? "#e6d49a" : a.tier === "middle" ? "#b7d3a0" : "#d3c19a";
    g.fillRect(X(a.x - 44), Z(a.z - 40), 88 * S, 96 * S);
    g.fillStyle = "#33413a"; g.font = "bold " + (9 * S) + "px Arial"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(a.name, X(a.x), Z(a.z));
  }
  for (const b of shapes.buildings) {
    if (b.place) {
      g.fillStyle = "#" + (b.placeColor || 0xc0392b).toString(16).padStart(6, "0");
      g.beginPath();
      g.arc(X(b.x), Z(b.z), 4.5 * S, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#fff";
      g.lineWidth = 1.5;
      g.stroke();
    } else {
      g.fillStyle = b.landmark ? "#2c8a63" : "#8f7a5e";
      g.fillRect(X(b.x - b.w / 2), Z(b.z - b.d / 2), b.w * S, b.d * S);
    }
  }
  g.fillStyle = "#3f8f3a"; for (const t of shapes.trees) { g.beginPath(); g.arc(X(t.x), Z(t.z), 2.2 * S, 0, 7); g.fill(); }
  const ctx = canvas.getContext("2d");
  const size = canvas.width, range = 52;
  return function draw(px, pz, yaw, heading, cars) {
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(yaw + Math.PI);
    const sc = size / (range * 2);
    ctx.scale(sc / S, sc / S);
    ctx.translate(-X(px), -Z(pz));
    ctx.drawImage(base, 0, 0);
    ctx.fillStyle = "#f2b134";
    for (const c of cars) { if (Math.abs(c.x - px) < range * 1.5 && Math.abs(c.z - pz) < range * 1.5) ctx.fillRect(X(c.x) - 2.5 * S / 2, Z(c.z) - 1, 5 * S / 2 * 1.6, 2 * S / 1.4); }
    // ---- Draw "My Home" marker if the player has a home ----
    if (window._myHomePos) {
      const hx = X(window._myHomePos.x), hz = Z(window._myHomePos.z);
      // Only draw if within a reasonable range of the minimap view
      if (Math.abs(window._myHomePos.x - px) < range * 2 && Math.abs(window._myHomePos.z - pz) < range * 2) {
        ctx.fillStyle = "#2e7d4f";
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hx, hz, 5 * S, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // House emoji label
        ctx.fillStyle = "#fff";
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🏠", hx, hz);
      }
    }
    ctx.translate(X(px), Z(pz)); ctx.rotate(Math.PI - heading); ctx.scale(S / sc, S / sc);
    ctx.fillStyle = "#ff6a3d"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, 9); ctx.lineTo(0, 4); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  };
}
