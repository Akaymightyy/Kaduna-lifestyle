// src/places/mechanic.js — Sani Motors Mechanic Workshop (Nov 4).
//
// Claude's fix-list #2: "Mechanic and repair shop: now that cars get damaged
// and wrecked, players need a place to fix them."
//
// The repair LOGIC already lives in vehicles.js (damage persists per owned
// vehicle until you pay; repairCost scales with how hurt the car is). What was
// missing is the PLACE. This is a full interior: car lift with a car on it,
// tool wall, workbench, oil drums, tyre stacks, and Sani the mechanic.
//
// The "Repair garage" activity opens an overlay listing every vehicle you own
// with its condition + repair price + a Fix button (money moves through the
// anti-cheat transaction in vehicles.js repairVehicle()).

import * as THREE from "three";
import { box, mergedMesh, signMesh, floor, interiorLights, disposeGroup } from "./_helpers.js";
import { rng } from "../config.js";
import { spawnPeople } from "./people.js";
import { getOwned, vehHealth, repairCost, repairVehicle, getVehicle } from "../vehicles.js";
import { runGig } from "../gigs.js";   // Nov 4: daily mechanic gig

let _built = false, _cache = null;
let _overlayEl = null, _overlayCtx = null;

// ---- Repair overlay (self-contained DOM, like dealership_ui) ----
function _ensureOverlay(ctx) {
  _overlayCtx = ctx;
  if (_overlayEl) return;
  _overlayEl = document.createElement("div");
  _overlayEl.id = "mech-overlay";
  _overlayEl.style.cssText =
    "position:fixed;inset:0;z-index:46;display:none;flex-direction:column;" +
    "background:rgba(20,24,28,.97);color:#fff;font-family:Poppins,system-ui,sans-serif;" +
    "overflow-y:auto;-webkit-overflow-scrolling:touch;";
  document.body.appendChild(_overlayEl);
}

function _healthColor(label) {
  if (label === "Perfect") return "#4ade80";
  if (label === "Scratched") return "#a3e635";
  if (label === "Dented") return "#f2b134";
  if (label === "Smoking") return "#fb923c";
  return "#e11d48"; // Wrecked
}

function _renderOverlay() {
  if (!_overlayEl) return;
  const ctx = _overlayCtx;
  const owned = Object.keys(getOwned() || {});
  let rows = "";
  if (!owned.length) {
    rows = '<div style="text-align:center;padding:30px 10px;color:#9ca3af;font-size:13px;">You no get any car yet.<br>Go <b style="color:#f2b134">Kaduna Motors</b> buy one, then bring am here when e spoil 😄</div>';
  } else {
    rows = owned.map((id) => {
      const v = getVehicle(id) || {};
      const { hp, label } = vehHealth(id);
      const cost = repairCost(id);
      const col = _healthColor(label);
      const perfect = hp >= 100;
      return (
        '<div style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #374151;border-radius:12px;margin-bottom:8px;background:rgba(255,255,255,.04);">' +
          '<div style="font-size:26px;line-height:1;">' + (v.emoji || "🚗") + "</div>" +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (v.name || id) + "</div>" +
            '<div style="display:flex;align-items:center;gap:6px;margin-top:4px;">' +
              '<div style="flex:1;height:6px;border-radius:3px;background:#374151;overflow:hidden;">' +
                '<div style="width:' + hp + "%;height:100%;background:" + col + ';"></div>' +
              "</div>" +
              '<span style="font-size:10px;font-weight:700;color:' + col + ';white-space:nowrap;">' + label + " " + hp + "%</span>" +
            "</div>" +
            (perfect ? "" : '<div style="font-size:10px;color:#9ca3af;margin-top:3px;">Repair na ₦' + cost.toLocaleString() + "</div>") +
          "</div>" +
          (perfect
            ? '<span style="font-size:11px;color:#4ade80;font-weight:700;">👌 Fresh</span>'
            : '<button data-mech-fix="' + id + '" style="background:linear-gradient(145deg,#f2b134,#d98e2b);color:#1a1a1a;border:none;border-radius:9px;padding:9px 14px;cursor:pointer;font:700 12px Poppins,sans-serif;white-space:nowrap;">🔧 Fix</button>') +
        "</div>"
      );
    }).join("");
  }
  _overlayEl.innerHTML =
    '<div style="max-width:520px;width:100%;margin:0 auto;padding:18px 16px calc(20px + env(safe-area-inset-bottom));">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
        '<div style="font-size:17px;font-weight:800;">🔧 Sani Motors — Repair Bay</div>' +
        '<button id="mech-close" style="background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:8px;padding:7px 12px;cursor:pointer;font:600 12px Poppins,sans-serif;">✕ Close</button>' +
      "</div>" +
      '<div style="background:rgba(242,177,52,.12);border-left:3px solid #f2b134;border-radius:8px;padding:9px 12px;font-size:11.5px;color:#d1d5db;margin-bottom:12px;">"Bring your car — we go fix am sharp sharp. Wrecked engine na more money o!" — Sani</div>' +
      rows +
    "</div>";
  _overlayEl.style.display = "flex";
  _overlayEl.querySelector("#mech-close").onclick = closeMechanicUI;
  _overlayEl.querySelectorAll("[data-mech-fix]").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.getAttribute("data-mech-fix");
      btn.disabled = true; btn.textContent = "⏳ …";
      const ok = await repairVehicle(id, ctx?.game?.state, ctx?.toast);
      if (ok) { ctx?.updateHUD?.(); _renderOverlay(); }
      else _renderOverlay();
    };
  });
}

export function closeMechanicUI() {
  if (_overlayEl) { _overlayEl.style.display = "none"; _overlayEl.innerHTML = ""; }
}

export async function build(scene, ctx) {
  if (_built) return _cache;
  const R = rng(20251104);
  const group = new THREE.Group();
  group.name = "mechanic"; group.visible = false;

  // ---- floor: stained concrete + oil puddles ----
  group.add(floor(30, 22, 0x54565a));
  for (let i = 0; i < 7; i++) {
    const stain = new THREE.Mesh(new THREE.CircleGeometry(0.4 + R() * 0.7, 12), new THREE.MeshLambertMaterial({ color: 0x1c1d20 }));
    stain.rotation.x = -Math.PI / 2;
    stain.position.set(-12 + R() * 24, 0.012, -8 + R() * 16);
    group.add(stain);
  }

  // ---- walls + roof ----
  group.add(mergedMesh([
    box(30, 4.2, 0.4, 0, 2.1, -11, 0x7a6a52),
    box(30, 4.2, 0.4, 0, 2.1, 11, 0x7a6a52),
    box(0.4, 4.2, 22, -15, 2.1, 0, 0x6f6049),
    box(0.4, 4.2, 22, 15, 2.1, 0, 0x6f6049),
  ]));
  group.add(mergedMesh([box(30.6, 0.3, 22.6, 0, 4.35, 0, 0x3a3d42)]));
  // open shutter door on the south wall (visual slats above the entrance gap)
  for (let i = 0; i < 5; i++) group.add(mergedMesh([box(6, 0.16, 0.12, 0, 3.0 + i * 0.28, 10.85, 0xb8860b)]));

  // ---- car lift with a car on it (centerpiece) ----
  const lift = new THREE.Group();
  lift.position.set(-6, 0, -2);
  lift.add(mergedMesh([
    box(5.4, 0.25, 2.8, 0, 1.15, 0, 0x2a2d33),               // raised platform
    box(0.5, 1.05, 0.5, -2.2, 0.52, 0.9, 0xe8741c),           // legs
    box(0.5, 1.05, 0.5, 2.2, 0.52, 0.9, 0xe8741c),
    box(0.5, 1.05, 0.5, -2.2, 0.52, -0.9, 0xe8741c),
    box(0.5, 1.05, 0.5, 2.2, 0.52, -0.9, 0xe8741c),
  ]));
  // the car sitting on the lift (simple body + cabin, wheels hanging)
  lift.add(mergedMesh([
    box(4.2, 0.55, 1.7, 0, 1.58, 0, 0x1d5fa8),
    box(2.2, 0.5, 1.55, -0.2, 2.05, 0, 0x2a3a4a),
    box(0.55, 0.4, 0.25, -1.35, 1.05, 0.8, 0x15171a),
    box(0.55, 0.4, 0.25, 1.35, 1.05, 0.8, 0x15171a),
    box(0.55, 0.4, 0.25, -1.35, 1.05, -0.8, 0x15171a),
    box(0.55, 0.4, 0.25, 1.35, 1.05, -0.8, 0x15171a),
  ]));
  group.add(lift);

  // ---- tool wall (north) ----
  const board = mergedMesh([box(8, 2.4, 0.12, -4, 2.1, -10.7, 0x4a4f55)]);
  group.add(board);
  const toolColors = [0xc0392b, 0xf2b134, 0xf2f2ee, 0xe8741c, 0x9aa0a6, 0x2e7d4f];
  for (let i = 0; i < 12; i++) {
    const tool = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5 + R() * 0.5, 0.08), new THREE.MeshLambertMaterial({ color: toolColors[i % toolColors.length] }));
    tool.position.set(-7.5 + i * 0.66, 2.0 + (i % 3) * 0.35, -10.6);
    tool.rotation.z = (R() - 0.5) * 0.5;
    group.add(tool);
  }
  // pegboard shelf with jerrycans + oil tins
  group.add(mergedMesh([
    box(4, 0.12, 0.6, 6, 1.9, -10.6, 0x5a4a30),
    box(0.5, 0.7, 0.35, 5, 2.35, -10.6, 0xf2b134),
    box(0.5, 0.7, 0.35, 5.8, 2.35, -10.6, 0xc0392b),
    box(0.4, 0.5, 0.3, 6.7, 2.3, -10.6, 0x9aa0a6),
  ]));

  // ---- workbench (east) ----
  group.add(mergedMesh([
    box(4.5, 0.14, 1.1, 11.5, 0.95, 2, 0x8a6a45),
    box(0.15, 0.9, 0.9, 9.5, 0.45, 2, 0x5a4a30),
    box(0.15, 0.9, 0.9, 13.5, 0.45, 2, 0x5a4a30),
  ]));
  // engine block + parts on the bench
  group.add(mergedMesh([
    box(1.0, 0.7, 0.8, 11.0, 1.4, 2, 0x6a7077),
    box(0.35, 0.35, 0.35, 12.3, 1.25, 2, 0x2a2d33),
    box(0.7, 0.2, 0.4, 12.6, 1.15, 2.6, 0xb8860b),
  ]));

  // ---- oil drums (corner) ----
  for (let i = 0; i < 4; i++) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.95, 12), new THREE.MeshLambertMaterial({ color: i % 2 ? 0xe8741c : 0x2e4a2e }));
    drum.position.set(-13.6 + (i % 2) * 0.85, 0.48, 8.5 + Math.floor(i / 2) * 0.9);
    group.add(drum);
  }

  // ---- tyre stacks (west wall) ----
  for (let s = 0; s < 2; s++) {
    for (let i = 0; i < 4; i++) {
      const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.18, 8, 14), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
      tyre.rotation.x = Math.PI / 2;
      tyre.position.set(-13.8 + s * 1.1, 0.2 + i * 0.36, -6 + s * 2.2);
      group.add(tyre);
    }
  }

  // ---- waiting stools + cooler (customers gist here) ----
  group.add(mergedMesh([
    box(0.4, 0.45, 0.4, 4, 0.22, 8, 0xc0392b),
    box(0.4, 0.45, 0.4, 5, 0.22, 8, 0x1d5fa8),
    box(0.7, 0.8, 0.5, 6.2, 0.4, 8, 0x2e7d4f),
  ]));

  // ---- sign + lights ----
  const sign = signMesh("SANI MOTORS — MECHANIC", 10, 1.2, { width: 420, height: 52, bg: "#14181c", fg: "#f2b134", size: 26 });
  sign.position.set(0, 4.9, 10.7); group.add(sign);
  group.add(interiorLights({
    ambient: 0.85,
    points: [
      { x: -6, y: 3.6, z: -2, color: 0xfff0d8, intensity: 0.9, distance: 10 },
      { x: 6, y: 3.6, z: -6, color: 0xfff0d8, intensity: 0.6, distance: 9 },
      { x: 0, y: 3.6, z: 6, color: 0xfff0d8, intensity: 0.6, distance: 10 },
    ],
  }));

  // ---- colliders ----
  const colliders = [
    { minX: -9.2, maxX: -2.8, minZ: -3.6, maxZ: -0.4 },   // car lift
    { minX: -8.5, maxX: 0.5, minZ: -11, maxZ: -10.2 },    // tool wall board
    { minX: 4.2, maxX: 7.8, minZ: -11, maxZ: -10.1 },     // shelf
    { minX: 9.2, maxX: 14, minZ: 1.3, maxZ: 2.7 },        // workbench
    { minX: -14.4, maxX: -12.4, minZ: 7.8, maxZ: 9.6 },   // drums
    { minX: -14.6, maxX: -12.9, minZ: -7.2, maxZ: -3.4 }, // tyres
    { minX: 3.6, maxX: 6.6, minZ: 7.6, maxZ: 8.4 },       // stools + cooler
  ];
  scene.add(group);

  let _people = null;
  spawnPeople(group, [
    { id: "mech1", name: "Sani", role: "mechanic", outfit: "casual", pose: "stand", x: -3.4, z: -1.6, ry: Math.PI / 2, top: "#e8741c" },
    { id: "mech2", name: "Customer", role: "customer", outfit: "kaftan", pose: "sit", x: 4, z: 8, ry: 0 },
  ]).then((p) => { _people = p; });

  const handle = {
    group, colliders,
    enter(ps) { ps.pos.set(0, 0, 9.5); ps.heading = Math.PI; },
    exit() { closeMechanicUI(); },
    update(dt, now, px, pz) { if (_people) _people.update(dt, now, px, pz); },
    dispose() {
      closeMechanicUI();
      if (_people) _people.dispose();
      scene.remove(group); disposeGroup(group);
      _built = false; _cache = null;
    },
    people: () => _people,
    onUIEvent(eid) {
      if (eid === "mechanic_gig") runGig("mechanic_gig", ctx);
      else if (eid === "repair_menu") { _ensureOverlay(ctx); _renderOverlay(); }
      else if (eid === "mechanic_chat" && ctx) {
        const lines = [
          "🗣️ Sani: 'Your shock absorber don weak — drive small small o!'",
          "🗣️ Sani: 'Fuel price high but my hand no dey shake.'",
          "🗣️ Sani: 'Bring the Ferrari next week — I wan see am.'",
        ];
        ctx.toast(lines[Math.floor(Math.random() * lines.length)]);
      }
    },
  };
  _built = true; _cache = handle; return handle;
}
