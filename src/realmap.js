// src/realmap.js — Real Kaduna map loader.
// Fetches /data/kaduna.json, builds real road network + river + buildings.
// Falls back gracefully to procedural world if data fails to load.
// © OpenStreetMap contributors (ODbL) — see CREDITS.md
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const ROAD_COLORS = { primary: 0x4a4a4a, secondary: 0x555a60, tertiary: 0x6a6a6a, residential: 0x7a7a7a };

export async function fetchKadunaData() {
  try {
    const res = await fetch("/data/kaduna.json");
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.roads || !data.buildings) return null;
    return data;
  } catch (e) { return null; }
}

export function buildRealMap(scene, data) {
  if (!data) return null;
  const group = new THREE.Group();
  group.name = "real_kaduna";
  const colliders = [];
  const mapShapes = { buildings: [], trees: [], roads: [] };

  // Ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 400), new THREE.MeshLambertMaterial({ color: 0x9aab62 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  group.add(ground);

  // Roads (merged by type)
  const roadGeosByType = { primary: [], secondary: [], tertiary: [], residential: [] };
  for (const road of data.roads) {
    const type = road.type in roadGeosByType ? road.type : "residential";
    const width = road.width || 8;
    for (let i = 0; i < road.points.length - 1; i++) {
      const [x1, z1] = road.points[i], [x2, z2] = road.points[i + 1];
      const dx = x2 - x1, dz = z2 - z1, len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.1) continue;
      const geo = new THREE.PlaneGeometry(width, len);
      geo.rotateX(-Math.PI / 2);
      geo.rotateY(-Math.atan2(dx, dz));
      geo.translate((x1 + x2) / 2, 0.02, (z1 + z2) / 2);
      roadGeosByType[type].push(geo);
    }
    mapShapes.roads.push({ type, width, points: road.points });
  }
  for (const [type, geos] of Object.entries(roadGeosByType)) {
    if (!geos.length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ color: ROAD_COLORS[type] }));
    mesh.receiveShadow = true; group.add(mesh);
    geos.forEach(g => g.dispose());
  }

  // Water
  if (data.water) {
    const waterGeos = [];
    for (const polygon of data.water) {
      if (polygon.length < 3) continue;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const [x, z] of polygon) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (z < minZ) minZ = z; if (z > maxZ) maxZ = z; }
      const w = maxX - minX, d = maxZ - minZ;
      if (w < 1 || d < 1) continue;
      const geo = new THREE.PlaneGeometry(w, d);
      geo.rotateX(-Math.PI / 2);
      geo.translate((minX + maxX) / 2, 0.01, (minZ + maxZ) / 2);
      waterGeos.push(geo);
    }
    if (waterGeos.length) {
      const waterMesh = new THREE.Mesh(mergeGeometries(waterGeos), new THREE.MeshLambertMaterial({ color: 0x2a6a9a, transparent: true, opacity: 0.85 }));
      group.add(waterMesh);
      waterGeos.forEach(g => g.dispose());
    }
  }

  // Buildings
  const buildingGeos = [];
  const palette = [0xf1e6cf, 0xe8d3b0, 0xd9a273, 0xf4f1ea, 0xcfe0c5, 0xe9c9a4, 0xf0d8c8, 0xc7d9e6, 0xe2b98f];
  for (const b of data.buildings) {
    const h = 3 + b.levels * 3;
    const color = palette[Math.abs(Math.floor(b.x * 7 + b.z * 13)) % palette.length];
    const geo = new THREE.BoxGeometry(b.w, h, b.d);
    geo.translate(b.x, h / 2, b.z);
    const c = new THREE.Color(color);
    const col = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < geo.attributes.position.count; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    buildingGeos.push(geo);
    colliders.push({ minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2 });
    mapShapes.buildings.push({ x: b.x, z: b.z, w: b.w, d: b.d });
  }
  if (buildingGeos.length) {
    const buildingsMesh = new THREE.Mesh(mergeGeometries(buildingGeos), new THREE.MeshLambertMaterial({ vertexColors: true }));
    buildingsMesh.receiveShadow = true; group.add(buildingsMesh);
    buildingGeos.forEach(g => g.dispose());
  }

  scene.add(group);
  return { group, colliders, mapShapes, dispose() { scene.remove(group); group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach(x => x.dispose()); } }); } };
}
