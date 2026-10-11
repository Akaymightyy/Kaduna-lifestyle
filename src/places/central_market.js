// src/places/central_market.js
// Kaduna Central Market interior.
// Layout: 4 rows of stalls under tarpaulin roofs, narrow aisles, central
// walkway. Each row has a different vendor type (fabric, spice, tailor, food).
// Hand-built props: tarpaulin roof, fabric rolls, spice baskets, sewing
// machine, food pots. Haggling mini-game at the fabric stall.

import * as THREE from "three";
import { box, mergedMesh, signMesh, floor, interiorLights, disposeGroup } from "./_helpers.js";
import { rng } from "../config.js";
import { spawnPeople, getNamedDialogue, getDialogue } from "./people.js";

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

  // perimeter walls (so the player and camera stay inside)
  colliders.push({ minX: -30.2, maxX: 30.2, minZ: -20.2, maxZ: -19.8 }, { minX: -30.2, maxX: 30.2, minZ: 19.8, maxZ: 20.2 }, { minX: -30.2, maxX: -29.8, minZ: -20, maxZ: 20 }, { minX: 29.8, maxX: 30.2, minZ: -20, maxZ: 20 });

  // ---- PlaceHandle ----
  // ---- People: 5 sellers behind stalls + 9 shoppers walking routes + 2 sitting ----
  let _people = null;
  const sellerSpecs = [
    { id: "seller1", name: "Mama Nkechi", role: "fabric seller", outfit: "casual", pose: "stand", x: -18, z: -12.5, ry: Math.PI, top: "#c0392b" },
    { id: "seller2", name: "Alhaji Sani", role: "spice trader", outfit: "kaftan", pose: "stand", x: 0, z: -12.5, ry: Math.PI, top: "#9fc2d9" },
    { id: "seller3", name: "Aunty Bisi", role: "tailor", outfit: "casual", pose: "stand", x: 18, z: -12.5, ry: Math.PI, top: "#2e7d4f" },
    { id: "seller4", name: "Iya Basira", role: "food corner", outfit: "casual", pose: "stand", x: -18, z: 14.5, ry: 0, top: "#d98e2b" },
    { id: "seller5", name: "Mallam Yusuf", role: "vegetable seller", outfit: "kaftan", pose: "stand", x: 18, z: 14.5, ry: 0, top: "#f4efe4" },
  ];
  const shopperSpecs = [];
  for (let i = 0; i < 9; i++) {
    const zLane = [-9, 0, 9][i % 3];
    shopperSpecs.push({ id: "shopper" + i, name: "Shopper", role: "shopper", outfit: i % 3 === 0 ? "kaftan" : "casual", pose: "stand", x: -22 + (i * 5), z: zLane, ry: 0, route: [{ x: -22 + (i * 5), z: zLane }, { x: 22 - (i * 4), z: zLane }, { x: 22 - (i * 4), z: zLane + (i % 2 ? 4 : -4) }, { x: -22 + (i * 5), z: zLane + (i % 2 ? 4 : -4) }], speed: 0.6 + (i % 3) * 0.2 });
  }
  const sittingSpecs = [
    { id: "sitter1", name: "Customer", role: "customer", outfit: "casual", pose: "sit", x: -8, z: 16, ry: 0 },
    { id: "sitter2", name: "Customer", role: "customer", outfit: "kaftan", pose: "sit", x: 8, z: 16, ry: Math.PI },
  ];
  spawnPeople(group, [...sellerSpecs, ...shopperSpecs, ...sittingSpecs]).then((p) => { _people = p; });

  const handle = {
    group,
    enter(playerState) {
      // Position player at the entrance, facing in
      playerState.pos.set(0, 0, 8);
      playerState.heading = Math.PI;
    },
    exit() { /* nothing to clean up beyond dispose */ },
    update(dt, now, px, pz) {
      if (_people) _people.update(dt, now, px, pz);
      // Future: NPC animations, fan rotations, etc.
    },
    dispose() {
      if (_people) _people.dispose();
      scene.remove(group);
      disposeGroup(group);
      _built = false;
      _cache = null;
    },
    onUIEvent(eventId, payload) {
      if (eventId === "talk" && payload?.personId) _talk(ctx, payload.personId);
      if (eventId === "haggle") _startHaggle(ctx);
    },
    people: () => _people,
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
  stallGroup.add(mergedMesh([backboard]));

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

// ---- Haggling mini-game (toast-based, no prompt()) ----
function _startHaggle(ctx) {
  const askPrice = 2000 + Math.floor(Math.random() * 3000);
  const fairPrice = Math.floor(askPrice * 0.6);
  const offer = fairPrice;
  ctx.toast('Mama Nkechi: "Ankara na ₦' + askPrice.toLocaleString() + '. You haggle well — ₦' + offer.toLocaleString() + ' final!"');
  if (ctx.game) {
    if (ctx.game.state.money >= offer) {
      ctx.game.state.money -= offer;
      ctx.game.state.needs.fun = Math.min(100, (ctx.game.state.needs.fun || 0) + 8);
      ctx.game.state.needs.social = Math.min(100, (ctx.game.state.needs.social || 0) + 3);
      ctx.game.save?.();
      ctx.updateHUD?.();
      setTimeout(() => ctx.toast('✓ Ankara bought for ₦' + offer.toLocaleString() + '!'), 1500);
    } else {
      setTimeout(() => ctx.toast('Not enough money! Need ₦' + offer.toLocaleString()), 1500);
    }
  }
}

// ---- Talk to a person ----
function _talk(ctx, personId) {
  const handle = _cache;
  if (!handle?.people) return;
  const people = handle.people();
  if (!people) return;
  const person = people.getPersonById?.(personId);
  if (!person) return;
  const line = getNamedDialogue(person.name) || getDialogue(person.role, person.name);
  ctx.toast("\u{1F4AC} " + person.name + ': "' + line + '"');
  if (ctx.game) {
    ctx.game.state.needs.social = Math.min(100, (ctx.game.state.needs.social || 0) + 1);
    ctx.game.save?.();
    ctx.updateHUD?.();
  }
}
