// src/places/central_mosque.js
// Central Mosque interior — prayer hall.
// Layout: large rectangular carpeted hall, qibla wall (mihrab niche) on the
// north side, minbar (pulpit) to the right of the mihrab, rows of prayer
// mats facing qibla, soft warm light from stained-glass-style windows.
// Modest-dress check at the door: if the player's outfit is not modest (kaftan
// or covered), Mallam Garba the guard will advise them. Praying restores mood
// and hygiene. Call to prayer (adhan) plays at salat times.

import * as THREE from "three";
import { box, mergedMesh, signMesh, floor, interiorLights, disposeGroup } from "./_helpers.js";
import { rng } from "../config.js";

let _built = false;
let _cache = null;

// Salat times (game-hour). Approximate, fixed for simplicity.
const SALAT_TIMES = [
  { name: "Fajr", hour: 5.5 },
  { name: "Zuhr", hour: 13.0 },
  { name: "Asr", hour: 16.0 },
  { name: "Maghrib", hour: 18.5 },
  { name: "Isha", hour: 20.0 },
];

export async function build(scene, ctx) {
  if (_built) return _cache;
  const R = rng(20251013);
  const group = new THREE.Group();
  group.name = "central_mosque_interior";
  group.visible = false;

  // ---- carpet floor (deep green) ----
  const carpetFloor = floor(40, 30, 0x1a5a3a);
  group.add(carpetFloor);
  // Carpet pattern: lighter stripes for prayer rows
  for (let i = 0; i < 8; i++) {
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 0.6),
      new THREE.MeshLambertMaterial({ color: 0x226a4a })
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(0, 0.01, -10 + i * 2.5);
    group.add(stripe);
  }
  // Prayer mat texture (simple pattern on each row)
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 12; col++) {
      const mat = new THREE.Mesh(
        new THREE.PlaneGeometry(1.0, 1.6),
        new THREE.MeshLambertMaterial({
          color: row % 2 === 0 ? 0x2a6a4a : 0x356a55,
        })
      );
      mat.rotation.x = -Math.PI / 2;
      mat.position.set(-15 + col * 2.7, 0.02, -10 + row * 2.5);
      group.add(mat);
      // Mihrab marker on each mat (small arch shape)
      const arch = new THREE.Mesh(
        new THREE.CircleGeometry(0.15, 12, 0, Math.PI),
        new THREE.MeshBasicMaterial({ color: 0xf2b134 })
      );
      arch.rotation.x = -Math.PI / 2;
      arch.position.set(-15 + col * 2.7, 0.03, -10 + row * 2.5 - 0.6);
      group.add(arch);
    }
  }

  // ---- walls (cream with green trim) ----
  const wallGeos = [
    box(40, 6, 0.4, 0, 3, -15, 0xf4f1ea),
    box(40, 6, 0.4, 0, 3, 15, 0xf4f1ea),
    box(0.4, 6, 30, -20, 3, 0, 0xf4f1ea),
    box(0.4, 6, 30, 20, 3, 0, 0xf4f1ea),
    // Green trim at the top
    box(40, 0.4, 0.5, 0, 5.8, -14.8, 0x1a5a3a),
    box(40, 0.4, 0.5, 0, 5.8, 14.8, 0x1a5a3a),
    box(0.5, 0.4, 30, -19.8, 5.8, 0, 0x1a5a3a),
    box(0.5, 0.4, 30, 19.8, 5.8, 0, 0x1a5a3a),
  ];
  group.add(mergedMesh(wallGeos));

  // ---- mihrab niche (qibla wall, center) ----
  const mihrabGroup = new THREE.Group();
  mihrabGroup.position.set(0, 0, -14.5);
  // Arch frame
  const archFrame = new THREE.Mesh(
    new THREE.RingGeometry(1.4, 1.8, 24, 1, 0, Math.PI),
    new THREE.MeshLambertMaterial({ color: 0x1a5a3a })
  );
  archFrame.position.y = 3.0;
  archFrame.rotation.y = Math.PI;
  mihrabGroup.add(archFrame);
  // Niche interior (darker)
  const niche = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 3.6),
    new THREE.MeshLambertMaterial({ color: 0x0d3a25 })
  );
  niche.position.y = 2.0;
  mihrabGroup.add(niche);
  // Calligraphy panel (gold on green)
  const calligraphy = signMesh("۞", 1.2, 1.2, {
    width: 128, height: 128, bg: "#0d3a25", fg: "#f2b134", size: 80, border: false,
  });
  calligraphy.position.set(0, 2.5, 0.05);
  mihrabGroup.add(calligraphy);
  group.add(mihrabGroup);

  // ---- minbar (pulpit, right of mihrab) ----
  const minbar = mergedMesh([
    box(2, 1, 1.5, 6, 0.5, -14, 0xa08050),
    box(2, 0.8, 1.5, 6, 1.4, -14, 0x8a6a40),
    box(0.2, 1.5, 1.5, 5, 1.6, -14, 0x6a4a30), // railing
    box(0.2, 1.5, 1.5, 7, 1.6, -14, 0x6a4a30),
    box(2, 0.1, 1.5, 6, 2.4, -14, 0x6a4a30), // roof
  ]);
  group.add(minbar);

  // ---- columns (4 corners + sides, Islamic architecture) ----
  const columnPositions = [
    [-16, -12], [16, -12], [-16, 12], [16, 12],
    [0, -12], [0, 12], [-8, 12], [8, 12],
  ];
  for (const [cx, cz] of columnPositions) {
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.55, 6, 12),
      new THREE.MeshLambertMaterial({ color: 0xe8e0d0 })
    );
    col.position.set(cx, 3, cz);
    col.castShadow = true;
    group.add(col);
    // Capital (top)
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.5, 0.3, 12),
      new THREE.MeshLambertMaterial({ color: 0x1a5a3a })
    );
    cap.position.set(cx, 6.15, cz);
    group.add(cap);
  }

  // ---- ceiling dome ----
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(14, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.4),
    new THREE.MeshLambertMaterial({ color: 0xf4f1ea, side: THREE.BackSide })
  );
  dome.position.y = 6;
  group.add(dome);
  // Dome interior trim
  const domeTrim = new THREE.Mesh(
    new THREE.TorusGeometry(14, 0.3, 8, 24),
    new THREE.MeshLambertMaterial({ color: 0x1a5a3a })
  );
  domeTrim.position.y = 6;
  domeTrim.rotation.x = Math.PI / 2;
  group.add(domeTrim);

  // ---- stained-glass-style windows (warm glow) ----
  const windowColors = [0xf2b134, 0x1a5a3a, 0xc0392b, 0xf2b134];
  for (let i = 0; i < 8; i++) {
    const w = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 3),
      new THREE.MeshBasicMaterial({
        color: windowColors[i % windowColors.length],
        transparent: true, opacity: 0.6,
      })
    );
    const side = i < 4 ? -19.7 : 19.7;
    const z = -10 + (i % 4) * 6.6;
    w.position.set(side, 3, z);
    if (i >= 4) w.rotation.y = Math.PI;
    group.add(w);
  }

  // ---- chandeliers (warm point lights from the dome) ----
  const chandelierPositions = [
    [-8, 5, -6], [8, 5, -6], [-8, 5, 6], [8, 5, 6], [0, 5, 0],
  ];
  for (const [cx, cy, cz] of chandelierPositions) {
    // Visible chandelier (gold ring)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.6, 0.05, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0xf2b134, metalness: 0.6, roughness: 0.3 })
    );
    ring.position.set(cx, cy, cz);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    // Hanging chain
    const chain = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 1.5, 4),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    chain.position.set(cx, cy + 0.75, cz);
    group.add(chain);
  }

  // ---- lighting: warm, calm ambiance ----
  group.add(interiorLights({
    ambient: 0.5,
    points: chandelierPositions.map(([x, y, z]) => ({
      x, y: y - 0.5, z, color: 0xffd070, intensity: 0.8, distance: 12,
    })),
  }));
  // Extra warm glow at mihrab
  const mihrabLight = new THREE.PointLight(0xffd070, 0.6, 10, 2.0);
  mihrabLight.position.set(0, 3, -13);
  group.add(mihrabLight);

  // ---- entrance sign ----
  const sign = signMesh("CENTRAL MOSQUE — PRAYER HALL", 8, 1.0, {
    width: 500, height: 60, bg: "#1a5a3a", fg: "#f2b134", size: 26,
  });
  sign.position.set(0, 5.5, 14.7);
  sign.rotation.y = Math.PI;
  group.add(sign);

  // ---- shoe rack at entrance (atmosphere) ----
  const shoeRack = mergedMesh([
    box(4, 0.2, 0.6, 0, 0.3, 13, 0x8a6a45),
    box(4, 0.2, 0.6, 0, 0.9, 13, 0x8a6a45),
    box(0.1, 0.9, 0.6, -2, 0.45, 13, 0x5a4a30),
    box(0.1, 0.9, 0.6, 2, 0.45, 13, 0x5a4a30),
  ]);
  group.add(shoeRack);
  // A few shoes on the rack
  for (let i = 0; i < 6; i++) {
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.1, 0.3),
      new THREE.MeshLambertMaterial({ color: [0x222222, 0x8a5a3c, 0xc0392b][i % 3] })
    );
    shoe.position.set(-1.6 + i * 0.6, 0.4, 13);
    group.add(shoe);
  }

  scene.add(group);

  // ---- PlaceHandle ----
  let _lastSalatCheck = 0;
    // ---- People: Imam + guard + worshippers + readers ----
  let _people = null;
  const _worshippers = [];
  for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) {
    _worshippers.push({ id: "worshipper_" + row + "_" + col, name: "Worshipper", role: "worshipper", outfit: "kaftan", pose: "stand", x: -6 + col * 3, z: -8 + row * 2.5, ry: 0, top: ["#f4efe4", "#9fc2d9", "#c9b38a", "#d9c7a0"][col % 4] });
  }
  spawnPeople(group, [
    { id: "imam", name: "Imam Ibrahim", role: "Imam", outfit: "kaftan", pose: "stand", x: 0, z: -13.5, ry: 0, top: "#f4efe4" },
    { id: "guard1", name: "Mallam Garba", role: "entrance guard", outfit: "kaftan", pose: "stand", x: 0, z: 12, ry: Math.PI, top: "#d9c7a0" },
    ..._worshippers,
    { id: "reader1", name: "Reader", role: "worshipper", outfit: "kaftan", pose: "sit", x: -16, z: 5, ry: Math.PI / 2, top: "#8a9bb5" },
    { id: "reader2", name: "Reader", role: "worshipper", outfit: "kaftan", pose: "sit", x: 16, z: 5, ry: -Math.PI / 2, top: "#c9b38a" },
    { id: "walker1", name: "Believer", role: "worshipper", outfit: "kaftan", pose: "stand", x: -8, z: 10, ry: Math.PI, top: "#9fc2d9", route: [{ x: -8, z: 10 }, { x: -8, z: -10 }, { x: 8, z: -10 }, { x: 8, z: 10 }], speed: 0.5 },
  ]).then((p) => { _people = p; });

  const handle = {
    group,
    enter(playerState) {
      // Player enters near the south wall (entrance side)
      playerState.pos.set(0, 0, 10.5);
      playerState.heading = Math.PI; // facing qibla (north)
      // Dress check: warn if outfit is casual (jeans/t-shirt)
      _checkDress(ctx);
    },
    exit() {},
    update(dt, now, px, pz) {
      if (_people) _people.update(dt, now, px, pz);
      // Check for adhan time every 5 seconds of real time
      const t = Date.now() / 1000;
      if (t - _lastSalatCheck > 5) {
        _lastSalatCheck = t;
        _checkSalat(ctx);
      }
    },
    dispose() {
      if (_people) _people.dispose();
      scene.remove(group);
      disposeGroup(group);
      _built = false;
      _cache = null;
    },
    people: () => _people,
    onUIEvent(eventId, payload) {
      if (eventId === "talk" && payload?.personId) _talk(ctx, payload.personId);
      if (eventId === "pray") _pray(ctx);
    },
    colliders: [
      // Walls
      { minX: -20, maxX: -19.6, minZ: -15, maxZ: 15 },
      { minX: 19.6, maxX: 20, minZ: -15, maxZ: 15 },
      { minX: -20, maxX: 20, minZ: -15, maxZ: -14.6 },
      { minX: -20, maxX: 20, minZ: 14.6, maxZ: 15 },
      // Minbar
      { minX: 5, maxX: 7, minZ: -14.5, maxZ: -13.5 },
      // Shoe rack
      { minX: -2, maxX: 2, minZ: 12.7, maxZ: 13.3 },
      // Columns
      ...[[-16, -12], [16, -12], [-16, 12], [16, 12], [0, -12], [0, 12], [-8, 12], [8, 12]].map(([x, z]) => ({
        minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.6, maxZ: z + 0.6,
      })),
    ],
  };

  _built = true;
  _cache = handle;
  return handle;
}

function _checkDress(ctx) {
  // The player's outfit is stored on the player state. For now we just warn.
  // Future: check playerState.outfit === 'kaftan' or 'hijab'
  if (ctx.game?.state?.outfit && ctx.game.state.outfit !== "kaftan" && ctx.game.state.outfit !== "hijab") {
    ctx.toast("Mallam Garba: \"Salam. Please dress modestly inside the prayer hall.\"");
  } else {
    ctx.toast("Mallam Garba: \"Salam alaykum. Welcome. Please remove your shoes.\"");
  }
}

function _checkSalat(ctx) {
  // gameHour = (Date.now() / 60000) % 24
  const gameHour = (Date.now() / 60000) % 24;
  for (const s of SALAT_TIMES) {
    if (Math.abs(gameHour - s.hour) < 0.05) {
      // It's salat time
      ctx.toast("🕌 " + s.name + " prayer time. Allahu Akbar.");
      break;
    }
  }
}

function _pray(ctx) {
  if (!ctx.game) return;
  // Praying restores mood (fun) and hygiene (wudu)
  ctx.game.state.needs.fun = Math.min(100, (ctx.game.state.needs.fun || 0) + 25);
  ctx.game.state.needs.hygiene = Math.min(100, (ctx.game.state.needs.hygiene || 0) + 15);
  ctx.game.state.needs.social = Math.min(100, (ctx.game.state.needs.social || 0) + 8);
  ctx.game.save?.();
  ctx.updateHUD?.();
  ctx.toast("🕌 You prayed. Mood and hygiene restored. Ma salam.");
}
