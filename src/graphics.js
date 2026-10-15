// src/graphics.js — Graphics upgrade: Sky shader + clouds + tone mapping + quality.
//
// Uses the Three.js Sky addon (three/addons/objects/Sky.js) for a realistic
// day/night sky with sun position. Adds cheap cloud billboards. Sets up ACES
// tone mapping + sRGB colour space. Provides a quality setting (Low/Medium/High)
// that the player can change in Settings.
//
// PERFORMANCE:
// - The Sky mesh is a single shader-pass on a box geometry — very cheap.
// - Sun position is updated only when the game hour changes (not every frame).
// - Clouds are 4 billboard sprites that drift slowly — ~4 draw calls total.
// - No per-frame cube camera renders (the official example re-renders reflections
//   every frame; we skip that entirely — it's for reflective water, which we don't have).

import { setArtQuality } from "./art/style.js";
import * as THREE from "three";
// Sky addon is loaded lazily inside initGraphics() so the game doesn't crash
// if the addon fails to load (e.g. on older browsers or bundler issues).
let Sky = null;

let _sky = null;
let _clouds = null;
let _sunSphere = null;
let _renderer = null;
let _scene = null;
let _sun = null;       // the DirectionalLight
let _hemi = null;      // the HemisphereLight
let _lastHour = -1;
let _quality = "medium"; // low | medium | high

// ---- Quality presets ----
export const QUALITY_PRESETS = {
  low:    { pixelRatio: 1.0, shadowMap: 0,    antialias: false, fogNear: 35, fogFar: 85,  shadows: false, clouds: false, skyShader: false },
  medium: { pixelRatio: 1.5, shadowMap: 1024, antialias: false, fogNear: 50, fogFar: 130, shadows: true,  clouds: true,  skyShader: true  },
  high:   { pixelRatio: 2.0, shadowMap: 2048, antialias: true,  fogNear: 60, fogFar: 160, shadows: true,  clouds: true,  skyShader: true  },
};

export function getQuality() { return _quality; }
export function setQuality(q) { _quality = q; }

// ---- Init the sky + clouds ----
export async function initGraphics({ renderer, scene, sun, hemi, quality }) {
  _renderer = renderer;
  _scene = scene;
  _sun = sun;
  _hemi = hemi;
  _quality = quality || "medium";

  // ---- ACES tone mapping + sRGB ----
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // ---- Sky shader (only if quality allows) — lazy-load the addon ----
  if (QUALITY_PRESETS[_quality].skyShader) {
    try {
      const skyMod = await import("three/addons/objects/Sky.js");
      Sky = skyMod.Sky || skyMod.default;
      if (Sky) {
        _sky = new Sky();
        _sky.scale.setScalar(450000);
        _scene.add(_sky);
        const skyUniforms = _sky.material.uniforms;
        skyUniforms["turbidity"].value = 8;
        skyUniforms["rayleigh"].value = 2;
        skyUniforms["mieCoefficient"].value = 0.005;
        skyUniforms["mieDirectionalG"].value = 0.8;
      }
    } catch (e) { console.warn("Sky addon failed to load:", e.message); }
  }

  // ---- Clouds (cheap billboards) ----
  if (QUALITY_PRESETS[_quality].clouds) {
    _clouds = _createClouds();
    _scene.add(_clouds);
  }

  // ---- Sun sphere (visible disc) — only on high ----
  if (_quality === "high") {
    const sunGeo = new THREE.SphereGeometry(20, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff2d6, fog: false });
    _sunSphere = new THREE.Mesh(sunGeo, sunMat);
    _scene.add(_sunSphere);
  }
}

// ---- Create cloud billboards ----
function _createClouds() {
  const group = new THREE.Group();
  group.name = "clouds";
  // Cloud texture: simple radial gradient on a canvas
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,0.8)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.4)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);

  // 6 cloud sprites at different positions + scales
  for (let i = 0; i < 6; i++) {
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.7, fog: false, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(
      (Math.random() - 0.5) * 300,
      40 + Math.random() * 20,
      (Math.random() - 0.5) * 300
    );
    const s = 20 + Math.random() * 30;
    sprite.scale.set(s, s * 0.6, 1);
    sprite.userData.driftSpeed = 0.5 + Math.random() * 0.5;
    sprite.userData.startX = sprite.position.x;
    group.add(sprite);
  }
  return group;
}

// ---- Update sky + sun based on game hour ----
// Called from main.js applyTime(). Only re-calculates when the hour changes
// (not every frame) to save CPU.
export function updateSky(hour) {
  const h = Math.floor(hour * 10) / 10; // quantize to 0.1h = 6min
  if (h === _lastHour) return;
  _lastHour = h;

  // ---- Sun position from hour ----
  // 6am = sunrise (east, low), 12pm = noon (overhead), 6pm = sunset (west, low), midnight = below
  const sunAngle = ((h - 6) / 24) * Math.PI * 2; // 0 at 6am, PI at 6pm
  const elevation = Math.sin(sunAngle) * 0.5 + 0.3; // -0.2 (night) to 0.8 (noon)
  const azimuth = Math.cos(sunAngle); // -1 (west) to 1 (east)

  // ---- Sky shader uniforms ----
  if (_sky && _sky.material && _sky.material.uniforms) {
    try {
    const phi = THREE.MathUtils.degToRad(90 - elevation * 90); // 0=horizon, 90=zenith
    const theta = THREE.MathUtils.degToRad(azimuth * 180);
    const sunPos = new THREE.Vector3();
    sunPos.setFromSphericalCoords(1, phi, theta);
    if (_sky.material.uniforms["sunPosition"]) _sky.material.uniforms["sunPosition"].value.copy(sunPos);
    // BUGFIX: removed `_sky.material.uniforms["exposure"].value = ...` — the Three.js
    // Sky addon does NOT have an "exposure" uniform (exposure is a renderer-level setting,
    // set via renderer.toneMappingExposure in initGraphics). Setting it threw
    // "Cannot set properties of undefined (setting 'value')" every time updateSky()
    // fired (every 6 game-minutes = every 6 real seconds with TIME_SCALE=1).
    // That was the red error banner at the top of the screen the user reported.

    // Adjust turbidity/rayleigh for time of day
    const isNight = elevation < 0.05;
    const isDawnDusk = elevation > 0.05 && elevation < 0.25;
    if (isNight) {
      if (_sky.material.uniforms["rayleigh"]) _sky.material.uniforms["rayleigh"].value = 0.5;
      if (_sky.material.uniforms["turbidity"]) _sky.material.uniforms["turbidity"].value = 0.5;
    } else if (isDawnDusk) {
      if (_sky.material.uniforms["rayleigh"]) _sky.material.uniforms["rayleigh"].value = 3;
      if (_sky.material.uniforms["turbidity"]) _sky.material.uniforms["turbidity"].value = 12;
    } else {
      if (_sky.material.uniforms["rayleigh"]) _sky.material.uniforms["rayleigh"].value = 2;
      if (_sky.material.uniforms["turbidity"]) _sky.material.uniforms["turbidity"].value = 8;
    }
    } catch (e) { /* Sky uniforms not available — sky won't update, no crash */ }
  }

  // ---- Sun light direction + colour ----
  if (_sun) {
    const sunX = Math.cos(sunAngle) * 50;
    const sunY = Math.max(5, elevation * 80);
    const sunZ = 30;
    _sun.position.set(sunX, sunY, sunZ);

    // Sun colour: warm at dawn/dusk, white at noon, dim at night
    const isNight = elevation < 0.05;
    const isDawnDusk = elevation > 0.05 && elevation < 0.25;
    if (isNight) {
      // FIX: brighter moonlight (was 0.1, too dim). 0.18 lets the player see
      // building silhouettes + the road ahead without killing the night mood.
      _sun.intensity = 0.18;
      _sun.color.setHex(0x6a7aaa); // moonlight blue, slightly brighter
    } else if (isDawnDusk) {
      _sun.intensity = 1.2;
      _sun.color.setHex(0xff9a5a); // warm orange
    } else {
      _sun.intensity = 1.8 + elevation;
      _sun.color.setHex(0xfff2d6); // warm white
    }
  }

  // ---- Hemisphere light ----
  if (_hemi) {
    const isNight = elevation < 0.05;
    if (isNight) {
      // FIX: brighter night hemi (was 0.3, too dark — streets were pitch black
      // even with lamps on, players couldn't see anything beyond 10m).
      // Bumped to 0.55 so the player can always see the road, building shapes,
      // and other players, while still feeling like night.
      _hemi.intensity = 0.55;
      _hemi.color.setHex(0x4a5a8a);   // brighter sky-blue
      _hemi.groundColor.setHex(0x2a2a3a);  // less black ground tint
    } else {
      _hemi.intensity = 0.6 + elevation * 0.5;
      _hemi.color.setHex(0xdfeeff);
      _hemi.groundColor.setHex(0x8a7a55);
    }
  }

  // ---- Sun sphere position ----
  if (_sunSphere && _sun) {
    _sunSphere.position.copy(_sun.position).multiplyScalar(3);
    _sunSphere.position.y = Math.max(20, _sunSphere.position.y);
  }

  // ---- Clouds: drift + fade at night ----
  if (_clouds) {
    const isNight = elevation < 0.05;
    for (const cloud of _clouds.children) {
      cloud.position.x += (cloud.userData.driftSpeed || 0.5) * 0.01;
      if (cloud.position.x > 200) cloud.position.x = -200;
      cloud.material.opacity = isNight ? 0.2 : 0.7;
    }
  }

  // ---- Fog colour matches sky ----
  if (_scene.fog) {
    const isNight = elevation < 0.05;
    const isDawnDusk = elevation > 0.05 && elevation < 0.25;
    if (isNight) {
      _scene.fog.color.setHex(0x0b1230);
      _scene.background = new THREE.Color(0x0b1230);
    } else if (isDawnDusk) {
      _scene.fog.color.setHex(0xf08a5d);
      _scene.background = new THREE.Color(0xf08a5d);
    } else {
      _scene.fog.color.setHex(0x9fd4f5);
      _scene.background = new THREE.Color(0x9fd4f5);
    }
  }
}

// ---- Animate clouds (called every frame) ----
export function tickGraphics(dt) {
  if (_clouds) {
    for (const cloud of _clouds.children) {
      cloud.position.x += (cloud.userData.driftSpeed || 0.5) * dt;
      if (cloud.position.x > 200) cloud.position.x = -200;
    }
  }
}

// ---- Apply quality preset to renderer + scene ----
export function applyQuality(q, { renderer, sun, scene }) {
  const preset = QUALITY_PRESETS[q];
  if (!preset) return;
  const prev = _quality;
  _quality = q;
  try { setArtQuality(q); } catch (e) {}

  // The sky shader / clouds / sun disc are the heaviest "pretty" parts: switch them off live on Low (no reload needed)
  if (_sky) _sky.visible = !!preset.skyShader;
  if (_clouds) _clouds.visible = !!preset.clouds;
  if (_sunSphere) _sunSphere.visible = q === "high";
  renderer.setPixelRatio(Math.min(preset.pixelRatio, devicePixelRatio));
  renderer.shadowMap.enabled = preset.shadows;
  if (preset.shadows && sun) {
    // FIX: dispose the old shadow map texture BEFORE changing mapSize, otherwise
    // Three.js keeps the old GPU texture alive and allocates a new one — every
    // quality switch leaks one full shadow map texture (1MB at 1024, 4MB at 2048).
    // This was a major cause of "lag returns shortly after refresh" on Medium/High.
    if (sun.shadow && sun.shadow.map) {
      try { sun.shadow.map.dispose(); } catch (e) { /* non-critical */ }
      sun.shadow.map = null;
    }
    sun.castShadow = true;
    sun.shadow.mapSize.set(preset.shadowMap, preset.shadowMap);
    // After recreating the shadow map, force a fresh render on the next frame
    // so the player doesn't see a black shadow for ~30 seconds.
    _requestShadowUpdate();
  } else if (sun) {
    sun.castShadow = false;
  }
  if (scene.fog) {
    scene.fog.near = preset.fogNear;
    scene.fog.far = preset.fogFar;
  }

  // Save to localStorage
  try { localStorage.setItem("kaduna-graphics", q); } catch (e) {}
}

// ---- Shadow update throttling ----
// Shadow map re-render is the single most expensive per-frame cost on phones
// (a 1024x1024 depth render of the entire scene from the sun's POV). autoUpdate
// forces this every frame, which on mid-range phones burns ~5-8ms per frame
// and accumulates GC pressure until the game stutters.
//
// We turn autoUpdate OFF and manually trigger a shadow update only when:
//   1. The player moved more than SHADOW_MOVE_THRESHOLD metres since last update
//      (shadow camera frustum follows the player, so shadows need to refresh
//      when the player crosses a threshold)
//   2. The sun moved (game-time changed enough to noticeably shift the sun)
//   3. Someone explicitly requested it (e.g. after a quality change)
//
// On Low quality (shadows disabled), this is a no-op.
let _shadowNeedsUpdate = true;     // initial render
let _lastShadowX = Infinity;
let _lastShadowZ = Infinity;
let _lastShadowHour = -1;
const SHADOW_MOVE_THRESHOLD = 4;   // metres — refresh shadow when player crosses this
const SHADOW_HOUR_THRESHOLD = 0.2;  // game-hours — refresh when sun moves this much

export function requestShadowUpdate() { _shadowNeedsUpdate = true; }
function _requestShadowUpdate() { _shadowNeedsUpdate = true; }

// Called from main.js every frame. Decides whether to refresh the shadow map.
export function tickShadows(playerX, playerZ, gameHour, renderer) {
  if (!renderer || !renderer.shadowMap) return;
  if (!renderer.shadowMap.enabled) return;
  // Reason 1: player moved
  const dx = playerX - _lastShadowX;
  const dz = playerZ - _lastShadowZ;
  if (dx * dx + dz * dz > SHADOW_MOVE_THRESHOLD * SHADOW_MOVE_THRESHOLD) {
    _shadowNeedsUpdate = true;
  }
  // Reason 2: sun moved
  if (Math.abs(gameHour - _lastShadowHour) >= SHADOW_HOUR_THRESHOLD) {
    _shadowNeedsUpdate = true;
  }
  // Apply
  if (_shadowNeedsUpdate) {
    renderer.shadowMap.needsUpdate = true;
    _shadowNeedsUpdate = false;
    _lastShadowX = playerX;
    _lastShadowZ = playerZ;
    _lastShadowHour = gameHour;
  }
}

// ---- Auto-detect quality based on device + first 3 seconds of FPS ----
// FEATURE: the user requested "high graphics as default". So we return
// "high" for everyone UNLESS the device is very low-end (mobile with ≤2GB
// RAM or small screen). The user can still manually switch to Low/Medium
// via Settings → Graphics, and the choice is saved to localStorage.
// Previously defaulted to "low" on mobile + "medium" on mid mobile which
// made the game look flat on capable phones.
export function autoDetectQuality() {
  // Check saved preference first
  try {
    const saved = localStorage.getItem("kaduna-graphics");
    if (saved && QUALITY_PRESETS[saved]) return saved;
  } catch (e) {}

  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const smallScreen = Math.min(innerWidth, innerHeight) < 480;

  // FEATURE: default to HIGH for everyone. Only drop to medium for very
  // low-end phones (≤2 cores or ≤2GB RAM or tiny screen). The user can
  // always downgrade in Settings if their device can't keep up.
  if (isMobile && (cores <= 2 || mem <= 2 || smallScreen)) return "medium";
  return "high";
}
