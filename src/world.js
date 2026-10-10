// src/world.js — improved Kaduna world with detailed buildings, landmarks, market
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ROAD_HALF, WORLD_HALF_X, CROSSINGS, SIDE_STREETS, rng } from "./config.js";

const C = (hex) => new THREE.Color(hex);

function windowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 128, 128);
  g.fillStyle = "#e9e4d8"; g.fillRect(0, 118, 128, 10);
  // window with reflection
  g.fillStyle = "#4a6177"; g.fillRect(34, 28, 60, 58);
  g.fillStyle = "#9db8cc"; g.fillRect(36, 30, 56, 26);
  g.fillStyle = "#ffffff"; g.fillRect(63, 28, 3, 58);
  g.fillStyle = "#c9c2b2"; g.fillRect(30, 86, 68, 6);
  // AC unit
  g.fillStyle = "#8a8f96"; g.fillRect(40, 76, 14, 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 2;
  return t;
}

export function labelTexture(text, w = 512, h = 128, bg = "#0f4d3a", fg = "#ffffff", size = 64) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
  g.fillStyle = fg; g.font = `700 ${size}px Poppins, Arial, sans-serif`;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, w / 2, h / 2 + 4, w - 40);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function windowBox(w, h, d, color) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, pos = g.attributes.position, nor = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    if (ny > 0.5) { uv.setXY(i, 0.04, 0.04); continue; }
    const u = nx > 0.5 ? pos.getZ(i) : pos.getX(i);
    uv.setXY(i, u / 3.4 + 0.5, (pos.getY(i) + h / 2) / 3.6);
  }
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { col[i*3] = color.r; col[i*3+1] = color.g; col[i*3+2] = color.b; }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

function part(w, h, d, x, y, z, hex) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

export function buildWorld(scene) {
  const R = rng(20241010);
  const colliders = [];
  const mapShapes = { buildings: [], trees: [], sideStreets: SIDE_STREETS.slice(), crossings: CROSSINGS.slice(), stalls: [] };
  const world = new THREE.Group();
  scene.add(world);

  // ---- ground ----
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 700), new THREE.MeshLambertMaterial({ color: 0x9aab62 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  world.add(ground);

  // ---- road ----
  const asphalt = new THREE.MeshLambertMaterial({ color: 0x3a3d43 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_HALF_X * 2 + 200, ROAD_HALF * 2), asphalt);
  road.rotation.x = -Math.PI / 2; road.position.y = 0.01; road.receiveShadow = true;
  world.add(road);

  for (const sx of SIDE_STREETS) {
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(12, 120), asphalt);
    sp.rotation.x = -Math.PI / 2; sp.position.set(sx, 0.012, 0); sp.receiveShadow = true;
    world.add(sp);
  }

  // sidewalks with kerb edge
  const paveMat = new THREE.MeshLambertMaterial({ color: 0xd2bf9c });
  for (const side of [1, -1]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(WORLD_HALF_X * 2 + 200, 0.16, 6), paveMat);
    s.position.set(0, 0.08, side * (ROAD_HALF + 3)); s.receiveShadow = true; world.add(s);
    // kerb edge
    const ke = new THREE.Mesh(new THREE.BoxGeometry(WORLD_HALF_X * 2 + 200, 0.22, 0.3), new THREE.MeshLambertMaterial({ color: 0xaaa49a }));
    ke.position.set(0, 0.11, side * ROAD_HALF); world.add(ke);
  }
  // median
  const kerb = new THREE.Mesh(new THREE.BoxGeometry(WORLD_HALF_X * 2 + 200, 0.2, 2.3), new THREE.MeshLambertMaterial({ color: 0xcfcfc8 }));
  kerb.position.y = 0.1; world.add(kerb);
  const medGrass = new THREE.Mesh(new THREE.BoxGeometry(WORLD_HALF_X * 2 + 200, 0.05, 1.8), new THREE.MeshLambertMaterial({ color: 0x5f9a45 }));
  medGrass.position.y = 0.22; world.add(medGrass);

  // lane markings
  const white = new THREE.MeshBasicMaterial({ color: 0xf2f2ee });
  const dashCount = Math.floor((WORLD_HALF_X * 2) / 8);
  const dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(3, 0.22).rotateX(-Math.PI / 2), white, dashCount * 2);
  const m4 = new THREE.Matrix4();
  let di = 0;
  for (const z of [4.5, -4.5]) for (let i = 0; i < dashCount; i++) { m4.makeTranslation(-WORLD_HALF_X + i * 8 + 2, 0.025, z); dashes.setMatrixAt(di++, m4); }
  world.add(dashes);
  for (const z of [7.7, -7.7]) {
    const e = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_HALF_X * 2 + 200, 0.18).rotateX(-Math.PI / 2), white);
    e.position.set(0, 0.026, z); world.add(e);
  }
  // zebra crossings
  const bars = [];
  for (const cx of CROSSINGS) for (let z = -7; z <= 7; z += 1.3) if (Math.abs(z) > 1.4) bars.push([cx, z]);
  const zebra = new THREE.InstancedMesh(new THREE.PlaneGeometry(3.6, 0.65).rotateX(-Math.PI / 2), white, bars.length);
  bars.forEach(([x, z], i) => { m4.makeTranslation(x, 0.03, z); zebra.setMatrixAt(i, m4); });
  world.add(zebra);

  // ---- buildings with rooftops, AC units, shop fronts ----
  const palette = [0xf1e6cf, 0xe8d3b0, 0xd9a273, 0xf4f1ea, 0xcfe0c5, 0xe9c9a4, 0xf0d8c8, 0xc7d9e6, 0xe2b98f];
  const awningColors = [0x0f4d3a, 0xc0392b, 0xf2b134, 0x1d5fa8, 0x7a3b8f];
  const geos = [];
  const addBuilding = (x, z, w, d, h, color, faceSign) => {
    geos.push(windowBox(w, h, d, color).translate(x, h / 2, z));
    // roof parapet
    geos.push(windowBox(w + 0.3, 0.5, d + 0.3, C(0xb5a68b)).translate(x, h + 0.25, z));
    // rooftop water tank (common in Kaduna)
    if (R() < 0.4) {
      geos.push(part(1.5, 1.5, 1.5, x + (R()-0.5)*w*0.5, h + 1.5, z + (R()-0.5)*d*0.5, 0x4a90d9));
    }
    // rooftop AC unit
    if (R() < 0.3) {
      geos.push(part(0.8, 0.4, 0.8, x + (R()-0.5)*w*0.4, h + 0.7, z + (R()-0.5)*d*0.4, 0x8a8f96));
    }
    // shop awning on road-facing side
    const az = z - faceSign * (d / 2 + 0.7);
    geos.push(windowBox(w * 0.9, 0.25, 1.6, C(awningColors[Math.floor(R() * awningColors.length)])).translate(x, 3.1, az));
    // shop sign board
    if (R() < 0.5) {
      const signColors = [0x0f4d3a, 0xc0392b, 0x1d5fa8];
      geos.push(part(w * 0.6, 0.8, 0.1, x, 4.2, az + faceSign * 0.8, signColors[Math.floor(R() * signColors.length)]));
    }
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    mapShapes.buildings.push({ x, z, w, d });
  };
  for (const side of [1, -1]) {
    let x = -WORLD_HALF_X + 20;
    while (x < WORLD_HALF_X - 20) {
      const w = 12 + R() * 14;
      const cx = x + w / 2;
      const nearSide = SIDE_STREETS.some((sx) => Math.abs(cx - sx) < w / 2 + 8);
      const nearMosque = side === 1 && cx > 25 && cx < 70;
      const nearMarket = side === -1 && cx > -50 && cx < -10;
      const nearPetrol = side === 1 && cx > -120 && cx < -95;
      if (!nearSide && !nearMosque && !nearMarket && !nearPetrol) {
        const d = 12 + R() * 10;
        const h = 7 + Math.floor(R() * 5) * 3.6 + (R() < 0.12 ? 14 : 0);
        addBuilding(cx, side * (17 + d / 2), w, d, h, C(palette[Math.floor(R() * palette.length)]), side);
      }
      x += w + 3 + R() * 5;
    }
  }
  for (const sx of SIDE_STREETS) for (const side of [1, -1]) addBuilding(sx, side * 62, 26, 12, 16, C(0xe8d3b0), side);
  const bMat = new THREE.MeshLambertMaterial({ map: windowTexture(), vertexColors: true });
  const buildings = new THREE.Mesh(mergeGeometries(geos), bMat);
  buildings.castShadow = true; buildings.receiveShadow = true;
  world.add(buildings);

  // ---- Central Mosque ----
  {
    const mx = 48, mz = 34;
    const hall = new THREE.Mesh(new THREE.BoxGeometry(34, 8, 22), new THREE.MeshLambertMaterial({ color: 0xf4f1ea }));
    hall.position.set(mx, 4, mz); hall.castShadow = true; hall.receiveShadow = true; world.add(hall);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(8, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x1f7a5a }));
    dome.position.set(mx, 8, mz); dome.castShadow = true; world.add(dome);
    // crescent on top
    const crescent = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.15, 8, 16, Math.PI), new THREE.MeshLambertMaterial({ color: 0xf2b134 }));
    crescent.position.set(mx, 17, mz); crescent.rotation.x = Math.PI / 2; world.add(crescent);
    for (const dx of [-20, 20]) {
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 26, 10), new THREE.MeshLambertMaterial({ color: 0xf4f1ea }));
      tw.position.set(mx + dx, 13, mz - 8); tw.castShadow = true; world.add(tw);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(2, 4, 10), new THREE.MeshLambertMaterial({ color: 0x1f7a5a }));
      cap.position.set(mx + dx, 28, mz - 8); world.add(cap);
    }
    colliders.push({ minX: mx - 17, maxX: mx + 17, minZ: mz - 11, maxZ: mz + 11 });
    mapShapes.buildings.push({ x: mx, z: mz, w: 34, d: 22, landmark: true });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshBasicMaterial({ map: labelTexture("CENTRAL MOSQUE", 512, 128, "#0f4d3a", "#ffffff", 52) }));
    sign.position.set(mx, 9.8, mz - 11.1); sign.rotation.y = Math.PI; world.add(sign);
  }

  // ---- Market stalls (Kaduna landmark) ----
  {
    const marketX = -30, marketZ = -25;
    const stallColors = [0xc0392b, 0xf2b134, 0x1d5fa8, 0x0f4d3a, 0x7a3b8f];
    for (let i = 0; i < 8; i++) {
      const sx = marketX + (i % 4) * 6 - 9;
      const sz = marketZ + Math.floor(i / 4) * 5;
      // stall frame
      const frame = part(4, 2.5, 3, sx, 1.25, sz, 0x8a6a45);
      const merged = mergeGeometries([frame,
        part(4.2, 0.15, 3.2, sx, 2.6, sz, stallColors[i % stallColors.length]),
        part(3.8, 1.8, 0.1, sx, 1.6, sz + 1.5, 0xf4f1ea),
        part(3.5, 0.8, 1, sx, 0.8, sz, 0xd2bf9c)
      ]);
      const stall = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true }));
      stall.castShadow = true; world.add(stall);
      colliders.push({ minX: sx - 2, maxX: sx + 2, minZ: sz - 1.5, maxZ: sz + 1.5 });
      mapShapes.stalls.push({ x: sx, z: sz });
    }
    // market sign
    const msign = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: labelTexture("MARKET", 256, 64, "#f2b134", "#12261e", 36) }));
    msign.position.set(marketX + 3, 3.5, marketZ - 3); world.add(msign);
  }

  // ---- Petrol station ----
  {
    const px = -110, pz = 28;
    const canopy = part(16, 0.3, 8, px, 5, pz, 0x0f4d3a);
    const canopyLegs = mergeGeometries([
      part(0.4, 5, 0.4, px - 7, 2.5, pz - 3, 0x555a60),
      part(0.4, 5, 0.4, px + 7, 2.5, pz - 3, 0x555a60),
      part(0.4, 5, 0.4, px - 7, 2.5, pz + 3, 0x555a60),
      part(0.4, 5, 0.4, px + 7, 2.5, pz + 3, 0x555a60),
    ]);
    // fuel pumps
    const pumps = mergeGeometries([
      part(0.8, 1.5, 0.6, px - 3, 0.75, pz, 0xe11d48),
      part(0.8, 1.5, 0.6, px + 3, 0.75, pz, 0xe11d48),
    ]);
    const merged = mergeGeometries([canopy, canopyLegs, pumps]);
    const station = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true }));
    station.castShadow = true; world.add(station);
    colliders.push({ minX: px - 8, maxX: px + 8, minZ: pz - 4, maxZ: pz + 4 });
    mapShapes.buildings.push({ x: px, z: pz, w: 16, d: 8, landmark: true });
    const psign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: labelTexture("PETROL", 256, 64, "#e11d48", "#ffffff", 36) }));
    psign.position.set(px, 5.5, pz - 4.1); psign.rotation.y = Math.PI; world.add(psign);
  }

  // ---- Keke park ----
  {
    const kx = 60, kz = -28;
    const shelter = mergeGeometries([
      part(8, 0.2, 4, kx, 2.8, kz, 0xf2b134),
      part(0.3, 2.8, 0.3, kx - 3.5, 1.4, kz - 1.5, 0x555a60),
      part(0.3, 2.8, 0.3, kx + 3.5, 1.4, kz - 1.5, 0x555a60),
      part(0.3, 2.8, 0.3, kx - 3.5, 1.4, kz + 1.5, 0x555a60),
      part(0.3, 2.8, 0.3, kx + 3.5, 1.4, kz + 1.5, 0x555a60),
      part(7, 1.5, 0.1, kx, 1.5, kz + 2, 0xbfd8e6),
    ]);
    const parkMesh = new THREE.Mesh(shelter, new THREE.MeshLambertMaterial({ vertexColors: true }));
    parkMesh.castShadow = true; world.add(parkMesh);
    const ksign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.2), new THREE.MeshBasicMaterial({ map: labelTexture("KEKE PARK", 256, 64, "#f2b134", "#12261e", 32) }));
    ksign.position.set(kx, 3.2, kz - 2.1); world.add(ksign);
  }

  // ---- trees: neem on pavements, palms on median ----
  const trunks = [], crowns = [];
  for (let x = -WORLD_HALF_X + 10; x < WORLD_HALF_X; x += 13) {
    if (CROSSINGS.some((c) => Math.abs(c - x) < 3.5)) continue;
    trunks.push([x, 0, 0, 5.2, 0.22]);
    crowns.push([x, 5.4, 0, 2.4, 0x2f8f3f, 0.5]);
  }
  for (let x = -WORLD_HALF_X + 18; x < WORLD_HALF_X; x += 17 + R() * 8) {
    for (const side of [1, -1]) {
      if (SIDE_STREETS.some((s) => Math.abs(x - s) < 8) || CROSSINGS.some((c) => Math.abs(x - c) < 4)) continue;
      const z = side * (ROAD_HALF + 5.2);
      trunks.push([x, z, 0, 2.6, 0.25]);
      crowns.push([x, 3.6, z, 2.3 + R() * 0.8, R() < 0.5 ? 0x3d8c3a : 0x4f9c43, 1]);
      mapShapes.trees.push({ x, z });
    }
  }
  {
    const tm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.7, 1, 1, 6).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: 0x7a5a3a }), trunks.length);
    trunks.forEach(([x, z, , h, r], i) => {
      m4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(r, h, r));
      tm.setMatrixAt(i, m4);
    });
    tm.castShadow = true; world.add(tm);
    const cm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), crowns.length);
    crowns.forEach(([x, y, z, s, col, flat], i) => {
      m4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(s, s * (flat === 0.5 ? 0.45 : 0.8), s));
      cm.setMatrixAt(i, m4); cm.setColorAt(i, C(col));
    });
    cm.castShadow = true; world.add(cm);
  }

  // ---- street lights ----
  const lampPos = [];
  for (let x = -WORLD_HALF_X + 12; x < WORLD_HALF_X; x += 24) for (const side of [1, -1]) lampPos.push([x, side * (ROAD_HALF + 0.7), side]);
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.1, 6.2, 6).translate(0, 3.1, 0), new THREE.MeshLambertMaterial({ color: 0x4a4f55 }), lampPos.length);
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.18, 0.45).translate(-0.6, 0, 0), new THREE.MeshBasicMaterial({ color: 0x555555 }), lampPos.length);
  lampPos.forEach(([x, z, side], i) => {
    m4.makeTranslation(x, 0, z); poles.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x, 6.2, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), side > 0 ? 0 : Math.PI), new THREE.Vector3(1, 1, 1));
    heads.setMatrixAt(i, m4);
  });
  world.add(poles, heads);

  // ---- bus stops + billboards ----
  const busStopTex = labelTexture("BUS STOP", 256, 64, "#f2b134", "#12261e", 36);
  for (const [bx, side] of [[-40, 1], [30, -1], [120, 1], [-130, -1]]) {
    const z = side * (ROAD_HALF + 4.6);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(5, 0.2, 2.2), new THREE.MeshLambertMaterial({ color: 0x0f4d3a })); roof.position.set(bx, 2.6, z);
    const back = new THREE.Mesh(new THREE.BoxGeometry(5, 2.4, 0.1), new THREE.MeshLambertMaterial({ color: 0xbfd8e6, transparent: true, opacity: 0.55 })); back.position.set(bx, 1.3, z + side * 1);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.15, 0.6), new THREE.MeshLambertMaterial({ color: 0x8a6a45 })); bench.position.set(bx, 0.55, z + side * 0.5);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: busStopTex })); sg.position.set(bx, 3.0, z - side * 1.12); sg.rotation.y = side > 0 ? Math.PI : 0;
    world.add(roof, back, bench, sg);
  }
  const boards = [["WELCOME TO KADUNA", "#0f4d3a", -60, 1], ["CENTRE OF LEARNING", "#1d5fa8", 100, -1], ["KADUNA LIFESTYLE", "#c0392b", -150, 1], ["EAT WELL LIVE WELL", "#7a3b8f", 10, -1]];
  for (const [txt, bg, bx, side] of boards) {
    const z = side * (ROAD_HALF + 10.5);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 5, 6), new THREE.MeshLambertMaterial({ color: 0x555a60 })); post.position.set(bx, 2.5, z);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.4), new THREE.MeshBasicMaterial({ map: labelTexture(txt, 512, 192, bg, "#ffffff", 54), side: THREE.DoubleSide })); panel.position.set(bx, 6.4, z);
    world.add(post, panel);
    colliders.push({ minX: bx - 0.3, maxX: bx + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
  }

  return { world, colliders, mapShapes, lamps: heads, ground, buildingsMesh: buildings };
}
