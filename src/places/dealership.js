// src/places/dealership.js — Kaduna Motors luxury car showroom.
//
// Layout: indoor showroom with polished tile floor, glass walls, neon sign
// ("KADUNA MOTORS — Premium Autos"), 4 cars on display pedestals, and a
// salesman NPC (Alhaji Manga) near the entrance.
//
// When the player walks near a car pedestal, a prompt appears: "Press E to
// view [Car Name]". Pressing E opens the dealership_ui.js catalogue overlay
// with full specs + Buy / Test Drive / Close buttons.
//
// Buying a car deducts money via the existing buyVehicle() flow. After
// buying, the car is added to the player's owned vehicles and can be
// spawned/rided from the existing Cars phone app — no special "drive out"
// flow needed (player just spawns the car outside the showroom and rides).
//
// "Park at house" is deferred to a later session — for now, owned cars
// appear in the Cars app and can be spawned at any time.

import * as THREE from "three";
import { box, mergedMesh, signMesh, floor, interiorLights, disposeGroup } from "./_helpers.js";
import { getShowroomCars } from "../dealership_catalog.js";
import { openDealershipUI, initDealershipUI } from "../dealership_ui.js";
import { buildRemoteVehicleMesh } from "../vehicles.js";

let _built = false;
let _cache = null;
const _carMeshes = []; // { car, group, mesh }

export async function build(scene, ctx) {
  if (_built) return _cache;
  const group = new THREE.Group();
  group.name = "dealership";
  group.visible = false;

  // ---- Floor: polished dark tile ----
  const floorMesh = floor(40, 30, 0x1a1a1a, 1);
  group.add(floorMesh);

  // ---- Walls: glass on the south side (entrance), concrete elsewhere ----
  // Concrete back wall (north)
  group.add(mergedMesh([
    box(40, 4, 0.3, 0, 2, -15, 0x0a3b2a),
  ]));
  // Side walls (east + west)
  group.add(mergedMesh([
    box(0.3, 4, 30, -20, 2, 0, 0x0a3b2a),
    box(0.3, 4, 30, 20, 2, 0, 0x0a3b2a),
  ]));
  // Glass front wall (south) — transparent so you can see in from outside
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x88c0d0, transparent: true, opacity: 0.25,
    roughness: 0.05, metalness: 0.1, transmission: 0.7,
  });
  const glassFront = new THREE.Mesh(
    new THREE.BoxGeometry(36, 3.5, 0.05),
    glassMat
  );
  glassFront.position.set(0, 1.75, 15);
  group.add(glassFront);
  // Glass door gap (in the middle of the south wall) — just visual gap
  // (no actual door mesh needed since the player enters from outside the
  // showroom and is teleported to the entrance position)

  // ---- Neon sign above entrance ----
  const sign = signMesh("KADUNA MOTORS", 14, 1.8, {
    bg: "#0f4d3a", fg: "#f2b134", size: 78, border: true,
  });
  sign.position.set(0, 4.2, 14.95);
  sign.material.side = THREE.DoubleSide;
  group.add(sign);
  // Sub-sign
  const subSign = signMesh("Premium Autos · Since 1985", 8, 0.6, {
    bg: "#0a3b2a", fg: "#9ec9b0", size: 24, border: false,
  });
  subSign.position.set(0, 3.2, 14.95);
  subSign.material.side = THREE.DoubleSide;
  group.add(subSign);

  // ---- Lighting rig ----
  group.add(interiorLights({ ambient: 0.95 }));
  // Strip lights overhead (gold + green — Nigerian flag colours)
  for (let i = -15; i <= 15; i += 10) {
    const stripGeo = new THREE.BoxGeometry(8, 0.1, 0.4);
    const stripMat = new THREE.MeshBasicMaterial({ color: i % 20 === 0 ? 0xf2b134 : 0x4ade80 });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(i, 4.5, 0);
    group.add(strip);
  }
  // Spotlights over each car pedestal (just visual — no real light cost)
  const spotMat = new THREE.MeshBasicMaterial({ color: 0xfff0b0 });
  const spotGeo = new THREE.CircleGeometry(0.4, 16);
  for (let i = 0; i < 4; i++) {
    const spot = new THREE.Mesh(spotGeo, spotMat);
    spot.rotation.x = Math.PI;
    spot.position.set(-12 + i * 8, 4.4, 0);
    group.add(spot);
  }

  // ---- 4 cars on display pedestals ----
  const showroomCars = getShowroomCars();
  const pedestalPositions = [
    { x: -12, z: 0 },
    { x: -4, z: 0 },
    { x: 4, z: 0 },
    { x: 12, z: 0 },
  ];
  for (let i = 0; i < showroomCars.length; i++) {
    const car = showroomCars[i];
    const pos = pedestalPositions[i];

    // Pedestal (rotating disc)
    const pedestalGroup = new THREE.Group();
    pedestalGroup.position.set(pos.x, 0, pos.z);
    // Disc
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(2.5, 2.5, 0.1, 24),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    disc.position.y = 0.05;
    pedestalGroup.add(disc);
    // Ring under disc (gold)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.5, 0.06, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xf2b134 })
    );
    ring.position.y = 0.11;
    ring.rotation.x = Math.PI / 2;
    pedestalGroup.add(ring);
    // Car name plate in front of pedestal
    const plate = signMesh(car.name, 3, 0.5, {
      bg: "#0a0a0a", fg: "#f2b134", size: 18, border: false,
    });
    plate.position.set(0, 0.2, 2.7);
    pedestalGroup.add(plate);
    // Price plate below
    const pricePlate = signMesh("₦" + car.price.toLocaleString(), 2.4, 0.4, {
      bg: "#0a0a0a", fg: "#4ade80", size: 16, border: false,
    });
    pricePlate.position.set(0, 0.2, 3.2);
    pedestalGroup.add(pricePlate);
    group.add(pedestalGroup);

    // Car mesh — use buildRemoteVehicleMesh (it builds a fitted Group with
    // the simplified body type as fallback for non-GLB cars)
    const carGroup = new THREE.Group();
    carGroup.position.set(pos.x, 0.15, pos.z);
    carGroup.userData = { car, pedestalIdx: i, isDealershipCar: true };

    // buildRemoteVehicleMesh uses the vehicle's glbPath if set, otherwise
    // falls back to _buildSimplifiedTypes. For our dealership cars (no
    // glbPath), it uses the bodyType. But buildRemoteVehicleMesh takes a
    // VEHICLE_CATALOG id, not our dealership catalog id — so we need to
    // build the mesh ourselves using the simplified types.
    try {
      const mesh = await _buildDealershipCarMesh(car);
      if (mesh) {
        carGroup.add(mesh);
      }
    } catch (e) {
      console.warn("[dealership] failed to build car mesh for", car.id, e.message);
    }

    group.add(carGroup);
    _carMeshes.push({ car, group: carGroup, pedestal: pedestalGroup });
  }

  // ---- Salesman NPC (Alhaji Manga) near the entrance ----
  // Simple capsule placeholder — full NPC model would require importing
  // createCharacter which is async-heavy. Keep it simple for MVP.
  const salesman = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 1.0, 4, 12),
    new THREE.MeshLambertMaterial({ color: 0x1a3b2a })
  );
  body.position.y = 0.9;
  salesman.add(body);
  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 12, 8),
    new THREE.MeshLambertMaterial({ color: 0x8a5a3c })
  );
  head.position.y = 1.85;
  salesman.add(head);
  // Cap (hausau cap)
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.27, 0.15, 12),
    new THREE.MeshLambertMaterial({ color: 0xf2f2ee })
  );
  cap.position.y = 2.05;
  salesman.add(cap);
  salesman.position.set(0, 0, 12);
  salesman.rotation.y = Math.PI; // face the entrance
  salesman.userData = { isSalesman: true };
  group.add(salesman);

  // ---- Salesman sign ----
  const salesmanSign = signMesh("Alhaji Manga — Salesman", 3, 0.4, {
    bg: "#0a3b2a", fg: "#f2b134", size: 16, border: false,
  });
  salesmanSign.position.set(0, 2.4, 12);
  salesmanSign.material.side = THREE.DoubleSide;
  group.add(salesmanSign);

  // ---- Colliders (walls) ----
  const colliders = [
    { minX: -20, maxX: -19.7, minZ: -15, maxZ: 15 },   // west wall
    { minX: 19.7, maxX: 20, minZ: -15, maxZ: 15 },     // east wall
    { minX: -20, maxX: 20, minZ: -15, maxZ: -14.7 },    // north wall
    // South wall has a gap for the entrance (no collider)
  ];

  scene.add(group);

  // ---- Init the dealership UI (lazy) ----
  initDealershipUI(ctx);

  // ---- Tick state ----
  let _rotateT = 0;
  let _promptShownFor = null; // pedestalIdx that's currently in prompt range
  let _promptEl = null;

  // Self-contained prompt UI (doesn't touch the global placeCtx — keeps
  // dealership self-contained and avoids editing main.js).
  function _ensurePromptEl() {
    if (_promptEl) return;
    _promptEl = document.createElement("div");
    _promptEl.style.cssText =
      "position:fixed;left:50%;bottom:calc(40% + env(safe-area-inset-bottom));" +
      "transform:translateX(-50%);background:rgba(15,77,58,.92);color:#fff;" +
      "padding:10px 18px;border-radius:14px;font:600 13px Poppins,sans-serif;" +
      "box-shadow:0 4px 14px rgba(0,0,0,.3);display:none;z-index:30;" +
      "border:1px solid #f2b134;text-align:center;max-width:90vw;cursor:pointer;";
    document.body.appendChild(_promptEl);
  }
  function _showPrompt(text, onClick) {
    _ensurePromptEl();
    _promptEl.textContent = text;
    _promptEl.style.display = "block";
    _promptEl.onclick = onClick;
  }
  function _hidePrompt() {
    if (_promptEl) _promptEl.style.display = "none";
  }

  const handle = {
    group,
    enter(playerState) {
      // Player enters through the south door
      playerState.pos.set(0, 0, 12);
      playerState.heading = Math.PI; // face north (into the showroom)
    },
    exit() {
      _hidePrompt();
    },
    update(dt, now) {
      _rotateT += dt;
      // Rotate each car slowly on its pedestal
      for (const cm of _carMeshes) {
        cm.group.rotation.y += dt * 0.4;
      }
      // Check player proximity to each car → show prompt
      // We get the player position from ctx (if provided) — but ctx may
      // not have playerPos, so wrap in try/catch and fall back gracefully.
      let p = null;
      try { p = ctx?.playerPos?.(); } catch (e) {}
      if (!p && ctx?.camera) {
        // Fall back to camera position (close enough for proximity check
        // since the camera follows the player from behind)
        p = { x: ctx.camera.position.x, z: ctx.camera.position.z };
      }
      if (p) {
        let nearest = null;
        let nearestDist = 6; // 6m proximity
        for (let i = 0; i < _carMeshes.length; i++) {
          const cm = _carMeshes[i];
          const dx = p.x - cm.group.position.x;
          const dz = p.z - cm.group.position.z;
          const d = Math.sqrt(dx * dx + dz * dz);
          if (d < nearestDist) {
            nearest = i;
            nearestDist = d;
          }
        }
        if (nearest !== _promptShownFor) {
          _promptShownFor = nearest;
          if (nearest !== null) {
            const car = _carMeshes[nearest].car;
            _showPrompt(`Press E (or tap) to view ${car.name} — ₦${car.price.toLocaleString()}`, () => {
              openDealershipUI(car);
            });
          } else {
            _hidePrompt();
          }
        }
      }
    },
    dispose() {
      _hidePrompt();
      if (_promptEl) { _promptEl.remove(); _promptEl = null; }
      scene.remove(group);
      disposeGroup(group);
      _built = false;
      _cache = null;
      _carMeshes.length = 0;
    },
    onUIEvent(eventId, payload) {
      if (eventId === "view_car") {
        const car = _carMeshes.find(c => c.car.id === payload?.id)?.car;
        if (car) openDealershipUI(car);
      }
    },
    colliders,
    // Exposed for main.js prompt system to call when player taps a car
    _carMeshes,
  };

  _built = true;
  _cache = handle;
  return handle;
}

// ---- Build a car mesh from a dealership catalog entry ----
// Uses the simplified body type builders (sedan/suv/sports/etc) and applies
// the dealership car's bodyColor + accentColor.
async function _buildDealershipCarMesh(car) {
  if (!car.bodyType) return null;
  // We need to import the simplified types builder from vehicles.js — but
  // it's a private function (_buildSimplifiedTypes). Use buildRemoteVehicleMesh
  // with a fake vehicle id that maps to the bodyType (e.g. "sedan", "suv",
  // "sports"). This works because those IDs are in VEHICLE_CATALOG.
  const fakeVehicleId = car.bodyType; // sedan, suv, sports, etc are all catalog ids
  const mesh = await buildRemoteVehicleMesh(fakeVehicleId);
  if (!mesh) return null;
  // Recolor the mesh to the dealership car's body color
  mesh.traverse((o) => {
    if (o.isMesh && o.material && o.material.color) {
      // Only recolor the body material (not lights, glass, etc)
      // The simplified builders use vertex colors, so we set the material
      // color to white and let vertex colors paint it. To override,
      // we'd need to rebuild the geometry. For now, scale the mesh + tint.
      o.material.color.setHex(car.bodyColor);
      o.material.vertexColors = false; // override vertex colors with material color
      o.material.needsUpdate = true;
    }
  });
  // Scale to look like a display model (slightly smaller for the pedestal)
  mesh.scale.setScalar(0.9);
  return mesh;
}
