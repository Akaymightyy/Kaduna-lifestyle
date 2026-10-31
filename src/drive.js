// src/drive.js — how a ridden vehicle moves (pure maths, no DOM / three.js, so it can be tested on its own).
//
// Conventions (the same as walking in main.js):
//   * heading h: the car's forward is (sin h, cos h)
//   * steering RIGHT (+1) must turn the heading DOWN, steering LEFT (-1) turns it UP
//   * the 3D model is placed with rotation.y = h - PI/2 (see vehicles.js), so its nose points along forward
//
// FIX (Oct 21): brake button now STOPS the car at 0 — no more reverse.
// Previously throttle < 0 meant target = -maxSpd * 0.35 (reverse), which
// confused players ("brake should stop, not go backwards"). Now
// throttle < 0 means target = 0 (brake to stop). Reverse is still
// available via keyboard 'S' / arrow-down for desktop players (which
// sets a separate flag — see below).
export function driveStep(player, input, dt, maxSpd) {
  const steer = Math.max(-1, Math.min(1, input.steer || 0));
  const throttle = Math.max(-1, Math.min(1, input.throttle || 0));
  // ACCEL (throttle > 0): ramp UP toward max speed
  // BRAKE (throttle < 0): ramp DOWN to 0 (STOP — no reverse)
  // IDLE (throttle = 0): coast (slowly decelerate)
  // REAL acceleration (Oct 23): hold ACCEL and speed climbs steadily to top speed (about 3.5s to full),
  // BRAKE slams it down to a full stop (about 0.6s), letting go coasts gently. Never reverses.
  const accel = maxSpd * 0.30;     // m/s gained per second while ACCEL is held
  const brake = maxSpd * 1.7;      // m/s lost per second while BRAKE is held
  const coast = maxSpd * 0.10;     // m/s lost per second when no pedal
  if (throttle > 0) {
    const top = throttle * maxSpd;
    if (player.speed < top) player.speed = Math.min(top, player.speed + accel * dt * (1.4 - 0.4 * (player.speed / maxSpd)));
    else player.speed = Math.max(top, player.speed - coast * dt);
  } else if (throttle < 0) {
    player.speed = Math.max(0, player.speed - brake * dt * Math.min(1, -throttle * 1.5));
  } else {
    player.speed = Math.max(0, player.speed - coast * dt);
  }
  if (Math.abs(player.speed) < 0.05) player.speed = 0;
  // steering eases in (no jerk), cannot spin on the spot, and turns a little wider at top speed
  player.steerSm = (player.steerSm || 0) + (steer - (player.steerSm || 0)) * (1 - Math.exp(-dt * 8));
  const v = player.speed;
  if (Math.abs(v) > 0.2) {
    const grip = Math.min(1, Math.abs(v) / 2.5);
    const wide = 1 - 0.45 * Math.min(1, Math.abs(v) / maxSpd);
    player.heading -= player.steerSm * 1.7 * grip * wide * dt * (v > 0 ? 1 : -1);
  }
  // straight ahead along the heading
  player.pos.x += Math.sin(player.heading) * player.speed * dt;
  player.pos.z += Math.cos(player.heading) * player.speed * dt;
}

// ---- KSR-style driving (Oct 31): the same feel as Kay Super Racing, used by the ksr_* cars. ----
// Velocity-based: the car has its own velocity vector and "grip" pulls it toward where the nose points, so it
// slides a little in corners. Hold BRAKE while steering at speed = DRIFT (low grip). Brake never reverses.
// KSR numbers are for a big open track, so speeds are scaled down (KS) to suit city streets.
const KS = 0.3;
export function ksrDriveStep(player, input, dt, st) {
  const steer = Math.max(-1, Math.min(1, input.steer || 0));
  const thr = Math.max(-1, Math.min(1, input.throttle || 0));
  const k = player.kvel || (player.kvel = { x: Math.sin(player.heading) * (player.speed || 0), z: Math.cos(player.heading) * (player.speed || 0) });
  const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
  let fwd = k.x * fx + k.z * fz;
  const max = st.top * KS;
  if (thr > 0) {
    const a = st.accel * KS * Math.max(0, Math.min(1, 1 - fwd / (max * thr)));
    k.x += fx * a * dt; k.z += fz * a * dt;
  }
  const drifting = thr < 0 && Math.abs(steer) > 0.3 && fwd > max * 0.4;
  if (thr < 0 && fwd > 0) {
    const b = Math.min(fwd, 58 * KS * (drifting ? 0.3 : 1) * Math.min(1, -thr * 1.5) * dt);
    k.x -= fx * b; k.z -= fz * b;
  }
  fwd = k.x * fx + k.z * fz;
  // steering: needs some speed, gets lazier at very high speed (same curve as KSR)
  const grip = Math.max(0, Math.min(1, Math.abs(fwd) / (16 * KS)));
  player.steerSm = (player.steerSm || 0) + (steer - (player.steerSm || 0)) * (1 - Math.exp(-dt * 10));
  player.heading -= player.steerSm * st.steer * grip / (1 + Math.abs(fwd) / (85 * KS)) * dt * (drifting ? 1.5 : 1);
  // drag (rolls to a stop when you let go) and grip: velocity swings round to the nose direction
  const dr = Math.exp(-(thr > 0 || drifting ? 0.14 : 0.5) * dt); k.x *= dr; k.z *= dr;
  const nfx = Math.sin(player.heading), nfz = Math.cos(player.heading);
  const sp = Math.hypot(k.x, k.z), g = 1 - Math.exp(-(drifting ? st.drift : 7.5) * dt);
  const dir = (k.x * nfx + k.z * nfz) >= 0 ? 1 : -1;
  k.x += (nfx * sp * dir - k.x) * g; k.z += (nfz * sp * dir - k.z) * g;
  if (Math.hypot(k.x, k.z) < 0.08 && thr <= 0) { k.x = 0; k.z = 0; }
  player.pos.x += k.x * dt; player.pos.z += k.z * dt;
  player.speed = Math.max(0, k.x * nfx + k.z * nfz);
}
