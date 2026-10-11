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

import { buildPlace, getPlace, isPlaceOpen, listPlaces } from "./registry.js";

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

export function getActivePlace() {
  return _state.active ? { id: _state.active, handle: _state.placeHandle } : null;
}

export function tickEntrancePrompt(playerX, playerZ, gameHour) {
  if (_state.active) {
    _state.promptEl.style.display = "block";
    _state.promptEl.innerHTML =
      '🚪 Press <b style="background:#fff;color:#0f4d3a;padding:2px 8px;border-radius:6px;">E</b> to leave';
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
        '</b> &nbsp;Press <b style="background:#fff;color:#0f4d3a;padding:2px 8px;border-radius:6px;">E</b>';
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

  await _fadeTo(1);

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
