// The 12 Kay Super Racing cars, brought into Kaduna Lifestyle (same names, same prices).
// Built by code (loft geometry, ~4k triangles each, no GLB). Nose = +X, wheels on the ground, like the other vehicles.
import * as THREE from "three";
import { CARS, carGeo, tintPart } from "./ksr/cars-data.js";
import { colorize } from "./ksr/carcolor.js";

const PAINT = {
  cruiser: 0x2e6fd6, cab: 0xf2f2f2, titan: 0x2b2f36, volt: 0x19b88a, blaze: 0xe8590c, nova: 0x7a3fd1,
  sultan: 0xd9a441, tesla: 0xd62828, phantom: 0x111418, apex: 0xf1c40f, zephyr: 0x0b8fd9, ghost: 0xe9ecef,
};
const EMOJI = { cab: "🚕", titan: "🚙", tesla: "🏎️", ghost: "🏎️" };
// KSR top speed (90..138) -> Kaduna ride speed (5.0..8.6, Ferrari is 8.5)
const speedOf = top => +(5 + (top - 90) / 48 * 3.6).toFixed(2);

export const KSR_PREFIX = "ksr_";
export const KSR_CATALOG = CARS.map(c => ({
  id: KSR_PREFIX + c.id, ksr: true, ksrId: c.id,
  name: c.name.replace(/\b(\w)(\w*)/g, (m, a, b) => a + b.toLowerCase()) + " (KSR)",
  stats: { top: c.stats.top, accel: c.stats.accel, steer: c.stats.steer, drift: c.stats.drift },
  emoji: EMOJI[c.id] || "🏎️", price: c.price, speed: speedOf(c.stats.top),
  desc: c.desc.replace(/ Press F to take off and fly over the city!/, " (flying coming soon)"),
}));

const _geo = {};
function _geoFor(ksrId) {
  if (_geo[ksrId]) return _geo[ksrId];
  const src = carGeo(ksrId);
  const g = src.clone();                       // KSR's cached geometry stays untouched
  colorize(g, PAINT[ksrId] || 0xcccccc);
  const car = CARS.find(c => c.id === ksrId);
  if (car && car.tint) for (const k of Object.keys(car.tint)) tintPart(g, +k, car.tint[k]);
  g.deleteAttribute("partId");
  g.rotateY(Math.PI / 2);                      // KSR front = +Z  ->  Kaduna front = +X
  g.computeBoundingBox();
  g.translate(0, -g.boundingBox.min.y, 0);     // wheels on the ground
  return (_geo[ksrId] = g);
}

export function buildKsrMesh(vehicleId) {
  const ksrId = String(vehicleId).replace(KSR_PREFIX, "");
  const g = _geoFor(ksrId);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const body = new THREE.Mesh(g, mat);
  body.frustumCulled = false;
  const grp = new THREE.Group();
  grp.add(body);
  grp.userData.shared = true;                  // geometry is cached: never dispose it
  return grp;
}
