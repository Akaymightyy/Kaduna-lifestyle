// src/places/manager.js
// Place Manager — orchestrates enter/exit transitions, hides the world while
// inside a place, and routes per-frame update() to the active place.
//
// Each place module exports: build(scene, ctx) -> PlaceHandle
//   PlaceHandle = {
//     group: THREE.Group,         // added to scene in build()
//     enter(playerState): Promise<void> | void,
//     exit(): Promise<void> | void,
//     update(dt, now): void,
//     dispose(): void,
//     onUIEvent?(id, payload): void,   // optional
//   }

import { buildPlace, getPlace, isPlaceOpen, listPlaces, disposePlace } from "./registry.js";

const _state = {
  active: null,
  placeHandle: null,
  worldGroup: null,
  scene: null,
  fadeOverlay: null,
  promptEl: null,
  ctx: null,
};

const PROMPT_DISTANCE = 6;
const FADE_MS = 320;

export function initPlaceManager({ scene, worldGroup, ctx }) {
  _state.scene = scene;
  _state.worldGroup = worldGroup;
  _state.ctx = ctx;

  if (!document.getElementById("place-fade")) {
    const f = document.createElement("div");
    f.id = "place-fade";
    f.style.cssText =
      "position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;" +
      "z-index:60;transition:opacity " + FADE_MS + "ms ease;";
    document.body.appendChild(f);
  }
  _state.fadeOverlay = document.getElementById("place-fade");

  if (!document.getElementById("place-prompt")) {
    const p = document.createElement("div");
    p.id = "place-prompt";
    p.style.cssText =
      "position:fixed;left:50%;bottom:calc(40% + env(safe-area-inset-bottom));" +
      "transform:translateX(-50%);background:rgba(15,77,58,.92);color:#fff;" +
      "padding:10px 18px;border-radius:14px;font:600 13px Poppins,sans-serif;" +
      "box-shadow:0 4px 14px rgba(0,0,0,.3);display:none;z-index:30;" +
      "border:1px solid rgba(255,255,255,.2);text-align:center;max-width:90vw;" +
      "cursor:pointer;";
    document.body.appendChild(p);
  }
  _state.promptEl = document.getElementById("place-prompt");
}

// Live map while you are inside a house: show the city again (and hide the room) so the map is not a brown void.
export function peekWorld(on) {
  if (!_state.active) return;
  if (_state.worldGroup) _state.worldGroup.visible = !!on;
  if (_state.placeHandle && _state.placeHandle.group) _state.placeHandle.group.visible = !on;
}
export function getActivePlace() {
  return _state.active ? { id: _state.active, handle: _state.placeHandle } : null;
}

export function tickEntrancePrompt(playerX, playerZ, gameHour) {
  if (_state.active) {
    _state.promptEl.style.display = "block";
    _state.promptEl.innerHTML =
      '🚪 Press here 🟢 to leave';
    return;
  }
  for (const def of listPlaces()) {
    const dx = def.entranceX - playerX, dz = def.entranceZ - playerZ;
    if (dx * dx + dz * dz > PROMPT_DISTANCE * PROMPT_DISTANCE) continue;
    const open = isPlaceOpen(def, gameHour);
    if (!open) {
      _state.promptEl.style.display = "block";
      _state.promptEl.innerHTML =
        '🔒 ' + def.name + ' <span style="opacity:.7;">(closed)</span>';
    } else {
      _state.promptEl.style.display = "block";
      _state.promptEl.innerHTML =
        '🚪 Enter <b style="color:#f2b134;">' + def.name +
        '</b> &nbsp;<span style="color:#4ade80;font-weight:600;">Press here 🟢</span>';
    }
    return;
  }
  _state.promptEl.style.display = "none";
}

export async function handleInteractKey(playerState, gameHour) {
  if (_state.active) {
    await exitPlace(playerState);
    return true;
  }
  const def = _findPlaceNear(playerState.pos.x, playerState.pos.z);
  if (!def) return false;
  if (!isPlaceOpen(def, gameHour)) {
    _state.ctx.toast(def.name + " is closed right now.");
    return true;
  }
  await enterPlace(def.id, playerState);
  return true;
}

function _findPlaceNear(x, z) {
  for (const def of listPlaces()) {
    const dx = def.entranceX - x, dz = def.entranceZ - z;
    if (dx * dx + dz * dz < PROMPT_DISTANCE * PROMPT_DISTANCE) return def;
  }
  return null;
}

export async function enterPlace(id, playerState) {
  if (_state.active) {
    console.warn("Already inside a place:", _state.active);
    return;
  }
  const def = getPlace(id);
  if (!def) throw new Error("Unknown place id: " + id);

  // BUGFIX: hide the per-plot knock prompt from the world before fading in.
  // We do NOT hide `place-prompt` here because THAT is the "Press here to
  // leave" button when inside a place — hiding it would trap the player.
  // (Earlier version hid both, which is why the player couldn't leave the
  // house after entering as a visitor.)
  document.getElementById("plot-knock-prompt")?.style.setProperty("display", "none");
  document.getElementById("owner-knock-prompt")?.style.setProperty("display", "none");

  await _fadeTo(1);

  // ---- For the player's home: always dispose the old instance so it rebuilds
  // fresh with the current player's furniture + home tier. Without this, the
  // home would be cached and show the wrong furniture when switching accounts. ----
  if (id === "home") {
    try { await disposePlace("home"); } catch (e) { console.warn("home dispose", e); }
  }

  let handle;
  try {
    handle = await buildPlace(id, _state.scene, _state.ctx);
  } catch (e) {
    console.error("Failed to build place", id, e);
    _state.ctx.toast("Could not load " + def.name);
    await _fadeTo(0);
    return;
  }

  if (_state.worldGroup) _state.worldGroup.visible = false;

  if (handle.enter) {
    try { await handle.enter(playerState); } catch (e) { console.warn(e); }
  }
  handle.group.visible = true;

  _state.active = id;
  _state.placeHandle = handle;

  await _fadeTo(0);
  _state.ctx.toast("📍 " + def.name);
  if (_state.ctx.onPlaceChange) _state.ctx.onPlaceChange(def);
}

// FEATURE: Enter ANOTHER player's house as a visitor.
// Sets ctx.visitingHouse before building so home.js loads the visited house's
// furniture (read from houses/{areaId}/{plotNo}/furniture — readable by anyone
// per the rules). Clears it on exit so the next home entry uses the owner path.
//
// `houseInfo` shape: { ownerUid, ownerName, areaId, plotNo }
export async function enterPlaceAsVisitor(houseInfo, playerState) {
  if (_state.active) {
    console.warn("Already inside a place:", _state.active);
    return false;
  }
  if (!houseInfo || !houseInfo.areaId || houseInfo.plotNo == null || !houseInfo.ownerUid) {
    _state.ctx?.toast?.("⚠️ Cannot visit — no house info.");
    return false;
  }
  // Stash on ctx so home.js picks it up
  _state.ctx.visitingHouse = {
    ownerUid: houseInfo.ownerUid,
    ownerName: houseInfo.ownerName || "Friend",
    areaId: houseInfo.areaId,
    plotNo: houseInfo.plotNo,
  };
  // The home place's def name shows in the toast + chip — update it
  const home = getPlace("home");
  if (home) home.name = houseInfo.ownerName + "'s Home";
  let ok = false;
  try {
    await enterPlace("home", playerState);
    ok = true;
  } catch (e) {
    console.error("Visitor entry failed:", e);
    _state.ctx.toast("Could not visit — try again");
    ok = false;
  }
  return ok;
}

export async function exitPlace(playerState) {
  if (!_state.active) return;
  const def = getPlace(_state.active);
  const handle = _state.placeHandle;

  await _fadeTo(1);

  if (handle?.exit) {
    try { await handle.exit(); } catch (e) { console.warn(e); }
  }
  if (handle?.group) handle.group.visible = false;

  if (_state.worldGroup) _state.worldGroup.visible = true;

  if (def) {
    playerState.pos.set(def.entranceX, 0, def.entranceZ);
    playerState.heading = def.entranceFacing;
  }

  _state.active = null;
  _state.placeHandle = null;

  // FEATURE: clear visitor context on exit so the next home entry uses the
  // owner path. Also restore the home place name.
  if (_state.ctx.visitingHouse) {
    _state.ctx.visitingHouse = null;
    const home = getPlace("home");
    if (home) home.name = "My Home";
  }

  await _fadeTo(0);
  if (_state.ctx.onPlaceChange) _state.ctx.onPlaceChange(null);
}

export function updateActive(dt, now) {
  if (_state.placeHandle?.update) {
    try { _state.placeHandle.update(dt, now); } catch (e) { console.warn(e); }
  }
}

export function sendUIEvent(eventId, payload) {
  if (_state.placeHandle?.onUIEvent) {
    _state.placeHandle.onUIEvent(eventId, payload);
  }
}

export async function travelToPlaceEntrance(id, playerState, opts = {}) {
  const def = getPlace(id);
  if (!def) throw new Error("Unknown place id: " + id);
  playerState.pos.set(def.entranceX, 0, def.entranceZ);
  playerState.heading = def.entranceFacing;
  if (opts.autoEnter) await enterPlace(id, playerState);
}

function _fadeTo(opacity) {
  return new Promise((resolve) => {
    const el = _state.fadeOverlay;
    if (!el) { resolve(); return; }
    el.style.opacity = String(opacity);
    el.style.pointerEvents = opacity > 0.5 ? "auto" : "none";
    setTimeout(resolve, FADE_MS);
  });
}

let _keyBound = false;
export function bindInteractKey(getPlayerState, getGameHour) {
  if (_keyBound) return;
  _keyBound = true;
  window.addEventListener("keydown", (e) => {
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return; // typing in login / chat
    if (e.key === "e" || e.key === "E" || e.key === "Enter") {
      const ps = getPlayerState();
      if (!ps) return;
      handleInteractKey(ps, getGameHour());
    }
  });
  _state.promptEl?.addEventListener("click", () => {
    const ps = getPlayerState();
    if (!ps) return;
    handleInteractKey(ps, getGameHour());
  });
}
