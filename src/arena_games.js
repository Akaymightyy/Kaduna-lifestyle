// src/arena_games.js — solo mini-games played inside Kaduna Arena (touch + mouse friendly).
// openArenaGame("bowling" | "pool" | "arcade" | "okada_dash")

let _root = null, _stop = null;

function _best(id, score, higherBetter = true) {
  const k = "kaduna-arena-best-" + id;
  let b = null;
  try { b = JSON.parse(localStorage.getItem(k)); } catch {}
  if (b == null || (higherBetter ? score > b : score < b)) {
    try { localStorage.setItem(k, JSON.stringify(score)); } catch {}
    return { best: score, isNew: b != null };
  }
  return { best: b, isNew: false };
}

function _shell(title, emoji) {
  closeArenaGame();
  _root = document.createElement("div");
  _root.style.cssText = "position:fixed;inset:0;z-index:60;background:radial-gradient(circle at 50% 20%,#1d2b4a,#0a0f1e);color:#fff;font-family:Poppins,system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;touch-action:none;user-select:none;-webkit-user-select:none;";
  _root.innerHTML = `<div style="width:100%;max-width:520px;display:flex;align-items:center;justify-content:space-between;padding:12px 14px;box-sizing:border-box"><div style="font-weight:800;font-size:16px">${emoji} ${title}</div><div id="ag-score" style="font-weight:700;color:#f2b134;font-size:14px"></div><button id="ag-x" style="background:#e11d48;border:0;color:#fff;font:700 13px Poppins,sans-serif;padding:8px 14px;border-radius:10px">Exit</button></div><div id="ag-body" style="flex:1;width:100%;max-width:520px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 10px 14px;box-sizing:border-box;min-height:0"></div>`;
  document.body.appendChild(_root);
  _root.querySelector("#ag-x").onclick = closeArenaGame;
  return { body: _root.querySelector("#ag-body"), score: (t) => { const e = _root && _root.querySelector("#ag-score"); if (e) e.textContent = t; } };
}

export function closeArenaGame() {
  if (_stop) { try { _stop(); } catch {} _stop = null; }
  if (_root) { _root.remove(); _root = null; }
}

function _canvas(body, w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.style.cssText = `width:100%;max-width:${Math.min(w, 480)}px;max-height:100%;aspect-ratio:${w}/${h};border-radius:14px;background:#000;touch-action:none`;
  body.appendChild(c);
  return c;
}
function _btn(body, text, fn, bg = "linear-gradient(145deg,#f2b134,#d98e2b)") {
  const b = document.createElement("button");
  b.textContent = text;
  b.style.cssText = `margin-top:12px;width:100%;max-width:360px;padding:14px;border:0;border-radius:12px;background:${bg};color:#1a1a1a;font:800 15px Poppins,sans-serif`;
  b.onclick = fn; body.appendChild(b); return b;
}
function _raf(fn) {
  let on = true, last = performance.now();
  const loop = (t) => { if (!on) return; const dt = Math.min(0.05, (t - last) / 1000); last = t; fn(dt, t / 1000); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  return () => { on = false; };
}
function _ptr(c, down, move, up) {
  const pos = (e) => { const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * c.width, y: (e.clientY - r.top) / r.height * c.height }; };
  c.addEventListener("pointerdown", (e) => { e.preventDefault(); c.setPointerCapture?.(e.pointerId); down && down(pos(e)); });
  c.addEventListener("pointermove", (e) => { e.preventDefault(); move && move(pos(e)); });
  c.addEventListener("pointerup", (e) => { e.preventDefault(); up && up(pos(e)); });
}

// ---------------------------------------------------------------- BOWLING
function bowling() {
  const ui = _shell("Bowling", "🎳");
  const c = _canvas(ui.body, 360, 560), g = c.getContext("2d");
  const FR = 10;
  let frame = 1, roll = 1, pins, total = 0, phase = "aim", t = 0, aim = 0, power = 0, msg = "Tap to set AIM", ball = null, over = false, frameScore = 0;
  const pinPos = [];
  for (let r = 0; r < 4; r++) for (let p = 0; p <= r; p++) pinPos.push({ x: (p - r / 2) * 0.5, y: r * 0.45 });
  const reset = () => { pins = pinPos.map(() => true); };
  reset();
  const hit = (x, pw) => {
    const down = new Set();
    pinPos.forEach((p, i) => { if (pins[i] && Math.abs(p.x - x) < 0.32 + pw * 0.12) down.add(i); });
    for (let k = 0; k < 2; k++) {
      const add = [];
      pinPos.forEach((p, i) => { if (!pins[i] || down.has(i)) return;
        for (const j of down) { const q = pinPos[j]; if (Math.hypot(p.x - q.x, p.y - q.y) < 0.62 && Math.random() < 0.35 + pw * 0.5) { add.push(i); break; } } });
      add.forEach((i) => down.add(i));
    }
    return down;
  };
  _ptr(c, () => {
    if (over) return;
    if (phase === "aim") { phase = "power"; t = 0; msg = "Tap to set POWER"; }
    else if (phase === "power") {
      phase = "roll";
      ball = { y: 0, x: aim * 1.1, pw: power };
      msg = "";
    }
  });
  _stop = _raf((dt) => {
    t += dt;
    if (phase === "aim") aim = Math.sin(t * 2.4);
    if (phase === "power") power = (Math.sin(t * 2.8 - Math.PI / 2) + 1) / 2;
    if (phase === "roll" && ball) {
      ball.y += dt * (1.2 + ball.pw * 1.6);
      if (ball.y >= 1) {
        // fast-but-wild vs slow-and-accurate: low power curves a bit
        const x = ball.x + (1 - ball.pw) * 0.35 * Math.sign(ball.x || 1);
        const d = hit(x, ball.pw);
        d.forEach((i) => { pins[i] = false; });
        const n = d.size; frameScore += n; total += n;
        const left = pins.filter(Boolean).length;
        msg = n === 10 || left === 0 ? (roll === 1 ? "STRIKE! 🔥" : "SPARE!") : n === 0 ? "Gutter ball 😅" : `${n} pin${n > 1 ? "s" : ""}!`;
        if (left === 0 && roll === 1) total += 5;
        ball = null; phase = "wait"; t = 0;
      }
    }
    if (phase === "wait" && t > 1.3) {
      const left = pins.filter(Boolean).length;
      if (roll === 1 && left > 0) { roll = 2; }
      else { frame++; roll = 1; frameScore = 0; reset(); }
      if (frame > FR) { over = true; phase = "over"; const b = _best("bowling", total); msg = `Final ${total}${b.isNew ? " — NEW BEST!" : ""}`; showEnd(b.best); }
      else { phase = "aim"; t = 0; msg = "Tap to set AIM"; }
    }
    ui.score(`Frame ${Math.min(frame, FR)}/${FR} · ${total}`);
    // draw
    g.fillStyle = "#1a1208"; g.fillRect(0, 0, 360, 560);
    const lg = g.createLinearGradient(80, 0, 280, 0); lg.addColorStop(0, "#b98a50"); lg.addColorStop(.5, "#e4b878"); lg.addColorStop(1, "#b98a50");
    g.fillStyle = lg; g.beginPath(); g.moveTo(130, 70); g.lineTo(230, 70); g.lineTo(300, 540); g.lineTo(60, 540); g.fill();
    g.fillStyle = "#222"; g.fillRect(40, 70, 14, 470);
    const proj = (x, y) => { const k = 1 - y * 0.62; return [180 + x * 70 * k * 1.15 / 1, 540 - y * 460 * 1]; };
    pinPos.forEach((p, i) => {
      const [px, py] = [180 + p.x * 38, 120 + p.y * 40];
      g.fillStyle = pins[i] ? "#fff" : "rgba(255,255,255,.12)"; g.beginPath(); g.ellipse(px, py, 8, 11, 0, 0, 7); g.fill();
      if (pins[i]) { g.fillStyle = "#e11d48"; g.fillRect(px - 6, py - 4, 12, 3); }
    });
    if (phase === "aim" || phase === "power") {
      g.strokeStyle = "rgba(242,177,52,.7)"; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(180 + aim * 60, 500); g.lineTo(180 + aim * 22, 150); g.stroke(); g.setLineDash([]);
    }
    const bx = ball ? 180 + ball.x * 50 * (1 - ball.y * 0.55) : 180 + aim * 60;
    const by = ball ? 500 - ball.y * 380 : 500;
    const br = ball ? 16 - ball.y * 6 : 16;
    if (phase !== "wait" && phase !== "over") { g.fillStyle = "#1d5fa8"; g.beginPath(); g.arc(bx, by, br, 0, 7); g.fill(); g.fillStyle = "#fff6"; g.beginPath(); g.arc(bx - 4, by - 4, 4, 0, 7); g.fill(); }
    if (phase === "power") { g.fillStyle = "#222"; g.fillRect(320, 200, 22, 280); g.fillStyle = power > .85 ? "#e11d48" : "#4ade80"; g.fillRect(320, 480 - 280 * power, 22, 280 * power); }
    g.fillStyle = "#fff"; g.font = "700 20px Poppins,sans-serif"; g.textAlign = "center"; g.fillText(msg, 180, 40);
  });
  function showEnd(best) { _btn(ui.body, "Play again 🎳", bowling); }
}

// ---------------------------------------------------------------- POOL
function pool() {
  const ui = _shell("Pool", "🎱");
  const W = 360, H = 600, c = _canvas(ui.body, W, H), g = c.getContext("2d");
  const L = 24, T = 40, R = W - 24, B = H - 40, BR = 10;
  const pockets = [[L, T], [R, T], [L, (T + B) / 2], [R, (T + B) / 2], [L, B], [R, B]];
  const cols = ["#f2c500", "#1d5fa8", "#e11d48", "#6b21a8", "#ea580c", "#16a34a"];
  let balls = [{ x: W / 2, y: B - 120, vx: 0, vy: 0, c: "#fff", cue: true }];
  let k = 0;
  for (let r = 0; r < 3; r++) for (let p = 0; p <= r; p++) balls.push({ x: W / 2 + (p - r / 2) * (BR * 2 + 1), y: T + 130 + r * (BR * 1.8), vx: 0, vy: 0, c: cols[k++] });
  let shots = 0, drag = null, over = false, scratch = 0;
  const moving = () => balls.some((b) => Math.hypot(b.vx, b.vy) > 4);
  _ptr(c, (p) => { if (!moving() && !over) drag = { x: p.x, y: p.y }; }, (p) => { if (drag) drag.cx = p.x, drag.cy = p.y; },
    () => {
      if (!drag || drag.cx == null) { drag = null; return; }
      const cue = balls[0], dx = drag.x - drag.cx, dy = drag.y - drag.cy, d = Math.hypot(dx, dy);
      if (d > 8) { const pw = Math.min(d, 140) / 140 * 900; cue.vx = dx / d * pw; cue.vy = dy / d * pw; shots++; }
      drag = null;
    });
  _stop = _raf((dt) => {
    const steps = 3, h = dt / steps;
    for (let s = 0; s < steps; s++) {
      for (const b of balls) {
        b.x += b.vx * h; b.y += b.vy * h;
        const f = Math.pow(0.45, h); b.vx *= f; b.vy *= f;
        if (b.x < L + BR) { b.x = L + BR; b.vx = Math.abs(b.vx) * .85; } if (b.x > R - BR) { b.x = R - BR; b.vx = -Math.abs(b.vx) * .85; }
        if (b.y < T + BR) { b.y = T + BR; b.vy = Math.abs(b.vy) * .85; } if (b.y > B - BR) { b.y = B - BR; b.vy = -Math.abs(b.vy) * .85; }
      }
      for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i], b = balls[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d < BR * 2 && d > 0) {
          const nx = dx / d, ny = dy / d, ov = BR * 2 - d; a.x -= nx * ov / 2; a.y -= ny * ov / 2; b.x += nx * ov / 2; b.y += ny * ov / 2;
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) { a.vx += rel * nx; a.vy += rel * ny; b.vx -= rel * nx; b.vy -= rel * ny; }
        }
      }
      balls = balls.filter((b) => {
        for (const [px, py] of pockets) if (Math.hypot(b.x - px, b.y - py) < 17) {
          if (b.cue) { scratch++; b.x = W / 2; b.y = B - 120; b.vx = b.vy = 0; return true; }
          return false;
        }
        return true;
      });
    }
    const left = balls.length - 1;
    ui.score(`Shots ${shots} · Left ${left}`);
    if (left === 0 && !over) { over = true; const sc = shots + scratch * 3; const b = _best("pool", sc, false); ui.score(`Cleared in ${sc}${b.isNew ? " NEW BEST" : ""}`); _btn(ui.body, "Rack again 🎱", pool); }
    g.fillStyle = "#3b2314"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#0f7a45"; g.fillRect(L, T, R - L, B - T);
    g.fillStyle = "#000"; pockets.forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 16, 0, 7); g.fill(); });
    for (const b of balls) { g.fillStyle = b.c; g.beginPath(); g.arc(b.x, b.y, BR, 0, 7); g.fill(); g.fillStyle = "#fff5"; g.beginPath(); g.arc(b.x - 3, b.y - 3, 3, 0, 7); g.fill(); }
    if (drag && drag.cx != null && !moving()) {
      const cue = balls[0], dx = drag.x - drag.cx, dy = drag.y - drag.cy, d = Math.hypot(dx, dy) || 1;
      g.strokeStyle = "#fff9"; g.setLineDash([5, 5]); g.beginPath(); g.moveTo(cue.x, cue.y); g.lineTo(cue.x + dx / d * 220, cue.y + dy / d * 220); g.stroke(); g.setLineDash([]);
      g.strokeStyle = "#e4b878"; g.lineWidth = 5; g.beginPath(); g.moveTo(cue.x - dx / d * 14, cue.y - dy / d * 14); g.lineTo(cue.x - dx / d * (14 + Math.min(d, 140)), cue.y - dy / d * (14 + Math.min(d, 140))); g.stroke(); g.lineWidth = 1;
    } else if (!moving() && !over) { g.fillStyle = "#fffc"; g.font = "600 13px Poppins,sans-serif"; g.textAlign = "center"; g.fillText("Drag back from anywhere, release to shoot — pot all balls", W / 2, H - 14); }
  });
}

// ---------------------------------------------------------------- ARCADE (tap the stars)
function arcade() {
  const ui = _shell("Arcade — Star Rush", "🕹️");
  const W = 360, H = 520, c = _canvas(ui.body, W, H), g = c.getContext("2d");
  let score = 0, time = 30, targets = [], spawn = 0, over = false, fx = [];
  _ptr(c, (p) => {
    if (over) return;
    for (let i = targets.length - 1; i >= 0; i--) { const t = targets[i];
      if (Math.hypot(p.x - t.x, p.y - t.y) < t.r + 10) { score += t.bad ? -5 : t.gold ? 5 : 1; fx.push({ x: t.x, y: t.y, a: 1, s: t.bad ? "-5" : t.gold ? "+5" : "+1" }); targets.splice(i, 1); return; } }
  });
  _stop = _raf((dt) => {
    if (!over) {
      time -= dt; spawn -= dt;
      if (spawn <= 0) { spawn = 0.45 - Math.min(0.25, (30 - time) * 0.008); const r = 20 + Math.random() * 10, rnd = Math.random();
        targets.push({ x: 40 + Math.random() * (W - 80), y: 60 + Math.random() * (H - 120), r, life: 1.3, bad: rnd < 0.15, gold: rnd > 0.9 }); }
      targets.forEach((t) => t.life -= dt); targets = targets.filter((t) => t.life > 0);
      if (time <= 0) { over = true; const b = _best("arcade", score); ui.score(`Final ${score}${b.isNew ? " NEW BEST" : ""}`); _btn(ui.body, "Play again 🕹️", arcade); }
      else ui.score(`⏱ ${Math.ceil(time)}s · ${score}`);
    }
    fx.forEach((f) => { f.a -= dt * 1.5; f.y -= dt * 40; }); fx = fx.filter((f) => f.a > 0);
    g.fillStyle = "#0a0f2a"; g.fillRect(0, 0, W, H);
    for (const t of targets) { g.globalAlpha = Math.min(1, t.life * 2); g.font = `${t.r * 2}px serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(t.bad ? "💣" : t.gold ? "🌟" : "⭐", t.x, t.y); }
    g.globalAlpha = 1;
    fx.forEach((f) => { g.globalAlpha = f.a; g.fillStyle = f.s[0] === "-" ? "#f87171" : "#4ade80"; g.font = "800 20px Poppins,sans-serif"; g.fillText(f.s, f.x, f.y); }); g.globalAlpha = 1;
    if (over) { g.fillStyle = "#000a"; g.fillRect(0, 0, W, H); g.fillStyle = "#f2b134"; g.font = "800 34px Poppins,sans-serif"; g.fillText("TIME UP!", W / 2, H / 2 - 10); g.fillStyle = "#fff"; g.font = "700 22px Poppins,sans-serif"; g.fillText(score + " pts", W / 2, H / 2 + 28); }
    else if (time > 28) { g.fillStyle = "#fff"; g.font = "600 14px Poppins,sans-serif"; g.fillText("Tap ⭐ (+1) 🌟 (+5) — avoid 💣", W / 2, 30); }
  });
}

// ---------------------------------------------------------------- OKADA DASH
function okada() {
  const ui = _shell("Okada Dash", "🏍️");
  const W = 360, H = 560, c = _canvas(ui.body, W, H), g = c.getContext("2d");
  const LW = 90, X0 = (W - LW * 3) / 2;
  let lane = 1, tx = 1, px = X0 + LW * 1.5, dist = 0, speed = 260, obs = [], coins = 0, spawn = 0, over = false, scroll = 0;
  const go = (d) => { lane = Math.max(0, Math.min(2, lane + d)); };
  _ptr(c, (p) => { if (!over) go(p.x < W / 2 ? -1 : 1); });
  const key = (e) => { if (e.key === "ArrowLeft" || e.key === "a") go(-1); if (e.key === "ArrowRight" || e.key === "d") go(1); };
  window.addEventListener("keydown", key);
  const prevStop = () => window.removeEventListener("keydown", key);
  _stop = (() => { const s = _raf((dt) => {
    if (!over) {
      speed += dt * 6; dist += speed * dt / 40; scroll = (scroll + speed * dt) % 60;
      px += ((X0 + LW * (lane + 0.5)) - px) * Math.min(1, dt * 14);
      spawn -= dt;
      if (spawn <= 0) { spawn = Math.max(0.35, 0.9 - speed / 900); const l = Math.floor(Math.random() * 3), r = Math.random();
        obs.push({ l, y: -50, k: r < 0.3 ? "coin" : r < 0.65 ? "car" : r < 0.85 ? "goat" : "bus" }); }
      for (const o of obs) o.y += speed * dt;
      for (const o of obs) { if (o.dead) continue; const ox = X0 + LW * (o.l + 0.5), h = o.k === "bus" ? 90 : 50;
        if (Math.abs(ox - px) < 30 && o.y + h / 2 > H - 120 && o.y - h / 2 < H - 70) {
          if (o.k === "coin") { coins++; o.dead = true; } else { over = true; const sc = Math.floor(dist) + coins * 10; const b = _best("okada_dash", sc); ui.score(`Final ${sc}${b.isNew ? " NEW BEST" : ""}`); _btn(ui.body, "Dash again 🏍️", okada); }
        } }
      obs = obs.filter((o) => !o.dead && o.y < H + 80);
      if (!over) ui.score(`${Math.floor(dist)}m · 🪙${coins}`);
    }
    g.fillStyle = "#2f7d3a"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#3a3a42"; g.fillRect(X0 - 10, 0, LW * 3 + 20, H);
    g.fillStyle = "#fff8"; for (let l = 1; l < 3; l++) for (let y = -60 + scroll; y < H; y += 60) g.fillRect(X0 + LW * l - 2, y, 4, 30);
    g.textAlign = "center"; g.textBaseline = "middle";
    for (const o of obs) { const ox = X0 + LW * (o.l + 0.5); g.font = (o.k === "bus" ? 70 : 44) + "px serif"; g.fillText(o.k === "coin" ? "🪙" : o.k === "car" ? "🚗" : o.k === "goat" ? "🐐" : "🚌", ox, o.y); }
    g.font = "52px serif"; g.fillText("🏍️", px, H - 95);
    if (over) { g.fillStyle = "#000a"; g.fillRect(0, 0, W, H); g.fillStyle = "#e11d48"; g.font = "800 34px Poppins,sans-serif"; g.fillText("CRASH!", W / 2, H / 2 - 10); g.fillStyle = "#fff"; g.font = "700 20px Poppins,sans-serif"; g.fillText(Math.floor(dist) + "m  ·  " + coins + " coins", W / 2, H / 2 + 28); }
    else if (dist < 15) { g.fillStyle = "#fff"; g.font = "600 14px Poppins,sans-serif"; g.fillText("Tap left / right side to switch lane", W / 2, 24); }
  }); return () => { s(); prevStop(); }; })();
}

export function openArenaGame(id) {
  if (id === "bowling") bowling();
  else if (id === "pool") pool();
  else if (id === "arcade") arcade();
  else if (id === "okada_dash") okada();
}
