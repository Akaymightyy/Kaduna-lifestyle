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
  if (_sky) {
    const phi = THREE.MathUtils.degToRad(90 - elevation * 90); // 0=horizon, 90=zenith
    const theta = THREE.MathUtils.degToRad(azimuth * 180);
    const sunPos = new THREE.Vector3();
    sunPos.setFromSphericalCoords(1, phi, theta);
    _sky.material.uniforms["sunPosition"].value.copy(sunPos);
    _sky.material.uniforms["exposure"].value = _renderer.toneMappingExposure;

    // Adjust turbidity/rayleigh for time of day
    const isNight = elevation < 0.05;
    const isDawnDusk = elevation > 0.05 && elevation < 0.25;
    if (isNight) {
      _sky.material.uniforms["rayleigh"].value = 0.5;
      _sky.material.uniforms["turbidity"].value = 0.5;
    } else if (isDawnDusk) {
      _sky.material.uniforms["rayleigh"].value = 3;
      _sky.material.uniforms["turbidity"].value = 12;
    } else {
      _sky.material.uniforms["rayleigh"].value = 2;
      _sky.material.uniforms["turbidity"].value = 8;
    }
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
  _quality = q;
  try { setArtQuality(q); } catch (e) {}

  renderer.setPixelRatio(Math.min(preset.pixelRatio, devicePixelRatio));
  renderer.shadowMap.enabled = preset.shadows;
  if (preset.shadows && sun) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(preset.shadowMap, preset.shadowMap);
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

// ---- Auto-detect quality based on device + first 3 seconds of FPS ----
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

  if (isMobile && (cores <= 4 || mem <= 3 || smallScreen)) return "low";
  if (isMobile) return "medium";
  return "high";
}
