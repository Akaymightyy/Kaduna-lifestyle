// src/art/style.js — the game-wide STYLISED LOW-POLY look (one place, used by world, places, furniture).
//
// What it does (all in the shader, no textures, no extra lights, no extra draw calls):
//   * procedural patterns per vertex (`aPat`): floor tiles, wood planks, plaster, zinc roof, blocks,
//     ankara print, rug motif, curtains, concrete, glass, grass, asphalt, glowing screens/bulbs
//   * soft "hand painted" grain so flat colours never look like plastic
//   * contact darkening where walls/props meet the floor (baked-looking ambient occlusion)
//   * a fake key light for interiors (interiors only have ambient light, so every face looked the same;
//     now tops are bright, sides differ, undersides are dark: shapes finally read)
// Quality: setArtQuality("low"|"medium"|"high") flips uniforms live (no recompile).
import * as THREE from "three";

export const PALETTE = {
  plaster: 0xf1e6cf, cream: 0xe8d3b0, peach: 0xe9c9a4, skyBlue: 0xc7d9e6, mint: 0xcfe0c5, white: 0xf4f1ea,
  wood: 0x8a5a3c, darkWood: 0x4a3322, zinc: 0x9aa3a8, redZinc: 0x9b4a35, laterite: 0xb0603a, tarmac: 0x3a3d43,
  grass: 0x6f9a4a, green: 0x1f7a5a, gold: 0xf2b134, red: 0xc0392b, blue: 0x1d5fa8, ink: 0x1a1a1a,
};

// x = patterns on/off, y = grain, z = contact darkening, w = fake key light strength
// 0 = full day, 1 = full night. One shared uniform: window glow (world.js) and anything else lit at night reads this.
export const NIGHT_GLOW = { value: 0 };

export const ART = { value: new THREE.Vector4(1, 1, 1, 1) };
let _quality = "medium";
const _registry = new Set();           // every stylised material (so a quality change can rebuild only these)

// What each material really compiles with, per quality. LOW costs (almost) nothing: outdoor surfaces become plain Lambert,
// interiors keep only the cheap fake key light. This is what keeps phones smooth.
function effective(opts, q) {
  const o = { pat: !!opts.pat, ao: !!opts.ao, fake: !!opts.fake, grain: !!opts.pat };
  if (q === "low") { o.pat = false; o.grain = false; if (!o.fake) o.ao = false; }
  return o;
}
function applyDefines(mat) {
  const e = effective(mat.userData.artOpts, _quality);
  const d = mat.defines || (mat.defines = {});
  for (const k of ["ART_PAT", "ART_GRAIN", "ART_AO", "ART_FAKE"]) delete d[k];
  if (e.pat) d.ART_PAT = ""; if (e.grain) d.ART_GRAIN = ""; if (e.ao) d.ART_AO = ""; if (e.fake) d.ART_FAKE = "";
  mat.userData.artKey = "art" + (e.pat ? "P" : "") + (e.grain ? "G" : "") + (e.ao ? "A" : "") + (e.fake ? "F" : "");
  mat.userData.artAny = e.pat || e.ao || e.fake;
}
export function setArtQuality(q) {
  if (q === "low") ART.value.set(0, 0, 1, 1);
  else if (q === "high") ART.value.set(1, 1, 1, 1);
  else ART.value.set(1, 0.8, 1, 1);
  if (q === _quality) return;
  _quality = q;
  _registry.forEach((m) => { applyDefines(m); m.needsUpdate = true; });
}

// pattern codes (aPat attribute)
export const PAT = { NONE: 0, TILES: 1, WOOD: 2, PLASTER: 3, ZINC: 4, BLOCK: 5, ANKARA: 6, RUG: 7, CURTAIN: 8, CONCRETE: 9, GLASS: 10, SCREEN: 11, GRASS: 12, ASPHALT: 13, GLOW: 14 };

const VERT_DECL = `
varying vec3 vOP; varying vec3 vWN; varying float vWY; varying float vPat;
#ifdef ART_PAT
attribute float aPat;
#endif
`;
const VERT_BODY = `
vOP = position;
vWN = normalize(mat3(modelMatrix) * normal);
vWY = (modelMatrix * vec4(transformed, 1.0)).y;
#ifdef ART_PAT
vPat = aPat;
#else
vPat = 0.0;
#endif
`;
const FRAG_DECL = `
uniform vec4 uArt;
varying vec3 vOP; varying vec3 vWN; varying float vWY; varying float vPat;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1.,0.)), f.x), mix(h21(i+vec2(0.,1.)), h21(i+vec2(1.,1.)), f.x), f.y); }
vec2 triUV(vec3 p, vec3 n){ vec3 a = abs(n); if (a.y >= a.x && a.y >= a.z) return p.xz; if (a.x >= a.z) return p.zy; return p.xy; }
vec3 artPattern(float code, vec2 uv, vec3 base){
  if (code < 0.5) return base;
  if (code < 1.5) {                                   // floor tiles with grout and tile-to-tile variation
    vec2 t = uv / 0.6; vec2 f = fract(t); vec2 id = floor(t);
    float g = step(f.x, 0.035) + step(f.y, 0.035);
    float v = 0.93 + 0.1 * h21(id);
    return mix(base * v, base * 0.62, clamp(g, 0.0, 1.0));
  }
  if (code < 2.5) {                                   // wood planks
    float row = floor(uv.y / 0.22); float off = h21(vec2(row, 3.1)) * 2.0;
    float seam = step(fract(uv.y / 0.22), 0.05) + step(fract((uv.x + off) / 1.9), 0.012);
    float grain = 0.92 + 0.1 * vn(vec2(uv.x * 2.0 + row * 7.0, uv.y * 40.0));
    float v = 0.9 + 0.14 * h21(vec2(row, floor((uv.x + off) / 1.9)));
    return mix(base * v * grain, base * 0.5, clamp(seam, 0.0, 1.0));
  }
  if (code < 3.5) {                                   // plaster: soft stains
    return base * (0.95 + 0.08 * vn(uv * 2.5) - 0.03 * vn(uv * 9.0));
  }
  if (code < 4.5) {                                   // corrugated zinc roof
    float r = 0.84 + 0.16 * sin(uv.x * 26.0);
    float rust = vn(uv * vec2(1.5, 6.0));
    return base * r * (0.9 + 0.12 * rust) + vec3(0.07, 0.03, 0.0) * smoothstep(0.62, 0.9, rust);
  }
  if (code < 5.5) {                                   // block wall with mortar courses
    float row = floor(uv.y / 0.2); float off = mod(row, 2.0) * 0.225;
    vec2 f = vec2(fract((uv.x + off) / 0.45), fract(uv.y / 0.2));
    float mortar = step(f.x, 0.04) + step(f.y, 0.08);
    return mix(base * (0.94 + 0.08 * h21(vec2(floor((uv.x + off) / 0.45), row))), base * 0.72, clamp(mortar, 0.0, 1.0));
  }
  if (code < 6.5) {                                   // ankara / wax print
    vec2 f = fract(uv / 0.45) - 0.5; vec2 id = floor(uv / 0.45);
    float d = length(f); float ring = smoothstep(0.34, 0.31, d) - smoothstep(0.22, 0.19, d);
    float dia = step(abs(f.x) + abs(f.y), 0.12);
    float k = h21(id);
    vec3 c1 = k < 0.33 ? vec3(0.95, 0.42, 0.08) : (k < 0.66 ? vec3(0.96, 0.78, 0.15) : vec3(0.08, 0.28, 0.65));
    vec3 col = mix(base * 0.75, c1, ring);
    col = mix(col, vec3(0.05, 0.05, 0.07), dia);
    float zig = step(0.47, abs(f.y)) * 0.6;
    return mix(col, base * 1.2, zig);
  }
  if (code < 7.5) {                                   // rug / prayer mat motif
    vec2 f = fract(uv / 0.4) - 0.5;
    float dia = step(abs(f.x) + abs(f.y), 0.26) - step(abs(f.x) + abs(f.y), 0.17);
    return mix(base * 0.82, min(base * 1.6 + 0.16, vec3(1.0)), clamp(dia, 0.0, 1.0)) * (0.96 + 0.06 * h21(floor(uv * 30.0)));
  }
  if (code < 8.5) {                                   // curtain folds
    float s = 0.78 + 0.22 * sin(uv.x * 34.0);
    return base * s * (0.92 + 0.1 * smoothstep(0.0, 2.0, uv.y));
  }
  if (code < 9.5) {                                   // concrete
    return base * (0.9 + 0.14 * h21(floor(uv * 36.0))) * (0.94 + 0.08 * vn(uv * 1.7));
  }
  if (code < 10.5) {                                  // glass with diagonal shine
    float sh = smoothstep(0.0, 0.25, fract((uv.x + uv.y) * 0.8)) * 0.25;
    return base * (0.85 + sh);
  }
  if (code < 11.5) {                                  // glowing screen (green pitch with lines)
    float lines = step(abs(fract(uv.x * 1.6) - 0.5), 0.02);
    return base * (0.8 + 0.35 * vn(uv * 30.0)) + vec3(0.25) * lines;
  }
  if (code < 12.5) {                                  // grass speckle
    return base * (0.88 + 0.16 * vn(uv * 1.3) + 0.08 * h21(floor(uv * 22.0)));
  }
  if (code < 13.5) {                                  // asphalt
    return base * (0.88 + 0.2 * h21(floor(uv * 60.0))) * (0.95 + 0.08 * vn(uv * 0.8));
  }
  return base;                                        // 14 = plain glow
}
`;
const FRAG_BODY = `
{
  vec3 col = diffuseColor.rgb;
  vec2 puv = triUV(vOP, vWN);
  #ifdef ART_PAT
    if (uArt.x > 0.5 && vPat > 0.5) col = artPattern(vPat, puv, col);
  #endif
  // hand-painted grain (only on surfaces that have patterns, never on big outdoor planes)
  #ifdef ART_GRAIN
    col *= 1.0 + (h21(floor(puv * 7.0)) - 0.5) * 0.06 * uArt.y;
  #endif
  // contact darkening on vertical surfaces near the ground
  #ifdef ART_AO
    float grad = mix(0.7, 1.0, smoothstep(0.0, 1.5, vWY));
    col *= mix(1.0, grad, uArt.z * (1.0 - abs(vWN.y)));
  #endif
  // fake key light for ambient-only interiors
  #ifdef ART_FAKE
    float kf = dot(normalize(vWN), normalize(vec3(0.45, 0.78, 0.38))) * 0.5 + 0.5;
    col *= mix(1.0, mix(0.68, 1.16, kf), uArt.w);
  #endif
  diffuseColor.rgb = col;
}
`;
const FRAG_GLOW = `
#ifdef ART_PAT
  if (vPat > 10.5 && vPat < 11.5 || vPat > 13.5 && vPat < 14.5) outgoingLight = diffuseColor.rgb * 1.15;
#endif
`;

/** Patch any MeshLambertMaterial with the stylised look. flags: { pat, ao, fake } */
export function stylize(mat, { pat = true, ao = true, fake = false } = {}) {
  mat.userData.artOpts = { pat, ao, fake };
  mat.userData.styled = true;
  applyDefines(mat);
  _registry.add(mat);
  mat.onBeforeCompile = (shader) => {
    if (!mat.userData.artAny) return;                 // nothing to add: stays a plain Lambert shader
    shader.uniforms.uArt = ART;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\n" + VERT_DECL)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n" + VERT_BODY);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + FRAG_DECL)
      .replace("#include <color_fragment>", "#include <color_fragment>\n" + FRAG_BODY)
      .replace("#include <opaque_fragment>", FRAG_GLOW + "\n#include <opaque_fragment>");
  };
  mat.customProgramCacheKey = () => mat.userData.artKey;
  return mat;
}

const _shared = {};
/** Shared styled material (vertex-coloured). kind: "interior" (fake key light) | "outdoor" */
export function styledMaterial(kind = "interior", extra = {}) {
  const k = kind + JSON.stringify(extra);
  if (!_shared[k]) {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true, ...extra });
    stylize(m, { pat: true, ao: true, fake: kind === "interior" });
    m.userData.shared = true;
    _shared[k] = m;
  }
  return _shared[k];
}
