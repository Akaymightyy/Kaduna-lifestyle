// src/drive.js — how a ridden vehicle moves (pure maths, no DOM / three.js, so it can be tested on its own).
//
// Conventions (the same as walking in main.js):
//   * heading h: the car's forward is (sin h, cos h)
//   * steering RIGHT (+1) must turn the heading DOWN, steering LEFT (-1) turns it UP
//   * the 3D model is placed with rotation.y = h - PI/2 (see vehicles.js), so its nose points along forward
export function driveStep(player, input, dt, maxSpd) {
  const steer = Math.max(-1, Math.min(1, input.steer || 0));
  const throttle = Math.max(-1, Math.min(1, input.throttle || 0));
  // gas goes forward; brake brakes hard and then reverses slowly
  const target = throttle >= 0 ? throttle * maxSpd : throttle * maxSpd * 0.35;
  const braking = throttle < 0 && player.speed > 0;
  player.speed += (target - player.speed) * (1 - Math.exp(-dt * (braking ? 6 : 3)));
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
