// src/places/central_market.js
// Kaduna Central Market interior.
// Layout: 4 rows of stalls under tarpaulin roofs, narrow aisles, central
// walkway. Each row has a different vendor type (fabric, spice, tailor, food).
// Hand-built props: tarpaulin roof, fabric rolls, spice baskets, sewing
// machine, food pots. Haggling mini-game at the fabric stall.

import * as THREE from "three";
import { box, mergedMesh, signMesh, floor, interiorLights, disposeGroup } from "./_helpers.js";
import { rng } from "../config.js";

let _built = false;

export async function build(scene, ctx) {
  if (_built) return _cache;
  const R = rng(20251011);
  const group = new THREE.Group();
  group.name = "central_market";
  group.visible = false;

  // ---- ground: packed earth floor with concrete walkway ----
  const groundFloor = floor(60, 40, 0x8a6a45);
  groundFloor.position.set(0, 0, 0);
  group.add(groundFloor);
  // Concrete walkway down the middle
  const walkway = floor(4, 40, 0xc8c2b0);
  walkway.position.set(0, 0.01, 0);
  group.add(walkway);

  // ---- perimeter walls (low, market-style) ----
  const wallColor = 0xd4c5a0;
  const walls = mergedMesh([
    box(60, 3.5, 0.4, 0, 1.75, -20, wallColor),
    box(60, 3.5, 0.4, 0, 1.75, 20, wallColor),
    box(0.4, 3.5, 40, -30, 1.75, 0, wallColor),
    box(0.4, 3.5, 40, 30, 1.75, 0, wallColor),
  ]);
  group.add(walls);

  // ---- tarpaulin roof (alternating colors per row) ----
  const tarpColors = [0xc0392b, 0xf2b134, 0x1d5fa8, 0x2e7d4f];
  for (let row = 0; row < 4; row++) {
    const z = -14 + row * 9;
    const tarp = new THREE.Mesh(
      new THREE.PlaneGeometry(56, 7),
      new THREE.MeshLambertMaterial({
        color: tarpColors[row],
        side: THREE.DoubleSide,
        transparent: true, opacity: 0.85,
      })
    );
    tarp.rotation.x = -Math.PI / 2;
    // tilt slightly for rain runoff
    tarp.rotation.z = 0.05;
    tarp.position.set(0, 4.2, z);
    group.add(tarp);
    // Tarp ridges (waves)
    const ridgeCount = 20;
    for (let i = 0; i < ridgeCount; i++) {
      const ridge = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 7),
        new THREE.MeshLambertMaterial({ color: tarpColors[row] })
      );
      ridge.position.set(-28 + i * 56 / ridgeCount, 4.25, z);
      group.add(ridge);
    }
    // Support poles
    for (const sx of [-28, -10, 10, 28]) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 4.2, 6),
        new THREE.MeshLambertMaterial({ color: 0x5a4a30 })
      );
      pole.position.set(sx, 2.1, z - 3.4);
      pole.castShadow = true;
      group.add(pole);
      const pole2 = pole.clone();
      pole2.position.z = z + 3.4;
      group.add(pole2);
    }
  }

  // ---- stalls (4 rows × 3 stalls each = 12 stalls) ----
  const stallLayout = [
    { row: 0, type: "fabric", name: "FABRIC" },
    { row: 1, type: "spice", name: "SPICES" },
    { row: 2, type: "tailor", name: "TAILOR" },
    { row: 3, type: "food", name: "FOOD" },
  ];
  const colliders = [];
  for (const layout of stallLayout) {
    const z = -14 + layout.row * 9;
    for (let i = 0; i < 3; i++) {
      const x = -18 + i * 18;
      const stall = _buildStall(layout.type, x, z, R);
      group.add(stall.group);
      colliders.push(stall.collider);
      // Sign above each stall
      const sign = signMesh(layout.name + " STALL", 5, 0.8, {
        width: 256, height: 64, bg: "#5a4a30", fg: "#fff", size: 28,
      });
      sign.position.set(x, 3.6, z - 2);
      group.add(sign);
    }
  }

  // ---- baskets of produce scattered around (atmosphere) ----
  for (let i = 0; i < 14; i++) {
    const basket = _buildBasket(R);
    basket.position.set(
      (R() - 0.5) * 50,
      0.15,
      -16 + R() * 32
    );
    // Keep baskets off the walkway
    if (Math.abs(basket.position.x) < 3) basket.position.x = (basket.position.x > 0 ? 1 : -1) * (3 + R() * 2);
    group.add(basket);
  }

  // ---- lighting: warm market ambiance ----
  const lights = interiorLights({
    ambient: 0.6,
    points: [
      { x: -18, y: 4, z: -14, color: 0xffd070, intensity: 1.0 },
      { x: 0, y: 4, z: -14, color: 0xffd070, intensity: 1.0 },
      { x: 18, y: 4, z: -14, color: 0xffd070, intensity: 1.0 },
      { x: -18, y: 4, z: 13, color: 0xffb060, intensity: 1.0 },
      { x: 0, y: 4, z: 13, color: 0xffb060, intensity: 1.0 },
      { x: 18, y: 4, z: 13, color: 0xffb060, intensity: 1.0 },
    ],
  });
  group.add(lights);

  // ---- entrance sign ----
  const entranceSign = signMesh("KADUNA CENTRAL MARKET", 12, 1.5, {
    width: 600, height: 80, bg: "#c0392b", fg: "#fff", size: 38,
  });
  entranceSign.position.set(0, 4.5, -19.7);
  group.add(entranceSign);

  scene.add(group);

  // ---- PlaceHandle ----
  const handle = {
    group,
    enter(playerState) {
      // Position player at the entrance, facing in
      playerState.pos.set(0, 0, 17);
      playerState.heading = Math.PI;
    },
    exit() { /* nothing to clean up beyond dispose */ },
    update(dt, now) {
      // Future: NPC animations, fan rotations, etc.
    },
    dispose() {
      scene.remove(group);
      disposeGroup(group);
      _built = false;
      _cache = null;
    },
    onUIEvent(eventId, payload) {
      if (eventId === "haggle") _startHaggle(ctx);
    },
    colliders,
  };

  _built = true;
  _cache = handle;
  return handle;
}

let _cache = null;

// ---- stall builders (unique per type) ----
function _buildStall(type, x, z, R) {
  const stallGroup = new THREE.Group();
  stallGroup.position.set(x, 0, z);
  // Common: wooden table + awning (small per-stall canopy)
  const tableTop = box(6, 0.15, 2.5, 0, 0.85, 0, 0x8a6a45);
  const tableLegs = mergedMesh([
    box(0.2, 0.85, 0.2, -2.8, 0.42, -1.1, 0x5a4a30),
    box(0.2, 0.85, 0.2, 2.8, 0.42, -1.1, 0x5a4a30),
    box(0.2, 0.85, 0.2, -2.8, 0.42, 1.1, 0x5a4a30),
    box(0.2, 0.85, 0.2, 2.8, 0.42, 1.1, 0x5a4a30),
  ]);
  stallGroup.add(mergedMesh([tableTop, tableLegs.geometry.translate(0,0,0)]).clone());
  // Re-merge cleanly
  const stallMesh = mergedMesh([tableTop, box(0.2, 0.85, 0.2, -2.8, 0.42, -1.1, 0x5a4a30), box(0.2, 0.85, 0.2, 2.8, 0.42, -1.1, 0x5a4a30), box(0.2, 0.85, 0.2, -2.8, 0.42, 1.1, 0x5a4a30), box(0.2, 0.85, 0.2, 2.8, 0.42, 1.1, 0x5a4a30)]);
  stallGroup.add(stallMesh);

  // Backboard (where goods are displayed)
  const backboard = box(6, 1.6, 0.2, 0, 1.7, -1.2, 0xbfb088);
  stallGroup.add(backboard);

  // Type-specific props
  if (type === "fabric") {
    // Colorful fabric rolls stacked on the table
    const fabricColors = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6, 0xe67e22, 0x1abc9c];
    for (let i = 0; i < 6; i++) {
      const roll = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 1.5, 12),
        new THREE.MeshLambertMaterial({ color: fabricColors[i % fabricColors.length] })
      );
      roll.rotation.z = Math.PI / 2;
      roll.position.set(-2.4 + i * 0.85, 1.05, -0.2);
      roll.castShadow = true;
      stallGroup.add(roll);
    }
    // Hanging fabric behind the stall
    for (let i = 0; i < 4; i++) {
      const hang = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 1.8),
        new THREE.MeshLambertMaterial({
          color: fabricColors[(i + 3) % fabricColors.length],
          side: THREE.DoubleSide,
        })
      );
      hang.position.set(-2 + i * 1.3, 2.4, -1.1);
      stallGroup.add(hang);
    }
  } else if (type === "spice") {
    // Bowls of spices (red pepper, yellow curry, brown nutmeg)
    const spices = [
      { color: 0xc0392b, name: "pepper" },
      { color: 0xf2b134, name: "curry" },
      { color: 0x8a5a3c, name: "nutmeg" },
      { color: 0xd98e2b, name: "turmeric" },
      { color: 0x2c3e50, name: "iron pot" },
    ];
    for (let i = 0; i < 5; i++) {
      const bowl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.25, 0.2, 12),
        new THREE.MeshLambertMaterial({ color: 0xe8e0d0 })
      );
      bowl.position.set(-2.2 + i * 1.0, 1.0, 0);
      stallGroup.add(bowl);
      const spice = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 0.1, 12),
        new THREE.MeshLambertMaterial({ color: spices[i].color })
      );
      spice.position.set(-2.2 + i * 1.0, 1.13, 0);
      stallGroup.add(spice);
    }
    // Sack of dried pepper behind
    const sack = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xc8b890 })
    );
    sack.scale.y = 0.8;
    sack.position.set(0, 1.5, -1.0);
    stallGroup.add(sack);
  } else if (type === "tailor") {
    // Sewing machine table
    const machine = mergedMesh([
      box(1.2, 0.6, 0.8, 0, 1.25, 0, 0x222222),
      box(0.6, 0.4, 0.4, -0.3, 1.7, 0, 0x555555),
      box(0.1, 0.3, 0.1, 0.1, 1.85, 0, 0xaa8855),
    ]);
    stallGroup.add(machine);
    // Mannequin
    const mannequin = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.3, 1.0, 4, 8),
      new THREE.MeshLambertMaterial({ color: 0xe8c547 })
    );
    mannequin.position.set(1.8, 1.4, -0.5);
    stallGroup.add(mannequin);
    // Tape measure hanging
    const tape = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.6, 0.02),
      new THREE.MeshLambertMaterial({ color: 0xf2b134 })
    );
    tape.position.set(-1.8, 2.2, -1.0);
    stallGroup.add(tape);
  } else if (type === "food") {
    // Three black pots on the table
    const foodColors = [0x4a2a10, 0xd4a020, 0xc0392b]; // tuwo, jollof, stew
    for (let i = 0; i < 3; i++) {
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.35, 0.55, 12),
        new THREE.MeshLambertMaterial({ color: 0x222222 })
      );
      pot.position.set(-1.5 + i * 1.5, 1.25, 0);
      stallGroup.add(pot);
      const food = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 0.08, 12),
        new THREE.MeshLambertMaterial({ color: foodColors[i] })
      );
      food.position.set(-1.5 + i * 1.5, 1.55, 0);
      stallGroup.add(food);
    }
    // Steaming pot (mist particle plane)
    const steam = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 })
    );
    steam.position.set(0, 2.0, 0);
    stallGroup.add(steam);
  }

  // Small per-stall canopy (awnings over the seller)
  const canopy = new THREE.Mesh(
    new THREE.PlaneGeometry(6.5, 3),
    new THREE.MeshLambertMaterial({
      color: [0xc0392b, 0xf2b134, 0x1d5fa8, 0x2e7d4f][Math.floor(R() * 4)],
      side: THREE.DoubleSide,
    })
  );
  canopy.rotation.x = -Math.PI / 2 + 0.3;
  canopy.position.set(0, 3.0, 1.5);
  stallGroup.add(canopy);

  return {
    group: stallGroup,
    collider: { minX: x - 3, maxX: x + 3, minZ: z - 1.5, maxZ: z + 1.5 },
  };
}

function _buildBasket(R) {
  const basketGroup = new THREE.Group();
  // Woven basket (truncated cone)
  const basket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.35, 0.5, 10),
    new THREE.MeshLambertMaterial({ color: 0xa08050 })
  );
  basket.position.y = 0.25;
  basketGroup.add(basket);
  // Produce on top (tomatoes / peppers / onions)
  const produceColors = [0xc0392b, 0xe74c3c, 0xf2b134, 0xffffff];
  for (let i = 0; i < 6; i++) {
    const item = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 6, 4),
      new THREE.MeshLambertMaterial({ color: produceColors[Math.floor(R() * produceColors.length)] })
    );
    item.position.set(
      (R() - 0.5) * 0.6,
      0.55,
      (R() - 0.5) * 0.6
    );
    basketGroup.add(item);
  }
  return basketGroup;
}

// ---- Haggling mini-game ----
function _startHaggle(ctx) {
  // Quick prompt-based haggle: seller asks a price, player counters
  const askPrice = 2000 + Math.floor(Math.random() * 3000);
  const fairPrice = Math.floor(askPrice * 0.6);
  const playerOffer = prompt(
    "Mama Nkechi: \"My sister, this Ankara na ₦" + askPrice.toLocaleString() + ". You know say na quality.\"\n\n" +
    "Your offer (₦):", fairPrice
  );
  if (playerOffer === null) return;
  const offer = parseInt(playerOffer, 10);
  if (isNaN(offer)) { ctx.toast("Enter a number"); return; }
  if (offer < fairPrice * 0.5) {
    ctx.toast("Mama Nkechi: \"Haba! You wan price me out of business?\"");
  } else if (offer < fairPrice) {
    ctx.toast("Mama Nkechi: \"Add small money, my customer.\"");
  } else if (offer <= askPrice) {
    const saving = askPrice - offer;
    ctx.toast("✓ Deal at ₦" + offer.toLocaleString() + "! You saved ₦" + saving.toLocaleString());
    if (ctx.game) {
      // Pay for the fabric
      if (ctx.game.state.money >= offer) {
        ctx.game.state.money -= offer;
        ctx.game.state.needs.fun = Math.min(100, (ctx.game.state.needs.fun || 0) + 8);
        ctx.updateHUD?.();
      } else {
        ctx.toast("Not enough money!");
      }
    }
  } else {
    ctx.toast("Mama Nkechi: \"God bless you, my customer!\"");
  }
}
