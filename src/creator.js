// src/creator.js — "Create your character" sheet: boy/girl, build (slim/normal/big), skin, hair, outfit.
// Shown once after sign-up (look.created missing). Live preview = the real player model behind the sheet.
import { outfitsFor, SKINS, HAIRS, BUILDS } from "./outfits.js";

export function openCreator({ look, onChange, onDone }) {
  let el = document.getElementById("creator-sheet");
  if (el) el.remove();
  const L = { ...look };
  el = document.createElement("div");
  el.id = "creator-sheet";
  el.style.cssText = "position:fixed;left:0;right:0;bottom:0;max-height:46vh;overflow-y:auto;z-index:60;background:#fffaf0;border-radius:18px 18px 0 0;padding:14px 14px calc(16px + env(safe-area-inset-bottom));box-shadow:0 -8px 30px rgba(0,0,0,.35);font-family:inherit;color:#1a1a1a";
  document.body.appendChild(el);
  const chip = (label, on, fn) => `<button data-f="${fn}" style="padding:9px 14px;margin:3px;border-radius:10px;border:2px solid ${on ? "#0f4d3a" : "#ddd"};background:${on ? "#0f4d3a" : "#fff"};color:${on ? "#fff" : "#0f4d3a"};font-weight:700;font-size:13px;cursor:pointer">${label}</button>`;
  const dot = (c, on, fn) => `<button data-f="${fn}" style="width:34px;height:34px;margin:3px;border-radius:50%;border:${on ? "3px solid #0f4d3a" : "1px solid #ccc"};background:${c};cursor:pointer"></button>`;
  const sec = (t, body) => `<div style="margin-bottom:10px"><div style="font-size:12px;font-weight:700;margin-bottom:4px;color:#0f4d3a">${t}</div><div style="display:flex;flex-wrap:wrap">${body}</div></div>`;
  const handlers = {};
  function render() {
    const outs = outfitsFor(L.gender);
    handlers.gender = (v) => { if (L.gender !== v) { L.gender = v; const o = outfitsFor(v)[0]; Object.assign(L, o, { gender: v }); change(); } };
    el.innerHTML = `<div style="font-size:17px;font-weight:800;color:#0f4d3a;margin-bottom:8px">🧑🏾 Create your character</div>` +
      sec("I am a", chip("👦 Boy / Man", L.gender !== "female", "gender:male") + chip("👧 Girl / Woman", L.gender === "female", "gender:female")) +
      sec("Body", BUILDS.map((b) => chip(b.label, (L.build || "normal") === b.id, "build:" + b.id)).join("")) +
      sec("Skin", SKINS.map((c) => dot(c, L.skin === c, "skin:" + c)).join("")) +
      sec("Hair", HAIRS.map((c) => dot(c, L.hair === c, "hair:" + c)).join("")) +
      sec("Outfit", outs.map((o) => chip(o.name, L.outfitId === o.id, "outfit:" + o.id)).join("")) +
      `<button id="cr-done" style="width:100%;margin-top:6px;background:#0f4d3a;color:#fff;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:800;cursor:pointer">✓ Start playing</button>`;
    el.querySelectorAll("button[data-f]").forEach((b) => (b.onclick = () => {
      const [k, ...r] = b.dataset.f.split(":"), v = r.join(":");
      if (k === "gender") return handlers.gender(v);
      if (k === "outfit") { const o = outs.find((x) => x.id === v); Object.assign(L, o, { outfitId: v }); }
      else L[k] = v;
      change();
    }));
    el.querySelector("#cr-done").onclick = () => { L.created = true; el.remove(); onDone(L); };
  }
  function change() { onChange({ ...L }); render(); }
  if (!L.outfitId) { const o = outfitsFor(L.gender)[0]; Object.assign(L, o, { outfitId: o.id }); }
  render();
}
