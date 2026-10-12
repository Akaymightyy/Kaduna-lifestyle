// src/outfits.js — outfit presets (colour sets + style) for men and women, used by the sign-up
// character creator and the in-game wardrobe. All original colour schemes.
export const MEN_OUTFITS = [
  { id: "m-casual", name: "Casual Tee & Jeans", top: "#1f7a5a", bottom: "#2b3a55", shoes: "#f2f2ee", topStyle: "casual", bottomStyle: "trousers" },
  { id: "m-kaftan", name: "Kaftan (white)", top: "#f4efe4", bottom: "#f4efe4", shoes: "#8a5a3c", topStyle: "kaftan", bottomStyle: "trousers" },
  { id: "m-baban", name: "Baban Riga (sky)", top: "#9fc2d9", bottom: "#9fc2d9", shoes: "#8a5a3c", topStyle: "kaftan", bottomStyle: "trousers" },
  { id: "m-senator", name: "Senator (navy)", top: "#2d3a4a", bottom: "#2d3a4a", shoes: "#222222", topStyle: "kaftan", bottomStyle: "trousers" },
  { id: "m-street", name: "Street (red tee, shorts)", top: "#c0392b", bottom: "#3b3b3b", shoes: "#f2f2ee", topStyle: "casual", bottomStyle: "shorts" },
  { id: "m-corporate", name: "Corporate (blue shirt)", top: "#3c8dbc", bottom: "#1f2a36", shoes: "#222222", topStyle: "casual", bottomStyle: "trousers" },
];
export const WOMEN_OUTFITS = [
  { id: "w-ankara", name: "Ankara Gown (gold)", top: "#d98e2b", bottom: "#a23b72", shoes: "#222222", topStyle: "kaftan", bottomStyle: "gown" },
  { id: "w-abaya", name: "Abaya (black)", top: "#2e2e2e", bottom: "#2e2e2e", shoes: "#222222", topStyle: "kaftan", bottomStyle: "gown" },
  { id: "w-hijab-set", name: "Modest set (sage)", top: "#7aa58a", bottom: "#d9c7a0", shoes: "#f2f2ee", topStyle: "kaftan", bottomStyle: "gown" },
  { id: "w-blouse", name: "Blouse & Skirt (purple)", top: "#6b4a8a", bottom: "#2b3a55", shoes: "#c0392b", topStyle: "casual", bottomStyle: "skirt" },
  { id: "w-casual", name: "Crop top & Jeans", top: "#e8c547", bottom: "#44546a", shoes: "#f2f2ee", topStyle: "casual", bottomStyle: "trousers" },
  { id: "w-gown", name: "Evening Gown (wine)", top: "#a23b72", bottom: "#a23b72", shoes: "#222222", topStyle: "kaftan", bottomStyle: "gown" },
];
export const outfitsFor = (gender) => (gender === "female" ? WOMEN_OUTFITS : MEN_OUTFITS);
export const SKINS = ["#f1c9a5", "#c28a5c", "#a5714a", "#8a5a3c", "#7a4b2e", "#6b4429", "#5a3825", "#3d2517"];
export const HAIRS = ["#111111", "#2a1e14", "#4a3322", "#7a5a3a", "#c9b38a", "#a23b72", "#1d5fa8", "#f2f2ee"];
export const BUILDS = [
  { id: "slim", label: "Slim" },
  { id: "normal", label: "Normal" },
  { id: "big", label: "Big" },
];

// ---- Boutique catalogue. slot: outfit | head | shoes | wrist.  for: m | f | any ----
export const SHOP = [
  { id: "ankara", name: "Ankara Native", emoji: "👗", price: 3000, slot: "outfit", for: "m", desc: "Bold African print colours", patch: { top: "#d98e2b", bottom: "#a23b72", topStyle: "kaftan", bottomStyle: "trousers" }, fun: 15 },
  { id: "ankara-gown", name: "Ankara Gown", emoji: "👗", price: 3000, slot: "outfit", for: "f", desc: "Bold African print colours", patch: { top: "#d98e2b", bottom: "#a23b72", topStyle: "kaftan", bottomStyle: "gown" }, fun: 15 },
  { id: "babanriga", name: "Baban Riga", emoji: "🧥", price: 8000, slot: "outfit", for: "m", desc: "Northern Nigeria traditional", patch: { top: "#9fc2d9", bottom: "#9fc2d9", topStyle: "kaftan", bottomStyle: "trousers" }, social: 20 },
  { id: "agbada", name: "Agbada Set", emoji: "🥻", price: 6500, slot: "outfit", for: "m", desc: "Flowing robe", patch: { top: "#f4efe4", bottom: "#c9b38a", topStyle: "kaftan", bottomStyle: "trousers" }, social: 15 },
  { id: "senator", name: "Senator Suit", emoji: "🧑‍💼", price: 7000, slot: "outfit", for: "m", desc: "Navy senator wear", patch: { top: "#2d3a4a", bottom: "#2d3a4a", topStyle: "kaftan", bottomStyle: "trousers" }, social: 12 },
  { id: "abaya", name: "Abaya", emoji: "🧕", price: 5000, slot: "outfit", for: "f", desc: "Elegant black abaya", patch: { top: "#2e2e2e", bottom: "#2e2e2e", topStyle: "kaftan", bottomStyle: "gown" }, social: 12 },
  { id: "gown", name: "Evening Gown", emoji: "👗", price: 9000, slot: "outfit", for: "f", desc: "Wine evening gown", patch: { top: "#a23b72", bottom: "#a23b72", topStyle: "kaftan", bottomStyle: "gown" }, fun: 15 },
  { id: "kufi", name: "Kufi Cap", emoji: "🎩", price: 1500, slot: "head", for: "any", desc: "White traditional cap", acc: "kufi" },
  { id: "sneakers", name: "Designer Sneakers", emoji: "👟", price: 4000, slot: "shoes", for: "any", desc: "Fresh white sneakers", patch: { shoes: "#ffffff" } },
  { id: "watch", name: "Gold Watch", emoji: "⌚", price: 12000, slot: "wrist", for: "any", desc: "Status symbol", acc: "watch" },
];
export const SLOT_KEYS = { outfit: ["top", "bottom", "topStyle", "bottomStyle"], shoes: ["shoes"], head: [], wrist: [] };
