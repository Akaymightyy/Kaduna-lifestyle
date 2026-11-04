// src/gigs.js — HUSTLE GIGS (Nov 4): okada rider, POS agent, suya seller.
//
// Claude's fix-list #2: "Jobs and daily tasks: okada rider, POS agent, suya seller,
// mechanic. Each gives money and a different outfit, like a uniform."
//
// A gig is a place activity: walk to the stand, tap the gig button, the character
// works a short on-the-spot shift (busy animation from activity.js placeSpec), and
// when the shift FINISHES the place's onUIEvent calls runGig() — you get paid and
// put on the job's uniform for the day (switch back anytime in Wardrobe).
// Walking away mid-shift cancels it and pays nothing (onDone(ok=false)).

import { GIG_UNIFORMS } from "./outfits.js";

export const GIGS = {
  suya_gig:  { pay: 1500, energy: 12, cd: 600, place: "suya_spot",     boss: "Mallam Audu" },
  pos_gig:   { pay: 1200, energy: 10, cd: 600, place: "central_market", boss: "Mama Nkechi" },
  okada_gig: { pay: 1800, energy: 14, cd: 600, place: "kawo_park",      boss: "Alhaji Tanko" },
};

const _key = (eid) => "kl_gig_" + eid;

export function gigCooldownLeft(eid) {
  const g = GIGS[eid]; if (!g) return 0;
  try {
    const last = parseInt(localStorage.getItem(_key(eid)) || "0", 10);
    return Math.max(0, g.cd - Math.floor((Date.now() - last) / 1000));
  } catch (e) { return 0; }
}

// Called by the place's onUIEvent AFTER the shift animation completes (ok path only).
export function runGig(eid, ctx) {
  const g = GIGS[eid];
  const uni = GIG_UNIFORMS[eid];
  if (!g || !ctx?.game) return;
  if (gigCooldownLeft(eid) > 0) { ctx.toast?.("Ease small — " + g.boss + " no need you again yet. Come back later."); return; }
  try { localStorage.setItem(_key(eid), String(Date.now())); } catch (e) {}
  const s = ctx.game.state;
  s.money += g.pay;
  s.needs.energy = Math.max(0, (s.needs.energy || 0) - g.energy);
  s.needs.fun = Math.max(0, Math.min(100, (s.needs.fun || 0) + 4));
  s.needs.social = Math.max(0, Math.min(100, (s.needs.social || 0) + 6));
  ctx.game.save?.();
  ctx.updateHUD?.();
  // the uniform: paint it on through the live look pipeline (save + Firebase + recolor)
  if (uni && typeof window !== "undefined" && window._applyUniform) window._applyUniform(uni);
  ctx.toast?.("💼 " + (uni ? uni.name : "Shift") + " done — ₦" + g.pay.toLocaleString() + " earned!" + (uni ? " You dey wear the uniform — change am for Wardrobe anytime." : ""));
}
