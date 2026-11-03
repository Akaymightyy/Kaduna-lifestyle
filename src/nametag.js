import * as THREE from "three";
// NAME TAG (Nov 3): soft white pill with the name in bold dark text + a small green role badge ("Visitor" / "Resident"),
// like the hostel-gist style. Sized to its text; the sprite is scaled to the canvas aspect so it never stretches.
export function makeNameTag(name, badge) {
  name = String(name || "Player").slice(0, 18);
  badge = badge || "Visitor";
  const S = 2, H = 52 * S, padX = 20 * S, gap = 10 * S;
  const m = document.createElement("canvas").getContext("2d");
  m.font = `700 ${24 * S}px Poppins, "DM Sans", Arial, sans-serif`; const nw = m.measureText(name).width;
  m.font = `700 ${13 * S}px Poppins, "DM Sans", Arial, sans-serif`; const bt = m.measureText(badge).width, bw = bt + 16 * S;
  const W = Math.ceil(padX * 2 + nw + gap + bw);
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  ctx.shadowColor = "rgba(0,0,0,.28)"; ctx.shadowBlur = 5 * S; ctx.shadowOffsetY = 1.5 * S;
  ctx.fillStyle = "rgba(244,249,251,0.96)"; rr(3 * S, 3 * S, W - 6 * S, H - 8 * S, (H - 8 * S) / 2); ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.textBaseline = "middle"; ctx.textAlign = "left";
  const cy = (H - 4 * S) / 2;
  ctx.fillStyle = "#14233a"; ctx.font = `700 ${24 * S}px Poppins, "DM Sans", Arial, sans-serif`; ctx.fillText(name, padX, cy + 1);
  const bx = padX + nw + gap, bh = 22 * S;
  ctx.fillStyle = "#c9ecb0"; rr(bx, cy - bh / 2, bw, bh, bh / 2); ctx.fill();
  ctx.strokeStyle = "#8fcf6a"; ctx.lineWidth = 1.2 * S; ctx.stroke();
  ctx.fillStyle = "#1f5a22"; ctx.font = `700 ${13 * S}px Poppins, "DM Sans", Arial, sans-serif`; ctx.textAlign = "center"; ctx.fillText(badge, bx + bw / 2, cy + 1);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  tex.userData = { aspect: W / H };
  return tex;
}
export const tagScale = (sp, tex, h = 0.36) => sp.scale.set(h * tex.userData.aspect, h, 1);
if (typeof window !== "undefined") window.__makeNameTag = makeNameTag;   // debug / previews
